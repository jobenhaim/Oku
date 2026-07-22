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
}

const PACK_REWARDS: Record<Difficulty, number> = {
    [Difficulty.SuperEasy]: 40,
    [Difficulty.Easy]: 75,
    [Difficulty.Normal]: 100,
    [Difficulty.Hard]: 150,
    [Difficulty.Intense]: 200,
    [Difficulty.Impossible]: 300,
};

const PACK_TITLES: Record<Difficulty, [string, string, string]> = {
    [Difficulty.SuperEasy]: ['Gentle Start', 'Easy Momentum', 'Super Easy Hero'],
    [Difficulty.Easy]: ['Easy Rhythm', 'Smooth Sailing', 'Easy Going'],
    [Difficulty.Normal]: ['Finding Balance', 'In the Flow', 'Perfectly Normal'],
    [Difficulty.Hard]: ['Steady Resolve', 'Hard Earned', 'Strong Finish'],
    [Difficulty.Intense]: ['Full Focus', 'Pressure Proof', 'Unshaken'],
    [Difficulty.Impossible]: ['Against the Odds', 'Beyond Limits', 'Impossible, Done'],
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
            reward: 20,
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
        reward: 20,
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
            title: PACK_TITLES[difficulty][displayPack - 1],
            detail: `Complete Pack ${displayPack} - ${difficulty}.`,
            current,
            target: 100,
            reward: PACK_REWARDS[difficulty],
            category: 'journey',
        });
    });
};

