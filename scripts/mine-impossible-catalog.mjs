import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadSudokuTools } from './load-sudoku-tools.mjs';

const args = new Map(
    process.argv
        .slice(2)
        .filter(argument => argument.startsWith('--'))
        .map(argument => {
            const [key, value = 'true'] = argument.slice(2).split('=');
            return [key, value];
        })
);

const targetCount = Math.max(1, Number.parseInt(args.get('count') ?? '300', 10));
const startingSeed = Math.max(1, Number.parseInt(args.get('start-seed') ?? '3000000', 10));
const maximumAttempts = Math.max(
    targetCount,
    Number.parseInt(args.get('max-attempts') ?? '100000', 10)
);
const outputPath = resolve(
    args.get('output') ?? 'data/sudoku-impossible-seed-catalog.json'
);

const {
    generateCandidateFromSeed,
    auditSudokuPuzzle,
    auditSudokuHumanFlow,
    auditSudokuWithAdvancedLogic,
    hasSoftImpossiblePacing,
    IMPOSSIBLE_SOFT_PACING_THRESHOLDS,
    measureImpossiblePacing,
    Difficulty
} = await loadSudokuTools();

const numericBoard = initial =>
    initial.map(row => row.map(cell => cell.value ?? 0));

const layoutTransforms = [
    (row, col) => [8 - row, 8 - col],
    (row, col) => [8 - row, col],
    (row, col) => [row, 8 - col],
    (row, col) => [col, row],
    (row, col) => [8 - col, 8 - row]
];

const getMaximumLayoutSymmetry = board => {
    const mask = board.flat().map(value => value === 0 ? 0 : 1);
    return Math.max(...layoutTransforms.map(transform => {
        let matchingCells = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const [transformedRow, transformedCol] = transform(row, col);
                if (mask[row * 9 + col] === mask[transformedRow * 9 + transformedCol]) {
                    matchingCells++;
                }
            }
        }
        return matchingCells / 81;
    }));
};

const proofMatchesSolution = (proof, solved) =>
    proof.every(step =>
        step.placements.every(({ row, col, value }) => solved[row][col] === value) &&
        step.eliminations.every(({ row, col, value }) => solved[row][col] !== value)
    );

const accepted = [];
const puzzleHashes = new Set();
const layoutHashes = new Set();
const rejectionCounts = {
    basicLogic: 0,
    unresolved: 0,
    insufficientAdvancedSteps: 0,
    noHighEndTechnique: 0,
    softPacing: 0,
    invalidProof: 0,
    symmetry: 0,
    duplicate: 0
};
let attempts = 0;
let seed = startingSeed;
const startedAt = Date.now();

console.log(`Mining ${targetCount} proof-certified Impossible puzzles...`);

while (accepted.length < targetCount && attempts < maximumAttempts) {
    const candidateSeed = seed++;
    attempts++;
    const { initial, solved, clues } = generateCandidateFromSeed(
        Difficulty.Impossible,
        candidateSeed
    );
    const board = numericBoard(initial);
    const basicAudit = auditSudokuPuzzle(initial);
    if (basicAudit.minimumTier !== null) {
        rejectionCounts.basicLogic++;
        continue;
    }

    const advancedAudit = auditSudokuWithAdvancedLogic(initial);
    if (!advancedAudit.solved || advancedAudit.contradiction) {
        rejectionCounts.unresolved++;
        continue;
    }
    if (advancedAudit.advancedSteps < 3) {
        rejectionCounts.insufficientAdvancedSteps++;
        continue;
    }
    if (advancedAudit.highEndSteps < 1) {
        rejectionCounts.noHighEndTechnique++;
        continue;
    }
    const pacing = measureImpossiblePacing(
        advancedAudit,
        auditSudokuHumanFlow(initial).steps.length
    );
    if (hasSoftImpossiblePacing(pacing)) {
        rejectionCounts.softPacing++;
        continue;
    }
    if (!proofMatchesSolution(advancedAudit.proof, solved)) {
        rejectionCounts.invalidProof++;
        continue;
    }

    const maximumSymmetry = getMaximumLayoutSymmetry(board);
    if (maximumSymmetry >= 0.8) {
        rejectionCounts.symmetry++;
        continue;
    }

    const puzzleHash = board.flat().join('');
    const layoutHash = board.flat().map(value => value === 0 ? '0' : '1').join('');
    if (puzzleHashes.has(puzzleHash) || layoutHashes.has(layoutHash)) {
        rejectionCounts.duplicate++;
        continue;
    }

    puzzleHashes.add(puzzleHash);
    layoutHashes.add(layoutHash);
    accepted.push({
        seed: candidateSeed,
        clues,
        advancedSteps: advancedAudit.advancedSteps,
        highEndSteps: advancedAudit.highEndSteps,
        hardestTechnique: advancedAudit.hardestTechnique,
        pacing,
        maximumSymmetry: Number(maximumSymmetry.toFixed(4)),
        techniques: advancedAudit.techniques
    });

    if (accepted.length % 25 === 0 || accepted.length === targetCount) {
        console.log(
            `  accepted ${accepted.length}/${targetCount} after ${attempts} attempts`
        );
    }
}

if (accepted.length !== targetCount) {
    throw new Error(
        `Found only ${accepted.length}/${targetCount} qualifying puzzles after ${attempts} attempts.`
    );
}

const techniqueTotals = {};
for (const entry of accepted) {
    for (const [technique, count] of Object.entries(entry.techniques)) {
        techniqueTotals[technique] = (techniqueTotals[technique] ?? 0) + count;
    }
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
    outputPath,
    `${JSON.stringify({
        version: 1,
        generatedAt: new Date().toISOString(),
        policy: {
            requiresBeyondTier3: true,
            minimumAdvancedSteps: 3,
            minimumHighEndSteps: 1,
            rejectsSoftPacing: true,
            softPacingThresholds: IMPOSSIBLE_SOFT_PACING_THRESHOLDS,
            maximumLayoutSymmetryExclusive: 0.8,
            branchingAllowed: false
        },
        attempts,
        elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
        rejectionCounts,
        techniqueTotals,
        seeds: accepted.map(entry => entry.seed),
        audit: accepted
    })}\n`
);

console.log(JSON.stringify({
    accepted: accepted.length,
    attempts,
    acceptanceRate: `${((accepted.length / attempts) * 100).toFixed(2)}%`,
    rejectionCounts,
    techniqueTotals,
    elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
    outputPath
}, null, 2));
