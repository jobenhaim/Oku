
import { Difficulty, Board, Cell, CellValue } from '../types';
import { IMPOSSIBLE_SEEDS } from './constants';

// Improved seeded random number generator (Mulberry32)
// Good distribution, fast, 32-bit state
class SeededRandom {
    seed: number;
    constructor(seed: number) {
        this.seed = seed;
    }

    // Returns a number between 0 and 1
    next(): number {
        var t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Helper to check if placing num at board[row][col] is valid (Standard Rules)
export function isValid(board: number[][], row: number, col: number, num: number): boolean {
  // Check Row
  for (let c = 0; c < 9; c++) {
    if (board[row][c] === num) return false;
  }
  
  // Check Column
  for (let r = 0; r < 9; r++) {
    if (board[r][col] === num) return false;
  }
  
  // Check 3x3 Box
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[startRow + i][startCol + j] === num) {
        return false;
      }
    }
  }
  return true;
}

// Counts solutions to ensure uniqueness.
// Optimized using MRV (Minimum Remaining Values) heuristic
function countSolutions(board: number[][]): number {
    let row = -1;
    let col = -1;
    let minOptions = 10;

    // Find cell with fewest options
    outer: for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                let options = 0;
                for (let k = 1; k <= 9; k++) {
                     if (isValid(board, r, c, k)) options++;
                }
                
                if (options === 0) return 0; // Impossible state (no candidates for an empty cell)
                
                if (options < minOptions) {
                    minOptions = options;
                    row = r;
                    col = c;
                }
                // Optimization: If a cell has only 1 option, we must pick it. No need to search further.
                if (minOptions === 1) break outer;
            }
        }
    }

    // If no empty cells found, we found a valid solution
    if (row === -1) {
        return 1;
    }

    let count = 0;
    for (let num = 1; num <= 9; num++) {
        if (isValid(board, row, col, num)) {
            board[row][col] = num;
            count += countSolutions(board);
            board[row][col] = 0; // Backtrack
            
            if (count > 1) return count; // Early exit if not unique
        }
    }
    
    return count;
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

// --- LOGICAL SOLVER ---
// This class simulates a human player to verify difficulty.
// It maintains a list of candidates for every cell and reduces them using logic.

class LogicalSolver {
    candidates: number[][][]; // [row][col] -> number[]
    solvedCount: number = 0;
    
    constructor(initialBoard: number[][]) {
        // Initialize candidates: 1-9 for empty cells, [val] for filled cells
        this.candidates = [];
        for(let r=0; r<9; r++) {
            const rowCands = [];
            for(let c=0; c<9; c++) {
                if (initialBoard[r][c] !== 0) {
                    rowCands.push([initialBoard[r][c]]);
                    this.solvedCount++;
                } else {
                    rowCands.push([1,2,3,4,5,6,7,8,9]);
                }
            }
            this.candidates.push(rowCands);
        }
        
        // Initial propagation: Remove filled numbers from peers
        for(let r=0; r<9; r++) {
            for(let c=0; c<9; c++) {
                if (initialBoard[r][c] !== 0) {
                    this.eliminatePeers(r, c, initialBoard[r][c]);
                }
            }
        }
    }

    // Removes 'val' from all peers (row, col, box) of (r,c)
    // Returns true if any candidate was removed
    private eliminatePeers(r: number, c: number, val: number): boolean {
        let changed = false;
        
        // Row & Col
        for(let i=0; i<9; i++) {
            if (i !== c && this.removeCandidate(r, i, val)) changed = true;
            if (i !== r && this.removeCandidate(i, c, val)) changed = true;
        }
        
        // Box
        const startR = Math.floor(r/3)*3;
        const startC = Math.floor(c/3)*3;
        for(let i=0; i<3; i++) {
            for(let j=0; j<3; j++) {
                const rr = startR + i;
                const cc = startC + j;
                if ((rr !== r || cc !== c) && this.removeCandidate(rr, cc, val)) changed = true;
            }
        }
        return changed;
    }

