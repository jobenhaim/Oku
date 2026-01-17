
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../ui/Icons';
import { Difficulty } from '../../types';

interface WinModalProps {
    difficulty: Difficulty;
    levelId: number;
    timer: number;
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

const useCounter = (target: number, duration: number = 800, start: boolean = false) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!start) {
            setCount(0);
            return;
        }
        let startTime: number;
        let animationFrame: number;

        const animate = (time: number) => {
            if (!startTime) startTime = time;
            const progress = Math.min((time - startTime) / duration, 1);
            // Cubic ease out
            const ease = 1 - Math.pow(1 - progress, 3); 
            setCount(Math.floor(target * ease));
            
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [target, duration, start]);
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
             
             {/* Unified Control Bar */}
             <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-2 px-4 pointer-events-none flex-wrap sm:flex-nowrap">
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
    );
};

export const WinModal: React.FC<WinModalProps> = ({
    difficulty,
    levelId,
    timer,
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
    
    // Animation Sequencing
    useEffect(() => {
        // Step 1: Checkmark (Immediate)
        const t1 = setTimeout(() => setStep(1), 100);
        // Step 2: Difficulty/Level Header
        const t2 = setTimeout(() => setStep(2), 500);
        // Step 3: "Solved!" Title
        const t3 = setTimeout(() => setStep(3), 800);
        // Step 4: Points Earned
        const t4 = setTimeout(() => setStep(4), 1400);
        // Step 5: Time
        const t5 = setTimeout(() => setStep(5), 2000);
        // Step 6: Actions
        const t6 = setTimeout(() => setStep(6), 2800);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
            clearTimeout(t6);
        };
    }, []);

    const animatedPoints = useCounter(points, 800, step >= 4);
    const animatedTimeSeconds = useCounter(timer, 800, step >= 5);

    const formatTime = (seconds: number) => {
        const total = Math.floor(seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    let content: React.ReactNode;

    if (showReplay && replayUrl) {
        content = <ReplayPlayer src={replayUrl} onShare={onShareReplay} onClose={onCloseReplay} />;
    } else {
        content = (
            <div className="fixed inset-0 w-full h-full bg-green-500/50 backdrop-blur-sm z-[140] flex flex-col items-center justify-center text-white animate-fade-in touch-none">
                <div className="bg-white dark:bg-stone-800 text-stone-800 dark:text-t-primary p-8 rounded-3xl shadow-2xl w-80 text-center relative overflow-hidden transform transition-all z-10">
                    
                    {/* Step 1: Checkmark Icon */}
                    <div 
                        className={`w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 dark:text-green-400 relative z-10 transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${step >= 1 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                    >
                        <Icons.Check className="w-10 h-10" />
                    </div>
                    
                    {/* Step 2: Difficulty Header */}
                    <div 
                        className={`flex flex-col gap-0.5 mb-2 relative z-10 transition-all duration-500 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    >
                        <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{difficulty} &bull; Level {levelId}</div>
                    </div>

                    {/* Step 3: Solved Title (Letter by Letter) */}
                    <div className="mb-8 relative z-10 h-10">
                        <div className="flex justify-center items-center">
                            {['S','o','l','v','e','d','!'].map((char, i) => (
                                <span 
                                    key={i}
                                    className={`text-3xl font-bold text-stone-800 dark:text-white leading-tight inline-block transition-all duration-300`}
                                    style={{ 
                                        transitionDelay: `${i * 40}ms`,
                                        opacity: step >= 3 ? 1 : 0,
                                        transform: step >= 3 ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.5)'
                                    }}
                                >
                                    {char}
                                </span>
                            ))}
                        </div>
                    </div>
                    
                    {/* Step 4: Earnings Group */}
                    <div 
                        className={`flex flex-col gap-1 mb-6 relative z-10 transition-all duration-500 ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    >
                        <p className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-widest">You Earned</p>
                        <div className="flex items-center justify-center gap-1.5 h-8">
                            <span className="text-3xl font-bold text-stone-800 dark:text-t-primary tabular-nums">+{animatedPoints}</span>
                            <Icons.Diamond className="w-6 h-6 text-blue-500 fill-current" />
                        </div>
                    </div>
                    
                    {/* Step 5: Time Group */}
                    <div 
                        className={`flex flex-col gap-0.5 mb-8 relative z-10 transition-all duration-500 ${step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    >
                        <p className="text-stone-400 dark:text-stone-500 text-[10px] uppercase tracking-widest font-bold">Time</p>
                        <p className="text-2xl font-medium tabular-nums text-stone-800 dark:text-white leading-tight">{formatTime(animatedTimeSeconds)}</p>
                    </div>
                    
                    {/* Step 6: Actions */}
                    <div 
                        className={`relative z-10 space-y-3 transition-all duration-700 ${step >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    >
                        {/* Replay Button */}
                        {generateReplayEnabled && (
                            isGeneratingReplay ? (
                                <div className="w-full py-3.5 flex items-center justify-center gap-2 text-stone-500 font-bold animate-pulse bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-dashed border-stone-200 dark:border-stone-700">
                                    <Icons.Video className="w-5 h-5" /> Generating Replay...
                                </div>
                            ) : replayUrl ? (
                                <button 
                                onClick={onReplay}
                                className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition flex items-center justify-center gap-2 hover:bg-blue-600 animate-pop"
                                >
                                <Icons.Video className="w-5 h-5" /> Watch Replay
                                </button>
                            ) : (
                                <button 
                                onClick={onGenerateReplay}
                                className="w-full py-3.5 bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300 rounded-xl font-bold shadow-sm active:scale-95 transition flex items-center justify-center gap-2 hover:bg-stone-200 dark:hover:bg-stone-600"
                                >
                                <Icons.Video className="w-5 h-5" /> Create Replay
                                </button>
                            )
                        )}

                        <div className="flex gap-3">
                             <button onClick={onBack} className="flex-1 py-3.5 bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 rounded-xl font-bold hover:bg-stone-700 dark:hover:bg-stone-200 active:scale-95 transition shadow-lg">Levels</button>
                             <button onClick={onReturnToMenu} className="flex-1 py-3.5 bg-white text-stone-600 border border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-600 rounded-xl font-bold hover:bg-stone-50 dark:hover:bg-stone-700 active:scale-95 transition">Menu</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return createPortal(content, document.body);
};
