import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
    stdin: {
        contents: `
            export {
                applyHintCandidatePlan,
                applyHintCandidateProgress,
                boardHintSignature,
                cloneHintBoard,
                colorHintCellReferences,
                computeHintCandidateProgressIntegrity,
                createHintCandidateProgress,
                createHintPlan,
                diagnoseHintSearch,
                hasValidHintCandidateProgressIntegrity,
                hintCellReferenceToneForFrame,
                hintCandidateProgressSignature,
                reconcileHintCandidateProgress,
            } from './utils/hints.ts';
            export {
                DEV_HINT_PREVIEWS,
                createDevHintPreview,
                getDevHintPreviewPuzzle,
                isDevHintPreview,
                scopeDevHintPreview,
            } from './utils/devHintPreview.ts';
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
    boardHintSignature,
    cloneHintBoard,
    colorHintCellReferences,
    computeHintCandidateProgressIntegrity,
    createHintCandidateProgress,
    createHintPlan,
    diagnoseHintSearch,
    hasValidHintCandidateProgressIntegrity,
    hintCellReferenceToneForFrame,
    hintCandidateProgressSignature,
    reconcileHintCandidateProgress,
    DEV_HINT_PREVIEWS,
    createDevHintPreview,
    getDevHintPreviewPuzzle,
    isDevHintPreview,
    scopeDevHintPreview,
    generateLevel,
    Difficulty,
} = await import(moduleUrl);

const parseGrid = (source) => source.split('/').map(row => (
    [...row].map(value => Number(value))
));

const makeBoard = (grid) => grid.map((row, rowIndex) => row.map((value, colIndex) => ({
    row: rowIndex,
    col: colIndex,
    value: value === 0 ? null : value,
    isFixed: value !== 0,
    notes: [],
    isError: false,
})));

const deepClone = value => JSON.parse(JSON.stringify(value));

const transposeGrid = grid => Array.from({ length: 9 }, (_, row) => (
    Array.from({ length: 9 }, (_, col) => grid[col][row])
));

const coordinateKey = ({ row, col }) => `${row}:${col}`;
const isPeer = (left, right) => (
    left.row === right.row
    || left.col === right.col
    || (
        Math.floor(left.row / 3) === Math.floor(right.row / 3)
        && Math.floor(left.col / 3) === Math.floor(right.col / 3)
    )
);

const legalCandidates = (grid, row, col) => {
    if (grid[row][col] !== 0) return [];
    const blocked = new Set();
    for (let index = 0; index < 9; index++) {
        blocked.add(grid[row][index]);
        blocked.add(grid[index][col]);
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
        for (let colOffset = 0; colOffset < 3; colOffset++) {
            blocked.add(grid[startRow + rowOffset][startCol + colOffset]);
        }
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(value => !blocked.has(value));
};

const cellsForGuideUnit = ({ kind, index }) => {
    if (kind === 'row') {
        return Array.from({ length: 9 }, (_, col) => ({ row: index, col }));
    }
    if (kind === 'column') {
        return Array.from({ length: 9 }, (_, row) => ({ row, col: index }));
    }
    const startRow = Math.floor(index / 3) * 3;
    const startCol = (index % 3) * 3;
    return Array.from({ length: 9 }, (_, offset) => ({
        row: startRow + Math.floor(offset / 3),
        col: startCol + (offset % 3),
    }));
};

const candidateGrid = grid => Array.from({ length: 9 }, (_, row) => (
    Array.from({ length: 9 }, (_, col) => legalCandidates(grid, row, col))
));

const simulatedPlacements = (grid, candidates) => {
    const placements = new Set();
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] === 0 && candidates[row][col].length === 1) {
                placements.add(`${row}:${col}:${candidates[row][col][0]}`);
            }
        }
    }
    for (const kind of ['row', 'column', 'box']) {
        for (let index = 0; index < 9; index++) {
            const unit = cellsForGuideUnit({ kind, index });
            for (let value = 1; value <= 9; value++) {
                if (unit.some(cell => grid[cell.row][cell.col] === value)) continue;
                const positions = unit.filter(cell => (
                    grid[cell.row][cell.col] === 0
                    && candidates[cell.row][cell.col].includes(value)
                ));
                if (positions.length === 1) {
                    placements.add(`${positions[0].row}:${positions[0].col}:${value}`);
                }
            }
        }
    }
    return placements;
};

const coordinateSet = coordinates => new Set(coordinates.map(coordinateKey));

const isSameCoordinateSet = (left, right) => (
    left.size === right.size && [...left].every(key => right.has(key))
);

const assertNakedCandidateBreakdown = (frame, target, grid) => {
    assert.equal(frame.remainingDigit, undefined);
    assert.equal(frame.candidateMarks, undefined);
    assert.deepEqual(
        { row: frame.candidateBreakdown.row, col: frame.candidateBreakdown.col },
        { row: target.row, col: target.col },
    );
    assert.deepEqual(
        frame.candidateBreakdown.marks.map(mark => mark.value),
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );

    const remainingMarks = frame.candidateBreakdown.marks.filter(mark => mark.tone === 'remaining');
    const blockedMarks = frame.candidateBreakdown.marks.filter(mark => mark.tone === 'blocked');
    assert.deepEqual(remainingMarks, [{ value: target.value, tone: 'remaining' }]);
    assert.equal(blockedMarks.length, 8);
    assert.equal(new Set(blockedMarks.map(mark => mark.value)).size, 8);
    assert.deepEqual(legalCandidates(grid, target.row, target.col), [target.value]);

    for (const mark of blockedMarks) {
        assert.equal(grid[mark.blockedBy.row][mark.blockedBy.col], mark.value);
        assert.ok(isPeer(mark.blockedBy, target));
    }

    assert.ok(isSameCoordinateSet(
        coordinateSet(frame.sourceCells),
        coordinateSet(blockedMarks.map(mark => mark.blockedBy)),
    ));
    assert.match(frame.accessibleDetail, new RegExp(`Only ${target.value} remains at row ${target.row + 1}, column ${target.col + 1}`));
};

const guideForCells = cells => {
    const rows = new Set(cells.map(cell => cell.row));
    const cols = new Set(cells.map(cell => cell.col));
    if (rows.size === 1 && cells.length === 9) {
        return { kind: 'row', index: cells[0].row };
    }
    if (cols.size === 1 && cells.length === 9) {
        return { kind: 'column', index: cells[0].col };
    }
    return {
        kind: 'box',
        index: Math.floor(cells[0].row / 3) * 3 + Math.floor(cells[0].col / 3),
    };
};

const inferLockedIntersection = (sourceUnit, lockedMarks) => {
    assert.ok(lockedMarks.length >= 2);
    if (sourceUnit.kind === 'box') {
        const rows = new Set(lockedMarks.map(mark => mark.row));
        if (rows.size === 1) return { kind: 'row', index: lockedMarks[0].row };
        const columns = new Set(lockedMarks.map(mark => mark.col));
        assert.equal(columns.size, 1);
        return { kind: 'column', index: lockedMarks[0].col };
    }

    return {
        kind: 'box',
        index: Math.floor(lockedMarks[0].row / 3) * 3 + Math.floor(lockedMarks[0].col / 3),
    };
};

const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
};

const SOLUTION = parseGrid(
    '534678912/672195348/198342567/859761423/426853791/713924856/961537284/287419635/345286179'
);

const withBlanks = (...coordinates) => {
    const grid = deepClone(SOLUTION);
    for (const { row, col } of coordinates) grid[row][col] = 0;
    return grid;
};

const displayUnitName = unit => unit.kind === 'box' ? '3 × 3 box' : unit.kind;

const formatCandidateValues = values => {
    if (values.length <= 1) return `${values[0] ?? ''}`;
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
};

const hasCoordinate = (coordinates, target) => (coordinates ?? []).some(cell => (
    cell.row === target.row && cell.col === target.col
));

const assertPresentationContract = (plan, label = plan.technique) => {
    if (plan.outcome === 'candidate') {
        assert.equal(plan.target, undefined);
        assert.ok(plan.frames.length >= 2);
        assert.ok(plan.deductions.length > 0);
        for (const frame of plan.frames) {
            assert.equal(frame.target, undefined, `${label}/${frame.id}: candidate flow cannot place`);
            assert.equal(
                (frame.candidateMarks ?? []).some(mark => mark.tone === 'answer'),
                false,
                `${label}/${frame.id}: candidate flow cannot reveal an answer`,
            );
            if (frame.titleParts) {
                assert.equal(frame.titleParts.map(part => part.text).join(''), frame.title);
            }
            if (frame.bodyParts) {
                assert.equal(frame.bodyParts.map(part => part.text).join(''), frame.body);
            }
        }
        const finalFrame = plan.frames.at(-1);
        assert.ok(finalFrame.id.endsWith('update'));
        assert.equal(finalFrame.eliminationStyle, 'candidate-slash');
        assert.equal(finalFrame.fillEliminatedCells, false);
        assert.ok(isSameCoordinateSet(
            coordinateSet(finalFrame.candidateUpdateCells),
            coordinateSet(plan.deductions.at(-1).candidateEliminations),
        ));
        return;
    }

    const target = plan.target;
    const targetValue = target.value;
    const assertTargetFocus = (frame) => {
        assert.ok(
            hasCoordinate(frame.spotlightCells, target),
            `${label}/${frame.id}: cell-focused copy must spotlight its target`,
        );
    };
    const unitFromCells = (frame) => {
        assert.equal(frame.unitCells?.length, 9, `${label}/${frame.id}: expected one complete unit`);
        return guideForCells(frame.unitCells);
    };

    if (plan.technique === 'multiStep') {
        assert.ok(plan.deductions.length >= 2 && plan.deductions.length <= 3);
        assert.equal(plan.frames.length, plan.deductions.length * 2 + 1);
        assert.equal(new Set(plan.frames.map(frame => frame.id)).size, plan.frames.length);
        assert.deepEqual(
            plan.candidateEliminations,
            plan.deductions.flatMap(deduction => deduction.candidateEliminations),
        );

        plan.deductions.forEach((deduction, index) => {
            const findFrame = plan.frames[index * 2];
            const removeFrame = plan.frames[index * 2 + 1];
            const stepNumber = index + 1;
            const expectedLabel = deduction.technique === 'lockedCandidate'
                ? 'Locked candidates'
                : deduction.technique === 'nakedPair'
                    ? 'Naked pair'
                    : deduction.technique === 'hiddenPair'
                        ? 'Hidden pair'
                        : deduction.technique === 'nakedTriple'
                            ? 'Naked triple'
                            : deduction.technique === 'xWing'
                                ? 'X-Wing'
                                : 'XY-Wing';
            const techniqueId = deduction.technique === 'lockedCandidate'
                ? 'locked'
                : deduction.technique === 'nakedPair'
                    ? 'pair'
                    : deduction.technique === 'hiddenPair'
                        ? 'hidden-pair'
                        : deduction.technique === 'nakedTriple'
                            ? 'triple'
                            : deduction.technique === 'xWing'
                                ? 'x-wing'
                                : 'xy-wing';
            assert.equal(deduction.techniqueLabel, expectedLabel);
            assert.equal(findFrame.id, `chain-${stepNumber}-${techniqueId}-find`);
            assert.equal(removeFrame.id, `chain-${stepNumber}-${techniqueId}-remove`);
            assert.equal(findFrame.techniqueLabel, expectedLabel);
            assert.equal(removeFrame.techniqueLabel, expectedLabel);
            assert.ok(deduction.candidateEliminations.length > 0);
            assert.equal(removeFrame.eliminationStyle, 'candidate-slash');
            const isFinalDeduction = index === plan.deductions.length - 1;
            const expectedFill = deduction.technique === 'nakedPair'
                || deduction.technique === 'hiddenPair'
                ? false
                : deduction.technique === 'nakedTriple'
                    ? isFinalDeduction && plan.derivedResult === 'hidden'
                    : removeFrame.candidateTransition === undefined;
            assert.equal(removeFrame.fillEliminatedCells, expectedFill);
        });

        const answerFrame = plan.frames.at(-1);
        assert.equal(answerFrame.id, 'chain-answer');
        assertTargetFocus(answerFrame);
        assert.deepEqual(answerFrame.target, plan.target);
        assert.equal(
            answerFrame.techniqueLabel,
            plan.derivedResult === 'naked' ? 'Naked single' : 'Hidden single',
        );
        if (plan.derivedResult === 'naked') {
            assert.equal(answerFrame.title, `Only ${targetValue} remains`);
            assert.equal(answerFrame.body, `${targetValue} belongs in this cell.`);
        } else {
            assert.equal(answerFrame.title, `Only one place remains for ${targetValue}`);
            assert.equal(answerFrame.body, `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
        }
        return;
    }

    for (const frame of plan.frames) {
        switch (frame.id) {
            case 'unit-completion-look': {
                const [unit] = frame.guideUnits;
                const name = displayUnitName(unit);
                assert.notEqual(frame.guideStrokeTone, 'soft');
                assert.equal(frame.title, `Look at this ${name}`);
                assert.equal(frame.body, 'Only one cell is empty.');
                break;
            }
            case 'unit-completion-answer': {
                const [unit] = frame.guideUnits;
                const name = displayUnitName(unit);
                assert.notEqual(frame.guideStrokeTone, 'soft');
                assert.equal(frame.title, `The only number left is ${targetValue}`);
                assert.equal(frame.body, `Every other number already appears in this ${name}.`);
                break;
            }
            case 'unit-completion-place': {
                const [unit] = frame.guideUnits;
                const name = displayUnitName(unit);
                assert.equal(frame.guideStrokeTone, 'soft');
                assertTargetFocus(frame);
                assert.equal(frame.title, `This cell must be ${targetValue}`);
                assert.equal(frame.body, `It completes the ${name}.`);
                break;
            }
            case 'naked-look':
                assertTargetFocus(frame);
                assert.equal(frame.unitCells, undefined);
                assert.equal(frame.guideUnits, undefined);
                assert.equal(frame.title, 'Look at this cell');
                assert.equal(frame.body, 'Which number can go here?');
                break;
            case 'naked-rule-out':
                assertTargetFocus(frame);
                assert.equal(frame.guideStrokeTone, 'soft');
                assert.deepEqual(
                    new Set(frame.guideUnits.map(unit => unit.kind)),
                    new Set(['row', 'column', 'box']),
                );
                assert.equal(frame.title, `Only ${targetValue} can fit`);
                assert.equal(
                    frame.body,
                    "Each other candidate is blocked by a placed number in this cell's row, column, or box.",
                );
                break;
            case 'naked-answer':
                assertTargetFocus(frame);
                assert.equal(frame.unitCells, undefined);
                assert.equal(frame.guideUnits, undefined);
                assert.equal(frame.title, `This cell must be ${targetValue}`);
                assert.equal(frame.body, 'It is the only number that fits.');
                break;
            case 'hidden-look': {
                const unit = unitFromCells(frame);
                const name = displayUnitName(unit);
                assert.notEqual(frame.unitStrokeTone, 'soft');
                assert.deepEqual(frame.spotlightCells, []);
                assert.ok(hasCoordinate(frame.unitCells, target));
                assert.equal(frame.title, `Look at this ${name}`);
                assert.equal(frame.body, `${targetValue} is missing from this ${name}.`);
                break;
            }
            case 'hidden-blocked':
                assertTargetFocus(frame);
                assert.equal(frame.title, `Only one place for ${targetValue}`);
                assert.equal(frame.body, `The placed ${targetValue}s rule out every other cell in this ${displayUnitName(unitFromCells(plan.frames[0]))}.`);
                assert.equal(frame.eliminationStyle, 'candidate-slash');
                assert.ok(frame.accessibleDetail?.includes(`only place for ${targetValue}`));
                break;
            case 'hidden-answer':
                assertTargetFocus(frame);
                assert.equal(frame.title, 'Only this cell remains');
                assert.equal(frame.body, `So ${targetValue} belongs here.`);
                break;
            case 'locked-find': {
                const unit = unitFromCells(frame);
                const name = displayUnitName(unit);
                const lockedMarks = frame.candidateMarks.filter(mark => mark.tone === 'locked');
                const lockedValue = lockedMarks[0].value;
                const placeCount = lockedMarks.length === 2 ? 'two' : 'three';
                assert.notEqual(frame.unitStrokeTone, 'soft');
                assert.equal(frame.title, `Only ${placeCount} places for ${lockedValue}`);
                assert.equal(frame.body, `In this ${name}, ${lockedValue} can only go in these cells.`);
                break;
            }
            case 'locked-remove': {
                const lockedMarks = frame.candidateMarks.filter(mark => mark.tone === 'locked');
                const eliminatedMarks = frame.candidateMarks.filter(mark => mark.tone === 'eliminated');
                const lockedValue = lockedMarks[0].value;
                const victim = plan.derivedResult === 'hidden'
                    ? eliminatedMarks.length === 1 ? 'the shaded cell' : 'the shaded cells'
                    : eliminatedMarks.length === 1 ? 'the outlined cell' : 'the outlined cells';
                assert.ok(lockedMarks.length >= 2);
                assert.ok(eliminatedMarks.length >= 1);
                assert.equal(frame.fillEliminatedCells, plan.derivedResult === 'hidden');
                if (plan.derivedResult === 'hidden') {
                    const unit = unitFromCells(frame);
                    const name = displayUnitName(unit);
                    assert.notEqual(frame.unitStrokeTone, 'soft');
                    assert.equal(frame.guideUnits, undefined);
                    assert.equal(frame.title, `Now look at this ${name}`);
                    assert.equal(frame.body, `The locked ${lockedValue}s rule out ${lockedValue} in ${victim}.`);
                } else {
                    assertTargetFocus(frame);
                    const [unit] = frame.guideUnits;
                    const name = displayUnitName(unit);
                    assert.equal(frame.unitStrokeTone, 'soft');
                    assert.notEqual(frame.guideStrokeTone, 'soft');
                    assert.equal(frame.title, `These ${lockedValue}s share this ${name}`);
                    assert.equal(frame.body, `So ${lockedValue} cannot go in ${victim}.`);
                }
                break;
            }
            case 'locked-answer':
                assertTargetFocus(frame);
                assert.equal(
                    frame.techniqueLabel,
                    plan.derivedResult === 'naked' ? 'Naked single' : 'Hidden single',
                );
                if (plan.derivedResult === 'hidden') {
                    assert.equal(frame.unitStrokeTone, 'soft');
                    assert.equal(frame.title, `Only one place remains for ${targetValue}`);
                    assert.equal(frame.body, `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
                } else {
                    assert.equal(frame.unitCells, undefined);
                    assert.equal(frame.title, `Only ${targetValue} remains`);
                    assert.equal(frame.body, `${targetValue} belongs in this cell.`);
                }
                break;
            case 'pair-find': {
                const pairValues = frame.candidateNoteSets[0].marks.map(mark => mark.value);
                assert.equal(frame.spotlightCells.length, 2);
                assert.equal(frame.unitStrokeTone, 'soft');
                assert.equal(frame.title, 'These cells share two choices');
                assert.equal(frame.body, `They must contain ${pairValues[0]} and ${pairValues[1]}, in either order.`);
                break;
            }
            case 'pair-remove': {
                const pairValues = frame.candidateNoteSets[0].marks.map(mark => mark.value);
                if (plan.derivedResult === 'hidden') {
                    const unit = unitFromCells(frame);
                    const name = displayUnitName(unit);
                    const eliminatedMarks = frame.candidateMarks.filter(mark => mark.tone === 'eliminated');
                    const victim = eliminatedMarks.length === 1 ? 'the shaded cell' : 'the shaded cells';
                    assert.deepEqual(frame.spotlightCells, []);
                    assert.notEqual(frame.unitStrokeTone, 'soft');
                    assert.equal(frame.guideUnits, undefined);
                    assert.equal(frame.candidateNoteSets.length, 2);
                    assert.ok(eliminatedMarks.length > 0);
                    assert.ok(eliminatedMarks.every(mark => mark.value === targetValue));
                    assert.equal(frame.eliminationStyle, 'candidate-slash');
                    assert.equal(frame.fillEliminatedCells, true);
                    assert.equal(frame.title, `Now look at this ${name}`);
                    assert.equal(frame.body, `The pair rules out ${targetValue} in ${victim}.`);
                } else {
                    const targetNotes = frame.candidateNoteSets.find(noteSet => (
                        noteSet.row === target.row && noteSet.col === target.col
                    ));
                    const removedValues = targetNotes.marks
                        .filter(mark => mark.tone === 'removed')
                        .map(mark => mark.value);
                    const removedLabel = removedValues.length === 2
                        ? `${removedValues[0]} and ${removedValues[1]}`
                        : `${removedValues[0]}`;
                    assertTargetFocus(frame);
                    assert.equal(frame.guideStrokeTone, 'soft');
                    assert.equal(frame.title, `The pair reserves ${pairValues[0]} and ${pairValues[1]}`);
                    assert.equal(frame.body, `Cross out ${removedLabel} in the cell with gray notes. Only ${targetValue} remains.`);
                }
                break;
            }
            case 'pair-answer':
                assertTargetFocus(frame);
                assert.equal(
                    frame.techniqueLabel,
                    plan.derivedResult === 'naked' ? 'Naked single' : 'Hidden single',
                );
                if (plan.derivedResult === 'hidden') {
                    assert.equal(frame.unitStrokeTone, 'soft');
                    assert.equal(frame.title, `Only one place remains for ${targetValue}`);
                    assert.equal(frame.body, `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
                } else {
                    assert.equal(frame.unitCells, undefined);
                    assert.equal(frame.title, `Only ${targetValue} remains`);
                    assert.equal(frame.body, `${targetValue} belongs in this cell.`);
                }
                break;
            case 'hidden-pair-find': {
                const pairValues = [...new Set(frame.candidateNoteSets.flatMap(noteSet => (
                    noteSet.marks
                        .filter(mark => mark.tone === 'locked')
                        .map(mark => mark.value)
                )))].sort((left, right) => left - right);
                const unit = unitFromCells(frame);
                const name = displayUnitName(unit);
                assert.equal(frame.spotlightCells.length, 2);
                assert.equal(frame.unitStrokeTone, 'soft');
                assert.equal(frame.title, `${pairValues[0]} and ${pairValues[1]} have only two places`);
                assert.equal(frame.body, `In this ${name}, both must go in these two cells.`);
                assert.ok(frame.candidateNoteSets.some(noteSet => (
                    noteSet.marks.some(mark => mark.tone === 'possible')
                )));
                break;
            }
            case 'hidden-pair-remove': {
                const pairValues = [...new Set(frame.candidateNoteSets.flatMap(noteSet => (
                    noteSet.marks
                        .filter(mark => mark.tone === 'remaining')
                        .map(mark => mark.value)
                )))].sort((left, right) => left - right);
                const removedValues = [...new Set(frame.candidateNoteSets.flatMap(noteSet => (
                    noteSet.marks
                        .filter(mark => mark.tone === 'removed')
                        .map(mark => mark.value)
                )))].sort((left, right) => left - right);
                const unit = unitFromCells(frame);
                const name = displayUnitName(unit);
                const removalInstruction = removedValues.length === 1
                    ? `Cross out the gray ${removedValues[0]}.`
                    : `Cross out the gray notes for ${formatCandidateValues(removedValues)}.`;
                assert.equal(frame.title, `Now look at this ${name}`);
                assert.equal(
                    frame.body,
                    `${removalInstruction} That leaves one place for ${targetValue}.`,
                );
                assert.equal(frame.eliminationStyle, 'candidate-slash');
                assert.equal(frame.fillEliminatedCells, false);
                break;
            }
            case 'hidden-pair-answer':
                assertTargetFocus(frame);
                assert.equal(frame.candidateNoteSets, undefined);
                assert.equal(frame.unitStrokeTone, 'soft');
                assert.equal(frame.title, `Only one place remains for ${targetValue}`);
                assert.equal(frame.body, `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
                break;
            case 'triple-find': {
                const unit = unitFromCells(frame);
                const name = displayUnitName(unit);
                const tripleValues = [...new Set(frame.candidateNoteSets.flatMap(noteSet => (
                    noteSet.marks.map(mark => mark.value)
                )))].sort((left, right) => left - right);
                assert.equal(frame.spotlightCells.length, 3);
                assert.equal(new Set(frame.spotlightCells.map(coordinateKey)).size, 3);
                assert.equal(frame.candidateNoteSets.length, 3);
                assert.equal(tripleValues.length, 3);
                assert.equal(frame.unitStrokeTone, 'soft');
                assert.equal(frame.title, 'These three cells share three choices');
                assert.equal(
                    frame.body,
                    `Together, they must contain ${formatCandidateValues(tripleValues)}, in some order.`,
                );
                assert.ok(frame.candidateNoteSets.every(noteSet => (
                    noteSet.marks.length >= 2
                    && noteSet.marks.length <= 3
                    && noteSet.marks.every(mark => mark.tone === 'locked')
                )));
                assert.ok(frame.accessibleDetail.includes(`In this ${name}`));
                break;
            }
            case 'triple-remove': {
                const tripleNoteSets = frame.candidateNoteSets.slice(0, 3);
                const tripleValues = [...new Set(tripleNoteSets.flatMap(noteSet => (
                    noteSet.marks.map(mark => mark.value)
                )))].sort((left, right) => left - right);
                assert.equal(frame.eliminationStyle === 'candidate-slash' || frame.eliminationStyle === undefined, true);
                if (plan.derivedResult === 'naked') {
                    const targetNotes = frame.candidateNoteSets.find(noteSet => (
                        noteSet.row === target.row && noteSet.col === target.col
                    ));
                    assert.ok(targetNotes);
                    const removedValues = targetNotes.marks
                        .filter(mark => mark.tone === 'removed')
                        .map(mark => mark.value);
                    assertTargetFocus(frame);
                    assert.equal(frame.guideStrokeTone, 'soft');
                    assert.equal(
                        frame.title,
                        `The triple reserves ${formatCandidateValues(tripleValues)}`,
                    );
                    assert.equal(
                        frame.body,
                        `Cross out ${formatCandidateValues(removedValues)} in the cell with gray notes. Only ${targetValue} remains.`,
                    );
                } else {
                    const unit = unitFromCells(frame);
                    const name = displayUnitName(unit);
                    const eliminatedMarks = frame.candidateMarks.filter(mark => (
                        mark.tone === 'eliminated'
                    ));
                    const candidatePhrase = eliminatedMarks.length === 1
                        ? `the gray ${targetValue}`
                        : `the gray ${targetValue}s`;
                    assert.deepEqual(frame.spotlightCells, []);
                    assert.ok(eliminatedMarks.length > 0);
                    assert.ok(eliminatedMarks.every(mark => mark.value === targetValue));
                    assert.equal(frame.title, `Now look at this ${name}`);
                    assert.equal(
                        frame.body,
                        `Cross out ${candidatePhrase}. That leaves one place for ${targetValue}.`,
                    );
                }
                break;
            }
            case 'triple-answer':
                assertTargetFocus(frame);
                if (plan.derivedResult === 'naked') {
                    assert.equal(frame.title, `Only ${targetValue} remains`);
                    assert.equal(frame.body, `${targetValue} belongs in this cell.`);
                } else {
                    assert.equal(frame.unitStrokeTone, 'soft');
                    assert.equal(frame.title, `Only one place remains for ${targetValue}`);
                    assert.equal(frame.body, `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
                }
                break;
            case 'x-wing-find': {
                const lockedMarks = frame.candidateMarks.filter(mark => mark.tone === 'locked');
                const value = lockedMarks[0].value;
                const baseKind = frame.guideUnits[0].kind;
                const baseName = baseKind === 'row' ? 'rows' : 'columns';
                const coverName = baseKind === 'row' ? 'columns' : 'rows';
                assert.equal(frame.guideUnits.length, 2);
                assert.ok(frame.guideUnits.every(unit => unit.kind === baseKind));
                assert.equal(frame.guideStrokeTone, 'soft');
                assert.equal(frame.spotlightCells.length, 4);
                assert.equal(new Set(frame.spotlightCells.map(coordinateKey)).size, 4);
                assert.equal(lockedMarks.length, 4);
                assert.ok(lockedMarks.every(mark => mark.value === value));
                assert.equal(frame.title, `Look at the possible ${value}s`);
                assert.equal(
                    frame.body,
                    `In both ${baseName}, ${value} can only go in the same two ${coverName}.`,
                );
                break;
            }
            case 'x-wing-remove': {
                const lockedMarks = frame.candidateMarks.filter(mark => mark.tone === 'locked');
                const eliminatedMarks = frame.candidateMarks.filter(mark => (
                    mark.tone === 'eliminated'
                ));
                const value = lockedMarks[0].value;
                const coverKind = frame.guideUnits[0].kind;
                const coverName = coverKind === 'row' ? 'rows' : 'columns';
                assert.equal(frame.guideUnits.length, 2);
                assert.ok(frame.guideUnits.every(unit => unit.kind === coverKind));
                assert.equal(frame.guideStrokeTone, 'soft');
                assert.equal(lockedMarks.length, 4);
                assert.ok(eliminatedMarks.length > 0);
                assert.ok(eliminatedMarks.every(mark => mark.value === value));
                assert.equal(frame.eliminationStyle, 'candidate-slash');
                assert.equal(frame.fillEliminatedCells, plan.derivedResult === 'hidden');
                assert.equal(frame.title, `So ${value} cannot go elsewhere in these ${coverName}`);
                if (plan.derivedResult === 'naked') {
                    assertTargetFocus(frame);
                    assert.deepEqual(frame.candidateTransition.afterCandidates, [targetValue]);
                    assert.equal(frame.candidateTransition.removedValue, value);
                    assert.equal(
                        frame.body,
                        `Cross out the slashed ${value}s. Only ${targetValue} remains in the outlined cell.`,
                    );
                } else {
                    assert.deepEqual(frame.spotlightCells, []);
                    assert.equal(
                        frame.body,
                        `Cross out the gray ${value}s. That leaves one place for ${targetValue}.`,
                    );
                }
                break;
            }
            case 'x-wing-answer':
                assertTargetFocus(frame);
                if (plan.derivedResult === 'naked') {
                    assert.equal(frame.title, `Only ${targetValue} remains`);
                    assert.equal(frame.body, `${targetValue} belongs in this cell.`);
                } else {
                    assert.equal(frame.unitStrokeTone, 'soft');
                    assert.equal(frame.title, `Only one place remains for ${targetValue}`);
                    assert.equal(frame.body, `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
                }
                break;
            case 'xy-wing-pivot': {
                const notes = frame.candidateNoteSets[0];
                const values = notes.marks.map(mark => mark.value);
                assert.equal(frame.spotlightCells.length, 1);
                assert.ok(isSameCoordinateSet(coordinateSet(frame.spotlightCells), coordinateSet([notes])));
                assert.ok(notes.marks.every(mark => mark.tone === 'locked'));
                assert.equal(frame.title, `This cell is ${values[0]} or ${values[1]}`);
                assert.equal(frame.body, "We don't know which one yet.");
                break;
            }
            case 'xy-wing-first-wing':
            case 'xy-wing-second-wing': {
                const isFirst = frame.id === 'xy-wing-first-wing';
                const pivotNotes = frame.candidateNoteSets[0];
                const wingNotes = frame.candidateNoteSets.at(-1);
                const pivotValues = pivotNotes.marks.map(mark => mark.value);
                const wingValues = wingNotes.marks.map(mark => mark.value);
                const shared = wingValues.find(value => pivotValues.includes(value));
                const z = wingValues.find(value => !pivotValues.includes(value));
                assert.equal(frame.guideUnits.length, 1);
                assert.equal(frame.guideStrokeTone, 'soft');
                assert.equal(frame.spotlightCells.length, 1);
                assert.ok(isPeer(pivotNotes, wingNotes));
                assert.ok(pivotNotes.marks.every(mark => mark.tone === 'locked'));
                assert.equal(wingNotes.marks.filter(mark => mark.tone === 'locked').length, 1);
                assert.equal(wingNotes.marks.find(mark => mark.tone === 'locked').value, shared);
                assert.equal(wingNotes.marks.find(mark => mark.value === z).tone, 'support');
                if (!isFirst) {
                    assert.equal(frame.candidateNoteSets[1].marks.find(mark => mark.value === z).tone, 'support');
                    assert.ok(frame.candidateNoteSets[1].marks
                        .filter(mark => mark.value !== z)
                        .every(mark => mark.tone === 'locked'));
                }
                assert.equal(frame.candidateNoteSets.flatMap(noteSet => noteSet.marks)
                    .some(mark => mark.tone === 'possible'), false);
                assert.equal(
                    frame.title,
                    `${isFirst ? 'This wing' : 'The other wing'} is ${shared} or ${z}`,
                );
                assert.equal(
                    frame.body,
                    `The ${shared} in both cells links them through this ${displayUnitName(frame.guideUnits[0])}.`,
                );
                break;
            }
            case 'xy-wing-remove': {
                const [pivotNotes, firstWing, secondWing] = frame.candidateNoteSets;
                const pivotValues = pivotNotes.marks.map(mark => mark.value);
                const firstValues = firstWing.marks.map(mark => mark.value);
                const secondValues = secondWing.marks.map(mark => mark.value);
                const z = firstValues.find(value => secondValues.includes(value));
                const eliminated = frame.candidateMarks.filter(mark => mark.tone === 'eliminated');
                assert.equal(frame.title, `Either way, one wing must be ${z}`);
                assert.equal(frame.eliminationStyle, 'candidate-slash');
                assert.equal(frame.fillEliminatedCells, plan.derivedResult === 'hidden');
                assert.ok(frame.guideUnits.length > 0);
                assert.equal(frame.guideStrokeTone, 'soft');
                assert.equal(pivotValues.length, 2);
                assert.equal(firstValues.length, 2);
                assert.equal(secondValues.length, 2);
                assert.ok(pivotNotes.marks.every(mark => mark.tone === 'locked'));
                assert.equal(firstWing.marks.find(mark => mark.value === z).tone, 'support');
                assert.equal(secondWing.marks.find(mark => mark.value === z).tone, 'support');
                assert.ok(firstWing.marks.filter(mark => mark.value !== z).every(mark => mark.tone === 'locked'));
                assert.ok(secondWing.marks.filter(mark => mark.value !== z).every(mark => mark.tone === 'locked'));
                assert.equal(frame.candidateNoteSets.flatMap(noteSet => noteSet.marks)
                    .some(mark => mark.tone === 'possible'), false);
                assert.ok(isPeer(pivotNotes, firstWing));
                assert.ok(isPeer(pivotNotes, secondWing));
                assert.ok(eliminated.length > 0);
                assert.ok(eliminated.every(mark => (
                    mark.value === z && isPeer(mark, firstWing) && isPeer(mark, secondWing)
                )));
                assert.ok(frame.candidateMarks.every(mark => mark.tone === 'eliminated'));
                if (plan.derivedResult === 'naked') assertTargetFocus(frame);
                assert.equal(frame.body, plan.derivedResult === 'naked'
                    ? `The outlined cell sees both wings, so ${z} cannot go here. Cross it out; only ${targetValue} remains.`
                    : eliminated.length === 1
                        ? `The ${z} in the shaded cell sees both wings, so cross it out.`
                        : `Every shaded ${z} sees both wings, so cross them out.`);
                break;
            }
            case 'xy-wing-answer':
                assertTargetFocus(frame);
                assert.equal(frame.title, plan.derivedResult === 'naked'
                    ? `Only ${targetValue} remains`
                    : `Only one place remains for ${targetValue}`);
                assert.equal(frame.body, plan.derivedResult === 'naked'
                    ? `${targetValue} belongs in this cell.`
                    : `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
                break;
            case 'color-chain-start':
                assert.equal(frame.guideUnits.length, 1);
                assert.equal(frame.guideStrokeTone, 'soft');
                assert.equal(frame.candidateMarks.length, 2);
                assert.deepEqual(new Set(frame.candidateMarks.map(mark => mark.tone)), new Set(['locked', 'possible']));
                assert.equal(frame.title, `Only two places for ${frame.candidateMarks[0].value}`);
                break;
            case 'color-chain-links':
                assert.equal(frame.title, 'Follow the alternating chain');
                assert.equal(
                    frame.body,
                    `The possible ${frame.candidateMarks[0].value}s alternate between circles and squares.`,
                );
                assert.deepEqual(frame.spotlightCells, []);
                assert.equal(frame.guideUnits, undefined);
                assert.equal(frame.guideStrokeTone, undefined);
                assert.ok(frame.candidateMarks.length >= 4 && frame.candidateMarks.length <= 8);
                assert.ok(frame.candidateMarks.every(mark => mark.tone === 'locked' || mark.tone === 'possible'));
                assert.deepEqual(new Set(frame.candidateMarks.map(mark => mark.tone)), new Set(['locked', 'possible']));
                break;
            case 'color-chain-rule':
                assert.ok(frame.spotlightCells.length > 0);
                assert.ok(frame.guideUnits.length > 0);
                assert.equal(frame.guideStrokeTone, 'normal');
                assert.ok(frame.candidateMarks.every(mark => mark.tone === 'locked' || mark.tone === 'possible'));
                break;
            case 'color-chain-remove':
                assert.equal(frame.guideUnits, undefined);
                assert.equal(frame.guideStrokeTone, undefined);
                assert.equal(frame.eliminationStyle, 'candidate-slash');
                assert.equal(frame.fillEliminatedCells, plan.derivedResult === 'hidden');
                assert.ok(frame.candidateMarks.every(mark => mark.tone === 'eliminated'));
                if (plan.derivedResult === 'naked') {
                    assertTargetFocus(frame);
                    assert.deepEqual(frame.candidateTransition.afterCandidates, [targetValue]);
                } else {
                    assert.deepEqual(frame.spotlightCells, []);
                    assert.equal(frame.candidateTransition, undefined);
                }
                break;
            case 'color-chain-answer':
                assert.equal(frame.guideUnits, undefined);
                assert.equal(frame.guideStrokeTone, undefined);
                assertTargetFocus(frame);
                assert.equal(frame.title, plan.derivedResult === 'naked'
                    ? `Only ${targetValue} remains`
                    : `Only one place remains for ${targetValue}`);
                assert.equal(frame.body, plan.derivedResult === 'naked'
                    ? `${targetValue} belongs in this cell.`
                    : `Every gray ${targetValue} is blocked, so ${targetValue} belongs in the green cell.`);
                break;
            default:
                assert.fail(`${label}: no presentation contract for ${frame.id}`);
        }
    }
};

const assertUnitCompletionPlan = (grid, expectedTarget, expectedUnit) => {
    const board = makeBoard(grid);
    const result = createHintPlan(board, SOLUTION);
    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'nakedSingle');
    assert.equal(result.plan.techniqueLabel, 'Full house');
    assert.deepEqual(result.plan.target, expectedTarget);
    assert.deepEqual(legalCandidates(grid, expectedTarget.row, expectedTarget.col), [expectedTarget.value]);

    const unitCells = cellsForGuideUnit(expectedUnit);
    const blankCells = unitCells.filter(cell => grid[cell.row][cell.col] === 0);
    assert.deepEqual(blankCells, [{ row: expectedTarget.row, col: expectedTarget.col }]);
    assert.deepEqual(
        new Set(unitCells.map(cell => grid[cell.row][cell.col]).filter(Boolean)),
        new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(value => value !== expectedTarget.value)),
    );

    const name = displayUnitName(expectedUnit);
    const [lookFrame, evidenceFrame, answerFrame] = result.plan.frames;
    assert.equal(lookFrame.title, `Look at this ${name}`);
    assert.equal(lookFrame.body, 'Only one cell is empty.');
    assert.deepEqual(lookFrame.spotlightCells, []);
    assert.deepEqual(lookFrame.guideUnits, [expectedUnit]);
    assert.equal(lookFrame.remainingDigit, undefined);
    assert.equal(lookFrame.sourceCells, undefined);
    assert.equal(lookFrame.candidateMarks, undefined);

    assert.equal(evidenceFrame.title, `The only number left is ${expectedTarget.value}`);
    assert.equal(evidenceFrame.body, `Every other number already appears in this ${name}.`);
    assert.deepEqual(evidenceFrame.spotlightCells, []);
    assert.deepEqual(evidenceFrame.guideUnits, [expectedUnit]);
    assert.equal(evidenceFrame.remainingDigit, undefined);
    assert.equal(evidenceFrame.sourceCells, undefined);
    assert.equal(evidenceFrame.candidateMarks, undefined);

    assert.equal(answerFrame.title, `This cell must be ${expectedTarget.value}`);
    assert.equal(answerFrame.body, `It completes the ${name}.`);
    assert.deepEqual(answerFrame.spotlightCells, [{ row: expectedTarget.row, col: expectedTarget.col }]);
    assert.deepEqual(answerFrame.guideUnits, [expectedUnit]);
    assert.equal(answerFrame.guideStrokeTone, 'soft');
    assert.deepEqual(answerFrame.target, expectedTarget);
    assert.deepEqual(answerFrame.candidateMarks, [{ ...expectedTarget, tone: 'answer' }]);
    assert.equal(answerFrame.remainingDigit, undefined);
    assert.equal(answerFrame.sourceCells, undefined);
    assertPresentationContract(result.plan, 'unit completion fixture');
    return result;
};

