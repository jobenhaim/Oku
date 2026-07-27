import { Difficulty, StoredData } from '../types';

export const PROFILE_TITLES = [
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
    'Three-Hundred Club',
];

export const MAX_PROFILE_RANK = PROFILE_TITLES.length + 4;

export const getProfileTitle = (rankIndex: number) => {
    if (rankIndex < PROFILE_TITLES.length) return PROFILE_TITLES[rankIndex];
    const starCount = Math.min(5, rankIndex - PROFILE_TITLES.length + 1);
    return `Puzzle Collector ${Array(starCount).fill('★').join(' ')}`;
};

export interface AchievementItem {
    id: string;
    title: string;
    detail: string;
    current: number;
    target: number;
    reward: number;
    claimed: boolean;
    ready: boolean;
    category: 'title' | 'journey' | 'skills' | 'pepino' | 'collection';
    onClaimTitleRank?: number;
    showProgress?: boolean;
}

const PACK_REWARDS: Record<Difficulty, number> = {
    [Difficulty.SuperEasy]: 40,
    [Difficulty.Easy]: 75,
    [Difficulty.Normal]: 100,
    [Difficulty.Hard]: 150,
    [Difficulty.Intense]: 200,
    [Difficulty.Impossible]: 300,
};

const completedInRange = (data: StoredData, difficulty: Difficulty, start: number, end: number) => {
    let completed = 0;
    for (let level = start; level <= end; level++) {
        const progress = data.progress[`${difficulty}-${level}`];
        if (progress && (progress.status === 'completed' || progress.bestTime !== undefined)) completed++;
    }
    return completed;
};

const makeItem = (
    claimedIds: Set<string>,
    item: Omit<AchievementItem, 'claimed' | 'ready'>,
): AchievementItem => {
    const claimed = claimedIds.has(item.id);
    return {
        ...item,
        claimed,
        ready: !claimed && item.current >= item.target,
    };
};

export const getTitleAchievement = (data: StoredData, claimedRank: number): AchievementItem => {
    const totalGamesWon = Math.max(0, data.stats?.totalGamesWon || 0);
    const earnedRank = Math.min(MAX_PROFILE_RANK, Math.floor(totalGamesWon / 20));
    const safeRank = Math.min(earnedRank, Math.max(0, claimedRank));

    if (safeRank >= MAX_PROFILE_RANK) {
        return {
            id: 'title-complete',
            title: getProfileTitle(MAX_PROFILE_RANK),
            detail: 'Every solver title earned.',
            current: 20,
            target: 20,
            reward: 10,
            claimed: true,
            ready: false,
            category: 'title',
        };
    }

    const nextRank = safeRank + 1;
    const current = Math.min(20, Math.max(0, totalGamesWon - safeRank * 20));
    const id = `title-rank-${nextRank}`;
    const claimed = (data.claimedAchievements || []).includes(id);
    return {
        id,
        title: getProfileTitle(nextRank),
        detail: `Solve 20 puzzles as ${getProfileTitle(safeRank)}.`,
        current,
        target: 20,
        reward: 10,
        claimed,
        ready: !claimed && earnedRank >= nextRank,
        category: 'title',
        onClaimTitleRank: nextRank,
    };
};

export const getReadyTitleAchievementCount = (data: StoredData, claimedRank: number) => {
    const totalGamesWon = Math.max(0, data.stats?.totalGamesWon || 0);
    const earnedRank = Math.min(MAX_PROFILE_RANK, Math.floor(totalGamesWon / 20));
    const safeClaimedRank = Math.min(earnedRank, Math.max(0, Math.floor(claimedRank)));
    return Math.max(0, earnedRank - safeClaimedRank);
};

export const getPackAchievements = (data: StoredData): AchievementItem[] => {
    const claimedIds = new Set(data.claimedAchievements || []);

    return Object.values(Difficulty).map((difficulty) => {
        let pack = 1;
        while (pack <= 3 && claimedIds.has(`finish-pack-${pack}-${difficulty}`)) pack++;
        const displayPack = Math.min(3, pack);
        const start = (displayPack - 1) * 100 + 1;
        const end = displayPack * 100;
        const id = `finish-pack-${displayPack}-${difficulty}`;
        const current = completedInRange(data, difficulty, start, end);

        return makeItem(claimedIds, {
            id,
            title: `Finish Book ${displayPack}`,
            detail: `Complete Book ${displayPack} · ${difficulty}.`,
            current,
            target: 100,
            reward: PACK_REWARDS[difficulty],
            category: 'journey',
            showProgress: false,
        });
    });
};

