
import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import { sounds } from '../../utils/sound';
import { AppSettings, DiamondOffer, Difficulty } from '../../types';
import { Storage } from '../../utils/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { IAP } from '../../utils/iap';
import type { SuccessfulIAPPurchase } from '../../utils/iap';

// ... (Privacy Policy & Terms text remain unchanged)
const PRIVACY_POLICY_TEXT = `Privacy Policy

Last updated: December 26, 2025

Oku: Sudoku is designed with privacy as a core principle.
This policy explains what data is (and is not) collected and how it is used.

“Oku: Sudoku”, “we”, and “us” refer to the independent developer of the app.

1. Data Collection & Storage

Local Storage
Your game progress, statistics, settings, and purchased items are stored locally on your device.
We do not collect or transmit this data to any external server.

Cloud Backup
If cloud backup is enabled on your device (e.g., iCloud or Google Drive), your game data may be stored securely in your private cloud account to sync across devices or restore data.
We do not have access to your cloud data at any time.
You can disable these backups at the system level.

2. Advertising

Oku: Sudoku may show optional rewarded ads (only when you choose to watch one).

These ads are provided by third-party ad networks.
We do not directly share any personally identifying information with advertisers.

Ads are non-personalized wherever supported, meaning they are not targeted using behavior from other apps or websites.

If an ad provider collects anonymized usage data, this is governed by their own privacy policy and device-level consent controls.

3. In-App Purchases

All purchases are processed securely by your device's App Store.

We do not receive or store:
- credit card numbers
- billing addresses
- or any payment credentials

The App Store's Privacy Policy applies to transactions.

4. Tracking & Personalization

We do not track users across other apps or websites.
We do not sell or share personal data with third parties.
We do not run marketing campaigns using user data.

Where ads are used, they are intended to be non-personalized.

5. Children’s Privacy

Oku: Sudoku is suitable for a general audience but is not directed toward children under 13.

We do not knowingly collect personal data from children.

If you believe a child has provided personal information, please contact us so we can help remove it.

6. Data Deletion & User Control

You are in full control of your game data.

Delete Progress — You can erase all saved data at any time from the in-app Settings screen using “Reset All Progress”.

Uninstalling the App — removes all locally-stored data.

Cloud Data — If cloud sync is enabled, you may also remove saved data via your device's storage settings.

We do not retain any backup copies.

7. Information Security

We rely on your device's secure systems for:
- Cloud storage
- App Store transactions

No gameplay data is stored on our own servers.

8. Changes to This Policy

This policy may occasionally be updated to reflect improvements or legal requirements.

When changes are made, the “Last Updated” date above will be revised.

9. Contact

If you have any questions about this policy or your data, please contact:

📧 jonabenhaim@gmail.com

We are happy to help.`;

