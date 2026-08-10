import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { Preferences } from '@capacitor/preferences';
import type { Cell, LevelProgress, PepinoState, StoredData } from '../types';
import { Storage } from './storage';

const CLOUD_SCHEMA_VERSION = 2;
const CLOUD_SAVE_DEBOUNCE_MS = 1800;
const SYNCED_ACCOUNT_IDS_KEY = 'oku_cloud_synced_account_ids_v1';
export const CLOUD_DATA_UPDATED_EVENT = 'oku-cloud-data-updated';

type CloudProfileData = Omit<StoredData, 'progress'>;

interface CloudProfileDocument {
    schemaVersion: number;
    updatedAt: number;
    data: CloudProfileData;
}

interface CloudBoardState {
    rows: number;
    columns: number;
    cells: Cell[];
}

type CloudLevelProgress = Omit<LevelProgress, 'boardState'> & {
    // Schema 2 stores the board as a map containing one flat cell array.
    // Firestore rejects Cell[][] because an array cannot directly contain
    // another array. Keep the legacy shape in the read type so a save made by
    // an earlier development build can still be recovered if one exists.
    boardState?: CloudBoardState | Cell[][];
};

interface CloudProgressDocument {
    schemaVersion: number;
    updatedAt: number;
    levels: Record<string, CloudLevelProgress>;
}

interface RemoteSave {
    data: StoredData | null;
    profileHash: string | null;
    chunkHashes: Map<string, string>;
}

export interface CloudSyncResult {
    synced: boolean;
    usedCloudData: boolean;
}

const cloneForCloud = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const contentHash = (value: unknown) => JSON.stringify(cloneForCloud(value));

const encodeBoardState = (boardState: Cell[][]): CloudBoardState | undefined => {
    const rows = boardState.length;
    const columns = boardState[0]?.length ?? 0;
    const isRectangular = rows > 0
        && columns > 0
        && boardState.every((row) => Array.isArray(row) && row.length === columns);

    if (!isRectangular) {
        console.warn('Cloud save: Skipping a malformed in-progress board');
        return undefined;
    }

    return {
        rows,
        columns,
        cells: cloneForCloud(boardState.flat()),
    };
};

const decodeBoardState = (
    boardState: CloudBoardState | Cell[][] | undefined
): Cell[][] | undefined => {
    if (!boardState) return undefined;

    // Backward compatibility for any development save that used schema 1.
    if (Array.isArray(boardState)) {
        const columns = boardState[0]?.length ?? 0;
        const isRectangular = boardState.length > 0
            && columns > 0
            && boardState.every((row) => Array.isArray(row) && row.length === columns);
        return isRectangular ? cloneForCloud(boardState) : undefined;
    }

    const { rows, columns, cells } = boardState;
    if (!Number.isInteger(rows)
        || !Number.isInteger(columns)
        || rows <= 0
        || columns <= 0
        || !Array.isArray(cells)
        || cells.length !== rows * columns) {
        console.warn('Cloud save: Ignoring a malformed cloud board');
        return undefined;
    }

    const decoded: Cell[][] = [];
    for (let row = 0; row < rows; row += 1) {
        decoded.push(cloneForCloud(cells.slice(row * columns, (row + 1) * columns)));
    }
    return decoded;
};

const containsDirectNestedArray = (value: unknown): boolean => {
    if (Array.isArray(value)) {
        if (value.some((item) => Array.isArray(item))) return true;
        return value.some((item) => containsDirectNestedArray(item));
    }
    if (!value || typeof value !== 'object') return false;
    return Object.values(value as Record<string, unknown>)
        .some((item) => containsDirectNestedArray(item));
};

const assertFirestoreSafe = (value: unknown) => {
    if (containsDirectNestedArray(value)) {
        throw new Error('Cloud save contains a nested array that Firestore cannot store.');
    }
};

const unionStrings = (...collections: Array<string[] | undefined>) => [
    ...new Set(collections.flatMap((collection) => collection ?? [])),
];

const maxNumberMap = (
    first: Record<string, number> | undefined,
    second: Record<string, number> | undefined
) => {
    const merged: Record<string, number> = {};
    for (const key of new Set([...Object.keys(first ?? {}), ...Object.keys(second ?? {})])) {
        merged[key] = Math.max(first?.[key] ?? 0, second?.[key] ?? 0);
    }
    return merged;
};

