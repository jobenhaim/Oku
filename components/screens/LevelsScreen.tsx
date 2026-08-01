import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Difficulty, LevelProgress } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { UnlockCard } from '../ui/UnlockCard';
import { getPackCost, formatTimeShort } from '../../utils/constants';
import { DiamondBalancePill } from '../ui/DiamondBalancePill';
import { sounds } from '../../utils/sound';
import { useTactilePress } from '../../hooks/useTactilePress';

const BOOK_REVEAL_ROW_GAP_MS = 126;
const BOOK_REVEAL_ROW_DURATION_MS = 360;
const BOOK_UNLOCK_CARD_FADE_MS = 1500;
const BOOK_LEVELS_AFTER_FADE_DELAY_MS = 100;

// --- OPTIMIZED LEVEL BUTTON COMPONENT ---
interface LevelButtonProps {
    levelId: number;
    status?: 'locked' | 'not-started' | 'in-progress' | 'completed';
    bestTime?: number;
    isGlobalBest: boolean;
    showTimer: boolean;
    onSelect: (levelId: number) => void;
    isPressed: boolean;
    isLocked: boolean;
    onPressStart: (levelId: number) => void;
    onPressCancel: (levelId: number) => void;
    isRevealing?: boolean;
    revealDelayMs?: number;
}

const LevelButton = React.memo(({ levelId, status, bestTime, isGlobalBest, showTimer, onSelect, isPressed, isLocked, onPressStart, onPressCancel, isRevealing = false, revealDelayMs = 0 }: LevelButtonProps) => {
    const isSolved = bestTime !== undefined || status === 'completed';
    const isInProgress = status === 'in-progress';

    let buttonClass = `oku-level-surface oku-level-tactile ${isPressed ? 'oku-level-tactile--pressed' : ''} w-full h-full rounded-xl relative `;
    
    if (isSolved) {
        buttonClass += 'oku-level-surface-solved ';
        if (isInProgress) {
            buttonClass += 'oku-level-surface-progress ';
        }
    } else if (isInProgress) {
        buttonClass += 'oku-level-surface-progress ';
    } else {
        buttonClass += 'oku-level-surface-open ';
    }

    return (
        <div
            className={`oku-level-shell aspect-square rounded-xl md:rounded-2xl ${isRevealing ? 'oku-book-level-row-reveal' : ''}`}
            style={isRevealing ? { animationDelay: `${revealDelayMs}ms` } : undefined}
        >
            <button
                onPointerDown={() => onPressStart(levelId)}
                onPointerCancel={() => onPressCancel(levelId)}
                onPointerLeave={() => onPressCancel(levelId)}
                onClick={() => onSelect(levelId)}
                disabled={isLocked}
                className={buttonClass}
            >
                <div className="absolute inset-0 flex items-center justify-center"><span className="font-bold text-2xl leading-none">{levelId}</span></div>
                {isSolved && showTimer ? (
                    isGlobalBest ? (
                        <>
                            <div className="absolute top-1.5 inset-x-0 flex justify-center">
                                <span className="text-[8px] font-bold text-amber-500 tracking-widest opacity-90 animate-pulse">BEST</span>
                            </div>
                            <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                                <span className="text-[10px] text-amber-500 font-bold tracking-tight block leading-none animate-pulse">{bestTime ? formatTimeShort(bestTime) : '--'}</span>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-x-0 bottom-1.5 text-center">
                            {bestTime ? <span className="text-[10px] font-bold tracking-tight block text-t-secondary">{formatTimeShort(bestTime)}</span> : null}
                        </div>
                    )
                ) : null}
            </button>
        </div>
    );
});

interface LevelsScreenProps {
    difficulty: Difficulty;
    points: number;
    showTimer: boolean;
    unlockedPacks2: string[];
    unlockedPacks3: string[];
    book2UnlockReady: string[];
    book3UnlockReady: string[];
    books2AllOwned: boolean;
    books3AllOwned: boolean;
    book2BundlePrice: string;
    book3BundlePrice: string;
    isPurchasingBook2Bundle: boolean;
    isPurchasingBook3Bundle: boolean;
    onBack: () => void;
    onLevelSelect: (levelId: number) => void;
    onOpenSettings: () => void;
    onUnlockPack2: () => void;
    onUnlockPack3: () => void;
    onRevealPack2: () => void;
    onRevealPack3: () => void;
    onPurchaseAllBooks2: () => void;
    onPurchaseAllBooks3: () => void;
}

