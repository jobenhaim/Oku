
import { AppSettings, Board, LevelProgress, StoredData, PepinoState, Difficulty, PermanentPurchaseOwnership, StorePurchaseUnlock, DiamondEarnSource, PlayerProfile, HintCandidateProgress } from '../types';
import { Preferences } from '@capacitor/preferences';
import { getHintCost, getScanRefillCost } from './constants';
import { hasValidHintCandidateProgressIntegrity } from './hints';
import {
  isActiveAccount,
  parseActiveProfile,
  serializeActiveProfile,
  type ActiveProfile,
} from './profilePolicy';

const STORAGE_KEY = 'oku_data_v1';
const LEGACY_STORAGE_KEY = 'minimal_sudoku_data_v1';
const GUEST_PROFILE_KEY = 'oku_guest_profile_v1';
const ACTIVE_PROFILE_KEY = 'oku_active_profile_v1';
const ACCOUNT_PROFILE_KEY_PREFIX = 'oku_account_profile_v1:';
const LEGACY_PLAYER_PROFILE_KEY = 'zen_profile';
const NORMAL_PUZZLE_CATALOG_VERSION = 1;
export const PROFILE_ACCOUNT_INTRO_KEY = 'oku_profile_account_intro_seen_v1';

export const hasPlayerBoardInput = (board?: Board) => Boolean(board?.some(row =>
    row.some(cell => !cell.isFixed && (cell.value !== null || cell.notes.length > 0))
));

const sanitizeHintCandidateProgress = (value: unknown): HintCandidateProgress | undefined => {
    if (!hasValidHintCandidateProgressIntegrity(value)) return undefined;
    const exclusions = value.exclusions.map(exclusion => ({ ...exclusion })).sort((left, right) => (
        left.row - right.row || left.col - right.col || left.value - right.value
    ));

    return {
        version: 1,
        boardSignature: value.boardSignature,
        exclusions,
        integrity: value.integrity,
    };
};

const storedBoardSignature = (value: unknown): string | null => {
    if (!Array.isArray(value) || value.length !== 9) return null;
    const rows: string[] = [];
    for (const rawRow of value) {
        if (!Array.isArray(rawRow) || rawRow.length !== 9) return null;
        let rowSignature = '';
        for (const rawCell of rawRow) {
            if (!rawCell || typeof rawCell !== 'object') return null;
            const cellValue = (rawCell as { value?: unknown }).value;
            if (cellValue === null) {
                rowSignature += '0';
            } else if (Number.isInteger(cellValue) && (cellValue as number) >= 1 && (cellValue as number) <= 9) {
                rowSignature += String(cellValue);
            } else {
                return null;
            }
        }
        rows.push(rowSignature);
    }
    return rows.join('/');
};

const DEFAULT_SETTINGS: AppSettings = {
  sound: true,
  highlight: true,
  autoEraseNotes: true, // Default ON
  vibration: true,
  showTimer: true,
  appearance: 'light',
  digitFirst: false, // Default OFF
  screenWakeLock: false, // Default OFF
  generateReplay: true, // Default ON
  pillNotifications: true, // Default ON
  goodLuckMessage: true, // Default ON
  scanWarningNotifications: true, // Default ON
  hiddenDifficulties: [], // Default show all
  devAutoSolve: false, // Default OFF
};

const DEFAULT_STATS = {
    totalGamesWon: 0,
    totalDiamondsEarned: 0,
    perfectGames: 0,
    gamesWonByDifficulty: {} as Record<string, number>,
    diamondsEarnedBySource: {} as Record<string, number>,
};

const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
    username: 'Zen Player',
    hasEditedName: false,
    claimedRank: 0,
    lastSeenRank: 0,
};

const sanitizeBreakdown = (breakdown: unknown): Record<string, number> => {
    if (!breakdown || typeof breakdown !== 'object') return {};
    const sanitized: Record<string, number> = {};
    for (const [key, value] of Object.entries(breakdown as Record<string, unknown>)) {
        const amount = Math.max(0, Math.floor(Number(value) || 0));
        if (amount > 0) sanitized[key] = amount;
    }
    return sanitized;
};

const sanitizeHintUsage = (usage: unknown): Record<string, number> => {
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return {};
    const sanitized: Record<string, number> = {};
    for (const [key, value] of Object.entries(usage as Record<string, unknown>)) {
        if (!key || key.length > 120 || !Number.isFinite(value)) continue;
        const count = Math.max(0, Math.floor(Number(value)));
        if (count > 0) sanitized[key] = count;
    }
    return sanitized;
};

const ensureStatsBreakdowns = (data: StoredData) => {
    if (!data.stats) data.stats = { ...DEFAULT_STATS, gamesWonByDifficulty: {}, diamondsEarnedBySource: {} };

    const savedWinBreakdown = sanitizeBreakdown(data.stats.gamesWonByDifficulty);
    const inferredWins: Record<string, number> = {};
    for (const progress of Object.values(data.progress || {})) {
        if (progress.status !== 'completed' && progress.bestTime === undefined) continue;
        inferredWins[progress.difficulty] = (inferredWins[progress.difficulty] || 0) + 1;
    }

    // Older versions only stored the aggregate win count, or placed that
    // aggregate under `previous`. Keep any part that cannot be reconstructed
    // from level progress as an unclassified remainder instead of silently
    // reducing totalGamesWon during migration.
    const previousAggregate = savedWinBreakdown.previous || 0;
    delete savedWinBreakdown.previous;
    const savedKnownTotal = Object.values(savedWinBreakdown).reduce((sum, value) => sum + value, 0);
    const legacyTotal = Math.max(
        0,
        Math.floor(Number(data.stats.totalGamesWon) || 0),
        previousAggregate,
        savedKnownTotal,
    );

    for (const [difficulty, inferredCount] of Object.entries(inferredWins)) {
        savedWinBreakdown[difficulty] = Math.max(savedWinBreakdown[difficulty] || 0, inferredCount);
    }

    const knownTotal = Object.values(savedWinBreakdown).reduce((sum, value) => sum + value, 0);
    const preservedTotal = Math.max(legacyTotal, knownTotal);
    const unclassifiedRemainder = preservedTotal - knownTotal;
    if (unclassifiedRemainder > 0) savedWinBreakdown.previous = unclassifiedRemainder;

    data.stats.gamesWonByDifficulty = savedWinBreakdown;
    data.stats.totalGamesWon = preservedTotal;

    const savedDiamondBreakdown = sanitizeBreakdown(data.stats.diamondsEarnedBySource);
    if (!data.stats.diamondsEarnedBySource || savedDiamondBreakdown.previous) {
        const rebuilt = { ...savedDiamondBreakdown };
        const unclassified = rebuilt.previous || data.stats.totalDiamondsEarned;
        delete rebuilt.previous;
        let remaining = Math.max(0, unclassified);

        if (data.welcomeGiftClaimed && !rebuilt.welcomeGift && remaining > 0) {
            const welcomeAmount = Math.min(100, remaining);
            rebuilt.welcomeGift = welcomeAmount;
            remaining -= welcomeAmount;
        }
        if (remaining > 0) {
            const source = (data.nextBonusClaimTime || 0) > 0 ? 'dailyGifts' : 'other';
            rebuilt[source] = (rebuilt[source] || 0) + remaining;
        }
        data.stats.diamondsEarnedBySource = rebuilt;
    } else {
        data.stats.diamondsEarnedBySource = savedDiamondBreakdown;
        const trackedDiamonds = Object.values(data.stats.diamondsEarnedBySource).reduce((sum, value) => sum + value, 0);
        if (trackedDiamonds < data.stats.totalDiamondsEarned) {
            data.stats.diamondsEarnedBySource.other = (data.stats.diamondsEarnedBySource.other || 0) + data.stats.totalDiamondsEarned - trackedDiamonds;
        }
    }
};

const recordGameWin = (data: StoredData, difficulty: Difficulty) => {
    ensureStatsBreakdowns(data);
    const winBreakdown = data.stats!.gamesWonByDifficulty!;
    winBreakdown[difficulty] = (winBreakdown[difficulty] || 0) + 1;
    data.stats!.totalGamesWon = Object.values(winBreakdown)
        .reduce((sum, value) => sum + value, 0);
};

const recordDiamondEarning = (data: StoredData, amount: number, source: DiamondEarnSource) => {
    if (amount <= 0) return;
    ensureStatsBreakdowns(data);
    data.stats!.totalDiamondsEarned += amount;
    const breakdown = data.stats!.diamondsEarnedBySource!;
    breakdown[source] = (breakdown[source] || 0) + amount;
};

const emptyAchievementCounters = () => ({
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
});

const createInitialData = (): StoredData => ({
    playerProfile: { ...DEFAULT_PLAYER_PROFILE },
    settings: { ...DEFAULT_SETTINGS, hiddenDifficulties: [] },
    points: 0,
    progress: {},
    hintUsageByPuzzle: {},
    normalPuzzleCatalogVersion: NORMAL_PUZZLE_CATALOG_VERSION,
    purchasedBackgrounds: ['bg-default', 'bg-dyn-default'],
    selectedBackground: 'bg-default',
    purchasedNumberColors: ['num-default'],
    selectedNumberColor: 'num-default',
    purchasedSkills: [],
    enabledSkills: [],
    purchasedSoundPacks: ['snd-zen'],
    selectedSoundPack: 'snd-zen',
    bonusClaimed: false,
    nextBonusClaimTime: 0,
    starterPackPurchased: false,
    books2AllOwned: false,
    books3AllOwned: false,
    booksForeverOwned: false,
    unlockedPack2: [],
    unlockedPack3: [],
    book2UnlockReady: [],
    book3UnlockReady: [],
    pepino: {
        unlocked: false,
        hasPendingGift: false,
        pendingGiftCount: 0,
        firstGiftClaimed: false,
        firstMessageShown: false,
    },
    seenStrictModeWarnings: [],
    redeemedCoupons: [],
    welcomeGiftClaimed: false,
    processedPurchaseTransactions: [],
    claimedAchievements: [],
    watchedReplayPuzzleIds: [],
    achievementCounters: emptyAchievementCounters(),
    stats: { ...DEFAULT_STATS, gamesWonByDifficulty: {}, diamondsEarnedBySource: {} },
});

