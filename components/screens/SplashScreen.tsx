
import React from 'react';
import { Logo } from '../ui/Logo';

export const SplashScreen: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-900 z-20 absolute inset-0">
            <div className="animate-pop">
                <Logo size={120} className="mb-8 drop-shadow-xl" />
            </div>
            <h1 className="text-5xl font-bold tracking-[0.2em] text-stone-800 dark:text-stone-100 ml-[0.2em]">OKU</h1>
        </div>
    );
};
