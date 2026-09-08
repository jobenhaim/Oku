export const TABBED_NAVIGATION_ENABLED = import.meta.env.VITE_OKU_NAVIGATION !== 'legacy';

export const MAIN_TABS = [
    { id: 'difficulty', label: 'Play' },
    { id: 'store', label: 'Market' },
    { id: 'diamondShop', label: 'Oku Shop' },
    { id: 'stats', label: 'Stats' },
    { id: 'profile', label: 'Profile' },
] as const;

export type MainTab = typeof MAIN_TABS[number]['id'];
export const isMainTab = (value: string): value is MainTab => MAIN_TABS.some(tab => tab.id === value);
export const tabForScreen = (screen: string): MainTab | null => (
    screen === 'levels' ? 'difficulty' : isMainTab(screen) ? screen : null
);
