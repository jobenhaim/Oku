import { Capacitor } from '@capacitor/core';
import {
    FirebaseAuthentication,
    type User,
} from '@capacitor-firebase/authentication';
import { IAP } from './iap';
import { Storage } from './storage';
import { CloudSave, CLOUD_DATA_UPDATED_EVENT } from './cloudSave';

export type OkuAuthProvider = 'apple' | 'google';

export type AuthActionResult =
    | { status: 'signed-in'; user: User; purchasesSynced: boolean; cloudSynced: boolean }
    | { status: 'signed-out'; purchasesSynced: boolean }
    | { status: 'cancelled' }
    | { status: 'failed'; message: string };

type AuthListener = (user: User | null) => void;

const isCancellationError = (error: unknown) => {
    const record = error && typeof error === 'object'
        ? error as Record<string, unknown>
        : {};
    const details = `${record.code ?? ''} ${record.message ?? error ?? ''}`.toLowerCase();

    return details.includes('cancel') || details.includes('canceled') || details.includes('cancelled');
};

const getFriendlyAuthError = (error: unknown) => {
    const record = error && typeof error === 'object'
        ? error as Record<string, unknown>
        : {};
    const details = `${record.code ?? ''} ${record.message ?? error ?? ''}`.toLowerCase();

    if (details.includes('network')) {
        return 'Please check your connection and try again.';
    }
    if (details.includes('account-exists-with-different-credential')) {
        return 'This email is already connected to another sign-in method.';
    }
    if (details.includes('provider') && details.includes('enabled')) {
        return 'This sign-in method is not available yet.';
    }

    return 'Sign in did not work. Please try again.';
};

class AuthManager {
    private initialized = false;
    private initializePromise: Promise<void> | null = null;
    private currentUser: User | null = null;
    private listeners = new Set<AuthListener>();

    isAvailable() {
        return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
    }

    getUser() {
        return this.currentUser;
    }

    subscribe(listener: AuthListener) {
        this.listeners.add(listener);
        listener(this.currentUser);

        return () => {
            this.listeners.delete(listener);
        };
    }

    async initialize() {
        if (this.initialized) return;
        if (this.initializePromise) return this.initializePromise;

        this.initializePromise = this.initializeInternal();
        await this.initializePromise;
    }

    /**
     * Select the correct local profile after Firebase restores its session.
     * Existing account caches can open offline; a half-finished first sign-in
     * is rolled back to the untouched guest profile.
     */
    async activateStoredSession() {
        await this.initialize();
        const uid = this.currentUser?.uid ?? null;
        await Storage.initializeProfiles(uid);
        if (!uid) return null;

        const hadAccountCache = Storage.isAccountProfileActive(uid);
        const cloudResult = await CloudSave.connect(uid);
        if (cloudResult.profileActivated || hadAccountCache) return uid;

        try {
            await FirebaseAuthentication.signOut();
        } catch (error) {
            console.warn('Auth: Could not clear an incomplete restored session', error);
        }
        this.setUser(null);
        await Storage.restoreGuestProfile();
        this.notifyProfileChanged();
        return null;
    }

    private async initializeInternal() {
        if (!this.isAvailable()) {
            this.initialized = true;
            return;
        }

        try {
            await FirebaseAuthentication.addListener('authStateChange', ({ user }) => {
                this.setUser(user);
            });

            const { user } = await FirebaseAuthentication.getCurrentUser();
            this.setUser(user);
        } catch (error) {
            console.error('Auth: Failed to read the current account', error);
        } finally {
            this.initialized = true;
        }
    }

