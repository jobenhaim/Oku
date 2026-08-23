import assert from 'node:assert/strict';
import { build } from 'esbuild';

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeSnapshot = (name, points, lastModifiedAt, progress = {}) => ({
    name,
    lastModifiedAt,
    settings: {},
    points,
    progress,
    purchasedBackgrounds: ['bg-default'],
    selectedBackground: 'bg-default',
    purchasedNumberColors: ['num-default'],
    selectedNumberColor: 'num-default',
    purchasedSkills: [],
    enabledSkills: [],
    purchasedSoundPacks: ['snd-zen'],
    selectedSoundPack: 'snd-zen',
    nextBonusClaimTime: 0,
    pepino: {
        unlocked: false,
        hasPendingGift: false,
        pendingGiftCount: 0,
        firstGiftClaimed: false,
        firstMessageShown: false,
    },
    achievementCounters: {
        scansUsed: 0,
        pepinoGiftsOpened: 0,
        hardPerfectGames: 0,
        replaysWatched: 0,
        nudgeCellClicks: 0,
        pepinoHeartTaps: 0,
        pepinoTenLoveTaps: 0,
        pepinoStrongTaps: 0,
        hardNoScanWins: 0,
        noteGamesWon: 0,
    },
    stats: {
        totalGamesWon: 0,
        totalDiamondsEarned: 0,
        perfectGames: 0,
        gamesWonByDifficulty: {},
        diamondsEarnedBySource: {},
    },
});

const storageState = {
    data: makeSnapshot('initial', 0, 0),
    guest: makeSnapshot('guest', 0, 0),
    activeUid: null,
    listeners: new Set(),
};

globalThis.__okuTestStorage = {
    createDefaultData: () => makeSnapshot('default', 0, 0),
    getStoredData: () => storageState.data,
    getGuestProfile: () => clone(storageState.guest),
    isAccountProfileActive: (uid) => storageState.activeUid === uid,
    activateAccountProfile: async (uid) => {
        storageState.activeUid = uid;
    },
    replaceStoredData: async (data) => {
        storageState.data = clone(data);
        storageState.listeners.forEach((listener) => listener(storageState.data));
    },
    subscribe: (listener) => {
        storageState.listeners.add(listener);
        return () => storageState.listeners.delete(listener);
    },
    flushPendingWrites: async () => undefined,
};

const firestoreState = {
    profiles: new Map(),
    progress: new Map(),
    batches: [],
    reads: [],
    delayedProfileUid: null,
    delayedProfileGate: null,
    delayedProfileStarted: null,
};

const uidFromReference = (reference) => reference.split('/')[1];

globalThis.__okuTestFirestore = {
    getDocument: async ({ reference }) => {
        firestoreState.reads.push(reference);
        const uid = uidFromReference(reference);
        if (uid === firestoreState.delayedProfileUid && firestoreState.delayedProfileGate) {
            firestoreState.delayedProfileStarted?.();
            await firestoreState.delayedProfileGate;
        }
        return {
            snapshot: {
                data: clone(firestoreState.profiles.get(uid) ?? null),
                metadata: { fromCache: false, hasPendingWrites: false },
            },
        };
    },
    getCollection: async ({ reference }) => {
        firestoreState.reads.push(reference);
        const uid = uidFromReference(reference);
        const chunks = firestoreState.progress.get(uid) ?? new Map();
        return {
            snapshots: [...chunks.entries()].map(([id, data]) => ({
                id,
                data: clone(data),
                metadata: { fromCache: false, hasPendingWrites: false },
            })),
        };
    },
    writeBatch: async ({ operations }) => {
        const copiedOperations = clone(operations);
        firestoreState.batches.push({ operations: copiedOperations });

        for (const operation of copiedOperations) {
            const parts = operation.reference.split('/');
            const uid = parts[1];
            if (parts[2] === 'saves') {
                firestoreState.profiles.set(uid, clone(operation.data));
            } else if (parts[2] === 'progress') {
                const chunks = firestoreState.progress.get(uid) ?? new Map();
                if (operation.type === 'delete') chunks.delete(parts[3]);
                else chunks.set(parts[3], clone(operation.data));
                firestoreState.progress.set(uid, chunks);
            }
        }
    },
};

