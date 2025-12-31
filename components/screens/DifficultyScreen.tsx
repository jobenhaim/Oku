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
    hiddenDifficulties?: Difficulty[]; // New prop
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
    "Sudoku awaits"
];

// Internal Hook for Counting Animation (Progress Bars)
const useAnimatedCounter = (target: number, duration: number = 500) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        // Reset start value to 0 on target change to trigger animation
        setCount(0);

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            
            // Cubic Ease Out
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
    isPyramidTop?: boolean; // Prop to handle pyramid layout centering
    contentScale?: 'normal' | 'medium' | 'large';
    layoutStyle?: React.CSSProperties;
}> = ({ diff, index, onSelect, activeInfo, onInfoToggle, isClosing, description, isPyramidTop, contentScale = 'normal', layoutStyle }) => {
    
    // Data Loading
    const completed = Storage.getCompletedCount(diff, 300);
    const isPack2Unlocked = Storage.isPack2Unlocked(diff);
    const isPack3Unlocked = Storage.isPack3Unlocked(diff);
    
    let maxLevels = 100;
    if (isPack2Unlocked) maxLevels = 200;
    if (isPack3Unlocked) maxLevels = 300;

    const diffPoints = getDifficultyPoints(diff);
    
    // Animation Logic
    const delay = 100 + (index * 50); // Linear delay based on index is smoother
    
    const isInfoActive = activeInfo === diff;
    // If pyramid top, tooltip should default to right or calculate based on screen
    const isLeftColumn = isPyramidTop ? true : index % 2 === 0;

    // State to track if entry animation is done
    const [animating, setAnimating] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => {
            setAnimating(false);
        }, delay + 600); // delay + animation duration (400ms) + buffer
        return () => clearTimeout(t);
    }, [delay]);

    // Z-Index Logic
    const baseZIndex = 30 - index; // Simple z-index stack
    const finalZIndex = isInfoActive ? 100 : baseZIndex;

    // Use animated counter hook
    const animatedCompleted = useAnimatedCounter(completed, 500);
    
    const progressPercent = Math.min((animatedCompleted / maxLevels) * 100, 100);

    // Default Style fallback (Grid Layout)
    const defaultStyle: React.CSSProperties = {
        width: '47.5%',
        aspectRatio: '1.55/1', 
    };

    const finalStyle = { ...defaultStyle, ...layoutStyle, zIndex: finalZIndex, animationDelay: `${delay}ms` };

    // Dynamic Scale classes
    const titleClass = contentScale === 'large' ? 'text-3xl mb-3' : (contentScale === 'medium' ? 'text-2xl mb-2' : 'text-lg mb-1');
    const iconSizeClass = contentScale === 'large' ? 'w-6 h-6' : (contentScale === 'medium' ? 'w-5 h-5' : 'w-3.5 h-3.5');
    const infoIconSizeClass = contentScale === 'large' ? 'w-8 h-8 -ml-1.5' : (contentScale === 'medium' ? 'w-7 h-7 -ml-1' : 'w-6 h-6 -ml-0.5');
    const infoIconInnerSize = contentScale === 'large' ? 'w-6 h-6' : (contentScale === 'medium' ? 'w-5 h-5' : 'w-4 h-4');
    const pointsTextClass = contentScale === 'large' ? 'text-xl' : (contentScale === 'medium' ? 'text-lg' : 'text-sm');
    const progressTextClass = contentScale === 'large' ? 'text-xl' : (contentScale === 'medium' ? 'text-lg' : 'text-sm');
    const progressBarHeight = contentScale === 'large' ? 'h-3' : (contentScale === 'medium' ? 'h-2.5' : 'h-1.5');
    const paddingClass = contentScale === 'large' ? 'p-6' : (contentScale === 'medium' ? 'p-5' : 'p-3.5');

    return (
        <button 
            onClick={() => onSelect(diff)} 
            style={finalStyle}
            className={`bg-t-surface ${paddingClass} rounded-2xl shadow-sm flex flex-col justify-between transition-transform text-left relative group overflow-visible ${animating ? 'opacity-0 animate-slide-in-down' : 'opacity-100'}`}
        >
            {/* Header: Title & Points */}
            <div className="w-full flex justify-between items-start mb-1">
                <span className={`font-semibold text-stone-700 dark:text-stone-300 leading-none tracking-tight truncate mr-1 mt-0.5 ${titleClass}`}>{diff}</span>
                <div className="flex items-center gap-1 shrink-0">
                    <span className={`${pointsTextClass} font-bold text-t-primary opacity-80 leading-none`}>+{diffPoints}</span>
                    <Icons.Diamond className={`${iconSizeClass} text-blue-500 fill-current`} />
                </div>
            </div>
            
            {/* Middle: Info & Progress Numbers */}
            <div className="w-full flex justify-between items-end mb-2 mt-auto">
                {/* Info Icon */}
                <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
                    <div 
                        role="button"
                        onClick={() => onInfoToggle(diff)}
                        className={`flex items-center justify-center cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors ${infoIconSizeClass}`}
                    >
                        <Icons.Info className={`${infoIconInnerSize} transition-colors ${isInfoActive ? 'text-stone-800 dark:text-stone-200' : 'text-stone-400 dark:text-stone-500'}`} />
                    </div>

                    {/* Tooltip */}
                    {isInfoActive && (
                        <div 
                            className={`absolute top-full mt-2 w-44 z-[60] cursor-default ${
                                isLeftColumn 
                                    ? '-left-2 origin-top-left' 
                                    : '-right-2 origin-top-right'
                            } ${isClosing ? 'animate-tooltip-exit' : 'animate-tooltip-enter'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-white text-stone-900 text-xs font-medium p-3 rounded-xl relative text-left leading-relaxed border border-stone-400 dark:border-stone-500 shadow-lg">
                                {description}
                                <div className={`absolute -top-[6px] w-3 h-3 bg-white border-t border-l border-stone-400 dark:border-stone-500 transform rotate-45 ${
                                    isLeftColumn ? 'left-[14px]' : 'right-[14px]'
                                }`}></div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Progress Numbers (Animated) */}
                <span className={`${progressTextClass} text-stone-700 dark:text-stone-300 font-bold tracking-wide font-sans leading-none`}>
                    {animatedCompleted} / {maxLevels}
                </span>
            </div>
            
            {/* Bottom: Progress Bar (Animated) */}
            <div className={`w-full bg-t-surface-sec rounded-full overflow-hidden ${progressBarHeight}`}>
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
    hiddenDifficulties = [] 
}) => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [activeInfo, setActiveInfo] = useState<Difficulty | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [subtitle] = useState(() => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]);
    
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

    // Filter Difficulties
    const visibleDifficulties = Object.values(Difficulty).filter(d => !hiddenDifficulties.includes(d));
    const isOddCount = visibleDifficulties.length % 2 !== 0;
    const isVerticalStack = visibleDifficulties.length === 2;
    const isOneVisible = visibleDifficulties.length === 1;

    return (
        <div 
            className="flex-1 w-full flex flex-col items-center overflow-hidden" 
            onClick={() => activeInfo && handleClose()}
        >
             {/* Content Container - removed overflow-y-auto, added overflow-hidden for non-scrollable */}
             <div className="flex-1 w-full overflow-hidden px-6 pb-6 pt-4 flex flex-col items-center min-h-0">
                  
                  {/* Hero Section - Clean Text Typography */}
                  <div className="flex flex-col items-center mb-8 shrink-0 pt-4">
                      <h1 className="text-6xl font-bold text-stone-800 dark:text-stone-100 tracking-tight leading-none mb-1">Oku</h1>
                      <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.4em] ml-1">Sudoku</span>
                  </div>

                  {/* Difficulty Header */}
                  <div 
                    className="w-full max-w-md flex justify-center mb-2 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: '50ms' }}
                  >
                      <p className="text-xs font-semibold text-t-secondary uppercase tracking-[0.2em]">{subtitle}</p>
                  </div>

                  {/* Difficulty Grid */}
                  <div className="w-full max-w-md flex flex-wrap justify-center gap-3 mb-8 shrink-0 min-h-[330px] content-center">
                      {visibleDifficulties.map((diff, index) => {
                          const descriptions = DIFFICULTY_DESCRIPTIONS[diff];
                          const currentIndex = infoIndices[diff] || 0;
                          const description = descriptions[currentIndex % descriptions.length];
                          
                          // Pyramid Layout Logic:
                          // If odd total, the first item (index 0) becomes top of pyramid.
                          // Exclude single item case from pyramid top logic to avoid wrapper redundancy if not needed
                          const isPyramidTop = isOddCount && index === 0 && !isOneVisible;
                          
                          // Determine dynamic sizing props
                          let contentScale: 'normal' | 'medium' | 'large' = 'normal';
                          let layoutStyle: React.CSSProperties = {};

                          if (isOneVisible) {
                              layoutStyle = { width: '62%', aspectRatio: '1.55/1' };
                              contentScale = 'normal';
                          } else if (isVerticalStack) {
                              layoutStyle = { width: '55%', aspectRatio: '1.55/1' };
                              contentScale = 'normal';
                          } else if (isPyramidTop) {
                              // Pyramid top (odd count) - Standard size but centered wrapper
                              layoutStyle = { width: '47.5%', aspectRatio: '1.55/1' };
                          }

                          if (isPyramidTop || isVerticalStack) {
                              // Wrap the top item (or all items if vertical stack) in a full-width container to force a new row and centering
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

                  {/* Footer Actions */}
                  <div className="w-full max-w-md flex flex-col gap-3 shrink-0">
                      {/* Row 1: Store & Get More */}
                      <div 
                        className="flex justify-center gap-3 opacity-0 animate-slide-in-down w-full" 
                        style={{ animationDelay: '250ms' }}
                      >
                          <button 
                            onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenStore(); }} 
                            style={{ width: '47.5%', background: 'linear-gradient(135deg, #E8BA6E 0%, #B78B4D 100%)' }}
                            className="p-4 text-[#3f2e18] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2 active:scale-95 transition relative"
                          >
                              <Icons.Store className="w-5 h-5" /> <span className="font-semibold tracking-wide">Store</span>
                          </button>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenDiamondShop(); }} 
                            style={{ width: '47.5%', background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #cbd5e1 100%)' }}
                            className="p-4 text-slate-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
                          >
                              <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-blue-100/30 to-transparent pointer-events-none" />
                              <div className="absolute inset-0 -translate-x-full animate-[shimmer_4s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-[-20deg] pointer-events-none" />
                              <span className="font-bold tracking-wide relative z-10 text-slate-700">Diamond Shop</span> 
                              <Icons.Diamond className="w-4 h-4 text-blue-500 fill-current relative z-10 drop-shadow-sm" />
                          </button>
                      </div>
                      
                      {/* Row 2: Stats & Bonus */}
                      <div 
                        className="flex justify-center gap-3 opacity-0 animate-slide-in-down w-full"
                        style={{ animationDelay: '300ms' }}
                      >
                          <button 
                            onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenStats(); }} 
                            style={{ width: '47.5%', background: 'linear-gradient(135deg, #B8D3F5 0%, #79A6E3 100%)' }}
                            className="p-4 text-[#102a43] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2 active:scale-95 transition relative"
                          >
                              <Icons.BarChart className="w-5 h-5" /> <span className="font-semibold tracking-wide">Stats</span>
                          </button>

                          <button 
                              onClick={onClaimBonus}
                              disabled={!!timeLeft}
                              style={{ width: '47.5%', ...(!timeLeft ? { background: 'linear-gradient(135deg, #B8DBBE 0%, #8CB794 100%)' } : {}) }}
                              className={`p-4 rounded-2xl flex items-center justify-center gap-2 transition overflow-hidden relative ${
                                  !!timeLeft 
                                  ? 'bg-t-surface-sec border-t-border text-t-secondary cursor-not-allowed shadow-sm' 
                                  : 'text-[#163c20] shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-95'
                              }`}
                          >
                              {!!timeLeft ? (
                                   <div className="flex items-center gap-2 h-6">
                                      <Icons.Clock className="w-4 h-4" />
                                      <span className="font-semibold text-xs tracking-wide">{timeLeft}</span>
                                   </div>
                              ) : (
                                   <div className="flex items-center gap-1.5 h-6">
                                      <Icons.Gift className="w-5 h-5 animate-bounce" />
                                      <span className="font-semibold tracking-wide">Claim +10</span>
                                      <Icons.Diamond className="w-4 h-4 text-blue-500 fill-current" />
                                   </div>
                              )}
                          </button>
                      </div>
                  </div>

                  {/* Utility Row (Points + Settings) */}
                  <div 
                    className="w-full max-w-md flex items-center justify-center gap-3 mt-6 mb-2 opacity-0 animate-slide-in-down shrink-0" 
                    style={{ animationDelay: '350ms' }}
                  >
                      <div 
                        className="flex items-center gap-1.5 bg-t-surface px-3 py-1.5 rounded-full shadow-sm"
                      >
                          <AnimatedNumber value={points} className="text-sm font-semibold text-t-primary tabular-nums leading-none pt-0.5" />
                          <div className="text-blue-500"><Icons.Diamond className="w-3.5 h-3.5 fill-current" /></div>
                      </div>
                      
                      <button onClick={(e) => { e.stopPropagation(); sounds.playClick(); onOpenSettings(); }} className="p-1.5 bg-t-surface rounded-full shadow-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition active:scale-95 text-t-icon">
                          <Icons.Settings className="w-5 h-5" />
                      </button>
                  </div>

                  <div className="h-safe-bottom w-full shrink-0" />
             </div>
        </div>
    );
};