import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { DIAMOND_OFFERS } from '../../utils/constants';
import { DiamondOffer } from '../../types';
import { Storage } from '../../utils/storage';
import { FishTank } from '../ui/FishTank';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface DiamondShopScreenProps {
    points: number;
    onBack: () => void;
    onBuyOffer: (offer: DiamondOffer) => void;
    onEarnPoints: (amount: number) => void;
    onRestorePurchases: () => Promise<'restored' | 'none' | 'failed'>;
    starterPackPurchased: boolean;
}

const FeatureRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-left">
        <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center shrink-0">
            {icon}
        </div>
        <span className="text-[13px] font-semibold text-stone-600 dark:text-stone-300 leading-tight">{children}</span>
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

const PremiumPepinoBackdrop = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef({ x: 78, y: 24 });
    const [position, setPosition] = useState(positionRef.current);
    const [direction, setDirection] = useState<'left' | 'right'>('left');
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [canAnimate, setCanAnimate] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const updateSize = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (size.width <= 0) return;
        const readyTimer = window.setTimeout(() => setCanAnimate(true), 100);
        return () => window.clearTimeout(readyTimer);
    }, [size.width]);

    useEffect(() => {
        let moveTimer: number;

        const move = () => {
            const next = {
                x: 12 + Math.random() * 76,
                y: 14 + Math.random() * 66
            };
            setDirection(next.x > positionRef.current.x ? 'right' : 'left');
            positionRef.current = next;
            setPosition(next);
            moveTimer = window.setTimeout(move, 4500 + Math.random() * 2500);
        };

        moveTimer = window.setTimeout(move, 900);
        return () => window.clearTimeout(moveTimer);
    }, []);

    const fishX = (position.x / 100) * size.width - 27;
    const fishY = (position.y / 100) * size.height - 17;

    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-b from-[#e0f7fa] via-[#d1f4fa] to-[#b3e5fc] dark:from-[#173b52] dark:via-[#1f4d63] dark:to-[#2b6879]" />
            <div
                className={`absolute top-0 left-0 w-[54px] h-[34px] transition-opacity duration-300 ${size.width > 0 ? 'opacity-70' : 'opacity-0'}`}
                style={{
                    transform: `translate3d(${fishX}px, ${fishY}px, 0)`,
                    transition: canAnimate ? 'transform 4000ms ease-in-out' : 'none',
                    willChange: 'transform',
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden'
                }}
            >
                <div className="w-full h-full transition-transform duration-500" style={{ transform: direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}>
                    <div className="w-full h-full animate-wiggle">
                        <svg viewBox="344.5149 210.9059 74.9591 41.2278" className="w-full h-full drop-shadow-sm">
                            <path d="M 373.193 239.648 C 379.513 254.112 400.131 252.185 404.661 240.061 C 393.45 240.02 396.193 239.089 386.193 239.648 L 373.193 239.648 Z" fill="#ef4444" opacity="0.95" />
                            <path d="M 372.793 224.525 C 379.113 207.278 399.731 209.576 404.261 224.033 C 393.05 224.081 395.793 225.192 385.793 224.525 L 372.793 224.525 Z" fill="#ef4444" opacity="0.95" />
                            <path d="M 394.515 231.681 C 379.515 206.681 344.428 201.406 344.515 231.681 C 344.565 261.131 379.515 256.681 394.515 231.681 Z" fill="#ef4444" opacity="0.95" />
                            <path d="M 394.515 231.681 C 374.515 216.681 359.515 211.681 354.515 231.681 C 359.515 251.681 374.515 246.681 394.515 231.681 Z" fill="#b91c1c" opacity="0.15" />
                            <ellipse cx="391.474" cy="231.681" rx="28" ry="11" fill="#dc2626" />
                            <path d="M 401.174 234.169 C 395.84 239.502 397.84 240.836 407.174 238.169 L 401.174 234.169 Z" fill="#fca5a5" opacity="0.8" transform="matrix(0.71619296, -0.69790214, 0.69790214, 0.71619296, 0.00000291, 0.0000368)" />
                            <circle cx="411.874" cy="230.381" r="2.5" fill="black" />
                            <circle cx="412.874" cy="229.381" r="0.8" fill="white" opacity="0.9" />
                        </svg>
                    </div>
                </div>
            </div>
            <div className="absolute inset-0 bg-white/[0.58] dark:bg-slate-950/[0.48]" />
        </div>
    );
};

