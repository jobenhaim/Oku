import React, { useMemo } from 'react';
import type {
    HintCoordinate,
    HintGuideUnit,
    HintVisualFrame,
} from '../../utils/hints';

interface HintGridOverlayProps {
    frame: HintVisualFrame;
    mainFontSize: string;
    noteFontSize: string;
    noteLineHeight: string;
}

type HintNoteTone =
    | 'possible'
    | 'blocked'
    | 'locked'
    | 'removed'
    | 'remaining'
    | 'chain-a'
    | 'chain-b';

interface HintNote {
    value: number;
    tone: HintNoteTone;
}

const HintNoteLayer: React.FC<{
    notes: HintNote[];
    fontSize: string;
    lineHeight: string;
}> = ({ notes, fontSize, lineHeight }) => {
    const notesByValue = new Map(notes.map(note => [note.value, note]));

    return (
        <span className="hint-grid-note-layer">
            {Array.from({ length: 9 }, (_, index) => {
                const value = index + 1;
                const note = notesByValue.get(value);
                return (
                    <span
                        key={value}
                        className={note ? `hint-grid-note hint-grid-note--${note.tone}` : ''}
                        style={note ? { fontSize, lineHeight } : undefined}
                    >
                        {note?.value}
                    </span>
                );
            })}
        </span>
    );
};

const keyFor = ({ row, col }: HintCoordinate) => `${row}:${col}`;

const belongsToUnit = (row: number, col: number, { kind, index }: HintGuideUnit) => {
    if (kind === 'row') return row === index;
    if (kind === 'column') return col === index;
    return Math.floor(row / 3) * 3 + Math.floor(col / 3) === index;
};

