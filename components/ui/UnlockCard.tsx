import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { sounds } from '../../utils/sound';
import { easeInOut, easeOut } from '../../utils/animation';

interface UnlockCardProps {
    startLevel: number;
    endLevel: number;
    completedCount: number;
    totalBaseLevels: number;
    cost: number;
    onUnlock: () => void;
}

export const UnlockCard: React.FC<UnlockCardProps> = ({
    startLevel,
    endLevel,
    completedCount,
    totalBaseLevels,
    cost,
    onUnlock,
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [animatedPercent, setAnimatedPercent] = useState(0);
    const [animatedCount, setAnimatedCount] = useState(0);
    const [showUnlockUI, setShowUnlockUI] = useState(false);
    const [animatedCost, setAnimatedCost] = useState(0);
    const [unlockReady, setUnlockReady] = useState(false);

    const rawPercent = Math.min(100, Math.floor((completedCount / totalBaseLevels) * 100));
    const packNumber = startLevel === 101 ? 2 : 3;
    const previousPackNumber = packNumber - 1;

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    return;
                }

                setIsVisible(false);
                setAnimatedPercent(0);
                setAnimatedCount(0);
                setShowUnlockUI(false);
                setAnimatedCost(0);
                setUnlockReady(false);
            },
            { threshold: 0.2 },
        );

        const card = cardRef.current;
        if (card) observer.observe(card);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        let progressFrame = 0;
        let priceFrame = 0;
        let revealTimer: ReturnType<typeof setTimeout> | undefined;
        let stopSound: (() => void) | undefined;
        let cancelled = false;

        const duration = rawPercent <= 0 ? 0 : 300 + (rawPercent / 100) * 2700;
        if (rawPercent > 0) stopSound = sounds.playProgressFill(duration / 1000);

        const progressStart = performance.now();
        const animateProgress = (time: number) => {
            if (cancelled) return;

            const progress = duration === 0 ? 1 : Math.min((time - progressStart) / duration, 1);
            const easedProgress = easeInOut(progress);
            setAnimatedPercent(Math.floor(rawPercent * easedProgress));
            setAnimatedCount(Math.floor(completedCount * easedProgress));

            if (progress < 1) {
                progressFrame = requestAnimationFrame(animateProgress);
                return;
            }

            setAnimatedPercent(rawPercent);
            setAnimatedCount(completedCount);

            if (rawPercent !== 100) return;

            revealTimer = setTimeout(() => {
                if (cancelled) return;
                setShowUnlockUI(true);
                sounds.playUnlockReady();

                const priceStart = performance.now();
                const priceDuration = 800;
                const animatePrice = (priceTime: number) => {
                    if (cancelled) return;
                    const priceProgress = Math.min((priceTime - priceStart) / priceDuration, 1);
                    setAnimatedCost(Math.round(cost * easeOut(priceProgress)));

                    if (priceProgress < 1) {
                        priceFrame = requestAnimationFrame(animatePrice);
                    } else {
                        setAnimatedCost(cost);
                        setUnlockReady(true);
                    }
                };

                priceFrame = requestAnimationFrame(animatePrice);
            }, 400);
        };

        progressFrame = requestAnimationFrame(animateProgress);

        return () => {
            cancelled = true;
            cancelAnimationFrame(progressFrame);
            cancelAnimationFrame(priceFrame);
            if (revealTimer) clearTimeout(revealTimer);
            if (stopSound) stopSound();
        };
    }, [isVisible, rawPercent, completedCount, cost]);

    const handleUnlockClick = () => {
        if (!unlockReady) return;
        onUnlock();
    };

    return (
        <div ref={cardRef} className="w-full max-w-md mt-6 px-1">
            <button
                onClick={handleUnlockClick}
                disabled={!unlockReady}
                aria-label={showUnlockUI ? `Unlock levels ${startLevel} through ${endLevel} for ${cost} diamonds` : undefined}
                className={`w-full h-[10.4rem] rounded-[1.75rem] relative overflow-hidden text-left transition-transform duration-200 ease-out ${
                    unlockReady ? 'active:scale-[0.985] cursor-pointer' : 'cursor-default'
                } bg-white dark:bg-stone-800 border border-white/90 dark:border-stone-700 shadow-[0_8px_24px_rgba(41,37,36,0.10)]`}
            >
                {showUnlockUI ? (
                    <div className="h-full flex flex-col px-5 py-4 animate-fade-in-fast">
                        <div className="flex-1 flex items-center justify-between gap-3 px-1 min-h-0">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-16 h-16 rounded-[1.35rem] bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center shrink-0">
                                    <Icons.LockOpen className="w-9 h-9 text-blue-500" strokeWidth={2} />
                                </div>
                                <div className="min-w-0 text-left">
                                    <span className="block text-[1.55rem] font-bold text-stone-900 dark:text-white leading-none whitespace-nowrap">
                                        Book {packNumber}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0" aria-live="polite">
                                <span className="text-[2.55rem] font-bold text-stone-950 dark:text-white leading-none tabular-nums tracking-tight">
                                    {animatedCost}
                                </span>
                                <Icons.Diamond className="w-7 h-7 text-blue-500 fill-current" />
                            </div>
                        </div>

                        <div className={`h-11 rounded-2xl flex items-center justify-between pl-5 pr-2.5 mt-2 transition-colors duration-300 ${
                            unlockReady ? 'bg-blue-500 shadow-[0_4px_10px_rgba(59,130,246,0.24)]' : 'bg-blue-400'
                        }`}>
                            <span className="text-base font-bold text-white">
                                {unlockReady ? 'Unlock' : 'Preparing…'}
                            </span>
                            <span className={`w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center transition-all duration-300 ${
                                unlockReady ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0'
                            }`}>
                                <Icons.Next className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col px-5 py-4">
                        <div className="flex-1 flex items-center justify-between gap-3 px-1 min-h-0">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-16 h-16 rounded-[1.35rem] bg-stone-100 dark:bg-stone-700 flex items-center justify-center shrink-0">
                                    <Icons.Lock className="w-9 h-9 text-stone-500 dark:text-stone-400" strokeWidth={2} />
                                </div>
                                <div className="min-w-0 text-left">
                                    <p className="text-[1.55rem] font-bold text-stone-900 dark:text-white leading-none whitespace-nowrap">
                                        Book {packNumber}
                                    </p>
                                    <p className="text-[14px] font-semibold text-stone-500 dark:text-stone-400 mt-2 whitespace-nowrap">
                                        Complete Book {previousPackNumber}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-baseline shrink-0 tabular-nums">
                                <span className="text-[2.55rem] font-bold text-stone-900 dark:text-white leading-none">{animatedCount}</span>
                                <span className="text-base font-bold text-stone-400 dark:text-stone-500">/{totalBaseLevels}</span>
                            </div>
                        </div>

                        <div className="w-full h-3 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden mt-2">
                            <div
                                className={`h-full rounded-full bg-loading-blue ${animatedPercent > 0 ? 'min-w-[8px]' : 'opacity-0'}`}
                                style={{ width: `${animatedPercent}%` }}
                            />
                        </div>
                    </div>
                )}
            </button>
        </div>
    );
};
