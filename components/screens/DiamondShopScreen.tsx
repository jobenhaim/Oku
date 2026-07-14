import React from 'react';
import { Icons } from '../ui/Icons';
import { DIAMOND_OFFERS } from '../../utils/constants';
import { DiamondOffer } from '../../types';
import { Storage } from '../../utils/storage';
import { FishTank } from '../ui/FishTank';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { IAP } from '../../utils/iap';

interface DiamondShopScreenProps {
    points: number;
    onBack: () => void;
    onBuyOffer: (offer: DiamondOffer) => void;
    onEarnPoints: (amount: number) => void;
    starterPackPurchased: boolean;
}

const FeatureRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-left">
        <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center shrink-0">
            {icon}
        </div>
        <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 leading-tight">{children}</span>
    </div>
);

const DiamondStack = ({ size }: { size: number }) => (
    <div className="relative w-16 h-10 flex items-center justify-center" aria-hidden="true">
        {size >= 2 && <Icons.Diamond className="absolute w-5 h-5 text-blue-200 dark:text-blue-900 fill-current -translate-x-3.5 -translate-y-1 rotate-[-8deg]" />}
        {size >= 3 && <Icons.Diamond className="absolute w-4 h-4 text-sky-200 dark:text-sky-900 fill-current translate-x-4 translate-y-0.5 rotate-12" />}
        {size >= 4 && <Icons.Diamond className="absolute w-4 h-4 text-indigo-200 dark:text-indigo-900 fill-current" style={{ transform: 'translate(-25px, 8px) rotate(-15deg)' }} />}
        {size >= 4 && <Icons.Diamond className="absolute w-3.5 h-3.5 text-cyan-200 dark:text-cyan-900 fill-current" style={{ transform: 'translate(25px, -7px) rotate(18deg)' }} />}
        {size >= 4 && <Icons.Diamond className="absolute w-3 h-3 text-blue-100 dark:text-blue-950 fill-current" style={{ transform: 'translate(1px, -13px) rotate(5deg)' }} />}
        <Icons.Diamond className={`relative z-10 text-blue-500 fill-current drop-shadow-sm ${size === 1 ? 'w-7 h-7' : size === 2 ? 'w-8 h-8' : 'w-9 h-9'}`} />
    </div>
);

