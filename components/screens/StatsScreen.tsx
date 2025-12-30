
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Difficulty, LevelProgress, StoredData } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { formatTimeShort, getDifficultyPoints } from '../../utils/constants';
import { sounds } from '../../utils/sound';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface StatsScreenProps {
    onBack: () => void;
    onEarnPoints?: (amount: number, source?: HTMLElement | DOMRect | null) => void;
    points: number;
}

// Hook for 1.5s counter animation with sound feedback
const useStatCounter = (target: number, dependency: any) => {
    const [count, setCount] = useState(0);
    const lastSoundValue = useRef(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrame: number;

        // Reset state on dependency change
        setCount(0);
        lastSoundValue.current = 0;

        const animate = (time: number) => {
            if (!startTime) startTime = time;
            const progress = Math.min((time - startTime) / 1500, 1); // 1.5s duration
            
            // Linear Easing
            const ease = progress; 
            
            const currentRaw = target * ease;
            const currentInt = Math.floor(currentRaw);

            // Play ticking sound if the integer value has changed
            if (currentInt !== lastSoundValue.current) {
                sounds.playCounterTick();
                lastSoundValue.current = currentInt;
            }

            setCount(currentRaw);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(target);
                // Ensure final sound if the target wasn't reached in the last step
                if (Math.floor(target) !== lastSoundValue.current) {
                    sounds.playCounterTick();
                }
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrame);
    }, [target, dependency]);

    return count;
};

