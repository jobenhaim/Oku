
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../ui/Icons';
import { sounds } from '../../utils/sound';
import { STATIC_BACKGROUNDS, DYNAMIC_BACKGROUNDS, NUMBER_COLORS, SKILLS, SOUND_PACKS } from '../../utils/constants';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { motion, AnimatePresence } from 'framer-motion';

interface StoreScreenProps {
    points: number;
    onBack: () => void;
    purchasedSkills: string[];
    enabledSkills: string[];
    purchasedBackgrounds: string[];
    purchasedNumberColors: string[];
    purchasedSoundPacks: string[];
    selectedBackgroundId: string | null;
    selectedNumberColorId: string;
    selectedSoundPackId: string;
    onPurchase: (item: any, type: 'bg' | 'num' | 'skill' | 'sound') => void;
    onSelectBackground: (id: string) => void;
    onSelectNumberColor: (id: string) => void;
    onSelectSoundPack: (id: string) => void;
    onToggleSkill: (id: string) => void;
}

type StoreTab = 'all' | 'skills' | 'bg' | 'sound' | 'num';

const TABS = [
    { id: 'all', label: 'All' },
    { id: 'skills', label: 'Skills' },
    { id: 'bg', label: 'Themes' },
    { id: 'sound', label: 'Sounds' },
    { id: 'num', label: 'Numbers' }
];

interface StoreItemWrapperProps {
    children: React.ReactNode;
    delay: number;
}

const StoreItemWrapper: React.FC<StoreItemWrapperProps> = ({ children, delay }) => {
    return (
        <div 
            className="animate-fade-in-fast"
            style={{
                transform: 'translateZ(0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                isolation: 'isolate',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
            }}
        >
            {children}
        </div>
    );
};

