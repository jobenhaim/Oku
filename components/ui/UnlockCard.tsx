import React, { useRef, useState, useEffect } from 'react';
import { Icons } from './Icons';

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
        if (isVisible) {
            // Animate progress
            const duration = 2500; // Slower duration
            const startTime = performance.now();

            const animate = (time: number) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = progress; // Linear easing
                
                setAnimatedPercent(Math.floor(rawPercent * ease));

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setAnimatedPercent(rawPercent);
                    if (rawPercent === 100) {
                        // Wait a moment after hitting 100% before showing the unlock button
                        setTimeout(() => {
                            setShowUnlockUI(true);
                        }, 500);
                    }
                }
            };
            requestAnimationFrame(animate);
        }
    }, [isVisible, rawPercent]);

    const handleUnlockClick = () => {
        if (!showUnlockUI) return;
        onUnlock();
    };

    return (
        <div ref={cardRef} className="w-full max-w-md mt-6 px-1">
            <button 
                onClick={handleUnlockClick}
                disabled={!showUnlockUI}
                // Removed borders
                className={`w-full h-32 rounded-[1.5rem] relative overflow-hidden transition-all duration-500 ease-out group ${
                    showUnlockUI 
                        ? 'bg-gradient-to-b from-white to-blue-50/50 dark:from-stone-800 dark:to-stone-900 shadow-lg active:scale-[0.98] cursor-pointer' 
                        : 'bg-stone-200 dark:bg-stone-800/80 cursor-default'
                }`}
            >
                {/* Background Decor for Unlock State */}
                {showUnlockUI && (
                    <div className="absolute inset-0 opacity-100 pointer-events-none">
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-400/10 rounded-full blur-2xl"></div>
                    </div>
                )}

                {/* Content Container */}
                <div className="absolute inset-0 flex items-center justify-center px-6">
                    {showUnlockUI ? (
                        <div className="flex flex-row items-center justify-between w-full animate-fade-in relative z-10 gap-2">
                             
                             {/* Left Side: Info & CTA */}
                             <div className="flex flex-col items-start gap-1.5">
                                 {/* Header Pill - Removed border */}
                                 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-stone-800 rounded-full shadow-sm">
                                    <Icons.LockOpen className="w-3 h-3 text-blue-500" />
                                    <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest pt-0.5">
                                        Levels {startLevel}-{endLevel}
                                    </span>
                                 </div>
                                 {/* Flashing CTA */}
                                 <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pl-1 animate-pulse ml-0.5">
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
                            {/* Left Side: Lock Icon */}
                            <div className="w-14 h-14 rounded-xl bg-stone-300/50 dark:bg-stone-700/50 flex items-center justify-center shadow-inner">
                                <Icons.Lock className="w-6 h-6 text-stone-500 dark:text-stone-400" />
                            </div>
                            
                            {/* Right Side: Progress Stats */}
                            <div className="flex-1 flex flex-col items-start gap-2">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-bold text-stone-500 dark:text-stone-400 leading-none">
                                        {animatedPercent}
                                    </span>
                                    <span className="text-lg font-bold text-stone-400 dark:text-stone-500">%</span>
                                </div>
                                {/* Modern Progress Bar */}
                                <div className="w-full h-2.5 bg-stone-300 dark:bg-stone-700 rounded-full overflow-hidden p-[1px]">
                                    <div 
                                        className="h-full bg-loading-green rounded-full shadow-sm transition-all duration-200 ease-out" 
                                        style={{ width: `${animatedPercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </button>
        </div>
    );
};