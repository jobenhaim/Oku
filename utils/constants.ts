
import { Difficulty, DiamondOffer } from '../types';
import { Icons } from '../components/ui/Icons';

// --- GOLDEN SEEDS ---
// These seeds are pre-mined. They guarantee a valid, unique puzzle with 20-23 clues.
// This allows "Impossible" levels to load INSTANTLY without freezing the phone.
export const IMPOSSIBLE_SEEDS = [
    // Pack 1 (Levels 1-100)
    36, 57, 101, 129, 153, 160, 169, 237, 435, 471, 
    594, 598, 665, 692, 874, 1221, 1368, 1499, 1584, 1674, 
    1728, 2032, 2058, 2077, 2078, 2143, 2187, 2191, 2233, 2614, 
    2738, 2739, 2742, 2760, 2811, 2823, 2829, 2838, 2930, 2964, 
    2970, 3068, 3209, 3266, 3359, 3368, 3377, 3510, 3785, 3949, 
    4042, 4141, 4264, 4300, 4319, 4425, 4462, 4527, 4641, 4651, 
    4798, 4861, 4873, 4946, 5090, 5144, 5294, 5312, 5368, 5418, 
    5744, 5782, 5824, 5855, 5882, 5973, 6149, 6181, 6207, 6274, 
    6290, 6306, 6310, 6509, 6559, 6599, 6635, 6756, 6867, 6938, 
    7009, 7053, 7354, 7511, 7579, 7597, 7681, 7692,
    
    // Pack 2 (Levels 101-200)
    7708, 7718, 7790, 8098, 8233, 8442, 8616, 8691, 8753, 8789, 
    8961, 9093, 9129, 9182, 9228, 9290, 9536, 9581, 9611, 9853, 
    9903, 9946, 10036, 10043, 10046, 10089, 10135, 10174, 10181, 10203, 
    10248, 10321, 10429, 10506, 10538, 10627, 10667, 10706, 10758, 10787, 
    11001, 11066, 11141, 11169, 11216, 11228, 11248, 11252, 11391, 11516, 
    11518, 11580, 11598, 11697, 11800, 11879, 11894, 12117, 12149, 12442, 
    12634, 12735, 12786, 12816, 12872, 12937, 12952, 13091, 13232, 13269, 
    13295, 13332, 13471, 13596, 13608, 13625, 13779, 13960, 13981, 14046, 
    14126, 14221, 14397, 14467, 14858, 14861, 14980, 15179, 15336, 15379, 
    15426, 15433, 15438, 15678, 15682, 16101,

    // Pack 3 (Levels 201-300)
    16114, 16269, 16342, 16547, 16562, 16654, 16769, 16816, 16915, 16937, 
    16944, 17069, 17115, 17159, 17194, 17203, 17208, 17427, 17431, 17498, 
    17509, 17536, 17551, 17629, 17768, 17795, 17835, 17918, 18070, 18076, 
    18143, 18169, 18171, 18248, 18276, 18317, 18641, 18648, 18672, 18732, 
    18831, 18861, 18960, 19111, 19159, 19317, 19333, 19529, 19722, 19808, 
    19842, 19873, 20004, 20182, 20331, 20461, 20515, 20557, 20586, 20589, 
    20667, 20803, 20825, 20927, 21019, 21087, 21156, 21459, 21460, 21463, 
    21479, 21506, 21597, 21600, 21601, 21681, 21789, 21794, 22206, 22230, 
    22330, 22384, 22513, 22530, 22547, 22635, 22663, 22897, 22941, 22993, 
    23105, 23140, 23154, 23183, 23209, 23329, 23488, 23517, 23566, 23642, 
    23854, 23951, 23975, 23991, 24032, 24041
];

