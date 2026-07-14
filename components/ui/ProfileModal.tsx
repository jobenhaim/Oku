import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { AnimatedNumber } from './AnimatedNumber';
import { sounds } from '../../utils/sound';

interface ProfileModalProps {
    onClose: () => void;
    stats: {
        totalGamesWon: number;
        totalDiamondsEarned?: number;
        perfectGames?: number;
    };
}

const AVATAR_OPTIONS = [
    { icon: Icons.User, bg: 'bg-stone-500', text: 'text-white', cardBg: 'bg-stone-500/10' },
    { icon: Icons.Star, bg: 'bg-gradient-to-br from-purple-400 to-purple-600', text: 'text-white', cardBg: 'bg-purple-500/10' },
    { icon: Icons.Flower, bg: 'bg-gradient-to-br from-rose-400 to-rose-600', text: 'text-white', cardBg: 'bg-rose-500/10' },
    { icon: Icons.Sun, bg: 'bg-gradient-to-br from-amber-400 to-amber-600', text: 'text-white', cardBg: 'bg-amber-500/10' },
    { icon: Icons.Moon, bg: 'bg-gradient-to-br from-indigo-400 to-indigo-600', text: 'text-white', cardBg: 'bg-indigo-500/10' },
    { icon: Icons.Wood, bg: 'bg-gradient-to-br from-emerald-400 to-emerald-600', text: 'text-white', cardBg: 'bg-emerald-500/10' },
    { icon: Icons.Diamond, bg: 'bg-gradient-to-br from-cyan-400 to-cyan-600', text: 'text-white', cardBg: 'bg-cyan-500/10' },
    { icon: Icons.Heart, bg: 'bg-gradient-to-br from-pink-400 to-pink-600', text: 'text-white', cardBg: 'bg-pink-500/10' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, stats }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [showCloudToast, setShowCloudToast] = useState(false);
    const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);
    
    const [profile, setProfile] = useState(() => {
        const stored = localStorage.getItem('zen_profile');
        return stored ? JSON.parse(stored) : { 
            username: "Zen Player", 
            avatarColorIndex: 0
        };
    });

    const [isEditingName, setIsEditingName] = useState(false);

    useEffect(() => {
        localStorage.setItem('zen_profile', JSON.stringify(profile));
    }, [profile]);

    const handleClose = () => {
        sounds.playClick();
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    };

    const handleCloudClick = () => {
        sounds.playClick();
        setShowCloudToast(true);
        setTimeout(() => setShowCloudToast(false), 3000);
    };

    const activeOption = AVATAR_OPTIONS[profile.avatarColorIndex] || AVATAR_OPTIONS[0];
    const ActiveIcon = activeOption.icon;

    return (
        <div className={`fixed inset-0 z-[999] bg-stone-900/35 flex items-end sm:items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={handleClose}>
            <div className={`bg-stone-50 dark:bg-stone-900 border border-white/80 dark:border-stone-700 w-full max-w-sm rounded-t-[2.25rem] sm:rounded-[2.25rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden pb-safe relative ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-center items-center px-6 pt-6 pb-2 shrink-0 z-10 relative">
                    <div className="text-center">
                        <p className="text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-[0.32em] mb-1.5">Oku</p>
                        <h3 className="text-xl font-bold text-t-primary leading-none">My Profile</h3>
                    </div>
                    <button onClick={handleClose} aria-label="Close profile" className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm absolute right-5 top-5 p-2 rounded-full text-t-primary active:scale-95 transition">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-6 pb-6 hide-scrollbar min-h-0 space-y-5 relative z-10">
                    
                    {/* User Card */}
                    <div className="flex flex-col items-center gap-3 px-4 pt-4 pb-2">
                        <div 
                            className={`w-24 h-24 rounded-full ${activeOption.bg} ${activeOption.text} flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-lg ring-[6px] ring-white dark:ring-stone-700`}
                            onClick={() => { sounds.playClick(); setIsSelectingAvatar(!isSelectingAvatar); }}
                            title="Tap to change avatar"
                        >
                            <ActiveIcon className="w-11 h-11" />
                        </div>

                        {isSelectingAvatar && (
                            <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex flex-wrap justify-center gap-3 animate-fade-in p-4 rounded-2xl w-full">
                                {AVATAR_OPTIONS.map((opt, idx) => {
                                    const Icon = opt.icon;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                sounds.playClick();
                                                setProfile({...profile, avatarColorIndex: idx});
                                                setIsSelectingAvatar(false);
                                            }}
                                            className={`w-10 h-10 rounded-full ${opt.bg} ${opt.text} flex items-center justify-center hover:scale-110 transition-transform ${profile.avatarColorIndex === idx ? 'ring-2 ring-t-primary ring-offset-2 ring-offset-t-surface-sec' : ''}`}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        
                        <div className="flex flex-col items-center w-full">
                            {isEditingName ? (
                                <input 
                                    autoFocus
                                    value={profile.username}
                                    onChange={e => setProfile({...profile, username: e.target.value})}
                                    onBlur={() => setIsEditingName(false)}
                                    onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
                                    maxLength={20}
                                    className="text-xl font-bold text-t-primary bg-transparent border-b border-t-secondary text-center focus:outline-none w-3/4"
                                />
                            ) : (
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { sounds.playClick(); setIsEditingName(true); }}>
                                    <span className="text-2xl font-bold text-t-primary leading-none truncate">{profile.username || "Anonymous"}</span>
                                    <div className="text-t-secondary group-hover:text-t-primary transition-colors">
                                        <Icons.Pencil className="w-4 h-4" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm rounded-[1.75rem] grid grid-cols-2 px-2 py-5">
                        <div className="flex flex-col items-center text-center px-3 border-r border-stone-200/70 dark:border-white/10">
                            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-400/15 rounded-full flex items-center justify-center mb-2.5">
                                <Icons.Trophy className="w-4 h-4 text-amber-500" />
                            </div>
                            <AnimatedNumber value={stats.totalGamesWon} startFromZero={true} className="text-3xl font-black text-stone-800 dark:text-white tabular-nums leading-none mb-1.5" />
                            <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider leading-tight">Games Won</span>
                        </div>
                        <div className="flex flex-col items-center text-center px-3">
                            <div className="w-9 h-9 bg-sky-100 dark:bg-sky-400/15 rounded-full flex items-center justify-center mb-2.5">
                                <Icons.Diamond className="w-4 h-4 text-blue-500 fill-current" />
                            </div>
                            <AnimatedNumber value={stats.totalDiamondsEarned || 0} startFromZero={true} className="text-3xl font-black text-stone-800 dark:text-white tabular-nums leading-none mb-1.5" />
                            <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider leading-tight">Diamonds Earned</span>
                        </div>
                    </div>

                    {/* Cloud Sync */}
                    <div>
                        <button 
                            onClick={handleCloudClick}
                            className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm w-full p-3.5 rounded-2xl flex items-center justify-between transition-all duration-300 active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700 shadow-sm flex items-center justify-center">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                                        <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                                        <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.16 2.766-2.395 3.558L19.834 21Z"/>
                                        <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
                                    </svg>
                                </div>
                                <div className="flex flex-col text-left gap-0.5">
                                    <span className="text-sm font-bold text-t-primary leading-tight transition-colors duration-300">Sign in with Google</span>
                                    <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 leading-tight">Cloud backup coming soon</span>
                                </div>
                            </div>
                            {showCloudToast ? (
                                <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md animate-fade-in">Coming Soon</span>
                            ) : (
                                <div className="bg-stone-100 dark:bg-stone-700 p-1.5 rounded-full text-t-icon">
                                    <Icons.Next className="w-3 h-3" />
                                </div>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
