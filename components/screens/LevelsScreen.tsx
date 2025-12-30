
import React from 'react';
import { Difficulty } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { sounds } from '../../utils/sound';
import { UnlockCard } from '../ui/UnlockCard';
import { getPackCost, formatTimeShort } from '../../utils/constants';
import { AnimatedNumber } from '../ui/AnimatedNumber';

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
    // Logic for Levels & Unlocking
    const isPack2Unlocked = unlockedPacks2.includes(difficulty);
    const isPack3Unlocked = unlockedPacks3.includes(difficulty);
    
    let totalVisibleLevels = 100;
    if (isPack2Unlocked) totalVisibleLevels = 200;
    if (isPack3Unlocked) totalVisibleLevels = 300;
    
    const allLevels = Array.from({ length: totalVisibleLevels }, (_, i) => i + 1);
    
    // Count completed levels for specific ranges to drive unlock cards
    const completedRange1 = Storage.getCompletedCountInRange(difficulty, 1, 100);
    const completedRange2 = Storage.getCompletedCountInRange(difficulty, 101, 200);

    // Global Best for Header
    let globalBest = Infinity;
    allLevels.forEach(l => {
        const p = Storage.getLevelProgress(difficulty, l);
        if (p?.bestTime !== undefined && p.bestTime < globalBest) {
            globalBest = p.bestTime;
        }
    });
    const hasGlobalBest = globalBest !== Infinity;

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden">
            <div className="w-full max-w-md flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-200/50 transition -ml-2 text-t-icon relative z-30">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>
                
                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl font-bold leading-none">{difficulty}</h1>
                    <p className="text-xs text-t-secondary uppercase tracking-widest mt-1">Select Level</p>
                    {hasGlobalBest && (
                        <div className="flex flex-col items-center animate-fade-in mt-1">
                            <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase mb-px opacity-90">Best: {formatTimeShort(globalBest)}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5 bg-t-surface px-3 py-1.5 rounded-full shadow-sm relative z-30">
                    <AnimatedNumber value={points} className="text-sm font-semibold text-t-primary tabular-nums leading-none pt-0.5" />
                    <div className="text-blue-500"><Icons.Diamond className="w-3.5 h-3.5 fill-current" /></div>
                </div>
            </div>

            <div className="flex-1 w-full overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col items-center">
                <div className="w-full max-w-md grid grid-cols-5 gap-3 pt-2">
                    {allLevels.map((lvl) => {
                            const progress = Storage.getLevelProgress(difficulty, lvl);
                            const bestTime = progress?.bestTime;
                            
                            // A level is considered "Solved" if it has a bestTime recorded (history of winning)
                            // or if the current status is completed (fresh win)
                            const isSolved = bestTime !== undefined || progress?.status === 'completed';
                            const isInProgress = progress?.status === 'in-progress';
                            const isGlobalBest = hasGlobalBest && bestTime !== undefined && bestTime === globalBest;

                            // Style Logic:
                            // - Solved levels always use the 'Completed' background (bg-t-surface-sec) to show they are done.
                            // - If Solved AND In-Progress (Replaying), we add a Blue Ring to show activity, but keep background grey/completed.
                            // - If Not Solved AND In-Progress, we use White/Surface background with Blue Ring.
                            
                            let buttonClass = 'aspect-square rounded-xl relative transition-all active:scale-90 shadow-sm ';
                            
                            if (isSolved) {
                                buttonClass += 'bg-t-surface-sec text-t-secondary ring-1 ring-inset ring-stone-900/5 ';
                                if (isInProgress) {
                                    // Replaying: Add active ring and clearer text color
                                    buttonClass += '!ring-2 !ring-blue-400 !text-t-primary ';
                                }
                            } else if (isInProgress) {
                                // First time playing, active
                                buttonClass += 'bg-t-surface ring-2 ring-blue-400 shadow-md text-t-primary ';
                            } else {
                                // Not started
                                buttonClass += 'bg-t-surface hover:shadow-md text-t-primary ';
                            }

                            return (
                                <button key={lvl} onClick={() => onLevelSelect(lvl)} className={buttonClass}>
                                    <div className="absolute inset-0 flex items-center justify-center"><span className="font-bold text-2xl leading-none">{lvl}</span></div>
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
                    })}
                </div>
                
                {/* Unlock Card Logic - Chained */}
                {!isPack2Unlocked && (
                    <UnlockCard 
                        startLevel={101}
                        endLevel={200}
                        completedCount={completedRange1}
                        totalBaseLevels={100}
                        cost={getPackCost(difficulty, 2)}
                        onUnlock={onUnlockPack2}
                    />
                )}

                {isPack2Unlocked && !isPack3Unlocked && (
                        <UnlockCard 
                        startLevel={201}
                        endLevel={300}
                        completedCount={completedRange2}
                        totalBaseLevels={100}
                        cost={getPackCost(difficulty, 3)}
                        onUnlock={onUnlockPack3}
                    />
                )}

                <div className="h-safe-bottom w-full shrink-0" />
            </div>
        </div>
    );
};
