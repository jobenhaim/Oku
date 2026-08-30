import { Difficulty, type Board, type CellValue } from '../types';
import { cloneHintBoard, createHintPlan, type HintPlan } from './hints';

export const DEV_HINT_PREVIEWS = [
    'last-number',
    'naked',
    'hidden',
    'locked',
    'locked-hidden',
    'pair',
    'pair-hidden',
    'hidden-pair',
    'hidden-pair-chain',
    'triple',
    'triple-hidden',
    'triple-chain',
    'x-wing',
    'x-wing-hidden',
    'x-wing-chain',
    'xy-wing',
    'xy-wing-hidden',
    'xy-wing-chain',
    'color-chain',
    'color-chain-wrap',
    'chain',
] as const;

export type DevHintPreview = typeof DEV_HINT_PREVIEWS[number];

export const isDevHintPreview = (value: string | null): value is DevHintPreview => (
    value !== null && DEV_HINT_PREVIEWS.includes(value as DevHintPreview)
);

export interface DevHintPreviewState {
    board: Board;
    plan: HintPlan;
}

const PREVIEW_PUZZLES: Record<DevHintPreview, { difficulty: Difficulty; levelId: number }> = {
    'last-number': { difficulty: Difficulty.SuperEasy, levelId: 1 },
    naked: { difficulty: Difficulty.SuperEasy, levelId: 4 },
    hidden: { difficulty: Difficulty.Easy, levelId: 42 },
    locked: { difficulty: Difficulty.Hard, levelId: 2 },
    'locked-hidden': { difficulty: Difficulty.Hard, levelId: 4 },
    pair: { difficulty: Difficulty.Hard, levelId: 84 },
    'pair-hidden': { difficulty: Difficulty.Hard, levelId: 37 },
    'hidden-pair': { difficulty: Difficulty.Impossible, levelId: 84 },
    'hidden-pair-chain': { difficulty: Difficulty.Intense, levelId: 177 },
    triple: { difficulty: Difficulty.Intense, levelId: 145 },
    'triple-hidden': { difficulty: Difficulty.Impossible, levelId: 74 },
    'triple-chain': { difficulty: Difficulty.Intense, levelId: 99 },
    'x-wing': { difficulty: Difficulty.Impossible, levelId: 153 },
    'x-wing-hidden': { difficulty: Difficulty.Impossible, levelId: 130 },
    'x-wing-chain': { difficulty: Difficulty.Impossible, levelId: 65 },
    'xy-wing': { difficulty: Difficulty.Intense, levelId: 84 },
    'xy-wing-hidden': { difficulty: Difficulty.Intense, levelId: 248 },
    'xy-wing-chain': { difficulty: Difficulty.Intense, levelId: 287 },
    'color-chain': { difficulty: Difficulty.Impossible, levelId: 10 },
    'color-chain-wrap': { difficulty: Difficulty.Impossible, levelId: 13 },
    chain: { difficulty: Difficulty.Hard, levelId: 35 },
};

export const getDevHintPreviewPuzzle = (preview: DevHintPreview) => {
    const puzzle = PREVIEW_PUZZLES[preview];
    if (!puzzle) throw new Error(`Unknown Hint preview: ${preview}`);
    return puzzle;
};

export const scopeDevHintPreview = (
    preview: DevHintPreview | null | undefined,
    difficulty: Difficulty | null | undefined,
    levelId: number | null | undefined,
): DevHintPreview | undefined => {
    if (!preview || !difficulty || levelId === null || levelId === undefined) {
        return undefined;
    }

    const puzzle = getDevHintPreviewPuzzle(preview);
    return puzzle.difficulty === difficulty && puzzle.levelId === levelId
        ? preview
        : undefined;
};

const LOCKED_PUZZLE = (
    '020687543/854213697/376004128/260030954/040020300/'
    + '530046872/482000709/690072400/710400200'
);

const LOCKED_SOLUTION = (
    '129687543/854213697/376594128/267138954/948725316/'
    + '531946872/482351769/695872431/713469285'
);

const LAST_NUMBER_PUZZLE = (
    '109604000/800071020/700903040/002468307/083010260/'
    + '671239058/306007892/950342600/017806030'
);

const LAST_NUMBER_SOLUTION = (
    '139624785/864571923/725983146/592468317/483715269/'
    + '671239458/346157892/958342671/217896534'
);

const NAKED_SINGLE_PUZZLE = (
    '520008903/034500087/700203105/302496800/085030406/'
    + '000850709/607925008/213680004/850304670'
);

