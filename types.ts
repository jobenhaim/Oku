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
}

export type Board = Cell[][];

export interface LevelProgress {
  levelId: number; // 1 to 30
  difficulty: Difficulty;
  status: 'locked' | 'not-started' | 'in-progress' | 'completed';
  timeElapsed: number;
  lastPlayed?: number; // timestamp
  boardState?: Cell[][]; // simplified for storage
  history?: any[]; // optional undo stack
  bestTime?: number; // Personal best time in seconds
}

export interface AppSettings {
  music: boolean;
  sound: boolean;
  highlight: boolean;
  autoNotes: boolean;
  defaultBackground: boolean; // If true, ignore selectedBackground and use default paper
  vibration: boolean;
}

export interface StoredData {
  settings: AppSettings;
  points: number;
  progress: Record<string, LevelProgress>; // key: "Difficulty-LevelID"
  purchasedBackgrounds: string[];
  selectedBackground: string | null;
}