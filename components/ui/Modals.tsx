
import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { sounds } from '../../utils/sound';
import { AppSettings, DiamondOffer, Difficulty } from '../../types';
import { Storage } from '../../utils/storage';

interface ReplayModalProps {
    levelId: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ReplayModal: React.FC<ReplayModalProps> = ({ levelId, onConfirm, onCancel }) => {
    const [isClosing, setIsClosing] = useState(false);
    const handleAction = (action: () => void) => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => action(), 300);
    };

    return (
        <div 
            className={`fixed inset-0 z-[130] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
            onClick={() => handleAction(onCancel)}
        >
            <div className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center ${isClosing ? '' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-t-primary mb-2">Replay Level {levelId}?</h3>
                <p className="text-sm text-t-secondary font-medium mb-6 leading-relaxed">
                    This will reset your current progress. Your best time will be preserved.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => handleAction(onCancel)} className="flex-1 py-3 text-t-secondary bg-t-surface-sec rounded-xl font-bold active:scale-95 transition">Cancel</button>
                    <button onClick={() => handleAction(onConfirm)} className="flex-1 py-3 text-white bg-stone-800 dark:bg-blue-600 rounded-xl font-bold shadow-lg active:scale-95 transition">Replay</button>
                </div>
            </div>
        </div>
    );
};

interface PurchaseModalProps {
    item: { id: string; name: string; cost: number; description?: string };
    onConfirm: () => void;
    onCancel: () => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({ item, onConfirm, onCancel }) => {
    const [isClosing, setIsClosing] = useState(false);
    const handleAction = (action: () => void) => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => action(), 300);
    };
    return (
        <div 
            className={`fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
            onClick={() => handleAction(onCancel)}
        >
            <div className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center ${isClosing ? '' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-t-primary mb-2">Unlock {item.name}?</h3>
                <div className="text-t-secondary font-medium mb-1 flex items-center justify-center gap-1">
                    Buy this item for <span className="text-t-primary font-bold">{item.cost}</span> <span className="text-blue-500"><Icons.Diamond className="w-4 h-4 fill-current" /></span>?
                </div>
                {item.description && (
                     <div className="bg-t-surface-sec rounded-xl p-3 mt-4 mb-2">
                        <p className="text-sm text-t-secondary leading-relaxed font-medium">
                            {item.description}
                        </p>
                     </div>
                )}
                <div className="flex gap-3 mt-6">
                    <button onClick={() => handleAction(onCancel)} className="flex-1 py-3 text-t-secondary bg-t-surface-sec rounded-xl font-bold active:scale-95 transition">No</button>
                    {/* Using explicit blue in dark mode for high visibility purchase action */}
                    <button onClick={() => handleAction(onConfirm)} className="flex-1 py-3 text-white bg-stone-800 dark:bg-blue-600 rounded-xl font-bold shadow-lg active:scale-95 transition">Yes</button>
                </div>
            </div>
        </div>
    );
};

interface PaymentModalProps {
    offer: DiamondOffer;
    onComplete: () => void;
    onCancel: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ offer, onComplete, onCancel }) => {
    const [status, setStatus] = useState<'confirm' | 'processing' | 'success'>('confirm');
    const [isClosing, setIsClosing] = useState(false);

    const handlePurchase = () => {
        sounds.playClick();
        setStatus('processing');
        
        // Simulate network delay
        setTimeout(() => {
            setStatus('success');
            sounds.playWin(); // Success sound
            // Wait a bit on success screen then complete
            setTimeout(() => {
                setIsClosing(true);
                setTimeout(() => {
                    onComplete();
                }, 300);
            }, 1000);
        }, 1500);
    };

    const handleCancel = () => {
        if (status === 'processing' || status === 'success') return;
        sounds.playClick();
        setIsClosing(true);
        setTimeout(onCancel, 300);
    };

    return (
        <div 
            className={`fixed inset-0 z-[140] flex items-center justify-center bg-black/40 backdrop-blur-md px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
            onClick={handleCancel}
        >
            <div 
                className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center relative overflow-hidden ${isClosing ? '' : 'animate-pop'}`} 
                onClick={e => e.stopPropagation()}
            >
                {/* Header Icon */}
                <div className="mx-auto w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    {status === 'success' ? (
                        <Icons.Check className="w-8 h-8 text-green-500 animate-pop" />
                    ) : (
                        <Icons.Diamond className="w-8 h-8 text-blue-500 fill-current" />
                    )}
                </div>

                <h3 className="text-xl font-bold text-t-primary mb-1">{offer.title}</h3>
                <p className="text-stone-500 dark:text-stone-400 font-medium mb-6">{offer.priceLabel}</p>

                {status === 'confirm' && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                        <button 
                            onClick={handlePurchase} 
                            className="w-full py-3.5 text-white bg-stone-900 dark:bg-blue-600 rounded-xl font-bold shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                        >
                            <span className="tracking-wide">Purchase</span>
                        </button>
                        <button 
                            onClick={handleCancel} 
                            className="w-full py-3 text-t-secondary hover:text-t-primary transition font-bold"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {status === 'processing' && (
                    <div className="flex flex-col items-center justify-center py-4 animate-fade-in">
                        <div className="w-8 h-8 border-4 border-stone-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">Processing</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center justify-center py-2 animate-fade-in">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">Payment Successful</p>
                        <p className="text-xs text-stone-400 mt-1">Thank you for your purchase</p>
                    </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-t-border text-[10px] text-stone-400 text-center leading-tight">
                    Secure Payment Simulation. <br/> No real money is charged.
                </div>
            </div>
        </div>
    );
};

interface NotEnoughPointsModalProps {
    onClose: () => void;
    onGetMore: () => void;
    onGoPlay: () => void;
}

export const NotEnoughPointsModal: React.FC<NotEnoughPointsModalProps> = ({ onClose, onGetMore, onGoPlay }) => {
    const [isClosing, setIsClosing] = useState(false);
    const handleAction = (action: () => void) => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => action(), 300);
    };

    return (
        <div className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={() => handleAction(onClose)}>
            <div className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center relative ${isClosing ? '' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
                <button onClick={() => handleAction(onClose)} className="absolute right-4 top-4 p-2 bg-t-surface-sec rounded-full hover:bg-stone-200 text-t-secondary active:scale-95 transition">
                    <Icons.Close className="w-4 h-4" />
                </button>
                
                <div className="flex flex-col items-center justify-center gap-2 mb-8 mt-4">
                     <div className="text-lg font-bold text-t-primary flex items-center gap-2">
                        Not enough <span className="text-blue-500"><Icons.Diamond className="w-5 h-5 fill-current" /></span>
                     </div>
                </div>

                <div className="flex flex-col gap-3">
                     {/* Premium Get More Button (Silver Design) */}
                     <button 
                        onClick={() => handleAction(onGetMore)} 
                        style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #cbd5e1 100%)' }}
                        className="w-full p-4 text-slate-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
                     >
                          {/* Soft Blue Glow at bottom (Diamond reflection) */}
                          <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-blue-100/30 to-transparent pointer-events-none" />
                          
                          {/* Sharp Shine Animation */}
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_4s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-[-20deg] pointer-events-none" />

                          <span className="font-bold tracking-wide relative z-10 text-slate-700">Get More</span> 
                          <Icons.Diamond className="w-4 h-4 text-blue-500 fill-current relative z-10 drop-shadow-sm" />
                     </button>

                     <button onClick={() => handleAction(onGoPlay)} className="w-full py-4 text-stone-700 bg-stone-200 dark:text-stone-200 dark:bg-stone-700 rounded-2xl font-bold active:scale-95 transition hover:opacity-90">
                        Go play
                     </button>
                </div>
            </div>
        </div>
    );
};

