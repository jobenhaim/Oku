import { AppSettings, LevelProgress, StoredData } from '../types';

const STORAGE_KEY = 'minimal_sudoku_data_v1';

const DEFAULT_SETTINGS: AppSettings = {
  music: false,
  sound: true,
  highlight: true,
  autoNotes: false,
  defaultBackground: false,
  vibration: true,
};

function getStoredData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { 
          settings: DEFAULT_SETTINGS, 
          points: 500, // Default start points
          progress: {},
          purchasedBackgrounds: [],
          selectedBackground: null
      };
    }
    const data = JSON.parse(raw);
    // Migrations
    if (typeof data.points !== 'number') data.points = 500;
    if (!data.purchasedBackgrounds) data.purchasedBackgrounds = [];
    if (data.selectedBackground === undefined) data.selectedBackground = null;
    if (data.settings.defaultBackground === undefined) data.settings.defaultBackground = false;
    if (data.settings.vibration === undefined) data.settings.vibration = true;
    
    return data;
  } catch (e) {
    console.error("Failed to load data", e);
    return { 
        settings: DEFAULT_SETTINGS, 
        points: 500, 
        progress: {},
        purchasedBackgrounds: [],
        selectedBackground: null 
    };
  }
}

function saveData(data: StoredData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data", e);
  }
}

export const Storage = {
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
    saveData(data);
    return data.points;
  },

  // Store Methods
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

  getLevelProgress: (difficulty: string, levelId: number): LevelProgress | undefined => {
    const key = `${difficulty}-${levelId}`;
    return getStoredData().progress[key];
  },

  saveLevelProgress: (progress: LevelProgress) => {
    const data = getStoredData();
    const key = `${progress.difficulty}-${progress.levelId}`;
    const existing = data.progress[key];

    // Handle Best Time Logic
    let bestTime = existing?.bestTime;
    
    if (progress.status === 'completed') {
        // If completed, update best time if current is better (lower) or if no best time exists
        if (bestTime === undefined || progress.timeElapsed < bestTime) {
            bestTime = progress.timeElapsed;
        }
    }
    
    // Preserve bestTime in the new progress object
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
           // Reset game state but PRESERVE bestTime and status if needed (though restart usually implies trying again)
           // We keep bestTime.
           const { bestTime } = data.progress[key];
           
           data.progress[key] = {
               levelId,
               difficulty: difficulty as any,
               status: 'not-started', // Reset status
               boardState: undefined,
               timeElapsed: 0,
               history: [],
               bestTime: bestTime // Keep the record
           };
           saveData(data);
      }
  },

  resetAllData: () => {
    localStorage.removeItem(STORAGE_KEY);
  },
  
  // Get counts for UI
  getCompletedCount: (difficulty: string): number => {
      const progress = getStoredData().progress;
      return Object.values(progress).filter(p => p.difficulty === difficulty && p.status === 'completed').length;
  }
};