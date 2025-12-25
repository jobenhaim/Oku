
import React from 'react';

interface SkillTooltipProps {
    text: string;
    isClosing: boolean;
}

export const SkillTooltip: React.FC<SkillTooltipProps> = ({ text, isClosing }) => {
    return (
        <div 
            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-32 z-[100] pointer-events-none origin-bottom ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
        >
            <div className="bg-white dark:bg-stone-100 text-stone-900 shadow-xl text-[10px] p-2 rounded-lg relative text-center leading-tight font-semibold border border-stone-200">
                {text}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-stone-100"></div>
            </div>
        </div>
    );
};
