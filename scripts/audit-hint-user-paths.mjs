import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';

const args = new Map(
    process.argv
        .slice(2)
        .filter(argument => argument.startsWith('--'))
        .map(argument => {
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
const extendedDepth = readPositiveInteger('extended-depth', 6);
const extendedStates = readPositiveInteger('extended-states', 50_000);
const requestedDifficulty = args.get('difficulty');
const seedVersion = args.get('seed') ?? 'hint-fluid-v1';

const bundle = await build({
    stdin: {
        contents: `
            export {
                boardHintSignature,
                cloneHintBoard,
                createHintPlan,
                diagnoseHintSearch,
            } from './utils/hints.ts';
            export { auditSudokuWithAdvancedLogic } from './utils/sudokuAdvancedAudit.ts';
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
    auditSudokuWithAdvancedLogic,
    boardHintSignature,
    cloneHintBoard,
    createHintPlan,
    diagnoseHintSearch,
    generateLevel,
    Difficulty,
} = await import(moduleUrl);

const difficulties = Object.values(Difficulty).filter(difficulty => (
    !requestedDifficulty
    || difficulty.toLowerCase() === requestedDifficulty.toLowerCase()
));
if (difficulties.length === 0) {
    throw new Error(`Unknown difficulty "${requestedDifficulty}".`);
}

const CURRENT_CHAIN_TECHNIQUES = new Set(['lockedCandidate', 'nakedPair', 'hiddenPair', 'nakedTriple', 'xWing', 'xyWing']);
const ADVANCED_PLAN_TECHNIQUES = new Set(['lockedCandidate', 'nakedPair', 'hiddenPair', 'nakedTriple', 'xWing', 'xyWing', 'simpleColoring', 'multiStep']);
const ALL_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const increment = (map, key, amount = 1) => {
    map.set(key, (map.get(key) ?? 0) + amount);
};

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

const coordinateKey = ({ row, col }) => `${row}:${col}`;

const getUnitCells = (kind, index) => {
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

const ALL_UNITS = ['row', 'column', 'box'].flatMap(kind => (
    Array.from({ length: 9 }, (_, index) => getUnitCells(kind, index))
));

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

const availableSingles = (board, solved) => {
    const grid = numericGrid(board);
    const candidates = Array.from({ length: 9 }, (_, row) => (
        Array.from({ length: 9 }, (_, col) => legalCandidates(grid, row, col))
    ));
    const placements = new Map();
    const add = (row, col, value) => {
        assert.equal(
            solved[row][col],
            value,
            `A sampled single at R${row + 1}C${col + 1} must match the solution.`,
        );
        placements.set(`${row}:${col}:${value}`, { row, col, value });
    };

    for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
            if (grid[row][col] === 0 && candidates[row][col].length === 1) {
                add(row, col, candidates[row][col][0]);
            }
        }
    }

    for (const unit of ALL_UNITS) {
        for (const value of ALL_DIGITS) {
            const cells = unit.filter(({ row, col }) => (
                grid[row][col] === 0 && candidates[row][col].includes(value)
            ));
            if (cells.length === 1) add(cells[0].row, cells[0].col, value);
        }
    }

    return [...placements.values()].sort((left, right) => (
        left.row - right.row
        || left.col - right.col
        || left.value - right.value
    ));
};

const blankCoordinates = board => board.flatMap((row, rowIndex) => (
    row.flatMap((cell, colIndex) => (
        cell.value === null ? [{ row: rowIndex, col: colIndex }] : []
    ))
));

const place = (board, placement) => {
    const cell = board[placement.row][placement.col];
    assert.equal(cell.value, null, 'A sampled path must only fill an empty cell.');
    cell.value = placement.value;
    cell.isFixed = false;
    cell.notes = [];
    cell.isError = false;
    cell.isMarkedWrong = false;
};

const progressPercent = (placed, blankCount) => (
    blankCount === 0 ? 100 : (placed / blankCount) * 100
);

const progressPhase = percent => {
    if (percent === 0) return 'opening';
    if (percent <= 25) return 'early';
    if (percent <= 75) return 'middle';
    return 'late';
};

const coverageRecord = () => ({
    checks: 0,
    ready: 0,
    unsupported: 0,
    complete: 0,
    unique: 0,
});

const coverageBySuite = new Map();
const coverageByDifficulty = new Map();
const coverageByPhase = new Map();
const uniqueCoverage = coverageRecord();
const unsupportedCategories = new Map();
const unsupportedReferenceTechniques = new Map();
const unsupportedExamples = new Map();
const chainDepths = new Map();
const chainSequences = new Map();
const canonicalLabels = new Map();

const bumpCoverage = (record, status, unique = false) => {
    record.checks += 1;
    record[status] += 1;
    if (unique) record.unique += 1;
};

const recordCoverage = (map, key, status, unique = false) => {
    if (!map.has(key)) map.set(key, coverageRecord());
    bumpCoverage(map.get(key), status, unique);
};

const referencePathToPlacement = board => {
    const audit = auditSudokuWithAdvancedLogic(board);
    const eliminations = [];
    let placement = null;
    for (const step of audit.proof) {
        if (step.placements.length > 0) {
            placement = step;
            break;
        }
        if (step.eliminations.length > 0) eliminations.push(step.technique);
    }
    const firstUnsupportedTechnique = eliminations.find(technique => (
        !CURRENT_CHAIN_TECHNIQUES.has(technique)
    ));
    return {
        solved: audit.solved,
        contradiction: audit.contradiction,
        eliminations,
        placementTechnique: placement?.technique,
        firstUnsupportedTechnique,
    };
};

const diagnoseUnsupported = (board, solved) => {
    const wide = diagnoseHintSearch(board, {
        maxDeductions: 3,
        maxStates: extendedStates,
    });
    assert.notEqual(wide.termination, 'invalid');
    if (wide.termination === 'found') {
        assert.equal(solved[wide.target.row][wide.target.col], wide.target.value);
        return {
            category: 'production state cap',
            diagnostics: wide,
            reference: referencePathToPlacement(board),
        };
    }

    const deep = diagnoseHintSearch(board, {
        maxDeductions: extendedDepth,
        maxStates: extendedStates,
    });
    assert.notEqual(deep.termination, 'invalid');
    if (deep.termination === 'found') {
        assert.equal(solved[deep.target.row][deep.target.col], deep.target.value);
        return {
            category: 'chain exceeds 3 deductions',
            diagnostics: deep,
            reference: referencePathToPlacement(board),
        };
    }

    const category = deep.termination === 'exhausted'
        ? 'current techniques exhausted'
        : deep.termination === 'state-limit'
            ? 'extended search state cap'
            : 'chain exceeds audited depth';
    return {
        category,
        diagnostics: deep,
        reference: referencePathToPlacement(board),
    };
};

const validatePlanSafety = (board, solved, result, context) => {
    if (result.status !== 'ready') return;
    const { row, col, value } = result.plan.target;
    assert.equal(board[row][col].value, null, `${context}: target must be empty.`);
    assert.equal(solved[row][col], value, `${context}: target must match the solution.`);
    for (const elimination of result.plan.candidateEliminations ?? []) {
        assert.equal(
            elimination.removedValues.includes(solved[elimination.row][elimination.col]),
            false,
            `${context}: a candidate elimination removed the solution value.`,
        );
    }
};

let uniqueStates = 0;
let noteIndependenceChecks = 0;
let freshBoardChecks = 0;
let openingReady = 0;

const canonicalOutcomes = new Map();
const humanOutcomes = new Map();

const makeOutcomeRecord = () => ({ runs: 0, complete: 0, unsupported: 0 });

const addOutcome = (map, difficulty, status) => {
    if (!map.has(difficulty)) map.set(difficulty, makeOutcomeRecord());
    const record = map.get(difficulty);
    record.runs += 1;
    record[status] += 1;
};

const startedAt = performance.now();

for (let difficultyIndex = 0; difficultyIndex < difficulties.length; difficultyIndex += 1) {
    const difficulty = difficulties[difficultyIndex];
    process.stdout.write(`Auditing ${difficulty} (${levelCount} levels)...\n`);

    for (let levelId = 1; levelId <= levelCount; levelId += 1) {
        const { initial, solved } = generateLevel(difficulty, levelId);
        const initialBlanks = blankCoordinates(initial);
        const blankCount = initialBlanks.length;
        const fixedMask = initial.map(row => row.map(cell => cell.isFixed));
        const stateCache = new Map();
        const frontiers = [];

        const evaluateState = (board, provenance) => {
            const signatureBefore = boardHintSignature(board);
            const context = `${difficulty} ${levelId}, ${provenance.suite}, ${provenance.route}, ${provenance.placed}/${blankCount}`;
            const phase = progressPhase(progressPercent(provenance.placed, blankCount));
            let cached = stateCache.get(signatureBefore);

            if (!cached) {
                const snapshot = structuredClone(board);
                const result = createHintPlan(board, solved);
                const repeated = createHintPlan(board, solved);
                assert.deepEqual(repeated, result, `${context}: Hint result must be deterministic.`);
                assert.equal(boardHintSignature(board), signatureBefore, `${context}: Hint mutated the board.`);
                assert.deepEqual(board, snapshot, `${context}: Hint mutated cell metadata or notes.`);
                assert.ok(
                    result.status === 'ready'
                    || result.status === 'unsupported'
                    || result.status === 'complete',
                    `${context}: unexpected Hint status ${result.status}.`,
                );
                validatePlanSafety(board, solved, result, context);

                for (let row = 0; row < 9; row += 1) {
                    for (let col = 0; col < 9; col += 1) {
                        if (fixedMask[row][col]) {
                            assert.equal(board[row][col].isFixed, true, `${context}: a given changed.`);
                        } else if (board[row][col].value !== null) {
                            assert.equal(board[row][col].isFixed, false, `${context}: a player value became fixed.`);
                        }
                    }
                }

                if (fnv1a(`${seedVersion}|notes|${difficulty}|${levelId}|${signatureBefore}`) % 20 === 0) {
                    const noted = cloneHintBoard(board);
                    for (let row = 0; row < 9; row += 1) {
                        for (let col = 0; col < 9; col += 1) {
                            if (noted[row][col].value === null) {
                                noted[row][col].notes = ((row * 9 + col) % 2 === 0)
                                    ? [9, 2, 5]
                                    : [7, 1];
                            }
                        }
                    }
                    assert.deepEqual(
                        createHintPlan(noted, solved),
                        result,
                        `${context}: player notes must not change Hint logic.`,
                    );
                    noteIndependenceChecks += 1;
                }

                if (result.status === 'ready') {
                    const continued = cloneHintBoard(board);
                    place(continued, result.plan.target);
                    const continuedSignature = boardHintSignature(continued);
                    const continuedResult = createHintPlan(continued, solved);
                    assert.equal(
                        boardHintSignature(continued),
                        continuedSignature,
                        `${context}: fresh Hint mutated the continued board.`,
                    );
                    assert.ok(
                        continuedResult.status === 'ready'
                        || continuedResult.status === 'unsupported'
                        || continuedResult.status === 'complete',
                        `${context}: fresh Hint returned ${continuedResult.status}.`,
                    );
                    validatePlanSafety(continued, solved, continuedResult, `${context}, continued`);
                    freshBoardChecks += 1;
                }

                cached = {
                    result,
                    unsupported: result.status === 'unsupported'
                        ? diagnoseUnsupported(board, solved)
                        : null,
                };
                stateCache.set(signatureBefore, cached);
                uniqueStates += 1;
                bumpCoverage(uniqueCoverage, result.status, true);

                if (cached.unsupported) {
                    const diagnosis = cached.unsupported;
                    increment(unsupportedCategories, diagnosis.category);
                    if (diagnosis.diagnostics.deductionCount) {
                        increment(chainDepths, `${diagnosis.diagnostics.deductionCount}`);
                        increment(
                            chainSequences,
                            diagnosis.diagnostics.techniqueSequence.join(' → '),
                        );
                    }
                    const referenceTechnique = diagnosis.reference.firstUnsupportedTechnique
                        ?? (
                            diagnosis.reference.eliminations.length > 0
                                ? 'only current techniques in reference path'
                                : diagnosis.reference.placementTechnique
                                    ? 'reference starts with a placement'
                                    : 'reference solver stalled'
                        );
                    increment(unsupportedReferenceTechniques, referenceTechnique);
                    const examples = unsupportedExamples.get(diagnosis.category) ?? [];
                    if (examples.length < 3) {
                        examples.push({
                            difficulty,
                            levelId,
                            route: provenance.route,
                            placed: provenance.placed,
                            blankCount,
                            progress: progressPercent(provenance.placed, blankCount),
                            signature: signatureBefore,
                            searchTermination: diagnosis.diagnostics.termination,
                            searchDepth: diagnosis.diagnostics.deductionCount
                                ?? diagnosis.diagnostics.maxDepthReached,
                            sequence: diagnosis.diagnostics.techniqueSequence?.join(' → '),
                            reference: diagnosis.reference.eliminations.join(' → '),
                            firstUnsupportedTechnique: diagnosis.reference.firstUnsupportedTechnique,
                        });
                        unsupportedExamples.set(diagnosis.category, examples);
                    }
                }
            }

            recordCoverage(coverageBySuite, provenance.suite, cached.result.status, false);
            recordCoverage(coverageByDifficulty, difficulty, cached.result.status, false);
            recordCoverage(coverageByPhase, phase, cached.result.status, false);
            return cached.result;
        };

        const canonicalBoard = cloneHintBoard(initial);
        let canonicalPlaced = 0;
        let canonicalEnded = false;
        for (let step = 0; step <= blankCount; step += 1) {
            const result = evaluateState(canonicalBoard, {
                suite: 'canonical full walk',
                route: 'Hint → Place',
                placed: canonicalPlaced,
            });

            if (canonicalPlaced === 0 && result.status === 'ready') openingReady += 1;
            if (result.status === 'ready') {
                increment(canonicalLabels, result.plan.techniqueLabel);
                if (ADVANCED_PLAN_TECHNIQUES.has(result.plan.technique)) {
                    frontiers.push({
                        board: cloneHintBoard(canonicalBoard),
                        result,
                        placed: canonicalPlaced,
                        label: result.plan.techniqueLabel,
                    });
                }
                place(canonicalBoard, result.plan.target);
                canonicalPlaced += 1;
                continue;
            }

            if (result.status === 'unsupported') {
                frontiers.push({
                    board: cloneHintBoard(canonicalBoard),
                    result,
                    placed: canonicalPlaced,
                    label: 'Unsupported',
                });
                addOutcome(canonicalOutcomes, difficulty, 'unsupported');
            } else {
                addOutcome(canonicalOutcomes, difficulty, 'complete');
            }
            canonicalEnded = true;
            break;
        }
        assert.equal(canonicalEnded, true, `${difficulty} ${levelId}: canonical path did not end.`);

        const milestoneCounts = new Set([
            0,
            1,
            Math.round(blankCount * 0.10),
            Math.round(blankCount * 0.25),
            Math.round(blankCount * 0.50),
            Math.round(blankCount * 0.75),
            blankCount - 10,
            blankCount - 3,
            blankCount - 1,
            blankCount,
        ].map(value => Math.max(0, Math.min(blankCount, value))));

        for (let routeIndex = 0; routeIndex < 2; routeIndex += 1) {
            const routeName = `seeded single choices ${routeIndex + 1}`;
            const random = mulberry32(fnv1a(
                `${seedVersion}|human|${difficulty}|${levelId}|${routeIndex}`,
            ));
            const board = cloneHintBoard(initial);
            let placedCount = 0;
            let routeEnded = false;

            while (placedCount <= blankCount) {
                let result = null;
                if (milestoneCounts.has(placedCount)) {
                    result = evaluateState(board, {
                        suite: 'varied logical paths',
                        route: routeName,
                        placed: placedCount,
                    });
                    if (result.status !== 'ready') {
                        addOutcome(humanOutcomes, difficulty, result.status);
                        routeEnded = true;
                        break;
                    }
                }

                if (placedCount === blankCount) {
                    addOutcome(humanOutcomes, difficulty, 'complete');
                    routeEnded = true;
                    break;
                }

                const singles = availableSingles(board, solved);
                if (singles.length > 0) {
                    const choice = singles[Math.floor(random() * singles.length)];
                    place(board, choice);
                    placedCount += 1;
                    continue;
                }

                result ??= evaluateState(board, {
                    suite: 'varied logical paths',
                    route: `${routeName} frontier`,
                    placed: placedCount,
                });
                if (result.status !== 'ready') {
                    addOutcome(humanOutcomes, difficulty, result.status);
                    routeEnded = true;
                    break;
                }
                place(board, result.plan.target);
                placedCount += 1;
            }
            assert.equal(routeEnded, true, `${difficulty} ${levelId}: ${routeName} did not end.`);
        }

        const spatialOrders = [
            [...initialBlanks].sort((left, right) => (
                (Math.floor(left.row / 3) * 3 + Math.floor(left.col / 3))
                - (Math.floor(right.row / 3) * 3 + Math.floor(right.col / 3))
                || left.row - right.row
                || left.col - right.col
            )),
            [...initialBlanks].sort((left, right) => (
                solved[left.row][left.col] - solved[right.row][right.col]
                || left.row - right.row
                || left.col - right.col
            )),
            shuffled(
                initialBlanks,
                fnv1a(`${seedVersion}|stress|${difficulty}|${levelId}`),
            ),
        ];

        for (let orderIndex = 0; orderIndex < spatialOrders.length; orderIndex += 1) {
            const order = spatialOrders[orderIndex];
            for (const filledCount of [...milestoneCounts].filter(value => value < blankCount)) {
                const board = cloneHintBoard(initial);
                for (const coordinate of order.slice(0, filledCount)) {
                    place(board, {
                        ...coordinate,
                        value: solved[coordinate.row][coordinate.col],
                    });
                }
                evaluateState(board, {
                    suite: 'solution-correct stress states',
                    route: ['box sweep', 'digit sweep', 'seeded shuffle'][orderIndex],
                    placed: filledCount,
                });
            }
        }

        for (let frontierIndex = 0; frontierIndex < frontiers.length; frontierIndex += 1) {
            const frontier = frontiers[frontierIndex];
            const excludedTarget = frontier.result.status === 'ready'
                ? coordinateKey(frontier.result.plan.target)
                : null;
            const candidates = blankCoordinates(frontier.board).filter(coordinate => (
                coordinateKey(coordinate) !== excludedTarget
            ));
            const mutations = shuffled(
                candidates,
                fnv1a(`${seedVersion}|frontier|${difficulty}|${levelId}|${frontierIndex}`),
            ).slice(0, 3);
            for (const coordinate of mutations) {
                const board = cloneHintBoard(frontier.board);
                place(board, {
                    ...coordinate,
                    value: solved[coordinate.row][coordinate.col],
                });
                evaluateState(board, {
                    suite: 'advanced frontier mutations',
                    route: `${frontier.label} + R${coordinate.row + 1}C${coordinate.col + 1}`,
                    placed: frontier.placed + 1,
                });
            }
        }
    }
}

const elapsedSeconds = (performance.now() - startedAt) / 1000;
const sampledChecks = [...coverageBySuite.values()].reduce((sum, record) => (
    sum + record.checks
), 0);
assert.equal(uniqueStates, uniqueCoverage.checks);

const percent = (value, total) => (
    total === 0 ? '—' : `${((value / total) * 100).toFixed(2)}%`
);

const sortedEntries = map => [...map.entries()].sort((left, right) => (
    right[1] - left[1] || `${left[0]}`.localeCompare(`${right[0]}`)
));

const printTable = (headers, rows) => {
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

process.stdout.write('\nHint user-path coverage audit\n');
process.stdout.write('Scope: deterministic sampled paths and states across the production catalogue; this is high-coverage evidence, not an enumeration of every possible board subset.\n\n');
process.stdout.write(`Puzzles: ${difficulties.length * levelCount}\n`);
process.stdout.write(`Sampled Hint checks: ${sampledChecks.toLocaleString()} across ${coverageBySuite.size} suites\n`);
process.stdout.write(`Unique current-board states: ${uniqueStates.toLocaleString()}\n`);
process.stdout.write(`Ready: ${uniqueCoverage.ready.toLocaleString()} (${percent(uniqueCoverage.ready, uniqueCoverage.checks)})\n`);
process.stdout.write(`Unsupported: ${uniqueCoverage.unsupported.toLocaleString()} (${percent(uniqueCoverage.unsupported, uniqueCoverage.checks)})\n`);
process.stdout.write(`Complete: ${uniqueCoverage.complete.toLocaleString()}\n`);
process.stdout.write(`Opening Hint availability: ${openingReady}/${difficulties.length * levelCount}\n`);
process.stdout.write(`Fresh-board recalculations checked: ${freshBoardChecks.toLocaleString()}\n`);
process.stdout.write(`Player-note independence checks: ${noteIndependenceChecks.toLocaleString()}\n`);
process.stdout.write(`Elapsed: ${elapsedSeconds.toFixed(1)}s\n\n`);

process.stdout.write('Canonical Hint → Place path outcomes\n');
printTable(
    ['Difficulty', 'Completed', 'Stalled', 'Total'],
    difficulties.map(difficulty => {
        const record = canonicalOutcomes.get(difficulty) ?? makeOutcomeRecord();
        return [difficulty, record.complete, record.unsupported, record.runs];
    }),
);

process.stdout.write('\nVaried logical-path outcomes (two routes per puzzle)\n');
printTable(
    ['Difficulty', 'Completed', 'Stalled', 'Total'],
    difficulties.map(difficulty => {
        const record = humanOutcomes.get(difficulty) ?? makeOutcomeRecord();
        return [difficulty, record.complete, record.unsupported, record.runs];
    }),
);

process.stdout.write('\nCoverage checks by suite\n');
printTable(
    ['Suite', 'Checks', 'Ready', 'Unsupported', 'Complete', 'Ready rate'],
    [...coverageBySuite].map(([suite, record]) => [
        suite,
        record.checks,
        record.ready,
        record.unsupported,
        record.complete,
        percent(record.ready, record.checks - record.complete),
    ]),
);

process.stdout.write('\nCoverage checks by difficulty\n');
printTable(
    ['Difficulty', 'Checks', 'Ready', 'Unsupported', 'Complete', 'Ready rate'],
    difficulties.map(difficulty => {
        const record = coverageByDifficulty.get(difficulty) ?? coverageRecord();
        return [
            difficulty,
            record.checks,
            record.ready,
            record.unsupported,
            record.complete,
            percent(record.ready, record.checks - record.complete),
        ];
    }),
);

process.stdout.write('\nCoverage checks by game phase\n');
printTable(
    ['Phase', 'Checks', 'Ready', 'Unsupported', 'Complete', 'Ready rate'],
    ['opening', 'early', 'middle', 'late'].map(phase => {
        const record = coverageByPhase.get(phase) ?? coverageRecord();
        return [
            phase,
            record.checks,
            record.ready,
            record.unsupported,
            record.complete,
            percent(record.ready, record.checks - record.complete),
        ];
    }),
);

process.stdout.write('\nCanonical Hint flow distribution\n');
printTable(
    ['Flow', 'Calls', 'Share'],
    sortedEntries(canonicalLabels).map(([label, count]) => [
        label,
        count,
        percent(count, [...canonicalLabels.values()].reduce((sum, value) => sum + value, 0)),
    ]),
);

process.stdout.write('\nUnsupported-state diagnosis\n');
printTable(
    ['Category', 'Unique states'],
    sortedEntries(unsupportedCategories),
);

if (unsupportedReferenceTechniques.size > 0) {
    process.stdout.write('\nFirst unsupported technique chosen by the reference audit path\n');
    printTable(
        ['Reference signal', 'Unique states'],
        sortedEntries(unsupportedReferenceTechniques),
    );
}

if (chainDepths.size > 0) {
    process.stdout.write('\nLonger current-technique chains found\n');
    printTable(['Deductions', 'Unique states'], sortedEntries(chainDepths));
    printTable(['Sequence', 'Unique states'], sortedEntries(chainSequences));
}

if (unsupportedExamples.size > 0) {
    process.stdout.write('\nReproducible unsupported examples (up to 3 per category)\n');
    for (const [category, examples] of unsupportedExamples) {
        process.stdout.write(`${category}:\n`);
        for (const example of examples) {
            process.stdout.write(
                `  ${example.difficulty} ${example.levelId}, ${example.progress.toFixed(1)}%, ${example.route}; search=${example.searchTermination}/${example.searchDepth}; reference=${example.reference || 'none'}; board=${example.signature}\n`,
            );
        }
    }
}

process.stdout.write('\nAudit completed without correctness, mutation, determinism, note-isolation, or stale-board failures.\n');
