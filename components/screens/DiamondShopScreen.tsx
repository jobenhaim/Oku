import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { DIAMOND_OFFERS } from '../../utils/constants';
import { DiamondOffer } from '../../types';
import { Storage } from '../../utils/storage';
import { FishTank } from '../ui/FishTank';
import { DiamondBalancePill } from '../ui/DiamondBalancePill';
import { IAP } from '../../utils/iap';
import { useTactilePress } from '../../hooks/useTactilePress';
import { sounds } from '../../utils/sound';

interface DiamondShopScreenProps {
    points: number;
    onBack: () => void;
    onBuyOffer: (offer: DiamondOffer) => void;
    onPointsChanged: (points: number) => void;
    onRestorePurchases: () => Promise<'restored' | 'none' | 'failed'>;
    starterPackPurchased: boolean;
    books2AllOwned: boolean;
    books3AllOwned: boolean;
    booksForeverOwned: boolean;
    book2BundlePrice: string;
    book3BundlePrice: string;
    booksForeverPrice: string;
    isPurchasingBook2Bundle: boolean;
    isPurchasingBook3Bundle: boolean;
    isPurchasingBooksForever: boolean;
    onPurchaseAllBooks2: () => void;
    onPurchaseAllBooks3: () => void;
    onPurchaseBooksForever: () => void;
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
    onPointsChanged,
    onRestorePurchases,
    starterPackPurchased,
    books2AllOwned,
    books3AllOwned,
    booksForeverOwned,
    book2BundlePrice,
    book3BundlePrice,
    booksForeverPrice,
    isPurchasingBook2Bundle,
    isPurchasingBook3Bundle,
    isPurchasingBooksForever,
    onPurchaseAllBooks2,
    onPurchaseAllBooks3,
    onPurchaseBooksForever,
}) => {
    const [localizedPrices, setLocalizedPrices] = useState<Record<string, string>>({});
    const [showBooksForeverInfo, setShowBooksForeverInfo] = useState(false);
    const [isClosingBooksForeverInfo, setIsClosingBooksForeverInfo] = useState(false);
    const shopPress = useTactilePress<string>();
    const pepinoState = Storage.getPepinoState();
    const premiumOffer = DIAMOND_OFFERS.find(offer => offer.type === 'support');
    const starterOffer = DIAMOND_OFFERS.find(offer => offer.type === 'starter');
    const diamondPacks = DIAMOND_OFFERS.filter(offer => offer.type === 'pack');

    useEffect(() => {
        let isActive = true;

        IAP.getLocalizedPrices(DIAMOND_OFFERS.map(offer => offer.productId)).then(prices => {
            if (isActive) setLocalizedPrices(prices);
        });

        return () => {
            isActive = false;
        };
    }, []);

    const getPriceLabel = (offer: DiamondOffer) => localizedPrices[offer.productId] || offer.priceLabel;

    const handleBuyOffer = (offer: DiamondOffer) => {
        onBuyOffer({
            ...offer,
            priceLabel: getPriceLabel(offer)
        });
    };

    const closeBooksForeverInfo = () => {
        if (!showBooksForeverInfo || isClosingBooksForeverInfo) return;
        setIsClosingBooksForeverInfo(true);
        window.setTimeout(() => {
            setShowBooksForeverInfo(false);
            setIsClosingBooksForeverInfo(false);
        }, 150);
    };

    const toggleBooksForeverInfo = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        sounds.playClick();
        if (showBooksForeverInfo) {
            closeBooksForeverInfo();
            return;
        }
        setIsClosingBooksForeverInfo(false);
        setShowBooksForeverInfo(true);
    };

    const shouldShowIntro = () => {
        if (!pepinoState.unlocked || !pepinoState.unlockedAt) return false;
        return Date.now() - pepinoState.unlockedAt < 15000;
    };

    const handleRewardClaim = (points: number) => {
        onPointsChanged(points);
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
        <div
            className="diamond-shop-screen flex-1 w-full flex flex-col items-center overflow-hidden relative"
            onClick={closeBooksForeverInfo}
        >
            <div className="w-full max-w-md md:max-w-[700px] flex items-center justify-between px-6 md:px-0 pt-4 md:pt-7 pb-4 relative shrink-0 z-20 mx-auto">
                <button onClick={onBack} aria-label="Back" className="p-2 md:p-2.5 rounded-full -ml-2 text-t-icon relative z-30 active:scale-90 transition-transform">
                    <Icons.Back className="w-6 h-6 md:w-7 md:h-7 text-t-icon" />
                </button>

                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl md:text-2xl font-bold text-t-primary leading-none">Oku Shop</h1>
                </div>

                <DiamondBalancePill points={points} />
            </div>

            <div className="scroll-edge-fade flex-1 w-full overflow-y-auto px-6 md:px-0 pb-6 hide-scrollbar flex flex-col items-center relative z-10">
                <div className="w-full max-w-md md:max-w-[620px] pt-2 md:pt-4 mx-auto space-y-6 md:space-y-8">
                    {pepinoState.unlocked ? (
                        <FishTank onRewardClaim={handleRewardClaim} showIntro={shouldShowIntro()} />
                    ) : premiumOffer ? (
                        <section aria-labelledby="premium-heading">
                            <button
                                onClick={() => handleBuyOffer(premiumOffer)}
                                className="w-full bg-[#e0f7fa] dark:bg-[#173b52] rounded-[1.75rem] shadow-sm border border-sky-100/80 dark:border-sky-900 overflow-hidden text-left active:scale-[0.99] transition-transform relative"
                            >
                                <PremiumPepinoBackdrop />

                                <div className="p-4 md:p-6 pb-3 md:pb-5 relative z-10">
                                    <div className="mb-3">
                                        <div className="min-w-0">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-white/95 via-violet-50/95 to-sky-50/95 border border-white/90 text-[#5f5872] mb-1.5 shadow-[0_0_12px_rgba(255,255,255,0.95),0_0_26px_rgba(139,92,246,0.32)]">
                                                <Icons.Star className="w-3 h-3 text-violet-500 drop-shadow-[0_0_4px_rgba(139,92,246,0.7)]" />
                                                <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Oku Premium</span>
                                            </div>
                                            <h2 id="premium-heading" className="text-xl md:text-2xl font-bold text-t-primary leading-tight">Meet Pepino</h2>
                                            <p className="text-[13px] md:text-sm font-medium text-t-secondary mt-0.5">A little companion for your Sudoku journey.</p>
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-white/80 dark:bg-slate-950/35 px-3.5 md:px-4 py-3 md:py-3.5 mb-3 md:mb-4">
                                        <p className="text-[13px] md:text-sm font-medium text-stone-600 dark:text-stone-300 leading-relaxed">
                                            Your purchase supports Oku, helps us make it better, and keeps the game alive.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        <FeatureRow icon={<Icons.Diamond className="w-3.5 h-3.5 fill-current" />}>
                                            {premiumOffer.diamonds.toLocaleString()} diamonds included
                                        </FeatureRow>
                                        <FeatureRow icon={<Icons.Gift className="w-3.5 h-3.5" />}>
                                            A new Pepino gift after every solved puzzle
                                        </FeatureRow>
                                    </div>
                                </div>

                                <div className="relative z-10 px-4 py-3 border-t border-white/70 dark:border-sky-900/70 flex items-center justify-between bg-white/80 dark:bg-slate-950/55">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold text-t-primary">Unlock Pepino</span>
                                        <Icons.Next className="w-4 h-4 text-t-secondary" />
                                    </div>
                                    <span className="px-3 py-1.5 rounded-full bg-blue-500 text-white text-sm font-bold shadow-sm shadow-blue-500/20">
                                        {getPriceLabel(premiumOffer)}
                                    </span>
                                </div>
                            </button>
                        </section>
                    ) : null}

                    {starterOffer && (
                        <section aria-labelledby="starter-heading">
                            <div className="oku-shop-card-shell rounded-3xl">
                                <button
                                    onPointerDown={() => !starterPackPurchased && shopPress.beginPress(starterOffer.id)}
                                    onPointerCancel={() => shopPress.cancelPress(starterOffer.id)}
                                    onPointerLeave={() => shopPress.cancelPress(starterOffer.id)}
                                    onClick={() => !starterPackPurchased && shopPress.runPressCycle(starterOffer.id, () => handleBuyOffer(starterOffer))}
                                    disabled={starterPackPurchased}
                                    className={`oku-shop-card-face ${shopPress.pressedId === starterOffer.id ? 'oku-shop-card-face--pressed' : ''} w-full bg-t-surface rounded-3xl border border-stone-200/80 dark:border-stone-800 text-left overflow-hidden relative ${starterPackPurchased ? 'opacity-60 cursor-default' : ''}`}
                                >

                                    <div className="p-4 md:p-5 pb-3 md:pb-4">
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
                                                    <h2 id="starter-heading" className="text-lg md:text-xl font-bold text-t-primary">Starter Pack</h2>
                                                </div>
                                                <p className="text-[13px] md:text-sm font-medium text-t-secondary">Five permanent rewards to begin your journey.</p>
                                            </div>
                                            {!starterPackPurchased && (
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-1 rounded-full shrink-0">One time</span>
                                            )}
                                        </div>

                                        <div className="relative grid grid-cols-5 gap-1.5 md:gap-2">
                                            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                                <div className="h-8 flex items-center justify-center">
                                                    <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                                                </div>
                                                <div className="text-center">
                                                    <span className="block text-[15px] font-bold text-t-primary leading-none">600</span>
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                                <div className="h-8 flex items-center justify-center">
                                                    <Icons.Guard className="w-[30px] h-[30px] translate-x-[2px]" />
                                                </div>
                                                <span className="text-[11px] font-bold text-t-primary">Guard</span>
                                            </div>
                                            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                                <div className="h-8 flex items-center justify-center">
                                                    <Icons.Scan className="w-[26px] h-[26px] text-red-500 dark:text-red-400" />
                                                </div>
                                                <span className="text-[11px] font-bold text-t-primary">Scan</span>
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
                                            {starterPackPurchased ? 'Owned' : getPriceLabel(starterOffer)}
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </section>
                    )}

                    <section aria-labelledby="books-heading">
                        <div className="px-1 mb-3">
                            <h2 id="books-heading" className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-widest">Book Collections</h2>
                            <p className="text-[13px] md:text-sm font-medium text-t-secondary mt-1">Open more puzzles across every difficulty.</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="oku-shop-card-shell rounded-3xl">
                                <button
                                    type="button"
                                    onPointerDown={() => !books2AllOwned && !isPurchasingBook2Bundle && shopPress.beginPress('books-2-all')}
                                    onPointerCancel={() => shopPress.cancelPress('books-2-all')}
                                    onPointerLeave={() => shopPress.cancelPress('books-2-all')}
                                    onClick={() => {
                                        if (books2AllOwned || isPurchasingBook2Bundle) return;
                                        shopPress.runPressCycle('books-2-all', onPurchaseAllBooks2);
                                    }}
                                    disabled={books2AllOwned || isPurchasingBook2Bundle}
                                    className={`oku-shop-card-face ${shopPress.pressedId === 'books-2-all' ? 'oku-shop-card-face--pressed' : ''} relative w-full min-h-[5.75rem] md:min-h-[7rem] rounded-3xl border-2 bg-white dark:bg-stone-800 px-4 md:px-5 py-1.5 text-left overflow-hidden flex items-center gap-2 md:gap-4 ${
                                        books2AllOwned
                                            ? 'border-stone-200 dark:border-stone-700 opacity-60 cursor-default'
                                            : 'border-blue-300 dark:border-blue-700'
                                    }`}
                                >
                                    <img
                                        src="/assets/oku-shop/book2.webp"
                                        alt=""
                                        className="w-20 h-20 md:w-24 md:h-24 object-contain shrink-0 -ml-2"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-base md:text-lg font-bold text-t-primary leading-tight">Oku Book 2</h3>
                                        <p className="text-[13px] md:text-sm font-semibold text-t-secondary leading-tight mt-1">600 puzzles.</p>
                                        <p className="text-[13px] md:text-sm font-semibold text-t-secondary leading-tight mt-0.5">All difficulties.</p>
                                    </div>
                                    <span
                                        aria-live="polite"
                                        aria-busy={isPurchasingBook2Bundle}
                                        className={`shrink-0 min-w-[4.25rem] min-h-9 px-3.5 py-2 rounded-full text-sm font-bold whitespace-nowrap flex items-center justify-center ${
                                        books2AllOwned
                                            ? 'bg-t-surface-sec text-t-secondary'
                                            : 'bg-blue-500 text-white'
                                    }`}>
                                        {isPurchasingBook2Bundle ? (
                                            <span className="block w-5 h-5 rounded-full border-[2.5px] border-white/40 border-t-white animate-spin" aria-hidden="true" />
                                        ) : books2AllOwned ? 'Owned' : book2BundlePrice}
                                    </span>
                                </button>
                            </div>

                            {books2AllOwned && (
                                <div className="oku-shop-card-shell rounded-3xl">
                                    <button
                                        type="button"
                                        onPointerDown={() => !books3AllOwned && !isPurchasingBook3Bundle && shopPress.beginPress('books-3-all')}
                                        onPointerCancel={() => shopPress.cancelPress('books-3-all')}
                                        onPointerLeave={() => shopPress.cancelPress('books-3-all')}
                                        onClick={() => {
                                            if (books3AllOwned || isPurchasingBook3Bundle) return;
                                            shopPress.runPressCycle('books-3-all', onPurchaseAllBooks3);
                                        }}
                                        disabled={books3AllOwned || isPurchasingBook3Bundle}
                                        className={`oku-shop-card-face ${shopPress.pressedId === 'books-3-all' ? 'oku-shop-card-face--pressed' : ''} relative w-full min-h-[5.75rem] md:min-h-[7rem] rounded-3xl border-2 bg-white dark:bg-stone-800 px-4 md:px-5 py-1.5 text-left overflow-hidden flex items-center gap-2 md:gap-4 ${
                                            books3AllOwned
                                                ? 'border-stone-200 dark:border-stone-700 opacity-60 cursor-default'
                                                : 'border-blue-300 dark:border-blue-700'
                                        }`}
                                    >
                                        <img
                                            src="/assets/oku-shop/book3.webp"
                                            alt=""
                                            className="w-20 h-20 md:w-24 md:h-24 object-contain shrink-0 -ml-2"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-base md:text-lg font-bold text-t-primary leading-tight">Oku Book 3</h3>
                                            <p className="text-[13px] md:text-sm font-semibold text-t-secondary leading-tight mt-1">600 puzzles.</p>
                                            <p className="text-[13px] md:text-sm font-semibold text-t-secondary leading-tight mt-0.5">All difficulties.</p>
                                        </div>
                                        <span
                                            aria-live="polite"
                                            aria-busy={isPurchasingBook3Bundle}
                                            className={`shrink-0 min-w-[4.25rem] min-h-9 px-3.5 py-2 rounded-full text-sm font-bold whitespace-nowrap flex items-center justify-center ${
                                            books3AllOwned
                                                ? 'bg-t-surface-sec text-t-secondary'
                                                : 'bg-blue-500 text-white'
                                        }`}>
                                            {isPurchasingBook3Bundle ? (
                                                <span className="block w-5 h-5 rounded-full border-[2.5px] border-white/40 border-t-white animate-spin" aria-hidden="true" />
                                            ) : books3AllOwned ? 'Owned' : book3BundlePrice}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className={`oku-shop-card-shell rounded-3xl mt-3 ${showBooksForeverInfo ? 'z-50' : ''}`}>
                            <button
                                type="button"
                                onPointerDown={() => !booksForeverOwned && !isPurchasingBooksForever && shopPress.beginPress('books-forever')}
                                onPointerCancel={() => shopPress.cancelPress('books-forever')}
                                onPointerLeave={() => shopPress.cancelPress('books-forever')}
                                onClick={() => {
                                    if (booksForeverOwned || isPurchasingBooksForever) return;
                                    shopPress.runPressCycle('books-forever', onPurchaseBooksForever);
                                }}
                                disabled={booksForeverOwned || isPurchasingBooksForever}
                                className={`oku-shop-card-face ${shopPress.pressedId === 'books-forever' ? 'oku-shop-card-face--pressed' : ''} relative w-full min-h-[5.75rem] md:min-h-[7rem] rounded-3xl border-2 bg-white dark:bg-stone-800 px-4 md:px-5 py-1.5 text-left overflow-hidden flex items-center gap-2 md:gap-4 ${
                                    booksForeverOwned
                                        ? 'border-stone-200 dark:border-stone-700 opacity-60 cursor-default'
                                        : 'border-blue-300 dark:border-blue-700'
                                }`}
                            >
                                <img
                                    src="/assets/oku-shop/bookall.webp"
                                    alt=""
                                    className="w-20 h-20 md:w-24 md:h-24 object-contain shrink-0 -ml-2"
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base md:text-lg font-bold text-t-primary leading-tight">All Books Forever</h3>
                                    <p className="text-[13px] md:text-sm font-semibold text-t-secondary leading-tight mt-1">Every Book.</p>
                                    <p className="text-[13px] md:text-sm font-semibold text-t-secondary leading-tight mt-0.5">Every difficulty.</p>
                                    <p className="text-[13px] md:text-sm font-semibold text-t-secondary leading-tight mt-0.5">Forever.</p>
                                </div>
                                <span
                                    aria-live="polite"
                                    aria-busy={isPurchasingBooksForever}
                                    className={`shrink-0 self-start mt-2 min-w-[4.25rem] min-h-9 px-3.5 py-2 rounded-full text-sm font-bold whitespace-nowrap flex items-center justify-center ${
                                    booksForeverOwned
                                        ? 'bg-t-surface-sec text-t-secondary'
                                        : 'bg-blue-500 text-white'
                                }`}>
                                    {isPurchasingBooksForever ? (
                                        <span className="block w-5 h-5 rounded-full border-[2.5px] border-white/40 border-t-white animate-spin" aria-hidden="true" />
                                    ) : booksForeverOwned ? 'Owned' : booksForeverPrice}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={toggleBooksForeverInfo}
                                aria-label="How All Books Forever works"
                                aria-expanded={showBooksForeverInfo}
                                className="absolute right-3 bottom-2.5 z-20 w-5 h-5 rounded-full border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-300 flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <Icons.Info className="w-3.5 h-3.5" />
                            </button>

                            {showBooksForeverInfo && (
                                <div className="absolute right-0 top-full mt-2 w-52 pointer-events-none z-50">
                                    <div className={`origin-top ${isClosingBooksForeverInfo ? 'animate-tooltip-exit' : 'animate-tooltip-enter'}`}>
                                        <div className="bg-stone-800 text-white dark:bg-white dark:text-stone-900 text-[11px] p-3 rounded-xl shadow-xl font-medium leading-snug relative border border-stone-600/30">
                                            Unlocks every current and future Oku book across all difficulties. New books open when you complete the previous book, so your journey still unfolds in order.
                                            <div className="absolute bottom-full right-4 w-0 h-0 border-4 border-transparent border-b-stone-800 dark:border-b-white" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section aria-labelledby="packs-heading">
                        <div className="px-1 mb-3">
                            <h2 id="packs-heading" className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-widest">Diamond Packs</h2>
                            <p className="text-[13px] md:text-sm font-medium text-t-secondary mt-1">Use diamonds for skills, scenes, sounds, and more.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {diamondPacks.map((offer, index) => {
                                const isBestValue = index === diamondPacks.length - 1;
                                return (
                                    <div key={offer.id} className="oku-shop-card-shell rounded-3xl">
                                        <button
                                            onPointerDown={() => shopPress.beginPress(offer.id)}
                                            onPointerCancel={() => shopPress.cancelPress(offer.id)}
                                            onPointerLeave={() => shopPress.cancelPress(offer.id)}
                                            onClick={() => shopPress.runPressCycle(offer.id, () => handleBuyOffer(offer))}
                                            className={`oku-shop-card-face ${shopPress.pressedId === offer.id ? 'oku-shop-card-face--pressed' : ''} relative w-full h-full overflow-hidden bg-t-surface rounded-3xl p-3.5 min-h-[148px] flex flex-col items-center justify-between text-center border ${isBestValue ? 'border-blue-300 dark:border-blue-800' : 'border-stone-200/80 dark:border-stone-800'}`}
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
                                                {getPriceLabel(offer)}
                                            </span>
                                        </button>
                                    </div>
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