interface HintGridRect {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface HintStrokeSegment {
    orientation: 'horizontal' | 'vertical';
    fixed: number;
    start: number;
    end: number;
}

const rectForUnit = ({ kind, index }: HintGuideUnit): HintGridRect => {
    if (kind === 'row') {
        return {
            top: index,
            right: 9,
            bottom: index + 1,
            left: 0,
        };
    }
    if (kind === 'column') {
        return {
            top: 0,
            right: index + 1,
            bottom: 9,
            left: index,
        };
    }
    const top = Math.floor(index / 3) * 3;
    const left = (index % 3) * 3;
    return {
        top,
        right: left + 3,
        bottom: top + 3,
        left,
    };
};

const rectForCells = (cells: HintCoordinate[]): HintGridRect | null => {
    if (cells.length === 0) return null;
    const rows = cells.map(cell => cell.row);
    const cols = cells.map(cell => cell.col);
    return {
        top: Math.min(...rows),
        right: Math.max(...cols) + 1,
        bottom: Math.max(...rows) + 1,
        left: Math.min(...cols),
    };
};

const createStrokeSegments = (rectangles: HintGridRect[]): HintStrokeSegment[] => {
    const edges = new Map<string, HintStrokeSegment>();
    const add = (segment: HintStrokeSegment) => {
        const key = `${segment.orientation}:${segment.fixed}:${segment.start}:${segment.end}`;
        edges.set(key, segment);
    };

    rectangles.forEach(rect => {
        for (let col = rect.left; col < rect.right; col += 1) {
            add({ orientation: 'horizontal', fixed: rect.top, start: col, end: col + 1 });
            add({ orientation: 'horizontal', fixed: rect.bottom, start: col, end: col + 1 });
        }
        for (let row = rect.top; row < rect.bottom; row += 1) {
            add({ orientation: 'vertical', fixed: rect.left, start: row, end: row + 1 });
            add({ orientation: 'vertical', fixed: rect.right, start: row, end: row + 1 });
        }
    });

    const grouped = new Map<string, HintStrokeSegment[]>();
    edges.forEach(segment => {
        const key = `${segment.orientation}:${segment.fixed}`;
        grouped.set(key, [...(grouped.get(key) ?? []), segment]);
    });

    return Array.from(grouped.values()).flatMap(group => {
        const sorted = [...group].sort((left, right) => left.start - right.start || left.end - right.end);
        const merged: HintStrokeSegment[] = [];
        sorted.forEach(segment => {
            const previous = merged[merged.length - 1];
            if (previous && segment.start <= previous.end) {
                previous.end = Math.max(previous.end, segment.end);
                return;
            }
            merged.push({ ...segment });
        });
        return merged;
    });
};

const pathForSegments = (segments: HintStrokeSegment[]) => segments
    .map(segment => segment.orientation === 'horizontal'
        ? `M ${segment.start} ${segment.fixed} H ${segment.end}`
        : `M ${segment.fixed} ${segment.start} V ${segment.end}`)
    .join(' ');

const HintStrokeLayer: React.FC<{
    segments: HintStrokeSegment[];
    tone?: 'default' | 'soft';
}> = ({ segments, tone = 'default' }) => {
    const outerSegments = segments.filter(segment => segment.fixed === 0 || segment.fixed === 9);
    const innerSegments = segments.filter(segment => segment.fixed !== 0 && segment.fixed !== 9);

    return (
        <svg
            className={`hint-grid-strokes ${tone === 'soft' ? 'hint-grid-strokes--soft' : ''}`}
            viewBox="0 0 9 9"
            preserveAspectRatio="none"
            focusable="false"
        >
            {pathForSegments(innerSegments) && (
                <path
                    d={pathForSegments(innerSegments)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    shapeRendering="crispEdges"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                />
            )}
            {pathForSegments(outerSegments) && (
                <path
                    d={pathForSegments(outerSegments)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    shapeRendering="crispEdges"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                />
            )}
        </svg>
    );
};

export const HintGridOverlay: React.FC<HintGridOverlayProps> = ({
    frame,
    mainFontSize,
    noteFontSize,
    noteLineHeight,
}) => {
    const isColorChainFrame = frame.id.startsWith('color-chain-');
    const guideCellsAreFocus = !isColorChainFrame || frame.id === 'color-chain-rule';
    const visual = useMemo(() => ({
        spotlight: new Set(frame.spotlightCells.map(keyFor)),
        unit: new Set((frame.unitCells ?? []).map(keyFor)),
        context: new Set((frame.contextCells ?? []).map(keyFor)),
        guide: new Set(
            Array.from({ length: 81 }, (_, index) => ({
                row: Math.floor(index / 9),
                col: index % 9,
            }))
                .filter(cell => (frame.guideUnits ?? []).some(unit => belongsToUnit(cell.row, cell.col, unit)))
                .map(keyFor)
        ),
        source: new Set((frame.sourceCells ?? []).map(keyFor)),
        supportSource: new Set((frame.supportSourceCells ?? []).map(keyFor)),
        candidates: new Map(
            (frame.candidateMarks ?? []).map(mark => [keyFor(mark), mark] as const)
        ),
        transition: frame.candidateTransition ? keyFor(frame.candidateTransition) : null,
        breakdown: frame.candidateBreakdown ? keyFor(frame.candidateBreakdown) : null,
        noteSets: new Map(
            (frame.candidateNoteSets ?? []).map(noteSet => [keyFor(noteSet), noteSet] as const)
        ),
        target: frame.target ? keyFor(frame.target) : null,
    }), [frame]);

    const spotlightIsWholeUnit = useMemo(() => (
        Boolean(frame.unitCells?.length)
        && frame.spotlightCells.length === frame.unitCells?.length
        && frame.spotlightCells.every(cell => visual.unit.has(keyFor(cell)))
    ), [frame.spotlightCells, frame.unitCells, visual.unit]);

    const strokeLayers = useMemo(() => {
        const guideRectangles: HintGridRect[] = (frame.guideUnits ?? []).map(rectForUnit);
        const softRectangles: HintGridRect[] = [];
        const emphasisRectangles: HintGridRect[] = [];
        const unitRect = rectForCells(frame.unitCells ?? []);
        if (unitRect) {
            if (frame.unitStrokeTone === 'soft') softRectangles.push(unitRect);
            else emphasisRectangles.push(unitRect);
        }

        if (!spotlightIsWholeUnit) {
            frame.spotlightCells.forEach(cell => emphasisRectangles.push({
                top: cell.row,
                right: cell.col + 1,
                bottom: cell.row + 1,
                left: cell.col,
            }));
        }
        if (frame.target) {
            emphasisRectangles.push({
                top: frame.target.row,
                right: frame.target.col + 1,
                bottom: frame.target.row + 1,
                left: frame.target.col,
            });
        }
        (frame.candidateMarks ?? [])
            .filter(candidate => candidate.tone === 'possible' && !isColorChainFrame)
            .forEach(candidate => emphasisRectangles.push({
                top: candidate.row,
                right: candidate.col + 1,
                bottom: candidate.row + 1,
                left: candidate.col,
            }));

        if (frame.guideStrokeTone === 'soft') softRectangles.push(...guideRectangles);
        else emphasisRectangles.push(...guideRectangles);

        return {
            guide: createStrokeSegments(softRectangles),
            emphasis: createStrokeSegments(emphasisRectangles),
        };
    }, [frame, isColorChainFrame, spotlightIsWholeUnit]);

    return (
        <div
            key={frame.id}
            className="absolute inset-0 pointer-events-none hint-grid-overlay"
            style={{ zIndex: 45 }}
            aria-hidden="true"
        >
            <div
                className="absolute inset-0 grid"
                style={{
                    gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
                    gridTemplateRows: 'repeat(9, minmax(0, 1fr))',
                }}
            >
                {Array.from({ length: 81 }, (_, index) => {
                    const row = Math.floor(index / 9);
                    const col = index % 9;
                    const key = `${row}:${col}`;
                    const isSpotlight = visual.spotlight.has(key);
                    const isUnit = visual.unit.has(key);
                    const isContext = visual.context.has(key);
                    const isGuide = visual.guide.has(key);
                    const isSource = visual.source.has(key);
                    const isSupportSource = visual.supportSource.has(key);
                    const isTarget = visual.target === key;
                    const candidate = visual.candidates.get(key);
                    const isTransition = visual.transition === key;
                    const isBreakdown = visual.breakdown === key;
                    const noteSet = visual.noteSets.get(key);
                    const isRelevant = isSpotlight
                        || isUnit
                        || isContext
                        || (isGuide && guideCellsAreFocus)
                        || isSource
                        || isSupportSource
                        || isTarget
                        || isTransition
                        || isBreakdown
                        || Boolean(candidate)
                        || Boolean(noteSet);

                    return (
                        <div
                            key={key}
                            className={`relative flex items-center justify-center transition-colors duration-300 ${
                                frame.dimUnrelated && !isRelevant ? 'hint-grid-cell--dimmed' : ''
                            } ${isUnit ? 'hint-grid-cell--unit' : ''} ${
                                isSpotlight && !spotlightIsWholeUnit ? 'hint-grid-cell--spotlight' : ''
                            } ${isSource ? 'hint-grid-cell--source' : ''} ${
                                candidate?.tone === 'possible' ? 'hint-grid-cell--possible' : ''
                            } ${candidate?.tone === 'eliminated' ? 'hint-grid-cell--eliminated' : ''} ${
                                candidate?.tone === 'eliminated' && frame.fillEliminatedCells ? 'hint-grid-cell--elimination-focus' : ''
                            } ${isTarget ? 'hint-grid-cell--target' : ''} ${
                                isTarget && frame.fillTargetCell ? 'hint-grid-cell--target-filled' : ''
                            }`}
                        >
                            {noteSet && (
                                <HintNoteLayer
                                    notes={noteSet.marks}
                                    fontSize={noteFontSize}
                                    lineHeight={noteLineHeight}
                                />
                            )}
                            {!noteSet && isBreakdown && frame.candidateBreakdown && (
                                <HintNoteLayer
                                    notes={frame.candidateBreakdown.marks.map(mark => ({
                                        value: mark.value,
                                        tone: mark.tone,
                                    }))}
                                    fontSize={noteFontSize}
                                    lineHeight={noteLineHeight}
                                />
                            )}
                            {candidate && !isTransition && !isBreakdown && !noteSet && (candidate.tone === 'locked' || candidate.tone === 'possible') && (
                                <HintNoteLayer
                                    notes={[{
                                        value: candidate.value,
                                        tone: isColorChainFrame
                                            ? candidate.tone === 'locked'
                                                ? 'chain-a'
                                                : 'chain-b'
                                            : 'locked',
                                    }]}
                                    fontSize={noteFontSize}
                                    lineHeight={noteLineHeight}
                                />
                            )}
                            {candidate && !isTransition && !isBreakdown && !noteSet && candidate.tone === 'eliminated' && frame.eliminationStyle === 'candidate-slash' && (
                                <HintNoteLayer
                                    notes={[{ value: candidate.value, tone: 'removed' }]}
                                    fontSize={noteFontSize}
                                    lineHeight={noteLineHeight}
                                />
                            )}
                            {candidate && !isTransition && !isBreakdown && !noteSet && candidate.tone === 'eliminated' && frame.eliminationStyle !== 'candidate-slash' && (
                                <span
                                    className={`hint-grid-candidate hint-grid-candidate--${candidate.tone}`}
                                    style={{ fontSize: mainFontSize }}
                                >
                                    ×
                                </span>
                            )}
                            {candidate && !isTransition && !isBreakdown && !noteSet && candidate.tone === 'answer' && (
                                <span
                                    className="hint-grid-candidate hint-grid-candidate--answer"
                                    style={{ fontSize: mainFontSize }}
                                >
                                    {candidate.value}
                                </span>
                            )}
                            {isTransition && !isBreakdown && !noteSet && frame.candidateTransition && (
                                <HintNoteLayer
                                    notes={frame.candidateTransition.beforeCandidates.map(value => ({
                                        value,
                                        tone: frame.candidateTransition!.afterCandidates.includes(value)
                                            ? 'remaining'
                                            : 'removed',
                                    }))}
                                    fontSize={noteFontSize}
                                    lineHeight={noteLineHeight}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {strokeLayers.guide.length > 0 && (
                <HintStrokeLayer segments={strokeLayers.guide} tone="soft" />
            )}
            <HintStrokeLayer segments={strokeLayers.emphasis} />

        </div>
    );
};
