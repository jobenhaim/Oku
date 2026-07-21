import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { AnimatedNumber } from './AnimatedNumber';
import { sounds } from '../../utils/sound';

interface ProfileModalProps {
    onClose: () => void;
    claimedRank: number;
    onTitleClaimed: (rank: number) => void;
    stats: {
        totalGamesWon: number;
        totalDiamondsEarned?: number;
        perfectGames?: number;
    };
}

const PROFILE_TITLES = [
    'Just Arrived',
    'New Solver',
    'Focused Solver',
    'Grid Explorer',
    'Puzzle Regular',
    'Century Club',
    'Number Collector',
    'Grid Resident',
    'Sudoku Enthusiast',
    'Puzzle Devotee',
    'Two-Hundred Club',
    'Grid Familiar',
    'Sudoku Superfan',
    'Puzzle Machine',
    'Grid Loyalist',
    'Three-Hundred Club'
];

export const MAX_PROFILE_RANK = PROFILE_TITLES.length + 4;

const getProfileTitle = (rankIndex: number) => {
    if (rankIndex < PROFILE_TITLES.length) return PROFILE_TITLES[rankIndex];
    const starCount = Math.min(5, rankIndex - PROFILE_TITLES.length + 1);
    return `Puzzle Collector ${Array(starCount).fill('★').join(' ')}`;
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

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, claimedRank, onTitleClaimed, stats }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [showCloudToast, setShowCloudToast] = useState(false);
    const [isRankCelebrating, setIsRankCelebrating] = useState(false);
    const [isProgressAnimated, setIsProgressAnimated] = useState(false);
    const totalGamesWon = Math.max(0, stats.totalGamesWon || 0);
    const earnedRankIndex = Math.min(MAX_PROFILE_RANK, Math.floor(totalGamesWon / 20));
    const rankIndex = Math.min(earnedRankIndex, Math.max(0, claimedRank));
    const isHighestTitle = rankIndex === MAX_PROFILE_RANK;
    const titleProgress = isHighestTitle ? 20 : Math.min(20, Math.max(0, totalGamesWon - rankIndex * 20));
    const isTitleReady = !isHighestTitle && earnedRankIndex > rankIndex;
    const currentTitle = getProfileTitle(rankIndex);
    const nextTitle = isHighestTitle ? currentTitle : getProfileTitle(rankIndex + 1);
    
    const [profile, setProfile] = useState(() => {
        const stored = localStorage.getItem('zen_profile');
        const storedProfile = stored ? JSON.parse(stored) : {};
        return {
            ...storedProfile,
            username: "Zen Player", 
            hasEditedName: storedProfile.hasEditedName ?? Boolean(storedProfile.username && storedProfile.username !== "Zen Player"),
            ...storedProfile,
            claimedRank: rankIndex,
            lastSeenRank: rankIndex
        };
    });

    const [isEditingName, setIsEditingName] = useState(false);

    useEffect(() => {
        localStorage.setItem('zen_profile', JSON.stringify(profile));
    }, [profile]);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsProgressAnimated(true), 180);
        return () => window.clearTimeout(timer);
    }, []);

    const handleTitleClaim = () => {
        if (!isTitleReady || isRankCelebrating) return;

        const newRank = Math.min(MAX_PROFILE_RANK, rankIndex + 1);
        setIsProgressAnimated(false);
        setIsRankCelebrating(true);
        sounds.playPop();
        setProfile((current: typeof profile) => ({
            ...current,
            claimedRank: newRank,
            lastSeenRank: newRank
        }));
        onTitleClaimed(newRank);

        window.setTimeout(() => setIsProgressAnimated(true), 120);
        window.setTimeout(() => setIsRankCelebrating(false), 1400);
    };

    const handleClose = () => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    };

    const handleCloudClick = () => {
        sounds.playClick();
        setShowCloudToast(true);
        setTimeout(() => setShowCloudToast(false), 3000);
    };

    return (
        <div className={`fixed inset-0 z-[999] bg-stone-900/35 flex items-end sm:items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={handleClose}>
            <div className={`bg-stone-50 dark:bg-stone-900 border border-white/80 dark:border-stone-700 w-[calc(100%_-_2rem)] max-w-[330px] rounded-[2rem] shadow-2xl flex flex-col max-h-[86vh] overflow-hidden pb-safe mb-4 sm:mb-0 relative ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="h-10 shrink-0 z-10 relative">
                    <button onClick={handleClose} aria-label="Close profile" className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm absolute right-4 top-4 p-2 rounded-full text-t-primary active:scale-95 transition">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-5 pb-5 hide-scrollbar min-h-0 space-y-4 relative z-10">
                    
                    {/* User Card */}
                    <div className="px-2 pt-2 pb-1 flex flex-col items-center text-center">
                        {!profile.hasEditedName && !isEditingName && (
                            <span className="text-[9px] font-bold text-stone-400 dark:text-stone-500 tracking-[0.18em] mb-1.5">TAP TO EDIT</span>
                        )}
                        {isEditingName ? (
                            <input
                                autoFocus
                                value={profile.username}
                                onChange={e => setProfile({...profile, username: e.target.value, hasEditedName: true})}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
                                maxLength={20}
                                className="text-2xl font-bold text-t-primary bg-transparent border-b border-t-secondary text-center focus:outline-none w-full min-w-0"
                            />
                        ) : (
                            <button
                                type="button"
                                className="max-w-full text-2xl font-bold text-t-primary leading-tight truncate active:scale-[0.98] transition-transform"
                                onClick={() => { sounds.playClick(); setIsEditingName(true); }}
                            >
                                {profile.username || "Anonymous"}
                            </button>
                        )}
                        <div className={`inline-flex items-center justify-center mt-2.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-500/15 dark:to-violet-500/15 border border-blue-100 dark:border-white/10 shadow-sm ${isRankCelebrating ? 'animate-pop ring-2 ring-blue-300/60' : ''}`}>
                            <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300 tracking-wide text-center">{currentTitle}</span>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm rounded-[1.5rem] grid grid-cols-2 px-2 py-4">
                        <div className="flex flex-col items-center text-center px-3 border-r border-stone-200/70 dark:border-white/10">
                            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-400/15 rounded-full flex items-center justify-center mb-2.5">
                                <Icons.Trophy className="w-4 h-4 text-amber-500" />
                            </div>
                            <AnimatedNumber value={stats.totalGamesWon} startFromZero={true} className="text-3xl font-black text-stone-800 dark:text-white tabular-nums leading-none mb-1.5" />
                            <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider leading-tight">Games Won</span>
                        </div>
                        <div className="flex flex-col items-center text-center px-3">
                            <div className="w-9 h-9 bg-sky-100 dark:bg-sky-400/15 rounded-full flex items-center justify-center mb-2.5">
                                <Icons.Diamond className="w-4 h-4 text-blue-500 fill-current" />
                            </div>
                            <AnimatedNumber value={stats.totalDiamondsEarned || 0} startFromZero={true} easing="easeOut" durationMs={1000} className="text-3xl font-black text-stone-800 dark:text-white tabular-nums leading-none mb-1.5" />
                            <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider leading-tight">Diamonds Earned</span>
                        </div>
                    </div>

                    {/* Title Progress */}
                    <button
                        type="button"
                        onClick={handleTitleClaim}
                        disabled={!isTitleReady || isRankCelebrating}
                        className={`relative w-full bg-white dark:bg-stone-800 border shadow-sm rounded-2xl px-4 py-3.5 text-left transition-transform ${isTitleReady ? 'border-blue-300 dark:border-blue-500/50 active:scale-[0.98]' : 'border-stone-200 dark:border-stone-700'} ${isRankCelebrating ? 'animate-pop' : ''}`}
                    >
                        {isTitleReady && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" aria-hidden="true" />}
                        <div className="flex items-end justify-between gap-3 mb-2.5">
                            <div className="min-w-0 text-left">
                                <span className="block text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-0.5">{isHighestTitle ? 'Highest title' : isTitleReady ? 'Title ready' : 'Next title'}</span>
                                <span className="block text-[15px] font-bold text-t-primary truncate">{nextTitle}</span>
                            </div>
                            <span className={`text-xs font-bold tabular-nums shrink-0 ${isTitleReady ? 'text-blue-600 dark:text-blue-400 pr-4' : 'text-stone-500 dark:text-stone-400'}`}>
                                <AnimatedNumber key={rankIndex} value={isProgressAnimated ? titleProgress : 0} easing="easeInOut" durationMs={700} />/20
                            </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-stone-100 dark:bg-stone-700 overflow-hidden">
                            <div
                                key={rankIndex}
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-700 ease-in-out"
                                style={{ width: isProgressAnimated ? `${(titleProgress / 20) * 100}%` : '0%' }}
                            />
                        </div>
                        <p className="text-[9px] font-semibold text-stone-400 dark:text-stone-500 mt-2 text-left">
                            {isHighestTitle
                                ? 'Every Puzzle Collector star earned.'
                                : isTitleReady
                                    ? 'Tap to unlock your new title.'
                                    : `Solve ${20 - titleProgress} more ${20 - titleProgress === 1 ? 'puzzle' : 'puzzles'}.`}
                        </p>
                    </button>

                    {/* Cloud Sync */}
                    <div>
                        <button
                            onClick={handleCloudClick}
                            className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm w-full p-3.5 rounded-2xl flex items-center justify-between transition-all duration-300 active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700 shadow-sm flex items-center justify-center">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                                        <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                                        <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.16 2.766-2.395 3.558L19.834 21Z"/>
                                        <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
                                    </svg>
                                </div>
                                <div className="flex flex-col text-left gap-0.5">
                                    <span className="text-sm font-bold text-t-primary leading-tight transition-colors duration-300">Sign in with Google</span>
                                    <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 leading-tight">Cloud backup coming soon</span>
                                </div>
                            </div>
                            {showCloudToast ? (
                                <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md animate-fade-in">Coming Soon</span>
                            ) : (
                                <div className="bg-stone-100 dark:bg-stone-700 p-1.5 rounded-full text-t-icon">
                                    <Icons.Next className="w-3 h-3" />
                                </div>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
