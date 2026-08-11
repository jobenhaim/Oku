import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AchievementItem, getOtherAchievements, getPackAchievements, getProfileTitle, getTitleAchievement, MAX_PROFILE_RANK } from '../../utils/achievements';
import { PROFILE_ACCOUNT_INTRO_KEY, Storage } from '../../utils/storage';
import { sounds } from '../../utils/sound';
import { DiamondBalancePill } from '../ui/DiamondBalancePill';
import { Icons } from '../ui/Icons';
import { Difficulty } from '../../types';
import { useTactilePress } from '../../hooks/useTactilePress';
import { AnimatePresence, motion } from 'framer-motion';
import { Auth, type OkuAuthProvider } from '../../utils/auth';
import type { User } from '@capacitor-firebase/authentication';

interface ProfileScreenProps {
    onClose: () => void;
    points: number;
    claimedRank: number;
    onTitleClaimed: (rank: number) => void;
    onClaimAchievement: (id: string, reward: number) => boolean;
    accountPreview?: { provider: OkuAuthProvider; name: string } | null;
}

export { MAX_PROFILE_RANK };

type ProfileStatBreakdown = 'games' | 'diamonds' | null;
type AchievementCategory = 'journey' | 'skills' | 'pepino' | 'collection' | 'books' | 'all';
type AuthAction = OkuAuthProvider | 'sign-out' | null;

const GoogleMark: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.36l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.77-5.61-4.14H3.04v2.62A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.54l3.35-2.62Z" />
        <path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.94 12 5.94Z" />
    </svg>
);

const getAccountProvider = (user: User): 'apple' | 'google' | 'oku' => {
    const providerIds = user.providerData.map((provider) => provider.providerId);
    if (providerIds.includes('apple.com')) return 'apple';
    if (providerIds.includes('google.com')) return 'google';
    return 'oku';
};

const ACHIEVEMENT_CATEGORIES: Array<{ id: AchievementCategory; label: string }> = [
    { id: 'journey', label: 'Journey' },
    { id: 'skills', label: 'Skills' },
    { id: 'pepino', label: 'Pepino' },
    { id: 'collection', label: 'Market' },
    { id: 'books', label: 'Books' },
    { id: 'all', label: 'All' },
];

const DIAMOND_SOURCE_LABELS: Record<string, string> = {
    welcomeGift: 'Welcome gift',
    dailyGifts: 'Daily gifts',
    sudoku: 'Puzzle rewards',
    pepino: 'Pepino gifts',
    achievements: 'Achievements',
    purchases: 'Oku Shop',
    coupons: 'Coupons',
    other: 'Other rewards',
};

export const getStoredClaimedProfileRank = (totalGamesWon: number) => {
    const earnedRank = Math.min(MAX_PROFILE_RANK, Math.floor(Math.max(0, totalGamesWon) / 20));

    try {
        const stored = localStorage.getItem('zen_profile');
        if (!stored) return earnedRank;
        const parsed = JSON.parse(stored);
        const storedRank = typeof parsed.claimedRank === 'number'
            ? parsed.claimedRank
            : typeof parsed.lastSeenRank === 'number'
                ? parsed.lastSeenRank
                : earnedRank;
        return Math.min(earnedRank, Math.max(0, Math.floor(storedRank)));
    } catch {
        return earnedRank;
    }
};