const onlineListeners = new Set();
globalThis.window = {
    addEventListener: (type, listener) => {
        if (type === 'online') onlineListeners.add(listener);
    },
    removeEventListener: (type, listener) => {
        if (type === 'online') onlineListeners.delete(listener);
    },
    dispatchEvent: () => true,
};
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true },
});
if (typeof globalThis.CustomEvent === 'undefined') {
    globalThis.CustomEvent = class CustomEvent {
        constructor(type) {
            this.type = type;
        }
    };
}

const bundle = await build({
    entryPoints: ['utils/cloudSave.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: false,
    logLevel: 'silent',
    plugins: [{
        name: 'mock-cloud-dependencies',
        setup(buildApi) {
            buildApi.onResolve({ filter: /^@capacitor\/core$/ }, () => ({
                path: 'mock-capacitor-core',
                namespace: 'oku-cloud-test',
            }));
            buildApi.onResolve({ filter: /^@capacitor-firebase\/firestore$/ }, () => ({
                path: 'mock-firestore',
                namespace: 'oku-cloud-test',
            }));
            buildApi.onResolve({ filter: /^\.\/storage$/ }, () => ({
                path: 'mock-storage',
                namespace: 'oku-cloud-test',
            }));
            buildApi.onLoad({ filter: /^mock-capacitor-core$/, namespace: 'oku-cloud-test' }, () => ({
                loader: 'js',
                contents: 'export const Capacitor = { isNativePlatform: () => true };',
            }));
            buildApi.onLoad({ filter: /^mock-firestore$/, namespace: 'oku-cloud-test' }, () => ({
                loader: 'js',
                contents: 'export const FirebaseFirestore = globalThis.__okuTestFirestore;',
            }));
            buildApi.onLoad({ filter: /^mock-storage$/, namespace: 'oku-cloud-test' }, () => ({
                loader: 'js',
                contents: 'export const Storage = globalThis.__okuTestStorage;',
            }));
        },
    }],
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { CloudSave } = await import(moduleUrl);

const toCloudProfile = (snapshot) => {
    const { progress: _progress, ...data } = snapshot;
    return {
        schemaVersion: 2,
        updatedAt: snapshot.lastModifiedAt,
        data: clone(data),
    };
};

const resetFirestore = () => {
    firestoreState.profiles.clear();
    firestoreState.progress.clear();
    firestoreState.batches.length = 0;
    firestoreState.reads.length = 0;
    firestoreState.delayedProfileUid = null;
    firestoreState.delayedProfileGate = null;
    firestoreState.delayedProfileStarted = null;
};

// A previously activated account remains usable when the app launches without
// connectivity. Once online, reconciliation must upload the newest whole local
// snapshot, with profile and progress changes in the same Firestore batch.
resetFirestore();
const offlineUid = 'offline-account';
const remoteOld = makeSnapshot('remote-old', 100, 100);
firestoreState.profiles.set(offlineUid, toCloudProfile(remoteOld));

storageState.activeUid = offlineUid;
storageState.data = makeSnapshot('local-cache', 200, 200);
storageState.guest = makeSnapshot('guest', 5, 50);
navigator.onLine = false;

const originalConsoleError = console.error;
console.error = () => undefined;
const offlineResult = await CloudSave.connect(offlineUid);
console.error = originalConsoleError;
assert.deepEqual(offlineResult, {
    synced: false,
    usedCloudData: false,
    profileActivated: true,
});
assert.equal(firestoreState.reads.length, 0, 'offline connect should not start a Firestore read');

const newestProgress = {
    'Easy-3': {
        levelId: 3,
        difficulty: 'Easy',
        status: 'completed',
        timeElapsed: 45,
        bestTime: 45,
    },
};
storageState.data = makeSnapshot('newest-local', 333, 300, newestProgress);
navigator.onLine = true;

const foregroundResult = await CloudSave.reconcileOnForeground();
assert.deepEqual(foregroundResult, {
    synced: true,
    usedCloudData: false,
    profileActivated: true,
});
assert.equal(storageState.data.points, 333);
assert.equal(firestoreState.batches.length, 1, 'reconciliation should use one atomic Firestore batch');

const reconciliationOperations = firestoreState.batches[0].operations;
assert.equal(reconciliationOperations.length, 2);
const profileOperation = reconciliationOperations.find(({ reference }) => (
    reference === `users/${offlineUid}/saves/profile`
));
const progressOperation = reconciliationOperations.find(({ reference }) => (
    reference === `users/${offlineUid}/progress/easy-book-1`
));
assert.ok(profileOperation, 'the batch should contain the profile document');
assert.ok(progressOperation, 'the same batch should contain the changed progress chunk');
assert.equal(profileOperation.data.data.points, 333);
assert.equal(progressOperation.data.levels['Easy-3'].status, 'completed');

await CloudSave.disconnect({ flush: false });

// A signed-in reset is a newer empty account snapshot, not a request to keep
// progress chunks left by the previous save. The stale chunk must be deleted
// in the same batch that commits the reset profile.
resetFirestore();
navigator.onLine = true;
const resetUid = 'reset-account';
const beforeReset = makeSnapshot('before-reset', 500, 100, {
    'Normal-19': {
        levelId: 19,
        difficulty: 'Normal',
        status: 'completed',
        timeElapsed: 120,
        bestTime: 120,
    },
});
firestoreState.profiles.set(resetUid, toCloudProfile(beforeReset));
firestoreState.progress.set(resetUid, new Map([[
    'normal-book-1',
    {
        schemaVersion: 2,
        updatedAt: 100,
        levels: clone(beforeReset.progress),
    },
]]));
storageState.activeUid = resetUid;
storageState.data = makeSnapshot('after-reset', 0, 500);
storageState.guest = makeSnapshot('guest', 5, 50);

const resetResult = await CloudSave.connect(resetUid);
assert.equal(resetResult.profileActivated, true);
assert.equal(storageState.data.points, 0);
assert.deepEqual(storageState.data.progress, {});
assert.equal(firestoreState.progress.get(resetUid).size, 0);
const resetOperations = firestoreState.batches.at(-1).operations;
assert.ok(resetOperations.some(({ type, reference }) => (
    type === 'delete' && reference === `users/${resetUid}/progress/normal-book-1`
)));

await CloudSave.disconnect({ flush: false });

// A missing profile/root with stale progress documents is an orphaned partial
// save. It must not replace the guest or retry forever: the next atomic batch
// creates the root and deletes progress absent from the trusted local snapshot.
resetFirestore();
navigator.onLine = true;
const orphanUid = 'orphan-user';
firestoreState.progress.set(orphanUid, new Map([[
    'easy-book-1',
    {
        schemaVersion: 2,
        updatedAt: 100,
        levels: {
            'Easy-1': {
                levelId: 1,
                difficulty: 'Easy',
                status: 'completed',
                timeElapsed: 60,
                bestTime: 60,
            },
        },
    },
]]));
storageState.activeUid = null;
storageState.guest = makeSnapshot('trusted-guest', 45, 500);
storageState.data = clone(storageState.guest);

const orphanResult = await CloudSave.connect(orphanUid);
assert.equal(orphanResult.profileActivated, true);
assert.equal(storageState.data.points, 45);
assert.equal(firestoreState.profiles.get(orphanUid).data.points, 45);
assert.equal(firestoreState.progress.get(orphanUid).size, 0);
const orphanOperations = firestoreState.batches.at(-1).operations;
assert.ok(orphanOperations.some(({ type, reference }) => (
    type === 'delete' && reference === `users/${orphanUid}/progress/easy-book-1`
)));

await CloudSave.disconnect({ flush: false });

// `null` is a valid selected background (the player can choose no scene). It
// must not make an otherwise healthy cloud profile look malformed.
resetFirestore();
navigator.onLine = true;
const noBackgroundUid = 'no-background-user';
const noBackgroundCloud = makeSnapshot('no-background', 72, 700);
noBackgroundCloud.selectedBackground = null;
firestoreState.profiles.set(noBackgroundUid, toCloudProfile(noBackgroundCloud));
storageState.activeUid = null;
storageState.guest = makeSnapshot('guest-before-no-background', 12, 100);
storageState.data = clone(storageState.guest);

const noBackgroundResult = await CloudSave.connect(noBackgroundUid);
assert.equal(noBackgroundResult.profileActivated, true);
assert.equal(storageState.data.selectedBackground, null);

await CloudSave.disconnect({ flush: false });

// A malformed cloud root is never allowed to replace a valid guest snapshot.
// Keep the guest untouched and fail closed until a healthy server document is
// available instead of turning missing fields into local defaults.
resetFirestore();
navigator.onLine = true;
const malformedUid = 'malformed-cloud-user';
firestoreState.profiles.set(malformedUid, {
    schemaVersion: 2,
    updatedAt: 900,
    data: { points: 999 },
});
storageState.activeUid = null;
storageState.guest = makeSnapshot('protected-guest', 64, 600);
storageState.data = clone(storageState.guest);

console.error = () => undefined;
const malformedResult = await CloudSave.connect(malformedUid);
console.error = originalConsoleError;
assert.equal(malformedResult.profileActivated, false);
assert.equal(storageState.activeUid, null);
assert.equal(storageState.data.points, 64);
assert.equal(firestoreState.batches.length, 0);

// A delayed task retains its original UID/generation. Switching accounts while
// that task is waiting must not let the old snapshot leak into the new path.
resetFirestore();
navigator.onLine = true;

let releaseOldProfileRead;
const oldProfileGate = new Promise((resolve) => {
    releaseOldProfileRead = resolve;
});
let markOldProfileReadStarted;
const oldProfileReadStarted = new Promise((resolve) => {
    markOldProfileReadStarted = resolve;
});
firestoreState.delayedProfileUid = 'old-user';
firestoreState.delayedProfileGate = oldProfileGate;
firestoreState.delayedProfileStarted = markOldProfileReadStarted;

const oldSnapshot = makeSnapshot('old-snapshot', 101, 100, {
    'Easy-1': {
        levelId: 1,
        difficulty: 'Easy',
        status: 'completed',
        timeElapsed: 60,
        bestTime: 60,
    },
});
storageState.activeUid = 'old-user';
storageState.data = oldSnapshot;
const oldConnection = CloudSave.connect('old-user');
await oldProfileReadStarted;

const newSnapshot = makeSnapshot('new-snapshot', 909, 900, {
    'Hard-2': {
        levelId: 2,
        difficulty: 'Hard',
        status: 'completed',
        timeElapsed: 90,
        bestTime: 90,
    },
});
storageState.activeUid = 'new-user';
storageState.data = newSnapshot;
const newConnectionResult = await CloudSave.connect('new-user');
assert.equal(newConnectionResult.profileActivated, true);

releaseOldProfileRead();
await oldConnection;

const allOperations = firestoreState.batches.flatMap(({ operations }) => operations);
assert.ok(allOperations.length > 0, 'the new account should have been uploaded');
assert.ok(allOperations.every(({ reference }) => reference.startsWith('users/new-user/')));
const newProfileWrites = allOperations.filter(({ reference }) => (
    reference === 'users/new-user/saves/profile'
));
assert.equal(newProfileWrites.length, 1);
assert.equal(newProfileWrites[0].data.data.points, 909);
assert.notEqual(newProfileWrites[0].data.data.name, 'old-snapshot');

await CloudSave.disconnect({ flush: false });

console.log('Cloud save concurrency checks passed.');