    // Removes 'val' from candidates of (r,c)
    // If a cell reduces to 1 candidate (Naked Single), it automatically propagates (cascading effect)
    private removeCandidate(r: number, c: number, val: number): boolean {
        const cands = this.candidates[r][c];
        if (cands.length <= 1) return false; // Already solved or empty
        
        const idx = cands.indexOf(val);
        if (idx !== -1) {
            cands.splice(idx, 1);
            if (cands.length === 1) {
                this.solvedCount++;
                // Cascade propagation (Naked Single logic)
                this.eliminatePeers(r, c, cands[0]);
            }
            return true;
        }
        return false;
    }

    // Tier 1 Logic: Hidden Singles
    // Checks if a number exists in only one spot within a unit (Row/Col/Box)
    private applyHiddenSingles(): boolean {
        let changed = false;
        // 0=Row, 1=Col, 2=Box
        for (let unitType = 0; unitType < 3; unitType++) {
            for (let unitIdx = 0; unitIdx < 9; unitIdx++) {
                const counts: {[key: number]: {count: number, r: number, c: number}} = {};
                
                // Scan unit
                for (let i = 0; i < 9; i++) {
                    let r, c;
                    if (unitType === 0) { r = unitIdx; c = i; }
                    else if (unitType === 1) { r = i; c = unitIdx; }
                    else { r = Math.floor(unitIdx/3)*3 + Math.floor(i/3); c = (unitIdx%3)*3 + (i%3); }

                    // Only check unsolved cells
                    if (this.candidates[r][c].length > 1) {
                        for (const val of this.candidates[r][c]) {
                            if (!counts[val]) counts[val] = { count: 0, r, c };
                            counts[val].count++;
                            // Optimization: if count > 1 we can stop tracking position, but logic is simpler this way
                        }
                    }
                }

                // Apply logic
                for (let n = 1; n <= 9; n++) {
                    if (counts[n] && counts[n].count === 1) {
                        // Found Hidden Single
                        const { r, c } = counts[n];
                        // Remove all other candidates from this cell
                        const cands = this.candidates[r][c];
                        const others = cands.filter(v => v !== n);
                        for (const other of others) {
                            this.removeCandidate(r, c, other);
                        }
                        changed = true;
                    }
                }
            }
        }
        return changed;
    }

    // Tier 2 Logic: Intersection Removal (Locked Candidates - Pointing & Claiming)
    private applyLockedCandidates(): boolean {
        let changed = false;
        
        // Check Boxes
        for (let b = 0; b < 9; b++) {
            const startR = Math.floor(b/3)*3;
            const startC = (b%3)*3;
            
            for (let n = 1; n <= 9; n++) {
                const rowsWithN = new Set<number>();
                const colsWithN = new Set<number>();
                
                // Find all positions of N in this box
                for(let i=0; i<3; i++) {
                    for(let j=0; j<3; j++) {
                        if (this.candidates[startR+i][startC+j].includes(n)) {
                            rowsWithN.add(startR+i);
                            colsWithN.add(startC+j);
                        }
                    }
                }
                
                // Pointing Pair (Box -> Row)
                if (rowsWithN.size === 1) {
                    const r = Array.from(rowsWithN)[0];
                    // Remove N from rest of the row outside this box
                    for (let c = 0; c < 9; c++) {
                        if (c < startC || c >= startC + 3) {
                            if (this.removeCandidate(r, c, n)) changed = true;
                        }
                    }
                }
                
                // Pointing Pair (Box -> Col)
                if (colsWithN.size === 1) {
                    const c = Array.from(colsWithN)[0];
                    // Remove N from rest of the col outside this box
                    for (let r = 0; r < 9; r++) {
                        if (r < startR || r >= startR + 3) {
                            if (this.removeCandidate(r, c, n)) changed = true;
                        }
                    }
                }
            }
        }
        return changed;
    }