// This puzzle has no naked singles. Its next supported step is a hidden single.
const HIDDEN_SINGLE_PUZZLE = parseGrid(
    '015927040/000500200/602003590/000100700/900000403/007059182/208360910/100208070/593700820'
);
const HIDDEN_SINGLE_SOLUTION = parseGrid(
    '315927648/749586231/682413597/826134759/951872463/437659182/278365914/164298375/593741826'
);

const LOCKED_POINTING_ROW_PUZZLE = parseGrid(
    '020687543/854213697/376004128/260030954/040020300/530046872/482000709/690072400/710400200'
);
const LOCKED_POINTING_ROW_SOLUTION = parseGrid(
    '129687543/854213697/376594128/267138954/948725316/531946872/482351769/695872431/713469285'
);

const LOCKED_POINTING_COLUMN_PUZZLE = parseGrid(
    '070138259/583962174/921547368/209870600/700309800/318624795/807290500/105083000/002000080'
);
const LOCKED_POINTING_COLUMN_SOLUTION = parseGrid(
    '476138259/583962174/921547368/259871643/764359812/318624795/847296531/195783426/632415987'
);

const LOCKED_CLAIMING_ROW_PUZZLE = parseGrid(
    '493050006/176293548/258600931/349010060/627000815/815762394/761000480/084006103/032080600'
);
const LOCKED_CLAIMING_ROW_SOLUTION = parseGrid(
    '493851276/176293548/258647931/349518762/627439815/815762394/761325489/584976123/932184657'
);

const LOCKED_CLAIMING_COLUMN_PUZZLE = parseGrid(
    '070003049/304000006/009204001/400006192/160000874/097400653/006947015/900600407/740130968'
);
const LOCKED_CLAIMING_COLUMN_SOLUTION = parseGrid(
    '672813549/314795286/589264731/458376192/163529874/297481653/826947315/931658427/745132968'
);

const LOCKED_HIDDEN_PUZZLE = parseGrid(
    '876941325/030852976/259637100/060083210/700429560/002016000/607090830/090060050/020370691'
);
const LOCKED_HIDDEN_SOLUTION = parseGrid(
    '876941325/134852976/259637184/465783219/713429568/982516743/647195832/391268457/528374691'
);

const NAKED_PAIR_PUZZLE = parseGrid(
    '876941325/030852976/259637100/060083210/700429560/002016000/607095830/090060050/020370691'
);
const NAKED_PAIR_SOLUTION = parseGrid(
    '876941325/134852976/259637184/465783219/713429568/982516743/647195832/391268457/528374691'
);

const NAKED_PAIR_HIDDEN_PUZZLE = parseGrid(
    '700530009/630010020/450080000/840070653/300060090/960000200/184020900/576098012/293100070'
);
const NAKED_PAIR_HIDDEN_SOLUTION = parseGrid(
    '728536149/639714528/451289367/842971653/315862794/967453281/184627935/576398412/293145876'
);

const HIDDEN_PAIR_PUZZLE = parseGrid(
    '348007090/951240003/627390014/070000000/012930050/060870100/795423001/236781040/184659300'
);
const HIDDEN_PAIR_SOLUTION = parseGrid(
    '348517296/951246783/627398514/579162438/812934657/463875129/795423861/236781945/184659372'
);

const HIDDEN_PAIR_CHAIN_PUZZLE = parseGrid(
    '004000087/000004032/000085100/600807200/048052070/700410805/597328400/003040709/410079308'
);
const HIDDEN_PAIR_CHAIN_SOLUTION = parseGrid(
    '954231687/871964532/362785194/635897241/148652973/729413865/597328416/283146759/416579328'
);

const NAKED_TRIPLE_PUZZLE = parseGrid(
    '000000376/703000548/050073129/806000431/000000095/501000702/000769204/020384007/007512003'
);
const NAKED_TRIPLE_SOLUTION = parseGrid(
    '912845376/763921548/458673129/896257431/274136895/531498762/385769214/129384657/647512983'
);

const NAKED_TRIPLE_HIDDEN_PUZZLE = parseGrid(
    '000700201/510632000/247109003/400501030/020000710/301806000/700400100/000017904/104000300'
);
const NAKED_TRIPLE_HIDDEN_SOLUTION = parseGrid(
    '963784251/518632497/247159863/489571632/625943718/371826549/732495186/856317924/194268375'
);

const NAKED_TRIPLE_CHAIN_PUZZLE = parseGrid(
    '130680070/680000310/470139086/007001625/060700840/000006790/000905060/000060030/006000057'
);
const NAKED_TRIPLE_CHAIN_SOLUTION = parseGrid(
    '135684972/689527314/472139586/347891625/961752843/528346791/213975468/754268139/896413257'
);

const X_WING_PUZZLE = parseGrid(
    '320040085/089530240/405280300/874952613/500473800/932168574/058394100/293010458/040825030'
);
const X_WING_SOLUTION = parseGrid(
    '327641985/689537241/415289367/874952613/561473892/932168574/758394126/293716458/146825739'
);

const X_WING_HIDDEN_PUZZLE = parseGrid(
    '000051326/005006874/002000951/051843000/300500140/070019583/500000000/090105008/003000205'
);
const X_WING_HIDDEN_SOLUTION = parseGrid(
    '789451326/135296874/642387951/951843762/368572149/274619583/526938417/497125638/813764295'
);

const X_WING_CHAIN_PUZZLE = parseGrid(
    '491562800/726813594/300479261/630190002/002380006/070624050/063058009/000031620/007046005'
);
const X_WING_CHAIN_SOLUTION = parseGrid(
    '491562837/726813594/358479261/634195782/512387946/879624153/163258479/945731628/287946315'
);

const XY_WING_PUZZLE = parseGrid(
    '340192060/512786934/090354100/125670403/009043051/483015670/000431008/004060310/831020046'
);
const XY_WING_SOLUTION = parseGrid(
    '347192865/512786934/698354127/125679483/769843251/483215679/256431798/974568312/831927546'
);
const XY_WING_HIDDEN_PUZZLE = parseGrid(
    '080300204/200084000/140792085/021073469/060009000/700060003/478030900/000108706/610907508'
);
const XY_WING_HIDDEN_SOLUTION = parseGrid(
    '985316274/237584691/146792385/521873469/863459127/794261853/478635912/359128746/612947538'
);
const XY_WING_CHAIN_PUZZLE = parseGrid(
    '001000005/000150070/500704103/020069007/000580624/600200000/060000030/800603041/300005096'
);
const XY_WING_CHAIN_SOLUTION = parseGrid(
    '271398465/483156972/596724183/128469357/937581624/645237819/764912538/859673241/312845796'
);

const MULTI_STEP_PUZZLE = parseGrid(
    '000768093/897023650/030059070/008300000/975612000/340805000/713586000/402901006/009200010'
);
const MULTI_STEP_SOLUTION = parseGrid(
    '251768493/897423651/634159872/128347965/975612384/346895127/713586249/482971536/569234718'
);

const COLOR_CHAIN_PUZZLE = parseGrid(
    '070006800/000080793/080379000/700900000/020063907/090708401/010832674/260417509/007695000'
);
const COLOR_CHAIN_SOLUTION = parseGrid(
    '973246815/642581793/185379246/751924368/824163957/396758421/519832674/268417539/437695182'
);
const COLOR_CHAIN_WRAP_PUZZLE = parseGrid(
    '300200100/180305920/207100000/400630000/620504000/035021649/560013090/012006435/003052800'
);
const COLOR_CHAIN_WRAP_SOLUTION = parseGrid(
    '356297184/184365927/297148563/471639258/629584371/835721649/568413792/912876435/743952816'
);

let passed = 0;
let skipLegacyPlacementContract = false;
const test = (name, run) => {
    if (skipLegacyPlacementContract) return;
    run();
    passed += 1;
    console.log(`✓ ${name}`);
};

