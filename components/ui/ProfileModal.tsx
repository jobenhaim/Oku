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
        <div className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={handleClose}>
            <div className={`bg-t-surface w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-300 pb-safe ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 pb-4 shrink-0 bg-t-surface z-10 transition-colors duration-300">
                    <h3 className="text-xl font-bold text-t-primary transition-colors duration-300">Profile</h3>
                    <button onClick={handleClose} className="p-2 bg-t-surface-sec rounded-full hover:opacity-80 text-t-primary transition-all duration-300">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-6 pb-6 hide-scrollbar min-h-0 space-y-6">
                    
                    {/* User Card */}
                    <div className={`flex flex-col items-center gap-5 p-6 rounded-3xl transition-colors duration-300 ${activeOption.cardBg}`}>
                        <div 
                            className={`w-20 h-20 rounded-full ${activeOption.bg} ${activeOption.text} flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-inner`}
                            onClick={() => { sounds.playClick(); setIsSelectingAvatar(!isSelectingAvatar); }}
                            title="Tap to change avatar"
                        >
                            <ActiveIcon className="w-10 h-10" />
                        </div>

                        {isSelectingAvatar && (
                            <div className="flex flex-wrap justify-center gap-3 animate-fade-in bg-t-surface p-4 rounded-2xl w-full">
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
                                    <span className="text-xl font-bold text-t-primary leading-none transition-colors duration-300 truncate">{profile.username || "Anonymous"}</span>
                                    <div className="text-t-secondary group-hover:text-t-primary transition-colors">
                                        <Icons.Pencil className="w-4 h-4" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div>
                        <label className="block text-xs font-bold text-t-secondary uppercase tracking-widest mb-3 ml-1 transition-colors duration-300">Progress</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="group bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-stone-800/80 dark:to-stone-900 p-5 rounded-3xl flex flex-col items-start relative overflow-hidden transition-all duration-300 border border-amber-200/50 dark:border-stone-700/50 shadow-sm">
                                <div className="absolute -right-3 -bottom-3 opacity-[0.08] dark:opacity-[0.03] pointer-events-none transition-transform duration-500">
                                    <Icons.Trophy className="w-24 h-24 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="bg-white/80 dark:bg-stone-800/80 p-2.5 rounded-2xl mb-6 backdrop-blur-sm shadow-sm border border-amber-100/50 dark:border-stone-700/50 relative z-10 transition-transform">
                                    <Icons.Trophy className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                                </div>
                                <AnimatedNumber value={stats.totalGamesWon} startFromZero={true} className="text-3xl font-black text-stone-800 dark:text-white tabular-nums leading-none mb-1.5 relative z-10" />
                                <span className="text-[10px] font-bold text-amber-700/70 dark:text-amber-400/50 uppercase tracking-wider leading-tight relative z-10">Total Games<br/>Won</span>
                            </div>
                            
                            <div className="group bg-gradient-to-br from-cyan-50 to-cyan-100/30 dark:from-stone-800/80 dark:to-stone-900 p-5 rounded-3xl flex flex-col items-start relative overflow-hidden transition-all duration-300 border border-cyan-200/50 dark:border-stone-700/50 shadow-sm">
                                <div className="absolute -right-3 -bottom-3 opacity-[0.08] dark:opacity-[0.03] pointer-events-none transition-transform duration-500">
                                    <Icons.Diamond className="w-24 h-24 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <div className="bg-white/80 dark:bg-stone-800/80 p-2.5 rounded-2xl mb-6 backdrop-blur-sm shadow-sm border border-cyan-100/50 dark:border-stone-700/50 relative z-10 transition-transform">
                                    <Icons.Diamond className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                                </div>
                                <AnimatedNumber value={stats.totalDiamondsEarned || 0} startFromZero={true} className="text-3xl font-black text-stone-800 dark:text-white tabular-nums leading-none mb-1.5 relative z-10" />
                                <span className="text-[10px] font-bold text-cyan-700/70 dark:text-cyan-400/50 uppercase tracking-wider leading-tight relative z-10">Total Diamonds<br/>Earned</span>
                            </div>
                        </div>
                    </div>

                    {/* Cloud Sync */}
                    <div>
                        <label className="block text-xs font-bold text-t-secondary uppercase tracking-widest mb-2 ml-1 transition-colors duration-300">Cloud Backup</label>
                        <button 
                            onClick={handleCloudClick}
                            className="w-full bg-t-surface-sec p-3 rounded-2xl flex items-center justify-between hover:bg-stone-200 dark:hover:bg-stone-800 transition-all duration-300 active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-white dark:bg-stone-800 shadow-sm flex items-center justify-center">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                                        <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                                        <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.16 2.766-2.395 3.558L19.834 21Z"/>
                                        <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
                                    </svg>
                                </div>
                                <div className="flex flex-col text-left gap-0.5">
                                    <span className="text-sm font-bold text-t-primary leading-tight transition-colors duration-300">Sign in with Google</span>
                                    <span className="text-[10px] font-medium text-t-secondary leading-tight transition-colors duration-300">Save progress to cloud</span>
                                </div>
                            </div>
                            {showCloudToast ? (
                                <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md animate-fade-in">Coming Soon</span>
                            ) : (
                                <div className="bg-t-surface p-1.5 rounded-full text-t-icon">
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