export const LevelsScreen: React.FC<LevelsScreenProps> = ({ 
    difficulty, 
    points,
    showTimer,
    unlockedPacks2, 
    unlockedPacks3, 
    book2UnlockReady,
    book3UnlockReady,
    books2AllOwned,
    books3AllOwned,
    book2BundlePrice,
    book3BundlePrice,
    isPurchasingBook2Bundle,
    isPurchasingBook3Bundle,
    onBack, 
    onLevelSelect, 
    onOpenSettings,
    onUnlockPack2,
    onUnlockPack3,
    onRevealPack2,
    onRevealPack3,
    onPurchaseAllBooks2,
    onPurchaseAllBooks3,
}) => {
    // --- BATCH DATA LOADING ---
    const [progressMap] = useState(() => Storage.getStoredData().progress);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [pressedLevelId, setPressedLevelId] = useState<number | null>(null);
    const [isLevelInteractionLocked, setIsLevelInteractionLocked] = useState(false);
    const levelInteractionLockedRef = useRef(false);
    const pressedLevelIdRef = useRef<number | null>(null);
    const levelPressStartedAtRef = useRef(0);
    const levelReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const levelActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bookPress = useTactilePress<number>();
    const [isTabletLayout, setIsTabletLayout] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    ));

    useEffect(() => {
        const tabletQuery = window.matchMedia('(min-width: 768px)');
        const updateTabletLayout = () => setIsTabletLayout(tabletQuery.matches);
        updateTabletLayout();
        tabletQuery.addEventListener('change', updateTabletLayout);
        return () => tabletQuery.removeEventListener('change', updateTabletLayout);
    }, []);

    useEffect(() => {
        return () => {
            if (levelReleaseTimerRef.current) clearTimeout(levelReleaseTimerRef.current);
            if (levelActionTimerRef.current) clearTimeout(levelActionTimerRef.current);
        };
    }, []);

    const beginLevelPress = useCallback((levelId: number) => {
        if (levelInteractionLockedRef.current) return;

        pressedLevelIdRef.current = levelId;
        levelPressStartedAtRef.current = performance.now();
        setPressedLevelId(levelId);
    }, []);

    const cancelLevelPress = useCallback((levelId: number) => {
        if (
            levelInteractionLockedRef.current ||
            pressedLevelIdRef.current !== levelId
        ) return;

        pressedLevelIdRef.current = null;
        setPressedLevelId(null);
    }, []);

    const runLevelPressCycle = useCallback((levelId: number) => {
        if (levelInteractionLockedRef.current) return;

        const startedWithPointer = pressedLevelIdRef.current === levelId;
        const elapsedPressTime = startedWithPointer
            ? performance.now() - levelPressStartedAtRef.current
            : 0;
        const releaseDelay = startedWithPointer
            ? Math.max(0, 50 - elapsedPressTime)
            : 50;

        levelInteractionLockedRef.current = true;
        setIsLevelInteractionLocked(true);
        if (!startedWithPointer) {
            pressedLevelIdRef.current = levelId;
            setPressedLevelId(levelId);
        }

        levelReleaseTimerRef.current = setTimeout(() => {
            pressedLevelIdRef.current = null;
            setPressedLevelId(null);
        }, releaseDelay);

        levelActionTimerRef.current = setTimeout(() => {
            levelInteractionLockedRef.current = false;
            setIsLevelInteractionLocked(false);
            onLevelSelect(levelId);
        }, releaseDelay + 50);
    }, [onLevelSelect]);
    
    // Helper to determine if a level should actually be shown as "in-progress"
    const getDisplayStatus = (progress?: LevelProgress) => {
        if (!progress) return 'not-started';
        if (progress.status !== 'in-progress') return progress.status;
        
        // Even if status is in-progress, check if there are any user values or notes
        const hasUserInteraction = progress.boardState?.some(row => 
            row.some(cell => !cell.isFixed && (cell.value !== null || cell.notes.length > 0))
        );
        
        return hasUserInteraction ? 'in-progress' : 'not-started';
    };

    // --- CALCULATE STATS ---
    const { globalBest, completedRange1, completedRange2 } = useMemo(() => {
        let best = Infinity;
        let c1 = 0;
        let c2 = 0;

        for (let i = 1; i <= 300; i++) {
            const key = `${difficulty}-${i}`;
            const p = progressMap[key];
            if (p && (p.status === 'completed' || p.bestTime !== undefined)) {
                if (i <= 100) c1++;
                else if (i <= 200) c2++;
                
                if (p.bestTime !== undefined && p.bestTime < best) {
                    best = p.bestTime;
                }
            }
        }

        return { 
            globalBest: best === Infinity ? undefined : best, 
            completedRange1: c1, 
            completedRange2: c2 
        };
    }, [progressMap, difficulty]);

    const isPack2Unlocked = unlockedPacks2.includes(difficulty);
    const isPack3Unlocked = unlockedPacks3.includes(difficulty);
    const [fadingUnlockedBook, setFadingUnlockedBook] = useState<2 | 3 | null>(null);
    const [revealingBook, setRevealingBook] = useState<2 | 3 | null>(null);
    const previousBookUnlocksRef = useRef({
        difficulty,
        book2: isPack2Unlocked,
        book3: isPack3Unlocked,
    });
    const bookRevealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const previousBookUnlocks = previousBookUnlocksRef.current;
    const isBook2UnlockTransition = fadingUnlockedBook === 2 || (
        previousBookUnlocks.difficulty === difficulty
        && !previousBookUnlocks.book2
        && isPack2Unlocked
    );
    const isBook3UnlockTransition = fadingUnlockedBook === 3 || (
        previousBookUnlocks.difficulty === difficulty
        && !previousBookUnlocks.book3
        && isPack3Unlocked
    );

    useLayoutEffect(() => {
        const previous = previousBookUnlocksRef.current;
        const current = {
            difficulty,
            book2: isPack2Unlocked,
            book3: isPack3Unlocked,
        };
        previousBookUnlocksRef.current = current;

        bookRevealTimersRef.current.forEach(clearTimeout);
        bookRevealTimersRef.current = [];

        // Opening another difficulty must never replay an already-owned Book.
        if (previous.difficulty !== difficulty) {
            setFadingUnlockedBook(null);
            setRevealingBook(null);
            return;
        }

        const newlyUnlockedBook: 2 | 3 | null = !previous.book2 && isPack2Unlocked
            ? 2
            : !previous.book3 && isPack3Unlocked
                ? 3
                : null;

        if (!newlyUnlockedBook) return;

        setActiveTab(newlyUnlockedBook);
        setFadingUnlockedBook(newlyUnlockedBook);
        bookRevealTimersRef.current.push(setTimeout(() => {
            setFadingUnlockedBook(null);
            setRevealingBook(newlyUnlockedBook);

            const revealRowCount = window.matchMedia('(min-width: 768px)').matches
                ? Math.ceil(100 / 8)
                : Math.ceil(100 / 5);

            for (let rowIndex = 0; rowIndex < revealRowCount; rowIndex++) {
                bookRevealTimersRef.current.push(setTimeout(() => {
                    sounds.playBookRowReveal(rowIndex);
                }, 35 + rowIndex * BOOK_REVEAL_ROW_GAP_MS));
            }

            const revealDuration = (
                (revealRowCount - 1) * BOOK_REVEAL_ROW_GAP_MS
                + BOOK_REVEAL_ROW_DURATION_MS
            );
            bookRevealTimersRef.current.push(setTimeout(() => {
                setRevealingBook(null);
                bookRevealTimersRef.current = [];
            }, revealDuration));
        }, BOOK_UNLOCK_CARD_FADE_MS + BOOK_LEVELS_AFTER_FADE_DELAY_MS));
    }, [difficulty, isPack2Unlocked, isPack3Unlocked]);

    useEffect(() => () => {
        bookRevealTimersRef.current.forEach(clearTimeout);
    }, []);

    // Open on the first book that still has something useful for the player.
    // A completed book advances to the next book's unlock card automatically.
    const defaultTab: 1 | 2 | 3 = isPack3Unlocked || (isPack2Unlocked && completedRange2 >= 100)
        ? 3
        : isPack2Unlocked || completedRange1 >= 100
            ? 2
            : 1;
    const [activeTab, setActiveTab] = useState<1 | 2 | 3>(() => defaultTab);

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [difficulty, defaultTab]);

    // Reset scroll on tab change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    // Determine visible tabs: Books 1 & 2 are always visible. Book 3 appears once Book 2 is unlocked.
    const visibleTabs = [1, 2];
    if (isPack2Unlocked) visibleTabs.push(3);

    const handleTabChange = (tab: 1 | 2 | 3) => {
        sounds.playClick();
        setActiveTab(tab);
    };

    const renderContent = () => {
        if (activeTab === 1) {
            const levels = Array.from({ length: 100 }, (_, i) => i + 1);
            return (
                <div className="flex flex-col items-center w-full max-w-md md:max-w-[700px]">
                    <div className="w-full grid grid-cols-5 md:grid-cols-8 gap-3 pt-2 md:pt-4 pb-6 md:pb-8">
                        {levels.map((lvl) => {
                            const key = `${difficulty}-${lvl}`;
                            const progress = progressMap[key];
                            return (
                                <LevelButton 
                                    key={lvl}
                                    levelId={lvl}
                                    status={getDisplayStatus(progress)}
                                    bestTime={progress?.bestTime}
                                    isGlobalBest={globalBest !== undefined && progress?.bestTime === globalBest}
                                    showTimer={showTimer}
                                    onSelect={runLevelPressCycle}
                                    isPressed={pressedLevelId === lvl}
                                    isLocked={isLevelInteractionLocked}
                                    onPressStart={beginLevelPress}
                                    onPressCancel={cancelLevelPress}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (activeTab === 2) {
            if (!isPack2Unlocked || isBook2UnlockTransition) {
                return (
                    <div className={`flex-1 flex flex-col items-center justify-center w-full max-w-md md:max-w-[700px] pb-20 md:pb-24 animate-fade-in-fast ${
                        isBook2UnlockTransition ? 'oku-book-unlock-card-fade-out pointer-events-none' : ''
                    }`}>
                        <UnlockCard 
                            startLevel={101}
                            endLevel={200}
                            completedCount={completedRange1}
                            totalBaseLevels={100}
                            cost={getPackCost(difficulty, 2)}
                            difficultyLabel={difficulty}
                            onUnlock={onUnlockPack2}
                            accessGranted={
                                book2UnlockReady.includes(difficulty)
                                || (books2AllOwned && completedRange1 >= 100)
                                || isBook2UnlockTransition
                            }
                            onReveal={onRevealPack2}
                            moneyPriceLabel={book2BundlePrice}
                            onUnlockAllWithMoney={onPurchaseAllBooks2}
                            moneyPurchasePending={isPurchasingBook2Bundle}
                        />
                    </div>
                );
            }
            const levels = Array.from({ length: 100 }, (_, i) => i + 101);
            return (
                <div className="flex flex-col items-center w-full max-w-md md:max-w-[700px]">
                    <div className="w-full grid grid-cols-5 md:grid-cols-8 gap-3 pt-2 md:pt-4 pb-6 md:pb-8">
                        {levels.map((lvl, levelIndex) => {
                            const key = `${difficulty}-${lvl}`;
                            const progress = progressMap[key];
                            const revealRowIndex = Math.floor(levelIndex / (isTabletLayout ? 8 : 5));
                            return (
                                <LevelButton
                                    key={lvl}
                                    levelId={lvl}
                                    status={getDisplayStatus(progress)}
                                    bestTime={progress?.bestTime}
                                    isGlobalBest={globalBest !== undefined && progress?.bestTime === globalBest}
                                    showTimer={showTimer}
                                    onSelect={runLevelPressCycle}
                                    isPressed={pressedLevelId === lvl}
                                    isLocked={isLevelInteractionLocked || revealingBook === 2}
                                    onPressStart={beginLevelPress}
                                    onPressCancel={cancelLevelPress}
                                    isRevealing={revealingBook === 2}
                                    revealDelayMs={revealRowIndex * BOOK_REVEAL_ROW_GAP_MS}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (activeTab === 3) {
            if (!isPack3Unlocked || isBook3UnlockTransition) {
                return (
                    <div className={`flex-1 flex flex-col items-center justify-center w-full max-w-md md:max-w-[700px] pb-20 md:pb-24 animate-fade-in-fast ${
                        isBook3UnlockTransition ? 'oku-book-unlock-card-fade-out pointer-events-none' : ''
                    }`}>
                        <UnlockCard 
                            startLevel={201}
                            endLevel={300}
                            completedCount={completedRange2}
                            totalBaseLevels={100}
                            cost={getPackCost(difficulty, 3)}
                            difficultyLabel={difficulty}
                            onUnlock={onUnlockPack3}
                            accessGranted={
                                book3UnlockReady.includes(difficulty)
                                || (books3AllOwned && completedRange2 >= 100)
                                || isBook3UnlockTransition
                            }
                            onReveal={onRevealPack3}
                            moneyPriceLabel={book3BundlePrice}
                            onUnlockAllWithMoney={onPurchaseAllBooks3}
                            moneyPurchasePending={isPurchasingBook3Bundle}
                        />
                    </div>
                );
            }
            const levels = Array.from({ length: 100 }, (_, i) => i + 201);
            return (
                <div className="flex flex-col items-center w-full max-w-md md:max-w-[700px]">
                    <div className="w-full grid grid-cols-5 md:grid-cols-8 gap-3 pt-2 md:pt-4 pb-6 md:pb-8">
                        {levels.map((lvl, levelIndex) => {
                            const key = `${difficulty}-${lvl}`;
                            const progress = progressMap[key];
                            const revealRowIndex = Math.floor(levelIndex / (isTabletLayout ? 8 : 5));
                            return (
                                <LevelButton
                                    key={lvl}
                                    levelId={lvl}
                                    status={getDisplayStatus(progress)}
                                    bestTime={progress?.bestTime}
                                    isGlobalBest={globalBest !== undefined && progress?.bestTime === globalBest}
                                    showTimer={showTimer}
                                    onSelect={runLevelPressCycle}
                                    isPressed={pressedLevelId === lvl}
                                    isLocked={isLevelInteractionLocked || revealingBook === 3}
                                    onPressStart={beginLevelPress}
                                    onPressCancel={cancelLevelPress}
                                    isRevealing={revealingBook === 3}
                                    revealDelayMs={revealRowIndex * BOOK_REVEAL_ROW_GAP_MS}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden relative">
            <div className="w-full max-w-md md:max-w-[700px] flex flex-col items-center px-6 md:px-0 pt-4 md:pt-7 shrink-0 z-20 gap-4 md:gap-6">
                
                {/* Header Row */}
                <div className="w-full flex items-center justify-between relative">
                    <button onClick={onBack} aria-label="Back to difficulties" className="p-2 md:p-2.5 rounded-full -ml-2 text-t-icon relative z-30 active:scale-95 transition">
                        <Icons.Back className="w-6 h-6 md:w-7 md:h-7 text-t-icon" />
                    </button>
                    
                    <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                        <h1 className="text-xl md:text-2xl font-bold leading-none">{difficulty}</h1>
                        <p className="text-xs md:text-sm font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-[0.2em] mt-1 md:mt-1.5">Select Level</p>
                        {showTimer && globalBest !== undefined && (
                            <div className="flex flex-col items-center animate-fade-in-fast mt-1">
                                <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase mb-px opacity-90">Best: {formatTimeShort(globalBest)}</span>
                            </div>
                        )}
                    </div>

                    <DiamondBalancePill points={points} />
                </div>

                {/* Tab Navigation (Scrollable Pills) */}
                <div className="w-full overflow-x-auto hide-scrollbar touch-pan-x pb-2 md:pb-3 pt-1 -mx-6 md:mx-0 px-6 md:px-0">
                    <div className="flex w-max gap-3 md:gap-4 min-w-min mx-auto">
                        {visibleTabs.map((tabNum) => {
                            const isActive = activeTab === tabNum;
                            // Only confirm lock if it's strictly the next unavailable one
                            const isLocked = (tabNum === 2 && !isPack2Unlocked) || (tabNum === 3 && !isPack3Unlocked);
                            
                            return (
                                <div key={tabNum} className="oku-book-tab-shell rounded-full">
                                    <button
                                        onPointerDown={() => !isActive && revealingBook === null && fadingUnlockedBook === null && bookPress.beginPress(tabNum)}
                                        onPointerCancel={() => bookPress.cancelPress(tabNum)}
                                        onPointerLeave={() => bookPress.cancelPress(tabNum)}
                                        onClick={() => {
                                            if (!isActive && revealingBook === null && fadingUnlockedBook === null) {
                                                bookPress.runPressCycle(
                                                    tabNum,
                                                    () => handleTabChange(tabNum as 1|2|3),
                                                );
                                            }
                                        }}
                                        aria-pressed={isActive}
                                        className={`
                                            oku-book-tab-face ${isActive ? 'oku-book-tab-face--selected' : ''} ${bookPress.pressedId === tabNum ? 'oku-book-tab-face--pressed' : ''} px-6 md:px-8 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap border-2
                                            ${isActive
                                                ? 'bg-white border-stone-700 text-stone-900 dark:bg-stone-800 dark:border-stone-300 dark:text-white'
                                                : 'bg-white border-stone-200 text-stone-500 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-400'
                                            }
                                        `}
                                    >
                                        {isLocked && <Icons.Lock className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-60" />}
                                        <span>Book {tabNum}</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div 
                ref={scrollContainerRef}
                className="scroll-edge-fade flex-1 w-full overflow-y-auto px-6 md:px-10 pb-6 md:pb-8 hide-scrollbar flex flex-col items-center relative"
            >
                {renderContent()}
                <div className="h-safe-bottom w-full shrink-0" />
            </div>

        </div>
    );
};
