import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Difficulty, LevelProgress } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { UnlockCard } from '../ui/UnlockCard';
import { getPackCost, formatTimeShort } from '../../utils/constants';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { sounds } from '../../utils/sound';

// --- OPTIMIZED LEVEL BUTTON COMPONENT ---
interface LevelButtonProps {
    levelId: number;
    index: number;
    status?: 'locked' | 'not-started' | 'in-progress' | 'completed';
    bestTime?: number;
    isGlobalBest: boolean;
    onSelect: (levelId: number) => void;
}

const LevelButton = React.memo(({ levelId, index, status, bestTime, isGlobalBest, onSelect }: LevelButtonProps) => {
    const isSolved = bestTime !== undefined || status === 'completed';
    const isInProgress = status === 'in-progress';

    const rowIndex = Math.floor(index / 5);
    const colIndex = index % 5;
    const delay = (rowIndex * 4) + (colIndex * 2);

    let buttonClass = 'aspect-square rounded-xl relative transition-all active:scale-90 shadow-sm ';
    
    if (isSolved) {
        buttonClass += 'bg-t-surface-sec text-t-secondary ring-1 ring-inset ring-stone-900/5 ';
        if (isInProgress) {
            buttonClass += '!ring-2 !ring-blue-400 !text-t-primary ';
        }
    } else if (isInProgress) {
        buttonClass += 'bg-t-surface ring-2 ring-blue-400 shadow-md text-t-primary ';
    } else {
        buttonClass += 'bg-t-surface text-t-primary ';
    }

    return (
        <button 
            onClick={() => onSelect(levelId)} 
            className={buttonClass}
        >
            <div className="absolute inset-0 flex items-center justify-center"><span className="font-bold text-2xl leading-none">{levelId}</span></div>
            {bestTime ? (
                isGlobalBest ? (
                    <>
                        <div className="absolute top-1.5 inset-x-0 flex justify-center">
                            <span className="text-[8px] font-bold text-amber-500 tracking-widest opacity-90 animate-pulse">BEST</span>
                        </div>
                        <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                            <span className="text-[10px] text-amber-500 font-bold tracking-tight block leading-none animate-pulse">{formatTimeShort(bestTime)}</span>
                        </div>
                    </>
                ) : (
                    <div className="absolute bottom-1.5 inset-x-0 text-center">
                        <span className={`text-[10px] font-bold tracking-tight block ${isInProgress ? 'text-t-primary' : 'text-t-secondary'}`}>{formatTimeShort(bestTime)}</span>
                    </div>
                )
            ) : null}
        </button>
    );
});

interface LevelsScreenProps {
    difficulty: Difficulty;
    points: number;
    unlockedPacks2: string[];
    unlockedPacks3: string[];
    onBack: () => void;
    onLevelSelect: (levelId: number) => void;
    onOpenSettings: () => void;
    onUnlockPack2: () => void;
    onUnlockPack3: () => void;
}

