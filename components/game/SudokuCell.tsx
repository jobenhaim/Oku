
import React, { useEffect, useRef } from 'react';
import { Cell, AppSettings } from '../../types';

interface SudokuCellProps {
    r: number;
    c: number;
    cell: Cell;
    isConflict: boolean;
    isError: boolean;
    isMarkedWrong: boolean;
    isRevealed: boolean;
    isSelected: boolean;
    isSameValue: boolean;
    isRelated: boolean;
    highlight: boolean;
    isGuardRejected?: boolean;
    isNudgeCue?: boolean;
    settings: AppSettings;
    numberColor: string;
    placementShineKey?: number;
    onCellClick: (e: React.MouseEvent, r: number, c: number) => void;
    onCellLongPress?: (r: number, c: number) => void;
    enableLongPress?: boolean;
    mainFontSize: string;
    noteFontSize: string;
    noteLineHeight: string;
    hideNotes?: boolean;
    onlyBackground?: boolean;
    onlyContent?: boolean;
}

const SudokuCell: React.FC<SudokuCellProps> = ({
    r,
    c,
    cell,
    isConflict,
    isError,
    isMarkedWrong,
    isRevealed,
    isSelected,
    isSameValue,
    isRelated,
    highlight,
    isGuardRejected = false,
    isNudgeCue = false,
    settings,
    numberColor,
    placementShineKey,
    onCellClick,
    onCellLongPress,
    enableLongPress = false,
    mainFontSize,
    noteFontSize,
    noteLineHeight,
    hideNotes = false,
    onlyBackground = false,
    onlyContent = false
}) => {
    const longPressTimerRef = useRef<number | null>(null);
    const didLongPressRef = useRef(false);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    useEffect(() => () => clearLongPressTimer(), []);

    const handlePointerDown = (e: React.PointerEvent) => {
        clearLongPressTimer();
        didLongPressRef.current = false;
        pointerStartRef.current = { x: e.clientX, y: e.clientY };
        if (!enableLongPress || !onCellLongPress) return;

        longPressTimerRef.current = window.setTimeout(() => {
            longPressTimerRef.current = null;
            didLongPressRef.current = true;
            onCellLongPress(r, c);
        }, 400);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const start = pointerStartRef.current;
        if (!start) return;

        // A drag is an exploration gesture, not a long press.
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 8) {
            clearLongPressTimer();
        }
    };

    const handlePointerRelease = () => {
        clearLongPressTimer();
        pointerStartRef.current = null;
    };

    let cornerClass = '';
    if (r === 0 && c === 0) cornerClass = 'rounded-tl-[6px] ';
    else if (r === 0 && c === 8) cornerClass = 'rounded-tr-[6px] ';
    else if (r === 8 && c === 0) cornerClass = 'rounded-bl-[6px] ';
    else if (r === 8 && c === 8) cornerClass = 'rounded-br-[6px] ';

    let classes = `w-full h-full flex items-center justify-center cursor-pointer select-none relative sudoku-cell ${cornerClass}`;
    
    let bgClass = ''; 

    // Dark Mode Color Strategy: 
    // The board background is Stone-800 (#292524) in Dark Mode.
    // Highlights must be darker or translucent to blend nicely.

    if (isMarkedWrong) {
         // Scanner Detection: Bright Red Flash
         bgClass = 'bg-red-500 animate-pulse shadow-inner '; 
    } else if (isSelected && (isError || isConflict)) {
         // Selected Error: 20% more red/saturated
         bgClass = 'bg-red-200/90 dark:bg-red-900/80 z-20 '; 
    } else if (isError || isConflict) {
         // Error: 20% more red/saturated
         bgClass = 'bg-red-100 dark:bg-red-950/60 z-10 ';
    } else if (isSelected) {
         // Selected: Blue 200 (Light) / Dark Blue (Dark Mode)
         bgClass = 'bg-blue-200 dark:bg-blue-900 '; 
    } else if (highlight && isSameValue) {
         // Same Value: Blue 100 / Translucent Dark Blue
         bgClass = 'bg-blue-100 dark:bg-blue-900/60 '; 
    } else if (highlight && isRelated) {
         // Related: Stone 100 / Stone 700 (Slightly lighter than base 800 for visibility)
         bgClass = 'bg-stone-100 dark:bg-stone-700 '; 
    } else if (isRevealed) {
         bgClass = 'bg-amber-100 dark:bg-amber-900 '; 
    } else {
         bgClass = 'bg-transparent '; 
    }
    
    if (isGuardRejected) classes += "guard-note-rejected z-40 ";
    
    if (cell.isFixed) {
        classes += "font-semibold text-stone-800 dark:text-stone-200 ";
    } else if (isRevealed) {
        classes += "font-semibold text-stone-800 dark:text-stone-200 ";
    } else {
        if (isMarkedWrong) {
            // Scanner Detection Text: stay black/dark and same font-medium, not bold/black
            classes += "font-medium text-stone-900 dark:text-stone-900 ";
        } else if (isError || isConflict) {
            // Error Text: Bright red, keeping original font-medium
            classes += "font-medium text-red-500 dark:text-red-500 ";
        } else {
            classes += "font-medium ";
        }
    }

    return (
        <div 
            className={classes} 
            onClick={(e) => {
                e.stopPropagation();
                if (didLongPressRef.current) {
                    didLongPressRef.current = false;
                    return;
                }
                onCellClick(e, r, c);
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerRelease}
            onContextMenu={(e) => {
                if (enableLongPress) e.preventDefault();
            }}
            style={{ fontSize: mainFontSize }}
        >
        {/* Cell Background Layer */}
        {!onlyContent && (
            <>
                <div className={`absolute inset-0 ${bgClass} ${cornerClass} sudoku-cell-bg pointer-events-none z-0`} />
                {isSelected && isMarkedWrong && (
                    <div
                        className={`absolute inset-0 ${cornerClass} pointer-events-none z-10 shadow-[inset_0_0_0_3px_rgba(59,130,246,0.95)] dark:shadow-[inset_0_0_0_3px_rgba(96,165,250,1)]`}
                        aria-hidden="true"
                    />
                )}
                {isNudgeCue && !isSelected && (
                    <div className={`nudge-cell-cue absolute inset-0 ${cornerClass} pointer-events-none z-10`} aria-hidden="true" />
                )}
            </>
        )}
        
        {/* Cell Content Layer */}
        {!onlyBackground && (
            cell.value ? (
                <span
                    key={`value-${cell.value}-${placementShineKey ?? 0}`}
                    data-premium-number={cell.value}
                    className={`leading-none pt-[0.1em] relative z-20 ${!cell.isFixed && !isError && !isConflict && !isMarkedWrong && !isRevealed ? numberColor : ''} ${placementShineKey !== undefined ? 'premium-number-placement-shine' : ''}`}
                >
                    {cell.value}
                </span>
            ) : cell.notes.length > 0 ? (
                <div
                    className={`grid grid-cols-3 grid-rows-3 w-full h-full p-[1px] pointer-events-none relative z-20 ${
                        hideNotes ? 'opacity-0' : 'opacity-100'
                    }`}
                    aria-hidden={hideNotes}
                >
                    {[1,2,3,4,5,6,7,8,9].map(n => {
                        const hasNote = cell.notes.includes(n);
                        if (!hasNote) {
                            return <div key={n} />;
                        }
                        return (
                            <div key={n} className="flex items-center justify-center leading-none" style={{ fontSize: noteFontSize, lineHeight: noteLineHeight }}>
                                <span
                                    className="text-stone-500 dark:text-stone-400 font-medium"
                                >{n}</span>
                            </div>
                        )
                    })}
                </div>
            ) : null
        )}
        </div>
    );
};

export default React.memo(SudokuCell);
