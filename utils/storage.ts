
import { AppSettings, LevelProgress, StoredData, PepinoState, Difficulty } from '../types';
import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'oku_data_v1';
const LEGACY_STORAGE_KEY = 'minimal_sudoku_data_v1';

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
  hiddenDifficulties: [], // Default show all
};

const DEFAULT_STATS = {
    totalGamesWon: 0,
    totalDiamondsEarned: 0,
    perfectGames: 0
};

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
          pepino: { unlocked: false, hasPendingGift: false },
          seenStrictModeWarnings: [],
          redeemedCoupons: [],
          stats: DEFAULT_STATS
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
    if (data.settings.hiddenDifficulties === undefined) data.settings.hiddenDifficulties = [];

    if (data.settings.appearance === undefined) {
        data.settings.appearance = 'light'; 
    }
    
    if (!data.purchasedSkills) data.purchasedSkills = [];
    if (!data.enabledSkills) data.enabledSkills = [...data.purchasedSkills]; // Default new field to existing purchased skills
    
    if (data.bonusClaimed === undefined) data.bonusClaimed = false;
    if (data.nextBonusClaimTime === undefined) data.nextBonusClaimTime = 0;
    
    if (data.starterPackPurchased === undefined) data.starterPackPurchased = false;
    
    if (!data.unlockedPack2) data.unlockedPack2 = [];
    if (!data.unlockedPack3) data.unlockedPack3 = [];
    
    if (!data.pepino) {
        data.pepino = { unlocked: false, hasPendingGift: false };
    } else {
        // Migration from Timer based (lastGiftTime) to Event based (hasPendingGift)
        if ((data.pepino as any).nextGiftDelay !== undefined) {
            const old = data.pepino as any;
            const wasReady = Date.now() >= (old.lastGiftTime || 0) + (old.nextGiftDelay || 0);
            data.pepino = {
                unlocked: old.unlocked,
                hasPendingGift: wasReady,
                unlockedAt: old.unlocked ? Date.now() : undefined // Fallback unlock time
            };
        }
    }
    
    if (!data.stats) {
        // Simple backfill of totalGamesWon based on progress
        const wonCount = Object.values(data.progress || {}).filter((p: any) => p.status === 'completed' || p.bestTime !== undefined).length;
        data.stats = { ...DEFAULT_STATS, totalGamesWon: wonCount };
    }

    if (!data.seenStrictModeWarnings) data.seenStrictModeWarnings = [];
    if (!data.redeemedCoupons) data.redeemedCoupons = [];

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
        pepino: { unlocked: false, hasPendingGift: false },
        seenStrictModeWarnings: [],
        redeemedCoupons: [],
        stats: DEFAULT_STATS
    };
  }
}

async function saveData(data: StoredData) {
  try {
    const stringified = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, stringified);
    await Preferences.set({
        key: STORAGE_KEY,
        value: stringified
    }).catch((err: any) => console.error("Native save failed", err));
  } catch (e) {
    console.error("Failed to save data", e);
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
              return JSON.parse(value);
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

  addPoints: (amount: number) => {
    const data = getStoredData();
    data.points += amount;
    // Update stats
    if (!data.stats) data.stats = { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 };
    data.stats.totalDiamondsEarned += amount;
    
    saveData(data);
    return data.points;
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
          if (!data.enabledSkills.includes(id)) data.enabledSkills.push(id); // Auto enable on purchase
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
        
        if (isPerfectGame) {
            data.stats.perfectGames += 1;
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
               revealUses: 1,
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
      return data.pepino || { unlocked: false, hasPendingGift: false };
  },

  unlockPepino: () => {
      const data = getStoredData();
      data.pepino = { 
          unlocked: true, 
          hasPendingGift: true, // First gift instant
          unlockedAt: Date.now() 
      };
      saveData(data);
  },

  grantPepinoGift: () => {
      const data = getStoredData();
      if (data.pepino && data.pepino.unlocked) {
          data.pepino.hasPendingGift = true;
          saveData(data);
      }
  },

  claimPepinoGift: () => {
      const data = getStoredData();
      if (data.pepino) {
          data.pepino.hasPendingGift = false;
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
};