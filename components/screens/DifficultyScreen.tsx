
import React, { useState, useEffect, useRef } from 'react';
import { Difficulty } from '../../types';
import { Storage } from '../../utils/storage';
import { Icons } from '../ui/Icons';
import { sounds } from '../../utils/sound';
import { getDifficultyPoints, DIFFICULTY_DESCRIPTIONS } from '../../utils/constants';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { easeInOut } from '../../utils/animation';

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
    hasProfileAchievement?: boolean;
    onContinue?: (diff: Difficulty, levelId: number) => void;
    cascadeDelayMs?: number;
}

// Internal Hook for Counting Animation (Progress Bars)
const useAnimatedCounter = (target: number, duration: number = 500, delay: number = 200, enabled = true) => {
    const [count, setCount] = useState(enabled ? 0 : target);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;
        let timeoutId: any;

        if (!enabled) {
            setCount(target);
            return;
        }

        setCount(0);

        const startAnimation = () => {
            const animate = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const progress = Math.min((currentTime - startTime) / duration, 1);
                const ease = easeInOut(progress);
                
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
    }, [target, duration, delay, enabled]);

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
    celebrateProgress?: boolean;
    cascadeDelayMs?: number;
    isPressed?: boolean;
    isLocked?: boolean;
}> = ({ diff, index, onSelect, isPyramidTop, contentScale = 'normal', layoutStyle, celebrateProgress = false, cascadeDelayMs = 0, isPressed = false, isLocked = false }) => {
    
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

    const animatedCompleted = useAnimatedCounter(completed, 1500, 200, celebrateProgress);
    const progressPercent = Math.min((animatedCompleted / maxLevels) * 100, 100);

    const defaultStyle: React.CSSProperties = {
        width: '47.5%',
        aspectRatio: '1.91/1', 
    };

    const finalStyle = { ...defaultStyle, ...layoutStyle, zIndex: finalZIndex, animationDelay: `${delay + cascadeDelayMs}ms` };

    const titleClass = contentScale === 'large' ? 'text-3xl' : (contentScale === 'medium' ? 'text-2xl' : 'text-lg');
    const iconSizeClass = contentScale === 'large' ? 'w-[13px] h-[13px]' : (contentScale === 'medium' ? 'w-[11px] h-[11px]' : 'w-[9px] h-[9px]');
    const progressTextClass = contentScale === 'large' ? 'text-[13px]' : (contentScale === 'medium' ? 'text-[11px]' : 'text-[9px]');
    const pointsTextClass = progressTextClass;
    const progressBarHeight = contentScale === 'large' ? 'h-3' : (contentScale === 'medium' ? 'h-2.5' : 'h-1.5');
    const paddingClass = contentScale === 'large' ? 'p-6' : (contentScale === 'medium' ? 'p-5' : 'p-3.5');

    return (
        <div 
            style={finalStyle}
            className="oku-tactile-shell rounded-2xl opacity-0 animate-slide-in-down"
        >
            <button 
                onClick={() => onSelect(diff)}
                disabled={isLocked}
                className={`oku-difficulty-glass oku-difficulty-card-tactile ${isPressed ? 'oku-difficulty-card-tactile--pressed' : ''} w-full h-full ${paddingClass} rounded-2xl flex flex-col justify-between text-left relative group overflow-visible`}
            >
                <div className="w-full flex items-center justify-center mb-1">
                    <span className={`w-full text-center font-bold text-stone-800 dark:text-white leading-none tracking-tight truncate ${titleClass}`}>{diff}</span>
                </div>
                
                <div className="w-full flex justify-between items-end mb-1 mt-auto">
                    <span className={`${progressTextClass} text-stone-800 dark:text-stone-200 font-bold tracking-wide font-sans leading-none`}>
                        {animatedCompleted} / {maxLevels}
                    </span>

                    <div className="flex items-center gap-0.5 shrink-0 relative z-50">
                        <span className={`${pointsTextClass} font-bold text-stone-900 dark:text-stone-100 leading-none`}>+{diffPoints}</span>
                        <Icons.Diamond className={`${iconSizeClass} text-blue-500 fill-current`} />
                    </div>
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
    hasProfileAchievement = false,
    onContinue,
    cascadeDelayMs = 0
}) => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [pressedMainMenuAction, setPressedMainMenuAction] = useState<string | null>(null);
    const [isMainMenuInteractionLocked, setIsMainMenuInteractionLocked] = useState(false);
    const mainMenuInteractionLockedRef = useRef(false);
    const mainMenuReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mainMenuActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const lastPlayedGame = Storage.getLastPlayedGame();

    useEffect(() => {
        return () => {
            if (mainMenuReleaseTimerRef.current) {
                clearTimeout(mainMenuReleaseTimerRef.current);
            }
            if (mainMenuActionTimerRef.current) {
                clearTimeout(mainMenuActionTimerRef.current);
            }
        };
    }, []);

    const runMainMenuPressCycle = (actionId: string, action: () => void, playPressSound = true) => {
        if (mainMenuInteractionLockedRef.current) return;

        mainMenuInteractionLockedRef.current = true;
        setIsMainMenuInteractionLocked(true);
        setPressedMainMenuAction(actionId);
        if (playPressSound) sounds.playClick();

        mainMenuReleaseTimerRef.current = setTimeout(() => {
            setPressedMainMenuAction(null);
        }, 75);

        mainMenuActionTimerRef.current = setTimeout(() => {
            mainMenuInteractionLockedRef.current = false;
            setIsMainMenuInteractionLocked(false);
            action();
        }, 175);
    };

    const handleDifficultyPress = (diff: Difficulty) => {
        runMainMenuPressCycle(`difficulty-${diff}`, () => onDifficultySelect(diff));
    };

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
    const progressLeader = visibleDifficulties.reduce<Difficulty | null>((leader, diff) => {
        const getProgressRatio = (difficulty: Difficulty) => {
            const maxLevels = Storage.isPack3Unlocked(difficulty)
                ? 300
                : Storage.isPack2Unlocked(difficulty)
                    ? 200
                    : 100;
            return Storage.getCompletedCount(difficulty, 300) / maxLevels;
        };

        const progress = getProgressRatio(diff);
        if (progress <= 0) return leader;
        if (!leader) return diff;
        return progress > getProgressRatio(leader) ? diff : leader;
    }, null);
    const isOddCount = visibleDifficulties.length % 2 !== 0;
    const isVerticalStack = visibleDifficulties.length === 2;
    const isOneVisible = visibleDifficulties.length === 1;

    // Common style without hover/active scales
    const BTN_BG_DEFAULT = "oku-difficulty-glass";
    const BTN_TEXT_DEFAULT = "text-stone-900 dark:text-white";
    const COMMON_BTN_STYLE = `oku-main-menu-tactile h-14 px-3 rounded-2xl flex items-center justify-center gap-2 group whitespace-nowrap`;

    return (
        <div 
            className="flex-1 w-full flex flex-col items-center overflow-hidden" 
        >
             <div className="flex-1 w-full overflow-hidden px-6 pb-6 pt-4 flex flex-col items-center min-h-0">
                  
                  <div
                    className="flex flex-col items-center mb-8 shrink-0 pt-4 opacity-0 animate-fade-in-long"
                    style={{ animationDelay: `${cascadeDelayMs}ms` }}
                  >
                      <h1 className="text-6xl font-bold text-stone-800 dark:text-stone-100 tracking-tight leading-none mb-1">Oku</h1>
                      <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.4em] ml-1">Sudoku</span>
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
                                          onSelect={handleDifficultyPress}
                                          isPyramidTop={true}
                                          contentScale={contentScale}
                                          layoutStyle={layoutStyle}
                                          celebrateProgress={diff === progressLeader}
                                          cascadeDelayMs={cascadeDelayMs}
                                          isPressed={pressedMainMenuAction === `difficulty-${diff}`}
                                          isLocked={isMainMenuInteractionLocked}
                                      />
                                  </div>
                              );
                          }

                          return (
                              <DifficultyCard 
                                  key={diff}
                                  diff={diff}
                                  index={index}
                                  onSelect={handleDifficultyPress}
                                  contentScale={contentScale}
                                  layoutStyle={layoutStyle}
                                  celebrateProgress={diff === progressLeader}
                                  cascadeDelayMs={cascadeDelayMs}
                                  isPressed={pressedMainMenuAction === `difficulty-${diff}`}
                                  isLocked={isMainMenuInteractionLocked}
                              />
                          );
                      })}
                  </div>

                  {/* Continue Button */}
                  {lastPlayedGame && (
                  <div 
                    className="w-full max-w-md flex justify-center mb-7 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: `${200 + cascadeDelayMs}ms` }}
                  >
                    <div className="oku-tactile-shell rounded-2xl w-[55%]">
                      <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            runMainMenuPressCycle('continue', () => {
                                if (onContinue) onContinue(lastPlayedGame.difficulty, lastPlayedGame.levelId);
                            });
                        }}
                        disabled={isMainMenuInteractionLocked}
                        className={`oku-difficulty-glass oku-main-menu-tactile ${pressedMainMenuAction === 'continue' ? 'oku-main-menu-tactile--pressed' : ''} relative flex items-center justify-center gap-3 w-full py-3 px-5 rounded-2xl text-blue-600 dark:text-blue-400`}
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
                  </div>
                  )}

                  {/* Footer Actions */}
                  <div className="w-full max-w-md flex flex-col gap-3 shrink-0">
                      <div 
                        className="flex justify-center gap-3 opacity-0 animate-slide-in-down w-full" 
                        style={{ animationDelay: `${250 + cascadeDelayMs}ms` }}
                      >
                          <div className="oku-tactile-shell rounded-2xl" style={{ width: '47.5%' }}>
                              <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    runMainMenuPressCycle('market', onOpenStore);
                                }}
                                disabled={isMainMenuInteractionLocked}
                                className={`${COMMON_BTN_STYLE} ${pressedMainMenuAction === 'market' ? 'oku-main-menu-tactile--pressed' : ''} ${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} w-full`}
                              >
                                  <Icons.Store className="w-5 h-5" />
                                  <span className="font-bold tracking-wide">Market</span>
                              </button>
                          </div>
                          
                          <div className="oku-tactile-shell rounded-2xl" style={{ width: '47.5%' }}>
                              <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    runMainMenuPressCycle('oku-shop', onOpenDiamondShop);
                                }}
                                disabled={isMainMenuInteractionLocked}
                                className={`${COMMON_BTN_STYLE} ${pressedMainMenuAction === 'oku-shop' ? 'oku-main-menu-tactile--pressed' : ''} ${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} relative overflow-visible w-full`}
                              >
                                  {hasPendingPepinoGift && (
                                    <div className="absolute -top-1.5 -right-1.5 z-50 animate-pop">
                                        <div className="w-[22px] h-[22px] bg-red-500 rounded-full flex items-center justify-center shadow-md animate-bounce">
                                            <Icons.Gift className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    </div>
                                  )}

                                  <div className="relative z-10 flex items-center gap-2">
                                      <Icons.Star className="w-5 h-5" />
                                      <span className="font-bold tracking-wide">Oku Shop</span>
                                  </div>
                              </button>
                          </div>
                      </div>
                      
                      <div 
                        className="flex justify-center gap-3 opacity-0 animate-slide-in-down w-full"
                        style={{ animationDelay: `${300 + cascadeDelayMs}ms` }}
                      >
                          <div className="oku-tactile-shell rounded-2xl" style={{ width: '47.5%' }}>
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      runMainMenuPressCycle('daily-reward', () => onClaimBonus(e), false);
                                  }}
                                  disabled={!!timeLeft || isMainMenuInteractionLocked}
                                  className={`${COMMON_BTN_STYLE} ${pressedMainMenuAction === 'daily-reward' ? 'oku-main-menu-tactile--pressed' : ''} w-full ${
                                      !!timeLeft
                                      ? 'oku-difficulty-glass text-stone-500 dark:text-stone-400 cursor-not-allowed opacity-60'
                                      : `${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} hover:brightness-105`
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
                          </div>

                          <div className="oku-tactile-shell rounded-2xl" style={{ width: '47.5%' }}>
                              <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    runMainMenuPressCycle('stats', onOpenStats);
                                }}
                                disabled={isMainMenuInteractionLocked}
                                className={`${COMMON_BTN_STYLE} ${pressedMainMenuAction === 'stats' ? 'oku-main-menu-tactile--pressed' : ''} ${BTN_BG_DEFAULT} ${BTN_TEXT_DEFAULT} w-full`}
                              >
                                  <Icons.BarChart className="w-5 h-5" />
                                  <span className="font-bold tracking-wide">Stats</span>
                              </button>
                          </div>
                      </div>
                  </div>

                  <div 
                    className="w-full max-w-md flex items-center justify-center gap-3 mt-6 mb-2 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: `${350 + cascadeDelayMs}ms` }}
                  >
                      <div className="oku-tactile-shell rounded-full">
                          <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  runMainMenuPressCycle('profile', onOpenProfile);
                              }}
                              disabled={isMainMenuInteractionLocked}
                              aria-label={hasProfileAchievement ? 'Profile, achievement ready' : 'Profile'}
                              className={`oku-difficulty-glass oku-main-menu-tactile ${pressedMainMenuAction === 'profile' ? 'oku-main-menu-tactile--pressed' : ''} relative p-1.5 rounded-full text-t-icon overflow-visible`}
                          >
                              <Icons.User className="w-5 h-5" />
                              {hasProfileAchievement && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-stone-900 shadow-sm" aria-hidden="true" />
                              )}
                          </button>
                      </div>

                      <div 
                        className="oku-difficulty-glass flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                      >
                          <AnimatedNumber value={points} easing="easeOut" durationMs={1000} className="text-sm font-semibold text-t-primary tabular-nums leading-none pt-0.5" />
                          <div className="text-blue-500"><Icons.Diamond className="w-3.5 h-3.5 fill-current" /></div>
                      </div>
                      
                      <div className="oku-tactile-shell rounded-full">
                          <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  runMainMenuPressCycle('settings', onOpenSettings);
                              }}
                              disabled={isMainMenuInteractionLocked}
                              aria-label="Settings"
                              className={`oku-difficulty-glass oku-main-menu-tactile ${pressedMainMenuAction === 'settings' ? 'oku-main-menu-tactile--pressed' : ''} p-1.5 rounded-full text-t-icon`}
                          >
                              <Icons.Settings className="w-5 h-5" />
                          </button>
                      </div>
                  </div>

                  <div className="h-safe-bottom w-full shrink-0" />
             </div>
        </div>
    );
};
