import { Board, CellValue, Difficulty } from '../types';
import puzzleCatalog from '../data/puzzles-v2.json';

export const PUZZLE_CATALOG_VERSION = 2;

// Standard Sudoku placement validation used by gameplay helpers.
export function isValid(board: number[][], row: number, col: number, num: number): boolean {
  for (let index = 0; index < 9; index++) {
    if (board[row][index] === num || board[index][col] === num) return false;
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 3; r++) {
    for (let c = startCol; c < startCol + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

const decodeGrid = (encoded: string): number[][] =>
  Array.from({ length: 9 }, (_, row) =>
    encoded.slice(row * 9, row * 9 + 9).split('').map(Number)
  );

/**
 * Loads one of the 1,800 pre-generated and audited Generator 2.0 puzzles.
 * Catalog entries contain an 81-character puzzle followed by its stable solution.
 */
export function generateLevel(difficulty: Difficulty, levelId: number): { initial: Board; solved: number[][] } {
  const entries = (puzzleCatalog.levels as Record<string, string[]>)[difficulty];
  if (!entries || levelId < 1 || levelId > entries.length) {
    throw new Error(`Puzzle Catalog v${PUZZLE_CATALOG_VERSION} has no ${difficulty} level ${levelId}`);
  }

  const encoded = entries[levelId - 1];
  const puzzle = decodeGrid(encoded.slice(0, 81));
  const solved = decodeGrid(encoded.slice(81));
  const initial: Board = puzzle.map((row, rowIndex) =>
    row.map((rawValue, colIndex) => ({
      row: rowIndex,
      col: colIndex,
      value: rawValue === 0 ? null : rawValue as CellValue,
      isFixed: rawValue !== 0,
      notes: [],
      isError: false
    }))
  );

  return { initial, solved };
}
