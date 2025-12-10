import React, { useState, useEffect } from 'react';
import { Difficulty, AppSettings } from './types';
import { SudokuGame } from './components/SudokuGame';
import { Storage } from './utils/storage';
import { Icons } from './components/ui/Icons';

type Screen = 'splash' | 'difficulty' | 'levels' | 'game' | 'settings' | 'store';

// Define Store Backgrounds
const STATIC_BACKGROUNDS = [
    { id: 'bg-dawn', name: 'Dawn', cost: 100, class: 'bg-gradient-to-br from-orange-50 to-rose-50' },
    { id: 'bg-ocean', name: 'Ocean', cost: 100, class: 'bg-gradient-to-br from-sky-50 to-cyan-50' },
    { id: 'bg-forest', name: 'Forest', cost: 100, class: 'bg-gradient-to-br from-emerald-50 to-green-50' },
    { id: 'bg-dusk', name: 'Dusk', cost: 100, class: 'bg-gradient-to-br from-violet-50 to-purple-50' },
    { id: 'bg-mist', name: 'Mist', cost: 100, class: 'bg-gradient-to-br from-stone-200 to-gray-200' },
];

const DYNAMIC_BACKGROUNDS = [
    { id: 'bg-aurora', name: 'Aurora', cost: 150, class: 'bg-gradient-to-r from-teal-100 via-purple-100 to-blue-100 bg-[length:400%_400%] animate-gradient' },
    { id: 'bg-solar', name: 'Solar', cost: 150, class: 'bg-gradient-to-r from-orange-100 via-amber-100 to-yellow-100 bg-[length:400%_400%] animate-gradient' },
    { id: 'bg-bloom', name: 'Bloom', cost: 150, class: 'bg-gradient-to-r from-pink-100 via-rose-100 to-red-100 bg-[length:400%_400%] animate-gradient' },
    { id: 'bg-ethereal', name: 'Ethereal', cost: 150, class: 'bg-gradient-to-r from-emerald-100 via-teal-100 to-cyan-100 bg-[length:400%_400%] animate-gradient' },
    { id: 'bg-galaxy', name: 'Galaxy', cost: 150, class: 'bg-gradient-to-r from-gray-200 via-slate-300 to-blue-200 bg-[length:400%_400%] animate-gradient' },
];

const ALL_BACKGROUNDS = [...STATIC_BACKGROUNDS, ...DYNAMIC_BACKGROUNDS];

interface PurchaseModalProps {
    item: { id: string; name: string; cost: number };
    onConfirm: () => void;
    onCancel: () => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ item, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4 animate-fade-in" onClick={onCancel}>
        <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center animate-pop" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-stone-800 mb-2">Unlock {item.name}?</h3>
            <p className="text-stone-600 font-medium mb-1">Buy this background for <span className="text-stone-800 font-bold">{item.cost}</span> points?</p>
            <p className="text-xs text-stone-400 mb-6 font-medium">(no refunds!)</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-3 text-stone-600 bg-stone-100 rounded-xl font-bold active:scale-95 transition">No</button>
                <button onClick={onConfirm} className="flex-1 py-3 text-white bg-stone-800 rounded-xl font-bold shadow-lg active:scale-95 transition">Yes</button>
            </div>
        </div>
    </div>
);

