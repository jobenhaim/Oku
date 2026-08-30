import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { HintPlan } from '../../utils/hints';
import { Icons } from '../ui/Icons';
import { sounds } from '../../utils/sound';

interface HintTheaterProps {
    plan: HintPlan;
    frameIndex: number;
    onFrameIndexChange: (index: number) => void;
    onPlaceNumber: () => void;
}

const useModalFocusTrap = (onEscape?: () => void) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));
        const initialFocus = dialog.querySelector<HTMLElement>('[data-dialog-autofocus]') ?? getFocusable()[0];
        window.requestAnimationFrame(() => initialFocus?.focus());

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onEscape?.();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = getFocusable();
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onEscape]);

    return dialogRef;
};

const HINT_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const HintTheater: React.FC<HintTheaterProps> = ({
    plan,
    frameIndex,
    onFrameIndexChange,
    onPlaceNumber,
}) => {
    const reduceMotion = useReducedMotion();
    const dialogRef = useModalFocusTrap();
    const frame = plan.frames[frameIndex];
    const techniqueLabel = frame.techniqueLabel ?? plan.techniqueLabel;
    const isLastFrame = frameIndex === plan.frames.length - 1;
    const reservedRemainingDigit = plan.frames.find(candidateFrame => (
        candidateFrame.remainingDigit !== undefined
    ))?.remainingDigit;
    const visibleRemainingDigit = frame.remainingDigit;
    const stripRemainingDigit = visibleRemainingDigit ?? reservedRemainingDigit;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowRight' && frameIndex < plan.frames.length - 1) {
                onFrameIndexChange(frameIndex + 1);
            }
            if (event.key === 'ArrowLeft' && frameIndex > 0) {
                onFrameIndexChange(frameIndex - 1);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [frameIndex, onFrameIndexChange, plan.frames.length]);

    const advance = () => {
        if (isLastFrame) {
            onPlaceNumber();
            return;
        }
        sounds.playClick();
        onFrameIndexChange(frameIndex + 1);
    };

    return (
        <motion.section
            ref={dialogRef}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="hint-theater-shell relative z-[320] w-full max-w-[560px] overflow-visible"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hint-theater-title"
            aria-describedby={frame.accessibleDetail ? 'hint-theater-body hint-theater-detail' : 'hint-theater-body'}
        >
            <div className="hint-technique-pill absolute left-1/2 top-0 z-10 flex h-7 md:h-9 -translate-x-1/2 -translate-y-[calc(100%+4px)] md:-translate-y-[calc(100%+6px)] items-center justify-center whitespace-nowrap rounded-full border border-blue-200/80 dark:border-blue-800/80 bg-white/[0.98] dark:bg-stone-900/[0.98] px-3 md:px-4">
                <div className="grid items-center justify-items-center">
                    {plan.frames.map(candidateFrame => (
                        <span
                            key={`label-measure-${candidateFrame.id}`}
                            className="invisible pointer-events-none col-start-1 row-start-1 -translate-y-px text-[9px] md:text-[10px] font-bold uppercase leading-none tracking-[0.14em]"
                            aria-hidden="true"
                        >
                            {candidateFrame.techniqueLabel ?? plan.techniqueLabel}
                        </span>
                    ))}
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={techniqueLabel}
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.14 }}
                            className="col-start-1 row-start-1 -translate-y-px text-[9px] md:text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-blue-600 dark:text-blue-300"
                        >
                            {techniqueLabel}
                        </motion.span>
                    </AnimatePresence>
                </div>
            </div>

            <div className="hint-theater-card max-h-[42dvh] overflow-y-auto rounded-t-[2rem] rounded-b-none border-x border-t border-stone-200/90 dark:border-stone-700/80 bg-white/[0.99] dark:bg-stone-900/[0.99] px-5 md:px-7 pt-4 md:pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-center gap-1.5" role="status" aria-label={`Step ${frameIndex + 1} of ${plan.frames.length}`}>
                    {plan.frames.map((item, index) => (
                        <span
                            key={item.id}
                            aria-hidden="true"
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                index === frameIndex
                                    ? 'w-7 bg-blue-500'
                                    : index < frameIndex
                                        ? 'w-2.5 bg-blue-200 dark:bg-blue-800'
                                        : 'w-2.5 bg-stone-200 dark:bg-stone-700'
                            }`}
                        />
                    ))}
                </div>

                <div className="mt-3 text-center">
                    <div className="grid min-h-[80px] md:min-h-[94px]">
                        {plan.frames.map(candidateFrame => (
                            <div
                                key={`measure-${candidateFrame.id}`}
                                className="invisible pointer-events-none col-start-1 row-start-1 flex flex-col justify-center"
                                aria-hidden="true"
                            >
                                <div className="text-[1.35rem] md:text-[1.6rem] font-bold tracking-tight leading-tight">
                                    {candidateFrame.title}
                                </div>
                                <div className="mt-1.5 text-sm md:text-base font-medium leading-relaxed">
                                    {candidateFrame.body}
                                </div>
                            </div>
                        ))}

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={frame.id}
                                initial={reduceMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.18 }}
                                className="col-start-1 row-start-1 flex flex-col justify-center"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                <h2 id="hint-theater-title" className="text-[1.35rem] md:text-[1.6rem] font-bold text-t-primary tracking-tight leading-tight">
                                    {frame.title}
                                </h2>
                                <p id="hint-theater-body" className="mt-1.5 text-sm md:text-base font-medium leading-relaxed text-t-secondary">
                                    {frame.body}
                                </p>
                                {frame.accessibleDetail && (
                                    <p id="hint-theater-detail" className="sr-only">
                                        {frame.accessibleDetail}
                                    </p>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {stripRemainingDigit !== undefined && (
                        <div
                            className={`hint-digit-strip mt-2.5 ${visibleRemainingDigit === undefined ? 'invisible' : ''}`}
                            role={visibleRemainingDigit === undefined ? undefined : 'img'}
                            aria-hidden={visibleRemainingDigit === undefined ? true : undefined}
                            aria-label={visibleRemainingDigit === undefined
                                ? undefined
                                : `${HINT_DIGITS.filter(digit => digit !== visibleRemainingDigit).join(', ')} are blocked. Only ${visibleRemainingDigit} remains.`}
                        >
                            {HINT_DIGITS.map(digit => {
                                const remains = digit === stripRemainingDigit;
                                return (
                                    <span
                                        key={digit}
                                        className={`hint-digit-strip__item ${remains ? 'hint-digit-strip__item--remaining' : 'hint-digit-strip__item--blocked'}`}
                                        aria-hidden="true"
                                    >
                                        {digit}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-3 flex items-center gap-2.5">
                    {frameIndex > 0 && (
                        <button
                            type="button"
                            onClick={() => { sounds.playClick(); onFrameIndexChange(frameIndex - 1); }}
                            className="h-12 md:h-[52px] px-5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-bold active:scale-[0.98] transition"
                        >
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        data-dialog-autofocus
                        onClick={advance}
                        className="h-12 md:h-[52px] flex-1 rounded-2xl bg-stone-900 dark:bg-blue-600 text-white font-bold active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        {isLastFrame ? `Place ${plan.target.value}` : 'Next'}
                        {!isLastFrame && <Icons.Next className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </motion.section>
    );
};