const minDefined = (first?: number, second?: number) => {
    if (first === undefined) return second;
    if (second === undefined) return first;
    return Math.min(first, second);
};

const mergeProgressEntry = (
    local: LevelProgress,
    remote: LevelProgress,
    preferLocal: boolean
): LevelProgress => {
    const localCompleted = local.status === 'completed' || local.bestTime !== undefined;
    const remoteCompleted = remote.status === 'completed' || remote.bestTime !== undefined;

    if (localCompleted || remoteCompleted) {
        const completedSource = localCompleted && !remoteCompleted
            ? local
            : remoteCompleted && !localCompleted
                ? remote
                : (local.lastPlayed ?? 0) >= (remote.lastPlayed ?? 0)
                    ? local
                    : remote;
        const other = completedSource === local ? remote : local;
        const merged: LevelProgress = {
            ...cloneForCloud(completedSource),
            status: 'completed',
            bestTime: minDefined(local.bestTime, remote.bestTime),
            lastPlayed: Math.max(local.lastPlayed ?? 0, remote.lastPlayed ?? 0) || undefined,
            moveLog: completedSource.moveLog ?? other.moveLog,
        };
        delete merged.boardState;
        return merged;
    }

    const localPlayed = local.lastPlayed ?? 0;
    const remotePlayed = remote.lastPlayed ?? 0;
    const source = localPlayed === remotePlayed
        ? (preferLocal ? local : remote)
        : localPlayed > remotePlayed
            ? local
            : remote;
    return cloneForCloud(source);
};

const mergePepino = (
    preferred: PepinoState | undefined,
    other: PepinoState | undefined
): PepinoState | undefined => {
    if (!preferred && !other) return undefined;
    const base = cloneForCloud(preferred ?? other!);
    return {
        ...base,
        unlocked: Boolean(preferred?.unlocked || other?.unlocked),
        hasPendingGift: Math.max(preferred?.pendingGiftCount ?? 0, other?.pendingGiftCount ?? 0) > 0,
        pendingGiftCount: Math.max(preferred?.pendingGiftCount ?? 0, other?.pendingGiftCount ?? 0),
        firstGiftClaimed: Boolean(preferred?.firstGiftClaimed || other?.firstGiftClaimed),
        firstMessageShown: Boolean(preferred?.firstMessageShown || other?.firstMessageShown),
        unlockedAt: minDefined(preferred?.unlockedAt, other?.unlockedAt),
    };
};

interface MergeOptions {
    preferRemoteProfile?: boolean;
}

