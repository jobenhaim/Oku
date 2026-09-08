import React from 'react';
import { DiamondBalancePill } from './DiamondBalancePill';
import { Icons } from './Icons';

export const MainScreenHeader: React.FC<{
    title?: string;
    points: number;
    onSettings: () => void;
}> = ({ title, points, onSettings }) => (
    <header className="oku-main-header">
        <DiamondBalancePill points={points} />
        {title && <h1 className="text-xl md:text-2xl font-bold text-t-primary leading-none">{title}</h1>}
        <button onClick={onSettings} aria-label="Settings" className="oku-header-settings text-t-icon">
            <Icons.Settings className="w-6 h-6" />
        </button>
    </header>
);
