
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
    isRevealingCell: boolean;
    animatingValue: number | null;
    settings: AppSettings;
    numberColor: string;
    onCellClick: (e: React.MouseEvent, r: number, c: number) => void;
    mainFontSize: string;
    noteFontSize: string;
    noteLineHeight: string;
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
    isRevealingCell,
    animatingValue,
    settings,
    numberColor,
    onCellClick,
    mainFontSize,
    noteFontSize,
    noteLineHeight
}) => {
    let classes = "w-full h-full flex items-center justify-center cursor-pointer select-none relative overflow-hidden ";
    
    let bgClass = ''; 

    // Dark Mode Color Strategy: 
    // The board background is Stone-300 (#d6d3d1) in Dark Mode.
    // Highlights are lighter (Stone-200) to stand out subtly without matching the Stone-500 grid lines.

    if (isRevealingCell) {
        // Keep default background during reveal init to prevent black flash from transparency
        bgClass = 'bg-t-board '; 
    } else if (isMarkedWrong) {
         // Scanner Detection: Bright Red Flash
         bgClass = 'bg-red-500 animate-pulse shadow-inner '; 
    } else if (isSelected && (isError || isConflict)) {
         // Selected Error:
         bgClass = 'bg-red-200 dark:bg-red-300 '; 
    } else if (isError || isConflict) {
         // Error:
         bgClass = 'bg-red-100 dark:bg-red-200 ';
    } else if (isSelected) {
         // Selected: Blue 200 (Light) / Blue 300 (Dark Mode - distinct but softer than 400)
         bgClass = 'bg-blue-200 dark:bg-blue-300 '; 
    } else if (highlight && isSameValue) {
         // Same Value: Blue 100 (was 50) / Blue 200 (Dark Mode)
         // Increased contrast for light mode visibility
         bgClass = 'bg-blue-100 dark:bg-blue-200 '; 
    } else if (highlight && isRelated) {
         // Related: Stone 100 (was 50) / Stone 200 (Dark Mode - lighter than board Stone-300)
         // Increased contrast for light mode visibility
         bgClass = 'bg-stone-100 dark:bg-stone-200 '; 
    } else if (isRevealed) {
         bgClass = 'bg-amber-100 '; 
    } else {
         bgClass = 'bg-t-board '; 
    }

    classes += bgClass;
    
    if (isRevealingCell) {
        classes += "animate-reveal-premium z-50 relative ";
    }
    
    if (cell.isFixed) {
        classes += "font-semibold text-stone-800 ";
    } else if (isRevealed) {
        classes += "font-semibold text-stone-800 ";
    } else {
        if (isMarkedWrong) {
            // Scanner Detection Text: White for contrast against bright red
            classes += "font-bold text-white ";
        } else if (isError || isConflict) {
            // Error Text: Dark red
            classes += "font-medium text-red-600 dark:text-red-700 ";
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
        {(cell.value || animatingValue !== null) ? (
            <span className={`leading-none pt-[0.1em] relative z-10 ${!cell.isFixed && !cell.isError && !cell.isMarkedWrong && !cell.isRevealed ? numberColor : ''}`}>
                {animatingValue !== null ? animatingValue : cell.value}
            </span>
        ) : (
            <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-[1px] pointer-events-none relative z-10">
                {[1,2,3,4,5,6,7,8,9].map(n => {
                    const noteClass = cell.notes.includes(n) 
                        ? 'text-stone-500 font-medium'
                        : 'invisible';
                        
                    return (
                        <div key={n} className="flex items-center justify-center leading-none" style={{ fontSize: noteFontSize, lineHeight: noteLineHeight }}>
                            <span className={noteClass}>{n}</span>
                        </div>
                    )
                })}
            </div>
        )}
        </div>
    );
};

export default React.memo(SudokuCell);
