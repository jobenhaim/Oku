import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AchievementItem, getOtherAchievements, getPackAchievements, getProfileTitle, getTitleAchievement, MAX_PROFILE_RANK } from '../../utils/achievements';
import { Storage } from '../../utils/storage';
import { sounds } from '../../utils/sound';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Icons } from '../ui/Icons';
import { Difficulty } from '../../types';

interface ProfileScreenProps {
    onClose: () => void;
    points: number;
    claimedRank: number;
    onTitleClaimed: (rank: number) => void;
    onClaimAchievement: (id: string, reward: number) => boolean;
}

export { MAX_PROFILE_RANK };

type ProfileStatBreakdown = 'games' | 'diamonds' | null;

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
    const showProgress = achievement.target > 1 && !achievement.claimed;
    const [isClaiming, setIsClaiming] = useState(false);
    const claimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (claimTimer.current) clearTimeout(claimTimer.current);
    }, []);

    const handleClick = () => {
        if (!achievement.ready || isClaiming) return;
        sounds.playSelectionHaptic();
        setIsClaiming(true);
        claimTimer.current = setTimeout(() => {
            onClaim(achievement);
            setIsClaiming(false);
            claimTimer.current = null;
        }, 420);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={!achievement.ready || isClaiming}
            className={`relative w-full h-[82px] px-4 py-3 text-left rounded-[1.25rem] border transition-transform overflow-hidden focus:outline-none ${
                achievement.claimed
                    ? 'bg-stone-100/90 dark:bg-stone-900/70 border-stone-200/60 dark:border-stone-800/70 shadow-none'
                    : 'bg-t-surface border-stone-200/80 dark:border-stone-800 shadow-sm'
            } ${achievement.ready ? 'active:scale-[0.98]' : ''} ${
                isClaiming ? 'achievement-claim-win' : ''
            } ${isEntering ? 'achievement-milestone-enter' : ''}`}
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
                        <span className={`text-[15px] font-bold leading-tight truncate ${achievement.claimed ? 'text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-white'}`}>
                            {achievement.title}
                        </span>
                        {achievement.claimed && (
                            <span className="w-4 h-4 rounded-full bg-stone-300 dark:bg-stone-700 flex items-center justify-center shrink-0">
                                <Icons.Check className="w-2.5 h-2.5 text-white" />
                            </span>
                        )}
                    </div>
                    <span className="block text-[13px] font-medium text-stone-500 dark:text-stone-400 mt-1 leading-tight">
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

                <div className={`min-w-[4.25rem] h-10 px-3 rounded-full flex items-center justify-center gap-1.5 shrink-0 ${
                    achievement.ready
                        ? 'bg-blue-500 shadow-[0_4px_12px_rgba(59,130,246,0.28)]'
                        : achievement.claimed
                            ? 'bg-stone-100 dark:bg-stone-700'
                            : 'bg-blue-50 dark:bg-blue-500/10'
                } ${isClaiming ? 'achievement-reward-pop' : ''}`}>
                    <span className={`text-sm font-bold tabular-nums ${achievement.ready ? 'text-white' : achievement.claimed ? 'text-stone-400 dark:text-stone-500' : 'text-blue-600 dark:text-blue-400'}`}>
                        {achievement.reward}
                    </span>
                    <Icons.Diamond className={`w-3.5 h-3.5 fill-current ${achievement.ready ? 'text-white' : achievement.claimed ? 'text-stone-400 dark:text-stone-500' : 'text-blue-500'}`} />
                </div>
            </div>
        </button>
    );
};

