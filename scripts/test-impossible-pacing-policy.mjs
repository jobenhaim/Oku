import assert from 'node:assert/strict';
import { loadSudokuTools } from './load-sudoku-tools.mjs';

const {
    hasSoftImpossiblePacing,
    IMPOSSIBLE_SOFT_PACING_THRESHOLDS,
    measureImpossiblePacing
} = await loadSudokuTools();

const single = technique => ({
    technique,
    placements: [{ row: 0, col: 0, value: 1 }],
    eliminations: []
});
const deduction = technique => ({
    technique,
    placements: [],
    eliminations: [{ row: 0, col: 0, value: 1 }]
});

const proof = [
    ...Array.from({ length: 12 }, () => single('nakedSingle')),
    deduction('lockedCandidate'),
    single('hiddenSingle'),
    deduction('simpleColoring'),
    ...Array.from({ length: 37 }, () => single('nakedSingle'))
];
const audit = {
    proof,
    highEndSteps: 1
};
const metrics = measureImpossiblePacing(audit, 12);

assert.deepEqual(metrics, {
    highEndSteps: 1,
    openingSingles: 12,
    candidateDeductionSteps: 2,
    middlePlacements: 1,
    finalSingles: 37
});
assert.equal(hasSoftImpossiblePacing(metrics), true);

for (const [metric, value] of [
    ['highEndSteps', 2],
    ['openingSingles', IMPOSSIBLE_SOFT_PACING_THRESHOLDS.minimumOpeningSingles - 1],
    [
        'candidateDeductionSteps',
        IMPOSSIBLE_SOFT_PACING_THRESHOLDS.maximumCandidateDeductionSteps + 1
    ],
    ['middlePlacements', IMPOSSIBLE_SOFT_PACING_THRESHOLDS.maximumMiddlePlacements + 1],
    ['finalSingles', IMPOSSIBLE_SOFT_PACING_THRESHOLDS.minimumFinalSingles - 1]
]) {
    assert.equal(
        hasSoftImpossiblePacing({ ...metrics, [metric]: value }),
        false,
        `${metric} should move the puzzle outside the soft-pacing signature`
    );
}

console.log('Impossible pacing policy test passed.');
