import { Capacitor } from '@capacitor/core';
import {
    FirebaseAuthentication,
    type User,
} from '@capacitor-firebase/authentication';
import { IAP } from './iap';
import { Storage } from './storage';
import { CloudSave } from './cloudSave';

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

        try {
            const result = provider === 'apple'
                ? await FirebaseAuthentication.signInWithApple()
                : await FirebaseAuthentication.signInWithGoogle();

            if (!result.user) {
                return { status: 'failed', message: 'No account was returned. Please try again.' };
            }

            this.setUser(result.user);
            const cloudResult = await CloudSave.connect(result.user.uid);
            const purchasesSynced = await this.syncPurchaseIdentity(result.user.uid);
            return {
                status: 'signed-in',
                user: result.user,
                purchasesSynced,
                cloudSynced: cloudResult.synced,
            };
        } catch (error) {
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
            return { status: 'signed-out', purchasesSynced: true };
        }

        try {
            // Firestore writes require the current Firebase session, so finish
            // the queued save before ending that session.
            await CloudSave.disconnect({ flush: true });
            await FirebaseAuthentication.signOut();
            this.setUser(null);
            const purchasesSynced = await this.syncPurchaseIdentity(null);
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

    private async syncPurchaseIdentity(appUserID: string | null) {
        const ownership = await IAP.syncAppUserID(appUserID);
        if (!ownership) return false;

        Storage.restorePermanentPurchases(ownership);
        return true;
    }
}

export const Auth = new AuthManager();
