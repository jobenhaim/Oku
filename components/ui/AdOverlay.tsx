
import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

interface AdOverlayProps {
    onComplete: () => void;
}

export const AdOverlay: React.FC<AdOverlayProps> = ({ onComplete }) => {
    const [timeLeft, setTimeLeft] = useState(5);
    const [canClose, setCanClose] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setCanClose(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const handleClose = () => {
        if (canClose) {
            onComplete();
        }
    };

    const handleAdClick = () => {
        // Simulate clicking an ad - normally this opens the App Store
        window.open('https://google.com', '_blank');
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center text-white overflow-hidden animate-fade-in">
            {/* Top Bar: Timer & Close */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-end items-start z-50 pt-safe-top">
                {canClose ? (
                    <button 
                        onClick={handleClose}
                        className="bg-white/20 backdrop-blur-md rounded-full p-2 hover:bg-white/30 active:scale-95 transition animate-pop"
                    >
                        <Icons.Close className="w-6 h-6 text-white" />
                    </button>
                ) : (
                    <div className="bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-white/80 border border-white/10">
                        <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                        Reward in {timeLeft}s
                    </div>
                )}
            </div>

            {/* AD CONTENT: "Nebula Jump" (Fake Game Ad) */}
            <div className="w-full h-full relative bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 flex flex-col">
                
                {/* Background Animation */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                    
                    {/* Stars */}
                    {[...Array(20)].map((_, i) => (
                        <div 
                            key={i}
                            className="absolute bg-white rounded-full animate-twinkle"
                            style={{
                                width: Math.random() * 3 + 'px',
                                height: Math.random() * 3 + 'px',
                                top: Math.random() * 100 + '%',
                                left: Math.random() * 100 + '%',
                                opacity: Math.random(),
                                animationDelay: Math.random() * 5 + 's',
                                animationDuration: Math.random() * 3 + 2 + 's'
                            }}
                        />
                    ))}
                </div>

                {/* Game Gameplay Mockup (Center) */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-8">
                    <div className="w-full max-w-xs aspect-[9/16] bg-stone-900 rounded-3xl shadow-2xl border-4 border-stone-800 relative overflow-hidden flex flex-col items-center justify-center group cursor-pointer" onClick={handleAdClick}>
                        {/* Fake Game Scene */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800">
                            {/* Platforms */}
                            <div className="absolute bottom-20 left-10 w-20 h-4 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
                            <div className="absolute bottom-48 right-10 w-20 h-4 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
                            <div className="absolute top-32 left-16 w-20 h-4 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
                            
                            {/* Character (Bouncing) */}
                            <div className="absolute bottom-24 left-16 w-8 h-8 bg-white rounded-lg animate-bounce shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-black rounded-full mr-1"></div>
                                    <div className="w-2 h-2 bg-black rounded-full"></div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Overlay Text */}
                        <div className="absolute top-10 inset-x-0 text-center">
                            <h2 className="text-3xl font-black text-white italic tracking-wider drop-shadow-lg" style={{ textShadow: '0 4px 0 #4c1d95' }}>
                                NEBULA<br/>JUMP
                            </h2>
                        </div>

                        {/* Finger Hint */}
                        <div className="absolute bottom-10 inset-x-0 flex justify-center opacity-80 animate-pulse">
                            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-white/20">
                                Tap to Play
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar: CTA */}
                <div className="bg-white text-stone-900 p-4 pb-8 flex items-center gap-4 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-slide-up">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                        <Icons.Gamepad className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-sm leading-tight">Nebula Jump: Cosmic Run</h3>
                        <p className="text-xs text-stone-500 font-medium">Free to Play &bull; 4.8 <span className="text-amber-500">★</span></p>
                    </div>
                    <button 
                        onClick={handleAdClick}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 active:scale-95 transition hover:bg-blue-700"
                    >
                        INSTALL
                    </button>
                </div>
            </div>
            
            {/* Ad Label */}
            <div className="absolute top-4 left-4 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-white/50 border border-white/10 z-50">
                AD
            </div>
        </div>
    );
};
