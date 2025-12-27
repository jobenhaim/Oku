
import React, { useMemo, useState, useEffect } from 'react';
import { Difficulty } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { formatTimeShort, getDifficultyPoints } from '../../utils/constants';
import { sounds } from '../../utils/sound';

interface StatsScreenProps {
    onBack: () => void;
}

// Hook for animating numbers
const useAnimatedCounter = (end: number, duration: number = 1000, delay: number = 0) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;
        let timeoutId: ReturnType<typeof setTimeout>;

        // Reset to 0 when target changes to ensure animation starts from 0
        setCount(0);

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            
            // Linear interpolation
            const ease = progress;
            
            setCount(Math.floor(end * ease));

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };

        if (delay > 0) {
            timeoutId = setTimeout(() => {
                animationFrameId = requestAnimationFrame(animate);
            }, delay);
        } else {
            animationFrameId = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [end, duration, delay]);

    return count;
};

export const StatsScreen: React.FC<StatsScreenProps> = ({ onBack }) => {
    const [selectedDiff, setSelectedDiff] = useState<Difficulty>(Difficulty.Normal);
    const [isDiffMenuOpen, setIsDiffMenuOpen] = useState(false);

    const stats = useMemo(() => {
        const allProgress = Storage.getStoredData().progress;
        const result = {
            completed: 0,
            totalTime: 0,
            bestTime: Infinity,
        };

        Object.values(allProgress).forEach(p => {
            if (p.difficulty === selectedDiff && p.status === 'completed') {
                result.completed++;
                result.totalTime += p.timeElapsed;
                if (p.bestTime && p.bestTime < result.bestTime) {
                    result.bestTime = p.bestTime;
                }
            }
        });

        return result;
    }, [selectedDiff]);

    const averageTime = stats.completed > 0 ? Math.floor(stats.totalTime / stats.completed) : 0;
    const pointsPerGame = getDifficultyPoints(selectedDiff);
    const totalDiamondsEarned = stats.completed * pointsPerGame;
    
    // Animated Values - Delayed by 350ms to start after the menu collapse animation (300ms) finishes
    const animatedCompleted = useAnimatedCounter(stats.completed, 1000, 350);
    const animatedBestTime = useAnimatedCounter(stats.bestTime === Infinity ? 0 : stats.bestTime, 1000, 350);
    const animatedTotalTime = useAnimatedCounter(stats.totalTime, 1000, 350);
    const animatedAverageTime = useAnimatedCounter(averageTime, 1000, 350);
    const animatedDiamonds = useAnimatedCounter(totalDiamondsEarned, 1000, 350);

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

    const handleToggleMenu = () => {
        sounds.playClick();
        setIsDiffMenuOpen(!isDiffMenuOpen);
    };

    const handleSelectDiff = (diff: Difficulty) => {
        sounds.playClick();
        setSelectedDiff(diff);
        setIsDiffMenuOpen(false);
    };

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden">
            {/* Header */}
            <div className="w-full max-w-md flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-200 transition -ml-2 text-t-icon relative z-30">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>
                
                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl font-bold text-t-primary leading-none">Statistics</h1>
                    <p className="text-t-secondary text-[10px] font-bold tracking-widest uppercase mt-1">Your Progress</p>
                </div>
                
                {/* Spacer to balance the layout for centering */}
                <div className="w-10"></div>
            </div>

            {/* Content */}
            <div className="flex-1 w-full overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col items-center">
                <div className="w-full max-w-md pt-2">
                    
                    {/* Collapsible Difficulty Menu (Accordion Style) */}
                    <div className="w-full mb-6 z-20">
                        <button 
                            onClick={handleToggleMenu}
                            className="w-full bg-t-surface p-4 rounded-2xl shadow-sm flex items-center justify-between active:scale-[0.98] transition-all relative z-10"
                        >
                            <span className="text-lg font-bold text-t-primary">{selectedDiff}</span>
                            <Icons.Back className={`w-5 h-5 text-t-secondary transition-transform duration-300 ${isDiffMenuOpen ? '-rotate-90' : '-rotate-180'}`} /> 
                        </button>
                        
                        {/* Accordion Content */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isDiffMenuOpen ? 'max-h-[400px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                            <div className="bg-t-surface rounded-2xl shadow-sm overflow-hidden flex flex-col">
                                {Object.values(Difficulty).map((diff) => (
                                    <button
                                        key={diff}
                                        onClick={() => handleSelectDiff(diff)}
                                        className={`w-full text-left px-5 py-4 text-lg font-bold border-b border-stone-200 dark:border-stone-700 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors ${selectedDiff === diff ? 'text-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'text-t-primary'}`}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Big Numbers Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Completed Games */}
                        <div className="bg-t-surface p-6 rounded-3xl shadow-sm flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full flex items-center justify-center mb-3">
                                <Icons.Check className="w-6 h-6 stroke-[3]" />
                            </div>
                            <span className="text-3xl font-bold text-t-primary mb-1">{animatedCompleted}</span>
                            <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Solved</span>
                        </div>

                        {/* Best Time */}
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

                    {/* Detailed Stats Card */}
                    <div className="bg-t-surface rounded-3xl shadow-sm overflow-hidden mb-6">
                        {/* Total Time */}
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
                        
                        {/* Average Time */}
                        <div className="p-5 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-full flex items-center justify-center">
                                    <Icons.BarChart className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Average Time</span>
                            </div>
                            <span className="text-lg font-bold text-t-primary">
                                {averageTime === 0 ? '--' : formatFullTime(animatedAverageTime)}
                            </span>
                        </div>

                        {/* Diamonds Earned */}
                        <div className="p-5 flex items-center justify-between bg-gradient-to-r from-transparent via-blue-50/20 to-transparent dark:via-blue-900/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-300 rounded-full flex items-center justify-center shadow-inner">
                                    <Icons.Diamond className="w-5 h-5 fill-current" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-t-secondary uppercase tracking-wider">Diamonds Earned</span>
                                    <span className="text-[10px] font-medium text-blue-400 dark:text-blue-500 tracking-tight leading-none mt-0.5">+{pointsPerGame} per game</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-t-primary">
                                    {animatedDiamonds.toLocaleString()}
                                </span>
                                <Icons.Diamond className="w-4 h-4 text-blue-500 fill-current" />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
