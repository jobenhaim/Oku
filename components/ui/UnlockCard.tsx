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
    difficultyLabel: string;
    onUnlock: () => void;
    moneyPriceLabel?: string;
    onUnlockAllWithMoney?: () => void;
    accessGranted?: boolean;
    onReveal?: () => void;
    moneyPurchasePending?: boolean;
}

export const UnlockCard: React.FC<UnlockCardProps> = ({
    startLevel,
    endLevel,
    completedCount,
    totalBaseLevels,
    cost,
    difficultyLabel,
    onUnlock,
    moneyPriceLabel = '$1.99',
    onUnlockAllWithMoney,
    accessGranted = false,
    onReveal,
    moneyPurchasePending = false,
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
        if (rawPercent > 0) stopSound = sounds.playUniversalProgressFill(duration / 1000);

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
                sounds.playPackUnlockReady();

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

    const handleDiamondUnlock = () => {
        if (!unlockReady) return;
        onUnlock();
    };

    const handleReveal = () => {
        if (!onReveal) return;
        sounds.playClick();
        onReveal();
    };

    if (accessGranted) {
        return (
            <div ref={cardRef} className="w-full max-w-md md:max-w-[620px] mt-6 md:mt-10 px-1">
                <button
                    type="button"
                    onClick={handleReveal}
                    className="w-full h-[8.25rem] md:h-[9.25rem] rounded-[1.75rem] md:rounded-[2rem] flex items-center justify-center gap-3 md:gap-4 bg-white dark:bg-stone-800 border-2 border-blue-300 dark:border-blue-700 active:scale-[0.98] transition-transform duration-100 ease-out"
                    aria-label={`Tap to unlock Book ${packNumber}`}
                >
                    <Icons.LockOpen className="w-8 h-8 md:w-10 md:h-10 text-blue-500" strokeWidth={2} />
                    <span className="text-[1.35rem] md:text-2xl font-bold text-stone-950 dark:text-white">
                        Tap to unlock Book {packNumber}
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div ref={cardRef} className="w-full max-w-md md:max-w-[620px] mt-6 md:mt-10 px-1">
            <div
                className="w-full h-[8.25rem] md:h-[9.25rem] rounded-[1.75rem] md:rounded-[2rem] relative overflow-hidden text-left bg-white dark:bg-stone-800 border border-white/90 dark:border-stone-700 shadow-[0_8px_24px_rgba(41,37,36,0.10)]"
            >
                <div className="h-full flex flex-col px-4 md:px-6 py-3.5 md:py-4">
                    <div className="flex-1 grid grid-cols-[3.5rem_minmax(0,1fr)] md:grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 md:gap-5 min-h-0">
                        <div className={`w-14 h-14 md:w-[4.5rem] md:h-[4.5rem] rounded-[1.15rem] md:rounded-[1.35rem] flex items-center justify-center transition-colors duration-300 ${
                            showUnlockUI ? 'bg-blue-50 dark:bg-blue-950/60' : 'bg-stone-100 dark:bg-stone-700'
                        }`}>
                            {showUnlockUI ? (
                                <Icons.LockOpen className="w-8 h-8 md:w-10 md:h-10 text-blue-500" strokeWidth={2} />
                            ) : (
                                <Icons.Lock className="w-8 h-8 md:w-10 md:h-10 text-stone-500 dark:text-stone-400" strokeWidth={2} />
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className="min-w-0 text-[clamp(1.1rem,5.5vw,1.35rem)] md:text-2xl font-bold text-stone-900 dark:text-white leading-none whitespace-nowrap">
                                    Book {packNumber}
                                </p>
                                <div className="shrink-0 flex items-baseline tabular-nums whitespace-nowrap">
                                    <span className="text-[clamp(1.65rem,8vw,2rem)] md:text-4xl font-bold text-stone-900 dark:text-white leading-none">{animatedCount}</span>
                                    <span className="text-sm md:text-base font-bold text-stone-400 dark:text-stone-500">/{totalBaseLevels}</span>
                                </div>
                            </div>
                            <p className={`text-[13px] md:text-[15px] font-semibold mt-1.5 md:mt-2 leading-none whitespace-nowrap transition-colors duration-300 ${
                                showUnlockUI ? 'text-blue-500' : 'text-stone-500 dark:text-stone-400'
                            }`}>
                                {showUnlockUI ? 'Ready to unlock' : `Complete Book ${previousPackNumber}`}
                            </p>
                        </div>
                    </div>

                    <div className="w-full h-3 md:h-3.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden mt-2 md:mt-3">
                        <div
                            className={`h-full rounded-full bg-loading-blue ${animatedPercent > 0 ? 'min-w-[8px]' : 'opacity-0'}`}
                            style={{ width: `${animatedPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {showUnlockUI && (
                <div className="mt-3 md:mt-4 grid grid-cols-2 gap-3 md:gap-4 animate-fade-in-fast">
                    <button
                        type="button"
                        onClick={handleDiamondUnlock}
                        disabled={!unlockReady}
                        aria-label={`Unlock levels ${startLevel} through ${endLevel} in ${difficultyLabel} for ${cost} diamonds`}
                        className="w-full min-h-[6.25rem] md:min-h-[7rem] rounded-[1.4rem] md:rounded-[1.6rem] border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 md:px-5 py-3.5 md:py-4 text-center transition-[transform,border-color] duration-100 ease-out active:scale-[0.97] disabled:cursor-default"
                    >
                        <span className="flex items-center justify-center gap-2 text-[1.65rem] md:text-3xl font-bold leading-none text-stone-950 dark:text-white tabular-nums" aria-live="polite">
                            {animatedCost}
                            <Icons.Diamond className="w-[1.65rem] h-[1.65rem] md:w-7 md:h-7 text-blue-500 fill-current" />
                        </span>
                        <span className="block mt-2 md:mt-2.5 text-[12px] md:text-sm font-semibold leading-tight text-stone-500 dark:text-stone-400">
                            Book {packNumber} for {difficultyLabel} only
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onUnlockAllWithMoney}
                        disabled={!unlockReady || !onUnlockAllWithMoney || moneyPurchasePending}
                        aria-busy={moneyPurchasePending}
                        aria-label={`Unlock Book ${packNumber} in every difficulty for ${moneyPriceLabel}`}
                        className="w-full min-h-[6.25rem] md:min-h-[7rem] rounded-[1.4rem] md:rounded-[1.6rem] border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-stone-800 px-3 md:px-5 py-3.5 md:py-4 text-center transition-[transform,border-color] duration-100 ease-out active:scale-[0.97] disabled:cursor-default flex flex-col items-center justify-center"
                    >
                        {moneyPurchasePending ? (
                            <span
                                className="block w-7 h-7 md:w-8 md:h-8 rounded-full border-[3px] border-stone-200 dark:border-stone-600 border-t-blue-500 dark:border-t-blue-400 animate-spin"
                                aria-hidden="true"
                            />
                        ) : (
                            <>
                                <span className="block text-[1.65rem] md:text-3xl font-bold leading-none text-stone-950 dark:text-white tabular-nums">
                                    {moneyPriceLabel}
                                </span>
                                <span className="block mt-2 md:mt-2.5 text-[12px] md:text-sm font-semibold leading-tight text-stone-500 dark:text-stone-400">
                                    Book {packNumber} in every difficulty
                                </span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
