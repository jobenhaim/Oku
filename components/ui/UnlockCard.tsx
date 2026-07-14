
import React, { useRef, useState, useEffect } from 'react';
import { Icons } from './Icons';
import { sounds } from '../../utils/sound';

interface UnlockCardProps {
    startLevel: number;
    endLevel: number;
    completedCount: number;
    totalBaseLevels: number;
    cost: number;
    onUnlock: () => void;
}

export const UnlockCard: React.FC<UnlockCardProps> = ({ startLevel, endLevel, completedCount, totalBaseLevels, cost, onUnlock }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [animatedPercent, setAnimatedPercent] = useState(0);
    const [animatedCount, setAnimatedCount] = useState(0);
    const [showUnlockUI, setShowUnlockUI] = useState(false);
    
    // Calculate percentage (capped at 100%)
    const rawPercent = Math.min(100, Math.floor((completedCount / totalBaseLevels) * 100));

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                    setAnimatedPercent(0); // Reset for replay
                    setAnimatedCount(0); // Reset count
                    setShowUnlockUI(false); // Reset UI state
                }
            },
            { threshold: 0.2 } // Trigger when 20% visible
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let stopSound: (() => void) | undefined;

        if (isVisible) {
            // Progressive Duration: 
            // 1% -> fast (~300ms)
            // 99% -> slow (~3000ms)
            const duration = rawPercent <= 0 ? 0 : 300 + (rawPercent / 100) * 2700;

            // Play fill sound if there is progress to show
            if (rawPercent > 0) {
               stopSound = sounds.playProgressFill(duration / 1000);
            }

            const startTime = performance.now();

            const animate = (time: number) => {
                const elapsed = time - startTime;
                const progress = duration === 0 ? 1 : Math.min(elapsed / duration, 1);
                // Linear ease fits loading bars better for sound synchronization
                const ease = progress; 
                
                setAnimatedPercent(Math.floor(rawPercent * ease));
                setAnimatedCount(Math.floor(completedCount * ease));

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setAnimatedPercent(rawPercent);
                    setAnimatedCount(completedCount);
                    if (rawPercent === 100) {
                        // Wait a moment after hitting 100% before showing the unlock button
                        setTimeout(() => {
                            setShowUnlockUI(true);
                            sounds.playUnlockReady();
                        }, 500);
                    }
                }
            };
            requestAnimationFrame(animate);
        }
        
        return () => {
            if (stopSound) stopSound();
        };
    }, [isVisible, rawPercent, completedCount]);

    const handleUnlockClick = () => {
        if (!showUnlockUI) return;
        onUnlock();
    };

    return (
        <div ref={cardRef} className="w-full max-w-md mt-6 px-1">
            <button 
                onClick={handleUnlockClick}
                disabled={!showUnlockUI}
                className={`w-full h-36 rounded-[1.5rem] relative overflow-hidden transition-all duration-500 ease-out group ${
                    showUnlockUI 
                        ? 'bg-white dark:bg-stone-800 shadow-lg active:scale-[0.98] cursor-pointer'
                        : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-[0_1px_3px_rgba(15,23,42,0.04)] cursor-default'
                }`}
            >
                {/* Content Container */}
                <div className="absolute inset-0 flex items-center justify-center px-6">
                    {showUnlockUI ? (
                        <div className="flex flex-row items-center justify-between w-full animate-fade-in relative z-10 gap-2">
                             
                             {/* Left Side: Info & CTA */}
                             <div className="flex flex-col items-start gap-1.5">
                                 {/* Header Pill */}
                                 <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-stone-800 rounded-full shadow-sm">
                                    <Icons.LockOpen className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest pt-0.5">
                                        Levels {startLevel}-{endLevel}
                                    </span>
                                 </div>
                                 {/* Flashing CTA */}
                                 <span className="text-xs font-bold text-blue-500 uppercase tracking-widest pl-1 animate-pulse ml-0.5">
                                     Tap to Unlock
                                 </span>
                             </div>
                             
                             {/* Right Side: Price */}
                             <div className="flex items-center gap-2">
                                <span className="text-5xl font-bold text-stone-900 dark:text-white leading-none">
                                    {cost}
                                </span>
                                <Icons.Diamond className="w-8 h-8 text-blue-500 fill-current drop-shadow-sm" />
                             </div>
                        </div>
                    ) : (
                        <div className="flex flex-row items-center justify-between w-full gap-5">
                            {/* Left Side: Locked Status Box */}
                            <div className="w-20 h-20 rounded-3xl bg-stone-100 dark:bg-stone-700 flex flex-col items-center justify-center shrink-0 border border-stone-200 dark:border-stone-600 shadow-sm">
                                <Icons.Lock className="w-8 h-8 text-stone-500 dark:text-stone-400 opacity-80" />
                            </div>
                            
                            {/* Right Side: Progress Details */}
                            <div className="flex-1 flex flex-col justify-center gap-3">
                                <div className="flex justify-between items-end px-0.5">
                                    <span className="text-sm font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wide leading-none">
                                        Locked
                                    </span>
                                    <span className="text-xs font-medium text-stone-500 dark:text-stone-400 leading-none tabular-nums">
                                        {animatedCount}/{totalBaseLevels} Levels
                                    </span>
                                </div>

                                {/* Modern Progress Bar */}
                                <div className="w-full h-4 bg-stone-100 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-full overflow-hidden p-[3px] shadow-sm">
                                    <div 
                                        className={`h-full bg-stone-500 dark:bg-stone-400 rounded-full shadow-sm transition-all duration-75 ease-linear relative overflow-hidden ${animatedPercent > 0 ? 'min-w-[8px]' : 'opacity-0'}`} 
                                        style={{ width: `${animatedPercent}%` }}
                                    >
                                        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,rgba(255,255,255,0.5)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.5)_50%,rgba(255,255,255,0.5)_75%,transparent_75%,transparent)] bg-[length:8px_8px]" />
                                    </div>
                                </div>
                                
                                <p className="text-xs font-medium text-stone-500 dark:text-stone-400 leading-tight px-0.5">
                                    Complete previous pack to unlock.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </button>
        </div>
    );
};
