import assert from 'node:assert/strict';
import { build } from 'esbuild';

const STORAGE_KEY = 'oku_data_v1';
const GUEST_PROFILE_KEY = 'oku_guest_profile_v1';
const ACTIVE_PROFILE_KEY = 'oku_active_profile_v1';

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
    stdin: {
        contents: `
            export { Storage } from './utils/storage.ts';
            export { SKILLS, DIAMOND_OFFERS } from './utils/constants.ts';
            export { computeHintCandidateProgressIntegrity } from './utils/hints.ts';
        `,
        resolveDir: process.cwd(),
        sourcefile: 'storage-consistency-entry.ts',
        loader: 'ts',
    },
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
const {
    Storage,
    SKILLS,
    DIAMOND_OFFERS,
    computeHintCandidateProgressIntegrity,
} = await import(moduleUrl);

const skillPrices = Object.fromEntries(SKILLS.map(({ name, cost }) => [name, cost]));
assert.deepEqual(
    { Focus: skillPrices.Focus, Guard: skillPrices.Guard, Scan: skillPrices.Scan },
    { Focus: 200, Guard: 200, Scan: 200 },
    'Focus, Guard, and Scan should share one accessible unlock price'
);

const starterOffer = DIAMOND_OFFERS.find(({ id }) => id === 'starter_pack');
assert.ok(starterOffer, 'the Starter Pack offer should exist');
assert.equal(starterOffer.diamonds, 800);
assert.match(starterOffer.includes.join(' '), /Focus/);
assert.match(starterOffer.includes.join(' '), /Guard/);
assert.match(starterOffer.includes.join(' '), /Scan/);

const clone = (value) => JSON.parse(JSON.stringify(value));

const EMPTY_BOARD_SIGNATURE = '000000000/000000000/000000000/000000000/000000000/000000000/000000000/000000000/000000000';
const makeEmptyStoredBoard = () => Array.from({ length: 9 }, (_, row) => (
    Array.from({ length: 9 }, (_, col) => ({
        row,
        col,
        value: null,
        notes: [],
        isFixed: false,
    }))
));
const makeSignedCandidateProgress = (boardSignature, exclusions) => ({
    version: 1,
    boardSignature,
    exclusions,
    integrity: computeHintCandidateProgressIntegrity(boardSignature, exclusions),
});

const installSnapshot = async (snapshot) => {
    await Storage.flushPendingWrites();
    localValues.clear();
    nativePreferences.clear();
    await Storage.replaceStoredData(clone(snapshot));
    await Storage.flushPendingWrites();
};

const installRawSnapshots = async ({ local, native }) => {
    await Storage.flushPendingWrites();
    localValues.clear();
    nativePreferences.clear();
    if (local) localValues.set(STORAGE_KEY, JSON.stringify(local));
    if (native) nativePreferences.set(STORAGE_KEY, JSON.stringify(native));
};

const readNativeSnapshot = async () => {
    await Storage.flushPendingWrites();
    const value = nativePreferences.get(STORAGE_KEY);
    assert.ok(value, 'the mutation should be durably queued to native Preferences');
    return JSON.parse(value);
};

const observeMutation = async (mutation) => {
    let notifications = 0;
    const unsubscribe = Storage.subscribe(() => {
        notifications += 1;
    });
    try {
        const result = await mutation();
        return { result, notifications };
    } finally {
        unsubscribe();
    }
};

const didApply = (result) => (
    typeof result === 'boolean' ? result : Boolean(result?.applied)
);

