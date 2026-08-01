
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Difficulty, LevelProgress, StoredData } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { formatTimeShort, getDifficultyPoints } from '../../utils/constants';
import { sounds } from '../../utils/sound';
import { DiamondBalancePill } from '../ui/DiamondBalancePill';
import { AnimatePresence, motion } from 'framer-motion';
import { easeInOut, easeOut } from '../../utils/animation';

interface StatsScreenProps {
    onBack: () => void;
    onEarnPoints?: (amount: number, source?: HTMLElement | DOMRect | null) => void;
    points: number;
}

// Hook for 1.5s counter animation with sound feedback (delayed by 0.5s)
const useStatCounter = (target: number, dependency: any, easing: (progress: number) => number = easeInOut, duration = 1500) => {
    const [count, setCount] = useState(0);
    const lastSoundValue = useRef(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrame: number;
        let disposed = false;

        // Reset state on dependency change
        setCount(0);
        lastSoundValue.current = 0;

        const animate = (time: number) => {
            if (disposed) return;
            if (!startTime) startTime = time;
            const progress = Math.min((time - startTime) / duration, 1);
            
            const ease = easing(progress);
            
            const currentRaw = target * ease;
            const currentInt = Math.floor(currentRaw);

            // Play ticking sound if the integer value has changed
            if (currentInt !== lastSoundValue.current) {
                sounds.playCounterTick();
                lastSoundValue.current = currentInt;
            }

            setCount(currentRaw);

            if (progress < 1) {
                if (!disposed) animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(target);
                // Ensure final sound if the target wasn't reached in the last step
                if (Math.floor(target) !== lastSoundValue.current) {
                    sounds.playCounterTick();
                }
            }
        };

        const timer = setTimeout(() => {
            if (!disposed) animationFrame = requestAnimationFrame(animate);
        }, 500);

        return () => {
            disposed = true;
            clearTimeout(timer);
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [target, dependency, easing, duration]);

    return count;
};

const cardVariants = {
    enter: { opacity: 0, y: -20 },
    center: { 
        opacity: 1, 
        y: 0,
        transition: {
            type: "spring",
            stiffness: 120,
            damping: 15
        }
    },
    exit: { 
        opacity: 0, 
        y: 15,
        transition: {
            duration: 0.15
        }
    }
};

export const StatsScreen: React.FC<StatsScreenProps> = ({ onBack, onEarnPoints, points }) => {
    // Stats State
    const [selectedDiff, setSelectedDiff] = useState<Difficulty>(Difficulty.Normal);
    const [direction, setDirection] = useState(0);

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
    const animatedEarned = useStatCounter(totalDiamondsEarned, selectedDiff, easeOut, 1000);
    
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

    const handleDiffChange = (newDiff: Difficulty) => {
        if (newDiff === selectedDiff) return;
        sounds.playClick();
        
        const difficulties = Object.values(Difficulty);
        const currentIndex = difficulties.indexOf(selectedDiff);
        const newIndex = difficulties.indexOf(newDiff);
        
        setDirection(newIndex > currentIndex ? 1 : -1);
        setSelectedDiff(newDiff);
    };

    const tabContentVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.95,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: {
                x: { type: "spring", stiffness: 200, damping: 25 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
                staggerChildren: 0.08,
                delayChildren: 0.05
            }
        },
        exit: (dir: number) => ({
            x: dir > 0 ? '-100%' : '100%',
            opacity: 0,
            scale: 0.95,
            position: 'absolute' as const,
            inset: 0,
            width: '100%',
            transition: {
                x: { type: "spring", stiffness: 200, damping: 25 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 }
            }
        }),
    };

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden">
            {/* Header */}
            <div className="w-full max-w-md md:max-w-[700px] flex items-center justify-between px-6 md:px-0 pt-4 md:pt-7 pb-4 relative shrink-0 z-20">
                <button onClick={onBack} aria-label="Back to menu" className="p-2 md:p-2.5 rounded-full -ml-2 text-t-icon relative z-30 active:scale-95 transition">
                    <Icons.Back className="w-6 h-6 md:w-7 md:h-7 text-t-icon" />
                </button>
                
                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl md:text-2xl font-bold text-t-primary leading-none">Stats</h1>
                </div>
                
                <DiamondBalancePill points={points} />
            </div>

            {/* Content Area */}
            <div className="flex-1 w-full overflow-y-auto overflow-x-hidden px-6 md:px-0 pb-6 hide-scrollbar flex flex-col items-center">
                <div className="w-full max-w-md md:max-w-[620px] pt-2 md:pt-4">
                    
                    <motion.div 
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: {
                                opacity: 1,
                                transition: {
                                    staggerChildren: 0.1,
                                    delayChildren: 0.05
                                }
                            }
                        }}
                        className="space-y-4 md:space-y-5 w-full"
                    >
                        
                        {/* Difficulty Tabs (Segmented Control) */}
                        <motion.div 
                            variants={{
                                hidden: { opacity: 0, y: -20 },
                                show: { 
                                    opacity: 1, 
                                    y: 0,
                                    transition: {
                                        type: "spring",
                                        stiffness: 120,
                                        damping: 15
                                    }
                                }
                            }}
                            className="oku-segmented-control w-full p-1 rounded-xl flex items-stretch relative min-h-[44px] md:min-h-[52px]"
                        >
                            {Object.values(Difficulty).map((diff) => {
                                const isActive = selectedDiff === diff;
                                const words = diff.split(' ');
                                
                                return (
                                    <button
                                        key={diff}
                                        onClick={() => handleDiffChange(diff)}
                                        className={`
                                            flex-1 py-2 px-0.5 text-[11px] md:text-[13px] font-bold transition-all relative z-10 flex flex-col items-center justify-center
                                            ${isActive 
                                                ? 'text-stone-900 dark:text-white'
                                                : 'text-stone-400 dark:text-stone-400'
                                            }
                                        `}
                                    >
                                        <div className="relative z-20 flex flex-col items-center leading-none gap-0">
                                            {words.map((w, i) => <span key={i}>{w}</span>)}
                                        </div>
                                        {isActive && (
                                            <motion.div 
                                                layoutId="activeDiffPill"
                                                className="oku-segmented-pill absolute inset-0 rounded-lg z-10"
                                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </motion.div>

                        <motion.div 
                            variants={{
                                hidden: { opacity: 0, y: 15 },
                                show: { 
                                    opacity: 1, 
                                    y: 0,
                                    transition: {
                                        type: "spring",
                                        stiffness: 120,
                                        damping: 15
                                    }
                                }
                            }}
                            className="w-full relative overflow-hidden"
                        >
                            <AnimatePresence initial={false} custom={direction}>
                                <motion.div
                                    key={selectedDiff}
                                    custom={direction}
                                    variants={tabContentVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    className="w-full space-y-4 md:space-y-5"
                                >
                                    {/* Big Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4 md:gap-5">
                                        <motion.div variants={cardVariants} className="bg-t-surface p-6 md:p-8 md:min-h-[190px] rounded-3xl shadow-sm flex flex-col items-center justify-center text-center">
                                            <div className="w-12 h-12 md:w-14 md:h-14 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full flex items-center justify-center mb-3 md:mb-4">
                                                <Icons.Check className="w-6 h-6 md:w-7 md:h-7 stroke-[3]" />
                                            </div>
                                            <span className="text-3xl md:text-4xl font-bold text-t-primary mb-1">
                                                {Math.floor(animatedCompleted)}
                                            </span>
                                            <span className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-wider">Solved</span>
                                        </motion.div>

                                        <motion.div variants={cardVariants} className="bg-t-surface p-6 md:p-8 md:min-h-[190px] rounded-3xl shadow-sm flex flex-col items-center justify-center text-center">
                                            <div className="w-12 h-12 md:w-14 md:h-14 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center justify-center mb-3 md:mb-4">
                                                <Icons.Timer className="w-6 h-6 md:w-7 md:h-7 stroke-[2.4]" />
                                            </div>
                                            <span className="text-3xl md:text-4xl font-bold text-t-primary mb-1">
                                                {stats.bestTime === Infinity ? '--' : formatTimeShort(animatedBestTime)}
                                            </span>
                                            <span className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-wider">Best Time</span>
                                        </motion.div>
                                    </div>

                                    {/* Detailed List */}
                                    <motion.div variants={cardVariants} className="bg-t-surface rounded-3xl shadow-sm overflow-hidden">
                                        <div className="p-5 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full flex items-center justify-center">
                                                    <Icons.Clock className="w-5 h-5 md:w-6 md:h-6" />
                                                </div>
                                                <span className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-wider">Total Time</span>
                                            </div>
                                            <span className="text-lg md:text-xl font-bold text-t-primary">
                                                {formatFullTime(animatedTotalTime)}
                                            </span>
                                        </div>
                                        
                                        <div className="p-5 md:p-6 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-full flex items-center justify-center">
                                                    <Icons.BarChart className="w-5 h-5 md:w-6 md:h-6" />
                                                </div>
                                                <span className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-wider">Avg Time</span>
                                            </div>
                                            <span className="text-lg md:text-xl font-bold text-t-primary">
                                                {averageTime === 0 ? '--' : formatFullTime(animatedAvgTime)}
                                            </span>
                                        </div>

                                        <div className="p-5 md:p-6 flex items-center justify-between bg-gradient-to-r from-transparent via-blue-50/20 to-transparent dark:via-blue-900/5">
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-300 rounded-full flex items-center justify-center shadow-inner">
                                                    <Icons.Diamond className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-wider">Earned</span>
                                                    <span className="text-[10px] md:text-xs font-medium text-blue-400 dark:text-blue-500 tracking-tight leading-none mt-0.5">+{pointsPerGame} / game</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl md:text-2xl font-bold text-t-primary">
                                                    {Math.floor(animatedEarned).toLocaleString()}
                                                </span>
                                                <Icons.Diamond className="w-4 h-4 md:w-5 md:h-5 text-blue-500 fill-current" />
                                            </div>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>

                </div>
                <div className="h-safe-bottom w-full shrink-0" />
            </div>
        </div>
    );
};