interface SettingsModalProps {
    settings: AppSettings;
    onToggle: (key: keyof AppSettings) => void;
    onReset: () => void;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onToggle, onReset, onClose }) => {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // Match animation duration
    };

    return (
        <div className={`fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex items-end sm:items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={handleClose}>
            <div 
                className={`bg-white w-full max-w-md p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-stone-800">Settings</h3>
                    <button onClick={handleClose} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200"><Icons.Close className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50">
                        <div className="flex items-center gap-3 text-stone-700">
                            <Icons.Sound className="w-5 h-5" />
                            <span>Sound Effects</span>
                        </div>
                        <button onClick={() => onToggle('sound')} className={`w-12 h-7 rounded-full p-1 transition-colors ${settings.sound ? 'bg-green-500' : 'bg-stone-300'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.sound ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50">
                        <div className="flex items-center gap-3 text-stone-700">
                            <Icons.Vibration className="w-5 h-5" />
                            <span>Vibration</span>
                        </div>
                        <button onClick={() => onToggle('vibration')} className={`w-12 h-7 rounded-full p-1 transition-colors ${settings.vibration ? 'bg-green-500' : 'bg-stone-300'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.vibration ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50">
                        <div className="flex items-center gap-3 text-stone-700">
                            <Icons.Eye className="w-5 h-5" />
                            <span>Highlight Areas</span>
                        </div>
                        <button onClick={() => onToggle('highlight')} className={`w-12 h-7 rounded-full p-1 transition-colors ${settings.highlight ? 'bg-green-500' : 'bg-stone-300'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.highlight ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50">
                        <div className="flex items-center gap-3 text-stone-700">
                            <Icons.Square className="w-5 h-5" />
                            <span>Default Background</span>
                        </div>
                        <button onClick={() => onToggle('defaultBackground')} className={`w-12 h-7 rounded-full p-1 transition-colors ${settings.defaultBackground ? 'bg-green-500' : 'bg-stone-300'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.defaultBackground ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-stone-100">
                    <button onClick={onReset} className="w-full py-3 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 rounded-xl transition">
                        <Icons.Trash className="w-5 h-5" /> Reset All Progress
                    </button>
                </div>
            </div>
        </div>
    );
};

function formatTimeShort(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(Storage.getSettings());
  const [points, setPoints] = useState<number>(Storage.getPoints());
  const [purchasedBackgrounds, setPurchasedBackgrounds] = useState<string[]>(Storage.getPurchasedBackgrounds());
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(Storage.getSelectedBackground());
  
  const [showSettings, setShowSettings] = useState(false);
  const [replayLevelId, setReplayLevelId] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Store Purchase State
  const [purchaseCandidate, setPurchaseCandidate] = useState<{id: string, name: string, cost: number} | null>(null);

  // Splash Screen Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setScreen('difficulty');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Update points/purchases from storage when returning to store/settings
  useEffect(() => {
     setPurchasedBackgrounds(Storage.getPurchasedBackgrounds());
     setSelectedBackgroundId(Storage.getSelectedBackground());
     setPoints(Storage.getPoints());
  }, [screen]);

  const handleDifficultySelect = (diff: Difficulty) => {
    setIsTransitioning(true);
    setTimeout(() => {
        setSelectedDifficulty(diff);
        setScreen('levels');
        setIsTransitioning(false);
    }, 300);
  };

  const handleLevelBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
        setScreen('difficulty');
        setIsTransitioning(false);
    }, 300);
  };
  
  const handleGameBack = () => {
    setScreen('levels');
    setPoints(Storage.getPoints()); 
  };

  const handleStoreBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
        setScreen('difficulty');
        setIsTransitioning(false);
    }, 300);
  };

  const handleLevelSelect = (levelId: number) => {
    const progress = Storage.getLevelProgress(selectedDifficulty!, levelId);
    if (progress?.status === 'completed') {
        setReplayLevelId(levelId);
    } else {
        setIsTransitioning(true);
        setTimeout(() => {
            setSelectedLevel(levelId);
            setScreen('game');
            setIsTransitioning(false);
        }, 300);
    }
  };

  const confirmReplay = () => {
      if (selectedDifficulty && replayLevelId) {
          Storage.clearLevelProgress(selectedDifficulty, replayLevelId);
          setIsTransitioning(true);
          setReplayLevelId(null);
          setTimeout(() => {
             setSelectedLevel(replayLevelId);
             setScreen('game');
             setIsTransitioning(false);
          }, 300);
      }
  };
  
  const getLevelCount = (diff: Difficulty | null) => {
      switch(diff) {
          case Difficulty.Intense: return 20;
          case Difficulty.Impossible: return 10;
          default: return 100;
      }
  };

  const handleNextLevel = () => {
      const maxLevels = getLevelCount(selectedDifficulty);
      if (selectedLevel && selectedLevel < maxLevels) {
          setSelectedLevel(selectedLevel + 1);
      } else {
          setScreen('levels');
      }
      setPoints(Storage.getPoints());
  };

  const toggleSetting = (key: keyof AppSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    Storage.saveSettings(newSettings);
  };

  const resetProgress = () => {
      if (confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
          Storage.resetAllData();
          window.location.reload();
      }
  };

  const handleEarnPoints = (amount: number) => {
      const newTotal = Storage.addPoints(amount);
      setPoints(newTotal);
  };

  const handleWatchAd = () => {
      if (confirm("Watch a short video to earn 10 Rhombuses?")) {
          setTimeout(() => {
              alert("Thanks for watching! +10 Points");
              handleEarnPoints(10);
          }, 1000);
      }
  };

  const handleSelectBackground = (id: string) => {
      Storage.selectBackground(id);
      setSelectedBackgroundId(id);
  };
  
  const initiatePurchase = (bg: {id: string, name: string, cost: number}) => {
      setPurchaseCandidate({
          id: bg.id,
          name: bg.name,
          cost: bg.cost
      });
  };

  const confirmPurchase = () => {
      if (!purchaseCandidate) return;
      
      if (points >= purchaseCandidate.cost) {
          const success = Storage.purchaseBackground(purchaseCandidate.id, purchaseCandidate.cost);
          if (success) {
              setPurchasedBackgrounds([...purchasedBackgrounds, purchaseCandidate.id]);
              setPoints(Storage.getPoints());
              // We do NOT auto-select, making it "selectable" now.
          }
      } else {
          alert("Not enough Rhombuses!");
      }
      setPurchaseCandidate(null);
  };

  // Determine Game Background
  let gameBackgroundClass = "bg-paper";
  if (!settings.defaultBackground && selectedBackgroundId) {
      const bg = ALL_BACKGROUNDS.find(b => b.id === selectedBackgroundId);
      if (bg) gameBackgroundClass = bg.class;
  }

  // --- Render Components ---

  // 1. Splash
  if (screen === 'splash') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-stone-50">
        <div className="animate-fade-in flex flex-col items-center">
            <div className="w-20 h-20 bg-stone-800 rounded-2xl mb-6 shadow-xl flex items-center justify-center">
                <div className="grid grid-cols-2 gap-1">
                    <div className="w-3 h-3 bg-white rounded-sm opacity-50"></div>
                    <div className="w-3 h-3 bg-white rounded-sm"></div>
                    <div className="w-3 h-3 bg-white rounded-sm"></div>
                    <div className="w-3 h-3 bg-white rounded-sm opacity-50"></div>
                </div>
            </div>
          <h1 className="text-3xl font-light tracking-widest text-stone-800">MINIMAL</h1>
          <h2 className="text-xl font-bold tracking-widest text-stone-400">SUDOKU</h2>
        </div>
      </div>
    );
  }

  // 2. Difficulty Selection (Main Menu)
  if (screen === 'difficulty') {
    const difficulties = Object.values(Difficulty);
    return (
      <div className={`min-h-screen bg-paper text-stone-800 px-6 pt-6 pb-6 flex flex-col items-center ${isTransitioning ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className="w-full max-w-md flex justify-between items-center mb-8 mt-2">
            <div>
                <h1 className="text-2xl font-bold">Select Mode</h1>
                <p className="text-stone-400 text-sm">Choose your difficulty</p>
            </div>
            <div className="flex gap-2">
                 <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-full shadow-sm border border-stone-100">
                    <div className="text-blue-500">
                        <Icons.Diamond className="w-3 h-3 fill-current" />
                    </div>
                    <span className="text-sm font-bold text-stone-700">{points}</span>
                </div>
                <button onClick={() => setShowSettings(true)} className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition">
                    <Icons.Settings className="w-6 h-6 text-stone-600" />
                </button>
            </div>
        </div>

        <div className="w-full max-w-md grid grid-cols-2 gap-3 mb-6">
          {difficulties.map((diff) => {
             const completed = Storage.getCompletedCount(diff);
             const maxLevels = getLevelCount(diff);
             return (
                <button
                key={diff}
                onClick={() => handleDifficultySelect(diff)}
                className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 flex flex-col items-start gap-1 hover:border-blue-200 hover:shadow-md transition-all active:scale-95 text-left"
                >
                <span className="text-base font-bold text-stone-700">{diff}</span>
                <span className="text-xs text-stone-400 font-medium tracking-wide">{completed} / {maxLevels}</span>
                <div className="w-full h-1 bg-stone-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-stone-800" style={{ width: `${(completed/maxLevels)*100}%` }}></div>
                </div>
                </button>
            )
          })}
        </div>

        {/* Store Button */}
        <div className="w-full max-w-md flex flex-col gap-3">
            <button 
                onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setScreen('store');
                        setIsTransitioning(false);
                    }, 300);
                }}
                className="w-full p-4 bg-gradient-to-r from-stone-800 to-stone-700 text-white rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition"
            >
                <Icons.Store className="w-5 h-5" />
                <span className="font-bold tracking-wide">Store</span>
            </button>

            {/* Watch Ad Placeholder */}
             <button 
                onClick={handleWatchAd}
                className="w-full p-4 bg-white border border-blue-200 text-blue-600 rounded-2xl shadow-sm flex items-center justify-center gap-3 active:scale-95 transition hover:bg-blue-50"
            >
                <Icons.Video className="w-5 h-5" />
                <span className="font-medium">Watch an ad and get 10</span>
                <Icons.Diamond className="w-4 h-4 fill-current" />
            </button>
        </div>

        {showSettings && <SettingsModal settings={settings} onToggle={toggleSetting} onReset={resetProgress} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // 5. Store Screen
  if (screen === 'store') {
      return (
        <div className={`min-h-screen bg-paper px-6 pt-6 pb-6 flex flex-col items-center ${isTransitioning ? 'animate-fade-out' : 'animate-fade-in'}`}>
            {/* Store Header */}
            <div className="w-full max-w-md flex items-start mb-6 relative">
                <button onClick={handleStoreBack} className="absolute left-0 p-2 rounded-full hover:bg-stone-200 transition -ml-2">
                    <Icons.Back className="w-6 h-6" />
                </button>
                <div className="w-full text-center mt-2 pointer-events-none">
                    <h1 className="text-xl font-bold text-stone-800">Store</h1>
                </div>
                 <div className="absolute right-0 top-0 flex items-center gap-1 bg-white px-3 py-2 rounded-full shadow-sm border border-stone-100">
                    <div className="text-blue-500">
                        <Icons.Diamond className="w-3 h-3 fill-current" />
                    </div>
                    <span className="text-sm font-bold text-stone-700">{points}</span>
                </div>
            </div>

            {/* Store Content */}
            <div className="w-full max-w-md space-y-8 overflow-y-auto pb-8 hide-scrollbar">
                
                {/* Backgrounds Section */}
                <div>
                     <h2 className="text-lg font-bold text-stone-700 mb-4 ml-1">Backgrounds</h2>

                     {/* Static Backgrounds */}
                     <div className="mb-6">
                        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 ml-1">Static</h3>
                        <div className="grid grid-cols-5 gap-3">
                            {STATIC_BACKGROUNDS.map((bg) => {
                                const isPurchased = purchasedBackgrounds.includes(bg.id);
                                const isSelected = selectedBackgroundId === bg.id;

                                return (
                                    <div key={bg.id} className="flex flex-col items-center gap-1">
                                        <button 
                                            onClick={() => isPurchased ? handleSelectBackground(bg.id) : initiatePurchase(bg)}
                                            className={`
                                                w-full aspect-square rounded-2xl shadow-sm flex flex-col items-center justify-center relative overflow-hidden transition-all active:scale-95
                                                ${bg.class}
                                                ${isSelected ? 'ring-4 ring-inset ring-blue-500/20' : ''}
                                                ${!isPurchased ? 'opacity-90' : ''}
                                            `}
                                        >
                                            {isPurchased && isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                    <Icons.Check className="w-6 h-6 text-white drop-shadow-md" />
                                                </div>
                                            )}
                                            {!isPurchased && (
                                                <div className="flex items-center gap-0.5 text-stone-700 font-bold">
                                                    <span className="text-sm">{bg.cost}</span>
                                                    <Icons.Diamond className="w-3 h-3 fill-current" />
                                                </div>
                                            )}
                                        </button>
                                        <span className="text-[10px] text-stone-500 font-medium">{bg.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Dynamic Backgrounds */}
                    <div>
                        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 ml-1">Dynamic</h3>
                        <div className="grid grid-cols-5 gap-3">
                            {DYNAMIC_BACKGROUNDS.map((bg) => {
                                const isPurchased = purchasedBackgrounds.includes(bg.id);
                                const isSelected = selectedBackgroundId === bg.id;

                                return (
                                    <div key={bg.id} className="flex flex-col items-center gap-1">
                                        <button 
                                            onClick={() => isPurchased ? handleSelectBackground(bg.id) : initiatePurchase(bg)}
                                            className={`
                                                w-full aspect-square rounded-2xl shadow-sm flex flex-col items-center justify-center relative overflow-hidden transition-all active:scale-95
                                                ${bg.class}
                                                ${isSelected ? 'ring-4 ring-inset ring-blue-500/20' : ''}
                                                ${!isPurchased ? 'opacity-90' : ''}
                                            `}
                                        >
                                            {isPurchased && isSelected && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                    <Icons.Check className="w-6 h-6 text-white drop-shadow-md" />
                                                </div>
                                            )}
                                            {!isPurchased && (
                                                <div className="flex items-center gap-0.5 text-stone-700 font-bold">
                                                    <span className="text-sm">{bg.cost}</span>
                                                    <Icons.Diamond className="w-3 h-3 fill-current" />
                                                </div>
                                            )}
                                        </button>
                                        <span className="text-[10px] text-stone-500 font-medium">{bg.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-stone-700 mb-3 ml-1">Grids</h3>
                    <div className="grid grid-cols-2 gap-3">
                         {[1, 2].map(i => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm flex flex-col items-center gap-2 opacity-60">
                                <div className="w-16 h-16 border-2 border-stone-200 rounded mb-1 bg-stone-50"></div>
                                <span className="text-xs font-bold text-stone-400">Coming Soon</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {purchaseCandidate && (
                <PurchaseModal 
                    item={purchaseCandidate} 
                    onConfirm={confirmPurchase} 
                    onCancel={() => setPurchaseCandidate(null)} 
                />
            )}
        </div>
      );
  }

  // 3. Level Selection
  if (screen === 'levels' && selectedDifficulty) {
    const maxLevels = getLevelCount(selectedDifficulty);
    const levels = Array.from({ length: maxLevels }, (_, i) => i + 1);
    
    return (
      <div className={`min-h-screen bg-paper px-6 pt-6 pb-6 flex flex-col items-center ${isTransitioning ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className="w-full max-w-md flex items-start mb-14 relative">
            <button onClick={handleLevelBack} className="absolute left-0 p-2 rounded-full hover:bg-stone-200 transition -ml-2">
                <Icons.Back className="w-6 h-6" />
            </button>
            <div className="w-full text-center mt-12 pointer-events-none">
                <h1 className="text-xl font-bold">{selectedDifficulty}</h1>
                <p className="text-xs text-stone-400 uppercase tracking-widest">Select Level</p>
            </div>
             <button onClick={() => setShowSettings(true)} className="absolute right-0 p-2 rounded-full hover:bg-stone-200 -mr-2">
                <Icons.Settings className="w-6 h-6 text-stone-600" />
            </button>
        </div>

        <div className="w-full max-w-md grid grid-cols-5 gap-3">
          {levels.map((lvl) => {
            const progress = Storage.getLevelProgress(selectedDifficulty, lvl);
            const isCompleted = progress?.status === 'completed';
            const isInProgress = progress?.status === 'in-progress';
            const bestTime = progress?.bestTime;
            // Only show blue dot if NOT completed AND NO PB AND IS in progress
            const showInProgressDot = isInProgress && !bestTime; 
            
            return (
              <button
                key={lvl}
                onClick={() => handleLevelSelect(lvl)}
                className={`
                  aspect-square rounded-xl relative transition-all active:scale-90
                  ${isCompleted 
                    ? 'bg-stone-100 text-stone-300 border border-stone-100' // Greyed out for completed
                    : isInProgress 
                        ? 'bg-white border-2 border-blue-400 shadow-md text-stone-800' 
                        : 'bg-white border border-stone-100 shadow-sm hover:shadow-md text-stone-800'}
                `}
              >
                {/* Center Number Absolute */}
                <div className="absolute inset-0 flex items-center justify-center">
                     <span className="font-bold text-xl leading-none">{lvl}</span>
                </div>
                
                {/* PB Time Display - Absolute Bottom, always show if bestTime exists */}
                {bestTime && (
                    <div className="absolute bottom-1.5 inset-x-0 text-center">
                        <span className="text-[10px] text-stone-400 font-bold tracking-tight block">{formatTimeShort(bestTime)}</span>
                    </div>
                )}
                
                {/* Blue Dot */}
                {showInProgressDot && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute bottom-2 left-1/2 -translate-x-1/2"></div>}
              </button>
            );
          })}
        </div>
        
        {/* Replay Confirmation Modal */}
        {replayLevelId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm px-4 animate-fade-in">
                <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm text-center animate-pop">
                    <h3 className="text-lg font-bold text-stone-800 mb-2">Replay Level {replayLevelId}?</h3>
                    <p className="text-stone-500 text-sm mb-6">This will reset your progress on this level.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setReplayLevelId(null)} className="flex-1 py-3 text-stone-600 bg-stone-100 rounded-xl font-medium active:scale-95 transition">Cancel</button>
                        <button onClick={confirmReplay} className="flex-1 py-3 text-white bg-blue-500 rounded-xl font-medium shadow-md active:scale-95 transition">Replay</button>
                    </div>
                </div>
            </div>
        )}

        {showSettings && <SettingsModal settings={settings} onToggle={toggleSetting} onReset={resetProgress} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // 4. Game Screen
  if (screen === 'game' && selectedDifficulty && selectedLevel) {
    return (
      <div className={`h-screen w-full ${gameBackgroundClass}`}>
         <SudokuGame 
            difficulty={selectedDifficulty}
            levelId={selectedLevel}
            onBack={handleGameBack}
            onComplete={() => {}} 
            onSettingsOpen={() => setShowSettings(true)}
            onNextLevel={handleNextLevel}
            settings={settings}
            onEarnPoints={handleEarnPoints}
            currentPoints={points}
            isSettingsOpen={showSettings}
            backgroundClass={gameBackgroundClass}
         />
         {showSettings && <SettingsModal settings={settings} onToggle={toggleSetting} onReset={resetProgress} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  return null;
}

export default App;