// A completed puzzle is one logical transaction: every derived total, the
// level itself, its diamond reward, and Pepino's gift queue move together.
const completionSeed = Storage.createDefaultData();
completionSeed.points = 100;
completionSeed.progress['Hard-10'] = {
    levelId: 10,
    difficulty: 'Hard',
    status: 'in-progress',
    timeElapsed: 80,
    scanUses: 3,
    scanRefillsPurchased: 0,
    hasMadeMistake: false,
    hasUsedNotes: true,
    boardState: makeEmptyStoredBoard(),
    hintCandidateProgress: makeSignedCandidateProgress(
        EMPTY_BOARD_SIGNATURE,
        [{ row: 0, col: 0, value: 2 }],
    ),
};
completionSeed.stats = {
    totalGamesWon: 9,
    totalDiamondsEarned: 5,
    perfectGames: 2,
    gamesWonByDifficulty: { Hard: 9 },
    diamondsEarnedBySource: { other: 5 },
};
completionSeed.pepino = {
    unlocked: true,
    hasPendingGift: false,
    pendingGiftCount: 0,
    firstGiftClaimed: true,
    firstMessageShown: true,
};
await installSnapshot(completionSeed);

const completedProgress = {
    ...completionSeed.progress['Hard-10'],
    status: 'completed',
    timeElapsed: 75,
    boardState: [[{ value: 1, notes: [], isFixed: false }]],
    moveLog: [{ row: 0, col: 0, value: 1 }],
};
const completion = await observeMutation(() => Storage.completePuzzle({
    progress: completedProgress,
    isPerfectGame: true,
    diamonds: 30,
}));
assert.equal(didApply(completion.result), true);
assert.equal(completion.notifications, 1, 'a puzzle completion should publish one complete snapshot');

const completed = Storage.getStoredData();
assert.equal(completed.points, 130);
assert.equal(completed.stats.totalDiamondsEarned, 35);
assert.equal(completed.stats.diamondsEarnedBySource.sudoku, 30);
assert.equal(completed.stats.totalGamesWon, 10);
assert.equal(completed.stats.gamesWonByDifficulty.Hard, 10);
assert.equal(completed.stats.perfectGames, 3);
assert.equal(completed.achievementCounters.hardPerfectGames, 1);
assert.equal(completed.achievementCounters.hardNoScanWins, 1);
assert.equal(completed.achievementCounters.noteGamesWon, 1);
assert.equal(completed.progress['Hard-10'].status, 'completed');
assert.equal(completed.progress['Hard-10'].bestTime, 75);
assert.equal(completed.progress['Hard-10'].boardState, undefined);
assert.equal(completed.progress['Hard-10'].moveLog, undefined);
assert.equal(completed.progress['Hard-10'].hintCandidateProgress, undefined);
assert.equal(completed.pepino.pendingGiftCount, 1);
assert.equal(completed.pepino.hasPendingGift, true);

const durableCompletion = await readNativeSnapshot();
assert.equal(durableCompletion.points, 130);
assert.equal(durableCompletion.stats.totalGamesWon, 10);
assert.equal(durableCompletion.stats.gamesWonByDifficulty.Hard, 10);
assert.equal(durableCompletion.progress['Hard-10'].status, 'completed');
assert.equal(durableCompletion.pepino.pendingGiftCount, 1);

// Re-delivering the same completion must not pay or count the same win twice.
const duplicateCompletion = await observeMutation(() => Storage.completePuzzle({
    progress: completedProgress,
    isPerfectGame: true,
    diamonds: 30,
}));
assert.equal(didApply(duplicateCompletion.result), false);
assert.equal(duplicateCompletion.notifications, 0);
assert.equal(Storage.getStoredData().points, 130);
assert.equal(Storage.getStoredData().stats.totalGamesWon, 10);
assert.equal(Storage.getStoredData().pepino.pendingGiftCount, 1);

// A stale autosave that arrives after the win cannot turn the level back into
// an unfinished game or erase its personal best.
Storage.saveLevelProgress({
    ...completedProgress,
    status: 'in-progress',
    timeElapsed: 90,
    bestTime: undefined,
});
const afterLateAutosave = Storage.getStoredData();
assert.equal(afterLateAutosave.progress['Hard-10'].status, 'completed');
assert.equal(afterLateAutosave.progress['Hard-10'].bestTime, 75);
assert.equal(afterLateAutosave.stats.totalGamesWon, 10);

