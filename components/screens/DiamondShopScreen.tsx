import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { DIAMOND_OFFERS } from '../../utils/constants';
import { DiamondOffer } from '../../types';
import { Storage } from '../../utils/storage';
import { FishTank } from '../ui/FishTank';
import { DiamondBalancePill } from '../ui/DiamondBalancePill';
import { MainScreenHeader } from '../ui/MainScreenHeader';
import { DailyGiftBubble } from '../ui/DailyGiftBubble';
import { IAP } from '../../utils/iap';
import { useTactilePress } from '../../hooks/useTactilePress';
import { sounds } from '../../utils/sound';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface DiamondShopScreenProps {
    nextBonusClaimTime: number;
    dailyGiftNow: number;
    dailyGiftClaims?: number;
    onClaimBonus: (e: React.MouseEvent) => void;
    points: number;
    onBack: () => void;
    onOpenSettings?: () => void;
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
    const fishRef = useRef<HTMLDivElement>(null);
    const turnRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef({ x: 45, y: 48 });
    const [canAnimate, setCanAnimate] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;
        let inView = false;
        let nativeActive = true;
        let disposed = false;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => {
            if (!disposed) setCanAnimate(inView && nativeActive && !document.hidden && !reducedMotion.matches);
        };
        const observer = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            update();
        }, { threshold: 0.1 });
        observer.observe(containerRef.current);
        document.addEventListener('visibilitychange', update);
        reducedMotion.addEventListener('change', update);
        const nativeListener = Capacitor.isNativePlatform()
            ? CapacitorApp.addListener('appStateChange', ({ isActive }) => { nativeActive = isActive; update(); })
            : null;
        return () => {
            disposed = true;
            observer.disconnect();
            document.removeEventListener('visibilitychange', update);
            reducedMotion.removeEventListener('change', update);
            void nativeListener?.then(listener => listener.remove()).catch(() => {});
        };
    }, []);

    useEffect(() => {
        const fish = fishRef.current;
        const tank = containerRef.current;
        if (!canAnimate || !fish || !tank) return;
        let timer: ReturnType<typeof setTimeout>;
        let movement: Animation | undefined;
        const move = () => {
            const current = positionRef.current;
            // Match the owned Pepino's nearby roaming targets and quick turns.
            let step = (Math.random() - 0.5) * 42;
            if (Math.abs(step) < 10) step = step < 0 ? -10 : 10;
            const next = {
                x: Math.min(86, Math.max(14, current.x + step)),
                y: Math.min(84, Math.max(28, current.y + (Math.random() - 0.5) * 28)),
            };
            const duration = 3000 + Math.random() * 2200;
            const x = Math.max(6, Math.min(tank.clientWidth - fish.offsetWidth - 6, next.x / 100 * tank.clientWidth - fish.offsetWidth / 2));
            const y = next.y / 100 * tank.clientHeight - fish.offsetHeight / 2;
            const from = getComputedStyle(fish).transform;
            movement?.cancel();
            const to = `translate3d(${x}px, ${y}px, 0)`;
            fish.style.transform = to;
            movement = fish.animate([{ transform: from }, { transform: to }], { duration, easing: 'ease-in-out' });
            if (turnRef.current && Math.abs(next.x - current.x) > 2) {
                turnRef.current.style.transform = next.x > current.x ? 'scaleX(1)' : 'scaleX(-1)';
            }
            positionRef.current = next;
            timer = setTimeout(move, duration - 180);
        };
        move();
        return () => {
            clearTimeout(timer);
            // Freeze at the current position instead of finishing offscreen.
            fish.style.transform = getComputedStyle(fish).transform;
            movement?.cancel();
        };
    }, [canAnimate]);

    return (
        <div ref={containerRef} className="shop-aquarium" data-swimming={canAnimate} aria-hidden="true">
            <div className="shop-aquarium-light" />
            <div className="shop-aquarium-plant shop-aquarium-plant--left" />
            <div className="shop-aquarium-plant shop-aquarium-plant--right" />
            <div className="shop-aquarium-pebbles" />
            <div ref={fishRef} className="shop-aquarium-fish-route">
                <div ref={turnRef} className="shop-aquarium-fish-turn">
                    <div className="shop-aquarium-fish-drift">
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
        </div>
    );
};

