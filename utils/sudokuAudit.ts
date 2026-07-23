import type { Board } from '../types';

export type SudokuTechnique =
    | 'nakedSingle'
    | 'hiddenSingle'
    | 'lockedCandidate'
    | 'nakedPair';

export interface SudokuTechniqueCounts {
    nakedSingle: number;
    hiddenSingle: number;
    lockedCandidate: number;
    nakedPair: number;
}

export interface SudokuLogicRun {
    solved: boolean;
    contradiction: boolean;
    remainingCells: number;
    logicalSteps: number;
    candidateEliminations: number;
    longestSinglesRun: number;
    hardestTechnique: SudokuTechnique | null;
    techniques: SudokuTechniqueCounts;
}

export interface SudokuAuditResult {
    clues: number;
    minimumTier: 1 | 2 | 3 | null;
    requiresBeyondSupportedLogic: boolean;
    tier1: SudokuLogicRun;
    tier2: SudokuLogicRun;
    tier3: SudokuLogicRun;
}

type CandidateGrid = Set<number>[][];
type Coordinate = { row: number; col: number };

const TECHNIQUE_TIER: Record<SudokuTechnique, number> = {
    nakedSingle: 1,
    hiddenSingle: 1,
    lockedCandidate: 2,
    nakedPair: 3
};

const makeTechniqueCounts = (): SudokuTechniqueCounts => ({
    nakedSingle: 0,
    hiddenSingle: 0,
    lockedCandidate: 0,
    nakedPair: 0
});

const toNumericBoard = (board: Board | number[][]): number[][] =>
    board.map(row =>
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

const candidatesFor = (board: number[][], row: number, col: number): Set<number> => {
    if (board[row][col] !== 0) return new Set();

    const blocked = new Set<number>();
    for (let index = 0; index < 9; index++) {
        if (board[row][index] !== 0) blocked.add(board[row][index]);
        if (board[index][col] !== 0) blocked.add(board[index][col]);
    }

    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
        for (let colOffset = 0; colOffset < 3; colOffset++) {
            const value = board[startRow + rowOffset][startCol + colOffset];
            if (value !== 0) blocked.add(value);
        }
    }

    const candidates = new Set<number>();
    for (let value = 1; value <= 9; value++) {
        if (!blocked.has(value)) candidates.add(value);
    }
    return candidates;
};

const buildCandidates = (board: number[][]): CandidateGrid =>
    Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 9 }, (_, col) => candidatesFor(board, row, col))
    );

const hasDuplicateValues = (board: number[][]): boolean =>
    UNITS.some(unit => {
        const values = unit
            .map(({ row, col }) => board[row][col])
            .filter(value => value !== 0);
        return new Set(values).size !== values.length;
    });