// Scanning an untouched board stores its economy without creating a Continue
// Game board, while the Scan achievement advances in that same one snapshot.
const untouchedScanSeed = Storage.createDefaultData();
await installSnapshot(untouchedScanSeed);
const untouchedScan = await observeMutation(() => (
    Storage.saveLevelScanEconomy('Easy', 3, 2, 0, 75)
));
assert.equal(untouchedScan.notifications, 1);
assert.equal(Storage.getStoredData().progress['Easy-3'].status, 'not-started');
assert.equal(Storage.getStoredData().progress['Easy-3'].boardState, undefined);
assert.equal(Storage.getStoredData().progress['Easy-3'].scanUses, 2);
assert.equal(Storage.getStoredData().achievementCounters.scansUsed, 1);

// Solver-owned candidate progress survives reloads only when its checksum and
// board signature both match. Invalid, stale, or manually edited proof resets
// instead of silently contributing candidate eliminations.
const candidateProgressSeed = Storage.createDefaultData();
const candidateExclusions = [
    { row: 0, col: 1, value: 4 },
    { row: 0, col: 0, value: 2 },
];
candidateProgressSeed.progress['Impossible-1'] = {
    levelId: 1,
    difficulty: 'Impossible',
    status: 'in-progress',
    timeElapsed: 30,
    lastPlayed: 123,
    boardState: makeEmptyStoredBoard(),
    hintCandidateProgress: makeSignedCandidateProgress(
        EMPTY_BOARD_SIGNATURE,
        candidateExclusions,
    ),
};
await installRawSnapshots({ local: candidateProgressSeed, native: null });
const migratedCandidateProgress = Storage.getStoredData().progress['Impossible-1'];
assert.deepEqual(migratedCandidateProgress.hintCandidateProgress, {
    version: 1,
    boardSignature: EMPTY_BOARD_SIGNATURE,
    exclusions: [
        { row: 0, col: 0, value: 2 },
        { row: 0, col: 1, value: 4 },
    ],
    integrity: computeHintCandidateProgressIntegrity(EMPTY_BOARD_SIGNATURE, candidateExclusions),
});
assert.equal(Storage.getLastPlayedGame()?.levelId, 1);
assert.equal(Storage.getLastPlayedGame()?.difficulty, 'Impossible');

const tamperedCandidateProgressSeed = clone(candidateProgressSeed);
tamperedCandidateProgressSeed.progress['Impossible-1'].hintCandidateProgress.exclusions.push({
    row: 0,
    col: 2,
    value: 6,
});
await installRawSnapshots({ local: tamperedCandidateProgressSeed, native: null });
assert.equal(
    Storage.getStoredData().progress['Impossible-1'].hintCandidateProgress,
    undefined,
    'a changed exclusion list with its old checksum must be discarded',
);
assert.equal(Storage.getLastPlayedGame(), undefined, 'invalid proof alone must not make a puzzle resumable');

const unsignedCandidateProgressSeed = clone(candidateProgressSeed);
delete unsignedCandidateProgressSeed.progress['Impossible-1'].hintCandidateProgress.integrity;
await installRawSnapshots({ local: unsignedCandidateProgressSeed, native: null });
assert.equal(
    Storage.getStoredData().progress['Impossible-1'].hintCandidateProgress,
    undefined,
    'missing candidate integrity must be discarded',
);

const staleCandidateProgressSeed = clone(candidateProgressSeed);
const staleSignature = `1${EMPTY_BOARD_SIGNATURE.slice(1)}`;
staleCandidateProgressSeed.progress['Impossible-1'].hintCandidateProgress = makeSignedCandidateProgress(
    staleSignature,
    candidateExclusions,
);
await installRawSnapshots({ local: staleCandidateProgressSeed, native: null });
assert.equal(
    Storage.getStoredData().progress['Impossible-1'].hintCandidateProgress,
    undefined,
    'candidate proof signed for a different board state must be discarded',
);