const AchievementGroup: React.FC<{
    title: string;
    achievements: AchievementItem[];
    onClaim: (achievement: AchievementItem) => void;
    enteringAchievementIds: Set<string>;
}> = ({ title, achievements, onClaim, enteringAchievementIds }) => {
    const [isHidden, setIsHidden] = useState(false);

    return achievements.length > 0 ? (
        <section>
            <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.18em]">
                    {title}
                </h2>
                <button
                    type="button"
                    onClick={() => { sounds.playClick(); setIsHidden((current) => !current); }}
                    aria-label={`${isHidden ? 'Show' : 'Hide'} ${title} achievements`}
                    aria-expanded={!isHidden}
                    className="flex items-center gap-1 text-[9px] font-bold text-stone-400 dark:text-stone-500 active:scale-95 transition-transform"
                >
                    <span>{isHidden ? 'Show' : 'Hide'}</span>
                    <Icons.Eye className={`w-3.5 h-3.5 transition-opacity duration-150 ${isHidden ? 'opacity-45' : 'opacity-80'}`} />
                </button>
            </div>
            <div
                aria-hidden={isHidden}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    isHidden
                        ? 'grid-rows-[0fr] opacity-0 pointer-events-none'
                        : 'grid-rows-[1fr] opacity-100'
                }`}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-2.5">
                        {achievements.map((achievement) => (
                            <div key={achievement.id}>
                                <AchievementRow
                                    achievement={achievement}
                                    onClaim={onClaim}
                                    isEntering={enteringAchievementIds.has(achievement.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    ) : null;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
    onClose,
    points,
    claimedRank,
    onTitleClaimed,
    onClaimAchievement,
}) => {
    const [storedData, setStoredData] = useState(() => Storage.getStoredData());
    const [isEditingName, setIsEditingName] = useState(false);
    const [showCloudToast, setShowCloudToast] = useState(false);
    const [hideCompleted, setHideCompleted] = useState(false);
    const [expandedStat, setExpandedStat] = useState<ProfileStatBreakdown>(null);
    const [visibleStatBreakdown, setVisibleStatBreakdown] = useState<Exclude<ProfileStatBreakdown, null>>('games');
    const [enteringAchievementIds, setEnteringAchievementIds] = useState<Set<string>>(() => new Set());
    const statSwitchTimer = useRef<number | null>(null);
    const achievementEntranceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const visibleTitleAchievements = hideCompleted && titleAchievement.claimed ? [] : [titleAchievement];
    const visiblePackAchievements = hideCompleted ? packAchievements.filter((achievement) => !achievement.claimed) : packAchievements;
    const visibleJourneyAchievements = hideCompleted ? journeyAchievements.filter((achievement) => !achievement.claimed) : journeyAchievements;
    const visibleCollectionAchievements = hideCompleted ? collectionAchievements.filter((achievement) => !achievement.claimed) : collectionAchievements;
    const visibleSkillAchievements = hideCompleted ? skillAchievements.filter((achievement) => !achievement.claimed) : skillAchievements;
    const visiblePepinoAchievements = hideCompleted ? pepinoAchievements.filter((achievement) => !achievement.claimed) : pepinoAchievements;
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

    const handleCloudClick = () => {
        sounds.playClick();
        setShowCloudToast(true);
        window.setTimeout(() => setShowCloudToast(false), 3000);
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
                        <span className="mt-3 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-500/10 text-sm font-bold text-blue-700 dark:text-blue-300">
                            {currentTitle}
                        </span>
                    </section>

                    <section className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => toggleStat('games', gamesWonBreakdown.length > 0)}
                                aria-expanded={expandedStat === 'games'}
                                className={`relative min-h-[112px] overflow-hidden rounded-[1.4rem] border p-4 text-left shadow-sm active:scale-[0.98] transition-transform ${expandedStat === 'games' ? 'border-amber-300 dark:border-amber-700' : 'border-amber-100 dark:border-amber-900/50'} bg-gradient-to-br from-amber-50 to-orange-100/70 dark:from-amber-950/40 dark:to-orange-950/20`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="w-9 h-9 rounded-xl bg-white/80 dark:bg-black/20 text-amber-500 flex items-center justify-center shadow-sm">
                                        <Icons.Trophy className="w-7 h-7" />
                                    </div>
                                    {gamesWonBreakdown.length > 0 && (
                                        <span className="w-7 h-7 rounded-full bg-white/75 dark:bg-black/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                                            <Icons.Down className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedStat === 'games' ? 'rotate-180' : ''}`} />
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3">
                                    <span className="block text-[1.75rem] font-bold tracking-[0.035em] tabular-nums leading-none text-stone-900 dark:text-stone-50">
                                        {storedData.stats?.totalGamesWon || 0}
                                    </span>
                                    <span className="block mt-1 text-[11px] font-bold text-amber-800/65 dark:text-amber-200/70 uppercase tracking-[0.13em]">Games Won</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleStat('diamonds', diamondBreakdown.length > 0)}
                                aria-expanded={expandedStat === 'diamonds'}
                                className={`relative min-h-[112px] overflow-hidden rounded-[1.4rem] border p-4 text-left shadow-sm active:scale-[0.98] transition-transform ${expandedStat === 'diamonds' ? 'border-blue-300 dark:border-blue-700' : 'border-blue-100 dark:border-blue-900/50'} bg-gradient-to-br from-blue-50 to-cyan-100/70 dark:from-blue-950/40 dark:to-cyan-950/20`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="w-9 h-9 rounded-xl bg-white/80 dark:bg-black/20 text-blue-500 flex items-center justify-center shadow-sm">
                                        <Icons.Diamond className="w-[18px] h-[18px] fill-current" />
                                    </div>
                                    {diamondBreakdown.length > 0 && (
                                        <span className="w-7 h-7 rounded-full bg-white/75 dark:bg-black/20 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                                            <Icons.Down className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedStat === 'diamonds' ? 'rotate-180' : ''}`} />
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3">
                                    <span className="block text-[1.75rem] font-bold tracking-[0.035em] tabular-nums leading-none text-stone-900 dark:text-stone-50">
                                        {storedData.stats?.totalDiamondsEarned || 0}
                                    </span>
                                    <span className="block mt-1 text-[11px] font-bold text-blue-800/65 dark:text-blue-200/70 uppercase tracking-[0.13em]">Diamonds Earned</span>
                                </div>
                            </button>
                        </div>
                        <div
                            className={`grid transition-[grid-template-rows,opacity] duration-150 ease-in-out ${expandedStat ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
                            aria-hidden={!expandedStat}
                        >
                            <div className="overflow-hidden">
                                <div className={`rounded-[1.25rem] border shadow-sm ${visibleStatBreakdown === 'games' ? 'bg-amber-50/70 border-amber-100 dark:bg-amber-950/25 dark:border-amber-900/50' : 'bg-blue-50/70 border-blue-100 dark:bg-blue-950/25 dark:border-blue-900/50'}`}>
                                    <div className="px-4 py-3 space-y-2.5">
                                        {(visibleStatBreakdown === 'games' ? gamesWonBreakdown : diamondBreakdown).map((item) => (
                                            <div key={item.label} className="flex items-center justify-between text-xs font-semibold">
                                                <span className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${visibleStatBreakdown === 'games' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                                                    {item.label}
                                                </span>
                                                <span className="min-w-9 px-2 py-1 rounded-full bg-white/80 dark:bg-black/20 text-center text-t-primary font-bold tabular-nums inline-flex items-center justify-center gap-1.5">
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

                        <div className="space-y-6">
                            <AchievementGroup title="Next title" achievements={visibleTitleAchievements} onClaim={handleClaim} enteringAchievementIds={enteringAchievementIds} />
                            <AchievementGroup title="Packs" achievements={visiblePackAchievements} onClaim={handleClaim} enteringAchievementIds={enteringAchievementIds} />
                            <AchievementGroup title="Journey" achievements={visibleJourneyAchievements} onClaim={handleClaim} enteringAchievementIds={enteringAchievementIds} />
                            <AchievementGroup title="Skills" achievements={visibleSkillAchievements} onClaim={handleClaim} enteringAchievementIds={enteringAchievementIds} />
                            <AchievementGroup title="Pepino" achievements={visiblePepinoAchievements} onClaim={handleClaim} enteringAchievementIds={enteringAchievementIds} />
                            <AchievementGroup title="Collection" achievements={visibleCollectionAchievements} onClaim={handleClaim} enteringAchievementIds={enteringAchievementIds} />
                        </div>
                    </div>

                    <button onClick={handleCloudClick} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm w-full p-4 rounded-2xl flex items-center justify-between active:scale-[0.99] transition-transform">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                                    <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                                    <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.16 2.766-2.395 3.558L19.834 21Z"/>
                                    <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
                                </svg>
                            </div>
                            <div className="text-left">
                                <span className="block text-sm font-bold">Sign in with Google</span>
                                <span className="block text-[10px] font-semibold text-stone-500 dark:text-stone-400 mt-0.5">Cloud backup coming soon</span>
                            </div>
                        </div>
                        {showCloudToast ? <span className="text-[10px] font-bold text-blue-500">Coming Soon</span> : <Icons.Next className="w-4 h-4 text-stone-400" />}
                    </button>
                </div>
                <div className="h-safe-bottom w-full shrink-0" />
            </main>
        </div>
    );
};
