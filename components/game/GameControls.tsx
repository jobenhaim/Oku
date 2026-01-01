
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
    isAutoAvailable: boolean;
    scanUses: number;
    isScanning: boolean;
    scanCooldown: boolean;
    revealUses: number;
    revealingCell: {r: number, c: number} | null;
    onAutoFill: (e: React.MouseEvent) => void;
    onScan: (e: React.MouseEvent) => void;
    onWatchScanAd: (e: React.MouseEvent) => void;
    onReveal: (e: React.MouseEvent) => void;
    onWatchRevealAd: (e: React.MouseEvent) => void;
    timer: number;
}

export const GameControls: React.FC<GameControlsProps> = ({
    canUndo,
    canErase,
    isPencilMode,
    onUndo,
    onErase,
    onTogglePencil,
    purchasedSkills,
    isAutoAvailable,
    scanUses,
    isScanning,
    scanCooldown,
    revealUses,
    revealingCell,
    onAutoFill,
    onScan,
    onWatchScanAd,
    onReveal,
    onWatchRevealAd,
    timer
}) => {
    // Helper for common enabled/disabled styles
    const getBaseButtonStyle = (isEnabled: boolean) => 
        isEnabled 
            ? 'text-stone-900 dark:text-stone-100 cursor-pointer hover:brightness-95 active:scale-95' 
            : 'text-stone-300 dark:text-stone-600 cursor-not-allowed';

    // Removed borders from base container styles
    const getBaseContainerStyle = (isEnabled: boolean) => 
        isEnabled
            ? 'bg-white dark:bg-stone-800'
            : 'bg-t-surface-sec dark:bg-stone-800/50';

    const revealTimeLeft = Math.max(0, 60 - timer);
    const isRevealLocked = revealTimeLeft > 0;

    return (
        <div className="flex justify-between w-full relative">
            {/* Reveal Skill Button */}
            {purchasedSkills.includes('skill-reveal') && (
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (revealUses > 0) onReveal(e);
                            else onWatchRevealAd(e);
                        }} 
                        className={`flex flex-col items-center gap-1 transition relative ${getBaseButtonStyle(!revealingCell && !isRevealLocked)}`}
                        disabled={!!revealingCell || isRevealLocked}
                    >
                    {/* Removed border class */}
                    <div className={`p-3 rounded-full shadow-sm transition-all duration-300 relative ${getBaseContainerStyle(!isRevealLocked)}`}>
                        {isRevealLocked ? (
                            <div className="w-5 h-5 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-stone-400 font-mono leading-none">{revealTimeLeft}s</span>
                            </div>
                        ) : (
                            <Icons.Reveal className={`w-5 h-5 ${revealUses > 0 ? 'text-purple-600 dark:text-purple-400' : (revealUses === 0 ? 'text-blue-500' : 'text-stone-300 dark:text-stone-600')}`} />
                        )}
                        
                        {/* Larger Badge for Reveal - Moved to -top-4 -right-4 */}
                        <div className={`absolute -top-4 -right-4 w-7 h-7 rounded-full flex items-center justify-center text-base font-bold leading-none shadow-sm z-10 ${revealUses > 0 && !isRevealLocked ? 'bg-blue-600 text-white' : (revealUses === 0 && !isRevealLocked ? 'bg-blue-600 text-white' : 'bg-stone-300 text-white dark:bg-stone-600')}`}>
                                {revealUses > 0 ? revealUses : (isRevealLocked ? '+' : <span className="text-[10px]">Ad</span>)}
                        </div>
                    </div>
                    <span className="text-sm font-medium">Reveal</span>
                </button>
            )}

            {/* Scan Skill Button */}
            {purchasedSkills.includes('skill-scan') && (
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (scanUses > 0) onScan(e);
                            else onWatchScanAd(e);
                        }} 
                        // Enabled if uses > 0 OR if we can watch an ad (uses == 0)
                        // Disabled only if active cooldown/scanning
                        className={`flex flex-col items-center gap-1 transition relative ${getBaseButtonStyle(!scanCooldown && !isScanning)}`}
                        disabled={scanCooldown || isScanning}
                    >
                    <div className={`p-3 rounded-full shadow-sm transition-all duration-300 relative ${getBaseContainerStyle(!scanCooldown && !isScanning)}`}>
                        <Icons.Scan className={`w-5 h-5 ${scanUses > 0 && !scanCooldown && !isScanning ? 'text-red-600 dark:text-red-400' : (scanUses === 0 ? 'text-blue-500' : 'text-stone-300 dark:text-stone-600')}`} />
                        
                        {/* Badge for Scan */}
                        <div className={`absolute -top-4 -right-4 w-7 h-7 rounded-full flex items-center justify-center text-base font-bold leading-none shadow-sm z-10 ${scanUses > 0 ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}`}>
                            {scanUses > 0 ? scanUses : <span className="text-[10px]">Ad</span>}
                        </div>
                    </div>
                    <span className="text-sm font-medium">Scan</span>
                </button>
            )}

            {/* Auto Skill Button */}
            {purchasedSkills.includes('skill-auto') && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onAutoFill(e); }} 
                    className={`flex flex-col items-center gap-1 transition relative active:scale-95 ${isAutoAvailable ? 'cursor-pointer text-amber-700 dark:text-amber-400' : 'cursor-not-allowed text-stone-300 dark:text-stone-600'}`}
                    disabled={!isAutoAvailable}
                >
                    {/* Removed borders and rings */}
                    <div className={`p-3 rounded-full shadow-sm transition-all duration-300 ${
                        isAutoAvailable 
                        ? 'bg-amber-100 dark:bg-amber-900/30' 
                        : 'bg-t-surface-sec dark:bg-stone-800/50'
                    }`}>
                        <Icons.Auto className={`w-5 h-5 ${isAutoAvailable ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-stone-300 dark:text-stone-600'}`} />
                    </div>
                    <span className="text-sm font-medium">Auto</span>
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
                className={`flex flex-col items-center gap-1 active:scale-95 transition cursor-pointer hover:brightness-95 ${isPencilMode ? 'text-blue-700 dark:text-blue-300' : 'text-stone-900 dark:text-stone-100'}`}
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
    );
};