const TERMS_OF_SERVICE_TEXT = `Terms of Service

Last updated: December 26, 2025

Please read these terms carefully before using Oku: Sudoku (the “App”). By downloading or using the App, you agree to these Terms of Service.

“Oku: Sudoku”, “we”, “our”, or “the developer” refers to the independent creator of the App.

1. Acceptance of Terms

By downloading, installing, or using the App, you agree to be bound by these Terms.
If you do not agree, please do not use the App.

2. License & Permitted Use

We grant you a personal, limited, non-exclusive, non-transferable license to use the App for personal entertainment.

You agree not to:
- modify, copy, or distribute the App or its content
- reverse engineer or attempt to extract the source code
- use the App for commercial purposes without permission

All rights not expressly granted remain with the developer.

3. In-App Purchases & Virtual Items

The App may offer virtual items including, but not limited to, Diamonds, Themes, and Skills.

Virtual items have no real-world monetary value.
They cannot be exchanged, transferred, refunded, or redeemed for cash.

All purchases are processed securely through the App Store.
Purchases are final and non-refundable, except where required by applicable law.

If you remove or reinstall the App, or change devices, previously purchased non-consumable items can be restored using the “Restore Purchases” option, provided the same account is used.

4. User Data & Privacy

Your use of the App is also governed by our Privacy Policy, which explains how data is handled and stored.

5. Availability & Changes

We may update, modify, or discontinue parts of the App at any time.
We are not obligated to maintain or support the App indefinitely.

6. Disclaimer of Warranties

The App is provided “AS IS” and “AS AVAILABLE.”

We do not guarantee that:
- the App will be free from errors or interruptions
- gameplay or data will always be preserved
- the App will be compatible with all devices

Your use of the App is at your own risk.

7. Limitation of Liability

To the maximum extent permitted by law, the developer shall not be liable for any indirect, incidental, consequential, or special damages arising out of the use of, or inability to use, the App.

Some regions do not allow exclusion of liability — in those cases, liability will be limited to the maximum extent permitted by law.

8. Termination

We reserve the right to terminate or restrict access to the App if these Terms are violated.

9. Changes to These Terms

We may update these Terms from time to time.
If changes are made, the “Last Updated” date above will be revised.

Continued use of the App after changes means you accept the updated Terms.

10. Contact

If you have questions or need support, please contact:

📧 jonabenhaim@gmail.com`;

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
            <div className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center transition-colors duration-300 ${isClosing ? '' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-t-primary mb-2 transition-colors duration-300">Replay Level {levelId}?</h3>
                <p className="text-sm text-t-secondary font-medium mb-6 leading-relaxed transition-colors duration-300">
                    This will reset your current progress. Your best time will be preserved.
                </p>
                <div className="flex gap-3">
                    <button onClick={() => handleAction(onCancel)} className="flex-1 py-3 text-t-secondary bg-t-surface-sec rounded-xl font-bold active:scale-95 transition-all duration-300">Cancel</button>
                    <button onClick={() => handleAction(onConfirm)} className="flex-1 py-3 text-white bg-stone-800 dark:bg-blue-600 rounded-xl font-bold shadow-lg active:scale-95 transition-all duration-300">Replay</button>
                </div>
            </div>
        </div>
    );
};

interface ResetConfirmModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({ onConfirm, onCancel }) => {
    const [isClosing, setIsClosing] = useState(false);
    const handleAction = (action: () => void) => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => action(), 300);
    };

    return (
        <div 
            className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
            onClick={() => handleAction(onCancel)}
        >
            <div className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center border border-red-100 dark:border-red-900/30 transition-colors duration-300 ${isClosing ? '' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                    <Icons.Trash className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-t-primary mb-2">Reset Progress?</h3>
                <p className="text-sm text-t-secondary font-medium mb-6 leading-relaxed">
                    This will permanently delete all your progress, unlocks, and stats. This cannot be undone.
                </p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => handleAction(onConfirm)} className="w-full py-3.5 text-white bg-red-500 rounded-xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-transform">
                        Yes, Reset Everything
                    </button>
                    <button onClick={() => handleAction(onCancel)} className="w-full py-3.5 text-t-secondary bg-t-surface-sec rounded-xl font-bold active:scale-95 transition-transform">
                        Cancel
                    </button>
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
            <div className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center transition-colors duration-300 ${isClosing ? '' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-t-primary mb-2 transition-colors duration-300">Unlock {item.name}?</h3>
                <div className="text-t-secondary font-medium mb-1 flex items-center justify-center gap-1 transition-colors duration-300">
                    Buy this item for <span className="text-t-primary font-bold transition-colors duration-300">{item.cost}</span> <span className="text-blue-500"><Icons.Diamond className="w-4 h-4 fill-current" /></span>?
                </div>
                {item.description && (
                     <div className="bg-t-surface-sec rounded-xl p-3 mt-4 mb-2 transition-colors duration-300">
                        <p className="text-sm text-t-secondary leading-relaxed font-medium transition-colors duration-300">
                            {item.description}
                        </p>
                     </div>
                )}
                <div className="flex gap-3 mt-6">
                    <button onClick={() => handleAction(onCancel)} className="flex-1 py-3 text-t-secondary bg-t-surface-sec rounded-xl font-bold active:scale-95 transition-all duration-300">No</button>
                    <button onClick={() => handleAction(onConfirm)} className="flex-1 py-3 text-white bg-stone-800 dark:bg-blue-600 rounded-xl font-bold shadow-lg active:scale-95 transition-all duration-300">Yes</button>
                </div>
            </div>
        </div>
    );
};

