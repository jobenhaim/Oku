
import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { sounds } from '../../utils/sound';
import { AnimatePresence, motion } from 'framer-motion';

interface GameControlsProps {
    canUndo: boolean;
    canErase: boolean;
    isEraseMode: boolean;
    isPencilMode: boolean;
    isFocusMode: boolean;
    onUndo: (e: React.MouseEvent) => void;
    onErase: (e: React.MouseEvent) => void;
    onTogglePencil: (e: React.MouseEvent) => void;
    onToggleFocus: (e: React.MouseEvent) => void;
    purchasedSkills: string[];
    // Skill specific props
    scanUses: number;
    scanRefillCost: number;
    currentPoints: number;
    isScanning: boolean;
    scanCooldown: boolean;
    onScan: (e: React.MouseEvent) => void;
    onPurchaseScanRefill: () => boolean;
    onDevSolve?: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
    canUndo,
    canErase,
    isEraseMode,
    isPencilMode,
    isFocusMode,
    onUndo,
    onErase,
    onTogglePencil,
    onToggleFocus,
    purchasedSkills,
    scanUses,
    scanRefillCost,
    currentPoints,
    isScanning,
    scanCooldown,
    onScan,
    onPurchaseScanRefill,
    onDevSolve
}) => {
    const [showScanRefill, setShowScanRefill] = useState(false);
    const scanRefillRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scanUses > 0) setShowScanRefill(false);
    }, [scanUses]);

    useEffect(() => {
        if (!showScanRefill) return;
        const handleOutsidePress = (event: PointerEvent) => {
            if (!scanRefillRef.current?.contains(event.target as Node)) {
                setShowScanRefill(false);
            }
        };
        document.addEventListener('pointerdown', handleOutsidePress);
        return () => document.removeEventListener('pointerdown', handleOutsidePress);
    }, [showScanRefill]);

    // Helper for common enabled/disabled styles
    const getBaseButtonStyle = (isEnabled: boolean) => 
        isEnabled 
            ? 'text-stone-900 dark:text-stone-100 cursor-pointer active:scale-95' 
            : 'text-stone-300 dark:text-stone-600 cursor-not-allowed';

    // Removed borders from base container styles
    const getBaseContainerStyle = (isEnabled: boolean) => 
        isEnabled
            ? 'bg-white dark:bg-stone-800'
            : 'bg-t-surface-sec dark:bg-stone-800/50';

    return (
        <div className="flex flex-col gap-4 relative">
            <div className="flex justify-between w-full relative">
                {/* Focus Skill Button */}
                {purchasedSkills.includes('skill-focus') && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleFocus(e); }}
                        className={`flex flex-col items-center gap-1 active:scale-95 transition cursor-pointer ${
                            isFocusMode ? 'text-blue-700 dark:text-blue-300' : 'text-stone-900 dark:text-stone-100'
                        }`}
                    >
                        <div className={`p-3 rounded-full transition-all duration-300 relative flex items-center justify-center ${
                            isFocusMode
                                ? 'bg-blue-100 dark:bg-blue-900/50 shadow-[0_0_14px_rgba(59,130,246,0.45)]'
                                : 'bg-white dark:bg-stone-800 shadow-sm'
                        }`}>
                            <Icons.Focus className="w-5 h-5 scale-[1.85]" />
                        </div>
                        <span className="text-sm font-medium">Focus</span>
                    </button>
                )}

                {/* Scan Skill Button */}
                {purchasedSkills.includes('skill-scan') && (
                    <div ref={scanRefillRef} className="relative flex flex-col items-center">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (scanCooldown || isScanning) return;
                                if (scanUses > 0) {
                                    setShowScanRefill(false);
                                    onScan(e);
                                    return;
                                }
                                sounds.playClick();
                                setShowScanRefill(current => !current);
                            }}
                            className={`flex flex-col items-center gap-1 transition relative ${getBaseButtonStyle(!scanCooldown && !isScanning)}`}
                            disabled={scanCooldown || isScanning}
                            aria-expanded={showScanRefill}
                            aria-label={scanUses > 0 ? `Scan, ${scanUses} uses remaining` : `Buy one Scan for ${scanRefillCost} diamonds`}
                        >
                        <div className={`p-3 rounded-full shadow-sm transition-all duration-300 relative flex items-center justify-center ${getBaseContainerStyle(!scanCooldown && !isScanning)}`}>
                            <Icons.Scan className={`w-5 h-5 scale-[1.16] ${!scanCooldown && !isScanning ? 'opacity-100' : 'opacity-30 grayscale'}`} />
                            {scanUses > 0 ? (
                                <div className="absolute -top-4 -right-4 w-7 h-7 rounded-full flex items-center justify-center text-[19px] font-bold leading-none shadow-sm z-10 bg-blue-600 text-white">
                                    {scanUses}
                                </div>
                            ) : (
                                <div className="absolute -top-4 -right-5 min-w-9 h-7 px-1.5 rounded-full flex items-center justify-center gap-0.5 text-[13px] font-bold leading-none shadow-sm z-10 bg-blue-600 text-white">
                                    <span>{scanRefillCost}</span>
                                    <Icons.Diamond className="w-3 h-3 fill-current" />
                                </div>
                            )}
                        </div>
                        <span className="text-sm font-medium">Scan</span>
                    </button>
                    <AnimatePresence>
                        {showScanRefill && scanUses === 0 && (
                            <div className="absolute top-[calc(100%+8px)] left-0 z-[160]">
                                <motion.div
                                    initial={{ opacity: 0, y: 5, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 5, scale: 0.96 }}
                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                    className="relative w-[172px] rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2.5 text-center shadow-lg"
                                    role="dialog"
                                    aria-label="Buy an extra Scan"
                                >
                                    <div className="text-[12px] font-semibold text-t-primary leading-snug">
                                        Use 1 Scan for{' '}
                                        <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-bold">
                                            {scanRefillCost}
                                            <Icons.Diamond className="w-3 h-3 text-blue-500 fill-current" />
                                        </span>
                                        ?
                                    </div>
                                    {currentPoints < scanRefillCost && (
                                        <div className="mt-1 text-[10px] font-semibold text-red-500">
                                            Not enough diamonds
                                        </div>
                                    )}
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                sounds.playClick();
                                                setShowScanRefill(false);
                                            }}
                                            className="flex-1 rounded-full bg-stone-100 dark:bg-stone-700 px-2 py-1.5 text-[11px] font-bold text-t-secondary active:scale-95 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={currentPoints < scanRefillCost}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                sounds.playClick();
                                                if (onPurchaseScanRefill()) setShowScanRefill(false);
                                            }}
                                            className="flex-1 rounded-full bg-blue-600 px-2 py-1.5 text-[11px] font-bold text-white active:scale-95 transition disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-stone-700 dark:disabled:text-stone-500 disabled:cursor-not-allowed"
                                        >
                                            Yes
                                        </button>
                                    </div>
                                    <div className="absolute bottom-full left-7 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[7px] border-x-transparent border-b-white dark:border-b-stone-800" />
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                    </div>
                )}

                {/* UNDO BUTTON */}
                <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className={`flex flex-col items-center gap-1 transition ${getBaseButtonStyle(canUndo)}`}
                >
                    <div className={`p-3 rounded-full shadow-sm transition-colors ${getBaseContainerStyle(canUndo)}`}>
                        <Icons.Undo className={`w-5 h-5 scale-125 ${canUndo ? 'text-stone-700 dark:text-stone-300' : 'text-stone-300 dark:text-stone-600'}`} />
                    </div>
                    <span className="text-sm font-medium">Undo</span>
                </button>

                {/* PENCIL BUTTON */}
                <button 
                    onClick={onTogglePencil} 
                    className={`flex flex-col items-center gap-1 active:scale-95 transition cursor-pointer ${isPencilMode ? 'text-blue-700 dark:text-blue-300' : 'text-stone-900 dark:text-stone-100'}`}
                >
                    {/* Removed borders */}
                    <div className={`p-3 rounded-full shadow-sm transition-colors ${
                        isPencilMode 
                        ? 'bg-blue-100 dark:bg-blue-900/40' 
                        : 'bg-white dark:bg-stone-800'
                    }`}>
                        <Icons.Pencil className={`w-5 h-5 scale-125 ${isPencilMode ? 'text-blue-600 dark:text-blue-400' : 'text-stone-700 dark:text-stone-300'}`} />
                    </div>
                    <span className="text-sm font-medium">Pencil</span>
                </button>

                {/* ERASE BUTTON */}
                <button 
                    onClick={onErase} 
                    disabled={!canErase}
                    className={`flex flex-col items-center gap-1 transition ${getBaseButtonStyle(canErase)} ${isEraseMode ? 'text-blue-700 dark:text-blue-300' : ''}`}
                >
                    <div className={`p-3 rounded-full shadow-sm transition-colors ${
                        isEraseMode
                            ? 'bg-blue-100 dark:bg-blue-900/40'
                            : getBaseContainerStyle(canErase)
                    }`}>
                        <Icons.Erase className={`w-5 h-5 scale-125 ${
                            isEraseMode
                                ? 'text-blue-600 dark:text-blue-400'
                                : canErase
                                    ? 'text-stone-700 dark:text-stone-300'
                                    : 'text-stone-300 dark:text-stone-600'
                        }`} />
                    </div>
                    <span className="text-sm font-medium">Erase</span>
                </button>
            </div>

            {/* Dev Auto Solve Button - Absolutely positioned to prevent layout shift */}
            {onDevSolve && (
                <div className="absolute left-0 right-0 -bottom-14 flex justify-center pointer-events-none">
                    <button 
                        onClick={onDevSolve}
                        className="pointer-events-auto px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full shadow-sm active:scale-95 transition-all border border-red-200 dark:border-red-800/50 flex items-center gap-1"
                    >
                        <Icons.Keyboard className="w-3 h-3" />
                        [DEV] AUTO SOLVE
                    </button>
                </div>
            )}
        </div>
    );
};