function getStoredData(): StoredData {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    
    // Migration Logic: Check for legacy key if new key doesn't exist
    if (!raw) {
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
            raw = legacyRaw;
            // Persist migration immediately
            localStorage.setItem(STORAGE_KEY, legacyRaw);
        }
    }

    if (!raw) {
      return createInitialData();
    }
    const data = JSON.parse(raw);
    
    // Migrations
    if (typeof data.points !== 'number') data.points = 0;
    data.hintUsageByPuzzle = sanitizeHintUsage(data.hintUsageByPuzzle);

    // Normal's human-flow catalogue replaces its previous boards. Preserve all
    // completions and rewards, but discard an unfinished snapshot whose fixed
    // cells would otherwise be compared with the replacement puzzle's answer.
    if ((data.normalPuzzleCatalogVersion ?? 0) < NORMAL_PUZZLE_CATALOG_VERSION) {
        for (const progress of Object.values(data.progress || {}) as LevelProgress[]) {
            if (progress.difficulty !== Difficulty.Normal || progress.status !== 'in-progress') continue;
            progress.status = progress.bestTime !== undefined ? 'completed' : 'not-started';
            progress.boardState = undefined;
            progress.moveLog = undefined;
            progress.timeElapsed = 0;
            progress.lastPlayed = undefined;
            progress.scanUses = 3;
            progress.scanRefillsPurchased = 0;
            progress.revealUses = undefined;
            progress.scribeUses = 4;
            progress.hasMadeMistake = false;
            progress.hasUsedNotes = false;
            progress.hintCandidateProgress = undefined;
        }
        data.normalPuzzleCatalogVersion = NORMAL_PUZZLE_CATALOG_VERSION;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    
    if (!data.purchasedBackgrounds) data.purchasedBackgrounds = ['bg-default', 'bg-dyn-default'];
    if (!data.purchasedBackgrounds.includes('bg-default')) data.purchasedBackgrounds.push('bg-default');
    if (!data.purchasedBackgrounds.includes('bg-dyn-default')) data.purchasedBackgrounds.push('bg-dyn-default');

    if (data.selectedBackground === undefined) data.selectedBackground = 'bg-default';
    
    if (!data.purchasedNumberColors) data.purchasedNumberColors = ['num-default'];
    if (!data.selectedNumberColor) data.selectedNumberColor = 'num-default';
    // Lagoon was retired in favor of Ember. Preserve ownership for anyone who
    // bought it, and keep their selected style valid.
    if (data.purchasedNumberColors.includes('num-lagoon')) {
        data.purchasedNumberColors = data.purchasedNumberColors.filter((id: string) => id !== 'num-lagoon');
        if (!data.purchasedNumberColors.includes('num-ruby')) data.purchasedNumberColors.push('num-ruby');
    }
    if (data.selectedNumberColor === 'num-lagoon') data.selectedNumberColor = 'num-ruby';

    // Emerald was retired because it visually overlapped Matcha. Transfer the
    // purchase and selection so existing players never lose an owned style.
    if (data.purchasedNumberColors.includes('num-emerald')) {
        data.purchasedNumberColors = data.purchasedNumberColors.filter((id: string) => id !== 'num-emerald');
        if (!data.purchasedNumberColors.includes('num-matcha')) data.purchasedNumberColors.push('num-matcha');
    }
    if (data.selectedNumberColor === 'num-emerald') data.selectedNumberColor = 'num-matcha';

    if (!data.purchasedSoundPacks) data.purchasedSoundPacks = ['snd-zen'];
    if (!data.selectedSoundPack) data.selectedSoundPack = 'snd-zen';

    if (data.settings.vibration === undefined) data.settings.vibration = true;

    if (data.settings.showTimer === undefined) {
        if ((data.settings as any).hideTimer !== undefined) {
            data.settings.showTimer = !(data.settings as any).hideTimer;
            delete (data.settings as any).hideTimer;
        } else {
            data.settings.showTimer = true;
        }
    }
    
    if (data.settings.autoEraseNotes === undefined) data.settings.autoEraseNotes = true;
    if (data.settings.digitFirst === undefined) data.settings.digitFirst = false;
    if (data.settings.screenWakeLock === undefined) data.settings.screenWakeLock = false;
    if (data.settings.generateReplay === undefined) data.settings.generateReplay = true; // Default ON
    if (data.settings.pillNotifications === undefined) data.settings.pillNotifications = true;
    if (data.settings.goodLuckMessage === undefined) data.settings.goodLuckMessage = true;
    if (data.settings.scanWarningNotifications === undefined) data.settings.scanWarningNotifications = true;
    if (data.settings.hiddenDifficulties === undefined) data.settings.hiddenDifficulties = [];
    if (data.settings.devAutoSolve === undefined) data.settings.devAutoSolve = false;

    if (data.settings.appearance === undefined) {
        data.settings.appearance = 'light'; 
    }
    
    if (!data.purchasedSkills) data.purchasedSkills = [];
    if (!data.enabledSkills) data.enabledSkills = [...data.purchasedSkills]; // Default new field to existing purchased skills
    // Retire Reveal and migrate former Auto owners to Guard's legacy skill ID without losing access.
    data.purchasedSkills = data.purchasedSkills
        .map((skillId: string) => skillId === 'skill-auto' ? 'skill-scribe' : skillId)
        .filter((skillId: string) => skillId !== 'skill-reveal');
    data.enabledSkills = data.enabledSkills
        .map((skillId: string) => skillId === 'skill-auto' ? 'skill-scribe' : skillId)
        .filter((skillId: string) => skillId !== 'skill-reveal');
    data.purchasedSkills = [...new Set(data.purchasedSkills)];
    data.enabledSkills = [...new Set(data.enabledSkills)];

    // Light is now part of Oku's welcome gift. Backfill it for players who
    // claimed the previous welcome gift before this reward was introduced.
    if (data.welcomeGiftClaimed && !data.purchasedSkills.includes('skill-nudge')) {
        data.purchasedSkills.push('skill-nudge');
        data.enabledSkills.push('skill-nudge');
    }

    for (const progress of Object.values(data.progress || {}) as Array<LevelProgress & { autoUses?: number }>) {
        if (progress.scribeUses === undefined && progress.autoUses !== undefined) {
            progress.scribeUses = Math.min(progress.autoUses, 4);
        }
        progress.scanUses = Math.max(0, Math.floor(progress.scanUses ?? 3));
        progress.scanRefillsPurchased = Math.max(0, Math.floor(progress.scanRefillsPurchased ?? 0));
        const candidateProgress = sanitizeHintCandidateProgress(progress.hintCandidateProgress);
        progress.hintCandidateProgress = candidateProgress
            && storedBoardSignature(progress.boardState) === candidateProgress.boardSignature
            ? candidateProgress
            : undefined;
        delete progress.autoUses;
    }
    
    if (data.bonusClaimed === undefined) data.bonusClaimed = false;
    if (data.nextBonusClaimTime === undefined) data.nextBonusClaimTime = 0;
    
    if (data.starterPackPurchased === undefined) data.starterPackPurchased = false;
    if (data.books2AllOwned === undefined) data.books2AllOwned = false;
    if (data.books3AllOwned === undefined) data.books3AllOwned = false;
    if (data.booksForeverOwned === undefined) data.booksForeverOwned = false;
    // Existing Starter Pack owners keep every permanent reward as the bundle
    // evolves. Consumable diamonds are intentionally never re-awarded here.
    if (data.starterPackPurchased) {
        ensureStarterPackUnlocked(data);
    }
    
    if (!data.unlockedPack2) data.unlockedPack2 = [];
    if (!data.unlockedPack3) data.unlockedPack3 = [];
    if (!data.book2UnlockReady) data.book2UnlockReady = [];
    if (!data.book3UnlockReady) data.book3UnlockReady = [];
    
    if (!data.pepino) {
        data.pepino = { unlocked: false, hasPendingGift: false, pendingGiftCount: 0, firstGiftClaimed: false, firstMessageShown: false };
    } else {
        // Migration from Timer based (lastGiftTime) to Event based (hasPendingGift)
        if ((data.pepino as any).nextGiftDelay !== undefined) {
            const old = data.pepino as any;
            const wasReady = Date.now() >= (old.lastGiftTime || 0) + (old.nextGiftDelay || 0);
            data.pepino = {
                unlocked: old.unlocked,
                hasPendingGift: wasReady,
                pendingGiftCount: wasReady ? 1 : 0,
                unlockedAt: old.unlocked ? Date.now() : undefined // Fallback unlock time
            };
        }

        // Migration from the single pending-gift flag to a cumulative gift queue.
        if (typeof data.pepino.pendingGiftCount !== 'number') {
            data.pepino.pendingGiftCount = data.pepino.hasPendingGift ? 1 : 0;
        }
        data.pepino.pendingGiftCount = Math.max(0, Math.floor(data.pepino.pendingGiftCount));
        data.pepino.hasPendingGift = data.pepino.pendingGiftCount > 0;

        // Existing Pepino owners keep their current reward/message behavior.
        // Fresh unlocks explicitly start with both one-time moments pending.
        if (data.pepino.firstGiftClaimed === undefined) {
            data.pepino.firstGiftClaimed = data.pepino.unlocked;
        }
        if (data.pepino.firstMessageShown === undefined) {
            data.pepino.firstMessageShown = data.pepino.unlocked;
        }
    }
    
    if (!data.stats) {
        // Simple backfill of totalGamesWon based on progress
        const wonCount = Object.values(data.progress || {}).filter((p: any) => p.status === 'completed' || p.bestTime !== undefined).length;
        data.stats = { totalGamesWon: wonCount, totalDiamondsEarned: 0, perfectGames: 0 };
    }
    ensureStatsBreakdowns(data);

    if (!data.playerProfile) {
        let legacyProfile: Partial<PlayerProfile> = {};
        try {
            const legacyRaw = localStorage.getItem(LEGACY_PLAYER_PROFILE_KEY);
            if (legacyRaw) {
                const parsed = JSON.parse(legacyRaw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    legacyProfile = parsed as Partial<PlayerProfile>;
                }
                // Import this device-only profile at most once. Leaving the old
                // key around could later leak a guest's name/title into a newly
                // downloaded account snapshot that predates this migration.
                localStorage.removeItem(LEGACY_PLAYER_PROFILE_KEY);
            }
        } catch {
            // A malformed legacy profile must never prevent the main save from
            // loading. It simply falls back to the values below.
        }

        const earnedRank = Math.max(0, Math.floor((data.stats?.totalGamesWon || 0) / 20));
        const username = typeof legacyProfile.username === 'string'
            ? legacyProfile.username
            : DEFAULT_PLAYER_PROFILE.username;
        const claimedRank = Number.isFinite(legacyProfile.claimedRank)
            ? Math.max(0, Math.floor(legacyProfile.claimedRank!))
            : Number.isFinite(legacyProfile.lastSeenRank)
                ? Math.max(0, Math.floor(legacyProfile.lastSeenRank!))
                : earnedRank;
        const lastSeenRank = Number.isFinite(legacyProfile.lastSeenRank)
            ? Math.max(0, Math.floor(legacyProfile.lastSeenRank!))
            : claimedRank;
        data.playerProfile = {
            username,
            hasEditedName: typeof legacyProfile.hasEditedName === 'boolean'
                ? legacyProfile.hasEditedName
                : username !== DEFAULT_PLAYER_PROFILE.username,
            claimedRank,
            lastSeenRank,
        };
    } else {
        data.playerProfile = {
            username: typeof data.playerProfile.username === 'string'
                ? data.playerProfile.username
                : DEFAULT_PLAYER_PROFILE.username,
            hasEditedName: typeof data.playerProfile.hasEditedName === 'boolean'
                ? data.playerProfile.hasEditedName
                : false,
            claimedRank: Number.isFinite(data.playerProfile.claimedRank)
                ? Math.max(0, Math.floor(data.playerProfile.claimedRank))
                : 0,
            lastSeenRank: Number.isFinite(data.playerProfile.lastSeenRank)
                ? Math.max(0, Math.floor(data.playerProfile.lastSeenRank))
                : 0,
        };
    }

    if (!data.seenStrictModeWarnings) data.seenStrictModeWarnings = [];
    if (!data.redeemedCoupons) data.redeemedCoupons = [];
    if (data.welcomeGiftClaimed === undefined) data.welcomeGiftClaimed = false;
    if (!Array.isArray(data.processedPurchaseTransactions)) data.processedPurchaseTransactions = [];
    if (!Array.isArray(data.claimedAchievements)) data.claimedAchievements = [];
    if (!data.achievementCounters) {
        const inferredScans = Object.values(data.progress || {}).reduce((total: number, progress: any) => {
            const remaining = typeof progress.scanUses === 'number' ? progress.scanUses : 3;
            return total + Math.max(0, 3 - remaining);
        }, 0);
        data.achievementCounters = {
            ...emptyAchievementCounters(),
            scansUsed: inferredScans,
            pepinoGiftsOpened: data.pepino?.firstGiftClaimed ? 1 : 0,
        };
    }
    data.achievementCounters.scansUsed = Math.max(0, Math.floor(data.achievementCounters.scansUsed || 0));
    data.achievementCounters.pepinoGiftsOpened = Math.max(0, Math.floor(data.achievementCounters.pepinoGiftsOpened || 0));
    if (typeof data.achievementCounters.hardPerfectGames !== 'number') {
        data.achievementCounters.hardPerfectGames = Math.max(0, Math.floor((data.achievementCounters as any).hardPerfectStageProgress || 0));
    }
    data.achievementCounters.hardPerfectGames = Math.max(0, Math.floor(data.achievementCounters.hardPerfectGames || 0));
    if (!Array.isArray(data.watchedReplayPuzzleIds)) {
        data.watchedReplayPuzzleIds = [];
    }
    data.watchedReplayPuzzleIds = [...new Set(
        data.watchedReplayPuzzleIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    )];
    data.achievementCounters.replaysWatched = data.watchedReplayPuzzleIds.length;
    data.achievementCounters.nudgeCellClicks = Math.max(
        0,
        Math.floor(data.achievementCounters.nudgeCellClicks || 0)
    );
    data.achievementCounters.pepinoHeartTaps = Math.max(
        0,
        Math.floor(data.achievementCounters.pepinoHeartTaps || 0)
    );
    data.achievementCounters.pepinoTenLoveTaps = Math.max(
        0,
        Math.floor(data.achievementCounters.pepinoTenLoveTaps || 0)
    );
    data.achievementCounters.pepinoStrongTaps = Math.max(
        0,
        Math.floor(data.achievementCounters.pepinoStrongTaps || 0)
    );
    data.achievementCounters.hardNoScanWins = Math.max(
        0,
        Math.floor(data.achievementCounters.hardNoScanWins || 0)
    );
    data.achievementCounters.noteGamesWon = Math.max(
        0,
        Math.floor(data.achievementCounters.noteGamesWon || 0)
    );

    // Generator 2.0 and 1.1 changed the board behind each level ID. When
    // returning to Generator 1.0, reset only their unfinished snapshots so no
    // saved board is checked against another puzzle's solution.
    if ((data as any).puzzleCatalogVersion === 2 || (data as any).puzzleGeneratorVersion === '1.1') {
        for (const progress of Object.values(data.progress || {}) as LevelProgress[]) {
            if (progress.status !== 'in-progress') continue;
            progress.status = progress.bestTime !== undefined ? 'completed' : 'not-started';
            progress.boardState = undefined;
            progress.moveLog = undefined;
            progress.timeElapsed = 0;
            progress.lastPlayed = undefined;
            progress.scanUses = 3;
            progress.scanRefillsPurchased = 0;
            progress.revealUses = undefined;
            progress.scribeUses = 4;
            progress.hintCandidateProgress = undefined;
        }
    }
    if ((data as any).puzzleCatalogVersion !== undefined) delete (data as any).puzzleCatalogVersion;
    if ((data as any).puzzleGeneratorVersion !== undefined) delete (data as any).puzzleGeneratorVersion;

    // Clean up deprecated fields if they exist from previous versions
    if ((data as any).purchasedBundles) delete (data as any).purchasedBundles;
    // Clean up old boolean if exists (migration)
    if ((data as any).hasSeenStrictModeWarning !== undefined) delete (data as any).hasSeenStrictModeWarning;

    return data;
  } catch (e) {
    console.error("Failed to load data", e);
    return createInitialData();
  }
}

