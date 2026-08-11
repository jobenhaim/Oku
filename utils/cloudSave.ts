import { Capacitor } from '@capacitor/core';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import type { Cell, LevelProgress, StoredData } from '../types';
import { Storage } from './storage';
import { chooseAccountSnapshot } from './profilePolicy';

const CLOUD_SCHEMA_VERSION = 2;
const CLOUD_SAVE_DEBOUNCE_MS = 1800;
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
        if (!this.isAvailable()) {
            return { synced: false, usedCloudData: false, profileActivated: false };
        }
        if (this.uid === uid && this.storageUnsubscribe) {
            return {
                synced: this.remoteReady,
                usedCloudData: false,
                profileActivated: Storage.isAccountProfileActive(uid),
            };
        }

        await this.disconnect({ flush: true });
        this.uid = uid;

        try {
            const result = await this.bootstrap(uid);
            this.storageUnsubscribe = Storage.subscribe(() => this.scheduleSave());
            return result;
        } catch (error) {
            console.error('Cloud save: Initial sync failed', error);
            await this.disconnect({ flush: false });
            return { synced: false, usedCloudData: false, profileActivated: false };
        }
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
        const upload = this.workQueue
            .catch(() => undefined)
            .then(async () => {
                const uid = this.uid;
                if (!uid) return;
                if (!this.remoteReady) {
                    await this.bootstrap(uid);
                    return;
                }
                await this.uploadNow(snapshot);
            });
        this.workQueue = upload.catch((error) => {
            console.error('Cloud save: Upload failed', error);
        });
        return upload;
    }

    private async bootstrap(uid: string) {
        const accountCache = Storage.getStoredData();
        const accountIsAlreadyActive = Storage.isAccountProfileActive(uid);
        const remote = await this.readRemote(uid);
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

        await Storage.replaceStoredData(selectedSnapshot);
        await Storage.activateAccountProfile(uid);
        this.remoteReady = true;
        window.dispatchEvent(new CustomEvent(CLOUD_DATA_UPDATED_EVENT));

        let synced = true;
        try {
            await this.uploadNow(Storage.getStoredData());
        } catch (error) {
            synced = false;
            console.error('Cloud save: Initial upload failed', error);
        }

        return { synced, usedCloudData, profileActivated: true };
    }

    private async readRemote(uid: string): Promise<RemoteSave> {
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