export const DIFFICULTY_DESCRIPTIONS = {
    [Difficulty.SuperEasy]: [
        "A relaxing start. Great for learning the basics.",
        "Like a gentle breeze for your brain.",
        "No stress. Just numbers finding their homes.",
        "Smooth sailing. Perfect for a quick win.",
        "Warm up your neurons gently."
    ],
    [Difficulty.Easy]: [
        "Just enough clues to keep moving forward.",
        "A nice, pleasant walk through logic park.",
        "Good for a quick mental snack.",
        "Simple patterns. No guessing needed.",
        "Keep the flow going. Nice and steady."
    ],
    [Difficulty.Normal]: [
        "A fair fight. Look beyond single cells.",
        "Not too hard, not too soft. Just right.",
        "Time to focus. Don't get too comfortable.",
        "You might actually need to think a bit.",
        "Standard difficulty. Balanced and reasonable."
    ],
    [Difficulty.Hard]: [
        "You will need notes to spot hidden pairs.",
        "Okay, playtime is over. Get serious.",
        "The board is starting to fight back.",
        "Mistakes made here will cost you later.",
        "Hope you brought your thinking cap."
    ],
    [Difficulty.Intense]: [
        "Extremely empty boards. Very few clues.",
        "Pack a lunch. You will be here a while.",
        "Only for the stubborn. Persistence is key.",
        "It is okay to cry. We will not judge.",
        "Good luck finding a place to start."
    ],
    [Difficulty.Impossible]: [
        "The ultimate test. Absolute precision required.",
        "The logical equivalent of stepping on a Lego.",
        "Hope you cancelled your plans for the weekend.",
        "Even the computer hesitated before generating this.",
        "This might actually break your brain."
    ],
};

const PACK_BASE_COST = {
    [Difficulty.SuperEasy]: 500,
    [Difficulty.Easy]: 1000,
    [Difficulty.Normal]: 1500,
    [Difficulty.Hard]: 2000,
    [Difficulty.Intense]: 3000,
    [Difficulty.Impossible]: 5000,
};

export const getPackCost = (difficulty: Difficulty, packIndex: number): number => {
    let cost = PACK_BASE_COST[difficulty] || 0;
    
    // Pack 2 is the base (Levels 101-200). Pack 1 is included.
    if (packIndex <= 2) return cost;

    // Calculate cost for Pack 3+ iteratively
    for (let i = 3; i <= packIndex; i++) {
        // Increase by 15%
        const increased = cost * 1.15;
        // Round to nearest multiple of 10
        cost = Math.round(increased / 10) * 10;
    }
    
    return cost;
};

export const getDifficultyPoints = (diff: Difficulty) => {
    switch(diff) {
        case Difficulty.SuperEasy: return 5;
        case Difficulty.Easy: return 10;
        case Difficulty.Normal: return 15;
        case Difficulty.Hard: return 20;
        case Difficulty.Intense: return 30;
        case Difficulty.Impossible: return 50;
        default: return 0;
    }
};

export const STATIC_BACKGROUNDS = [
    { id: 'bg-default', name: 'Default', cost: 0, class: 'bg-paper dark:bg-stone-900' },
    { id: 'bg-dawn', name: 'Dawn', cost: 100, class: 'bg-gradient-to-br from-orange-100 to-rose-100' },
    { id: 'bg-ocean', name: 'Ocean', cost: 100, class: 'bg-gradient-to-br from-sky-100 to-cyan-200' },
    { id: 'bg-forest', name: 'Forest', cost: 100, class: 'bg-gradient-to-br from-green-100 to-emerald-200' },
    { id: 'bg-dusk', name: 'Dusk', cost: 100, class: 'bg-gradient-to-br from-indigo-100 to-slate-300' },
    { id: 'bg-dune', name: 'Dune', cost: 100, class: 'bg-gradient-to-br from-amber-100 to-orange-100' },
    { id: 'bg-lavender', name: 'Lavender', cost: 100, class: 'bg-gradient-to-br from-purple-100 to-violet-200' },
    { id: 'bg-mint', name: 'Mint', cost: 100, class: 'bg-gradient-to-br from-emerald-50 to-teal-100' },
    { id: 'bg-berry', name: 'Berry', cost: 100, class: 'bg-gradient-to-br from-pink-100 to-rose-100' },
    { id: 'bg-glacier', name: 'Glacier', cost: 100, class: 'bg-gradient-to-br from-cyan-50 to-sky-100' },
];

export const DYNAMIC_BACKGROUNDS = [
    { id: 'bg-prism', name: 'Aurora', cost: 300, class: 'bg-atmosphere-aurora' },
    { id: 'bg-horizon', name: 'Canopy', cost: 300, class: 'bg-atmosphere-meadow' },
    { id: 'bg-coral', name: 'Sakura', cost: 300, class: 'bg-atmosphere-blush' },
    { id: 'bg-orbit', name: 'Sunroom', cost: 300, class: 'bg-atmosphere-golden' },
    { id: 'bg-flux', name: 'Fireflies', cost: 300, class: 'bg-atmosphere-platinum' },
];

export const ALL_BACKGROUNDS = [...STATIC_BACKGROUNDS, ...DYNAMIC_BACKGROUNDS];

