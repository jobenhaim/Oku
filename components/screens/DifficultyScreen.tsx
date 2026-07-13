
import React, { useState, useEffect } from 'react';
import { Difficulty } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { sounds } from '../../utils/sound';
import { getDifficultyPoints, DIFFICULTY_DESCRIPTIONS } from '../../utils/constants';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface DifficultyScreenProps {
    points: number;
    onDifficultySelect: (diff: Difficulty) => void;
    onOpenSettings: () => void;
    onOpenProfile: () => void;
    onOpenStore: () => void;
    onOpenDiamondShop: () => void;
    onClaimBonus: (e: React.MouseEvent) => void;
    onOpenStats: () => void;
    nextBonusClaimTime: number;
    hiddenDifficulties?: Difficulty[]; 
    hasPendingPepinoGift?: boolean;
    onContinue?: (diff: Difficulty, levelId: number) => void;
}

const SUBTITLES = [
    "Choose your pace",
    "Find your flow",
    "Time to focus",
    "Relax and solve",
    "Pick your challenge",
    "Sharpen your mind",
    "Enjoy the quiet",
    "A moment of zen",
    "Ready to play?",
    "Sudoku awaits",
    "Breathe and begin"
];

// Internal Hook for Counting Animation (Progress Bars)
const useAnimatedCounter = (target: number, duration: number = 500, delay: number = 200) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;
        let timeoutId: any;

        setCount(0);

        const startAnimation = () => {
            const animate = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const progress = Math.min((currentTime - startTime) / duration, 1);
                const ease = progress; // Linear animation
                
                setCount(Math.floor(target * ease));

                if (progress < 1) {
                    animationFrameId = requestAnimationFrame(animate);
                } else {
                    setCount(target);
                }
            };
            animationFrameId = requestAnimationFrame(animate);
        };

        if (delay > 0) {
            timeoutId = setTimeout(startAnimation, delay);
        } else {
            startAnimation();
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [target, duration, delay]);

    return count;
};