test('colors every “this cell” reference to match its highlighted cell role', () => {
    const referencePattern = /^this cell(?:['’]s)?$/i;
    const observedTones = new Set();

    for (const preview of DEV_HINT_PREVIEWS) {
        const { plan } = createDevHintPreview(preview);
        for (const frame of plan.frames) {
            const tone = hintCellReferenceToneForFrame(frame);
            for (const [fallback, configuredParts] of [
                [frame.title, frame.titleParts],
                [frame.body, frame.bodyParts],
            ]) {
                if (!/\bthis cell(?:['’]s)?\b/i.test(fallback)) continue;
                const parts = colorHintCellReferences(
                    configuredParts?.length ? configuredParts : [{ text: fallback }],
                    tone,
                );
                assert.equal(parts.map(part => part.text).join(''), fallback);
                const references = parts.filter(part => referencePattern.test(part.text));
                assert.ok(references.length > 0, `${preview} ${frame.id} must isolate its cell reference`);
                assert.ok(
                    references.every(part => part.tone === tone),
                    `${preview} ${frame.id} must use the ${tone} cell-reference tone`,
                );
                observedTones.add(tone);
            }
        }
    }

    assert.ok(observedTones.has('source'), 'blue spotlight references must be covered');
    assert.ok(observedTones.has('remaining'), 'green result references must be covered');

    const eliminatedFrame = {
        id: 'eliminated-cell-reference-contract',
        title: 'This cell is ruled out',
        body: 'Check this cell.',
        spotlightCells: [],
        candidateMarks: [{ row: 0, col: 0, value: 1, tone: 'eliminated' }],
        fillEliminatedCells: true,
    };
    const eliminatedTone = hintCellReferenceToneForFrame(eliminatedFrame);
    assert.equal(eliminatedTone, 'removed');
    assert.ok(colorHintCellReferences(
        [{ text: eliminatedFrame.title }],
        eliminatedTone,
    ).some(part => referencePattern.test(part.text) && part.tone === 'removed'));
});

test('uses blue links, amber shared candidates, and gray only for XY-Wing removals', () => {
    const textsByTone = (frame, field, tone) => (frame[field] ?? [])
        .filter(part => part.tone === tone)
        .map(part => part.text);
    const assertPalette = (frames, label) => {
        const removeFrame = frames.find(frame => (
            frame.id.endsWith('remove') || frame.id.endsWith('update')
        ));
        assert.ok(removeFrame, `${label} needs a removal frame`);
        const removed = removeFrame.candidateMarks?.find(mark => mark.tone === 'eliminated')?.value;
        assert.ok(removed, `${label} needs an eliminated candidate`);

        const relationshipFrames = frames.filter(frame => (
            frame.candidateNoteSets?.length
            && frame !== removeFrame
        ));
        relationshipFrames.forEach(frame => {
            const notes = frame.candidateNoteSets.flatMap(noteSet => noteSet.marks);
            assert.equal(
                notes.some(mark => mark.tone === 'possible'),
                false,
                `${label} ${frame.id} must not use gray for a live XY-Wing candidate`,
            );
            assert.ok(notes.every(mark => mark.tone === 'locked' || mark.tone === 'support'));
        });

        const removalNotes = removeFrame.candidateNoteSets?.flatMap(noteSet => noteSet.marks) ?? [];
        assert.equal(removalNotes.some(mark => mark.tone === 'possible'), false);
        assert.ok(removalNotes.some(mark => mark.value === removed && mark.tone === 'support'));
        assert.ok(removeFrame.candidateMarks.every(mark => mark.tone === 'eliminated'));
        assert.ok(
            textsByTone(removeFrame, 'titleParts', 'support').includes(`${removed}`),
            `${label} must color the shared wing candidate amber`,
        );
        assert.ok([
            ...textsByTone(removeFrame, 'titleParts', 'removed'),
            ...textsByTone(removeFrame, 'bodyParts', 'removed'),
        ].includes(`${removed}`));
    };

    for (const preview of ['xy-wing', 'xy-wing-hidden']) {
        const candidate = createDevHintPreview(preview);
        assert.equal(candidate.plan.technique, 'xyWing');
        assertPalette(candidate.plan.frames, preview);
    }
});

const assertLockedCandidatePlan = (grid, solution, expected) => {
    const board = makeBoard(grid);
    const beforeBoard = deepClone(board);
    const result = createHintPlan(board, solution);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'lockedCandidate');
    assert.equal(result.plan.techniqueLabel, 'Locked candidates');
    assert.equal(result.plan.derivedResult, expected.resultKind);
    assert.deepEqual(result.plan.target, expected.target);
    assert.equal(result.plan.frames.length, 3);
    assertPresentationContract(result.plan, `locked ${expected.resultKind} fixture`);

    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
    assert.equal(findFrame.id, 'locked-find');
    assert.equal(removeFrame.id, 'locked-remove');
    assert.equal(answerFrame.id, 'locked-answer');
    assert.deepEqual(findFrame.spotlightCells, []);
    assert.deepEqual(
        removeFrame.spotlightCells,
        expected.resultKind === 'naked'
            ? [{ row: expected.target.row, col: expected.target.col }]
            : [],
    );
    assert.equal(findFrame.dimUnrelated, true);
    assert.equal(removeFrame.dimUnrelated, true);
    assert.equal(answerFrame.dimUnrelated, true);
    assert.match(findFrame.accessibleDetail, /row \d+, column \d+/);
    assert.match(removeFrame.accessibleDetail, /row \d+, column \d+/);
    assert.match(answerFrame.accessibleDetail, /row \d+, column \d+/);

    const sourceGuide = guideForCells(findFrame.unitCells);
    assert.deepEqual(sourceGuide, expected.sourceUnit);
    if (expected.resultKind === 'hidden') {
        assert.deepEqual(guideForCells(removeFrame.unitCells), guideForCells(answerFrame.unitCells));
        assert.equal(removeFrame.title, `Now look at this ${displayUnitName(guideForCells(answerFrame.unitCells))}`);
        assert.equal(removeFrame.unitStrokeTone, undefined);
        assert.equal(removeFrame.contextCells, undefined);
        assert.equal(removeFrame.guideUnits, undefined);
        assert.equal(removeFrame.guideStrokeTone, undefined);
    } else {
        assert.deepEqual(guideForCells(removeFrame.unitCells), expected.sourceUnit);
        assert.equal(removeFrame.title, `These ${expected.value}s share this ${displayUnitName(expected.intersectingUnit)}`);
        assert.equal(removeFrame.unitStrokeTone, 'soft');
        assert.deepEqual(removeFrame.guideUnits, [expected.intersectingUnit]);
        assert.equal(removeFrame.guideStrokeTone, undefined);
    }
    assert.equal(removeFrame.eliminationStyle, 'candidate-slash');
    assert.equal(removeFrame.fillEliminatedCells, expected.resultKind === 'hidden');
    assert.ok(isSameCoordinateSet(
        coordinateSet(findFrame.unitCells),
        coordinateSet(cellsForGuideUnit(sourceGuide)),
    ));

    const beforeCandidates = candidateGrid(grid);
    const lockedMarks = findFrame.candidateMarks.filter(mark => mark.tone === 'locked');
    assert.ok(lockedMarks.length >= 2 && lockedMarks.length <= 3);
    assert.equal(findFrame.candidateMarks.length, lockedMarks.length);
    assert.ok(lockedMarks.every(mark => mark.value === expected.value));
    assert.ok(isSameCoordinateSet(
        coordinateSet(lockedMarks),
        coordinateSet(expected.lockedCells),
    ));

    const completeSourcePositions = cellsForGuideUnit(sourceGuide).filter(cell => (
        grid[cell.row][cell.col] === 0
        && beforeCandidates[cell.row][cell.col].includes(expected.value)
    ));
    assert.ok(isSameCoordinateSet(
        coordinateSet(lockedMarks),
        coordinateSet(completeSourcePositions),
    ));
    for (const mark of lockedMarks) {
        assert.equal(grid[mark.row][mark.col], 0);
        assert.ok(beforeCandidates[mark.row][mark.col].includes(expected.value));
        assert.ok(cellsForGuideUnit(expected.intersectingUnit).some(cell => (
            coordinateKey(cell) === coordinateKey(mark)
        )));
    }

    const repeatedLockedMarks = removeFrame.candidateMarks.filter(mark => mark.tone === 'locked');
    const eliminatedMarks = removeFrame.candidateMarks.filter(mark => mark.tone === 'eliminated');
    assert.ok(isSameCoordinateSet(coordinateSet(repeatedLockedMarks), coordinateSet(lockedMarks)));
    assert.ok(eliminatedMarks.length > 0);
    assert.ok(eliminatedMarks.every(mark => mark.value === expected.value));
    const expectedCausalEliminations = expected.resultKind === 'naked'
        ? [{ row: expected.target.row, col: expected.target.col }]
        : expected.eliminationCells.filter(cell => answerFrame.unitCells.some(unitCell => (
            coordinateKey(unitCell) === coordinateKey(cell)
        )));
    assert.ok(isSameCoordinateSet(
        coordinateSet(eliminatedMarks),
        coordinateSet(expectedCausalEliminations),
    ));
    assert.equal(
        removeFrame.body,
        expected.resultKind === 'hidden'
            ? `The locked ${expected.value}s rule out ${expected.value} in ${eliminatedMarks.length === 1 ? 'the shaded cell' : 'the shaded cells'}.`
            : `So ${expected.value} cannot go in ${eliminatedMarks.length === 1 ? 'the outlined cell' : 'the outlined cells'}.`,
    );
    assert.equal(
        removeFrame.candidateMarks.length,
        lockedMarks.length + eliminatedMarks.length,
    );
    if (expected.resultKind === 'hidden') {
        assert.ok(eliminatedMarks.length <= 3, 'hidden-result visuals must stay uncluttered');
    }

    const sourceKeys = coordinateSet(cellsForGuideUnit(sourceGuide));
    const intersectingKeys = coordinateSet(cellsForGuideUnit(expected.intersectingUnit));
    for (const cell of expected.eliminationCells) {
        const key = coordinateKey(cell);
        assert.equal(sourceKeys.has(key), false);
        assert.equal(intersectingKeys.has(key), true);
        assert.ok(beforeCandidates[cell.row][cell.col].includes(expected.value));
        assert.notEqual(solution[cell.row][cell.col], expected.value);
    }

    const afterCandidates = beforeCandidates.map(row => row.map(values => [...values]));
    for (const cell of expected.eliminationCells) {
        afterCandidates[cell.row][cell.col] = afterCandidates[cell.row][cell.col].filter(value => (
            value !== expected.value
        ));
        assert.ok(afterCandidates[cell.row][cell.col].length > 0);
    }

    const target = expected.target;
    if (expected.resultKind === 'naked') {
        assert.equal(answerFrame.title, `Only ${target.value} remains`);
        assert.equal(
            answerFrame.body,
            `${target.value} belongs in this cell.`,
        );
        assert.deepEqual(
            beforeCandidates[target.row][target.col],
            [expected.value, target.value].sort((left, right) => left - right),
        );
        assert.deepEqual(afterCandidates[target.row][target.col], [target.value]);
        assert.equal(answerFrame.unitCells, undefined);
        assert.deepEqual(removeFrame.candidateTransition, {
            row: target.row,
            col: target.col,
            beforeCandidates: [...beforeCandidates[target.row][target.col]],
            removedValue: expected.value,
            afterCandidates: [target.value],
        });
    } else {
        assert.equal(answerFrame.title, `Only one place remains for ${target.value}`);
        assert.equal(
            answerFrame.body,
            `Every gray ${target.value} is blocked, so ${target.value} belongs in the green cell.`,
        );
        assert.equal(removeFrame.candidateTransition, undefined);
        assert.ok(answerFrame.unitCells?.length === 9);
        assert.equal(answerFrame.unitStrokeTone, 'soft');
        assert.equal(answerFrame.eliminationStyle, 'candidate-slash');
        assert.equal(answerFrame.fillEliminatedCells, true);
        const resultGuide = guideForCells(answerFrame.unitCells);
        const beforePositions = cellsForGuideUnit(resultGuide).filter(cell => (
            grid[cell.row][cell.col] === 0
            && beforeCandidates[cell.row][cell.col].includes(target.value)
        ));
        const afterPositions = cellsForGuideUnit(resultGuide).filter(cell => (
            grid[cell.row][cell.col] === 0
            && afterCandidates[cell.row][cell.col].includes(target.value)
        ));
        assert.ok(beforePositions.length > 1);
        assert.deepEqual(afterPositions, [{ row: target.row, col: target.col }]);
    }

    assert.deepEqual(answerFrame.target, target);
    assert.equal(answerFrame.fillTargetCell, true);
    assert.deepEqual(answerFrame.spotlightCells, [{ row: target.row, col: target.col }]);
    const answerMarks = answerFrame.candidateMarks.filter(mark => mark.tone === 'answer');
    assert.deepEqual(answerMarks, [{ ...target, tone: 'answer' }]);
    const answerLockedMarks = answerFrame.candidateMarks.filter(mark => mark.tone === 'locked');
    const answerEliminations = answerFrame.candidateMarks.filter(mark => mark.tone === 'eliminated');
    const expectedAnswerEliminations = expected.resultKind === 'hidden'
        ? answerFrame.unitCells.filter(cell => (
            grid[cell.row][cell.col] === 0
            && (cell.row !== target.row || cell.col !== target.col)
        ))
        : [];
    assert.ok(isSameCoordinateSet(
        coordinateSet(answerEliminations),
        coordinateSet(expectedAnswerEliminations),
    ));
    if (expected.resultKind === 'hidden') {
        assert.deepEqual(answerLockedMarks, []);
        assert.equal(answerFrame.sourceCells, undefined);
        assert.equal(
            answerFrame.candidateMarks.length,
            answerEliminations.length + answerMarks.length,
        );
        const causalKeys = coordinateSet(expectedCausalEliminations);
        const preBlockedEliminations = expectedAnswerEliminations.filter(cell => (
            !causalKeys.has(coordinateKey(cell))
        ));
        const supportSourceCells = answerFrame.supportSourceCells ?? [];
        if (preBlockedEliminations.length > 0) assert.ok(supportSourceCells.length > 0);
        else assert.deepEqual(supportSourceCells, []);
        for (const source of supportSourceCells) {
            assert.equal(grid[source.row][source.col], target.value);
            assert.ok(preBlockedEliminations.some(cell => isPeer(source, cell)));
        }
        for (const mark of preBlockedEliminations) {
            assert.ok(supportSourceCells.some(source => isPeer(source, mark)));
        }
        for (const source of supportSourceCells) {
            const otherSources = supportSourceCells.filter(other => (
                coordinateKey(other) !== coordinateKey(source)
            ));
            assert.ok(preBlockedEliminations.some(mark => (
                isPeer(source, mark) && !otherSources.some(other => isPeer(other, mark))
            )), 'each supporting 5 must be necessary for at least one crossed candidate');
        }
    } else {
        assert.deepEqual(answerLockedMarks, []);
        assert.equal(answerFrame.sourceCells, undefined);
        assert.equal(answerFrame.supportSourceCells, undefined);
    }
    assert.equal(solution[target.row][target.col], target.value);
    assert.deepEqual(createHintPlan(board, solution), result);
    assert.deepEqual(board, beforeBoard);
    return result;
};

test('explains a last number using only the obvious column', () => {
    const grid = withBlanks(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
    );
    assertUnitCompletionPlan(
        grid,
        { row: 0, col: 0, value: 5 },
        { kind: 'column', index: 0 },
    );
});

test('explains a last number using only the obvious row', () => {
    const grid = withBlanks(
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
    );
    assertUnitCompletionPlan(
        grid,
        { row: 0, col: 0, value: 5 },
        { kind: 'row', index: 0 },
    );
});

test('explains a last number using only the obvious box', () => {
    const grid = withBlanks(
        { row: 0, col: 0 },
        { row: 0, col: 3 },
        { row: 3, col: 0 },
    );
    assertUnitCompletionPlan(
        grid,
        { row: 0, col: 0, value: 5 },
        { kind: 'box', index: 0 },
    );
});

test('uses the compact box when several units complete at once', () => {
    const grid = withBlanks({ row: 0, col: 0 });
    const first = assertUnitCompletionPlan(
        grid,
        { row: 0, col: 0, value: 5 },
        { kind: 'box', index: 0 },
    );
    assert.deepEqual(createHintPlan(makeBoard(grid), SOLUTION), first);
});

test('prioritizes a last-number move over an earlier generic naked single', () => {
    const grid = withBlanks(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 8, col: 8 },
    );
    assertUnitCompletionPlan(
        grid,
        { row: 8, col: 8, value: 9 },
        { kind: 'box', index: 8 },
    );
});

test('builds a deterministic naked-single theater plan', () => {
    const grid = withBlanks(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
    );
    const board = makeBoard(grid);

    const result = createHintPlan(board, SOLUTION);
    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'nakedSingle');
    assert.deepEqual(result.plan.target, { row: 0, col: 0, value: 5 });
    assert.equal(result.plan.frames.length, 3);
    assertPresentationContract(result.plan, 'naked single fixture');
    const [lookFrame, evidenceFrame, answerFrame] = result.plan.frames;
    assert.equal(lookFrame.title, 'Look at this cell');
    assert.equal(lookFrame.body, 'Which number can go here?');
    assert.equal(lookFrame.unitCells, undefined);
    assert.equal(lookFrame.sourceCells, undefined);
    assert.equal(lookFrame.candidateMarks, undefined);
    assert.equal(lookFrame.remainingDigit, undefined);
    assert.deepEqual(lookFrame.spotlightCells, [{ row: 0, col: 0 }]);
    assert.equal(evidenceFrame.title, 'Only 5 can fit');
    assert.equal(
        evidenceFrame.body,
        "Each other candidate is blocked by a placed number in this cell's row, column, or box.",
    );
    assert.equal(evidenceFrame.unitCells, undefined);
    assert.equal(evidenceFrame.contextCells, undefined);
    assertNakedCandidateBreakdown(evidenceFrame, result.plan.target, grid);
    assert.deepEqual(evidenceFrame.guideUnits, [
        { kind: 'row', index: 0 },
        { kind: 'column', index: 0 },
        { kind: 'box', index: 0 },
    ]);
    for (const guideUnit of evidenceFrame.guideUnits) {
        assert.ok(cellsForGuideUnit(guideUnit).some(cell => (
            coordinateKey(cell) === coordinateKey(result.plan.target)
        )));
    }
    const visibleDigits = new Set(
        evidenceFrame.guideUnits
            .flatMap(cellsForGuideUnit)
            .map(cell => board[cell.row][cell.col].value)
            .filter(value => value !== null)
    );
    assert.deepEqual(visibleDigits, new Set([1, 2, 3, 4, 6, 7, 8, 9]));
    assert.deepEqual(answerFrame.target, result.plan.target);
    assert.deepEqual(answerFrame.candidateMarks, [{ row: 0, col: 0, value: 5, tone: 'answer' }]);
    assert.equal(answerFrame.title, 'This cell must be 5');
    assert.equal(answerFrame.body, 'It is the only number that fits.');
    assert.equal(answerFrame.remainingDigit, undefined);
    assert.equal(answerFrame.unitCells, undefined);
    assert.equal(answerFrame.sourceCells, undefined);
    assert.equal(answerFrame.guideUnits, undefined);
    assert.deepEqual(createHintPlan(board, SOLUTION), result);
});

test('builds a deterministic hidden-single theater plan', () => {
    const board = makeBoard(HIDDEN_SINGLE_PUZZLE);
    const result = createHintPlan(board, HIDDEN_SINGLE_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'hiddenSingle');
    assert.deepEqual(result.plan.target, { row: 3, col: 8, value: 9 });
    assert.ok(
        legalCandidates(HIDDEN_SINGLE_PUZZLE, result.plan.target.row, result.plan.target.col).length > 1,
        'fixture must remain a hidden single, not a naked single',
    );
    assert.equal(result.plan.frames.length, 3);
    assertPresentationContract(result.plan, 'hidden single fixture');
    const [lookFrame, evidenceFrame, answerFrame] = result.plan.frames;
    assert.equal(lookFrame.title, 'Look at this 3 × 3 box');
    assert.equal(lookFrame.body, '9 is missing from this 3 × 3 box.');
    assert.equal(
        lookFrame.accessibleDetail,
        'The highlighted 3 × 3 box does not contain 9.',
    );
    assert.equal(lookFrame.unitCells.length, 9);
    assert.equal(evidenceFrame.unitCells, undefined);
    assert.deepEqual(evidenceFrame.contextCells, lookFrame.unitCells);
    assert.deepEqual(lookFrame.spotlightCells, []);
    assert.deepEqual(evidenceFrame.spotlightCells, [{ row: 3, col: 8 }]);
    assert.equal(evidenceFrame.title, 'Only one place for 9');
    assert.equal(evidenceFrame.body, 'The placed 9s rule out every other cell in this 3 × 3 box.');
    assert.equal(evidenceFrame.eliminationStyle, 'candidate-slash');
    assert.equal(
        evidenceFrame.accessibleDetail,
        'Existing 9s block row 4, column 8; row 5, column 8, leaving row 4, column 9 as the only place for 9 in this 3 × 3 box.',
    );
    assert.equal(evidenceFrame.remainingDigit, undefined);
    assert.ok(lookFrame.unitCells.some(cell => coordinateKey(cell) === coordinateKey(result.plan.target)));
    assert.equal(new Set(lookFrame.unitCells.map(coordinateKey)).size, 9);
    assert.equal(
        lookFrame.unitCells.some(cell => board[cell.row][cell.col].value === result.plan.target.value),
        false,
    );
    const eliminatedMarks = evidenceFrame.candidateMarks.filter(mark => mark.tone === 'eliminated');
    assert.equal(evidenceFrame.candidateMarks.some(mark => mark.tone === 'possible'), false);
    const otherBlankCells = lookFrame.unitCells.filter(cell => (
        board[cell.row][cell.col].value === null
        && coordinateKey(cell) !== coordinateKey(result.plan.target)
    ));
    assert.equal(eliminatedMarks.length, otherBlankCells.length);
    assert.deepEqual(
        new Set(eliminatedMarks.map(coordinateKey)),
        new Set(otherBlankCells.map(coordinateKey)),
    );
    assert.ok(evidenceFrame.sourceCells.length > 0);
    for (const source of evidenceFrame.sourceCells) {
        assert.equal(board[source.row][source.col].value, result.plan.target.value);
        assert.ok(
            eliminatedMarks.some(mark => isPeer(source, mark)),
            'every green source must explain at least one gray ×',
        );
    }
    for (const mark of eliminatedMarks) {
        assert.equal(mark.value, result.plan.target.value);
        assert.ok(
            evidenceFrame.sourceCells.some(source => isPeer(source, mark)),
            'every gray × must be explained by a green source number',
        );
    }
    assert.deepEqual(answerFrame.target, result.plan.target);
    assert.deepEqual(answerFrame.candidateMarks, [{ ...result.plan.target, tone: 'answer' }]);
    assert.equal(answerFrame.title, 'Only this cell remains');
    assert.equal(answerFrame.body, 'So 9 belongs here.');
    assert.equal(answerFrame.remainingDigit, undefined);
    assert.equal(answerFrame.unitCells, undefined);
    assert.equal(answerFrame.contextCells, undefined);
    assert.equal(answerFrame.sourceCells, undefined);
    assert.deepEqual(createHintPlan(board, HIDDEN_SINGLE_SOLUTION), result);
});

skipLegacyPlacementContract = true;

test('explains a pointing-row Locked Candidate that unlocks a naked single', () => {
    const result = assertLockedCandidatePlan(
        LOCKED_POINTING_ROW_PUZZLE,
        LOCKED_POINTING_ROW_SOLUTION,
        {
            value: 1,
            sourceUnit: { kind: 'box', index: 5 },
            intersectingUnit: { kind: 'row', index: 4 },
            lockedCells: [{ row: 4, col: 7 }, { row: 4, col: 8 }],
            eliminationCells: [
                { row: 4, col: 0 },
                { row: 4, col: 2 },
                { row: 4, col: 3 },
                { row: 4, col: 5 },
            ],
            resultKind: 'naked',
            target: { row: 4, col: 0, value: 9 },
        },
    );
    assert.equal(result.plan.frames[0].title, 'Only two places for 1');
    assert.equal(result.plan.frames[1].title, 'These 1s share this row');
    assert.equal(result.plan.frames[2].title, 'Only 9 remains');
});

test('explains a pointing-column Locked Candidate that unlocks a naked single', () => {
    const result = assertLockedCandidatePlan(
        LOCKED_POINTING_COLUMN_PUZZLE,
        LOCKED_POINTING_COLUMN_SOLUTION,
        {
            value: 4,
            sourceUnit: { kind: 'box', index: 5 },
            intersectingUnit: { kind: 'column', index: 7 },
            lockedCells: [{ row: 3, col: 7 }, { row: 4, col: 7 }],
            eliminationCells: [{ row: 6, col: 7 }, { row: 7, col: 7 }],
            resultKind: 'naked',
            target: { row: 7, col: 7, value: 2 },
        },
    );
    assert.equal(result.plan.frames[1].title, 'These 4s share this column');
});

test('skips unproductive patterns and explains a claiming-row Locked Candidate', () => {
    const result = assertLockedCandidatePlan(
        LOCKED_CLAIMING_ROW_PUZZLE,
        LOCKED_CLAIMING_ROW_SOLUTION,
        {
            value: 5,
            sourceUnit: { kind: 'row', index: 6 },
            intersectingUnit: { kind: 'box', index: 7 },
            lockedCells: [{ row: 6, col: 3 }, { row: 6, col: 5 }],
            eliminationCells: [
                { row: 7, col: 3 },
                { row: 8, col: 3 },
                { row: 8, col: 5 },
            ],
            resultKind: 'naked',
            target: { row: 7, col: 3, value: 9 },
        },
    );
    assert.equal(result.plan.frames[0].title, 'Only two places for 5');
    assert.equal(result.plan.frames[1].title, 'These 5s share this 3 × 3 box');
});

test('explains a claiming-column Locked Candidate', () => {
    const result = assertLockedCandidatePlan(
        LOCKED_CLAIMING_COLUMN_PUZZLE,
        LOCKED_CLAIMING_COLUMN_SOLUTION,
        {
            value: 5,
            sourceUnit: { kind: 'column', index: 0 },
            intersectingUnit: { kind: 'box', index: 0 },
            lockedCells: [{ row: 0, col: 0 }, { row: 2, col: 0 }],
            eliminationCells: [
                { row: 0, col: 2 },
                { row: 1, col: 1 },
                { row: 2, col: 1 },
            ],
            resultKind: 'naked',
            target: { row: 2, col: 1, value: 8 },
        },
    );
    assert.equal(result.plan.frames[0].title, 'Only two places for 5');
    assert.equal(result.plan.frames[1].title, 'These 5s share this 3 × 3 box');
});

test('shows when a Locked Candidate unlocks a hidden single', () => {
    const result = assertLockedCandidatePlan(
        LOCKED_HIDDEN_PUZZLE,
        LOCKED_HIDDEN_SOLUTION,
        {
            value: 5,
            sourceUnit: { kind: 'box', index: 4 },
            intersectingUnit: { kind: 'column', index: 3 },
            lockedCells: [{ row: 3, col: 3 }, { row: 5, col: 3 }],
            eliminationCells: [{ row: 6, col: 3 }],
            resultKind: 'hidden',
            target: { row: 6, col: 5, value: 5 },
        },
    );
    const [, removeFrame, answerFrame] = result.plan.frames;
    assert.deepEqual(removeFrame.candidateMarks, [
        { row: 3, col: 3, value: 5, tone: 'locked' },
        { row: 5, col: 3, value: 5, tone: 'locked' },
        { row: 6, col: 3, value: 5, tone: 'eliminated' },
    ]);
    assert.equal(answerFrame.title, 'Only one place remains for 5');
    assert.equal(answerFrame.body, 'Every gray 5 is blocked, so 5 belongs in the green cell.');
    assert.equal(answerFrame.sourceCells, undefined);
    assert.deepEqual(answerFrame.supportSourceCells, [
        { row: 2, col: 1 },
        { row: 7, col: 7 },
    ]);
    assert.deepEqual(answerFrame.candidateMarks, [
        { row: 6, col: 1, value: 5, tone: 'eliminated' },
        { row: 6, col: 3, value: 5, tone: 'eliminated' },
        { row: 6, col: 8, value: 5, tone: 'eliminated' },
        { row: 6, col: 5, value: 5, tone: 'answer' },
    ]);
});

test('explains a Naked Pair that immediately reveals one number', () => {
    const board = makeBoard(NAKED_PAIR_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, NAKED_PAIR_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'nakedPair');
    assert.equal(result.plan.techniqueLabel, 'Naked pair');
    assert.equal(result.plan.derivedResult, 'naked');
    assert.deepEqual(result.plan.target, { row: 5, col: 6, value: 7 });
    assertPresentationContract(result.plan, 'naked pair fixture');
    assert.deepEqual(legalCandidates(NAKED_PAIR_PUZZLE, 5, 1), [4, 8]);
    assert.deepEqual(legalCandidates(NAKED_PAIR_PUZZLE, 5, 7), [4, 8]);
    assert.deepEqual(legalCandidates(NAKED_PAIR_PUZZLE, 5, 6), [4, 7]);
    assert.deepEqual(
        new Set([NAKED_PAIR_SOLUTION[5][1], NAKED_PAIR_SOLUTION[5][7]]),
        new Set([4, 8]),
    );

    assert.deepEqual(result.plan.candidateEliminations, [
        {
            row: 5,
            col: 0,
            beforeCandidates: [3, 4, 5, 9],
            removedValues: [4],
            afterCandidates: [3, 5, 9],
        },
        {
            row: 5,
            col: 6,
            beforeCandidates: [4, 7],
            removedValues: [4],
            afterCandidates: [7],
        },
        {
            row: 5,
            col: 8,
            beforeCandidates: [3, 4, 7, 8, 9],
            removedValues: [4, 8],
            afterCandidates: [3, 7, 9],
        },
    ]);

    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
    assert.equal(findFrame.id, 'pair-find');
    assert.equal(findFrame.title, 'These cells share two choices');
    assert.equal(findFrame.body, 'They must contain 4 and 8, in either order.');
    assert.deepEqual(findFrame.spotlightCells, [{ row: 5, col: 1 }, { row: 5, col: 7 }]);
    assert.deepEqual(guideForCells(findFrame.unitCells), { kind: 'row', index: 5 });
    assert.deepEqual(findFrame.candidateNoteSets, [
        {
            row: 5,
            col: 1,
            marks: [{ value: 4, tone: 'locked' }, { value: 8, tone: 'locked' }],
        },
        {
            row: 5,
            col: 7,
            marks: [{ value: 4, tone: 'locked' }, { value: 8, tone: 'locked' }],
        },
    ]);

    assert.equal(removeFrame.id, 'pair-remove');
    assert.equal(removeFrame.title, 'The pair reserves 4 and 8');
    assert.equal(removeFrame.body, 'Cross out 4 in the cell with gray notes. Only 7 remains.');
    assert.deepEqual(removeFrame.guideUnits, [{ kind: 'row', index: 5 }]);
    assert.equal(removeFrame.guideStrokeTone, 'soft');
    assert.deepEqual(removeFrame.candidateNoteSets.at(-1), {
        row: 5,
        col: 6,
        marks: [{ value: 4, tone: 'removed' }, { value: 7, tone: 'remaining' }],
    });
    assert.equal(removeFrame.candidateTransition, undefined);

    assert.equal(answerFrame.id, 'pair-answer');
    assert.equal(answerFrame.title, 'Only 7 remains');
    assert.equal(answerFrame.body, '7 belongs in this cell.');
    assert.deepEqual(answerFrame.candidateMarks, [{ row: 5, col: 6, value: 7, tone: 'answer' }]);
    assert.deepEqual(answerFrame.target, result.plan.target);

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, NAKED_PAIR_SOLUTION), result);
    assert.doesNotThrow(() => createHintPlan(deepFreeze(deepClone(board)), deepFreeze(deepClone(NAKED_PAIR_SOLUTION))));
    assert.deepEqual(createHintPlan(board, NAKED_PAIR_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('explains a Naked Pair that creates a new only-place number', () => {
    const board = makeBoard(NAKED_PAIR_HIDDEN_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, NAKED_PAIR_HIDDEN_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'nakedPair');
    assert.equal(result.plan.techniqueLabel, 'Naked pair');
    assert.equal(result.plan.derivedResult, 'hidden');
    assert.deepEqual(result.plan.target, { row: 0, col: 5, value: 6 });
    assertPresentationContract(result.plan, 'naked pair hidden-result fixture');

    assert.deepEqual(legalCandidates(NAKED_PAIR_HIDDEN_PUZZLE, 2, 7), [3, 6]);
    assert.deepEqual(legalCandidates(NAKED_PAIR_HIDDEN_PUZZLE, 6, 7), [3, 6]);
    assert.deepEqual(legalCandidates(NAKED_PAIR_HIDDEN_PUZZLE, 0, 7), [4, 6, 8]);
    assert.deepEqual(legalCandidates(NAKED_PAIR_HIDDEN_PUZZLE, 0, 5), [2, 4, 6]);
    assert.deepEqual(result.plan.candidateEliminations, [
        {
            row: 0,
            col: 7,
            beforeCandidates: [4, 6, 8],
            removedValues: [6],
            afterCandidates: [4, 8],
        },
    ]);

    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
    assert.deepEqual(guideForCells(findFrame.unitCells), { kind: 'column', index: 7 });
    assert.deepEqual(findFrame.spotlightCells, [{ row: 2, col: 7 }, { row: 6, col: 7 }]);
    assert.deepEqual(findFrame.candidateNoteSets, [
        {
            row: 2,
            col: 7,
            marks: [{ value: 3, tone: 'locked' }, { value: 6, tone: 'locked' }],
        },
        {
            row: 6,
            col: 7,
            marks: [{ value: 3, tone: 'locked' }, { value: 6, tone: 'locked' }],
        },
    ]);

    assert.deepEqual(guideForCells(removeFrame.unitCells), { kind: 'row', index: 0 });
    assert.equal(removeFrame.title, 'Now look at this row');
    assert.equal(removeFrame.body, 'The pair rules out 6 in the shaded cell.');
    assert.deepEqual(removeFrame.candidateNoteSets, findFrame.candidateNoteSets);
    assert.deepEqual(removeFrame.candidateMarks, [
        { row: 0, col: 7, value: 6, tone: 'eliminated' },
    ]);
    assert.equal(removeFrame.eliminationStyle, 'candidate-slash');
    assert.equal(removeFrame.fillEliminatedCells, true);

    assert.deepEqual(guideForCells(answerFrame.unitCells), { kind: 'row', index: 0 });
    assert.equal(answerFrame.title, 'Only one place remains for 6');
    assert.equal(answerFrame.body, 'Every gray 6 is blocked, so 6 belongs in the green cell.');
    assert.deepEqual(answerFrame.target, result.plan.target);
    assert.deepEqual(
        answerFrame.candidateMarks.filter(mark => mark.tone === 'answer'),
        [{ row: 0, col: 5, value: 6, tone: 'answer' }],
    );
    assert.equal(
        answerFrame.candidateMarks.some(mark => (
            mark.row === result.plan.target.row
            && mark.col === result.plan.target.col
            && mark.tone === 'eliminated'
        )),
        false,
    );
    assert.deepEqual(answerFrame.supportSourceCells, [{ row: 1, col: 0 }, { row: 3, col: 6 }]);

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, NAKED_PAIR_HIDDEN_SOLUTION), result);
    assert.doesNotThrow(() => createHintPlan(
        deepFreeze(deepClone(board)),
        deepFreeze(deepClone(NAKED_PAIR_HIDDEN_SOLUTION)),
    ));
    assert.deepEqual(createHintPlan(board, NAKED_PAIR_HIDDEN_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('explains a productive Hidden Pair that creates a new only-place number', () => {
    const board = makeBoard(HIDDEN_PAIR_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, HIDDEN_PAIR_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'hiddenPair');
    assert.equal(result.plan.techniqueLabel, 'Hidden pair');
    assert.equal(result.plan.derivedResult, 'hidden');
    assert.deepEqual(result.plan.target, { row: 3, col: 5, value: 2 });
    assertPresentationContract(result.plan, 'hidden pair fixture');

    const candidates = candidateGrid(HIDDEN_PAIR_PUZZLE);
    assert.deepEqual([...simulatedPlacements(HIDDEN_PAIR_PUZZLE, candidates)], []);
    assert.deepEqual(candidates[5][0], [4, 5]);
    assert.deepEqual(candidates[5][5], [2, 4, 5]);
    for (const pairValue of [4, 5]) {
        assert.deepEqual(
            cellsForGuideUnit({ kind: 'row', index: 5 }).filter(cell => (
                candidates[cell.row][cell.col].includes(pairValue)
            )),
            [{ row: 5, col: 0 }, { row: 5, col: 5 }],
        );
    }
    assert.deepEqual(result.plan.candidateEliminations, [{
        row: 5,
        col: 5,
        beforeCandidates: [2, 4, 5],
        removedValues: [2],
        afterCandidates: [4, 5],
    }]);
    assert.equal(HIDDEN_PAIR_SOLUTION[5][5], 5);

    const afterCandidates = candidates.map(row => row.map(cell => [...cell]));
    afterCandidates[5][5] = [4, 5];
    assert.ok(simulatedPlacements(HIDDEN_PAIR_PUZZLE, afterCandidates).has('3:5:2'));

    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
    assert.deepEqual(findFrame.spotlightCells, [{ row: 5, col: 0 }, { row: 5, col: 5 }]);
    assert.deepEqual(findFrame.candidateNoteSets, [
        {
            row: 5,
            col: 0,
            marks: [{ value: 4, tone: 'locked' }, { value: 5, tone: 'locked' }],
        },
        {
            row: 5,
            col: 5,
            marks: [
                { value: 2, tone: 'possible' },
                { value: 4, tone: 'locked' },
                { value: 5, tone: 'locked' },
            ],
        },
    ]);
    assert.deepEqual(removeFrame.candidateNoteSets[1], {
        row: 5,
        col: 5,
        marks: [
            { value: 2, tone: 'removed' },
            { value: 4, tone: 'remaining' },
            { value: 5, tone: 'remaining' },
        ],
    });
    assert.deepEqual(guideForCells(removeFrame.unitCells), { kind: 'box', index: 4 });
    assert.deepEqual(answerFrame.target, result.plan.target);
    assert.equal(answerFrame.candidateNoteSets, undefined);

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, HIDDEN_PAIR_SOLUTION), result);
    assert.doesNotThrow(() => createHintPlan(
        deepFreeze(deepClone(board)),
        deepFreeze(deepClone(HIDDEN_PAIR_SOLUTION)),
    ));
    assert.deepEqual(createHintPlan(board, HIDDEN_PAIR_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('uses a Hidden Pair inside a dependent multi-step Hint', () => {
    const board = makeBoard(HIDDEN_PAIR_CHAIN_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, HIDDEN_PAIR_CHAIN_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'multiStep');
    assert.equal(result.plan.derivedResult, 'hidden');
    assert.deepEqual(result.plan.target, { row: 3, col: 4, value: 9 });
    assert.deepEqual(
        result.plan.deductions.map(deduction => deduction.technique),
        ['nakedPair', 'hiddenPair'],
    );
    assertPresentationContract(result.plan, 'hidden pair chain fixture');

    assert.deepEqual(result.plan.deductions[0].candidateEliminations, [
        {
            row: 3,
            col: 7,
            beforeCandidates: [1, 4, 9],
            removedValues: [9],
            afterCandidates: [1, 4],
        },
        {
            row: 4,
            col: 8,
            beforeCandidates: [1, 3, 6],
            removedValues: [6],
            afterCandidates: [1, 3],
        },
    ]);
    assert.deepEqual(result.plan.deductions[1].candidateEliminations, [
        {
        row: 1,
        col: 2,
        beforeCandidates: [1, 5, 6, 9],
        removedValues: [6, 9],
        afterCandidates: [1, 5],
        },
        {
            row: 3,
            col: 2,
            beforeCandidates: [1, 5, 9],
            removedValues: [9],
            afterCandidates: [1, 5],
        },
    ]);

    const candidates = candidateGrid(HIDDEN_PAIR_CHAIN_PUZZLE);
    assert.deepEqual([...simulatedPlacements(HIDDEN_PAIR_CHAIN_PUZZLE, candidates)], []);
    const afterNakedPair = candidates.map(row => row.map(cell => [...cell]));
    afterNakedPair[3][7] = [1, 4];
    afterNakedPair[4][8] = [1, 3];
    assert.deepEqual([...simulatedPlacements(HIDDEN_PAIR_CHAIN_PUZZLE, afterNakedPair)], []);

    const afterHiddenPair = afterNakedPair.map(row => row.map(cell => [...cell]));
    afterHiddenPair[1][2] = [1, 5];
    afterHiddenPair[3][2] = [1, 5];
    assert.ok(simulatedPlacements(HIDDEN_PAIR_CHAIN_PUZZLE, afterHiddenPair).has('3:4:9'));
    assert.deepEqual(result.plan.frames.map(frame => frame.id), [
        'chain-1-pair-find',
        'chain-1-pair-remove',
        'chain-2-hidden-pair-find',
        'chain-2-hidden-pair-remove',
        'chain-answer',
    ]);
    assert.deepEqual(result.plan.frames.map(frame => frame.techniqueLabel), [
        'Naked pair',
        'Naked pair',
        'Hidden pair',
        'Hidden pair',
        'Hidden single',
    ]);

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, HIDDEN_PAIR_CHAIN_SOLUTION), result);
    assert.deepEqual(createHintPlan(board, HIDDEN_PAIR_CHAIN_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('explains a productive Naked Triple that immediately reveals one number', () => {
    const board = makeBoard(NAKED_TRIPLE_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, NAKED_TRIPLE_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'nakedTriple');
    assert.equal(result.plan.techniqueLabel, 'Naked triple');
    assert.equal(result.plan.derivedResult, 'naked');
    assert.deepEqual(result.plan.target, { row: 4, col: 1, value: 7 });
    assertPresentationContract(result.plan, 'direct naked triple fixture');

    const candidates = candidateGrid(NAKED_TRIPLE_PUZZLE);
    assert.deepEqual([...simulatedPlacements(NAKED_TRIPLE_PUZZLE, candidates)], []);
    assert.deepEqual(candidates[4][0], [2, 3, 4]);
    assert.deepEqual(candidates[4][2], [2, 4]);
    assert.deepEqual(candidates[4][4], [2, 3, 4]);
    assert.deepEqual(result.plan.candidateEliminations, [
        {
            row: 4,
            col: 1,
            beforeCandidates: [3, 4, 7],
            removedValues: [3, 4],
            afterCandidates: [7],
        },
        {
            row: 4,
            col: 3,
            beforeCandidates: [1, 2, 4, 6, 8],
            removedValues: [2, 4],
            afterCandidates: [1, 6, 8],
        },
    ]);
    assert.equal(NAKED_TRIPLE_SOLUTION[4][1], 7);
    assert.equal(NAKED_TRIPLE_SOLUTION[4][3], 1);

    const afterCandidates = candidates.map(row => row.map(cell => [...cell]));
    for (const elimination of result.plan.candidateEliminations) {
        afterCandidates[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.ok(simulatedPlacements(NAKED_TRIPLE_PUZZLE, afterCandidates).has('4:1:7'));

    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
    assert.deepEqual(findFrame.spotlightCells, [
        { row: 4, col: 0 },
        { row: 4, col: 2 },
        { row: 4, col: 4 },
    ]);
    assert.deepEqual(findFrame.candidateNoteSets, [
        {
            row: 4,
            col: 0,
            marks: [
                { value: 2, tone: 'locked' },
                { value: 3, tone: 'locked' },
                { value: 4, tone: 'locked' },
            ],
        },
        {
            row: 4,
            col: 2,
            marks: [
                { value: 2, tone: 'locked' },
                { value: 4, tone: 'locked' },
            ],
        },
        {
            row: 4,
            col: 4,
            marks: [
                { value: 2, tone: 'locked' },
                { value: 3, tone: 'locked' },
                { value: 4, tone: 'locked' },
            ],
        },
    ]);
    assert.deepEqual(removeFrame.candidateNoteSets.at(-1), {
        row: 4,
        col: 1,
        marks: [
            { value: 3, tone: 'removed' },
            { value: 4, tone: 'removed' },
            { value: 7, tone: 'remaining' },
        ],
    });
    assert.deepEqual(answerFrame.candidateMarks, [
        { row: 4, col: 1, value: 7, tone: 'answer' },
    ]);

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, NAKED_TRIPLE_SOLUTION), result);
    assert.doesNotThrow(() => createHintPlan(
        deepFreeze(deepClone(board)),
        deepFreeze(deepClone(NAKED_TRIPLE_SOLUTION)),
    ));
    assert.deepEqual(createHintPlan(board, NAKED_TRIPLE_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('explains a Naked Triple that creates a new only-place number', () => {
    const board = makeBoard(NAKED_TRIPLE_HIDDEN_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, NAKED_TRIPLE_HIDDEN_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'nakedTriple');
    assert.equal(result.plan.derivedResult, 'hidden');
    assert.deepEqual(result.plan.target, { row: 0, col: 0, value: 9 });
    assertPresentationContract(result.plan, 'hidden-result naked triple fixture');

    const candidates = candidateGrid(NAKED_TRIPLE_HIDDEN_PUZZLE);
    assert.deepEqual([...simulatedPlacements(NAKED_TRIPLE_HIDDEN_PUZZLE, candidates)], []);
    assert.deepEqual(candidates[4][3], [3, 9]);
    assert.deepEqual(candidates[4][4], [4, 9]);
    assert.deepEqual(candidates[4][5], [3, 4]);
    assert.deepEqual(result.plan.candidateEliminations, [
        {
            row: 4,
            col: 0,
            beforeCandidates: [6, 8, 9],
            removedValues: [9],
            afterCandidates: [6, 8],
        },
        {
            row: 4,
            col: 2,
            beforeCandidates: [5, 6, 8, 9],
            removedValues: [9],
            afterCandidates: [5, 6, 8],
        },
        {
            row: 4,
            col: 8,
            beforeCandidates: [5, 6, 8, 9],
            removedValues: [9],
            afterCandidates: [5, 6, 8],
        },
    ]);

    const columnBefore = cellsForGuideUnit({ kind: 'column', index: 0 }).filter(cell => (
        NAKED_TRIPLE_HIDDEN_PUZZLE[cell.row][cell.col] === 0
        && candidates[cell.row][cell.col].includes(9)
    ));
    assert.deepEqual(columnBefore, [
        { row: 0, col: 0 },
        { row: 4, col: 0 },
    ]);
    const afterCandidates = candidates.map(row => row.map(cell => [...cell]));
    for (const elimination of result.plan.candidateEliminations) {
        afterCandidates[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.ok(simulatedPlacements(NAKED_TRIPLE_HIDDEN_PUZZLE, afterCandidates).has('0:0:9'));

    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
    assert.deepEqual(findFrame.candidateNoteSets, [
        {
            row: 4,
            col: 3,
            marks: [{ value: 3, tone: 'locked' }, { value: 9, tone: 'locked' }],
        },
        {
            row: 4,
            col: 4,
            marks: [{ value: 4, tone: 'locked' }, { value: 9, tone: 'locked' }],
        },
        {
            row: 4,
            col: 5,
            marks: [{ value: 3, tone: 'locked' }, { value: 4, tone: 'locked' }],
        },
    ]);
    assert.deepEqual(guideForCells(removeFrame.unitCells), { kind: 'column', index: 0 });
    assert.deepEqual(removeFrame.spotlightCells, []);
    assert.deepEqual(removeFrame.candidateMarks, [
        { row: 4, col: 0, value: 9, tone: 'eliminated' },
    ]);
    assert.deepEqual(answerFrame.target, result.plan.target);
    assert.deepEqual(
        answerFrame.candidateMarks.filter(mark => mark.tone === 'answer'),
        [{ row: 0, col: 0, value: 9, tone: 'answer' }],
    );

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, NAKED_TRIPLE_HIDDEN_SOLUTION), result);
    assert.doesNotThrow(() => createHintPlan(
        deepFreeze(deepClone(board)),
        deepFreeze(deepClone(NAKED_TRIPLE_HIDDEN_SOLUTION)),
    ));
    assert.deepEqual(createHintPlan(board, NAKED_TRIPLE_HIDDEN_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('uses a Naked Triple inside a dependent multi-step Hint', () => {
    const board = makeBoard(NAKED_TRIPLE_CHAIN_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, NAKED_TRIPLE_CHAIN_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'multiStep');
    assert.equal(result.plan.derivedResult, 'naked');
    assert.deepEqual(result.plan.target, { row: 4, col: 5, value: 2 });
    assert.deepEqual(
        result.plan.deductions.map(deduction => deduction.technique),
        ['nakedTriple', 'nakedPair'],
    );
    assertPresentationContract(result.plan, 'naked triple chain fixture');

    assert.deepEqual(result.plan.deductions[0].candidateEliminations, [
        {
            row: 4,
            col: 2,
            beforeCandidates: [1, 2, 3, 5, 9],
            removedValues: [2, 5, 9],
            afterCandidates: [1, 3],
        },
        {
            row: 5,
            col: 2,
            beforeCandidates: [1, 2, 3, 4, 5, 8],
            removedValues: [2, 5],
            afterCandidates: [1, 3, 4, 8],
        },
        {
            row: 6,
            col: 2,
            beforeCandidates: [1, 2, 3, 4, 8],
            removedValues: [2],
            afterCandidates: [1, 3, 4, 8],
        },
        {
            row: 7,
            col: 2,
            beforeCandidates: [1, 2, 4, 5, 8, 9],
            removedValues: [2, 5, 9],
            afterCandidates: [1, 4, 8],
        },
    ]);
    assert.deepEqual(result.plan.deductions[1].candidateEliminations, [
        {
            row: 4,
            col: 0,
            beforeCandidates: [2, 3, 5, 9],
            removedValues: [3],
            afterCandidates: [2, 5, 9],
        },
        {
            row: 4,
            col: 5,
            beforeCandidates: [2, 3],
            removedValues: [3],
            afterCandidates: [2],
        },
    ]);

    const candidates = candidateGrid(NAKED_TRIPLE_CHAIN_PUZZLE);
    assert.deepEqual([...simulatedPlacements(NAKED_TRIPLE_CHAIN_PUZZLE, candidates)], []);
    const afterTriple = candidates.map(row => row.map(cell => [...cell]));
    for (const elimination of result.plan.deductions[0].candidateEliminations) {
        afterTriple[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.deepEqual([...simulatedPlacements(NAKED_TRIPLE_CHAIN_PUZZLE, afterTriple)], []);
    const afterPair = afterTriple.map(row => row.map(cell => [...cell]));
    for (const elimination of result.plan.deductions[1].candidateEliminations) {
        afterPair[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.ok(simulatedPlacements(NAKED_TRIPLE_CHAIN_PUZZLE, afterPair).has('4:5:2'));
    assert.deepEqual(result.plan.frames.map(frame => frame.id), [
        'chain-1-triple-find',
        'chain-1-triple-remove',
        'chain-2-pair-find',
        'chain-2-pair-remove',
        'chain-answer',
    ]);
    assert.deepEqual(result.plan.frames.map(frame => frame.techniqueLabel), [
        'Naked triple',
        'Naked triple',
        'Naked pair',
        'Naked pair',
        'Naked single',
    ]);

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, NAKED_TRIPLE_CHAIN_SOLUTION), result);
    assert.deepEqual(createHintPlan(board, NAKED_TRIPLE_CHAIN_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('explains productive classic X-Wings in both orientations', () => {
    const cases = [
        {
            label: 'column-oriented',
            grid: X_WING_PUZZLE,
            solution: X_WING_SOLUTION,
            baseKind: 'column',
            coverKind: 'row',
            target: { row: 0, col: 3, value: 6 },
        },
        {
            label: 'row-oriented',
            grid: transposeGrid(X_WING_PUZZLE),
            solution: transposeGrid(X_WING_SOLUTION),
            baseKind: 'row',
            coverKind: 'column',
            target: { row: 3, col: 0, value: 6 },
        },
    ];

    for (const fixture of cases) {
        const board = makeBoard(fixture.grid);
        const before = deepClone(board);
        const result = createHintPlan(board, fixture.solution);

        assert.equal(result.status, 'ready', fixture.label);
        assert.equal(result.plan.technique, 'xWing', fixture.label);
        assert.equal(result.plan.techniqueLabel, 'X-Wing', fixture.label);
        assert.equal(result.plan.derivedResult, 'naked', fixture.label);
        assert.deepEqual(result.plan.target, fixture.target, fixture.label);
        assert.deepEqual(
            result.plan.frames.map(frame => frame.id),
            ['x-wing-find', 'x-wing-remove', 'x-wing-answer'],
            fixture.label,
        );
        assertPresentationContract(result.plan, `${fixture.label} X-Wing fixture`);

        const candidates = candidateGrid(fixture.grid);
        assert.deepEqual([...simulatedPlacements(fixture.grid, candidates)], [], fixture.label);
        const [findFrame, removeFrame, answerFrame] = result.plan.frames;
        const lockedMarks = findFrame.candidateMarks.filter(mark => mark.tone === 'locked');
        const eliminatedMarks = removeFrame.candidateMarks.filter(mark => (
            mark.tone === 'eliminated'
        ));
        const xWingValue = lockedMarks[0].value;
        assert.equal(xWingValue, 7, fixture.label);
        assert.equal(lockedMarks.length, 4, fixture.label);
        assert.equal(new Set(lockedMarks.map(coordinateKey)).size, 4, fixture.label);
        assert.deepEqual(findFrame.guideUnits.map(unit => unit.kind), [
            fixture.baseKind,
            fixture.baseKind,
        ], fixture.label);
        assert.deepEqual(removeFrame.guideUnits.map(unit => unit.kind), [
            fixture.coverKind,
            fixture.coverKind,
        ], fixture.label);

        for (const baseUnit of findFrame.guideUnits) {
            const actualPositions = cellsForGuideUnit(baseUnit).filter(cell => (
                fixture.grid[cell.row][cell.col] === 0
                && candidates[cell.row][cell.col].includes(xWingValue)
            ));
            const markedPositions = lockedMarks.filter(mark => (
                baseUnit.kind === 'row'
                    ? mark.row === baseUnit.index
                    : mark.col === baseUnit.index
            ));
            assert.equal(actualPositions.length, 2, fixture.label);
            assert.ok(isSameCoordinateSet(
                coordinateSet(actualPositions),
                coordinateSet(markedPositions),
            ), fixture.label);
        }

        const baseKeys = new Set(findFrame.guideUnits.flatMap(unit => (
            cellsForGuideUnit(unit).map(coordinateKey)
        )));
        const coverKeys = new Set(removeFrame.guideUnits.flatMap(unit => (
            cellsForGuideUnit(unit).map(coordinateKey)
        )));
        assert.ok(isSameCoordinateSet(
            coordinateSet(eliminatedMarks),
            coordinateSet(result.plan.candidateEliminations),
        ), fixture.label);
        for (const elimination of result.plan.candidateEliminations) {
            assert.equal(baseKeys.has(coordinateKey(elimination)), false, fixture.label);
            assert.equal(coverKeys.has(coordinateKey(elimination)), true, fixture.label);
            assert.deepEqual(elimination.removedValues, [xWingValue], fixture.label);
            assert.ok(elimination.beforeCandidates.includes(xWingValue), fixture.label);
            assert.deepEqual(
                elimination.afterCandidates,
                elimination.beforeCandidates.filter(value => value !== xWingValue),
                fixture.label,
            );
            assert.notEqual(
                fixture.solution[elimination.row][elimination.col],
                xWingValue,
                fixture.label,
            );
        }

        const afterCandidates = candidates.map(row => row.map(cell => [...cell]));
        for (const elimination of result.plan.candidateEliminations) {
            afterCandidates[elimination.row][elimination.col] = [
                ...elimination.afterCandidates,
            ];
        }
        assert.ok(
            simulatedPlacements(fixture.grid, afterCandidates).has(
                `${fixture.target.row}:${fixture.target.col}:${fixture.target.value}`,
            ),
            fixture.label,
        );
        assert.deepEqual(removeFrame.candidateTransition, {
            row: fixture.target.row,
            col: fixture.target.col,
            beforeCandidates: [6, 7],
            removedValue: 7,
            afterCandidates: [6],
        }, fixture.label);
        assert.deepEqual(answerFrame.candidateMarks, [
            { ...fixture.target, tone: 'answer' },
        ], fixture.label);

        const notedBoard = deepClone(board);
        notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
        assert.deepEqual(createHintPlan(notedBoard, fixture.solution), result, fixture.label);
        assert.doesNotThrow(() => createHintPlan(
            deepFreeze(deepClone(board)),
            deepFreeze(deepClone(fixture.solution)),
        ), fixture.label);
        assert.deepEqual(createHintPlan(board, fixture.solution), result, fixture.label);
        assert.deepEqual(board, before, fixture.label);
    }

    assert.deepEqual(createHintPlan(makeBoard(X_WING_PUZZLE), X_WING_SOLUTION).plan.candidateEliminations, [
        {
            row: 0,
            col: 3,
            beforeCandidates: [6, 7],
            removedValues: [7],
            afterCandidates: [6],
        },
        {
            row: 0,
            col: 5,
            beforeCandidates: [1, 6, 7, 9],
            removedValues: [7],
            afterCandidates: [1, 6, 9],
        },
        {
            row: 8,
            col: 0,
            beforeCandidates: [1, 6, 7],
            removedValues: [7],
            afterCandidates: [1, 6],
        },
        {
            row: 8,
            col: 8,
            beforeCandidates: [6, 7, 9],
            removedValues: [7],
            afterCandidates: [6, 9],
        },
    ]);
});

test('keeps the hidden-result and chained X-Wing previews exact and mutation-free', () => {
    const hiddenPreview = createDevHintPreview('x-wing-hidden');
    const hiddenPuzzle = getDevHintPreviewPuzzle('x-wing-hidden');
    const hiddenBoard = cloneHintBoard(hiddenPreview.board);
    const hiddenBoardBefore = deepClone(hiddenBoard);
    const hiddenResult = createHintPlan(hiddenBoard, X_WING_HIDDEN_SOLUTION);

    assert.deepEqual(hiddenPuzzle, { difficulty: Difficulty.Impossible, levelId: 130 });
    assert.equal(
        scopeDevHintPreview('x-wing-hidden', Difficulty.Impossible, 130),
        'x-wing-hidden',
    );
    assert.equal(scopeDevHintPreview('x-wing-hidden', Difficulty.Impossible, 131), undefined);
    assert.equal(scopeDevHintPreview('x-wing-hidden', Difficulty.Hard, 130), undefined);
    assert.equal(hiddenResult.status, 'ready');
    assert.equal(hiddenResult.plan.technique, 'xWing');
    assert.equal(hiddenResult.plan.derivedResult, 'hidden');
    assert.deepEqual(hiddenResult.plan.target, { row: 3, col: 8, value: 2 });
    assert.deepEqual(
        hiddenResult.plan.frames.map(frame => frame.id),
        ['x-wing-find', 'x-wing-remove', 'x-wing-answer'],
    );
    assert.deepEqual(hiddenResult.plan.candidateEliminations, [
        {
            row: 4,
            col: 4,
            beforeCandidates: [2, 6, 7],
            removedValues: [2],
            afterCandidates: [6, 7],
        },
        {
            row: 4,
            col: 8,
            beforeCandidates: [2, 7, 9],
            removedValues: [2],
            afterCandidates: [7, 9],
        },
        {
            row: 6,
            col: 3,
            beforeCandidates: [2, 3, 4, 6, 7, 9],
            removedValues: [2],
            afterCandidates: [3, 4, 6, 7, 9],
        },
        {
            row: 6,
            col: 4,
            beforeCandidates: [2, 3, 6, 7, 8, 9],
            removedValues: [2],
            afterCandidates: [3, 6, 7, 8, 9],
        },
    ]);
    assertPresentationContract(hiddenResult.plan, 'hidden-result X-Wing preview');
    for (const elimination of hiddenResult.plan.candidateEliminations) {
        assert.equal(
            elimination.removedValues.includes(
                X_WING_HIDDEN_SOLUTION[elimination.row][elimination.col],
            ),
            false,
        );
    }
    assert.equal(X_WING_HIDDEN_SOLUTION[3][8], 2);
    assert.deepEqual(hiddenBoard, hiddenBoardBefore);

    const hiddenNotedBoard = deepClone(hiddenBoard);
    hiddenNotedBoard.forEach(row => row.forEach(cell => { cell.notes = [8, 2, 5, 1]; }));
    const hiddenNotedBefore = deepClone(hiddenNotedBoard);
    assert.deepEqual(
        createHintPlan(hiddenNotedBoard, X_WING_HIDDEN_SOLUTION),
        hiddenResult,
    );
    assert.deepEqual(hiddenNotedBoard, hiddenNotedBefore);
    assert.deepEqual(createDevHintPreview('x-wing-hidden'), hiddenPreview);

    const chainPreview = createDevHintPreview('x-wing-chain');
    const chainPuzzle = getDevHintPreviewPuzzle('x-wing-chain');
    const chainBoard = cloneHintBoard(chainPreview.board);
    const chainBoardBefore = deepClone(chainBoard);
    const chainResult = createHintPlan(chainBoard, X_WING_CHAIN_SOLUTION);

    assert.deepEqual(chainPuzzle, { difficulty: Difficulty.Impossible, levelId: 65 });
    assert.equal(
        scopeDevHintPreview('x-wing-chain', Difficulty.Impossible, 65),
        'x-wing-chain',
    );
    assert.equal(scopeDevHintPreview('x-wing-chain', Difficulty.Impossible, 66), undefined);
    assert.equal(scopeDevHintPreview('x-wing-chain', Difficulty.Hard, 65), undefined);
    assert.equal(chainResult.status, 'ready');
    assert.equal(chainResult.plan.technique, 'multiStep');
    assert.equal(chainResult.plan.derivedResult, 'naked');
    assert.deepEqual(chainResult.plan.target, { row: 5, col: 2, value: 9 });
    assert.deepEqual(
        chainResult.plan.deductions.map(deduction => deduction.technique),
        ['hiddenPair', 'xWing'],
    );
    assert.deepEqual(chainResult.plan.frames.map(frame => frame.id), [
        'chain-1-hidden-pair-find',
        'chain-1-hidden-pair-remove',
        'chain-2-x-wing-find',
        'chain-2-x-wing-remove',
        'chain-answer',
    ]);
    assert.deepEqual(chainResult.plan.deductions[0].candidateEliminations, [
        {
            row: 8,
            col: 0,
            beforeCandidates: [1, 2, 8, 9],
            removedValues: [1, 8],
            afterCandidates: [2, 9],
        },
    ]);
    assert.deepEqual(chainResult.plan.deductions[1].candidateEliminations, [
        {
            row: 5,
            col: 2,
            beforeCandidates: [8, 9],
            removedValues: [8],
            afterCandidates: [9],
        },
        {
            row: 7,
            col: 1,
            beforeCandidates: [4, 5, 8],
            removedValues: [8],
            afterCandidates: [4, 5],
        },
        {
            row: 7,
            col: 2,
            beforeCandidates: [4, 5, 8, 9],
            removedValues: [8],
            afterCandidates: [4, 5, 9],
        },
    ]);
    assertPresentationContract(chainResult.plan, 'chained X-Wing preview');

    const initialCandidates = candidateGrid(X_WING_CHAIN_PUZZLE);
    assert.deepEqual([...simulatedPlacements(X_WING_CHAIN_PUZZLE, initialCandidates)], []);
    const afterHiddenPair = initialCandidates.map(row => row.map(cell => [...cell]));
    for (const elimination of chainResult.plan.deductions[0].candidateEliminations) {
        afterHiddenPair[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.deepEqual([...simulatedPlacements(X_WING_CHAIN_PUZZLE, afterHiddenPair)], []);
    const afterXWing = afterHiddenPair.map(row => row.map(cell => [...cell]));
    for (const elimination of chainResult.plan.deductions[1].candidateEliminations) {
        afterXWing[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.ok(simulatedPlacements(X_WING_CHAIN_PUZZLE, afterXWing).has('5:2:9'));
    for (const deduction of chainResult.plan.deductions) {
        for (const elimination of deduction.candidateEliminations) {
            assert.equal(
                elimination.removedValues.includes(
                    X_WING_CHAIN_SOLUTION[elimination.row][elimination.col],
                ),
                false,
            );
        }
    }
    assert.equal(X_WING_CHAIN_SOLUTION[5][2], 9);
    assert.deepEqual(chainBoard, chainBoardBefore);

    const chainNotedBoard = deepClone(chainBoard);
    chainNotedBoard.forEach(row => row.forEach(cell => { cell.notes = [8, 2, 5, 1]; }));
    const chainNotedBefore = deepClone(chainNotedBoard);
    assert.deepEqual(
        createHintPlan(chainNotedBoard, X_WING_CHAIN_SOLUTION),
        chainResult,
    );
    assert.deepEqual(chainNotedBoard, chainNotedBefore);
    assert.deepEqual(createDevHintPreview('x-wing-chain'), chainPreview);
});

test('keeps productive direct and chained XY-Wing previews exact and mutation-free', () => {
    const directCases = [
        {
            preview: 'xy-wing',
            puzzle: XY_WING_PUZZLE,
            solution: XY_WING_SOLUTION,
            levelId: 84,
            resultKind: 'naked',
            target: { row: 2, col: 8, value: 7 },
            pivot: { row: 3, col: 7, values: [8, 9] },
            firstWing: { row: 2, col: 7, values: [2, 8] },
            secondWing: { row: 5, col: 8, values: [2, 9] },
            firstGuide: { kind: 'column', index: 7 },
            secondGuide: { kind: 'box', index: 5 },
            removalGuides: [{ kind: 'box', index: 2 }, { kind: 'column', index: 8 }],
            elimination: {
                row: 2,
                col: 8,
                beforeCandidates: [2, 7],
                removedValues: [2],
                afterCandidates: [7],
            },
        },
        {
            preview: 'xy-wing-hidden',
            puzzle: XY_WING_HIDDEN_PUZZLE,
            solution: XY_WING_HIDDEN_SOLUTION,
            levelId: 248,
            resultKind: 'hidden',
            target: { row: 5, col: 6, value: 8 },
            pivot: { row: 5, col: 5, values: [1, 5] },
            firstWing: { row: 5, col: 6, values: [1, 8] },
            secondWing: { row: 3, col: 3, values: [5, 8] },
            firstGuide: { kind: 'row', index: 5 },
            secondGuide: { kind: 'box', index: 4 },
            removalGuides: [{ kind: 'row', index: 5 }, { kind: 'box', index: 4 }],
            elimination: {
                row: 5,
                col: 3,
                beforeCandidates: [2, 4, 5, 8],
                removedValues: [8],
                afterCandidates: [2, 4, 5],
            },
        },
    ];

    for (const fixture of directCases) {
        const preview = createDevHintPreview(fixture.preview);
        const puzzleScope = getDevHintPreviewPuzzle(fixture.preview);
        const board = makeBoard(fixture.puzzle);
        const before = deepClone(board);
        const result = createHintPlan(board, fixture.solution);

        assert.deepEqual(puzzleScope, {
            difficulty: Difficulty.Intense,
            levelId: fixture.levelId,
        });
        assert.equal(
            scopeDevHintPreview(fixture.preview, Difficulty.Intense, fixture.levelId),
            fixture.preview,
        );
        assert.equal(
            scopeDevHintPreview(fixture.preview, Difficulty.Intense, fixture.levelId + 1),
            undefined,
        );
        assert.equal(scopeDevHintPreview(fixture.preview, Difficulty.Hard, fixture.levelId), undefined);
        assert.equal(result.status, 'ready');
        assert.equal(result.plan.technique, 'xyWing');
        assert.equal(result.plan.techniqueLabel, 'XY-Wing');
        assert.equal(result.plan.derivedResult, fixture.resultKind);
        assert.deepEqual(result.plan.target, fixture.target);
        assert.deepEqual(result.plan.frames.map(frame => frame.id), [
            'xy-wing-pivot',
            'xy-wing-first-wing',
            'xy-wing-second-wing',
            'xy-wing-remove',
            'xy-wing-answer',
        ]);
        assert.deepEqual(result.plan.candidateEliminations, [fixture.elimination]);
        assertPresentationContract(result.plan, fixture.preview);

        const [pivotFrame, firstFrame, secondFrame, removeFrame, answerFrame] = result.plan.frames;
        const z = fixture.elimination.removedValues[0];
        const firstShared = fixture.firstWing.values.find(value => fixture.pivot.values.includes(value));
        const secondShared = fixture.secondWing.values.find(value => fixture.pivot.values.includes(value));
        const expectedNoteSet = (coordinate, emphasizedValues, supportValues = []) => ({
            row: coordinate.row,
            col: coordinate.col,
            marks: coordinate.values.map(value => ({
                value,
                tone: emphasizedValues.includes(value)
                    ? 'locked'
                    : supportValues.includes(value)
                        ? 'support'
                        : 'possible',
            })),
        });
        assert.deepEqual(pivotFrame.candidateNoteSets, [{
            row: fixture.pivot.row,
            col: fixture.pivot.col,
            marks: fixture.pivot.values.map(value => ({ value, tone: 'locked' })),
        }]);
        assert.deepEqual(pivotFrame.guideUnits, undefined);
        assert.deepEqual(firstFrame.candidateNoteSets, [
            expectedNoteSet(fixture.pivot, fixture.pivot.values),
            expectedNoteSet(fixture.firstWing, [firstShared], [z]),
        ]);
        assert.deepEqual(firstFrame.guideUnits, [fixture.firstGuide]);
        assert.deepEqual(secondFrame.candidateNoteSets, [
            expectedNoteSet(fixture.pivot, fixture.pivot.values),
            expectedNoteSet(fixture.firstWing, [firstShared], [z]),
            expectedNoteSet(fixture.secondWing, [secondShared], [z]),
        ]);
        assert.deepEqual(secondFrame.guideUnits, [fixture.secondGuide]);
        assert.deepEqual(removeFrame.candidateNoteSets, [
            expectedNoteSet(fixture.pivot, fixture.pivot.values),
            expectedNoteSet(fixture.firstWing, [firstShared], [z]),
            expectedNoteSet(fixture.secondWing, [secondShared], [z]),
        ]);
        fixture.pivot.values.forEach(value => {
            assertToneText(pivotFrame, 'titleParts', 'source', value, fixture.preview);
        });
        assertToneText(firstFrame, 'titleParts', 'source', firstShared, fixture.preview);
        assertToneText(firstFrame, 'titleParts', 'support', z, fixture.preview);
        assertToneText(firstFrame, 'bodyParts', 'source', firstShared, fixture.preview);
        assertToneText(secondFrame, 'titleParts', 'source', secondShared, fixture.preview);
        assertToneText(secondFrame, 'titleParts', 'support', z, fixture.preview);
        assertToneText(secondFrame, 'bodyParts', 'source', secondShared, fixture.preview);
        assertToneText(removeFrame, 'titleParts', 'support', z, fixture.preview);
        assertToneText(removeFrame, 'bodyParts', 'removed', z, fixture.preview);
        assertToneText(answerFrame, 'titleParts', 'remaining', fixture.target.value, fixture.preview);
        assert.deepEqual(removeFrame.guideUnits, fixture.removalGuides);
        assert.equal(removeFrame.guideStrokeTone, 'soft');
        assert.equal(removeFrame.fillEliminatedCells, fixture.resultKind === 'hidden');
        assert.deepEqual(
            removeFrame.spotlightCells,
            fixture.resultKind === 'naked'
                ? [{ row: fixture.target.row, col: fixture.target.col }]
                : [
                    { row: fixture.firstWing.row, col: fixture.firstWing.col },
                    { row: fixture.secondWing.row, col: fixture.secondWing.col },
                ],
        );
        assert.equal(
            answerFrame.body,
            fixture.resultKind === 'naked'
                ? `${fixture.target.value} belongs in this cell.`
                : `Every gray ${fixture.target.value} is blocked, so ${fixture.target.value} belongs in the green cell.`,
        );
        assert.ok(isPeer(fixture.pivot, fixture.firstWing));
        assert.ok(isPeer(fixture.pivot, fixture.secondWing));
        assert.equal(isPeer(fixture.firstWing, fixture.secondWing), false);
        assert.ok(isPeer(fixture.elimination, fixture.firstWing));
        assert.ok(isPeer(fixture.elimination, fixture.secondWing));
        assert.equal(removeFrame.eliminationStyle, 'candidate-slash');
        assert.deepEqual(removeFrame.candidateMarks, [{
            row: fixture.elimination.row,
            col: fixture.elimination.col,
            value: z,
            tone: 'eliminated',
        }]);
        assert.equal(
            removeFrame.accessibleDetail,
            `If the pivot is ${firstShared}, the ${firstShared}/${z} wing must be ${z}. If the pivot is ${secondShared}, the ${secondShared}/${z} wing must be ${z}. Therefore the ${z} at row ${fixture.elimination.row + 1}, column ${fixture.elimination.col + 1} can be crossed out because that cell sees both wings.`,
        );
        assert.equal(
            fixture.solution[fixture.elimination.row][fixture.elimination.col]
                === fixture.elimination.removedValues[0],
            false,
        );
        assert.equal(fixture.solution[fixture.target.row][fixture.target.col], fixture.target.value);

        const initialCandidates = candidateGrid(fixture.puzzle);
        assert.deepEqual([...simulatedPlacements(fixture.puzzle, initialCandidates)], []);
        const after = initialCandidates.map(row => row.map(cell => [...cell]));
        after[fixture.elimination.row][fixture.elimination.col] = [
            ...fixture.elimination.afterCandidates,
        ];
        assert.ok(simulatedPlacements(fixture.puzzle, after).has(
            `${fixture.target.row}:${fixture.target.col}:${fixture.target.value}`,
        ));

        const notedBoard = deepClone(board);
        notedBoard.forEach(row => row.forEach(cell => { cell.notes = [8, 2, 5, 1]; }));
        const notedBefore = deepClone(notedBoard);
        assert.deepEqual(createHintPlan(notedBoard, fixture.solution), result);
        assert.deepEqual(notedBoard, notedBefore);
        assert.doesNotThrow(() => createHintPlan(
            deepFreeze(deepClone(board)),
            deepFreeze(deepClone(fixture.solution)),
        ));
        assert.deepEqual(createHintPlan(board, fixture.solution), result);
        assert.deepEqual(board, before);
        assert.deepEqual(createDevHintPreview(fixture.preview), preview);
    }

    const chainPreview = createDevHintPreview('xy-wing-chain');
    const chainBoard = makeBoard(XY_WING_CHAIN_PUZZLE);
    const chainBefore = deepClone(chainBoard);
    const chainResult = createHintPlan(chainBoard, XY_WING_CHAIN_SOLUTION);
    assert.deepEqual(getDevHintPreviewPuzzle('xy-wing-chain'), {
        difficulty: Difficulty.Intense,
        levelId: 287,
    });
    assert.equal(scopeDevHintPreview('xy-wing-chain', Difficulty.Intense, 287), 'xy-wing-chain');
    assert.equal(scopeDevHintPreview('xy-wing-chain', Difficulty.Intense, 288), undefined);
    assert.equal(scopeDevHintPreview('xy-wing-chain', Difficulty.Hard, 287), undefined);
    assert.equal(chainResult.status, 'ready');
    assert.equal(chainResult.plan.technique, 'multiStep');
    assert.equal(chainResult.plan.derivedResult, 'hidden');
    assert.deepEqual(chainResult.plan.target, { row: 8, col: 3, value: 8 });
    assert.deepEqual(chainResult.plan.deductions.map(item => item.technique), [
        'lockedCandidate',
        'xyWing',
    ]);
    assert.deepEqual(chainResult.plan.frames.map(frame => frame.id), [
        'chain-1-locked-find',
        'chain-1-locked-remove',
        'chain-2-xy-wing-find',
        'chain-2-xy-wing-remove',
        'chain-answer',
    ]);
    assert.deepEqual(chainResult.plan.deductions[0].candidateEliminations, [
        { row: 3, col: 6, beforeCandidates: [3, 5, 8], removedValues: [5], afterCandidates: [3, 8] },
        { row: 5, col: 6, beforeCandidates: [3, 5, 8, 9], removedValues: [5], afterCandidates: [3, 8, 9] },
    ]);
    assert.deepEqual(chainResult.plan.deductions[1].candidateEliminations, [
        { row: 8, col: 6, beforeCandidates: [2, 7, 8], removedValues: [8], afterCandidates: [2, 7] },
    ]);
    assertPresentationContract(chainResult.plan, 'chained XY-Wing preview');

    const baseCandidates = candidateGrid(XY_WING_CHAIN_PUZZLE);
    assert.deepEqual([...simulatedPlacements(XY_WING_CHAIN_PUZZLE, baseCandidates)], []);
    const afterLocked = baseCandidates.map(row => row.map(cell => [...cell]));
    for (const elimination of chainResult.plan.deductions[0].candidateEliminations) {
        afterLocked[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.deepEqual([...simulatedPlacements(XY_WING_CHAIN_PUZZLE, afterLocked)], []);
    const xyFindFrame = chainResult.plan.frames[2];
    const xyRemoveFrame = chainResult.plan.frames[3];
    const expectedChainNotes = [
        { row: 3, col: 3, marks: [{ value: 3, tone: 'locked' }, { value: 4, tone: 'locked' }] },
        { row: 3, col: 6, marks: [{ value: 3, tone: 'locked' }, { value: 8, tone: 'support' }] },
        { row: 8, col: 3, marks: [{ value: 4, tone: 'locked' }, { value: 8, tone: 'support' }] },
    ];
    assert.deepEqual(xyFindFrame.candidateNoteSets, expectedChainNotes);
    assert.deepEqual(xyFindFrame.spotlightCells, [
        { row: 3, col: 3 },
        { row: 3, col: 6 },
        { row: 8, col: 3 },
    ]);
    assert.deepEqual(xyFindFrame.sourceCells, [{ row: 3, col: 3 }]);
    assert.deepEqual(xyFindFrame.guideUnits, undefined);
    assert.equal(xyFindFrame.title, 'Now this 3/4 cell links two wings');
    assert.equal(
        xyFindFrame.body,
        'One wing is 3/8 and the other is 4/8. Either way, one wing must be 8.',
    );
    assertToneText(xyFindFrame, 'titleParts', 'source', 3, 'xy-wing-chain');
    assertToneText(xyFindFrame, 'titleParts', 'source', 4, 'xy-wing-chain');
    assertToneText(xyFindFrame, 'bodyParts', 'source', 3, 'xy-wing-chain');
    assertToneText(xyFindFrame, 'bodyParts', 'source', 4, 'xy-wing-chain');
    assert.ok(toneTexts(xyFindFrame, 'bodyParts', 'support').filter(text => text === '8').length >= 3);
    assert.deepEqual(xyRemoveFrame.candidateNoteSets, expectedChainNotes);
    assert.deepEqual(xyRemoveFrame.spotlightCells, []);
    assert.deepEqual(xyRemoveFrame.sourceCells, [{ row: 3, col: 6 }, { row: 8, col: 3 }]);
    assert.deepEqual(xyRemoveFrame.guideUnits, [
        { kind: 'column', index: 6 },
        { kind: 'row', index: 8 },
    ]);
    assert.equal(xyRemoveFrame.guideStrokeTone, 'soft');
    assert.equal(xyRemoveFrame.title, 'So 8 cannot go here');
    assert.equal(
        xyRemoveFrame.body,
        'This cell sees both wings. Cross out this 8; now only one place remains for 8.',
    );
    assert.deepEqual(xyRemoveFrame.candidateMarks, [
        { row: 8, col: 6, value: 8, tone: 'eliminated' },
    ]);
    assert.ok(isPeer(xyFindFrame.candidateNoteSets[0], xyFindFrame.candidateNoteSets[1]));
    assert.ok(isPeer(xyFindFrame.candidateNoteSets[0], xyFindFrame.candidateNoteSets[2]));
    assert.equal(isPeer(xyFindFrame.candidateNoteSets[1], xyFindFrame.candidateNoteSets[2]), false);
    const afterXYWing = afterLocked.map(row => row.map(cell => [...cell]));
    afterXYWing[8][6] = [2, 7];
    assert.ok(simulatedPlacements(XY_WING_CHAIN_PUZZLE, afterXYWing).has('8:3:8'));
    for (const deduction of chainResult.plan.deductions) {
        for (const elimination of deduction.candidateEliminations) {
            assert.equal(
                elimination.removedValues.includes(
                    XY_WING_CHAIN_SOLUTION[elimination.row][elimination.col],
                ),
                false,
            );
        }
    }
    const chainNoted = deepClone(chainBoard);
    chainNoted.forEach(row => row.forEach(cell => { cell.notes = [8, 2, 5, 1]; }));
    const chainNotedBefore = deepClone(chainNoted);
    assert.deepEqual(createHintPlan(chainNoted, XY_WING_CHAIN_SOLUTION), chainResult);
    assert.deepEqual(chainNoted, chainNotedBefore);
    assert.doesNotThrow(() => createHintPlan(
        deepFreeze(deepClone(chainBoard)),
        deepFreeze(deepClone(XY_WING_CHAIN_SOLUTION)),
    ));
    assert.deepEqual(chainBoard, chainBefore);
    assert.deepEqual(createDevHintPreview('xy-wing-chain'), chainPreview);
});

test('keeps Color Trap and Color Wrap previews causal, focused, and mutation-free', () => {
    const cases = [
        {
            preview: 'color-chain', levelId: 10,
            grid: COLOR_CHAIN_PUZZLE, solution: COLOR_CHAIN_SOLUTION,
            target: { row: 4, col: 7, value: 5 }, nodeCount: 4,
            colored: ['4:0:locked', '7:2:locked', '7:7:possible', '8:0:possible'],
            startGuide: { kind: 'column', index: 0 },
            startMarks: [
                { row: 4, col: 0, value: 8, tone: 'locked' },
                { row: 8, col: 0, value: 8, tone: 'possible' },
            ],
            startAccessible: 'This column has exactly two places for 8: row 5, column 1 and row 9, column 1. The circle and square are opposite groups; neither is assumed true yet.',
            ruleGuides: [{ kind: 'row', index: 4 }, { kind: 'column', index: 7 }],
            ruleTitle: 'This 8 sees both groups',
            ruleBody: 'One group must be true, so this candidate is blocked either way.',
            ruleAccessible: 'The 8 at row 5, column 8 sees one circle and one square 8. One of those opposite groups must be true, so this outside candidate is false.',
            ruleSpotlights: [{ row: 4, col: 7 }],
            ruleNoteSets: [{
                row: 4, col: 7,
                marks: [{ value: 8, tone: 'possible' }],
            }],
            delta: { row: 4, col: 7, beforeCandidates: [5, 8], removedValues: [8], afterCandidates: [5] },
        },
        {
            preview: 'color-chain-wrap', levelId: 13,
            grid: COLOR_CHAIN_WRAP_PUZZLE, solution: COLOR_CHAIN_WRAP_SOLUTION,
            target: { row: 5, col: 3, value: 7 }, nodeCount: 5,
            colored: ['5:0:locked', '6:2:locked', '5:3:possible', '6:3:possible', '7:0:possible'],
            startGuide: { kind: 'row', index: 5 },
            startMarks: [
                { row: 5, col: 0, value: 8, tone: 'locked' },
                { row: 5, col: 3, value: 8, tone: 'possible' },
            ],
            startAccessible: 'This row has exactly two places for 8: row 6, column 1 and row 6, column 4. The circle and square are opposite groups; neither is assumed true yet.',
            ruleGuides: [{ kind: 'column', index: 3 }],
            ruleTitle: 'Two square 8s share this column',
            ruleBody: 'They cannot both be true, so every square 8 is false.',
            ruleAccessible: 'The square 8s at row 6, column 4 and row 7, column 4 see each other in column 4. Therefore the square group is false.',
            ruleSpotlights: [{ row: 5, col: 3 }, { row: 6, col: 3 }],
            ruleNoteSets: undefined,
            delta: { row: 5, col: 3, beforeCandidates: [7, 8], removedValues: [8], afterCandidates: [7] },
        },
    ];
    for (const fixture of cases) {
        const preview = createDevHintPreview(fixture.preview);
        const board = makeBoard(fixture.grid);
        const before = deepClone(board);
        const result = createHintPlan(board, fixture.solution);
        assert.deepEqual(getDevHintPreviewPuzzle(fixture.preview), {
            difficulty: Difficulty.Impossible, levelId: fixture.levelId,
        });
        assert.equal(scopeDevHintPreview(fixture.preview, Difficulty.Impossible, fixture.levelId), fixture.preview);
        assert.equal(scopeDevHintPreview(fixture.preview, Difficulty.Impossible, fixture.levelId + 1), undefined);
        assert.equal(result.status, 'ready');
        assert.equal(result.plan.technique, 'simpleColoring');
        assert.equal(result.plan.techniqueLabel, 'Simple coloring');
        assert.equal(result.plan.derivedResult, 'naked');
        assert.deepEqual(result.plan.target, fixture.target);
        assert.deepEqual(result.plan.frames.map(frame => frame.id), [
            'color-chain-start', 'color-chain-links', 'color-chain-rule',
            'color-chain-remove', 'color-chain-answer',
        ]);
        assert.deepEqual(result.plan.candidateEliminations, [fixture.delta]);
        assertPresentationContract(result.plan, fixture.preview);
        const [start, links, rule, remove, answer] = result.plan.frames;
        assert.deepEqual(start.guideUnits, [fixture.startGuide]);
        assert.equal(start.guideStrokeTone, 'soft');
        assert.deepEqual(start.candidateMarks, fixture.startMarks);
        assert.equal(start.accessibleDetail, fixture.startAccessible);
        assert.equal(links.candidateMarks.length, fixture.nodeCount);
        assert.equal(links.title, 'Follow the alternating chain');
        assert.equal(links.body, 'The possible 8s alternate between circles and squares.');
        assert.deepEqual(links.spotlightCells, []);
        assert.equal(links.guideUnits, undefined);
        assert.equal(links.guideStrokeTone, undefined);
        assert.deepEqual(links.candidateMarks.map(mark => (
            `${mark.row}:${mark.col}:${mark.tone}`
        )), fixture.colored);
        assert.deepEqual(rule.candidateMarks, links.candidateMarks);
        assert.deepEqual(rule.guideUnits, fixture.ruleGuides);
        assert.equal(rule.guideStrokeTone, 'normal');
        assert.equal(rule.title, fixture.ruleTitle);
        assert.equal(rule.body, fixture.ruleBody);
        assert.equal(rule.accessibleDetail, fixture.ruleAccessible);
        assert.deepEqual(rule.spotlightCells, fixture.ruleSpotlights);
        assert.deepEqual(rule.candidateNoteSets, fixture.ruleNoteSets);
        assert.equal(remove.guideUnits, undefined);
        assert.equal(remove.guideStrokeTone, undefined);
        assert.equal(remove.fillEliminatedCells, false);
        assert.deepEqual(remove.spotlightCells, [{
            row: fixture.delta.row, col: fixture.delta.col,
        }]);
        assert.deepEqual(remove.candidateTransition, {
            row: fixture.delta.row,
            col: fixture.delta.col,
            beforeCandidates: fixture.delta.beforeCandidates,
            removedValue: fixture.delta.removedValues[0],
            afterCandidates: fixture.delta.afterCandidates,
        });
        assert.equal(answer.guideUnits, undefined);
        assert.equal(answer.guideStrokeTone, undefined);
        assert.deepEqual(remove.candidateMarks, [{
            row: fixture.delta.row, col: fixture.delta.col,
            value: fixture.delta.removedValues[0], tone: 'eliminated',
        }]);
        assert.equal(remove.eliminationStyle, 'candidate-slash');
        assert.equal(remove.candidateMarks.some(mark => mark.tone === 'blocked'), false);
        assert.notEqual(
            fixture.solution[fixture.delta.row][fixture.delta.col],
            fixture.delta.removedValues[0],
        );
        const candidates = candidateGrid(fixture.grid);
        assert.deepEqual([...simulatedPlacements(fixture.grid, candidates)], []);
        candidates[fixture.delta.row][fixture.delta.col] = [...fixture.delta.afterCandidates];
        assert.ok(simulatedPlacements(fixture.grid, candidates).has(
            `${fixture.target.row}:${fixture.target.col}:${fixture.target.value}`,
        ));
        const noted = deepClone(board);
        noted.forEach(row => row.forEach(cell => { cell.notes = [8, 2, 5, 1]; }));
        const notedBefore = deepClone(noted);
        assert.deepEqual(createHintPlan(noted, fixture.solution), result);
        assert.deepEqual(noted, notedBefore);
        assert.doesNotThrow(() => createHintPlan(
            deepFreeze(deepClone(board)), deepFreeze(deepClone(fixture.solution)),
        ));
        assert.deepEqual(board, before);
        assert.deepEqual(createDevHintPreview(fixture.preview), preview);
    }
});

test('chains candidate deductions until one number can be placed', () => {
    const board = makeBoard(MULTI_STEP_PUZZLE);
    const before = deepClone(board);
    const result = createHintPlan(board, MULTI_STEP_SOLUTION);

    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'multiStep');
    assert.equal(result.plan.techniqueLabel, 'Step by step');
    assert.equal(result.plan.derivedResult, 'naked');
    assert.deepEqual(result.plan.target, { row: 3, col: 7, value: 6 });
    assert.deepEqual(
        result.plan.deductions.map(deduction => deduction.technique),
        ['lockedCandidate', 'lockedCandidate'],
    );
    assertPresentationContract(result.plan, 'multi-step fixture');

    const initialCandidates = candidateGrid(MULTI_STEP_PUZZLE);
    assert.deepEqual([...simulatedPlacements(MULTI_STEP_PUZZLE, initialCandidates)], []);
    assert.deepEqual(result.plan.deductions[0].candidateEliminations, [
        {
            row: 3, col: 6, beforeCandidates: [1, 2, 4, 5, 7, 9],
            removedValues: [2], afterCandidates: [1, 4, 5, 7, 9],
        },
        {
            row: 3, col: 7, beforeCandidates: [2, 4, 6],
            removedValues: [2], afterCandidates: [4, 6],
        },
        {
            row: 3, col: 8, beforeCandidates: [1, 2, 4, 5, 7, 9],
            removedValues: [2], afterCandidates: [1, 4, 5, 7, 9],
        },
    ]);
    assert.deepEqual(result.plan.deductions[1].candidateEliminations, [
        {
            row: 3, col: 6, beforeCandidates: [1, 4, 5, 7, 9],
            removedValues: [4], afterCandidates: [1, 5, 7, 9],
        },
        {
            row: 3, col: 7, beforeCandidates: [4, 6],
            removedValues: [4], afterCandidates: [6],
        },
        {
            row: 3, col: 8, beforeCandidates: [1, 4, 5, 7, 9],
            removedValues: [4], afterCandidates: [1, 5, 7, 9],
        },
    ]);

    const afterFirst = initialCandidates.map(row => row.map(cell => [...cell]));
    for (const elimination of result.plan.deductions[0].candidateEliminations) {
        assert.deepEqual(afterFirst[elimination.row][elimination.col], elimination.beforeCandidates);
        afterFirst[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.deepEqual([...simulatedPlacements(MULTI_STEP_PUZZLE, afterFirst)], []);

    const afterSecond = afterFirst.map(row => row.map(cell => [...cell]));
    for (const elimination of result.plan.deductions[1].candidateEliminations) {
        assert.deepEqual(afterSecond[elimination.row][elimination.col], elimination.beforeCandidates);
        afterSecond[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    assert.deepEqual(afterSecond[3][7], [6]);
    assert.ok(simulatedPlacements(MULTI_STEP_PUZZLE, afterSecond).has('3:7:6'));
    assert.equal(MULTI_STEP_SOLUTION[3][7], 6);

    assert.deepEqual(result.plan.frames.map(frame => frame.id), [
        'chain-1-locked-find',
        'chain-1-locked-remove',
        'chain-2-locked-find',
        'chain-2-locked-remove',
        'chain-answer',
    ]);
    assert.deepEqual(result.plan.frames.map(frame => frame.techniqueLabel), [
        'Locked candidates',
        'Locked candidates',
        'Locked candidates',
        'Locked candidates',
        'Naked single',
    ]);
    assert.deepEqual(result.plan.frames[3].spotlightCells, [{ row: 3, col: 7 }]);
    assert.equal(result.plan.frames[1].fillEliminatedCells, true);
    assert.equal(result.plan.frames[3].fillEliminatedCells, false);
    assert.equal(
        result.plan.frames[3].body,
        'Cross out the slashed 4s. Only 6 remains in the outlined cell.',
    );

    const notedBoard = deepClone(board);
    notedBoard.forEach(row => row.forEach(cell => { cell.notes = [9, 2, 6, 1]; }));
    assert.deepEqual(createHintPlan(notedBoard, MULTI_STEP_SOLUTION), result);
    assert.doesNotThrow(() => createHintPlan(
        deepFreeze(deepClone(board)),
        deepFreeze(deepClone(MULTI_STEP_SOLUTION)),
    ));
    assert.deepEqual(createHintPlan(board, MULTI_STEP_SOLUTION), result);
    assert.deepEqual(board, before);
});

test('diagnoses multi-step search limits without changing production Hint behavior', () => {
    const board = makeBoard(MULTI_STEP_PUZZLE);
    const before = deepClone(board);

    const diagnostics = diagnoseHintSearch(board);
    assert.equal(diagnostics.termination, 'found');
    assert.equal(diagnostics.deductionCount, 2);
    assert.deepEqual(diagnostics.techniqueSequence, ['lockedCandidate', 'lockedCandidate']);
    assert.deepEqual(diagnostics.target, { row: 3, col: 7, value: 6 });
    assert.ok(diagnostics.exploredStates > 0);
    assert.ok(diagnostics.visitedStates > 0);
    assert.ok(diagnostics.generatedTransitions > 0);
    assert.equal(diagnostics.maxDepthReached, 2);

    const shallow = diagnoseHintSearch(board, { maxDeductions: 1, maxStates: 50_000 });
    assert.equal(shallow.termination, 'depth-limit');
    assert.equal(shallow.maxDepthReached, 1);
    assert.equal(shallow.deductionCount, undefined);

    const tinyBudget = diagnoseHintSearch(board, { maxDeductions: 3, maxStates: 1 });
    assert.equal(tinyBudget.termination, 'state-limit');
    assert.equal(tinyBudget.exploredStates, 1);

    assert.equal(
        diagnoseHintSearch(board, { maxDeductions: 0 }).termination,
        'invalid',
    );
    assert.deepEqual(board, before);
    assert.equal(createHintPlan(board, MULTI_STEP_SOLUTION).status, 'ready');
});

test('keeps simpler singles ahead of an available Naked Pair', () => {
    const board = makeBoard(NAKED_PAIR_PUZZLE);
    board[0][0].value = null;
    board[0][0].isFixed = false;

    const result = createHintPlan(board, NAKED_PAIR_SOLUTION);
    assert.equal(result.status, 'ready');
    assert.equal(result.plan.technique, 'nakedSingle');
    assert.deepEqual(result.plan.target, { row: 0, col: 0, value: 8 });
});

test('keeps every core local Hint preview deterministic and production-compatible', () => {
    const cases = [
        {
            preview: 'last-number',
            puzzle: { difficulty: Difficulty.SuperEasy, levelId: 1 },
            technique: 'nakedSingle',
            techniqueLabel: 'Full house',
            derivedResult: undefined,
            target: { row: 4, col: 5, value: 5 },
            frameIds: ['unit-completion-look', 'unit-completion-answer', 'unit-completion-place'],
            productionOpening: true,
        },
        {
            preview: 'naked',
            puzzle: { difficulty: Difficulty.SuperEasy, levelId: 4 },
            technique: 'nakedSingle',
            techniqueLabel: 'Naked single',
            derivedResult: undefined,
            target: { row: 3, col: 8, value: 1 },
            frameIds: ['naked-look', 'naked-rule-out', 'naked-answer'],
            productionOpening: true,
        },
        {
            preview: 'hidden',
            puzzle: { difficulty: Difficulty.Easy, levelId: 42 },
            technique: 'hiddenSingle',
            techniqueLabel: 'Hidden single',
            derivedResult: undefined,
            target: { row: 3, col: 8, value: 9 },
            frameIds: ['hidden-look', 'hidden-blocked', 'hidden-answer'],
            productionOpening: true,
        },
        {
            preview: 'locked',
            puzzle: { difficulty: Difficulty.Hard, levelId: 2 },
            technique: 'lockedCandidate',
            techniqueLabel: 'Locked candidates',
            derivedResult: 'naked',
            target: { row: 4, col: 0, value: 9 },
            frameIds: ['locked-find', 'locked-remove', 'locked-answer'],
            productionOpening: false,
        },
        {
            preview: 'locked-hidden',
            puzzle: { difficulty: Difficulty.Hard, levelId: 4 },
            technique: 'lockedCandidate',
            techniqueLabel: 'Locked candidates',
            derivedResult: 'hidden',
            target: { row: 6, col: 5, value: 5 },
            frameIds: ['locked-find', 'locked-remove', 'locked-answer'],
            productionOpening: false,
        },
        {
            preview: 'pair',
            puzzle: { difficulty: Difficulty.Hard, levelId: 84 },
            technique: 'nakedPair',
            techniqueLabel: 'Naked pair',
            derivedResult: 'naked',
            target: { row: 4, col: 7, value: 7 },
            frameIds: ['pair-find', 'pair-remove', 'pair-answer'],
            productionOpening: false,
        },
        {
            preview: 'pair-hidden',
            puzzle: { difficulty: Difficulty.Hard, levelId: 37 },
            technique: 'nakedPair',
            techniqueLabel: 'Naked pair',
            derivedResult: 'hidden',
            target: { row: 0, col: 5, value: 6 },
            frameIds: ['pair-find', 'pair-remove', 'pair-answer'],
            productionOpening: false,
        },
        {
            preview: 'hidden-pair',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 84 },
            technique: 'hiddenPair',
            techniqueLabel: 'Hidden pair',
            derivedResult: 'hidden',
            target: { row: 3, col: 5, value: 2 },
            frameIds: ['hidden-pair-find', 'hidden-pair-remove', 'hidden-pair-answer'],
            productionOpening: false,
        },
        {
            preview: 'hidden-pair-chain',
            puzzle: { difficulty: Difficulty.Intense, levelId: 177 },
            technique: 'multiStep',
            techniqueLabel: 'Step by step',
            derivedResult: 'hidden',
            target: { row: 3, col: 4, value: 9 },
            frameIds: [
                'chain-1-pair-find',
                'chain-1-pair-remove',
                'chain-2-hidden-pair-find',
                'chain-2-hidden-pair-remove',
                'chain-answer',
            ],
            productionOpening: false,
        },
        {
            preview: 'triple',
            puzzle: { difficulty: Difficulty.Intense, levelId: 145 },
            technique: 'nakedTriple',
            techniqueLabel: 'Naked triple',
            derivedResult: 'naked',
            target: { row: 4, col: 1, value: 7 },
            frameIds: ['triple-find', 'triple-remove', 'triple-answer'],
            productionOpening: false,
        },
        {
            preview: 'triple-hidden',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 74 },
            technique: 'nakedTriple',
            techniqueLabel: 'Naked triple',
            derivedResult: 'hidden',
            target: { row: 0, col: 0, value: 9 },
            frameIds: ['triple-find', 'triple-remove', 'triple-answer'],
            productionOpening: false,
        },
        {
            preview: 'triple-chain',
            puzzle: { difficulty: Difficulty.Intense, levelId: 99 },
            technique: 'multiStep',
            techniqueLabel: 'Step by step',
            derivedResult: 'naked',
            target: { row: 4, col: 5, value: 2 },
            frameIds: [
                'chain-1-triple-find',
                'chain-1-triple-remove',
                'chain-2-pair-find',
                'chain-2-pair-remove',
                'chain-answer',
            ],
            productionOpening: false,
        },
        {
            preview: 'x-wing',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 153 },
            technique: 'xWing',
            techniqueLabel: 'X-Wing',
            derivedResult: 'naked',
            target: { row: 0, col: 3, value: 6 },
            frameIds: ['x-wing-find', 'x-wing-remove', 'x-wing-answer'],
            productionOpening: false,
        },
        {
            preview: 'x-wing-hidden',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 130 },
            technique: 'xWing',
            techniqueLabel: 'X-Wing',
            derivedResult: 'hidden',
            target: { row: 3, col: 8, value: 2 },
            frameIds: ['x-wing-find', 'x-wing-remove', 'x-wing-answer'],
            productionOpening: false,
        },
        {
            preview: 'x-wing-chain',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 65 },
            technique: 'multiStep',
            techniqueLabel: 'Step by step',
            derivedResult: 'naked',
            target: { row: 5, col: 2, value: 9 },
            frameIds: [
                'chain-1-hidden-pair-find',
                'chain-1-hidden-pair-remove',
                'chain-2-x-wing-find',
                'chain-2-x-wing-remove',
                'chain-answer',
            ],
            productionOpening: false,
        },
        {
            preview: 'xy-wing',
            puzzle: { difficulty: Difficulty.Intense, levelId: 84 },
            technique: 'xyWing',
            techniqueLabel: 'XY-Wing',
            derivedResult: 'naked',
            target: { row: 2, col: 8, value: 7 },
            frameIds: [
                'xy-wing-pivot',
                'xy-wing-first-wing',
                'xy-wing-second-wing',
                'xy-wing-remove',
                'xy-wing-answer',
            ],
            productionOpening: false,
        },
        {
            preview: 'xy-wing-hidden',
            puzzle: { difficulty: Difficulty.Intense, levelId: 248 },
            technique: 'xyWing',
            techniqueLabel: 'XY-Wing',
            derivedResult: 'hidden',
            target: { row: 5, col: 6, value: 8 },
            frameIds: [
                'xy-wing-pivot',
                'xy-wing-first-wing',
                'xy-wing-second-wing',
                'xy-wing-remove',
                'xy-wing-answer',
            ],
            productionOpening: false,
        },
        {
            preview: 'xy-wing-chain',
            puzzle: { difficulty: Difficulty.Intense, levelId: 287 },
            technique: 'multiStep',
            techniqueLabel: 'Step by step',
            derivedResult: 'hidden',
            target: { row: 8, col: 3, value: 8 },
            frameIds: [
                'chain-1-locked-find',
                'chain-1-locked-remove',
                'chain-2-xy-wing-find',
                'chain-2-xy-wing-remove',
                'chain-answer',
            ],
            productionOpening: false,
        },
        {
            preview: 'color-chain',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 10 },
            technique: 'simpleColoring',
            techniqueLabel: 'Simple coloring',
            derivedResult: 'naked',
            target: { row: 4, col: 7, value: 5 },
            frameIds: ['color-chain-start', 'color-chain-links', 'color-chain-rule', 'color-chain-remove', 'color-chain-answer'],
            productionOpening: false,
        },
        {
            preview: 'color-chain-wrap',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 13 },
            technique: 'simpleColoring',
            techniqueLabel: 'Simple coloring',
            derivedResult: 'naked',
            target: { row: 5, col: 3, value: 7 },
            frameIds: ['color-chain-start', 'color-chain-links', 'color-chain-rule', 'color-chain-remove', 'color-chain-answer'],
            productionOpening: false,
        },
        {
            preview: 'chain',
            puzzle: { difficulty: Difficulty.Hard, levelId: 35 },
            technique: 'multiStep',
            techniqueLabel: 'Step by step',
            derivedResult: 'naked',
            target: { row: 3, col: 7, value: 6 },
            frameIds: [
                'chain-1-locked-find',
                'chain-1-locked-remove',
                'chain-2-locked-find',
                'chain-2-locked-remove',
                'chain-answer',
            ],
            productionOpening: false,
        },
    ];

    assert.deepEqual(DEV_HINT_PREVIEWS, cases.map(item => item.preview));
    assert.equal(isDevHintPreview(null), false);
    assert.equal(isDevHintPreview('unknown'), false);

    for (const expected of cases) {
        assert.equal(isDevHintPreview(expected.preview), true);
        const preview = createDevHintPreview(expected.preview);
        const puzzle = getDevHintPreviewPuzzle(expected.preview);
        const productionLevel = generateLevel(puzzle.difficulty, puzzle.levelId);

        assert.deepEqual(puzzle, expected.puzzle);
        assert.equal(preview.plan.technique, expected.technique);
        assert.equal(preview.plan.techniqueLabel, expected.techniqueLabel);
        assert.equal(preview.plan.derivedResult, expected.derivedResult);
        assert.deepEqual(preview.plan.target, expected.target);
        assert.deepEqual(preview.plan.frames.map(frame => frame.id), expected.frameIds);
        assertPresentationContract(preview.plan, `${expected.preview} preview`);
        assert.equal(scopeDevHintPreview(
            expected.preview,
            puzzle.difficulty,
            puzzle.levelId,
        ), expected.preview);
        assert.equal(scopeDevHintPreview(
            expected.preview,
            puzzle.difficulty,
            puzzle.levelId + 1,
        ), undefined);
        assert.equal(scopeDevHintPreview(
            expected.preview,
            puzzle.difficulty === Difficulty.Hard ? Difficulty.Easy : Difficulty.Hard,
            puzzle.levelId,
        ), undefined);

        preview.board.forEach((previewRow, rowIndex) => {
            previewRow.forEach((cell, colIndex) => {
                if (cell.value !== null) {
                    assert.equal(
                        cell.value,
                        productionLevel.solved[rowIndex][colIndex],
                        `${expected.preview} must contain only values from its production solution`,
                    );
                }
            });
        });
        assert.equal(
            productionLevel.solved[expected.target.row][expected.target.col],
            expected.target.value,
        );
        if (expected.productionOpening) {
            assert.equal(
                boardHintSignature(preview.board),
                boardHintSignature(productionLevel.initial),
                `${expected.preview} should remain the exact production opening board`,
            );
        }

        const continuedBoard = cloneHintBoard(preview.board);
        continuedBoard[expected.target.row][expected.target.col].value = expected.target.value;
        continuedBoard[expected.target.row][expected.target.col].isFixed = false;
        const continued = createHintPlan(continuedBoard, productionLevel.solved);
        assert.notEqual(continued.status, 'wrong-board');
        assert.notEqual(continued.status, 'invalid');
        assert.deepEqual(createDevHintPreview(expected.preview), preview);
    }
});

test('keeps the local Locked Candidates preview deterministic and ready', () => {
    const preview = createDevHintPreview('locked');
    const puzzle = getDevHintPreviewPuzzle('locked');
    const productionLevel = generateLevel(puzzle.difficulty, puzzle.levelId);
    assert.equal(preview.plan.technique, 'lockedCandidate');
    assert.equal(preview.plan.frames.length, 3);
    assert.deepEqual(preview.plan.target, { row: 4, col: 0, value: 9 });
    assert.equal(preview.plan.frames[0].title, 'Only two places for 1');
    assert.equal(preview.plan.frames[1].title, 'These 1s share this row');
    assert.equal(
        preview.plan.frames[1].body,
        'So 1 cannot go in the outlined cell.',
    );
    assert.equal(
        preview.plan.frames[1].accessibleDetail,
        'Candidate 1 is eliminated from row 5, column 1 because every possible 1 in the 3 × 3 box lies in this row.',
    );
    assert.equal(preview.plan.frames[2].title, 'Only 9 remains');
    assert.equal(
        preview.plan.frames[2].body,
        '9 belongs in this cell.',
    );
    assert.equal(
        preview.plan.frames[2].accessibleDetail,
        'Candidate 1 is ruled out at row 5, column 1, leaving only 9.',
    );
    const { row, col, value } = preview.plan.target;
    assert.deepEqual(puzzle, { difficulty: Difficulty.Hard, levelId: 2 });
    assert.equal(scopeDevHintPreview('locked', Difficulty.Hard, 2), 'locked');
    assert.equal(scopeDevHintPreview('locked', Difficulty.Hard, 20), undefined);
    assert.equal(scopeDevHintPreview('locked', Difficulty.Normal, 2), undefined);
    assert.equal(scopeDevHintPreview(null, Difficulty.Hard, 2), undefined);
    assert.equal(productionLevel.solved[row][col], value);
    preview.board.forEach((previewRow, rowIndex) => {
        previewRow.forEach((cell, colIndex) => {
            if (cell.value !== null) {
                assert.equal(cell.value, productionLevel.solved[rowIndex][colIndex]);
            }
        });
    });
});

test('keeps the local Naked Pair preview isolated and deterministic', () => {
    const preview = createDevHintPreview('pair');
    const puzzle = getDevHintPreviewPuzzle('pair');
    const productionLevel = generateLevel(puzzle.difficulty, puzzle.levelId);

    assert.equal(preview.plan.technique, 'nakedPair');
    assert.equal(preview.plan.frames.length, 3);
    assert.deepEqual(preview.plan.target, { row: 4, col: 7, value: 7 });
    assert.equal(preview.plan.frames[0].body, 'They must contain 2 and 8, in either order.');
    assert.equal(preview.plan.frames[1].title, 'The pair reserves 2 and 8');
    assert.deepEqual(puzzle, { difficulty: Difficulty.Hard, levelId: 84 });
    assert.equal(scopeDevHintPreview('pair', Difficulty.Hard, 84), 'pair');
    assert.equal(scopeDevHintPreview('pair', Difficulty.Hard, 2), undefined);
    assert.equal(scopeDevHintPreview('pair', Difficulty.Normal, 84), undefined);

    const { row, col, value } = preview.plan.target;
    assert.equal(productionLevel.solved[row][col], value);
    preview.board.forEach((previewRow, rowIndex) => {
        previewRow.forEach((cell, colIndex) => {
            if (cell.value !== null) {
                assert.equal(cell.value, productionLevel.solved[rowIndex][colIndex]);
            }
        });
    });
    assert.deepEqual(createDevHintPreview('pair'), preview);
});

test('keeps the local Naked Pair hidden-result preview isolated and deterministic', () => {
    const preview = createDevHintPreview('pair-hidden');
    const puzzle = getDevHintPreviewPuzzle('pair-hidden');
    const productionLevel = generateLevel(puzzle.difficulty, puzzle.levelId);

    assert.equal(preview.plan.technique, 'nakedPair');
    assert.equal(preview.plan.derivedResult, 'hidden');
    assert.equal(preview.plan.frames.length, 3);
    assert.deepEqual(preview.plan.target, { row: 0, col: 5, value: 6 });
    assert.equal(preview.plan.frames[0].body, 'They must contain 3 and 6, in either order.');
    assert.equal(preview.plan.frames[1].title, 'Now look at this row');
    assert.equal(preview.plan.frames[2].title, 'Only one place remains for 6');
    assert.deepEqual(puzzle, { difficulty: Difficulty.Hard, levelId: 37 });
    assert.equal(scopeDevHintPreview('pair-hidden', Difficulty.Hard, 37), 'pair-hidden');
    assert.equal(scopeDevHintPreview('pair-hidden', Difficulty.Hard, 84), undefined);
    assert.equal(scopeDevHintPreview('pair-hidden', Difficulty.Normal, 37), undefined);

    const { row, col, value } = preview.plan.target;
    assert.equal(productionLevel.solved[row][col], value);
    preview.board.forEach((previewRow, rowIndex) => {
        previewRow.forEach((cell, colIndex) => {
            if (cell.value !== null) {
                assert.equal(cell.value, productionLevel.solved[rowIndex][colIndex]);
            }
        });
    });
    assert.deepEqual(createDevHintPreview('pair-hidden'), preview);
});

test('keeps the local Hidden Pair previews isolated and deterministic', () => {
    const directPreview = createDevHintPreview('hidden-pair');
    const directPuzzle = getDevHintPreviewPuzzle('hidden-pair');
    const directLevel = generateLevel(directPuzzle.difficulty, directPuzzle.levelId);

    assert.equal(directPreview.plan.technique, 'hiddenPair');
    assert.equal(directPreview.plan.derivedResult, 'hidden');
    assert.deepEqual(directPreview.plan.target, { row: 3, col: 5, value: 2 });
    assert.deepEqual(
        directPreview.plan.frames.map(frame => frame.techniqueLabel),
        ['Hidden pair', 'Hidden pair', 'Hidden single'],
    );
    assert.deepEqual(directPuzzle, { difficulty: Difficulty.Impossible, levelId: 84 });
    assert.equal(scopeDevHintPreview('hidden-pair', Difficulty.Impossible, 84), 'hidden-pair');
    assert.equal(scopeDevHintPreview('hidden-pair', Difficulty.Impossible, 85), undefined);
    assert.equal(scopeDevHintPreview('hidden-pair', Difficulty.Hard, 84), undefined);
    assert.equal(
        directLevel.solved[directPreview.plan.target.row][directPreview.plan.target.col],
        directPreview.plan.target.value,
    );
    assert.deepEqual(createDevHintPreview('hidden-pair'), directPreview);

    const chainPreview = createDevHintPreview('hidden-pair-chain');
    const chainPuzzle = getDevHintPreviewPuzzle('hidden-pair-chain');
    const chainLevel = generateLevel(chainPuzzle.difficulty, chainPuzzle.levelId);

    assert.equal(chainPreview.plan.technique, 'multiStep');
    assert.equal(chainPreview.plan.derivedResult, 'hidden');
    assert.deepEqual(chainPreview.plan.target, { row: 3, col: 4, value: 9 });
    assert.deepEqual(
        chainPreview.plan.deductions.map(deduction => deduction.technique),
        ['nakedPair', 'hiddenPair'],
    );
    assert.deepEqual(chainPuzzle, { difficulty: Difficulty.Intense, levelId: 177 });
    assert.equal(
        scopeDevHintPreview('hidden-pair-chain', Difficulty.Intense, 177),
        'hidden-pair-chain',
    );
    assert.equal(scopeDevHintPreview('hidden-pair-chain', Difficulty.Intense, 178), undefined);
    assert.equal(scopeDevHintPreview('hidden-pair-chain', Difficulty.Hard, 177), undefined);
    assert.equal(
        chainLevel.solved[chainPreview.plan.target.row][chainPreview.plan.target.col],
        chainPreview.plan.target.value,
    );
    assert.deepEqual(createDevHintPreview('hidden-pair-chain'), chainPreview);
});

test('keeps the local Naked Triple previews isolated and deterministic', () => {
    const directPreview = createDevHintPreview('triple');
    const directPuzzle = getDevHintPreviewPuzzle('triple');
    const directLevel = generateLevel(directPuzzle.difficulty, directPuzzle.levelId);

    assert.equal(directPreview.plan.technique, 'nakedTriple');
    assert.equal(directPreview.plan.derivedResult, 'naked');
    assert.deepEqual(directPreview.plan.target, { row: 4, col: 1, value: 7 });
    assert.deepEqual(
        directPreview.plan.frames.map(frame => frame.techniqueLabel),
        ['Naked triple', 'Naked triple', 'Naked single'],
    );
    assert.deepEqual(directPuzzle, { difficulty: Difficulty.Intense, levelId: 145 });
    assert.equal(scopeDevHintPreview('triple', Difficulty.Intense, 145), 'triple');
    assert.equal(scopeDevHintPreview('triple', Difficulty.Intense, 146), undefined);
    assert.equal(scopeDevHintPreview('triple', Difficulty.Hard, 145), undefined);
    assert.equal(
        directLevel.solved[directPreview.plan.target.row][directPreview.plan.target.col],
        directPreview.plan.target.value,
    );
    assert.deepEqual(createDevHintPreview('triple'), directPreview);

    const hiddenPreview = createDevHintPreview('triple-hidden');
    const hiddenPuzzle = getDevHintPreviewPuzzle('triple-hidden');
    const hiddenLevel = generateLevel(hiddenPuzzle.difficulty, hiddenPuzzle.levelId);

    assert.equal(hiddenPreview.plan.technique, 'nakedTriple');
    assert.equal(hiddenPreview.plan.derivedResult, 'hidden');
    assert.deepEqual(hiddenPreview.plan.target, { row: 0, col: 0, value: 9 });
    assert.deepEqual(
        hiddenPreview.plan.frames.map(frame => frame.techniqueLabel),
        ['Naked triple', 'Naked triple', 'Hidden single'],
    );
    assert.deepEqual(hiddenPuzzle, { difficulty: Difficulty.Impossible, levelId: 74 });
    assert.equal(
        scopeDevHintPreview('triple-hidden', Difficulty.Impossible, 74),
        'triple-hidden',
    );
    assert.equal(scopeDevHintPreview('triple-hidden', Difficulty.Impossible, 75), undefined);
    assert.equal(scopeDevHintPreview('triple-hidden', Difficulty.Hard, 74), undefined);
    assert.equal(
        hiddenLevel.solved[hiddenPreview.plan.target.row][hiddenPreview.plan.target.col],
        hiddenPreview.plan.target.value,
    );
    assert.deepEqual(createDevHintPreview('triple-hidden'), hiddenPreview);

    const chainPreview = createDevHintPreview('triple-chain');
    const chainPuzzle = getDevHintPreviewPuzzle('triple-chain');
    const chainLevel = generateLevel(chainPuzzle.difficulty, chainPuzzle.levelId);

    assert.equal(chainPreview.plan.technique, 'multiStep');
    assert.equal(chainPreview.plan.derivedResult, 'naked');
    assert.deepEqual(chainPreview.plan.target, { row: 4, col: 5, value: 2 });
    assert.deepEqual(
        chainPreview.plan.deductions.map(deduction => deduction.technique),
        ['nakedTriple', 'nakedPair'],
    );
    assert.deepEqual(chainPuzzle, { difficulty: Difficulty.Intense, levelId: 99 });
    assert.equal(
        scopeDevHintPreview('triple-chain', Difficulty.Intense, 99),
        'triple-chain',
    );
    assert.equal(scopeDevHintPreview('triple-chain', Difficulty.Intense, 100), undefined);
    assert.equal(scopeDevHintPreview('triple-chain', Difficulty.Hard, 99), undefined);
    assert.equal(
        chainLevel.solved[chainPreview.plan.target.row][chainPreview.plan.target.col],
        chainPreview.plan.target.value,
    );
    assert.deepEqual(createDevHintPreview('triple-chain'), chainPreview);
});

test('keeps the local multi-step preview isolated and deterministic', () => {
    const preview = createDevHintPreview('chain');
    const puzzle = getDevHintPreviewPuzzle('chain');
    const productionLevel = generateLevel(puzzle.difficulty, puzzle.levelId);

    assert.equal(preview.plan.technique, 'multiStep');
    assert.equal(preview.plan.derivedResult, 'naked');
    assert.equal(preview.plan.frames.length, 5);
    assert.deepEqual(preview.plan.target, { row: 3, col: 7, value: 6 });
    assert.deepEqual(
        preview.plan.deductions.map(deduction => deduction.technique),
        ['lockedCandidate', 'lockedCandidate'],
    );
    assert.deepEqual(
        preview.plan.frames.map(frame => frame.techniqueLabel),
        ['Locked candidates', 'Locked candidates', 'Locked candidates', 'Locked candidates', 'Naked single'],
    );
    assert.deepEqual(puzzle, { difficulty: Difficulty.Hard, levelId: 35 });
    assert.equal(scopeDevHintPreview('chain', Difficulty.Hard, 35), 'chain');
    assert.equal(scopeDevHintPreview('chain', Difficulty.Hard, 37), undefined);
    assert.equal(scopeDevHintPreview('chain', Difficulty.Normal, 35), undefined);

    const { row, col, value } = preview.plan.target;
    assert.equal(productionLevel.solved[row][col], value);
    preview.board.forEach((previewRow, rowIndex) => {
        previewRow.forEach((cell, colIndex) => {
            if (cell.value !== null) {
                assert.equal(cell.value, productionLevel.solved[rowIndex][colIndex]);
            }
        });
    });
    assert.deepEqual(createDevHintPreview('chain'), preview);
});

skipLegacyPlacementContract = false;

test('rejects a wrong player value without leaking its location', () => {
    const grid = deepClone(SOLUTION);
    grid[0][0] = 4;
    const board = makeBoard(grid);
    board[0][0].isFixed = false;
    const before = deepClone(board);

    const result = createHintPlan(board, SOLUTION);

    assert.deepEqual(result, { status: 'wrong-board' });
    assert.deepEqual(Object.keys(result), ['status']);
    assert.equal(JSON.stringify(result).includes('row'), false);
    assert.equal(JSON.stringify(result).includes('col'), false);
    assert.deepEqual(board, before);
});

test('recognizes a completed board', () => {
    assert.deepEqual(createHintPlan(makeBoard(SOLUTION), SOLUTION), { status: 'complete' });
});

test('returns unsupported when singles cannot advance the board', () => {
    const emptyBoard = makeBoard(Array.from({ length: 9 }, () => Array(9).fill(0)));
    assert.deepEqual(createHintPlan(emptyBoard, SOLUTION), { status: 'unsupported' });
});

test('returns invalid for malformed inputs instead of throwing', () => {
    const validBoard = makeBoard(SOLUTION);
    assert.deepEqual(createHintPlan(validBoard.slice(0, 8), SOLUTION), { status: 'invalid' });

    const invalidSolution = deepClone(SOLUTION);
    invalidSolution[0][0] = invalidSolution[0][1];
    assert.deepEqual(createHintPlan(validBoard, invalidSolution), { status: 'invalid' });

    const malformedBoard = Array.from({ length: 9 }, () => Array(9).fill(null));
    assert.doesNotThrow(() => createHintPlan(malformedBoard, SOLUTION));
    assert.deepEqual(createHintPlan(malformedBoard, SOLUTION), { status: 'invalid' });

    const fixedBlank = makeBoard(Array.from({ length: 9 }, () => Array(9).fill(0)));
    fixedBlank[0][0].isFixed = true;
    assert.deepEqual(createHintPlan(fixedBlank, SOLUTION), { status: 'invalid' });
});

test('ignores pencil notes when choosing a hint', () => {
    const plainBoard = makeBoard(HIDDEN_SINGLE_PUZZLE);
    const notedBoard = deepClone(plainBoard);
    for (const row of notedBoard) {
        for (const cell of row) {
            cell.notes = cell.value === null ? [9, 2, 6, 1] : [3];
        }
    }

    assert.deepEqual(
        createHintPlan(notedBoard, HIDDEN_SINGLE_SOLUTION),
        createHintPlan(plainBoard, HIDDEN_SINGLE_SOLUTION)
    );
    assert.equal(boardHintSignature(notedBoard), boardHintSignature(plainBoard));
});

test('does not mutate frozen inputs and clones note arrays safely', () => {
    const grid = deepClone(SOLUTION);
    grid[0][0] = 0;
    const mutableBoard = makeBoard(grid);
    mutableBoard[0][0].notes = [1, 2, 3];
    const boardSnapshot = deepClone(mutableBoard);
    const solutionSnapshot = deepClone(SOLUTION);
    const frozenBoard = deepFreeze(mutableBoard);
    const frozenSolution = deepFreeze(deepClone(SOLUTION));

    assert.doesNotThrow(() => createHintPlan(frozenBoard, frozenSolution));
    assert.deepEqual(mutableBoard, boardSnapshot);
    assert.deepEqual(frozenSolution, solutionSnapshot);

    const clonedBoard = cloneHintBoard(frozenBoard);
    clonedBoard[0][0].notes.push(9);
    clonedBoard[0][0].value = 5;
    assert.deepEqual(frozenBoard[0][0].notes, [1, 2, 3]);
    assert.equal(frozenBoard[0][0].value, null);
});

skipLegacyPlacementContract = true;

test('finds a supported opening Hint across all production puzzles', () => {
    for (const difficulty of Object.values(Difficulty)) {
        for (let levelId = 1; levelId <= 300; levelId += 1) {
            const { initial, solved } = generateLevel(difficulty, levelId);
            const result = createHintPlan(initial, solved);
            assert.equal(
                result.status,
                'ready',
                `${difficulty} ${levelId} should begin with a supported Hint`
            );
            assert.equal(
                solved[result.plan.target.row][result.plan.target.col],
                result.plan.target.value,
                `${difficulty} ${levelId} Hint target must match its solution`
            );
        }
    }
});

test('walks every production puzzle through a safe deterministic Hint path', () => {
    let lockedSteps = 0;
    const lockedVariants = new Set();
    const lockedResults = new Set();
    let nakedPairSteps = 0;
    const nakedPairUnits = new Set();
    const nakedPairResults = new Set();
    let nakedTripleSteps = 0;
    const nakedTripleUnits = new Set();
    const nakedTripleResults = new Set();
    const nakedTripleShapes = new Set();
    let multiStepPlans = 0;
    let maxMultiStepDeductions = 0;
    const multiStepSequences = new Set();

    for (const difficulty of Object.values(Difficulty)) {
        for (let levelId = 1; levelId <= 300; levelId += 1) {
            const { initial, solved } = generateLevel(difficulty, levelId);
            const board = cloneHintBoard(initial);
            let terminated = false;

            for (let step = 0; step <= 81; step += 1) {
                const beforeSignature = boardHintSignature(board);
                const result = createHintPlan(board, solved);
                assert.equal(
                    boardHintSignature(board),
                    beforeSignature,
                    `${difficulty} ${levelId} step ${step} must not mutate the board`,
                );

                if (result.status !== 'ready') {
                    assert.ok(
                        result.status === 'complete' || result.status === 'unsupported',
                        `${difficulty} ${levelId} ended with unexpected status ${result.status}`,
                    );
                    terminated = true;
                    break;
                }

                assertPresentationContract(
                    result.plan,
                    `${difficulty} ${levelId} step ${step}`,
                );

                const { row, col, value } = result.plan.target;
                assert.equal(board[row][col].value, null);
                assert.equal(
                    solved[row][col],
                    value,
                    `${difficulty} ${levelId} step ${step} target must match its solution`,
                );

                if (
                    result.plan.technique === 'nakedSingle'
                    && result.plan.techniqueLabel === 'Naked single'
                ) {
                    const numericGrid = board.map(boardRow => boardRow.map(cell => cell.value ?? 0));
                    assertNakedCandidateBreakdown(result.plan.frames[1], result.plan.target, numericGrid);
                }

                if (result.plan.technique === 'lockedCandidate') {
                    lockedSteps += 1;
                    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
                    const sourceUnit = guideForCells(findFrame.unitCells);
                    const numericGrid = board.map(boardRow => boardRow.map(cell => cell.value ?? 0));
                    const candidates = candidateGrid(numericGrid);
                    const lockedMarks = findFrame.candidateMarks.filter(mark => mark.tone === 'locked');
                    const eliminatedMarks = removeFrame.candidateMarks.filter(mark => mark.tone === 'eliminated');
                    assert.ok(lockedMarks.length >= 2 && lockedMarks.length <= 3);
                    assert.ok(eliminatedMarks.length > 0);
                    const lockedValue = lockedMarks[0].value;
                    const intersectingUnit = inferLockedIntersection(sourceUnit, lockedMarks);
                    lockedVariants.add(`${sourceUnit.kind}->${intersectingUnit.kind}`);
                    lockedResults.add(result.plan.derivedResult);

                    const completeSourcePositions = cellsForGuideUnit(sourceUnit).filter(cell => (
                        numericGrid[cell.row][cell.col] === 0
                        && candidates[cell.row][cell.col].includes(lockedValue)
                    ));
                    assert.ok(isSameCoordinateSet(
                        coordinateSet(lockedMarks),
                        coordinateSet(completeSourcePositions),
                    ));

                    const sourceKeys = coordinateSet(cellsForGuideUnit(sourceUnit));
                    const intersectionKeys = coordinateSet(cellsForGuideUnit(intersectingUnit));
                    for (const mark of eliminatedMarks) {
                        const key = coordinateKey(mark);
                        assert.equal(sourceKeys.has(key), false);
                        assert.equal(intersectionKeys.has(key), true);
                        assert.ok(candidates[mark.row][mark.col].includes(lockedValue));
                        assert.notEqual(solved[mark.row][mark.col], lockedValue);
                    }
                    assert.deepEqual(answerFrame.target, result.plan.target);

                    if (result.plan.derivedResult === 'naked') {
                        assert.deepEqual(guideForCells(removeFrame.unitCells), sourceUnit);
                        assert.deepEqual(removeFrame.guideUnits, [intersectingUnit]);
                        const transition = removeFrame.candidateTransition;
                        assert.ok(transition);
                        assert.deepEqual(
                            transition.beforeCandidates,
                            [...candidates[row][col]],
                        );
                        assert.equal(transition.beforeCandidates.length, 2);
                        assert.ok(transition.beforeCandidates.includes(lockedValue));
                        assert.equal(transition.removedValue, lockedValue);
                        assert.deepEqual(transition.afterCandidates, [value]);
                        assert.deepEqual(
                            eliminatedMarks.map(mark => ({ row: mark.row, col: mark.col })),
                            [{ row, col }],
                        );
                        assert.equal(answerFrame.unitCells, undefined);
                    } else {
                        assert.equal(result.plan.derivedResult, 'hidden');
                        assert.deepEqual(
                            guideForCells(removeFrame.unitCells),
                            guideForCells(answerFrame.unitCells),
                        );
                        assert.equal(removeFrame.guideUnits, undefined);
                        assert.ok(isSameCoordinateSet(
                            coordinateSet(removeFrame.candidateMarks.filter(mark => mark.tone === 'locked')),
                            coordinateSet(lockedMarks),
                        ));
                        assert.equal(removeFrame.candidateTransition, undefined);
                        assert.ok(eliminatedMarks.length <= 3, 'hidden-result visuals must stay uncluttered');
                        assert.equal(value, lockedValue);
                        assert.ok(answerFrame.unitCells?.length === 9);
                        assert.equal(
                            eliminatedMarks.some(mark => mark.row === row && mark.col === col),
                            false,
                        );
                        const resultUnit = guideForCells(answerFrame.unitCells);
                        const resultUnitKeys = coordinateSet(cellsForGuideUnit(resultUnit));
                        assert.ok(eliminatedMarks.every(mark => resultUnitKeys.has(coordinateKey(mark))));
                        const beforePositions = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && candidates[cell.row][cell.col].includes(value)
                        ));
                        const afterCandidates = candidates.map(candidateRow => (
                            candidateRow.map(cellCandidates => [...cellCandidates])
                        ));
                        for (const mark of eliminatedMarks) {
                            afterCandidates[mark.row][mark.col] = afterCandidates[mark.row][mark.col]
                                .filter(candidate => candidate !== value);
                        }
                        const afterPositions = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && afterCandidates[cell.row][cell.col].includes(value)
                        ));
                        assert.ok(beforePositions.length > 1);
                        assert.deepEqual(afterPositions, [{ row, col }]);
                        assert.deepEqual(candidates[row][col], afterCandidates[row][col]);

                        const answerLockedMarks = answerFrame.candidateMarks.filter(mark => (
                            mark.tone === 'locked'
                        ));
                        const answerEliminations = answerFrame.candidateMarks.filter(mark => (
                            mark.tone === 'eliminated'
                        ));
                        const answerMarks = answerFrame.candidateMarks.filter(mark => (
                            mark.tone === 'answer'
                        ));
                        const expectedAnswerEliminations = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && (cell.row !== row || cell.col !== col)
                        ));
                        assert.deepEqual(answerLockedMarks, []);
                        assert.ok(isSameCoordinateSet(
                            coordinateSet(answerEliminations),
                            coordinateSet(expectedAnswerEliminations),
                        ));
                        assert.deepEqual(answerMarks, [{ row, col, value, tone: 'answer' }]);
                        assert.equal(answerFrame.sourceCells, undefined);
                        const causalKeys = coordinateSet(eliminatedMarks);
                        const preBlockedEliminations = expectedAnswerEliminations.filter(cell => (
                            !causalKeys.has(coordinateKey(cell))
                        ));
                        const supportSourceCells = answerFrame.supportSourceCells ?? [];
                        if (preBlockedEliminations.length > 0) assert.ok(supportSourceCells.length > 0);
                        else assert.deepEqual(supportSourceCells, []);
                        for (const source of supportSourceCells) {
                            assert.equal(numericGrid[source.row][source.col], value);
                            assert.ok(preBlockedEliminations.some(cell => isPeer(source, cell)));
                        }
                        for (const mark of preBlockedEliminations) {
                            assert.ok(supportSourceCells.some(source => isPeer(source, mark)));
                        }
                        assert.equal(
                            answerFrame.candidateMarks.length,
                            answerEliminations.length + answerMarks.length,
                        );
                    }
                }

                if (result.plan.technique === 'nakedPair') {
                    nakedPairSteps += 1;
                    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
                    const pairUnit = guideForCells(findFrame.unitCells);
                    nakedPairUnits.add(pairUnit.kind);
                    nakedPairResults.add(result.plan.derivedResult);
                    const numericGrid = board.map(boardRow => boardRow.map(cell => cell.value ?? 0));
                    const candidates = candidateGrid(numericGrid);
                    const pairSets = findFrame.candidateNoteSets;

                    assert.ok(
                        result.plan.derivedResult === 'naked'
                        || result.plan.derivedResult === 'hidden',
                    );
                    assert.equal(pairSets.length, 2);
                    assert.equal(new Set(pairSets.map(coordinateKey)).size, 2);
                    const pairValues = pairSets[0].marks.map(mark => mark.value);
                    assert.equal(pairValues.length, 2);
                    assert.ok(pairValues[0] < pairValues[1]);
                    assert.ok(pairSets.every(noteSet => (
                        noteSet.marks.every(mark => mark.tone === 'locked')
                        && isSameCoordinateSet(
                            new Set(noteSet.marks.map(mark => `${mark.value}`)),
                            new Set(pairValues.map(pairValue => `${pairValue}`)),
                        )
                        && isSameCoordinateSet(
                            new Set(candidates[noteSet.row][noteSet.col].map(candidate => `${candidate}`)),
                            new Set(pairValues.map(pairValue => `${pairValue}`)),
                        )
                    )));
                    const unitKeys = coordinateSet(cellsForGuideUnit(pairUnit));
                    assert.ok(pairSets.every(noteSet => unitKeys.has(coordinateKey(noteSet))));
                    assert.deepEqual(
                        new Set(pairSets.map(noteSet => solved[noteSet.row][noteSet.col])),
                        new Set(pairValues),
                    );
                    const exactPairCells = cellsForGuideUnit(pairUnit).filter(cell => (
                        isSameCoordinateSet(
                            new Set(candidates[cell.row][cell.col].map(candidate => `${candidate}`)),
                            new Set(pairValues.map(pairValue => `${pairValue}`)),
                        )
                    ));
                    assert.equal(exactPairCells.length, 2);

                    assert.ok(result.plan.candidateEliminations.length > 0);
                    for (const elimination of result.plan.candidateEliminations) {
                        assert.equal(unitKeys.has(coordinateKey(elimination)), true);
                        assert.equal(pairSets.some(noteSet => coordinateKey(noteSet) === coordinateKey(elimination)), false);
                        assert.deepEqual(elimination.beforeCandidates, candidates[elimination.row][elimination.col]);
                        assert.deepEqual(
                            elimination.removedValues,
                            elimination.beforeCandidates.filter(candidate => pairValues.includes(candidate)),
                        );
                        assert.deepEqual(
                            elimination.afterCandidates,
                            elimination.beforeCandidates.filter(candidate => !pairValues.includes(candidate)),
                        );
                        assert.ok(elimination.removedValues.length > 0);
                        assert.ok(elimination.afterCandidates.length > 0);
                        assert.equal(elimination.removedValues.includes(solved[elimination.row][elimination.col]), false);
                    }

                    assert.deepEqual(answerFrame.target, result.plan.target);
                    if (result.plan.derivedResult === 'naked') {
                        const targetElimination = result.plan.candidateEliminations.find(elimination => (
                            elimination.row === row && elimination.col === col
                        ));
                        assert.ok(targetElimination);
                        assert.deepEqual(targetElimination.afterCandidates, [value]);
                        assert.deepEqual(removeFrame.candidateNoteSets.at(-1).marks, [
                            ...targetElimination.beforeCandidates.map(candidate => ({
                                value: candidate,
                                tone: targetElimination.afterCandidates.includes(candidate)
                                    ? 'remaining'
                                    : 'removed',
                            })),
                        ]);
                        assert.deepEqual(answerFrame.candidateMarks, [{ ...result.plan.target, tone: 'answer' }]);
                    } else {
                        assert.equal(result.plan.derivedResult, 'hidden');
                        assert.equal(
                            result.plan.candidateEliminations.some(elimination => (
                                elimination.row === row && elimination.col === col
                            )),
                            false,
                        );
                        assert.deepEqual(removeFrame.candidateNoteSets, pairSets);
                        assert.equal(removeFrame.guideUnits, undefined);
                        assert.equal(removeFrame.candidateTransition, undefined);

                        const resultUnit = guideForCells(answerFrame.unitCells);
                        assert.deepEqual(guideForCells(removeFrame.unitCells), resultUnit);
                        const resultUnitKeys = coordinateSet(cellsForGuideUnit(resultUnit));
                        const causalMarks = removeFrame.candidateMarks.filter(mark => (
                            mark.tone === 'eliminated'
                        ));
                        assert.ok(causalMarks.length > 0);
                        assert.ok(causalMarks.every(mark => (
                            mark.value === value
                            && resultUnitKeys.has(coordinateKey(mark))
                            && result.plan.candidateEliminations.some(elimination => (
                                coordinateKey(elimination) === coordinateKey(mark)
                                && elimination.removedValues.includes(value)
                            ))
                        )));

                        const beforePositions = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && candidates[cell.row][cell.col].includes(value)
                        ));
                        const afterCandidates = candidates.map(candidateRow => (
                            candidateRow.map(cellCandidates => [...cellCandidates])
                        ));
                        for (const elimination of result.plan.candidateEliminations) {
                            afterCandidates[elimination.row][elimination.col] = [
                                ...elimination.afterCandidates,
                            ];
                        }
                        const afterPositions = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && afterCandidates[cell.row][cell.col].includes(value)
                        ));
                        assert.ok(beforePositions.length > 1);
                        assert.deepEqual(afterPositions, [{ row, col }]);
                        assert.ok(afterCandidates[row][col].length > 1);

                        const answerEliminations = answerFrame.candidateMarks.filter(mark => (
                            mark.tone === 'eliminated'
                        ));
                        const answerMarks = answerFrame.candidateMarks.filter(mark => (
                            mark.tone === 'answer'
                        ));
                        const expectedAnswerEliminations = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && (cell.row !== row || cell.col !== col)
                        ));
                        assert.ok(isSameCoordinateSet(
                            coordinateSet(answerEliminations),
                            coordinateSet(expectedAnswerEliminations),
                        ));
                        assert.deepEqual(answerMarks, [{ row, col, value, tone: 'answer' }]);
                        assert.equal(answerFrame.sourceCells, undefined);

                        const causalKeys = coordinateSet(causalMarks);
                        const preBlockedEliminations = expectedAnswerEliminations.filter(cell => (
                            !causalKeys.has(coordinateKey(cell))
                            && !candidates[cell.row][cell.col].includes(value)
                        ));
                        const supportSourceCells = answerFrame.supportSourceCells ?? [];
                        if (preBlockedEliminations.length > 0) assert.ok(supportSourceCells.length > 0);
                        else assert.deepEqual(supportSourceCells, []);
                        for (const source of supportSourceCells) {
                            assert.equal(numericGrid[source.row][source.col], value);
                            assert.ok(preBlockedEliminations.some(cell => isPeer(source, cell)));
                        }
                        for (const mark of preBlockedEliminations) {
                            assert.ok(supportSourceCells.some(source => isPeer(source, mark)));
                        }
                    }
                }

                if (result.plan.technique === 'nakedTriple') {
                    nakedTripleSteps += 1;
                    const [findFrame, removeFrame, answerFrame] = result.plan.frames;
                    const tripleUnit = guideForCells(findFrame.unitCells);
                    nakedTripleUnits.add(tripleUnit.kind);
                    nakedTripleResults.add(result.plan.derivedResult);
                    const numericGrid = board.map(boardRow => (
                        boardRow.map(cell => cell.value ?? 0)
                    ));
                    const candidates = candidateGrid(numericGrid);
                    const tripleSets = findFrame.candidateNoteSets;
                    const tripleValues = [...new Set(tripleSets.flatMap(noteSet => (
                        noteSet.marks.map(mark => mark.value)
                    )))].sort((left, right) => left - right);

                    assert.equal(tripleSets.length, 3);
                    assert.equal(new Set(tripleSets.map(coordinateKey)).size, 3);
                    assert.equal(tripleValues.length, 3);
                    assert.ok(tripleSets.every(noteSet => (
                        noteSet.marks.length >= 2
                        && noteSet.marks.length <= 3
                        && noteSet.marks.every(mark => mark.tone === 'locked')
                        && isSameCoordinateSet(
                            new Set(noteSet.marks.map(mark => `${mark.value}`)),
                            new Set(candidates[noteSet.row][noteSet.col].map(candidate => `${candidate}`)),
                        )
                    )));
                    nakedTripleShapes.add(
                        tripleSets.map(noteSet => noteSet.marks.length).sort().join('/'),
                    );
                    const unitKeys = coordinateSet(cellsForGuideUnit(tripleUnit));
                    const tripleKeys = coordinateSet(tripleSets);
                    assert.ok(tripleSets.every(noteSet => unitKeys.has(coordinateKey(noteSet))));
                    assert.deepEqual(
                        new Set(tripleSets.map(noteSet => solved[noteSet.row][noteSet.col])),
                        new Set(tripleValues),
                    );

                    assert.ok(result.plan.candidateEliminations.length > 0);
                    for (const elimination of result.plan.candidateEliminations) {
                        assert.equal(unitKeys.has(coordinateKey(elimination)), true);
                        assert.equal(tripleKeys.has(coordinateKey(elimination)), false);
                        assert.deepEqual(
                            elimination.beforeCandidates,
                            candidates[elimination.row][elimination.col],
                        );
                        assert.deepEqual(
                            elimination.removedValues,
                            elimination.beforeCandidates.filter(candidate => (
                                tripleValues.includes(candidate)
                            )),
                        );
                        assert.deepEqual(
                            elimination.afterCandidates,
                            elimination.beforeCandidates.filter(candidate => (
                                !tripleValues.includes(candidate)
                            )),
                        );
                        assert.ok(elimination.removedValues.length > 0);
                        assert.ok(elimination.afterCandidates.length > 0);
                        assert.equal(
                            elimination.removedValues.includes(
                                solved[elimination.row][elimination.col],
                            ),
                            false,
                        );
                    }

                    assert.deepEqual(answerFrame.target, result.plan.target);
                    if (result.plan.derivedResult === 'naked') {
                        const targetElimination = result.plan.candidateEliminations.find(
                            elimination => (
                                elimination.row === row && elimination.col === col
                            ),
                        );
                        assert.ok(targetElimination);
                        assert.deepEqual(targetElimination.afterCandidates, [value]);
                        assert.deepEqual(answerFrame.candidateMarks, [
                            { row, col, value, tone: 'answer' },
                        ]);
                    } else {
                        assert.equal(result.plan.derivedResult, 'hidden');
                        const resultUnit = guideForCells(answerFrame.unitCells);
                        assert.deepEqual(guideForCells(removeFrame.unitCells), resultUnit);
                        const resultUnitKeys = coordinateSet(cellsForGuideUnit(resultUnit));
                        const causalMarks = removeFrame.candidateMarks.filter(mark => (
                            mark.tone === 'eliminated'
                        ));
                        assert.ok(causalMarks.length > 0);
                        assert.ok(causalMarks.every(mark => (
                            mark.value === value
                            && resultUnitKeys.has(coordinateKey(mark))
                            && result.plan.candidateEliminations.some(elimination => (
                                coordinateKey(elimination) === coordinateKey(mark)
                                && elimination.removedValues.includes(value)
                            ))
                        )));
                        const afterCandidates = candidates.map(candidateRow => (
                            candidateRow.map(cellCandidates => [...cellCandidates])
                        ));
                        for (const elimination of result.plan.candidateEliminations) {
                            afterCandidates[elimination.row][elimination.col] = [
                                ...elimination.afterCandidates,
                            ];
                        }
                        const beforePositions = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && candidates[cell.row][cell.col].includes(value)
                        ));
                        const afterPositions = cellsForGuideUnit(resultUnit).filter(cell => (
                            numericGrid[cell.row][cell.col] === 0
                            && afterCandidates[cell.row][cell.col].includes(value)
                        ));
                        assert.ok(beforePositions.length > 1);
                        assert.deepEqual(afterPositions, [{ row, col }]);
                    }
                }

                if (result.plan.technique === 'multiStep') {
                    multiStepPlans += 1;
                    maxMultiStepDeductions = Math.max(
                        maxMultiStepDeductions,
                        result.plan.deductions.length,
                    );
                    multiStepSequences.add(
                        result.plan.deductions.map(deduction => deduction.technique).join('>'),
                    );
                    assert.ok(
                        result.plan.deductions.length >= 2
                        && result.plan.deductions.length <= 3,
                    );
                    assert.equal(
                        result.plan.frames.length,
                        result.plan.deductions.length * 2 + 1,
                    );
                    assert.deepEqual(
                        result.plan.candidateEliminations,
                        result.plan.deductions.flatMap(deduction => (
                            deduction.candidateEliminations
                        )),
                    );

                    const numericGrid = board.map(boardRow => (
                        boardRow.map(cell => cell.value ?? 0)
                    ));
                    const simulatedCandidates = candidateGrid(numericGrid);
                    assert.deepEqual([...simulatedPlacements(numericGrid, simulatedCandidates)], []);

                    result.plan.deductions.forEach((deduction, deductionIndex) => {
                        const beforeCount = simulatedCandidates.flat().reduce((sum, cell) => (
                            sum + cell.length
                        ), 0);
                        for (const elimination of deduction.candidateEliminations) {
                            assert.deepEqual(
                                simulatedCandidates[elimination.row][elimination.col],
                                elimination.beforeCandidates,
                            );
                            assert.deepEqual(
                                elimination.afterCandidates,
                                elimination.beforeCandidates.filter(candidate => (
                                    !elimination.removedValues.includes(candidate)
                                )),
                            );
                            assert.ok(elimination.removedValues.length > 0);
                            assert.ok(elimination.afterCandidates.length > 0);
                            assert.equal(
                                elimination.removedValues.includes(
                                    solved[elimination.row][elimination.col],
                                ),
                                false,
                            );
                            simulatedCandidates[elimination.row][elimination.col] = [
                                ...elimination.afterCandidates,
                            ];
                        }
                        const afterCount = simulatedCandidates.flat().reduce((sum, cell) => (
                            sum + cell.length
                        ), 0);
                        assert.ok(afterCount < beforeCount);

                        const placements = simulatedPlacements(numericGrid, simulatedCandidates);
                        if (deductionIndex < result.plan.deductions.length - 1) {
                            assert.deepEqual([...placements], []);
                        } else {
                            assert.ok(placements.has(`${row}:${col}:${value}`));
                        }
                    });
                }

                board[row][col].value = value;
                board[row][col].notes = [];
                board[row][col].isFixed = false;
            }

            assert.equal(
                terminated,
                true,
                `${difficulty} ${levelId} Hint path must terminate within 81 placements`,
            );
        }
    }

    assert.ok(lockedSteps > 0, 'the catalogue traversal must exercise Locked Candidates');
    assert.deepEqual(lockedVariants, new Set([
        'box->row',
        'box->column',
        'row->box',
        'column->box',
    ]));
    assert.deepEqual(lockedResults, new Set(['naked', 'hidden']));
    assert.ok(nakedPairSteps > 0, 'the catalogue traversal must exercise Naked Pairs');
    assert.deepEqual(nakedPairUnits, new Set(['row', 'column', 'box']));
    assert.deepEqual(nakedPairResults, new Set(['naked', 'hidden']));
    assert.ok(nakedTripleSteps > 0, 'the catalogue traversal must exercise Naked Triples');
    assert.deepEqual(nakedTripleUnits, new Set(['row', 'column', 'box']));
    assert.deepEqual(nakedTripleResults, new Set(['naked', 'hidden']));
    assert.ok(nakedTripleShapes.has('2/2/2'));
    assert.ok(
        [...nakedTripleShapes].some(shape => shape !== '2/2/2'),
        'the catalogue traversal must exercise a mixed-subset Naked Triple',
    );
    assert.ok(multiStepPlans > 0, 'the catalogue traversal must exercise multi-step Hints');
    assert.ok(maxMultiStepDeductions >= 2 && maxMultiStepDeductions <= 3);
    assert.ok(multiStepSequences.has('lockedCandidate>nakedPair'));
    assert.ok(multiStepSequences.has('nakedTriple>nakedPair'));
});

skipLegacyPlacementContract = false;

const candidatesWithProgress = (board, progress) => {
    const grid = board.map(row => row.map(cell => cell.value ?? 0));
    const candidates = candidateGrid(grid);
    for (const exclusion of progress?.exclusions ?? []) {
        candidates[exclusion.row][exclusion.col] = candidates[exclusion.row][exclusion.col]
            .filter(value => value !== exclusion.value);
    }
    return candidates;
};

const assertTextParts = (parts, fallback, label) => {
    if (!parts) return;
    assert.equal(parts.map(part => part.text).join(''), fallback, `${label} semantic copy`);
    assert.ok(parts.every(part => typeof part.text === 'string' && part.text.length > 0));
};

const toneTexts = (frame, field, tone) => (frame[field] ?? [])
    .filter(part => part.tone === tone)
    .map(part => part.text);

const assertToneText = (frame, field, tone, expected, label) => {
    assert.ok(
        toneTexts(frame, field, tone).includes(`${expected}`),
        `${label}: expected ${tone} ${expected} in ${field}`,
    );
};

const assertCandidatePlanContract = (
    plan,
    board,
    solution,
    progress = null,
    label = plan.technique,
) => {
    assert.equal(plan.outcome, 'candidate', `${label} must end with a candidate update`);
    assert.equal(plan.target, undefined, `${label} must not carry a placement target`);
    assert.equal(plan.derivedResult, undefined, `${label} must not promise a placement result`);
    assert.ok(plan.candidateEliminations.length > 0, `${label} needs solver deltas`);
    assert.ok(plan.noteUpdates.length > 0, `${label} needs a visible note update`);
    assert.ok(plan.deductions.length > 0, `${label} needs deduction metadata`);
    assert.equal(new Set(plan.frames.map(frame => frame.id)).size, plan.frames.length);
    assertPresentationContract(plan, label);

    for (const frame of plan.frames) {
        assert.equal(frame.target, undefined, `${label}/${frame.id} cannot place a number`);
        assert.equal(
            (frame.candidateMarks ?? []).some(mark => mark.tone === 'answer'),
            false,
            `${label}/${frame.id} cannot show an answer mark`,
        );
        assert.equal(frame.id.includes('answer'), false, `${label}/${frame.id} cannot be an answer frame`);
        assertTextParts(frame.titleParts, frame.title, `${label}/${frame.id} title`);
        assertTextParts(frame.bodyParts, frame.body, `${label}/${frame.id} body`);
    }

    const currentDeduction = plan.deductions.at(-1);
    const currentCells = coordinateSet(currentDeduction.candidateEliminations);
    const finalFrame = plan.frames.at(-1);
    assert.ok(finalFrame.id.endsWith('update'));
    assert.equal(finalFrame.eliminationStyle, 'candidate-slash');
    assert.equal(finalFrame.fillEliminatedCells, false);
    assert.ok(isSameCoordinateSet(
        coordinateSet(finalFrame.candidateUpdateCells),
        currentCells,
    ), `${label} final update cells must match its current deduction`);
    assert.ok(finalFrame.titleParts || finalFrame.bodyParts, `${label} needs semantic final copy`);

    const simulated = candidatesWithProgress(board, progress);
    for (const elimination of plan.candidateEliminations) {
        assert.deepEqual(
            elimination.beforeCandidates,
            simulated[elimination.row][elimination.col],
            `${label} delta must start from solver candidates`,
        );
        assert.ok(elimination.removedValues.length > 0);
        assert.equal(new Set(elimination.removedValues).size, elimination.removedValues.length);
        assert.deepEqual(
            elimination.afterCandidates,
            elimination.beforeCandidates.filter(value => (
                !elimination.removedValues.includes(value)
            )),
        );
        assert.ok(elimination.afterCandidates.length > 0);
        assert.equal(
            elimination.removedValues.includes(solution[elimination.row][elimination.col]),
            false,
            `${label} cannot remove the solution candidate`,
        );
        simulated[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }

    const affectedKeys = coordinateSet(plan.candidateEliminations);
    for (const update of plan.noteUpdates) {
        const beforeNotes = [...new Set(board[update.row][update.col].notes)].sort((a, b) => a - b);
        assert.deepEqual(update.beforeNotes, beforeNotes);
        assert.notDeepEqual(update.afterNotes, update.beforeNotes);
        assert.ok(affectedKeys.has(coordinateKey(update)));
        const removedHere = plan.candidateEliminations
            .filter(delta => coordinateKey(delta) === coordinateKey(update))
            .flatMap(delta => delta.removedValues);
        if (update.beforeNotes.length === 0) {
            assert.deepEqual(update.afterNotes, simulated[update.row][update.col]);
        } else {
            assert.deepEqual(
                update.afterNotes,
                update.beforeNotes.filter(value => !removedHere.includes(value)),
            );
        }
    }
};

const assertAdvancedVisualLogic = (plan, label) => {
    const [findFrame] = plan.frames;
    const finalFrame = plan.frames.at(-1);
    const expectedFrameCounts = {
        lockedCandidate: 2,
        nakedPair: 2,
        hiddenPair: 2,
        nakedTriple: 2,
        hiddenTriple: 2,
        xWing: 2,
        swordfish: 3,
        xyWing: 4,
        simpleColoring: 4,
    };
    assert.equal(plan.frames.length, expectedFrameCounts[plan.technique], label);
    assert.equal(finalFrame.dimUnrelated, true);
    assert.ok((finalFrame.candidateMarks ?? []).some(mark => mark.tone === 'eliminated'));

    if (plan.technique === 'lockedCandidate') {
        const locked = findFrame.candidateMarks.filter(mark => mark.tone === 'locked');
        assert.ok(locked.length >= 2 && locked.length <= 3);
        assert.equal(findFrame.unitCells.length, 9);
        assert.equal(finalFrame.guideUnits.length, 1);
        assertToneText(findFrame, 'titleParts', 'source', locked[0].value, label);
        assertToneText(findFrame, 'bodyParts', 'source', locked[0].value, label);
        assertToneText(finalFrame, 'titleParts', 'removed', locked[0].value, label);
        assert.equal(findFrame.titleParts[0].tone, undefined, `${label}: count stays neutral`);
    } else if (plan.technique === 'nakedPair') {
        assert.equal(findFrame.candidateNoteSets.length, 2);
        assert.deepEqual(
            new Set(findFrame.candidateNoteSets.map(set => set.marks.length)),
            new Set([2]),
        );
        const values = findFrame.candidateNoteSets[0].marks.map(mark => mark.value);
        values.forEach(value => {
            assertToneText(findFrame, 'bodyParts', 'source', value, label);
            assertToneText(finalFrame, 'titleParts', 'source', value, label);
        });
    } else if (plan.technique === 'hiddenPair') {
        assert.equal(findFrame.candidateNoteSets.length, 2);
        assert.equal(findFrame.unitCells.length, 9);
        const values = [...new Set(findFrame.candidateNoteSets.flatMap(set => (
            set.marks.filter(mark => mark.tone === 'locked').map(mark => mark.value)
        )))];
        values.forEach(value => {
            assertToneText(findFrame, 'titleParts', 'source', value, label);
            assertToneText(finalFrame, 'titleParts', 'remaining', value, label);
        });
    } else if (plan.technique === 'hiddenTriple') {
        assert.equal(findFrame.candidateNoteSets.length, 3);
        assert.equal(findFrame.unitCells.length, 9);
        const values = new Set(findFrame.candidateNoteSets.flatMap(set => (
            set.marks.filter(mark => mark.tone === 'locked').map(mark => mark.value)
        )));
        assert.equal(values.size, 3);
        values.forEach(value => {
            assertToneText(findFrame, 'titleParts', 'source', value, label);
            assertToneText(finalFrame, 'titleParts', 'remaining', value, label);
        });
    } else if (plan.technique === 'nakedTriple') {
        assert.equal(findFrame.candidateNoteSets.length, 3);
        const values = new Set(findFrame.candidateNoteSets.flatMap(set => (
            set.marks.map(mark => mark.value)
        )));
        assert.equal(values.size, 3);
        values.forEach(value => {
            assertToneText(findFrame, 'bodyParts', 'source', value, label);
            assertToneText(finalFrame, 'titleParts', 'source', value, label);
        });
    } else if (plan.technique === 'xWing') {
        assert.equal(findFrame.candidateMarks.filter(mark => mark.tone === 'locked').length, 4);
        assert.equal(findFrame.guideUnits.length, 2);
        assert.equal(finalFrame.guideUnits.length, 2);
        const value = findFrame.candidateMarks[0].value;
        assertToneText(findFrame, 'titleParts', 'source', value, label);
        assertToneText(findFrame, 'bodyParts', 'source', value, label);
        assertToneText(finalFrame, 'titleParts', 'removed', value, label);
    } else if (plan.technique === 'swordfish') {
        const sourceMarks = findFrame.candidateMarks.filter(mark => mark.tone === 'locked');
        assert.ok(sourceMarks.length >= 6 && sourceMarks.length <= 9);
        assert.equal(new Set(sourceMarks.map(mark => mark.value)).size, 1);
        assert.equal(findFrame.guideUnits.length, 3);
        assert.equal(plan.frames[1].id, 'candidate-swordfish-reserve');
        assert.equal(plan.frames[1].guideUnits.length, 3);
        assert.equal(plan.frames[1].guideStrokeTone, 'support');
        assert.deepEqual(plan.frames[1].spotlightCells, []);
        assert.deepEqual(plan.frames[1].candidateMarks, findFrame.candidateMarks);
        assert.equal(plan.frames[1].candidateMarks.some(mark => mark.tone === 'eliminated'), false);
        assert.equal(plan.frames[1].candidateUpdateCells, undefined);
        assert.equal(finalFrame.guideUnits.length, 3);
        assert.equal(finalFrame.guideStrokeTone, 'soft');
        assertToneText(findFrame, 'titleParts', 'source', sourceMarks[0].value, label);
        assertToneText(plan.frames[1], 'titleParts', 'source', sourceMarks[0].value, label);
        assertToneText(finalFrame, 'titleParts', 'removed', sourceMarks[0].value, label);
    } else if (plan.technique === 'xyWing') {
        assert.deepEqual(
            plan.frames.map(frame => frame.id),
            ['candidate-xy-wing-pivot', 'candidate-xy-wing-first', 'candidate-xy-wing-second', 'candidate-xy-wing-update'],
        );
        assert.equal(plan.frames[0].candidateNoteSets[0].marks.length, 2);
        assert.equal(plan.frames[1].candidateNoteSets.at(-1).marks.length, 2);
        assert.equal(plan.frames[2].candidateNoteSets.at(-1).marks.length, 2);
        plan.frames[0].candidateNoteSets[0].marks.forEach(mark => {
            assert.equal(mark.tone, 'locked');
            assertToneText(plan.frames[0], 'titleParts', 'source', mark.value, label);
        });
        for (const frame of [plan.frames[1], plan.frames[2]]) {
            const wingMarks = frame.candidateNoteSets.at(-1).marks;
            const linked = wingMarks.find(mark => mark.tone === 'locked');
            const sharedResult = wingMarks.find(mark => mark.tone === 'support');
            assertToneText(frame, 'titleParts', 'source', linked.value, label);
            assertToneText(frame, 'titleParts', 'support', sharedResult.value, label);
            assertToneText(frame, 'bodyParts', 'source', linked.value, label);
            assert.equal(frame.candidateNoteSets.flatMap(noteSet => noteSet.marks)
                .some(mark => mark.tone === 'possible'), false);
        }
        assertToneText(
            finalFrame,
            'titleParts',
            'support',
            finalFrame.candidateMarks.find(mark => mark.tone === 'eliminated').value,
            label,
        );
    } else if (plan.technique === 'simpleColoring') {
        assert.deepEqual(
            plan.frames.map(frame => frame.id),
            ['candidate-color-start', 'candidate-color-chain', 'candidate-color-rule', 'candidate-color-update'],
        );
        const colored = plan.frames[1].candidateMarks;
        assert.ok(colored.length >= 2 && colored.length <= 9);
        assert.ok(colored.some(mark => mark.tone === 'locked'));
        assert.ok(colored.some(mark => mark.tone === 'possible'));
        const value = colored[0].value;
        assertToneText(findFrame, 'titleParts', 'candidate', value, label);
        assert.ok(toneTexts(findFrame, 'bodyParts', 'source').includes('circle'));
        assert.ok(toneTexts(findFrame, 'bodyParts', 'support').includes('square'));
        assertToneText(finalFrame, 'titleParts', 'removed', value, label);
    }

    const removedValues = new Set((finalFrame.candidateMarks ?? [])
        .filter(mark => mark.tone === 'eliminated')
        .map(mark => `${mark.value}`));
    const removedCopy = new Set([
        ...toneTexts(finalFrame, 'titleParts', 'removed'),
        ...toneTexts(finalFrame, 'bodyParts', 'removed'),
    ]);
    removedValues.forEach(value => {
        assert.ok(removedCopy.has(value), `${label}: eliminated ${value} needs gray copy`);
    });
};

const applyCandidateStep = (board, solution, progress, plan, label) => {
    const boardBefore = deepClone(board);
    const progressBefore = deepClone(progress);
    const next = applyHintCandidatePlan(board, solution, progress, plan);
    assert.ok(next, `${label} candidate progress must apply atomically`);
    assert.deepEqual(board, boardBefore, `${label} ledger application must not mutate the board`);
    assert.deepEqual(progress, progressBefore, `${label} ledger application must not mutate prior progress`);
    plan.noteUpdates.forEach(update => {
        board[update.row][update.col].notes = [...update.afterNotes];
    });
    return next;
};

const walkCandidateHintsToPlacement = (
    board,
    solution,
    initialProgress = null,
    initialPlan = null,
    label = 'candidate path',
) => {
    let progress = initialProgress;
    let candidateDepth = 0;
    let plan = initialPlan;
    const seen = new Set();
    const techniques = [];
    for (let step = 0; step < 64; step += 1) {
        const stateKey = `${boardHintSignature(board)}|${progress ? hintCandidateProgressSignature(progress) : 'none'}`;
        assert.equal(seen.has(stateKey), false, `${label} cannot repeat a solver state`);
        seen.add(stateKey);
        const result = plan
            ? { status: 'ready', plan }
            : createHintPlan(board, solution, { candidateProgress: progress });
        plan = null;
        assert.equal(result.status, 'ready', `${label} stopped at ${result.status}`);
        techniques.push(result.plan.technique);
        if (result.plan.outcome === 'placement') {
            assert.equal(
                solution[result.plan.target.row][result.plan.target.col],
                result.plan.target.value,
            );
            if (result.plan.candidateEliminations?.length) {
                const advanced = applyHintCandidateProgress(
                    board,
                    solution,
                    progress,
                    result.plan,
                );
                assert.ok(advanced, `${label} carried eliminations must validate`);
                progress = advanced;
            }
            return { candidateDepth, placement: result.plan, progress, techniques };
        }
        assertCandidatePlanContract(result.plan, board, solution, progress, `${label} step ${step}`);
        const before = progress ? hintCandidateProgressSignature(progress) : 'none';
        progress = applyCandidateStep(board, solution, progress, result.plan, `${label} step ${step}`);
        assert.notEqual(hintCandidateProgressSignature(progress), before);
        candidateDepth += 1;
    }
    assert.fail(`${label} did not reach a placement within 64 candidate updates`);
};

const findCanonicalCandidatePlan = (
    levelId,
    predicate,
    label,
) => {
    const { initial, solved } = generateLevel(Difficulty.Impossible, levelId);
    const board = cloneHintBoard(initial);
    let progress = null;
    const seen = new Set();

    for (let action = 0; action < 256; action += 1) {
        const stateKey = `${boardHintSignature(board)}|${progress ? hintCandidateProgressSignature(progress) : 'none'}`;
        assert.equal(seen.has(stateKey), false, `${label} canonical path cannot cycle`);
        seen.add(stateKey);

        const result = createHintPlan(board, solved, { candidateProgress: progress });
        assert.equal(result.status, 'ready', `${label} stopped at ${result.status}`);
        if (result.plan.outcome === 'candidate' && predicate(result.plan)) {
            assert.deepEqual(
                createHintPlan(board, solved, { candidateProgress: progress }),
                result,
                `${label} must be deterministic`,
            );
            return { action, board, solved, progress, plan: result.plan };
        }

        if (result.plan.outcome === 'candidate') {
            progress = applyCandidateStep(
                board,
                solved,
                progress,
                result.plan,
                `${label} action ${action}`,
            );
            continue;
        }

        if (result.plan.candidateEliminations?.length) {
            progress = applyHintCandidateProgress(board, solved, progress, result.plan);
            assert.ok(progress, `${label} carried deductions must apply`);
        }
        const { row, col, value } = result.plan.target;
        assert.equal(solved[row][col], value, `${label} placement must match the solution`);
        board[row][col].value = value;
        board[row][col].isFixed = false;
        board[row][col].notes = [];
        board[row][col].isError = false;
        board[row][col].isMarkedWrong = false;
        progress = reconcileHintCandidateProgress(board, solved, progress);
    }

    assert.fail(`${label} did not reach its candidate fixture`);
};

const ADVANCED_CANDIDATE_FIXTURES = [
    ['locked pointing row', LOCKED_POINTING_ROW_PUZZLE, LOCKED_POINTING_ROW_SOLUTION, 'lockedCandidate'],
    ['locked pointing column', LOCKED_POINTING_COLUMN_PUZZLE, LOCKED_POINTING_COLUMN_SOLUTION, 'lockedCandidate'],
    ['locked claiming row', LOCKED_CLAIMING_ROW_PUZZLE, LOCKED_CLAIMING_ROW_SOLUTION, 'lockedCandidate'],
    ['locked claiming column', LOCKED_CLAIMING_COLUMN_PUZZLE, LOCKED_CLAIMING_COLUMN_SOLUTION, 'lockedCandidate'],
    ['locked hidden legacy', LOCKED_HIDDEN_PUZZLE, LOCKED_HIDDEN_SOLUTION, 'lockedCandidate'],
    ['naked pair', NAKED_PAIR_PUZZLE, NAKED_PAIR_SOLUTION, 'nakedPair', 'nakedPair'],
    ['naked pair hidden legacy', NAKED_PAIR_HIDDEN_PUZZLE, NAKED_PAIR_HIDDEN_SOLUTION, 'nakedPair', 'nakedPair'],
    ['hidden pair', HIDDEN_PAIR_PUZZLE, HIDDEN_PAIR_SOLUTION, 'hiddenPair', 'hiddenPair'],
    ['hidden pair chain legacy', HIDDEN_PAIR_CHAIN_PUZZLE, HIDDEN_PAIR_CHAIN_SOLUTION, 'hiddenPair', 'hiddenPair'],
    ['naked triple', NAKED_TRIPLE_PUZZLE, NAKED_TRIPLE_SOLUTION, 'nakedTriple', 'nakedTriple'],
    ['naked triple hidden legacy', NAKED_TRIPLE_HIDDEN_PUZZLE, NAKED_TRIPLE_HIDDEN_SOLUTION, 'nakedTriple', 'nakedTriple'],
    ['naked triple chain legacy', NAKED_TRIPLE_CHAIN_PUZZLE, NAKED_TRIPLE_CHAIN_SOLUTION, 'nakedTriple', 'nakedTriple'],
    ['X-Wing', X_WING_PUZZLE, X_WING_SOLUTION, 'xWing', 'xWing'],
    ['X-Wing hidden legacy', X_WING_HIDDEN_PUZZLE, X_WING_HIDDEN_SOLUTION, 'xWing', 'xWing'],
    ['X-Wing chain entry', X_WING_CHAIN_PUZZLE, X_WING_CHAIN_SOLUTION, 'hiddenPair'],
    ['XY-Wing', XY_WING_PUZZLE, XY_WING_SOLUTION, 'xyWing', 'xyWing'],
    ['XY-Wing hidden legacy', XY_WING_HIDDEN_PUZZLE, XY_WING_HIDDEN_SOLUTION, 'xyWing', 'xyWing'],
    ['XY-Wing chain entry', XY_WING_CHAIN_PUZZLE, XY_WING_CHAIN_SOLUTION, 'lockedCandidate'],
    ['multi-step legacy entry', MULTI_STEP_PUZZLE, MULTI_STEP_SOLUTION, 'lockedCandidate'],
    ['Color Trap', COLOR_CHAIN_PUZZLE, COLOR_CHAIN_SOLUTION, 'simpleColoring', 'simpleColoring'],
    ['Color Wrap', COLOR_CHAIN_WRAP_PUZZLE, COLOR_CHAIN_WRAP_SOLUTION, 'simpleColoring', 'simpleColoring'],
];

test('advanced fixtures end with safe visible candidate updates and later place a number', () => {
    const techniques = new Set();
    for (const [label, grid, solution, expectedTechnique, preferredTechnique] of ADVANCED_CANDIDATE_FIXTURES) {
        const board = makeBoard(grid);
        const before = deepClone(board);
        const options = preferredTechnique ? { preferredTechnique } : {};
        const result = createHintPlan(board, solution, options);
        assert.equal(result.status, 'ready', label);
        assert.equal(result.plan.outcome, 'candidate', label);
        assert.equal(result.plan.technique, expectedTechnique, label);
        assertCandidatePlanContract(result.plan, board, solution, null, label);
        assertAdvancedVisualLogic(result.plan, label);
        assert.deepEqual(createHintPlan(board, solution, options), result, `${label} determinism`);
        assert.deepEqual(board, before, `${label} planning must be read-only`);
        techniques.add(result.plan.technique);

        const firstProgress = applyCandidateStep(board, solution, null, result.plan, label);
        const path = walkCandidateHintsToPlacement(board, solution, firstProgress, null, label);
        assert.ok(path.candidateDepth >= 0);
    }
    assert.deepEqual(techniques, new Set([
        'lockedCandidate',
        'nakedPair',
        'hiddenPair',
        'nakedTriple',
        'xWing',
        'xyWing',
        'simpleColoring',
    ]));
});

test('Hidden Triple and Swordfish candidate theaters cover every unit orientation safely', () => {
    const fixtures = [
        {
            label: 'Hidden Triple box',
            levelId: 8,
            action: 16,
            technique: 'hiddenTriple',
            unit: { kind: 'box', index: 0 },
            values: [4, 6, 9],
            sourceCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }],
        },
        {
            label: 'Hidden Triple column',
            levelId: 96,
            action: 22,
            technique: 'hiddenTriple',
            unit: { kind: 'column', index: 0 },
            values: [4, 8, 9],
            sourceCells: [{ row: 0, col: 0 }, { row: 3, col: 0 }, { row: 4, col: 0 }],
        },
        {
            label: 'Hidden Triple row',
            levelId: 188,
            action: 13,
            technique: 'hiddenTriple',
            unit: { kind: 'row', index: 2 },
            values: [4, 7, 8],
            sourceCells: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 4 }],
        },
        {
            label: 'row Swordfish',
            levelId: 111,
            action: 27,
            technique: 'swordfish',
            value: 1,
            baseGuides: [{ kind: 'row', index: 0 }, { kind: 'row', index: 5 }, { kind: 'row', index: 8 }],
            coverGuides: [{ kind: 'column', index: 0 }, { kind: 'column', index: 4 }, { kind: 'column', index: 7 }],
        },
        {
            label: 'column Swordfish',
            levelId: 216,
            action: 34,
            technique: 'swordfish',
            value: 1,
            baseGuides: [{ kind: 'column', index: 2 }, { kind: 'column', index: 5 }, { kind: 'column', index: 8 }],
            coverGuides: [{ kind: 'row', index: 1 }, { kind: 'row', index: 4 }, { kind: 'row', index: 5 }],
        },
    ];

    for (const fixture of fixtures) {
        const matched = findCanonicalCandidatePlan(
            fixture.levelId,
            plan => plan.technique === fixture.technique,
            fixture.label,
        );
        assert.equal(matched.action, fixture.action, fixture.label);
        assert.equal(matched.plan.deductions.at(-1).technique, fixture.technique);
        assertCandidatePlanContract(
            matched.plan,
            matched.board,
            matched.solved,
            matched.progress,
            fixture.label,
        );
        assertAdvancedVisualLogic(matched.plan, fixture.label);

        if (fixture.technique === 'hiddenTriple') {
            assert.deepEqual(
                matched.plan.frames.map(frame => frame.id),
                ['candidate-hidden-triple-find', 'candidate-hidden-triple-update'],
            );
            assert.deepEqual(guideForCells(matched.plan.frames[0].unitCells), fixture.unit);
            assert.ok(isSameCoordinateSet(
                coordinateSet(matched.plan.frames[0].candidateNoteSets),
                coordinateSet(fixture.sourceCells),
            ));
            assert.deepEqual(
                [...new Set(matched.plan.frames[0].candidateNoteSets.flatMap(set => (
                    set.marks.filter(mark => mark.tone === 'locked').map(mark => mark.value)
                )))].sort((left, right) => left - right),
                fixture.values,
            );
        } else {
            assert.deepEqual(
                matched.plan.frames.map(frame => frame.id),
                ['candidate-swordfish-find', 'candidate-swordfish-reserve', 'candidate-swordfish-update'],
            );
            assert.deepEqual(matched.plan.frames[0].guideUnits, fixture.baseGuides);
            assert.deepEqual(matched.plan.frames[1].guideUnits, fixture.coverGuides);
            assert.deepEqual(matched.plan.frames[2].guideUnits, fixture.coverGuides);
            assert.ok(matched.plan.frames[0].candidateMarks.every(mark => (
                mark.tone === 'locked' && mark.value === fixture.value
            )));
        }

        const advanced = applyCandidateStep(
            matched.board,
            matched.solved,
            matched.progress,
            matched.plan,
            fixture.label,
        );
        assert.notEqual(
            hintCandidateProgressSignature(advanced),
            matched.progress ? hintCandidateProgressSignature(matched.progress) : 'none',
        );
    }
});

test('candidate-only Color Wrap permits the measured nine-cell explanation', () => {
    for (const [levelId, expectedAction] of [[179, 38], [245, 52]]) {
        const label = `Impossible ${levelId} nine-cell Color Wrap`;
        const matched = findCanonicalCandidatePlan(
            levelId,
            plan => (
                plan.technique === 'simpleColoring'
                && plan.frames[1]?.candidateMarks?.length === 9
            ),
            label,
        );
        assert.equal(matched.action, expectedAction, label);
        assertCandidatePlanContract(
            matched.plan,
            matched.board,
            matched.solved,
            matched.progress,
            label,
        );
        assertAdvancedVisualLogic(matched.plan, label);
        assert.deepEqual(
            matched.plan.frames.map(frame => frame.id),
            ['candidate-color-start', 'candidate-color-chain', 'candidate-color-rule', 'candidate-color-update'],
        );
        assert.equal(matched.plan.frames[1].candidateMarks.length, 9);
        assert.match(matched.plan.frames[2].title, /^Two square \d+s see each other$/);
        assert.ok(applyCandidateStep(
            matched.board,
            matched.solved,
            matched.progress,
            matched.plan,
            label,
        ));
    }
});

test('Hidden Triple and Swordfish previews replay their real production paths', () => {
    const cases = [
        {
            preview: 'hidden-triple',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 8 },
            technique: 'hiddenTriple',
            frameIds: ['candidate-hidden-triple-find', 'candidate-hidden-triple-update'],
        },
        {
            preview: 'swordfish',
            puzzle: { difficulty: Difficulty.Impossible, levelId: 111 },
            technique: 'swordfish',
            frameIds: ['candidate-swordfish-find', 'candidate-swordfish-reserve', 'candidate-swordfish-update'],
        },
    ];

    for (const expected of cases) {
        assert.equal(isDevHintPreview(expected.preview), true);
        assert.deepEqual(getDevHintPreviewPuzzle(expected.preview), expected.puzzle);
        assert.equal(
            scopeDevHintPreview(
                expected.preview,
                expected.puzzle.difficulty,
                expected.puzzle.levelId,
            ),
            expected.preview,
        );
        const preview = createDevHintPreview(expected.preview);
        assert.equal(preview.plan.outcome, 'candidate');
        assert.equal(preview.plan.technique, expected.technique);
        assert.deepEqual(preview.plan.frames.map(frame => frame.id), expected.frameIds);
        assertCandidatePlanContract(
            preview.plan,
            preview.board,
            generateLevel(expected.puzzle.difficulty, expected.puzzle.levelId).solved,
            preview.candidateProgress,
            `${expected.preview} preview`,
        );
        assert.deepEqual(createDevHintPreview(expected.preview), preview);
    }
});

test('candidate progress reconciles forward play and rejects corruption or stale plans', () => {
    const board = makeBoard(LOCKED_POINTING_ROW_PUZZLE);
    const result = createHintPlan(board, LOCKED_POINTING_ROW_SOLUTION);
    assert.equal(result.status, 'ready');
    assert.equal(result.plan.outcome, 'candidate');
    const planSnapshot = deepClone(result.plan);
    const initial = createHintCandidateProgress(board);
    const initialSnapshot = deepClone(initial);
    const progress = applyHintCandidatePlan(
        deepFreeze(deepClone(board)),
        deepFreeze(deepClone(LOCKED_POINTING_ROW_SOLUTION)),
        deepFreeze(initial),
        deepFreeze(result.plan),
    );
    assert.ok(progress);
    assert.deepEqual(initial, initialSnapshot);
    assert.deepEqual(result.plan, planSnapshot);
    assert.equal(progress.exclusions.length, result.plan.candidateEliminations.reduce(
        (sum, delta) => sum + delta.removedValues.length,
        0,
    ));
    assert.deepEqual(
        progress.exclusions,
        [...progress.exclusions].sort((left, right) => (
            left.row - right.row || left.col - right.col || left.value - right.value
        )),
    );
    assert.equal(hasValidHintCandidateProgressIntegrity(initial), true);
    assert.equal(hasValidHintCandidateProgressIntegrity(progress), true);
    assert.equal(
        progress.integrity,
        computeHintCandidateProgressIntegrity(progress.boardSignature, progress.exclusions),
    );

    assert.equal(
        applyHintCandidatePlan(board, LOCKED_POINTING_ROW_SOLUTION, progress, result.plan),
        null,
        'the same candidate plan cannot be charged/applied twice',
    );

    const tampered = deepClone(result.plan);
    const targetDelta = tampered.candidateEliminations[0];
    const solutionValue = LOCKED_POINTING_ROW_SOLUTION[targetDelta.row][targetDelta.col];
    targetDelta.removedValues = [solutionValue];
    targetDelta.afterCandidates = targetDelta.beforeCandidates.filter(value => value !== solutionValue);
    assert.equal(
        applyHintCandidatePlan(board, LOCKED_POINTING_ROW_SOLUTION, null, tampered),
        null,
        'a tampered solution-candidate removal must be rejected',
    );

    const corrupt = {
        ...progress,
        exclusions: progress.exclusions.slice(1),
    };
    const repaired = reconcileHintCandidateProgress(
        board,
        LOCKED_POINTING_ROW_SOLUTION,
        corrupt,
    );
    assert.equal(
        hasValidHintCandidateProgressIntegrity(corrupt),
        false,
        'editing an exclusion without recomputing integrity invalidates the proof',
    );
    assert.deepEqual(repaired.exclusions, [], 'invalid candidate proof resets instead of being consumed');
    assert.equal(hasValidHintCandidateProgressIntegrity(repaired), true);

    const missingIntegrity = deepClone(progress);
    delete missingIntegrity.integrity;
    assert.deepEqual(
        reconcileHintCandidateProgress(board, LOCKED_POINTING_ROW_SOLUTION, missingIntegrity).exclusions,
        [],
        'legacy or partial ledgers without integrity reset',
    );

    const duplicateExclusions = [...progress.exclusions, progress.exclusions[0]];
    const reSignedDuplicate = {
        ...progress,
        exclusions: duplicateExclusions,
        integrity: computeHintCandidateProgressIntegrity(progress.boardSignature, duplicateExclusions),
    };
    assert.equal(hasValidHintCandidateProgressIntegrity(reSignedDuplicate), false);
    assert.deepEqual(
        reconcileHintCandidateProgress(board, LOCKED_POINTING_ROW_SOLUTION, reSignedDuplicate).exclusions,
        [],
        'duplicate entries are invalid proof rather than something to prune silently',
    );

    const unsafeCell = progress.exclusions[0];
    const unsafeExclusions = [
        ...progress.exclusions,
        {
            row: unsafeCell.row,
            col: unsafeCell.col,
            value: LOCKED_POINTING_ROW_SOLUTION[unsafeCell.row][unsafeCell.col],
        },
    ];
    const reSignedUnsafe = {
        ...progress,
        exclusions: unsafeExclusions,
        integrity: computeHintCandidateProgressIntegrity(progress.boardSignature, unsafeExclusions),
    };
    assert.equal(hasValidHintCandidateProgressIntegrity(reSignedUnsafe), true);
    assert.deepEqual(
        reconcileHintCandidateProgress(board, LOCKED_POINTING_ROW_SOLUTION, reSignedUnsafe),
        progress,
        'even a recomputed checksum cannot make an unsafe solution exclusion logical proof',
    );

    const forwardBoard = cloneHintBoard(board);
    const filled = progress.exclusions[0];
    forwardBoard[filled.row][filled.col].value = LOCKED_POINTING_ROW_SOLUTION[filled.row][filled.col];
    forwardBoard[filled.row][filled.col].isFixed = false;
    const advanced = reconcileHintCandidateProgress(
        forwardBoard,
        LOCKED_POINTING_ROW_SOLUTION,
        progress,
    );
    assert.equal(advanced.exclusions.length, progress.exclusions.length - 1);
    assert.ok(advanced.exclusions.every(exclusion => coordinateKey(exclusion) !== coordinateKey(filled)));
    assert.equal(hasValidHintCandidateProgressIntegrity(advanced), true);
    assert.notEqual(advanced.integrity, progress.integrity);
    forwardBoard[filled.row][filled.col].value = null;
    const reset = reconcileHintCandidateProgress(
        forwardBoard,
        LOCKED_POINTING_ROW_SOLUTION,
        advanced,
    );
    assert.deepEqual(reset.exclusions, [], 'erasing a placed value resets logical exclusions');
});

test('note-aware candidate updates cover empty, removable, empty-after, and no-op notes', () => {
    const solution = LOCKED_POINTING_ROW_SOLUTION;
    const plain = makeBoard(LOCKED_POINTING_ROW_PUZZLE);
    const baseline = createHintPlan(plain, solution);
    assert.equal(baseline.status, 'ready');
    assert.equal(baseline.plan.outcome, 'candidate');
    assert.ok(baseline.plan.noteUpdates.every(update => (
        update.beforeNotes.length === 0 && update.afterNotes.length > 0
    )));

    const removable = makeBoard(LOCKED_POINTING_ROW_PUZZLE);
    baseline.plan.candidateEliminations.forEach(delta => {
        removable[delta.row][delta.col].notes = [...delta.afterCandidates];
    });
    const focus = baseline.plan.candidateEliminations[0];
    const preserved = focus.afterCandidates[0];
    removable[focus.row][focus.col].notes = [focus.removedValues[0], preserved];
    const removalPlan = createHintPlan(removable, solution, {
        preferredTechnique: 'lockedCandidate',
    });
    assert.equal(removalPlan.status, 'ready');
    assert.equal(removalPlan.plan.outcome, 'candidate');
    assert.deepEqual(removalPlan.plan.noteUpdates, [{
        row: focus.row,
        col: focus.col,
        beforeNotes: [focus.removedValues[0], preserved].sort((a, b) => a - b),
        afterNotes: [preserved],
    }]);

    const emptied = makeBoard(LOCKED_POINTING_ROW_PUZZLE);
    baseline.plan.candidateEliminations.forEach(delta => {
        emptied[delta.row][delta.col].notes = [...delta.removedValues];
    });
    const emptyPlan = createHintPlan(emptied, solution, {
        preferredTechnique: 'lockedCandidate',
    });
    assert.equal(emptyPlan.status, 'ready');
    assert.equal(emptyPlan.plan.outcome, 'candidate');
    assert.ok(emptyPlan.plan.noteUpdates.every(update => {
        const delta = emptyPlan.plan.candidateEliminations.find(item => (
            item.row === update.row && item.col === update.col
        ));
        return delta
            && update.afterNotes.length > 0
            && update.afterNotes.length === delta.afterCandidates.length
            && update.afterNotes.every((value, index) => value === delta.afterCandidates[index]);
    }), 'an all-removed partial note set is refilled with verified candidates');
    assert.ok(applyHintCandidatePlan(emptied, solution, null, emptyPlan.plan));

    const noOp = makeBoard(LOCKED_POINTING_ROW_PUZZLE);
    noOp.flat().forEach(cell => {
        if (cell.value === null) cell.notes = [solution[cell.row][cell.col]];
    });
    const carried = createHintPlan(noOp, solution, {
        preferredTechnique: 'lockedCandidate',
    });
    assert.equal(carried.status, 'ready');
    assert.equal(carried.plan.outcome, 'placement');
    assert.ok(carried.plan.candidateEliminations.length > 0);
    assert.ok(applyHintCandidateProgress(noOp, solution, null, carried.plan));
});

test('all production openings are supported by a safe placement or candidate update', () => {
    for (const difficulty of Object.values(Difficulty)) {
        for (let levelId = 1; levelId <= 300; levelId += 1) {
            const { initial, solved } = generateLevel(difficulty, levelId);
            const before = deepClone(initial);
            const result = createHintPlan(initial, solved);
            assert.equal(result.status, 'ready', `${difficulty} ${levelId}`);
            assert.deepEqual(initial, before);
            if (result.plan.outcome === 'placement') {
                assert.equal(
                    solved[result.plan.target.row][result.plan.target.col],
                    result.plan.target.value,
                );
            } else {
                assertCandidatePlanContract(
                    result.plan,
                    initial,
                    solved,
                    null,
                    `${difficulty} ${levelId} opening`,
                );
            }
        }
    }
});

test('sampled production paths persist candidate progress and terminate without cycles', () => {
    const sampledLevels = [1, 50, 100, 150, 200, 250, 300];
    for (const difficulty of Object.values(Difficulty)) {
        for (const levelId of sampledLevels) {
            const { initial, solved } = generateLevel(difficulty, levelId);
            const board = cloneHintBoard(initial);
            let progress = null;
            const seen = new Set();
            let complete = false;
            for (let action = 0; action < 512; action += 1) {
                const stateKey = `${boardHintSignature(board)}|${progress ? hintCandidateProgressSignature(progress) : 'none'}`;
                assert.equal(seen.has(stateKey), false, `${difficulty} ${levelId} cycle`);
                seen.add(stateKey);
                const result = createHintPlan(board, solved, { candidateProgress: progress });
                if (result.status === 'complete') {
                    complete = true;
                    break;
                }
                assert.equal(result.status, 'ready', `${difficulty} ${levelId} action ${action}`);
                if (result.plan.outcome === 'candidate') {
                    assertCandidatePlanContract(
                        result.plan,
                        board,
                        solved,
                        progress,
                        `${difficulty} ${levelId} action ${action}`,
                    );
                    progress = applyCandidateStep(
                        board,
                        solved,
                        progress,
                        result.plan,
                        `${difficulty} ${levelId} action ${action}`,
                    );
                    continue;
                }
                if (result.plan.candidateEliminations?.length) {
                    progress = applyHintCandidateProgress(board, solved, progress, result.plan);
                    assert.ok(progress);
                }
                const { row, col, value } = result.plan.target;
                assert.equal(solved[row][col], value);
                board[row][col].value = value;
                board[row][col].isFixed = false;
                board[row][col].notes = [];
                progress = reconcileHintCandidateProgress(board, solved, progress);
            }
            assert.equal(complete, true, `${difficulty} ${levelId} must complete`);
        }
    }
});

console.log(`Hint engine tests passed (${passed} cases).`);
