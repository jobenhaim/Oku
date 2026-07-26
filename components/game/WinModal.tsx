
import React, { useRef, useState, useEffect } from 'react';
import { Icons } from '../ui/Icons';
import { Difficulty } from '../../types';
import { sounds } from '../../utils/sound';
import { easeInOut, easeOut } from '../../utils/animation';

interface WinModalProps {
    difficulty: Difficulty;
    levelId: number;
    timer: number;
    showTimer: boolean;
    points: number;
    isGeneratingReplay: boolean;
    replayUrl: string | null;
    showReplay: boolean;
    generateReplayEnabled: boolean;
    onReplay: (e: React.MouseEvent) => void;
    onShareReplay: () => void;
    onCloseReplay: () => void;
    onGenerateReplay: () => void;
    onBack: (e: React.MouseEvent) => void;
    onReturnToMenu: (e: React.MouseEvent) => void;
}

const useCounter = (target: number, duration: number = 800, start: boolean = false, easing: (progress: number) => number = easeInOut) => {
    const [count, setCount] = useState(0);
    const lastTickRef = useRef(0);
    useEffect(() => {
        if (!start) {
            setCount(0);
            lastTickRef.current = 0;
            return;
        }
        let startTime: number;
        let animationFrame: number;

        const animate = (time: number) => {
            if (!startTime) startTime = time;
            const progress = Math.min((time - startTime) / duration, 1);
            const ease = easing(progress);
            const currentCount = Math.floor(target * ease);
            
            if (currentCount > lastTickRef.current) {
                // Tick when an eased counter crosses a milestone, even if a
                // rendered frame skips the milestone's exact integer value.
                const tickInterval = Math.max(1, Math.floor(target / 10));
                if (Math.floor(currentCount / tickInterval) > Math.floor(lastTickRef.current / tickInterval)) {
                    sounds.playCounterTick();
                }
                lastTickRef.current = currentCount;
            }

            setCount(currentCount);
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [target, duration, start, easing]);
    return count;
};

const ReplayPlayer = ({ src, onShare, onClose }: { src: string, onShare: () => void, onClose: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);

    const togglePlay = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const toggleMute = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-black z-[150] flex flex-col items-center justify-center animate-fade-in touch-none">
             {/* Main Video Container */}
             <div 
                className="relative w-full max-w-lg aspect-square bg-stone-900 shadow-2xl overflow-hidden rounded-none sm:rounded-2xl group cursor-pointer"
                onClick={togglePlay}
             >
                  <video 
                      ref={videoRef}
                      src={src} 
                      autoPlay 
                      loop 
                      playsInline 
                      className="w-full h-full object-cover"
                  />
                  
                  {/* Only show center play button when paused, otherwise keep video clean */}
                  {!isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] animate-fade-in pointer-events-none">
                          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-lg">
                              <Icons.Play className="w-10 h-10 text-white fill-current ml-1" />
                          </div>
                      </div>
                  )}
             </div>
             
             {/* Unified Control Bar - Respects Safe Area */}
             <div className="absolute bottom-0 w-full pb-safe pointer-events-none">
                 <div className="mb-10 flex items-center justify-center gap-2 px-4 flex-wrap sm:flex-nowrap">
                     {/* Share/Save - Primary Action */}
                     <button 
                         onClick={onShare}
                         className="h-14 px-6 bg-white text-black rounded-full font-bold shadow-xl active:scale-95 transition flex items-center gap-2 pointer-events-auto"
                     >
                         <Icons.Share className="w-5 h-5 text-blue-500" /> Share/Save
                     </button>

                     <div className="flex gap-2">
                         {/* Pause/Play */}
                         <button 
                            onClick={togglePlay}
                            className="w-14 h-14 bg-stone-800 text-white rounded-full shadow-xl active:scale-95 transition flex items-center justify-center pointer-events-auto"
                         >
                             {isPlaying ? <Icons.Pause className="w-6 h-6 fill-current" /> : <Icons.Play className="w-6 h-6 fill-current ml-1" />}
                         </button>

                         {/* Mute/Unmute */}
                         <button 
                            onClick={toggleMute}
                            className="w-14 h-14 bg-stone-800 text-white rounded-full shadow-xl active:scale-95 transition flex items-center justify-center pointer-events-auto"
                         >
                             {isMuted ? <Icons.Mute className="w-6 h-6" /> : <Icons.Sound className="w-6 h-6" />}
                         </button>

                         {/* Close */}
                         <button 
                             onClick={onClose}
                             className="w-14 h-14 bg-stone-800 text-white rounded-full shadow-xl active:scale-95 transition flex items-center justify-center pointer-events-auto"
                         >
                             <Icons.Close className="w-6 h-6" />
                         </button>
                     </div>
                 </div>
             </div>
        </div>
    );
};

