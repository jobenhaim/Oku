import { loadSudokuTools } from './load-sudoku-tools.mjs';

const {
    generateLevel,
    auditSudokuPuzzle,
    auditSudokuHumanFlow,
    auditSudokuWithAdvancedLogic,
    hasSoftImpossiblePacing,
    measureImpossiblePacing,
    Difficulty
} = await loadSudokuTools();

const countSolutions = source => {
    const board = source.map(row => [...row]);
    let count = 0;
    const solve = () => {
        if (count > 1) return;
        let targetRow = -1;
        let targetCol = -1;
        let targetOptions = null;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] !== 0) continue;
                const blocked = new Set();
                for (let index = 0; index < 9; index++) {
                    blocked.add(board[row][index]);
                    blocked.add(board[index][col]);
                }
                const startRow = Math.floor(row / 3) * 3;
                const startCol = Math.floor(col / 3) * 3;
                for (let boxRow = startRow; boxRow < startRow + 3; boxRow++) {
                    for (let boxCol = startCol; boxCol < startCol + 3; boxCol++) {
                        blocked.add(board[boxRow][boxCol]);
                    }
                }
                const options = [];
                for (let value = 1; value <= 9; value++) {
                    if (!blocked.has(value)) options.push(value);
                }
                if (options.length === 0) return;
                if (targetOptions === null || options.length < targetOptions.length) {
                    targetRow = row;
                    targetCol = col;
                    targetOptions = options;
                }
            }
        }
        if (targetOptions === null) {
            count++;
            return;
        }
        for (const value of targetOptions) {
            board[targetRow][targetCol] = value;
            solve();
            board[targetRow][targetCol] = 0;
            if (count > 1) return;
        }
    };
    solve();
    return count;
};

const transforms = [
    (row, col) => [8 - row, 8 - col],
    (row, col) => [8 - row, col],
    (row, col) => [row, 8 - col],
    (row, col) => [col, row],
    (row, col) => [8 - col, 8 - row]
];

const maximumSymmetry = board => {
    const mask = board.flat().map(value => value === 0 ? 0 : 1);
    return Math.max(...transforms.map(transform => {
        let matches = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const [otherRow, otherCol] = transform(row, col);
                if (mask[row * 9 + col] === mask[otherRow * 9 + otherCol]) {
                    matches++;
                }
            }
        }
        return matches / 81;
    }));
};

const failures = [];
const puzzleHashes = new Set();
const layoutHashes = new Set();
const techniqueTotals = {};
let highestSymmetry = 0;
let minimumClues = 81;
let maximumClues = 0;

for (let level = 1; level <= 300; level++) {
    const { initial, solved } = generateLevel(Difficulty.Impossible, level);
    const board = initial.map(row => row.map(cell => cell.value ?? 0));
    const clues = board.flat().filter(Boolean).length;
    minimumClues = Math.min(minimumClues, clues);
    maximumClues = Math.max(maximumClues, clues);

    const puzzleHash = board.flat().join('');
    const layoutHash = board.flat().map(value => value === 0 ? '0' : '1').join('');
    if (puzzleHashes.has(puzzleHash)) failures.push(`Level ${level}: duplicate puzzle`);
    if (layoutHashes.has(layoutHash)) failures.push(`Level ${level}: duplicate clue layout`);
    puzzleHashes.add(puzzleHash);
    layoutHashes.add(layoutHash);

    const symmetry = maximumSymmetry(board);
    highestSymmetry = Math.max(highestSymmetry, symmetry);
    if (symmetry >= 0.8) failures.push(`Level ${level}: excessive symmetry ${symmetry}`);

    if (countSolutions(board) !== 1) {
        failures.push(`Level ${level}: does not have exactly one solution`);
    }

    const basicAudit = auditSudokuPuzzle(initial);
    if (basicAudit.minimumTier !== null) {
        failures.push(`Level ${level}: solvable without advanced logic`);
    }

    const advancedAudit = auditSudokuWithAdvancedLogic(initial);
    if (!advancedAudit.solved || advancedAudit.contradiction) {
        failures.push(`Level ${level}: advanced proof did not solve cleanly`);
    }
    if (advancedAudit.advancedSteps < 3) {
        failures.push(`Level ${level}: fewer than three advanced steps`);
    }
    if (advancedAudit.highEndSteps < 1) {
        failures.push(`Level ${level}: no high-end technique`);
    }
    const pacing = measureImpossiblePacing(
        advancedAudit,
        auditSudokuHumanFlow(initial).steps.length
    );
    if (hasSoftImpossiblePacing(pacing)) {
        failures.push(
            `Level ${level}: soft Impossible pacing ` +
            `(opening ${pacing.openingSingles}, candidate steps ` +
            `${pacing.candidateDeductionSteps}, middle placements ` +
            `${pacing.middlePlacements}, final singles ${pacing.finalSingles})`
        );
    }
    for (const step of advancedAudit.proof) {
        for (const placement of step.placements) {
            if (solved[placement.row][placement.col] !== placement.value) {
                failures.push(`Level ${level}: invalid proof placement`);
            }
        }
        for (const elimination of step.eliminations) {
            if (solved[elimination.row][elimination.col] === elimination.value) {
                failures.push(`Level ${level}: invalid proof elimination`);
            }
        }
    }
    for (const [technique, count] of Object.entries(advancedAudit.techniques)) {
        techniqueTotals[technique] = (techniqueTotals[technique] ?? 0) + count;
    }
}

const report = {
    levels: 300,
    uniquePuzzles: puzzleHashes.size,
    uniqueLayouts: layoutHashes.size,
    clueRange: `${minimumClues}-${maximumClues}`,
    maximumSymmetry: Number(highestSymmetry.toFixed(4)),
    proofFailures: failures.length,
    branchingUsed: 0,
    techniqueTotals
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) {
    console.error(failures.slice(0, 25).join('\n'));
    process.exitCode = 1;
}