const malformedCandidateProgressSeed = clone(candidateProgressSeed);
const malformedExclusions = [
    ...candidateExclusions,
    { row: 9, col: 0, value: 3 },
];
malformedCandidateProgressSeed.progress['Impossible-1'].hintCandidateProgress = makeSignedCandidateProgress(
    EMPTY_BOARD_SIGNATURE,
    malformedExclusions,
);
await installRawSnapshots({ local: malformedCandidateProgressSeed, native: null });
assert.equal(
    Storage.getStoredData().progress['Impossible-1'].hintCandidateProgress,
    undefined,
    'structurally malformed exclusions must fail closed even with a recomputed checksum',
);

// Hint usage and its diamond charge are one durable transaction. Every puzzle
// follows 5 / 15 / 30 with the price capped at 30 for every later use.
const hintSeed = Storage.createDefaultData();
hintSeed.points = 200;
await installSnapshot(hintSeed);

assert.deepEqual(Storage.getHintEconomy('Normal', 12), {
    hintsUsed: 0,
    cost: 5,
});

const expectedHintCharges = [5, 15, 30, 30, 30];
const expectedNextHintCosts = [15, 30, 30, 30, 30];
let expectedHintPoints = 200;

for (let hintsUsed = 0; hintsUsed < expectedHintCharges.length; hintsUsed += 1) {
    const charge = expectedHintCharges[hintsUsed];
    expectedHintPoints -= charge;

    const consumption = await observeMutation(() => (
        Storage.consumeHint('Normal', 12, hintsUsed)
    ));
    assert.equal(consumption.result.success, true);
    assert.equal(consumption.result.reason, 'consumed');
    assert.equal(consumption.result.charged, charge);
    assert.equal(consumption.result.points, expectedHintPoints);
    assert.equal(consumption.result.hintsUsed, hintsUsed + 1);
    assert.equal(consumption.result.nextCost, expectedNextHintCosts[hintsUsed]);
    assert.equal(consumption.notifications, 1, 'a successful Hint should publish one complete snapshot');

    const durableHint = await readNativeSnapshot();
    assert.equal(durableHint.points, expectedHintPoints);
    assert.equal(durableHint.hintUsageByPuzzle['Normal-12'], hintsUsed + 1);
}

assert.equal(Storage.getStoredData().points, 90);
assert.deepEqual(Storage.getHintEconomy('Normal', 12), {
    hintsUsed: 5,
    cost: 30,
});

// A stale direct request/double press must not silently accept a newly changed
// price or consume a second Hint.
const beforeStaleHint = clone(Storage.getStoredData());
const staleHint = await observeMutation(() => (
    Storage.consumeHint('Normal', 12, 4)
));
assert.equal(staleHint.result.success, false);
assert.equal(staleHint.result.reason, 'stale');
assert.equal(staleHint.result.charged, 0);
assert.equal(staleHint.result.points, 90);
assert.equal(staleHint.result.hintsUsed, 5);
assert.equal(staleHint.result.cost, 30);
assert.equal(staleHint.notifications, 0);
assert.deepEqual(Storage.getStoredData(), beforeStaleHint);

// Insufficient diamonds are also an exact no-op: neither the balance nor the
// per-puzzle usage counter (or mutation timestamp) may move.
const insufficientHintSeed = Storage.createDefaultData();
insufficientHintSeed.points = 4;
insufficientHintSeed.hintUsageByPuzzle = { 'Easy-8': 1 };
await installSnapshot(insufficientHintSeed);
const beforeInsufficientHint = clone(Storage.getStoredData());
const insufficientHint = await observeMutation(() => (
    Storage.consumeHint('Easy', 8, 1)
));
assert.equal(insufficientHint.result.success, false);
assert.equal(insufficientHint.result.reason, 'insufficient-points');
assert.equal(insufficientHint.result.charged, 0);
assert.equal(insufficientHint.result.points, 4);
assert.equal(insufficientHint.result.hintsUsed, 1);
assert.equal(insufficientHint.result.cost, 15);
assert.equal(insufficientHint.notifications, 0);
assert.deepEqual(Storage.getStoredData(), beforeInsufficientHint);