// Sub-component for individual cards
const DifficultyCard: React.FC<{
    diff: Difficulty;
    index: number;
    onSelect: (diff: Difficulty) => void;
    isPyramidTop?: boolean;
    contentScale?: 'normal' | 'medium' | 'large';
    layoutStyle?: React.CSSProperties;
}> = ({ diff, index, onSelect, isPyramidTop, contentScale = 'normal', layoutStyle }) => {
    
    const completed = Storage.getCompletedCount(diff, 300);
    const isPack2Unlocked = Storage.isPack2Unlocked(diff);
    const isPack3Unlocked = Storage.isPack3Unlocked(diff);
    
    let maxLevels = 100;
    if (isPack2Unlocked) maxLevels = 200;
    if (isPack3Unlocked) maxLevels = 300;

    const diffPoints = getDifficultyPoints(diff);
    
    const delay = 100 + (index * 50);

    const baseZIndex = 30 - index;
    const finalZIndex = baseZIndex;

    const animatedCompleted = useAnimatedCounter(completed, 1500);
    const progressPercent = Math.min((animatedCompleted / maxLevels) * 100, 100);

    const defaultStyle: React.CSSProperties = {
        width: '47.5%',
        aspectRatio: '1.91/1', 
    };

    const finalStyle = { ...defaultStyle, ...layoutStyle, zIndex: finalZIndex, animationDelay: `${delay}ms` };

    const titleClass = contentScale === 'large' ? 'text-3xl' : (contentScale === 'medium' ? 'text-2xl' : 'text-lg');
    const iconSizeClass = contentScale === 'large' ? 'w-5 h-5' : (contentScale === 'medium' ? 'w-4 h-4' : 'w-3 h-3');
    const pointsTextClass = contentScale === 'large' ? 'text-base' : (contentScale === 'medium' ? 'text-sm' : 'text-xs');
    const progressTextClass = contentScale === 'large' ? 'text-sm' : (contentScale === 'medium' ? 'text-xs' : 'text-[10px]');
    const progressBarHeight = contentScale === 'large' ? 'h-3' : (contentScale === 'medium' ? 'h-2.5' : 'h-1.5');
    const paddingClass = contentScale === 'large' ? 'p-6' : (contentScale === 'medium' ? 'p-5' : 'p-3.5');

    return (
        <div 
            style={finalStyle}
            className="opacity-0 animate-slide-in-down"
        >
            <button 
                onClick={() => { sounds.playClick(); onSelect(diff); }} 
                className={`w-full h-full bg-white dark:bg-stone-900 border border-white/40 dark:border-white/10 ${paddingClass} rounded-2xl shadow-sm flex flex-col justify-between transition-all active:scale-95 text-left relative group overflow-visible`}
            >
                <div className="w-full flex justify-between items-center mb-1">
                    <span className={`font-bold text-stone-800 dark:text-white leading-none tracking-tight truncate mr-1 ${titleClass}`}>{diff}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                        <span className={`${pointsTextClass} font-bold text-stone-900 dark:text-stone-100 leading-none`}>+{diffPoints}</span>
                        <Icons.Diamond className={`${iconSizeClass} text-blue-500 fill-current`} />
                    </div>
                </div>
                
                <div className="w-full flex justify-between items-end mb-1 mt-auto">
                    <div className="relative z-50"></div>
                    
                    <span className={`${progressTextClass} text-stone-800 dark:text-stone-200 font-bold tracking-wide font-sans leading-none`}>
                        {animatedCompleted} / {maxLevels}
                    </span>
                </div>
                
                <div className={`w-full bg-stone-900/10 dark:bg-white/10 rounded-full overflow-hidden ${progressBarHeight}`}>
                    <div 
                        className="h-full bg-loading-blue" 
                        style={{ 
                            width: `${progressPercent}%`,
                            transition: 'none' 
                        }}
                    ></div>
                </div>
            </button>
        </div>
    );
};