export const getOtherAchievements = (data: StoredData): AchievementItem[] => {
    const claimedIds = new Set(data.claimedAchievements || []);
    const totalGamesWon = Math.max(0, data.stats?.totalGamesWon || 0);
    const pepinoGiftsOpened = Math.max(0, data.achievementCounters?.pepinoGiftsOpened || 0);
    const hardPerfectGames = Math.max(0, data.achievementCounters?.hardPerfectGames || 0);
    const scansUsed = Math.max(0, data.achievementCounters?.scansUsed || 0);
    const replaysWatched = Math.max(0, data.achievementCounters?.replaysWatched || 0);
    const hardNoScanWins = Math.max(0, data.achievementCounters?.hardNoScanWins || 0);
    const noteGamesWon = Math.max(0, data.achievementCounters?.noteGamesWon || 0);
    const nudgeCellClicks = Math.max(
        0,
        data.achievementCounters?.nudgeCellClicks || 0
    );
    const backgrounds = data.purchasedBackgrounds.filter((id) => id !== 'bg-default' && id !== 'bg-dyn-default').length;
    const numberStyles = data.purchasedNumberColors.filter((id) => id !== 'num-default').length;
    const soundPacks = data.purchasedSoundPacks.filter((id) => id !== 'snd-zen').length;
    const skills = new Set(data.purchasedSkills.filter((id) => ['skill-focus', 'skill-nudge', 'skill-scribe', 'skill-scan'].includes(id))).size;
    const winsByDifficulty = data.stats?.gamesWonByDifficulty || {};

    type AchievementDefinition = Omit<AchievementItem, 'claimed' | 'ready'>;
    const definitions: AchievementDefinition[] = [
        { id: 'first-win', title: 'First Step', detail: 'Complete your first puzzle.', current: totalGamesWon, target: 1, reward: 5, category: 'journey' },
        { id: 'puzzle-veteran-250', title: 'Puzzle Veteran', detail: 'Complete 250 puzzles.', current: totalGamesWon, target: 250, reward: 100, category: 'journey' },
        { id: 'ten-super-easy-wins', title: 'Easy Introduction', detail: 'Complete 10 Super Easy puzzles.', current: winsByDifficulty[Difficulty.SuperEasy] || 0, target: 10, reward: 10, category: 'journey' },
        { id: 'ten-easy-wins', title: 'Easy Going', detail: 'Complete 10 Easy puzzles.', current: winsByDifficulty[Difficulty.Easy] || 0, target: 10, reward: 15, category: 'journey' },
        { id: 'ten-normal-wins', title: 'Finding Balance', detail: 'Complete 10 Normal puzzles.', current: winsByDifficulty[Difficulty.Normal] || 0, target: 10, reward: 20, category: 'journey' },
        { id: 'ten-hard-wins', title: 'Hard Earned', detail: 'Complete 10 Hard puzzles.', current: winsByDifficulty[Difficulty.Hard] || 0, target: 10, reward: 25, category: 'journey' },
        { id: 'ten-intense-wins', title: 'Pressure Proof', detail: 'Complete 10 Intense puzzles.', current: winsByDifficulty[Difficulty.Intense] || 0, target: 10, reward: 30, category: 'journey' },
        { id: 'ten-impossible-wins', title: 'Against the Odds', detail: 'Complete 10 Impossible puzzles.', current: winsByDifficulty[Difficulty.Impossible] || 0, target: 10, reward: 40, category: 'journey' },
        { id: 'clean-record-hard-25', title: 'Clean Record', detail: 'Complete 25 flawless puzzles on Hard or above.', current: hardPerfectGames, target: 25, reward: 75, category: 'journey' },
        { id: 'pure-focus-hard-50', title: 'Pure Focus', detail: 'Complete 50 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 50, reward: 75, category: 'journey' },
        { id: 'note-keeper-100', title: 'Note Keeper', detail: 'Complete 100 puzzles after using notes.', current: noteGamesWon, target: 100, reward: 75, category: 'journey' },
        { id: 'director-cut-unique-50', title: "Director's Cut", detail: 'Watch replays from 50 different puzzles.', current: replaysWatched, target: 50, reward: 75, category: 'journey' },
        { id: 'sharp-eye-valid-100', title: 'Sharp Eye', detail: 'Use Scan 100 times after at least 1 minute of play.', current: scansUsed, target: 100, reward: 50, category: 'skills' },
        { id: 'guiding-light-100', title: 'Guiding Light', detail: 'Tap 100 Light-highlighted cells.', current: nudgeCellClicks, target: 100, reward: 50, category: 'skills' },
        { id: 'unlock-pepino', title: 'Nice to Meet You', detail: 'Unlock Pepino.', current: data.pepino?.unlocked ? 1 : 0, target: 1, reward: 10, category: 'pepino' },
        { id: 'pepino-best-friend-100', title: "Pepino's Best Friend", detail: 'Open 100 Pepino gifts.', current: pepinoGiftsOpened, target: 100, reward: 100, category: 'pepino' },
        { id: 'eight-backgrounds', title: 'Scene Setter', detail: 'Get 8 backgrounds.', current: backgrounds, target: 8, reward: 50, category: 'collection' },
        { id: 'eight-number-styles', title: 'Number Wardrobe', detail: 'Get 8 number styles.', current: numberStyles, target: 8, reward: 50, category: 'collection' },
        { id: 'eight-sound-packs', title: 'Sound Library', detail: 'Get 8 sound packs.', current: soundPacks, target: 8, reward: 50, category: 'collection' },
        { id: 'all-skills', title: 'Complete Toolkit', detail: 'Unlock every skill.', current: skills, target: 4, reward: 50, category: 'collection' },
    ];

    return definitions.map((item) => makeItem(claimedIds, item));
};

export const hasClaimableAchievement = (data: StoredData, claimedRank: number) => {
    if (getTitleAchievement(data, claimedRank).ready) return true;
    return [...getPackAchievements(data), ...getOtherAchievements(data)].some((achievement) => achievement.ready);
};
