import React from 'react';
import { Grid3X3 } from 'lucide-react';
import { Icons } from './Icons';
import { MAIN_TABS, type MainTab } from '../../utils/navigation';

const TAB_ICONS = { difficulty: Grid3X3, store: Icons.Store, diamondShop: Icons.Star, stats: Icons.BarChart, profile: Icons.User };

export const BottomNavigation: React.FC<{
    selected: MainTab;
    onSelect: (tab: MainTab) => void;
    disabled?: boolean;
    shopBadge: boolean;
    profileBadge: boolean;
}> = ({ selected, onSelect, disabled, shopBadge, profileBadge }) => (
    <nav aria-label="Main navigation" className="oku-bottom-navigation">
        {MAIN_TABS.map(tab => {
            const Icon = TAB_ICONS[tab.id];
            const badge = tab.id === 'diamondShop' ? shopBadge : tab.id === 'profile' ? profileBadge : false;
            return <button key={tab.id} type="button" aria-current={selected === tab.id ? 'page' : undefined}
                aria-label={`${tab.label}${badge ? ', reward available' : ''}`} disabled={disabled}
                onClick={() => onSelect(tab.id)} className="oku-navigation-item">
                <span className="relative"><Icon aria-hidden="true" />{badge && <span className="oku-navigation-badge" />}</span>
                <span>{tab.label}</span>
            </button>;
        })}
    </nav>
);
