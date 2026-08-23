import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import type { WriteBatchOperation } from '@capacitor-firebase/firestore';
import type { Cell, LevelProgress, StoredData } from '../types';
import { Storage } from './storage';
import { chooseAccountSnapshot } from './profilePolicy';

const CLOUD_SCHEMA_VERSION = 2;
const CLOUD_SAVE_DEBOUNCE_MS = 1800;
const CLOUD_RETRY_BASE_MS = 2000;
const CLOUD_RETRY_MAX_MS = 60000;
const CLOUD_READ_TIMEOUT_MS = 8000;
const CLOUD_WRITE_TIMEOUT_MS = 8000;
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
    profileActivated: boolean;
}

const cloneForCloud = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const contentHash = (value: unknown) => JSON.stringify(cloneForCloud(value));

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const hasSupportedCloudSchema = (value: unknown) => (
    Number.isInteger(value)
    && Number(value) >= 1
    && Number(value) <= CLOUD_SCHEMA_VERSION
);

const isCloudProfileDocument = (value: unknown): value is CloudProfileDocument => {
    if (!isRecord(value)
        || !hasSupportedCloudSchema(value.schemaVersion)
        || !Number.isFinite(value.updatedAt)
        || !isRecord(value.data)) {
        return false;
    }

    const data = value.data;
    return Number.isFinite(data.points)
        && isRecord(data.settings)
        && Array.isArray(data.purchasedBackgrounds)
        && (typeof data.selectedBackground === 'string' || data.selectedBackground === null)
        && Array.isArray(data.purchasedNumberColors)
        && typeof data.selectedNumberColor === 'string'
        && Array.isArray(data.purchasedSkills)
        && Array.isArray(data.enabledSkills)
        && Array.isArray(data.purchasedSoundPacks)
        && typeof data.selectedSoundPack === 'string';
};

const isCloudProgressDocument = (value: unknown): value is CloudProgressDocument => {
    if (!isRecord(value)
        || !hasSupportedCloudSchema(value.schemaVersion)
        || !Number.isFinite(value.updatedAt)
        || !isRecord(value.levels)) {
        return false;
    }

    return Object.values(value.levels).every((progress) => (
        isRecord(progress)
        && Number.isFinite(progress.levelId)
        && typeof progress.difficulty === 'string'
        && typeof progress.status === 'string'
        && Number.isFinite(progress.timeElapsed)
    ));
};

