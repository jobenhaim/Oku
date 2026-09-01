import type {
    Board,
    HintCandidateExclusion,
    HintCandidateProgress,
} from '../types';

export type HintTechnique = 'nakedSingle' | 'hiddenSingle' | 'lockedCandidate' | 'nakedPair' | 'hiddenPair' | 'nakedTriple' | 'hiddenTriple' | 'xWing' | 'swordfish' | 'xyWing' | 'simpleColoring' | 'multiStep';
export type HintUnitKind = 'row' | 'column' | 'box';

export interface HintCoordinate {
    row: number;
    col: number;
}

export interface HintUnit {
    kind: HintUnitKind;
    index: number;
    cells: HintCoordinate[];
}

export interface HintCandidateMark extends HintCoordinate {
    value: number;
    tone: 'possible' | 'locked' | 'eliminated' | 'answer';
}

export interface HintCandidateTransition extends HintCoordinate {
    beforeCandidates: number[];
    removedValue: number;
    afterCandidates: number[];
}

export type HintCandidateBreakdownMark =
    | { value: number; tone: 'blocked'; blockedBy: HintCoordinate }
    | { value: number; tone: 'remaining' };

export interface HintCandidateBreakdown extends HintCoordinate {
    marks: HintCandidateBreakdownMark[];
}

export type HintCandidateNoteTone = 'possible' | 'locked' | 'support' | 'blocked' | 'removed' | 'remaining';

export interface HintCandidateNoteSet extends HintCoordinate {
    marks: Array<{ value: number; tone: HintCandidateNoteTone }>;
}

export interface HintCandidateDelta extends HintCoordinate {
    beforeCandidates: number[];
    removedValues: number[];
    afterCandidates: number[];
}

export interface HintVisibleNoteUpdate extends HintCoordinate {
    beforeNotes: number[];
    afterNotes: number[];
}

export interface HintGuideUnit {
    kind: HintUnitKind;
    index: number;
}

export interface HintTextPart {
    text: string;
    tone?: 'candidate' | 'source' | 'support' | 'secondary' | 'remaining' | 'removed';
    emphasis?: boolean;
}

export type HintTextTone = NonNullable<HintTextPart['tone']>;

const candidateValuePart = (
    value: number,
    tone: HintTextTone = 'source',
): HintTextPart => ({
    text: `${value}`,
    tone,
    emphasis: true,
});

const candidateValueParts = (
    values: readonly number[],
    tone: HintTextTone = 'source',
): HintTextPart[] => values.flatMap((value, index) => {
    if (index === 0) return [candidateValuePart(value, tone)];
    const separator = values.length === 2
        ? ' and '
        : index === values.length - 1
            ? ', and '
            : ', ';
    return [{ text: separator }, candidateValuePart(value, tone)];
});

export interface HintVisualFrame {
    id: string;
    techniqueLabel?: string;
    title: string;
    body: string;
    titleParts?: HintTextPart[];
    bodyParts?: HintTextPart[];
    accessibleDetail?: string;
    spotlightCells: HintCoordinate[];
    unitCells?: HintCoordinate[];
    contextCells?: HintCoordinate[];
    sourceCells?: HintCoordinate[];
    supportSourceCells?: HintCoordinate[];
    guideUnits?: HintGuideUnit[];
    guideStrokeTone?: 'normal' | 'soft' | 'support';
    unitStrokeTone?: 'normal' | 'soft';
    eliminationStyle?: 'cell-x' | 'candidate-slash';
    fillEliminatedCells?: boolean;
    fillTargetCell?: boolean;
    candidateMarks?: HintCandidateMark[];
    candidateTransition?: HintCandidateTransition;
    candidateBreakdown?: HintCandidateBreakdown;
    candidateNoteSets?: HintCandidateNoteSet[];
    candidateUpdateCells?: HintCoordinate[];
    remainingDigit?: number;
    target?: HintCoordinate & { value: number };
    dimUnrelated?: boolean;
}

