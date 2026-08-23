import assert from 'node:assert/strict';
import { build } from 'esbuild';

const user = (uid) => ({ uid, displayName: uid, email: `${uid}@example.com` });

const state = {
    firebaseUser: user('existing-user'),
    signOutShouldFail: false,
    initializeProfilesShouldFail: false,
    firebaseSignOutCalls: 0,
    restoreGuestCalls: 0,
    cloudFlushCalls: 0,
    cloudDisconnects: [],
};

globalThis.window = { dispatchEvent: () => true };
if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
        constructor(type) { this.type = type; }
    };
}

globalThis.__okuAuthTestFirebase = {
    addListener: async () => ({ remove: async () => undefined }),
    getCurrentUser: async () => ({ user: state.firebaseUser }),
    signInWithApple: async () => ({ user: state.firebaseUser }),
    signInWithGoogle: async () => {
        state.firebaseUser = user('google-user');
        return { user: state.firebaseUser };
    },
    signOut: async () => {
        state.firebaseSignOutCalls += 1;
        if (state.signOutShouldFail) throw new Error('native sign out failed');
        state.firebaseUser = null;
    },
};

globalThis.__okuAuthTestStorage = {
    captureGuestProfile: async () => undefined,
    initializeProfiles: async () => {
        if (state.initializeProfilesShouldFail) throw new Error('profile switch failed');
    },
    restoreGuestProfile: async () => { state.restoreGuestCalls += 1; },
    isAccountProfileActive: () => true,
    restorePermanentPurchases: () => undefined,
};

globalThis.__okuAuthTestCloud = {
    connect: async () => ({ synced: true, usedCloudData: false, profileActivated: true }),
    disconnect: async (options) => { state.cloudDisconnects.push(options); },
    flush: async () => { state.cloudFlushCalls += 1; },
};

const bundle = await build({
    entryPoints: ['utils/auth.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: false,
    logLevel: 'silent',
    plugins: [{
        name: 'mock-auth-dependencies',
        setup(buildApi) {
            buildApi.onResolve({ filter: /^@capacitor\/core$/ }, () => ({
                path: 'mock-core', namespace: 'auth-test',
            }));
            buildApi.onResolve({ filter: /^@capacitor-firebase\/authentication$/ }, () => ({
                path: 'mock-firebase-auth', namespace: 'auth-test',
            }));
            buildApi.onResolve({ filter: /^\.\/storage$/ }, () => ({
                path: 'mock-storage', namespace: 'auth-test',
            }));
            buildApi.onResolve({ filter: /^\.\/cloudSave$/ }, () => ({
                path: 'mock-cloud', namespace: 'auth-test',
            }));
            buildApi.onResolve({ filter: /^\.\/iap$/ }, () => ({
                path: 'mock-iap', namespace: 'auth-test',
            }));
            buildApi.onLoad({ filter: /^mock-core$/, namespace: 'auth-test' }, () => ({
                loader: 'js',
                contents: `export const Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };`,
            }));
            buildApi.onLoad({ filter: /^mock-firebase-auth$/, namespace: 'auth-test' }, () => ({
                loader: 'js',
                contents: 'export const FirebaseAuthentication = globalThis.__okuAuthTestFirebase;',
            }));
            buildApi.onLoad({ filter: /^mock-storage$/, namespace: 'auth-test' }, () => ({
                loader: 'js',
                contents: 'export const Storage = globalThis.__okuAuthTestStorage;',
            }));
            buildApi.onLoad({ filter: /^mock-cloud$/, namespace: 'auth-test' }, () => ({
                loader: 'js',
                contents: `export const CloudSave = globalThis.__okuAuthTestCloud; export const CLOUD_DATA_UPDATED_EVENT = 'cloud-update';`,
            }));
            buildApi.onLoad({ filter: /^mock-iap$/, namespace: 'auth-test' }, () => ({
                loader: 'js',
                contents: 'export const IAP = { syncAppUserID: async () => null };',
            }));
        },
    }],
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { Auth } = await import(moduleUrl);
await Auth.initialize();

// A rejected native sign-out must leave CloudSave attached; only a successful
// Firebase sign-out is allowed to disconnect it.
state.signOutShouldFail = true;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = () => undefined;
console.warn = () => undefined;
const failedSignOut = await Auth.signOut();
console.error = originalConsoleError;
console.warn = originalConsoleWarn;
assert.equal(failedSignOut.status, 'failed');
assert.equal(state.cloudFlushCalls, 1);
assert.equal(state.cloudDisconnects.length, 0);
assert.equal(Auth.getUser().uid, 'existing-user');

// Once an OAuth provider returned a user, a later profile-switch failure must
// undo Firebase Auth, detach that attempted UID, and restore the guest.
state.signOutShouldFail = false;
state.initializeProfilesShouldFail = true;
console.error = () => undefined;
console.warn = () => undefined;
const failedSignIn = await Auth.signIn('google');
console.error = originalConsoleError;
console.warn = originalConsoleWarn;
assert.equal(failedSignIn.status, 'failed');
assert.equal(state.firebaseUser, null);
assert.equal(Auth.getUser(), null);
assert.equal(state.restoreGuestCalls, 1);
assert.ok(state.cloudDisconnects.some(({ flush }) => flush === false));

console.log('Authentication rollback checks passed.');