// Pepino's queued gift and its diamond reward are consumed as one mutation.
const pepinoSeed = Storage.createDefaultData();
pepinoSeed.points = 50;
pepinoSeed.pepino = {
    unlocked: true,
    hasPendingGift: true,
    pendingGiftCount: 1,
    firstGiftClaimed: false,
    firstMessageShown: false,
};
await installSnapshot(pepinoSeed);

const pepinoClaim = await observeMutation(() => Storage.claimPepinoGiftReward(20));
assert.equal(didApply(pepinoClaim.result), true);
assert.equal(pepinoClaim.notifications, 1);
const claimedPepino = Storage.getStoredData();
assert.equal(claimedPepino.points, 70);
assert.equal(claimedPepino.pepino.pendingGiftCount, 0);
assert.equal(claimedPepino.pepino.hasPendingGift, false);
assert.equal(claimedPepino.pepino.firstGiftClaimed, true);
assert.equal(claimedPepino.achievementCounters.pepinoGiftsOpened, 1);
assert.equal(claimedPepino.stats.totalDiamondsEarned, 20);
assert.equal(claimedPepino.stats.diamondsEarnedBySource.pepino, 20);

const beforeRejectedPepinoClaim = clone(claimedPepino);
const rejectedPepinoClaim = await observeMutation(() => Storage.claimPepinoGiftReward(20));
assert.equal(didApply(rejectedPepinoClaim.result), false);
assert.equal(rejectedPepinoClaim.notifications, 0);
assert.deepEqual(Storage.getStoredData(), beforeRejectedPepinoClaim);

// The daily timer and its diamonds must never be saved as separate states.
const dailySeed = Storage.createDefaultData();
dailySeed.points = 0;
dailySeed.nextBonusClaimTime = 0;
await installSnapshot(dailySeed);

const nextDailyClaim = 2_000_000_000_000;
const dailyClaim = await observeMutation(() => Storage.claimDailyBonus(nextDailyClaim, 10));
assert.equal(didApply(dailyClaim.result), true);
assert.equal(dailyClaim.notifications, 1);
const claimedDaily = Storage.getStoredData();
assert.equal(claimedDaily.points, 10);
assert.equal(claimedDaily.nextBonusClaimTime, nextDailyClaim);
assert.equal(claimedDaily.stats.totalDiamondsEarned, 10);
assert.equal(claimedDaily.stats.diamondsEarnedBySource.dailyGifts, 10);

const durableDailyClaim = await readNativeSnapshot();
assert.equal(durableDailyClaim.points, 10);
assert.equal(durableDailyClaim.nextBonusClaimTime, nextDailyClaim);
assert.equal(durableDailyClaim.stats.diamondsEarnedBySource.dailyGifts, 10);

const duplicateDailyClaim = await observeMutation(() => (
    Storage.claimDailyBonus(nextDailyClaim + 86_400_000, 10)
));
assert.equal(didApply(duplicateDailyClaim.result), false);
assert.equal(duplicateDailyClaim.notifications, 0);
assert.equal(Storage.getStoredData().points, 10);

