
export enum Difficulty {
  SuperEasy = 'Super Easy',
  Easy = 'Easy',
  Normal = 'Normal',
  Hard = 'Hard',
  Intense = 'Intense',
  Impossible = 'Impossible',
}

export type CellValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | null;

export interface Cell {
  row: number;
  col: number;
  value: CellValue;
  isFixed: boolean;
  notes: number[];
  isError?: boolean;
  isMarkedWrong?: boolean; // For Scan skill
  isRevealed?: boolean; // For Reveal skill
}

export type Board = Cell[][];

export interface MoveLogEntry {
  r: number;
  c: number;
  v: number;
  t: number;
}

export interface LevelProgress {
  levelId: number; // 1 to 30
  difficulty: Difficulty;
  status: 'locked' | 'not-started' | 'in-progress' | 'completed';
  timeElapsed: number;
  lastPlayed?: number; // timestamp
  boardState?: Cell[][]; // simplified for storage
  moveLog?: MoveLogEntry[]; // History of moves for replay
  bestTime?: number; // Personal best time in seconds
  scanUses?: number; // Remaining scan uses
  revealUses?: number; // Remaining reveal uses
}

export interface AppSettings {
  sound: boolean;
  highlight: boolean;
  autoEraseNotes: boolean; // Default ON
  vibration: boolean;
  showTimer: boolean;
  appearance: 'system' | 'light' | 'dark';
  digitFirst: boolean; // Input mode
  screenWakeLock: boolean; // Keep screen on
  generateReplay: boolean; // Generate video replay on completion
  hiddenDifficulties: Difficulty[]; // List of difficulties to hide from main screen
}

export interface PepinoState {
  unlocked: boolean;
  hasPendingGift: boolean;
  unlockedAt?: number; // Timestamp of when it was unlocked, for intro logic
}

export interface StoredData {
  settings: AppSettings;
  points: number;
  progress: Record<string, LevelProgress>; // key: "Difficulty-LevelID"
  purchasedBackgrounds: string[];
  selectedBackground: string | null;
  purchasedNumberColors: string[];
  selectedNumberColor: string;
  purchasedSkills: string[];
  enabledSkills: string[]; // Tracks which skills are toggled ON for the game
  purchasedSoundPacks: string[];
  selectedSoundPack: string;
  bonusClaimed?: boolean;
  nextBonusClaimTime?: number; // Timestamp for next daily bonus
  starterPackPurchased?: boolean;
  unlockedPack2?: string[]; // Array of difficulty names where Pack 2 (levels 101-200) is unlocked
  unlockedPack3?: string[]; // Array of difficulty names where Pack 3 (levels 201-300) is unlocked
  pepino?: PepinoState;
  seenStrictModeWarnings?: string[]; // Track which difficulties the user has seen the hard mode warning for
  redeemedCoupons?: string[]; // Track redeemed coupon codes
  
  // Stats
  stats?: {
      totalGamesWon: number;
      totalDiamondsEarned: number;
      perfectGames: number; // Won without errors
  };
}

export type DiamondOffer = {
  id: string;
  productId: string; // Apple/Google Store Product ID
  title: string;
  subtitle?: string;
  diamonds: number;
  includes?: string[];
  badge?: string;
  priceLabel: string;
  type: "starter" | "pack" | "support";
  gradientClass?: string;
};