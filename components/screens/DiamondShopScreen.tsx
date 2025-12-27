
import React, { useState } from 'react';
import { Icons } from '../ui/Icons';
import { DIAMOND_OFFERS } from '../../utils/constants';
import { DiamondOffer } from '../../types';
import { Storage } from '../../utils/storage';
import { FishTank } from '../ui/FishTank';

interface DiamondShopScreenProps {
    points: number;
    onBack: () => void;
    onWatchAd: () => void;
    onBuyOffer: (offer: DiamondOffer) => void;
    onEarnPoints: (amount: number) => void;
    starterPackPurchased: boolean;
}

const DiamondBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <svg className="w-full h-[200%] animate-flow-up opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="diamond-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
           <path d="M30 5 L55 30 L30 55 L5 30 Z" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 dark:text-stone-600" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#diamond-pattern)" />
    </svg>
  </div>
);

export const DiamondShopScreen: React.FC<DiamondShopScreenProps> = ({
    points,
    onBack,
    onWatchAd,
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
        const now = Date.now();
        // If unlocked within the last 15 seconds AND delay is 0 (initial state), show intro
        return (now - pepinoState.lastGiftTime) < 15000 && pepinoState.nextGiftDelay === 0;
    };

    const handleRewardClaim = (amount: number) => {
        if (amount > 0) {
            onEarnPoints(amount);
        }
    };

    // Unified Price Badge Style
    // Premium Silver Gradient + Dark Text + Thin Border + Reduced Size
    const priceBadgeClass = "px-3 py-1.5 rounded-lg text-sm font-bold text-stone-800 shadow-sm min-w-[70px] text-center flex items-center justify-center border border-stone-900/10 bg-gradient-to-br from-white via-gray-100 to-gray-200 active:scale-95 transition-transform tracking-wide";

    return (
        <div className="flex-1 w-full flex flex-col items-center overflow-hidden relative">
            <DiamondBackground />

            <div className="w-full max-w-md flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20 mx-auto">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-200 transition -ml-2 text-t-icon relative z-30">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>
                 
                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl font-bold text-t-primary leading-none">Diamond Shop</h1>
                    <p className="text-t-secondary text-[10px] font-bold tracking-widest uppercase mt-1">Get More</p>
                </div>

                <div className="flex items-center gap-1 bg-t-surface px-3 py-2 rounded-full shadow-sm relative z-30">
                      <span className="text-sm font-bold text-t-primary animate-pop">{points}</span>
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
                                // Card Container - Premium Midnight Slate Gradient with lighter start
                                className="w-full h-56 relative overflow-hidden rounded-[1.75rem] p-6 shadow-2xl transition-transform mb-6 text-left bg-gradient-to-br from-slate-600 via-slate-800 to-slate-900 active:scale-[0.99] group border border-white/10"
                            >
                                {/* Subtle Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/5 pointer-events-none" />

                                {/* Giant Faded Heart Background - Centered/Right */}
                                <div className="absolute -right-8 -bottom-10 opacity-[0.08] pointer-events-none z-0">
                                     <svg viewBox="0 0 24 24" className="w-64 h-64 fill-current text-rose-500">
                                         <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                     </svg>
                                </div>

                                {/* Moving Floating Hearts */}
                                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                                    {[...Array(12)].map((_, i) => (
                                        <div 
                                            key={i}
                                            className="absolute text-rose-500 animate-float-up"
                                            style={{
                                                left: `${Math.random() * 100}%`,
                                                bottom: '-20px',
                                                animationDelay: `${Math.random() * 5}s`,
                                                animationDuration: `${5 + Math.random() * 5}s`,
                                                opacity: 0 // Initial opacity handled by keyframe
                                            }}
                                        >
                                            <Icons.Heart 
                                                className="fill-current" 
                                                style={{ 
                                                    // Increased size by ~15% (range: 10px - 24px)
                                                    width: `${10 + Math.random() * 14}px`, 
                                                    height: `${10 + Math.random() * 14}px` 
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="relative z-10 flex flex-col h-full">
                                    {/* Header Row */}
                                    <div className="flex justify-between items-start mb-2">
                                        <h2 className="text-2xl font-bold text-white leading-tight">{offer.title}</h2>
                                    </div>

                                    {/* Description Text - Explicitly over the heart area */}
                                    <p className="text-[11px] font-medium text-slate-300 leading-relaxed pr-2 max-w-full mb-3 relative z-10">
                                        Oku is made by a single independent developer. 
                                        Your support helps keep the app calm, fair, and ad-light. 
                                        Thank you for being here.
                                    </p>

                                    {/* Bottom Area: Benefits List + Price Badge */}
                                    <div className="flex items-end justify-between mt-auto w-full">
                                        
                                        {/* Benefits List (Smaller Text: text-[11px] or text-xs) */}
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Icons.Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                                                <div className="flex items-center gap-0.5">
                                                    <span className="text-[11px] font-bold text-white">+400</span>
                                                    <Icons.Diamond className="w-3.5 h-3.5 text-sky-400 fill-current" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Icons.Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                                                <span className="text-[11px] font-bold text-slate-200">No forced ads, ever</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Icons.Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                                                <span className="text-[11px] font-bold text-slate-200">Special companion</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Icons.Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                                                <span className="text-[11px] font-bold text-slate-200">A personal thank-you</span>
                                            </div>
                                        </div>

                                        {/* Price Badge */}
                                        <div className={`${priceBadgeClass} shrink-0 ml-4 mb-0.5 shadow-lg`}>
                                            {offer.priceLabel}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}

                    <button 
                        onClick={onWatchAd} 
                        className="w-1/2 mx-auto block relative overflow-hidden bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 bg-[length:200%_200%] animate-gradient rounded-2xl shadow-lg shadow-amber-500/30 active:scale-95 transition-transform group mb-8 border-t border-white/40"
                    >
                        <div className="py-3 flex items-center justify-center gap-3 relative z-10">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20 shadow-sm">
                                <Icons.Film className="w-6 h-6 text-stone-900" />
                            </div>
                            
                            <div className="flex items-center gap-1.5 bg-white/30 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/20 shadow-sm">
                                 <span className="text-2xl font-bold tracking-tighter leading-none text-black">+25</span>
                                 <Icons.Diamond className="w-5 h-5 fill-current text-blue-600 drop-shadow-sm" />
                            </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent z-20 animate-shimmer pointer-events-none" />
                    </button>

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
                            onClick={() => {
                                if(confirm("Restore Purchases?")) {
                                    alert("Purchases Restored (Simulation)");
                                }
                            }}
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