    // Tier 3 Logic: Naked Pairs
    private applyNakedPairs(): boolean {
        let changed = false;
        
        // Helper to check units
        const checkUnit = (coords: {r: number, c:number}[]) => {
            // Find cells with exactly 2 candidates
            const pairs: { [key: string]: {r:number, c:number}[] } = {};
            
            coords.forEach(({r,c}) => {
                if (this.candidates[r][c].length === 2) {
                    const key = this.candidates[r][c].join(',');
                    if (!pairs[key]) pairs[key] = [];
                    pairs[key].push({r,c});
                }
            });

            // If we have exactly 2 cells with the same 2 candidates, it's a Naked Pair
            for (const key in pairs) {
                if (pairs[key].length === 2) {
                    const [v1, v2] = key.split(',').map(Number);
                    const pairCells = pairs[key];
                    
                    // Remove v1, v2 from all OTHER cells in unit
                    coords.forEach(({r,c}) => {
                        // Skip the pair cells themselves
                        if (pairCells.some(p => p.r === r && p.c === c)) return;
                        
                        if (this.removeCandidate(r, c, v1)) changed = true;
                        if (this.removeCandidate(r, c, v2)) changed = true;
                    });
                }
            }
        };

        // Check Rows
        for (let r=0; r<9; r++) {
            const coords = [];
            for(let c=0; c<9; c++) coords.push({r,c});
            checkUnit(coords);
        }
        
        // Check Cols
        for (let c=0; c<9; c++) {
            const coords = [];
            for(let r=0; r<9; r++) coords.push({r,c});
            checkUnit(coords);
        }
        
        // Check Boxes
        for (let b=0; b<9; b++) {
            const startR = Math.floor(b/3)*3;
            const startC = (b%3)*3;
            const coords = [];
            for(let i=0; i<3; i++) for(let j=0; j<3; j++) coords.push({r: startR+i, c: startC+j});
            checkUnit(coords);
        }

        return changed;
    }

