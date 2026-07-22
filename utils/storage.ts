
import { AppSettings, Board, LevelProgress, StoredData, PepinoState, Difficulty, PermanentPurchaseOwnership, StorePurchaseUnlock, DiamondEarnSource } from '../types';
import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'oku_data_v1';
const LEGACY_STORAGE_KEY = 'minimal_sudoku_data_v1';

export const hasPlayerBoardInput = (board?: Board) => Boolean(board?.some(row =>
    row.some(cell => !cell.isFixed && (cell.value !== null || cell.notes.length > 0))
));

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

const sanitizeBreakdown = (breakdown: unknown): Record<string, number> => {
    if (!breakdown || typeof breakdown !== 'object') return {};
    const sanitized: Record<string, number> = {};
    for (const [key, value] of Object.entries(breakdown as Record<string, unknown>)) {
        const amount = Math.max(0, Math.floor(Number(value) || 0));
        if (amount > 0) sanitized[key] = amount;
    }
    return sanitized;
};

const ensureStatsBreakdowns = (data: StoredData) => {
    if (!data.stats) data.stats = { ...DEFAULT_STATS, gamesWonByDifficulty: {}, diamondsEarnedBySource: {} };

    const savedWinBreakdown = sanitizeBreakdown(data.stats.gamesWonByDifficulty);
    if (!data.stats.gamesWonByDifficulty || savedWinBreakdown.previous) {
        const inferred: Record<string, number> = {};
        for (const progress of Object.values(data.progress || {})) {
            if (progress.status !== 'completed' && progress.bestTime === undefined) continue;
            inferred[progress.difficulty] = (inferred[progress.difficulty] || 0) + 1;
        }
        data.stats.gamesWonByDifficulty = inferred;
        data.stats.totalGamesWon = Object.values(inferred).reduce((sum, value) => sum + value, 0);
    } else {
        data.stats.gamesWonByDifficulty = savedWinBreakdown;
        const trackedWins = Object.values(data.stats.gamesWonByDifficulty).reduce((sum, value) => sum + value, 0);
        data.stats.totalGamesWon = trackedWins;
    }

    const savedDiamondBreakdown = sanitizeBreakdown(data.stats.diamondsEarnedBySource);
    if (!data.stats.diamondsEarnedBySource || savedDiamondBreakdown.previous) {
        const rebuilt = { ...savedDiamondBreakdown };
        const unclassified = rebuilt.previous || data.stats.totalDiamondsEarned;
        delete rebuilt.previous;
        let remaining = Math.max(0, unclassified);

        if (data.welcomeGiftClaimed && !rebuilt.welcomeGift && remaining > 0) {
            const welcomeAmount = Math.min(200, remaining);
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
      const initialData: StoredData = { 
          settings: DEFAULT_SETTINGS, 
          points: 0, 
          progress: {},
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
          unlockedPack2: [],
          unlockedPack3: [],
          pepino: { unlocked: false, hasPendingGift: false, pendingGiftCount: 0, firstGiftClaimed: false, firstMessageShown: false },
          seenStrictModeWarnings: [],
          redeemedCoupons: [],
          welcomeGiftClaimed: false,
          processedPurchaseTransactions: [],
          claimedAchievements: [],
          achievementCounters: emptyAchievementCounters(),
          stats: { ...DEFAULT_STATS, gamesWonByDifficulty: {}, diamondsEarnedBySource: {} }
      };
      
      return initialData;
    }
    const data = JSON.parse(raw);
    
    // Migrations
    if (typeof data.points !== 'number') data.points = 0;
    
    if (!data.purchasedBackgrounds) data.purchasedBackgrounds = ['bg-default', 'bg-dyn-default'];
    if (!data.purchasedBackgrounds.includes('bg-default')) data.purchasedBackgrounds.push('bg-default');
    if (!data.purchasedBackgrounds.includes('bg-dyn-default')) data.purchasedBackgrounds.push('bg-dyn-default');

    if (data.selectedBackground === undefined) data.selectedBackground = 'bg-default';
    
    if (!data.purchasedNumberColors) data.purchasedNumberColors = ['num-default'];
    if (!data.selectedNumberColor) data.selectedNumberColor = 'num-default';

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

    for (const progress of Object.values(data.progress || {}) as Array<LevelProgress & { autoUses?: number }>) {
        if (progress.scribeUses === undefined && progress.autoUses !== undefined) {
            progress.scribeUses = Math.min(progress.autoUses, 4);
        }
        delete progress.autoUses;
    }
    
    if (data.bonusClaimed === undefined) data.bonusClaimed = false;
    if (data.nextBonusClaimTime === undefined) data.nextBonusClaimTime = 0;
    
    if (data.starterPackPurchased === undefined) data.starterPackPurchased = false;
    // Backfill rewards added to the Starter Pack without re-enabling skills
    // that an existing owner deliberately switched off.
    if (data.starterPackPurchased) {
        if (!data.purchasedSkills.includes('skill-nudge')) {
            data.purchasedSkills.push('skill-nudge');
            if (!data.enabledSkills.includes('skill-nudge')) data.enabledSkills.push('skill-nudge');
        }
        if (!data.purchasedNumberColors.includes('num-teal')) data.purchasedNumberColors.push('num-teal');
    }
    
    if (!data.unlockedPack2) data.unlockedPack2 = [];
    if (!data.unlockedPack3) data.unlockedPack3 = [];
    
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
    data.achievementCounters.replaysWatched = Math.max(0, Math.floor(data.achievementCounters.replaysWatched || 0));

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
            progress.revealUses = undefined;
            progress.scribeUses = 4;
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
    return { 
        settings: DEFAULT_SETTINGS, 
        points: 0, 
        progress: {},
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
        unlockedPack2: [],
        unlockedPack3: [],
        pepino: { unlocked: false, hasPendingGift: false, pendingGiftCount: 0, firstGiftClaimed: false, firstMessageShown: false },
        seenStrictModeWarnings: [],
        redeemedCoupons: [],
        welcomeGiftClaimed: false,
        processedPurchaseTransactions: [],
        claimedAchievements: [],
        achievementCounters: emptyAchievementCounters(),
        stats: { ...DEFAULT_STATS, gamesWonByDifficulty: {}, diamondsEarnedBySource: {} }
    };
  }
}

