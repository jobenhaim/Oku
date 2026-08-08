import type { Board } from '../types';

export const NORMAL_HUMAN_FLOW_MAXIMUM_SCAN_COST = 3;

export interface HumanFlowStep {
    row: number;
    col: number;
    value: number;
    technique: 'nakedSingle' | 'hiddenSingle';
    scanCost: number;
    availableMoves: number;
}

export interface SudokuHumanFlowAudit {
    solved: boolean;
    comfortable: boolean;
    maximumScanCost: number;
    bottleneckSteps: number;
    steps: HumanFlowStep[];
}

type NumericBoard = number[][];
type Position = readonly [number, number];

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const UNITS: Position[][] = (() => {
    const units: Position[][] = [];
    for (let row = 0; row < 9; row++) {
        units.push(Array.from({ length: 9 }, (_, col) => [row, col] as const));
    }
    for (let col = 0; col < 9; col++) {
        units.push(Array.from({ length: 9 }, (_, row) => [row, col] as const));
    }
    for (let box = 0; box < 9; box++) {
        const startRow = Math.floor(box / 3) * 3;
        const startCol = (box % 3) * 3;
        units.push(Array.from({ length: 9 }, (_, index) => [
            startRow + Math.floor(index / 3),
            startCol + (index % 3)
        ] as const));
    }
    return units;
})();

const toNumericBoard = (source: Board | number[][]): NumericBoard =>
    source.map(row => row.map(cell =>
        typeof cell === 'number' ? cell : (cell.value ?? 0)
    ));

const getCandidates = (board: NumericBoard, row: number, col: number): number[] => {
    if (board[row][col] !== 0) return [];

    const blocked = new Set<number>([
        ...board[row],
        ...board.map(line => line[col])
    ]);
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let currentRow = startRow; currentRow < startRow + 3; currentRow++) {
        for (let currentCol = startCol; currentCol < startCol + 3; currentCol++) {
            blocked.add(board[currentRow][currentCol]);
        }
    }

    return DIGITS.filter(value => !blocked.has(value));
};

const getMinimumUnitEmpties = (board: NumericBoard, row: number, col: number): number => {
    const rowEmpties = board[row].filter(value => value === 0).length;
    const colEmpties = board.filter(line => line[col] === 0).length;
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    let boxEmpties = 0;
    for (let currentRow = startRow; currentRow < startRow + 3; currentRow++) {
        for (let currentCol = startCol; currentCol < startCol + 3; currentCol++) {
            if (board[currentRow][currentCol] === 0) boxEmpties++;
        }
    }
    return Math.min(rowEmpties, colEmpties, boxEmpties);
};

type AvailableMove = Omit<HumanFlowStep, 'availableMoves'>;

const getAvailableSingles = (board: NumericBoard): AvailableMove[] => {
    const candidates = Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 9 }, (_, col) => getCandidates(board, row, col))
    );
    const moves = new Map<string, AvailableMove>();
    const addMove = (move: AvailableMove) => {
        const key = `${move.row}:${move.col}`;
        const current = moves.get(key);
        if (!current || move.scanCost < current.scanCost) moves.set(key, move);
    };

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (candidates[row][col].length !== 1) continue;
            addMove({
                row,
                col,
                value: candidates[row][col][0],
                technique: 'nakedSingle',
                scanCost: getMinimumUnitEmpties(board, row, col)
            });
        }
    }

    for (const unit of UNITS) {
        const emptyCells = unit.filter(([row, col]) => board[row][col] === 0);
        for (const value of DIGITS) {
            if (unit.some(([row, col]) => board[row][col] === value)) continue;
            const possibleCells = emptyCells.filter(([row, col]) =>
                candidates[row][col].includes(value)
            );
            if (possibleCells.length !== 1) continue;
            const [[row, col]] = possibleCells;
            addMove({
                row,
                col,
                value,
                technique: 'hiddenSingle',
                scanCost: emptyCells.length
            });
        }
    }

    return [...moves.values()].sort((left, right) =>
        left.scanCost - right.scanCost ||
        Number(left.technique === 'hiddenSingle') - Number(right.technique === 'hiddenSingle') ||
        left.row - right.row ||
        left.col - right.col
    );
};

// This is an experience audit, not another Sudoku technique solver. It follows
// the easiest currently available single and measures how many empty cells the
// player must visually compare to notice it. Normal passes only when that path
// always offers a move in a row, column, or box with at most three empty cells.
export const auditSudokuHumanFlow = (
    source: Board | number[][],
    maximumComfortableScanCost = NORMAL_HUMAN_FLOW_MAXIMUM_SCAN_COST
): SudokuHumanFlowAudit => {
    const board = toNumericBoard(source);
    const steps: HumanFlowStep[] = [];

    while (board.some(row => row.some(value => value === 0))) {
        const moves = getAvailableSingles(board);
        if (moves.length === 0) {
            const maximumScanCost = Math.max(0, ...steps.map(step => step.scanCost));
            return {
                solved: false,
                comfortable: false,
                maximumScanCost,
                bottleneckSteps: steps.filter(step =>
                    step.scanCost > maximumComfortableScanCost
                ).length,
                steps
            };
        }

        const move = moves[0];
        steps.push({ ...move, availableMoves: moves.length });
        board[move.row][move.col] = move.value;
    }

    const maximumScanCost = Math.max(0, ...steps.map(step => step.scanCost));
    return {
        solved: true,
        comfortable: maximumScanCost <= maximumComfortableScanCost,
        maximumScanCost,
        bottleneckSteps: steps.filter(step =>
            step.scanCost > maximumComfortableScanCost
        ).length,
        steps
    };
};
