import React from 'react';

interface NumberPadProps {
    activeNumber: number | null;
    numberCounts: Record<number, number>;
    isPencilMode: boolean;
    numberColor: string;
    onNumberClick: (e: React.MouseEvent, num: number) => void;
}

export const NumberPad: React.FC<NumberPadProps> = ({
    activeNumber,
    numberCounts,
    isPencilMode,
    numberColor,
    onNumberClick
}) => {
    return (
        <div className="grid grid-cols-9 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                const isFullyPlaced = numberCounts[num] >= 9;
                const isActive = activeNumber === num;
                
                return (
                    // Removed 'border' and 'border-t-border'. Removed 'border-blue-600' when active.
                    <button key={num} onClick={(e) => onNumberClick(e, num)} className={`aspect-[4/5] flex items-center justify-center text-3xl font-medium rounded-lg shadow-sm active:shadow-none active:translate-y-[2px] transition-all ${isActive ? 'bg-blue-500 text-white' : 'bg-t-surface'} ${isFullyPlaced && !isActive ? 'opacity-25' : 'opacity-100'}`}>
                        <span className={isPencilMode && !isActive ? 'text-stone-500' : (isActive ? 'text-white' : numberColor)}>{num}</span>
                    </button>
                );
            })}
        </div>
    );
};