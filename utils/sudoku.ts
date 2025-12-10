import { Difficulty, Board, Cell, CellValue } from '../types';

// Simple seeded random number generator (Linear Congruential Generator)
class SeededRandom {
    seed: number;
    constructor(seed: number) {
        this.seed = seed;
    }

    // Returns a number between 0 and 1
    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

// Helper to check if placing num at board[row][col] is valid (Standard Rules)
export function isValid(board: number[][], row: number, col: number, num: number): boolean {
  // Check Row & Column
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num && i !== col) return false;
    if (board[i][col] === num && i !== row) return false;
  }
  
  // Check 3x3 Box
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[startRow + i][startCol + j] === num && (startRow + i !== row || startCol + j !== col)) {
        return false;
      }
    }
  }
  return true;
}

// Counts solutions to ensure uniqueness. Returns 0, 1, or >1 (capped at 2 for performance)
function countSolutions(board: number[][]): number {
    let solutions = 0;

    function solve(idx: number) {
        if (solutions > 1) return; // Optimization: Stop if ambiguous

        // Find next empty cell
        let cur = idx;
        while (cur < 81) {
            const r = Math.floor(cur / 9);
            const c = cur % 9;
            if (board[r][c] === 0) break;
            cur++;
        }

        // If no empty cells, we found a solution
        if (cur === 81) {
            solutions++;
            return;
        }

        const r = Math.floor(cur / 9);
        const c = cur % 9;

        for (let num = 1; num <= 9; num++) {
            if (isValid(board, r, c, num)) {
                board[r][c] = num;
                solve(cur + 1);
                board[r][c] = 0; // Backtrack
            }
        }
    }
    
    // We need to pass a deep copy to countSolutions if we didn't want mutation, 
    // but since we backtrack strictly, the board remains unchanged after execution.
    // However, for safety in JS async environments (though this is sync), we trust the backtracking.
    solve(0);
    return solutions;
}

// Generates a full valid 9x9 Sudoku board
function generateFullBoard(rng: SeededRandom): number[][] {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  
  function fill(idx: number): boolean {
      if (idx === 81) return true;

      const row = Math.floor(idx / 9);
      const col = idx % 9;

      // Randomize 1-9 check order
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map(value => ({ value, sort: rng.next() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);

      for (const num of nums) {
          if (isValid(board, row, col, num)) {
              board[row][col] = num;
              if (fill(idx + 1)) return true;
              board[row][col] = 0;
          }
      }
      return false;
  }

  fill(0);
  return board;
}

function getDifficultySeed(diff: Difficulty): number {
    switch(diff) {
        case Difficulty.SuperEasy: return 1000;
        case Difficulty.Easy: return 2000;
        case Difficulty.Normal: return 3000;
        case Difficulty.Hard: return 4000;
        case Difficulty.Intense: return 5000;
        case Difficulty.Impossible: return 6000;
        default: return 0;
    }
}

export function generateLevel(difficulty: Difficulty, levelId: number): { initial: Board, solved: number[][] } {
    const seedBase = getDifficultySeed(difficulty);
    const rng = new SeededRandom(levelId + seedBase + 999);
    
    // 1. Generate a solved board
    const solvedRaw = generateFullBoard(rng);
    
    // 2. Clone it to create the puzzle
    const puzzleRaw = solvedRaw.map(row => [...row]);
    
    // 3. Define target holes (empty cells) based on difficulty
    // Lower holes = Easier. Guaranteed uniqueness ensures logic solvability.
    let targetHoles = 30; 
    switch(difficulty) {
        case Difficulty.SuperEasy: targetHoles = 20; break; // Very filled
        case Difficulty.Easy: targetHoles = 30; break;
        case Difficulty.Normal: targetHoles = 40; break; // Increased from 36
        case Difficulty.Hard: targetHoles = 48; break; // Increased from 46
        case Difficulty.Intense: targetHoles = 52; break;
        case Difficulty.Impossible: targetHoles = 58; break; // Attempt max removal
    }

    // 4. Create a shuffled list of all positions (0-80)
    const positions = Array.from({length: 81}, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // 5. Remove cells one by one, ensuring uniqueness
    let holesRemoved = 0;

    for (const pos of positions) {
        if (holesRemoved >= targetHoles) break;

        const r = Math.floor(pos / 9);
        const c = pos % 9;
        const backup = puzzleRaw[r][c];

        // Tentatively remove
        puzzleRaw[r][c] = 0;

        // Check if solution is still unique
        // We pass a copy because countSolutions modifies the board during search
        const boardCopy = puzzleRaw.map(row => [...row]);
        const solutions = countSolutions(boardCopy);

        if (solutions !== 1) {
            // If not unique, put it back (critical for "No Guessing" rule)
            puzzleRaw[r][c] = backup;
        } else {
            holesRemoved++;
        }
    }

    // 6. Convert to rich Cell objects
    const initial: Board = puzzleRaw.map((row, rIndex) => 
        row.map((val, cIndex) => ({
            row: rIndex,
            col: cIndex,
            value: val === 0 ? null : (val as CellValue),
            isFixed: val !== 0,
            notes: [],
            isError: false
        }))
    );

    return { initial, solved: solvedRaw };
}

export function checkErrors(current: Board, solved: number[][]): Board {
    return current.map(row => 
        row.map(cell => ({
            ...cell,
            isError: cell.value !== null && cell.value !== solved[cell.row][cell.col]
        }))
    );
}

export function isGameSolved(current: Board): boolean {
    for(let r=0; r<9; r++) {
        for(let c=0; c<9; c++) {
            const cell = current[r][c];
            if (cell.value === null || cell.isError) return false;
        }
    }
    return true;
}