// Native Preferences writes are asynchronous. A win triggers several saves in
// quick succession (diamonds, level progress, and Pepino), so allowing those
// writes to race can leave an older snapshot as the final native value.
// Keep them ordered while localStorage remains immediately available to the UI.
let nativeSaveQueue: Promise<void> = Promise.resolve();
const pendingNativeValues = new Map<string, string>();
type StorageListener = (data: StoredData) => void;
const storageListeners = new Set<StorageListener>();

interface StoredSnapshotCandidate {
  raw: string;
  lastModifiedAt: number;
}

const parseStoredSnapshotCandidate = (raw: string | null): StoredSnapshotCandidate | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredData> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (!parsed.settings || typeof parsed.settings !== 'object') return null;
    if (!parsed.progress || typeof parsed.progress !== 'object' || Array.isArray(parsed.progress)) return null;

    return {
      raw,
      lastModifiedAt: Number.isFinite(parsed.lastModifiedAt)
        ? Math.max(0, Math.floor(parsed.lastModifiedAt!))
        : 0,
    };
  } catch {
    return null;
  }
};

const chooseNewestStoredSnapshot = (
  localCandidate: StoredSnapshotCandidate | null,
  nativeCandidate: StoredSnapshotCandidate | null,
) => {
  if (!localCandidate) return nativeCandidate;
  if (!nativeCandidate) return localCandidate;

  // Equal timestamps prefer WebView storage because it is updated
  // synchronously, while the Preferences mirror is intentionally async.
  return localCandidate.lastModifiedAt >= nativeCandidate.lastModifiedAt
    ? localCandidate
    : nativeCandidate;
};

const queuePreferenceSet = (key: string, value: string) => {
  pendingNativeValues.set(key, value);
  nativeSaveQueue = nativeSaveQueue
    .catch(() => undefined)
    .then(async () => {
      await Preferences.set({ key, value });
      if (pendingNativeValues.get(key) === value) {
        pendingNativeValues.delete(key);
      }
    })
    .catch((error: unknown) => console.error(`Native save failed for ${key}`, error));
  return nativeSaveQueue;
};