export const mergeCloudAndDeviceData = (
    local: StoredData,
    remote: StoredData,
    options: MergeOptions = {}
): StoredData => {
    const localModified = local.lastModifiedAt ?? 0;
    const remoteModified = remote.lastModifiedAt ?? 0;
    // The first time an existing account is opened on this installation, its
    // cloud wallet and preferences are authoritative. Otherwise a freshly
    // claimed welcome gift could make an empty install appear newer and replace
    // the account's real diamond balance. Progress and permanent unlocks are
    // still merged below, so legitimate guest play is not discarded.
    const preferLocal = options.preferRemoteProfile
        ? false
        : localModified >= remoteModified;
    const preferred = preferLocal ? local : remote;
    const other = preferLocal ? remote : local;
    const merged = cloneForCloud(preferred);

    merged.lastModifiedAt = Math.max(localModified, remoteModified) || undefined;
    merged.normalPuzzleCatalogVersion = Math.max(
        local.normalPuzzleCatalogVersion ?? 0,
        remote.normalPuzzleCatalogVersion ?? 0
    ) || undefined;

    merged.purchasedBackgrounds = unionStrings(local.purchasedBackgrounds, remote.purchasedBackgrounds);
    merged.purchasedNumberColors = unionStrings(local.purchasedNumberColors, remote.purchasedNumberColors);
    merged.purchasedSkills = unionStrings(local.purchasedSkills, remote.purchasedSkills);
    merged.purchasedSoundPacks = unionStrings(local.purchasedSoundPacks, remote.purchasedSoundPacks);
    merged.enabledSkills = unionStrings(preferred.enabledSkills)
        .filter((skillId) => merged.purchasedSkills.includes(skillId));
    merged.unlockedPack2 = unionStrings(local.unlockedPack2, remote.unlockedPack2);
    merged.unlockedPack3 = unionStrings(local.unlockedPack3, remote.unlockedPack3);
    merged.book2UnlockReady = unionStrings(local.book2UnlockReady, remote.book2UnlockReady);
    merged.book3UnlockReady = unionStrings(local.book3UnlockReady, remote.book3UnlockReady);
    merged.seenStrictModeWarnings = unionStrings(local.seenStrictModeWarnings, remote.seenStrictModeWarnings);
    merged.redeemedCoupons = unionStrings(local.redeemedCoupons, remote.redeemedCoupons);
    merged.processedPurchaseTransactions = unionStrings(
        local.processedPurchaseTransactions,
        remote.processedPurchaseTransactions
    );
    merged.claimedAchievements = unionStrings(local.claimedAchievements, remote.claimedAchievements);
    merged.watchedReplayPuzzleIds = unionStrings(
        local.watchedReplayPuzzleIds,
        remote.watchedReplayPuzzleIds
    );

    merged.bonusClaimed = Boolean(local.bonusClaimed || remote.bonusClaimed);
    merged.nextBonusClaimTime = Math.max(local.nextBonusClaimTime ?? 0, remote.nextBonusClaimTime ?? 0);
    merged.starterPackPurchased = Boolean(local.starterPackPurchased || remote.starterPackPurchased);
    merged.books2AllOwned = Boolean(local.books2AllOwned || remote.books2AllOwned);
    merged.books3AllOwned = Boolean(local.books3AllOwned || remote.books3AllOwned);
    merged.booksForeverOwned = Boolean(local.booksForeverOwned || remote.booksForeverOwned);
    merged.welcomeGiftClaimed = Boolean(local.welcomeGiftClaimed || remote.welcomeGiftClaimed);
    merged.pepino = mergePepino(preferred.pepino, other.pepino);

    const counterKeys: Array<keyof NonNullable<StoredData['achievementCounters']>> = [
        'scansUsed',
        'pepinoGiftsOpened',
        'hardPerfectGames',
        'replaysWatched',
        'nudgeCellClicks',
        'hardNoScanWins',
        'noteGamesWon',
    ];
    merged.achievementCounters = { ...preferred.achievementCounters! };
    for (const key of counterKeys) {
        merged.achievementCounters[key] = Math.max(
            local.achievementCounters?.[key] ?? 0,
            remote.achievementCounters?.[key] ?? 0
        );
    }
    merged.achievementCounters.replaysWatched = merged.watchedReplayPuzzleIds.length;

    merged.stats = {
        totalGamesWon: Math.max(local.stats?.totalGamesWon ?? 0, remote.stats?.totalGamesWon ?? 0),
        totalDiamondsEarned: Math.max(
            local.stats?.totalDiamondsEarned ?? 0,
            remote.stats?.totalDiamondsEarned ?? 0
        ),
        perfectGames: Math.max(local.stats?.perfectGames ?? 0, remote.stats?.perfectGames ?? 0),
        gamesWonByDifficulty: maxNumberMap(
            local.stats?.gamesWonByDifficulty,
            remote.stats?.gamesWonByDifficulty
        ),
        diamondsEarnedBySource: maxNumberMap(
            local.stats?.diamondsEarnedBySource,
            remote.stats?.diamondsEarnedBySource
        ),
    };

    merged.progress = {};
    for (const key of new Set([...Object.keys(local.progress), ...Object.keys(remote.progress)])) {
        const localProgress = local.progress[key];
        const remoteProgress = remote.progress[key];
        merged.progress[key] = localProgress && remoteProgress
            ? mergeProgressEntry(localProgress, remoteProgress, preferLocal)
            : cloneForCloud(localProgress ?? remoteProgress);
    }

    return merged;
};

const getChunkId = (progress: LevelProgress) => {
    const difficulty = progress.difficulty.toLowerCase().replace(/\s+/g, '-');
    const book = Math.min(3, Math.max(1, Math.ceil(progress.levelId / 100)));
    return `${difficulty}-book-${book}`;
};

