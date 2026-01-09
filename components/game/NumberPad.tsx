
import React, { useRef } from 'react';

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
    const lastTouchedNumRef = useRef<number | null>(null);
    const lastTouchTimeRef = useRef<number>(0);

    const handleTouch = (e: React.TouchEvent) => {
        // Prevent default to disable scrolling and prevent phantom click events on mobile
        if (e.cancelable && e.type !== 'touchend') e.preventDefault();
        
        lastTouchTimeRef.current = Date.now();

        const touch = e.touches[0];
        if (!touch) return;

        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (target) {
            // Find closest button parent if we hit the span number or padding
            const button = target.closest('button[data-number]');
            if (button) {
                const num = parseInt(button.getAttribute('data-number') || '0', 10);
                
                // Only trigger if we moved to a NEW number
                if (num > 0 && num !== lastTouchedNumRef.current) {
                    lastTouchedNumRef.current = num;
                    // Create a synthetic event for the handler
                    const syntheticEvent = { 
                        stopPropagation: () => {}, 
                        preventDefault: () => {} 
                    } as React.MouseEvent;
                    
                    onNumberClick(syntheticEvent, num);
                }
            }
        }
    };

    const handleTouchEnd = () => {
        lastTouchedNumRef.current = null;
        lastTouchTimeRef.current = Date.now();
    };

    const handleMouseClick = (e: React.MouseEvent, num: number) => {
        // Ignore clicks that happen immediately after a touch event (phantom clicks)
        if (Date.now() - lastTouchTimeRef.current < 500) return;
        onNumberClick(e, num);
    };

    return (
        <div 
            className="grid grid-cols-9 gap-1 touch-none select-none"
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
            onTouchEnd={handleTouchEnd}
        >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                const isFullyPlaced = numberCounts[num] >= 9;
                const isActive = activeNumber === num;
                
                return (
                    <button 
                        key={num} 
                        data-number={num}
                        onClick={(e) => handleMouseClick(e, num)} 
                        className={`aspect-[4/5] flex items-center justify-center text-3xl font-medium rounded-lg shadow-sm active:shadow-none active:translate-y-[2px] transition-all ${isActive ? 'bg-blue-500 text-white' : 'bg-t-surface'} ${isFullyPlaced && !isActive ? 'opacity-25' : 'opacity-100'}`}
                    >
                        <span className={`pointer-events-none ${isPencilMode && !isActive ? 'text-stone-500' : (isActive ? 'text-white' : numberColor)}`}>{num}</span>
                    </button>
                );
            })}
        </div>
    );
};
