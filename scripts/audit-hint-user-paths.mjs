import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';

const args = new Map(
    process.argv.slice(2).filter(argument => argument.startsWith('--')).map(argument => {
        const [key, value = 'true'] = argument.slice(2).split('=');
        return [key, value];
    })
);

const readPositiveInteger = (name, fallback) => {
    const value = Number.parseInt(args.get(name) ?? `${fallback}`, 10);
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--${name} must be a positive integer.`);
    }
    return value;
};

const levelCount = Math.min(300, readPositiveInteger('levels', 300));
const maxActions = readPositiveInteger('max-actions', 2048);
const frontierLimit = readPositiveInteger('frontier-limit', 64);
const requestedDifficulty = args.get('difficulty');
const seedVersion = args.get('seed') ?? 'hint-candidates-v2';

const bundle = await build({
    stdin: {
        contents: `
            export {
                applyHintCandidatePlan,
                applyHintCandidateProgress,
                boardHintSignature,
                cloneHintBoard,
                createHintPlan,
                hintCandidateProgressSignature,
                reconcileHintCandidateProgress,
            } from './utils/hints.ts';
            export { auditSudokuWithAdvancedLogic } from './utils/sudokuAdvancedAudit.ts';
            export { hasSoftImpossiblePacing } from './utils/sudokuImpossiblePacing.ts';
            export { generateLevel } from './utils/sudoku.ts';
            export { Difficulty } from './types.ts';
        `,
        resolveDir: process.cwd(),
        loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    write: false,
    logLevel: 'silent',
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const {
    applyHintCandidatePlan,
    applyHintCandidateProgress,
    auditSudokuWithAdvancedLogic,
    boardHintSignature,
    cloneHintBoard,
    createHintPlan,
    hasSoftImpossiblePacing,
    hintCandidateProgressSignature,
    reconcileHintCandidateProgress,
    generateLevel,
    Difficulty,
} = await import(moduleUrl);

const difficulties = Object.values(Difficulty).filter(difficulty => (
    !requestedDifficulty || difficulty.toLowerCase() === requestedDifficulty.toLowerCase()
));
if (difficulties.length === 0) throw new Error(`Unknown difficulty "${requestedDifficulty}".`);

const ALL_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const HIGH_END_CANDIDATE_HINTS = new Set([
    'xWing',
    'swordfish',
    'xyWing',
    'simpleColoring',
]);
const increment = (map, key, amount = 1) => map.set(key, (map.get(key) ?? 0) + amount);
const coordinateKey = ({ row, col }) => `${row}:${col}`;
const coordinateSet = coordinates => new Set((coordinates ?? []).map(coordinateKey));
const sameSet = (left, right) => left.size === right.size && [...left].every(value => right.has(value));

const isHighEndCandidateHint = plan => (
    (plan.deductions ?? []).some(deduction => HIGH_END_CANDIDATE_HINTS.has(deduction.technique))
    || HIGH_END_CANDIDATE_HINTS.has(plan.technique)
);

const fnv1a = source => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const mulberry32 = seed => {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const shuffled = (items, seed) => {
    const result = [...items];
    const random = mulberry32(seed);
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
};

const numericGrid = board => board.map(row => row.map(cell => cell.value ?? 0));

const legalCandidates = (grid, row, col) => {
    if (grid[row][col] !== 0) return [];
    const blocked = new Set();
    for (let index = 0; index < 9; index += 1) {
        blocked.add(grid[row][index]);
        blocked.add(grid[index][col]);
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
        for (let colOffset = 0; colOffset < 3; colOffset += 1) {
            blocked.add(grid[startRow + rowOffset][startCol + colOffset]);
        }
    }
    return ALL_DIGITS.filter(value => !blocked.has(value));
};

const candidatesWithProgress = (board, progress) => {
    const grid = numericGrid(board);
    const candidates = Array.from({ length: 9 }, (_, row) => (
        Array.from({ length: 9 }, (_, col) => legalCandidates(grid, row, col))
    ));
    for (const exclusion of progress?.exclusions ?? []) {
        candidates[exclusion.row][exclusion.col] = candidates[exclusion.row][exclusion.col]
            .filter(value => value !== exclusion.value);
    }
    return candidates;
};

const noteSignature = board => board.map(row => row.map(cell => (
    [...cell.notes].sort((left, right) => left - right).join('')
)).join(',')).join('/');

const stateSignature = (board, progress) => (
    `${boardHintSignature(board)}|${progress ? hintCandidateProgressSignature(progress) : 'none'}|${noteSignature(board)}`
);

const blankCoordinates = board => board.flatMap((row, rowIndex) => row.flatMap((cell, colIndex) => (
    cell.value === null ? [{ row: rowIndex, col: colIndex }] : []
)));

const place = (board, placement) => {
    const cell = board[placement.row][placement.col];
    assert.equal(cell.value, null, 'A Hint path can only fill an empty cell.');
    cell.value = placement.value;
    cell.isFixed = false;
    cell.notes = [];
    cell.isError = false;
    cell.isMarkedWrong = false;
};

const validateCandidateDeltas = (board, solved, progress, plan, context) => {
    const candidates = candidatesWithProgress(board, progress);
    assert.ok(plan.candidateEliminations.length > 0, `${context}: missing deltas.`);
    for (const elimination of plan.candidateEliminations) {
        assert.deepEqual(
            elimination.beforeCandidates,
            candidates[elimination.row][elimination.col],
            `${context}: stale beforeCandidates.`,
        );
        assert.ok(elimination.removedValues.length > 0, `${context}: empty removal.`);
        assert.deepEqual(
            elimination.afterCandidates,
            elimination.beforeCandidates.filter(value => !elimination.removedValues.includes(value)),
            `${context}: malformed afterCandidates.`,
        );
        assert.ok(elimination.afterCandidates.length > 0, `${context}: emptied a cell.`);
        assert.equal(
            elimination.removedValues.includes(solved[elimination.row][elimination.col]),
            false,
            `${context}: removed the solution candidate.`,
        );
        candidates[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
};

const validatePlanSafety = (board, solved, progress, result, context) => {
    if (result.status !== 'ready') return;
    const plan = result.plan;
    if (plan.candidateEliminations?.length) {
        validateCandidateDeltas(board, solved, progress, plan, context);
    }

    if (plan.outcome === 'placement') {
        const { row, col, value } = plan.target;
        assert.equal(board[row][col].value, null, `${context}: target must be empty.`);
        assert.equal(solved[row][col], value, `${context}: target must match the solution.`);
        return;
    }

    assert.equal(plan.target, undefined, `${context}: candidate Hint cannot have a target.`);
    assert.ok(plan.noteUpdates.length > 0, `${context}: candidate Hint needs visible updates.`);
    assert.ok(plan.deductions.length > 0, `${context}: candidate Hint needs metadata.`);
    for (const frame of plan.frames) {
        assert.equal(frame.target, undefined, `${context}/${frame.id}: unexpected answer target.`);
        assert.equal(
            (frame.candidateMarks ?? []).some(mark => mark.tone === 'answer'),
            false,
            `${context}/${frame.id}: unexpected answer mark.`,
        );
    }
    const finalFrame = plan.frames.at(-1);
    assert.ok(finalFrame.id.endsWith('update'), `${context}: final frame must update candidates.`);
    assert.equal(finalFrame.eliminationStyle, 'candidate-slash');
    assert.equal(finalFrame.fillEliminatedCells, false);
    assert.ok(sameSet(
        coordinateSet(finalFrame.candidateUpdateCells),
        coordinateSet(plan.deductions.at(-1).candidateEliminations),
    ), `${context}: update cells do not match the current deduction.`);

    const affected = coordinateSet(plan.candidateEliminations);
    for (const update of plan.noteUpdates) {
        assert.ok(affected.has(coordinateKey(update)), `${context}: unrelated note update.`);
        assert.notDeepEqual(update.beforeNotes, update.afterNotes, `${context}: no-op update.`);
        assert.deepEqual(
            update.beforeNotes,
            [...board[update.row][update.col].notes].sort((left, right) => left - right),
        );
    }
};

const applyCandidate = (board, solved, progress, plan, context) => {
    const boardBefore = structuredClone(board);
    const progressBefore = structuredClone(progress);
    const next = applyHintCandidatePlan(board, solved, progress, plan);
    assert.ok(next, `${context}: candidate plan failed atomic validation.`);
    assert.deepEqual(board, boardBefore, `${context}: ledger application mutated the board.`);
    assert.deepEqual(progress, progressBefore, `${context}: prior ledger was mutated.`);
    for (const update of plan.noteUpdates) {
        board[update.row][update.col].notes = [...update.afterNotes];
    }
    return next;
};

const createNotedVariant = (board, seed) => {
    const noted = cloneHintBoard(board);
    const random = mulberry32(seed);
    for (const cell of noted.flat()) {
        if (cell.value !== null) continue;
        const notes = ALL_DIGITS.filter(() => random() < 0.28);
        cell.notes = notes.length > 0 ? notes : [1 + Math.floor(random() * 9)];
    }
    return noted;
};

const outcomeRecord = () => ({ runs: 0, complete: 0, unsupported: 0, cycle: 0, limit: 0 });
const outcomes = new Map(difficulties.map(difficulty => [difficulty, outcomeRecord()]));
const flowCounts = new Map();
const candidateDepths = new Map();
const unsupportedReference = new Map();
let openingReady = 0;
let totalChecks = 0;
let placementHints = 0;
let candidateHints = 0;
let carriedPlacementHints = 0;
let deterministicChecks = 0;
let noteVariantChecks = 0;
let frontierChecks = 0;
let maximumCandidateDepth = 0;
const softImpossiblePacing = [];
let impossiblePacingChecks = 0;

const recordReferenceStall = (board) => {
    const reference = auditSudokuWithAdvancedLogic(board);
    const first = reference.proof.find(step => (
        step.placements.length > 0 || step.eliminations.length > 0
    ));
    increment(unsupportedReference, first?.technique ?? (
        reference.contradiction ? 'reference contradiction' : 'reference exhausted'
    ));
};

const evaluate = (board, solved, progress, context) => {
    const boardBefore = structuredClone(board);
    const progressBefore = structuredClone(progress);
    const result = createHintPlan(board, solved, { candidateProgress: progress });
    const repeated = createHintPlan(board, solved, { candidateProgress: progress });
    assert.deepEqual(repeated, result, `${context}: non-deterministic result.`);
    assert.deepEqual(board, boardBefore, `${context}: planning mutated the board.`);
    assert.deepEqual(progress, progressBefore, `${context}: planning mutated progress.`);
    assert.ok(
        result.status === 'ready' || result.status === 'complete' || result.status === 'unsupported',
        `${context}: unexpected status ${result.status}.`,
    );
    validatePlanSafety(board, solved, progress, result, context);
    deterministicChecks += 1;
    totalChecks += 1;
    return result;
};

const runToNextPlacement = (board, solved, initialProgress, context) => {
    let progress = initialProgress;
    let depth = 0;
    const seen = new Set();
    for (let action = 0; action < frontierLimit; action += 1) {
        const signature = stateSignature(board, progress);
        if (seen.has(signature)) return { status: 'cycle', depth, progress };
        seen.add(signature);
        const result = evaluate(board, solved, progress, `${context}, candidate ${depth}`);
        if (result.status !== 'ready') return { status: result.status, depth, progress };
        if (result.plan.outcome === 'placement') {
            if (result.plan.candidateEliminations?.length) {
                const next = applyHintCandidateProgress(board, solved, progress, result.plan);
                assert.ok(next, `${context}: carried placement deductions failed.`);
                progress = next;
            }
            return { status: 'placement', depth, progress, plan: result.plan };
        }
        progress = applyCandidate(board, solved, progress, result.plan, context);
        depth += 1;
    }
    return { status: 'limit', depth, progress };
};

const startedAt = performance.now();

for (const difficulty of difficulties) {
    process.stdout.write(`Auditing ${difficulty} (${levelCount} levels)...\n`);
    for (let levelId = 1; levelId <= levelCount; levelId += 1) {
        const { initial, solved } = generateLevel(difficulty, levelId);
        const board = cloneHintBoard(initial);
        let progress = null;
        let depthSincePlacement = 0;
        let ended = false;
        const seen = new Set();
        const record = outcomes.get(difficulty);
        const pacing = {
            highEndSteps: 0,
            openingSingles: 0,
            candidateDeductionSteps: 0,
            middlePlacements: 0,
            placementsAfterLastCandidateUpdate: 0,
            candidateTechniques: [],
        };
        record.runs += 1;

        for (let action = 0; action < maxActions; action += 1) {
            const signature = stateSignature(board, progress);
            if (seen.has(signature)) {
                record.cycle += 1;
                ended = true;
                break;
            }
            seen.add(signature);
            const context = `${difficulty} ${levelId}, canonical action ${action}`;
            const result = evaluate(board, solved, progress, context);
            if (action === 0 && result.status === 'ready') openingReady += 1;

            if (result.status === 'complete') {
                record.complete += 1;
                ended = true;
                break;
            }
            if (result.status === 'unsupported') {
                record.unsupported += 1;
                recordReferenceStall(board);
                ended = true;
                break;
            }

            increment(flowCounts, `${result.plan.outcome}: ${result.plan.techniqueLabel}`);
            if (result.plan.outcome === 'candidate') {
                candidateHints += 1;
                // Placements after the previous update become middle placements
                // only when another update follows; otherwise they are the final run.
                if (pacing.candidateDeductionSteps > 0) {
                    pacing.middlePlacements += pacing.placementsAfterLastCandidateUpdate;
                    pacing.placementsAfterLastCandidateUpdate = 0;
                }
                pacing.candidateDeductionSteps += 1;
                pacing.candidateTechniques.push(result.plan.techniqueLabel);
                if (isHighEndCandidateHint(result.plan)) pacing.highEndSteps += 1;
                progress = applyCandidate(board, solved, progress, result.plan, context);
                depthSincePlacement += 1;
                continue;
            }

            placementHints += 1;
            if (result.plan.candidateEliminations?.length) {
                carriedPlacementHints += 1;
                const advanced = applyHintCandidateProgress(board, solved, progress, result.plan);
                assert.ok(advanced, `${context}: carried placement deductions failed.`);
                progress = advanced;
            }
            increment(candidateDepths, `${depthSincePlacement}`);
            maximumCandidateDepth = Math.max(maximumCandidateDepth, depthSincePlacement);
            depthSincePlacement = 0;
            place(board, result.plan.target);
            if (pacing.candidateDeductionSteps === 0) {
                pacing.openingSingles += 1;
            } else {
                pacing.placementsAfterLastCandidateUpdate += 1;
            }
            progress = reconcileHintCandidateProgress(board, solved, progress);

            if (fnv1a(`${seedVersion}|notes|${difficulty}|${levelId}|${action}`) % 37 === 0) {
                const noted = createNotedVariant(board, fnv1a(`${seedVersion}|${context}`));
                const notedResult = evaluate(noted, solved, progress, `${context}, note variant`);
                if (notedResult.status === 'ready' && notedResult.plan.outcome === 'candidate') {
                    assert.ok(applyHintCandidatePlan(noted, solved, progress, notedResult.plan));
                }
                noteVariantChecks += 1;
            }
        }
        if (!ended) record.limit += 1;

        if (difficulty === Difficulty.Impossible) {
            const metrics = {
                highEndSteps: pacing.highEndSteps,
                openingSingles: pacing.openingSingles,
                candidateDeductionSteps: pacing.candidateDeductionSteps,
                middlePlacements: pacing.middlePlacements,
                finalSingles: pacing.candidateDeductionSteps > 0
                    ? pacing.placementsAfterLastCandidateUpdate
                    : pacing.openingSingles,
            };
            impossiblePacingChecks += 1;
            if (hasSoftImpossiblePacing(metrics)) {
                softImpossiblePacing.push({
                    levelId,
                    ...metrics,
                    candidateTechniques: pacing.candidateTechniques,
                });
            }
        }

        const blanks = blankCoordinates(initial);
        const order = shuffled(blanks, fnv1a(`${seedVersion}|frontier|${difficulty}|${levelId}`));
        for (const fraction of [0.25, 0.5, 0.75]) {
            const stressBoard = cloneHintBoard(initial);
            for (const coordinate of order.slice(0, Math.round(blanks.length * fraction))) {
                place(stressBoard, { ...coordinate, value: solved[coordinate.row][coordinate.col] });
            }
            const frontier = runToNextPlacement(
                stressBoard,
                solved,
                null,
                `${difficulty} ${levelId}, ${Math.round(fraction * 100)}% stress frontier`,
            );
            assert.ok(
                frontier.status === 'placement' || frontier.status === 'complete',
                `${difficulty} ${levelId} stress frontier stopped at ${frontier.status}.`,
            );
            maximumCandidateDepth = Math.max(maximumCandidateDepth, frontier.depth);
            increment(candidateDepths, `${frontier.depth}`);
            frontierChecks += 1;
        }
    }
}

const elapsedSeconds = (performance.now() - startedAt) / 1000;
const totalPuzzles = difficulties.length * levelCount;
const totalOutcomes = [...outcomes.values()].reduce((total, record) => ({
    complete: total.complete + record.complete,
    unsupported: total.unsupported + record.unsupported,
    cycle: total.cycle + record.cycle,
    limit: total.limit + record.limit,
}), { complete: 0, unsupported: 0, cycle: 0, limit: 0 });

assert.equal(totalOutcomes.cycle, 0, 'Canonical Hint paths must never cycle.');
assert.equal(totalOutcomes.limit, 0, 'Canonical Hint paths must stay within the action limit.');
assert.equal(openingReady, totalPuzzles, 'Every production puzzle needs an opening Hint.');
assert.deepEqual(
    softImpossiblePacing,
    [],
    `Impossible production Hint paths have soft pacing: ${softImpossiblePacing.map(result => (
        `${result.levelId} (opening ${result.openingSingles}, candidate updates ` +
        `${result.candidateDeductionSteps}, middle placements ${result.middlePlacements}, ` +
        `final placements ${result.finalSingles}, high-end Hints ${result.highEndSteps}, ` +
        `candidate techniques ${result.candidateTechniques.join(' → ')})`
    )).join('; ')}`,
);

const sortedEntries = map => [...map.entries()].sort((left, right) => (
    right[1] - left[1] || `${left[0]}`.localeCompare(`${right[0]}`)
));

const printTable = (headers, rows) => {
    if (rows.length === 0) return;
    const widths = headers.map((header, index) => Math.max(
        `${header}`.length,
        ...rows.map(row => `${row[index]}`.length),
    ));
    const printRow = row => process.stdout.write(
        `${row.map((cell, index) => `${cell}`.padEnd(widths[index])).join('  ')}\n`,
    );
    printRow(headers);
    printRow(widths.map(width => '-'.repeat(width)));
    rows.forEach(printRow);
};

process.stdout.write('\nCandidate-aware Hint user-path audit\n');
process.stdout.write(`Puzzles: ${totalPuzzles}\n`);
process.stdout.write(`Hint evaluations: ${totalChecks.toLocaleString()}\n`);
process.stdout.write(`Placement Hints: ${placementHints.toLocaleString()}\n`);
process.stdout.write(`Candidate-update Hints: ${candidateHints.toLocaleString()}\n`);
process.stdout.write(`Placements carrying invisible deductions: ${carriedPlacementHints.toLocaleString()}\n`);
process.stdout.write(`Maximum candidate updates before a placement: ${maximumCandidateDepth}\n`);
process.stdout.write(`Opening availability: ${openingReady}/${totalPuzzles}\n`);
process.stdout.write(`Determinism checks: ${deterministicChecks.toLocaleString()}\n`);
process.stdout.write(`Note-variant checks: ${noteVariantChecks.toLocaleString()}\n`);
process.stdout.write(`Correct-player-state frontier checks: ${frontierChecks.toLocaleString()}\n`);
if (impossiblePacingChecks > 0) {
    process.stdout.write(`Impossible Hint pacing checks: ${impossiblePacingChecks.toLocaleString()}\n`);
}
process.stdout.write(`Elapsed: ${elapsedSeconds.toFixed(1)}s\n\n`);

process.stdout.write('Canonical outcomes\n');
printTable(
    ['Difficulty', 'Complete', 'Unsupported', 'Cycle', 'Limit'],
    difficulties.map(difficulty => {
        const record = outcomes.get(difficulty);
        return [difficulty, record.complete, record.unsupported, record.cycle, record.limit];
    }),
);

process.stdout.write('\nHint flow distribution\n');
printTable(['Outcome / flow', 'Calls'], sortedEntries(flowCounts));

process.stdout.write('\nCandidate-update depth before the next placement\n');
printTable(
    ['Candidate updates', 'Occurrences'],
    [...candidateDepths.entries()].sort((left, right) => Number(left[0]) - Number(right[0])),
);

if (unsupportedReference.size > 0) {
    process.stdout.write('\nReference signal for unsupported canonical states\n');
    printTable(['Reference technique', 'States'], sortedEntries(unsupportedReference));
}

process.stdout.write('\nAudit completed without solution-removal, mutation, determinism, stale-plan, cycle, candidate-progress, or Impossible pacing failures.\n');