const CELL_REFERENCE_SPLIT = /(\bthis cell(?:['’]s)?\b)/gi;
const CELL_REFERENCE_EXACT = /^this cell(?:['’]s)?$/i;

/** Match a cell-reference phrase to the visual role of that cell on the grid. */
export const hintCellReferenceToneForFrame = (
    frame: HintVisualFrame,
): HintTextTone => {
    if (frame.target || (frame.candidateUpdateCells?.length ?? 0) > 0) {
        return 'remaining';
    }
    if (
        frame.fillEliminatedCells
        && frame.candidateMarks?.some(mark => mark.tone === 'eliminated')
    ) {
        return 'removed';
    }
    return 'source';
};

/** Color only “this cell” while preserving every surrounding copy style. */
export const colorHintCellReferences = (
    parts: readonly HintTextPart[],
    tone: HintTextTone,
): HintTextPart[] => parts.flatMap(part => (
    part.text
        .split(CELL_REFERENCE_SPLIT)
        .filter(Boolean)
        .map(text => ({
            ...part,
            text,
            tone: CELL_REFERENCE_EXACT.test(text) ? tone : part.tone,
        }))
));

export interface HintDeduction {
    id: string;
    technique: 'lockedCandidate' | 'nakedPair' | 'hiddenPair' | 'nakedTriple' | 'hiddenTriple' | 'xWing' | 'swordfish' | 'xyWing' | 'simpleColoring';
    techniqueLabel: string;
    candidateEliminations: HintCandidateDelta[];
}

interface HintPlanBase {
    technique: HintTechnique;
    techniqueLabel: string;
    frames: HintVisualFrame[];
    candidateEliminations?: HintCandidateDelta[];
    deductions?: HintDeduction[];
}

export interface HintPlacementPlan extends HintPlanBase {
    outcome: 'placement';
    target: HintCoordinate & { value: number };
    derivedResult?: 'naked' | 'hidden';
}

export interface HintCandidatePlan extends HintPlanBase {
    outcome: 'candidate';
    candidateEliminations: HintCandidateDelta[];
    noteUpdates: HintVisibleNoteUpdate[];
}

export type HintPlan = HintPlacementPlan | HintCandidatePlan;

export interface HintPlanOptions {
    candidateProgress?: HintCandidateProgress | null;
    /** Deterministic local-preview override; normal gameplay leaves this unset. */
    preferredTechnique?: Exclude<HintTechnique, 'nakedSingle' | 'hiddenSingle' | 'multiStep'>;
}

export type HintPlanResult =
    | { status: 'ready'; plan: HintPlan }
    | { status: 'wrong-board' }
    | { status: 'complete' }
    | { status: 'unsupported' }
    | { status: 'invalid' };

export type HintSearchTermination =
    | 'found'
    | 'exhausted'
    | 'depth-limit'
    | 'state-limit'
    | 'invalid';

export interface HintSearchDiagnostics {
    termination: HintSearchTermination;
    exploredStates: number;
    visitedStates: number;
    generatedTransitions: number;
    maxDepthReached: number;
    deductionCount?: number;
    techniqueSequence?: Array<'lockedCandidate' | 'nakedPair' | 'hiddenPair' | 'nakedTriple' | 'xWing' | 'xyWing'>;
    target?: HintCoordinate & { value: number };
}

export interface HintSearchOptions {
    maxDeductions?: number;
    maxStates?: number;
}

type NumericBoard = number[][];
type CandidateGrid = number[][][];

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const coordinateKey = ({ row, col }: HintCoordinate) => `${row}:${col}`;

const uniqueCoordinates = (coordinates: HintCoordinate[]) => {
    const seen = new Set<string>();
    return coordinates.filter((coordinate) => {
        const key = coordinateKey(coordinate);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const describeCoordinate = ({ row, col }: HintCoordinate) => (
    `row ${row + 1}, column ${col + 1}`
);

const describeCoordinates = (coordinates: HintCoordinate[]) => (
    coordinates.map(describeCoordinate).join('; ')
);

const isNineByNine = (value: unknown): value is unknown[][] => (
    Array.isArray(value)
    && value.length === 9
    && value.every(row => Array.isArray(row) && row.length === 9)
);

const isValidCell = (value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const cell = value as { value?: unknown; isFixed?: unknown };
    return (
        typeof cell.isFixed === 'boolean'
        && (cell.value === null || (
            Number.isInteger(cell.value)
            && Number(cell.value) >= 1
            && Number(cell.value) <= 9
        ))
    );
};

const hasAllDigits = (values: number[]) => (
    values.length === 9 && new Set(values).size === 9 && values.every(value => DIGITS.includes(value as typeof DIGITS[number]))
);

const isValidSolution = (solution: number[][]) => {
    for (let index = 0; index < 9; index++) {
        if (!hasAllDigits(solution[index])) return false;
        if (!hasAllDigits(solution.map(row => row[index]))) return false;
    }
    for (let box = 0; box < 9; box++) {
        const values = getUnitCells('box', box).map(cell => solution[cell.row][cell.col]);
        if (!hasAllDigits(values)) return false;
    }
    return true;
};

const toNumericBoard = (board: Board): NumericBoard => (
    board.map(row => row.map(cell => cell.value ?? 0))
);

const getBoxIndex = (row: number, col: number) => (
    Math.floor(row / 3) * 3 + Math.floor(col / 3)
);

const getUnitCells = (kind: HintUnitKind, index: number): HintCoordinate[] => {
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

const getAllUnits = (): HintUnit[] => {
    const units: HintUnit[] = [];
    for (let index = 0; index < 9; index++) {
        units.push({ kind: 'row', index, cells: getUnitCells('row', index) });
        units.push({ kind: 'column', index, cells: getUnitCells('column', index) });
        units.push({ kind: 'box', index, cells: getUnitCells('box', index) });
    }
    return units;
};

const ALL_UNITS = getAllUnits();

const getPeers = (row: number, col: number): HintCoordinate[] => uniqueCoordinates([
    ...getUnitCells('row', row),
    ...getUnitCells('column', col),
    ...getUnitCells('box', getBoxIndex(row, col)),
]).filter(peer => peer.row !== row || peer.col !== col);

const getCandidates = (board: NumericBoard, row: number, col: number): number[] => {
    if (board[row][col] !== 0) return [];
    const blocked = new Set(
        getPeers(row, col)
            .map(peer => board[peer.row][peer.col])
            .filter(Boolean)
    );
    return DIGITS.filter(value => !blocked.has(value));
};

const getCandidateGrid = (board: NumericBoard): number[][][] => (
    Array.from({ length: 9 }, (_, row) => (
        Array.from({ length: 9 }, (_, col) => getCandidates(board, row, col))
    ))
);

const compareCandidateExclusions = (
    left: HintCandidateExclusion,
    right: HintCandidateExclusion,
) => left.row - right.row || left.col - right.col || left.value - right.value;

const normalizeCandidateExclusions = (
    exclusions: HintCandidateExclusion[],
): HintCandidateExclusion[] => {
    const seen = new Set<string>();
    return [...exclusions]
        .filter(exclusion => (
            Number.isInteger(exclusion.row)
            && exclusion.row >= 0
            && exclusion.row < 9
            && Number.isInteger(exclusion.col)
            && exclusion.col >= 0
            && exclusion.col < 9
            && Number.isInteger(exclusion.value)
            && exclusion.value >= 1
            && exclusion.value <= 9
        ))
        .sort(compareCandidateExclusions)
        .filter(exclusion => {
            const key = `${exclusion.row}:${exclusion.col}:${exclusion.value}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map(exclusion => ({ ...exclusion }));
};

const HINT_BOARD_SIGNATURE_PATTERN = /^[0-9]{9}(\/[0-9]{9}){8}$/;
const HINT_CANDIDATE_PROGRESS_INTEGRITY_PATTERN = /^h1-[0-9a-f]{16}$/;

const hasStrictCandidateExclusions = (
    value: unknown,
): value is HintCandidateExclusion[] => {
    if (!Array.isArray(value)) return false;
    const seen = new Set<string>();
    return value.every(raw => {
        if (!raw || typeof raw !== 'object') return false;
        const exclusion = raw as Partial<HintCandidateExclusion>;
        if (
            !Number.isInteger(exclusion.row)
            || (exclusion.row as number) < 0
            || (exclusion.row as number) > 8
            || !Number.isInteger(exclusion.col)
            || (exclusion.col as number) < 0
            || (exclusion.col as number) > 8
            || !Number.isInteger(exclusion.value)
            || (exclusion.value as number) < 1
            || (exclusion.value as number) > 9
        ) return false;
        const key = `${exclusion.row}:${exclusion.col}:${exclusion.value}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const candidateProgressHashPart = (payload: string, seed: number) => {
    let hash = seed >>> 0;
    for (let index = 0; index < payload.length; index++) {
        hash ^= payload.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
        hash ^= hash >>> 13;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * Deterministic, Firestore-safe digest for solver-owned candidate proof. This
 * is an integrity checksum, not an authentication mechanism: it catches stale,
 * partial, or manually edited persisted ledgers before they influence a Hint.
 */
export const computeHintCandidateProgressIntegrity = (
    boardSignature: string,
    exclusions: HintCandidateExclusion[],
    version: 1 = 1,
) => {
    const canonicalExclusions = normalizeCandidateExclusions(exclusions)
        .map(exclusion => `${exclusion.row}:${exclusion.col}:${exclusion.value}`)
        .join(',');
    const payload = `${version}|${boardSignature}|${canonicalExclusions}`;
    return `h1-${candidateProgressHashPart(payload, 0x811c9dc5)}${candidateProgressHashPart(payload, 0x9e3779b9)}`;
};

/** Validate the full persisted proof before any exclusion is consumed. */
export const hasValidHintCandidateProgressIntegrity = (
    value: unknown,
): value is HintCandidateProgress => {
    if (!value || typeof value !== 'object') return false;
    const progress = value as Partial<HintCandidateProgress>;
    if (
        progress.version !== 1
        || typeof progress.boardSignature !== 'string'
        || !HINT_BOARD_SIGNATURE_PATTERN.test(progress.boardSignature)
        || !hasStrictCandidateExclusions(progress.exclusions)
        || typeof progress.integrity !== 'string'
        || !HINT_CANDIDATE_PROGRESS_INTEGRITY_PATTERN.test(progress.integrity)
    ) return false;
    return progress.integrity === computeHintCandidateProgressIntegrity(
        progress.boardSignature,
        progress.exclusions,
        progress.version,
    );
};

const makeHintCandidateProgress = (
    boardSignature: string,
    exclusions: HintCandidateExclusion[],
): HintCandidateProgress => {
    const normalizedExclusions = normalizeCandidateExclusions(exclusions);
    return {
        version: 1,
        boardSignature,
        exclusions: normalizedExclusions,
        integrity: computeHintCandidateProgressIntegrity(boardSignature, normalizedExclusions),
    };
};

const parseBoardSignature = (signature: string): NumericBoard | null => {
    const rows = signature.split('/');
    if (rows.length !== 9 || rows.some(row => !/^\d{9}$/.test(row))) return null;
    return rows.map(row => [...row].map(value => Number(value)));
};

const numericBoardSignature = (board: NumericBoard) => (
    board.map(row => row.join('')).join('/')
);

const isMonotonicBoardAdvance = (
    previous: NumericBoard,
    current: NumericBoard,
    solvedBoard: number[][],
) => {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const before = previous[row][col];
            const after = current[row][col];
            if (before !== 0 && before !== after) return false;
            if (before === 0 && after !== 0 && after !== solvedBoard[row][col]) return false;
        }
    }
    return true;
};

const hasSafeCandidateGrid = (
    board: NumericBoard,
    solvedBoard: number[][],
    candidates: CandidateGrid,
) => candidates.every((rowCandidates, row) => rowCandidates.every((cellCandidates, col) => (
    board[row][col] !== 0
        ? cellCandidates.length === 0
        : cellCandidates.length > 0 && cellCandidates.includes(solvedBoard[row][col])
)));

const candidateGridFromProgress = (
    board: NumericBoard,
    progress: HintCandidateProgress,
): CandidateGrid => {
    const candidates = getCandidateGrid(board);
    for (const exclusion of progress.exclusions) {
        candidates[exclusion.row][exclusion.col] = candidates[exclusion.row][exclusion.col]
            .filter(value => value !== exclusion.value);
    }
    return candidates;
};

/** Create an empty, Firestore-safe logical-candidate ledger for this board. */
export const createHintCandidateProgress = (board: Board): HintCandidateProgress => (
    makeHintCandidateProgress(numericBoardSignature(toNumericBoard(board)), [])
);

/**
 * Reconcile solver-owned candidate progress with placed values. Correct forward
 * play keeps still-relevant exclusions; erasing/changing a value resets them.
 * Player notes never participate in this decision.
 */
export const reconcileHintCandidateProgress = (
    board: Board,
    solvedBoard: number[][],
    progress?: HintCandidateProgress | null,
): HintCandidateProgress => {
    const numericBoard = toNumericBoard(board);
    const boardSignature = numericBoardSignature(numericBoard);
    if (
        !progress
        || !hasValidHintCandidateProgressIntegrity(progress)
        || !isNineByNine(solvedBoard)
        || !isValidSolution(solvedBoard)
    ) {
        return makeHintCandidateProgress(boardSignature, []);
    }

    const previousBoard = parseBoardSignature(progress.boardSignature);
    if (
        !previousBoard
        || (
            progress.boardSignature !== boardSignature
            && !isMonotonicBoardAdvance(previousBoard, numericBoard, solvedBoard)
        )
    ) {
        return makeHintCandidateProgress(boardSignature, []);
    }

    const legalCandidates = getCandidateGrid(numericBoard);
    const exclusions = normalizeCandidateExclusions(progress.exclusions).filter(exclusion => (
        numericBoard[exclusion.row][exclusion.col] === 0
        && legalCandidates[exclusion.row][exclusion.col].includes(exclusion.value)
        && solvedBoard[exclusion.row][exclusion.col] !== exclusion.value
    ));
    const reconciled = makeHintCandidateProgress(boardSignature, exclusions);
    const candidates = candidateGridFromProgress(numericBoard, reconciled);
    return hasSafeCandidateGrid(numericBoard, solvedBoard, candidates)
        ? reconciled
        : makeHintCandidateProgress(boardSignature, []);
};

/** Stable key useful for save deduplication and memoized Hint planning. */
export const hintCandidateProgressSignature = (progress: HintCandidateProgress) => (
    `${progress.version}|${progress.boardSignature}|${normalizeCandidateExclusions(progress.exclusions)
        .map(exclusion => `${exclusion.row}:${exclusion.col}:${exclusion.value}`)
        .join(',')}|${hasValidHintCandidateProgressIntegrity(progress) ? progress.integrity : 'invalid'}`
);

const findBlocker = (
    board: NumericBoard,
    row: number,
    col: number,
    value: number,
): HintCoordinate | null => (
    getPeers(row, col).find(peer => board[peer.row][peer.col] === value) ?? null
);

const selectMinimalBlockers = (
    board: NumericBoard,
    cells: HintCoordinate[],
    value: number,
): HintCoordinate[] => {
    if (cells.length === 0) return [];

    const blockers = uniqueCoordinates(
        cells.flatMap(cell => getPeers(cell.row, cell.col).filter(peer => (
            board[peer.row][peer.col] === value
        )))
    ).sort((left, right) => left.row - right.row || left.col - right.col);

    let best: { blockers: HintCoordinate[]; distance: number; key: string } | null = null;
    const subsetCount = 2 ** blockers.length;

    for (let mask = 1; mask < subsetCount; mask += 1) {
        const selected = blockers.filter((_, index) => (mask & (1 << index)) !== 0);
        if (best && selected.length > best.blockers.length) continue;

        const distances = cells.map(cell => {
            const coveringDistances = selected
                .filter(blocker => getPeers(cell.row, cell.col).some(peer => (
                    peer.row === blocker.row && peer.col === blocker.col
                )))
                .map(blocker => Math.abs(cell.row - blocker.row) + Math.abs(cell.col - blocker.col));
            return coveringDistances.length > 0 ? Math.min(...coveringDistances) : null;
        });
        if (distances.some(distance => distance === null)) continue;

        const distance = distances.reduce<number>((total, current) => total + (current ?? 0), 0);
        const key = selected.map(coordinateKey).join('|');
        if (
            !best
            || selected.length < best.blockers.length
            || (selected.length === best.blockers.length && distance < best.distance)
            || (selected.length === best.blockers.length && distance === best.distance && key < best.key)
        ) {
            best = { blockers: selected, distance, key };
        }
    }

    return best?.blockers ?? [];
};

const makeCandidateBreakdown = (
    board: NumericBoard,
    row: number,
    col: number,
    remainingValue: number,
): HintCandidateBreakdown | null => {
    const marks: HintCandidateBreakdownMark[] = [];

    for (const value of DIGITS) {
        if (value === remainingValue) {
            marks.push({ value, tone: 'remaining' });
            continue;
        }

        const blockedBy = findBlocker(board, row, col, value);
        if (!blockedBy) return null;
        marks.push({ value, tone: 'blocked', blockedBy });
    }

    return { row, col, marks };
};

const UNIT_KIND_PRIORITY: Record<HintUnitKind, number> = {
    box: 0,
    row: 1,
    column: 2,
};

const shortestUnitFor = (board: NumericBoard, row: number, col: number): HintUnit => {
    const units = [
        { kind: 'box' as const, index: getBoxIndex(row, col) },
        { kind: 'row' as const, index: row },
        { kind: 'column' as const, index: col },
    ].map(unit => ({ ...unit, cells: getUnitCells(unit.kind, unit.index) }));

    return units.sort((left, right) => {
        const leftEmpty = left.cells.filter(cell => board[cell.row][cell.col] === 0).length;
        const rightEmpty = right.cells.filter(cell => board[cell.row][cell.col] === 0).length;
        return leftEmpty - rightEmpty
            || UNIT_KIND_PRIORITY[left.kind] - UNIT_KIND_PRIORITY[right.kind]
            || left.index - right.index;
    })[0];
};

const unitName = (unit: HintUnit) => {
    if (unit.kind === 'box') return '3 × 3 box';
    return unit.kind;
};

const makeNakedSinglePlan = (
    board: NumericBoard,
    candidates: number[][][],
): HintPlan | null => {
    const matches: Array<{ row: number; col: number; value: number; unit: HintUnit; scanCost: number }> = [];
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (candidates[row][col].length !== 1) continue;
            const unit = shortestUnitFor(board, row, col);
            matches.push({
                row,
                col,
                value: candidates[row][col][0],
                unit,
                scanCost: unit.cells.filter(cell => board[cell.row][cell.col] === 0).length,
            });
        }
    }

    const match = matches.sort((left, right) => (
        left.scanCost - right.scanCost
        || left.row - right.row
        || left.col - right.col
        || UNIT_KIND_PRIORITY[left.unit.kind] - UNIT_KIND_PRIORITY[right.unit.kind]
        || left.unit.index - right.unit.index
    ))[0];
    if (!match) return null;

    const { row, col, value, unit, scanCost } = match;
    const target = { row, col, value };
    if (scanCost === 1) {
        const guideUnit = { kind: unit.kind, index: unit.index };
        const name = unitName(unit);
        return {
            outcome: 'placement',
            technique: 'nakedSingle',
            techniqueLabel: 'Full house',
            target,
            frames: [
                {
                    id: 'unit-completion-look',
                    title: `Look at this ${name}`,
                    body: 'Only one cell is empty.',
                    accessibleDetail: `The empty cell is ${describeCoordinate(target)}.`,
                    spotlightCells: [],
                    guideUnits: [guideUnit],
                    dimUnrelated: true,
                },
                {
                    id: 'unit-completion-answer',
                    title: `The only number left is ${value}`,
                    body: `Every other number already appears in this ${name}.`,
                    titleParts: [
                        { text: 'The only number left is ' },
                        candidateValuePart(value, 'remaining'),
                    ],
                    accessibleDetail: `${value} is the missing number for ${describeCoordinate(target)}.`,
                    spotlightCells: [],
                    guideUnits: [guideUnit],
                    dimUnrelated: true,
                },
                {
                    id: 'unit-completion-place',
                    title: `This cell must be ${value}`,
                    body: `It completes the ${name}.`,
                    titleParts: [
                        { text: 'This cell must be ' },
                        candidateValuePart(value, 'remaining'),
                    ],
                    accessibleDetail: `Place ${value} at ${describeCoordinate(target)}.`,
                    spotlightCells: [{ row, col }],
                    guideUnits: [guideUnit],
                    guideStrokeTone: 'soft',
                    candidateMarks: [{ row, col, value, tone: 'answer' }],
                    target,
                    dimUnrelated: true,
                },
            ],
        };
    }

    const candidateBreakdown = makeCandidateBreakdown(board, row, col, value);
    if (!candidateBreakdown) {
        const legalCandidates = getCandidates(board, row, col);
        const logicallyRemoved = legalCandidates.filter(candidate => (
            !candidates[row][col].includes(candidate)
        ));
        if (logicallyRemoved.length === 0) return null;
        const noteSet: HintCandidateNoteSet = {
            row,
            col,
            marks: legalCandidates.map(candidate => ({
                value: candidate,
                tone: candidate === value ? 'remaining' : 'removed',
            })),
        };
        return {
            outcome: 'placement',
            technique: 'nakedSingle',
            techniqueLabel: 'Naked single',
            target,
            frames: [
                {
                    id: 'candidate-single-look',
                    title: 'Look at this cell',
                    body: 'Your earlier candidate update narrowed its choices.',
                    accessibleDetail: `The solver-owned candidate progress applies to ${describeCoordinate(target)}.`,
                    spotlightCells: [{ row, col }],
                    dimUnrelated: true,
                },
                {
                    id: 'candidate-single-remains',
                    title: `Only ${value} remains`,
                    body: `The crossed-out candidates were ruled out earlier.`,
                    titleParts: [
                        { text: 'Only ' },
                        candidateValuePart(value, 'remaining'),
                        { text: ' remains' },
                    ],
                    accessibleDetail: `Earlier logical deductions removed ${formatCandidateValues(logicallyRemoved)}, leaving only ${value} at ${describeCoordinate(target)}.`,
                    spotlightCells: [{ row, col }],
                    candidateNoteSets: [noteSet],
                    eliminationStyle: 'candidate-slash',
                    fillEliminatedCells: false,
                    dimUnrelated: true,
                },
                {
                    id: 'candidate-single-answer',
                    title: `This cell must be ${value}`,
                    body: 'It is the only candidate left.',
                    titleParts: [
                        { text: 'This cell must be ' },
                        candidateValuePart(value, 'remaining'),
                    ],
                    accessibleDetail: `Place ${value} at ${describeCoordinate(target)}.`,
                    spotlightCells: [{ row, col }],
                    candidateMarks: [{ row, col, value, tone: 'answer' }],
                    target,
                    dimUnrelated: true,
                },
            ],
        };
    }
    const blockedMarks = candidateBreakdown.marks.filter((mark): mark is Extract<
        HintCandidateBreakdownMark,
        { tone: 'blocked' }
    > => mark.tone === 'blocked');
    const sourceCells = uniqueCoordinates(blockedMarks.map(mark => mark.blockedBy));

    return {
        outcome: 'placement',
        technique: 'nakedSingle',
        techniqueLabel: 'Naked single',
        target,
        frames: [
            {
                id: 'naked-look',
                title: 'Look at this cell',
                body: 'Which number can go here?',
                accessibleDetail: `Check ${describeCoordinate(target)} against its row, column, and 3 × 3 box.`,
                spotlightCells: [{ row, col }],
                dimUnrelated: true,
            },
            {
                id: 'naked-rule-out',
                title: `Only ${value} can fit`,
                body: "Each other candidate is blocked by a placed number in this cell's row, column, or box.",
                titleParts: [
                    { text: 'Only ' },
                    candidateValuePart(value, 'remaining'),
                    { text: ' can fit' },
                ],
                spotlightCells: [{ row, col }],
                guideUnits: [
                    { kind: 'row', index: row },
                    { kind: 'column', index: col },
                    { kind: 'box', index: getBoxIndex(row, col) },
                ],
                guideStrokeTone: 'soft',
                sourceCells,
                candidateBreakdown,
                accessibleDetail: `${blockedMarks.map(mark => (
                    `${mark.value} is blocked by ${describeCoordinate(mark.blockedBy)}`
                )).join('; ')}. Only ${value} remains at ${describeCoordinate(target)}.`,
                dimUnrelated: true,
            },
            {
                id: 'naked-answer',
                title: `This cell must be ${value}`,
                body: 'It is the only number that fits.',
                titleParts: [
                    { text: 'This cell must be ' },
                    candidateValuePart(value, 'remaining'),
                ],
                accessibleDetail: `Place ${value} at ${describeCoordinate(target)}.`,
                spotlightCells: [{ row, col }],
                candidateMarks: [{ row, col, value, tone: 'answer' }],
                target,
                dimUnrelated: true,
            },
        ],
    };
};

interface HiddenSingleMatch {
    unit: HintUnit;
    row: number;
    col: number;
    value: number;
    emptyCount: number;
}

const findHiddenSingleMatches = (
    board: NumericBoard,
    candidates: number[][][],
): HiddenSingleMatch[] => {
    const matches: HiddenSingleMatch[] = [];
    for (const unit of ALL_UNITS) {
        const emptyCells = unit.cells.filter(cell => board[cell.row][cell.col] === 0);
        for (const value of DIGITS) {
            if (unit.cells.some(cell => board[cell.row][cell.col] === value)) continue;
            const positions = emptyCells.filter(cell => (
                candidates[cell.row][cell.col].includes(value)
            ));
            if (positions.length !== 1) continue;
            matches.push({
                unit,
                row: positions[0].row,
                col: positions[0].col,
                value,
                emptyCount: emptyCells.length,
            });
        }
    }

    return matches.sort((left, right) => (
        left.emptyCount - right.emptyCount
        || UNIT_KIND_PRIORITY[left.unit.kind] - UNIT_KIND_PRIORITY[right.unit.kind]
        || left.unit.index - right.unit.index
        || left.value - right.value
        || left.row - right.row
        || left.col - right.col
    ));
};

const makeHiddenSinglePlan = (
    board: NumericBoard,
    candidates: number[][][],
): HintPlan | null => {
    const match = findHiddenSingleMatches(board, candidates)[0];
    if (!match) return null;

    const { unit, row, col, value } = match;
    const target = { row, col, value };
    const otherEmptyCells = unit.cells.filter(cell => (
        board[cell.row][cell.col] === 0
        && (cell.row !== row || cell.col !== col)
    ));
    const sourceCells = uniqueCoordinates(
        otherEmptyCells
            .map(cell => findBlocker(board, cell.row, cell.col, value))
            .filter((cell): cell is HintCoordinate => cell !== null)
    );
    const logicallyRemovedCells = otherEmptyCells.filter(cell => (
        getCandidates(board, cell.row, cell.col).includes(value)
        && !candidates[cell.row][cell.col].includes(value)
    ));
    const hasLogicalRemovals = logicallyRemovedCells.length > 0;
    const placedBlockedCells = otherEmptyCells.filter(cell => (
        !logicallyRemovedCells.some(removed => coordinateKey(removed) === coordinateKey(cell))
    ));

    return {
        outcome: 'placement',
        technique: 'hiddenSingle',
        techniqueLabel: 'Hidden single',
        target,
        frames: [
            {
                id: 'hidden-look',
                title: `Look at this ${unitName(unit)}`,
                body: `${value} is missing from this ${unitName(unit)}.`,
                bodyParts: [
                    candidateValuePart(value),
                    { text: ` is missing from this ${unitName(unit)}.` },
                ],
                accessibleDetail: `The highlighted ${unitName(unit)} does not contain ${value}.`,
                spotlightCells: [],
                unitCells: unit.cells,
                dimUnrelated: true,
            },
            {
                id: 'hidden-blocked',
                title: `Only one place for ${value}`,
                body: hasLogicalRemovals
                    ? `Placed numbers and earlier candidate updates rule out every other ${value}.`
                    : `The placed ${value}s rule out every other cell in this ${unitName(unit)}.`,
                titleParts: [
                    { text: 'Only one place for ' },
                    candidateValuePart(value),
                ],
                bodyParts: hasLogicalRemovals
                    ? [
                        { text: 'Placed numbers and earlier candidate updates rule out every other ' },
                        candidateValuePart(value, 'removed'),
                        { text: '.' },
                    ]
                    : [
                        { text: 'The placed ' },
                        candidateValuePart(value),
                        { text: `s rule out every other cell in this ${unitName(unit)}.` },
                    ],
                accessibleDetail: hasLogicalRemovals
                    ? `Earlier deductions remove ${value} from ${describeCoordinates(logicallyRemovedCells)}${placedBlockedCells.length > 0 ? `, while placed ${value}s block ${describeCoordinates(placedBlockedCells)}` : ''}. That leaves ${describeCoordinate(target)} as the only place for ${value} in this ${unitName(unit)}.`
                    : `Existing ${value}s block ${describeCoordinates(otherEmptyCells)}, leaving ${describeCoordinate(target)} as the only place for ${value} in this ${unitName(unit)}.`,
                spotlightCells: [{ row, col }],
                contextCells: unit.cells,
                sourceCells,
                candidateMarks: [
                    ...otherEmptyCells.map(cell => ({ ...cell, value, tone: 'eliminated' as const })),
                ],
                eliminationStyle: 'candidate-slash',
                dimUnrelated: true,
            },
            {
                id: 'hidden-answer',
                title: 'Only this cell remains',
                body: `So ${value} belongs here.`,
                bodyParts: [
                    { text: 'So ' },
                    candidateValuePart(value, 'remaining'),
                    { text: ' belongs here.' },
                ],
                accessibleDetail: `Place ${value} at ${describeCoordinate(target)}; it is the only cell left for ${value} in this ${unitName(unit)}.`,
                spotlightCells: [{ row, col }],
                candidateMarks: [{ row, col, value, tone: 'answer' }],
                target,
                dimUnrelated: true,
            },
        ],
    };
};

type LockedCandidateVariant = 'pointing' | 'claiming';
type LockedCandidateResultKind = 'naked' | 'hidden';

interface LockedCandidatePattern {
    variant: LockedCandidateVariant;
    value: number;
    sourceUnit: HintUnit;
    intersectingUnit: HintUnit;
    lockedCells: HintCoordinate[];
    eliminationCells: HintCoordinate[];
}

interface LockedCandidateMatch extends LockedCandidatePattern {
    resultKind: LockedCandidateResultKind;
    target: HintCoordinate & { value: number };
    resultUnit?: HintUnit;
    beforeCandidates?: number[];
    afterCandidates?: number[];
}

const cloneCandidateGrid = (candidates: CandidateGrid): CandidateGrid => (
    candidates.map(row => row.map(cell => [...cell]))
);

const findLockedCandidatePatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): LockedCandidatePattern[] => {
    const patterns: LockedCandidatePattern[] = [];

    const addPattern = (
        variant: LockedCandidateVariant,
        value: number,
        sourceUnit: HintUnit,
        intersectingUnit: HintUnit,
        lockedCells: HintCoordinate[],
    ) => {
        const sourceKeys = new Set(sourceUnit.cells.map(coordinateKey));
        const eliminationCells = intersectingUnit.cells.filter(cell => (
            !sourceKeys.has(coordinateKey(cell))
            && board[cell.row][cell.col] === 0
            && candidates[cell.row][cell.col].includes(value)
        ));
        if (eliminationCells.length === 0) return;
        patterns.push({
            variant,
            value,
            sourceUnit,
            intersectingUnit,
            lockedCells,
            eliminationCells,
        });
    };

    // Pointing: every position for a digit inside one box shares a row or
    // column, so that digit can be removed from the rest of that line.
    for (let box = 0; box < 9; box++) {
        const sourceUnit: HintUnit = {
            kind: 'box',
            index: box,
            cells: getUnitCells('box', box),
        };
        for (const value of DIGITS) {
            const lockedCells = sourceUnit.cells.filter(cell => (
                board[cell.row][cell.col] === 0
                && candidates[cell.row][cell.col].includes(value)
            ));
            // One position is a Hidden Single, not a Locked Candidate.
            if (lockedCells.length < 2) continue;

            const rows = new Set(lockedCells.map(cell => cell.row));
            if (rows.size === 1) {
                const row = lockedCells[0].row;
                addPattern(
                    'pointing',
                    value,
                    sourceUnit,
                    { kind: 'row', index: row, cells: getUnitCells('row', row) },
                    lockedCells,
                );
            }

            const columns = new Set(lockedCells.map(cell => cell.col));
            if (columns.size === 1) {
                const col = lockedCells[0].col;
                addPattern(
                    'pointing',
                    value,
                    sourceUnit,
                    { kind: 'column', index: col, cells: getUnitCells('column', col) },
                    lockedCells,
                );
            }
        }
    }

    // Claiming: every position for a digit inside one row or column shares a
    // box, so that digit can be removed from the rest of that box.
    for (const kind of ['row', 'column'] as const) {
        for (let index = 0; index < 9; index++) {
            const sourceUnit: HintUnit = {
                kind,
                index,
                cells: getUnitCells(kind, index),
            };
            for (const value of DIGITS) {
                const lockedCells = sourceUnit.cells.filter(cell => (
                    board[cell.row][cell.col] === 0
                    && candidates[cell.row][cell.col].includes(value)
                ));
                if (lockedCells.length < 2) continue;

                const boxes = new Set(lockedCells.map(cell => getBoxIndex(cell.row, cell.col)));
                if (boxes.size !== 1) continue;
                const box = getBoxIndex(lockedCells[0].row, lockedCells[0].col);
                addPattern(
                    'claiming',
                    value,
                    sourceUnit,
                    { kind: 'box', index: box, cells: getUnitCells('box', box) },
                    lockedCells,
                );
            }
        }
    }

    return patterns;
};

const applyLockedCandidatePattern = (
    candidates: CandidateGrid,
    pattern: LockedCandidatePattern,
): CandidateGrid => {
    const next = cloneCandidateGrid(candidates);
    for (const cell of pattern.eliminationCells) {
        next[cell.row][cell.col] = next[cell.row][cell.col].filter(value => (
            value !== pattern.value
        ));
    }
    return next;
};

const placementAfterLockedCandidate = (
    board: NumericBoard,
    before: CandidateGrid,
    after: CandidateGrid,
    pattern: LockedCandidatePattern,
): Pick<
    LockedCandidateMatch,
    'resultKind' | 'target' | 'resultUnit' | 'beforeCandidates' | 'afterCandidates'
> | null => {
    const nakedTargets = pattern.eliminationCells
        .filter(cell => before[cell.row][cell.col].length > 1 && after[cell.row][cell.col].length === 1)
        .map(cell => ({
            row: cell.row,
            col: cell.col,
            value: after[cell.row][cell.col][0],
        }))
        .sort((left, right) => (
            left.row - right.row
            || left.col - right.col
            || left.value - right.value
        ));
    if (nakedTargets[0]) {
        const target = nakedTargets[0];
        return {
            resultKind: 'naked',
            target,
            beforeCandidates: [...before[target.row][target.col]],
            afterCandidates: [...after[target.row][target.col]],
        };
    }

    const existingHidden = new Set(findHiddenSingleMatches(board, before).map(match => (
        `${match.row}:${match.col}:${match.value}`
    )));
    const hiddenTarget = findHiddenSingleMatches(board, after).find(match => (
        !existingHidden.has(`${match.row}:${match.col}:${match.value}`)
    ));
    if (!hiddenTarget) return null;

    return {
        resultKind: 'hidden',
        target: {
            row: hiddenTarget.row,
            col: hiddenTarget.col,
            value: hiddenTarget.value,
        },
        resultUnit: hiddenTarget.unit,
    };
};

const makeLockedCandidatePlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const matches = findLockedCandidatePatterns(board, candidates)
        .map(pattern => {
            const placement = placementAfterLockedCandidate(
                board,
                candidates,
                applyLockedCandidatePattern(candidates, pattern),
                pattern,
            );
            return placement ? { ...pattern, ...placement } : null;
        })
        .filter((match): match is LockedCandidateMatch => match !== null)
        .sort((left, right) => (
            (left.resultKind === 'naked' ? 0 : 1) - (right.resultKind === 'naked' ? 0 : 1)
            || (left.variant === 'pointing' ? 0 : 1) - (right.variant === 'pointing' ? 0 : 1)
            || left.lockedCells.length - right.lockedCells.length
            || left.eliminationCells.length - right.eliminationCells.length
            || UNIT_KIND_PRIORITY[left.sourceUnit.kind] - UNIT_KIND_PRIORITY[right.sourceUnit.kind]
            || left.sourceUnit.index - right.sourceUnit.index
            || UNIT_KIND_PRIORITY[left.intersectingUnit.kind] - UNIT_KIND_PRIORITY[right.intersectingUnit.kind]
            || left.intersectingUnit.index - right.intersectingUnit.index
            || left.value - right.value
            || left.target.row - right.target.row
            || left.target.col - right.target.col
    ));
    const match = matches[0];
    if (!match) return null;
    if (
        match.resultKind === 'naked'
        && (
            match.beforeCandidates?.length !== 2
            || match.afterCandidates?.length !== 1
            || !match.beforeCandidates.includes(match.value)
            || match.afterCandidates[0] !== match.target.value
        )
    ) return null;

    const intersectingName = unitName(match.intersectingUnit);
    const sourceName = unitName(match.sourceUnit);
    const placeCount = match.lockedCells.length === 2 ? 'two' : 'three';
    const lockedMarks: HintCandidateMark[] = match.lockedCells.map(cell => ({
        ...cell,
        value: match.value,
        tone: 'locked',
    }));
    const eliminatedMarks: HintCandidateMark[] = match.eliminationCells.map(cell => ({
        ...cell,
        value: match.value,
        tone: 'eliminated',
    }));
    const intersectingGuide = {
        kind: match.intersectingUnit.kind,
        index: match.intersectingUnit.index,
    };
    const resultUnitKeys = new Set(match.resultUnit?.cells.map(coordinateKey) ?? []);
    const causalEliminatedMarks = match.resultKind === 'hidden'
        ? eliminatedMarks.filter(mark => resultUnitKeys.has(coordinateKey(mark)))
        : eliminatedMarks.filter(mark => (
            mark.row === match.target.row && mark.col === match.target.col
        ));
    const answerMark: HintCandidateMark = { ...match.target, tone: 'answer' };
    const hiddenResultOtherCells = match.resultKind === 'hidden'
        ? (match.resultUnit?.cells ?? []).filter(cell => (
            board[cell.row][cell.col] === 0
            && (cell.row !== match.target.row || cell.col !== match.target.col)
        ))
        : [];
    const hiddenResultEliminatedMarks: HintCandidateMark[] = hiddenResultOtherCells.map(cell => ({
        ...cell,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const causalEliminationKeys = new Set(causalEliminatedMarks.map(coordinateKey));
    const hiddenResultPreBlockedCells = hiddenResultOtherCells.filter(cell => (
        !causalEliminationKeys.has(coordinateKey(cell))
        && !candidates[cell.row][cell.col].includes(match.target.value)
    ));
    const hiddenResultSupportSources = selectMinimalBlockers(
        board,
        hiddenResultPreBlockedCells,
        match.target.value,
    );
    const removeFocusUnit = match.resultKind === 'hidden'
        ? match.resultUnit!
        : match.sourceUnit;
    const removeCandidateMarks = [...lockedMarks, ...causalEliminatedMarks];
    const eliminatedCellPhrase = causalEliminatedMarks.length === 1
        ? 'the shaded cell'
        : 'the shaded cells';
    const nakedEliminatedCellPhrase = causalEliminatedMarks.length === 1
        ? 'the outlined cell'
        : 'the outlined cells';

    return {
        outcome: 'placement',
        technique: 'lockedCandidate',
        techniqueLabel: 'Locked candidates',
        target: match.target,
        derivedResult: match.resultKind,
        frames: [
            {
                id: 'locked-find',
                title: `Only ${placeCount} places for ${match.value}`,
                body: `In this ${sourceName}, ${match.value} can only go in these cells.`,
                accessibleDetail: `Candidate ${match.value} can only go at ${describeCoordinates(match.lockedCells)}.`,
                spotlightCells: [],
                unitCells: match.sourceUnit.cells,
                candidateMarks: lockedMarks,
                dimUnrelated: true,
            },
            {
                id: 'locked-remove',
                title: match.resultKind === 'hidden'
                    ? `Now look at this ${unitName(match.resultUnit!)}`
                    : `These ${match.value}s share this ${intersectingName}`,
                body: match.resultKind === 'hidden'
                    ? `The locked ${match.value}s rule out ${match.value} in ${eliminatedCellPhrase}.`
                    : `So ${match.value} cannot go in ${nakedEliminatedCellPhrase}.`,
                accessibleDetail: `Candidate ${match.value} is eliminated from ${describeCoordinates(causalEliminatedMarks)} because every possible ${match.value} in the ${sourceName} lies in this ${intersectingName}.`,
                spotlightCells: match.resultKind === 'naked'
                    ? [{ row: match.target.row, col: match.target.col }]
                    : [],
                unitCells: removeFocusUnit.cells,
                unitStrokeTone: match.resultKind === 'naked' ? 'soft' : undefined,
                contextCells: match.resultKind === 'naked' ? match.intersectingUnit.cells : undefined,
                guideUnits: match.resultKind === 'naked' ? [intersectingGuide] : undefined,
                candidateMarks: removeCandidateMarks,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: match.resultKind === 'hidden',
                candidateTransition: match.resultKind === 'naked'
                    ? {
                        row: match.target.row,
                        col: match.target.col,
                        beforeCandidates: [...match.beforeCandidates!],
                        removedValue: match.value,
                        afterCandidates: [...match.afterCandidates!],
                    }
                    : undefined,
                dimUnrelated: true,
            },
            {
                id: 'locked-answer',
                techniqueLabel: match.resultKind === 'naked' ? 'Naked single' : 'Hidden single',
                title: match.resultKind === 'naked'
                    ? `Only ${match.target.value} remains`
                    : `Only one place remains for ${match.target.value}`,
                body: match.resultKind === 'naked'
                    ? `${match.target.value} belongs in this cell.`
                    : `Every other ${match.target.value} is ruled out, so ${match.target.value} belongs in the outlined cell.`,
                accessibleDetail: match.resultKind === 'naked'
                    ? `Candidate ${match.value} is ruled out at ${describeCoordinate(match.target)}, leaving only ${match.target.value}.`
                    : `Placed ${match.target.value}s rule out ${describeCoordinates(hiddenResultPreBlockedCells)}. The locked candidates rule out ${describeCoordinates(causalEliminatedMarks)}, leaving ${describeCoordinate(match.target)}.`,
                spotlightCells: [{ row: match.target.row, col: match.target.col }],
                unitCells: match.resultUnit?.cells,
                unitStrokeTone: match.resultKind === 'hidden' ? 'soft' : undefined,
                supportSourceCells: match.resultKind === 'hidden'
                    ? hiddenResultSupportSources
                    : undefined,
                candidateMarks: match.resultKind === 'hidden'
                    ? [...hiddenResultEliminatedMarks, answerMark]
                    : [answerMark],
                eliminationStyle: match.resultKind === 'hidden' ? 'candidate-slash' : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                fillTargetCell: true,
                target: match.target,
                dimUnrelated: true,
            },
        ],
    };
};

interface NakedPairPattern {
    unit: HintUnit;
    pairCells: [HintCoordinate, HintCoordinate];
    pairValues: [number, number];
    eliminations: HintCandidateDelta[];
}

interface NakedPairNakedMatch extends NakedPairPattern {
    resultKind: 'naked';
    target: HintCoordinate & { value: number };
    beforeCandidates: number[];
    afterCandidates: number[];
    removedValues: number[];
    causalEliminations: HintCandidateDelta[];
}

interface NakedPairHiddenMatch extends NakedPairPattern {
    resultKind: 'hidden';
    target: HintCoordinate & { value: number };
    resultUnit: HintUnit;
    causalEliminations: HintCandidateDelta[];
}

type NakedPairMatch = NakedPairNakedMatch | NakedPairHiddenMatch;

const findNakedPairPatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): NakedPairPattern[] => {
    const patterns: NakedPairPattern[] = [];

    for (const unit of ALL_UNITS) {
        const cellsByPair = new Map<string, HintCoordinate[]>();
        for (const cell of unit.cells) {
            if (board[cell.row][cell.col] !== 0) continue;
            const values = candidates[cell.row][cell.col];
            if (values.length !== 2) continue;
            const key = values.join(':');
            const cells = cellsByPair.get(key) ?? [];
            cells.push(cell);
            cellsByPair.set(key, cells);
        }

        for (const [key, cells] of cellsByPair) {
            // Three cells sharing two candidates are not a Naked Pair.
            if (cells.length !== 2) continue;
            const pairValues = key.split(':').map(Number) as [number, number];
            const pairKeys = new Set(cells.map(coordinateKey));
            const eliminations = unit.cells
                .filter(cell => (
                    !pairKeys.has(coordinateKey(cell))
                    && board[cell.row][cell.col] === 0
                ))
                .map(cell => {
                    const beforeCandidates = [...candidates[cell.row][cell.col]];
                    const removedValues = beforeCandidates.filter(value => pairValues.includes(value));
                    const afterCandidates = beforeCandidates.filter(value => !pairValues.includes(value));
                    return {
                        ...cell,
                        beforeCandidates,
                        removedValues,
                        afterCandidates,
                    };
                })
                .filter(delta => delta.removedValues.length > 0);
            if (
                eliminations.length === 0
                || eliminations.some(delta => delta.afterCandidates.length === 0)
            ) continue;

            patterns.push({
                unit,
                pairCells: [cells[0], cells[1]],
                pairValues,
                eliminations,
            });
        }
    }

    return patterns;
};

const applyNakedPairPattern = (
    candidates: CandidateGrid,
    pattern: NakedPairPattern,
): CandidateGrid => {
    const next = cloneCandidateGrid(candidates);
    for (const elimination of pattern.eliminations) {
        next[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    return next;
};

const makeNakedPairPlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const matches = findNakedPairPatterns(board, candidates)
        .map((pattern): NakedPairMatch | null => {
            const after = applyNakedPairPattern(candidates, pattern);
            const nakedTarget = pattern.eliminations
                .filter(delta => (
                    delta.beforeCandidates.length > 1
                    && delta.afterCandidates.length === 1
                ))
                .map(delta => {
                    const beforeCandidates = [...delta.beforeCandidates];
                    const afterCandidates = [...after[delta.row][delta.col]];
                    return {
                        row: delta.row,
                        col: delta.col,
                        value: afterCandidates[0],
                        beforeCandidates,
                        afterCandidates,
                        removedValues: [...delta.removedValues],
                    };
                })
                .sort((left, right) => (
                    right.removedValues.length - left.removedValues.length
                    || left.row - right.row
                    || left.col - right.col
                    || left.value - right.value
                ))[0];
            if (nakedTarget) {
                const causalElimination = pattern.eliminations.find(delta => (
                    delta.row === nakedTarget.row && delta.col === nakedTarget.col
                ))!;
                return {
                    ...pattern,
                    resultKind: 'naked',
                    target: {
                        row: nakedTarget.row,
                        col: nakedTarget.col,
                        value: nakedTarget.value,
                    },
                    beforeCandidates: nakedTarget.beforeCandidates,
                    afterCandidates: nakedTarget.afterCandidates,
                    removedValues: nakedTarget.removedValues,
                    causalEliminations: [causalElimination],
                };
            }

            const existingHidden = new Set(findHiddenSingleMatches(board, candidates).map(match => (
                `${match.row}:${match.col}:${match.value}`
            )));
            for (const hiddenTarget of findHiddenSingleMatches(board, after)) {
                if (existingHidden.has(`${hiddenTarget.row}:${hiddenTarget.col}:${hiddenTarget.value}`)) {
                    continue;
                }
                const resultUnitKeys = new Set(hiddenTarget.unit.cells.map(coordinateKey));
                const causalEliminations = pattern.eliminations.filter(delta => (
                    resultUnitKeys.has(coordinateKey(delta))
                    && delta.removedValues.includes(hiddenTarget.value)
                ));
                if (causalEliminations.length === 0) continue;

                return {
                    ...pattern,
                    resultKind: 'hidden',
                    target: {
                        row: hiddenTarget.row,
                        col: hiddenTarget.col,
                        value: hiddenTarget.value,
                    },
                    resultUnit: hiddenTarget.unit,
                    causalEliminations,
                };
            }

            return null;
        })
        .filter((match): match is NakedPairMatch => match !== null)
        .sort((left, right) => (
            (left.resultKind === 'naked' ? 0 : 1) - (right.resultKind === 'naked' ? 0 : 1)
            || (
                left.resultKind === 'naked' && right.resultKind === 'naked'
                    ? right.removedValues.length - left.removedValues.length
                    : 0
            )
            || (
                left.resultKind === 'hidden' && right.resultKind === 'hidden'
                    ? left.causalEliminations.length - right.causalEliminations.length
                    : 0
            )
            || left.eliminations.length - right.eliminations.length
            || UNIT_KIND_PRIORITY[left.unit.kind] - UNIT_KIND_PRIORITY[right.unit.kind]
            || left.unit.index - right.unit.index
            || left.pairValues[0] - right.pairValues[0]
            || left.pairValues[1] - right.pairValues[1]
            || left.pairCells[0].row - right.pairCells[0].row
            || left.pairCells[0].col - right.pairCells[0].col
            || left.pairCells[1].row - right.pairCells[1].row
            || left.pairCells[1].col - right.pairCells[1].col
            || left.target.row - right.target.row
            || left.target.col - right.target.col
        ));
    const match = matches[0];
    if (!match) return null;

    const [firstValue, secondValue] = match.pairValues;
    const pairNoteSets: HintCandidateNoteSet[] = match.pairCells.map(cell => ({
        ...cell,
        marks: match.pairValues.map(value => ({ value, tone: 'locked' as const })),
    }));
    const guideUnit = { kind: match.unit.kind, index: match.unit.index };
    const removedLabel = match.resultKind === 'naked'
        ? (match.removedValues.length === 2
            ? `${match.removedValues[0]} and ${match.removedValues[1]}`
            : `${match.removedValues[0]}`)
        : '';
    const targetNoteSet: HintCandidateNoteSet | null = match.resultKind === 'naked'
        ? {
            row: match.target.row,
            col: match.target.col,
            marks: match.beforeCandidates.map(value => ({
                value,
                tone: match.afterCandidates.includes(value) ? 'remaining' : 'removed',
            })),
        }
        : null;
    const causalEliminatedMarks: HintCandidateMark[] = match.resultKind === 'hidden'
        ? match.causalEliminations.map(elimination => ({
            row: elimination.row,
            col: elimination.col,
            value: match.target.value,
            tone: 'eliminated',
        }))
        : [];
    const hiddenResultOtherCells = match.resultKind === 'hidden'
        ? match.resultUnit.cells.filter(cell => (
            board[cell.row][cell.col] === 0
            && (cell.row !== match.target.row || cell.col !== match.target.col)
        ))
        : [];
    const hiddenResultEliminatedMarks: HintCandidateMark[] = hiddenResultOtherCells.map(cell => ({
        ...cell,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const causalEliminationKeys = new Set(causalEliminatedMarks.map(coordinateKey));
    const hiddenResultPreBlockedCells = hiddenResultOtherCells.filter(cell => (
        !causalEliminationKeys.has(coordinateKey(cell))
        && !candidates[cell.row][cell.col].includes(match.target.value)
    ));
    const hiddenResultSupportSources = match.resultKind === 'hidden'
        ? selectMinimalBlockers(board, hiddenResultPreBlockedCells, match.target.value)
        : [];
    const eliminatedCellPhrase = causalEliminatedMarks.length === 1
        ? 'the shaded cell'
        : 'the shaded cells';
    const answerMark: HintCandidateMark = { ...match.target, tone: 'answer' };

    return {
        outcome: 'placement',
        technique: 'nakedPair',
        techniqueLabel: 'Naked pair',
        target: match.target,
        derivedResult: match.resultKind,
        candidateEliminations: match.eliminations.map(elimination => ({
            ...elimination,
            beforeCandidates: [...elimination.beforeCandidates],
            removedValues: [...elimination.removedValues],
            afterCandidates: [...elimination.afterCandidates],
        })),
        frames: [
            {
                id: 'pair-find',
                title: 'These cells share two choices',
                body: `They must contain ${firstValue} and ${secondValue}, in either order.`,
                accessibleDetail: `In this ${unitName(match.unit)}, ${describeCoordinate(match.pairCells[0])} and ${describeCoordinate(match.pairCells[1])} each have only candidates ${firstValue} and ${secondValue}.`,
                spotlightCells: match.pairCells,
                unitCells: match.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: pairNoteSets,
                dimUnrelated: true,
            },
            {
                id: 'pair-remove',
                title: match.resultKind === 'naked'
                    ? `The pair reserves ${firstValue} and ${secondValue}`
                    : `Now look at this ${unitName(match.resultUnit)}`,
                body: match.resultKind === 'naked'
                    ? `Cross out ${removedLabel} in the cell where those candidates are shown. Only ${match.target.value} remains.`
                    : `The pair rules out ${match.target.value} in ${eliminatedCellPhrase}.`,
                accessibleDetail: match.resultKind === 'naked'
                    ? `The pair reserves ${firstValue} and ${secondValue} in this ${unitName(match.unit)}. Removing ${removedLabel} from ${describeCoordinate(match.target)} leaves ${match.target.value}.`
                    : `The pair reserves ${firstValue} and ${secondValue} in this ${unitName(match.unit)}, ruling out ${match.target.value} at ${describeCoordinates(causalEliminatedMarks)} in this ${unitName(match.resultUnit)}.`,
                spotlightCells: match.resultKind === 'naked'
                    ? [...match.pairCells, { row: match.target.row, col: match.target.col }]
                    : [],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                guideUnits: match.resultKind === 'naked' ? [guideUnit] : undefined,
                guideStrokeTone: match.resultKind === 'naked' ? 'soft' : undefined,
                candidateNoteSets: targetNoteSet
                    ? [...pairNoteSets, targetNoteSet]
                    : pairNoteSets,
                candidateMarks: match.resultKind === 'hidden'
                    ? causalEliminatedMarks
                    : undefined,
                eliminationStyle: match.resultKind === 'hidden'
                    ? 'candidate-slash'
                    : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                dimUnrelated: true,
            },
            {
                id: 'pair-answer',
                techniqueLabel: match.resultKind === 'naked' ? 'Naked single' : 'Hidden single',
                title: match.resultKind === 'naked'
                    ? `Only ${match.target.value} remains`
                    : `Only one place remains for ${match.target.value}`,
                body: match.resultKind === 'naked'
                    ? `${match.target.value} belongs in this cell.`
                    : `Every other ${match.target.value} is ruled out, so ${match.target.value} belongs in the outlined cell.`,
                accessibleDetail: match.resultKind === 'naked'
                    ? `Place ${match.target.value} at ${describeCoordinate(match.target)}.`
                    : `The pair rules out ${describeCoordinates(causalEliminatedMarks)}. Placed ${match.target.value}s rule out ${describeCoordinates(hiddenResultPreBlockedCells)}, leaving ${describeCoordinate(match.target)}.`,
                spotlightCells: [{ row: match.target.row, col: match.target.col }],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                unitStrokeTone: match.resultKind === 'hidden' ? 'soft' : undefined,
                supportSourceCells: match.resultKind === 'hidden'
                    ? hiddenResultSupportSources
                    : undefined,
                candidateMarks: match.resultKind === 'hidden'
                    ? [...hiddenResultEliminatedMarks, answerMark]
                    : [answerMark],
                eliminationStyle: match.resultKind === 'hidden'
                    ? 'candidate-slash'
                    : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                fillTargetCell: true,
                target: match.target,
                dimUnrelated: true,
            },
        ],
    };
};

interface HiddenPairPattern {
    unit: HintUnit;
    pairCells: [HintCoordinate, HintCoordinate];
    pairValues: [number, number];
    eliminations: HintCandidateDelta[];
}

interface HiddenPairMatch extends HiddenPairPattern {
    target: HintCoordinate & { value: number };
    resultUnit: HintUnit;
    causalEliminations: HintCandidateDelta[];
}

const findHiddenPairPatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HiddenPairPattern[] => {
    const patterns: HiddenPairPattern[] = [];

    for (const unit of ALL_UNITS) {
        for (let firstValue = 1; firstValue <= 8; firstValue++) {
            const firstPositions = unit.cells.filter(cell => (
                board[cell.row][cell.col] === 0
                && candidates[cell.row][cell.col].includes(firstValue)
            ));
            if (firstPositions.length !== 2) continue;

            for (let secondValue = firstValue + 1; secondValue <= 9; secondValue++) {
                const secondPositions = unit.cells.filter(cell => (
                    board[cell.row][cell.col] === 0
                    && candidates[cell.row][cell.col].includes(secondValue)
                ));
                if (
                    secondPositions.length !== 2
                    || !firstPositions.every(position => (
                        secondPositions.some(candidate => (
                            candidate.row === position.row && candidate.col === position.col
                        ))
                    ))
                ) continue;

                const pairValues: [number, number] = [firstValue, secondValue];
                const pairCells = [...firstPositions].sort(compareCoordinates) as [
                    HintCoordinate,
                    HintCoordinate,
                ];
                const eliminations = pairCells.map(cell => {
                    const beforeCandidates = [...candidates[cell.row][cell.col]];
                    const afterCandidates = beforeCandidates.filter(value => (
                        pairValues.includes(value)
                    ));
                    return {
                        ...cell,
                        beforeCandidates,
                        removedValues: beforeCandidates.filter(value => (
                            !pairValues.includes(value)
                        )),
                        afterCandidates,
                    };
                }).filter(elimination => elimination.removedValues.length > 0);
                if (
                    eliminations.length === 0
                    || eliminations.some(elimination => elimination.afterCandidates.length !== 2)
                ) continue;

                patterns.push({
                    unit,
                    pairCells,
                    pairValues,
                    eliminations,
                });
            }
        }
    }

    return patterns;
};

interface HiddenTriplePattern {
    unit: HintUnit;
    tripleCells: [HintCoordinate, HintCoordinate, HintCoordinate];
    tripleValues: [number, number, number];
    eliminations: HintCandidateDelta[];
}

const findHiddenTriplePatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HiddenTriplePattern[] => {
    const patterns: HiddenTriplePattern[] = [];

    for (const unit of ALL_UNITS) {
        for (let firstValue = 1; firstValue <= 7; firstValue++) {
            for (let secondValue = firstValue + 1; secondValue <= 8; secondValue++) {
                for (let thirdValue = secondValue + 1; thirdValue <= 9; thirdValue++) {
                    const tripleValues: [number, number, number] = [
                        firstValue,
                        secondValue,
                        thirdValue,
                    ];
                    const tripleCells = unit.cells.filter(cell => (
                        board[cell.row][cell.col] === 0
                        && tripleValues.some(value => (
                            candidates[cell.row][cell.col].includes(value)
                        ))
                    )).sort(compareCoordinates);
                    if (
                        tripleCells.length !== 3
                        || !tripleValues.every(value => tripleCells.some(cell => (
                            candidates[cell.row][cell.col].includes(value)
                        )))
                    ) continue;

                    const typedCells = tripleCells as HiddenTriplePattern['tripleCells'];
                    const eliminations = typedCells.map(cell => {
                        const beforeCandidates = [...candidates[cell.row][cell.col]];
                        const afterCandidates = beforeCandidates.filter(value => (
                            tripleValues.includes(value)
                        ));
                        return {
                            ...cell,
                            beforeCandidates,
                            removedValues: beforeCandidates.filter(value => (
                                !tripleValues.includes(value)
                            )),
                            afterCandidates,
                        };
                    }).filter(elimination => elimination.removedValues.length > 0);
                    if (
                        eliminations.length === 0
                        || eliminations.some(elimination => (
                            elimination.afterCandidates.length === 0
                        ))
                    ) continue;

                    patterns.push({
                        unit,
                        tripleCells: typedCells,
                        tripleValues,
                        eliminations,
                    });
                }
            }
        }
    }

    return patterns.sort((left, right) => (
        left.eliminations.length - right.eliminations.length
        || left.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
        - right.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
        || UNIT_KIND_PRIORITY[left.unit.kind] - UNIT_KIND_PRIORITY[right.unit.kind]
        || left.unit.index - right.unit.index
        || left.tripleValues[0] - right.tripleValues[0]
        || left.tripleValues[1] - right.tripleValues[1]
        || left.tripleValues[2] - right.tripleValues[2]
        || compareCoordinates(left.tripleCells[0], right.tripleCells[0])
        || compareCoordinates(left.tripleCells[1], right.tripleCells[1])
        || compareCoordinates(left.tripleCells[2], right.tripleCells[2])
    ));
};

const applyHiddenPairPattern = (
    candidates: CandidateGrid,
    pattern: HiddenPairPattern,
): CandidateGrid => applyCandidateDeltas(candidates, pattern.eliminations);

const placementAfterHiddenPair = (
    board: NumericBoard,
    before: CandidateGrid,
    after: CandidateGrid,
    pattern: HiddenPairPattern,
): Pick<HiddenPairMatch, 'target' | 'resultUnit' | 'causalEliminations'> | null => {
    const existingHidden = new Set(findHiddenSingleMatches(board, before).map(match => (
        `${match.row}:${match.col}:${match.value}`
    )));
    for (const hiddenTarget of findHiddenSingleMatches(board, after)) {
        if (existingHidden.has(`${hiddenTarget.row}:${hiddenTarget.col}:${hiddenTarget.value}`)) {
            continue;
        }
        const resultUnitKeys = new Set(hiddenTarget.unit.cells.map(coordinateKey));
        const causalEliminations = pattern.eliminations.filter(elimination => (
            resultUnitKeys.has(coordinateKey(elimination))
            && elimination.removedValues.includes(hiddenTarget.value)
        ));
        if (causalEliminations.length === 0) continue;
        return {
            target: {
                row: hiddenTarget.row,
                col: hiddenTarget.col,
                value: hiddenTarget.value,
            },
            resultUnit: hiddenTarget.unit,
            causalEliminations,
        };
    }
    return null;
};

const makeHiddenPairPlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const matches = findHiddenPairPatterns(board, candidates)
        .map((pattern): HiddenPairMatch | null => {
            const placement = placementAfterHiddenPair(
                board,
                candidates,
                applyHiddenPairPattern(candidates, pattern),
                pattern,
            );
            return placement ? { ...pattern, ...placement } : null;
        })
        .filter((match): match is HiddenPairMatch => match !== null)
        .sort((left, right) => (
            left.causalEliminations.length - right.causalEliminations.length
            || left.eliminations.length - right.eliminations.length
            || left.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
            - right.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
            || UNIT_KIND_PRIORITY[left.unit.kind] - UNIT_KIND_PRIORITY[right.unit.kind]
            || left.unit.index - right.unit.index
            || left.pairValues[0] - right.pairValues[0]
            || left.pairValues[1] - right.pairValues[1]
            || compareCoordinates(left.pairCells[0], right.pairCells[0])
            || compareCoordinates(left.pairCells[1], right.pairCells[1])
            || UNIT_KIND_PRIORITY[left.resultUnit.kind] - UNIT_KIND_PRIORITY[right.resultUnit.kind]
            || left.resultUnit.index - right.resultUnit.index
            || compareCoordinates(left.target, right.target)
        ));
    const match = matches[0];
    if (!match) return null;

    const [firstValue, secondValue] = match.pairValues;
    const beforeNoteSets: HintCandidateNoteSet[] = match.pairCells.map(cell => ({
        ...cell,
        marks: candidates[cell.row][cell.col].map(value => ({
            value,
            tone: match.pairValues.includes(value)
                ? 'locked' as const
                : 'possible' as const,
        })),
    }));
    const afterNoteSets: HintCandidateNoteSet[] = match.pairCells.map(cell => ({
        ...cell,
        marks: candidates[cell.row][cell.col].map(value => ({
            value,
            tone: match.pairValues.includes(value)
                ? 'remaining' as const
                : 'removed' as const,
        })),
    }));
    const removedValues = [...new Set(match.eliminations.flatMap(elimination => (
        elimination.removedValues
    )))].sort((left, right) => left - right);
    const removalLabel = formatCandidateValues(removedValues);
    const removalInstruction = removedValues.length === 1
        ? `Cross out ${removalLabel} where it is shown.`
        : `Cross out ${removalLabel} where they are shown.`;
    const causalMarks: HintCandidateMark[] = match.causalEliminations.map(elimination => ({
        row: elimination.row,
        col: elimination.col,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const fillMarks: HintCandidateMark[] = match.eliminations.map(elimination => ({
        row: elimination.row,
        col: elimination.col,
        value: elimination.removedValues[0],
        tone: 'eliminated',
    }));
    const otherEmptyCells = match.resultUnit.cells.filter(cell => (
        board[cell.row][cell.col] === 0
        && (cell.row !== match.target.row || cell.col !== match.target.col)
    ));
    const allResultEliminations: HintCandidateMark[] = otherEmptyCells.map(cell => ({
        ...cell,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const causalKeys = new Set(causalMarks.map(coordinateKey));
    const preBlockedCells = otherEmptyCells.filter(cell => (
        !causalKeys.has(coordinateKey(cell))
        && !candidates[cell.row][cell.col].includes(match.target.value)
    ));
    const supportSourceCells = selectMinimalBlockers(
        board,
        preBlockedCells,
        match.target.value,
    );
    const preBlockedDetail = preBlockedCells.length > 0
        ? ` Placed ${match.target.value}s rule out ${describeCoordinates(preBlockedCells)}.`
        : '';
    const answerMark: HintCandidateMark = { ...match.target, tone: 'answer' };

    return {
        outcome: 'placement',
        technique: 'hiddenPair',
        techniqueLabel: 'Hidden pair',
        target: match.target,
        derivedResult: 'hidden',
        candidateEliminations: match.eliminations.map(cloneCandidateDelta),
        frames: [
            {
                id: 'hidden-pair-find',
                techniqueLabel: 'Hidden pair',
                title: `${firstValue} and ${secondValue} have only two places`,
                body: `In this ${unitName(match.unit)}, both must go in these two cells.`,
                accessibleDetail: `Candidates ${firstValue} and ${secondValue} can appear only at ${describeCoordinates(match.pairCells)} in this ${unitName(match.unit)}.`,
                spotlightCells: match.pairCells,
                unitCells: match.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: beforeNoteSets,
                dimUnrelated: true,
            },
            {
                id: 'hidden-pair-remove',
                techniqueLabel: 'Hidden pair',
                title: `Now look at this ${unitName(match.resultUnit)}`,
                body: `${removalInstruction} That leaves one place for ${match.target.value}.`,
                accessibleDetail: `Keeping only ${firstValue} and ${secondValue} removes ${removalLabel} from ${describeCoordinates(match.eliminations)}, leaving one place for ${match.target.value} in this ${unitName(match.resultUnit)}.`,
                spotlightCells: [],
                unitCells: match.resultUnit.cells,
                candidateNoteSets: afterNoteSets,
                candidateMarks: fillMarks,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
            {
                id: 'hidden-pair-answer',
                techniqueLabel: 'Hidden single',
                title: `Only one place remains for ${match.target.value}`,
                body: `Every other ${match.target.value} is ruled out, so ${match.target.value} belongs in the outlined cell.`,
                accessibleDetail: `The hidden pair rules out ${describeCoordinates(causalMarks)}.${preBlockedDetail} That leaves ${describeCoordinate(match.target)}.`,
                spotlightCells: [{ row: match.target.row, col: match.target.col }],
                unitCells: match.resultUnit.cells,
                unitStrokeTone: 'soft',
                supportSourceCells,
                candidateMarks: [...allResultEliminations, answerMark],
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: true,
                fillTargetCell: true,
                target: match.target,
                dimUnrelated: true,
            },
        ],
    };
};

interface NakedTriplePattern {
    unit: HintUnit;
    tripleCells: [HintCoordinate, HintCoordinate, HintCoordinate];
    tripleValues: [number, number, number];
    tripleCandidates: [number[], number[], number[]];
    eliminations: HintCandidateDelta[];
}

interface NakedTripleNakedMatch extends NakedTriplePattern {
    resultKind: 'naked';
    target: HintCoordinate & { value: number };
    beforeCandidates: number[];
    afterCandidates: number[];
    removedValues: number[];
    causalEliminations: HintCandidateDelta[];
}

interface NakedTripleHiddenMatch extends NakedTriplePattern {
    resultKind: 'hidden';
    target: HintCoordinate & { value: number };
    resultUnit: HintUnit;
    causalEliminations: HintCandidateDelta[];
}

type NakedTripleMatch = NakedTripleNakedMatch | NakedTripleHiddenMatch;

const findNakedTriplePatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): NakedTriplePattern[] => {
    const patterns: NakedTriplePattern[] = [];

    for (const unit of ALL_UNITS) {
        const eligibleCells = unit.cells.filter(cell => (
            board[cell.row][cell.col] === 0
            && candidates[cell.row][cell.col].length >= 2
            && candidates[cell.row][cell.col].length <= 3
        ));

        for (let firstIndex = 0; firstIndex < eligibleCells.length - 2; firstIndex++) {
            for (
                let secondIndex = firstIndex + 1;
                secondIndex < eligibleCells.length - 1;
                secondIndex++
            ) {
                for (
                    let thirdIndex = secondIndex + 1;
                    thirdIndex < eligibleCells.length;
                    thirdIndex++
                ) {
                    const tripleCells = [
                        eligibleCells[firstIndex],
                        eligibleCells[secondIndex],
                        eligibleCells[thirdIndex],
                    ].sort(compareCoordinates) as [
                        HintCoordinate,
                        HintCoordinate,
                        HintCoordinate,
                    ];
                    const tripleValues = [...new Set(tripleCells.flatMap(cell => (
                        candidates[cell.row][cell.col]
                    )))].sort((left, right) => left - right);
                    if (tripleValues.length !== 3) continue;

                    const typedValues = tripleValues as [number, number, number];
                    const tripleKeys = new Set(tripleCells.map(coordinateKey));
                    const eliminations = unit.cells
                        .filter(cell => (
                            board[cell.row][cell.col] === 0
                            && !tripleKeys.has(coordinateKey(cell))
                        ))
                        .map(cell => {
                            const beforeCandidates = [...candidates[cell.row][cell.col]];
                            const removedValues = beforeCandidates.filter(value => (
                                typedValues.includes(value)
                            ));
                            const afterCandidates = beforeCandidates.filter(value => (
                                !typedValues.includes(value)
                            ));
                            return {
                                ...cell,
                                beforeCandidates,
                                removedValues,
                                afterCandidates,
                            };
                        })
                        .filter(elimination => elimination.removedValues.length > 0);
                    if (
                        eliminations.length === 0
                        || eliminations.some(elimination => (
                            elimination.afterCandidates.length === 0
                        ))
                    ) continue;

                    patterns.push({
                        unit,
                        tripleCells,
                        tripleValues: typedValues,
                        tripleCandidates: tripleCells.map(cell => (
                            [...candidates[cell.row][cell.col]]
                        )) as [number[], number[], number[]],
                        eliminations,
                    });
                }
            }
        }
    }

    return patterns;
};

const applyNakedTriplePattern = (
    candidates: CandidateGrid,
    pattern: NakedTriplePattern,
): CandidateGrid => applyCandidateDeltas(candidates, pattern.eliminations);

const makeNakedTriplePlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const matches = findNakedTriplePatterns(board, candidates)
        .map((pattern): NakedTripleMatch | null => {
            const after = applyNakedTriplePattern(candidates, pattern);
            const nakedTarget = pattern.eliminations
                .filter(elimination => (
                    elimination.beforeCandidates.length > 1
                    && elimination.afterCandidates.length === 1
                ))
                .map(elimination => ({
                    row: elimination.row,
                    col: elimination.col,
                    value: elimination.afterCandidates[0],
                    beforeCandidates: [...elimination.beforeCandidates],
                    afterCandidates: [...elimination.afterCandidates],
                    removedValues: [...elimination.removedValues],
                }))
                .sort((left, right) => (
                    right.removedValues.length - left.removedValues.length
                    || compareCoordinates(left, right)
                    || left.value - right.value
                ))[0];
            if (nakedTarget) {
                const causalElimination = pattern.eliminations.find(elimination => (
                    elimination.row === nakedTarget.row
                    && elimination.col === nakedTarget.col
                ))!;
                return {
                    ...pattern,
                    resultKind: 'naked',
                    target: {
                        row: nakedTarget.row,
                        col: nakedTarget.col,
                        value: nakedTarget.value,
                    },
                    beforeCandidates: nakedTarget.beforeCandidates,
                    afterCandidates: nakedTarget.afterCandidates,
                    removedValues: nakedTarget.removedValues,
                    causalEliminations: [causalElimination],
                };
            }

            const existingHidden = new Set(findHiddenSingleMatches(board, candidates).map(match => (
                `${match.row}:${match.col}:${match.value}`
            )));
            for (const hiddenTarget of findHiddenSingleMatches(board, after)) {
                if (existingHidden.has(`${hiddenTarget.row}:${hiddenTarget.col}:${hiddenTarget.value}`)) {
                    continue;
                }
                const resultUnitKeys = new Set(hiddenTarget.unit.cells.map(coordinateKey));
                const causalEliminations = pattern.eliminations.filter(elimination => (
                    resultUnitKeys.has(coordinateKey(elimination))
                    && elimination.removedValues.includes(hiddenTarget.value)
                ));
                if (causalEliminations.length === 0) continue;

                return {
                    ...pattern,
                    resultKind: 'hidden',
                    target: {
                        row: hiddenTarget.row,
                        col: hiddenTarget.col,
                        value: hiddenTarget.value,
                    },
                    resultUnit: hiddenTarget.unit,
                    causalEliminations,
                };
            }

            return null;
        })
        .filter((match): match is NakedTripleMatch => match !== null)
        .sort((left, right) => (
            (left.resultKind === 'naked' ? 0 : 1) - (right.resultKind === 'naked' ? 0 : 1)
            || (
                left.resultKind === 'naked' && right.resultKind === 'naked'
                    ? right.removedValues.length - left.removedValues.length
                    : 0
            )
            || (
                left.resultKind === 'hidden' && right.resultKind === 'hidden'
                    ? left.causalEliminations.length - right.causalEliminations.length
                    : 0
            )
            || left.eliminations.length - right.eliminations.length
            || UNIT_KIND_PRIORITY[left.unit.kind] - UNIT_KIND_PRIORITY[right.unit.kind]
            || left.unit.index - right.unit.index
            || left.tripleValues[0] - right.tripleValues[0]
            || left.tripleValues[1] - right.tripleValues[1]
            || left.tripleValues[2] - right.tripleValues[2]
            || compareCoordinates(left.tripleCells[0], right.tripleCells[0])
            || compareCoordinates(left.tripleCells[1], right.tripleCells[1])
            || compareCoordinates(left.tripleCells[2], right.tripleCells[2])
            || compareCoordinates(left.target, right.target)
        ));
    const match = matches[0];
    if (!match) return null;

    const tripleLabel = formatCandidateValues(match.tripleValues);
    const tripleNoteSets: HintCandidateNoteSet[] = match.tripleCells.map((cell, index) => ({
        ...cell,
        marks: match.tripleCandidates[index].map(value => ({
            value,
            tone: 'locked' as const,
        })),
    }));
    const targetNoteSet: HintCandidateNoteSet | null = match.resultKind === 'naked'
        ? {
            row: match.target.row,
            col: match.target.col,
            marks: match.beforeCandidates.map(value => ({
                value,
                tone: match.afterCandidates.includes(value) ? 'remaining' : 'removed',
            })),
        }
        : null;
    const removedLabel = match.resultKind === 'naked'
        ? formatCandidateValues(match.removedValues)
        : '';
    const causalEliminatedMarks: HintCandidateMark[] = match.resultKind === 'hidden'
        ? match.causalEliminations.map(elimination => ({
            row: elimination.row,
            col: elimination.col,
            value: match.target.value,
            tone: 'eliminated',
        }))
        : [];
    const hiddenResultOtherCells = match.resultKind === 'hidden'
        ? match.resultUnit.cells.filter(cell => (
            board[cell.row][cell.col] === 0
            && (cell.row !== match.target.row || cell.col !== match.target.col)
        ))
        : [];
    const hiddenResultEliminatedMarks: HintCandidateMark[] = hiddenResultOtherCells.map(cell => ({
        ...cell,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const causalEliminationKeys = new Set(causalEliminatedMarks.map(coordinateKey));
    const hiddenResultPreBlockedCells = hiddenResultOtherCells.filter(cell => (
        !causalEliminationKeys.has(coordinateKey(cell))
        && !candidates[cell.row][cell.col].includes(match.target.value)
    ));
    const hiddenResultSupportSources = match.resultKind === 'hidden'
        ? selectMinimalBlockers(board, hiddenResultPreBlockedCells, match.target.value)
        : [];
    const preBlockedDetail = hiddenResultPreBlockedCells.length > 0
        ? ` Placed ${match.target.value}s rule out ${describeCoordinates(hiddenResultPreBlockedCells)}.`
        : '';
    const eliminatedCandidatePhrase = causalEliminatedMarks.length === 1
        ? `${match.target.value} where it is shown`
        : `${match.target.value}s where they are shown`;
    const answerMark: HintCandidateMark = { ...match.target, tone: 'answer' };

    return {
        outcome: 'placement',
        technique: 'nakedTriple',
        techniqueLabel: 'Naked triple',
        target: match.target,
        derivedResult: match.resultKind,
        candidateEliminations: match.eliminations.map(cloneCandidateDelta),
        frames: [
            {
                id: 'triple-find',
                techniqueLabel: 'Naked triple',
                title: 'These three cells share three choices',
                body: `Together, they must contain ${tripleLabel}, in some order.`,
                accessibleDetail: `In this ${unitName(match.unit)}, ${describeCoordinates(match.tripleCells)} share only candidates ${tripleLabel}.`,
                spotlightCells: match.tripleCells,
                unitCells: match.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: tripleNoteSets,
                dimUnrelated: true,
            },
            {
                id: 'triple-remove',
                techniqueLabel: 'Naked triple',
                title: match.resultKind === 'naked'
                    ? `The triple reserves ${tripleLabel}`
                    : `Now look at this ${unitName(match.resultUnit)}`,
                body: match.resultKind === 'naked'
                    ? `Cross out ${removedLabel} in the cell where those candidates are shown. Only ${match.target.value} remains.`
                    : `Cross out ${eliminatedCandidatePhrase}. That leaves one place for ${match.target.value}.`,
                accessibleDetail: match.resultKind === 'naked'
                    ? `The triple reserves ${tripleLabel} in this ${unitName(match.unit)}. Removing ${removedLabel} from ${describeCoordinate(match.target)} leaves ${match.target.value}.`
                    : `The triple reserves ${tripleLabel} in this ${unitName(match.unit)}, ruling out ${match.target.value} at ${describeCoordinates(causalEliminatedMarks)} in this ${unitName(match.resultUnit)}.`,
                spotlightCells: match.resultKind === 'naked'
                    ? [...match.tripleCells, { row: match.target.row, col: match.target.col }]
                    : [],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                guideUnits: match.resultKind === 'naked'
                    ? [{ kind: match.unit.kind, index: match.unit.index }]
                    : undefined,
                guideStrokeTone: match.resultKind === 'naked' ? 'soft' : undefined,
                candidateNoteSets: targetNoteSet
                    ? [...tripleNoteSets, targetNoteSet]
                    : tripleNoteSets,
                candidateMarks: match.resultKind === 'hidden'
                    ? causalEliminatedMarks
                    : undefined,
                eliminationStyle: match.resultKind === 'hidden'
                    ? 'candidate-slash'
                    : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                dimUnrelated: true,
            },
            {
                id: 'triple-answer',
                techniqueLabel: match.resultKind === 'naked'
                    ? 'Naked single'
                    : 'Hidden single',
                title: match.resultKind === 'naked'
                    ? `Only ${match.target.value} remains`
                    : `Only one place remains for ${match.target.value}`,
                body: match.resultKind === 'naked'
                    ? `${match.target.value} belongs in this cell.`
                    : `Every other ${match.target.value} is ruled out, so ${match.target.value} belongs in the outlined cell.`,
                accessibleDetail: match.resultKind === 'naked'
                    ? `Place ${match.target.value} at ${describeCoordinate(match.target)}.`
                    : `The triple rules out ${describeCoordinates(causalEliminatedMarks)}.${preBlockedDetail} That leaves ${describeCoordinate(match.target)}.`,
                spotlightCells: [{ row: match.target.row, col: match.target.col }],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                unitStrokeTone: match.resultKind === 'hidden' ? 'soft' : undefined,
                supportSourceCells: match.resultKind === 'hidden'
                    ? hiddenResultSupportSources
                    : undefined,
                candidateMarks: match.resultKind === 'hidden'
                    ? [...hiddenResultEliminatedMarks, answerMark]
                    : [answerMark],
                eliminationStyle: match.resultKind === 'hidden'
                    ? 'candidate-slash'
                    : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                fillTargetCell: true,
                target: match.target,
                dimUnrelated: true,
            },
        ],
    };
};

type XWingOrientation = 'row' | 'column';

interface XWingPattern {
    orientation: XWingOrientation;
    value: number;
    baseUnits: [HintUnit, HintUnit];
    coverUnits: [HintUnit, HintUnit];
    cornerCells: [HintCoordinate, HintCoordinate, HintCoordinate, HintCoordinate];
    eliminations: HintCandidateDelta[];
}

interface XWingNakedMatch extends XWingPattern {
    resultKind: 'naked';
    target: HintCoordinate & { value: number };
    beforeCandidates: number[];
    afterCandidates: number[];
}

interface XWingHiddenMatch extends XWingPattern {
    resultKind: 'hidden';
    target: HintCoordinate & { value: number };
    resultUnit: HintUnit;
    causalEliminations: HintCandidateDelta[];
}

type XWingMatch = XWingNakedMatch | XWingHiddenMatch;

const xWingCoordinate = (
    orientation: XWingOrientation,
    baseIndex: number,
    coverIndex: number,
): HintCoordinate => orientation === 'row'
    ? { row: baseIndex, col: coverIndex }
    : { row: coverIndex, col: baseIndex };

const findXWingPatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): XWingPattern[] => {
    const patterns: XWingPattern[] = [];

    for (const orientation of ['row', 'column'] as const) {
        const baseKind: HintUnitKind = orientation;
        const coverKind: HintUnitKind = orientation === 'row' ? 'column' : 'row';

        for (const value of DIGITS) {
            const basesByCovers = new Map<
                string,
                Array<{ baseIndex: number; coverIndexes: [number, number] }>
            >();

            for (let baseIndex = 0; baseIndex < 9; baseIndex++) {
                const coverIndexes = Array.from({ length: 9 }, (_, index) => index)
                    .filter(coverIndex => {
                        const cell = xWingCoordinate(orientation, baseIndex, coverIndex);
                        return (
                            board[cell.row][cell.col] === 0
                            && candidates[cell.row][cell.col].includes(value)
                        );
                    });
                if (coverIndexes.length !== 2) continue;

                const typedCoverIndexes = coverIndexes as [number, number];
                const key = typedCoverIndexes.join(':');
                basesByCovers.set(key, [
                    ...(basesByCovers.get(key) ?? []),
                    { baseIndex, coverIndexes: typedCoverIndexes },
                ]);
            }

            for (const entries of basesByCovers.values()) {
                // Three source rows or columns competing for only two cover
                // units cannot occur on a solution-correct board. Refusing the
                // ambiguous shape keeps the theater strictly classic X-Wing.
                if (entries.length !== 2) continue;

                const [firstBase, secondBase] = entries;
                const [firstCover, secondCover] = firstBase.coverIndexes;
                const baseIndexes = new Set([
                    firstBase.baseIndex,
                    secondBase.baseIndex,
                ]);
                const cornerCells = [
                    xWingCoordinate(orientation, firstBase.baseIndex, firstCover),
                    xWingCoordinate(orientation, firstBase.baseIndex, secondCover),
                    xWingCoordinate(orientation, secondBase.baseIndex, firstCover),
                    xWingCoordinate(orientation, secondBase.baseIndex, secondCover),
                ].sort((left, right) => (
                    left.row - right.row || left.col - right.col
                )) as XWingPattern['cornerCells'];

                const eliminations: HintCandidateDelta[] = [];
                for (const coverIndex of [firstCover, secondCover]) {
                    for (let baseIndex = 0; baseIndex < 9; baseIndex++) {
                        if (baseIndexes.has(baseIndex)) continue;
                        const cell = xWingCoordinate(orientation, baseIndex, coverIndex);
                        if (
                            board[cell.row][cell.col] !== 0
                            || !candidates[cell.row][cell.col].includes(value)
                        ) continue;

                        const beforeCandidates = [...candidates[cell.row][cell.col]];
                        eliminations.push({
                            ...cell,
                            beforeCandidates,
                            removedValues: [value],
                            afterCandidates: beforeCandidates.filter(candidate => (
                                candidate !== value
                            )),
                        });
                    }
                }
                eliminations.sort((left, right) => (
                    left.row - right.row || left.col - right.col
                ));
                if (
                    eliminations.length === 0
                    || eliminations.some(elimination => (
                        elimination.afterCandidates.length === 0
                    ))
                ) continue;

                patterns.push({
                    orientation,
                    value,
                    baseUnits: [
                        {
                            kind: baseKind,
                            index: firstBase.baseIndex,
                            cells: getUnitCells(baseKind, firstBase.baseIndex),
                        },
                        {
                            kind: baseKind,
                            index: secondBase.baseIndex,
                            cells: getUnitCells(baseKind, secondBase.baseIndex),
                        },
                    ],
                    coverUnits: [
                        {
                            kind: coverKind,
                            index: firstCover,
                            cells: getUnitCells(coverKind, firstCover),
                        },
                        {
                            kind: coverKind,
                            index: secondCover,
                            cells: getUnitCells(coverKind, secondCover),
                        },
                    ],
                    cornerCells,
                    eliminations,
                });
            }
        }
    }

    return patterns.sort((left, right) => (
        (left.orientation === 'row' ? 0 : 1) - (right.orientation === 'row' ? 0 : 1)
        || left.value - right.value
        || left.baseUnits[0].index - right.baseUnits[0].index
        || left.baseUnits[1].index - right.baseUnits[1].index
        || left.coverUnits[0].index - right.coverUnits[0].index
        || left.coverUnits[1].index - right.coverUnits[1].index
        || left.eliminations.length - right.eliminations.length
    ));
};

interface SwordfishPattern {
    orientation: XWingOrientation;
    value: number;
    baseUnits: [HintUnit, HintUnit, HintUnit];
    coverUnits: [HintUnit, HintUnit, HintUnit];
    sourceCells: HintCoordinate[];
    eliminations: HintCandidateDelta[];
}

const findSwordfishPatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): SwordfishPattern[] => {
    const patterns: SwordfishPattern[] = [];

    for (const orientation of ['row', 'column'] as const) {
        const baseKind: HintUnitKind = orientation;
        const coverKind: HintUnitKind = orientation === 'row' ? 'column' : 'row';

        for (const value of DIGITS) {
            const eligibleBases = Array.from({ length: 9 }, (_, baseIndex) => ({
                baseIndex,
                coverIndexes: Array.from({ length: 9 }, (_, index) => index)
                    .filter(coverIndex => {
                        const cell = xWingCoordinate(orientation, baseIndex, coverIndex);
                        return (
                            board[cell.row][cell.col] === 0
                            && candidates[cell.row][cell.col].includes(value)
                        );
                    }),
            })).filter(entry => (
                entry.coverIndexes.length >= 2 && entry.coverIndexes.length <= 3
            ));

            for (let first = 0; first < eligibleBases.length - 2; first++) {
                for (let second = first + 1; second < eligibleBases.length - 1; second++) {
                    for (let third = second + 1; third < eligibleBases.length; third++) {
                        const entries = [
                            eligibleBases[first],
                            eligibleBases[second],
                            eligibleBases[third],
                        ];
                        const coverIndexes = [...new Set(entries.flatMap(entry => (
                            entry.coverIndexes
                        )))].sort((left, right) => left - right);
                        if (coverIndexes.length !== 3) continue;

                        const baseIndexes = new Set(entries.map(entry => entry.baseIndex));
                        const eliminations: HintCandidateDelta[] = [];
                        for (const coverIndex of coverIndexes) {
                            for (let baseIndex = 0; baseIndex < 9; baseIndex++) {
                                if (baseIndexes.has(baseIndex)) continue;
                                const cell = xWingCoordinate(
                                    orientation,
                                    baseIndex,
                                    coverIndex,
                                );
                                if (
                                    board[cell.row][cell.col] !== 0
                                    || !candidates[cell.row][cell.col].includes(value)
                                ) continue;
                                const beforeCandidates = [...candidates[cell.row][cell.col]];
                                eliminations.push({
                                    ...cell,
                                    beforeCandidates,
                                    removedValues: [value],
                                    afterCandidates: beforeCandidates.filter(candidate => (
                                        candidate !== value
                                    )),
                                });
                            }
                        }
                        eliminations.sort(compareCoordinates);
                        if (
                            eliminations.length === 0
                            || eliminations.some(elimination => (
                                elimination.afterCandidates.length === 0
                            ))
                        ) continue;

                        const sourceCells = entries.flatMap(entry => (
                            entry.coverIndexes.map(coverIndex => (
                                xWingCoordinate(orientation, entry.baseIndex, coverIndex)
                            ))
                        )).sort(compareCoordinates);
                        patterns.push({
                            orientation,
                            value,
                            baseUnits: entries.map(entry => ({
                                kind: baseKind,
                                index: entry.baseIndex,
                                cells: getUnitCells(baseKind, entry.baseIndex),
                            })) as SwordfishPattern['baseUnits'],
                            coverUnits: coverIndexes.map(coverIndex => ({
                                kind: coverKind,
                                index: coverIndex,
                                cells: getUnitCells(coverKind, coverIndex),
                            })) as SwordfishPattern['coverUnits'],
                            sourceCells,
                            eliminations,
                        });
                    }
                }
            }
        }
    }

    return patterns.sort((left, right) => (
        (left.orientation === 'row' ? 0 : 1) - (right.orientation === 'row' ? 0 : 1)
        || left.value - right.value
        || left.baseUnits[0].index - right.baseUnits[0].index
        || left.baseUnits[1].index - right.baseUnits[1].index
        || left.baseUnits[2].index - right.baseUnits[2].index
        || left.coverUnits[0].index - right.coverUnits[0].index
        || left.coverUnits[1].index - right.coverUnits[1].index
        || left.coverUnits[2].index - right.coverUnits[2].index
        || left.eliminations.length - right.eliminations.length
    ));
};

const applyXWingPattern = (
    candidates: CandidateGrid,
    pattern: XWingPattern,
): CandidateGrid => {
    const next = cloneCandidateGrid(candidates);
    for (const elimination of pattern.eliminations) {
        next[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    return next;
};

const makeXWingPlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const matches = findXWingPatterns(board, candidates)
        .map((pattern): XWingMatch | null => {
            const after = applyXWingPattern(candidates, pattern);
            const nakedTarget = pattern.eliminations
                .filter(elimination => (
                    elimination.beforeCandidates.length > 1
                    && elimination.afterCandidates.length === 1
                ))
                .map(elimination => ({
                    row: elimination.row,
                    col: elimination.col,
                    value: elimination.afterCandidates[0],
                    beforeCandidates: [...elimination.beforeCandidates],
                    afterCandidates: [...elimination.afterCandidates],
                }))
                .sort((left, right) => (
                    left.row - right.row
                    || left.col - right.col
                    || left.value - right.value
                ))[0];
            if (nakedTarget) {
                return {
                    ...pattern,
                    resultKind: 'naked',
                    target: {
                        row: nakedTarget.row,
                        col: nakedTarget.col,
                        value: nakedTarget.value,
                    },
                    beforeCandidates: nakedTarget.beforeCandidates,
                    afterCandidates: nakedTarget.afterCandidates,
                };
            }

            const existingHidden = new Set(findHiddenSingleMatches(board, candidates).map(match => (
                `${match.row}:${match.col}:${match.value}`
            )));
            for (const hiddenTarget of findHiddenSingleMatches(board, after)) {
                if (
                    hiddenTarget.value !== pattern.value
                    || existingHidden.has(`${hiddenTarget.row}:${hiddenTarget.col}:${hiddenTarget.value}`)
                ) continue;

                const resultUnitKeys = new Set(hiddenTarget.unit.cells.map(coordinateKey));
                const causalEliminations = pattern.eliminations.filter(elimination => (
                    resultUnitKeys.has(coordinateKey(elimination))
                    && elimination.removedValues.includes(hiddenTarget.value)
                ));
                if (causalEliminations.length === 0) continue;

                return {
                    ...pattern,
                    resultKind: 'hidden',
                    target: {
                        row: hiddenTarget.row,
                        col: hiddenTarget.col,
                        value: hiddenTarget.value,
                    },
                    resultUnit: hiddenTarget.unit,
                    causalEliminations,
                };
            }

            return null;
        })
        .filter((match): match is XWingMatch => match !== null)
        .sort((left, right) => (
            (left.resultKind === 'naked' ? 0 : 1) - (right.resultKind === 'naked' ? 0 : 1)
            || left.eliminations.length - right.eliminations.length
            || (left.orientation === 'row' ? 0 : 1) - (right.orientation === 'row' ? 0 : 1)
            || left.value - right.value
            || left.baseUnits[0].index - right.baseUnits[0].index
            || left.baseUnits[1].index - right.baseUnits[1].index
            || left.target.row - right.target.row
            || left.target.col - right.target.col
        ));
    const match = matches[0];
    if (!match) return null;

    const baseName = match.orientation === 'row' ? 'rows' : 'columns';
    const coverName = match.orientation === 'row' ? 'columns' : 'rows';
    const baseGuides = match.baseUnits.map(unit => ({
        kind: unit.kind,
        index: unit.index,
    }));
    const coverGuides = match.coverUnits.map(unit => ({
        kind: unit.kind,
        index: unit.index,
    }));
    const cornerMarks: HintCandidateMark[] = match.cornerCells.map(cell => ({
        ...cell,
        value: match.value,
        tone: 'locked',
    }));
    const eliminatedMarks: HintCandidateMark[] = match.eliminations.map(elimination => ({
        row: elimination.row,
        col: elimination.col,
        value: match.value,
        tone: 'eliminated',
    }));
    const hiddenResultOtherCells = match.resultKind === 'hidden'
        ? match.resultUnit.cells.filter(cell => (
            board[cell.row][cell.col] === 0
            && (cell.row !== match.target.row || cell.col !== match.target.col)
        ))
        : [];
    const hiddenResultEliminatedMarks: HintCandidateMark[] = hiddenResultOtherCells.map(cell => ({
        ...cell,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const causalEliminationKeys = new Set(
        match.resultKind === 'hidden'
            ? match.causalEliminations.map(coordinateKey)
            : [],
    );
    const hiddenResultPreBlockedCells = match.resultKind === 'hidden'
        ? hiddenResultOtherCells.filter(cell => (
            !causalEliminationKeys.has(coordinateKey(cell))
            && !candidates[cell.row][cell.col].includes(match.target.value)
        ))
        : [];
    const hiddenResultSupportSources = match.resultKind === 'hidden'
        ? selectMinimalBlockers(board, hiddenResultPreBlockedCells, match.target.value)
        : [];
    const answerMark: HintCandidateMark = { ...match.target, tone: 'answer' };

    return {
        outcome: 'placement',
        technique: 'xWing',
        techniqueLabel: 'X-Wing',
        target: match.target,
        derivedResult: match.resultKind,
        candidateEliminations: match.eliminations.map(cloneCandidateDelta),
        frames: [
            {
                id: 'x-wing-find',
                techniqueLabel: 'X-Wing',
                title: `Look at the possible ${match.value}s`,
                body: `In both ${baseName}, ${match.value} can only go in the same two ${coverName}.`,
                accessibleDetail: `Candidate ${match.value} appears only at ${describeCoordinates(match.cornerCells)} in these two ${baseName}.`,
                spotlightCells: match.cornerCells,
                guideUnits: baseGuides,
                guideStrokeTone: 'soft',
                candidateMarks: cornerMarks,
                dimUnrelated: true,
            },
            {
                id: 'x-wing-remove',
                techniqueLabel: 'X-Wing',
                title: `So ${match.value} cannot go elsewhere in these ${coverName}`,
                body: match.resultKind === 'naked'
                    ? `Cross out the slashed ${match.value}s. Only ${match.target.value} remains in the outlined cell.`
                    : `Cross out the slashed ${match.value}s. That leaves one place for ${match.target.value}.`,
                accessibleDetail: `The four corner candidates force ${match.value} into both highlighted ${coverName}, eliminating ${match.value} from ${describeCoordinates(match.eliminations)}.`,
                spotlightCells: match.resultKind === 'naked'
                    ? [{ row: match.target.row, col: match.target.col }]
                    : [],
                contextCells: match.baseUnits.flatMap(unit => unit.cells),
                guideUnits: coverGuides,
                guideStrokeTone: 'soft',
                candidateMarks: [...cornerMarks, ...eliminatedMarks],
                candidateTransition: match.resultKind === 'naked'
                    ? {
                        row: match.target.row,
                        col: match.target.col,
                        beforeCandidates: [...match.beforeCandidates],
                        removedValue: match.value,
                        afterCandidates: [...match.afterCandidates],
                    }
                    : undefined,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: match.resultKind === 'hidden',
                dimUnrelated: true,
            },
            {
                id: 'x-wing-answer',
                techniqueLabel: match.resultKind === 'naked'
                    ? 'Naked single'
                    : 'Hidden single',
                title: match.resultKind === 'naked'
                    ? `Only ${match.target.value} remains`
                    : `Only one place remains for ${match.target.value}`,
                body: match.resultKind === 'naked'
                    ? `${match.target.value} belongs in this cell.`
                    : `Every other ${match.target.value} is ruled out, so ${match.target.value} belongs in the outlined cell.`,
                accessibleDetail: match.resultKind === 'naked'
                    ? `The X-Wing removes ${match.value} from ${describeCoordinate(match.target)}, leaving ${match.target.value}.`
                    : `The X-Wing leaves ${describeCoordinate(match.target)} as the only place for ${match.target.value} in this ${unitName(match.resultUnit)}.`,
                spotlightCells: [{ row: match.target.row, col: match.target.col }],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                unitStrokeTone: match.resultKind === 'hidden' ? 'soft' : undefined,
                supportSourceCells: match.resultKind === 'hidden'
                    ? hiddenResultSupportSources
                    : undefined,
                candidateMarks: match.resultKind === 'hidden'
                    ? [...hiddenResultEliminatedMarks, answerMark]
                    : [answerMark],
                eliminationStyle: match.resultKind === 'hidden'
                    ? 'candidate-slash'
                    : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                fillTargetCell: true,
                target: match.target,
                dimUnrelated: true,
            },
        ],
    };
};

interface XYWingPattern {
    pivot: HintCoordinate;
    xWing: HintCoordinate;
    yWing: HintCoordinate;
    x: number;
    y: number;
    z: number;
    eliminations: HintCandidateDelta[];
}

interface XYWingNakedMatch extends XYWingPattern {
    resultKind: 'naked';
    target: HintCoordinate & { value: number };
    beforeCandidates: number[];
    afterCandidates: number[];
}

interface XYWingHiddenMatch extends XYWingPattern {
    resultKind: 'hidden';
    target: HintCoordinate & { value: number };
    resultUnit: HintUnit;
    causalEliminations: HintCandidateDelta[];
}

type XYWingMatch = XYWingNakedMatch | XYWingHiddenMatch;

const coordinatesArePeers = (left: HintCoordinate, right: HintCoordinate) => (
    left.row === right.row
    || left.col === right.col
    || getBoxIndex(left.row, left.col) === getBoxIndex(right.row, right.col)
);

const sharedPeerUnit = (left: HintCoordinate, right: HintCoordinate): HintUnit => {
    const leftBox = getBoxIndex(left.row, left.col);
    const rightBox = getBoxIndex(right.row, right.col);
    if (leftBox === rightBox) {
        return { kind: 'box', index: leftBox, cells: getUnitCells('box', leftBox) };
    }
    if (left.row === right.row) {
        return { kind: 'row', index: left.row, cells: getUnitCells('row', left.row) };
    }
    return { kind: 'column', index: left.col, cells: getUnitCells('column', left.col) };
};

const uniqueGuideUnits = (units: HintGuideUnit[]): HintGuideUnit[] => {
    const guides = new Map<string, HintGuideUnit>();
    units.forEach(unit => {
        const guide = { kind: unit.kind, index: unit.index };
        guides.set(`${guide.kind}:${guide.index}`, guide);
    });
    return [...guides.values()];
};

const makeXYWingNoteSet = (
    coordinate: HintCoordinate,
    values: readonly number[],
    emphasizedValues: readonly number[],
    supportValues: readonly number[] = [],
): HintCandidateNoteSet => {
    const emphasized = new Set(emphasizedValues);
    const supported = new Set(supportValues);
    return {
        ...coordinate,
        marks: [...values].sort((a, b) => a - b).map(value => ({
            value,
            tone: emphasized.has(value)
                ? 'locked'
                : supported.has(value)
                    ? 'support'
                    : 'possible',
        })),
    };
};

const findXYWingPatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): XYWingPattern[] => {
    const bivalueCells: Array<HintCoordinate & { values: [number, number] }> = [];
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] !== 0 || candidates[row][col].length !== 2) continue;
            const values = [...candidates[row][col]].sort((left, right) => left - right) as [number, number];
            bivalueCells.push({ row, col, values });
        }
    }

    const patterns = new Map<string, XYWingPattern>();
    for (const pivot of bivalueCells) {
        const [x, y] = pivot.values;
        const pivotPeers = bivalueCells.filter(cell => (
            coordinateKey(cell) !== coordinateKey(pivot)
            && coordinatesArePeers(pivot, cell)
        ));

        for (const xWing of pivotPeers) {
            if (!xWing.values.includes(x) || xWing.values.includes(y)) continue;
            const z = xWing.values.find(value => value !== x);
            if (z === undefined || z === y) continue;

            for (const yWing of pivotPeers) {
                if (
                    coordinateKey(yWing) === coordinateKey(xWing)
                    || !yWing.values.includes(y)
                    || yWing.values.includes(x)
                    || !yWing.values.includes(z)
                ) continue;

                const sourceKeys = new Set([
                    coordinateKey(pivot),
                    coordinateKey(xWing),
                    coordinateKey(yWing),
                ]);
                const eliminations: HintCandidateDelta[] = [];
                let unsafeElimination = false;
                for (let row = 0; row < 9; row++) {
                    for (let col = 0; col < 9; col++) {
                        const cell = { row, col };
                        if (
                            board[row][col] !== 0
                            || sourceKeys.has(coordinateKey(cell))
                            || !candidates[row][col].includes(z)
                            || !coordinatesArePeers(cell, xWing)
                            || !coordinatesArePeers(cell, yWing)
                        ) continue;
                        const beforeCandidates = [...candidates[row][col]];
                        const afterCandidates = beforeCandidates.filter(value => value !== z);
                        if (afterCandidates.length === 0) {
                            unsafeElimination = true;
                            continue;
                        }
                        eliminations.push({
                            row,
                            col,
                            beforeCandidates,
                            removedValues: [z],
                            afterCandidates,
                        });
                    }
                }
                eliminations.sort(compareCoordinates);
                if (unsafeElimination || eliminations.length === 0) continue;

                const wingKeys = [coordinateKey(xWing), coordinateKey(yWing)].sort();
                const key = `${coordinateKey(pivot)}|${wingKeys.join('|')}|${x}:${y}:${z}`;
                if (patterns.has(key)) continue;
                patterns.set(key, {
                    pivot: { row: pivot.row, col: pivot.col },
                    xWing: { row: xWing.row, col: xWing.col },
                    yWing: { row: yWing.row, col: yWing.col },
                    x,
                    y,
                    z,
                    eliminations,
                });
            }
        }
    }

    return [...patterns.values()].sort((left, right) => (
        left.eliminations.length - right.eliminations.length
        || compareCoordinates(left.pivot, right.pivot)
        || left.x - right.x
        || left.y - right.y
        || left.z - right.z
        || compareCoordinates(left.xWing, right.xWing)
        || compareCoordinates(left.yWing, right.yWing)
    ));
};

const applyXYWingPattern = (
    candidates: CandidateGrid,
    pattern: XYWingPattern,
) => applyCandidateDeltas(candidates, pattern.eliminations);

const makeXYWingPlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const existingHidden = new Set(findHiddenSingleMatches(board, candidates).map(match => (
        `${match.row}:${match.col}:${match.value}`
    )));
    const matches = findXYWingPatterns(board, candidates).map((pattern): XYWingMatch | null => {
        const after = applyXYWingPattern(candidates, pattern);
        const nakedTarget = pattern.eliminations.find(elimination => (
            elimination.beforeCandidates.length > 1
            && elimination.afterCandidates.length === 1
        ));
        if (nakedTarget) {
            return {
                ...pattern,
                resultKind: 'naked',
                target: {
                    row: nakedTarget.row,
                    col: nakedTarget.col,
                    value: nakedTarget.afterCandidates[0],
                },
                beforeCandidates: [...nakedTarget.beforeCandidates],
                afterCandidates: [...nakedTarget.afterCandidates],
            };
        }

        for (const hiddenTarget of findHiddenSingleMatches(board, after)) {
            const hiddenKey = `${hiddenTarget.row}:${hiddenTarget.col}:${hiddenTarget.value}`;
            if (hiddenTarget.value !== pattern.z || existingHidden.has(hiddenKey)) continue;
            const unitKeys = new Set(hiddenTarget.unit.cells.map(coordinateKey));
            const causalEliminations = pattern.eliminations.filter(elimination => (
                unitKeys.has(coordinateKey(elimination))
                && elimination.removedValues.includes(pattern.z)
            ));
            if (causalEliminations.length === 0) continue;
            return {
                ...pattern,
                resultKind: 'hidden',
                target: {
                    row: hiddenTarget.row,
                    col: hiddenTarget.col,
                    value: hiddenTarget.value,
                },
                resultUnit: hiddenTarget.unit,
                causalEliminations,
            };
        }
        return null;
    }).filter((match): match is XYWingMatch => match !== null).sort((left, right) => (
        (left.resultKind === 'naked' ? 0 : 1) - (right.resultKind === 'naked' ? 0 : 1)
        || left.eliminations.length - right.eliminations.length
        || compareCoordinates(left.pivot, right.pivot)
        || left.x - right.x
        || left.y - right.y
        || left.z - right.z
        || compareCoordinates(left.target, right.target)
    ));
    const match = matches[0];
    if (!match) return null;

    const pivotFrameNotes = makeXYWingNoteSet(
        match.pivot,
        [match.x, match.y],
        [match.x, match.y],
    );
    const firstWingFrameNotes: HintCandidateNoteSet[] = [
        makeXYWingNoteSet(match.pivot, [match.x, match.y], [match.x, match.y]),
        makeXYWingNoteSet(match.xWing, [match.x, match.z], [match.x], [match.z]),
    ];
    const secondWingFrameNotes: HintCandidateNoteSet[] = [
        makeXYWingNoteSet(match.pivot, [match.x, match.y], [match.x, match.y]),
        makeXYWingNoteSet(match.xWing, [match.x, match.z], [match.x], [match.z]),
        makeXYWingNoteSet(match.yWing, [match.y, match.z], [match.y], [match.z]),
    ];
    const removalFrameNotes: HintCandidateNoteSet[] = [
        makeXYWingNoteSet(match.pivot, [match.x, match.y], [match.x, match.y]),
        makeXYWingNoteSet(match.xWing, [match.x, match.z], [match.x], [match.z]),
        makeXYWingNoteSet(match.yWing, [match.y, match.z], [match.y], [match.z]),
    ];
    const eliminatedMarks: HintCandidateMark[] = match.eliminations.map(elimination => ({
        row: elimination.row,
        col: elimination.col,
        value: match.z,
        tone: 'eliminated',
    }));
    const firstWingUnit = sharedPeerUnit(match.pivot, match.xWing);
    const secondWingUnit = sharedPeerUnit(match.pivot, match.yWing);
    const removalGuideUnits = uniqueGuideUnits(match.eliminations.flatMap(elimination => [
        sharedPeerUnit(elimination, match.xWing),
        sharedPeerUnit(elimination, match.yWing),
    ]));
    const hiddenResultOtherCells = match.resultKind === 'hidden'
        ? match.resultUnit.cells.filter(cell => (
            board[cell.row][cell.col] === 0
            && (cell.row !== match.target.row || cell.col !== match.target.col)
        ))
        : [];
    const hiddenResultEliminatedMarks: HintCandidateMark[] = hiddenResultOtherCells.map(cell => ({
        ...cell,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const causalEliminationKeys = new Set(
        match.resultKind === 'hidden'
            ? match.causalEliminations.map(coordinateKey)
            : [],
    );
    const hiddenResultPreBlockedCells = match.resultKind === 'hidden'
        ? hiddenResultOtherCells.filter(cell => (
            !causalEliminationKeys.has(coordinateKey(cell))
            && !candidates[cell.row][cell.col].includes(match.target.value)
        ))
        : [];
    const hiddenResultSupportSources = match.resultKind === 'hidden'
        ? selectMinimalBlockers(board, hiddenResultPreBlockedCells, match.target.value)
        : [];
    const answerMark: HintCandidateMark = { ...match.target, tone: 'answer' };

    return {
        outcome: 'placement',
        technique: 'xyWing',
        techniqueLabel: 'XY-Wing',
        target: match.target,
        derivedResult: match.resultKind,
        candidateEliminations: match.eliminations.map(cloneCandidateDelta),
        frames: [
            {
                id: 'xy-wing-pivot',
                techniqueLabel: 'XY-Wing',
                title: `This cell is ${match.x} or ${match.y}`,
                body: "We don't know which one yet.",
                titleParts: [
                    { text: 'This cell is ' },
                    candidateValuePart(match.x),
                    { text: ' or ' },
                    candidateValuePart(match.y),
                ],
                accessibleDetail: `The pivot at ${describeCoordinate(match.pivot)} has candidates ${match.x} and ${match.y}.`,
                spotlightCells: [match.pivot],
                candidateNoteSets: [pivotFrameNotes],
                dimUnrelated: true,
            },
            {
                id: 'xy-wing-first-wing',
                techniqueLabel: 'XY-Wing',
                title: `This wing is ${match.x} or ${match.z}`,
                body: `The ${match.x} in both cells links them through this ${unitName(firstWingUnit)}.`,
                titleParts: [
                    { text: 'This wing is ' },
                    candidateValuePart(match.x),
                    { text: ' or ' },
                    candidateValuePart(match.z, 'support'),
                ],
                bodyParts: [
                    { text: 'The ' },
                    candidateValuePart(match.x),
                    { text: ` in both cells links them through this ${unitName(firstWingUnit)}.` },
                ],
                accessibleDetail: `The first wing at ${describeCoordinate(match.xWing)} has candidates ${match.x} and ${match.z}, and shares this ${unitName(firstWingUnit)} with the pivot at ${describeCoordinate(match.pivot)}.`,
                spotlightCells: [match.xWing],
                guideUnits: [{ kind: firstWingUnit.kind, index: firstWingUnit.index }],
                guideStrokeTone: 'soft',
                candidateNoteSets: firstWingFrameNotes,
                dimUnrelated: true,
            },
            {
                id: 'xy-wing-second-wing',
                techniqueLabel: 'XY-Wing',
                title: `The other wing is ${match.y} or ${match.z}`,
                body: `The ${match.y} in both cells links them through this ${unitName(secondWingUnit)}.`,
                titleParts: [
                    { text: 'The other wing is ' },
                    candidateValuePart(match.y),
                    { text: ' or ' },
                    candidateValuePart(match.z, 'support'),
                ],
                bodyParts: [
                    { text: 'The ' },
                    candidateValuePart(match.y),
                    { text: ` in both cells links them through this ${unitName(secondWingUnit)}.` },
                ],
                accessibleDetail: `The second wing at ${describeCoordinate(match.yWing)} has candidates ${match.y} and ${match.z}, and shares this ${unitName(secondWingUnit)} with the pivot at ${describeCoordinate(match.pivot)}.`,
                spotlightCells: [match.yWing],
                guideUnits: [{ kind: secondWingUnit.kind, index: secondWingUnit.index }],
                guideStrokeTone: 'soft',
                candidateNoteSets: secondWingFrameNotes,
                dimUnrelated: true,
            },
            {
                id: 'xy-wing-remove',
                techniqueLabel: 'XY-Wing',
                title: `Either way, one wing must be ${match.z}`,
                body: match.resultKind === 'naked'
                    ? `The outlined cell sees both wings, so ${match.z} cannot go here. Cross it out; only ${match.target.value} remains.`
                    : match.eliminations.length === 1
                        ? `The ${match.z} in the shaded cell sees both wings, so cross it out.`
                        : `Every shaded ${match.z} sees both wings, so cross them out.`,
                titleParts: [
                    { text: 'Either way, one wing must be ' },
                    candidateValuePart(match.z, 'support'),
                ],
                bodyParts: match.resultKind === 'naked'
                    ? [
                        { text: 'The outlined cell sees both wings, so ' },
                        candidateValuePart(match.z, 'removed'),
                        { text: ' cannot go here. Cross it out; only ' },
                        candidateValuePart(match.target.value, 'remaining'),
                        { text: ' remains.' },
                    ]
                    : match.eliminations.length === 1
                        ? [
                            { text: 'The ' },
                            candidateValuePart(match.z, 'removed'),
                            { text: ' in the shaded cell sees both wings, so cross it out.' },
                        ]
                        : [
                            { text: 'Every shaded ' },
                            candidateValuePart(match.z, 'removed'),
                            { text: ' sees both wings, so cross them out.' },
                        ],
                accessibleDetail: match.eliminations.length === 1
                    ? `If the pivot is ${match.x}, the ${match.x}/${match.z} wing must be ${match.z}. If the pivot is ${match.y}, the ${match.y}/${match.z} wing must be ${match.z}. Therefore the ${match.z} at ${describeCoordinate(match.eliminations[0])} can be crossed out because that cell sees both wings.`
                    : `If the pivot is ${match.x}, the ${match.x}/${match.z} wing must be ${match.z}. If the pivot is ${match.y}, the ${match.y}/${match.z} wing must be ${match.z}. Therefore ${match.z} can be crossed out at ${describeCoordinates(match.eliminations)} because those cells see both wings.`,
                spotlightCells: match.resultKind === 'naked'
                    ? [{ row: match.target.row, col: match.target.col }]
                    : [match.xWing, match.yWing],
                guideUnits: removalGuideUnits,
                guideStrokeTone: 'soft',
                candidateNoteSets: removalFrameNotes,
                candidateMarks: eliminatedMarks,
                candidateTransition: match.resultKind === 'naked'
                    ? {
                        row: match.target.row,
                        col: match.target.col,
                        beforeCandidates: [...match.beforeCandidates],
                        removedValue: match.z,
                        afterCandidates: [...match.afterCandidates],
                    }
                    : undefined,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: match.resultKind === 'hidden',
                dimUnrelated: true,
            },
            {
                id: 'xy-wing-answer',
                techniqueLabel: match.resultKind === 'naked' ? 'Naked single' : 'Hidden single',
                title: match.resultKind === 'naked'
                    ? `Only ${match.target.value} remains`
                    : `Only one place remains for ${match.target.value}`,
                body: match.resultKind === 'naked'
                    ? `${match.target.value} belongs in this cell.`
                    : `Every other ${match.target.value} is ruled out, so ${match.target.value} belongs in the outlined cell.`,
                titleParts: match.resultKind === 'naked'
                    ? [
                        { text: 'Only ' },
                        candidateValuePart(match.target.value, 'remaining'),
                        { text: ' remains' },
                    ]
                    : [
                        { text: 'Only one place remains for ' },
                        candidateValuePart(match.target.value, 'remaining'),
                    ],
                bodyParts: match.resultKind === 'naked'
                    ? [
                        candidateValuePart(match.target.value, 'remaining'),
                        { text: ' belongs in this cell.' },
                    ]
                    : [
                        { text: 'Every other ' },
                        candidateValuePart(match.target.value, 'removed'),
                        { text: ' is ruled out, so ' },
                        candidateValuePart(match.target.value, 'remaining'),
                        { text: ' belongs in the outlined cell.' },
                    ],
                accessibleDetail: match.resultKind === 'naked'
                    ? `The XY-Wing removes ${match.z} from ${describeCoordinate(match.target)}, leaving ${match.target.value}.`
                    : `The XY-Wing leaves ${describeCoordinate(match.target)} as the only place for ${match.target.value} in this ${unitName(match.resultUnit)}.`,
                spotlightCells: [{ row: match.target.row, col: match.target.col }],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                unitStrokeTone: match.resultKind === 'hidden' ? 'soft' : undefined,
                supportSourceCells: match.resultKind === 'hidden'
                    ? hiddenResultSupportSources
                    : undefined,
                candidateMarks: match.resultKind === 'hidden'
                    ? [...hiddenResultEliminatedMarks, answerMark]
                    : [answerMark],
                eliminationStyle: match.resultKind === 'hidden'
                    ? 'candidate-slash'
                    : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                fillTargetCell: true,
                target: match.target,
                dimUnrelated: true,
            },
        ],
    };
};

type SimpleColor = 0 | 1;

interface SimpleColoringLink {
    first: HintCoordinate;
    second: HintCoordinate;
    unit: HintUnit;
}

interface SimpleColoringPattern {
    rule: 'trap' | 'wrap';
    value: number;
    colorCells: [HintCoordinate[], HintCoordinate[]];
    links: SimpleColoringLink[];
    conflictCells?: [HintCoordinate, HintCoordinate];
    eliminations: HintCandidateDelta[];
}

interface SimpleColoringNakedMatch extends SimpleColoringPattern {
    resultKind: 'naked';
    target: HintCoordinate & { value: number };
    beforeCandidates: number[];
    afterCandidates: number[];
}

interface SimpleColoringHiddenMatch extends SimpleColoringPattern {
    resultKind: 'hidden';
    target: HintCoordinate & { value: number };
    resultUnit: HintUnit;
    causalEliminations: HintCandidateDelta[];
}

type SimpleColoringMatch = SimpleColoringNakedMatch | SimpleColoringHiddenMatch;

const makeColoringDelta = (
    candidates: CandidateGrid,
    cell: HintCoordinate,
    value: number,
): HintCandidateDelta | null => {
    const beforeCandidates = [...candidates[cell.row][cell.col]];
    if (!beforeCandidates.includes(value)) return null;
    const afterCandidates = beforeCandidates.filter(candidate => candidate !== value);
    if (afterCandidates.length === 0) return null;
    return {
        ...cell,
        beforeCandidates,
        removedValues: [value],
        afterCandidates,
    };
};

const findSimpleColoringPatterns = (
    board: NumericBoard,
    candidates: CandidateGrid,
): SimpleColoringPattern[] => {
    const patterns: SimpleColoringPattern[] = [];

    for (const value of DIGITS) {
        const coordinates = new Map<string, HintCoordinate>();
        const adjacency = new Map<string, Set<string>>();
        const linksByPair = new Map<string, SimpleColoringLink>();

        for (const unit of ALL_UNITS) {
            const positions = unit.cells.filter(cell => (
                board[cell.row][cell.col] === 0
                && candidates[cell.row][cell.col].includes(value)
            ));
            if (positions.length !== 2) continue;
            const [first, second] = [...positions].sort(compareCoordinates);
            const firstKey = coordinateKey(first);
            const secondKey = coordinateKey(second);
            coordinates.set(firstKey, first);
            coordinates.set(secondKey, second);
            if (!adjacency.has(firstKey)) adjacency.set(firstKey, new Set());
            if (!adjacency.has(secondKey)) adjacency.set(secondKey, new Set());
            adjacency.get(firstKey)?.add(secondKey);
            adjacency.get(secondKey)?.add(firstKey);
            const pairKey = [firstKey, secondKey].sort().join('|');
            const existing = linksByPair.get(pairKey);
            if (
                !existing
                || UNIT_KIND_PRIORITY[unit.kind] < UNIT_KIND_PRIORITY[existing.unit.kind]
                || (
                    UNIT_KIND_PRIORITY[unit.kind] === UNIT_KIND_PRIORITY[existing.unit.kind]
                    && unit.index < existing.unit.index
                )
            ) {
                linksByPair.set(pairKey, { first, second, unit });
            }
        }

        const visited = new Set<string>();
        const starts = [...adjacency.keys()].sort();
        for (const start of starts) {
            if (visited.has(start)) continue;
            const colors = new Map<string, SimpleColor>();
            const queue = [start];
            colors.set(start, 0);
            visited.add(start);
            while (queue.length > 0) {
                const current = queue.shift() as string;
                const nextColor: SimpleColor = colors.get(current) === 0 ? 1 : 0;
                const neighbors = [...(adjacency.get(current) ?? [])].sort();
                for (const neighbor of neighbors) {
                    if (colors.has(neighbor)) continue;
                    colors.set(neighbor, nextColor);
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }

            // An odd strong-link cycle cannot be assigned two consistent
            // colors. Treat it as an invalid candidate component rather than
            // presenting one arbitrary BFS coloring as a Color Wrap.
            const hasInconsistentStrongLink = [...colors].some(([key, color]) => (
                [...(adjacency.get(key) ?? [])].some(neighbor => colors.get(neighbor) === color)
            ));
            if (hasInconsistentStrongLink) continue;

            const componentKeys = new Set(colors.keys());
            const colorCells = ([0, 1] as const).map(color => (
                [...colors]
                    .filter(([, assigned]) => assigned === color)
                    .map(([key]) => coordinates.get(key) as HintCoordinate)
                    .sort(compareCoordinates)
            )) as [HintCoordinate[], HintCoordinate[]];
            const links = [...linksByPair.values()].filter(link => (
                componentKeys.has(coordinateKey(link.first))
                && componentKeys.has(coordinateKey(link.second))
            )).sort((left, right) => (
                compareCoordinates(left.first, right.first)
                || compareCoordinates(left.second, right.second)
                || UNIT_KIND_PRIORITY[left.unit.kind] - UNIT_KIND_PRIORITY[right.unit.kind]
                || left.unit.index - right.unit.index
            ));

            const conflicts = ([0, 1] as const).map(color => {
                const cells = colorCells[color];
                for (let firstIndex = 0; firstIndex < cells.length; firstIndex++) {
                    for (let secondIndex = firstIndex + 1; secondIndex < cells.length; secondIndex++) {
                        if (coordinatesArePeers(cells[firstIndex], cells[secondIndex])) {
                            return [cells[firstIndex], cells[secondIndex]] as [HintCoordinate, HintCoordinate];
                        }
                    }
                }
                return null;
            });

            // A component where both colors contradict themselves represents
            // an inconsistent candidate state, not a teachable coloring step.
            if (conflicts[0] && conflicts[1]) continue;
            const conflictColor = conflicts[0] ? 0 : conflicts[1] ? 1 : null;
            if (conflictColor !== null) {
                const eliminations = colorCells[conflictColor]
                    .map(cell => makeColoringDelta(candidates, cell, value))
                    .filter((delta): delta is HintCandidateDelta => delta !== null)
                    .sort(compareCoordinates);
                if (eliminations.length !== colorCells[conflictColor].length) continue;
                patterns.push({
                    rule: 'wrap',
                    value,
                    colorCells,
                    links,
                    conflictCells: conflicts[conflictColor] as [HintCoordinate, HintCoordinate],
                    eliminations,
                });
                continue;
            }

            const trapCells: HintCoordinate[] = [];
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    const cell = { row, col };
                    if (
                        board[row][col] !== 0
                        || !candidates[row][col].includes(value)
                        || componentKeys.has(coordinateKey(cell))
                    ) continue;
                    if (
                        colorCells[0].some(colored => coordinatesArePeers(cell, colored))
                        && colorCells[1].some(colored => coordinatesArePeers(cell, colored))
                    ) {
                        trapCells.push(cell);
                    }
                }
            }
            const eliminations = trapCells
                .sort(compareCoordinates)
                .map(cell => makeColoringDelta(candidates, cell, value))
                .filter((delta): delta is HintCandidateDelta => delta !== null);
            if (eliminations.length !== trapCells.length || eliminations.length === 0) continue;
            patterns.push({ rule: 'trap', value, colorCells, links, eliminations });
        }
    }

    return patterns.sort((left, right) => (
        left.colorCells.flat().length - right.colorCells.flat().length
        || left.links.length - right.links.length
        || left.eliminations.length - right.eliminations.length
        || (left.rule === 'trap' ? 0 : 1) - (right.rule === 'trap' ? 0 : 1)
        || left.value - right.value
        || compareCoordinates(left.colorCells[0][0], right.colorCells[0][0])
    ));
};

const shortestColoringPath = (
    links: SimpleColoringLink[],
    start: HintCoordinate,
    end: HintCoordinate,
): Set<string> => {
    const startKey = coordinateKey(start);
    const endKey = coordinateKey(end);
    const adjacency = new Map<string, Set<string>>();
    for (const link of links) {
        const firstKey = coordinateKey(link.first);
        const secondKey = coordinateKey(link.second);
        if (!adjacency.has(firstKey)) adjacency.set(firstKey, new Set());
        if (!adjacency.has(secondKey)) adjacency.set(secondKey, new Set());
        adjacency.get(firstKey)?.add(secondKey);
        adjacency.get(secondKey)?.add(firstKey);
    }
    const queue = [startKey];
    const previous = new Map<string, string | null>([[startKey, null]]);
    while (queue.length > 0) {
        const current = queue.shift() as string;
        if (current === endKey) break;
        for (const neighbor of [...(adjacency.get(current) ?? [])].sort()) {
            if (previous.has(neighbor)) continue;
            previous.set(neighbor, current);
            queue.push(neighbor);
        }
    }
    if (!previous.has(endKey)) return new Set([startKey, endKey]);
    const path = new Set<string>();
    let current: string | null = endKey;
    while (current !== null) {
        path.add(current);
        current = previous.get(current) ?? null;
    }
    return path;
};

const MAX_COLOR_CHAIN_CELLS = 8;
const MAX_CANDIDATE_COLOR_CHAIN_CELLS = 9;

const coloringTrapWitnesses = (
    pattern: SimpleColoringPattern,
    elimination: HintCoordinate,
): {
    first: HintCoordinate;
    second: HintCoordinate;
    path: Set<string>;
} | null => {
    const witnesses = ([0, 1] as const).map(color => (
        pattern.colorCells[color]
            .filter(cell => coordinatesArePeers(cell, elimination))
            .sort(compareCoordinates)
    ));
    let best: {
        first: HintCoordinate;
        second: HintCoordinate;
        path: Set<string>;
    } | null = null;
    for (const first of witnesses[0]) {
        for (const second of witnesses[1]) {
            const path = shortestColoringPath(pattern.links, first, second);
            const signature = [...path].sort().join('|');
            const bestSignature = best ? [...best.path].sort().join('|') : '';
            if (
                !best
                || path.size < best.path.size
                || (path.size === best.path.size && signature < bestSignature)
            ) {
                best = { first, second, path };
            }
        }
    }
    return best;
};

const connectColoringPaths = (
    current: Set<string>,
    addition: Set<string>,
    links: SimpleColoringLink[],
): Set<string> | null => {
    if (current.size === 0) return new Set(addition);
    if ([...addition].some(key => current.has(key))) {
        return new Set([...current, ...addition]);
    }

    const coordinates = new Map<string, HintCoordinate>();
    links.forEach(link => {
        coordinates.set(coordinateKey(link.first), link.first);
        coordinates.set(coordinateKey(link.second), link.second);
    });
    let connector: Set<string> | null = null;
    for (const currentKey of [...current].sort()) {
        const currentCell = coordinates.get(currentKey);
        if (!currentCell) continue;
        for (const additionKey of [...addition].sort()) {
            const additionCell = coordinates.get(additionKey);
            if (!additionCell) continue;
            const path = shortestColoringPath(links, currentCell, additionCell);
            const signature = [...path].sort().join('|');
            const connectorSignature = connector ? [...connector].sort().join('|') : '';
            if (
                !connector
                || path.size < connector.size
                || (path.size === connector.size && signature < connectorSignature)
            ) connector = path;
        }
    }
    if (!connector) return null;
    return new Set([...current, ...connector, ...addition]);
};

const coloringCausalKeys = (
    match: SimpleColoringPattern,
    eliminations: HintCandidateDelta[],
): Set<string> | null => {
    if (match.rule === 'wrap') {
        if (!match.conflictCells) return null;
        let keys = shortestColoringPath(
            match.links,
            match.conflictCells[0],
            match.conflictCells[1],
        );
        for (const elimination of eliminations) {
            const branch = shortestColoringPath(
                match.links,
                match.conflictCells[0],
                elimination,
            );
            const connected = connectColoringPaths(keys, branch, match.links);
            if (!connected) return null;
            keys = connected;
        }
        return keys;
    }

    let keys = new Set<string>();
    for (const elimination of eliminations) {
        const witnesses = coloringTrapWitnesses(match, elimination);
        if (!witnesses) return null;
        const connected = connectColoringPaths(keys, witnesses.path, match.links);
        if (!connected) return null;
        keys = connected;
    }
    return keys;
};

const uniqueColoringGuides = (links: SimpleColoringLink[]): HintGuideUnit[] => {
    return uniqueGuideUnits(links.map(({ unit }) => unit));
};

const makeSimpleColoringPlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const existingHidden = new Set(findHiddenSingleMatches(board, candidates).map(match => (
        `${match.row}:${match.col}:${match.value}`
    )));
    const matches = findSimpleColoringPatterns(board, candidates)
        .map((pattern): SimpleColoringMatch | null => {
            const after = applyCandidateDeltas(candidates, pattern.eliminations);
            const nakedTarget = pattern.eliminations.find(elimination => (
                elimination.beforeCandidates.length > 1
                && elimination.afterCandidates.length === 1
            ));
            if (nakedTarget) {
                return {
                    ...pattern,
                    resultKind: 'naked',
                    target: {
                        row: nakedTarget.row,
                        col: nakedTarget.col,
                        value: nakedTarget.afterCandidates[0],
                    },
                    beforeCandidates: [...nakedTarget.beforeCandidates],
                    afterCandidates: [...nakedTarget.afterCandidates],
                };
            }
            for (const hiddenTarget of findHiddenSingleMatches(board, after)) {
                const key = `${hiddenTarget.row}:${hiddenTarget.col}:${hiddenTarget.value}`;
                if (hiddenTarget.value !== pattern.value || existingHidden.has(key)) continue;
                const unitKeys = new Set(hiddenTarget.unit.cells.map(coordinateKey));
                const causalEliminations = pattern.eliminations.filter(elimination => (
                    unitKeys.has(coordinateKey(elimination))
                    && elimination.removedValues.includes(pattern.value)
                ));
                if (causalEliminations.length === 0) continue;
                return {
                    ...pattern,
                    resultKind: 'hidden',
                    target: {
                        row: hiddenTarget.row,
                        col: hiddenTarget.col,
                        value: hiddenTarget.value,
                    },
                    resultUnit: hiddenTarget.unit,
                    causalEliminations,
                };
            }
            return null;
        })
        .filter((match): match is SimpleColoringMatch => match !== null);

    const prepared = matches.map(match => {
        const focusEliminations = match.resultKind === 'naked'
            ? match.eliminations.filter(elimination => (
                elimination.row === match.target.row
                && elimination.col === match.target.col
            ))
            : match.causalEliminations;
        if (focusEliminations.length === 0) return null;
        const afterFocus = applyCandidateDeltas(candidates, focusEliminations);
        if (match.resultKind === 'hidden') {
            const stillForced = findHiddenSingleMatches(board, afterFocus).some(candidate => (
                candidate.row === match.target.row
                && candidate.col === match.target.col
                && candidate.value === match.target.value
                && candidate.unit.kind === match.resultUnit.kind
                && candidate.unit.index === match.resultUnit.index
            ));
            if (!stillForced) return null;
        }
        const causalKeys = coloringCausalKeys(match, focusEliminations);
        if (!causalKeys || causalKeys.size > MAX_COLOR_CHAIN_CELLS) return null;
        return { match, focusEliminations, causalKeys };
    }).filter((item): item is {
        match: SimpleColoringMatch;
        focusEliminations: HintCandidateDelta[];
        causalKeys: Set<string>;
    } => item !== null).sort((left, right) => (
        (left.match.resultKind === 'naked' ? 0 : 1)
        - (right.match.resultKind === 'naked' ? 0 : 1)
        || left.causalKeys.size - right.causalKeys.size
        || left.focusEliminations.length - right.focusEliminations.length
        || (left.match.rule === 'trap' ? 0 : 1) - (right.match.rule === 'trap' ? 0 : 1)
        || left.match.value - right.match.value
        || compareCoordinates(left.match.target, right.match.target)
    ));
    const selected = prepared[0];
    if (!selected) return null;
    const { match, focusEliminations, causalKeys } = selected;

    const rawCausalColorCells = match.colorCells.map(cells => (
        cells.filter(cell => causalKeys.has(coordinateKey(cell)))
    )) as [HintCoordinate[], HintCoordinate[]];
    const causalLinks = match.links.filter(link => (
        causalKeys.has(coordinateKey(link.first))
        && causalKeys.has(coordinateKey(link.second))
    ));
    if (causalLinks.length === 0) return null;

    // For Color Wrap, always present the contradictory (false) group as the
    // dashed-square group. The grouping is arbitrary, so this normalization
    // keeps the explanation and visual semantics stable across puzzles.
    const rawConflictColor = match.rule === 'wrap' && match.conflictCells
        ? match.colorCells[0].some(cell => (
            coordinateKey(cell) === coordinateKey(match.conflictCells![0])
        )) ? 0 : 1
        : null;
    const causalColorCells: [HintCoordinate[], HintCoordinate[]] = rawConflictColor === 0
        ? [rawCausalColorCells[1], rawCausalColorCells[0]]
        : rawCausalColorCells;
    const circleKeys = new Set(causalColorCells[0].map(coordinateKey));
    const coloredMark = (cell: HintCoordinate): HintCandidateMark => ({
        ...cell,
        value: match.value,
        tone: circleKeys.has(coordinateKey(cell)) ? 'locked' : 'possible',
    });
    const coloredMarks: HintCandidateMark[] = [
        ...causalColorCells[0].map(coloredMark),
        ...causalColorCells[1].map(coloredMark),
    ];
    const eliminatedMarks: HintCandidateMark[] = focusEliminations.map(elimination => ({
        row: elimination.row,
        col: elimination.col,
        value: match.value,
        tone: 'eliminated',
    }));
    const trapFocusNoteSets: HintCandidateNoteSet[] = match.rule === 'trap'
        ? focusEliminations.map(elimination => ({
            row: elimination.row,
            col: elimination.col,
            marks: [{ value: match.value, tone: 'possible' }],
        }))
        : [];
    const answerMark: HintCandidateMark = { ...match.target, tone: 'answer' };
    const linkGuides = uniqueColoringGuides(causalLinks);
    const focusCoordinate = focusEliminations[0];
    const startLink = causalLinks.find(link => (
        match.rule === 'wrap' && match.conflictCells
            ? coordinateKey(link.first) === coordinateKey(match.conflictCells[0])
                || coordinateKey(link.second) === coordinateKey(match.conflictCells[0])
            : coordinatesArePeers(link.first, focusCoordinate)
                || coordinatesArePeers(link.second, focusCoordinate)
    )) ?? causalLinks[0];
    const startMarks = [startLink.first, startLink.second].map(coloredMark);
    const wrapConflictUnit = match.rule === 'wrap' && match.conflictCells
        ? sharedPeerUnit(match.conflictCells[0], match.conflictCells[1])
        : null;
    const trapWitnessGuides = match.rule === 'trap'
        ? focusEliminations.flatMap(elimination => {
            const witnesses = coloringTrapWitnesses(match, elimination);
            if (!witnesses) return [];
            return [
                sharedPeerUnit(elimination, witnesses.first),
                sharedPeerUnit(elimination, witnesses.second),
            ];
        })
        : [];
    const ruleGuides = uniqueColoringGuides(
        match.rule === 'wrap' && wrapConflictUnit && match.conflictCells
            ? [{
                first: match.conflictCells[0],
                second: match.conflictCells[1],
                unit: wrapConflictUnit,
            }]
            : trapWitnessGuides.map(unit => ({
                first: focusCoordinate,
                second: focusCoordinate,
                unit,
            })),
    );
    const hiddenOtherCells = match.resultKind === 'hidden'
        ? match.resultUnit.cells.filter(cell => (
            board[cell.row][cell.col] === 0
            && coordinateKey(cell) !== coordinateKey(match.target)
        ))
        : [];
    const focusEliminationKeys = new Set(focusEliminations.map(coordinateKey));
    const hiddenAnswerEliminations: HintCandidateMark[] = hiddenOtherCells.map(cell => ({
        ...cell,
        value: match.target.value,
        tone: 'eliminated',
    }));
    const hiddenPreBlockedCells = match.resultKind === 'hidden'
        ? hiddenOtherCells.filter(cell => (
            !focusEliminationKeys.has(coordinateKey(cell))
            && !candidates[cell.row][cell.col].includes(match.target.value)
        ))
        : [];
    const hiddenSupportSources = match.resultKind === 'hidden'
        ? selectMinimalBlockers(board, hiddenPreBlockedCells, match.target.value)
        : [];
    const guideDescription = linkGuides.map(guide => (
        `${guide.kind === 'box' ? '3 × 3 box' : guide.kind} ${guide.index + 1}`
    )).join(', ');
    const focusDescription = focusEliminations.map(describeCoordinate).join(' and ');
    const wrapConflictDescription = (match.conflictCells ?? [])
        .map(describeCoordinate)
        .join(' and ');

    return {
        outcome: 'placement',
        technique: 'simpleColoring',
        techniqueLabel: 'Simple coloring',
        target: match.target,
        derivedResult: match.resultKind,
        candidateEliminations: focusEliminations.map(cloneCandidateDelta),
        frames: [
            {
                id: 'color-chain-start',
                techniqueLabel: 'Simple coloring',
                title: `Only two places for ${match.value}`,
                body: `One must be ${match.value}. We mark one with a circle and one with a square.`,
                accessibleDetail: `This ${unitName(startLink.unit)} has exactly two places for ${match.value}: ${describeCoordinate(startLink.first)} and ${describeCoordinate(startLink.second)}. The circle and square are opposite groups; neither is assumed true yet.`,
                spotlightCells: [],
                guideUnits: [{ kind: startLink.unit.kind, index: startLink.unit.index }],
                guideStrokeTone: 'soft',
                candidateMarks: startMarks,
                dimUnrelated: true,
            },
            {
                id: 'color-chain-links',
                techniqueLabel: 'Simple coloring',
                title: 'Follow the alternating chain',
                body: `The possible ${match.value}s alternate between circles and squares.`,
                accessibleDetail: `The shortest relevant chain alternates circle and square candidates at ${describeCoordinates(causalColorCells.flat())}. Its strong links are in ${guideDescription}.`,
                spotlightCells: [],
                candidateMarks: coloredMarks,
                dimUnrelated: true,
            },
            {
                id: 'color-chain-rule',
                techniqueLabel: 'Simple coloring',
                title: match.rule === 'trap'
                    ? `${focusEliminations.length === 1 ? 'This' : 'Each'} ${match.value} sees both groups`
                    : `Two square ${match.value}s share this ${unitName(wrapConflictUnit!)}`,
                body: match.rule === 'trap'
                    ? `One group must be true, so ${focusEliminations.length === 1 ? 'this candidate is' : 'these candidates are'} blocked either way.`
                    : `They cannot both be true, so every square ${match.value} is false.`,
                accessibleDetail: match.rule === 'trap'
                    ? focusEliminations.length === 1
                        ? `The ${match.value} at ${describeCoordinate(focusEliminations[0])} sees one circle and one square ${match.value}. One of those opposite groups must be true, so this outside candidate is false.`
                        : `The ${match.value}s at ${focusDescription} each see one circle and one square ${match.value}. One of those opposite groups must be true, so these outside candidates are false.`
                    : `The square ${match.value}s at ${wrapConflictDescription} see each other in ${unitName(wrapConflictUnit!)} ${wrapConflictUnit!.index + 1}. Therefore the square group is false.`,
                spotlightCells: match.rule === 'wrap'
                    ? match.conflictCells ?? []
                    : focusEliminations.map(({ row, col }) => ({ row, col })),
                guideUnits: ruleGuides,
                guideStrokeTone: 'normal',
                candidateMarks: coloredMarks,
                candidateNoteSets: match.rule === 'trap' ? trapFocusNoteSets : undefined,
                dimUnrelated: true,
            },
            {
                id: 'color-chain-remove',
                techniqueLabel: 'Simple coloring',
                title: match.resultKind === 'naked'
                    ? `Cross out ${match.value}`
                    : `Now ${match.target.value} has one place in this ${unitName(match.resultUnit)}`,
                body: match.resultKind === 'naked'
                    ? `Only ${match.target.value} remains in the outlined cell.`
                    : `Those ${match.target.value} candidates are ruled out.`,
                accessibleDetail: `The visible color-chain proof eliminates ${match.value} from ${describeCoordinates(focusEliminations)}.`,
                spotlightCells: match.resultKind === 'naked'
                    ? [{ row: match.target.row, col: match.target.col }]
                    : [],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                candidateMarks: eliminatedMarks,
                candidateTransition: match.resultKind === 'naked'
                    ? {
                        row: match.target.row,
                        col: match.target.col,
                        beforeCandidates: [...match.beforeCandidates],
                        removedValue: match.value,
                        afterCandidates: [...match.afterCandidates],
                    }
                    : undefined,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: match.resultKind === 'hidden',
                dimUnrelated: true,
            },
            {
                id: 'color-chain-answer',
                techniqueLabel: match.resultKind === 'naked' ? 'Naked single' : 'Hidden single',
                title: match.resultKind === 'naked'
                    ? `Only ${match.target.value} remains`
                    : `Only one place remains for ${match.target.value}`,
                body: match.resultKind === 'naked'
                    ? `${match.target.value} belongs in this cell.`
                    : `Every other ${match.target.value} is ruled out, so ${match.target.value} belongs in the outlined cell.`,
                accessibleDetail: match.resultKind === 'naked'
                    ? `Crossing out ${match.value} leaves only ${match.target.value} at ${describeCoordinate(match.target)}.`
                    : `The color-chain eliminations leave ${describeCoordinate(match.target)} as the only place for ${match.target.value} in ${unitName(match.resultUnit)} ${match.resultUnit.index + 1}.`,
                spotlightCells: [{ row: match.target.row, col: match.target.col }],
                unitCells: match.resultKind === 'hidden' ? match.resultUnit.cells : undefined,
                unitStrokeTone: match.resultKind === 'hidden' ? 'soft' : undefined,
                supportSourceCells: match.resultKind === 'hidden'
                    ? hiddenSupportSources
                    : undefined,
                candidateMarks: match.resultKind === 'hidden'
                    ? [...hiddenAnswerEliminations, answerMark]
                    : [answerMark],
                eliminationStyle: match.resultKind === 'hidden'
                    ? 'candidate-slash'
                    : undefined,
                fillEliminatedCells: match.resultKind === 'hidden',
                fillTargetCell: true,
                target: match.target,
                dimUnrelated: true,
            },
        ],
    };
};

type MultiStepPlacement =
    | {
        resultKind: 'naked';
        target: HintCoordinate & { value: number };
        beforeCandidates: number[];
        afterCandidates: number[];
    }
    | {
        resultKind: 'hidden';
        target: HintCoordinate & { value: number };
        resultUnit: HintUnit;
    };

interface MultiStepLockedDeduction {
    technique: 'lockedCandidate';
    pattern: LockedCandidatePattern;
    eliminations: HintCandidateDelta[];
}

interface MultiStepPairDeduction {
    technique: 'nakedPair';
    pattern: NakedPairPattern;
    eliminations: HintCandidateDelta[];
}

interface MultiStepHiddenPairDeduction {
    technique: 'hiddenPair';
    pattern: HiddenPairPattern;
    eliminations: HintCandidateDelta[];
}

interface MultiStepTripleDeduction {
    technique: 'nakedTriple';
    pattern: NakedTriplePattern;
    eliminations: HintCandidateDelta[];
}

interface MultiStepXWingDeduction {
    technique: 'xWing';
    pattern: XWingPattern;
    eliminations: HintCandidateDelta[];
}

interface MultiStepXYWingDeduction {
    technique: 'xyWing';
    pattern: XYWingPattern;
    eliminations: HintCandidateDelta[];
}

type MultiStepDeduction =
    | MultiStepLockedDeduction
    | MultiStepPairDeduction
    | MultiStepHiddenPairDeduction
    | MultiStepTripleDeduction
    | MultiStepXWingDeduction
    | MultiStepXYWingDeduction;

interface CandidateColoringDeduction {
    technique: 'simpleColoring';
    pattern: SimpleColoringPattern;
    eliminations: HintCandidateDelta[];
}

interface CandidateHiddenTripleDeduction {
    technique: 'hiddenTriple';
    pattern: HiddenTriplePattern;
    eliminations: HintCandidateDelta[];
}

interface CandidateSwordfishDeduction {
    technique: 'swordfish';
    pattern: SwordfishPattern;
    eliminations: HintCandidateDelta[];
}

type CandidateDeduction =
    | MultiStepDeduction
    | CandidateHiddenTripleDeduction
    | CandidateSwordfishDeduction
    | CandidateColoringDeduction;

interface MultiStepSearchResult {
    deductions: MultiStepDeduction[];
    placement: MultiStepPlacement;
}

interface MultiStepSearchRun {
    result: MultiStepSearchResult | null;
    termination: Exclude<HintSearchTermination, 'invalid'>;
    exploredStates: number;
    visitedStates: number;
    generatedTransitions: number;
    maxDepthReached: number;
}

const MAX_MULTI_STEP_DEDUCTIONS = 3;
const MAX_MULTI_STEP_STATES = 512;

const candidateGridSignature = (candidates: CandidateGrid) => (
    candidates.map(row => row.map(cell => cell.join('')).join(',')).join('/')
);

const cloneCandidateDelta = (delta: HintCandidateDelta): HintCandidateDelta => ({
    row: delta.row,
    col: delta.col,
    beforeCandidates: [...delta.beforeCandidates],
    removedValues: [...delta.removedValues],
    afterCandidates: [...delta.afterCandidates],
});

const applyCandidateDeltas = (
    candidates: CandidateGrid,
    eliminations: HintCandidateDelta[],
): CandidateGrid => {
    const next = cloneCandidateGrid(candidates);
    for (const elimination of eliminations) {
        next[elimination.row][elimination.col] = [...elimination.afterCandidates];
    }
    return next;
};

const compareCoordinates = (left: HintCoordinate, right: HintCoordinate) => (
    left.row - right.row || left.col - right.col
);

const findMultiStepDeductions = (
    board: NumericBoard,
    candidates: CandidateGrid,
): MultiStepDeduction[] => {
    const lockedDeductions: MultiStepLockedDeduction[] = findLockedCandidatePatterns(board, candidates)
        .map(pattern => ({
            technique: 'lockedCandidate' as const,
            pattern,
            eliminations: pattern.eliminationCells.map(cell => ({
                row: cell.row,
                col: cell.col,
                beforeCandidates: [...candidates[cell.row][cell.col]],
                removedValues: [pattern.value],
                afterCandidates: candidates[cell.row][cell.col].filter(value => (
                    value !== pattern.value
                )),
            })),
        }))
        .filter(deduction => deduction.eliminations.every(elimination => (
            elimination.removedValues.length > 0
            && elimination.afterCandidates.length > 0
        )))
        .sort((left, right) => (
            (left.pattern.variant === 'pointing' ? 0 : 1)
            - (right.pattern.variant === 'pointing' ? 0 : 1)
            || left.pattern.lockedCells.length - right.pattern.lockedCells.length
            || left.eliminations.length - right.eliminations.length
            || UNIT_KIND_PRIORITY[left.pattern.sourceUnit.kind]
            - UNIT_KIND_PRIORITY[right.pattern.sourceUnit.kind]
            || left.pattern.sourceUnit.index - right.pattern.sourceUnit.index
            || UNIT_KIND_PRIORITY[left.pattern.intersectingUnit.kind]
            - UNIT_KIND_PRIORITY[right.pattern.intersectingUnit.kind]
            || left.pattern.intersectingUnit.index - right.pattern.intersectingUnit.index
            || left.pattern.value - right.pattern.value
            || compareCoordinates(left.pattern.lockedCells[0], right.pattern.lockedCells[0])
        ));

    const pairDeductions: MultiStepPairDeduction[] = findNakedPairPatterns(board, candidates)
        .map(pattern => ({
            technique: 'nakedPair' as const,
            pattern,
            eliminations: pattern.eliminations.map(cloneCandidateDelta),
        }))
        .sort((left, right) => (
            left.eliminations.length - right.eliminations.length
            || UNIT_KIND_PRIORITY[left.pattern.unit.kind]
            - UNIT_KIND_PRIORITY[right.pattern.unit.kind]
            || left.pattern.unit.index - right.pattern.unit.index
            || left.pattern.pairValues[0] - right.pattern.pairValues[0]
            || left.pattern.pairValues[1] - right.pattern.pairValues[1]
            || compareCoordinates(left.pattern.pairCells[0], right.pattern.pairCells[0])
            || compareCoordinates(left.pattern.pairCells[1], right.pattern.pairCells[1])
        ));

    const hiddenPairDeductions: MultiStepHiddenPairDeduction[] = findHiddenPairPatterns(
        board,
        candidates,
    ).map(pattern => ({
        technique: 'hiddenPair' as const,
        pattern,
        eliminations: pattern.eliminations.map(cloneCandidateDelta),
    })).sort((left, right) => (
        left.eliminations.length - right.eliminations.length
        || left.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
        - right.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
        || UNIT_KIND_PRIORITY[left.pattern.unit.kind]
        - UNIT_KIND_PRIORITY[right.pattern.unit.kind]
        || left.pattern.unit.index - right.pattern.unit.index
        || left.pattern.pairValues[0] - right.pattern.pairValues[0]
        || left.pattern.pairValues[1] - right.pattern.pairValues[1]
        || compareCoordinates(left.pattern.pairCells[0], right.pattern.pairCells[0])
        || compareCoordinates(left.pattern.pairCells[1], right.pattern.pairCells[1])
    ));

    const tripleDeductions: MultiStepTripleDeduction[] = findNakedTriplePatterns(
        board,
        candidates,
    ).map(pattern => ({
        technique: 'nakedTriple' as const,
        pattern,
        eliminations: pattern.eliminations.map(cloneCandidateDelta),
    })).sort((left, right) => (
        left.eliminations.length - right.eliminations.length
        || left.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
        - right.eliminations.reduce((sum, item) => sum + item.removedValues.length, 0)
        || UNIT_KIND_PRIORITY[left.pattern.unit.kind]
        - UNIT_KIND_PRIORITY[right.pattern.unit.kind]
        || left.pattern.unit.index - right.pattern.unit.index
        || left.pattern.tripleValues[0] - right.pattern.tripleValues[0]
        || left.pattern.tripleValues[1] - right.pattern.tripleValues[1]
        || left.pattern.tripleValues[2] - right.pattern.tripleValues[2]
        || compareCoordinates(left.pattern.tripleCells[0], right.pattern.tripleCells[0])
        || compareCoordinates(left.pattern.tripleCells[1], right.pattern.tripleCells[1])
        || compareCoordinates(left.pattern.tripleCells[2], right.pattern.tripleCells[2])
    ));

    const xWingDeductions: MultiStepXWingDeduction[] = findXWingPatterns(
        board,
        candidates,
    ).map(pattern => ({
        technique: 'xWing' as const,
        pattern,
        eliminations: pattern.eliminations.map(cloneCandidateDelta),
    })).sort((left, right) => (
        left.eliminations.length - right.eliminations.length
        || (left.pattern.orientation === 'row' ? 0 : 1)
        - (right.pattern.orientation === 'row' ? 0 : 1)
        || left.pattern.value - right.pattern.value
        || left.pattern.baseUnits[0].index - right.pattern.baseUnits[0].index
        || left.pattern.baseUnits[1].index - right.pattern.baseUnits[1].index
        || left.pattern.coverUnits[0].index - right.pattern.coverUnits[0].index
        || left.pattern.coverUnits[1].index - right.pattern.coverUnits[1].index
    ));

    const xyWingDeductions: MultiStepXYWingDeduction[] = findXYWingPatterns(
        board,
        candidates,
    ).map(pattern => ({
        technique: 'xyWing' as const,
        pattern,
        eliminations: pattern.eliminations.map(cloneCandidateDelta),
    })).sort((left, right) => (
        left.eliminations.length - right.eliminations.length
        || compareCoordinates(left.pattern.pivot, right.pattern.pivot)
        || left.pattern.x - right.pattern.x
        || left.pattern.y - right.pattern.y
        || left.pattern.z - right.pattern.z
        || compareCoordinates(left.pattern.xWing, right.pattern.xWing)
        || compareCoordinates(left.pattern.yWing, right.pattern.yWing)
    ));

    return [
        ...lockedDeductions,
        ...pairDeductions,
        ...hiddenPairDeductions,
        ...tripleDeductions,
        ...xWingDeductions,
        ...xyWingDeductions,
    ];
};

const findCandidateDeductions = (
    board: NumericBoard,
    candidates: CandidateGrid,
): CandidateDeduction[] => {
    const existingDeductions = findMultiStepDeductions(board, candidates);
    const hiddenTripleDeductions: CandidateHiddenTripleDeduction[] = (
        findHiddenTriplePatterns(board, candidates).map(pattern => ({
            technique: 'hiddenTriple' as const,
            pattern,
            eliminations: pattern.eliminations.map(cloneCandidateDelta),
        }))
    );
    const swordfishDeductions: CandidateSwordfishDeduction[] = (
        findSwordfishPatterns(board, candidates).map(pattern => ({
            technique: 'swordfish' as const,
            pattern,
            eliminations: pattern.eliminations.map(cloneCandidateDelta),
        }))
    );
    const coloringDeductions: CandidateColoringDeduction[] = findSimpleColoringPatterns(
        board,
        candidates,
    ).flatMap(pattern => {
        // A single visibly proven removal keeps a color-chain explanation
        // readable even when the same coloring rule has several consequences.
        const prepared = pattern.eliminations.map(elimination => {
            const causalKeys = coloringCausalKeys(pattern, [elimination]);
            return causalKeys && causalKeys.size <= MAX_CANDIDATE_COLOR_CHAIN_CELLS
                ? { elimination, causalKeys }
                : null;
        }).filter((item): item is {
            elimination: HintCandidateDelta;
            causalKeys: Set<string>;
        } => item !== null).sort((left, right) => (
            left.causalKeys.size - right.causalKeys.size
            || compareCoordinates(left.elimination, right.elimination)
        ));
        return prepared[0]
            ? [{
                technique: 'simpleColoring' as const,
                pattern,
                eliminations: [cloneCandidateDelta(prepared[0].elimination)],
            }]
            : [];
    }).sort((left, right) => (
        left.pattern.colorCells.flat().length - right.pattern.colorCells.flat().length
        || left.pattern.links.length - right.pattern.links.length
        || (left.pattern.rule === 'trap' ? 0 : 1) - (right.pattern.rule === 'trap' ? 0 : 1)
        || left.pattern.value - right.pattern.value
        || compareCoordinates(left.eliminations[0], right.eliminations[0])
    ));

    return [
        ...existingDeductions.filter(deduction => (
            deduction.technique === 'lockedCandidate'
            || deduction.technique === 'nakedPair'
            || deduction.technique === 'hiddenPair'
            || deduction.technique === 'nakedTriple'
        )),
        ...hiddenTripleDeductions,
        ...existingDeductions.filter(deduction => deduction.technique === 'xWing'),
        ...swordfishDeductions,
        ...existingDeductions.filter(deduction => deduction.technique === 'xyWing'),
        ...coloringDeductions,
    ];
};

const makeVisibleNoteUpdates = (
    board: Board,
    eliminations: HintCandidateDelta[],
): HintVisibleNoteUpdate[] => {
    const updates = new Map<string, HintVisibleNoteUpdate>();
    for (const elimination of eliminations) {
        const cell = board[elimination.row]?.[elimination.col];
        if (!cell || cell.value !== null) continue;
        const key = coordinateKey(elimination);
        const previous = updates.get(key);
        const beforeNotes = previous?.beforeNotes ?? [...new Set(
            (Array.isArray(cell.notes) ? cell.notes : []).filter(value => (
                Number.isInteger(value) && value >= 1 && value <= 9
            )),
        )].sort((left, right) => left - right);
        const workingNotes = previous?.afterNotes ?? beforeNotes;
        const filteredNotes = workingNotes.filter(value => (
            !elimination.removedValues.includes(value)
        ));
        const afterNotes = workingNotes.length === 0 || filteredNotes.length === 0
            ? [...elimination.afterCandidates]
            : filteredNotes;
        if (
            beforeNotes.length === afterNotes.length
            && beforeNotes.every((value, index) => value === afterNotes[index])
        ) {
            updates.delete(key);
            continue;
        }
        updates.set(key, {
            row: elimination.row,
            col: elimination.col,
            beforeNotes,
            afterNotes: [...afterNotes],
        });
    }
    return [...updates.values()].sort(compareCoordinates);
};

const findPlacementAfterDeduction = (
    board: NumericBoard,
    before: CandidateGrid,
    after: CandidateGrid,
): MultiStepPlacement | null => {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (
                board[row][col] === 0
                && before[row][col].length > 1
                && after[row][col].length === 1
            ) {
                return {
                    resultKind: 'naked',
                    target: { row, col, value: after[row][col][0] },
                    beforeCandidates: [...before[row][col]],
                    afterCandidates: [...after[row][col]],
                };
            }
        }
    }

    const hiddenTarget = findHiddenSingleMatches(board, after)[0];
    if (!hiddenTarget) return null;
    return {
        resultKind: 'hidden',
        target: {
            row: hiddenTarget.row,
            col: hiddenTarget.col,
            value: hiddenTarget.value,
        },
        resultUnit: hiddenTarget.unit,
    };
};

const findMultiStepSearchResult = (
    board: NumericBoard,
    candidates: CandidateGrid,
    options: Required<HintSearchOptions> = {
        maxDeductions: MAX_MULTI_STEP_DEDUCTIONS,
        maxStates: MAX_MULTI_STEP_STATES,
    },
): MultiStepSearchRun => {
    interface SearchState {
        candidates: CandidateGrid;
        deductions: MultiStepDeduction[];
    }

    const queue: SearchState[] = [{
        candidates: cloneCandidateGrid(candidates),
        deductions: [],
    }];
    const visited = new Set([candidateGridSignature(candidates)]);
    let queueIndex = 0;
    let exploredStates = 0;
    let generatedTransitions = 0;
    let maxDepthReached = 0;
    let reachedDepthLimit = false;

    while (queueIndex < queue.length) {
        if (exploredStates >= options.maxStates) {
            return {
                result: null,
                termination: 'state-limit',
                exploredStates,
                visitedStates: visited.size,
                generatedTransitions,
                maxDepthReached,
            };
        }
        const state = queue[queueIndex];
        queueIndex += 1;
        exploredStates += 1;
        maxDepthReached = Math.max(maxDepthReached, state.deductions.length);
        if (state.deductions.length >= options.maxDeductions) {
            reachedDepthLimit = true;
            continue;
        }

        for (const deduction of findMultiStepDeductions(board, state.candidates)) {
            generatedTransitions += 1;
            const nextCandidates = applyCandidateDeltas(state.candidates, deduction.eliminations);
            if (nextCandidates.some((row, rowIndex) => row.some((cell, colIndex) => (
                board[rowIndex][colIndex] === 0 && cell.length === 0
            )))) continue;

            const signature = candidateGridSignature(nextCandidates);
            if (visited.has(signature)) continue;
            visited.add(signature);

            const nextDeductions = [...state.deductions, deduction];
            maxDepthReached = Math.max(maxDepthReached, nextDeductions.length);
            const placement = findPlacementAfterDeduction(
                board,
                state.candidates,
                nextCandidates,
            );
            if (placement) {
                // Existing one-step Hints run before this fallback. Requiring
                // two deductions here keeps their simpler explanations intact.
                if (nextDeductions.length >= 2) {
                    return {
                        result: {
                            deductions: nextDeductions,
                            placement,
                        },
                        termination: 'found',
                        exploredStates,
                        visitedStates: visited.size,
                        generatedTransitions,
                        maxDepthReached,
                    };
                }
                continue;
            }

            if (nextDeductions.length < options.maxDeductions) {
                queue.push({
                    candidates: nextCandidates,
                    deductions: nextDeductions,
                });
            } else {
                reachedDepthLimit = true;
            }
        }
    }

    return {
        result: null,
        termination: reachedDepthLimit ? 'depth-limit' : 'exhausted',
        exploredStates,
        visitedStates: visited.size,
        generatedTransitions,
        maxDepthReached,
    };
};

const formatCandidateValues = (values: number[]) => {
    if (values.length <= 1) return `${values[0] ?? ''}`;
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
};

const candidateDeductionLabel = (deduction: CandidateDeduction) => {
    if (deduction.technique === 'lockedCandidate') return 'Locked candidates';
    if (deduction.technique === 'nakedPair') return 'Naked pair';
    if (deduction.technique === 'hiddenPair') return 'Hidden pair';
    if (deduction.technique === 'nakedTriple') return 'Naked triple';
    if (deduction.technique === 'hiddenTriple') return 'Hidden triple';
    if (deduction.technique === 'xWing') return 'X-Wing';
    if (deduction.technique === 'swordfish') return 'Swordfish';
    if (deduction.technique === 'xyWing') return 'XY-Wing';
    return 'Simple coloring';
};

const candidateDeductionMetadata = (
    deductions: CandidateDeduction[],
): HintDeduction[] => deductions.map((deduction, index) => ({
    id: `candidate-${index + 1}-${deduction.technique}`,
    technique: deduction.technique,
    techniqueLabel: candidateDeductionLabel(deduction),
    candidateEliminations: deduction.eliminations.map(cloneCandidateDelta),
}));

const eliminationNoteSets = (
    eliminations: HintCandidateDelta[],
): HintCandidateNoteSet[] => eliminations.map(elimination => ({
    row: elimination.row,
    col: elimination.col,
    marks: elimination.beforeCandidates.map(value => ({
        value,
        tone: elimination.removedValues.includes(value)
            ? 'removed' as const
            : 'remaining' as const,
    })),
}));

const eliminationMarks = (
    eliminations: HintCandidateDelta[],
): HintCandidateMark[] => eliminations.flatMap(elimination => (
    elimination.removedValues.map(value => ({
        row: elimination.row,
        col: elimination.col,
        value,
        tone: 'eliminated' as const,
    }))
));

const candidateUpdateBody = (eliminations: HintCandidateDelta[]) => {
    const removed = [...new Set(eliminations.flatMap(item => item.removedValues))]
        .sort((left, right) => left - right);
    const places = eliminations.length === 1 ? 'this cell' : 'the outlined cells';
    return `Cross out ${formatCandidateValues(removed)} in ${places}. Oku will update these candidates for you.`;
};

const candidateUpdateBodyParts = (
    eliminations: HintCandidateDelta[],
): HintTextPart[] => {
    const removed = [...new Set(eliminations.flatMap(item => item.removedValues))]
        .sort((left, right) => left - right);
    const places = eliminations.length === 1 ? 'this cell' : 'the outlined cells';
    return [
        { text: 'Cross out ' },
        ...candidateValueParts(removed, 'removed'),
        { text: ` in ${places}. ` },
        { text: 'Oku will update these candidates for you.', tone: 'secondary' },
    ];
};

const makeCandidateDeductionPlan = (
    candidates: CandidateGrid,
    deduction: CandidateDeduction,
    appliedDeductions: CandidateDeduction[],
    noteUpdates: HintVisibleNoteUpdate[],
): HintCandidatePlan | null => {
    const label = candidateDeductionLabel(deduction);
    const eliminations = deduction.eliminations.map(cloneCandidateDelta);
    const allEliminations = appliedDeductions.flatMap(item => (
        item.eliminations.map(cloneCandidateDelta)
    ));
    const removedNoteSets = eliminationNoteSets(eliminations);
    const removedMarks = eliminationMarks(eliminations);
    const removalCells = eliminations.map(({ row, col }) => ({ row, col }));
    let frames: HintVisualFrame[];

    if (deduction.technique === 'lockedCandidate') {
        const { pattern } = deduction;
        const sourceName = unitName(pattern.sourceUnit);
        const intersectingName = unitName(pattern.intersectingUnit);
        const lockedMarks: HintCandidateMark[] = pattern.lockedCells.map(cell => ({
            ...cell,
            value: pattern.value,
            tone: 'locked',
        }));
        frames = [
            {
                id: 'candidate-locked-find',
                techniqueLabel: label,
                title: `Only ${pattern.lockedCells.length} places for ${pattern.value}`,
                body: `In this ${sourceName}, ${pattern.value} can only go in these cells.`,
                titleParts: [
                    { text: `Only ${pattern.lockedCells.length} places for ` },
                    candidateValuePart(pattern.value),
                ],
                bodyParts: [
                    { text: `In this ${sourceName}, ` },
                    candidateValuePart(pattern.value),
                    { text: ' can only go in these cells.' },
                ],
                accessibleDetail: `Candidate ${pattern.value} can only go at ${describeCoordinates(pattern.lockedCells)} in this ${sourceName}.`,
                spotlightCells: pattern.lockedCells,
                unitCells: pattern.sourceUnit.cells,
                candidateMarks: lockedMarks,
                dimUnrelated: true,
            },
            {
                id: 'candidate-locked-update',
                techniqueLabel: label,
                title: `Remove ${pattern.value} from this ${intersectingName}`,
                body: candidateUpdateBody(eliminations),
                titleParts: [
                    { text: 'Remove ' },
                    candidateValuePart(pattern.value, 'removed'),
                    { text: ` from this ${intersectingName}` },
                ],
                bodyParts: candidateUpdateBodyParts(eliminations),
                accessibleDetail: `Because every possible ${pattern.value} in the ${sourceName} lies in this ${intersectingName}, remove ${pattern.value} from ${describeCoordinates(eliminations)}.`,
                spotlightCells: removalCells,
                contextCells: pattern.sourceUnit.cells,
                guideUnits: [{
                    kind: pattern.intersectingUnit.kind,
                    index: pattern.intersectingUnit.index,
                }],
                guideStrokeTone: 'normal',
                candidateMarks: [...lockedMarks, ...removedMarks],
                candidateNoteSets: removedNoteSets,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else if (deduction.technique === 'nakedPair') {
        const { pattern } = deduction;
        const pairLabel = formatCandidateValues(pattern.pairValues);
        const pairNoteSets: HintCandidateNoteSet[] = pattern.pairCells.map(cell => ({
            ...cell,
            marks: pattern.pairValues.map(value => ({ value, tone: 'locked' as const })),
        }));
        frames = [
            {
                id: 'candidate-pair-find',
                techniqueLabel: label,
                title: 'These cells share two choices',
                body: `They must contain ${pairLabel}, in either order.`,
                bodyParts: [
                    { text: 'They must contain ' },
                    ...candidateValueParts(pattern.pairValues),
                    { text: ', in either order.' },
                ],
                accessibleDetail: `${describeCoordinates(pattern.pairCells)} contain only candidates ${pairLabel} in this ${unitName(pattern.unit)}.`,
                spotlightCells: pattern.pairCells,
                unitCells: pattern.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: pairNoteSets,
                dimUnrelated: true,
            },
            {
                id: 'candidate-pair-update',
                techniqueLabel: label,
                title: `The pair reserves ${pairLabel}`,
                body: candidateUpdateBody(eliminations),
                titleParts: [
                    { text: 'The pair reserves ' },
                    ...candidateValueParts(pattern.pairValues),
                ],
                bodyParts: candidateUpdateBodyParts(eliminations),
                accessibleDetail: `The naked pair removes ${pairLabel} from ${describeCoordinates(eliminations)} in the same ${unitName(pattern.unit)}.`,
                spotlightCells: removalCells,
                guideUnits: [{ kind: pattern.unit.kind, index: pattern.unit.index }],
                guideStrokeTone: 'normal',
                candidateNoteSets: [...pairNoteSets, ...removedNoteSets],
                candidateMarks: removedMarks,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else if (deduction.technique === 'hiddenPair') {
        const { pattern } = deduction;
        const pairLabel = formatCandidateValues(pattern.pairValues);
        const beforeNoteSets: HintCandidateNoteSet[] = pattern.pairCells.map(cell => ({
            ...cell,
            marks: candidates[cell.row][cell.col].map(value => ({
                value,
                tone: pattern.pairValues.includes(value)
                    ? 'locked' as const
                    : 'possible' as const,
            })),
        }));
        frames = [
            {
                id: 'candidate-hidden-pair-find',
                techniqueLabel: label,
                title: `${pairLabel} have only two places`,
                body: `In this ${unitName(pattern.unit)}, both numbers must use these two cells.`,
                titleParts: [
                    ...candidateValueParts(pattern.pairValues),
                    { text: ' have only two places' },
                ],
                accessibleDetail: `Candidates ${pairLabel} occur only at ${describeCoordinates(pattern.pairCells)} in this ${unitName(pattern.unit)}.`,
                spotlightCells: pattern.pairCells,
                unitCells: pattern.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: beforeNoteSets,
                dimUnrelated: true,
            },
            {
                id: 'candidate-hidden-pair-update',
                techniqueLabel: label,
                title: `Keep only ${pairLabel} here`,
                body: candidateUpdateBody(eliminations),
                titleParts: [
                    { text: 'Keep only ' },
                    ...candidateValueParts(pattern.pairValues, 'remaining'),
                    { text: ' here' },
                ],
                bodyParts: candidateUpdateBodyParts(eliminations),
                accessibleDetail: `Because these two cells are reserved for ${pairLabel}, remove the other candidates from ${describeCoordinates(eliminations)}.`,
                spotlightCells: pattern.pairCells,
                unitCells: pattern.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: removedNoteSets,
                candidateMarks: removedMarks,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else if (deduction.technique === 'hiddenTriple') {
        const { pattern } = deduction;
        const tripleLabel = formatCandidateValues(pattern.tripleValues);
        const beforeNoteSets: HintCandidateNoteSet[] = pattern.tripleCells.map(cell => ({
            ...cell,
            marks: candidates[cell.row][cell.col].map(value => ({
                value,
                tone: pattern.tripleValues.includes(value)
                    ? 'locked' as const
                    : 'possible' as const,
            })),
        }));
        frames = [
            {
                id: 'candidate-hidden-triple-find',
                techniqueLabel: label,
                title: `${tripleLabel} have only three places`,
                body: `In this ${unitName(pattern.unit)}, all three numbers must use these cells.`,
                titleParts: [
                    ...candidateValueParts(pattern.tripleValues),
                    { text: ' have only three places' },
                ],
                accessibleDetail: `Candidates ${tripleLabel} occur only at ${describeCoordinates(pattern.tripleCells)} in this ${unitName(pattern.unit)}.`,
                spotlightCells: pattern.tripleCells,
                unitCells: pattern.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: beforeNoteSets,
                dimUnrelated: true,
            },
            {
                id: 'candidate-hidden-triple-update',
                techniqueLabel: label,
                title: `Keep only ${tripleLabel} here`,
                body: candidateUpdateBody(eliminations),
                titleParts: [
                    { text: 'Keep only ' },
                    ...candidateValueParts(pattern.tripleValues, 'remaining'),
                    { text: ' here' },
                ],
                bodyParts: candidateUpdateBodyParts(eliminations),
                accessibleDetail: `Because these three cells are reserved for ${tripleLabel}, remove the other candidates from ${describeCoordinates(eliminations)}.`,
                spotlightCells: pattern.tripleCells,
                unitCells: pattern.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: removedNoteSets,
                candidateMarks: removedMarks,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else if (deduction.technique === 'nakedTriple') {
        const { pattern } = deduction;
        const tripleLabel = formatCandidateValues(pattern.tripleValues);
        const tripleNoteSets: HintCandidateNoteSet[] = pattern.tripleCells.map((cell, index) => ({
            ...cell,
            marks: pattern.tripleCandidates[index].map(value => ({
                value,
                tone: 'locked' as const,
            })),
        }));
        frames = [
            {
                id: 'candidate-triple-find',
                techniqueLabel: label,
                title: 'These three cells share three choices',
                body: `Together, they must contain ${tripleLabel}, in some order.`,
                bodyParts: [
                    { text: 'Together, they must contain ' },
                    ...candidateValueParts(pattern.tripleValues),
                    { text: ', in some order.' },
                ],
                accessibleDetail: `${describeCoordinates(pattern.tripleCells)} share only ${tripleLabel} in this ${unitName(pattern.unit)}.`,
                spotlightCells: pattern.tripleCells,
                unitCells: pattern.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: tripleNoteSets,
                dimUnrelated: true,
            },
            {
                id: 'candidate-triple-update',
                techniqueLabel: label,
                title: `The triple reserves ${tripleLabel}`,
                body: candidateUpdateBody(eliminations),
                titleParts: [
                    { text: 'The triple reserves ' },
                    ...candidateValueParts(pattern.tripleValues),
                ],
                bodyParts: candidateUpdateBodyParts(eliminations),
                accessibleDetail: `The naked triple removes ${formatCandidateValues([...new Set(eliminations.flatMap(item => item.removedValues))].sort((a, b) => a - b))} from ${describeCoordinates(eliminations)}.`,
                spotlightCells: removalCells,
                guideUnits: [{ kind: pattern.unit.kind, index: pattern.unit.index }],
                guideStrokeTone: 'normal',
                candidateNoteSets: [...tripleNoteSets, ...removedNoteSets],
                candidateMarks: removedMarks,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else if (deduction.technique === 'xWing') {
        const { pattern } = deduction;
        const baseName = pattern.orientation === 'row' ? 'rows' : 'columns';
        const coverName = pattern.orientation === 'row' ? 'columns' : 'rows';
        const cornerMarks: HintCandidateMark[] = pattern.cornerCells.map(cell => ({
            ...cell,
            value: pattern.value,
            tone: 'locked',
        }));
        frames = [
            {
                id: 'candidate-x-wing-find',
                techniqueLabel: label,
                title: `Look at the possible ${pattern.value}s`,
                body: `In both ${baseName}, ${pattern.value} can only go in the same two ${coverName}.`,
                titleParts: [
                    { text: 'Look at the possible ' },
                    candidateValuePart(pattern.value),
                    { text: 's' },
                ],
                bodyParts: [
                    { text: `In both ${baseName}, ` },
                    candidateValuePart(pattern.value),
                    { text: ` can only go in the same two ${coverName}.` },
                ],
                accessibleDetail: `Candidate ${pattern.value} appears only at ${describeCoordinates(pattern.cornerCells)} in these two ${baseName}.`,
                spotlightCells: pattern.cornerCells,
                guideUnits: pattern.baseUnits.map(unit => ({ kind: unit.kind, index: unit.index })),
                guideStrokeTone: 'normal',
                candidateMarks: cornerMarks,
                dimUnrelated: true,
            },
            {
                id: 'candidate-x-wing-update',
                techniqueLabel: label,
                title: `Remove ${pattern.value} from these ${coverName}`,
                body: candidateUpdateBody(eliminations),
                titleParts: [
                    { text: 'Remove ' },
                    candidateValuePart(pattern.value, 'removed'),
                    { text: ` from these ${coverName}` },
                ],
                bodyParts: candidateUpdateBodyParts(eliminations),
                accessibleDetail: `The four corners force ${pattern.value} into both highlighted ${coverName}, so remove it from ${describeCoordinates(eliminations)}.`,
                spotlightCells: removalCells,
                contextCells: pattern.baseUnits.flatMap(unit => unit.cells),
                guideUnits: pattern.coverUnits.map(unit => ({ kind: unit.kind, index: unit.index })),
                guideStrokeTone: 'normal',
                candidateMarks: [...cornerMarks, ...removedMarks],
                candidateNoteSets: removedNoteSets,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else if (deduction.technique === 'swordfish') {
        const { pattern } = deduction;
        const baseName = pattern.orientation === 'row' ? 'rows' : 'columns';
        const baseSingular = pattern.orientation === 'row' ? 'row' : 'column';
        const coverName = pattern.orientation === 'row' ? 'columns' : 'rows';
        const coverSingular = pattern.orientation === 'row' ? 'column' : 'row';
        const baseIndexes = formatCandidateValues(pattern.baseUnits.map(unit => unit.index + 1));
        const coverIndexes = formatCandidateValues(pattern.coverUnits.map(unit => unit.index + 1));
        const capitalizedBaseName = `${baseName[0].toUpperCase()}${baseName.slice(1)}`;
        const sourceMarks: HintCandidateMark[] = pattern.sourceCells.map(cell => ({
            ...cell,
            value: pattern.value,
            tone: 'locked',
        }));
        frames = [
            {
                id: 'candidate-swordfish-find',
                techniqueLabel: label,
                title: `${pattern.value} is limited to three ${coverName}`,
                body: `In each outlined ${baseSingular}, ${pattern.value} can only go in these same three ${coverName}.`,
                titleParts: [
                    candidateValuePart(pattern.value),
                    { text: ` is limited to three ${coverName}` },
                ],
                bodyParts: [
                    { text: `In each outlined ${baseSingular}, ` },
                    candidateValuePart(pattern.value),
                    { text: ` can only go in these same three ${coverName}.` },
                ],
                accessibleDetail: `In ${baseName} ${baseIndexes}, candidate ${pattern.value} appears only at ${describeCoordinates(pattern.sourceCells)}, all within ${coverName} ${coverIndexes}.`,
                spotlightCells: pattern.sourceCells,
                guideUnits: pattern.baseUnits.map(unit => ({
                    kind: unit.kind,
                    index: unit.index,
                })),
                guideStrokeTone: 'normal',
                candidateMarks: sourceMarks,
                dimUnrelated: true,
            },
            {
                id: 'candidate-swordfish-reserve',
                techniqueLabel: label,
                title: `One ${pattern.value} must land in each ${coverSingular}`,
                body: `The three ${baseName} need three ${pattern.value}s. A ${coverSingular} can hold only one, so all three ${coverName} are used.`,
                titleParts: [
                    { text: 'One ' },
                    candidateValuePart(pattern.value),
                    { text: ` must land in each ${coverSingular}` },
                ],
                bodyParts: [
                    { text: `The three ${baseName} need three ` },
                    candidateValuePart(pattern.value),
                    { text: `s. A ${coverSingular} can hold only one, so all three ${coverName} are used.` },
                ],
                accessibleDetail: `${capitalizedBaseName} ${baseIndexes} each require one ${pattern.value}. Because a ${coverSingular} cannot contain two ${pattern.value}s, the placements occupy ${coverName} ${coverIndexes}, one per ${coverSingular}.`,
                spotlightCells: [],
                guideUnits: pattern.coverUnits.map(unit => ({
                    kind: unit.kind,
                    index: unit.index,
                })),
                guideStrokeTone: 'support',
                candidateMarks: sourceMarks,
                dimUnrelated: true,
            },
            {
                id: 'candidate-swordfish-update',
                techniqueLabel: label,
                title: `Cross out the other ${pattern.value} candidates`,
                body: `In these ${coverName}, any ${pattern.value} outside the source ${baseName} is impossible. Oku will update the outlined cells.`,
                titleParts: [
                    { text: 'Cross out the other ' },
                    candidateValuePart(pattern.value, 'removed'),
                    { text: ' candidates' },
                ],
                bodyParts: [
                    { text: `In these ${coverName}, any ` },
                    candidateValuePart(pattern.value, 'removed'),
                    { text: ` outside the source ${baseName} is impossible. ` },
                    { text: 'Oku will update the outlined cells.', tone: 'secondary' },
                ],
                accessibleDetail: `Remove candidate ${pattern.value} from ${describeCoordinates(eliminations)}. These cells are in ${coverName} ${coverIndexes}, but outside the source ${baseName} ${baseIndexes}.`,
                spotlightCells: removalCells,
                guideUnits: pattern.coverUnits.map(unit => ({
                    kind: unit.kind,
                    index: unit.index,
                })),
                guideStrokeTone: 'soft',
                candidateMarks: [...sourceMarks, ...removedMarks],
                candidateNoteSets: removedNoteSets,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else if (deduction.technique === 'xyWing') {
        const { pattern } = deduction;
        const firstUnit = sharedPeerUnit(pattern.pivot, pattern.xWing);
        const secondUnit = sharedPeerUnit(pattern.pivot, pattern.yWing);
        const pivotNotes = makeXYWingNoteSet(
            pattern.pivot,
            [pattern.x, pattern.y],
            [pattern.x, pattern.y],
        );
        const firstPivotNotes = makeXYWingNoteSet(
            pattern.pivot,
            [pattern.x, pattern.y],
            [pattern.x, pattern.y],
        );
        const firstNotes = makeXYWingNoteSet(
            pattern.xWing,
            [pattern.x, pattern.z],
            [pattern.x],
            [pattern.z],
        );
        const secondPivotNotes = makeXYWingNoteSet(
            pattern.pivot,
            [pattern.x, pattern.y],
            [pattern.x, pattern.y],
        );
        const secondNotes = makeXYWingNoteSet(
            pattern.yWing,
            [pattern.y, pattern.z],
            [pattern.y],
            [pattern.z],
        );
        const updatePivotNotes = makeXYWingNoteSet(
            pattern.pivot,
            [pattern.x, pattern.y],
            [pattern.x, pattern.y],
        );
        const updateFirstNotes = makeXYWingNoteSet(
            pattern.xWing,
            [pattern.x, pattern.z],
            [pattern.x],
            [pattern.z],
        );
        const updateSecondNotes = makeXYWingNoteSet(
            pattern.yWing,
            [pattern.y, pattern.z],
            [pattern.y],
            [pattern.z],
        );
        const removalGuides = uniqueGuideUnits(eliminations.flatMap(elimination => [
            sharedPeerUnit(elimination, pattern.xWing),
            sharedPeerUnit(elimination, pattern.yWing),
        ]));
        frames = [
            {
                id: 'candidate-xy-wing-pivot',
                techniqueLabel: label,
                title: `This cell is ${pattern.x} or ${pattern.y}`,
                body: "We don't know which one yet.",
                titleParts: [
                    { text: 'This cell is ' },
                    candidateValuePart(pattern.x),
                    { text: ' or ' },
                    candidateValuePart(pattern.y),
                ],
                accessibleDetail: `The pivot at ${describeCoordinate(pattern.pivot)} has candidates ${pattern.x} and ${pattern.y}.`,
                spotlightCells: [pattern.pivot],
                candidateNoteSets: [pivotNotes],
                dimUnrelated: true,
            },
            {
                id: 'candidate-xy-wing-first',
                techniqueLabel: label,
                title: `This wing is ${pattern.x} or ${pattern.z}`,
                body: `It shares ${pattern.x} with the pivot through this ${unitName(firstUnit)}.`,
                titleParts: [
                    { text: 'This wing is ' },
                    candidateValuePart(pattern.x),
                    { text: ' or ' },
                    candidateValuePart(pattern.z, 'support'),
                ],
                bodyParts: [
                    { text: 'It shares ' },
                    candidateValuePart(pattern.x),
                    { text: ` with the pivot through this ${unitName(firstUnit)}.` },
                ],
                accessibleDetail: `The first wing at ${describeCoordinate(pattern.xWing)} shares candidate ${pattern.x} with the pivot.`,
                spotlightCells: [pattern.pivot, pattern.xWing],
                guideUnits: [{ kind: firstUnit.kind, index: firstUnit.index }],
                guideStrokeTone: 'normal',
                candidateNoteSets: [firstPivotNotes, firstNotes],
                dimUnrelated: true,
            },
            {
                id: 'candidate-xy-wing-second',
                techniqueLabel: label,
                title: `The other wing is ${pattern.y} or ${pattern.z}`,
                body: `It shares ${pattern.y} with the pivot through this ${unitName(secondUnit)}.`,
                titleParts: [
                    { text: 'The other wing is ' },
                    candidateValuePart(pattern.y),
                    { text: ' or ' },
                    candidateValuePart(pattern.z, 'support'),
                ],
                bodyParts: [
                    { text: 'It shares ' },
                    candidateValuePart(pattern.y),
                    { text: ` with the pivot through this ${unitName(secondUnit)}.` },
                ],
                accessibleDetail: `The second wing at ${describeCoordinate(pattern.yWing)} shares candidate ${pattern.y} with the pivot.`,
                spotlightCells: [pattern.pivot, pattern.yWing],
                guideUnits: [{ kind: secondUnit.kind, index: secondUnit.index }],
                guideStrokeTone: 'normal',
                candidateNoteSets: [secondPivotNotes, secondNotes],
                dimUnrelated: true,
            },
            {
                id: 'candidate-xy-wing-update',
                techniqueLabel: label,
                title: `Either way, one wing must be ${pattern.z}`,
                body: candidateUpdateBody(eliminations),
                titleParts: [
                    { text: 'Either way, one wing must be ' },
                    candidateValuePart(pattern.z, 'support'),
                ],
                bodyParts: candidateUpdateBodyParts(eliminations),
                accessibleDetail: `Every outlined cell sees both wings, so candidate ${pattern.z} can be removed from ${describeCoordinates(eliminations)}.`,
                spotlightCells: removalCells,
                sourceCells: [pattern.xWing, pattern.yWing],
                guideUnits: removalGuides,
                guideStrokeTone: 'normal',
                candidateNoteSets: [
                    updatePivotNotes,
                    updateFirstNotes,
                    updateSecondNotes,
                    ...removedNoteSets,
                ],
                candidateMarks: removedMarks,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    } else {
        const { pattern } = deduction;
        const causalKeys = coloringCausalKeys(pattern, eliminations);
        if (!causalKeys || causalKeys.size > MAX_CANDIDATE_COLOR_CHAIN_CELLS) return null;
        const rawColors = pattern.colorCells.map(cells => (
            cells.filter(cell => causalKeys.has(coordinateKey(cell)))
        )) as [HintCoordinate[], HintCoordinate[]];
        const conflictColor = pattern.rule === 'wrap' && pattern.conflictCells
            ? pattern.colorCells[0].some(cell => (
                coordinateKey(cell) === coordinateKey(pattern.conflictCells![0])
            )) ? 0 : 1
            : null;
        const colorCells: [HintCoordinate[], HintCoordinate[]] = conflictColor === 0
            ? [rawColors[1], rawColors[0]]
            : rawColors;
        const circleKeys = new Set(colorCells[0].map(coordinateKey));
        const coloredMark = (cell: HintCoordinate): HintCandidateMark => ({
            ...cell,
            value: pattern.value,
            tone: circleKeys.has(coordinateKey(cell)) ? 'locked' : 'possible',
        });
        const coloredMarks = colorCells.flatMap(cells => cells.map(coloredMark));
        const causalLinks = pattern.links.filter(link => (
            causalKeys.has(coordinateKey(link.first))
            && causalKeys.has(coordinateKey(link.second))
        ));
        const startLink = causalLinks[0];
        if (!startLink) return null;
        const focus = eliminations[0];
        const ruleGuides = pattern.rule === 'wrap' && pattern.conflictCells
            ? [sharedPeerUnit(pattern.conflictCells[0], pattern.conflictCells[1])]
            : (() => {
                const witnesses = coloringTrapWitnesses(pattern, focus);
                return witnesses ? [
                    sharedPeerUnit(focus, witnesses.first),
                    sharedPeerUnit(focus, witnesses.second),
                ] : [];
            })();
        frames = [
            {
                id: 'candidate-color-start',
                techniqueLabel: label,
                title: `Only two places for ${pattern.value}`,
                body: `One must be ${pattern.value}. We mark one with a circle and one with a square.`,
                titleParts: [
                    { text: 'Only two places for ' },
                    candidateValuePart(pattern.value, 'candidate'),
                ],
                bodyParts: [
                    { text: 'One must be ' },
                    candidateValuePart(pattern.value, 'candidate'),
                    { text: '. We mark one with a ' },
                    { text: 'circle', tone: 'source', emphasis: true },
                    { text: ' and one with a ' },
                    { text: 'square', tone: 'support', emphasis: true },
                    { text: '.' },
                ],
                accessibleDetail: `This ${unitName(startLink.unit)} has exactly two places for ${pattern.value}: ${describeCoordinate(startLink.first)} and ${describeCoordinate(startLink.second)}.`,
                spotlightCells: [],
                guideUnits: [{ kind: startLink.unit.kind, index: startLink.unit.index }],
                guideStrokeTone: 'normal',
                candidateMarks: [coloredMark(startLink.first), coloredMark(startLink.second)],
                dimUnrelated: true,
            },
            {
                id: 'candidate-color-chain',
                techniqueLabel: label,
                title: 'Follow the alternating chain',
                body: `The possible ${pattern.value}s alternate between circles and squares.`,
                bodyParts: [
                    { text: 'The possible ' },
                    candidateValuePart(pattern.value, 'candidate'),
                    { text: 's alternate between ' },
                    { text: 'circles', tone: 'source', emphasis: true },
                    { text: ' and ' },
                    { text: 'squares', tone: 'support', emphasis: true },
                    { text: '.' },
                ],
                accessibleDetail: `The relevant chain alternates through ${describeCoordinates(colorCells.flat())}.`,
                spotlightCells: [],
                candidateMarks: coloredMarks,
                dimUnrelated: true,
            },
            {
                id: 'candidate-color-rule',
                techniqueLabel: label,
                title: pattern.rule === 'trap'
                    ? `This ${pattern.value} sees both groups`
                    : `Two square ${pattern.value}s see each other`,
                body: pattern.rule === 'trap'
                    ? 'One circle or square group must be true, so this outside candidate is false.'
                    : `Both cannot be true, so every square ${pattern.value} is false.`,
                titleParts: pattern.rule === 'trap'
                    ? [
                        { text: 'This ' },
                        candidateValuePart(pattern.value, 'candidate'),
                        { text: ' sees both groups' },
                    ]
                    : [
                        { text: 'Two ' },
                        { text: 'square ', tone: 'support', emphasis: true },
                        candidateValuePart(pattern.value, 'support'),
                        { text: 's see each other' },
                    ],
                bodyParts: pattern.rule === 'trap'
                    ? [
                        { text: 'One ' },
                        { text: 'circle', tone: 'source', emphasis: true },
                        { text: ' or ' },
                        { text: 'square', tone: 'support', emphasis: true },
                        { text: ' group must be true, so this outside candidate is false.' },
                    ]
                    : [
                        { text: 'Both cannot be true, so every ' },
                        { text: 'square ', tone: 'support', emphasis: true },
                        candidateValuePart(pattern.value, 'support'),
                        { text: ' is false.' },
                    ],
                accessibleDetail: pattern.rule === 'trap'
                    ? `The ${pattern.value} at ${describeCoordinate(focus)} sees one circle and one square. One group must be true, so this candidate is false.`
                    : `The two conflicting square ${pattern.value}s at ${describeCoordinates(pattern.conflictCells ?? [])} see each other, so the square group is false.`,
                spotlightCells: pattern.rule === 'trap'
                    ? removalCells
                    : pattern.conflictCells ?? [],
                guideUnits: uniqueGuideUnits(ruleGuides),
                guideStrokeTone: 'normal',
                candidateMarks: coloredMarks,
                candidateNoteSets: pattern.rule === 'trap'
                    ? [{
                        row: focus.row,
                        col: focus.col,
                        marks: [{ value: pattern.value, tone: 'possible' }],
                    }]
                    : undefined,
                dimUnrelated: true,
            },
            {
                id: 'candidate-color-update',
                techniqueLabel: label,
                title: `Cross out ${pattern.value}`,
                body: `Remove it from the outlined cell. Oku will update these candidates for you.`,
                titleParts: [
                    { text: 'Cross out ' },
                    candidateValuePart(pattern.value, 'removed'),
                ],
                bodyParts: [
                    { text: 'Remove it from the outlined cell. ' },
                    { text: 'Oku will update these candidates for you.', tone: 'secondary' },
                ],
                accessibleDetail: `The color-chain proof removes ${pattern.value} from ${describeCoordinates(eliminations)}.`,
                spotlightCells: removalCells,
                candidateMarks: removedMarks,
                candidateNoteSets: removedNoteSets,
                candidateUpdateCells: removalCells,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        ];
    }

    return {
        outcome: 'candidate',
        technique: deduction.technique,
        techniqueLabel: label,
        candidateEliminations: allEliminations,
        noteUpdates,
        deductions: candidateDeductionMetadata(appliedDeductions),
        frames,
    };
};

const isApplicableCandidateDeduction = (
    board: NumericBoard,
    solvedBoard: number[][],
    candidates: CandidateGrid,
    deduction: CandidateDeduction,
) => {
    if (deduction.eliminations.length === 0) return false;
    for (const elimination of deduction.eliminations) {
        if (
            elimination.row < 0
            || elimination.row >= 9
            || elimination.col < 0
            || elimination.col >= 9
            || board[elimination.row][elimination.col] !== 0
        ) return false;
        const before = candidates[elimination.row][elimination.col];
        if (
            before.length !== elimination.beforeCandidates.length
            || !before.every((value, index) => value === elimination.beforeCandidates[index])
        ) return false;
        const removedValues = [...new Set(elimination.removedValues)]
            .sort((left, right) => left - right);
        if (
            removedValues.length === 0
            || removedValues.some(value => !before.includes(value))
            || removedValues.includes(solvedBoard[elimination.row][elimination.col])
        ) return false;
        const expectedAfter = before.filter(value => !removedValues.includes(value));
        if (
            expectedAfter.length === 0
            || expectedAfter.length !== elimination.afterCandidates.length
            || !expectedAfter.every((value, index) => value === elimination.afterCandidates[index])
        ) return false;
    }
    return hasSafeCandidateGrid(
        board,
        solvedBoard,
        applyCandidateDeltas(candidates, deduction.eliminations),
    );
};

const makeCandidateProgressPlan = (
    board: Board,
    numericBoard: NumericBoard,
    solvedBoard: number[][],
    initialCandidates: CandidateGrid,
    preferredTechnique?: HintPlanOptions['preferredTechnique'],
): HintPlan | null => {
    let candidates = cloneCandidateGrid(initialCandidates);
    const appliedDeductions: CandidateDeduction[] = [];
    const visited = new Set([candidateGridSignature(candidates)]);

    // This is not a speculative search. It only carries deterministic, safe
    // deductions that would otherwise make no visible change to player notes.
    for (let step = 0; step < 32; step += 1) {
        if (appliedDeductions.length > 0) {
            const placement = makeNakedSinglePlan(numericBoard, candidates)
                ?? makeHiddenSinglePlan(numericBoard, candidates);
            if (placement?.outcome === 'placement') {
                return {
                    ...placement,
                    candidateEliminations: appliedDeductions.flatMap(deduction => (
                        deduction.eliminations.map(cloneCandidateDelta)
                    )),
                    deductions: candidateDeductionMetadata(appliedDeductions),
                };
            }
        }

        const deductions = findCandidateDeductions(numericBoard, candidates)
            .filter(deduction => isApplicableCandidateDeduction(
                numericBoard,
                solvedBoard,
                candidates,
                deduction,
            ));
        const eligibleDeductions = preferredTechnique
            ? deductions.filter(deduction => deduction.technique === preferredTechnique)
            : deductions;
        if (eligibleDeductions.length === 0) return null;

        for (const deduction of eligibleDeductions) {
            const noteUpdates = makeVisibleNoteUpdates(board, deduction.eliminations);
            if (noteUpdates.length === 0) continue;
            return makeCandidateDeductionPlan(
                candidates,
                deduction,
                [...appliedDeductions, deduction],
                noteUpdates,
            );
        }

        const carried = eligibleDeductions[0];
        appliedDeductions.push(carried);
        candidates = applyCandidateDeltas(candidates, carried.eliminations);
        const signature = candidateGridSignature(candidates);
        if (visited.has(signature)) return null;
        visited.add(signature);
    }
    return null;
};

/**
 * Atomically validate and apply the solver deductions carried by a candidate
 * Hint. A stale/tampered plan returns null and never partially mutates state.
 */
export const applyHintCandidateProgress = (
    board: Board,
    solvedBoard: number[][],
    progress: HintCandidateProgress | null | undefined,
    plan: HintPlan,
): HintCandidateProgress | null => {
    if (
        !plan.candidateEliminations
        || plan.candidateEliminations.length === 0
        || (plan.outcome === 'candidate' && plan.noteUpdates.length === 0)
        || !isNineByNine(board)
        || !board.every(row => row.every(isValidCell))
        || !isNineByNine(solvedBoard)
        || !isValidSolution(solvedBoard)
    ) return null;

    if (plan.outcome === 'candidate') {
        const expectedUpdates = makeVisibleNoteUpdates(board, plan.candidateEliminations);
        if (
            expectedUpdates.length !== plan.noteUpdates.length
            || expectedUpdates.some((expected, index) => {
                const actual = plan.noteUpdates[index];
                return (
                    !actual
                    || actual.row !== expected.row
                    || actual.col !== expected.col
                    || actual.beforeNotes.length !== expected.beforeNotes.length
                    || !actual.beforeNotes.every((value, noteIndex) => (
                        value === expected.beforeNotes[noteIndex]
                    ))
                    || actual.afterNotes.length !== expected.afterNotes.length
                    || !actual.afterNotes.every((value, noteIndex) => (
                        value === expected.afterNotes[noteIndex]
                    ))
                );
            })
        ) return null;
    }

    const numericBoard = toNumericBoard(board);
    const reconciled = reconcileHintCandidateProgress(board, solvedBoard, progress);
    let candidates = candidateGridFromProgress(numericBoard, reconciled);
    const newExclusions: HintCandidateExclusion[] = [];

    for (const elimination of plan.candidateEliminations) {
        if (
            !Number.isInteger(elimination.row)
            || elimination.row < 0
            || elimination.row >= 9
            || !Number.isInteger(elimination.col)
            || elimination.col < 0
            || elimination.col >= 9
            || numericBoard[elimination.row][elimination.col] !== 0
        ) return null;
        const before = candidates[elimination.row][elimination.col];
        if (
            before.length !== elimination.beforeCandidates.length
            || !before.every((value, index) => value === elimination.beforeCandidates[index])
        ) return null;
        const removedValues = [...new Set(elimination.removedValues)]
            .sort((left, right) => left - right);
        if (
            removedValues.length === 0
            || removedValues.some(value => !before.includes(value))
            || removedValues.includes(solvedBoard[elimination.row][elimination.col])
        ) return null;
        const expectedAfter = before.filter(value => !removedValues.includes(value));
        if (
            expectedAfter.length === 0
            || expectedAfter.length !== elimination.afterCandidates.length
            || !expectedAfter.every((value, index) => value === elimination.afterCandidates[index])
        ) return null;
        candidates = applyCandidateDeltas(candidates, [{
            ...elimination,
            beforeCandidates: [...before],
            removedValues,
            afterCandidates: expectedAfter,
        }]);
        removedValues.forEach(value => newExclusions.push({
            row: elimination.row,
            col: elimination.col,
            value,
        }));
    }

    if (!hasSafeCandidateGrid(numericBoard, solvedBoard, candidates)) return null;
    return makeHintCandidateProgress(
        numericBoardSignature(numericBoard),
        [
            ...reconciled.exclusions,
            ...newExclusions,
        ],
    );
};

/** Candidate-plan convenience wrapper for the common UI integration path. */
export const applyHintCandidatePlan = (
    board: Board,
    solvedBoard: number[][],
    progress: HintCandidateProgress | null | undefined,
    plan: HintCandidatePlan,
) => applyHintCandidateProgress(board, solvedBoard, progress, plan);

const multiStepDeductionSourceCells = (
    deduction: MultiStepDeduction,
): HintCoordinate[] => {
    if (deduction.technique === 'lockedCandidate') {
        return deduction.pattern.sourceUnit.cells;
    }
    if (deduction.technique === 'nakedPair' || deduction.technique === 'hiddenPair') {
        return deduction.pattern.pairCells;
    }
    if (deduction.technique === 'nakedTriple') {
        return deduction.pattern.tripleCells;
    }
    if (deduction.technique === 'xWing') {
        return deduction.pattern.baseUnits.flatMap(unit => unit.cells);
    }
    return [deduction.pattern.pivot, deduction.pattern.xWing, deduction.pattern.yWing];
};

const multiStepDeductionFocusValue = (
    deduction: MultiStepDeduction,
): number | null => (
    deduction.technique === 'lockedCandidate' || deduction.technique === 'xWing'
        ? deduction.pattern.value
        : deduction.technique === 'xyWing'
            ? deduction.pattern.z
        : null
);

const makeMultiStepPlan = (
    board: NumericBoard,
    candidates: CandidateGrid,
): HintPlan | null => {
    const result = findMultiStepSearchResult(board, candidates).result;
    if (!result) return null;

    const frames: HintVisualFrame[] = [];
    result.deductions.forEach((deduction, index) => {
        const stepNumber = index + 1;
        const isFinalDeduction = index === result.deductions.length - 1;

        if (deduction.technique === 'lockedCandidate') {
            const { pattern, eliminations } = deduction;
            const sourceName = unitName(pattern.sourceUnit);
            const intersectingName = unitName(pattern.intersectingUnit);
            const placeCount = pattern.lockedCells.length === 2 ? 'two' : 'three';
            const lockedMarks: HintCandidateMark[] = pattern.lockedCells.map(cell => ({
                ...cell,
                value: pattern.value,
                tone: 'locked',
            }));
            const eliminatedMarks: HintCandidateMark[] = eliminations.map(elimination => ({
                row: elimination.row,
                col: elimination.col,
                value: pattern.value,
                tone: 'eliminated',
            }));
            const finalTargetDelta = result.placement.resultKind === 'naked' && isFinalDeduction
                ? eliminations.find(elimination => (
                    elimination.row === result.placement.target.row
                    && elimination.col === result.placement.target.col
                ))
                : undefined;
            const victim = eliminations.length === 1 ? 'the shaded cell' : 'the shaded cells';

            frames.push(
                {
                    id: `chain-${stepNumber}-locked-find`,
                    techniqueLabel: 'Locked candidates',
                    title: index === 0
                        ? `Only ${placeCount} places for ${pattern.value}`
                        : `Now only ${placeCount} places for ${pattern.value}`,
                    body: index === 0
                        ? `In this ${sourceName}, ${pattern.value} can only go in these cells.`
                        : `With the previous notes crossed out, ${pattern.value} can only go in these cells.`,
                    titleParts: [
                        { text: index === 0 ? 'Only ' : 'Now only ' },
                        { text: `${placeCount} places for ` },
                        candidateValuePart(pattern.value),
                    ],
                    bodyParts: [
                        { text: index === 0
                            ? `In this ${sourceName}, `
                            : 'With the previous notes crossed out, ' },
                        candidateValuePart(pattern.value),
                        { text: ' can only go in these cells.' },
                    ],
                    accessibleDetail: `Candidate ${pattern.value} can only go at ${describeCoordinates(pattern.lockedCells)}.`,
                    spotlightCells: [],
                    unitCells: pattern.sourceUnit.cells,
                    candidateMarks: lockedMarks,
                    dimUnrelated: true,
                },
                {
                    id: `chain-${stepNumber}-locked-remove`,
                    techniqueLabel: 'Locked candidates',
                    title: `These ${pattern.value}s share this ${intersectingName}`,
                    body: isFinalDeduction
                        ? result.placement.resultKind === 'naked'
                            ? `Cross out the other ${pattern.value} candidates. Only ${result.placement.target.value} remains in the outlined cell.`
                            : `Cross out ${pattern.value} in ${victim}. Now ${result.placement.target.value} has one place in this ${unitName(result.placement.resultUnit)}.`
                        : `So ${pattern.value} cannot go in ${victim}.`,
                    titleParts: [
                        { text: 'These ' },
                        candidateValuePart(pattern.value),
                        { text: `s share this ${intersectingName}` },
                    ],
                    bodyParts: isFinalDeduction
                        ? result.placement.resultKind === 'naked'
                            ? [
                                { text: 'Cross out the other ' },
                                candidateValuePart(pattern.value, 'removed'),
                                { text: ' candidates. Only ' },
                                candidateValuePart(result.placement.target.value, 'remaining'),
                                { text: ' remains in the outlined cell.' },
                            ]
                            : [
                                { text: 'Cross out ' },
                                candidateValuePart(pattern.value, 'removed'),
                                { text: ` in ${victim}. Now ` },
                                candidateValuePart(result.placement.target.value, 'remaining'),
                                { text: ` has one place in this ${unitName(result.placement.resultUnit)}.` },
                            ]
                        : [
                            { text: 'So ' },
                            candidateValuePart(pattern.value, 'removed'),
                            { text: ` cannot go in ${victim}.` },
                        ],
                    accessibleDetail: `The locked ${pattern.value}s eliminate ${pattern.value} from ${describeCoordinates(eliminations)}.`,
                    spotlightCells: finalTargetDelta
                        ? [{ row: finalTargetDelta.row, col: finalTargetDelta.col }]
                        : [],
                    unitCells: pattern.sourceUnit.cells,
                    unitStrokeTone: 'soft',
                    contextCells: pattern.intersectingUnit.cells,
                    guideUnits: [{
                        kind: pattern.intersectingUnit.kind,
                        index: pattern.intersectingUnit.index,
                    }],
                    candidateMarks: [...lockedMarks, ...eliminatedMarks],
                    candidateTransition: finalTargetDelta
                        ? {
                            row: finalTargetDelta.row,
                            col: finalTargetDelta.col,
                            beforeCandidates: [...finalTargetDelta.beforeCandidates],
                            removedValue: pattern.value,
                            afterCandidates: [...finalTargetDelta.afterCandidates],
                        }
                        : undefined,
                    eliminationStyle: 'candidate-slash',
                    fillEliminatedCells: !finalTargetDelta,
                    dimUnrelated: true,
                },
            );
            return;
        }

        if (deduction.technique === 'nakedPair') {
            const { pattern, eliminations } = deduction;
            const [firstValue, secondValue] = pattern.pairValues;
            const pairNoteSets: HintCandidateNoteSet[] = pattern.pairCells.map(cell => ({
                ...cell,
                marks: pattern.pairValues.map(value => ({ value, tone: 'locked' as const })),
            }));
            const eliminatedNoteSets: HintCandidateNoteSet[] = eliminations.map(elimination => ({
                row: elimination.row,
                col: elimination.col,
                marks: elimination.beforeCandidates.map(value => ({
                    value,
                    tone: elimination.afterCandidates.includes(value)
                        ? 'remaining' as const
                        : 'removed' as const,
                })),
            }));
            const eliminatedCellMarks: HintCandidateMark[] = eliminations.map(elimination => ({
                row: elimination.row,
                col: elimination.col,
                value: elimination.removedValues[0],
                tone: 'eliminated',
            }));
            const removedValues = [...new Set(eliminations.flatMap(elimination => (
                elimination.removedValues
            )))].sort((left, right) => left - right);
            const removalInstruction = removedValues.length === 1
                ? `Cross out ${removedValues[0]} where it is shown`
                : `Cross out ${formatCandidateValues(removedValues)} where they are shown`;

            frames.push(
                {
                    id: `chain-${stepNumber}-pair-find`,
                    techniqueLabel: 'Naked pair',
                    title: index === 0
                        ? 'These cells share two choices'
                        : 'Now these cells share two choices',
                    body: index === 0
                        ? `They must contain ${firstValue} and ${secondValue}, in either order.`
                        : `With the previous notes crossed out, they must contain ${firstValue} and ${secondValue}.`,
                    bodyParts: [
                        { text: index === 0
                            ? 'They must contain '
                            : 'With the previous notes crossed out, they must contain ' },
                        ...candidateValueParts(pattern.pairValues),
                        { text: index === 0 ? ', in either order.' : '.' },
                    ],
                    accessibleDetail: `In this ${unitName(pattern.unit)}, ${describeCoordinate(pattern.pairCells[0])} and ${describeCoordinate(pattern.pairCells[1])} each have only candidates ${firstValue} and ${secondValue}.`,
                    spotlightCells: pattern.pairCells,
                    unitCells: pattern.unit.cells,
                    unitStrokeTone: 'soft',
                    candidateNoteSets: pairNoteSets,
                    dimUnrelated: true,
                },
                {
                    id: `chain-${stepNumber}-pair-remove`,
                    techniqueLabel: 'Naked pair',
                    title: `The pair reserves ${firstValue} and ${secondValue}`,
                    body: isFinalDeduction
                        ? result.placement.resultKind === 'naked'
                            ? `${removalInstruction}. Only ${result.placement.target.value} remains in the outlined cell.`
                            : `${removalInstruction}. Now ${result.placement.target.value} has one place in this ${unitName(result.placement.resultUnit)}.`
                        : `${removalInstruction}.`,
                    titleParts: [
                        { text: 'The pair reserves ' },
                        ...candidateValueParts(pattern.pairValues),
                    ],
                    bodyParts: [
                        { text: 'Cross out ' },
                        ...candidateValueParts(removedValues, 'removed'),
                        { text: removedValues.length === 1
                            ? ' where it is shown'
                            : ' where they are shown' },
                        ...(isFinalDeduction
                            ? result.placement.resultKind === 'naked'
                                ? [
                                    { text: '. Only ' },
                                    candidateValuePart(result.placement.target.value, 'remaining'),
                                    { text: ' remains in the outlined cell.' },
                                ]
                                : [
                                    { text: '. Now ' },
                                    candidateValuePart(result.placement.target.value, 'remaining'),
                                    { text: ` has one place in this ${unitName(result.placement.resultUnit)}.` },
                                ]
                            : [{ text: '.' }]),
                    ],
                    accessibleDetail: `The pair eliminates ${formatCandidateValues(removedValues)} from ${describeCoordinates(eliminations)}.`,
                    spotlightCells: isFinalDeduction && result.placement.resultKind === 'naked'
                        ? [{ row: result.placement.target.row, col: result.placement.target.col }]
                        : pattern.pairCells,
                    guideUnits: [{ kind: pattern.unit.kind, index: pattern.unit.index }],
                    guideStrokeTone: 'soft',
                    candidateNoteSets: [...pairNoteSets, ...eliminatedNoteSets],
                    candidateMarks: eliminatedCellMarks,
                    eliminationStyle: 'candidate-slash',
                    fillEliminatedCells: false,
                    dimUnrelated: true,
                },
            );
            return;
        }

        if (deduction.technique === 'xWing') {
            const { pattern, eliminations } = deduction;
            const baseName = pattern.orientation === 'row' ? 'rows' : 'columns';
            const coverName = pattern.orientation === 'row' ? 'columns' : 'rows';
            const cornerMarks: HintCandidateMark[] = pattern.cornerCells.map(cell => ({
                ...cell,
                value: pattern.value,
                tone: 'locked',
            }));
            const eliminatedMarks: HintCandidateMark[] = eliminations.map(elimination => ({
                row: elimination.row,
                col: elimination.col,
                value: pattern.value,
                tone: 'eliminated',
            }));
            const finalTargetDelta = result.placement.resultKind === 'naked' && isFinalDeduction
                ? eliminations.find(elimination => (
                    elimination.row === result.placement.target.row
                    && elimination.col === result.placement.target.col
                ))
                : undefined;

            frames.push(
                {
                    id: `chain-${stepNumber}-x-wing-find`,
                    techniqueLabel: 'X-Wing',
                    title: index === 0
                        ? `Look at the possible ${pattern.value}s`
                        : `Now look at the possible ${pattern.value}s`,
                    body: index === 0
                        ? `In both ${baseName}, ${pattern.value} can only go in the same two ${coverName}.`
                        : `With the previous notes crossed out, the same two ${coverName} remain in both ${baseName}.`,
                    titleParts: [
                        { text: index === 0 ? 'Look at the possible ' : 'Now look at the possible ' },
                        candidateValuePart(pattern.value),
                        { text: 's' },
                    ],
                    bodyParts: index === 0
                        ? [
                            { text: `In both ${baseName}, ` },
                            candidateValuePart(pattern.value),
                            { text: ` can only go in the same two ${coverName}.` },
                        ]
                        : undefined,
                    accessibleDetail: `Candidate ${pattern.value} appears only at ${describeCoordinates(pattern.cornerCells)} in these two ${baseName}.`,
                    spotlightCells: pattern.cornerCells,
                    guideUnits: pattern.baseUnits.map(unit => ({
                        kind: unit.kind,
                        index: unit.index,
                    })),
                    guideStrokeTone: 'soft',
                    candidateMarks: cornerMarks,
                    dimUnrelated: true,
                },
                {
                    id: `chain-${stepNumber}-x-wing-remove`,
                    techniqueLabel: 'X-Wing',
                    title: `So ${pattern.value} cannot go elsewhere in these ${coverName}`,
                    body: isFinalDeduction
                        ? result.placement.resultKind === 'naked'
                            ? `Cross out the other ${pattern.value} candidates. Only ${result.placement.target.value} remains in the outlined cell.`
                            : `Cross out the other ${pattern.value} candidates. Now ${result.placement.target.value} has one place in this ${unitName(result.placement.resultUnit)}.`
                        : `Cross out the other ${pattern.value} candidates.`,
                    titleParts: [
                        { text: 'So ' },
                        candidateValuePart(pattern.value, 'removed'),
                        { text: ` cannot go elsewhere in these ${coverName}` },
                    ],
                    bodyParts: [
                        { text: 'Cross out the other ' },
                        candidateValuePart(pattern.value, 'removed'),
                        { text: ' candidates.' },
                        ...(isFinalDeduction
                            ? result.placement.resultKind === 'naked'
                                ? [
                                    { text: ' Only ' },
                                    candidateValuePart(result.placement.target.value, 'remaining'),
                                    { text: ' remains in the outlined cell.' },
                                ]
                                : [
                                    { text: ' Now ' },
                                    candidateValuePart(result.placement.target.value, 'remaining'),
                                    { text: ` has one place in this ${unitName(result.placement.resultUnit)}.` },
                                ]
                            : []),
                    ],
                    accessibleDetail: `The X-Wing eliminates ${pattern.value} from ${describeCoordinates(eliminations)}.`,
                    spotlightCells: finalTargetDelta
                        ? [{ row: finalTargetDelta.row, col: finalTargetDelta.col }]
                        : [],
                    contextCells: pattern.baseUnits.flatMap(unit => unit.cells),
                    guideUnits: pattern.coverUnits.map(unit => ({
                        kind: unit.kind,
                        index: unit.index,
                    })),
                    guideStrokeTone: 'soft',
                    candidateMarks: [...cornerMarks, ...eliminatedMarks],
                    candidateTransition: finalTargetDelta
                        ? {
                            row: finalTargetDelta.row,
                            col: finalTargetDelta.col,
                            beforeCandidates: [...finalTargetDelta.beforeCandidates],
                            removedValue: pattern.value,
                            afterCandidates: [...finalTargetDelta.afterCandidates],
                        }
                        : undefined,
                    eliminationStyle: 'candidate-slash',
                    fillEliminatedCells: !finalTargetDelta,
                    dimUnrelated: true,
                },
            );
            return;
        }

        if (deduction.technique === 'xyWing') {
            const { pattern, eliminations } = deduction;
            const sourceNoteSets: HintCandidateNoteSet[] = [
                makeXYWingNoteSet(pattern.pivot, [pattern.x, pattern.y], [pattern.x, pattern.y]),
                makeXYWingNoteSet(pattern.xWing, [pattern.x, pattern.z], [pattern.x], [pattern.z]),
                makeXYWingNoteSet(pattern.yWing, [pattern.y, pattern.z], [pattern.y], [pattern.z]),
            ];
            const eliminatedMarks: HintCandidateMark[] = eliminations.map(elimination => ({
                row: elimination.row,
                col: elimination.col,
                value: pattern.z,
                tone: 'eliminated',
            }));
            const removalGuideUnits = uniqueGuideUnits(eliminations.flatMap(elimination => [
                sharedPeerUnit(elimination, pattern.xWing),
                sharedPeerUnit(elimination, pattern.yWing),
            ]));
            const finalTargetDelta = result.placement.resultKind === 'naked' && isFinalDeduction
                ? eliminations.find(elimination => (
                    elimination.row === result.placement.target.row
                    && elimination.col === result.placement.target.col
                ))
                : undefined;
            const eliminationLead = eliminations.length === 1
                ? `This cell sees both wings. Cross out this ${pattern.z}`
                : `These cells see both wings. Cross out ${pattern.z} from each one`;
            const eliminationLeadParts: HintTextPart[] = eliminations.length === 1
                ? [
                    { text: 'This cell sees both wings. Cross out this ' },
                    candidateValuePart(pattern.z, 'removed'),
                ]
                : [
                    { text: 'These cells see both wings. Cross out ' },
                    candidateValuePart(pattern.z, 'removed'),
                    { text: ' from each one' },
                ];

            frames.push(
                {
                    id: `chain-${stepNumber}-xy-wing-find`,
                    techniqueLabel: 'XY-Wing',
                    title: index === 0
                        ? `This ${pattern.x}/${pattern.y} cell links two wings`
                        : `Now this ${pattern.x}/${pattern.y} cell links two wings`,
                    body: `One wing is ${pattern.x}/${pattern.z} and the other is ${pattern.y}/${pattern.z}. Either way, one wing must be ${pattern.z}.`,
                    titleParts: [
                        { text: index === 0 ? 'This ' : 'Now this ' },
                        candidateValuePart(pattern.x),
                        { text: '/' },
                        candidateValuePart(pattern.y),
                        { text: ' cell links two wings' },
                    ],
                    bodyParts: [
                        { text: 'One wing is ' },
                        candidateValuePart(pattern.x),
                        { text: '/' },
                        candidateValuePart(pattern.z, 'support'),
                        { text: ' and the other is ' },
                        candidateValuePart(pattern.y),
                        { text: '/' },
                        candidateValuePart(pattern.z, 'support'),
                        { text: '. Either way, one wing must be ' },
                        candidateValuePart(pattern.z, 'support'),
                        { text: '.' },
                    ],
                    accessibleDetail: `The pivot at ${describeCoordinate(pattern.pivot)} sees ${describeCoordinate(pattern.xWing)} and ${describeCoordinate(pattern.yWing)}.`,
                    spotlightCells: [pattern.pivot, pattern.xWing, pattern.yWing],
                    sourceCells: [pattern.pivot],
                    candidateNoteSets: sourceNoteSets,
                    dimUnrelated: true,
                },
                {
                    id: `chain-${stepNumber}-xy-wing-remove`,
                    techniqueLabel: 'XY-Wing',
                    title: eliminations.length === 1
                        ? `So ${pattern.z} cannot go here`
                        : `So ${pattern.z} cannot go in these cells`,
                    body: isFinalDeduction
                        ? result.placement.resultKind === 'naked'
                            ? `${eliminationLead}; only ${result.placement.target.value} remains${eliminations.length === 1 ? '' : ' in the outlined cell'}.`
                            : `${eliminationLead}; now only one place remains for ${result.placement.target.value}.`
                        : eliminations.length === 1
                            ? `This cell sees both wings, so cross out this ${pattern.z}.`
                            : `These cells see both wings, so cross out ${pattern.z} from each one.`,
                    titleParts: [
                        { text: 'So ' },
                        candidateValuePart(pattern.z, 'removed'),
                        { text: eliminations.length === 1
                            ? ' cannot go here'
                            : ' cannot go in these cells' },
                    ],
                    bodyParts: isFinalDeduction
                        ? result.placement.resultKind === 'naked'
                            ? [
                                ...eliminationLeadParts,
                                { text: '; only ' },
                                candidateValuePart(result.placement.target.value, 'remaining'),
                                { text: eliminations.length === 1
                                    ? ' remains.'
                                    : ' remains in the outlined cell.' },
                            ]
                            : [
                                ...eliminationLeadParts,
                                { text: '; now only one place remains for ' },
                                candidateValuePart(result.placement.target.value, 'remaining'),
                                { text: '.' },
                            ]
                        : eliminations.length === 1
                            ? [
                                { text: 'This cell sees both wings, so cross out this ' },
                                candidateValuePart(pattern.z, 'removed'),
                                { text: '.' },
                            ]
                            : [
                                { text: 'These cells see both wings, so cross out ' },
                                candidateValuePart(pattern.z, 'removed'),
                                { text: ' from each one.' },
                            ],
                    accessibleDetail: `The XY-Wing eliminates ${pattern.z} from ${describeCoordinates(eliminations)}.`,
                    spotlightCells: finalTargetDelta
                        ? [{ row: finalTargetDelta.row, col: finalTargetDelta.col }]
                        : [],
                    sourceCells: [pattern.xWing, pattern.yWing],
                    guideUnits: removalGuideUnits,
                    guideStrokeTone: 'soft',
                    candidateNoteSets: sourceNoteSets,
                    candidateMarks: eliminatedMarks,
                    candidateTransition: finalTargetDelta
                        ? {
                            row: finalTargetDelta.row,
                            col: finalTargetDelta.col,
                            beforeCandidates: [...finalTargetDelta.beforeCandidates],
                            removedValue: pattern.z,
                            afterCandidates: [...finalTargetDelta.afterCandidates],
                        }
                        : undefined,
                    eliminationStyle: 'candidate-slash',
                    fillEliminatedCells: !finalTargetDelta,
                    dimUnrelated: true,
                },
            );
            return;
        }

        if (deduction.technique === 'nakedTriple') {
            const { pattern, eliminations } = deduction;
            const tripleLabel = formatCandidateValues(pattern.tripleValues);
            const nextDeduction = result.deductions[index + 1];
            const nextPatternKeys = nextDeduction
                ? new Set(multiStepDeductionSourceCells(nextDeduction).map(coordinateKey))
                : null;
            const nextFocusValue = nextDeduction
                ? multiStepDeductionFocusValue(nextDeduction)
                : null;
            const causallyFocusedEliminations = nextDeduction && nextPatternKeys
                ? eliminations.filter(elimination => (
                    nextPatternKeys.has(coordinateKey(elimination))
                    && (
                        nextFocusValue === null
                        || elimination.removedValues.includes(nextFocusValue)
                    )
                ))
                : [];
            const displayedEliminations = causallyFocusedEliminations.length > 0
                ? causallyFocusedEliminations
                : eliminations;
            const tripleNoteSets: HintCandidateNoteSet[] = pattern.tripleCells.map((
                cell,
                cellIndex,
            ) => ({
                ...cell,
                marks: pattern.tripleCandidates[cellIndex].map(value => ({
                    value,
                    tone: 'locked' as const,
                })),
            }));
            const eliminatedNoteSets: HintCandidateNoteSet[] = displayedEliminations.map(elimination => ({
                row: elimination.row,
                col: elimination.col,
                marks: elimination.beforeCandidates.map(value => ({
                    value,
                    tone: elimination.afterCandidates.includes(value)
                        ? 'remaining' as const
                        : 'removed' as const,
                })),
            }));
            const eliminatedCellMarks: HintCandidateMark[] = displayedEliminations.map(elimination => ({
                row: elimination.row,
                col: elimination.col,
                value: elimination.removedValues[0],
                tone: 'eliminated',
            }));
            const removedValues = [...new Set(displayedEliminations.flatMap(elimination => (
                elimination.removedValues
            )))].sort((left, right) => left - right);
            const removalInstruction = removedValues.length === 1
                ? `Cross out ${removedValues[0]} where it is shown`
                : `Cross out ${formatCandidateValues(removedValues)} where they are shown`;
            const finalHiddenUnit = isFinalDeduction && result.placement.resultKind === 'hidden'
                ? result.placement.resultUnit
                : null;
            const finalHiddenUnitKeys = finalHiddenUnit
                ? new Set(finalHiddenUnit.cells.map(coordinateKey))
                : null;
            const finalHiddenEliminations = finalHiddenUnitKeys
                ? eliminations.filter(elimination => (
                    finalHiddenUnitKeys.has(coordinateKey(elimination))
                    && elimination.removedValues.includes(result.placement.target.value)
                ))
                : [];
            const finalHiddenMarks: HintCandidateMark[] = finalHiddenEliminations.map(
                elimination => ({
                    row: elimination.row,
                    col: elimination.col,
                    value: result.placement.target.value,
                    tone: 'eliminated',
                }),
            );
            const finalHiddenVictim = finalHiddenEliminations.length === 1
                ? `${result.placement.target.value} where it is shown`
                : `${result.placement.target.value}s where they are shown`;

            frames.push(
                {
                    id: `chain-${stepNumber}-triple-find`,
                    techniqueLabel: 'Naked triple',
                    title: index === 0
                        ? 'These three cells share three choices'
                        : 'Now these three cells share three choices',
                    body: index === 0
                        ? `Together, they must contain ${tripleLabel}, in some order.`
                        : `With the previous notes crossed out, together they can only be ${tripleLabel}.`,
                    bodyParts: [
                        { text: index === 0
                            ? 'Together, they must contain '
                            : 'With the previous notes crossed out, together they can only be ' },
                        ...candidateValueParts(pattern.tripleValues),
                        { text: index === 0 ? ', in some order.' : '.' },
                    ],
                    accessibleDetail: `In this ${unitName(pattern.unit)}, ${describeCoordinates(pattern.tripleCells)} share only candidates ${tripleLabel}.`,
                    spotlightCells: pattern.tripleCells,
                    unitCells: pattern.unit.cells,
                    unitStrokeTone: 'soft',
                    candidateNoteSets: tripleNoteSets,
                    dimUnrelated: true,
                },
                {
                    id: `chain-${stepNumber}-triple-remove`,
                    techniqueLabel: 'Naked triple',
                    title: finalHiddenUnit
                        ? `Now look at this ${unitName(finalHiddenUnit)}`
                        : `The triple reserves ${tripleLabel}`,
                    body: finalHiddenUnit
                        ? `Cross out ${finalHiddenVictim}. That leaves one place for ${result.placement.target.value}.`
                        : isFinalDeduction && result.placement.resultKind === 'naked'
                            ? `${removalInstruction}. Only ${result.placement.target.value} remains in the outlined cell.`
                            : `${removalInstruction}.`,
                    titleParts: finalHiddenUnit
                        ? undefined
                        : [
                            { text: 'The triple reserves ' },
                            ...candidateValueParts(pattern.tripleValues),
                        ],
                    bodyParts: finalHiddenUnit
                        ? [
                            { text: 'Cross out ' },
                            candidateValuePart(result.placement.target.value, 'removed'),
                            { text: finalHiddenEliminations.length === 1
                                ? ' where it is shown. That leaves one place for '
                                : 's where they are shown. That leaves one place for ' },
                            candidateValuePart(result.placement.target.value, 'remaining'),
                            { text: '.' },
                        ]
                        : [
                            { text: 'Cross out ' },
                            ...candidateValueParts(removedValues, 'removed'),
                            { text: removedValues.length === 1
                                ? ' where it is shown'
                                : ' where they are shown' },
                            ...(isFinalDeduction && result.placement.resultKind === 'naked'
                                ? [
                                    { text: '. Only ' },
                                    candidateValuePart(result.placement.target.value, 'remaining'),
                                    { text: ' remains in the outlined cell.' },
                                ]
                                : [{ text: '.' }]),
                        ],
                    accessibleDetail: finalHiddenUnit
                        ? `The triple eliminates ${result.placement.target.value} from ${describeCoordinates(finalHiddenEliminations)}, leaving one place in this ${unitName(finalHiddenUnit)}.`
                        : `The triple eliminates ${formatCandidateValues(removedValues)} from ${describeCoordinates(displayedEliminations)}.`,
                    spotlightCells: finalHiddenUnit
                        ? []
                        : isFinalDeduction && result.placement.resultKind === 'naked'
                            ? [{ row: result.placement.target.row, col: result.placement.target.col }]
                            : pattern.tripleCells,
                    unitCells: finalHiddenUnit?.cells,
                    guideUnits: finalHiddenUnit
                        ? undefined
                        : [{ kind: pattern.unit.kind, index: pattern.unit.index }],
                    guideStrokeTone: finalHiddenUnit ? undefined : 'soft',
                    candidateNoteSets: finalHiddenUnit
                        ? tripleNoteSets
                        : [...tripleNoteSets, ...eliminatedNoteSets],
                    candidateMarks: finalHiddenUnit
                        ? finalHiddenMarks
                        : eliminatedCellMarks,
                    eliminationStyle: 'candidate-slash',
                    fillEliminatedCells: Boolean(finalHiddenUnit),
                    dimUnrelated: true,
                },
            );
            return;
        }

        const { pattern, eliminations } = deduction;
        const [firstValue, secondValue] = pattern.pairValues;
        const noteSets = pattern.pairCells.map(cell => {
            const elimination = eliminations.find(item => (
                item.row === cell.row && item.col === cell.col
            ));
            const beforeCandidates = elimination?.beforeCandidates ?? [...pattern.pairValues];
            return {
                ...cell,
                before: {
                    ...cell,
                    marks: beforeCandidates.map(value => ({
                        value,
                        tone: pattern.pairValues.includes(value)
                            ? 'locked' as const
                            : 'possible' as const,
                    })),
                },
                after: {
                    ...cell,
                    marks: beforeCandidates.map(value => ({
                        value,
                        tone: pattern.pairValues.includes(value)
                            ? 'remaining' as const
                            : 'removed' as const,
                    })),
                },
            };
        });
        const removedValues = [...new Set(eliminations.flatMap(elimination => (
            elimination.removedValues
        )))].sort((left, right) => left - right);
        const eliminatedCellMarks: HintCandidateMark[] = eliminations.map(elimination => ({
            row: elimination.row,
            col: elimination.col,
            value: elimination.removedValues[0],
            tone: 'eliminated',
        }));
        const finalResultUnit = isFinalDeduction && result.placement.resultKind === 'hidden'
            ? result.placement.resultUnit
            : null;
        const removalInstruction = removedValues.length === 1
            ? `Cross out ${removedValues[0]} where it is shown.`
            : `Cross out ${formatCandidateValues(removedValues)} where they are shown.`;

        frames.push(
            {
                id: `chain-${stepNumber}-hidden-pair-find`,
                techniqueLabel: 'Hidden pair',
                title: index === 0
                    ? `${firstValue} and ${secondValue} have only two places`
                    : `Now ${firstValue} and ${secondValue} have only two places`,
                body: index === 0
                    ? `In this ${unitName(pattern.unit)}, both must go in these two cells.`
                    : 'With the previous notes crossed out, both must go in these two cells.',
                titleParts: [
                    ...(index === 0 ? [] : [{ text: 'Now ' }]),
                    ...candidateValueParts(pattern.pairValues),
                    { text: ' have only two places' },
                ],
                accessibleDetail: `Candidates ${firstValue} and ${secondValue} can appear only at ${describeCoordinates(pattern.pairCells)} in this ${unitName(pattern.unit)}.`,
                spotlightCells: pattern.pairCells,
                unitCells: pattern.unit.cells,
                unitStrokeTone: 'soft',
                candidateNoteSets: noteSets.map(noteSet => noteSet.before),
                dimUnrelated: true,
            },
            {
                id: `chain-${stepNumber}-hidden-pair-remove`,
                techniqueLabel: 'Hidden pair',
                title: finalResultUnit
                    ? `Now look at this ${unitName(finalResultUnit)}`
                    : `So only ${firstValue} and ${secondValue} stay here`,
                body: finalResultUnit
                    ? `${removalInstruction} That leaves one place for ${result.placement.target.value}.`
                    : removalInstruction,
                titleParts: finalResultUnit
                    ? undefined
                    : [
                        { text: 'So only ' },
                        ...candidateValueParts(pattern.pairValues, 'remaining'),
                        { text: ' stay here' },
                    ],
                bodyParts: [
                    { text: 'Cross out ' },
                    ...candidateValueParts(removedValues, 'removed'),
                    { text: removedValues.length === 1
                        ? ' where it is shown.'
                        : ' where they are shown.' },
                    ...(finalResultUnit
                        ? [
                            { text: ' That leaves one place for ' },
                            candidateValuePart(result.placement.target.value, 'remaining'),
                            { text: '.' },
                        ]
                        : []),
                ],
                accessibleDetail: `Keeping only ${firstValue} and ${secondValue} removes ${formatCandidateValues(removedValues)} from ${describeCoordinates(eliminations)}.`,
                spotlightCells: finalResultUnit ? [] : pattern.pairCells,
                unitCells: finalResultUnit?.cells ?? pattern.unit.cells,
                unitStrokeTone: finalResultUnit ? undefined : 'soft',
                candidateNoteSets: noteSets.map(noteSet => noteSet.after),
                candidateMarks: eliminatedCellMarks,
                eliminationStyle: 'candidate-slash',
                fillEliminatedCells: false,
                dimUnrelated: true,
            },
        );
    });

    const { placement } = result;
    const answerMark: HintCandidateMark = { ...placement.target, tone: 'answer' };
    if (placement.resultKind === 'naked') {
        frames.push({
            id: 'chain-answer',
            techniqueLabel: 'Naked single',
            title: `Only ${placement.target.value} remains`,
            body: `${placement.target.value} belongs in this cell.`,
            titleParts: [
                { text: 'Only ' },
                candidateValuePart(placement.target.value, 'remaining'),
                { text: ' remains' },
            ],
            bodyParts: [
                candidateValuePart(placement.target.value, 'remaining'),
                { text: ' belongs in this cell.' },
            ],
            accessibleDetail: `Place ${placement.target.value} at ${describeCoordinate(placement.target)}.`,
            spotlightCells: [{ row: placement.target.row, col: placement.target.col }],
            candidateMarks: [answerMark],
            fillTargetCell: true,
            target: placement.target,
            dimUnrelated: true,
        });
    } else {
        const otherEmptyCells = placement.resultUnit.cells.filter(cell => (
            board[cell.row][cell.col] === 0
            && (cell.row !== placement.target.row || cell.col !== placement.target.col)
        ));
        const allEliminations = result.deductions.flatMap(deduction => deduction.eliminations);
        const chainEliminationKeys = new Set(allEliminations
            .filter(elimination => elimination.removedValues.includes(placement.target.value))
            .map(coordinateKey));
        const preBlockedCells = otherEmptyCells.filter(cell => (
            !chainEliminationKeys.has(coordinateKey(cell))
            && !candidates[cell.row][cell.col].includes(placement.target.value)
        ));
        const supportSourceCells = selectMinimalBlockers(
            board,
            preBlockedCells,
            placement.target.value,
        );

        frames.push({
            id: 'chain-answer',
            techniqueLabel: 'Hidden single',
            title: `Only one place remains for ${placement.target.value}`,
            body: `Every other ${placement.target.value} is ruled out, so ${placement.target.value} belongs in the outlined cell.`,
            titleParts: [
                { text: 'Only one place remains for ' },
                candidateValuePart(placement.target.value, 'remaining'),
            ],
            bodyParts: [
                { text: 'Every other ' },
                candidateValuePart(placement.target.value, 'removed'),
                { text: ' is ruled out, so ' },
                candidateValuePart(placement.target.value, 'remaining'),
                { text: ' belongs in the outlined cell.' },
            ],
            accessibleDetail: `The chained deductions leave ${describeCoordinate(placement.target)} as the only place for ${placement.target.value} in this ${unitName(placement.resultUnit)}.`,
            spotlightCells: [{ row: placement.target.row, col: placement.target.col }],
            unitCells: placement.resultUnit.cells,
            unitStrokeTone: 'soft',
            supportSourceCells,
            candidateMarks: [
                ...otherEmptyCells.map(cell => ({
                    ...cell,
                    value: placement.target.value,
                    tone: 'eliminated' as const,
                })),
                answerMark,
            ],
            eliminationStyle: 'candidate-slash',
            fillEliminatedCells: true,
            fillTargetCell: true,
            target: placement.target,
            dimUnrelated: true,
        });
    }

    const candidateEliminations = result.deductions.flatMap(deduction => (
        deduction.eliminations.map(cloneCandidateDelta)
    ));
    return {
        outcome: 'placement',
        technique: 'multiStep',
        techniqueLabel: 'Logical chain',
        target: placement.target,
        derivedResult: placement.resultKind,
        candidateEliminations,
        deductions: result.deductions.map((deduction, index) => ({
            id: `chain-deduction-${index + 1}`,
            technique: deduction.technique,
            techniqueLabel: deduction.technique === 'lockedCandidate'
                ? 'Locked candidates'
                : deduction.technique === 'nakedPair'
                    ? 'Naked pair'
                    : deduction.technique === 'hiddenPair'
                        ? 'Hidden pair'
                        : deduction.technique === 'nakedTriple'
                            ? 'Naked triple'
                            : deduction.technique === 'xWing'
                                ? 'X-Wing'
                                : 'XY-Wing',
            candidateEliminations: deduction.eliminations.map(cloneCandidateDelta),
        })),
        frames,
    };
};

/**
 * Build an explanation from placed values plus solver-owned candidate progress.
 * Player notes affect only whether an update will be visible; they are never
 * trusted as logical input.
 */
export const createHintPlan = (
    board: Board,
    solvedBoard: number[][],
    options: HintPlanOptions = {},
): HintPlanResult => {
    if (!isNineByNine(board) || !isNineByNine(solvedBoard)) return { status: 'invalid' };
    if (!board.every(row => row.every(isValidCell))) return { status: 'invalid' };
    if (!isValidSolution(solvedBoard as number[][])) return { status: 'invalid' };

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = board[row][col];
            const solutionValue = solvedBoard[row][col];
            if (cell.isFixed && cell.value === null) return { status: 'invalid' };
            if (cell.value === null || cell.value === solutionValue) continue;
            return { status: cell.isFixed ? 'invalid' : 'wrong-board' };
        }
    }

    const numericBoard = toNumericBoard(board);
    if (numericBoard.every(row => row.every(Boolean))) return { status: 'complete' };

    const candidateProgress = reconcileHintCandidateProgress(
        board,
        solvedBoard,
        options.candidateProgress,
    );
    const candidates = candidateGridFromProgress(numericBoard, candidateProgress);
    if (candidates.some((row, rowIndex) => row.some((cell, colIndex) => (
        numericBoard[rowIndex][colIndex] === 0 && cell.length === 0
    )))) {
        return { status: 'invalid' };
    }

    const plan = makeNakedSinglePlan(numericBoard, candidates)
        ?? makeHiddenSinglePlan(numericBoard, candidates)
        ?? makeCandidateProgressPlan(
            board,
            numericBoard,
            solvedBoard,
            candidates,
            options.preferredTechnique,
        )
        ?? makeMultiStepPlan(numericBoard, candidates);
    if (!plan) return { status: 'unsupported' };
    if (
        plan.outcome === 'placement'
        && solvedBoard[plan.target.row][plan.target.col] !== plan.target.value
    ) {
        return { status: 'invalid' };
    }
    if (
        plan.technique === 'lockedCandidate'
        && plan.frames.some(frame => (frame.candidateMarks ?? []).some(mark => (
            mark.tone === 'eliminated'
            && solvedBoard[mark.row][mark.col] === mark.value
        )))
    ) {
        return { status: 'invalid' };
    }
    if (
        plan.outcome === 'candidate'
        && (
            plan.noteUpdates.length === 0
            || plan.candidateEliminations.length === 0
        )
    ) {
        return { status: 'invalid' };
    }
    if (
        (plan.candidateEliminations ?? []).some(elimination => (
            elimination.removedValues.includes(solvedBoard[elimination.row][elimination.col])
        ))
    ) {
        return { status: 'invalid' };
    }

    return { status: 'ready', plan };
};

/**
 * Read-only search diagnostics for offline Hint coverage audits. This uses the
 * exact Locked Candidate + Naked Pair + Hidden Pair + Naked Triple + X-Wing + XY-Wing
 * search used by gameplay,
 * but permits a larger depth/state budget so an unsupported board can be
 * classified without changing the production Hint limits.
 */
export const diagnoseHintSearch = (
    board: Board,
    options: HintSearchOptions = {},
): HintSearchDiagnostics => {
    const maxDeductions = options.maxDeductions ?? MAX_MULTI_STEP_DEDUCTIONS;
    const maxStates = options.maxStates ?? MAX_MULTI_STEP_STATES;
    const invalidResult: HintSearchDiagnostics = {
        termination: 'invalid',
        exploredStates: 0,
        visitedStates: 0,
        generatedTransitions: 0,
        maxDepthReached: 0,
    };

    if (
        !isNineByNine(board)
        || !board.every(row => row.every(isValidCell))
        || board.some(row => row.some(cell => cell.isFixed && cell.value === null))
        || !Number.isInteger(maxDeductions)
        || maxDeductions < 1
        || !Number.isInteger(maxStates)
        || maxStates < 1
    ) {
        return invalidResult;
    }

    const numericBoard = toNumericBoard(board);
    const candidates = getCandidateGrid(numericBoard);
    if (candidates.some((row, rowIndex) => row.some((cell, colIndex) => (
        numericBoard[rowIndex][colIndex] === 0 && cell.length === 0
    )))) {
        return invalidResult;
    }

    const run = findMultiStepSearchResult(board.map(row => (
        row.map(cell => cell.value ?? 0)
    )), candidates, { maxDeductions, maxStates });
    const result = run.result;
    return {
        termination: run.termination,
        exploredStates: run.exploredStates,
        visitedStates: run.visitedStates,
        generatedTransitions: run.generatedTransitions,
        maxDepthReached: run.maxDepthReached,
        ...(result ? {
            deductionCount: result.deductions.length,
            techniqueSequence: result.deductions.map(deduction => deduction.technique),
            target: result.placement.target,
        } : {}),
    };
};

export const boardHintSignature = (board: Board) => (
    board.map(row => row.map(cell => cell.value ?? 0).join('')).join('/')
);

export const cloneHintBoard = (board: Board): Board => (
    board.map(row => row.map(cell => ({
        ...cell,
        notes: Array.isArray(cell.notes) ? [...cell.notes] : [],
    })))
);
