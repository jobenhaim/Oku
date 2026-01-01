
import React from 'react';
import { Icons } from './Icons';

export const LandscapeBlocker: React.FC = () => {
    return (
        <div className="landscape-blocker fixed inset-0 z-[9999] bg-stone-900 text-white flex-col items-center justify-center p-8 text-center touch-none overscroll-none hidden">
            <div className="mb-6 animate-[spin_3s_ease-in-out_infinite]">
                <Icons.Smartphone className="w-16 h-16 text-stone-400" />
            </div>
            <h2 className="text-xl font-bold mb-2 tracking-wide">Rotate to Portrait</h2>
            <p className="text-stone-400 text-sm font-medium leading-relaxed max-w-[250px]">
                Oku is designed for a calm, portrait-only experience.
            </p>
        </div>
    );
};
