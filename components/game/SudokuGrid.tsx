
import React, { useMemo } from 'react';
import { Board, Cell, AppSettings } from '../../types';

interface SudokuGridProps {
    board: Board;
    selectedCell: [number, number] | null;
    activeNumber: number | null;
    conflicts: Set<string>;
    revealingCell: {r: number, c: number} | null;
    animatingCell: {r: number, c: number, value: number} | null;
    isScanning: boolean;
    animatingSections: Set<string>;
    settings: AppSettings;
    numberColor: string;
    onCellClick: (e: React.MouseEvent, r: number, c: number) => void;
}

export const SudokuGrid: React.FC<SudokuGridProps> = ({
    board,
    selectedCell,
    activeNumber,
    conflicts,
    revealingCell,
    animatingCell,
    isScanning,
    animatingSections,
    settings,
    numberColor,
    onCellClick
}) => {
    const squareSize = 'min(96vw, 53dvh)';
    const mainFontSize = `calc(${squareSize} / 9 * 0.6)`;
    const noteFontSize = `calc(${squareSize} / 9 * 0.22)`;
    const noteLineHeight = `calc(${squareSize} / 9 * 0.25)`;

    // Calculate the currently highlighted value based on active input or selected cell
    const highlightedValue = useMemo(() => {
        if (activeNumber !== null) return activeNumber;
        if (selectedCell) {
            return board[selectedCell[0]][selectedCell[1]].value;
        }
        return null;
    }, [activeNumber, selectedCell, board]);

    const getCellClass = (cell: Cell, r: number, c: number) => {
        let classes = "w-full h-full flex items-center justify-center cursor-pointer select-none relative overflow-hidden ";
        const isConflict = conflicts.has(`${r}-${c}`);
        const isError = cell.isError;
        const isMarkedWrong = cell.isMarkedWrong;
        const isRevealed = cell.isRevealed;
        
        const isSelected = selectedCell ? (selectedCell[0] === r && selectedCell[1] === c) : false;
        
        // Check if cell matches highlighted value for background highlight
        let isSameValue = false;
        if (cell.value !== null && highlightedValue !== null) {
            isSameValue = cell.value === highlightedValue;
        }
    
        const isRelated = selectedCell && (selectedCell[0] === r || selectedCell[1] === c || (Math.floor(selectedCell[0]/3) === Math.floor(r/3) && Math.floor(selectedCell[1]/3) === Math.floor(c/3)));
        
        let bgClass = ''; 
        const isThisCellRevealing = revealingCell?.r === r && revealingCell?.c === c;
    
        if (isThisCellRevealing) {
            bgClass = ''; 
        } else if (isMarkedWrong) {
             // Scanner Detection: Bright Red Flash
             bgClass = 'bg-red-500 animate-pulse shadow-inner '; 
        } else if (isSelected && (isError || isConflict)) {
             // Selected Error: Noticeable Red
             bgClass = 'bg-red-200 dark:bg-red-900 '; 
        } else if (isError || isConflict) {
             // Error: Increased visibility
             bgClass = 'bg-red-100 dark:bg-red-900/50 ';
        } else if (isSelected) {
             bgClass = 'bg-blue-200 dark:bg-blue-500 '; // Selected: Blue 200 (Lighter)
        } else if (settings.highlight && isSameValue) {
             bgClass = 'bg-blue-100 dark:bg-blue-600/40 '; // Same Value: Blue 100
        } else if (settings.highlight && isRelated) {
             // Related: Grey (stone-100) instead of Blue
             bgClass = 'bg-stone-100 dark:bg-black/10 '; 
        } else if (isRevealed) {
             bgClass = 'bg-amber-100 '; 
        } else {
             bgClass = 'bg-t-board '; 
        }
    
        classes += bgClass;
        
        if (isThisCellRevealing) {
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
                // Error Text: Darker red for visibility
                classes += "font-medium text-red-600 dark:text-red-300 ";
            } else {
                classes += "font-medium ";
            }
        }
        return classes;
    };

    const getSectionOverlayStyle = (sectionId: string) => {
        if (sectionId === 'full-board') {
            return {
                position: 'absolute' as const,
                pointerEvents: 'none' as const,
                zIndex: 60,
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderWidth: '8px' // Make completion border more prominent
            };
        }

        const [type, idxStr] = sectionId.split('-');
        const index = parseInt(idxStr);
        const style: React.CSSProperties = { position: 'absolute', pointerEvents: 'none', zIndex: 60 };
        
        if (type === 'row') {
            style.top = `${(index / 9) * 100}%`;
            style.left = '0';
            style.width = '100%';
            style.height = `${100 / 9}%`;
        } else if (type === 'col') {
            style.left = `${(index / 9) * 100}%`;
            style.top = '0';
            style.height = '100%';
            style.width = `${100 / 9}%`;
        } else if (type === 'box') {
            const r = Math.floor(index / 3);
            const c = index % 3;
            style.top = `${(r * 3 / 9) * 100}%`;
            style.left = `${(c * 3 / 9) * 100}%`;
            style.width = `${100 / 3}%`;
            style.height = `${100 / 3}%`;
        }
        return style;
    };

    return (
        <div className="flex-none w-full flex flex-col items-center justify-start min-h-0 px-0 pb-2 pt-[10px]">
            <div 
                className="bg-stone-900 rounded-lg overflow-hidden relative flex-none shadow-lg border-[3px] border-stone-900" 
                style={{ 
                    width: squareSize, 
                    height: squareSize, 
                    maxWidth: '500px', 
                    maxHeight: '500px'
                }}
            >
            
            {/* Main Border Overlay Removed - Now handled by container border */}

            {isScanning && (
                <div className="absolute left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] z-30 animate-scan pointer-events-none"></div>
            )}
            
            <div className="absolute inset-0 pointer-events-none z-20">
                <svg width="100%" height="100%" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                    <defs><style>{`.grid-line-thin { stroke: #a8a29e; stroke-width: 0.05; } .grid-line-thick { stroke: #1c1917; stroke-width: 0.05; } `}</style></defs>
                    <line x1="1" y1="0" x2="1" y2="9" className="grid-line-thin" /><line x1="2" y1="0" x2="2" y2="9" className="grid-line-thin" />
                    <line x1="4" y1="0" x2="4" y2="9" className="grid-line-thin" /><line x1="5" y1="0" x2="5" y2="9" className="grid-line-thin" />
                    <line x1="7" y1="0" x2="7" y2="9" className="grid-line-thin" /><line x1="8" y1="0" x2="8" y2="9" className="grid-line-thin" />
                    <line x1="0" y1="1" x2="9" y2="1" className="grid-line-thin" /><line x1="0" y1="2" x2="9" y2="2" className="grid-line-thin" />
                    <line x1="0" y1="4" x2="9" y2="4" className="grid-line-thin" /><line x1="0" y1="5" x2="9" y2="5" className="grid-line-thin" />
                    <line x1="0" y1="7" x2="9" y2="7" className="grid-line-thin" /><line x1="0" y1="8" x2="9" y2="8" className="grid-line-thin" />
                    <line x1="3" y1="0" x2="3" y2="9" className="grid-line-thick" /><line x1="6" y1="0" x2="6" y2="9" className="grid-line-thick" />
                    <line x1="0" y1="3" x2="9" y2="3" className="grid-line-thick" /><line x1="0" y1="6" x2="9" y2="6" className="grid-line-thick" />
                </svg>
            </div>

            <div className="grid w-full h-full relative z-10" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gridTemplateRows: 'repeat(9, minmax(0, 1fr))' }}>
            {board.map((row, rIndex) => row.map((cell, cIndex) => {
                    const isAnimating = animatingCell?.r === rIndex && animatingCell?.c === cIndex;

                    return (
                        <div 
                            key={`${rIndex}-${cIndex}`} 
                            className={getCellClass(cell, rIndex, cIndex)} 
                            onClick={(e) => {
                                e.stopPropagation();
                                onCellClick(e, rIndex, cIndex);
                            }} 
                            style={{ fontSize: mainFontSize }}
                        >
                        {(cell.value || isAnimating) ? (
                            <span className={`leading-none pt-[0.1em] relative z-10 ${!cell.isFixed && !cell.isError && !cell.isMarkedWrong && !cell.isRevealed ? numberColor : ''}`}>
                                {isAnimating ? animatingCell!.value : cell.value}
                            </span>
                        ) : (
                            <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-[1px] pointer-events-none relative z-10">
                                {[1,2,3,4,5,6,7,8,9].map(n => {
                                    // BOLD NOTE LOGIC
                                    const isNoteActive = n === highlightedValue;
                                    const noteClass = cell.notes.includes(n) 
                                        ? (isNoteActive 
                                            ? 'text-stone-900 dark:text-stone-100 font-black scale-110 transition-transform' 
                                            : 'text-stone-500 font-medium')
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
                })
            )}
            </div>
            
            {/* Section/Board Completion Borders */}
            {Array.from(animatingSections).map((sectionId: string) => (
                 <div 
                    key={sectionId} 
                    className={`absolute box-border border-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.9)] animate-section-complete ${sectionId === 'full-board' ? 'rounded-lg border-4' : 'rounded-sm border-2'}`}
                    style={getSectionOverlayStyle(sectionId)}
                 />
            ))}
         </div>
         </div>
    );
};
