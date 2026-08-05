import React, { useEffect, useRef } from 'react';

interface NumberPadProps {
    activeNumber: number | null;
    numberCounts: Record<number, number>;
    isPencilMode: boolean;
    numberColor: string;
    onNumberClick: (e: React.MouseEvent, num: number) => void;
    onNumberLongPress: (e: React.MouseEvent, num: number) => void;
}

const LONG_PRESS_MS = 400;

const syntheticMouseEvent = () => ({
    stopPropagation: () => {},
    preventDefault: () => {}
} as React.MouseEvent);

export const NumberPad: React.FC<NumberPadProps> = ({
    activeNumber,
    numberCounts,
    isPencilMode,
    numberColor,
    onNumberClick,
    onNumberLongPress
}) => {
    const activeTouchNumberRef = useRef<number | null>(null);
    const longPressTimerRef = useRef<number | null>(null);
    const didLongPressRef = useRef(false);
    const suppressMouseClickRef = useRef(false);
    const lastTouchTimeRef = useRef(0);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const startLongPress = (num: number) => {
        clearLongPressTimer();
        didLongPressRef.current = false;
        if (!isPencilMode) return;

        longPressTimerRef.current = window.setTimeout(() => {
            didLongPressRef.current = true;
            suppressMouseClickRef.current = true;
            onNumberLongPress(syntheticMouseEvent(), num);
        }, LONG_PRESS_MS);
    };

    useEffect(() => () => clearLongPressTimer(), []);

    const numberAtTouch = (touch: React.Touch) => {
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const button = target?.closest('button[data-number]');
        if (!button) return null;
        const number = Number.parseInt(button.getAttribute('data-number') || '', 10);
        return number >= 1 && number <= 9 ? number : null;
    };

    const handleTouchStart = (event: React.TouchEvent) => {
        if (event.cancelable) event.preventDefault();
        const number = event.touches[0] ? numberAtTouch(event.touches[0]) : null;
        activeTouchNumberRef.current = number;
        didLongPressRef.current = false;
        if (number === null) return;

        if (isPencilMode) startLongPress(number);
        else onNumberClick(syntheticMouseEvent(), number);
    };

    const handleTouchMove = (event: React.TouchEvent) => {
        if (event.cancelable) event.preventDefault();
        const number = event.touches[0] ? numberAtTouch(event.touches[0]) : null;
        if (number === activeTouchNumberRef.current) return;

        clearLongPressTimer();
        activeTouchNumberRef.current = number;
        didLongPressRef.current = false;
        if (number === null) return;

        if (isPencilMode) startLongPress(number);
        else onNumberClick(syntheticMouseEvent(), number);
    };

    const handleTouchEnd = (event: React.TouchEvent) => {
        if (event.cancelable) event.preventDefault();
        clearLongPressTimer();
        const number = activeTouchNumberRef.current;
        if (isPencilMode && number !== null && !didLongPressRef.current) {
            onNumberClick(syntheticMouseEvent(), number);
        }
        activeTouchNumberRef.current = null;
        lastTouchTimeRef.current = Date.now();
        window.setTimeout(() => {
            suppressMouseClickRef.current = false;
        }, 500);
    };

    const handleTouchCancel = () => {
        clearLongPressTimer();
        activeTouchNumberRef.current = null;
        didLongPressRef.current = false;
        lastTouchTimeRef.current = Date.now();
    };

    const handleMouseDown = (num: number) => {
        if (Date.now() - lastTouchTimeRef.current < 500 || !isPencilMode) return;
        activeTouchNumberRef.current = num;
        startLongPress(num);
    };

    const handleMouseRelease = () => {
        clearLongPressTimer();
        activeTouchNumberRef.current = null;
    };

    const handleMouseClick = (event: React.MouseEvent, num: number) => {
        if (Date.now() - lastTouchTimeRef.current < 500) return;
        if (suppressMouseClickRef.current) {
            suppressMouseClickRef.current = false;
            return;
        }
        onNumberClick(event, num);
    };

    return (
        <div
            className="grid grid-cols-9 gap-1 md:gap-1.5 touch-none select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onContextMenu={(event) => event.preventDefault()}
        >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                const isFullyPlaced = numberCounts[num] >= 9;
                const isActive = activeNumber === num;

                return (
                    <button
                        key={num}
                        data-number={num}
                        onMouseDown={() => handleMouseDown(num)}
                        onMouseUp={handleMouseRelease}
                        onMouseLeave={handleMouseRelease}
                        onClick={(event) => handleMouseClick(event, num)}
                        className={`aspect-[4/5] flex items-center justify-center text-3xl md:text-4xl font-medium rounded-lg md:rounded-xl shadow-sm active:shadow-none active:translate-y-[2px] transition-all ${isActive ? 'bg-blue-500 text-white' : 'bg-t-surface'} ${isFullyPlaced && !isActive ? 'opacity-25' : 'opacity-100'}`}
                    >
                        <span
                            data-premium-number={num}
                            className={`pointer-events-none ${isPencilMode && !isActive ? 'text-stone-500' : (isActive ? 'text-white' : numberColor)}`}
                        >
                            {num}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
