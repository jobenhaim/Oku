import React from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { Icons } from './Icons';

interface DiamondBalancePillProps {
    points: number;
}

export const DiamondBalancePill: React.FC<DiamondBalancePillProps> = ({ points }) => (
    <div
        className="oku-diamond-balance relative z-30 inline-flex h-[35px] min-w-[67.5px] shrink-0 items-center justify-center gap-[5px] rounded-full border border-stone-200/70 bg-white/95 px-2.5 shadow-sm dark:border-stone-700 dark:bg-stone-800/95"
        aria-label={`${points} diamonds`}
    >
        <AnimatedNumber
            value={points}
            easing="easeOut"
            durationMs={1000}
            className="text-[13.75px] font-bold leading-none tracking-normal text-t-primary tabular-nums"
        />
        <Icons.Diamond className="h-[12.5px] w-[12.5px] shrink-0 fill-current text-blue-500" aria-hidden="true" />
    </div>
);