const NAKED_SINGLE_SOLUTION = (
    '526178943/134569287/798243165/372496851/985731426/'
    + '461852739/647925318/213687594/859314672'
);

const HIDDEN_SINGLE_PUZZLE = (
    '015927040/000500200/602003590/000100700/900000403/'
    + '007059182/208360910/100208070/593700820'
);

const HIDDEN_SINGLE_SOLUTION = (
    '315927648/749586231/682413597/826134759/951872463/'
    + '437659182/278365914/164298375/593741826'
);

const LOCKED_HIDDEN_PUZZLE = (
    '876941325/030852976/259637100/060083210/700429560/'
    + '002016000/607090830/090060050/020370691'
);

const LOCKED_HIDDEN_SOLUTION = (
    '876941325/134852976/259637184/465783219/713429568/'
    + '982516743/647195832/391268457/528374691'
);

const NAKED_PAIR_PUZZLE = (
    '036008004/085900003/027031005/600007090/000049506/'
    + '090060010/003000250/209080637/000003040'
);

const NAKED_PAIR_SOLUTION = (
    '936758124/185924763/427631985/658317492/312849576/'
    + '794562318/873496251/249185637/561273849'
);

const NAKED_PAIR_HIDDEN_PUZZLE = (
    '700530009/630010020/450080000/840070653/300060090/'
    + '960000200/184020900/576098012/293100070'
);

const NAKED_PAIR_HIDDEN_SOLUTION = (
    '728536149/639714528/451289367/842971653/315862794/'
    + '967453281/184627935/576398412/293145876'
);

const MULTI_STEP_PUZZLE = (
    '000768093/897023650/030059070/008300000/975612000/'
    + '340805000/713586000/402901006/009200010'
);

const MULTI_STEP_SOLUTION = (
    '251768493/897423651/634159872/128347965/975612384/'
    + '346895127/713586249/482971536/569234718'
);

const HIDDEN_PAIR_PUZZLE = (
    '348007090/951240003/627390014/070000000/012930050/'
    + '060870100/795423001/236781040/184659300'
);

const HIDDEN_PAIR_SOLUTION = (
    '348517296/951246783/627398514/579162438/812934657/'
    + '463875129/795423861/236781945/184659372'
);

const HIDDEN_PAIR_CHAIN_PUZZLE = (
    '004000087/000004032/000085100/600807200/048052070/'
    + '700410805/597328400/003040709/410079308'
);

const HIDDEN_PAIR_CHAIN_SOLUTION = (
    '954231687/871964532/362785194/635897241/148652973/'
    + '729413865/597328416/283146759/416579328'
);

const NAKED_TRIPLE_PUZZLE = (
    '000000376/703000548/050073129/806000431/000000095/'
    + '501000702/000769204/020384007/007512003'
);

const NAKED_TRIPLE_SOLUTION = (
    '912845376/763921548/458673129/896257431/274136895/'
    + '531498762/385769214/129384657/647512983'
);

const NAKED_TRIPLE_HIDDEN_PUZZLE = (
    '000700201/510632000/247109003/400501030/020000710/'
    + '301806000/700400100/000017904/104000300'
);

const NAKED_TRIPLE_HIDDEN_SOLUTION = (
    '963784251/518632497/247159863/489571632/625943718/'
    + '371826549/732495186/856317924/194268375'
);

const NAKED_TRIPLE_CHAIN_PUZZLE = (
    '130680070/680000310/470139086/007001625/060700840/'
    + '000006790/000905060/000060030/006000057'
);

const NAKED_TRIPLE_CHAIN_SOLUTION = (
    '135684972/689527314/472139586/347891625/961752843/'
    + '528346791/213975468/754268139/896413257'
);

const X_WING_PUZZLE = (
    '320040085/089530240/405280300/874952613/500473800/'
    + '932168574/058394100/293010458/040825030'
);

const X_WING_SOLUTION = (
    '327641985/689537241/415289367/874952613/561473892/'
    + '932168574/758394126/293716458/146825739'
);

const X_WING_HIDDEN_PUZZLE = (
    '000051326/005006874/002000951/051843000/300500140/'
    + '070019583/500000000/090105008/003000205'
);

const X_WING_HIDDEN_SOLUTION = (
    '789451326/135296874/642387951/951843762/368572149/'
    + '274619583/526938417/497125638/813764295'
);

const X_WING_CHAIN_PUZZLE = (
    '491562800/726813594/300479261/630190002/002380006/'
    + '070624050/063058009/000031620/007046005'
);

const X_WING_CHAIN_SOLUTION = (
    '491562837/726813594/358479261/634195782/512387946/'
    + '879624153/163258479/945731628/287946315'
);

