import React from 'react';

export const AdOverlay: React.FC = () => (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center text-white animate-fade-in">
        <div className="absolute top-8 right-8 text-stone-500 font-mono text-xs">ADVERTISEMENT</div>
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
        <h2 className="text-2xl font-bold tracking-widest">ADVERTISEMENT</h2>
        <p className="text-stone-400 mt-2 text-sm">Thanks for supporting us!</p>
    </div>
);