const retryPendingPreferenceWrites = async () => {
  await nativeSaveQueue;
  const entries = [...pendingNativeValues.entries()];
  for (const [key, value] of entries) {
    try {
      await Preferences.set({ key, value });
      if (pendingNativeValues.get(key) === value) {
        pendingNativeValues.delete(key);
      }
    } catch (error) {
      console.error(`Native save retry failed for ${key}`, error);
    }
  }
};

// Account cloud flushes already wait for Preferences, but guests do not have a
// CloudSave connection. Queue the newest synchronous WebView snapshot again at
// lifecycle boundaries so it is the final native write even after a burst of
// board moves.
const queueLatestSnapshotForLifecycle = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) void queuePreferenceSet(STORAGE_KEY, raw);
  } catch (error) {
    console.warn('Could not queue the latest save during app suspension', error);
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') queueLatestSnapshotForLifecycle();
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', queueLatestSnapshotForLifecycle);
}

const persistAuxiliaryValue = async (key: string, value: string) => {
  localStorage.setItem(key, value);
  await queuePreferenceSet(key, value);
};

const getActiveProfile = (): ActiveProfile | null => (
  parseActiveProfile(localStorage.getItem(ACTIVE_PROFILE_KEY))
);

const getAccountProfileKey = (uid: string) => (
  `${ACCOUNT_PROFILE_KEY_PREFIX}${encodeURIComponent(uid)}`
);

const readGuestProfile = (): StoredData | null => {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_KEY);
    return raw ? JSON.parse(raw) as StoredData : null;
  } catch (error) {
    console.warn('Could not read the saved guest profile', error);
    return null;
  }
};

const persistGuestProfile = async (data: StoredData) => {
  await persistAuxiliaryValue(GUEST_PROFILE_KEY, JSON.stringify(data));
};

const readAccountProfile = (uid: string): StoredData | null => {
  try {
    const raw = localStorage.getItem(getAccountProfileKey(uid));
    return raw ? JSON.parse(raw) as StoredData : null;
  } catch (error) {
    console.warn(`Could not read the saved account profile for ${uid}`, error);
    return null;
  }
};

const persistAccountProfile = async (uid: string, data: StoredData) => {
  await persistAuxiliaryValue(getAccountProfileKey(uid), JSON.stringify(data));
};

const loadNewestAccountProfile = async (uid: string): Promise<StoredData | null> => {
  const key = getAccountProfileKey(uid);
  const localCandidate = parseStoredSnapshotCandidate(localStorage.getItem(key));
  let nativeCandidate: StoredSnapshotCandidate | null = null;
  try {
    const nativeResult = await Preferences.get({ key });
    nativeCandidate = parseStoredSnapshotCandidate(nativeResult.value);
  } catch (error) {
    console.warn(`Could not read the native account cache for ${uid}`, error);
  }

  const selected = chooseNewestStoredSnapshot(localCandidate, nativeCandidate);
  if (!selected) return null;

  localStorage.setItem(key, selected.raw);
  if (nativeCandidate?.raw !== selected.raw) void queuePreferenceSet(key, selected.raw);

  // Migrate the cached snapshot through the same path as every active save.
  localStorage.setItem(STORAGE_KEY, selected.raw);
  const migrated = getStoredData();
  const migratedRaw = JSON.stringify(migrated);
  localStorage.setItem(STORAGE_KEY, migratedRaw);
  localStorage.setItem(key, migratedRaw);
  void queuePreferenceSet(STORAGE_KEY, migratedRaw);
  void queuePreferenceSet(key, migratedRaw);
  return migrated;
};

const persistActiveProfile = async (profile: ActiveProfile) => {
  await persistAuxiliaryValue(ACTIVE_PROFILE_KEY, serializeActiveProfile(profile));
};

function saveData(
  data: StoredData,
  options: { touchModifiedAt?: boolean; notify?: boolean; mirrorActiveProfile?: boolean } = {}
) {
  try {
    // A read-only restore/check must not make an old device look newer than a
    // device that actually progressed. Compare business data before advancing
    // the conflict timestamp or notifying CloudSave.
    if (options.touchModifiedAt !== false) {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw) as StoredData;
          const { lastModifiedAt: _currentModifiedAt, ...currentContent } = current;
          const { lastModifiedAt: _nextModifiedAt, ...nextContent } = data;
          if (JSON.stringify(currentContent) === JSON.stringify(nextContent)) {
            return false;
          }
        } catch {
          // Persisting a valid replacement is the recovery path for bad JSON.
        }
      }
    }

    if (options.touchModifiedAt !== false) {
      const previousModifiedAt = Number.isFinite(data.lastModifiedAt)
        ? Math.max(0, Math.floor(data.lastModifiedAt!))
        : 0;
      data.lastModifiedAt = Math.max(Date.now(), previousModifiedAt + 1);
    }
    const stringified = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, stringified);

    void queuePreferenceSet(STORAGE_KEY, stringified);

    const activeProfile = getActiveProfile();
    if (options.mirrorActiveProfile !== false && activeProfile?.kind === 'account') {
      const accountKey = getAccountProfileKey(activeProfile.uid);
      localStorage.setItem(accountKey, stringified);
      void queuePreferenceSet(accountKey, stringified);
    }

    if (options.notify !== false) {
      storageListeners.forEach((listener) => listener(data));
    }
    return true;
  } catch (e) {
    console.error("Failed to save data", e);
    return false;
  }
}

function ensurePepinoUnlocked(data: StoredData) {
  if (data.pepino?.unlocked) return;
  data.pepino = {
    unlocked: true,
    hasPendingGift: true,
    pendingGiftCount: 1,
    firstGiftClaimed: false,
    firstMessageShown: false,
    unlockedAt: Date.now()
  };
}

function ensureStarterPackUnlocked(data: StoredData) {
  data.starterPackPurchased = true;
  if (!data.purchasedSkills) data.purchasedSkills = [];
  if (!data.enabledSkills) data.enabledSkills = [];
  if (!data.purchasedSoundPacks) data.purchasedSoundPacks = ['snd-zen'];

  for (const skillId of ['skill-focus', 'skill-scribe', 'skill-scan']) {
    if (!data.purchasedSkills.includes(skillId)) {
      data.purchasedSkills.push(skillId);
    }
    if (!data.enabledSkills.includes(skillId)) data.enabledSkills.push(skillId);
  }
  if (!data.purchasedSoundPacks.includes('snd-piano')) {
    data.purchasedSoundPacks.push('snd-piano');
  }
  if (!data.purchasedNumberColors.includes('num-teal')) {
    data.purchasedNumberColors.push('num-teal');
  }
}

interface LevelProgressMutationResult {
  changed: boolean;
  completedNow: boolean;
}

/**
 * Apply the level snapshot and every stat derived directly from crossing into
 * `completed`. All public progress writers use this helper so an autosave and
 * the victory transaction cannot disagree about completion or personal bests.
 */
const applyLevelProgressMutation = (
  data: StoredData,
  progress: LevelProgress,
  isPerfectGame = false,
): LevelProgressMutationResult => {
  const key = `${progress.difficulty}-${progress.levelId}`;
  const existing = data.progress[key];

  // A lifecycle or Scan callback can arrive after the synchronous victory
  // write. Never reopen a completed puzzle with that stale snapshot.
  if (existing?.status === 'completed' && progress.status !== 'completed') {
    return { changed: false, completedNow: false };
  }

  const completedNow = progress.status === 'completed' && existing?.status !== 'completed';
  let bestTime = existing?.bestTime;

  if (progress.status === 'completed') {
    const incomingTime = Math.max(0, Math.floor(progress.timeElapsed || 0));
    const existingBest = bestTime === undefined
      ? undefined
      : Math.max(0, Math.floor(bestTime));

    // A repeated callback for a completion we already stored must be a true
    // no-op when the stored result is at least as good. This is what prevents a
    // second reward/notification from a duplicate native or React callback.
    if (!completedNow && existingBest !== undefined && existingBest <= incomingTime) {
      return { changed: false, completedNow: false };
    }

    if (existingBest === undefined || incomingTime < existingBest) {
      bestTime = incomingTime;
    }

    if (completedNow) {
      if (!data.stats) {
        data.stats = { ...DEFAULT_STATS, gamesWonByDifficulty: {}, diamondsEarnedBySource: {} };
      }
      recordGameWin(data, progress.difficulty as Difficulty);

      if (isPerfectGame) {
        data.stats.perfectGames += 1;
        if ([Difficulty.Hard, Difficulty.Intense, Difficulty.Impossible].includes(progress.difficulty as Difficulty)) {
          if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
          data.achievementCounters.hardPerfectGames += 1;
        }
      }

      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      if (
        [Difficulty.Hard, Difficulty.Intense, Difficulty.Impossible].includes(progress.difficulty as Difficulty)
        && (progress.scanUses ?? 3) === 3
      ) {
        data.achievementCounters.hardNoScanWins += 1;
      }
      if (progress.hasUsedNotes) {
        data.achievementCounters.noteGamesWon += 1;
      }
    }
  }

  const storedProgress: LevelProgress = {
    ...progress,
    bestTime,
  };
  if (storedProgress.status === 'completed') {
    // Completed games only need their result/economy metadata. Keeping 81 Cell
    // objects plus the entire move history for hundreds of finished levels can
    // exhaust WebView localStorage and make an otherwise successful save fail.
    storedProgress.boardState = undefined;
    storedProgress.moveLog = undefined;
    storedProgress.hintCandidateProgress = undefined;
  }
  data.progress[key] = storedProgress;
  return { changed: true, completedNow };
};

