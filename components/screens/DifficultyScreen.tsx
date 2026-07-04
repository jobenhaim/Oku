
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
const useAnimatedCounter = (target: number, duration: number = 500) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        setCount(0);

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); 
            
            setCount(Math.floor(target * ease));

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [target, duration]);

    return count;
};

// Sub-component for individual cards
const DifficultyCard: React.FC<{
    diff: Difficulty;
    index: number;
    onSelect: (diff: Difficulty) => void;
    activeInfo: Difficulty | null;
    onInfoToggle: (diff: Difficulty) => void;
    isClosing: boolean;
    description: string;
    isPyramidTop?: boolean;
    contentScale?: 'normal' | 'medium' | 'large';
    layoutStyle?: React.CSSProperties;
}> = ({ diff, index, onSelect, activeInfo, onInfoToggle, isClosing, description, isPyramidTop, contentScale = 'normal', layoutStyle }) => {
    
    const completed = Storage.getCompletedCount(diff, 300);
    const isPack2Unlocked = Storage.isPack2Unlocked(diff);
    const isPack3Unlocked = Storage.isPack3Unlocked(diff);
    
    let maxLevels = 100;
    if (isPack2Unlocked) maxLevels = 200;
    if (isPack3Unlocked) maxLevels = 300;

    const diffPoints = getDifficultyPoints(diff);
    
    const delay = 100 + (index * 50);
    const isInfoActive = activeInfo === diff;
    const isLeftColumn = isPyramidTop ? true : index % 2 === 0;

    const [animating, setAnimating] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => {
            setAnimating(false);
        }, delay + 600);
        return () => clearTimeout(t);
    }, [delay]);

    const baseZIndex = 30 - index;
    const finalZIndex = isInfoActive ? 100 : baseZIndex;

    const animatedCompleted = useAnimatedCounter(completed, 500);
    const progressPercent = Math.min((animatedCompleted / maxLevels) * 100, 100);

    const defaultStyle: React.CSSProperties = {
        width: '47.5%',
        aspectRatio: '1.55/1', 
    };

    const finalStyle = { ...defaultStyle, ...layoutStyle, zIndex: finalZIndex, animationDelay: `${delay}ms` };

    const titleClass = contentScale === 'large' ? 'text-3xl' : (contentScale === 'medium' ? 'text-2xl' : 'text-lg');
    const iconSizeClass = contentScale === 'large' ? 'w-5 h-5' : (contentScale === 'medium' ? 'w-4 h-4' : 'w-3 h-3');
    const infoIconSizeClass = contentScale === 'large' ? 'w-8 h-8 -ml-1.5' : (contentScale === 'medium' ? 'w-7 h-7 -ml-1' : 'w-6 h-6 -ml-0.5');
    const infoIconInnerSize = contentScale === 'large' ? 'w-6 h-6' : (contentScale === 'medium' ? 'w-5 h-5' : 'w-4 h-4');
    const pointsTextClass = contentScale === 'large' ? 'text-base' : (contentScale === 'medium' ? 'text-sm' : 'text-xs');
    const progressTextClass = contentScale === 'large' ? 'text-sm' : (contentScale === 'medium' ? 'text-xs' : 'text-[10px]');
    const progressBarHeight = contentScale === 'large' ? 'h-3' : (contentScale === 'medium' ? 'h-2.5' : 'h-1.5');
    const paddingClass = contentScale === 'large' ? 'p-6' : (contentScale === 'medium' ? 'p-5' : 'p-3.5');

    return (
        <button 
            onClick={() => onSelect(diff)} 
            style={finalStyle}
            className={`bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border border-white/40 dark:border-white/10 ${paddingClass} rounded-2xl shadow-sm flex flex-col justify-between transition-all active:scale-95 hover:brightness-105 text-left relative group overflow-visible ${animating ? 'opacity-0 animate-slide-in-down' : 'opacity-100'}`}
        >
            <div className="w-full flex justify-between items-center mb-1">
                <span className={`font-bold text-stone-800 dark:text-white leading-none tracking-tight truncate mr-1 ${titleClass}`}>{diff}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                    <span className={`${pointsTextClass} font-bold text-stone-900 dark:text-stone-100 leading-none`}>+{diffPoints}</span>
                    <Icons.Diamond className={`${iconSizeClass} text-blue-500 fill-current`} />
                </div>
            </div>
            
            <div className="w-full flex justify-between items-end mb-1 mt-auto">
                <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
                    <div 
                        role="button"
                        onClick={() => onInfoToggle(diff)}
                        className={`flex items-center justify-center cursor-pointer hover:bg-stone-900/5 dark:hover:bg-white/10 rounded-full transition-colors ${infoIconSizeClass}`}
                    >
                        <Icons.Info className={`${infoIconInnerSize} transition-colors ${isInfoActive ? 'text-stone-900 dark:text-white' : 'text-stone-500 dark:text-stone-400'}`} />
                    </div>

                    {isInfoActive && (
                        <div 
                            className={`absolute top-full mt-2 w-44 z-[60] cursor-default ${
                                isLeftColumn 
                                    ? '-left-2 origin-top-left' 
                                    : '-right-2 origin-top-right'
                            } ${isClosing ? 'animate-tooltip-exit' : 'animate-tooltip-enter'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-white/95 backdrop-blur-xl text-stone-900 text-xs font-medium p-3 rounded-xl relative text-left leading-relaxed border border-stone-200 dark:border-stone-700 shadow-lg">
                                {description}
                                <div className={`absolute -top-[6px] w-3 h-3 bg-white/95 border-t border-l border-stone-200 dark:border-stone-700 transform rotate-45 ${
                                    isLeftColumn ? 'left-[14px]' : 'right-[14px]'
                                }`}></div>
                            </div>
                        </div>
                    )}
                </div>
                
                <span className={`${progressTextClass} text-stone-800 dark:text-stone-200 font-bold tracking-wide font-sans leading-none`}>
                    {animatedCompleted} / {maxLevels}
                </span>
            </div>
            
            <div className={`w-full bg-stone-900/10 dark:bg-white/10 rounded-full overflow-hidden ${progressBarHeight}`}>
                <div 
                    className="h-full bg-loading-blue" 
                    style={{ 
                        width: `${progressPercent}%`,
                        transition: 'width 0.1s linear' 
                    }}
                ></div>
            </div>
        </button>
    );
};

export const DifficultyScreen: React.FC<DifficultyScreenProps> = ({ 
    points, 
    onDifficultySelect, 
    onOpenSettings, 
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
    const [activeInfo, setActiveInfo] = useState<Difficulty | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [subtitle] = useState(() => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]);
    
    const lastPlayedGame = Storage.getLastPlayedGame();
    
    const [infoIndices, setInfoIndices] = useState<Record<string, number>>({});

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

    const handleClose = () => {
        if (!activeInfo) return;
        setIsClosing(true);
        const closingDiff = activeInfo;
        setTimeout(() => {
            setActiveInfo(null);
            setIsClosing(false);
            setInfoIndices(prev => ({
                ...prev,
                [closingDiff]: (prev[closingDiff] || 0) + 1
            }));
        }, 150);
    };

    const handleInfoToggle = (diff: Difficulty) => {
        sounds.playTap();
        if (activeInfo === diff) {
            handleClose();
        } else {
            setActiveInfo(diff);
            setIsClosing(false);
        }
    };

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
            onClick={() => activeInfo && handleClose()}
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

                  <div className={`w-full max-w-md flex flex-wrap justify-center gap-3 shrink-0 min-h-[330px] content-center ${lastPlayedGame ? 'mb-4' : 'mb-8'}`}>
                      {visibleDifficulties.map((diff, index) => {
                          const descriptions = DIFFICULTY_DESCRIPTIONS[diff];
                          const currentIndex = infoIndices[diff] || 0;
                          const description = descriptions[currentIndex % descriptions.length];
                          
                          const isPyramidTop = isOddCount && index === 0 && !isOneVisible;
                          
                          let contentScale: 'normal' | 'medium' | 'large' = 'normal';
                          let layoutStyle: React.CSSProperties = {};

                          if (isOneVisible) {
                              layoutStyle = { width: '62%', aspectRatio: '1.55/1' };
                              contentScale = 'normal';
                          } else if (isVerticalStack) {
                              layoutStyle = { width: '55%', aspectRatio: '1.55/1' };
                              contentScale = 'normal';
                          } else if (isPyramidTop) {
                              layoutStyle = { width: '47.5%', aspectRatio: '1.55/1' };
                          }

                          if (isPyramidTop || isVerticalStack) {
                              return (
                                  <div key={diff} className="w-full flex justify-center">
                                      <DifficultyCard 
                                          diff={diff}
                                          index={index}
                                          onSelect={onDifficultySelect}
                                          activeInfo={activeInfo}
                                          onInfoToggle={handleInfoToggle}
                                          isClosing={isClosing && activeInfo === diff}
                                          description={description}
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
                                  activeInfo={activeInfo}
                                  onInfoToggle={handleInfoToggle}
                                  isClosing={isClosing && activeInfo === diff}
                                  description={description}
                                  contentScale={contentScale}
                                  layoutStyle={layoutStyle}
                              />
                          );
                      })}
                  </div>

                  {/* Continue Button */}
                  {lastPlayedGame && (
                  <div 
                    className="w-full max-w-md flex justify-center mb-4 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: '200ms' }}
                  >
                      <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            sounds.playClick(); 
                            if (onContinue) onContinue(lastPlayedGame.difficulty, lastPlayedGame.levelId);
                        }}
                        className="flex items-center justify-center gap-2 w-[47.5%] py-3 bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 dark:border-blue-500/30 rounded-2xl text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-all active:scale-95 shadow-sm"
                      >
                          <span>Continue Game</span>
                          <Icons.Next className="w-4 h-4" />
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