export const NUMBER_COLORS = [
    { id: 'num-default', name: 'Default', cost: 0, class: 'text-blue-600 dark:text-blue-400', uiClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-50/50 dark:bg-blue-900/10' },
    { id: 'num-purple', name: 'Purple', cost: 125, class: 'text-purple-600 dark:text-purple-400', uiClass: 'text-purple-600 dark:text-purple-400', bgClass: 'bg-purple-50/50 dark:bg-purple-900/10' },
    { id: 'num-teal', name: 'Teal', cost: 125, class: 'text-cyan-600 dark:text-cyan-400', uiClass: 'text-cyan-600 dark:text-cyan-400', bgClass: 'bg-cyan-50/50 dark:bg-cyan-900/10' },
    { id: 'num-fuchsia', name: 'Fuchsia', cost: 125, class: 'text-pink-600 dark:text-pink-400', uiClass: 'text-pink-600 dark:text-pink-400', bgClass: 'bg-pink-50/50 dark:bg-pink-900/10' },
    { id: 'num-orange', name: 'Orange', cost: 125, class: 'text-orange-600 dark:text-orange-400', uiClass: 'text-orange-600 dark:text-orange-400', bgClass: 'bg-orange-50/50 dark:bg-orange-900/10' },
    { id: 'num-emerald', name: 'Emerald', cost: 125, class: 'text-emerald-600 dark:text-emerald-400', uiClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
    { id: 'num-rainbow', name: 'Rainbow', cost: 400, class: 'text-shine-rainbow', uiClass: 'text-shine-rainbow', bgClass: 'bg-stone-100/50 dark:bg-stone-800/50' },
    // Premium last
    { id: 'num-shine', name: 'Gold', cost: 600, class: 'text-shine-gold', uiClass: 'text-shine-gold', bgClass: 'bg-yellow-50/60 dark:bg-yellow-900/10' },
    { id: 'num-rgb', name: 'Diamond', cost: 600, class: 'text-shine-diamond', uiClass: 'text-shine-diamond', bgClass: 'bg-cyan-50/60 dark:bg-cyan-900/10' },
    { id: 'num-ruby', name: 'Ruby', cost: 600, class: 'text-shine-ruby', uiClass: 'text-shine-ruby', bgClass: 'bg-rose-50/60 dark:bg-rose-900/10' },
];

export const SOUND_PACKS = [
    { 
        id: 'snd-zen', 
        name: 'Zen', 
        cost: 0, 
        icon: Icons.Wind, 
        description: 'Our default theme. Crisp, clean clicks for pure focus.',
        colorClass: 'from-sky-200 to-teal-200 dark:from-sky-800 dark:to-teal-800',
        iconColor: 'text-sky-700 dark:text-sky-300'
    },
    { 
        id: 'snd-paper', 
        name: 'Paper', 
        cost: 200, 
        icon: Icons.Paper, 
        description: 'Like a pencil on heavy paper. Warm, textured, and cozy.',
        colorClass: 'from-stone-200 to-orange-200 dark:from-stone-700 dark:to-orange-900',
        iconColor: 'text-stone-600 dark:text-stone-300'
    },
    {
        id: 'snd-stone',
        name: 'Stone',
        cost: 200,
        icon: Icons.Stone,
        description: 'Deep, resonant thuds. Solid and grounding.',
        colorClass: 'from-stone-400 to-stone-600 dark:from-stone-600 dark:to-stone-800',
        iconColor: 'text-stone-800 dark:text-stone-200'
    },
    { 
        id: 'snd-water', 
        name: 'Water', 
        cost: 200, 
        icon: Icons.Water, 
        description: 'Refreshing droplets. Wet, bloopy, and relaxing.',
        colorClass: 'from-cyan-100 to-blue-100 dark:from-cyan-900 dark:to-blue-900',
        iconColor: 'text-cyan-600 dark:text-cyan-300'
    },
    {
        id: 'snd-mech',
        name: 'Type',
        cost: 200,
        icon: Icons.Keyboard,
        description: 'Tactile mechanical switches. Satisfying clicks.',
        colorClass: 'from-slate-200 to-slate-400 dark:from-slate-700 dark:to-slate-900',
        iconColor: 'text-slate-700 dark:text-slate-300'
    },
    {
        id: 'snd-retro',
        name: '8-Bit',
        cost: 400,
        icon: Icons.Gamepad,
        description: 'Classic arcade bleeps. Nostalgic and digital.',
        colorClass: 'from-green-300 to-purple-300 dark:from-green-800 dark:to-purple-800',
        iconColor: 'text-purple-600 dark:text-purple-400'
    },
    {
        id: 'snd-crystal',
        name: 'Crystal',
        cost: 400,
        icon: Icons.Crystal,
        description: 'Pure, resonant chimes. Sharp, clear, and bright.',
        colorClass: 'from-cyan-100 to-blue-100 dark:from-cyan-900 dark:to-blue-900',
        iconColor: 'text-cyan-600 dark:text-cyan-300'
    },
    { 
        id: 'snd-wood', 
        name: 'Wood', 
        cost: 400, 
        icon: Icons.Wood, 
        description: 'Solid, resonant knocks. Like tapping a hardwood desk.',
        colorClass: 'from-amber-200 to-yellow-200 dark:from-amber-800 dark:to-yellow-800',
        iconColor: 'text-amber-700 dark:text-amber-300'
    },
    { 
        id: 'snd-piano', 
        name: 'Piano', 
        cost: 700, 
        icon: Icons.Music, 
        description: 'Rich, melodic piano notes. Create harmony while you play.',
        colorClass: 'from-indigo-200 to-violet-200 dark:from-indigo-800 dark:to-violet-800',
        iconColor: 'text-indigo-700 dark:text-indigo-300'
    },
    {
        id: 'snd-koto',
        name: 'Koto',
        cost: 700,
        icon: Icons.Flower,
        description: 'Traditional Japanese strings. Sharp, resonant, and Zen.',
        colorClass: 'from-emerald-200 to-teal-200 dark:from-emerald-900 dark:to-teal-900',
        iconColor: 'text-emerald-700 dark:text-emerald-300'
    }
];

export const SKILLS = [
    { id: 'skill-auto', name: 'Auto', cost: 500, icon: Icons.Auto, class: 'text-amber-500', bgClass: 'bg-amber-50/60 dark:bg-amber-900/10', description: "Automatically fills a cell when it's the only option left." },
    { id: 'skill-scan', name: 'Scan', cost: 750, icon: Icons.Scan, class: 'text-red-500', bgClass: 'bg-red-50/60 dark:bg-red-900/10', description: "Spot errors instantly. Essential for Hard, Intense, and Impossible modes." },
    { id: 'skill-reveal', name: 'Reveal', cost: 1000, icon: Icons.Reveal, class: 'text-purple-500', bgClass: 'bg-purple-50/60 dark:bg-purple-900/10', description: "Reveals a correct number randomly. Available after one minute of play." },
];

export const DIAMOND_OFFERS: DiamondOffer[] = [
    // Premium Pack (Previously Support Developer)
    {
        id: 'support_dev',
        productId: 'com.oku.sudoku.iap.premiumpack',
        title: 'Oku Premium',
        subtitle: 'Pepino Companion + Rewards',
        diamonds: 1500,
        priceLabel: '$4.99',
        type: 'support',
        badge: 'PREMIUM'
    },
    // Starter
    {
        id: 'starter_pack',
        productId: 'com.oku.sudoku.iap.starterpack',
        title: 'Starter Pack',
        subtitle: 'Everything you need to begin',
        diamonds: 500,
        includes: ['Auto & Scan Skill Unlocked', 'Piano Sound Pack Unlocked'],
        badge: 'BEST VALUE',
        priceLabel: '$2.99',
        type: 'starter',
        gradientClass: 'bg-[#FFF5E1] border-amber-100'
    },
    // Packs
    { id: 'gem_300', productId: 'com.oku.sudoku.iap.diamonds300', title: 'Handful', diamonds: 300, priceLabel: '$0.99', type: 'pack' },
    { id: 'gem_1000', productId: 'com.oku.sudoku.iap.diamonds1000', title: 'Pouch', diamonds: 1000, priceLabel: '$1.99', type: 'pack' },
    { id: 'gem_2500', productId: 'com.oku.sudoku.iap.diamonds2500', title: 'Chest', diamonds: 2500, priceLabel: '$3.99', type: 'pack' },
    { id: 'gem_5000', productId: 'com.oku.sudoku.iap.diamonds5000', title: 'Vault', diamonds: 5000, priceLabel: '$6.99', type: 'pack' },
];

export function formatTimeShort(totalSeconds: number) {
    const total = Math.floor(totalSeconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
