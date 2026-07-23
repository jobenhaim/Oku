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
    const guidedDifficultiesCompleted = [Difficulty.SuperEasy, Difficulty.Easy, Difficulty.Normal]
        .filter((difficulty) => completedInRange(data, difficulty, 1, 300) > 0).length;
    const hiddenMistakeDifficultiesCompleted = [Difficulty.Hard, Difficulty.Intense, Difficulty.Impossible]
        .filter((difficulty) => completedInRange(data, difficulty, 1, 300) > 0).length;
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
    const skills = new Set(data.purchasedSkills.filter((id) => ['skill-nudge', 'skill-scribe', 'skill-scan'].includes(id))).size;

    type AchievementDefinition = Omit<AchievementItem, 'claimed' | 'ready'>;
    const selectCurrentMilestone = (milestones: AchievementDefinition[]) => (
        milestones.find((item) => !claimedIds.has(item.id)) || milestones[milestones.length - 1]
    );

    const journeyMilestones: AchievementDefinition[] = [
        { id: 'first-win', title: 'First Step', detail: 'Complete 1 puzzle.', current: totalGamesWon, target: 1, reward: 5, category: 'journey' },
        { id: 'five-wins', title: 'Warming Up', detail: 'Complete 5 puzzles.', current: totalGamesWon, target: 5, reward: 5, category: 'journey' },
        { id: 'ten-wins', title: 'Finding a Rhythm', detail: 'Complete 10 puzzles.', current: totalGamesWon, target: 10, reward: 10, category: 'journey' },
        { id: 'twenty-five-wins', title: 'Settling In', detail: 'Complete 25 puzzles.', current: totalGamesWon, target: 25, reward: 10, category: 'journey' },
        { id: 'fifty-wins', title: 'In the Flow', detail: 'Complete 50 puzzles.', current: totalGamesWon, target: 50, reward: 15, category: 'journey' },
        { id: 'seventy-five-wins', title: 'Grid Regular', detail: 'Complete 75 puzzles.', current: totalGamesWon, target: 75, reward: 15, category: 'journey' },
        { id: 'hundred-wins', title: 'One Hundred', detail: 'Complete 100 puzzles.', current: totalGamesWon, target: 100, reward: 20, category: 'journey' },
        { id: 'one-fifty-wins', title: 'Keeping Pace', detail: 'Complete 150 puzzles.', current: totalGamesWon, target: 150, reward: 20, category: 'journey' },
        { id: 'two-hundred-wins', title: 'Double Century', detail: 'Complete 200 puzzles.', current: totalGamesWon, target: 200, reward: 20, category: 'journey' },
        { id: 'three-hundred-wins', title: 'Deep Focus', detail: 'Complete 300 puzzles.', current: totalGamesWon, target: 300, reward: 25, category: 'journey' },
        { id: 'four-hundred-wins', title: 'Grid Resident', detail: 'Complete 400 puzzles.', current: totalGamesWon, target: 400, reward: 25, category: 'journey' },
        { id: 'five-hundred-wins', title: 'Halfway There', detail: 'Complete 500 puzzles.', current: totalGamesWon, target: 500, reward: 30, category: 'journey' },
        { id: 'six-fifty-wins', title: 'Puzzle Habit', detail: 'Complete 650 puzzles.', current: totalGamesWon, target: 650, reward: 30, category: 'journey' },
        { id: 'eight-hundred-wins', title: 'The Long Game', detail: 'Complete 800 puzzles.', current: totalGamesWon, target: 800, reward: 35, category: 'journey' },
        { id: 'thousand-wins', title: 'Thousand Strong', detail: 'Complete 1,000 puzzles.', current: totalGamesWon, target: 1000, reward: 50, category: 'journey' },
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
        { id: 'one-scan', title: 'Quick Check', detail: 'Use Scan after 1 minute of play.', current: scansUsed, target: 1, reward: 5, category: 'skills' },
        { id: 'five-scans', title: 'Second Look', detail: 'Use Scan 10 times after 1 minute of play.', current: scansUsed, target: 10, reward: 10, category: 'skills' },
        { id: 'ten-scans', title: 'Double Checker', detail: 'Use Scan 25 times after 1 minute of play.', current: scansUsed, target: 25, reward: 10, category: 'skills' },
        { id: 'twenty-scans', title: 'Careful Eyes', detail: 'Use Scan 50 times after 1 minute of play.', current: scansUsed, target: 50, reward: 10, category: 'skills' },
        { id: 'thirty-scans', title: 'Scan Habit', detail: 'Use Scan 100 times after 1 minute of play.', current: scansUsed, target: 100, reward: 10, category: 'skills' },
        { id: 'fifty-scans', title: 'Trust Issues', detail: 'Use Scan 200 times after 1 minute of play.', current: scansUsed, target: 200, reward: 15, category: 'skills' },
        { id: 'seventy-five-scans', title: 'Sharp Eye', detail: 'Use Scan 350 times after 1 minute of play.', current: scansUsed, target: 350, reward: 15, category: 'skills' },
        { id: 'hundred-scans', title: 'Nothing Gets Past Me', detail: 'Use Scan 500 times after 1 minute of play.', current: scansUsed, target: 500, reward: 15, category: 'skills' },
    ];
    const nudgeMilestones: AchievementDefinition[] = [
        { id: 'one-nudge-cell', title: 'Gentle Hint', detail: 'Tap 1 Nudge-highlighted cell.', current: nudgeCellClicks, target: 1, reward: 5, category: 'skills' },
        { id: 'five-nudge-cells', title: 'Small Push', detail: 'Tap 5 Nudge-highlighted cells.', current: nudgeCellClicks, target: 5, reward: 10, category: 'skills' },
        { id: 'ten-nudge-cells', title: 'Right on Cue', detail: 'Tap 10 Nudge-highlighted cells.', current: nudgeCellClicks, target: 10, reward: 10, category: 'skills' },
        { id: 'fifteen-nudge-cells', title: 'Taking the Hint', detail: 'Tap 15 Nudge-highlighted cells.', current: nudgeCellClicks, target: 15, reward: 10, category: 'skills' },
        { id: 'twenty-nudge-cells', title: 'Subtle Signal', detail: 'Tap 20 Nudge-highlighted cells.', current: nudgeCellClicks, target: 20, reward: 10, category: 'skills' },
        { id: 'thirty-nudge-cells', title: 'Friendly Reminder', detail: 'Tap 30 Nudge-highlighted cells.', current: nudgeCellClicks, target: 30, reward: 10, category: 'skills' },
        { id: 'forty-nudge-cells', title: 'Helpful Glow', detail: 'Tap 40 Nudge-highlighted cells.', current: nudgeCellClicks, target: 40, reward: 10, category: 'skills' },
        { id: 'fifty-nudge-cells', title: 'Nudge Regular', detail: 'Tap 50 Nudge-highlighted cells.', current: nudgeCellClicks, target: 50, reward: 15, category: 'skills' },
        { id: 'seventy-five-nudge-cells', title: 'Guiding Light', detail: 'Tap 75 Nudge-highlighted cells.', current: nudgeCellClicks, target: 75, reward: 15, category: 'skills' },
        { id: 'hundred-nudge-cells', title: 'Hint Whisperer', detail: 'Tap 100 Nudge-highlighted cells.', current: nudgeCellClicks, target: 100, reward: 15, category: 'skills' },
    ];
    const noScanMilestones: AchievementDefinition[] = [
        { id: 'one-hard-no-scan', title: 'Own Eyes', detail: 'Win 1 puzzle on Hard or above without Scan.', current: hardNoScanWins, target: 1, reward: 5, category: 'skills' },
        { id: 'five-hard-no-scan', title: 'Looking Good', detail: 'Win 5 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 5, reward: 5, category: 'skills' },
        { id: 'ten-hard-no-scan', title: 'Clear Judgment', detail: 'Win 10 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 10, reward: 10, category: 'skills' },
        { id: 'twenty-five-hard-no-scan', title: 'Steady Confidence', detail: 'Win 25 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 25, reward: 10, category: 'skills' },
        { id: 'fifty-hard-no-scan', title: 'No Second Guess', detail: 'Win 50 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 50, reward: 10, category: 'skills' },
        { id: 'hundred-hard-no-scan', title: 'Self-Reliant', detail: 'Win 100 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 100, reward: 15, category: 'skills' },
        { id: 'two-hundred-hard-no-scan', title: 'Clear Mind', detail: 'Win 200 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 200, reward: 15, category: 'skills' },
        { id: 'three-fifty-hard-no-scan', title: 'Unassisted', detail: 'Win 350 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 350, reward: 20, category: 'skills' },
        { id: 'five-hundred-hard-no-scan', title: 'Pure Focus', detail: 'Win 500 puzzles on Hard or above without Scan.', current: hardNoScanWins, target: 500, reward: 25, category: 'skills' },
    ];
    const noteKeeperMilestones: AchievementDefinition[] = [
        { id: 'one-note-game', title: 'First Notes', detail: 'Complete 1 puzzle after using notes.', current: noteGamesWon, target: 1, reward: 5, category: 'skills' },
        { id: 'five-note-games', title: 'Pencil Ready', detail: 'Complete 5 puzzles after using notes.', current: noteGamesWon, target: 5, reward: 5, category: 'skills' },
        { id: 'ten-note-games', title: 'Note Taker', detail: 'Complete 10 puzzles after using notes.', current: noteGamesWon, target: 10, reward: 10, category: 'skills' },
        { id: 'twenty-five-note-games', title: 'Candidate Keeper', detail: 'Complete 25 puzzles after using notes.', current: noteGamesWon, target: 25, reward: 10, category: 'skills' },
        { id: 'fifty-note-games', title: 'Fine Print', detail: 'Complete 50 puzzles after using notes.', current: noteGamesWon, target: 50, reward: 10, category: 'skills' },
        { id: 'hundred-note-games', title: 'Pencil Habit', detail: 'Complete 100 puzzles after using notes.', current: noteGamesWon, target: 100, reward: 15, category: 'skills' },
        { id: 'two-hundred-note-games', title: 'Written Method', detail: 'Complete 200 puzzles after using notes.', current: noteGamesWon, target: 200, reward: 15, category: 'skills' },
        { id: 'three-fifty-note-games', title: 'Margin Master', detail: 'Complete 350 puzzles after using notes.', current: noteGamesWon, target: 350, reward: 20, category: 'skills' },
        { id: 'five-hundred-note-games', title: 'Note Keeper', detail: 'Complete 500 puzzles after using notes.', current: noteGamesWon, target: 500, reward: 25, category: 'skills' },
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
        selectCurrentMilestone(perfectMilestones),
        selectCurrentMilestone(replayMilestones),
        selectCurrentMilestone(scanMilestones),
        selectCurrentMilestone(nudgeMilestones),
        selectCurrentMilestone(noScanMilestones),
        selectCurrentMilestone(noteKeeperMilestones),
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