const withTimeout = <T>(
    operation: Promise<T>,
    timeoutMs: number,
    description: string
): Promise<T> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
        reject(new Error(`${description} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    operation.then(
        (value) => {
            clearTimeout(timer);
            resolve(value);
        },
        (error) => {
            clearTimeout(timer);
            reject(error);
        }
    );
});

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
    private generation = 0;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private retryAttempt = 0;
    private storageUnsubscribe: (() => void) | null = null;
    private profileHash: string | null = null;
    private chunkHashes = new Map<string, string>();
    private workQueue: Promise<void> = Promise.resolve();
    private remoteReady = false;
    private onlineListenerAttached = false;

    private readonly handleOnline = () => {
        if (!this.uid) return;
        this.clearRetryTimer();
        this.retryAttempt = 0;
        void this.reconcileOnForeground();
    };

    private attachOnlineListener() {
        if (this.onlineListenerAttached) return;
        if (typeof window === 'undefined') return;
        window.addEventListener('online', this.handleOnline);
        this.onlineListenerAttached = true;
    }

    private detachOnlineListener() {
        if (!this.onlineListenerAttached) return;
        if (typeof window === 'undefined') return;
        window.removeEventListener('online', this.handleOnline);
        this.onlineListenerAttached = false;
    }

    isAvailable() {
        return Capacitor.isNativePlatform();
    }

    async connect(uid: string): Promise<CloudSyncResult> {
        if (!this.isAvailable()) {
            return { synced: false, usedCloudData: false, profileActivated: false };
        }
        if (this.uid === uid && this.storageUnsubscribe) {
            const generation = this.generation;
            try {
                await Storage.flushPendingWrites();
                const result = await this.enqueueReconcile(uid, generation);
                return result ?? {
                    synced: this.remoteReady,
                    usedCloudData: false,
                    profileActivated: Storage.isAccountProfileActive(uid),
                };
            } catch (error) {
                console.error('Cloud save: Reconnect failed', error);
                this.scheduleRetry(uid, generation);
                return {
                    synced: false,
                    usedCloudData: false,
                    profileActivated: Storage.isAccountProfileActive(uid),
                };
            }
        }

        await this.disconnect({ flush: true });
        this.uid = uid;
        this.generation += 1;
        const generation = this.generation;
        const accountCacheIsActive = Storage.isAccountProfileActive(uid);

        // Listen before the first network request. An already-active account can
        // keep playing offline while reconciliation retries in the background.
        this.storageUnsubscribe = Storage.subscribe(() => this.scheduleSave(uid, generation));
        this.attachOnlineListener();

        try {
            await Storage.flushPendingWrites();
            const result = await this.enqueueReconcile(uid, generation);
            if (result) return result;
            return { synced: false, usedCloudData: false, profileActivated: false };
        } catch (error) {
            console.error('Cloud save: Initial sync failed', error);

            // A restored account already has an isolated local cache. Keep that
            // session active offline and reconcile it when connectivity returns.
            if (this.isCurrentConnection(uid, generation)
                && accountCacheIsActive
                && Storage.isAccountProfileActive(uid)) {
                this.remoteReady = false;
                this.scheduleRetry(uid, generation);
                return { synced: false, usedCloudData: false, profileActivated: true };
            }

            // A first sign-in has no trusted account cache yet. Leave the guest
            // profile untouched so Auth can safely roll the attempted login back.
            this.clearConnection(uid, generation);
            return { synced: false, usedCloudData: false, profileActivated: false };
        }
    }

    async disconnect(options: { flush?: boolean } = {}) {
        const uid = this.uid;
        const generation = this.generation;
        if (options.flush && uid) {
            try {
                if (this.saveTimer) clearTimeout(this.saveTimer);
                this.saveTimer = null;
                await Storage.flushPendingWrites();
                if (this.remoteReady && this.isCurrentConnection(uid, generation)) {
                    await this.enqueueUpload(Storage.getStoredData(), uid, generation);
                }
            } catch (error) {
                // The account cache is already durable locally. A network failure
                // must not trap the user in an account they are trying to leave.
                console.error('Cloud save: Final upload before disconnect failed', error);
            }
        }
        this.clearConnection(uid, generation);
    }

    async flush() {
        const uid = this.uid;
        const generation = this.generation;
        if (!uid) return;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = null;
        await Storage.flushPendingWrites();
        if (!this.isCurrentConnection(uid, generation)) return;
        await this.enqueueUpload(Storage.getStoredData(), uid, generation);
    }

    /**
     * Reconcile after returning to the foreground. Callers do not need to catch
     * connectivity failures; the manager retains the local account cache and
     * retries with exponential backoff.
     */
    async reconcileOnForeground(): Promise<CloudSyncResult | null> {
        const uid = this.uid;
        const generation = this.generation;
        if (!uid) return null;

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.scheduleRetry(uid, generation);
            return null;
        }

        try {
            await Storage.flushPendingWrites();
            if (!this.isCurrentConnection(uid, generation)) return null;
            return await this.enqueueReconcile(uid, generation);
        } catch (error) {
            console.error('Cloud save: Foreground reconciliation failed', error);
            this.scheduleRetry(uid, generation);
            return null;
        }
    }

    private scheduleSave(uid: string, generation: number) {
        if (!this.isCurrentConnection(uid, generation)) return;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            if (!this.isCurrentConnection(uid, generation)) return;
            void this.enqueueUpload(Storage.getStoredData(), uid, generation).catch((error) => {
                console.error('Cloud save: Upload failed', error);
            });
        }, CLOUD_SAVE_DEBOUNCE_MS);
    }

    private enqueueTask<T>(
        uid: string,
        generation: number,
        task: () => Promise<T>
    ): Promise<T | null> {
        const run = this.workQueue
            .catch(() => undefined)
            .then(async () => {
                if (!this.isCurrentConnection(uid, generation)) return null;
                return task();
            });
        this.workQueue = run.then(() => undefined, () => undefined);
        return run;
    }

    private enqueueUpload(data: StoredData, uid: string, generation: number) {
        const snapshot = cloneForCloud(data);
        return this.enqueueTask(uid, generation, async () => {
            try {
                if (!this.remoteReady) {
                    await this.reconcileNow(uid, generation);
                    return;
                }
                await this.uploadNow(snapshot, uid, generation);
                this.markSyncSucceeded(uid, generation);
            } catch (error) {
                this.scheduleRetry(uid, generation);
                throw error;
            }
        });
    }

    private enqueueReconcile(uid: string, generation: number) {
        return this.enqueueTask(uid, generation, async () => {
            try {
                return await this.reconcileNow(uid, generation);
            } catch (error) {
                this.scheduleRetry(uid, generation);
                throw error;
            }
        });
    }

    private async reconcileNow(
        uid: string,
        generation: number
    ): Promise<CloudSyncResult | null> {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('Cloud save is offline.');
        }

        const remote = await this.readRemote(uid);
        if (!this.isCurrentConnection(uid, generation)) return null;

        // Read local state after the network request so gameplay performed while
        // Firestore was responding participates in the snapshot decision.
        const accountCache = Storage.getStoredData();
        const accountIsAlreadyActive = Storage.isAccountProfileActive(uid);
        this.profileHash = remote.profileHash;
        this.chunkHashes = remote.chunkHashes;

        const choice = chooseAccountSnapshot({
            accountIsAlreadyActive,
            accountCache,
            cloudSnapshot: remote.data,
            guestSnapshot: Storage.getGuestProfile(),
        });
        const selectedSnapshot = cloneForCloud(choice.snapshot);
        selectedSnapshot.lastModifiedAt ??= Date.now();
        const usedCloudData = choice.source === 'cloud'
            && contentHash(selectedSnapshot) !== contentHash(accountCache);

        if (contentHash(selectedSnapshot) !== contentHash(accountCache)) {
            await Storage.replaceStoredData(selectedSnapshot);
            if (!this.isCurrentConnection(uid, generation)) return null;
        }
        if (!accountIsAlreadyActive) {
            await Storage.activateAccountProfile(uid);
            if (!this.isCurrentConnection(uid, generation)) return null;
        }
        this.remoteReady = true;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(CLOUD_DATA_UPDATED_EVENT));
        }

        let synced = true;
        try {
            await this.uploadNow(Storage.getStoredData(), uid, generation);
            this.markSyncSucceeded(uid, generation);
        } catch (error) {
            synced = false;
            console.error('Cloud save: Reconciliation upload failed', error);
            this.scheduleRetry(uid, generation);
        }

        if (!this.isCurrentConnection(uid, generation)) return null;
        return { synced, usedCloudData, profileActivated: true };
    }

    private async readRemote(uid: string): Promise<RemoteSave> {
        const profileReference = `users/${uid}/saves/profile`;
        const progressReference = `users/${uid}/progress`;
        const [profileResult, progressResult] = await withTimeout(
            Promise.all([
                FirebaseFirestore.getDocument<CloudProfileDocument>({ reference: profileReference }),
                FirebaseFirestore.getCollection<CloudProgressDocument>({ reference: progressReference }),
            ]),
            CLOUD_READ_TIMEOUT_MS,
            'Cloud save read'
        );

        const snapshots = [profileResult.snapshot, ...progressResult.snapshots];
        if (snapshots.some((snapshot) => (
            snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites
        ))) {
            throw new Error('Cloud save read did not reach the Firestore server.');
        }

        const profileDocument = profileResult.snapshot.data;
        if (profileDocument && !isCloudProfileDocument(profileDocument)) {
            throw new Error('Cloud profile is malformed or uses an unsupported schema.');
        }
        const progress: StoredData['progress'] = {};
        const chunkHashes = new Map<string, string>();
        for (const snapshot of progressResult.snapshots) {
            if (!isCloudProgressDocument(snapshot.data)) {
                throw new Error(`Cloud progress chunk ${snapshot.id} is malformed or unsupported.`);
            }
            const levels = snapshot.data.levels;
            chunkHashes.set(snapshot.id, contentHash(levels));
            for (const [key, cloudProgress] of Object.entries(levels)) {
                const { boardState, ...localProgress } = cloneForCloud(cloudProgress);
                const decodedBoard = decodeBoardState(boardState);
                progress[key] = decodedBoard
                    ? { ...localProgress, boardState: decodedBoard }
                    : localProgress;
            }
        }

        if (!profileDocument) {
            // The profile document is the authoritative commit/root. Orphaned
            // progress documents must never replace trusted local or guest
            // data, but they also must not deadlock sync forever. Preserve their
            // hashes so the next atomic upload can replace/delete them.
            return { data: null, profileHash: null, chunkHashes };
        }

        const defaultData = Storage.createDefaultData();
        const profileData = profileDocument?.data ?? toProfileData(defaultData);
        return {
            data: {
                ...cloneForCloud(defaultData),
                ...cloneForCloud(profileData),
                progress,
            },
            profileHash: profileDocument ? contentHash(profileData) : null,
            chunkHashes,
        };
    }

    private async uploadNow(data: StoredData, uid: string, generation: number) {
        if (!this.isCurrentConnection(uid, generation)) return;

        const profile = toProfileData(data);
        const nextProfileHash = contentHash(profile);
        const operations: WriteBatchOperation[] = [];
        const nextChunkHashes = new Map<string, string>();
        const updatedAt = Date.now();

        if (nextProfileHash !== this.profileHash) {
            const profileDocument: CloudProfileDocument = {
                schemaVersion: CLOUD_SCHEMA_VERSION,
                updatedAt,
                data: profile,
            };
            assertFirestoreSafe(profileDocument);
            operations.push({
                type: 'set',
                reference: `users/${uid}/saves/profile`,
                data: profileDocument,
                options: { merge: false },
            });
        }

        const chunks = buildProgressChunks(data.progress);
        const chunkIds = new Set([...chunks.keys(), ...this.chunkHashes.keys()]);
        for (const chunkId of chunkIds) {
            const levels = chunks.get(chunkId);
            if (!levels) {
                operations.push({
                    type: 'delete',
                    reference: `users/${uid}/progress/${chunkId}`,
                });
                continue;
            }
            const nextHash = contentHash(levels);
            if (nextHash === this.chunkHashes.get(chunkId)) continue;

            const progressDocument: CloudProgressDocument = {
                schemaVersion: CLOUD_SCHEMA_VERSION,
                updatedAt,
                levels,
            };
            assertFirestoreSafe(progressDocument);
            operations.push({
                type: 'set',
                reference: `users/${uid}/progress/${chunkId}`,
                data: progressDocument,
                options: { merge: false },
            });
            nextChunkHashes.set(chunkId, nextHash);
        }

        if (operations.length === 0) return;
        await withTimeout(
            FirebaseFirestore.writeBatch({ operations }),
            CLOUD_WRITE_TIMEOUT_MS,
            'Cloud save write'
        );
        if (!this.isCurrentConnection(uid, generation)) return;

        if (nextProfileHash !== this.profileHash) {
            this.profileHash = nextProfileHash;
        }
        for (const [chunkId, hash] of nextChunkHashes) {
            this.chunkHashes.set(chunkId, hash);
        }
        for (const chunkId of [...this.chunkHashes.keys()]) {
            if (!chunks.has(chunkId)) this.chunkHashes.delete(chunkId);
        }
    }

    private isCurrentConnection(uid: string, generation: number) {
        return this.uid === uid && this.generation === generation;
    }

    private markSyncSucceeded(uid: string, generation: number) {
        if (!this.isCurrentConnection(uid, generation)) return;
        this.retryAttempt = 0;
        this.clearRetryTimer();
    }

    private scheduleRetry(uid: string, generation: number) {
        if (!this.isCurrentConnection(uid, generation) || this.retryTimer) return;
        const delay = Math.min(
            CLOUD_RETRY_BASE_MS * (2 ** this.retryAttempt),
            CLOUD_RETRY_MAX_MS
        );
        this.retryAttempt += 1;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (!this.isCurrentConnection(uid, generation)) return;
            void this.enqueueReconcile(uid, generation).catch((error) => {
                console.error('Cloud save: Scheduled reconciliation failed', error);
            });
        }, delay);
    }

    private clearRetryTimer() {
        if (!this.retryTimer) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    private clearConnection(uid: string | null, generation: number) {
        if (uid !== null && !this.isCurrentConnection(uid, generation)) return;
        if (uid === null && this.uid !== null) return;

        this.generation += 1;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.clearRetryTimer();
        this.retryAttempt = 0;
        this.storageUnsubscribe?.();
        this.storageUnsubscribe = null;
        this.detachOnlineListener();
        this.uid = null;
        this.remoteReady = false;
        this.profileHash = null;
        this.chunkHashes.clear();
        this.workQueue = Promise.resolve();
    }
}

export const CloudSave = new CloudSaveManager();
