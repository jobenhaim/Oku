import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icons } from './Icons';
import { sounds } from '../../utils/sound';
import { easeOut } from '../../utils/animation';

interface WelcomeGiftModalProps {
    onClose: () => void;
}

export const WelcomeGiftModal: React.FC<WelcomeGiftModalProps> = ({ onClose }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [count, setCount] = useState(0);
    const [showDiamonds, setShowDiamonds] = useState(false);
    const [showLight, setShowLight] = useState(false);
    const [showButton, setShowButton] = useState(false);

    // Play welcome gift sound upon opening
    useEffect(() => {
        sounds.playUniversalGiftClaim();
    }, []);

    useEffect(() => {
        const diamondTimer = window.setTimeout(() => setShowDiamonds(true), 240);
        const lightTimer = window.setTimeout(() => {
            setShowLight(true);
            sounds.playUniversalGiftClaim();
        }, 740);
        const buttonTimer = window.setTimeout(() => setShowButton(true), 1040);

        return () => {
            window.clearTimeout(diamondTimer);
            window.clearTimeout(lightTimer);
            window.clearTimeout(buttonTimer);
        };
    }, []);

    useEffect(() => {
        if (!showDiamonds) return;

        const duration = 700;
        const target = 100;
        const startTime = performance.now();
        let lastValue = 0;

        let frameId: number;
        const updateCounter = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = easeOut(progress);
            const currentValue = Math.floor(easedProgress * target);

            if (currentValue !== lastValue) {
                setCount(currentValue);
                sounds.playCounterTick();
                lastValue = currentValue;
            }

            if (progress < 1) {
                frameId = requestAnimationFrame(updateCounter);
            } else {
                setCount(target);
            }
        };

        frameId = requestAnimationFrame(updateCounter);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [showDiamonds]);

    const handleAction = () => {
        if (isClosing) return;
        sounds.playUniversalGiftClaim();
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    return (
        <div 
            className={`fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 18 }}
                animate={isClosing ? { opacity: 0, scale: 0.96, y: 8 } : { opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 330, damping: 24 }}
                className="welcome-gift-card bg-t-surface p-5 sm:p-6 md:p-7 rounded-[2rem] shadow-2xl w-full max-w-[310px] md:max-w-[350px] text-center border border-stone-100 dark:border-stone-800 transition-colors duration-300 relative overflow-hidden"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="welcome-gift-title"
            >
                <div className="relative">
                    <h3 id="welcome-gift-title" className="text-[1.1rem] md:text-[1.25rem] font-medium text-t-primary mb-1 tracking-tight">
                        <span className="block">Thank you for downloading</span>
                        <strong className="block font-bold">Oku: Sudoku!</strong>
                    </h3>
                    <p className="text-sm md:text-base text-t-secondary font-semibold mb-4 md:mb-5">Here’s a little gift from us.</p>

                    <div className="min-h-[156px] md:min-h-[168px] space-y-3" aria-live="polite">
                        <AnimatePresence>
                            {showDiamonds && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.62, y: 16 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ type: 'spring', stiffness: 430, damping: 20 }}
                                    className="h-[72px] md:h-[78px] rounded-2xl border border-blue-100 bg-blue-50/80 px-5 flex items-center justify-center dark:border-blue-900/60 dark:bg-blue-950/30"
                                >
                                    <div className="flex items-center justify-center gap-3">
                                        <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-t-primary min-w-[58px] text-right tabular-nums">{count}</span>
                                        <Icons.Diamond className="w-7 h-7 md:w-8 md:h-8 text-blue-500 fill-current" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {showLight && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.62, y: 16 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ type: 'spring', stiffness: 430, damping: 20 }}
                                    className="h-[72px] md:h-[78px] flex items-center justify-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/80 px-5 dark:border-amber-900/60 dark:bg-amber-950/30"
                                >
                                    <Icons.Nudge className="h-11 w-11 md:h-12 md:w-12 shrink-0" />
                                    <div className="text-left">
                                        <span className="block text-lg md:text-xl font-bold text-t-primary leading-tight">Light skill</span>
                                        <span className="block text-xs md:text-sm font-semibold text-t-secondary">Unlocked for free</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: showButton ? 1 : 0 }}
                        transition={{ duration: 0.24 }}
                        onClick={handleAction}
                        disabled={!showButton || isClosing}
                        className="mt-5 md:mt-6 w-full py-3.5 md:py-4 text-white bg-stone-900 dark:bg-white dark:text-stone-900 rounded-2xl font-bold active:scale-[0.98] transition-transform text-base select-none disabled:pointer-events-none"
                    >
                        Thanks!
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};
