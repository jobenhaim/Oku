import type { Board } from '../types';

export type AdvancedSudokuTechnique =
    | 'nakedSingle'
    | 'hiddenSingle'
    | 'lockedCandidate'
    | 'nakedPair'
    | 'hiddenPair'
    | 'nakedTriple'
    | 'hiddenTriple'
    | 'nakedQuad'
    | 'hiddenQuad'
    | 'xWing'
    | 'swordfish'
    | 'xyWing'
    | 'simpleColoring';

export interface SudokuProofStep {
    technique: AdvancedSudokuTechnique;
    placements: Array<{ row: number; col: number; value: number }>;
    eliminations: Array<{ row: number; col: number; value: number }>;
}

export interface AdvancedSudokuAuditResult {
    solved: boolean;
    contradiction: boolean;
    remainingCells: number;
    clues: number;
    proof: SudokuProofStep[];
    techniques: Record<AdvancedSudokuTechnique, number>;
    hardestTechnique: AdvancedSudokuTechnique | null;
    advancedSteps: number;
    highEndSteps: number;
}

type Coordinate = { row: number; col: number };
type CandidateGrid = Set<number>[][];

const TECHNIQUES: AdvancedSudokuTechnique[] = [
    'nakedSingle',
    'hiddenSingle',
    'lockedCandidate',
    'nakedPair',
    'hiddenPair',
    'nakedTriple',
    'hiddenTriple',
    'nakedQuad',
    'hiddenQuad',
    'xWing',
    'swordfish',
    'xyWing',
    'simpleColoring'
];

const TECHNIQUE_RANK: Record<AdvancedSudokuTechnique, number> = {
    nakedSingle: 1,
    hiddenSingle: 1,
    lockedCandidate: 2,
    nakedPair: 3,
    hiddenPair: 4,
    nakedTriple: 4,
    hiddenTriple: 4,
    nakedQuad: 4,
    hiddenQuad: 4,
    xWing: 5,
    swordfish: 6,
    xyWing: 6,
    simpleColoring: 6
};

const ADVANCED_TECHNIQUES = new Set<AdvancedSudokuTechnique>([
    'hiddenPair',
    'nakedTriple',
    'hiddenTriple',
    'nakedQuad',
    'hiddenQuad',
    'xWing',
    'swordfish',
    'xyWing',
    'simpleColoring'
]);

const HIGH_END_TECHNIQUES = new Set<AdvancedSudokuTechnique>([
    'xWing',
    'swordfish',
    'xyWing',
    'simpleColoring'
]);

const makeTechniqueCounts = (): Record<AdvancedSudokuTechnique, number> =>
    Object.fromEntries(TECHNIQUES.map(technique => [technique, 0])) as
        Record<AdvancedSudokuTechnique, number>;

const toNumericBoard = (source: Board | number[][]): number[][] =>
    source.map(row =>
        row.map(cell => typeof cell === 'number' ? cell : (cell.value ?? 0))
    );

const getUnits = (): Coordinate[][] => {
    const units: Coordinate[][] = [];
    for (let row = 0; row < 9; row++) {
        units.push(Array.from({ length: 9 }, (_, col) => ({ row, col })));
    }
    for (let col = 0; col < 9; col++) {
        units.push(Array.from({ length: 9 }, (_, row) => ({ row, col })));
    }
    for (let box = 0; box < 9; box++) {
        const startRow = Math.floor(box / 3) * 3;
        const startCol = (box % 3) * 3;
        const unit: Coordinate[] = [];
        for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
            for (let colOffset = 0; colOffset < 3; colOffset++) {
                unit.push({
                    row: startRow + rowOffset,
                    col: startCol + colOffset
                });
            }
        }
        units.push(unit);
    }
    return units;
};

const UNITS = getUnits();

const combinations = <T>(items: T[], size: number): T[][] => {
    const result: T[][] = [];
    const visit = (start: number, chosen: T[]) => {
        if (chosen.length === size) {
            result.push([...chosen]);
            return;
        }
        for (let index = start; index <= items.length - (size - chosen.length); index++) {
            chosen.push(items[index]);
            visit(index + 1, chosen);
            chosen.pop();
        }
    };
    visit(0, []);
    return result;
};

