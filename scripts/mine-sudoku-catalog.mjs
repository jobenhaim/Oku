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

const countPerDifficulty = Math.max(1, Number.parseInt(args.get('count') ?? '12', 10));
const startingSeed = Math.max(1, Number.parseInt(args.get('start-seed') ?? '100000', 10));
const maximumAttempts = Math.max(
    countPerDifficulty,
    Number.parseInt(args.get('max-attempts') ?? '100000', 10)
);
const outputFormat = args.get('format') ?? 'detailed';
if (outputFormat !== 'detailed' && outputFormat !== 'seeds') {
    throw new Error(`Unknown output format "${outputFormat}". Use "detailed" or "seeds".`);
}
const outputPath = resolve(args.get('output') ?? 'data/sudoku-test-catalog.json');
const requestedDifficulties = (args.get('difficulties') ?? 'Normal,Hard,Intense')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

const {
    generateCandidateFromSeed,
    auditSudokuPuzzle,
    assessSudokuDifficulty,
    scoreSudokuAudit,
    DIFFICULTY_TARGETS,
    Difficulty
} = await loadSudokuTools();

const allDifficulties = Object.values(Difficulty);
const difficulties = requestedDifficulties.map(requested => {
    const difficulty = allDifficulties.find(
        value => value.toLowerCase() === requested.toLowerCase()
    );
    if (!difficulty) throw new Error(`Unknown difficulty "${requested}".`);
    if (difficulty === Difficulty.Impossible) {
        throw new Error('Impossible is not mineable until the logical auditor supports advanced techniques.');
    }
    return difficulty;
});

const acceptedPuzzleHashes = new Set();
const acceptedLayoutHashes = new Set();
const catalogue = [];
const miningSummary = [];
const startedAt = Date.now();

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

for (let difficultyIndex = 0; difficultyIndex < difficulties.length; difficultyIndex++) {
    const difficulty = difficulties[difficultyIndex];
    const accepted = [];
    let attempts = 0;
    let seed = startingSeed + difficultyIndex * maximumAttempts;

    process.stdout.write(
        `Mining ${countPerDifficulty} ${difficulty} candidates from seed ${seed}...\n`
    );

    while (accepted.length < countPerDifficulty && attempts < maximumAttempts) {
        const candidateSeed = seed++;
        attempts++;
        const { initial } = generateCandidateFromSeed(difficulty, candidateSeed);
        const audit = auditSudokuPuzzle(initial);
        const assessment = assessSudokuDifficulty(difficulty, audit);

        if (assessment.status !== 'match') {
            if (attempts % 500 === 0) {
                process.stdout.write(`  ${attempts} attempts, ${accepted.length} accepted\n`);
            }
            continue;
        }

        const board = numericBoard(initial);
        const maximumLayoutSymmetry = getMaximumLayoutSymmetry(board);
        if (maximumLayoutSymmetry >= 0.8) {
            continue;
        }
        const puzzleHash = board.flat().join('');
        const layoutHash = board.flat().map(value => value === 0 ? '0' : '1').join('');
        if (acceptedPuzzleHashes.has(puzzleHash) || acceptedLayoutHashes.has(layoutHash)) {
            continue;
        }

        acceptedPuzzleHashes.add(puzzleHash);
        acceptedLayoutHashes.add(layoutHash);
        const { complexityScore, advancedScore } = scoreSudokuAudit(audit);
        const entry = {
            difficulty,
            seed: candidateSeed,
            clues: audit.clues,
            minimumTier: audit.minimumTier,
            complexityScore,
            advancedScore,
            techniques: audit.tier3.techniques,
            logicalSteps: audit.tier3.logicalSteps,
            longestSinglesRun: audit.tier3.longestSinglesRun,
            maximumLayoutSymmetry,
            puzzle: board.map(row => row.join('')).join('/')
        };
        accepted.push(entry);
        catalogue.push(entry);
        if (countPerDifficulty <= 50 || accepted.length % 25 === 0 || accepted.length === countPerDifficulty) {
            process.stdout.write(
                `  accepted ${accepted.length}/${countPerDifficulty}: seed ${candidateSeed}, tier ${audit.minimumTier}, score ${complexityScore}\n`
            );
        }
    }

    if (accepted.length < countPerDifficulty) {
        throw new Error(
            `Only found ${accepted.length}/${countPerDifficulty} ${difficulty} candidates after ${attempts} attempts.`
        );
    }

    miningSummary.push({
        difficulty,
        attempts,
        accepted: accepted.length,
        acceptanceRate: accepted.length / attempts
    });
}

const output = outputFormat === 'seeds'
    ? {
        version: 2,
        generatedAt: new Date().toISOString(),
        purpose: 'Production level seed catalogue. Every seed passed the Oku difficulty policy.',
        summary: miningSummary,
        seeds: Object.fromEntries(
            difficulties.map(difficulty => [
                difficulty,
                catalogue
                    .filter(entry => entry.difficulty === difficulty)
                    .map(entry => entry.seed)
            ])
        )
    }
    : {
        generatedAt: new Date().toISOString(),
        purpose: 'Human difficulty testing only. Not connected to the production level catalogue.',
        targets: Object.fromEntries(
            difficulties.map(difficulty => [difficulty, DIFFICULTY_TARGETS[difficulty]])
        ),
        summary: miningSummary,
        puzzles: catalogue
    };

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

const elapsedSeconds = Math.round((Date.now() - startedAt) / 100) / 10;
process.stdout.write(`\nSaved ${catalogue.length} candidates to ${outputPath}\n`);
for (const summary of miningSummary) {
    process.stdout.write(
        `${summary.difficulty}: ${summary.accepted}/${summary.attempts} accepted (${(summary.acceptanceRate * 100).toFixed(2)}%)\n`
    );
}
process.stdout.write(`Mining time: ${elapsedSeconds}s\n`);
