
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
                <div className="h-6 bg-white dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700 flex items-center justify-center gap-0.5 shrink-0 relative z-10">
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
                {SKILLS.map(skill => {
                    const isPurchased = purchasedSkills.includes(skill.id);
                    const isEnabled = enabledSkills.includes(skill.id);
                    const SkillIcon = skill.icon;
                    
                    return (
                        <button 
                            key={skill.id}
                            onClick={(e) => handleSkillInteraction(e, skill)}
                            className={`w-full h-[74px] px-3 py-2 rounded-[1.25rem] shadow-sm flex items-center gap-3 text-left active:scale-[0.98] transition-all bg-t-surface relative overflow-hidden group`}
                        >
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${skill.bgClass} transition-transform group-active:scale-95`}>
                                <SkillIcon className={`w-6 h-6 ${skill.class}`} />
                            </div>

                            <div className="flex-1 min-w-0 py-0.5">
                                <h3 className="text-[15px] font-bold text-t-primary leading-tight mb-0.5">{skill.name}</h3>
                                <p className="text-[10px] font-medium text-t-secondary leading-[1.15] line-clamp-2">{skill.description}</p>
                            </div>

                            <div className="shrink-0 w-[68px] flex justify-end">
                                {isPurchased ? (
                                        <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-out ${isEnabled ? 'bg-stone-600 dark:bg-stone-400' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ease-out ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </div>
                                ) : (
                                        <div className="flex items-center justify-center bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 h-8 px-2.5 rounded-full min-w-[60px] gap-1">
                                            <span className="text-xs font-bold text-t-primary leading-none pt-0.5">{skill.cost}</span>
                                            <Icons.Diamond className="w-3 h-3 text-blue-500 fill-current" />
                                        </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const renderBackgrounds = () => (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-t-primary mb-3 ml-1">Backgrounds</h2>
            <div className="mb-6">
                <h3 className="text-xs font-bold text-t-secondary uppercase tracking-widest mb-3 ml-1">Static</h3>
                <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{STATIC_BACKGROUNDS.map(bg => {
                    const isPurchased = purchasedBackgrounds.includes(bg.id);
                    const isSelected = selectedBackgroundId === bg.id;
                    return (
                        <div key={bg.id} className="flex flex-col items-center gap-1.5">
                            <button 
                                onClick={() => isPurchased ? onSelectBackground(bg.id) : onPurchase(bg, 'bg')} 
                                className={`w-full aspect-square rounded-2xl shadow-sm flex flex-col items-stretch relative overflow-hidden transition-all active:scale-95 bg-gradient-to-t from-stone-200 to-white dark:bg-none dark:bg-stone-800 ${isSelected ? 'border border-stone-600 dark:border-stone-400 scale-105 z-10' : ''}`}
                            >
                                <div className={`flex-1 relative overflow-hidden ${bg.class}`}>
                                        <div className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-500" style={{ opacity: bg.id === 'bg-default' ? 'calc(var(--overlay-opacity) * 0.6)' : 'calc(var(--overlay-opacity) * 1.6)' }} />
                                </div>
                                <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={bg.cost} />
                            </button>
                            <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-800 dark:text-stone-200' : 'text-t-secondary'}`}>{bg.name}</span>
                        </div>
                    );
                })}</div>
            </div>
            <div className="mb-2">
                <h3 className="text-xs font-bold text-t-secondary uppercase tracking-widest mb-3 ml-1">Atmosphere</h3>
                <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{DYNAMIC_BACKGROUNDS.map(bg => {
                    const isPurchased = purchasedBackgrounds.includes(bg.id);
                    const isSelected = selectedBackgroundId === bg.id;
                    return (
                        <div key={bg.id} className="flex flex-col items-center gap-1.5">
                            <button 
                                onClick={() => isPurchased ? onSelectBackground(bg.id) : onPurchase(bg, 'bg')} 
                                className={`w-full aspect-square rounded-2xl shadow-sm flex flex-col items-stretch relative overflow-hidden transition-all active:scale-95 bg-gradient-to-t from-stone-200 to-white dark:bg-none dark:bg-stone-800 ${isSelected ? 'border border-stone-600 dark:border-stone-400 scale-105 z-10' : ''}`}
                            >
                                <div 
                                className={`flex-1 relative overflow-hidden ${bg.class}`} 
                                style={{ backgroundSize: '300% 300%' }}
                                >
                                        <div className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-500" style={{ opacity: 'calc(var(--overlay-opacity) * 1.6)' }} />
                                </div>
                                <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={bg.cost} />
                            </button>
                            <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-800 dark:text-stone-200' : 'text-t-secondary'}`}>{bg.name}</span>
                        </div>
                    );
                })}</div>
            </div>
        </div>
    );

    const renderSoundPacks = () => (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-t-primary mb-3 ml-1">Sound Packs</h2>
            <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{SOUND_PACKS.map(pack => {
                const isPurchased = purchasedSoundPacks.includes(pack.id);
                const isSelected = selectedSoundPackId === pack.id;
                const isInfoActive = activeInfoId === pack.id;
                const PackIcon = pack.icon;
                
                return (
                    <div key={pack.id} className={`flex flex-col items-center gap-1.5 ${isSelected ? 'relative z-20' : 'relative z-0'}`}>
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
                            className={`w-full aspect-square rounded-2xl shadow-sm flex flex-col items-stretch relative overflow-hidden transition-all bg-gradient-to-t from-stone-100 to-white dark:bg-none dark:bg-stone-800 ${isSelected ? 'border border-stone-600 dark:border-stone-400 scale-105 shadow-md' : 'active:scale-95'}`}
                        >
                            <div className={`flex-1 flex items-center justify-center relative z-10 overflow-hidden`}>
                                <PackIcon className={`w-8 h-8 ${pack.iconColor} relative z-20`} />
                            </div>
                            <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={pack.cost} />
                        </button>
                        
                        <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-800 dark:text-stone-200' : 'text-t-secondary'}`}>{pack.name}</span>
                    </div>
                );
            })}</div>
        </div>
    );

    const renderNumbers = () => (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-t-primary mb-3 ml-1">Number Styles</h2>
            <div className="grid grid-cols-5 gap-x-2 gap-y-6 items-start">{NUMBER_COLORS.map(num => {
                const isPurchased = purchasedNumberColors.includes(num.id);
                const isSelected = selectedNumberColorId === num.id;
                return (
                    <div key={num.id} className="flex flex-col items-center gap-1.5">
                        <button 
                            onClick={() => isPurchased ? onSelectNumberColor(num.id) : onPurchase(num, 'num')} 
                            className={`w-full aspect-square rounded-2xl shadow-sm flex flex-col items-stretch relative overflow-hidden transition-all bg-gradient-to-t from-stone-100 to-white dark:bg-none dark:bg-stone-800 ${isSelected ? 'border border-stone-600 dark:border-stone-400 scale-105 z-10' : 'active:scale-95'}`}
                        >
                            <div className={`flex-1 flex items-center justify-center w-full`}>
                                <span className={`text-3xl font-bold ${num.uiClass}`}>5</span>
                            </div>
                            <ItemFooter isPurchased={isPurchased} isSelected={isSelected} cost={num.cost} />
                        </button>
                        <span className={`text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-stone-800 dark:text-stone-200' : 'text-t-secondary'}`}>{num.name}</span>
                    </div>
                );
            })}</div>
        </div>
    );

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.95,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (dir: number) => ({
            x: dir > 0 ? '-100%' : '100%',
            opacity: 0,
            scale: 0.95,
        }),
    };

    return (
        <div 
            className="flex-1 w-full flex flex-col items-center overflow-hidden"
            onClick={handleCloseInfo}
        >
             {/* Header */}
             <div className="w-full max-w-md flex flex-col px-6 pt-4 pb-2 relative shrink-0 z-20 gap-4">
                <div className="flex items-center justify-between w-full mb-2">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-200 transition -ml-2 text-t-icon relative z-30">
                        <Icons.Back className="w-6 h-6 text-t-icon" />
                    </button>
                    
                    <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                        <h1 className="text-xl font-bold text-t-primary leading-none">Market</h1>
                        <p className="text-t-secondary text-[10px] font-bold tracking-widest uppercase mt-1">Personalize</p>
                    </div>

                    <div className="flex items-center gap-1 bg-t-surface px-3 py-2 rounded-full shadow-sm relative z-30">
                          <AnimatedNumber value={points} className="text-sm font-bold text-t-primary tabular-nums" />
                          <div className="text-blue-500"><Icons.Diamond className="w-3 h-3 fill-current" /></div>
                    </div>
                </div>

                {/* Category Tabs (Table Style) */}
                <div className="w-full flex items-center border-b border-stone-200 dark:border-stone-700 divide-x divide-stone-200 dark:divide-stone-700 mt-2">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as StoreTab)}
                                className={`
                                    flex-1 py-3 text-xs font-bold transition-all relative
                                    ${isActive 
                                        ? 'text-stone-800 dark:text-stone-100 bg-stone-100/50 dark:bg-white/5' 
                                        : 'text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-white/5'
                                    }
                                `}
                            >
                                {tab.label}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-800 dark:bg-stone-100" />
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
                          <motion.div
                              key={activeTab}
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
                              {activeTab === 'all' && (
                                  <>
                                      {renderSkills()}
                                      {renderBackgrounds()}
                                      {renderSoundPacks()}
                                      {renderNumbers()}
                                  </>
                              )}
                              {activeTab === 'skills' && renderSkills()}
                              {activeTab === 'bg' && renderBackgrounds()}
                              {activeTab === 'sound' && renderSoundPacks()}
                              {activeTab === 'num' && renderNumbers()}
                          </motion.div>
                      </AnimatePresence>
                  </div>
                  <div className="h-safe-bottom w-full shrink-0" />
             </div>
        </div>
    );
};