const applyPepinoGiftClaim = (data: StoredData, reward: number) => {
  const pendingGiftCount = Math.max(0, Math.floor(data.pepino?.pendingGiftCount || 0));
  if (!data.pepino || pendingGiftCount <= 0) return false;

  data.pepino.pendingGiftCount = pendingGiftCount - 1;
  data.pepino.hasPendingGift = data.pepino.pendingGiftCount > 0;
  data.pepino.firstGiftClaimed = true;
  if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
  data.achievementCounters.pepinoGiftsOpened += 1;

  if (reward > 0) {
    data.points += reward;
    recordDiamondEarning(data, reward, 'pepino');
  }
  return true;
};

const applyDifficultyCompletion = (data: StoredData, difficulty: Difficulty) => {
  if (!data.stats) {
    data.stats = { ...DEFAULT_STATS, gamesWonByDifficulty: {}, diamondsEarnedBySource: {} };
  }

  for (let level = 1; level <= 100; level += 1) {
    const key = `${difficulty}-${level}`;
    const existing = data.progress[key];
    const wasAlreadyCompleted = existing?.status === 'completed' || existing?.bestTime !== undefined;
    if (existing?.status === 'completed') continue;

    data.progress[key] = {
      ...existing,
      levelId: level,
      difficulty,
      status: 'completed',
      timeElapsed: existing?.timeElapsed || 60,
      bestTime: existing?.bestTime !== undefined ? Math.min(existing.bestTime, 60) : 60,
      boardState: undefined,
      moveLog: undefined,
      hintCandidateProgress: undefined,
      scanUses: existing?.scanUses ?? 3,
      scribeUses: existing?.scribeUses ?? 4,
    };

    if (!wasAlreadyCompleted) recordGameWin(data, difficulty);
  }
};

