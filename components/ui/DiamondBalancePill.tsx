import React from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { Icons } from './Icons';

interface DiamondBalancePillProps {
    points: number;
    className?: string;
}

export const DiamondBalancePill: React.FC<DiamondBalancePillProps> = ({ points, className = '' }) => (
    <div
        className={`relative z-30 inline-flex h-10 min-w-[76px] items-center justify-center gap-1.5 rounded-full border border-stone-200/70 bg-white/95 px-3 shadow-sm dark:border-stone-700 dark:bg-stone-800/95 ${className}`}
        aria-label={`${points} diamonds`}
    >
        <AnimatedNumber
            value={points}
            easing="easeOut"
            durationMs={1000}
            className="text-[15px] font-bold leading-none tracking-normal text-t-primary tabular-nums"
        />
        <Icons.Diamond className="h-3.5 w-3.5 shrink-0 fill-current text-blue-500" />
    </div>
);