const XY_WING_PUZZLE = (
    '340192060/512786934/090354100/125670403/009043051/'
    + '483015670/000431008/004060310/831020046'
);

const XY_WING_SOLUTION = (
    '347192865/512786934/698354127/125679483/769843251/'
    + '483215679/256431798/974568312/831927546'
);

const XY_WING_HIDDEN_PUZZLE = (
    '080300204/200084000/140792085/021073469/060009000/'
    + '700060003/478030900/000108706/610907508'
);

const XY_WING_HIDDEN_SOLUTION = (
    '985316274/237584691/146792385/521873469/863459127/'
    + '794261853/478635912/359128746/612947538'
);

const XY_WING_CHAIN_PUZZLE = (
    '001000005/000150070/500704103/020069007/000580624/'
    + '600200000/060000030/800603041/300005096'
);

const XY_WING_CHAIN_SOLUTION = (
    '271398465/483156972/596724183/128469357/937581624/'
    + '645237819/764912538/859673241/312845796'
);

const COLOR_CHAIN_PUZZLE = (
    '070006800/000080793/080379000/700900000/020063907/'
    + '090708401/010832674/260417509/007695000'
);

const COLOR_CHAIN_SOLUTION = (
    '973246815/642581793/185379246/751924368/824163957/'
    + '396758421/519832674/268417539/437695182'
);

const COLOR_CHAIN_WRAP_PUZZLE = (
    '300200100/180305920/207100000/400630000/620504000/'
    + '035021649/560013090/012006435/003052800'
);

const COLOR_CHAIN_WRAP_SOLUTION = (
    '356297184/184365927/297148563/471639258/629584371/'
    + '835721649/568413792/912876435/743952816'
);

const parseGrid = (source: string): number[][] => source.split('/').map(row => (
    [...row].map(value => Number(value))
));

const makeBoard = (grid: number[][]): Board => grid.map((row, rowIndex) => (
    row.map((value, colIndex) => ({
        row: rowIndex,
        col: colIndex,
        value: (value === 0 ? null : value) as CellValue,
        isFixed: value !== 0,
        notes: [],
        isError: false,
    }))
));

/**
 * A deterministic mid-game fixture used only by the local Hint Theater URL.
 * Each fixture shares its assigned production level's solution so the preview
 * can return to normal, playable in-memory gameplay after placing the number.
 */