    async signIn(provider: OkuAuthProvider): Promise<AuthActionResult> {
        if (!this.isAvailable()) {
            return {
                status: 'failed',
                message: 'Sign in can be tested in the iPhone or iPad app.',
            };
        }

        await this.initialize();

        let providerUser: User | null = null;
        try {
            // Preserve the local guest exactly as it is before Firebase changes
            // identity. It is restored verbatim on sign-out.
            await Storage.captureGuestProfile();

            const result = provider === 'apple'
                ? await FirebaseAuthentication.signInWithApple()
                : await FirebaseAuthentication.signInWithGoogle();

            if (!result.user) {
                return { status: 'failed', message: 'No account was returned. Please try again.' };
            }
            providerUser = result.user;

            // Finish any previous account's work before selecting this UID's
            // isolated local cache. This also makes an offline sign-out/sign-in
            // round trip recover the account snapshot that has not reached
            // Firestore yet.
            await CloudSave.disconnect({ flush: true });
            await Storage.initializeProfiles(result.user.uid);
            this.setUser(result.user);
            const cloudResult = await CloudSave.connect(result.user.uid);
            if (!cloudResult.profileActivated) {
                await CloudSave.disconnect({ flush: false });
                await FirebaseAuthentication.signOut();
                this.setUser(null);
                await Storage.restoreGuestProfile();
                this.notifyProfileChanged();
                return {
                    status: 'failed',
                    message: 'Your account could not be loaded. Please check your connection and try again.',
                };
            }

            const purchasesSynced = await this.syncPurchaseIdentity(result.user.uid);
            this.notifyProfileChanged();
            return {
                status: 'signed-in',
                user: result.user,
                purchasesSynced,
                cloudSynced: cloudResult.synced,
            };
        } catch (error) {
            // Once the provider returned a Firebase user, every remaining step
            // is part of one profile switch. Roll the whole switch back if
            // local-cache selection or cloud bootstrap fails so Firebase Auth,
            // CloudSave, and the active local profile cannot disagree.
            if (providerUser) {
                try {
                    await CloudSave.disconnect({ flush: false });
                    await FirebaseAuthentication.signOut();
                } catch (rollbackError) {
                    console.warn('Auth: Could not fully roll back failed sign in', rollbackError);
                }
                this.setUser(null);
                await Storage.restoreGuestProfile();
                this.notifyProfileChanged();
            }

            if (isCancellationError(error)) {
                return { status: 'cancelled' };
            }

            console.error(`Auth: ${provider} sign in failed`, error);
            return { status: 'failed', message: getFriendlyAuthError(error) };
        }
    }

    async signOut(): Promise<AuthActionResult> {
        if (!this.isAvailable()) {
            this.setUser(null);
            await Storage.restoreGuestProfile();
            this.notifyProfileChanged();
            return { status: 'signed-out', purchasesSynced: true };
        }

        try {
            // Try the final upload while CloudSave is still attached. A network
            // failure is safe because the UID-scoped account cache is durable;
            // sign-out may continue and the cache will reconcile next sign-in.
            // Crucially, if native sign-out itself fails, CloudSave remains
            // connected and later gameplay can still sync in this session.
            try {
                await CloudSave.flush();
            } catch (flushError) {
                console.warn('Auth: Final cloud save will retry next sign in', flushError);
            }
            await FirebaseAuthentication.signOut();
            await CloudSave.disconnect({ flush: false });
            this.setUser(null);
            await Storage.restoreGuestProfile();
            // Switch RevenueCat back to its guest identity, but do not rewrite
            // the restored guest profile with the account's purchase flags.
            const purchasesSynced = await this.syncPurchaseIdentity(null, false);
            this.notifyProfileChanged();
            return { status: 'signed-out', purchasesSynced };
        } catch (error) {
            console.error('Auth: Sign out failed', error);
            return { status: 'failed', message: 'Sign out did not work. Please try again.' };
        }
    }

    private setUser(user: User | null) {
        this.currentUser = user;
        this.listeners.forEach((listener) => listener(user));
    }

    private notifyProfileChanged() {
        window.dispatchEvent(new CustomEvent(CLOUD_DATA_UPDATED_EVENT));
    }

    private async syncPurchaseIdentity(appUserID: string | null, applyOwnership = true) {
        const ownership = await IAP.syncAppUserID(appUserID);
        if (!ownership) return false;

        if (applyOwnership) Storage.restorePermanentPurchases(ownership);
        return true;
    }
}

export const Auth = new AuthManager();
