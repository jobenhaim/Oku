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
                        set: async ({ key, value }) => {
                            if (globalThis.__okuFailGuestWrite && key === 'oku_guest_profile_v1') {
                                globalThis.__okuFailGuestWrite = false;
                                throw new Error('Expected simulated guest write failure');
                            }
                            values.set(key, value);
                        },
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
assert.equal(Storage.getStoredData().purchaseRestoreRequired, true);
assert.notEqual(Storage.getGuestProfile().purchaseRestoreRequired, true, 'Account reset does not suppress guest purchases');

// Sign-out restores the exact guest snapshot, including its own progress.
await Storage.restoreGuestProfile();
assert.deepEqual(Storage.getActiveProfile(), { kind: 'guest' });
assert.equal(Storage.getStoredData().points, 111);
assert.ok(Storage.getStoredData().progress['guest-1']);
assert.equal(Storage.getStoredData().progress['account-1'], undefined);
await Storage.initializeProfiles('user-1');
assert.equal(Storage.getStoredData().purchaseRestoreRequired, true, 'Manual restore requirement survives signing back in');
await Storage.restoreGuestProfile();

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
assert.equal(Storage.getGuestProfile().purchaseRestoreRequired, true, 'Guest backup retains explicit reset intent');

// A real guest mutation must survive a fresh storage module and native hydration.
const assertSnapshot = (actual, expected, message) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
await Storage.initializeNative();
await Storage.initializeProfiles(null);
assert.equal(Storage.claimWelcomeGift().applied, true);
Storage.saveSettings({ ...Storage.getSettings(), appearance: 'dark' });
const deadline = Date.now() + 86_400_000;
assert.equal(Storage.claimDailyBonus().applied, true);
const board = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => ({ row, col, value: null, notes: [], isFixed: false })));
board[0][0].value = 5;
board[0][1].notes = [2, 7];
Storage.saveLevelProgress({ difficulty: 'Easy', levelId: 4, status: 'in-progress', timeElapsed: 137, boardState: board, lastPlayed: Date.now(), scanUses: 3, scanRefillsPurchased: 0 });
const latestGuest = Storage.getStoredData();
assert.equal(latestGuest.points, 105);
assertSnapshot(Storage.getGuestProfile(), latestGuest, 'Every guest mutation updates the isolated guest cache synchronously');
await Storage.flushPendingWrites();
assertSnapshot(JSON.parse(nativePreferences.get('oku_guest_profile_v1')), latestGuest);

let restartNumber = 0;
const restart = async (nativeOnly = false) => {
    if (nativeOnly) localValues.clear();
    const { Storage: restarted } = await import(`${moduleUrl}#restart-${++restartNumber}`);
    await restarted.initializeNative();
    await restarted.initializeProfiles(null);
    return restarted;
};
let restarted = await restart();
assertSnapshot(restarted.getStoredData(), latestGuest, 'Guest state survives ordinary relaunch');
assert.equal(restarted.claimWelcomeGift().applied, false);
assert.equal(restarted.claimDailyBonus().applied, false);
restarted = await restart(true);
assertSnapshot(restarted.getStoredData(), latestGuest, 'Native guest cache restores settings, gifts, values and notes when WebView storage is absent');

// Loading incoming account data happens before its account marker is activated.
// That replacement is NOT guest gameplay and must never overwrite the guest.
const incomingAccount = withIdentity(restarted.createDefaultData(), 'incoming-account', 845);
await restarted.replaceStoredData(incomingAccount);
assertSnapshot(restarted.getGuestProfile(), latestGuest);
await restarted.activateAccountProfile('incoming-user');
restarted.addPoints(5);
await restarted.flushPendingWrites();
assert.equal(restarted.getAccountProfile('incoming-user').points, 850);
assertSnapshot(restarted.getGuestProfile(), latestGuest);
await restarted.restoreGuestProfile();
assertSnapshot(restarted.getStoredData(), latestGuest);
restarted.addPoints(3);
const returnedGuest = restarted.getStoredData();
await restarted.flushPendingWrites();
restarted = await restart(true);
assertSnapshot(restarted.getStoredData(), returnedGuest, 'Guest edits after sign-out also survive restart');
await restarted.initializeProfiles('incoming-user');
assert.equal(restarted.getStoredData().points, 850);
assertSnapshot(restarted.getGuestProfile(), returnedGuest);

// A remote refresh of an ALREADY active account still updates its own cache.
const refreshedAccount = { ...restarted.getStoredData(), points: 901 };
await restarted.replaceStoredData(refreshedAccount);
assert.equal(restarted.getAccountProfile('incoming-user').points, 901);
assertSnapshot(restarted.getGuestProfile(), returnedGuest);

// Bursty edits and a temporary native failure must not leave the guest mirror
// behind. The synchronous guest copy protects restarts while retry is pending.
await restarted.restoreGuestProfile();
globalThis.__okuFailGuestWrite = true;
const savedConsoleError = console.error;
const expectedErrors = [];
console.error = (...args) => expectedErrors.push(args);
try {
    for (let i = 0; i < 20; i++) restarted.addPoints(1);
    const burstGuest = restarted.getStoredData();
    assertSnapshot(restarted.getGuestProfile(), burstGuest);
    await restarted.flushPendingWrites();
    assert.equal(expectedErrors.length, 1);
    assertSnapshot(JSON.parse(nativePreferences.get('oku_guest_profile_v1')), burstGuest);
    globalThis.__okuFailGuestWrite = true;
    restarted.addPoints(1);
    const retriedGuest = restarted.getStoredData();
    await restarted.flushPendingWrites();
    assert.equal(expectedErrors.length, 2);
    assertSnapshot(JSON.parse(nativePreferences.get('oku_guest_profile_v1')), retriedGuest, 'The last failed guest write is retried even without a later mutation');
    restarted = await restart(true);
    assertSnapshot(restarted.getStoredData(), retriedGuest);
    assert.equal(restarted.getAccountProfile('incoming-user')?.points ?? JSON.parse(nativePreferences.get('oku_account_profile_v1:incoming-user')).points, 901);
} finally {
    console.error = savedConsoleError;
    delete globalThis.__okuFailGuestWrite;
}

console.log('Profile storage: guest restart, native-only recovery, rewards, board notes, account replacement, sign-out and account isolation passed.');