const solveWithTier = (source: number[][], maxTier: 1 | 2 | 3): SudokuLogicRun => {
    const board = source.map(row => [...row]);
    const candidates = buildCandidates(board);
    const techniques = makeTechniqueCounts();
    let candidateEliminations = 0;
    let contradiction = hasDuplicateValues(board);
    let currentSinglesRun = 0;
    let longestSinglesRun = 0;
    let hardestTechnique: SudokuTechnique | null = null;

    const recordTechnique = (technique: SudokuTechnique) => {
        techniques[technique]++;
        if (
            hardestTechnique === null ||
            TECHNIQUE_TIER[technique] > TECHNIQUE_TIER[hardestTechnique]
        ) {
            hardestTechnique = technique;
        }

        if (technique === 'nakedSingle' || technique === 'hiddenSingle') {
            currentSinglesRun++;
            longestSinglesRun = Math.max(longestSinglesRun, currentSinglesRun);
        } else {
            currentSinglesRun = 0;
        }
    };

    const eliminateFromPeers = (row: number, col: number, value: number) => {
        for (let index = 0; index < 9; index++) {
            if (index !== col && candidates[row][index].delete(value)) candidateEliminations++;
            if (index !== row && candidates[index][col].delete(value)) candidateEliminations++;
        }

        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
            for (let colOffset = 0; colOffset < 3; colOffset++) {
                const peerRow = startRow + rowOffset;
                const peerCol = startCol + colOffset;
                if (
                    (peerRow !== row || peerCol !== col) &&
                    candidates[peerRow][peerCol].delete(value)
                ) {
                    candidateEliminations++;
                }
            }
        }
    };

    const place = (row: number, col: number, value: number, technique: SudokuTechnique) => {
        board[row][col] = value;
        candidates[row][col].clear();
        eliminateFromPeers(row, col, value);
        recordTechnique(technique);
    };

    const checkContradiction = (): boolean => {
        if (hasDuplicateValues(board)) return true;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0 && candidates[row][col].size === 0) return true;
            }
        }
        return false;
    };

    const applyNakedSingle = (): boolean => {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0 && candidates[row][col].size === 1) {
                    const value = candidates[row][col].values().next().value as number;
                    place(row, col, value, 'nakedSingle');
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
                    ({ row, col }) =>
                        board[row][col] === 0 && candidates[row][col].has(value)
                );
                if (positions.length === 1) {
                    const [{ row, col }] = positions;
                    place(row, col, value, 'hiddenSingle');
                    return true;
                }
            }
        }
        return false;
    };

    const applyLockedCandidate = (): boolean => {
        // Pointing: candidates confined to one row/column inside a box eliminate
        // that candidate from the rest of the row/column.
        for (let box = 0; box < 9; box++) {
            const startRow = Math.floor(box / 3) * 3;
            const startCol = (box % 3) * 3;

            for (let value = 1; value <= 9; value++) {
                const positions: Coordinate[] = [];
                for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
                    for (let colOffset = 0; colOffset < 3; colOffset++) {
                        const row = startRow + rowOffset;
                        const col = startCol + colOffset;
                        if (board[row][col] === 0 && candidates[row][col].has(value)) {
                            positions.push({ row, col });
                        }
                    }
                }

                if (positions.length < 2) continue;

                const rows = new Set(positions.map(position => position.row));
                if (rows.size === 1) {
                    const row = positions[0].row;
                    let removed = false;
                    for (let col = 0; col < 9; col++) {
                        if (
                            (col < startCol || col >= startCol + 3) &&
                            board[row][col] === 0 &&
                            candidates[row][col].delete(value)
                        ) {
                            candidateEliminations++;
                            removed = true;
                        }
                    }
                    if (removed) {
                        recordTechnique('lockedCandidate');
                        return true;
                    }
                }

                const cols = new Set(positions.map(position => position.col));
                if (cols.size === 1) {
                    const col = positions[0].col;
                    let removed = false;
                    for (let row = 0; row < 9; row++) {
                        if (
                            (row < startRow || row >= startRow + 3) &&
                            board[row][col] === 0 &&
                            candidates[row][col].delete(value)
                        ) {
                            candidateEliminations++;
                            removed = true;
                        }
                    }
                    if (removed) {
                        recordTechnique('lockedCandidate');
                        return true;
                    }
                }
            }
        }

        // Claiming: candidates confined to one box inside a row/column eliminate
        // that candidate from the rest of the box.
        for (let unitType = 0; unitType < 2; unitType++) {
            for (let unitIndex = 0; unitIndex < 9; unitIndex++) {
                for (let value = 1; value <= 9; value++) {
                    const positions: Coordinate[] = [];
                    for (let offset = 0; offset < 9; offset++) {
                        const row = unitType === 0 ? unitIndex : offset;
                        const col = unitType === 0 ? offset : unitIndex;
                        if (board[row][col] === 0 && candidates[row][col].has(value)) {
                            positions.push({ row, col });
                        }
                    }

                    if (positions.length < 2) continue;
                    const boxIndexes = new Set(
                        positions.map(({ row, col }) =>
                            Math.floor(row / 3) * 3 + Math.floor(col / 3)
                        )
                    );
                    if (boxIndexes.size !== 1) continue;

                    const box = [...boxIndexes][0];
                    const startRow = Math.floor(box / 3) * 3;
                    const startCol = (box % 3) * 3;
                    let removed = false;

                    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
                        for (let colOffset = 0; colOffset < 3; colOffset++) {
                            const row = startRow + rowOffset;
                            const col = startCol + colOffset;
                            const belongsToSourceUnit =
                                unitType === 0 ? row === unitIndex : col === unitIndex;
                            if (
                                !belongsToSourceUnit &&
                                board[row][col] === 0 &&
                                candidates[row][col].delete(value)
                            ) {
                                candidateEliminations++;
                                removed = true;
                            }
                        }
                    }

                    if (removed) {
                        recordTechnique('lockedCandidate');
                        return true;
                    }
                }
            }
        }

        return false;
    };

    const applyNakedPair = (): boolean => {
        for (const unit of UNITS) {
            const pairs = new Map<string, Coordinate[]>();
            for (const coordinate of unit) {
                const { row, col } = coordinate;
                if (board[row][col] !== 0 || candidates[row][col].size !== 2) continue;
                const key = [...candidates[row][col]].sort((a, b) => a - b).join(',');
                const coordinates = pairs.get(key) ?? [];
                coordinates.push(coordinate);
                pairs.set(key, coordinates);
            }

            for (const [key, pairCells] of pairs) {
                if (pairCells.length !== 2) continue;
                const pairValues = key.split(',').map(Number);
                let removed = false;

                for (const { row, col } of unit) {
                    if (pairCells.some(cell => cell.row === row && cell.col === col)) continue;
                    if (board[row][col] !== 0) continue;
                    for (const value of pairValues) {
                        if (candidates[row][col].delete(value)) {
                            candidateEliminations++;
                            removed = true;
                        }
                    }
                }

                if (removed) {
                    recordTechnique('nakedPair');
                    return true;
                }
            }
        }

        return false;
    };

    while (!contradiction) {
        const remainingCells = board.flat().filter(value => value === 0).length;
        if (remainingCells === 0) break;

        if (applyNakedSingle()) {
            contradiction = checkContradiction();
            continue;
        }
        if (applyHiddenSingle()) {
            contradiction = checkContradiction();
            continue;
        }
        if (maxTier >= 2 && applyLockedCandidate()) {
            contradiction = checkContradiction();
            continue;
        }
        if (maxTier >= 3 && applyNakedPair()) {
            contradiction = checkContradiction();
            continue;
        }
        break;
    }

    const remainingCells = board.flat().filter(value => value === 0).length;
    return {
        solved: !contradiction && remainingCells === 0,
        contradiction,
        remainingCells,
        logicalSteps: Object.values(techniques).reduce((sum, count) => sum + count, 0),
        candidateEliminations,
        longestSinglesRun,
        hardestTechnique,
        techniques
    };
};

export const auditSudokuPuzzle = (source: Board | number[][]): SudokuAuditResult => {
    const board = toNumericBoard(source);
    const tier1 = solveWithTier(board, 1);
    const tier2 = solveWithTier(board, 2);
    const tier3 = solveWithTier(board, 3);
    const minimumTier = tier1.solved ? 1 : tier2.solved ? 2 : tier3.solved ? 3 : null;

    return {
        clues: board.flat().filter(value => value !== 0).length,
        minimumTier,
        requiresBeyondSupportedLogic: minimumTier === null,
        tier1,
        tier2,
        tier3
    };
};
