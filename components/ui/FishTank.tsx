
import React, { useState, useEffect, useRef } from 'react';
import { Storage } from '../../utils/storage';
import { sounds } from '../../utils/sound';
import { Icons } from './Icons';
import { PepinoState } from '../../types';

interface FishTankProps {
    onRewardClaim: (amount: number, isPoop: boolean) => void;
    showIntro?: boolean;
}

export const FishTank: React.FC<FishTankProps> = ({ onRewardClaim, showIntro = false }) => {
    const [pepinoState, setPepinoState] = useState<PepinoState>(Storage.getPepinoState());
    const [isGiftReady, setIsGiftReady] = useState(false);
    const [poopVisible, setPoopVisible] = useState(false);
    
    // Reward Feedback State
    const [rewardFeedback, setRewardFeedback] = useState<{amount: number, isPoop: boolean} | null>(null);
    const [rewardExiting, setRewardExiting] = useState(false);
    
    // Intro State: 'waiting' (text visible) -> 'appearing' (fish pops in) -> 'active' (normal swim)
    const [introState, setIntroState] = useState<'waiting' | 'appearing' | 'active'>(
        showIntro ? 'waiting' : 'active'
    );
    
    // Fish movement state
    const [fishPos, setFishPos] = useState({ x: 50, y: 50 }); // Percentage
    const [fishDirection, setFishDirection] = useState<'left' | 'right'>('right');
    
    // Refs for animation logic to avoid stale closures
    const fishPosRef = useRef({ x: 50, y: 50 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle Intro Flow
    useEffect(() => {
        if (showIntro) {
            // 1. Wait 7 seconds with text overlay
            const timer1 = setTimeout(() => {
                setIntroState('appearing');
                
                // 2. Play Pop Sound as fish appears
                setTimeout(() => {
                    sounds.playPop(); 
                }, 100);

                // 3. Switch to fully active state after pop animation
                setTimeout(() => {
                    setIntroState('active');
                }, 600); 
            }, 7000);
            return () => clearTimeout(timer1);
        }
    }, [showIntro]);

    // Timer check
    useEffect(() => {
        const checkTime = () => {
            const now = Date.now();
            const readyTime = pepinoState.lastGiftTime + pepinoState.nextGiftDelay;
            
            if (now >= readyTime) {
                setIsGiftReady(true);
            } else {
                setIsGiftReady(false);
            }
        };

        checkTime();
        const interval = setInterval(checkTime, 5000); 
        return () => clearInterval(interval);
    }, [pepinoState]);

    // Random Swimming Logic
    useEffect(() => {
        let timeoutId: any;
        
        const moveFish = () => {
            const currentX = fishPosRef.current.x;
            
            // Generate new target position
            // X: 15-85% (avoid walls)
            const newX = 15 + Math.random() * 70;
            // Y: 20-80% (More vertical space now that sand is gone)
            const newY = 20 + Math.random() * 60; 
            
            // Determine direction based on CURRENT position vs NEW position
            const newDirection = newX > currentX ? 'right' : 'left';
            
            setFishDirection(newDirection);
            setFishPos({ x: newX, y: newY });
            
            // Update ref
            fishPosRef.current = { x: newX, y: newY };

            const delay = 4000 + Math.random() * 4000; // Slow, calm movement
            timeoutId = setTimeout(moveFish, delay);
        };

        // Initial delay before first move to let intro settle
        timeoutId = setTimeout(moveFish, 1000);

        return () => clearTimeout(timeoutId);
    }, []); 

    const handleClaim = (e: React.MouseEvent) => {
        e.stopPropagation();
        if ((!isGiftReady && !poopVisible) || rewardFeedback) return;

        const minDelay = 7200000;
        const maxDelay = 10800000;
        const nextDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        
        Storage.updatePepinoGiftTime(nextDelay);
        setPepinoState(Storage.getPepinoState()); 
        setIsGiftReady(false);

        if (poopVisible) {
            setPoopVisible(false);
            onRewardClaim(1, true); 
            showReward({ amount: 1, isPoop: true });
            sounds.playPop();
            return;
        }

        const r = Math.random();
        let amount = 5;
        let isPoop = false;

        if (r < 0.05) {
            isPoop = true;
            setPoopVisible(true);
            return; 
        } else if (r < 0.10) amount = 20;
        else if (r < 0.20) amount = 15;
        else if (r < 0.50) amount = 10;

        if (amount > 0) {
            sounds.playWin();
            onRewardClaim(amount, false);
            showReward({ amount, isPoop: false });
        }
    };

    const showReward = (feedback: {amount: number, isPoop: boolean}) => {
        setRewardFeedback(feedback);
        setRewardExiting(false);
        
        // Show for 2 seconds total
        setTimeout(() => {
            setRewardExiting(true);
            setTimeout(() => {
                setRewardFeedback(null);
                setRewardExiting(false);
            }, 300); 
        }, 1700);
    };

    // Derived state for visibility
    const isTextVisible = introState === 'waiting';
    const isFishVisible = introState !== 'waiting';
    const isPopping = introState === 'appearing';

    return (
        <div 
            ref={containerRef}
            // Size: w-24 h-16 (~20-25% smaller than original w-32 h-24)
            className="w-full h-56 relative rounded-[1.75rem] overflow-hidden bg-[#e0f7fa] shadow-xl mb-6 select-none animate-pop mx-auto"
        >
            {/* Clean Water Gradient - No Decor */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#e0f7fa] via-[#d1f4fa] to-[#b3e5fc]" />

            {/* --- INTRO TEXT OVERLAY --- */}
            <div 
                className={`absolute inset-0 flex items-center justify-center p-4 z-40 transition-opacity duration-700 ${isTextVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/40 text-center max-w-[90%]">
                    <p className="text-lg font-bold text-stone-800 mb-2 leading-tight">This is Pepino.</p>
                    <p className="text-[11px] font-medium text-stone-600 mb-3 leading-relaxed">He was around while Oku was being built.</p>
                    <p className="text-[9px] text-stone-500 font-semibold opacity-90">Thanks for supporting the app — feel free to check on him anytime.</p>
                </div>
            </div>

            {/* PEPINO CONTAINER (Handles X/Y Position) */}
            <div 
                className={`absolute w-12 h-8 transition-all duration-[4000ms] ease-in-out z-30 ${isFishVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                    left: `${fishPos.x}%`, 
                    top: `${fishPos.y}%`,
                    transform: `translate(-50%, -50%) ${isPopping ? 'scale(0)' : 'scale(1)'}` 
                }}
            >
                 {/* POP IN ANIMATION WRAPPER */}
                 <div className={`w-full h-full transition-transform duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275) ${isPopping ? 'scale-100' : ''}`}>
                     
                     {/* DIRECTION FLIPPER */}
                     <div 
                        className="w-full h-full transition-transform duration-500"
                        style={{ transform: fishDirection === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}
                     >
                         {/* WIGGLER */}
                         <div className="w-full h-full animate-wiggle">
                            {/* Updated Pepino with new SVG paths */}
                            <svg viewBox="344.5149 210.9059 74.9591 41.2278" className="w-full h-full drop-shadow-sm filter" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>
                                <path d="M 373.193 239.648 C 379.513 254.112 400.131 252.185 404.661 240.061 C 393.45 240.02 396.193 239.089 386.193 239.648 L 373.193 239.648 Z" fill="#ef4444" opacity="0.95" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 372.793 224.525 C 379.113 207.278 399.731 209.576 404.261 224.033 C 393.05 224.081 395.793 225.192 385.793 224.525 L 372.793 224.525 Z" fill="#ef4444" opacity="0.95" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 394.515 231.681 C 379.515 206.681 344.428 201.406 344.515 231.681 C 344.565 261.131 379.515 256.681 394.515 231.681 Z" fill="#ef4444" opacity="0.95" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 394.515 231.681 C 374.515 216.681 359.515 211.681 354.515 231.681 C 359.515 251.681 374.515 246.681 394.515 231.681 Z" fill="#b91c1c" opacity="0.15" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <ellipse cx="391.474" cy="231.681" rx="28" ry="11" fill="#dc2626" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 401.174 234.169 C 395.84 239.502 397.84 240.836 407.174 238.169 L 401.174 234.169 Z" fill="#fca5a5" opacity="0.8" style={{strokeWidth: 1, transformOrigin: '402.719px 236.836px'}} transform="matrix(0.71619296, -0.69790214, 0.69790214, 0.71619296, 0.00000291, 0.0000368)"/>
                                <circle cx="411.874" cy="230.381" r="2.5" fill="black" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <circle cx="412.874" cy="229.381" r="0.8" fill="white" opacity="0.9" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                            </svg>
                         </div>
                     </div>
                 </div>

                 {/* GIFT BUBBLE */}
                 {isGiftReady && !isTextVisible && (
                        <div 
                            onClick={handleClaim}
                            className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 cursor-pointer hover:scale-105 transition-transform"
                        >
                            <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-blue-100/50">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="8" width="18" height="4" rx="1" />
                                    <path d="M12 8v13" />
                                    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                                    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
                                </svg>
                            </div>
                        </div>
                 )}
            </div>
            
            {/* POOP */}
            {poopVisible && !isTextVisible && (
                <div 
                    onClick={handleClaim}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 cursor-pointer hover:scale-110 transition-transform animate-bounce"
                >
                    <span className="text-lg filter drop-shadow-md">💩</span>
                </div>
            )}

            {/* REWARD FEEDBACK (Center Pill - Scale In / Scale Out) */}
            {rewardFeedback && (
                <div 
                    className={`absolute inset-0 flex items-center justify-center pointer-events-none z-50 transition-all duration-300 ease-out ${
                        rewardExiting 
                        ? 'opacity-0 scale-90' 
                        : 'opacity-100 scale-100'
                    }`}
                >
                    <div className="bg-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-stone-100 animate-scale-in">
                        {rewardFeedback.isPoop ? (
                            <span className="text-sm font-bold text-stone-600">Cleaned!</span>
                        ) : (
                            <>
                                <span className="text-xl font-bold text-stone-800">+{rewardFeedback.amount}</span>
                                <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Tank Reflection */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/30 to-transparent pointer-events-none rounded-bl-full" />
        </div>
    );
};