export const DiamondShopScreen: React.FC<DiamondShopScreenProps> = ({
    points,
    onBack,
    onBuyOffer,
    onEarnPoints,
    starterPackPurchased
}) => {
    const pepinoState = Storage.getPepinoState();
    const premiumOffer = DIAMOND_OFFERS.find(offer => offer.type === 'support');
    const starterOffer = DIAMOND_OFFERS.find(offer => offer.type === 'starter');
    const diamondPacks = DIAMOND_OFFERS.filter(offer => offer.type === 'pack');

    const shouldShowIntro = () => {
        if (!pepinoState.unlocked || !pepinoState.unlockedAt) return false;
        return Date.now() - pepinoState.unlockedAt < 15000;
    };

    const handleRewardClaim = (amount: number) => {
        if (amount > 0) onEarnPoints(amount);
    };

    const handleRestore = async () => {
        if (!confirm('Restore previous purchases?')) return;

        try {
            await IAP.restore();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="diamond-shop-screen flex-1 w-full flex flex-col items-center overflow-hidden relative animate-fade-in-fast">
            <div className="w-full max-w-md flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20 mx-auto">
                <button onClick={onBack} aria-label="Back" className="p-2 rounded-full -ml-2 text-t-icon relative z-30 active:scale-90 transition-transform">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>

                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl font-bold text-t-primary leading-none">Diamonds</h1>
                    <p className="text-t-secondary text-[10px] font-bold tracking-widest uppercase mt-1">Shop</p>
                </div>

                <div className="flex items-center gap-1.5 bg-t-surface px-3 py-2 rounded-full shadow-sm relative z-30 border border-stone-200/60 dark:border-stone-800">
                    <AnimatedNumber value={points} className="text-sm font-bold text-t-primary tabular-nums" />
                    <Icons.Diamond className="w-3 h-3 text-blue-500 fill-current" />
                </div>
            </div>

            <div className="flex-1 w-full overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col items-center relative z-10">
                <div className="w-full max-w-md pt-2 mx-auto space-y-6">
                    {pepinoState.unlocked ? (
                        <FishTank onRewardClaim={handleRewardClaim} showIntro={shouldShowIntro()} />
                    ) : premiumOffer ? (
                        <section aria-labelledby="premium-heading">
                            <button
                                onClick={() => onBuyOffer(premiumOffer)}
                                className="w-full bg-t-surface rounded-[1.75rem] shadow-sm border border-stone-200/80 dark:border-stone-800 overflow-hidden text-left active:scale-[0.99] transition-transform"
                            >
                                <div className="p-4 pb-3">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="min-w-0">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-300 mb-1.5">
                                                <Icons.Star className="w-3 h-3" />
                                                <span className="text-[9px] font-bold uppercase tracking-[0.16em]">Oku Premium</span>
                                            </div>
                                            <h2 id="premium-heading" className="text-xl font-bold text-t-primary leading-tight">Meet Pepino</h2>
                                            <p className="text-[11px] font-medium text-t-secondary mt-0.5">A little companion for your Sudoku journey.</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0 rotate-2">
                                            <Icons.Fish className="w-7 h-7 text-red-600 dark:text-red-400" />
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-t-surface-sec px-3.5 py-3 mb-3">
                                        <p className="text-[11px] font-medium text-stone-600 dark:text-stone-300 leading-relaxed">
                                            Pepino lives in a peaceful aquarium, grows with you, and brings you a diamond gift after every completed game.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        <FeatureRow icon={<Icons.Diamond className="w-3.5 h-3.5 fill-current" />}>
                                            {premiumOffer.diamonds.toLocaleString()} diamonds included
                                        </FeatureRow>
                                        <FeatureRow icon={<Icons.Gift className="w-3.5 h-3.5" />}>
                                            A new Pepino gift after every solved puzzle
                                        </FeatureRow>
                                        <FeatureRow icon={<Icons.Check className="w-3.5 h-3.5 stroke-[3]" />}>
                                            No forced ads, ever
                                        </FeatureRow>
                                    </div>
                                </div>

                                <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold text-t-primary">Unlock Pepino</span>
                                        <Icons.Next className="w-4 h-4 text-t-secondary" />
                                    </div>
                                    <span className="px-3 py-1.5 rounded-full bg-blue-500 text-white text-sm font-bold shadow-sm shadow-blue-500/20">
                                        {premiumOffer.priceLabel}
                                    </span>
                                </div>
                            </button>
                        </section>
                    ) : null}

                    {starterOffer && (
                        <section aria-labelledby="starter-heading">
                            <button
                                onClick={() => !starterPackPurchased && onBuyOffer(starterOffer)}
                                disabled={starterPackPurchased}
                                className={`w-full bg-t-surface rounded-3xl shadow-sm border border-stone-200/80 dark:border-stone-800 text-left transition-all overflow-hidden relative ${starterPackPurchased ? 'opacity-60 cursor-default' : 'active:scale-[0.99]'}`}
                            >

                                <div className="p-4 pb-3">
                                    <div className="relative flex items-center justify-between gap-3 mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                                    <Icons.Gift className="w-4 h-4" />
                                                </div>
                                                <h2 id="starter-heading" className="text-lg font-bold text-t-primary">Starter Pack</h2>
                                            </div>
                                            <p className="text-[11px] font-medium text-t-secondary">Four permanent rewards to begin your journey.</p>
                                        </div>
                                        {!starterPackPurchased && (
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-1 rounded-full shrink-0">One time</span>
                                        )}
                                    </div>

                                    <div className="relative grid grid-cols-4 gap-2">
                                        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 px-2 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                                            <div className="text-center">
                                                <span className="block text-sm font-bold text-t-primary leading-none">500</span>
                                                <span className="block text-[8px] font-semibold text-t-secondary mt-1">Diamonds</span>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 px-2 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <Icons.Auto className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                            <span className="text-[9px] font-bold text-t-primary">Auto</span>
                                        </div>
                                        <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 px-2 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <Icons.Scan className="w-5 h-5 text-red-500 dark:text-red-400" />
                                            <span className="text-[9px] font-bold text-t-primary">Scan</span>
                                        </div>
                                        <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 px-2 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <Icons.Music className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                                            <span className="text-[9px] font-bold text-t-primary">Piano</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative px-4 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold text-t-primary">{starterPackPurchased ? 'Starter Pack' : 'Unlock Starter Pack'}</span>
                                        {!starterPackPurchased && <Icons.Next className="w-4 h-4 text-t-secondary" />}
                                    </div>
                                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${starterPackPurchased ? 'bg-t-surface-sec text-t-secondary' : 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'}`}>
                                        {starterPackPurchased ? 'Owned' : starterOffer.priceLabel}
                                    </span>
                                </div>
                            </button>
                        </section>
                    )}

                    <section aria-labelledby="packs-heading">
                        <div className="px-1 mb-3">
                            <h2 id="packs-heading" className="text-xs font-bold text-t-secondary uppercase tracking-widest">Diamond Packs</h2>
                            <p className="text-[11px] font-medium text-t-secondary mt-1">Use diamonds for skills, themes, sounds, and more.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {diamondPacks.map((offer, index) => {
                                const isBestValue = index === diamondPacks.length - 1;
                                return (
                                    <button
                                        key={offer.id}
                                        onClick={() => onBuyOffer(offer)}
                                        className={`relative overflow-hidden bg-t-surface rounded-3xl p-3.5 min-h-[148px] flex flex-col items-center justify-between text-center shadow-sm border active:scale-[0.98] transition-transform ${isBestValue ? 'border-blue-300 dark:border-blue-800' : 'border-stone-200/80 dark:border-stone-800'}`}
                                    >
                                        {isBestValue && (
                                            <span className="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 rounded-full">Best value</span>
                                        )}
                                        <div className="relative flex flex-col items-center pt-1">
                                            <DiamondStack size={index + 1} />
                                            <span className="text-2xl font-bold text-t-primary leading-none mt-1">{offer.diamonds.toLocaleString()}</span>
                                            <span className="sr-only">diamonds</span>
                                        </div>
                                        <span className="relative px-3 py-1.5 rounded-full text-sm font-bold bg-blue-500 text-white shadow-sm shadow-blue-500/20">
                                            {offer.priceLabel}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <div className="text-center pb-2">
                        <button className="text-xs font-semibold text-t-secondary py-2 px-4 active:text-t-primary transition-colors" onClick={handleRestore}>
                            Restore Purchases
                        </button>
                        <p className="text-[9px] font-medium text-stone-300 dark:text-stone-600 mt-1">Purchases are handled securely by the App Store.</p>
                    </div>
                </div>
                <div className="h-safe-bottom w-full shrink-0" />
            </div>
        </div>
    );
};