const sameCoordinate = (left: Coordinate, right: Coordinate): boolean =>
    left.row === right.row && left.col === right.col;

const sees = (left: Coordinate, right: Coordinate): boolean =>
    left.row === right.row ||
    left.col === right.col ||
    (
        Math.floor(left.row / 3) === Math.floor(right.row / 3) &&
        Math.floor(left.col / 3) === Math.floor(right.col / 3)
    );

const candidateSetFor = (
    board: number[][],
    row: number,
    col: number
): Set<number> => {
    if (board[row][col] !== 0) return new Set();
    const blocked = new Set<number>();
    for (let index = 0; index < 9; index++) {
        blocked.add(board[row][index]);
        blocked.add(board[index][col]);
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
        for (let colOffset = 0; colOffset < 3; colOffset++) {
            blocked.add(board[startRow + rowOffset][startCol + colOffset]);
        }
    }
    const candidates = new Set<number>();
    for (let value = 1; value <= 9; value++) {
        if (!blocked.has(value)) candidates.add(value);
    }
    return candidates;
};

const hasDuplicateValues = (board: number[][]): boolean =>
    UNITS.some(unit => {
        const values = unit
            .map(({ row, col }) => board[row][col])
            .filter(value => value !== 0);
        return new Set(values).size !== values.length;
    });

