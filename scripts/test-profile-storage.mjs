import assert from 'node:assert/strict';
import { build } from 'esbuild';

const nativePreferences = new Map();
globalThis.__okuTestPreferences = nativePreferences;

const localValues = new Map();
globalThis.localStorage = {
    getItem: (key) => localValues.get(key) ?? null,
    setItem: (key, value) => localValues.set(key, String(value)),
    removeItem: (key) => localValues.delete(key),
    clear: () => localValues.clear(),
    key: (index) => [...localValues.keys()][index] ?? null,
    get length() { return localValues.size; },
};

const bundle = await build({
    entryPoints: ['utils/storage.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: false,
    logLevel: 'silent',
    plugins: [{
        name: 'mock-capacitor-preferences',
        setup(buildApi) {
            buildApi.onResolve({ filter: /^@capacitor\/preferences$/ }, () => ({
                path: 'mock-preferences',
                namespace: 'oku-test',
            }));
            buildApi.onLoad({ filter: /.*/, namespace: 'oku-test' }, () => ({
                loader: 'js',
                contents: `
                    const values = globalThis.__okuTestPreferences;
                    export const Preferences = {
                        get: async ({ key }) => ({ value: values.get(key) ?? null }),
                        set: async ({ key, value }) => { values.set(key, value); },
                        remove: async ({ key }) => { values.delete(key); },
                    };
                `,
            }));
        },
    }],
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { Storage } = await import(moduleUrl);

const withIdentity = (data, identity, points) => ({
    ...data,
    points,
    progress: {
        [`${identity}-1`]: {
            levelId: 1,
            difficulty: 'Easy',
            status: 'completed',
            timeElapsed: 30,
            bestTime: 30,
        },
    },
    purchasedBackgrounds: ['bg-default', identity],
    selectedBackground: identity,
    lastModifiedAt: points,
});

const originalGuest = withIdentity(Storage.createDefaultData(), 'guest', 111);
await Storage.replaceStoredData(originalGuest);
await Storage.initializeProfiles(null);
assert.deepEqual(Storage.getActiveProfile(), { kind: 'guest' });
assert.equal(Storage.getGuestProfile().points, 111);

// Switching to an account never mutates the guest slot.
const account = withIdentity(Storage.createDefaultData(), 'account', 999);
await Storage.replaceStoredData(account);
await Storage.activateAccountProfile('user-1');
assert.equal(Storage.getStoredData().points, 999);
assert.equal(Storage.getGuestProfile().points, 111);

// Resetting a signed-in profile must not reset the saved guest.
await Storage.resetAllData();
assert.equal(Storage.getStoredData().points, 0);
assert.equal(Storage.getGuestProfile().points, 111);

// Sign-out restores the exact guest snapshot, including its own progress.
await Storage.restoreGuestProfile();
assert.deepEqual(Storage.getActiveProfile(), { kind: 'guest' });
assert.equal(Storage.getStoredData().points, 111);
assert.ok(Storage.getStoredData().progress['guest-1']);
assert.equal(Storage.getStoredData().progress['account-1'], undefined);

// An account that signs out before its offline changes reach Firestore keeps a
// UID-scoped local cache. Signing into that UID again must restore the account,
// never convert/merge the currently visible guest profile.
const offlineAccount = withIdentity(Storage.createDefaultData(), 'offline-account', 777);
await Storage.replaceStoredData(offlineAccount);
await Storage.activateAccountProfile('user-offline');
Storage.addPoints(1);
await Storage.restoreGuestProfile();
assert.equal(Storage.getStoredData().points, 111);

await Storage.initializeProfiles('user-offline');
assert.deepEqual(Storage.getActiveProfile(), { kind: 'account', uid: 'user-offline' });
assert.equal(Storage.getStoredData().points, 778);
assert.ok(Storage.getStoredData().progress['offline-account-1']);
assert.equal(Storage.getStoredData().progress['guest-1'], undefined);

await Storage.restoreGuestProfile();
assert.equal(Storage.getStoredData().points, 111);

// Resetting while playing as a guest replaces both the active and backup copy.
await Storage.resetAllData();
assert.equal(Storage.getStoredData().points, 0);
assert.equal(Storage.getGuestProfile().points, 0);
assert.deepEqual(Storage.getGuestProfile().progress, {});

console.log('Profile storage transition checks passed.');
