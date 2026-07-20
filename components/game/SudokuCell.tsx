
import React from 'react';
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
    isScribingCell: boolean;
    isNudgeCue?: boolean;
    settings: AppSettings;
    numberColor: string;
    onCellClick: (e: React.MouseEvent, r: number, c: number) => void;
    mainFontSize: string;
    noteFontSize: string;
    noteLineHeight: string;
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
    isScribingCell,
    isNudgeCue = false,
    settings,
    numberColor,
    onCellClick,
    mainFontSize,
    noteFontSize,
    noteLineHeight,
    onlyBackground = false,
    onlyContent = false
}) => {
    let cornerClass = '';
    if (r === 0 && c === 0) cornerClass = 'rounded-tl-[5px] ';
    else if (r === 0 && c === 8) cornerClass = 'rounded-tr-[5px] ';
    else if (r === 8 && c === 0) cornerClass = 'rounded-bl-[5px] ';
    else if (r === 8 && c === 8) cornerClass = 'rounded-br-[5px] ';

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
    
    if (isScribingCell) {
        classes += "scribe-cell-active z-40 relative ";
    }
    
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
                onCellClick(e, r, c);
            }} 
            style={{ fontSize: mainFontSize }}
        >
        {/* Cell Background Layer */}
        {!onlyContent && (
            <>
                <div className={`absolute inset-0 ${bgClass} ${cornerClass} sudoku-cell-bg pointer-events-none z-0`} />
                {isNudgeCue && (
                    <div className={`nudge-cell-cue absolute inset-0 ${cornerClass} pointer-events-none z-10`} aria-hidden="true" />
                )}
                {isScribingCell && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden="true">
                        <div className="scribe-cell-wash" />
                        <div className="scribe-scan-line" />
                    </div>
                )}
            </>
        )}
        
        {/* Cell Content Layer */}
        {!onlyBackground && (
            cell.value ? (
                <span className={`leading-none pt-[0.1em] relative z-20 ${!cell.isFixed && !isError && !isConflict && !isMarkedWrong && !isRevealed ? numberColor : ''}`}>
                    {cell.value}
                </span>
            ) : cell.notes.length > 0 ? (
                <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-[1px] pointer-events-none relative z-20">
                    {[1,2,3,4,5,6,7,8,9].map(n => {
                        const hasNote = cell.notes.includes(n);
                        if (!hasNote) {
                            return <div key={n} />;
                        }
                        return (
                            <div key={n} className="flex items-center justify-center leading-none" style={{ fontSize: noteFontSize, lineHeight: noteLineHeight }}>
                                <span
                                    className={`text-stone-500 dark:text-stone-400 font-medium ${isScribingCell ? 'scribe-note-arrive' : ''}`}
                                    style={isScribingCell ? { animationDelay: `${cell.notes.indexOf(n) * 45}ms` } : undefined}
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