export const auditSudokuWithAdvancedLogic = (
    source: Board | number[][]
): AdvancedSudokuAuditResult => {
    const board = toNumericBoard(source);
    const clues = board.flat().filter(Boolean).length;
    const candidates: CandidateGrid = Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 9 }, (_, col) => candidateSetFor(board, row, col))
    );
    const proof: SudokuProofStep[] = [];
    const techniques = makeTechniqueCounts();
    let contradiction = hasDuplicateValues(board);
    let hardestTechnique: AdvancedSudokuTechnique | null = null;

    const record = (
        technique: AdvancedSudokuTechnique,
        placements: SudokuProofStep['placements'],
        eliminations: SudokuProofStep['eliminations']
    ) => {
        techniques[technique]++;
        if (
            hardestTechnique === null ||
            TECHNIQUE_RANK[technique] > TECHNIQUE_RANK[hardestTechnique]
        ) {
            hardestTechnique = technique;
        }
        proof.push({ technique, placements, eliminations });
    };

    const eliminate = (
        row: number,
        col: number,
        value: number,
        eliminations: SudokuProofStep['eliminations']
    ): boolean => {
        if (board[row][col] !== 0 || !candidates[row][col].delete(value)) return false;
        eliminations.push({ row, col, value });
        return true;
    };

    const place = (
        row: number,
        col: number,
        value: number,
        technique: AdvancedSudokuTechnique
    ) => {
        board[row][col] = value;
        candidates[row][col].clear();
        const eliminations: SudokuProofStep['eliminations'] = [];
        for (let index = 0; index < 9; index++) {
            if (index !== col) eliminate(row, index, value, eliminations);
            if (index !== row) eliminate(index, col, value, eliminations);
        }
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
            for (let colOffset = 0; colOffset < 3; colOffset++) {
                const peerRow = startRow + rowOffset;
                const peerCol = startCol + colOffset;
                if (peerRow !== row || peerCol !== col) {
                    eliminate(peerRow, peerCol, value, eliminations);
                }
            }
        }
        record(technique, [{ row, col, value }], eliminations);
    };

    const checkContradiction = (): boolean => {
        if (hasDuplicateValues(board)) return true;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0 && candidates[row][col].size === 0) return true;
            }
        }
        return UNITS.some(unit =>
            Array.from({ length: 9 }, (_, index) => index + 1).some(value =>
                !unit.some(({ row, col }) => board[row][col] === value) &&
                !unit.some(({ row, col }) => candidates[row][col].has(value))
            )
        );
    };

    const applyNakedSingle = (): boolean => {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0 && candidates[row][col].size === 1) {
                    place(
                        row,
                        col,
                        candidates[row][col].values().next().value as number,
                        'nakedSingle'
                    );
                    return true;
                }
            }
        }
        return false;
    };

    const applyHiddenSingle = (): boolean => {
        for (const unit of UNITS) {
            for (let value = 1; value <= 9; value++) {
                if (unit.some(({ row, col }) => board[row][col] === value)) continue;
                const positions = unit.filter(
                    ({ row, col }) => candidates[row][col].has(value)
                );
                if (positions.length === 1) {
                    place(positions[0].row, positions[0].col, value, 'hiddenSingle');
                    return true;
                }
            }
        }
        return false;
    };

    const applyLockedCandidate = (): boolean => {
        for (let box = 0; box < 9; box++) {
            const startRow = Math.floor(box / 3) * 3;
            const startCol = (box % 3) * 3;
            for (let value = 1; value <= 9; value++) {
                const positions: Coordinate[] = [];
                for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
                    for (let colOffset = 0; colOffset < 3; colOffset++) {
                        const row = startRow + rowOffset;
                        const col = startCol + colOffset;
                        if (candidates[row][col].has(value)) positions.push({ row, col });
                    }
                }
                if (positions.length < 2) continue;
                const eliminations: SudokuProofStep['eliminations'] = [];
                if (new Set(positions.map(position => position.row)).size === 1) {
                    const row = positions[0].row;
                    for (let col = 0; col < 9; col++) {
                        if (col < startCol || col >= startCol + 3) {
                            eliminate(row, col, value, eliminations);
                        }
                    }
                }
                if (new Set(positions.map(position => position.col)).size === 1) {
                    const col = positions[0].col;
                    for (let row = 0; row < 9; row++) {
                        if (row < startRow || row >= startRow + 3) {
                            eliminate(row, col, value, eliminations);
                        }
                    }
                }
                if (eliminations.length > 0) {
                    record('lockedCandidate', [], eliminations);
                    return true;
                }
            }
        }

        for (let orientation = 0; orientation < 2; orientation++) {
            for (let unitIndex = 0; unitIndex < 9; unitIndex++) {
                for (let value = 1; value <= 9; value++) {
                    const positions: Coordinate[] = [];
                    for (let offset = 0; offset < 9; offset++) {
                        const row = orientation === 0 ? unitIndex : offset;
                        const col = orientation === 0 ? offset : unitIndex;
                        if (candidates[row][col].has(value)) positions.push({ row, col });
                    }
                    if (positions.length < 2) continue;
                    const boxes = new Set(
                        positions.map(({ row, col }) =>
                            Math.floor(row / 3) * 3 + Math.floor(col / 3)
                        )
                    );
                    if (boxes.size !== 1) continue;
                    const box = [...boxes][0];
                    const startRow = Math.floor(box / 3) * 3;
                    const startCol = (box % 3) * 3;
                    const eliminations: SudokuProofStep['eliminations'] = [];
                    for (let row = startRow; row < startRow + 3; row++) {
                        for (let col = startCol; col < startCol + 3; col++) {
                            const inSource =
                                orientation === 0 ? row === unitIndex : col === unitIndex;
                            if (!inSource) eliminate(row, col, value, eliminations);
                        }
                    }
                    if (eliminations.length > 0) {
                        record('lockedCandidate', [], eliminations);
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const applyNakedSubset = (size: 2 | 3 | 4): boolean => {
        const technique = (
            size === 2 ? 'nakedPair' :
            size === 3 ? 'nakedTriple' :
            'nakedQuad'
        ) as AdvancedSudokuTechnique;
        for (const unit of UNITS) {
            const eligible = unit.filter(({ row, col }) =>
                board[row][col] === 0 &&
                candidates[row][col].size >= 2 &&
                candidates[row][col].size <= size
            );
            for (const subsetCells of combinations(eligible, size)) {
                const values = new Set<number>();
                subsetCells.forEach(({ row, col }) =>
                    candidates[row][col].forEach(value => values.add(value))
                );
                if (values.size !== size) continue;
                const eliminations: SudokuProofStep['eliminations'] = [];
                for (const { row, col } of unit) {
                    if (
                        board[row][col] !== 0 ||
                        subsetCells.some(cell => sameCoordinate(cell, { row, col }))
                    ) continue;
                    values.forEach(value => eliminate(row, col, value, eliminations));
                }
                if (eliminations.length > 0) {
                    record(technique, [], eliminations);
                    return true;
                }
            }
        }
        return false;
    };

    const applyHiddenSubset = (size: 2 | 3 | 4): boolean => {
        const technique = (
            size === 2 ? 'hiddenPair' :
            size === 3 ? 'hiddenTriple' :
            'hiddenQuad'
        ) as AdvancedSudokuTechnique;
        for (const unit of UNITS) {
            for (const values of combinations(
                Array.from({ length: 9 }, (_, index) => index + 1),
                size
            )) {
                const cells = unit.filter(({ row, col }) =>
                    board[row][col] === 0 &&
                    values.some(value => candidates[row][col].has(value))
                );
                if (cells.length !== size) continue;
                if (!values.every(value =>
                    cells.some(({ row, col }) => candidates[row][col].has(value))
                )) continue;
                const allowed = new Set(values);
                const eliminations: SudokuProofStep['eliminations'] = [];
                for (const { row, col } of cells) {
                    for (const candidate of [...candidates[row][col]]) {
                        if (!allowed.has(candidate)) {
                            eliminate(row, col, candidate, eliminations);
                        }
                    }
                }
                if (eliminations.length > 0) {
                    record(technique, [], eliminations);
                    return true;
                }
            }
        }
        return false;
    };

    const applyFish = (size: 2 | 3): boolean => {
        const technique: AdvancedSudokuTechnique = size === 2 ? 'xWing' : 'swordfish';
        for (let value = 1; value <= 9; value++) {
            for (let orientation = 0; orientation < 2; orientation++) {
                const baseUnits = Array.from({ length: 9 }, (_, base) => {
                    const covers: number[] = [];
                    for (let cover = 0; cover < 9; cover++) {
                        const row = orientation === 0 ? base : cover;
                        const col = orientation === 0 ? cover : base;
                        if (candidates[row][col].has(value)) covers.push(cover);
                    }
                    return { base, covers };
                }).filter(entry =>
                    entry.covers.length >= 2 && entry.covers.length <= size
                );

                for (const selected of combinations(baseUnits, size)) {
                    const covers = new Set(selected.flatMap(entry => entry.covers));
                    if (covers.size !== size) continue;
                    const bases = new Set(selected.map(entry => entry.base));
                    const eliminations: SudokuProofStep['eliminations'] = [];
                    for (const cover of covers) {
                        for (let base = 0; base < 9; base++) {
                            if (bases.has(base)) continue;
                            const row = orientation === 0 ? base : cover;
                            const col = orientation === 0 ? cover : base;
                            eliminate(row, col, value, eliminations);
                        }
                    }
                    if (eliminations.length > 0) {
                        record(technique, [], eliminations);
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const applyXYWing = (): boolean => {
        const bivalue: Coordinate[] = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (candidates[row][col].size === 2) bivalue.push({ row, col });
            }
        }
        for (const pivot of bivalue) {
            const pivotValues = [...candidates[pivot.row][pivot.col]];
            const wings = bivalue.filter(cell =>
                !sameCoordinate(cell, pivot) && sees(cell, pivot)
            );
            for (const first of wings) {
                const firstValues = [...candidates[first.row][first.col]];
                const sharedWithPivot = firstValues.filter(value => pivotValues.includes(value));
                if (sharedWithPivot.length !== 1) continue;
                const zValues = firstValues.filter(value => !pivotValues.includes(value));
                if (zValues.length !== 1) continue;
                const x = sharedWithPivot[0];
                const y = pivotValues.find(value => value !== x) as number;
                const z = zValues[0];
                for (const second of wings) {
                    if (sameCoordinate(second, first)) continue;
                    const secondValues = candidates[second.row][second.col];
                    if (
                        secondValues.size !== 2 ||
                        !secondValues.has(y) ||
                        !secondValues.has(z) ||
                        secondValues.has(x)
                    ) continue;
                    const eliminations: SudokuProofStep['eliminations'] = [];
                    for (let row = 0; row < 9; row++) {
                        for (let col = 0; col < 9; col++) {
                            const target = { row, col };
                            if (
                                !sameCoordinate(target, pivot) &&
                                !sameCoordinate(target, first) &&
                                !sameCoordinate(target, second) &&
                                sees(target, first) &&
                                sees(target, second)
                            ) {
                                eliminate(row, col, z, eliminations);
                            }
                        }
                    }
                    if (eliminations.length > 0) {
                        record('xyWing', [], eliminations);
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const applySimpleColoring = (): boolean => {
        for (let value = 1; value <= 9; value++) {
            const adjacency = new Map<string, Set<string>>();
            const coordinates = new Map<string, Coordinate>();
            const keyFor = ({ row, col }: Coordinate) => `${row},${col}`;
            for (const unit of UNITS) {
                const positions = unit.filter(({ row, col }) =>
                    candidates[row][col].has(value)
                );
                if (positions.length !== 2) continue;
                const [left, right] = positions;
                const leftKey = keyFor(left);
                const rightKey = keyFor(right);
                coordinates.set(leftKey, left);
                coordinates.set(rightKey, right);
                if (!adjacency.has(leftKey)) adjacency.set(leftKey, new Set());
                if (!adjacency.has(rightKey)) adjacency.set(rightKey, new Set());
                adjacency.get(leftKey)?.add(rightKey);
                adjacency.get(rightKey)?.add(leftKey);
            }

            const visited = new Set<string>();
            for (const startKey of adjacency.keys()) {
                if (visited.has(startKey)) continue;
                const colors = new Map<string, 0 | 1>();
                const queue = [startKey];
                colors.set(startKey, 0);
                visited.add(startKey);
                while (queue.length > 0) {
                    const current = queue.shift() as string;
                    const nextColor = colors.get(current) === 0 ? 1 : 0;
                    for (const neighbor of adjacency.get(current) ?? []) {
                        if (!colors.has(neighbor)) {
                            colors.set(neighbor, nextColor);
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }

                const colorCells = ([0, 1] as const).map(color =>
                    [...colors]
                        .filter(([, cellColor]) => cellColor === color)
                        .map(([key]) => coordinates.get(key) as Coordinate)
                );
                const eliminations: SudokuProofStep['eliminations'] = [];

                for (const color of [0, 1] as const) {
                    const cells = colorCells[color];
                    const hasConflict = cells.some((cell, index) =>
                        cells.slice(index + 1).some(other => sees(cell, other))
                    );
                    if (hasConflict) {
                        cells.forEach(({ row, col }) =>
                            eliminate(row, col, value, eliminations)
                        );
                    }
                }

                if (eliminations.length === 0) {
                    for (let row = 0; row < 9; row++) {
                        for (let col = 0; col < 9; col++) {
                            if (!candidates[row][col].has(value)) continue;
                            const target = { row, col };
                            if (colors.has(keyFor(target))) continue;
                            if (
                                colorCells[0].some(cell => sees(target, cell)) &&
                                colorCells[1].some(cell => sees(target, cell))
                            ) {
                                eliminate(row, col, value, eliminations);
                            }
                        }
                    }
                }

                if (eliminations.length > 0) {
                    record('simpleColoring', [], eliminations);
                    return true;
                }
            }
        }
        return false;
    };

    while (!contradiction) {
        const remainingCells = board.flat().filter(value => value === 0).length;
        if (remainingCells === 0) break;
        const changed =
            applyNakedSingle() ||
            applyHiddenSingle() ||
            applyLockedCandidate() ||
            applyNakedSubset(2) ||
            applyHiddenSubset(2) ||
            applyNakedSubset(3) ||
            applyHiddenSubset(3) ||
            applyNakedSubset(4) ||
            applyHiddenSubset(4) ||
            applyFish(2) ||
            applyXYWing() ||
            applyFish(3) ||
            applySimpleColoring();
        if (!changed) break;
        contradiction = checkContradiction();
    }

    const remainingCells = board.flat().filter(value => value === 0).length;
    return {
        solved: !contradiction && remainingCells === 0,
        contradiction,
        remainingCells,
        clues,
        proof,
        techniques,
        hardestTechnique,
        advancedSteps: [...ADVANCED_TECHNIQUES]
            .reduce((sum, technique) => sum + techniques[technique], 0),
        highEndSteps: [...HIGH_END_TECHNIQUES]
            .reduce((sum, technique) => sum + techniques[technique], 0)
    };
};