export const WinModal: React.FC<WinModalProps> = ({
    difficulty,
    levelId,
    timer,
    showTimer,
    points,
    isGeneratingReplay,
    replayUrl,
    showReplay,
    generateReplayEnabled,
    onReplay,
    onShareReplay,
    onCloseReplay,
    onGenerateReplay,
    onBack,
    onReturnToMenu
}) => {
    const [step, setStep] = useState(0);
    const [revealedLetters, setRevealedLetters] = useState(0);
    
    // Animation Sequencing
    useEffect(() => {
        // Step 1: Difficulty/Level subtitle appears
        const t1 = setTimeout(() => {
            setStep(1);
            sounds.playPepinoTap();
        }, 100);

        // Step 2: Brief beat before the solved title
        const t2 = setTimeout(() => {
            setStep(2);
        }, 300);

        // Step 3: Solved title appears with perfectly synchronized letters and tick sounds
        const t3 = setTimeout(() => {
            setStep(3);
            let currentCount = 0;
            const letterInterval = setInterval(() => {
                currentCount++;
                setRevealedLetters(currentCount);
                sounds.playCounterTick();
                
                if (currentCount >= 7) {
                    clearInterval(letterInterval);
                }
            }, 75); // Snappy, frame-accurate 75ms spacing
        }, 400);

        // Step 4: Points Card appears
        const t4 = setTimeout(() => {
            setStep(4);
            sounds.playPop();
        }, 1300);

        // Step 5: Time Card appears
        const t5 = setTimeout(() => {
            setStep(5);
            if (showTimer) sounds.playPop();
        }, 1550);

        // Step 6: Action buttons slide up
        const t6 = setTimeout(() => {
            setStep(6);
            sounds.playPop();
        }, 1800);

        // The action area finishes its 700ms entrance after appearing at 1800ms.
        const t7 = setTimeout(() => {
            setStep(7);
        }, 2500);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
            clearTimeout(t6);
            clearTimeout(t7);
        };
    }, [showTimer]);

    const animatedPoints = useCounter(points, 1000, step >= 4, easeOut);
    const animatedTimeSeconds = useCounter(timer, 800, showTimer && step >= 5);

    const formatTime = (seconds: number) => {
        const total = Math.floor(seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (showReplay && replayUrl) {
        return <ReplayPlayer src={replayUrl} onShare={onShareReplay} onClose={onCloseReplay} />;
    }

    return (
        <div className="fixed inset-0 w-full h-full bg-stone-950/40 dark:bg-black/60 backdrop-blur-sm z-[140] flex flex-col items-center justify-center animate-fade-in touch-none">
            <div className="bg-white dark:bg-stone-900/95 border border-stone-200 dark:border-white/10 text-stone-800 dark:text-white p-5 rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[300px] max-w-[calc(100vw-32px)] text-center relative overflow-hidden transform transition-all duration-300 z-10">
                <style>{`
                    @keyframes letter-pop {
                        0% {
                            transform: scale(0.3) translateY(16px) rotate(-15deg);
                            opacity: 0;
                            color: var(--start-color);
                        }
                        45% {
                            transform: scale(1.3) translateY(-6px) rotate(10deg);
                            opacity: 1;
                            color: var(--start-color);
                        }
                        65% {
                            transform: scale(0.95) translateY(2px) rotate(-3deg);
                            color: var(--start-color);
                        }
                        100% {
                            transform: scale(1) translateY(0) rotate(0deg);
                            opacity: 1;
                            color: var(--title-final-color);
                        }
                    }
                    .letter-animate {
                        animation: letter-pop 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    }
                    .win-modal-letters {
                        --title-final-color: #1c1917;
                    }
                    .dark .win-modal-letters {
                        --title-final-color: #ffffff;
                    }
                `}</style>
                
                {/* Step 1: Difficulty Header */}
                <div 
                    className={`flex flex-col gap-1 mb-2 relative z-10 transition-all duration-300 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                >
                    <div className="text-[15px] font-bold text-black dark:text-white uppercase tracking-[0.12em]">{difficulty} &bull; Level {levelId}</div>
                </div>

                {/* Step 3: Solved Title (Letter by Letter All-Caps Celebratory Pop) */}
                <div className="mb-4 relative z-10 h-10 flex justify-center items-center">
                    <div className="flex justify-center items-center gap-1 win-modal-letters">
                        {['S','O','L','V','E','D','!'].map((char, i) => {
                            const startColors = [
                                '#f59e0b', // Amber-500
                                '#f97316', // Orange-500
                                '#eab308', // Yellow-500
                                '#10b981', // Emerald-500
                                '#0ea5e9', // Sky-500
                                '#6366f1', // Indigo-500
                                '#f43f5e', // Rose-500
                            ];
                            return (
                                <span 
                                    key={i}
                                    style={{ '--start-color': startColors[i] } as React.CSSProperties}
                                    className={`text-[34px] font-black leading-none inline-block opacity-0 ${
                                        revealedLetters > i 
                                        ? 'letter-animate' 
                                        : ''
                                    }`}
                                >
                                    {char}
                                </span>
                            );
                        })}
                    </div>
                </div>
                
                {/* Grid of stats (Side-by-side to minimize height and eliminate empty space) */}
                <div className={`grid gap-3 mb-5 relative z-10 ${showTimer ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {/* Step 4: Earnings */}
                    <div 
                        className={`bg-stone-50 dark:bg-white/5 border border-stone-100 dark:border-white/5 rounded-2xl p-3 transition-all duration-500 ${
                            step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                        }`}
                    >
                        <p className="text-stone-500 dark:text-stone-400 text-[14px] font-bold uppercase tracking-wider mb-1">Earned</p>
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-2xl font-extrabold text-stone-800 dark:text-white tabular-nums">+{animatedPoints}</span>
                            <Icons.Diamond className="w-4 h-4 text-blue-500 dark:text-blue-400 fill-current" />
                        </div>
                    </div>
                    
                    {/* Step 5: Time */}
                    {showTimer && (
                        <div
                            className={`bg-stone-50 dark:bg-white/5 border border-stone-100 dark:border-white/5 rounded-2xl p-3 transition-all duration-500 ${
                                step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                            }`}
                        >
                            <p className="text-stone-500 dark:text-stone-400 text-[14px] font-bold uppercase tracking-wider mb-1">Time</p>
                            <p className="text-2xl font-extrabold tabular-nums text-stone-800 dark:text-white leading-none pt-0.5">{formatTime(animatedTimeSeconds)}</p>
                        </div>
                    )}
                </div>
                
                {/* Step 6: Actions */}
                <div 
                    className={`relative z-10 space-y-3 transition-all duration-700 ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                >
                    {/* Replay Button */}
                    {generateReplayEnabled && (
                         isGeneratingReplay ? (
                            <div className="w-full h-14 flex items-center justify-center gap-1.5 text-stone-500 dark:text-stone-400 font-bold text-[18px] animate-pulse bg-stone-50 dark:bg-white/5 rounded-2xl border border-dashed border-stone-200 dark:border-white/10">
                                <Icons.Video className="w-5 h-5" /> Generating Replay...
                            </div>
                        ) : replayUrl ? (
                            <button 
                                onClick={onReplay}
                                className="w-full h-14 bg-blue-600 text-white rounded-2xl font-bold text-[18px] shadow-lg shadow-blue-600/10 dark:shadow-blue-600/20 active:scale-95 transition-transform flex items-center justify-center gap-1.5 border border-transparent"
                            >
                                <Icons.Video className="w-5 h-5" /> Watch Replay
                            </button>
                        ) : (
                            <button 
                                onClick={onGenerateReplay}
                                className="w-full h-14 bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-200 rounded-2xl font-bold text-[18px] active:scale-95 transition flex items-center justify-center gap-1.5 border border-stone-200/60 dark:border-white/5 hover:bg-stone-200 dark:hover:bg-white/15"
                            >
                                <Icons.Video className="w-5 h-5" /> Create Replay
                            </button>
                        )
                    )}

                    <button 
                        onClick={onReturnToMenu} 
                        disabled={step < 7}
                        className="w-full h-14 bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-200 border border-stone-200/60 dark:border-white/5 rounded-2xl font-bold text-[18px] active:scale-95 transition-transform flex items-center justify-center disabled:pointer-events-none"
                    >
                        Menu
                    </button>
                </div>
            </div>
        </div>
    );
};
