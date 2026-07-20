import React, { useState, useEffect, useRef } from 'react';
import { sounds } from '../../utils/sound';
import { easeInOut } from '../../utils/animation';

interface AnimatedNumberProps {
    value: number;
    className?: string;
    startFromZero?: boolean;
    easing?: 'quarticOut' | 'easeInOut';
    durationMs?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className = "", startFromZero = false, easing = 'easeInOut', durationMs }) => {
    const [displayValue, setDisplayValue] = useState(startFromZero ? 0 : value);
    const startValue = useRef(startFromZero ? 0 : value);
    const startTime = useRef<number | null>(null);
    const rafId = useRef<number | null>(null);
    const lastSoundValue = useRef(startFromZero ? 0 : value);

    useEffect(() => {
        if (value === displayValue && rafId.current === null) return;
        
        // Capture starting state
        startValue.current = displayValue;
        startTime.current = null;
        lastSoundValue.current = displayValue;
        
        // Calculate difference to determine duration
        const delta = Math.abs(value - displayValue);
        
        // Dynamic duration: Longer animation for bigger numbers
        // Base 600ms + 100ms per unit difference, capped at 4000ms (4 seconds)
        const duration = durationMs ?? Math.min(4000, 600 + (delta * 100));

        const animate = (time: number) => {
            if (!startTime.current) startTime.current = time;
            const progress = Math.min((time - startTime.current) / duration, 1);
            
            const ease = easing === 'easeInOut'
                ? easeInOut(progress)
                : 1 - Math.pow(1 - progress, 4);
            
            const current = Math.floor(startValue.current + (value - startValue.current) * ease);
            
            if (current !== lastSoundValue.current) {
                sounds.playCounterTick();
                lastSoundValue.current = current;
            }

            setDisplayValue(current);

            if (progress < 1) {
                rafId.current = requestAnimationFrame(animate);
            } else {
                setDisplayValue(value);
                // Ensure final sound if needed
                if (value !== lastSoundValue.current) {
                    sounds.playCounterTick();
                    lastSoundValue.current = value;
                }
                rafId.current = null;
            }
        };

        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(animate);

        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, [value, easing, durationMs]);

    return <span className={className}>{displayValue}</span>;
};