interface PaymentModalProps {
    offer: DiamondOffer;
    onComplete: (purchase: SuccessfulIAPPurchase) => void;
    onCancel: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ offer, onComplete, onCancel }) => {
    const [status, setStatus] = useState<'confirm' | 'processing' | 'success' | 'failed'>('confirm');
    const [isClosing, setIsClosing] = useState(false);
    const [wasRestored, setWasRestored] = useState(false);
    const purchaseBtnRef = useRef<HTMLButtonElement>(null);

    const handlePurchase = async () => {
        sounds.playClick();
        setStatus('processing');
        
        try {
            const result = await IAP.purchase(offer.productId);
            if (result.status === 'purchased' || result.status === 'restored') {
                setWasRestored(result.status === 'restored');
                setStatus('success');
                sounds.playWin(); 
                setTimeout(() => {
                    setIsClosing(true);
                    setTimeout(() => {
                        onComplete(result);
                    }, 300);
                }, 1000);
            } else if (result.status === 'cancelled') {
                setIsClosing(true);
                setTimeout(onCancel, 300);
            } else {
                setStatus('failed');
            }
        } catch (error) {
            console.error("Purchase failed", error);
            setStatus('failed');
            // Allow retry or cancel after failure
            setTimeout(() => setStatus('confirm'), 2000);
        }
    };

    const handleCancel = () => {
        if (status === 'processing' || status === 'success') return;
        sounds.playClick();
        setIsClosing(true);
        setTimeout(onCancel, 300);
    };

    const getDescription = () => {
        if (offer.type === 'support') {
            return (
                <span>
                    Meet <span className="font-bold">Pepino</span>, a little companion who lives in a peaceful aquarium, grows with you, and brings a diamond gift after every completed game. Includes <span className="font-bold">1,500 Diamonds</span> and no forced ads.
                </span>
            );
        }
        if (offer.type === 'starter') {
            return (
                <span>
                    Includes <span className="font-bold">500 Diamonds</span>, plus permanent access to <span className="font-bold">Scribe</span> & <span className="font-bold">Scan</span> skills and the <span className="font-bold">Piano</span> sound pack.
                </span>
            );
        }
        return (
            <span>
                Instantly add <span className="font-bold">{offer.diamonds} Diamonds</span> to your balance to unlock themes, sounds, and skills.
            </span>
        );
    };

    return (
        <div 
            className={`fixed inset-0 z-[140] flex items-center justify-center bg-black/40 backdrop-blur-md px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
            onClick={handleCancel}
        >
            <div 
                className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center relative overflow-hidden transition-colors duration-300 ${isClosing ? '' : 'animate-pop'}`} 
                onClick={e => e.stopPropagation()}
            >
                {/* Header Icon */}
                <div className="mx-auto w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm transition-colors duration-300">
                    {status === 'success' ? (
                        <Icons.Check className="w-8 h-8 text-green-500 animate-pop" />
                    ) : status === 'failed' ? (
                        <Icons.Close className="w-8 h-8 text-red-500 animate-pop" />
                    ) : offer.type === 'support' ? (
                        <Icons.Trophy className="w-8 h-8 text-amber-500 fill-current" />
                    ) : (
                        <Icons.Diamond className="w-8 h-8 text-blue-500 fill-current" />
                    )}
                </div>

                <h3 className="text-xl font-bold text-t-primary mb-1 transition-colors duration-300">{offer.title}</h3>
                <p className="text-stone-500 dark:text-stone-400 font-medium mb-3 transition-colors duration-300">{offer.priceLabel}</p>

                {/* Description Box */}
                <div className="bg-stone-50 dark:bg-stone-900/50 p-3 rounded-xl mb-6 text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-medium transition-colors duration-300">
                    {getDescription()}
                </div>

                {(status === 'confirm' || status === 'failed') && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                        <button 
                            ref={purchaseBtnRef}
                            onClick={handlePurchase} 
                            className="w-full py-3.5 text-white bg-blue-500 hover:bg-blue-600 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition flex items-center justify-center gap-2"
                        >
                            <span className="tracking-wide">{status === 'failed' ? 'Retry' : 'Purchase'}</span>
                        </button>
                        <button 
                            onClick={handleCancel} 
                            className="w-full py-3 text-t-secondary hover:text-t-primary transition-colors duration-300 font-bold"
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
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{wasRestored ? 'Purchase Restored' : 'Payment Successful'}</p>
                        <p className="text-xs text-stone-400 mt-1">{wasRestored ? 'Your access is ready' : 'Thank you for your purchase'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface NotEnoughPointsModalProps {
    onClose: () => void;
    onShop: () => void;
    onHome: () => void;
}

export const NotEnoughPointsModal: React.FC<NotEnoughPointsModalProps> = ({ onClose, onShop, onHome }) => {
    const [isClosing, setIsClosing] = useState(false);
    const handleAction = (action: () => void) => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => action(), 300);
    };

    return (
        <div className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={() => handleAction(onClose)}>
            <div className={`bg-t-surface p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center relative transition-colors duration-300 ${isClosing ? '' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
                <button onClick={() => handleAction(onClose)} className="absolute right-4 top-4 p-2 bg-t-surface-sec rounded-full hover:bg-stone-200 text-t-secondary active:scale-95 transition-all duration-300">
                    <Icons.Close className="w-4 h-4" />
                </button>
                
                <div className="flex items-center justify-center mb-7 mt-4">
                    <h3 className="text-lg font-bold text-t-primary flex items-center gap-2 transition-colors duration-300">
                        <span>Not enough</span>
                        <Icons.Diamond className="w-5 h-5 text-blue-500 fill-current" />
                    </h3>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => handleAction(onShop)}
                        className="w-full py-3.5 text-white bg-blue-500 rounded-2xl font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-transform duration-200 flex items-center justify-center gap-2"
                    >
                        <Icons.Star className="w-4 h-4 fill-current" />
                        Oku Shop
                    </button>

                    <button
                        onClick={() => handleAction(onHome)}
                        className="w-full py-3.5 text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold active:scale-95 transition-transform duration-200 flex items-center justify-center gap-2"
                    >
                        <Icons.Home className="w-4 h-4" strokeWidth={2.6} />
                        Home
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
    onRedeemCode: (code: string) => boolean;
    redeemedCoupons: string[];
}

const SettingRow = ({ 
    sKey, 
    icon: Icon, 
    title, 
    desc,
    settings,
    onToggle
}: { 
    sKey: keyof AppSettings, 
    icon: any, 
    title: string, 
    desc: string,
    settings: AppSettings,
    onToggle: (key: keyof AppSettings) => void
}) => (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-stone-300/70 dark:border-neutral-600/70 last:border-b-0 transition-colors duration-300">
        <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-t-surface flex items-center justify-center flex-none text-stone-900 dark:text-stone-100 transition-colors duration-300">
                <Icon className="w-[18px] h-[18px]" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-bold text-t-primary leading-tight transition-colors duration-300">{title}</span>
                <span className="text-[11px] font-medium text-t-secondary leading-snug transition-colors duration-300">{desc}</span>
            </div>
        </div>
        <button onClick={() => onToggle(sKey)} className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex-none ${settings[sKey] ? 'bg-green-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${settings[sKey] ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </button>
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onToggle, onToggleDifficulty, onSetAppearance, onReset, onClose, onRedeemCode, redeemedCoupons }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isDifficultyExpanded, setIsDifficultyExpanded] = useState(false);
    const [activeDoc, setActiveDoc] = useState<'privacy' | 'terms' | null>(null);
    const [showDarkToast, setShowDarkToast] = useState(false);
    const [showResetPreConfirm, setShowResetPreConfirm] = useState(false);
    
    // Coupon State
    const [showCouponInput, setShowCouponInput] = useState(false);
    const [couponCode, setCouponCode] = useState("");
    const [redeemStatus, setRedeemStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleClose = () => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    };

    const handleDocBack = () => {
        sounds.playClick();
        setActiveDoc(null);
    };

    const handleCouponClick = () => {
        sounds.playClick();
        setShowCouponInput(true);
    };

    const handleCouponCancel = () => {
        sounds.playClick();
        setShowCouponInput(false);
        setCouponCode("");
        setRedeemStatus('idle');
    };

    const handleRedeemSubmit = () => {
        const success = onRedeemCode(couponCode);
        if (success) {
            setRedeemStatus('success');
            setTimeout(() => {
                setShowCouponInput(false);
                setCouponCode("");
                setRedeemStatus('idle');
            }, 1500);
        } else {
            setRedeemStatus('error');
            setTimeout(() => setRedeemStatus('idle'), 1000);
        }
    };

    const handleResetPreConfirm = () => {
        sounds.playClick();
        setShowResetPreConfirm(false);
        onReset();
    };

    return (
        <div className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={handleClose}>
            
            {/* Top-Level Toast Notification (Outside Modal Content) */}
            <AnimatePresence>
                {showDarkToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -100 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute top-0 left-0 right-0 flex justify-center z-[1000] pointer-events-none pt-safe mt-4"
                    >
                        <div className="bg-stone-900/90 text-white px-5 py-3 rounded-full text-xs font-bold shadow-2xl border border-white/10 flex items-center gap-2.5 backdrop-blur-xl">
                            <Icons.Moon className="w-4 h-4 text-blue-400 fill-current" />
                            <span>Backgrounds hidden for eye comfort</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Added pb-safe to allow bottom sheet to respect home indicator */}
            <div className={`bg-t-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-300 pb-safe ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center px-5 pt-4 pb-2 shrink-0 bg-t-surface z-10 transition-colors duration-300">
                    <h3 className="text-xl font-bold text-t-primary transition-colors duration-300">Settings</h3>
                    <button onClick={handleClose} className="p-1.5 bg-t-surface-sec rounded-full text-t-primary transition-colors duration-300"><Icons.Close className="w-5 h-5" /></button>
                </div>
                
                {/* Content Container - Flex-1 allows it to take space, relative for conditional rendering */}
                <div className="flex-1 overflow-hidden relative w-full flex flex-col min-h-0">
                    
                    {/* Render MAIN LIST if no doc active */}
                    {!activeDoc && (
                        <div className="scroll-edge-fade flex-1 overflow-y-auto px-5 pt-3 pb-5 hide-scrollbar animate-fade-in min-h-0">
                            {/* Appearance */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-t-secondary uppercase tracking-[0.18em] mb-2 ml-1 transition-colors duration-300">Theme</label>
                                <div className="bg-t-surface-sec p-1 rounded-xl flex transition-colors duration-300">
                                    {(['system', 'light', 'dark'] as const).map((opt) => (
                                        <button 
                                            key={opt}
                                            onClick={() => { 
                                                sounds.playClick(); 
                                                onSetAppearance(opt); 
                                                if (opt === 'dark') {
                                                    setShowDarkToast(true);
                                                    setTimeout(() => setShowDarkToast(false), 3000);
                                                }
                                            }}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-300 ${settings.appearance === opt ? 'bg-t-surface text-t-primary shadow-sm' : 'text-t-secondary'}`}
                                        >
                                            {opt === 'system' && <Icons.System className="w-4 h-4 text-stone-900 dark:text-stone-100" />}
                                            {opt === 'light' && <Icons.Sun className="w-4 h-4 text-stone-900 dark:text-stone-100" />}
                                            {opt === 'dark' && <Icons.Moon className="w-4 h-4 text-stone-900 dark:text-stone-100" />}
                                            <span className="capitalize">{opt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Content / Active Difficulties */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-t-secondary uppercase tracking-[0.18em] mb-2 ml-1 transition-colors duration-300">Content</label>
                                <div className="bg-t-surface-sec rounded-xl overflow-hidden transition-colors duration-300">
                                    <button 
                                        onClick={() => { sounds.playClick(); setIsDifficultyExpanded(!isDifficultyExpanded); }}
                                        className="w-full flex items-center justify-between px-3 py-2.5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-t-surface flex items-center justify-center text-stone-900 dark:text-stone-100 transition-colors duration-300">
                                                <Icons.BarChart className="w-[18px] h-[18px]" />
                                            </div>
                                            <div className="text-left flex flex-col gap-0.5">
                                                <span className="text-sm font-bold text-t-primary leading-tight transition-colors duration-300">Active Difficulties</span>
                                                <span className="text-[11px] font-medium text-t-secondary leading-tight transition-colors duration-300">
                                                    {Object.values(Difficulty).length - (settings.hiddenDifficulties?.length || 0)} Visible
                                                </span>
                                            </div>
                                        </div>
                                        <Icons.Back className={`w-4 h-4 text-stone-900 dark:text-stone-100 transition-transform duration-200 ${isDifficultyExpanded ? '-rotate-90' : '-rotate-180'}`} />
                                    </button>
                                    
                                    <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${isDifficultyExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                                        <div className="min-h-0 overflow-hidden">
                                            <div className="px-2 pb-2 border-t border-t-border">
                                                <p className="px-2.5 py-2 text-[10px] text-t-secondary leading-relaxed font-medium transition-colors duration-300">
                                                    Hide difficulties you don't play. At least one must remain visible.
                                                </p>
                                                <div className="divide-y divide-stone-200/60 dark:divide-white/5">
                                                    {Object.values(Difficulty).map(diff => {
                                                        const isHidden = settings.hiddenDifficulties?.includes(diff);
                                                        return (
                                                            <button
                                                                key={diff}
                                                                onClick={() => onToggleDifficulty(diff)}
                                                                className="oku-difficulty-visibility-option w-full flex items-center justify-between px-2.5 py-2.5"
                                                            >
                                                                <span className={`text-xs font-bold ${isHidden ? 'text-t-secondary' : 'text-t-primary'}`}>{diff}</span>
                                                                <Icons.Eye className={`w-4 h-4 ${isHidden ? 'text-t-secondary opacity-50' : 'text-stone-900 dark:text-stone-100'}`} />
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Gameplay */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-t-secondary uppercase tracking-[0.18em] mb-2 ml-1 transition-colors duration-300">Gameplay</label>
                                <div className="bg-t-surface-sec rounded-xl overflow-hidden">
                                <SettingRow
                                    sKey="autoEraseNotes" 
                                    icon={Icons.Note}
                                    title="Smart Notes" 
                                    desc="Automatically remove notes when you place a number."
                                    settings={settings}
                                    onToggle={onToggle}
                                />
                                
                                <SettingRow 
                                    sKey="digitFirst" 
                                    icon={Icons.Hand} 
                                    title="Digit-First Input" 
                                    desc="Select a number first, then tap cells to fill."
                                    settings={settings}
                                    onToggle={onToggle}
                                />

                                <SettingRow 
                                    sKey="screenWakeLock" 
                                    icon={Icons.Battery} 
                                    title="Keep Screen On" 
                                    desc="Prevents your screen from sleeping while playing."
                                    settings={settings}
                                    onToggle={onToggle}
                                />
                                </div>
                            </div>

                            {/* Interface */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-t-secondary uppercase tracking-[0.18em] mb-2 ml-1 transition-colors duration-300">Interface</label>
                                <div className="bg-t-surface-sec rounded-xl overflow-hidden">

                                <SettingRow 
                                    sKey="showTimer" 
                                    icon={Icons.Clock} 
                                    title="Show Timer" 
                                    desc="Display the elapsed time during gameplay."
                                    settings={settings}
                                    onToggle={onToggle}
                                />

                                <SettingRow 
                                    sKey="generateReplay" 
                                    icon={Icons.Video} 
                                    title="Generate Replay" 
                                    desc="Create a shareable video of your solution."
                                    settings={settings}
                                    onToggle={onToggle}
                                />

                                <SettingRow 
                                    sKey="highlight" 
                                    icon={Icons.Eye} 
                                    title="Highlight Areas" 
                                    desc="Highlight rows, columns, and boxes for the selected cell."
                                    settings={settings}
                                    onToggle={onToggle}
                                />

                                <SettingRow
                                    sKey="pillNotifications"
                                    icon={Icons.Bell}
                                    title="Pill Notifications"
                                    desc="Show helpful messages above the Sudoku grid."
                                    settings={settings}
                                    onToggle={onToggle}
                                />

                                <SettingRow 
                                    sKey="sound" 
                                    icon={Icons.Sound} 
                                    title="Sound Effects" 
                                    desc="Play sounds for interactions and game events."
                                    settings={settings}
                                    onToggle={onToggle}
                                />

                                <SettingRow 
                                    sKey="vibration" 
                                    icon={Icons.Vibration} 
                                    title="Haptics" 
                                    desc="Vibrate on taps and game events."
                                    settings={settings}
                                    onToggle={onToggle}
                                />

                                {/* Developer Options */}
                                {(redeemedCoupons.includes('HAHASOLVE') || redeemedCoupons.includes('hahasolve')) && (
                                    <SettingRow 
                                        sKey="devAutoSolve" 
                                        icon={Icons.Keyboard} 
                                        title="Auto-Solve" 
                                        desc="Enable instant win button for testing."
                                        settings={settings}
                                        onToggle={onToggle}
                                    />
                                )}
                                </div>

                                {/* Coupon Row */}
                                {showCouponInput ? (
                                    <div className="mt-2 px-3 py-3 rounded-xl bg-t-surface-sec transition-colors duration-300 flex flex-col gap-2.5 animate-fade-in">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icons.Ticket className="w-5 h-5 text-stone-900 dark:text-stone-100" />
                                            <span className="text-sm font-bold text-t-primary">Enter Code</span>
                                        </div>
                                        
                                        <input 
                                            type="text" 
                                            value={couponCode}
                                            onChange={(e) => {
                                                setCouponCode(e.target.value);
                                                if (redeemStatus === 'error') setRedeemStatus('idle');
                                            }}
                                            placeholder="CODE"
                                            className={`w-full bg-t-surface border-2 rounded-lg px-3 py-2.5 outline-none text-stone-800 dark:text-stone-100 font-bold uppercase tracking-widest text-center transition-all ${
                                                redeemStatus === 'error' 
                                                ? 'border-red-500 ring-2 ring-red-500/20' 
                                                : redeemStatus === 'success' 
                                                ? 'border-green-500 ring-2 ring-green-500/20'
                                                : 'border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                                            }`}
                                        />
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={handleCouponCancel}
                                                className="flex-1 py-2.5 text-xs font-bold text-stone-500 dark:text-stone-400 bg-t-surface rounded-lg transition active:scale-95"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                onClick={handleRedeemSubmit}
                                                className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-500 rounded-lg transition active:scale-95 shadow-lg shadow-blue-500/20"
                                            >
                                                {redeemStatus === 'success' ? 'Success!' : 'Redeem'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleCouponClick}
                                        className="mt-2 w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-t-surface-sec transition-transform duration-300 active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3 flex-1 pr-2">
                                            <div className="w-8 h-8 rounded-lg bg-t-surface flex items-center justify-center text-stone-900 dark:text-stone-100 transition-colors duration-300">
                                                <Icons.Ticket className="w-[18px] h-[18px]" />
                                            </div>
                                            <div className="flex flex-col gap-0.5 text-left">
                                                <span className="text-sm font-bold text-t-primary leading-tight transition-colors duration-300">Redeem Coupon</span>
                                                <span className="text-[11px] font-medium text-t-secondary leading-tight transition-colors duration-300">Enter code for rewards</span>
                                            </div>
                                        </div>
                                        <div className="bg-t-surface p-1.5 rounded-full text-stone-900 dark:text-stone-100 transition-colors">
                                            <Icons.Next className="w-4 h-4" />
                                        </div>
                                    </button>
                                )}
                            </div>

                            {/* Danger Zone */}
                            <div className="pt-3 border-t border-t-border flex flex-col gap-2 transition-colors duration-300">
                                <button onClick={() => { sounds.playClick(); setShowResetPreConfirm(true); }} className="w-full py-2.5 flex items-center justify-center gap-2 text-red-500 rounded-xl transition-colors duration-300 font-bold text-sm">
                                    <Icons.Trash className="w-4 h-4 text-stone-900 dark:text-stone-100" /> Reset All Progress
                                </button>
                                <p className="text-[9px] text-center text-t-secondary font-medium px-4 leading-relaxed transition-colors duration-300">
                                    Your progress is saved in your device's Cloud Backup.<br/>We cannot access your data.
                                </p>
                            </div>

                            {/* Legal Links */}
                            <div className="flex flex-col items-center gap-3 py-5">
                                <div className="flex items-center gap-4 text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest transition-colors duration-300">
                                    <button onClick={() => { sounds.playClick(); setActiveDoc('privacy'); }} className="transition-colors duration-300 px-2 py-1">Privacy Policy</button>
                                    <div className="w-1 h-1 rounded-full bg-stone-300 dark:bg-stone-700 transition-colors duration-300" />
                                    <button onClick={() => { sounds.playClick(); setActiveDoc('terms'); }} className="transition-colors duration-300 px-2 py-1">Terms of Service</button>
                                </div>
                                <span className="text-[9px] text-stone-300 dark:text-stone-600 font-mono transition-colors duration-300">v3.9.4</span>
                            </div>
                        </div>
                    )}

                    {/* Render DOC VIEW if active */}
                    {activeDoc && (
                        <div className="flex-1 flex flex-col bg-white dark:bg-stone-900 animate-slide-up min-h-0 h-full transition-colors duration-300">
                            {/* Document Header */}
                            <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200 dark:border-stone-800 shrink-0 bg-white dark:bg-stone-900 z-10 transition-colors duration-300">
                                <button 
                                    onClick={handleDocBack} 
                                    className="p-2 -ml-2 rounded-full text-stone-600 dark:text-stone-300"
                                >
                                    <Icons.Back className="w-6 h-6" />
                                </button>
                                <h3 className="text-lg font-bold text-stone-900 dark:text-white transition-colors duration-300">
                                    {activeDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                                </h3>
                            </div>
                            
                            {/* Document Text - This is Scrollable */}
                            <div className="scroll-edge-fade flex-1 overflow-y-auto p-6 min-h-0">
                                <div className="text-stone-600 dark:text-stone-300 text-sm leading-relaxed whitespace-pre-wrap font-medium pb-8 transition-colors duration-300">
                                    {activeDoc === 'privacy' ? PRIVACY_POLICY_TEXT : TERMS_OF_SERVICE_TEXT}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showResetPreConfirm && (
                <div
                    className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4 animate-fade-in"
                    onClick={(e) => {
                        e.stopPropagation();
                        sounds.playClick();
                        setShowResetPreConfirm(false);
                    }}
                >
                    <div
                        className="bg-t-surface p-5 rounded-3xl shadow-2xl w-full max-w-xs text-center animate-pop transition-colors duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-bold text-t-primary mb-5">Are you sure?</h3>
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => { sounds.playClick(); setShowResetPreConfirm(false); }}
                                className="w-full py-3 text-t-primary bg-t-surface-sec rounded-xl font-bold active:scale-95 transition-transform"
                            >
                                No
                            </button>
                            <button
                                onClick={handleResetPreConfirm}
                                className="w-full py-3 text-red-500 rounded-xl font-bold active:scale-95 transition-transform"
                            >
                                Yes, I’m sure
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