export const getOtherAchievements = (data: StoredData): AchievementItem[] => {
    const claimedIds = new Set(data.claimedAchievements || []);
    const totalGamesWon = Math.max(0, data.stats?.totalGamesWon || 0);
    const difficultiesCompleted = Object.values(Difficulty).filter((difficulty) => completedInRange(data, difficulty, 1, 300) > 0).length;
    const guidedDifficultiesCompleted = [Difficulty.SuperEasy, Difficulty.Easy, Difficulty.Normal]
        .filter((difficulty) => completedInRange(data, difficulty, 1, 300) > 0).length;
    const hiddenMistakeDifficultiesCompleted = [Difficulty.Hard, Difficulty.Intense, Difficulty.Impossible]
        .filter((difficulty) => completedInRange(data, difficulty, 1, 300) > 0).length;
    const pepinoGiftsOpened = Math.max(0, data.achievementCounters?.pepinoGiftsOpened || 0);
    const hardPerfectGames = Math.max(0, data.achievementCounters?.hardPerfectGames || 0);
    const scansUsed = Math.max(0, data.achievementCounters?.scansUsed || 0);
    const replaysWatched = Math.max(0, data.achievementCounters?.replaysWatched || 0);
    const backgrounds = data.purchasedBackgrounds.filter((id) => id !== 'bg-default' && id !== 'bg-dyn-default').length;
    const numberStyles = data.purchasedNumberColors.filter((id) => id !== 'num-default').length;
    const soundPacks = data.purchasedSoundPacks.filter((id) => id !== 'snd-zen').length;
    const skills = new Set(data.purchasedSkills.filter((id) => ['skill-nudge', 'skill-scribe', 'skill-scan'].includes(id))).size;

    type AchievementDefinition = Omit<AchievementItem, 'claimed' | 'ready'>;
    const selectCurrentMilestone = (milestones: AchievementDefinition[]) => (
        milestones.find((item) => !claimedIds.has(item.id)) || milestones[milestones.length - 1]
    );

    const journeyMilestones: AchievementDefinition[] = [
        { id: 'first-win', title: 'First Step', detail: 'Complete 1 puzzle.', current: totalGamesWon, target: 1, reward: 10, category: 'journey' },
        { id: 'ten-wins', title: 'Finding a Rhythm', detail: 'Complete 10 puzzles.', current: totalGamesWon, target: 10, reward: 20, category: 'journey' },
        { id: 'fifty-wins', title: 'In the Flow', detail: 'Complete 50 puzzles.', current: totalGamesWon, target: 50, reward: 40, category: 'journey' },
        { id: 'hundred-wins', title: 'One Hundred', detail: 'Complete 100 puzzles.', current: totalGamesWon, target: 100, reward: 75, category: 'journey' },
    ];
    const perfectMilestones: AchievementDefinition[] = [
        { id: 'first-perfect-hard', title: 'Clean Slate', detail: 'Win 1 flawless puzzle on Hard or above.', current: hardPerfectGames, target: 1, reward: 10, category: 'journey' },
        { id: 'five-perfect-hard', title: 'Steady Hand', detail: 'Win 5 flawless puzzles on Hard or above.', current: hardPerfectGames, target: 5, reward: 15, category: 'journey' },
        { id: 'ten-perfect-hard', title: 'Smooth Operator', detail: 'Win 10 flawless puzzles on Hard or above.', current: hardPerfectGames, target: 10, reward: 25, category: 'journey' },
        { id: 'twenty-perfect-hard', title: 'Untouchable', detail: 'Win 20 flawless puzzles on Hard or above.', current: hardPerfectGames, target: 20, reward: 40, category: 'journey' },
    ];
    const replayMilestones: AchievementDefinition[] = [
        { id: 'one-replay-watched', title: 'First Screening', detail: 'Watch 1 gameplay replay.', current: replaysWatched, target: 1, reward: 10, category: 'journey' },
        { id: 'five-replays-watched', title: 'One More Episode', detail: 'Watch 5 gameplay replays.', current: replaysWatched, target: 5, reward: 10, category: 'journey' },
        { id: 'ten-replays-watched', title: 'Couch Critic', detail: 'Watch 10 gameplay replays.', current: replaysWatched, target: 10, reward: 15, category: 'journey' },
        { id: 'twenty-five-replays-watched', title: 'Replay Regular', detail: 'Watch 25 gameplay replays.', current: replaysWatched, target: 25, reward: 15, category: 'journey' },
        { id: 'fifty-replays-watched', title: 'Prime Time', detail: 'Watch 50 gameplay replays.', current: replaysWatched, target: 50, reward: 20, category: 'journey' },
        { id: 'hundred-replays-watched', title: "Director's Cut", detail: 'Watch 100 gameplay replays.', current: replaysWatched, target: 100, reward: 25, category: 'journey' },
    ];
    const scanMilestones: AchievementDefinition[] = [
        { id: 'one-scan', title: 'Quick Check', detail: 'Use Scan 1 time.', current: scansUsed, target: 1, reward: 5, category: 'skills' },
        { id: 'ten-scans', title: 'Double Checker', detail: 'Use Scan 10 times.', current: scansUsed, target: 10, reward: 15, category: 'skills' },
        { id: 'twenty-five-scans', title: 'Careful Eyes', detail: 'Use Scan 25 times.', current: scansUsed, target: 25, reward: 20, category: 'skills' },
        { id: 'fifty-scans', title: 'Trust Issues', detail: 'Use Scan 50 times.', current: scansUsed, target: 50, reward: 35, category: 'skills' },
        { id: 'hundred-scans', title: 'Nothing Gets Past Me', detail: 'Use Scan 100 times.', current: scansUsed, target: 100, reward: 50, category: 'skills' },
    ];
    const backgroundMilestones: AchievementDefinition[] = [
        { id: 'first-background', title: 'A New View', detail: 'Get 1 background.', current: backgrounds, target: 1, reward: 15, category: 'collection' },
        { id: 'three-backgrounds', title: 'Scene Setter', detail: 'Get 3 backgrounds.', current: backgrounds, target: 3, reward: 35, category: 'collection' },
    ];
    const numberStyleMilestones: AchievementDefinition[] = [
        { id: 'first-number-style', title: 'Fresh Ink', detail: 'Get 1 number style.', current: numberStyles, target: 1, reward: 15, category: 'collection' },
        { id: 'three-number-styles', title: 'Number Wardrobe', detail: 'Get 3 number styles.', current: numberStyles, target: 3, reward: 35, category: 'collection' },
    ];
    const soundPackMilestones: AchievementDefinition[] = [
        { id: 'first-sound-pack', title: 'A New Sound', detail: 'Get 1 sound pack.', current: soundPacks, target: 1, reward: 15, category: 'collection' },
        { id: 'three-sound-packs', title: 'Sound Library', detail: 'Get 3 sound packs.', current: soundPacks, target: 3, reward: 35, category: 'collection' },
    ];

    const definitions: AchievementDefinition[] = [
        selectCurrentMilestone(journeyMilestones),
        { id: 'guided-difficulties', title: 'Clear Path', detail: 'Win once in Super Easy, Easy, and Normal.', current: guidedDifficultiesCompleted, target: 3, reward: 10, category: 'journey' },
        { id: 'hidden-mistake-difficulties', title: 'No Safety Net', detail: 'Win once in Hard, Intense, and Impossible.', current: hiddenMistakeDifficultiesCompleted, target: 3, reward: 20, category: 'journey' },
        { id: 'every-difficulty', title: 'Try Everything', detail: 'Complete a puzzle in every difficulty.', current: difficultiesCompleted, target: 6, reward: 75, category: 'journey' },
        selectCurrentMilestone(perfectMilestones),
        selectCurrentMilestone(replayMilestones),
        selectCurrentMilestone(scanMilestones),
        selectCurrentMilestone(backgroundMilestones),
        selectCurrentMilestone(numberStyleMilestones),
        selectCurrentMilestone(soundPackMilestones),
        { id: 'all-skills', title: 'Complete Toolkit', detail: 'Unlock every skill.', current: skills, target: 3, reward: 50, category: 'collection' },
    ];

    const pepinoMilestones: Array<Omit<AchievementItem, 'claimed' | 'ready'>> = [
        { id: 'one-pepino-gift', title: 'Nice to Meet You', detail: 'Open 1 Pepino gift.', current: pepinoGiftsOpened, target: 1, reward: 10, category: 'pepino' },
        { id: 'two-pepino-gifts', title: 'Back for More', detail: 'Open 2 Pepino gifts.', current: pepinoGiftsOpened, target: 2, reward: 15, category: 'pepino' },
        { id: 'five-pepino-gifts', title: 'Fish Friend', detail: 'Open 5 Pepino gifts.', current: pepinoGiftsOpened, target: 5, reward: 15, category: 'pepino' },
        { id: 'ten-pepino-gifts', title: 'Best Fins', detail: 'Open 10 Pepino gifts.', current: pepinoGiftsOpened, target: 10, reward: 20, category: 'pepino' },
        { id: 'twenty-pepino-gifts', title: 'Gift Bubbles', detail: 'Open 20 Pepino gifts.', current: pepinoGiftsOpened, target: 20, reward: 20, category: 'pepino' },
        { id: 'thirty-five-pepino-gifts', title: 'Tank Regular', detail: 'Open 35 Pepino gifts.', current: pepinoGiftsOpened, target: 35, reward: 25, category: 'pepino' },
        { id: 'fifty-pepino-gifts', title: "Pepino's Favorite", detail: 'Open 50 Pepino gifts.', current: pepinoGiftsOpened, target: 50, reward: 30, category: 'pepino' },
        { id: 'seventy-five-pepino-gifts', title: 'Gift Current', detail: 'Open 75 Pepino gifts.', current: pepinoGiftsOpened, target: 75, reward: 35, category: 'pepino' },
        { id: 'hundred-pepino-gifts', title: 'Fin-tastic Century', detail: 'Open 100 Pepino gifts.', current: pepinoGiftsOpened, target: 100, reward: 50, category: 'pepino' },
    ];
    definitions.push(selectCurrentMilestone(pepinoMilestones));

    return definitions.map((item) => makeItem(claimedIds, item));
};

export const hasClaimableAchievement = (data: StoredData, claimedRank: number) => {
    if (getTitleAchievement(data, claimedRank).ready) return true;
    return [...getPackAchievements(data), ...getOtherAchievements(data)].some((achievement) => achievement.ready);
};