// A coupon's reward and redeemed marker are one write. Duplicate delivery must
// not grant the reward again.
const couponSeed = Storage.createDefaultData();
await installSnapshot(couponSeed);
const couponClaim = await observeMutation(() => Storage.redeemCoupon('haha5000', { diamonds: 5000 }));
assert.equal(didApply(couponClaim.result), true);
assert.equal(couponClaim.notifications, 1);
assert.equal(Storage.getStoredData().points, 5000);
assert.deepEqual(Storage.getStoredData().redeemedCoupons, ['HAHA5000']);
assert.equal(Storage.getStoredData().stats.diamondsEarnedBySource.coupons, 5000);

const duplicateCoupon = await observeMutation(() => Storage.redeemCoupon('HAHA5000', { diamonds: 5000 }));
assert.equal(didApply(duplicateCoupon.result), false);
assert.equal(duplicateCoupon.notifications, 0);
assert.equal(Storage.getStoredData().points, 5000);

// The Starter Pack's consumable reward and every permanent entitlement are
// fulfilled atomically. Re-delivering its Store transaction must do nothing.
const starterSeed = Storage.createDefaultData();
starterSeed.points = 25;
await installSnapshot(starterSeed);
const starterPurchase = await observeMutation(() => Storage.fulfillStorePurchase({
    transactionId: 'starter-transaction',
    diamonds: starterOffer.diamonds,
    unlock: 'starter',
}));
assert.equal(didApply(starterPurchase.result), true);
assert.equal(starterPurchase.notifications, 1);

const assertStarterEntitlements = (data) => {
    assert.equal(data.starterPackPurchased, true);
    for (const skillId of ['skill-focus', 'skill-scribe', 'skill-scan']) {
        assert.ok(data.purchasedSkills.includes(skillId), `${skillId} should be owned`);
        assert.ok(data.enabledSkills.includes(skillId), `${skillId} should be enabled`);
    }
    assert.ok(data.purchasedSoundPacks.includes('snd-piano'));
    assert.ok(data.purchasedNumberColors.includes('num-teal'));
    assert.equal(new Set(data.purchasedSkills).size, data.purchasedSkills.length);
    assert.equal(new Set(data.enabledSkills).size, data.enabledSkills.length);
};

const purchasedStarter = Storage.getStoredData();
assertStarterEntitlements(purchasedStarter);
assert.equal(purchasedStarter.points, 825);
assert.equal(purchasedStarter.stats.totalDiamondsEarned, 800);
assert.equal(purchasedStarter.stats.diamondsEarnedBySource.purchases, 800);
assert.deepEqual(purchasedStarter.processedPurchaseTransactions, ['starter-transaction']);
assertStarterEntitlements(await readNativeSnapshot());

const beforeDuplicateStarter = clone(Storage.getStoredData());
const duplicateStarter = await observeMutation(() => Storage.fulfillStorePurchase({
    transactionId: 'starter-transaction',
    diamonds: starterOffer.diamonds,
    unlock: 'starter',
}));
assert.equal(didApply(duplicateStarter.result), false);
assert.equal(duplicateStarter.notifications, 0);
assert.deepEqual(Storage.getStoredData(), beforeDuplicateStarter);

// Restoring a permanent Starter entitlement recovers every permanent reward,
// including Focus, but never re-awards its 800 consumable diamonds.
const starterRestoreSeed = Storage.createDefaultData();
starterRestoreSeed.points = 7;
await installSnapshot(starterRestoreSeed);
const starterRestore = await observeMutation(() => Storage.restorePermanentPurchases({
    premiumOwned: false,
    starterOwned: true,
    books2AllOwned: false,
    books3AllOwned: false,
    booksForeverOwned: false,
    transactionIds: ['starter-restore'],
}));
assert.equal(starterRestore.notifications, 1);
const restoredStarter = Storage.getStoredData();
assertStarterEntitlements(restoredStarter);
assert.equal(restoredStarter.points, 7);
assert.equal(restoredStarter.stats.totalDiamondsEarned, 0);
assert.equal(restoredStarter.stats.diamondsEarnedBySource.purchases, undefined);