const compactProgress = (progress: LevelProgress): CloudLevelProgress => {
    const compacted = cloneForCloud(progress);
    const isCompleted = compacted.status === 'completed' || compacted.bestTime !== undefined;
    if (isCompleted) {
        compacted.status = 'completed';
        delete compacted.boardState;
    } else if (compacted.status !== 'in-progress') {
        delete compacted.boardState;
        delete compacted.moveLog;
    }

    const { boardState, ...cloudProgress } = compacted;
    const encodedBoard = boardState ? encodeBoardState(boardState) : undefined;
    return encodedBoard
        ? { ...cloudProgress, boardState: encodedBoard }
        : cloudProgress;
};

const buildProgressChunks = (progress: StoredData['progress']) => {
    const chunks = new Map<string, Record<string, CloudLevelProgress>>();
    for (const [key, value] of Object.entries(progress)) {
        const chunkId = getChunkId(value);
        const levels = chunks.get(chunkId) ?? {};
        levels[key] = compactProgress(value);
        chunks.set(chunkId, levels);
    }
    return chunks;
};

const toProfileData = (data: StoredData): CloudProfileData => {
    const { progress: _progress, ...profile } = data;
    return cloneForCloud(profile);
};

class CloudSaveManager {
    private uid: string | null = null;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private storageUnsubscribe: (() => void) | null = null;
    private profileHash: string | null = null;
    private chunkHashes = new Map<string, string>();
    private workQueue: Promise<void> = Promise.resolve();
    private remoteReady = false;

    isAvailable() {
        return Capacitor.isNativePlatform();
    }

    async connect(uid: string): Promise<CloudSyncResult> {
        if (!this.isAvailable()) return { synced: false, usedCloudData: false };
        if (this.uid === uid && this.storageUnsubscribe) {
            return { synced: true, usedCloudData: false };
        }

        await this.disconnect({ flush: true });
        this.uid = uid;

        let usedCloudData = false;
        let synced = true;
        try {
            usedCloudData = await this.bootstrap(uid);
        } catch (error) {
            synced = false;
            console.error('Cloud save: Initial sync failed', error);
        }

        this.storageUnsubscribe = Storage.subscribe(() => this.scheduleSave());
        return { synced, usedCloudData };
    }

    async disconnect(options: { flush?: boolean } = {}) {
        if (options.flush && this.uid) await this.flush();
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.storageUnsubscribe?.();
        this.storageUnsubscribe = null;
        this.uid = null;
        this.remoteReady = false;
        this.profileHash = null;
        this.chunkHashes.clear();
    }

    async flush() {
        if (!this.uid) return;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = null;
        await Storage.flushPendingWrites();
        await this.enqueueUpload(Storage.getStoredData());
    }