export const createDevHintPreview = (preview: DevHintPreview): DevHintPreviewState => {
    const fixtures = {
        'last-number': {
            puzzle: LAST_NUMBER_PUZZLE,
            solution: LAST_NUMBER_SOLUTION,
            technique: 'nakedSingle' as const,
            techniqueLabel: 'Last number',
            derivedResult: undefined,
        },
        naked: {
            puzzle: NAKED_SINGLE_PUZZLE,
            solution: NAKED_SINGLE_SOLUTION,
            technique: 'nakedSingle' as const,
            techniqueLabel: 'One number fits',
            derivedResult: undefined,
        },
        hidden: {
            puzzle: HIDDEN_SINGLE_PUZZLE,
            solution: HIDDEN_SINGLE_SOLUTION,
            technique: 'hiddenSingle' as const,
            techniqueLabel: 'Only one place',
            derivedResult: undefined,
        },
        locked: {
            puzzle: LOCKED_PUZZLE,
            solution: LOCKED_SOLUTION,
            technique: 'lockedCandidate' as const,
            techniqueLabel: 'Locked candidate',
            derivedResult: 'naked' as const,
        },
        'locked-hidden': {
            puzzle: LOCKED_HIDDEN_PUZZLE,
            solution: LOCKED_HIDDEN_SOLUTION,
            technique: 'lockedCandidate' as const,
            techniqueLabel: 'Locked candidate',
            derivedResult: 'hidden' as const,
        },
        pair: {
            puzzle: NAKED_PAIR_PUZZLE,
            solution: NAKED_PAIR_SOLUTION,
            technique: 'nakedPair' as const,
            techniqueLabel: 'Naked pair',
            derivedResult: 'naked' as const,
        },
        'pair-hidden': {
            puzzle: NAKED_PAIR_HIDDEN_PUZZLE,
            solution: NAKED_PAIR_HIDDEN_SOLUTION,
            technique: 'nakedPair' as const,
            techniqueLabel: 'Naked pair',
            derivedResult: 'hidden' as const,
        },
        'hidden-pair': {
            puzzle: HIDDEN_PAIR_PUZZLE,
            solution: HIDDEN_PAIR_SOLUTION,
            technique: 'hiddenPair' as const,
            techniqueLabel: 'Hidden pair',
            derivedResult: 'hidden' as const,
        },
        'hidden-pair-chain': {
            puzzle: HIDDEN_PAIR_CHAIN_PUZZLE,
            solution: HIDDEN_PAIR_CHAIN_SOLUTION,
            technique: 'multiStep' as const,
            techniqueLabel: 'Step by step',
            derivedResult: 'hidden' as const,
        },
        triple: {
            puzzle: NAKED_TRIPLE_PUZZLE,
            solution: NAKED_TRIPLE_SOLUTION,
            technique: 'nakedTriple' as const,
            techniqueLabel: 'Naked triple',
            derivedResult: 'naked' as const,
        },
        'triple-hidden': {
            puzzle: NAKED_TRIPLE_HIDDEN_PUZZLE,
            solution: NAKED_TRIPLE_HIDDEN_SOLUTION,
            technique: 'nakedTriple' as const,
            techniqueLabel: 'Naked triple',
            derivedResult: 'hidden' as const,
        },
        'triple-chain': {
            puzzle: NAKED_TRIPLE_CHAIN_PUZZLE,
            solution: NAKED_TRIPLE_CHAIN_SOLUTION,
            technique: 'multiStep' as const,
            techniqueLabel: 'Step by step',
            derivedResult: 'naked' as const,
        },
        'x-wing': {
            puzzle: X_WING_PUZZLE,
            solution: X_WING_SOLUTION,
            technique: 'xWing' as const,
            techniqueLabel: 'X-Wing',
            derivedResult: 'naked' as const,
        },
        'x-wing-hidden': {
            puzzle: X_WING_HIDDEN_PUZZLE,
            solution: X_WING_HIDDEN_SOLUTION,
            technique: 'xWing' as const,
            techniqueLabel: 'X-Wing',
            derivedResult: 'hidden' as const,
        },
        'x-wing-chain': {
            puzzle: X_WING_CHAIN_PUZZLE,
            solution: X_WING_CHAIN_SOLUTION,
            technique: 'multiStep' as const,
            techniqueLabel: 'Step by step',
            derivedResult: 'naked' as const,
        },
        'xy-wing': {
            puzzle: XY_WING_PUZZLE,
            solution: XY_WING_SOLUTION,
            technique: 'xyWing' as const,
            techniqueLabel: 'XY-Wing',
            derivedResult: 'naked' as const,
        },
        'xy-wing-hidden': {
            puzzle: XY_WING_HIDDEN_PUZZLE,
            solution: XY_WING_HIDDEN_SOLUTION,
            technique: 'xyWing' as const,
            techniqueLabel: 'XY-Wing',
            derivedResult: 'hidden' as const,
        },
        'xy-wing-chain': {
            puzzle: XY_WING_CHAIN_PUZZLE,
            solution: XY_WING_CHAIN_SOLUTION,
            technique: 'multiStep' as const,
            techniqueLabel: 'Step by step',
            derivedResult: 'hidden' as const,
        },
        'color-chain': {
            puzzle: COLOR_CHAIN_PUZZLE,
            solution: COLOR_CHAIN_SOLUTION,
            technique: 'simpleColoring' as const,
            techniqueLabel: 'Color chain',
            derivedResult: 'naked' as const,
        },
        'color-chain-wrap': {
            puzzle: COLOR_CHAIN_WRAP_PUZZLE,
            solution: COLOR_CHAIN_WRAP_SOLUTION,
            technique: 'simpleColoring' as const,
            techniqueLabel: 'Color chain',
            derivedResult: 'naked' as const,
        },
        chain: {
            puzzle: MULTI_STEP_PUZZLE,
            solution: MULTI_STEP_SOLUTION,
            technique: 'multiStep' as const,
            techniqueLabel: 'Step by step',
            derivedResult: 'naked' as const,
        },
    } satisfies Record<DevHintPreview, {
        puzzle: string;
        solution: string;
        technique: HintPlan['technique'];
        techniqueLabel: string;
        derivedResult: HintPlan['derivedResult'];
    }>;
    const fixture = fixtures[preview];

    const board = makeBoard(parseGrid(fixture.puzzle));
    const result = createHintPlan(board, parseGrid(fixture.solution));
    if (
        result.status !== 'ready'
        || result.plan.technique !== fixture.technique
        || result.plan.techniqueLabel !== fixture.techniqueLabel
        || result.plan.derivedResult !== fixture.derivedResult
    ) {
        throw new Error(`${preview} Hint preview fixture is no longer supported`);
    }

    return {
        board: cloneHintBoard(board),
        plan: result.plan,
    };
};