interface SettingsModalProps {
    settings: AppSettings;
    onToggle: (key: keyof AppSettings) => void;
    onToggleDifficulty: (diff: Difficulty) => void;
    onSetAppearance: (val: 'system' | 'light' | 'dark') => void;
    onReset: () => void;
    onClose: () => void;
    onAddDevPoints?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onToggle, onToggleDifficulty, onSetAppearance, onReset, onClose, onAddDevPoints }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isDifficultyExpanded, setIsDifficultyExpanded] = useState(false);

    const handleClose = () => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    };

    const SettingRow = ({ 
        sKey, 
        icon: Icon, 
        title, 
        desc,
        colorClass = "text-t-primary"
    }: { 
        sKey: keyof AppSettings, 
        icon: any, 
        title: string, 
        desc: string,
        colorClass?: string
    }) => (
        <div className="flex items-center justify-between px-4 py-4 rounded-2xl bg-t-surface-sec">
            <div className="flex items-center gap-4 flex-1 pr-2">
                <div className={`p-2.5 rounded-xl bg-t-surface shadow-sm ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-base font-bold text-t-primary leading-tight">{title}</span>
                    <span className="text-xs font-medium text-t-secondary leading-tight">{desc}</span>
                </div>
            </div>
            <button onClick={() => onToggle(sKey)} className={`w-14 h-8 rounded-full p-1 transition-colors flex-none ${settings[sKey] ? 'bg-green-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${settings[sKey] ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
        </div>
    );

    return (
        <div className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={handleClose}>
            <div className={`bg-t-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 pb-2 shrink-0">
                    <h3 className="text-2xl font-bold text-t-primary">Settings</h3>
                    <button onClick={handleClose} className="p-2 bg-t-surface-sec rounded-full hover:opacity-80 text-t-primary transition-opacity"><Icons.Close className="w-6 h-6" /></button>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 hide-scrollbar">
                    
                    {/* Appearance */}
                    <div className="mb-6">
                         <label className="block text-sm font-bold text-t-secondary uppercase tracking-widest mb-3 ml-1">Theme</label>
                         <div className="bg-t-surface-sec p-1.5 rounded-2xl flex">
                             {(['system', 'light', 'dark'] as const).map((opt) => (
                                 <button 
                                    key={opt}
                                    onClick={() => { sounds.playClick(); onSetAppearance(opt); }}
                                    className={`flex-1 py-3.5 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${settings.appearance === opt ? 'bg-t-surface text-t-primary shadow-sm' : 'text-t-secondary hover:text-t-primary'}`}
                                 >
                                     {opt === 'system' && <Icons.System className="w-6 h-6" />}
                                     {opt === 'light' && <Icons.Sun className="w-6 h-6" />}
                                     {opt === 'dark' && <Icons.Moon className="w-6 h-6" />}
                                     <span className="capitalize">{opt}</span>
                                 </button>
                             ))}
                         </div>
                    </div>

                    {/* Content / Active Difficulties */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-t-secondary uppercase tracking-widest mb-2 ml-1">Content</label>
                        <div className="bg-t-surface-sec rounded-2xl overflow-hidden transition-all duration-300 ease-in-out">
                            <button 
                                onClick={() => { sounds.playClick(); setIsDifficultyExpanded(!isDifficultyExpanded); }}
                                className="w-full flex items-center justify-between px-4 py-4"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-xl bg-t-surface shadow-sm text-indigo-500">
                                        <Icons.BarChart className="w-6 h-6" />
                                    </div>
                                    <div className="text-left flex flex-col gap-0.5">
                                        <span className="text-base font-bold text-t-primary leading-tight">Active Difficulties</span>
                                        <span className="text-xs font-medium text-t-secondary leading-tight">
                                            {Object.values(Difficulty).length - (settings.hiddenDifficulties?.length || 0)} Visible
                                        </span>
                                    </div>
                                </div>
                                <Icons.Back className={`w-5 h-5 text-t-secondary transition-transform duration-300 ${isDifficultyExpanded ? '-rotate-90' : '-rotate-180'}`} />
                            </button>
                            
                            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isDifficultyExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="px-2 pb-2 space-y-1">
                                    <p className="px-4 py-2 text-xs text-t-secondary leading-relaxed font-medium">
                                        Hide difficulties you don't play. At least one must remain visible.
                                    </p>
                                    {Object.values(Difficulty).map(diff => {
                                        const isHidden = settings.hiddenDifficulties?.includes(diff);
                                        return (
                                            <button 
                                                key={diff}
                                                onClick={() => onToggleDifficulty(diff)}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <span className={`text-sm font-bold transition-colors ${isHidden ? 'text-t-secondary' : 'text-t-primary'}`}>{diff}</span>
                                                <Icons.Eye className={`w-5 h-5 transition-colors ${isHidden ? 'text-t-secondary opacity-50' : 'text-stone-700 dark:text-stone-300'}`} />
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gameplay */}
                    <div className="mb-6 space-y-3">
                         <label className="block text-sm font-bold text-t-secondary uppercase tracking-widest mb-2 ml-1">Gameplay</label>
                         
                         <SettingRow 
                            sKey="autoEraseNotes" 
                            icon={Icons.Sparkles} 
                            title="Smart Notes" 
                            desc="Automatically remove notes when you place a number."
                            colorClass="text-amber-500"
                         />
                         
                         <SettingRow 
                            sKey="digitFirst" 
                            icon={Icons.Hand} 
                            title="Digit-First Input" 
                            desc="Select a number first, then tap cells to fill."
                            colorClass="text-blue-500"
                         />

                         <SettingRow 
                            sKey="screenWakeLock" 
                            icon={Icons.Battery} 
                            title="Keep Screen On" 
                            desc="Prevents your screen from sleeping while playing."
                            colorClass="text-green-500"
                         />
                    </div>

                    {/* Interface */}
                    <div className="mb-6 space-y-3">
                         <label className="block text-sm font-bold text-t-secondary uppercase tracking-widest mb-2 ml-1">Interface</label>

                         <SettingRow 
                            sKey="showTimer" 
                            icon={Icons.Clock} 
                            title="Show Timer" 
                            desc="Display the elapsed time during gameplay."
                         />

                         <SettingRow 
                            sKey="generateReplay" 
                            icon={Icons.Video} 
                            title="Generate Replay" 
                            desc="Create a shareable video of your solution."
                         />

                         <SettingRow 
                            sKey="highlight" 
                            icon={Icons.Eye} 
                            title="Highlight Areas" 
                            desc="Highlight rows, columns, and boxes for the selected cell."
                         />

                         <SettingRow 
                            sKey="sound" 
                            icon={Icons.Sound} 
                            title="Sound Effects" 
                            desc="Play sounds for interactions and game events."
                         />

                         <SettingRow 
                            sKey="vibration" 
                            icon={Icons.Vibration} 
                            title="Haptics" 
                            desc="Vibrate on taps and game events."
                         />
                    </div>

                    {/* Development */}
                    {onAddDevPoints && (
                        <div className="mb-6 space-y-3">
                            <label className="block text-sm font-bold text-t-secondary uppercase tracking-widest mb-2 ml-1">Development</label>
                            <button onClick={() => { sounds.playWin(); onAddDevPoints(); }} className="w-full py-4 flex items-center justify-center gap-2 text-blue-500 bg-blue-50 dark:bg-blue-900/10 rounded-2xl transition font-bold text-base border border-blue-100 dark:border-blue-800">
                                <Icons.Diamond className="w-5 h-5 fill-current" /> Dev: Add 5,000 Diamonds
                            </button>
                        </div>
                    )}

                    {/* Danger Zone */}
                    <div className="pt-4 border-t border-t-border">
                        <button onClick={onReset} className="w-full py-4 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition font-bold text-base">
                            <Icons.Trash className="w-5 h-5" /> Reset All Progress
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