    private scheduleSave() {
        if (!this.uid) return;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            void this.enqueueUpload(Storage.getStoredData());
        }, CLOUD_SAVE_DEBOUNCE_MS);
    }

    private enqueueUpload(data: StoredData) {
        const snapshot = cloneForCloud(data);
        this.workQueue = this.workQueue
            .catch(() => undefined)
            .then(async () => {
                const uid = this.uid;
                if (!uid) return;
                if (!this.remoteReady) {
                    await this.bootstrap(uid);
                    return;
                }
                await this.uploadNow(snapshot);
            })
            .catch((error) => console.error('Cloud save: Upload failed', error));
        return this.workQueue;
    }

    private async bootstrap(uid: string) {
        const local = Storage.getStoredData();
        const remote = await this.readRemote(uid, local);
        this.profileHash = remote.profileHash;
        this.chunkHashes = remote.chunkHashes;
        const hasSyncedAccount = await this.hasSyncedAccount(uid);

        const merged = remote.data
            ? mergeCloudAndDeviceData(local, remote.data, {
                preferRemoteProfile: !hasSyncedAccount,
            })
            : { ...local, lastModifiedAt: local.lastModifiedAt ?? Date.now() };
        const usedCloudData = Boolean(remote.data && contentHash(merged) !== contentHash(local));
        await Storage.replaceStoredData(merged);
        this.remoteReady = true;
        await this.uploadNow(Storage.getStoredData());
        await this.rememberSyncedAccount(uid);
        window.dispatchEvent(new CustomEvent(CLOUD_DATA_UPDATED_EVENT));
        return usedCloudData;
    }

    private async getSyncedAccountIds() {
        try {
            const { value } = await Preferences.get({ key: SYNCED_ACCOUNT_IDS_KEY });
            if (!value) return [] as string[];
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? parsed.filter((accountId): accountId is string => typeof accountId === 'string')
                : [];
        } catch (error) {
            console.warn('Cloud save: Could not read the local account marker', error);
            return [] as string[];
        }
    }

    private async hasSyncedAccount(uid: string) {
        return (await this.getSyncedAccountIds()).includes(uid);
    }

    private async rememberSyncedAccount(uid: string) {
        const accountIds = await this.getSyncedAccountIds();
        if (accountIds.includes(uid)) return;

        try {
            await Preferences.set({
                key: SYNCED_ACCOUNT_IDS_KEY,
                value: JSON.stringify([...accountIds, uid]),
            });
        } catch (error) {
            // Sync already succeeded. A missing marker only means the cloud
            // profile will be preferred again on the next connection.
            console.warn('Cloud save: Could not save the local account marker', error);
        }
    }

    private async readRemote(uid: string, localFallback: StoredData): Promise<RemoteSave> {
        const profileReference = `users/${uid}/saves/profile`;
        const progressReference = `users/${uid}/progress`;
        const [profileResult, progressResult] = await Promise.all([
            FirebaseFirestore.getDocument<CloudProfileDocument>({ reference: profileReference }),
            FirebaseFirestore.getCollection<CloudProgressDocument>({ reference: progressReference }),
        ]);

        const profileDocument = profileResult.snapshot.data;
        const progress: StoredData['progress'] = {};
        const chunkHashes = new Map<string, string>();
        for (const snapshot of progressResult.snapshots) {
            const levels = snapshot.data?.levels ?? {};
            chunkHashes.set(snapshot.id, contentHash(levels));
            for (const [key, cloudProgress] of Object.entries(levels)) {
                const { boardState, ...localProgress } = cloneForCloud(cloudProgress);
                const decodedBoard = decodeBoardState(boardState);
                progress[key] = decodedBoard
                    ? { ...localProgress, boardState: decodedBoard }
                    : localProgress;
            }
        }

        if (!profileDocument && progressResult.snapshots.length === 0) {
            return { data: null, profileHash: null, chunkHashes };
        }

        const profileData = profileDocument?.data ?? toProfileData(localFallback);
        return {
            data: {
                ...cloneForCloud(localFallback),
                ...cloneForCloud(profileData),
                progress,
            },
            profileHash: profileDocument ? contentHash(profileData) : null,
            chunkHashes,
        };
    }

    private async uploadNow(data: StoredData) {
        const uid = this.uid;
        if (!uid) return;

        const profile = toProfileData(data);
        const nextProfileHash = contentHash(profile);
        if (nextProfileHash !== this.profileHash) {
            const profileDocument: CloudProfileDocument = {
                schemaVersion: CLOUD_SCHEMA_VERSION,
                updatedAt: Date.now(),
                data: profile,
            };
            assertFirestoreSafe(profileDocument);
            await FirebaseFirestore.setDocument({
                reference: `users/${uid}/saves/profile`,
                data: profileDocument,
                merge: false,
            });
            this.profileHash = nextProfileHash;
        }

        const chunks = buildProgressChunks(data.progress);
        const chunkIds = new Set([...chunks.keys(), ...this.chunkHashes.keys()]);
        for (const chunkId of chunkIds) {
            const levels = chunks.get(chunkId) ?? {};
            const nextHash = contentHash(levels);
            if (nextHash === this.chunkHashes.get(chunkId)) continue;

            const progressDocument: CloudProgressDocument = {
                schemaVersion: CLOUD_SCHEMA_VERSION,
                updatedAt: Date.now(),
                levels,
            };
            assertFirestoreSafe(progressDocument);
            await FirebaseFirestore.setDocument({
                reference: `users/${uid}/progress/${chunkId}`,
                data: progressDocument,
                merge: false,
            });
            this.chunkHashes.set(chunkId, nextHash);
        }
    }
}

export const CloudSave = new CloudSaveManager();