const restoredStarterModifiedAt = restoredStarter.lastModifiedAt;
const repeatedStarterRestore = await observeMutation(() => Storage.restorePermanentPurchases({
    premiumOwned: false,
    starterOwned: true,
    books2AllOwned: false,
    books3AllOwned: false,
    booksForeverOwned: false,
    transactionIds: ['starter-restore'],
}));
assert.equal(repeatedStarterRestore.notifications, 0);
assert.equal(Storage.getStoredData().lastModifiedAt, restoredStarterModifiedAt);

// Existing owners receive newly added permanent Starter benefits on migration
// without receiving another diamond grant or losing historical benefits.
const legacyStarter = Storage.createDefaultData();
legacyStarter.points = 11;
legacyStarter.starterPackPurchased = true;
legacyStarter.purchasedSkills = ['skill-scribe', 'skill-scan'];
legacyStarter.enabledSkills = ['skill-scribe', 'skill-scan'];
await installRawSnapshots({ local: legacyStarter, native: null });
const migratedStarter = Storage.getStoredData();
assertStarterEntitlements(migratedStarter);
assert.equal(migratedStarter.points, 11);

// RevenueCat checks ownership at every startup. Re-applying an identical
// ownership snapshot must not make an otherwise stale device look newer than
// a device that actually progressed.
const ownershipSeed = Storage.createDefaultData();
ownershipSeed.books2AllOwned = true;
ownershipSeed.processedPurchaseTransactions = ['book-2-transaction'];
await installSnapshot(ownershipSeed);
const ownershipModifiedAt = Storage.getStoredData().lastModifiedAt;
const repeatedOwnership = await observeMutation(() => Storage.restorePermanentPurchases({
    premiumOwned: false,
    starterOwned: false,
    books2AllOwned: true,
    books3AllOwned: false,
    booksForeverOwned: false,
    transactionIds: ['book-2-transaction'],
}));
assert.equal(repeatedOwnership.notifications, 0);
assert.equal(Storage.getStoredData().lastModifiedAt, ownershipModifiedAt);

// Old saves did not have per-difficulty win totals. Unique completed levels
// explain part of the legacy total; replay wins still need to survive as an
// unclassified remainder rather than silently disappearing in migration.
const legacy = Storage.createDefaultData();
legacy.stats = {
    totalGamesWon: 15,
    totalDiamondsEarned: 0,
    perfectGames: 0,
};
for (let levelId = 1; levelId <= 10; levelId += 1) {
    legacy.progress[`Easy-${levelId}`] = {
        levelId,
        difficulty: 'Easy',
        status: 'completed',
        timeElapsed: 60,
        bestTime: 60,
    };
}
await installRawSnapshots({ local: legacy });
const migratedLegacy = Storage.getStoredData();
const migratedWinBreakdown = migratedLegacy.stats.gamesWonByDifficulty;
assert.equal(migratedLegacy.stats.totalGamesWon, 15);
assert.equal(migratedWinBreakdown.Easy, 10);
assert.equal(
    Object.values(migratedWinBreakdown).reduce((sum, count) => sum + count, 0),
    15,
    'the five replay/legacy wins must remain represented in the breakdown'
);

// Capacitor Preferences and WebView localStorage can disagree after a crash.
// Startup must select the whole snapshot with the newest mutation timestamp.
const localNewer = Storage.createDefaultData();
localNewer.points = 222;
localNewer.lastModifiedAt = 200;
const nativeOlder = Storage.createDefaultData();
nativeOlder.points = 111;
nativeOlder.lastModifiedAt = 100;
await installRawSnapshots({ local: localNewer, native: nativeOlder });
const hydratedLocal = await Storage.initializeNative();
assert.equal(hydratedLocal.points, 222);
assert.equal(Storage.getStoredData().points, 222);