export const DiamondShopScreen: React.FC<DiamondShopScreenProps> = ({
    points,
    onBack,
    onBuyOffer,
    onEarnPoints,
    onRestorePurchases,
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
            const result = await onRestorePurchases();
            if (result === 'restored') {
                alert('Purchases restored.');
            } else if (result === 'none') {
                alert('No restorable purchases were found.');
            } else {
                alert('Restore failed. Please try again.');
            }
        } catch (error) {
            console.error(error);
            alert('Restore failed. Please try again.');
        }
    };

    return (
        <div className="diamond-shop-screen flex-1 w-full flex flex-col items-center overflow-hidden relative">
            <div className="w-full max-w-md flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20 mx-auto">
                <button onClick={onBack} aria-label="Back" className="p-2 rounded-full -ml-2 text-t-icon relative z-30 active:scale-90 transition-transform">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>

                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl font-bold text-t-primary leading-none">Oku Shop</h1>
                </div>

                <div className="flex items-center gap-1.5 bg-t-surface px-3 py-2 rounded-full shadow-sm relative z-30 border border-stone-200/60 dark:border-stone-800">
                    <AnimatedNumber value={points} easing="easeOut" durationMs={1000} className="text-sm font-bold text-t-primary tabular-nums" />
                    <Icons.Diamond className="w-3 h-3 text-blue-500 fill-current" />
                </div>
            </div>

            <div className="scroll-edge-fade flex-1 w-full overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col items-center relative z-10">
                <div className="w-full max-w-md pt-2 mx-auto space-y-6">
                    {pepinoState.unlocked ? (
                        <FishTank onRewardClaim={handleRewardClaim} showIntro={shouldShowIntro()} />
                    ) : premiumOffer ? (
                        <section aria-labelledby="premium-heading">
                            <button
                                onClick={() => onBuyOffer(premiumOffer)}
                                className="w-full bg-[#e0f7fa] dark:bg-[#173b52] rounded-[1.75rem] shadow-sm border border-sky-100/80 dark:border-sky-900 overflow-hidden text-left active:scale-[0.99] transition-transform relative"
                            >
                                <PremiumPepinoBackdrop />

                                <div className="p-4 pb-3 relative z-10">
                                    <div className="mb-3">
                                        <div className="min-w-0">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-white/95 via-violet-50/95 to-sky-50/95 border border-white/90 text-[#5f5872] mb-1.5 shadow-[0_0_12px_rgba(255,255,255,0.95),0_0_26px_rgba(139,92,246,0.32)]">
                                                <Icons.Star className="w-3 h-3 text-violet-500 drop-shadow-[0_0_4px_rgba(139,92,246,0.7)]" />
                                                <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Oku Premium</span>
                                            </div>
                                            <h2 id="premium-heading" className="text-xl font-bold text-t-primary leading-tight">Meet Pepino</h2>
                                            <p className="text-[13px] font-medium text-t-secondary mt-0.5">A little companion for your Sudoku journey.</p>
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-white/80 dark:bg-slate-950/35 px-3.5 py-3 mb-3">
                                        <p className="text-[13px] font-medium text-stone-600 dark:text-stone-300 leading-relaxed">
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

                                <div className="relative z-10 px-4 py-3 border-t border-white/70 dark:border-sky-900/70 flex items-center justify-between bg-white/80 dark:bg-slate-950/55">
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
                                                <img
                                                    src="/assets/starter-pack-icon.webp"
                                                    alt=""
                                                    aria-hidden="true"
                                                    className="w-8 h-8 object-contain shrink-0 select-none pointer-events-none"
                                                    draggable={false}
                                                />
                                                <h2 id="starter-heading" className="text-lg font-bold text-t-primary">Starter Pack</h2>
                                            </div>
                                            <p className="text-[13px] font-medium text-t-secondary">Six permanent rewards to begin your journey.</p>
                                        </div>
                                        {!starterPackPurchased && (
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-1 rounded-full shrink-0">One time</span>
                                        )}
                                    </div>

                                    <div className="relative grid grid-cols-6 gap-1">
                                        <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <div className="h-8 flex items-center justify-center">
                                                <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                                            </div>
                                            <div className="text-center">
                                                <span className="block text-[15px] font-bold text-t-primary leading-none">500</span>
                                            </div>
                                        </div>
                                        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <div className="h-8 flex items-center justify-center">
                                                <Icons.Guard className="w-[30px] h-[30px]" />
                                            </div>
                                            <span className="text-[11px] font-bold text-t-primary">Guard</span>
                                        </div>
                                        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <div className="h-8 flex items-center justify-center">
                                                <Icons.Scan className="w-[30px] h-[30px] text-red-500 dark:text-red-400" />
                                            </div>
                                            <span className="text-[11px] font-bold text-t-primary">Scan</span>
                                        </div>
                                        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <div className="h-8 flex items-center justify-center">
                                                <Icons.Nudge className="w-8 h-8" />
                                            </div>
                                            <span className="text-[11px] font-bold text-t-primary">Nudge</span>
                                        </div>
                                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <div className="h-8 flex items-center justify-center">
                                                <img
                                                    src="/assets/sound-pack-icons/piano_icon.webp"
                                                    alt=""
                                                    aria-hidden="true"
                                                    className="block w-8 h-8 object-contain object-center select-none pointer-events-none"
                                                    draggable={false}
                                                />
                                            </div>
                                            <span className="text-[11px] font-bold text-t-primary">Piano</span>
                                        </div>
                                        <div className="rounded-xl bg-cyan-50 dark:bg-cyan-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                            <div className="h-8 flex items-center justify-center">
                                                <span className="text-[30px] font-semibold leading-none text-cyan-600 dark:text-cyan-400">5</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-t-primary">Teal</span>
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
                            <p className="text-[13px] font-medium text-t-secondary mt-1">Use diamonds for skills, themes, sounds, and more.</p>
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
