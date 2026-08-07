import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { sounds } from '../../utils/sound';
import { easeOut } from '../../utils/animation';

interface WelcomeGiftModalProps {
    onClose: (diamonds: number) => void;
}

export const WelcomeGiftModal: React.FC<WelcomeGiftModalProps> = ({ onClose }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [count, setCount] = useState(0);
    const [hasStarted, setHasStarted] = useState(false);

    // Play welcome gift sound upon opening
    useEffect(() => {
        sounds.playUniversalGiftClaim();
    }, []);

    // Core counting logic
    useEffect(() => {
        setHasStarted(true);
        const duration = 1000;
        const target = 200;
        const startTime = performance.now();
        let lastValue = 0;

        let frameId: number;
        const updateCounter = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = easeOut(progress);
            const currentValue = Math.floor(easedProgress * target);

            if (currentValue !== lastValue) {
                setCount(currentValue);
                sounds.playCounterTick();
                lastValue = currentValue;
            }

            if (progress < 1) {
                frameId = requestAnimationFrame(updateCounter);
            } else {
                setCount(target);
            }
        };

        frameId = requestAnimationFrame(updateCounter);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, []);

    const handleAction = () => {
        if (isClosing) return;
        sounds.playUniversalGiftClaim();
        setIsClosing(true);
        setTimeout(() => {
            onClose(200);
        }, 300);
    };

    return (
        <div 
            className={`fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        >
            <div 
                className={`bg-t-surface p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-xs md:max-w-sm text-center border border-stone-100 dark:border-stone-900 transition-colors duration-300 relative ${isClosing ? 'animate-fade-out' : 'animate-pop'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Gift Icon Box */}
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-950/30 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-500 shadow-inner">
                    <Icons.Gift className="w-10 h-10" />
                </div>

                {/* Nice message */}
                <h3 className="text-2xl font-black text-t-primary mb-3 tracking-tight">Welcome Gift!</h3>
                <p className="text-sm text-t-secondary font-semibold leading-relaxed mb-6 px-1">
                    Thank you for downloading<br />
                    <span className="text-t-primary font-bold">Oku: Sudoku</span>.<br />
                    Here's a little gift from us!
                </p>

                {/* Counter displaying diamonds */}
                <div className="bg-stone-50 dark:bg-stone-950/40 rounded-2xl py-4 px-6 flex items-center justify-center gap-3 mb-8 border border-stone-100/80 dark:border-stone-800/30 shadow-sm">
                    <div className="flex flex-col items-end leading-none">
                        <span className="text-3xl font-extrabold tracking-tight text-t-primary min-w-[70px] text-right tabular-nums">
                            {count}
                        </span>
                    </div>
                    <Icons.Diamond className="w-8 h-8 text-blue-500 fill-current" />
                </div>

                {/* "Great!" Claim Button */}
                <button 
                    onClick={handleAction} 
                    className="w-full py-4 text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-base select-none"
                >
                    Great!
                </button>
            </div>
        </div>
    );
};