// Native Preferences writes are asynchronous. A win triggers several saves in
// quick succession (diamonds, level progress, and Pepino), so allowing those
// writes to race can leave an older snapshot as the final native value.
// Keep them ordered while localStorage remains immediately available to the UI.
let nativeSaveQueue: Promise<void> = Promise.resolve();

function saveData(data: StoredData) {
  try {
    const stringified = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, stringified);

    nativeSaveQueue = nativeSaveQueue
      .catch(() => undefined)
      .then(async () => {
          await Preferences.set({
              key: STORAGE_KEY,
              value: stringified
          });
      })
      .catch((err: any) => console.error("Native save failed", err));
  } catch (e) {
    console.error("Failed to save data", e);
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

  for (const skillId of ['skill-nudge', 'skill-scribe', 'skill-scan']) {
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

export const Storage = {
  getStoredData, 
  
  initializeNative: async (): Promise<StoredData | null> => {
      try {
          let { value } = await Preferences.get({ key: STORAGE_KEY });
          
          // Native Migration Logic
          if (!value) {
              const legacy = await Preferences.get({ key: LEGACY_STORAGE_KEY });
              if (legacy.value) {
                  value = legacy.value;
                  // Persist to new key
                  await Preferences.set({ key: STORAGE_KEY, value: legacy.value });
              }
          }

          if (value) {
              localStorage.setItem(STORAGE_KEY, value);
              // Run the same migrations/defaults used by normal local reads before
              // hydrating React state from native preferences.
              return getStoredData();
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

  recordScanUse: () => {
      const data = getStoredData();
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.scansUsed += 1;
      saveData(data);
  },

  recordReplayWatch: () => {
      const data = getStoredData();
      if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
      data.achievementCounters.replaysWatched += 1;
      saveData(data);
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

  isPack2Unlocked: (difficulty: string): boolean => {
      return getStoredData().unlockedPack2?.includes(difficulty) ?? false;
  },

  unlockPack2: (difficulty: string, cost: number): boolean => {
      const data = getStoredData();
      if (!data.unlockedPack2) data.unlockedPack2 = [];
      
      if (data.points >= cost && !data.unlockedPack2.includes(difficulty)) {
          data.points -= cost;
          data.unlockedPack2.push(difficulty);
          saveData(data);
          return true;
      }
      return false;
  },

  getUnlockedPacks3: (): string[] => {
      return getStoredData().unlockedPack3 || [];
  },

  isPack3Unlocked: (difficulty: string): boolean => {
      return getStoredData().unlockedPack3?.includes(difficulty) ?? false;
  },

  unlockPack3: (difficulty: string, cost: number): boolean => {
      const data = getStoredData();
      if (!data.unlockedPack3) data.unlockedPack3 = [];
      
      if (data.points >= cost && !data.unlockedPack3.includes(difficulty)) {
          data.points -= cost;
          data.unlockedPack3.push(difficulty);
          saveData(data);
          return true;
      }
      return false;
  },

  getLastPlayedGame: (): LevelProgress | undefined => {
    const data = getStoredData();
    const inProgressGames = Object.values(data.progress).filter(p =>
        p.status === 'in-progress' && hasPlayerBoardInput(p.boardState)
    );
    if (inProgressGames.length === 0) return undefined;
    inProgressGames.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return inProgressGames[0];
  },

  getLevelProgress: (difficulty: string, levelId: number): LevelProgress | undefined => {
    const key = `${difficulty}-${levelId}`;
    return getStoredData().progress[key];
  },

  saveLevelProgress: (progress: LevelProgress, isPerfectGame: boolean = false) => {
    const data = getStoredData();
    const key = `${progress.difficulty}-${progress.levelId}`;
    const existing = data.progress[key];
    let bestTime = existing?.bestTime;
    
    if (progress.status === 'completed') {
        if (bestTime === undefined || progress.timeElapsed < bestTime) {
            bestTime = progress.timeElapsed;
        }
        // Increment Stats
        if (!data.stats) data.stats = { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 };
        
        data.stats.totalGamesWon += 1;
        ensureStatsBreakdowns(data);
        const winBreakdown = data.stats.gamesWonByDifficulty!;
        winBreakdown[progress.difficulty] = (winBreakdown[progress.difficulty] || 0) + 1;
        if (isPerfectGame) {
            data.stats.perfectGames += 1;
            if ([Difficulty.Hard, Difficulty.Intense, Difficulty.Impossible].includes(progress.difficulty as Difficulty)) {
                if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
                data.achievementCounters.hardPerfectGames += 1;
            }
        }
    }
    
    data.progress[key] = {
        ...progress,
        bestTime: bestTime
    };
    
    saveData(data);
  },
  
  clearLevelProgress: (difficulty: string, levelId: number) => {
      const data = getStoredData();
      const key = `${difficulty}-${levelId}`;
      if (data.progress[key]) {
           const { bestTime } = data.progress[key];
           data.progress[key] = {
               levelId,
               difficulty: difficulty as any,
               status: 'not-started',
               boardState: undefined,
               timeElapsed: 0,
               bestTime: bestTime,
               scanUses: 3,
               scribeUses: 4,
           };
           saveData(data);
      }
  },

  resetAllData: async () => {
    localStorage.removeItem(STORAGE_KEY);
    // Also remove legacy just in case
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    
    try {
        await Preferences.remove({ key: STORAGE_KEY });
        await Preferences.remove({ key: LEGACY_STORAGE_KEY });
    } catch (e) {
        console.warn("Error removing native preference", e);
    }
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
      if (data.pepino) {
          data.pepino.pendingGiftCount = Math.max(0, (data.pepino.pendingGiftCount || 0) - 1);
          data.pepino.hasPendingGift = data.pepino.pendingGiftCount > 0;
          data.pepino.firstGiftClaimed = true;
          if (!data.achievementCounters) data.achievementCounters = emptyAchievementCounters();
          data.achievementCounters.pepinoGiftsOpened += 1;
          saveData(data);
      }
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
  completeSuperEasyLevels: () => {
      const data = getStoredData();
      if (!data.stats) data.stats = { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 };
      
      for (let lvl = 1; lvl <= 100; lvl++) {
          const key = `${Difficulty.SuperEasy}-${lvl}`;
          const existing = data.progress[key];
          const wasAlreadyCompleted = existing?.status === 'completed' || existing?.bestTime !== undefined;

          if (existing?.status !== 'completed') {
              data.progress[key] = {
                  ...existing,
                  levelId: lvl,
                  difficulty: Difficulty.SuperEasy,
                  status: 'completed',
                  timeElapsed: existing?.timeElapsed || 60,
                  bestTime: existing?.bestTime !== undefined ? Math.min(existing.bestTime, 60) : 60,
                  scanUses: existing?.scanUses ?? 3,
                  scribeUses: existing?.scribeUses ?? 4,
              };

              if (!wasAlreadyCompleted) {
                  data.stats.totalGamesWon += 1;
                  ensureStatsBreakdowns(data);
                  const winBreakdown = data.stats.gamesWonByDifficulty!;
                  winBreakdown[Difficulty.SuperEasy] = (winBreakdown[Difficulty.SuperEasy] || 0) + 1;
              }
          }
      }
      saveData(data);
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

  claimWelcomeGift: () => {
      const data = getStoredData();
      data.welcomeGiftClaimed = true;
      saveData(data);
  },
};