    // Attempt to solve the puzzle using logic up to maxTier
    // Tier 1: Singles (Naked & Hidden)
    // Tier 2: + Intersections (Locked Candidates)
    // Tier 3: + Subsets (Naked Pairs)
    public solve(maxTier: number): boolean {
        let changed = true;
        while(changed && this.solvedCount < 81) {
            changed = false;
            
            // Note: removeCandidate automatically propagates Naked Singles via eliminatePeers.
            // So we don't need an explicit "applyNakedSingles".
            
            // Check Hidden Singles (Tier 1)
            if (this.applyHiddenSingles()) {
                changed = true;
                continue; // Restart loop to ripple new singles
            }

            if (maxTier >= 2) {
                if (this.applyLockedCandidates()) {
                    changed = true;
                    continue;
                }
            }

            if (maxTier >= 3) {
                if (this.applyNakedPairs()) {
                    changed = true;
                    continue;
                }
            }
        }
        return this.solvedCount === 81;
    }
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

// Logic Configuration for each difficulty
// Only Normal is increased by 2 (to 36). Others kept at original baseline.
const DIFFICULTY_CONFIG = {
    [Difficulty.SuperEasy]: { tier: 1, minClues: 48 }, // Original baseline
    [Difficulty.Easy]:      { tier: 1, minClues: 40 }, // Original baseline
    [Difficulty.Normal]:    { tier: 2, minClues: 36 }, // Increased +2 from 34
    [Difficulty.Hard]:      { tier: 3, minClues: 32 }, // Original baseline
    [Difficulty.Intense]:   { tier: 3, minClues: 26 }, // Original baseline
    [Difficulty.Impossible]:{ tier: 4, minClues: 0 }   // Deepest dig
};

// Helper function to generate a single attempt
function generateAttempt(difficulty: Difficulty, seed: number): { initial: Board, solved: number[][], clues: number } {
    const rng = new SeededRandom(seed);
    
    // 1. Generate a solved board
    const solvedRaw = generateFullBoard(rng);
    
    // 2. Clone it to create the puzzle
    const puzzleRaw = solvedRaw.map(row => [...row]);
    
    const config = DIFFICULTY_CONFIG[difficulty];
    const targetClues = config.minClues;
    
    // 3. Create shuffled list of positions
    const positions = Array.from({length: 81}, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // 4. Dig Holes
    let currentClues = 81;

    for (const pos of positions) {
        // Stop if we hit target clue count (prevents SuperEasy from becoming too sparse)
        if (targetClues > 0 && currentClues <= targetClues) break;

        const r = Math.floor(pos / 9);
        const c = pos % 9;
        const backup = puzzleRaw[r][c];

        // Tentatively remove
        puzzleRaw[r][c] = 0;

        // CHECK 1: Uniqueness (Absolute Rule)
        // We assume countSolutions is fast enough for backtracker check
        const boardCopy = puzzleRaw.map(row => [...row]);
        const solutions = countSolutions(boardCopy);
        
        if (solutions !== 1) {
            puzzleRaw[r][c] = backup; // Put it back
            continue;
        }

        // CHECK 2: Logic Grading (Difficulty Rule)
        // For Impossible (Tier 4), we skip logic check and just dig deep
        if (config.tier < 4) {
            const solver = new LogicalSolver(puzzleRaw);
            const isSolvable = solver.solve(config.tier);
            
            if (!isSolvable) {
                puzzleRaw[r][c] = backup; // Put it back (Needs this clue for this difficulty)
                continue;
            }
        }

        // Removal Accepted
        currentClues--;
    }

    // 5. Convert to rich Cell objects
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

    return { initial, solved: solvedRaw, clues: currentClues };
}

export function generateLevel(difficulty: Difficulty, levelId: number): { initial: Board, solved: number[][] } {
    
    // GOLDEN SEEDS STRATEGY (Impossible Difficulty)
    // Instead of generating at runtime (slow), we pick from a list of pre-mined seeds.
    if (difficulty === Difficulty.Impossible) {
        // Deterministically pick a seed from the pool based on Level ID
        const seedIndex = (levelId - 1) % IMPOSSIBLE_SEEDS.length;
        const goldenSeed = IMPOSSIBLE_SEEDS[seedIndex];
        
        // This generates ONE board instantly using the golden seed.
        // We assume the seed guarantees the clue count.
        const attempt = generateAttempt(difficulty, goldenSeed);
        return { initial: attempt.initial, solved: attempt.solved };
    }

    // Standard generation for other difficulties
    const seedBase = getDifficultySeed(difficulty);
    const baseSeed = levelId + seedBase + 9999;
    const attempt = generateAttempt(difficulty, baseSeed);
    return { initial: attempt.initial, solved: attempt.solved };
}

// --- MINING TOOL ---
// Run this in the browser console: window.mineSudokuSeeds(1, 300)
// It will look for seeds that produce puzzles with <= 22 clues AND match difficulty.
(window as any).mineSudokuSeeds = (startSeed: number = 1, count: number = 50) => {
    console.log(`%c ⛏️ SUDOKU MINER STARTED (Target: ${count} seeds, <= 22 Clues, Hard Logic) `, 'background: #222; color: #bada55; padding: 5px;');
    
    const results: number[] = [];
    let seed = startSeed;
    let attempts = 0;
    const maxAttempts = 1000000; // Allow it to run longer
    
    const startTime = performance.now();

    while(results.length < count && attempts < maxAttempts) {
        attempts++;
        // Use Impossible to allow digging to 0, but we will check logic ourselves
        const attempt = generateAttempt(Difficulty.Impossible, seed);
        
        if (attempt.clues <= 22) {
             // EXTRA CHECK: Is it actually hard? 
             // Convert back to simple board for solver
             const simpleBoard = attempt.initial.map(r => r.map(c => c.value || 0));
             const solver = new LogicalSolver(simpleBoard);
             // If Tier 3 (Naked Pairs) CANNOT solve it, it's a true "Impossible" candidate
             const isEasy = solver.solve(3);
             
             if (!isEasy) {
                results.push(seed);
                console.log(`%c [${results.length}/${count}] Seed: ${seed} | Clues: ${attempt.clues} (Impossible Verified) `, 'color: #10b981');
             }
        }
        
        if (attempts % 1000 === 0) console.log(`Searched ${attempts} seeds... found ${results.length}`);
        seed++;
    }

    const endTime = performance.now();
    console.log(`%c MINING COMPLETE in ${((endTime - startTime)/1000).toFixed(2)}s `, 'background: #222; color: #bada55; padding: 5px;');
    console.log(`Found ${results.length} seeds.`);
    console.log(`%c COPY THE ARRAY BELOW INTO constants.ts (IMPOSSIBLE_SEEDS):`, 'font-weight: bold;');
    console.log(JSON.stringify(results));
}