export const LevelsScreen: React.FC<LevelsScreenProps> = ({ 
    difficulty, 
    points,
    unlockedPacks2, 
    unlockedPacks3, 
    onBack, 
    onLevelSelect, 
    onOpenSettings,
    onUnlockPack2,
    onUnlockPack3
}) => {
    // --- BATCH DATA LOADING ---
    const [progressMap] = useState(() => Storage.getStoredData().progress);
    
    // --- TAB STATE ---
    const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
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

    // Reset scroll on tab change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [activeTab]);

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

    // Determine Visible Tabs: Pack 1 & 2 always visible. Pack 3 only if Pack 2 unlocked.
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
                <div className="flex flex-col items-center w-full max-w-md">
                    <div className="w-full grid grid-cols-5 gap-3 pt-2 pb-6">
                        {levels.map((lvl, idx) => {
                            const key = `${difficulty}-${lvl}`;
                            const progress = progressMap[key];
                            return (
                                <LevelButton 
                                    key={lvl}
                                    levelId={lvl}
                                    index={idx}
                                    status={getDisplayStatus(progress)}
                                    bestTime={progress?.bestTime}
                                    isGlobalBest={globalBest !== undefined && progress?.bestTime === globalBest}
                                    onSelect={onLevelSelect}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (activeTab === 2) {
            if (!isPack2Unlocked) {
                return (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md pb-20 animate-fade-in-fast">
                        <UnlockCard 
                            startLevel={101}
                            endLevel={200}
                            completedCount={completedRange1}
                            totalBaseLevels={100}
                            cost={getPackCost(difficulty, 2)}
                            onUnlock={onUnlockPack2}
                        />
                    </div>
                );
            }
            const levels = Array.from({ length: 100 }, (_, i) => i + 101);
            return (
                <div className="flex flex-col items-center w-full max-w-md">
                    <div className="w-full grid grid-cols-5 gap-3 pt-2 pb-6 animate-fade-in-fast">
                        {levels.map((lvl, idx) => {
                            const key = `${difficulty}-${lvl}`;
                            const progress = progressMap[key];
                            return (
                                <LevelButton 
                                    key={lvl}
                                    levelId={lvl}
                                    index={idx}
                                    status={getDisplayStatus(progress)}
                                    bestTime={progress?.bestTime}
                                    isGlobalBest={globalBest !== undefined && progress?.bestTime === globalBest}
                                    onSelect={onLevelSelect}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (activeTab === 3) {
            if (!isPack3Unlocked) {
                return (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md pb-20 animate-fade-in-fast">
                        <UnlockCard 
                            startLevel={201}
                            endLevel={300}
                            completedCount={completedRange2}
                            totalBaseLevels={100}
                            cost={getPackCost(difficulty, 3)}
                            onUnlock={onUnlockPack3}
                        />
                    </div>
                );
            }
            const levels = Array.from({ length: 100 }, (_, i) => i + 201);
            return (
                <div className="flex flex-col items-center w-full max-w-md animate-fade-in-fast">
                    <div className="w-full grid grid-cols-5 gap-3 pt-2 pb-6">
                        {levels.map((lvl, idx) => {
                            const key = `${difficulty}-${lvl}`;
                            const progress = progressMap[key];
                            return (
                                <LevelButton 
                                    key={lvl}
                                    levelId={lvl}
                                    index={idx}
                                    status={getDisplayStatus(progress)}
                                    bestTime={progress?.bestTime}
                                    isGlobalBest={globalBest !== undefined && progress?.bestTime === globalBest}
                                    onSelect={onLevelSelect}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden relative animate-fade-in-fast">
            <div className="w-full max-w-md flex flex-col items-center px-6 pt-4 shrink-0 z-20 gap-4">
                
                {/* Header Row */}
                <div className="w-full flex items-center justify-between relative">
                    <button onClick={onBack} className="p-2 rounded-full -ml-2 text-t-icon relative z-30">
                        <Icons.Back className="w-6 h-6 text-t-icon" />
                    </button>
                    
                    <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                        <h1 className="text-xl font-bold leading-none">{difficulty}</h1>
                        <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-[0.2em] mt-1">Select Level</p>
                        {globalBest !== undefined && (
                            <div className="flex flex-col items-center animate-fade-in-fast mt-1">
                                <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase mb-px opacity-90">Best: {formatTimeShort(globalBest)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 bg-t-surface px-3 py-1.5 rounded-full shadow-sm relative z-30">
                        <AnimatedNumber value={points} className="text-sm font-semibold text-t-primary tabular-nums leading-none pt-0.5" />
                        <div className="text-blue-500"><Icons.Diamond className="w-3.5 h-3.5 fill-current" /></div>
                    </div>
                </div>

                {/* Tab Navigation (Scrollable Pills) */}
                <div className="w-full overflow-x-auto hide-scrollbar touch-pan-x pb-2 pt-1 -mx-6 px-6">
                    <div className="flex gap-3 min-w-min mx-auto md:mx-0">
                        {visibleTabs.map((tabNum) => {
                            const isActive = activeTab === tabNum;
                            // Only confirm lock if it's strictly the next unavailable one
                            const isLocked = (tabNum === 2 && !isPack2Unlocked) || (tabNum === 3 && !isPack3Unlocked);
                            
                            return (
                                <button
                                    key={tabNum}
                                    onClick={() => handleTabChange(tabNum as 1|2|3)}
                                    className={`
                                        px-6 py-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-sm border
                                        ${isActive 
                                            ? 'bg-stone-800 border-stone-800 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-900 scale-105' 
                                            : 'bg-white border-stone-200 text-stone-500 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                                        }
                                    `}
                                >
                                    {isLocked && <Icons.Lock className="w-3 h-3 opacity-60" />}
                                    <span>Pack {tabNum}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div 
                ref={scrollContainerRef}
                className="flex-1 w-full overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col items-center relative"
            >
                {renderContent()}
                <div className="h-safe-bottom w-full shrink-0" />
            </div>

        </div>
    );
};
