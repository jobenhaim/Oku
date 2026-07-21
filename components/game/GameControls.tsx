
import React from 'react';
import { Icons } from '../ui/Icons';
import { sounds } from '../../utils/sound';

interface GameControlsProps {
    canUndo: boolean;
    canErase: boolean;
    isPencilMode: boolean;
    onUndo: (e: React.MouseEvent) => void;
    onErase: (e: React.MouseEvent) => void;
    onTogglePencil: (e: React.MouseEvent) => void;
    purchasedSkills: string[];
    // Skill specific props
    scanUses: number;
    isScanning: boolean;
    scanCooldown: boolean;
    onScan: (e: React.MouseEvent) => void;
    onDevSolve?: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
    canUndo,
    canErase,
    isPencilMode,
    onUndo,
    onErase,
    onTogglePencil,
    purchasedSkills,
    scanUses,
    isScanning,
    scanCooldown,
    onScan,
    onDevSolve
}) => {
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
                {/* Scan Skill Button */}
                {purchasedSkills.includes('skill-scan') && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onScan(e); }} 
                            className={`flex flex-col items-center gap-1 transition relative ${getBaseButtonStyle(scanUses > 0 && !scanCooldown && !isScanning)}`}
                            disabled={scanUses <= 0 || scanCooldown || isScanning}
                        >
                        <div className={`p-3 rounded-full shadow-sm transition-all duration-300 relative flex items-center justify-center ${getBaseContainerStyle(scanUses > 0 && !scanCooldown && !isScanning)}`}>
                            <Icons.Scan className={`w-5 h-5 scale-[1.32] ${scanUses > 0 && !scanCooldown && !isScanning ? 'opacity-100' : 'opacity-30 grayscale'}`} />
                            {/* Larger Badge for Scan - Moved to -top-4 -right-4 */}
                            {scanUses > 0 && (
                                <div className={`absolute -top-4 -right-4 w-7 h-7 rounded-full flex items-center justify-center text-base font-bold leading-none shadow-sm z-10 ${scanUses > 0 ? 'bg-blue-600 text-white' : 'hidden'}`}>
                                    {scanUses}
                                </div>
                            )}
                        </div>
                        <span className="text-sm font-medium">Scan</span>
                    </button>
                )}

                {/* UNDO BUTTON */}
                <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className={`flex flex-col items-center gap-1 transition ${getBaseButtonStyle(canUndo)}`}
                >
                    <div className={`p-3 rounded-full shadow-sm transition-colors ${getBaseContainerStyle(canUndo)}`}>
                        <Icons.Undo className={`w-5 h-5 ${canUndo ? 'text-stone-700 dark:text-stone-300' : 'text-stone-300 dark:text-stone-600'}`} />
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
                        <Icons.Pencil className={`w-5 h-5 ${isPencilMode ? 'text-blue-600 dark:text-blue-400' : 'text-stone-700 dark:text-stone-300'}`} />
                    </div>
                    <span className="text-sm font-medium">Pencil</span>
                </button>

                {/* ERASE BUTTON */}
                <button 
                    onClick={onErase} 
                    disabled={!canErase}
                    className={`flex flex-col items-center gap-1 transition ${getBaseButtonStyle(canErase)}`}
                >
                    <div className={`p-3 rounded-full shadow-sm transition-colors ${getBaseContainerStyle(canErase)}`}>
                        <Icons.Erase className={`w-5 h-5 ${canErase ? 'text-stone-700 dark:text-stone-300' : 'text-stone-300 dark:text-stone-600'}`} />
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
