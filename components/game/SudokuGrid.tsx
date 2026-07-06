import React, { useMemo } from 'react';
import { Board, Cell, AppSettings } from '../../types';
import SudokuCell from './SudokuCell';

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

export const SudokuGrid: React.FC<SudokuGridProps> = React.memo(({
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
    // iPad Fix: Clamp max size to 500px so font calc stops growing when container stops growing
    const squareSize = 'min(96vw, 53dvh, 500px)';
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

    const getSectionOverlayStyle = (sectionId: string) => {
        if (sectionId === 'full-board') {
            return {
                position: 'absolute' as const,
                pointerEvents: 'none' as const,
                zIndex: 2,
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderWidth: '8px' 
            };
        }

        const [typeAndIdx] = sectionId.split(':');
        const [type, idxStr] = typeAndIdx.split('_');
        const index = parseInt(idxStr);
        const style: React.CSSProperties = { position: 'absolute', pointerEvents: 'none', zIndex: 2 };
        
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
                className="bg-t-board rounded-lg overflow-hidden relative flex-none shadow-lg" 
                style={{ 
                    width: squareSize, 
                    height: squareSize, 
                    maxWidth: '500px', 
                    maxHeight: '500px',
                    clipPath: 'inset(0 round 8px)',
                    WebkitClipPath: 'inset(0 round 8px)'
                }}
            >
            
            {/* Inner Grid Area (Inset to sit perfectly inside the 3px outer border) */}
            <div 
                className="absolute inset-[3px] rounded-[5px] overflow-hidden z-10 bg-t-board"
                style={{
                    clipPath: 'inset(0 round 5px)',
                    WebkitClipPath: 'inset(0 round 5px)'
                }}
            >
                {isScanning && (
                    <div className="absolute left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] z-40 animate-scan pointer-events-none"></div>
                )}
                
                {/* Layer 1: Backgrounds Grid (z-1) */}
                <div 
                    className="grid w-full h-full absolute inset-0" 
                    style={{ 
                        gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', 
                        gridTemplateRows: 'repeat(9, minmax(0, 1fr))', 
                        zIndex: 1,
                    }}
                >
                    {board.map((row, rIndex) => row.map((cell, cIndex) => {
                        const isAnimating = animatingCell?.r === rIndex && animatingCell?.c === cIndex;
                        const isConflict = conflicts.has(`${rIndex}-${cIndex}`);
                        const isSelected = selectedCell ? (selectedCell[0] === rIndex && selectedCell[1] === cIndex) : false;
                        
                        let isSameValue = false;
                        if (cell.value !== null && highlightedValue !== null) {
                            isSameValue = cell.value === highlightedValue;
                        }
                    
                        const isRelated = selectedCell && (selectedCell[0] === rIndex || selectedCell[1] === cIndex || (Math.floor(selectedCell[0]/3) === Math.floor(rIndex/3) && Math.floor(selectedCell[1]/3) === Math.floor(cIndex/3)));
                        const isRevealingCell = revealingCell?.r === rIndex && revealingCell?.c === cIndex;

                        return (
                            <SudokuCell
                                key={`bg-${rIndex}-${cIndex}`}
                                r={rIndex}
                                c={cIndex}
                                cell={cell}
                                isConflict={isConflict}
                                isError={!!cell.isError}
                                isMarkedWrong={!!cell.isMarkedWrong}
                                isRevealed={!!cell.isRevealed}
                                isSelected={isSelected}
                                isSameValue={isSameValue}
                                isRelated={!!isRelated}
                                highlight={settings.highlight}
                                isRevealingCell={isRevealingCell}
                                animatingValue={isAnimating ? animatingCell!.value : null}
                                settings={settings}
                                numberColor={numberColor}
                                onCellClick={() => {}}
                                mainFontSize={mainFontSize}
                                noteFontSize={noteFontSize}
                                noteLineHeight={noteLineHeight}
                                onlyBackground={true}
                            />
                        );
                    }))}
                </div>

                {/* Layer 2: Animating Overlays (Ripples) (z-2) */}
                <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{ 
                        zIndex: 2,
                    }}
                >
                    {Array.from(animatingSections).map((sectionId: string) => {
                        if (sectionId === 'full-board') {
                            return (
                                <div 
                                    key={sectionId} 
                                    className="completion-sweep-board"
                                    style={getSectionOverlayStyle(sectionId)}
                                />
                            );
                        }

                        return (
                            <div 
                                key={sectionId} 
                                className="absolute pointer-events-none rounded-sm bg-emerald-500 dark:bg-emerald-400 animate-section-fade"
                                style={getSectionOverlayStyle(sectionId)}
                            />
                        );
                    })}
                </div>

                {/* Grid Lines (Rendered at z-10 on top of cell backgrounds and ripples, but below text) */}
                <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{ 
                        zIndex: 10,
                    }}
                >
                    <svg width="100%" height="100%" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }} shapeRendering="crispEdges">
                        <defs>
                            <style>{`
                                .grid-line-thin { 
                                    stroke: var(--grid-thin); 
                                    stroke-width: 1px; 
                                    vector-effect: non-scaling-stroke; 
                                    shape-rendering: crispEdges;
                                } 
                                .grid-line-thick { 
                                    stroke: var(--grid-thick); 
                                    stroke-width: 3px; 
                                    vector-effect: non-scaling-stroke; 
                                    shape-rendering: crispEdges;
                                } 
                            `}</style>
                        </defs>
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

                {/* Layer 3: Interactive Numbers & Notes Grid (z-20) */}
                <div 
                    className="grid w-full h-full absolute inset-0" 
                    style={{ 
                        gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', 
                        gridTemplateRows: 'repeat(9, minmax(0, 1fr))', 
                        zIndex: 20,
                    }}
                >
                    {board.map((row, rIndex) => row.map((cell, cIndex) => {
                        const isAnimating = animatingCell?.r === rIndex && animatingCell?.c === cIndex;
                        const isConflict = conflicts.has(`${rIndex}-${cIndex}`);
                        const isSelected = selectedCell ? (selectedCell[0] === rIndex && selectedCell[1] === cIndex) : false;
                        
                        let isSameValue = false;
                        if (cell.value !== null && highlightedValue !== null) {
                            isSameValue = cell.value === highlightedValue;
                        }
                    
                        const isRelated = selectedCell && (selectedCell[0] === rIndex || selectedCell[1] === cIndex || (Math.floor(selectedCell[0]/3) === Math.floor(rIndex/3) && Math.floor(selectedCell[1]/3) === Math.floor(cIndex/3)));
                        const isRevealingCell = revealingCell?.r === rIndex && revealingCell?.c === cIndex;

                        return (
                            <SudokuCell
                                key={`content-${rIndex}-${cIndex}`}
                                r={rIndex}
                                c={cIndex}
                                cell={cell}
                                isConflict={isConflict}
                                isError={!!cell.isError}
                                isMarkedWrong={!!cell.isMarkedWrong}
                                isRevealed={!!cell.isRevealed}
                                isSelected={isSelected}
                                isSameValue={isSameValue}
                                isRelated={!!isRelated}
                                highlight={settings.highlight}
                                isRevealingCell={isRevealingCell}
                                animatingValue={isAnimating ? animatingCell!.value : null}
                                settings={settings}
                                numberColor={numberColor}
                                onCellClick={onCellClick}
                                mainFontSize={mainFontSize}
                                noteFontSize={noteFontSize}
                                noteLineHeight={noteLineHeight}
                                onlyContent={true}
                            />
                        );
                    }))}
                </div>
            </div>
            
            {/* Crisp vector overlay outer border on top of grid lines and cell backgrounds */}
            <div className="absolute inset-0 rounded-lg border-[3px] border-stone-900 dark:border-stone-800 pointer-events-none z-30" />

         </div>
         </div>
    );
});