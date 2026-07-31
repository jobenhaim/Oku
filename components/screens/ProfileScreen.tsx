import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AchievementItem, getOtherAchievements, getPackAchievements, getProfileTitle, getTitleAchievement, MAX_PROFILE_RANK } from '../../utils/achievements';
import { Storage } from '../../utils/storage';
import { sounds } from '../../utils/sound';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Icons } from '../ui/Icons';
import { Difficulty } from '../../types';
import { useTactilePress } from '../../hooks/useTactilePress';
import { AnimatePresence, motion } from 'framer-motion';

interface ProfileScreenProps {
    onClose: () => void;
    points: number;
    claimedRank: number;
    onTitleClaimed: (rank: number) => void;
    onClaimAchievement: (id: string, reward: number) => boolean;
}

export { MAX_PROFILE_RANK };

type ProfileStatBreakdown = 'games' | 'diamonds' | null;
type AchievementCategory = 'journey' | 'skills' | 'pepino' | 'collection' | 'books' | 'all';

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
                className={`relative block w-full h-full px-4 py-3 text-left rounded-[1.25rem] border overflow-hidden focus:outline-none transition-colors duration-[650ms] ease-in-out ${
                    achievement.claimed
                        ? 'bg-stone-100/90 dark:bg-stone-900/70 border-stone-200/60 dark:border-stone-800/70 shadow-none'
                        : achievement.ready
                            ? 'oku-achievement-tactile bg-t-surface border-stone-200/80 dark:border-stone-800'
                            : 'bg-t-surface border-stone-200/80 dark:border-stone-800 shadow-sm'
                } ${isPressed ? 'oku-achievement-tactile--pressed' : ''}`}
            >
                {achievement.ready && (
                    <span
                        aria-label="Ready to claim"
                        className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
                    />
                )}
                <div className="flex items-center gap-3 h-full">
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <span className={`text-[15px] font-bold leading-tight truncate transition-colors duration-[650ms] ease-in-out ${achievement.claimed ? 'text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-white'}`}>
                                {achievement.title}
                            </span>
                            {achievement.claimed && (
                                <span className="achievement-claimed-mark-enter w-4 h-4 rounded-full bg-stone-300 dark:bg-stone-700 flex items-center justify-center shrink-0">
                                    <Icons.Check className="w-2.5 h-2.5 text-white" />
                                </span>
                            )}
                        </div>
                        <span className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mt-1 leading-tight">
                            {achievement.detail}
                        </span>

                        {showProgress && (
                            <div className="h-2 mt-2 flex items-center gap-2.5">
                                <div className="h-2 flex-1 rounded-full bg-stone-100 dark:bg-stone-700 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-[width] duration-700 ease-in-out ${achievement.ready ? 'bg-emerald-400 dark:bg-emerald-400' : 'bg-emerald-300 dark:bg-emerald-500/70'}`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 tabular-nums shrink-0">
                                    {Math.min(achievement.current, achievement.target)}/{achievement.target}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className={`min-w-[4.25rem] h-10 px-3 rounded-full flex items-center justify-center gap-1.5 shrink-0 bg-white dark:bg-white border transition-colors duration-[650ms] ease-in-out ${
                        achievement.claimed ? 'border-stone-300' : 'border-stone-800'
                    }`}>
                        <span className={`text-sm font-bold tabular-nums transition-colors duration-[650ms] ease-in-out ${
                            achievement.claimed ? 'text-stone-400' : 'text-stone-900'
                        }`}>
                            {achievement.reward}
                        </span>
                        <Icons.Diamond className={`w-3.5 h-3.5 fill-current transition-colors duration-[650ms] ease-in-out ${
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
        <div className="flex flex-col gap-2.5 animate-fade-in-fast">
            {achievements.map((achievement) => (
                <AchievementRow
                    key={achievement.id}
                    achievement={achievement}
                    onClaim={onClaim}
                    isEntering={enteringAchievementIds.has(achievement.id)}
                />
            ))}
        </div>
    ) : (
        <div className="animate-fade-in-fast rounded-[1.25rem] border border-stone-200/80 dark:border-stone-800 bg-white/75 dark:bg-stone-900/75 px-5 py-7 text-center">
            <Icons.Check className="w-7 h-7 mx-auto text-emerald-400 mb-2" />
            <span className="block text-sm font-bold text-stone-800 dark:text-stone-100">{emptyTitle}</span>
            <span className="block mt-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">{emptyDetail}</span>
        </div>
    )
);

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
    onClose,
    points,
    claimedRank,
    onTitleClaimed,
    onClaimAchievement,
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
    const statSwitchTimer = useRef<number | null>(null);
    const achievementEntranceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    useEffect(() => () => {
        if (statSwitchTimer.current) window.clearTimeout(statSwitchTimer.current);
        if (achievementEntranceTimer.current) clearTimeout(achievementEntranceTimer.current);
    }, []);

    const currentTitle = getProfileTitle(claimedRank);
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
    const visibleAchievements = !hideCompleted
        ? activeCategoryAchievements
        : activeCategoryAchievements.filter((achievement) => !achievement.claimed);
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

        sounds.playGiftClaim();
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

    return (
        <div className="w-full h-full bg-transparent flex flex-col font-sans text-t-primary">
            <header className="w-full max-w-md mx-auto flex items-center justify-between px-6 pt-4 pb-4 relative shrink-0 z-20">
                <button onClick={onClose} aria-label="Back to menu" className="p-2 rounded-full -ml-2 text-t-icon active:scale-95 transition-transform relative z-30">
                    <Icons.Back className="w-6 h-6 text-t-icon" />
                </button>

                <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                    <h1 className="text-xl font-bold text-t-primary leading-none">Profile</h1>
                </div>

                <div className="flex items-center gap-1 bg-t-surface px-3 py-2 rounded-full shadow-sm relative z-30 border border-stone-200/60 dark:border-stone-800">
                    <AnimatedNumber value={points} easing="easeOut" durationMs={1000} className="text-sm font-bold text-t-primary tabular-nums" />
                    <Icons.Diamond className="w-3 h-3 text-blue-500 fill-current" />
                </div>
            </header>

            <main className="scroll-edge-fade flex-1 overflow-y-auto hide-scrollbar px-6 pb-8">
                <div className="w-full max-w-md mx-auto space-y-6">
                    <section className="flex flex-col items-center text-center pt-3">
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
                                className="text-3xl font-bold bg-transparent border-b border-stone-300 dark:border-stone-600 text-center focus:outline-none w-full"
                            />
                        ) : (
                            <button type="button" onClick={() => { sounds.playClick(); setIsEditingName(true); }} className="max-w-full text-3xl font-bold leading-tight truncate active:scale-[0.98] transition-transform">
                                {profile.username || 'Anonymous'}
                            </button>
                        )}
                        <span className="mt-3 px-4 py-2 rounded-full bg-white dark:bg-white border border-stone-800 dark:border-stone-800 text-sm font-bold text-blue-700 dark:text-blue-700">
                            {currentTitle}
                        </span>
                    </section>

                    <section className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="oku-profile-stat-shell rounded-[1.4rem]">
                                <button
                                    type="button"
                                    onPointerDown={() => gamesWonBreakdown.length > 0 && statPress.beginPress('games')}
                                    onPointerCancel={() => statPress.cancelPress('games')}
                                    onPointerLeave={() => statPress.cancelPress('games')}
                                    onClick={() => gamesWonBreakdown.length > 0 && statPress.runPressCycle('games', () => toggleStat('games', true))}
                                    aria-expanded={expandedStat === 'games'}
                                    className={`oku-profile-stat-card ${statPress.pressedId === 'games' ? 'oku-profile-stat-card--pressed' : ''} relative w-full min-h-[112px] overflow-hidden rounded-[1.4rem] border p-4 text-left bg-white dark:bg-stone-900 ${expandedStat === 'games' ? 'border-amber-300 dark:border-amber-700' : 'border-stone-200/80 dark:border-stone-800'}`}
                                >
                                    <Icons.Trophy className="absolute -right-10 -bottom-16 w-48 h-48 opacity-[0.105] pointer-events-none" />
                                    {gamesWonBreakdown.length > 0 && (
                                        <span className="absolute z-20 right-4 top-4 w-8 h-8 rounded-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-50 flex items-center justify-center border border-stone-100 dark:border-stone-700">
                                            <Icons.Down className={`w-4 h-4 transition-transform duration-200 ${expandedStat === 'games' ? 'rotate-180' : ''}`} />
                                        </span>
                                    )}
                                    <div className="relative z-10 mt-5">
                                        <span className="block text-[2.15rem] font-bold tracking-[0.035em] tabular-nums leading-none text-stone-900 dark:text-stone-50">
                                            {storedData.stats?.totalGamesWon || 0}
                                        </span>
                                        <span className="block mt-1.5 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.13em]">Games Won</span>
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
                                    className={`oku-profile-stat-card ${statPress.pressedId === 'diamonds' ? 'oku-profile-stat-card--pressed' : ''} relative w-full min-h-[112px] overflow-hidden rounded-[1.4rem] border p-4 text-left bg-white dark:bg-stone-900 ${expandedStat === 'diamonds' ? 'border-blue-300 dark:border-blue-700' : 'border-stone-200/80 dark:border-stone-800'}`}
                                >
                                    <Icons.Diamond className="absolute -right-8 -bottom-12 w-40 h-40 text-blue-500 fill-current opacity-[0.095] pointer-events-none" />
                                    {diamondBreakdown.length > 0 && (
                                        <span className="absolute z-20 right-4 top-4 w-8 h-8 rounded-full bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-50 flex items-center justify-center border border-stone-100 dark:border-stone-700">
                                            <Icons.Down className={`w-4 h-4 transition-transform duration-200 ${expandedStat === 'diamonds' ? 'rotate-180' : ''}`} />
                                        </span>
                                    )}
                                    <div className="relative z-10 mt-5">
                                        <span className="block text-[2.15rem] font-bold tracking-[0.035em] tabular-nums leading-none text-stone-900 dark:text-stone-50">
                                            {storedData.stats?.totalDiamondsEarned || 0}
                                        </span>
                                        <span className="block mt-1.5 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.13em]">Diamonds Earned</span>
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
                                    <div className="px-4 py-3.5 space-y-3">
                                        {(visibleStatBreakdown === 'games' ? gamesWonBreakdown : diamondBreakdown).map((item) => (
                                            <div key={item.label} className="flex items-center justify-between text-sm font-semibold">
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
                            <h2 className="text-2xl font-bold">Achievements</h2>
                            <div className="flex items-center gap-2.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => { sounds.playClick(); setHideCompleted((current) => !current); }}
                                    aria-pressed={hideCompleted}
                                    className="h-8 pl-2.5 pr-2 rounded-full bg-t-surface border border-stone-200/80 dark:border-stone-800 shadow-sm flex items-center gap-2 active:scale-95 transition-transform"
                                >
                                    <span className="text-[9px] font-bold text-stone-600 dark:text-stone-300 whitespace-nowrap">Hide completed</span>
                                    <span className={`inline-block w-7 h-4 rounded-full p-0.5 transition-colors duration-200 ${hideCompleted ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                                        <span className={`block w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${hideCompleted ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div
                            role="tablist"
                            aria-label="Achievement categories"
                            className="oku-segmented-control w-full p-1 rounded-xl flex items-stretch relative min-h-[44px] mb-3"
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
                                        onClick={() => {
                                            if (isActive) return;
                                            sounds.playClick();
                                            const currentIndex = ACHIEVEMENT_CATEGORIES.findIndex((item) => item.id === activeAchievementCategory);
                                            const nextIndex = ACHIEVEMENT_CATEGORIES.findIndex((item) => item.id === category.id);
                                            setAchievementCategoryDirection(nextIndex > currentIndex ? 1 : -1);
                                            setActiveAchievementCategory(category.id);
                                        }}
                                        className={`flex-1 py-2 px-0.5 text-[10px] font-bold transition-all relative z-10 flex items-center justify-center ${
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
                <div className="h-safe-bottom w-full shrink-0" />
            </main>
        </div>
    );
};