const AchievementRow: React.FC<{
    achievement: AchievementItem;
    onClaim: (achievement: AchievementItem) => void;
    isEntering?: boolean;
}> = ({ achievement, onClaim, isEntering = false }) => {
    const progress = Math.min(100, (achievement.current / achievement.target) * 100);
    const showProgress = achievement.showProgress !== false && achievement.target > 1 && !achievement.claimed;
    const [isClaiming, setIsClaiming] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const claimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pointerOriginExpiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressStartedAt = useRef(0);
    const pressedWithPointer = useRef(false);
    const pointerOrigin = useRef(false);
    const interactionLockedRef = useRef(false);

    useEffect(() => () => {
        if (claimTimer.current) clearTimeout(claimTimer.current);
        if (releaseTimer.current) clearTimeout(releaseTimer.current);
        if (completionTimer.current) clearTimeout(completionTimer.current);
        if (pointerOriginExpiryTimer.current) clearTimeout(pointerOriginExpiryTimer.current);
    }, []);

    const handlePointerDown = () => {
        if (!achievement.ready || interactionLockedRef.current) return;
        if (pointerOriginExpiryTimer.current) {
            clearTimeout(pointerOriginExpiryTimer.current);
            pointerOriginExpiryTimer.current = null;
        }
        pointerOrigin.current = true;
        pressedWithPointer.current = true;
        pressStartedAt.current = performance.now();
        setIsPressed(true);
    };

    const cancelPointerPress = () => {
        if (interactionLockedRef.current || !pressedWithPointer.current) return;
        pressedWithPointer.current = false;
        setIsPressed(false);
        pointerOriginExpiryTimer.current = setTimeout(() => {
            pointerOrigin.current = false;
            pointerOriginExpiryTimer.current = null;
        }, 750);
    };

    const handleClick = () => {
        if (!achievement.ready || interactionLockedRef.current) return;
        interactionLockedRef.current = true;

        const startedWithPointer = pointerOrigin.current;
        const elapsedPressTime = startedWithPointer
            ? performance.now() - pressStartedAt.current
            : 0;
        const releaseDelay = startedWithPointer
            ? Math.max(0, 50 - elapsedPressTime)
            : 50;

        sounds.playSelectionHaptic();
        pointerOrigin.current = false;
        if (pointerOriginExpiryTimer.current) {
            clearTimeout(pointerOriginExpiryTimer.current);
            pointerOriginExpiryTimer.current = null;
        }
        setIsClaiming(true);
        if (!startedWithPointer) setIsPressed(true);

        releaseTimer.current = setTimeout(() => {
            pressedWithPointer.current = false;
            setIsPressed(false);
            releaseTimer.current = null;
        }, releaseDelay);

        claimTimer.current = setTimeout(() => {
            setIsCompleting(true);
            onClaim(achievement);
            setIsClaiming(false);
            claimTimer.current = null;
            completionTimer.current = setTimeout(() => {
                setIsCompleting(false);
                interactionLockedRef.current = false;
                completionTimer.current = null;
            }, 650);
        }, releaseDelay + 50);
    };

    return (
        <div className={`oku-achievement-row-shell rounded-[1.25rem] ${
            achievement.ready || isCompleting ? 'oku-achievement-tactile-shell' : ''
        } ${
            isCompleting ? 'oku-achievement-completing-shell' : ''
        } ${isEntering ? 'achievement-milestone-enter' : ''}`}>
            <button
                type="button"
                onPointerDown={handlePointerDown}
                onPointerCancel={cancelPointerPress}
                onPointerLeave={cancelPointerPress}
                onClick={handleClick}
                disabled={!achievement.ready || isClaiming}
                className={`relative block w-full h-full px-4 md:px-5 py-3 md:py-4 text-left rounded-[1.25rem] ${achievement.ready ? 'border-2' : 'border'} overflow-hidden focus:outline-none transition-colors duration-[650ms] ease-in-out ${
                    achievement.claimed
                        ? 'bg-stone-100/90 dark:bg-stone-900/70 border-stone-200/60 dark:border-stone-800/70 shadow-none'
                        : achievement.ready
                            ? 'oku-achievement-tactile bg-blue-50/50 dark:bg-blue-950/20 border-blue-400 dark:border-blue-500'
                            : 'bg-t-surface border-stone-200/80 dark:border-stone-800 shadow-sm'
                } ${isPressed ? 'oku-achievement-tactile--pressed' : ''}`}
            >
                {achievement.ready && (
                    <span
                        aria-label="Ready to claim"
                        className="absolute top-2.5 md:top-3.5 right-2.5 md:right-3.5 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                    />
                )}
                <div className="flex items-center gap-3 md:gap-4 h-full">
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <span className={`text-[15px] md:text-[18px] font-bold leading-tight truncate transition-colors duration-[650ms] ease-in-out ${achievement.claimed ? 'text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-white'}`}>
                                {achievement.title}
                            </span>
                            {achievement.claimed && (
                                <span className="achievement-claimed-mark-enter w-4 h-4 rounded-full bg-stone-300 dark:bg-stone-700 flex items-center justify-center shrink-0">
                                    <Icons.Check className="w-2.5 h-2.5 text-white" />
                                </span>
                            )}
                        </div>
                        <span className="block text-[11px] md:text-[13px] font-medium text-stone-500 dark:text-stone-400 mt-1 leading-tight">
                            {achievement.detail}
                        </span>

                        {showProgress && (
                            <div className="h-2 md:h-2.5 mt-2 md:mt-2.5 flex items-center gap-2.5 md:gap-3">
                                <div className="h-2 md:h-2.5 flex-1 rounded-full bg-stone-100 dark:bg-stone-700 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-[width] duration-700 ease-in-out ${achievement.ready ? 'bg-emerald-400 dark:bg-emerald-400' : 'bg-emerald-300 dark:bg-emerald-500/70'}`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <span className="text-[10px] md:text-[12px] font-bold text-stone-500 dark:text-stone-400 tabular-nums shrink-0">
                                    {Math.min(achievement.current, achievement.target)}/{achievement.target}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className={`min-w-[4.25rem] md:min-w-[5.5rem] h-10 md:h-12 px-3 md:px-4 rounded-full flex items-center justify-center gap-1.5 md:gap-2 shrink-0 bg-white dark:bg-white border transition-colors duration-[650ms] ease-in-out ${
                        achievement.claimed ? 'border-stone-300' : 'border-stone-800'
                    }`}>
                        <span className={`text-sm md:text-base font-bold tabular-nums transition-colors duration-[650ms] ease-in-out ${
                            achievement.claimed ? 'text-stone-400' : 'text-stone-900'
                        }`}>
                            {achievement.reward}
                        </span>
                        <Icons.Diamond className={`w-3.5 h-3.5 md:w-4 md:h-4 fill-current transition-colors duration-[650ms] ease-in-out ${
                            achievement.claimed ? 'text-stone-400' : 'text-blue-500'
                        }`} />
                    </div>
                </div>
            </button>
        </div>
    );
};

const AchievementList: React.FC<{
    achievements: AchievementItem[];
    onClaim: (achievement: AchievementItem) => void;
    enteringAchievementIds: Set<string>;
    emptyTitle: string;
    emptyDetail: string;
}> = ({ achievements, onClaim, enteringAchievementIds, emptyTitle, emptyDetail }) => (
    achievements.length > 0 ? (
        <div className="flex flex-col gap-2.5 md:gap-3.5 animate-fade-in-fast">
            {achievements.map((achievement) => (
                <motion.div
                    key={achievement.id}
                    layout="position"
                    transition={{ layout: { type: 'spring', stiffness: 360, damping: 32, mass: 0.65 } }}
                >
                    <AchievementRow
                        achievement={achievement}
                        onClaim={onClaim}
                        isEntering={enteringAchievementIds.has(achievement.id)}
                    />
                </motion.div>
            ))}
        </div>
    ) : (
        <div className="animate-fade-in-fast rounded-[1.25rem] border border-stone-200/80 dark:border-stone-800 bg-white/75 dark:bg-stone-900/75 px-5 md:px-7 py-7 md:py-9 text-center">
            <Icons.Check className="w-7 h-7 md:w-8 md:h-8 mx-auto text-emerald-400 mb-2" />
            <span className="block text-sm md:text-base font-bold text-stone-800 dark:text-stone-100">{emptyTitle}</span>
            <span className="block mt-1 text-[11px] md:text-[13px] font-medium text-stone-500 dark:text-stone-400">{emptyDetail}</span>
        </div>
    )
);

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
    onClose,
    points,
    claimedRank,
    onTitleClaimed,
    onClaimAchievement,
    accountPreview = null,
}) => {
    const [storedData, setStoredData] = useState(() => Storage.getStoredData());
    const [activeAchievementCategory, setActiveAchievementCategory] = useState<AchievementCategory>(() => {
        const title = getTitleAchievement(storedData, claimedRank);
        const achievements = getOtherAchievements(storedData);
        const firstReadyCategory = ACHIEVEMENT_CATEGORIES.find((category) => {
            if (category.id === 'all') return false;
            if (category.id === 'journey' && title.ready) return true;
            if (category.id === 'books') return getPackAchievements(storedData).some((achievement) => achievement.ready);
            return achievements.some((achievement) => achievement.category === category.id && achievement.ready);
        });
        return firstReadyCategory?.id ?? 'journey';
    });
    const [achievementCategoryDirection, setAchievementCategoryDirection] = useState(0);
    const [isEditingName, setIsEditingName] = useState(false);
    const [hideCompleted, setHideCompleted] = useState(false);
    const [expandedStat, setExpandedStat] = useState<ProfileStatBreakdown>(null);
    const [visibleStatBreakdown, setVisibleStatBreakdown] = useState<Exclude<ProfileStatBreakdown, null>>('games');
    const [enteringAchievementIds, setEnteringAchievementIds] = useState<Set<string>>(() => new Set());
    const [achievementScrollSpacerHeight, setAchievementScrollSpacerHeight] = useState(0);
    const [authUser, setAuthUser] = useState<User | null>(() => Auth.getUser());
    const [authLoading, setAuthLoading] = useState(() => !accountPreview);
    const [authAction, setAuthAction] = useState<AuthAction>(null);
    const [authMessage, setAuthMessage] = useState<string | null>(null);
    const [showAccountIntro, setShowAccountIntro] = useState(false);
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
    const statSwitchTimer = useRef<number | null>(null);
    const achievementEntranceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileScrollRef = useRef<HTMLElement | null>(null);
    const achievementScrollFrame = useRef<number | null>(null);
    const pendingAchievementScroll = useRef<{
        category: AchievementCategory;
        spacerHeight: number;
        scrollTop: number;
    } | null>(null);
    const statPress = useTactilePress<'games' | 'diamonds'>();
    const [profile, setProfile] = useState(() => {
        try {
            const stored = localStorage.getItem('zen_profile');
            const parsed = stored ? JSON.parse(stored) : {};
            return {
                ...parsed,
                username: parsed.username || 'Zen Player',
                hasEditedName: parsed.hasEditedName ?? Boolean(parsed.username && parsed.username !== 'Zen Player'),
                claimedRank,
                lastSeenRank: claimedRank,
            };
        } catch {
            return { username: 'Zen Player', hasEditedName: false, claimedRank, lastSeenRank: claimedRank };
        }
    });

    useEffect(() => {
        localStorage.setItem('zen_profile', JSON.stringify(profile));
    }, [profile]);

    useEffect(() => {
        if (accountPreview) {
            setAuthLoading(false);
            return;
        }

        let mounted = true;
        const unsubscribe = Auth.subscribe((user) => {
            if (mounted) setAuthUser(user);
        });

        Auth.initialize().finally(() => {
            if (mounted) setAuthLoading(false);
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [accountPreview]);

    useEffect(() => {
        if (accountPreview) {
            setShowAccountIntro(false);
            return;
        }

        if (authLoading) return;

        if (authUser) {
            localStorage.setItem(PROFILE_ACCOUNT_INTRO_KEY, '1');
            setShowAccountIntro(false);
            return;
        }

        setShowAccountIntro(localStorage.getItem(PROFILE_ACCOUNT_INTRO_KEY) !== '1');
    }, [accountPreview, authLoading, authUser]);

    useEffect(() => () => {
        if (statSwitchTimer.current) window.clearTimeout(statSwitchTimer.current);
        if (achievementEntranceTimer.current) clearTimeout(achievementEntranceTimer.current);
        if (achievementScrollFrame.current) window.cancelAnimationFrame(achievementScrollFrame.current);
    }, []);

    const currentTitle = getProfileTitle(claimedRank);
    const hasAccountCard = Boolean(authUser || accountPreview);
    const accountProvider = authUser ? getAccountProvider(authUser) : accountPreview?.provider ?? null;
    const accountName = authUser
        ? authUser.displayName?.trim() || profile.username?.trim() || 'Oku player'
        : accountPreview?.name ?? null;
    const titleAchievement = useMemo(() => getTitleAchievement(storedData, claimedRank), [storedData, claimedRank]);
    const packAchievements = useMemo(() => getPackAchievements(storedData), [storedData]);
    const otherAchievements = useMemo(() => getOtherAchievements(storedData), [storedData]);
    const journeyAchievements = otherAchievements.filter((achievement) => achievement.category === 'journey');
    const collectionAchievements = otherAchievements.filter((achievement) => achievement.category === 'collection');
    const skillAchievements = otherAchievements.filter((achievement) => achievement.category === 'skills');
    const pepinoAchievements = otherAchievements.filter((achievement) => achievement.category === 'pepino');
    const allAchievements = [
        titleAchievement,
        ...journeyAchievements,
        ...skillAchievements,
        ...pepinoAchievements,
        ...collectionAchievements,
        ...packAchievements,
    ];
    const achievementsByCategory: Record<AchievementCategory, AchievementItem[]> = {
        journey: [titleAchievement, ...journeyAchievements],
        skills: skillAchievements,
        pepino: pepinoAchievements,
        collection: collectionAchievements,
        books: packAchievements,
        all: allAchievements,
    };
    const activeCategoryAchievements = achievementsByCategory[activeAchievementCategory];
    const filteredAchievements = !hideCompleted
        ? activeCategoryAchievements
        : activeCategoryAchievements.filter((achievement) => !achievement.claimed);
    const visibleAchievements = [...filteredAchievements].sort(
        (first, second) => Number(first.claimed) - Number(second.claimed)
    );
    const categoryHasReadyAchievement = (category: AchievementCategory) =>
        achievementsByCategory[category].some((achievement) => achievement.ready);
    const achievementContentVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.95,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: {
                x: { type: 'spring', stiffness: 200, damping: 25 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
            },
        },
        exit: (direction: number) => ({
            x: direction > 0 ? '-100%' : '100%',
            opacity: 0,
            scale: 0.95,
            position: 'absolute' as const,
            inset: 0,
            width: '100%',
            transition: {
                x: { type: 'spring', stiffness: 200, damping: 25 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
            },
        }),
    };

    useLayoutEffect(() => {
        const pending = pendingAchievementScroll.current;
        const scroller = profileScrollRef.current;
        if (!pending || pending.category !== activeAchievementCategory || !scroller) return;

        // React replaces the filtered cards before the first animation frame. Restore the
        // captured position during layout so the browser cannot visibly clamp it first.
        scroller.scrollTop = pending.scrollTop;

        achievementScrollFrame.current = window.requestAnimationFrame(() => {
            const naturalScrollHeight = Math.max(scroller.clientHeight, scroller.scrollHeight - pending.spacerHeight);
            const nextMaximumScroll = Math.max(0, naturalScrollHeight - scroller.clientHeight);
            const targetScrollTop = Math.min(pending.scrollTop, nextMaximumScroll);
            const startScrollTop = scroller.scrollTop;
            const distance = targetScrollTop - startScrollTop;

            const finish = () => {
                setAchievementScrollSpacerHeight(0);
                pendingAchievementScroll.current = null;
                achievementScrollFrame.current = null;
            };

            if (Math.abs(distance) < 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                scroller.scrollTop = targetScrollTop;
                finish();
                return;
            }

            const startedAt = performance.now();
            const duration = 300;
            const animateScroll = (time: number) => {
                const progress = Math.min(1, (time - startedAt) / duration);
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                scroller.scrollTop = startScrollTop + distance * easedProgress;

                if (progress < 1) {
                    achievementScrollFrame.current = window.requestAnimationFrame(animateScroll);
                } else {
                    finish();
                }
            };

            achievementScrollFrame.current = window.requestAnimationFrame(animateScroll);
        });
    }, [activeAchievementCategory]);

    const selectAchievementCategory = (category: AchievementCategory) => {
        if (category === activeAchievementCategory) return;

        if (achievementScrollFrame.current) {
            window.cancelAnimationFrame(achievementScrollFrame.current);
            achievementScrollFrame.current = null;
        }

        const scroller = profileScrollRef.current;
        if (scroller) {
            const spacerHeight = Math.max(
                scroller.clientHeight,
                scroller.scrollHeight - achievementScrollSpacerHeight,
            );
            setAchievementScrollSpacerHeight(spacerHeight);
            pendingAchievementScroll.current = {
                category,
                spacerHeight,
                scrollTop: scroller.scrollTop,
            };
        }

        sounds.playClick();
        const currentIndex = ACHIEVEMENT_CATEGORIES.findIndex((item) => item.id === activeAchievementCategory);
        const nextIndex = ACHIEVEMENT_CATEGORIES.findIndex((item) => item.id === category);
        setAchievementCategoryDirection(nextIndex > currentIndex ? 1 : -1);
        setActiveAchievementCategory(category);
    };
    const gamesWonBreakdown = useMemo(() => {
        const breakdown = storedData.stats?.gamesWonByDifficulty || {};
        return [
            ...Object.values(Difficulty).map((difficulty) => ({ label: difficulty, value: breakdown[difficulty] || 0 })),
        ].filter((item) => item.value > 0);
    }, [storedData]);
    const diamondBreakdown = useMemo(() => {
        const breakdown = storedData.stats?.diamondsEarnedBySource || {};
        const order = ['welcomeGift', 'dailyGifts', 'sudoku', 'pepino', 'achievements', 'purchases', 'coupons', 'other'];
        return order
            .map((source) => ({ label: DIAMOND_SOURCE_LABELS[source], value: breakdown[source] || 0 }))
            .filter((item) => item.value > 0);
    }, [storedData]);

    const toggleStat = (stat: Exclude<ProfileStatBreakdown, null>, hasItems: boolean) => {
        if (!hasItems) return;
        sounds.playClick();

        if (statSwitchTimer.current) {
            window.clearTimeout(statSwitchTimer.current);
            statSwitchTimer.current = null;
        }

        if (expandedStat === stat) {
            setExpandedStat(null);
            return;
        }

        if (expandedStat) {
            setExpandedStat(null);
            statSwitchTimer.current = window.setTimeout(() => {
                setVisibleStatBreakdown(stat);
                setExpandedStat(stat);
                statSwitchTimer.current = null;
            }, 150);
            return;
        }

        setVisibleStatBreakdown(stat);
        setExpandedStat(stat);
    };

    const handleClaim = (achievement: AchievementItem) => {
        if (!achievement.ready) return;
        const previousIds = new Set([
            titleAchievement.id,
            ...packAchievements.map((item) => item.id),
            ...otherAchievements.map((item) => item.id),
        ]);
        if (!onClaimAchievement(achievement.id, achievement.reward)) return;

        sounds.playUniversalGiftClaim();
        const nextClaimedRank = achievement.onClaimTitleRank ?? claimedRank;
        if (achievement.onClaimTitleRank !== undefined) {
            const newRank = achievement.onClaimTitleRank;
            setProfile((current: typeof profile) => ({ ...current, claimedRank: newRank, lastSeenRank: newRank }));
            onTitleClaimed(newRank);
        }
        const freshData = Storage.getStoredData();
        const nextAchievements = [
            getTitleAchievement(freshData, nextClaimedRank),
            ...getPackAchievements(freshData),
            ...getOtherAchievements(freshData),
        ];
        const newIds = new Set(
            nextAchievements
                .map((item) => item.id)
                .filter((id) => !previousIds.has(id))
        );

        setStoredData(freshData);
        if (achievementEntranceTimer.current) clearTimeout(achievementEntranceTimer.current);
        setEnteringAchievementIds(newIds);
        achievementEntranceTimer.current = setTimeout(() => {
            setEnteringAchievementIds(new Set());
            achievementEntranceTimer.current = null;
        }, 700);
    };

    const handleSignIn = async (provider: OkuAuthProvider) => {
        if (authAction) return;
        sounds.playClick();
        setAuthAction(provider);
        setAuthMessage(null);

        const result = await Auth.signIn(provider);
        if (result.status === 'signed-in') {
            setStoredData(Storage.getStoredData());
            setAuthMessage(result.cloudSynced
                ? null
                : 'Your progress will sync when you are online.');
        } else if (result.status === 'failed') {
            setAuthMessage(result.message);
        }

        setAuthAction(null);
    };

    const handleSignOut = async () => {
        if (authAction) return;
        sounds.playClick();
        setAuthAction('sign-out');
        setAuthMessage(null);

        const result = await Auth.signOut();
        if (result.status === 'signed-out') {
            setStoredData(Storage.getStoredData());
            setAuthMessage('Signed out. Your guest progress is back.');
        } else if (result.status === 'failed') {
            setAuthMessage(result.message);
        }

        setAuthAction(null);
    };

    return (
        <div className="w-full h-full bg-transparent flex flex-col font-sans text-t-primary">
            <header className="w-full max-w-md md:max-w-[700px] mx-auto flex items-center justify-between px-6 md:px-0 pt-4 md:pt-7 pb-4 relative shrink-0 z-20">
                <button onClick={onClose} aria-label="Back to menu" className="p-2 md:p-2.5 rounded-full -ml-2 text-t-icon active:scale-95 transition-transform relative z-30">
                    <Icons.Back className="w-6 h-6 md:w-7 md:h-7 text-t-icon" />
                </button>

                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl md:text-2xl font-bold text-t-primary leading-none">Profile</h1>
                </div>

                <DiamondBalancePill points={points} />
            </header>

            <main ref={profileScrollRef} className="achievement-scroll-container scroll-edge-fade flex-1 overflow-y-auto hide-scrollbar px-6 md:px-0 pb-8">
                <div className="w-full max-w-md md:max-w-[620px] mx-auto space-y-6 md:space-y-8">
                    <section className="flex flex-col items-center text-center pt-3 md:pt-5">
                        {!profile.hasEditedName && !isEditingName && (
                            <span className="text-[9px] font-bold text-stone-400 dark:text-stone-500 tracking-[0.18em] mb-1.5">TAP TO EDIT</span>
                        )}
                        {isEditingName ? (
                            <input
                                autoFocus
                                value={profile.username}
                                onChange={(event) => setProfile({ ...profile, username: event.target.value, hasEditedName: true })}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={(event) => event.key === 'Enter' && setIsEditingName(false)}
                                maxLength={20}
                                className="text-3xl md:text-4xl font-bold bg-transparent border-b border-stone-300 dark:border-stone-600 text-center focus:outline-none w-full"
                            />
                        ) : (
                            <button type="button" onClick={() => { sounds.playClick(); setIsEditingName(true); }} className="max-w-full text-3xl md:text-4xl font-bold leading-tight truncate active:scale-[0.98] transition-transform">
                                {profile.username || 'Anonymous'}
                            </button>
                        )}
                        <span className="mt-3 md:mt-4 px-4 md:px-5 py-2 md:py-2.5 rounded-full bg-white dark:bg-white border border-stone-800 dark:border-stone-800 text-sm md:text-base font-bold text-blue-700 dark:text-blue-700">
                            {currentTitle}
                        </span>
                    </section>

                    <section className="space-y-2.5 md:space-y-3">
                        <div className="flex items-end justify-between px-1 gap-4">
                            <div>
                                <span className="block text-[10px] md:text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-[0.16em]">Account</span>
                                {!hasAccountCard && !authLoading && (
                                    <span className="block mt-1 text-[12px] md:text-sm font-medium text-stone-600 dark:text-stone-300">
                                        Save your progress. Continue with:
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className={`rounded-[1.4rem] border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm ${hasAccountCard ? 'px-4 py-2.5 md:px-5 md:py-3' : 'p-4 md:p-5'}`}>
                            {authLoading && !accountPreview ? (
                                <div className="h-12 flex items-center justify-center text-xs md:text-sm font-semibold text-stone-400">
                                    Checking account…
                                </div>
                            ) : hasAccountCard ? (
                                <div className="flex items-center gap-3.5 md:gap-4">
                                    <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm ${accountProvider === 'apple'
                                        ? 'bg-black text-white'
                                        : 'bg-white border border-stone-200 dark:border-stone-700'
                                        }`}>
                                        {accountProvider === 'apple' ? (
                                            <span className="text-[26px] md:text-[28px] leading-none -mt-0.5" aria-label="Apple account"></span>
                                        ) : accountProvider === 'google' ? (
                                            <GoogleMark className="w-6 h-6 md:w-7 md:h-7" />
                                        ) : (
                                            <span className="text-lg md:text-xl font-bold text-blue-500" aria-label="Oku account">O</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[16px] md:text-lg font-bold text-t-primary truncate">
                                            Welcome, {accountName}.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (accountPreview) return;
                                            sounds.playClick();
                                            setShowSignOutConfirm(true);
                                        }}
                                        disabled={authAction !== null}
                                        className="px-1.5 py-2 text-[10px] md:text-xs font-semibold text-stone-400 dark:text-stone-500 active:scale-95 transition-transform disabled:opacity-50"
                                    >
                                        {authAction === 'sign-out' ? 'Signing out…' : 'Sign out'}
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                                    <button
                                        type="button"
                                        aria-label="Continue with Apple"
                                        onClick={() => handleSignIn('apple')}
                                        disabled={authAction !== null}
                                        className="h-12 md:h-13 px-3 rounded-xl bg-black text-white flex items-center justify-center gap-2 text-xs md:text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-55"
                                    >
                                        <span className="text-[22px] md:text-2xl leading-none -mt-0.5" aria-hidden="true"></span>
                                        <span>{authAction === 'apple' ? 'Connecting…' : 'Apple'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Continue with Google"
                                        onClick={() => handleSignIn('google')}
                                        disabled={authAction !== null}
                                        className="h-12 md:h-13 px-3 rounded-xl bg-white text-stone-800 border border-stone-300 flex items-center justify-center gap-2 text-xs md:text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-55"
                                    >
                                        <GoogleMark className="w-[18px] h-[18px] md:w-5 md:h-5 shrink-0" />
                                        <span>{authAction === 'google' ? 'Connecting…' : 'Google'}</span>
                                    </button>
                                </div>
                            )}

                            {authMessage && (
                                <p className="mt-3 text-center text-[10px] md:text-xs font-medium text-stone-500 dark:text-stone-400 animate-fade-in-fast">
                                    {authMessage}
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                            <div className="oku-profile-stat-shell rounded-[1.4rem]">
                                <button
                                    type="button"
                                    onPointerDown={() => gamesWonBreakdown.length > 0 && statPress.beginPress('games')}
                                    onPointerCancel={() => statPress.cancelPress('games')}
                                    onPointerLeave={() => statPress.cancelPress('games')}
                                    onClick={() => gamesWonBreakdown.length > 0 && statPress.runPressCycle('games', () => toggleStat('games', true))}
                                    aria-expanded={expandedStat === 'games'}
                                    className={`oku-profile-stat-card ${statPress.pressedId === 'games' ? 'oku-profile-stat-card--pressed' : ''} relative w-full min-h-[112px] md:min-h-[140px] overflow-hidden rounded-[1.4rem] border p-4 md:p-5 text-left bg-white dark:bg-stone-900 ${expandedStat === 'games' ? 'border-amber-300 dark:border-amber-700' : 'border-stone-200/80 dark:border-stone-800'}`}
                                >
                                    <Icons.Trophy className="absolute -right-10 -bottom-16 w-48 h-48 opacity-[0.105] pointer-events-none" />
                                    {gamesWonBreakdown.length > 0 && (
                                        <span className="absolute z-20 right-4 md:right-5 top-4 md:top-5 w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-50 flex items-center justify-center border border-stone-100 dark:border-stone-700">
                                            <Icons.Down className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-200 ${expandedStat === 'games' ? 'rotate-180' : ''}`} />
                                        </span>
                                    )}
                                    <div className="relative z-10 mt-5 md:mt-7">
                                        <span className="block text-[2.15rem] md:text-[2.6rem] font-bold tracking-[0.035em] tabular-nums leading-none text-stone-900 dark:text-stone-50">
                                            {storedData.stats?.totalGamesWon || 0}
                                        </span>
                                        <span className="block mt-1.5 md:mt-2 text-[11px] md:text-[13px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.13em]">Games Won</span>
                                    </div>
                                </button>
                            </div>
                            <div className="oku-profile-stat-shell rounded-[1.4rem]">
                                <button
                                    type="button"
                                    onPointerDown={() => diamondBreakdown.length > 0 && statPress.beginPress('diamonds')}
                                    onPointerCancel={() => statPress.cancelPress('diamonds')}
                                    onPointerLeave={() => statPress.cancelPress('diamonds')}
                                    onClick={() => diamondBreakdown.length > 0 && statPress.runPressCycle('diamonds', () => toggleStat('diamonds', true))}
                                    aria-expanded={expandedStat === 'diamonds'}
                                    className={`oku-profile-stat-card ${statPress.pressedId === 'diamonds' ? 'oku-profile-stat-card--pressed' : ''} relative w-full min-h-[112px] md:min-h-[140px] overflow-hidden rounded-[1.4rem] border p-4 md:p-5 text-left bg-white dark:bg-stone-900 ${expandedStat === 'diamonds' ? 'border-blue-300 dark:border-blue-700' : 'border-stone-200/80 dark:border-stone-800'}`}
                                >
                                    <Icons.Diamond className="absolute -right-8 -bottom-12 w-40 h-40 text-blue-500 fill-current opacity-[0.095] pointer-events-none" />
                                    {diamondBreakdown.length > 0 && (
                                        <span className="absolute z-20 right-4 md:right-5 top-4 md:top-5 w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-50 flex items-center justify-center border border-stone-100 dark:border-stone-700">
                                            <Icons.Down className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-200 ${expandedStat === 'diamonds' ? 'rotate-180' : ''}`} />
                                        </span>
                                    )}
                                    <div className="relative z-10 mt-5 md:mt-7">
                                        <span className="block text-[2.15rem] md:text-[2.6rem] font-bold tracking-[0.035em] tabular-nums leading-none text-stone-900 dark:text-stone-50">
                                            {storedData.stats?.totalDiamondsEarned || 0}
                                        </span>
                                        <span className="block mt-1.5 md:mt-2 text-[11px] md:text-[13px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.13em]">Diamonds Earned</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div
                            className={`grid transition-[grid-template-rows,opacity] duration-150 ease-in-out ${expandedStat ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
                            aria-hidden={!expandedStat}
                        >
                            <div className="overflow-hidden">
                                <div className="rounded-[1.25rem] border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm">
                                    <div className="px-4 md:px-5 py-3.5 md:py-4 space-y-3 md:space-y-3.5">
                                        {(visibleStatBreakdown === 'games' ? gamesWonBreakdown : diamondBreakdown).map((item) => (
                                            <div key={item.label} className="flex items-center justify-between text-sm md:text-base font-semibold">
                                                <span className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${visibleStatBreakdown === 'games' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                                                    {item.label}
                                                </span>
                                                <span className="min-w-10 px-2.5 py-1.5 rounded-full bg-stone-50 dark:bg-stone-800 text-center text-t-primary font-bold tabular-nums inline-flex items-center justify-center gap-1.5">
                                                    {item.value}
                                                    {visibleStatBreakdown === 'diamonds' && <Icons.Diamond className="w-2.5 h-2.5 text-blue-500 fill-current" />}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div>
                        <div className="flex items-center justify-between mb-3 px-1 gap-3">
                            <h2 className="text-2xl md:text-3xl font-bold">Achievements</h2>
                            <div className="flex items-center gap-2.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => { sounds.playClick(); setHideCompleted((current) => !current); }}
                                    aria-pressed={hideCompleted}
                                    className="h-8 md:h-10 pl-2.5 md:pl-3.5 pr-2 md:pr-2.5 rounded-full bg-t-surface border border-stone-200/80 dark:border-stone-800 shadow-sm flex items-center gap-2 md:gap-2.5 active:scale-95 transition-transform"
                                >
                                    <span className="text-[9px] md:text-[11px] font-bold text-stone-600 dark:text-stone-300 whitespace-nowrap">Hide completed</span>
                                    <span className={`inline-block w-7 h-4 rounded-full p-0.5 transition-colors duration-200 ${hideCompleted ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                                        <span className={`block w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${hideCompleted ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div
                            role="tablist"
                            aria-label="Achievement categories"
                            className="oku-segmented-control w-full p-1 rounded-xl flex items-stretch relative min-h-[44px] md:min-h-[52px] mb-3 md:mb-4"
                        >
                            {ACHIEVEMENT_CATEGORIES.map((category) => {
                                const isActive = activeAchievementCategory === category.id;
                                const hasReadyAchievement = categoryHasReadyAchievement(category.id);
                                return (
                                    <button
                                        key={category.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        aria-label={`${category.label}${hasReadyAchievement ? ', reward ready' : ''}`}
                                        onClick={() => selectAchievementCategory(category.id)}
                                        className={`flex-1 py-2 px-0.5 text-[10px] md:text-[12px] font-bold transition-all relative z-10 flex items-center justify-center ${
                                            isActive
                                                ? 'text-stone-900 dark:text-white'
                                                : 'text-stone-400 dark:text-stone-400'
                                        }`}
                                    >
                                        <span className="relative z-20 leading-none">{category.label}</span>
                                        {hasReadyAchievement && (
                                            <span className="absolute z-30 top-1 right-1 w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                                        )}
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeAchievementPill"
                                                className="oku-segmented-pill absolute inset-0 rounded-lg z-10"
                                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="relative overflow-hidden">
                            <AnimatePresence initial={false} custom={achievementCategoryDirection}>
                                <motion.div
                                    key={activeAchievementCategory}
                                    custom={achievementCategoryDirection}
                                    variants={achievementContentVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                >
                                    <AchievementList
                                        achievements={visibleAchievements}
                                        onClaim={handleClaim}
                                        enteringAchievementIds={enteringAchievementIds}
                                        emptyTitle="Nothing waiting here"
                                        emptyDetail={
                                            hideCompleted
                                                ? 'Completed achievements are currently hidden.'
                                                : 'There are no achievements in this category yet.'
                                        }
                                    />
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                </div>
                {achievementScrollSpacerHeight > 0 && (
                    <div aria-hidden="true" className="w-full shrink-0" style={{ height: achievementScrollSpacerHeight }} />
                )}
                <div className="h-safe-bottom w-full shrink-0" />
            </main>

            <AnimatePresence>
                {showAccountIntro && (
                    <motion.div
                        className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 backdrop-blur-sm px-5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="account-intro-title"
                            aria-describedby="account-intro-description"
                            className="w-full max-w-xs md:max-w-sm rounded-[1.75rem] border border-stone-100 dark:border-stone-700 bg-t-surface px-6 py-7 md:px-8 md:py-9 text-center shadow-2xl"
                            initial={{ opacity: 0, scale: 0.94, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: 5 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                        >
                            <h3 id="account-intro-title" className="text-2xl md:text-3xl font-bold text-t-primary">
                                Save your progress
                            </h3>
                            <p id="account-intro-description" className="mt-3 text-sm md:text-base font-normal leading-relaxed text-stone-500 dark:text-stone-400">
                                Sign in to save your progress across devices, or continue as a guest.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    sounds.playClick();
                                    localStorage.setItem(PROFILE_ACCOUNT_INTRO_KEY, '1');
                                    setShowAccountIntro(false);
                                }}
                                className="mt-6 w-full rounded-2xl bg-stone-950 py-3.5 text-base font-bold text-white active:scale-[0.97] transition-transform"
                            >
                                Got it
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSignOutConfirm && (
                    <motion.div
                        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 backdrop-blur-sm px-5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => {
                            sounds.playClick();
                            setShowSignOutConfirm(false);
                        }}
                    >
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="sign-out-confirm-title"
                            className="w-full max-w-xs md:max-w-sm rounded-[1.75rem] border border-stone-100 dark:border-stone-700 bg-t-surface p-6 md:p-8 text-center shadow-2xl"
                            initial={{ opacity: 0, scale: 0.94, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 5 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <h3
                                id="sign-out-confirm-title"
                                className="text-xl md:text-2xl font-bold leading-snug text-t-primary"
                            >
                                Are you sure you want to sign out of your account?
                            </h3>

                            <div className="mt-6 flex flex-col gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSignOutConfirm(false);
                                        void handleSignOut();
                                    }}
                                    className="w-full rounded-2xl bg-stone-950 py-3.5 text-base font-bold text-white active:scale-[0.97] transition-transform"
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        sounds.playClick();
                                        setShowSignOutConfirm(false);
                                    }}
                                    className="w-full rounded-2xl bg-stone-100 dark:bg-stone-800 py-3.5 text-base font-bold text-stone-500 dark:text-stone-400 active:scale-[0.97] transition-transform"
                                >
                                    No
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