export const StatsScreen: React.FC<StatsScreenProps> = ({ onBack, onEarnPoints, points }) => {
    // Stats State
    const [selectedDiff, setSelectedDiff] = useState<Difficulty>(Difficulty.Normal);
    const [isDiffMenuOpen, setIsDiffMenuOpen] = useState(false);

    // Load Data
    const [storedData, setStoredData] = useState(Storage.getStoredData());
    
    // Derived Stats
    const stats = useMemo(() => {
        const allProgress = storedData.progress;
        const result = {
            completed: 0,
            totalTime: 0,
            bestTime: Infinity,
        };

        Object.values(allProgress).forEach((p: LevelProgress) => {
            if (p.difficulty === selectedDiff && (p.status === 'completed' || p.bestTime !== undefined)) {
                result.completed++;
                const timeToAdd = p.bestTime !== undefined ? p.bestTime : p.timeElapsed;
                result.totalTime += timeToAdd;
                if (p.bestTime && p.bestTime < result.bestTime) {
                    result.bestTime = p.bestTime;
                }
            }
        });
        return result;
    }, [selectedDiff, storedData]);

    const averageTime = stats.completed > 0 ? Math.floor(stats.totalTime / stats.completed) : 0;
    const pointsPerGame = getDifficultyPoints(selectedDiff);
    const totalDiamondsEarned = stats.completed * pointsPerGame;
    
    // Animated Values
    const animatedCompleted = useStatCounter(stats.completed, selectedDiff);
    const animatedBestTime = useStatCounter(stats.bestTime === Infinity ? 0 : stats.bestTime, selectedDiff);
    const animatedTotalTime = useStatCounter(stats.totalTime, selectedDiff);
    const animatedAvgTime = useStatCounter(averageTime, selectedDiff);
    const animatedEarned = useStatCounter(totalDiamondsEarned, selectedDiff);
    
    const formatFullTime = (seconds: number) => {
        const total = Math.floor(seconds);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const mStr = m.toString().padStart(2, '0');
        const sStr = s.toString().padStart(2, '0');
        if (h > 0) return `${h}h ${mStr}m ${sStr}s`;
        return `${mStr}m ${sStr}s`;
    };

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden">
            {/* Header */}
            <div className="w-full max-w-md flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-200 transition -ml-2 text-t-icon relative z-30">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>
                
                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl font-bold text-t-primary leading-none">Stats</h1>
                    <p className="text-t-secondary text-[10px] font-bold tracking-widest uppercase mt-1">My Journey</p>
                </div>
                
                <div className="flex items-center gap-1 bg-t-surface px-3 py-2 rounded-full shadow-sm relative z-30">
                      <div className="contents">
                        <AnimatedNumber value={points} className="text-sm font-bold text-t-primary tabular-nums" />
                        <div className="text-blue-500"><Icons.Diamond className="w-3 h-3 fill-current" /></div>
                      </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 w-full overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col items-center">
                <div className="w-full max-w-md pt-2">
                    
                    <div className="animate-fade-in space-y-4">
                        {/* Difficulty Selector */}
                        <div className="w-full z-20">
                            <button 
                                onClick={() => { sounds.playClick(); setIsDiffMenuOpen(!isDiffMenuOpen); }}
                                className="w-full bg-t-surface p-4 rounded-2xl shadow-sm flex items-center justify-between active:scale-[0.98] transition-all relative z-10"
                            >
                                <span className="text-lg font-bold text-t-primary">{selectedDiff}</span>
                                <Icons.Back className={`w-5 h-5 text-t-secondary transition-transform duration-300 ${isDiffMenuOpen ? '-rotate-90' : '-rotate-180'}`} /> 
                            </button>
                            
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isDiffMenuOpen ? 'max-h-[400px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                                <div className="bg-t-surface rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                    {Object.values(Difficulty).map((diff) => (
                                        <button
                                            key={diff}
                                            onClick={() => { sounds.playClick(); setSelectedDiff(diff); setIsDiffMenuOpen(false); }}
                                            className={`w-full text-left px-5 py-4 text-lg font-bold border-b border-stone-200 dark:border-stone-700 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors ${selectedDiff === diff ? 'text-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'text-t-primary'}`}
                                        >
                                            {diff}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Big Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-t-surface p-6 rounded-3xl shadow-sm flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full flex items-center justify-center mb-3">
                                    <Icons.Check className="w-6 h-6 stroke-[3]" />
                                </div>
                                <span className="text-3xl font-bold text-t-primary mb-1">
                                    {Math.floor(animatedCompleted)}
                                </span>
                                <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Solved</span>
                            </div>

                            <div className="bg-t-surface p-6 rounded-3xl shadow-sm flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center justify-center mb-3">
                                    <Icons.Sparkles className="w-6 h-6" />
                                </div>
                                <span className="text-3xl font-bold text-t-primary mb-1">
                                    {stats.bestTime === Infinity ? '--' : formatTimeShort(animatedBestTime)}
                                </span>
                                <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Best Time</span>
                            </div>
                        </div>

                        {/* Detailed List */}
                        <div className="bg-t-surface rounded-3xl shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full flex items-center justify-center">
                                        <Icons.Clock className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Total Time</span>
                                </div>
                                <span className="text-lg font-bold text-t-primary">
                                    {formatFullTime(animatedTotalTime)}
                                </span>
                            </div>
                            
                            <div className="p-5 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-full flex items-center justify-center">
                                        <Icons.BarChart className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Avg Time</span>
                                </div>
                                <span className="text-lg font-bold text-t-primary">
                                    {averageTime === 0 ? '--' : formatFullTime(animatedAvgTime)}
                                </span>
                            </div>

                            <div className="p-5 flex items-center justify-between bg-gradient-to-r from-transparent via-blue-50/20 to-transparent dark:via-blue-900/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-300 rounded-full flex items-center justify-center shadow-inner">
                                        <Icons.Diamond className="w-5 h-5 fill-current" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Earned</span>
                                        <span className="text-[10px] font-medium text-blue-400 dark:text-blue-500 tracking-tight leading-none mt-0.5">+{pointsPerGame} / game</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-t-primary">
                                        {Math.floor(animatedEarned).toLocaleString()}
                                    </span>
                                    <Icons.Diamond className="w-4 h-4 text-blue-500 fill-current" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
