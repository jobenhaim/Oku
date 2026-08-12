
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
  isRevealed?: boolean; // Legacy saved-board compatibility
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
  scanRefillsPurchased?: number; // Extra Scan uses bought during this puzzle attempt
  revealUses?: number; // Legacy saved-game compatibility
  scribeUses?: number; // Legacy saved-game compatibility
  hasMadeMistake?: boolean; // Preserve flawless-run eligibility across resumes
  hasUsedNotes?: boolean; // Preserve note-based achievement eligibility across resumes
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
  pillNotifications: boolean; // Show gameplay pill messages
  goodLuckMessage: boolean; // Show the level-start Good Luck pill
  scanWarningNotifications: boolean; // Show the automatic Scan recommendation pill
  hiddenDifficulties: Difficulty[]; // List of difficulties to hide from main screen
  devAutoSolve?: boolean; // Developer setting to enable auto-solve button
}

export interface PepinoState {
  unlocked: boolean;
  hasPendingGift: boolean;
  pendingGiftCount: number;
  firstGiftClaimed: boolean;
  firstMessageShown: boolean;
  unlockedAt?: number; // Timestamp of when it was unlocked, for intro logic
}

export interface StoredData {
  /** Last local mutation time, used to resolve device/cloud conflicts safely. */
  lastModifiedAt?: number;
  settings: AppSettings;
  points: number;
  progress: Record<string, LevelProgress>; // key: "Difficulty-LevelID"
  normalPuzzleCatalogVersion?: number; // Safely resets stale in-progress Normal boards after catalogue updates
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
  books2AllOwned?: boolean;
  books3AllOwned?: boolean;
  booksForeverOwned?: boolean;
  unlockedPack2?: string[]; // Array of difficulty names where Book 2 (levels 101-200) is unlocked
  unlockedPack3?: string[]; // Array of difficulty names where Book 3 (levels 201-300) is unlocked
  book2UnlockReady?: string[]; // Paid/granted, waiting for the player to trigger the reveal
  book3UnlockReady?: string[]; // Paid/granted, waiting for the player to trigger the reveal
  pepino?: PepinoState;
  seenStrictModeWarnings?: string[]; // Track which difficulties the user has seen the hard mode warning for
  redeemedCoupons?: string[]; // Track redeemed coupon codes
  welcomeGiftClaimed?: boolean; // Track if the welcome gift has been claimed
  processedPurchaseTransactions?: string[]; // Prevent a Store transaction from granting rewards twice
  claimedAchievements?: string[]; // Achievement rewards already collected
  watchedReplayPuzzleIds?: string[]; // Count each completed puzzle only once for replay achievements
  achievementCounters?: {
      scansUsed: number;
      pepinoGiftsOpened: number;
      hardPerfectGames: number;
      replaysWatched: number;
      nudgeCellClicks: number;
      pepinoHeartTaps: number;
      pepinoTenLoveTaps: number;
      pepinoStrongTaps: number;
      hardNoScanWins: number;
      noteGamesWon: number;
  };
  
  // Stats
  stats?: {
      totalGamesWon: number;
      totalDiamondsEarned: number;
      perfectGames: number; // Won without errors
      gamesWonByDifficulty?: Record<string, number>;
      diamondsEarnedBySource?: Record<string, number>;
  };
}

export type DiamondEarnSource = 'welcomeGift' | 'dailyGifts' | 'sudoku' | 'pepino' | 'achievements' | 'purchases' | 'coupons' | 'other';

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

export type PermanentPurchaseOwnership = {
  premiumOwned: boolean;
  starterOwned: boolean;
  books2AllOwned: boolean;
  books3AllOwned: boolean;
  booksForeverOwned: boolean;
  transactionIds: string[];
};

export type StorePurchaseUnlock = 'premium' | 'starter' | null;