export const DifficultyScreen: React.FC<DifficultyScreenProps> = ({ 
    points, 
    onDifficultySelect, 
    onOpenSettings, 
    onOpenProfile,
    onOpenStore, 
    onOpenDiamondShop, 
    onClaimBonus, 
    onOpenStats, 
    nextBonusClaimTime,
    hiddenDifficulties = [],
    hasPendingPepinoGift = false,
    onContinue
}) => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [subtitle] = useState(() => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]);
    
    const lastPlayedGame = Storage.getLastPlayedGame();

    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            if (now >= nextBonusClaimTime) {
                setTimeLeft("");
                return;
            }
            setTimeLeft("See you tomorrow!");
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [nextBonusClaimTime]);

    const visibleDifficulties = Object.values(Difficulty).filter(d => !hiddenDifficulties.includes(d));
    const isOddCount = visibleDifficulties.length % 2 !== 0;
    const isVerticalStack = visibleDifficulties.length === 2;
    const isOneVisible = visibleDifficulties.length === 1;

    // Common style without hover/active scales
    const BTN_BG_DEFAULT = "bg-white/90 dark:bg-stone-900/90 backdrop-blur-md";
    const BTN_TEXT_DEFAULT = "text-stone-900 dark:text-white";
    const COMMON_BTN_STYLE = `h-14 px-3 rounded-2xl shadow-sm flex items-center justify-center gap-2 transition group border border-white/40 dark:border-white/10 whitespace-nowrap`;

    return (
        <div 
            className="flex-1 w-full flex flex-col items-center overflow-hidden" 
        >
             <style>{`
                @keyframes diamond-scroll {
                    from { background-position: 0 0; }
                    to { background-position: 0 20px; }
                }
             `}</style>

             <div className="flex-1 w-full overflow-hidden px-6 pb-6 pt-4 flex flex-col items-center min-h-0">
                  
                  <div className="flex flex-col items-center mb-8 shrink-0 pt-4">
                      <h1 className="text-6xl font-bold text-stone-800 dark:text-stone-100 tracking-tight leading-none mb-1">Oku</h1>
                      <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.4em] ml-1">Sudoku</span>
                  </div>

                  <div 
                    className="w-full max-w-md flex justify-center mb-2 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: '50ms' }}
                  >
                      <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-[0.2em]">{subtitle}</p>
                  </div>

                  <div className={`w-full max-w-md aspect-[1.15/1] flex flex-wrap content-center justify-center gap-3 shrink-0 ${lastPlayedGame ? 'mb-1' : 'mb-8'}`}>
                      {visibleDifficulties.map((diff, index) => {
                          const isPyramidTop = isOddCount && index === 0 && !isOneVisible;
                          
                          let contentScale: 'normal' | 'medium' | 'large' = 'normal';
                          let layoutStyle: React.CSSProperties = {};

                          if (isOneVisible) {
                              layoutStyle = { width: '62%', aspectRatio: '1.91/1' };
                              contentScale = 'normal';
                          } else if (isVerticalStack) {
                              layoutStyle = { width: '55%', aspectRatio: '1.91/1' };
                              contentScale = 'normal';
                          } else if (isPyramidTop) {
                              layoutStyle = { width: '47.5%', aspectRatio: '1.91/1' };
                          }

                          if (isPyramidTop || isVerticalStack) {
                              return (
                                  <div key={diff} className="w-full flex justify-center">
                                      <DifficultyCard 
                                          diff={diff}
                                          index={index}
                                          onSelect={onDifficultySelect}
                                          isPyramidTop={true}
                                          contentScale={contentScale}
                                          layoutStyle={layoutStyle}
                                      />
                                  </div>
                              );
                          }

                          return (
                              <DifficultyCard 
                                  key={diff}
                                  diff={diff}
                                  index={index}
                                  onSelect={onDifficultySelect}
                                  contentScale={contentScale}
                                  layoutStyle={layoutStyle}
                              />
                          );
                      })}
                  </div>

                  {/* Continue Button */}
                  {lastPlayedGame && (
                  <div 
                    className="w-full max-w-md flex justify-center mb-7 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: '200ms' }}
                  >
                      <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            sounds.playClick(); 
                            if (onContinue) onContinue(lastPlayedGame.difficulty, lastPlayedGame.levelId);
                        }}
                        className="relative flex items-center justify-center gap-3 w-[55%] py-3 px-5 bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl text-blue-600 dark:text-blue-400 active:scale-95 shadow-md"
                      >
                          <div className="flex flex-col items-center text-center">
                              <span className="text-sm font-bold leading-none">Continue Game</span>
                              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 leading-none mt-1.5">
                                  {lastPlayedGame.difficulty} - {lastPlayedGame.levelId}
                              </span>
                          </div>
                          <Icons.Next className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                  </div>
                  )}

                  {/* Footer Actions */}
                  <div className="w-full max-w-md flex flex-col gap-3 shrink-0">
                      <div 
                        className="flex justify-center gap-3 opacity-0 animate-slide-in-down w-full" 
                        style={{ animationDelay: '250ms' }}
                      >
                          <button 
                            onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenStore(); }} 
                            style={{ width: '47.5%' }}
                            className={`${COMMON_BTN_STYLE} ${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} active:scale-95 hover:brightness-105`}
                          >
                              <Icons.Store className="w-5 h-5" /> 
                              <span className="font-bold tracking-wide">Market</span>
                          </button>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenDiamondShop(); }} 
                            style={{ width: '47.5%' }}
                            className={`${COMMON_BTN_STYLE} ${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} relative overflow-visible shadow-sm active:scale-95 hover:brightness-105`}
                          >
                              {hasPendingPepinoGift && (
                                <div className="absolute -top-1.5 -right-1.5 z-50 animate-pop">
                                    <div className="w-[22px] h-[22px] bg-red-500 rounded-full flex items-center justify-center shadow-md animate-bounce">
                                        <Icons.Gift className="w-3.5 h-3.5 text-white" />
                                    </div>
                                </div>
                              )}

                              <div 
                                className="absolute inset-0 opacity-[0.05] pointer-events-none overflow-hidden rounded-2xl"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 2 L18 10 L10 18 L2 10 Z' fill='none' stroke='%23000000' stroke-width='1.5'/%3E%3C/svg%3E")`,
                                    backgroundSize: '20px 20px',
                                    animation: 'diamond-scroll 4s linear infinite'
                                }}
                              />
                              
                              <div className="relative z-10 flex items-center gap-2">
                                  <Icons.Diamond className="w-5 h-5" />
                                  <span className="font-bold tracking-wide">Diamonds</span> 
                              </div>
                          </button>
                      </div>
                      
                      <div 
                        className="flex justify-center gap-3 opacity-0 animate-slide-in-down w-full"
                        style={{ animationDelay: '300ms' }}
                      >
                          <button 
                              onClick={onClaimBonus}
                              disabled={!!timeLeft}
                              style={{ width: '47.5%' }}
                              className={`${COMMON_BTN_STYLE} ${
                                  !!timeLeft 
                                  ? 'bg-white/30 dark:bg-stone-800/30 backdrop-blur-sm text-stone-500 dark:text-stone-400 cursor-not-allowed shadow-none border border-white/20 dark:border-white/5' 
                                  : `${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} active:scale-95 hover:brightness-105`
                              }`}
                          >
                              {!!timeLeft ? (
                                   <div className="flex items-center gap-2">
                                      <Icons.Clock className="w-4 h-4" />
                                      <span className="font-bold text-xs tracking-wide opacity-100">{timeLeft}</span>
                                   </div>
                              ) : (
                                   <div className="flex items-center gap-1.5">
                                      <Icons.Gift className="w-5 h-5 animate-bounce" />
                                      <div className="flex items-center gap-[1px]">
                                          <span className="font-bold tracking-wide">Claim +10</span>
                                          <Icons.Diamond className="w-3.5 h-3.5 text-blue-600 fill-current" />
                                      </div>
                                   </div>
                              )}
                          </button>

                          <button 
                            onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenStats(); }} 
                            style={{ width: '47.5%' }}
                            className={`${COMMON_BTN_STYLE} ${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} active:scale-95 hover:brightness-105`}
                          >
                              <Icons.BarChart className="w-5 h-5" /> 
                              <span className="font-bold tracking-wide">Stats</span>
                          </button>
                      </div>
                  </div>

                  <div 
                    className="w-full max-w-md flex items-center justify-center gap-3 mt-6 mb-2 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: '350ms' }}
                  >
                      <button onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenProfile(); }} className="p-1.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-full shadow-sm hover:bg-white/80 dark:hover:bg-stone-800 transition active:scale-95 text-t-icon">
                          <Icons.User className="w-5 h-5" />
                      </button>

                      <div 
                        className="flex items-center gap-1.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border border-white/40 dark:border-white/10 px-3 py-1.5 rounded-full shadow-sm"
                      >
                          <AnimatedNumber value={points} className="text-sm font-semibold text-t-primary tabular-nums leading-none pt-0.5" />
                          <div className="text-blue-500"><Icons.Diamond className="w-3.5 h-3.5 fill-current" /></div>
                      </div>
                      
                      <button onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenSettings(); }} className="p-1.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-full shadow-sm hover:bg-white/80 dark:hover:bg-stone-800 transition active:scale-95 text-t-icon">
                          <Icons.Settings className="w-5 h-5" />
                      </button>
                  </div>

                  <div className="h-safe-bottom w-full shrink-0" />
             </div>
        </div>
    );
};
