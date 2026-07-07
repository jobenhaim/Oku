import React, { useState } from 'react';
import { Icons } from '../ui/Icons';
import { DIAMOND_OFFERS } from '../../utils/constants';
import { DiamondOffer } from '../../types';
import { Storage } from '../../utils/storage';
import { FishTank } from '../ui/FishTank';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { IAP } from '../../utils/iap'; // Import IAP Service

interface DiamondShopScreenProps {
    points: number;
    onBack: () => void;
    onBuyOffer: (offer: DiamondOffer) => void;
    onEarnPoints: (amount: number) => void;
    starterPackPurchased: boolean;
}

export const DiamondShopScreen: React.FC<DiamondShopScreenProps> = ({
    points,
    onBack,
    onBuyOffer,
    onEarnPoints,
    starterPackPurchased
}) => {
    const pepinoState = Storage.getPepinoState();
    
    const handleBuyOfferWrapper = (offer: DiamondOffer) => {
        onBuyOffer(offer);
    };

    const shouldShowIntro = () => {
        if (!pepinoState.unlocked) return false;
        // If we have an unlock timestamp, check if it was recent (15s)
        if (pepinoState.unlockedAt) {
            return (Date.now() - pepinoState.unlockedAt) < 15000;
        }
        return false;
    };

    const handleRewardClaim = (amount: number) => {
        if (amount > 0) {
            onEarnPoints(amount);
        }
    };

    const handleRestore = async () => {
        if(confirm("Restore previous purchases?")) {
            try {
                await IAP.restore();
            } catch (e) {
                console.error(e);
            }
        }
    };

    // Unified Price Badge Style
    const priceBadgeClass = "px-3 py-1.5 rounded-lg text-sm font-bold text-stone-800 shadow-sm min-w-[70px] text-center flex items-center justify-center border border-stone-900/10 bg-gradient-to-br from-white via-gray-100 to-gray-200 active:scale-95 transition-transform tracking-wide";

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden relative">
            {/* Background is now handled in App.tsx to cover safe areas */}

            <div className="w-full max-w-md flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20 mx-auto">
                <button onClick={onBack} className="p-2 rounded-full -ml-2 text-t-icon relative z-30">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>
                 
                <div className="flex items-center justify-center gap-2 absolute left-0 right-0 pointer-events-none z-20">
                    <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                    <h1 className="text-xl font-bold text-t-primary leading-none">Get More</h1>
                    <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                </div>

                <div className="flex items-center gap-1 bg-t-surface px-3 py-2 rounded-full shadow-sm relative z-30">
                      <AnimatedNumber value={points} className="text-sm font-bold text-t-primary tabular-nums" />
                      <div className="text-blue-500"><Icons.Diamond className="w-3 h-3 fill-current" /></div>
                </div>
            </div>
            
            <div className="flex-1 w-full overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col items-center relative z-10">
                <div className="w-full max-w-md pt-2 mx-auto">
                    
                    {pepinoState.unlocked ? (
                        <FishTank onRewardClaim={handleRewardClaim} showIntro={shouldShowIntro()} />
                    ) : (
                        DIAMOND_OFFERS.filter(o => o.type === 'support').map(offer => (
                            <button 
                                key={offer.id} 
                                onClick={() => handleBuyOfferWrapper(offer)}
                                // Card Container - Compact Premium with Price Header
                                className="w-full h-56 relative overflow-hidden rounded-[1.75rem] p-5 shadow-2xl transition-transform mb-6 text-left bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 active:scale-[0.99] group border border-white/10"
                            >
                                {/* Subtle Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/10 pointer-events-none" />

                                {/* Giant Faded Crown/Star Background */}
                                <div className="absolute -right-6 -bottom-8 opacity-[0.12] pointer-events-none z-0 rotate-12">
                                     <svg viewBox="0 0 24 24" className="w-48 h-48 fill-current text-white">
                                         <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
                                     </svg>
                                </div>

                                {/* Floating Premium Particles */}
                                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                                    {[...Array(8)].map((_, i) => (
                                        <div 
                                            key={i}
                                            className={`absolute ${i % 2 === 0 ? 'text-yellow-200' : 'text-rose-300'} animate-float-up`}
                                            style={{
                                                left: `${Math.random() * 100}%`,
                                                bottom: '-20px',
                                                // Negative delay ensures particles are already mid-flight when component mounts
                                                animationDelay: `-${Math.random() * 5}s`,
                                                animationDuration: `${5 + Math.random() * 5}s`,
                                                opacity: 0 
                                            }}
                                        >
                                            {/* Alternating Hearts and Crowns */}
                                            {i % 2 === 0 ? (
                                                <Icons.Crown className="fill-current" style={{ width: `${14 + Math.random() * 10}px`, height: `${14 + Math.random() * 10}px` }} />
                                            ) : (
                                                <Icons.Heart className="fill-current" style={{ width: `${14 + Math.random() * 10}px`, height: `${14 + Math.random() * 10}px` }} />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Main Layout - Vertical Stack */}
                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    
                                    {/* Top Row: Title/Desc and Price */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col items-start pr-2">
                                            <div className="inline-block px-2 py-0.5 rounded-[6px] bg-white/20 text-white text-[10px] font-bold tracking-widest uppercase mb-2 border border-white/20 leading-none w-fit backdrop-blur-sm shadow-sm">
                                                EXCLUSIVE
                                            </div>
                                            <h2 className="text-2xl font-bold text-white leading-none drop-shadow-md mb-2">{offer.title}</h2>
                                            
                                            <p className="text-xs font-medium text-indigo-50 leading-snug mb-1 max-w-[85%] opacity-95">
                                                Adopt an exclusive companion that grows with you and grants special rewards after every game.
                                            </p>
                                        </div>

                                        <div className={`${priceBadgeClass} shrink-0 mt-0.5`}>
                                            {offer.priceLabel}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Checklist and Diamonds */}
                                    <div className="flex items-end justify-between w-full">
                                        {/* Features List */}
                                        <div className="flex flex-col gap-1.5 pl-0.5 pb-0.5">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-white/20 p-0.5 rounded-full"><Icons.Check className="w-2.5 h-2.5 text-white stroke-[4]" /></div>
                                                <span className="text-[11px] font-bold text-white shadow-sm">No forced ads, ever</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="bg-white/20 p-0.5 rounded-full"><Icons.Check className="w-2.5 h-2.5 text-white stroke-[4]" /></div>
                                                <span className="text-[11px] font-bold text-white shadow-sm">Support Indie Dev</span>
                                            </div>
                                        </div>

                                        {/* Value */}
                                        <div className="flex items-center gap-1 pb-1">
                                            <span className="text-3xl font-bold text-white tracking-tighter leading-none drop-shadow-md">+{offer.diamonds}</span>
                                            <Icons.Diamond className="w-6 h-6 text-blue-200 fill-current drop-shadow-md mb-0.5" />
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}

                    {DIAMOND_OFFERS.filter(o => o.type === 'starter').map(offer => {
                         const isPurchased = starterPackPurchased;
                         return (
                             <button 
                                key={offer.id} 
                                onClick={() => !isPurchased && onBuyOffer(offer)}
                                disabled={isPurchased}
                                className={`w-full h-40 relative overflow-hidden rounded-[1.75rem] p-5 shadow-xl transition-transform mb-6 text-left ${offer.gradientClass || 'bg-white'} ${isPurchased ? 'shadow-none opacity-50 grayscale cursor-not-allowed' : 'shadow-amber-900/5 active:scale-[0.99] group'}`}
                             >
                                <div className="absolute right-3 -bottom-10 opacity-[0.07] pointer-events-none animate-spin-slow">
                                     <Icons.Diamond className="w-48 h-48 text-stone-900 fill-current" />
                                </div>
                                <div className="relative z-10 flex flex-row justify-between h-full items-stretch">
                                    <div className="flex flex-col items-start justify-between flex-1 pr-4 py-0.5">
                                         <div>
                                             {!isPurchased && (
                                                <div className="inline-block px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold tracking-widest uppercase mb-1.5 border border-orange-200/50 leading-none">
                                                    {offer.badge || "BEST VALUE"}
                                                </div>
                                             )}
                                             <h2 className="text-xl font-bold text-stone-900 leading-tight mb-0.5">{offer.title}</h2>
                                             <p className="text-xs font-semibold text-stone-500 leading-none">{offer.subtitle}</p>
                                         </div>
                                         <div className="flex flex-col gap-1 items-start mt-1">
                                             {offer.includes && offer.includes.map(inc => (
                                                 <div key={inc} className="flex items-center gap-1.5">
                                                     <Icons.Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" />
                                                     <span className="text-[11px] font-bold text-stone-600">{inc}</span>
                                                 </div>
                                             ))}
                                         </div>
                                    </div>
                                    <div className="flex flex-col items-end justify-between shrink-0 py-0.5">
                                        <div 
                                            className={`${isPurchased ? 'bg-stone-400 text-white shadow-none cursor-default px-3 py-1.5 rounded-lg text-xs font-bold min-w-[70px] text-center border border-transparent' : priceBadgeClass}`}
                                         >
                                            {isPurchased ? 'OWNED' : offer.priceLabel}
                                         </div>
                                         <div className="flex items-center gap-1 mt-auto pt-1">
                                             <span className="text-3xl font-bold text-stone-900 tracking-tighter leading-none">+{offer.diamonds}</span>
                                             <Icons.Diamond className="w-6 h-6 text-blue-500 fill-current drop-shadow-sm mb-0.5" />
                                         </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    <h3 className="text-xs font-bold text-t-secondary uppercase tracking-widest mb-3 ml-1">PACKS</h3>
                    <div className="grid grid-cols-4 gap-2 mb-8">
                        {DIAMOND_OFFERS.filter(o => o.type === 'pack').map(offer => (
                            <button 
                                key={offer.id} 
                                onClick={() => onBuyOffer(offer)}
                                className="bg-gradient-to-b from-blue-50 to-white dark:from-stone-800 dark:to-stone-900 rounded-2xl p-1.5 flex flex-col items-center justify-between shadow-sm border border-blue-100 dark:border-stone-700 h-28 active:scale-95 transition-transform group"
                            >
                                <div className="flex-1 flex flex-col items-center justify-center gap-0.5 w-full overflow-hidden">
                                    <Icons.Diamond className="w-6 h-6 text-blue-500 fill-current drop-shadow-sm mb-0.5" />
                                    <span className="text-base font-bold text-stone-900 dark:text-t-primary leading-none">+{offer.diamonds}</span>
                                    <span className="text-[10px] font-bold text-stone-400 truncate w-full text-center leading-tight">{offer.title}</span>
                                </div>
                                <div className="w-full">
                                    <div className={`${priceBadgeClass} w-full text-xs py-1.5 min-w-0 rounded-md group-active:scale-100 border-stone-900/10`}>
                                        {offer.priceLabel}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    
                    <div className="p-4 bg-t-surface-sec rounded-xl text-center mt-6">
                        <button 
                            className="text-xs font-bold text-t-primary underline" 
                            onClick={handleRestore}
                        >
                            Restore Purchases
                        </button>
                    </div>
                </div>
                <div className="h-safe-bottom w-full shrink-0" />
            </div>
        </div>
    );
};