const localOlder = Storage.createDefaultData();
localOlder.points = 333;
localOlder.lastModifiedAt = 300;
const nativeNewer = Storage.createDefaultData();
nativeNewer.points = 444;
nativeNewer.lastModifiedAt = 400;
await installRawSnapshots({ local: localOlder, native: nativeNewer });
const hydratedNative = await Storage.initializeNative();
assert.equal(hydratedNative.points, 444);
assert.equal(Storage.getStoredData().points, 444);

// Profile identity is stronger than timestamps. A generic/native account
// snapshot left behind by an interrupted sign-out must never open as guest.
const interruptedAccount = Storage.createDefaultData();
interruptedAccount.points = 900;
interruptedAccount.lastModifiedAt = 900;
const isolatedGuest = Storage.createDefaultData();
isolatedGuest.points = 25;
isolatedGuest.lastModifiedAt = 100;
await Storage.flushPendingWrites();
localValues.clear();
nativePreferences.clear();
localValues.set(STORAGE_KEY, JSON.stringify(interruptedAccount));
nativePreferences.set(STORAGE_KEY, JSON.stringify(interruptedAccount));
localValues.set(GUEST_PROFILE_KEY, JSON.stringify(isolatedGuest));
nativePreferences.set(GUEST_PROFILE_KEY, JSON.stringify(isolatedGuest));
localValues.set(ACTIVE_PROFILE_KEY, 'guest');
nativePreferences.set(ACTIVE_PROFILE_KEY, 'guest');
const hydratedGuest = await Storage.initializeNative();
assert.equal(hydratedGuest.points, 25);
assert.equal(Storage.getStoredData().points, 25);

// A corrupt WebView marker cannot hide the intact native guest marker.
localValues.set(STORAGE_KEY, JSON.stringify(interruptedAccount));
nativePreferences.set(STORAGE_KEY, JSON.stringify(interruptedAccount));
localValues.set(GUEST_PROFILE_KEY, JSON.stringify(isolatedGuest));
nativePreferences.set(GUEST_PROFILE_KEY, JSON.stringify(isolatedGuest));
localValues.set(ACTIVE_PROFILE_KEY, 'not-a-profile');
nativePreferences.set(ACTIVE_PROFILE_KEY, 'guest');
const recoveredGuestMarker = await Storage.initializeNative();
assert.equal(recoveredGuestMarker.points, 25);
assert.deepEqual(Storage.getActiveProfile(), { kind: 'guest' });

// Signing out offline preserves the UID-scoped account snapshot before the
// guest is restored. The guest write must not overwrite that account cache.
const offlineAccount = Storage.createDefaultData();
offlineAccount.points = 777;
offlineAccount.lastModifiedAt = 777;
await installSnapshot(offlineAccount);
await Storage.activateAccountProfile('offline-user');
await Storage.restoreGuestProfile();
assert.equal(Storage.getStoredData().points, 0);
assert.equal(Storage.getAccountProfile('offline-user').points, 777);

// If only the active-profile marker is lost, an existing guest cache proves
// this is not a legacy one-slot install. Restoring Firebase must not silently
// relabel that guest progress as the signed-in account.
const markerlessGuest = Storage.createDefaultData();
markerlessGuest.points = 88;
markerlessGuest.lastModifiedAt = 88;
await Storage.flushPendingWrites();
localValues.clear();
nativePreferences.clear();
localValues.set(STORAGE_KEY, JSON.stringify(markerlessGuest));
nativePreferences.set(STORAGE_KEY, JSON.stringify(markerlessGuest));
localValues.set(GUEST_PROFILE_KEY, JSON.stringify(markerlessGuest));
nativePreferences.set(GUEST_PROFILE_KEY, JSON.stringify(markerlessGuest));
await Storage.initializeProfiles('markerless-account');
assert.deepEqual(Storage.getActiveProfile(), { kind: 'guest' });
assert.equal(Storage.getStoredData().points, 88);
assert.equal(Storage.getAccountProfile('markerless-account'), null);

console.log('Storage consistency checks passed.');