export const Storage = {
  getStoredData, 

  createDefaultData: () => createInitialData(),

  getPlayerProfile: (): PlayerProfile => {
      const profile = getStoredData().playerProfile ?? DEFAULT_PLAYER_PROFILE;
      // Do not expose the live object stored inside the full save snapshot.
      return { ...profile };
  },

  updatePlayerProfile: (partial: Partial<PlayerProfile>): PlayerProfile => {
      const data = getStoredData();
      const current = data.playerProfile ?? { ...DEFAULT_PLAYER_PROFILE };
      const next: PlayerProfile = {
          username: typeof partial.username === 'string' ? partial.username : current.username,
          hasEditedName: typeof partial.hasEditedName === 'boolean'
              ? partial.hasEditedName
              : current.hasEditedName,
          claimedRank: Number.isFinite(partial.claimedRank)
              ? Math.max(0, Math.floor(partial.claimedRank!))
              : current.claimedRank,
          lastSeenRank: Number.isFinite(partial.lastSeenRank)
              ? Math.max(0, Math.floor(partial.lastSeenRank!))
              : current.lastSeenRank,
      };

      if (
          current.username === next.username
          && current.hasEditedName === next.hasEditedName
          && current.claimedRank === next.claimedRank
          && current.lastSeenRank === next.lastSeenRank
      ) {
          return { ...current };
      }

      data.playerProfile = next;
      saveData(data);
      return { ...next };
  },

  getActiveProfile,

  isAccountProfileActive: (uid: string) => isActiveAccount(getActiveProfile(), uid),

  getGuestProfile: () => {
      const guest = readGuestProfile();
      if (guest) return JSON.parse(JSON.stringify(guest)) as StoredData;
      return getActiveProfile()?.kind === 'guest'
          ? JSON.parse(JSON.stringify(getStoredData())) as StoredData
          : createInitialData();
  },

  getAccountProfile: (uid: string) => {
      const account = readAccountProfile(uid);
      return account ? JSON.parse(JSON.stringify(account)) as StoredData : null;
  },

  captureGuestProfile: async () => {
      const activeProfile = getActiveProfile();
      if (activeProfile?.kind === 'account') return;
      await nativeSaveQueue;
      await persistGuestProfile(JSON.parse(JSON.stringify(getStoredData())) as StoredData);
  },

  activateAccountProfile: async (uid: string) => {
      if (!uid) throw new Error('Cannot activate an account without a user ID.');
      await persistAccountProfile(uid, getStoredData());
      await persistActiveProfile({ kind: 'account', uid });
  },

  restoreGuestProfile: async () => {
      const activeProfile = getActiveProfile();
      if (activeProfile?.kind === 'account') {
          await persistAccountProfile(activeProfile.uid, getStoredData());
      }
      const guestSnapshot = readGuestProfile() ?? createInitialData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestSnapshot));
      const migratedGuest = getStoredData();
      saveData(migratedGuest, { touchModifiedAt: false, mirrorActiveProfile: false });
      await persistGuestProfile(migratedGuest);
      await persistActiveProfile({ kind: 'guest' });
      await nativeSaveQueue;
      return migratedGuest;
  },

  initializeProfiles: async (authenticatedUid: string | null) => {
      let activeProfile = getActiveProfile();
      const guestProfileBeforeMigration = readGuestProfile();

      // One-time migration for installations created before profiles were
      // isolated. Preserve the current device save rather than risking loss.
      if (!guestProfileBeforeMigration) {
          await persistGuestProfile(JSON.parse(JSON.stringify(getStoredData())) as StoredData);
      }

      if (!authenticatedUid) {
          if (activeProfile?.kind === 'account') {
              return Storage.restoreGuestProfile();
          }
          if (!activeProfile) {
              await persistActiveProfile({ kind: 'guest' });
          }
          return getStoredData();
      }

      if (!activeProfile) {
          const cachedAccount = await loadNewestAccountProfile(authenticatedUid);
          if (cachedAccount) {
              await persistActiveProfile({ kind: 'account', uid: authenticatedUid });
              activeProfile = { kind: 'account', uid: authenticatedUid };
          } else if (!guestProfileBeforeMigration) {
              // A genuinely legacy signed-in installation has neither an active
              // marker nor an isolated guest. Its current slot is the only
              // recoverable account snapshot, so migrate it to both caches.
              await persistActiveProfile({ kind: 'account', uid: authenticatedUid });
              await persistAccountProfile(authenticatedUid, getStoredData());
              activeProfile = { kind: 'account', uid: authenticatedUid };
          } else {
              // If the profile marker alone was lost, a pre-existing guest cache
              // proves that profile isolation already ran. Never relabel that
              // guest as the restored Firebase account; CloudSave will either
              // load the account root or explicitly convert the guest.
              localStorage.setItem(STORAGE_KEY, JSON.stringify(guestProfileBeforeMigration));
              const migratedGuest = getStoredData();
              saveData(migratedGuest, {
                  touchModifiedAt: false,
                  notify: false,
                  mirrorActiveProfile: false,
              });
              await persistGuestProfile(migratedGuest);
              await persistActiveProfile({ kind: 'guest' });
              activeProfile = { kind: 'guest' };
          }
      } else if (activeProfile.kind === 'account' && activeProfile.uid === authenticatedUid) {
          await persistAccountProfile(authenticatedUid, getStoredData());
      } else if (activeProfile.kind === 'account') {
          // An external Firebase account switch must never reuse the previous
          // user's in-memory snapshot as the new user's account cache.
          await persistAccountProfile(activeProfile.uid, getStoredData());
          await Storage.restoreGuestProfile();
          activeProfile = { kind: 'guest' };
          const cachedAccount = await loadNewestAccountProfile(authenticatedUid);
          if (cachedAccount) {
              await persistActiveProfile({ kind: 'account', uid: authenticatedUid });
              activeProfile = { kind: 'account', uid: authenticatedUid };
          }
      } else if (activeProfile.kind === 'guest') {
          // Firebase may restore a session before cloud bootstrap. Keep the
          // latest guest snapshot ready for a safe rollback or first upload.
          await Storage.captureGuestProfile();
          const cachedAccount = await loadNewestAccountProfile(authenticatedUid);
          if (cachedAccount) {
              await persistActiveProfile({ kind: 'account', uid: authenticatedUid });
              activeProfile = { kind: 'account', uid: authenticatedUid };
          }
      }

      return getStoredData();
  },

  subscribe: (listener: StorageListener) => {
      storageListeners.add(listener);
      return () => storageListeners.delete(listener);
  },

  replaceStoredData: async (data: StoredData) => {
      // Put the incoming snapshot through Oku's normal migrations before it
      // becomes active. Cloud saves and long-idle guest profiles may come from
      // an older app version.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      saveData(getStoredData(), { touchModifiedAt: false });
      await nativeSaveQueue;
  },

  flushPendingWrites: async () => {
      await retryPendingPreferenceWrites();
  },
  
  initializeNative: async (): Promise<StoredData | null> => {
      try {
          const [storedResult, guestResult, activeProfileResult] = await Promise.all([
              Preferences.get({ key: STORAGE_KEY }),
              Preferences.get({ key: GUEST_PROFILE_KEY }),
              Preferences.get({ key: ACTIVE_PROFILE_KEY }),
          ]);
          const localGuestCandidate = parseStoredSnapshotCandidate(localStorage.getItem(GUEST_PROFILE_KEY));
          const nativeGuestCandidate = parseStoredSnapshotCandidate(guestResult.value);
          const selectedGuestCandidate = chooseNewestStoredSnapshot(localGuestCandidate, nativeGuestCandidate);
          if (selectedGuestCandidate) {
              localStorage.setItem(GUEST_PROFILE_KEY, selectedGuestCandidate.raw);
              if (guestResult.value !== selectedGuestCandidate.raw) {
                  void queuePreferenceSet(GUEST_PROFILE_KEY, selectedGuestCandidate.raw);
              }
          }

          // Auxiliary markers are written to localStorage synchronously before
          // their Preferences mirror. Prefer that local marker when the two
          // disagree after a suspension between those writes. A malformed local
          // value, however, must not hide a valid native marker.
          const localActiveProfileValue = localStorage.getItem(ACTIVE_PROFILE_KEY);
          const selectedActiveProfile = parseActiveProfile(localActiveProfileValue)
              ?? parseActiveProfile(activeProfileResult.value);
          const selectedActiveProfileValue = selectedActiveProfile
              ? serializeActiveProfile(selectedActiveProfile)
              : null;
          if (selectedActiveProfileValue) {
              localStorage.setItem(ACTIVE_PROFILE_KEY, selectedActiveProfileValue);
              if (activeProfileResult.value !== selectedActiveProfileValue) {
                  void queuePreferenceSet(ACTIVE_PROFILE_KEY, selectedActiveProfileValue);
              }
          }

          const localCurrentCandidate = parseStoredSnapshotCandidate(localStorage.getItem(STORAGE_KEY));
          const localLegacyCandidate = localCurrentCandidate
              ? null
              : parseStoredSnapshotCandidate(localStorage.getItem(LEGACY_STORAGE_KEY));
          let nativeCandidate = parseStoredSnapshotCandidate(storedResult.value);

          // Native migration fallback. A corrupt current value must not hide a
          // valid legacy snapshot.
          if (!nativeCandidate) {
              const legacy = await Preferences.get({ key: LEGACY_STORAGE_KEY });
              nativeCandidate = parseStoredSnapshotCandidate(legacy.value);
          }

          let selectedCandidate = chooseNewestStoredSnapshot(
              localCurrentCandidate ?? localLegacyCandidate,
              nativeCandidate,
          );

          if (selectedActiveProfile?.kind === 'guest' && selectedGuestCandidate) {
              // The generic slot can still contain the account snapshot if the
              // app stopped midway through sign-out. Logical profiles must not
              // compete by timestamp: an explicit guest marker always selects
              // the isolated guest cache.
              selectedCandidate = selectedGuestCandidate;
          } else if (selectedActiveProfile?.kind === 'account') {
              const accountKey = getAccountProfileKey(selectedActiveProfile.uid);
              const accountNativeResult = await Preferences.get({ key: accountKey });
              const accountCandidate = chooseNewestStoredSnapshot(
                  parseStoredSnapshotCandidate(localStorage.getItem(accountKey)),
                  parseStoredSnapshotCandidate(accountNativeResult.value),
              );

              // The UID-scoped copy cannot be mistaken for a guest snapshot if
              // the app stopped midway through sign-out/account switching.
              if (accountCandidate) selectedCandidate = accountCandidate;
          }

          if (selectedCandidate) {
              localStorage.setItem(STORAGE_KEY, selectedCandidate.raw);
              // Run normal migrations, then repair both mirrors with the same
              // complete snapshot without making hydration look like a mutation.
              const migrated = getStoredData();
              saveData(migrated, { touchModifiedAt: false, notify: false });
              if (selectedActiveProfile?.kind === 'account') {
                  await persistAccountProfile(selectedActiveProfile.uid, migrated);
              }
              await nativeSaveQueue;
              return migrated;
          }
          return null;
      } catch (e) {
          console.warn("Could not read native prefs", e);
          return null;
      }
  },

  getSettings: (): AppSettings => {
    return getStoredData().settings;
  },

  saveSettings: (settings: AppSettings) => {
    const data = getStoredData();
    data.settings = settings;
    saveData(data);
  },

  getPoints: (): number => {
    return getStoredData().points;
  },

  addPoints: (amount: number, source: DiamondEarnSource = 'other') => {
    const data = getStoredData();
    data.points += amount;
    recordDiamondEarning(data, amount, source);
    
    saveData(data);
    return data.points;
  },

  claimAchievement: (id: string, reward: number): boolean => {
      const data = getStoredData();
      if (!data.claimedAchievements) data.claimedAchievements = [];
      if (!id || reward < 0 || data.claimedAchievements.includes(id)) return false;

      data.claimedAchievements.push(id);
      data.points += reward;
      recordDiamondEarning(data, reward, 'achievements');
      saveData(data);
      return true;
  },

  recordScanUse: (elapsedSeconds: number) => {
      if (elapsedSeconds < 60) return false;
      const data = getStoredData();
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.scansUsed += 1;
      saveData(data);
      return true;
  },

  purchaseScanRefill: (difficulty: Difficulty, levelId: number) => {
      const data = getStoredData();
      const key = `${difficulty}-${levelId}`;
      const existing = data.progress[key];
      const refillsPurchased = Math.max(0, Math.floor(existing?.scanRefillsPurchased ?? 0));
      const cost = getScanRefillCost(refillsPurchased);

      if (data.points < cost) {
          return {
              success: false,
              points: data.points,
              scanUses: Math.max(0, Math.floor(existing?.scanUses ?? 3)),
              scanRefillsPurchased: refillsPurchased,
              cost,
          };
      }

      data.points -= cost;
      const scanUses = Math.max(0, Math.floor(existing?.scanUses ?? 0)) + 1;
      const nextRefillCount = refillsPurchased + 1;
      data.progress[key] = {
          ...existing,
          levelId,
          difficulty,
          status: existing?.status ?? 'not-started',
          timeElapsed: existing?.timeElapsed ?? 0,
          scanUses,
          scanRefillsPurchased: nextRefillCount,
      };
      saveData(data);

      return {
          success: true,
          points: data.points,
          scanUses,
          scanRefillsPurchased: nextRefillCount,
          cost,
      };
  },

  recordNudgeCellClick: () => {
      const data = getStoredData();
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.nudgeCellClicks += 1;
      saveData(data);
  },

  recordPepinoHeartTap: () => {
      const data = getStoredData();
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.pepinoHeartTaps += 1;
      if (data.claimedAchievements?.includes('pepino-love-tap')) {
          data.achievementCounters.pepinoTenLoveTaps += 1;
      }
      if (data.claimedAchievements?.includes('pepino-ten-love-taps')) {
          data.achievementCounters.pepinoStrongTaps += 1;
      }
      saveData(data);
  },

  recordReplayWatch: (puzzleId: string): boolean => {
      if (!puzzleId) return false;
      const data = getStoredData();
      if (!data.watchedReplayPuzzleIds) data.watchedReplayPuzzleIds = [];
      if (data.watchedReplayPuzzleIds.includes(puzzleId)) return false;

      data.watchedReplayPuzzleIds.push(puzzleId);
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.replaysWatched = data.watchedReplayPuzzleIds.length;
      saveData(data);
      return true;
  },
  
  getPurchasedBackgrounds: (): string[] => {
      return getStoredData().purchasedBackgrounds;
  },

  getSelectedBackground: (): string | null => {
      return getStoredData().selectedBackground;
  },

  purchaseBackground: (id: string, cost: number): boolean => {
      const data = getStoredData();
      if (data.points >= cost && !data.purchasedBackgrounds.includes(id)) {
          data.points -= cost;
          data.purchasedBackgrounds.push(id);
          saveData(data);
          return true;
      }
      return false;
  },

  selectBackground: (id: string | null) => {
      const data = getStoredData();
      data.selectedBackground = id;
      saveData(data);
  },

  getPurchasedNumberColors: (): string[] => {
      return getStoredData().purchasedNumberColors;
  },

  getSelectedNumberColor: (): string => {
      return getStoredData().selectedNumberColor;
  },

  purchaseNumberColor: (id: string, cost: number): boolean => {
      const data = getStoredData();
      if (data.points >= cost && !data.purchasedNumberColors.includes(id)) {
          data.points -= cost;
          data.purchasedNumberColors.push(id);
          saveData(data);
          return true;
      }
      return false;
  },

  selectNumberColor: (id: string) => {
      const data = getStoredData();
      data.selectedNumberColor = id;
      saveData(data);
  },

  getPurchasedSoundPacks: (): string[] => {
    return getStoredData().purchasedSoundPacks || ['snd-zen'];
  },

  getSelectedSoundPack: (): string => {
      return getStoredData().selectedSoundPack || 'snd-zen';
  },

  purchaseSoundPack: (id: string, cost: number): boolean => {
      const data = getStoredData();
      if (!data.purchasedSoundPacks) data.purchasedSoundPacks = ['snd-zen'];
      if (data.points >= cost && !data.purchasedSoundPacks.includes(id)) {
          data.points -= cost;
          data.purchasedSoundPacks.push(id);
          saveData(data);
          return true;
      }
      return false;
  },

  selectSoundPack: (id: string) => {
      const data = getStoredData();
      data.selectedSoundPack = id;
      saveData(data);
  },
  
  getPurchasedSkills: (): string[] => {
      return getStoredData().purchasedSkills;
  },

  getEnabledSkills: (): string[] => {
    const data = getStoredData();
    return data.enabledSkills || [];
  },
  
  purchaseSkill: (id: string, cost: number): boolean => {
      const data = getStoredData();
      if (data.points >= cost && !data.purchasedSkills.includes(id)) {
          data.points -= cost;
          data.purchasedSkills.push(id);
          if (!data.enabledSkills) data.enabledSkills = [];
          if (!data.enabledSkills.includes(id)) data.enabledSkills.push(id);
          saveData(data);
          return true;
      }
      return false;
  },

  toggleSkillEnabled: (id: string) => {
    const data = getStoredData();
    if (!data.enabledSkills) data.enabledSkills = [];
    if (data.enabledSkills.includes(id)) {
      data.enabledSkills = data.enabledSkills.filter(s => s !== id);
    } else if (data.purchasedSkills.includes(id)) {
      data.enabledSkills.push(id);
    }
    saveData(data);
    return data.enabledSkills;
  },

  isBonusClaimed: (): boolean => {
      return !!getStoredData().bonusClaimed;
  },

  setBonusClaimed: () => {
      const data = getStoredData();
      data.bonusClaimed = true;
      saveData(data);
  },

  getNextBonusClaimTime: (): number => {
      return getStoredData().nextBonusClaimTime || 0;
  },

  claimDailyBonus: (nextTime: number, amount: number): { applied: boolean; data: StoredData } => {
      const data = getStoredData();
      const now = Date.now();
      const normalizedNextTime = Number.isFinite(nextTime) ? Math.floor(nextTime) : 0;
      const reward = Number.isFinite(amount) ? Math.floor(amount) : 0;

      // Check the durable value, not React state, so a double tap or duplicate
      // event cannot claim twice before the UI re-renders.
      if ((data.nextBonusClaimTime || 0) > now || normalizedNextTime <= now || reward <= 0) {
          return { applied: false, data };
      }

      data.nextBonusClaimTime = normalizedNextTime;
      data.points += reward;
      recordDiamondEarning(data, reward, 'dailyGifts');
      saveData(data);
      return { applied: true, data };
  },

  setNextBonusClaimTime: (time: number) => {
      const data = getStoredData();
      data.nextBonusClaimTime = time;
      saveData(data);
  },
  
  isStarterPackPurchased: (): boolean => {
      return !!getStoredData().starterPackPurchased;
  },
  
  setStarterPackPurchased: () => {
      const data = getStoredData();
      data.starterPackPurchased = true;
      saveData(data);
  },

  fulfillStorePurchase: ({
      transactionId,
      diamonds,
      unlock
  }: {
      transactionId: string;
      diamonds: number;
      unlock: StorePurchaseUnlock;
  }): { applied: boolean; data: StoredData } => {
      const data = getStoredData();
      if (!data.processedPurchaseTransactions) data.processedPurchaseTransactions = [];

      if (!transactionId || data.processedPurchaseTransactions.includes(transactionId)) {
          return { applied: false, data };
      }

      data.processedPurchaseTransactions.push(transactionId);

      if (unlock === 'premium') ensurePepinoUnlocked(data);
      if (unlock === 'starter') ensureStarterPackUnlocked(data);

      if (diamonds > 0) {
          data.points += diamonds;
          recordDiamondEarning(data, diamonds, 'purchases');
      }

      saveData(data);
      return { applied: true, data };
  },

  restorePermanentPurchases: (ownership: PermanentPurchaseOwnership): StoredData => {
      const data = getStoredData();
      if (!data.processedPurchaseTransactions) data.processedPurchaseTransactions = [];

      if (ownership.premiumOwned) ensurePepinoUnlocked(data);
      if (ownership.starterOwned) ensureStarterPackUnlocked(data);
      // Reconcile book access in both directions. Previously this method only
      // ever set flags to true, so a refund or cleared sandbox history could
      // never remove stale local ownership.
      data.books2AllOwned = ownership.books2AllOwned;
      data.books3AllOwned = ownership.books3AllOwned;
      data.booksForeverOwned = ownership.booksForeverOwned;

      for (const transactionId of ownership.transactionIds) {
          if (transactionId && !data.processedPurchaseTransactions.includes(transactionId)) {
              data.processedPurchaseTransactions.push(transactionId);
          }
      }

      saveData(data);
      return data;
  },

  getUnlockedPacks2: (): string[] => {
      return getStoredData().unlockedPack2 || [];
  },

  isBooks2AllOwned: (): boolean => {
      const data = getStoredData();
      return Boolean(data.books2AllOwned || data.booksForeverOwned);
  },

  isBooks3AllOwned: (): boolean => {
      const data = getStoredData();
      return Boolean(data.books3AllOwned || data.booksForeverOwned);
  },

  isBooksForeverOwned: (): boolean => {
      return Boolean(getStoredData().booksForeverOwned);
  },

  isPack2Unlocked: (difficulty: string): boolean => {
      return getStoredData().unlockedPack2?.includes(difficulty) ?? false;
  },

  getBook2UnlockReady: (): string[] => {
      return getStoredData().book2UnlockReady || [];
  },

  purchasePack2Unlock: (difficulty: string, cost: number): boolean => {
      const data = getStoredData();
      if (!data.unlockedPack2) data.unlockedPack2 = [];
      if (!data.book2UnlockReady) data.book2UnlockReady = [];
      
      if (
          data.points >= cost
          && !data.unlockedPack2.includes(difficulty)
          && !data.book2UnlockReady.includes(difficulty)
      ) {
          data.points -= cost;
          data.book2UnlockReady.push(difficulty);
          saveData(data);
          return true;
      }
      return false;
  },

  revealPack2: (difficulty: string, hasAllBooks2Access = false): boolean => {
      const data = getStoredData();
      if (!data.unlockedPack2) data.unlockedPack2 = [];
      if (!data.book2UnlockReady) data.book2UnlockReady = [];
      const hasAccess = data.book2UnlockReady.includes(difficulty) || data.books2AllOwned || data.booksForeverOwned || hasAllBooks2Access;
      if (!hasAccess || data.unlockedPack2.includes(difficulty)) return false;

      data.book2UnlockReady = data.book2UnlockReady.filter(item => item !== difficulty);
      data.unlockedPack2.push(difficulty);
      saveData(data);
      return true;
  },

  getUnlockedPacks3: (): string[] => {
      return getStoredData().unlockedPack3 || [];
  },

  isPack3Unlocked: (difficulty: string): boolean => {
      return getStoredData().unlockedPack3?.includes(difficulty) ?? false;
  },

  getBook3UnlockReady: (): string[] => {
      return getStoredData().book3UnlockReady || [];
  },

  purchasePack3Unlock: (difficulty: string, cost: number): boolean => {
      const data = getStoredData();
      if (!data.unlockedPack3) data.unlockedPack3 = [];
      if (!data.book3UnlockReady) data.book3UnlockReady = [];
      
      if (
          data.points >= cost
          && !data.unlockedPack3.includes(difficulty)
          && !data.book3UnlockReady.includes(difficulty)
      ) {
          data.points -= cost;
          data.book3UnlockReady.push(difficulty);
          saveData(data);
          return true;
      }
      return false;
  },

  revealPack3: (difficulty: string, hasAllBooks3Access = false): boolean => {
      const data = getStoredData();
      if (!data.unlockedPack3) data.unlockedPack3 = [];
      if (!data.book3UnlockReady) data.book3UnlockReady = [];
      const hasAccess = data.book3UnlockReady.includes(difficulty) || data.books3AllOwned || data.booksForeverOwned || hasAllBooks3Access;
      if (!hasAccess || data.unlockedPack3.includes(difficulty)) return false;

      data.book3UnlockReady = data.book3UnlockReady.filter(item => item !== difficulty);
      data.unlockedPack3.push(difficulty);
      saveData(data);
      return true;
  },

  getLastPlayedGame: (): LevelProgress | undefined => {
    const data = getStoredData();
    const inProgressGames = Object.values(data.progress).filter(p =>
        p.status === 'in-progress'
        && Array.isArray(p.boardState)
        && p.boardState.length === 9
        && p.boardState.every(row => Array.isArray(row) && row.length === 9)
        && (
            hasPlayerBoardInput(p.boardState)
            || Boolean(p.hintCandidateProgress?.exclusions.length)
        )
    );
    if (inProgressGames.length === 0) return undefined;
    inProgressGames.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return inProgressGames[0];
  },

  getLevelProgress: (difficulty: string, levelId: number): LevelProgress | undefined => {
    const key = `${difficulty}-${levelId}`;
    return getStoredData().progress[key];
  },

  getHintEconomy: (difficulty: Difficulty, levelId: number) => {
    const data = getStoredData();
    const key = `${difficulty}-${levelId}`;
    const hintsUsed = Math.max(0, Math.floor(data.hintUsageByPuzzle?.[key] ?? 0));
    return {
      hintsUsed,
      cost: getHintCost(hintsUsed),
    };
  },

  consumeHint: (
    difficulty: Difficulty,
    levelId: number,
    expectedHintsUsed: number,
  ) => {
    const data = getStoredData();
    const key = `${difficulty}-${levelId}`;
    const usage = data.hintUsageByPuzzle ?? {};
    const hintsUsed = Math.max(0, Math.floor(usage[key] ?? 0));
    const expected = Math.max(0, Math.floor(expectedHintsUsed));
    const cost = getHintCost(hintsUsed);

    if (hintsUsed !== expected) {
      return {
        success: false as const,
        reason: 'stale' as const,
        points: data.points,
        hintsUsed,
        cost,
        nextCost: cost,
        charged: 0,
      };
    }

    if (data.points < cost) {
      return {
        success: false as const,
        reason: 'insufficient-points' as const,
        points: data.points,
        hintsUsed,
        cost,
        nextCost: cost,
        charged: 0,
      };
    }

    data.points -= cost;
    const nextHintsUsed = hintsUsed + 1;
    data.hintUsageByPuzzle = {
      ...usage,
      [key]: nextHintsUsed,
    };

    if (!saveData(data)) {
      return {
        success: false as const,
        reason: 'save-failed' as const,
        points: getStoredData().points,
        hintsUsed: Storage.getHintEconomy(difficulty, levelId).hintsUsed,
        cost,
        nextCost: getHintCost(hintsUsed),
        charged: 0,
      };
    }

    return {
      success: true as const,
      reason: 'consumed' as const,
      points: data.points,
      hintsUsed: nextHintsUsed,
      cost,
      nextCost: getHintCost(nextHintsUsed),
      charged: cost,
    };
  },

  saveLevelScanEconomy: (
    difficulty: Difficulty,
    levelId: number,
    scanUses: number,
    scanRefillsPurchased: number,
    scanAchievementElapsedSeconds?: number,
  ) => {
    const data = getStoredData();
    const key = `${difficulty}-${levelId}`;
    const existing = data.progress[key];
    data.progress[key] = {
        levelId,
        difficulty,
        status: existing?.status === 'completed' ? 'completed' : 'not-started',
        timeElapsed: existing?.status === 'completed' ? existing.timeElapsed : 0,
        bestTime: existing?.bestTime,
        scanUses: Math.max(0, Math.floor(scanUses)),
        scanRefillsPurchased: Math.max(0, Math.floor(scanRefillsPurchased)),
    };

    if (scanAchievementElapsedSeconds !== undefined && scanAchievementElapsedSeconds >= 60) {
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.scansUsed += 1;
    }
    saveData(data);
  },

  saveLevelProgress: (
    progress: LevelProgress,
    isPerfectGame: boolean = false
  ) => {
    const data = getStoredData();
    const mutation = applyLevelProgressMutation(data, progress, isPerfectGame);
    if (mutation.changed) saveData(data);
    return { applied: mutation.changed, data };
  },

  saveScannedLevelProgress: (progress: LevelProgress, elapsedSeconds: number) => {
    const data = getStoredData();
    const mutation = applyLevelProgressMutation(data, progress);
    if (!mutation.changed) return { applied: false, data };

    if (elapsedSeconds >= 60) {
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.scansUsed += 1;
    }

    saveData(data);
    return { applied: true, data };
  },

  completePuzzle: ({
    progress,
    isPerfectGame,
    diamonds,
  }: {
    progress: LevelProgress;
    isPerfectGame: boolean;
    diamonds: number;
  }): { applied: boolean; data: StoredData } => {
    const data = getStoredData();
    if (progress.status !== 'completed') return { applied: false, data };

    const mutation = applyLevelProgressMutation(data, progress, isPerfectGame);
    if (!mutation.completedNow) {
      // A genuinely faster result may still improve the personal best, but an
      // already-completed attempt can never award another win or diamonds.
      if (mutation.changed) saveData(data);
      return { applied: false, data };
    }

    const reward = Number.isFinite(diamonds) ? Math.max(0, Math.floor(diamonds)) : 0;
    if (reward > 0) {
      data.points += reward;
      recordDiamondEarning(data, reward, 'sudoku');
    }

    if (data.pepino?.unlocked) {
      data.pepino.pendingGiftCount = Math.max(0, Math.floor(data.pepino.pendingGiftCount || 0)) + 1;
      data.pepino.hasPendingGift = true;
    }

    saveData(data);
    return { applied: true, data };
  },
  
  clearLevelProgress: (difficulty: string, levelId: number, resetScanEconomy = false) => {
      const data = getStoredData();
      const key = `${difficulty}-${levelId}`;
      if (data.progress[key]) {
           const { bestTime, scanUses, scanRefillsPurchased } = data.progress[key];
           data.progress[key] = {
               levelId,
               difficulty: difficulty as any,
               status: 'not-started',
               boardState: undefined,
               timeElapsed: 0,
               lastPlayed: Date.now(),
               bestTime: bestTime,
               scanUses: resetScanEconomy ? 3 : Math.max(0, Math.floor(scanUses ?? 3)),
               scanRefillsPurchased: resetScanEconomy
                   ? 0
                   : Math.max(0, Math.floor(scanRefillsPurchased ?? 0)),
               scribeUses: 4,
           };
           saveData(data);
      }
  },

  resetAllData: async () => {
    const resetGuestProfile = getActiveProfile()?.kind !== 'account';
    localStorage.removeItem(STORAGE_KEY);
    // Also remove legacy just in case
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    // Reset one-time onboarding so a fresh profile sees the account reminder.
    localStorage.removeItem(PROFILE_ACCOUNT_INTRO_KEY);
    
    try {
        await Preferences.remove({ key: STORAGE_KEY });
        await Preferences.remove({ key: LEGACY_STORAGE_KEY });
    } catch (e) {
        console.warn("Error removing native preference", e);
    }

    // Persist and announce the fresh state as a real mutation. If an account
    // is connected, its cloud save is reset too instead of restoring stale
    // progress on the next launch.
    const freshData = getStoredData();
    saveData(freshData);
    if (resetGuestProfile) {
        await persistGuestProfile(freshData);
        await persistActiveProfile({ kind: 'guest' });
    }
    await nativeSaveQueue;
  },
  
  getCompletedCount: (difficulty: string, maxLevel: number = 200): number => {
      const progress = getStoredData().progress;
      return Object.values(progress).filter(p => 
        p.difficulty === difficulty && 
        p.levelId <= maxLevel && 
        (p.status === 'completed' || p.bestTime !== undefined)
      ).length;
  },

  // PEPINO (Fish) Methods
  getPepinoState: (): PepinoState => {
      const data = getStoredData();
      return data.pepino || { unlocked: false, hasPendingGift: false, pendingGiftCount: 0, firstGiftClaimed: false, firstMessageShown: false };
  },

  unlockPepino: () => {
      const data = getStoredData();
      data.pepino = { 
          unlocked: true, 
          hasPendingGift: true, // First gift instant
          pendingGiftCount: 1,
          firstGiftClaimed: false,
          firstMessageShown: false,
          unlockedAt: Date.now() 
      };
      saveData(data);
  },

  grantPepinoGift: () => {
      const data = getStoredData();
      if (data.pepino && data.pepino.unlocked) {
          data.pepino.pendingGiftCount = (data.pepino.pendingGiftCount || 0) + 1;
          data.pepino.hasPendingGift = true;
          saveData(data);
      }
  },

  claimPepinoGift: () => {
      const data = getStoredData();
      if (!applyPepinoGiftClaim(data, 0)) return false;
      saveData(data);
      return true;
  },

  claimPepinoGiftReward: (amount: number): { applied: boolean; data: StoredData } => {
      const data = getStoredData();
      const reward = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : -1;
      if (reward < 0 || !applyPepinoGiftClaim(data, reward)) {
          return { applied: false, data };
      }

      saveData(data);
      return { applied: true, data };
  },

  markPepinoFirstMessageShown: () => {
      const data = getStoredData();
      if (data.pepino && !data.pepino.firstMessageShown) {
          data.pepino.firstMessageShown = true;
          saveData(data);
      }
  },

  // STRICT MODE WARNING
  hasSeenStrictModeWarning: (difficulty: string): boolean => {
      const data = getStoredData();
      return data.seenStrictModeWarnings?.includes(difficulty) ?? false;
  },

  setSeenStrictModeWarning: (difficulty: string) => {
      const data = getStoredData();
      if (!data.seenStrictModeWarnings) data.seenStrictModeWarnings = [];
      if (!data.seenStrictModeWarnings.includes(difficulty)) {
          data.seenStrictModeWarnings.push(difficulty);
          saveData(data);
      }
  },

  // COUPONS
  redeemCoupon: (
      code: string,
      effect: {
          diamonds?: number;
          unlockPepino?: boolean;
          settings?: Partial<AppSettings>;
          completeDifficulties?: Difficulty[];
      }
  ): { applied: boolean; data: StoredData } => {
      const data = getStoredData();
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) return { applied: false, data };
      if (!data.redeemedCoupons) data.redeemedCoupons = [];
      if (data.redeemedCoupons.includes(normalizedCode)) return { applied: false, data };

      const diamonds = Number.isFinite(effect.diamonds)
          ? Math.max(0, Math.floor(effect.diamonds!))
          : 0;
      const difficulties = [...new Set(effect.completeDifficulties || [])];
      const hasEffect = diamonds > 0
          || effect.unlockPepino === true
          || Boolean(effect.settings && Object.keys(effect.settings).length > 0)
          || difficulties.length > 0;
      if (!hasEffect) return { applied: false, data };

      data.redeemedCoupons.push(normalizedCode);
      if (diamonds > 0) {
          data.points += diamonds;
          recordDiamondEarning(data, diamonds, 'coupons');
      }
      if (effect.unlockPepino) ensurePepinoUnlocked(data);
      if (effect.settings) data.settings = { ...data.settings, ...effect.settings };
      difficulties.forEach((difficulty) => applyDifficultyCompletion(data, difficulty));

      saveData(data);
      return { applied: true, data };
  },

  completeDifficultyLevels: (difficulty: Difficulty) => {
      const data = getStoredData();
      applyDifficultyCompletion(data, difficulty);
      saveData(data);
  },

  completeSuperEasyLevels: () => {
      Storage.completeDifficultyLevels(Difficulty.SuperEasy);
  },

  isCouponRedeemed: (code: string): boolean => {
      const data = getStoredData();
      return data.redeemedCoupons?.includes(code.toUpperCase()) ?? false;
  },

  markCouponRedeemed: (code: string) => {
      const data = getStoredData();
      if (!data.redeemedCoupons) data.redeemedCoupons = [];
      if (!data.redeemedCoupons.includes(code.toUpperCase())) {
          data.redeemedCoupons.push(code.toUpperCase());
          saveData(data);
      }
  },

  isWelcomeGiftClaimed: (): boolean => {
      return !!getStoredData().welcomeGiftClaimed;
  },

  claimWelcomeGift: (): { applied: boolean; data: StoredData } => {
      const data = getStoredData();
      if (data.welcomeGiftClaimed) return { applied: false, data };

      data.welcomeGiftClaimed = true;
      data.points += 100;
      recordDiamondEarning(data, 100, 'welcomeGift');

      if (!data.purchasedSkills.includes('skill-nudge')) {
          data.purchasedSkills.push('skill-nudge');
      }
      if (!data.enabledSkills.includes('skill-nudge')) {
          data.enabledSkills.push('skill-nudge');
      }

      saveData(data);
      return { applied: true, data };
  },
};