export const StoreScreen: React.FC<StoreScreenProps> = ({
    points,
    onBack,
    purchasedSkills,
    enabledSkills,
    purchasedBackgrounds,
    purchasedNumberColors,
    purchasedSoundPacks,
    selectedBackgroundId,
    selectedNumberColorId,
    selectedSoundPackId,
    onPurchase,
    onSelectBackground,
    onSelectNumberColor,
    onSelectSoundPack,
    onToggleSkill
}) => {
    const [activeTab, setActiveTab] = useState<StoreTab>('all');
    const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [direction, setDirection] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleCloseInfo = () => {
        if (!activeInfoId) return;
        setIsClosing(true);
        setTimeout(() => {
            setActiveInfoId(null);
            setIsClosing(false);
        }, 150);
    };
    
    const handleTabChange = (tabId: StoreTab) => {
        if (tabId === activeTab) return;
        sounds.playClick();
        
        // Calculate direction based on tab index
        const currentIndex = TABS.findIndex(t => t.id === activeTab);
        const newIndex = TABS.findIndex(t => t.id === tabId);
        setDirection(newIndex > currentIndex ? 1 : -1);
        
        setActiveTab(tabId);
        
        // Reset scroll when tab changes
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    };
    
    const handleSoundPackClick = (e: React.MouseEvent, pack: typeof SOUND_PACKS[0]) => {
        e.stopPropagation();
        const isPurchased = purchasedSoundPacks.includes(pack.id);
        
        // Preview the sound whenever clicked
        sounds.playPreview(pack.id);

        if (!isPurchased) {
            onPurchase(pack, 'sound');
        } else {
            // Select the pack
            onSelectSoundPack(pack.id);
            
            // Toggle Info Bubble logic
            if (activeInfoId === pack.id) {
                handleCloseInfo();
            } else {
                setActiveInfoId(pack.id);
                setIsClosing(false);
            }
        }
    };

    const handleSkillInteraction = (e: React.MouseEvent, skill: typeof SKILLS[0]) => {
        const isPurchased = purchasedSkills.includes(skill.id);
        if (!isPurchased) {
            onPurchase(skill, 'skill');
        } else {
            sounds.playClick();
            onToggleSkill(skill.id);
        }
    };

    // Shared Price Footer component for grid items
    const ItemFooter = ({ isPurchased, isSelected, cost }: any) => {
        // If not purchased, always show price
        if (!isPurchased) {
            return (
                <div className="h-6 bg-white/45 dark:bg-black/25 border-t border-white/70 dark:border-white/10 backdrop-blur-xl flex items-center justify-center gap-0.5 shrink-0 relative z-10">
                    <span className="text-[13px] font-bold text-stone-900 dark:text-white leading-none pt-0.5">{cost}</span>
                    <Icons.Diamond className="w-3 h-3 text-blue-500 fill-current" />
                </div>
            );
        }
        // Return null when purchased to allow content to center naturally
        return null;
    };

    const renderSkills = () => (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-t-primary mb-3 ml-1">Skills</h2>
            <div className="flex flex-col gap-4">
                {SKILLS.map((skill, idx) => {
                    const isPurchased = purchasedSkills.includes(skill.id);
                    const isEnabled = enabledSkills.includes(skill.id);
                    const SkillIcon = skill.icon;
                    const delay = idx * 5;
                    
                    return (
                        <StoreItemWrapper delay={delay} key={skill.id}>
                            <button 
                                onClick={(e) => handleSkillInteraction(e, skill)}
                                className="oku-main-glass w-full h-[74px] px-3 py-2 rounded-[1.25rem] flex items-center gap-3 text-left active:scale-[0.98] transition-all relative overflow-hidden group"
                            >
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-white/75 dark:bg-white/10 border border-white/90 dark:border-white/15 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,1),0_3px_10px_rgba(68,64,60,0.07)] transition-transform group-active:scale-95">
                                    <SkillIcon className={`w-6 h-6 ${skill.class}`} />
                                </div>

                                <div className="flex-1 min-w-0 py-0.5">
                                    <h3 className="text-[15px] font-bold text-t-primary leading-tight mb-0.5">{skill.name}</h3>
                                    <p className="text-[10px] font-semibold text-stone-600 dark:text-stone-300 leading-[1.15] line-clamp-2">{skill.description}</p>
                                </div>

                                <div className="shrink-0 w-[68px] flex justify-end">
                                    {isPurchased ? (
                                            <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-out ${isEnabled ? 'bg-stone-600 dark:bg-stone-400' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                                <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ease-out ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                    ) : (
                                            <div className="flex items-center justify-center bg-white/72 dark:bg-white/10 border border-white/95 dark:border-white/15 backdrop-blur-xl h-9 px-3.5 rounded-full min-w-[72px] gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_3px_10px_rgba(68,64,60,0.08)]">
                                                <span className="text-[13px] font-bold text-t-primary leading-none pt-0.5">{skill.cost}</span>
                                                <Icons.Diamond className="w-3.5 h-3.5 text-blue-500 fill-current" />
                                            </div>
                                    )}
                                </div>
                            </button>
                        </StoreItemWrapper>
                    );
                })}
            </div>
        </div>
    );

    const renderBackgrounds = () => (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-t-primary mb-3 ml-1">Backgrounds</h2>
            <div className="mb-6">
                <h3 className="text-xs font-bold text-stone-600 dark:text-stone-300 uppercase tracking-widest mb-3 ml-1">Static</h3>
                <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{STATIC_BACKGROUNDS.map((bg, idx) => {
                    const isPurchased = purchasedBackgrounds.includes(bg.id);
                    const isSelected = selectedBackgroundId === bg.id;
                    const delay = activeTab === 'all' ? (3 + idx) * 5 : idx * 5;
                    return (
                        <StoreItemWrapper delay={delay} key={bg.id}>
                            <div className="flex flex-col items-center gap-1.5">
                                <button 
                                    onClick={() => isPurchased ? onSelectBackground(bg.id) : onPurchase(bg, 'bg')} 
                                    className={`oku-main-glass w-full aspect-square rounded-2xl flex flex-col items-stretch relative overflow-hidden transition-all active:scale-95 ${isSelected ? 'oku-store-selected scale-105 z-10' : ''}`}
                                >
                                    <div className={`flex-1 relative overflow-hidden ${bg.class}`}>
                                            <div className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-500" style={{ opacity: bg.id === 'bg-default' ? 'calc(var(--overlay-opacity) * 0.6)' : 'calc(var(--overlay-opacity) * 1.6)' }} />
                                    </div>
                                    <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={bg.cost} />
                                </button>
                                <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>{bg.name}</span>
                            </div>
                        </StoreItemWrapper>
                    );
                })}</div>
            </div>
            <div className="mb-2">
                <h3 className="text-xs font-bold text-stone-600 dark:text-stone-300 uppercase tracking-widest mb-3 ml-1">Atmosphere</h3>
                <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{DYNAMIC_BACKGROUNDS.map((bg, idx) => {
                    const isPurchased = purchasedBackgrounds.includes(bg.id);
                    const isSelected = selectedBackgroundId === bg.id;
                    const delay = activeTab === 'all' ? (3 + STATIC_BACKGROUNDS.length + idx) * 5 : (STATIC_BACKGROUNDS.length + idx) * 5;
                    return (
                        <StoreItemWrapper delay={delay} key={bg.id}>
                            <div className="flex flex-col items-center gap-1.5">
                                <button 
                                    onClick={() => isPurchased ? onSelectBackground(bg.id) : onPurchase(bg, 'bg')} 
                                    className={`oku-main-glass w-full aspect-square rounded-2xl flex flex-col items-stretch relative overflow-hidden transition-all active:scale-95 ${isSelected ? 'oku-store-selected scale-105 z-10' : ''}`}
                                >
                                    <div 
                                    className={`flex-1 relative overflow-hidden ${bg.class}`} 
                                    style={{ backgroundSize: '300% 300%' }}
                                    >
                                            <div className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-500" style={{ opacity: 'calc(var(--overlay-opacity) * 1.6)' }} />
                                    </div>
                                    <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={bg.cost} />
                                </button>
                                <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>{bg.name}</span>
                            </div>
                        </StoreItemWrapper>
                    );
                })}</div>
            </div>
        </div>
    );

    const renderSoundPacks = () => (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-t-primary mb-3 ml-1">Sound Packs</h2>
            <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{SOUND_PACKS.map((pack, idx) => {
                const isPurchased = purchasedSoundPacks.includes(pack.id);
                const isSelected = selectedSoundPackId === pack.id;
                const isInfoActive = activeInfoId === pack.id;
                const PackIcon = pack.icon;
                
                const delay = activeTab === 'all' 
                    ? (3 + STATIC_BACKGROUNDS.length + DYNAMIC_BACKGROUNDS.length + idx) * 5 
                    : idx * 5;
                
                return (
                    <StoreItemWrapper delay={delay} key={pack.id}>
                        <div className={`flex flex-col items-center gap-1.5 ${isSelected ? 'relative z-20' : 'relative z-0'}`}>
                            {isInfoActive && (
                                <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full w-32 pointer-events-none z-50">
                                    <div className={`origin-bottom ${isClosing ? 'animate-tooltip-exit' : 'animate-tooltip-enter'}`}>
                                        <div className="bg-stone-800 text-white dark:bg-white dark:text-stone-900 text-[10px] p-2 rounded-lg shadow-xl text-center font-medium leading-tight relative border border-stone-600/30">
                                            {pack.description}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-stone-800 dark:border-t-white"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={(e) => handleSoundPackClick(e, pack)} 
                                className={`oku-main-glass w-full aspect-square rounded-2xl flex flex-col items-stretch relative overflow-hidden transition-all ${isSelected ? 'oku-store-selected scale-105' : 'active:scale-95'}`}
                            >
                                <div className={`flex-1 flex items-center justify-center relative z-10 overflow-hidden`}>
                                    <PackIcon className={`w-8 h-8 ${pack.iconColor} relative z-20`} />
                                </div>
                                <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={pack.cost} />
                            </button>
                            
                            <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>{pack.name}</span>
                        </div>
                    </StoreItemWrapper>
                );
            })}</div>
        </div>
    );

    const renderNumbers = () => (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-t-primary mb-3 ml-1">Number Styles</h2>
            <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{NUMBER_COLORS.map((num, idx) => {
                const isPurchased = purchasedNumberColors.includes(num.id);
                const isSelected = selectedNumberColorId === num.id;
                
                const delay = activeTab === 'all'
                    ? (3 + STATIC_BACKGROUNDS.length + DYNAMIC_BACKGROUNDS.length + SOUND_PACKS.length + idx) * 5
                    : idx * 5;
                
                return (
                    <StoreItemWrapper delay={delay} key={num.id}>
                        <div className="flex flex-col items-center gap-1.5">
                            <button 
                                onClick={() => isPurchased ? onSelectNumberColor(num.id) : onPurchase(num, 'num')} 
                                className={`oku-main-glass w-full aspect-square rounded-2xl flex flex-col items-stretch relative overflow-hidden transition-all ${isSelected ? 'oku-store-selected scale-105 z-10' : 'active:scale-95'}`}
                            >
                                <div className={`flex-1 flex items-center justify-center w-full`}>
                                    <span className={`text-3xl font-bold ${num.uiClass}`}>5</span>
                                </div>
                                <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={num.cost} />
                            </button>
                            <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>{num.name}</span>
                        </div>
                    </StoreItemWrapper>
                );
            })}</div>
        </div>
    );

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.95,
            pointerEvents: 'none' as any,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            pointerEvents: 'auto' as any,
        },
        exit: (dir: number) => ({
            x: dir > 0 ? '-100%' : '100%',
            opacity: 0,
            scale: 0.95,
            pointerEvents: 'none' as any,
        }),
    };

    return (
        <div 
            className="flex-1 w-full flex flex-col items-center overflow-hidden animate-fade-in-fast"
            onClick={handleCloseInfo}
        >
             {/* Header */}
             <div className="w-full max-w-md flex flex-col px-6 pt-4 pb-2 relative shrink-0 z-20 gap-4">
                <div className="flex items-center justify-between w-full mb-2">
                    <button onClick={onBack} className="oku-main-glass p-2 rounded-full -ml-2 text-t-icon relative z-30 active:scale-95 transition">
                        <Icons.Back className="w-6 h-6 text-t-icon" />
                    </button>
                    
                    <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                        <h1 className="text-xl font-bold text-t-primary leading-none">Market</h1>
                        <p className="text-t-secondary text-[10px] font-bold tracking-widest uppercase mt-1">Personalize</p>
                    </div>

                    <div className="oku-main-glass flex items-center gap-1 px-3 py-2 rounded-full relative z-30">
                          <AnimatedNumber value={points} className="text-sm font-bold text-t-primary tabular-nums" />
                          <div className="text-blue-500"><Icons.Diamond className="w-3 h-3 fill-current" /></div>
                    </div>
                </div>

                {/* Cleaner Category Tabs (Segmented Control Style) */}
                <div className="oku-main-glass w-full p-1 rounded-xl flex items-center mt-2 relative">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as StoreTab)}
                                className={`
                                    flex-1 py-2 text-[11px] font-bold transition-all relative z-10
                                    ${isActive 
                                        ? 'text-stone-900 dark:text-white' 
                                        : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                                    }
                                `}
                            >
                                <span className="relative z-20">{tab.label}</span>
                                {isActive && (
                                    <motion.div 
                                        layoutId="activeTabPill"
                                        className="absolute inset-0 bg-white/70 dark:bg-white/10 backdrop-blur-xl rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(45,55,72,0.12)] ring-1 ring-white/80 dark:ring-white/15 z-10"
                                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
             </div>

             <div 
                ref={scrollContainerRef}
                className="flex-1 w-full overflow-y-auto overflow-x-hidden px-6 pb-6 hide-scrollbar flex flex-col items-center relative"
             >
                  <div className="w-full max-w-md pt-6">
                      <AnimatePresence initial={false} custom={direction} mode="popLayout">
                          {activeTab === 'all' && (
                              <motion.div
                                  key="all"
                                  custom={direction}
                                  variants={variants}
                                  initial="enter"
                                  animate="center"
                                  exit="exit"
                                  transition={{
                                      x: { type: "spring", stiffness: 200, damping: 25 },
                                      opacity: { duration: 0.2 },
                                      scale: { duration: 0.2 }
                                  }}
                                  className="w-full"
                              >
                                  {renderSkills()}
                                  {renderBackgrounds()}
                                  {renderSoundPacks()}
                                  {renderNumbers()}
                              </motion.div>
                          )}
                          {activeTab === 'skills' && (
                              <motion.div
                                  key="skills"
                                  custom={direction}
                                  variants={variants}
                                  initial="enter"
                                  animate="center"
                                  exit="exit"
                                  transition={{
                                      x: { type: "spring", stiffness: 200, damping: 25 },
                                      opacity: { duration: 0.2 },
                                      scale: { duration: 0.2 }
                                  }}
                                  className="w-full"
                              >
                                  {renderSkills()}
                              </motion.div>
                          )}
                          {activeTab === 'bg' && (
                              <motion.div
                                  key="bg"
                                  custom={direction}
                                  variants={variants}
                                  initial="enter"
                                  animate="center"
                                  exit="exit"
                                  transition={{
                                      x: { type: "spring", stiffness: 200, damping: 25 },
                                      opacity: { duration: 0.2 },
                                      scale: { duration: 0.2 }
                                  }}
                                  className="w-full"
                              >
                                  {renderBackgrounds()}
                              </motion.div>
                          )}
                          {activeTab === 'sound' && (
                              <motion.div
                                  key="sound"
                                  custom={direction}
                                  variants={variants}
                                  initial="enter"
                                  animate="center"
                                  exit="exit"
                                  transition={{
                                      x: { type: "spring", stiffness: 200, damping: 25 },
                                      opacity: { duration: 0.2 },
                                      scale: { duration: 0.2 }
                                  }}
                                  className="w-full"
                              >
                                  {renderSoundPacks()}
                              </motion.div>
                          )}
                          {activeTab === 'num' && (
                              <motion.div
                                  key="num"
                                  custom={direction}
                                  variants={variants}
                                  initial="enter"
                                  animate="center"
                                  exit="exit"
                                  transition={{
                                      x: { type: "spring", stiffness: 200, damping: 25 },
                                      opacity: { duration: 0.2 },
                                      scale: { duration: 0.2 }
                                  }}
                                  className="w-full"
                              >
                                  {renderNumbers()}
                              </motion.div>
                          )}
                      </AnimatePresence>
                  </div>
                  <div className="h-safe-bottom w-full shrink-0" />
             </div>
        </div>
    );
};