export const DiamondShopScreen: React.FC<DiamondShopScreenProps> = ({
    nextBonusClaimTime,
    dailyGiftNow,
    dailyGiftClaims = 0,
    onClaimBonus,
    points,
    onBack,
    onOpenSettings,
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
            className="diamond-shop-screen shop-native flex-1 w-full flex flex-col items-center overflow-hidden relative"
            onClick={closeBooksForeverInfo}
        >
            {onOpenSettings ? <MainScreenHeader title="Oku Shop" points={points} onSettings={onOpenSettings} /> : <div className="w-full max-w-md md:max-w-[700px] flex items-center justify-between px-6 md:px-0 pt-4 md:pt-7 pb-4 relative shrink-0 z-20 mx-auto">
                <button onClick={onBack} aria-label="Back" className="p-2 md:p-2.5 rounded-full -ml-2 text-t-icon relative z-30 active:scale-90 transition-transform">
                    <Icons.Back className="w-6 h-6 md:w-7 md:h-7 text-t-icon" />
                </button>

                <div className="shop-navbar-title flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl md:text-2xl font-bold text-t-primary leading-none">Oku Shop</h1>
                </div>

                <DiamondBalancePill points={points} />
            </div>

            }
            <div data-navigation-scroll className="scroll-edge-fade flex-1 w-full overflow-y-auto px-6 md:px-0 pb-6 hide-scrollbar flex flex-col items-center relative z-10">
                <div className="w-full max-w-md md:max-w-[620px] pt-2 md:pt-4 mx-auto space-y-6 md:space-y-8">
                    {pepinoState.unlocked ? (
                        <FishTank onRewardClaim={handleRewardClaim} showIntro={shouldShowIntro()} />
                    ) : premiumOffer ? (
                        <section aria-labelledby="premium-heading">
                            <button
                                onPointerDown={() => shopPress.beginPress(premiumOffer.id)}
                                onPointerCancel={() => shopPress.cancelPress(premiumOffer.id)}
                                onPointerLeave={() => shopPress.cancelPress(premiumOffer.id)}
                                onClick={() => shopPress.runPressCycle(premiumOffer.id, () => handleBuyOffer(premiumOffer))}
                                className={`shop-premium-card oku-shop-card-face ${shopPress.pressedId === premiumOffer.id ? 'oku-shop-card-face--pressed' : ''}`}
                            >
                                <PremiumPepinoBackdrop />
                                <div className="shop-premium-copy">
                                    <span className="shop-premium-eyebrow">Oku Premium</span>
                                    <h2 id="premium-heading" className="text-xl md:text-2xl font-bold text-t-primary leading-tight">Meet Pepino</h2>
                                    <p className="text-[13px] font-medium text-t-secondary leading-snug">Your little Sudoku companion.</p>
                                    <div className="space-y-2 my-2">
                                        <FeatureRow icon={<Icons.Diamond className="w-3.5 h-3.5 fill-current" />}>
                                            {premiumOffer.diamonds.toLocaleString()} diamonds
                                        </FeatureRow>
                                        <FeatureRow icon={<Icons.Gift className="w-3.5 h-3.5" />}>
                                            A gift after every solved puzzle
                                        </FeatureRow>
                                    </div>
                                    <span className="shop-purchase-price shop-premium-price">
                                        <span>Unlock Pepino</span>
                                        <span>{getPriceLabel(premiumOffer)}</span>
                                    </span>
                                </div>
                                <p className="shop-premium-support text-t-secondary">
                                    Oku is made by one developer. Bringing Pepino home supports my work and helps Oku grow. Thank you! ♥
                                </p>
                            </button>
                        </section>
                    ) : null}

                    <DailyGiftBubble nextClaimTime={nextBonusClaimTime} now={dailyGiftNow} claims={dailyGiftClaims}
                        pressed={shopPress.pressedId === 'daily-gift'}
                        onPointerDown={() => shopPress.beginPress('daily-gift')}
                        onPointerCancel={() => shopPress.cancelPress('daily-gift')}
                        onPointerLeave={() => shopPress.cancelPress('daily-gift')}
                        onClick={(e) => {
                            e.stopPropagation();
                            shopPress.runPressCycle('daily-gift', () => onClaimBonus(e));
                        }} />

                    {starterOffer && (
                        <section className="shop-starter" aria-labelledby="starter-heading">
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
                                                        className="w-12 h-12 object-contain shrink-0 select-none pointer-events-none"
                                                        draggable={false}
                                                    />
                                                    <h2 id="starter-heading" className="text-lg md:text-xl font-bold text-t-primary">Starter Pack</h2>
                                                </div>
                                                <p className="text-[13px] md:text-sm font-medium text-t-secondary">Five rewards to get started.</p>
                                            </div>
                                            {!starterPackPurchased && (
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-1 rounded-full shrink-0">One time</span>
                                            )}
                                        </div>

                                        <div className="shop-reward-tray relative grid grid-cols-5 gap-1.5 md:gap-2">
                                            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 px-0.5 py-3 flex flex-col items-center justify-center gap-1.5 min-w-0">
                                                <div className="h-8 flex items-center justify-center">
                                                    <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                                                </div>
                                                <div className="text-center">
                                                    <span className="block text-[15px] font-bold text-t-primary leading-none">{starterOffer.diamonds}</span>
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

                    <section className="shop-books" aria-labelledby="books-heading">
                        <div className="px-1 mb-3">
                            <h2 id="books-heading" className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-widest">Book Collections</h2>
                            <p className="text-[13px] md:text-sm font-medium text-t-secondary mt-1">Open more puzzles across every difficulty.</p>
                        </div>

                        <div className="shop-book-group">
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

                        <div className={`oku-shop-card-shell rounded-3xl mt-3 ${showBooksForeverInfo ? 'z-50' : ''}`}>
                            <div
                                className={`oku-shop-card-face ${shopPress.pressedId === 'books-forever' ? 'oku-shop-card-face--pressed' : ''} relative w-full min-h-[5.75rem] md:min-h-[7rem] rounded-3xl border-2 bg-white dark:bg-stone-800 px-4 md:px-5 py-1.5 text-left overflow-hidden flex items-center gap-2 md:gap-4 ${
                                    booksForeverOwned
                                        ? 'border-stone-200 dark:border-stone-700 opacity-60 cursor-default'
                                        : 'border-blue-300 dark:border-blue-700'
                                }`}
                            >
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
                                aria-label={`All Books Forever, ${booksForeverOwned ? 'Owned' : isPurchasingBooksForever ? 'Purchasing' : booksForeverPrice}`}
                                className="absolute inset-0 z-10 rounded-2xl"
                            />
                                <img
                                    src="/assets/oku-shop/bookall.webp"
                                    alt=""
                                    className="w-20 h-20 md:w-24 md:h-24 object-contain shrink-0 -ml-2"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                    <h3 className="text-base md:text-lg font-bold text-t-primary leading-tight">All Books Forever</h3>
                                    <button
                                type="button"
                                onClick={toggleBooksForeverInfo}
                                aria-label="How All Books Forever works"
                                aria-expanded={showBooksForeverInfo}
                                aria-controls="books-forever-details"
                                className="shop-books-info relative z-20 shrink-0 w-6 h-6 rounded-full text-stone-500 dark:text-stone-300 flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <Icons.Info className="w-3.5 h-3.5" />
                            </button>
                                    </div>
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
                            </div>

                            {showBooksForeverInfo && (
                                <div id="books-forever-details" role="tooltip" className="absolute right-0 top-full mt-2 w-52 pointer-events-none z-50">
                                    <div className={`origin-top ${isClosingBooksForeverInfo ? 'animate-tooltip-exit' : 'animate-tooltip-enter'}`}>
                                        <div className="bg-stone-800 text-white dark:bg-white dark:text-stone-900 text-[11px] p-3 rounded-xl shadow-xl font-medium leading-snug relative border border-stone-600/30">
                                            Unlocks every current and future Oku book across all difficulties. New books open when you complete the previous book, so your journey still unfolds in order.
                                            <div className="absolute bottom-full right-4 w-0 h-0 border-4 border-transparent border-b-stone-800 dark:border-b-white" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>
                    </section>

                    <section className="shop-diamonds" aria-labelledby="packs-heading">
                        <div className="px-1 mb-3">
                            <h2 id="packs-heading" className="text-xs md:text-sm font-bold text-t-secondary uppercase tracking-widest">Diamond Packs</h2>
                            <p className="text-[13px] md:text-sm font-medium text-t-secondary mt-1">Use diamonds for skills, scenes, sounds, and more.</p>
                        </div>

                        <div className="shop-diamond-group">
                            {diamondPacks.map((offer, index) => {
                                const isBestValue = index === diamondPacks.length - 1;
                                return (
                                    <div key={offer.id} className="oku-shop-card-shell rounded-3xl">
                                        <button
                                            onPointerDown={() => shopPress.beginPress(offer.id)}
                                            onPointerCancel={() => shopPress.cancelPress(offer.id)}
                                            onPointerLeave={() => shopPress.cancelPress(offer.id)}
                                            onClick={() => shopPress.runPressCycle(offer.id, () => handleBuyOffer(offer))}
                                            className={`oku-shop-card-face ${shopPress.pressedId === offer.id ? 'oku-shop-card-face--pressed' : ''} shop-diamond-row relative w-full overflow-hidden bg-t-surface flex items-center justify-between text-left border ${isBestValue ? 'border-blue-300 dark:border-blue-800' : 'border-stone-200/80 dark:border-stone-800'}`}
                                        >
                                            {isBestValue && (
                                                <span className="shop-best-value absolute text-[8px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 rounded-full">Best value</span>
                                            )}
                                            <div className="relative flex items-center gap-1">
                                                <DiamondStack size={index + 1} />
                                                <span className="text-lg font-bold text-t-primary leading-none">{offer.diamonds.toLocaleString()}</span>
                                                <span className="sr-only">diamonds</span>
                                            </div>
                                            <span className="shop-purchase-price relative text-sm font-bold">
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
                        <p className="text-[11px] font-medium text-t-secondary mt-1">Purchases are handled securely by the App Store.</p>
                    </div>
                </div>
                <div className="h-safe-bottom w-full shrink-0" />
            </div>
        </div>
    );
};
