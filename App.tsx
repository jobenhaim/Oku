
import React, { useState, useEffect } from 'react';
import { Difficulty, AppSettings, DiamondOffer } from './types';
import { SudokuGame } from './components/SudokuGame';
import { Storage } from './utils/storage';
import { sounds } from './utils/sound';
import { getPackCost, NUMBER_COLORS, ALL_BACKGROUNDS } from './utils/constants';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { IAP } from './utils/iap'; // Import IAP Service

// UI Components
import { PurchaseModal, ReplayModal, NotEnoughPointsModal, SettingsModal, PaymentModal } from './components/ui/Modals';
import { LandscapeBlocker } from './components/ui/LandscapeBlocker';

// Screens
import { SplashScreen } from './components/screens/SplashScreen';
import { DifficultyScreen } from './components/screens/DifficultyScreen';
import { LevelsScreen } from './components/screens/LevelsScreen';
import { StoreScreen } from './components/screens/StoreScreen';
import { DiamondShopScreen } from './components/screens/DiamondShopScreen';
import { StatsScreen } from './components/screens/StatsScreen';

type Screen = 'splash' | 'difficulty' | 'levels' | 'game' | 'settings' | 'store' | 'diamondShop' | 'stats';

// Optimized Diamond Background Component (CSS-based)
const DiamondBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 bg-diamond-pattern" />
);

export function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [direction, setDirection] = useState<number>(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(Storage.getSettings());
  const [points, setPoints] = useState<number>(Storage.getPoints());
  
  const [purchasedBackgrounds, setPurchasedBackgrounds] = useState<string[]>(Storage.getPurchasedBackgrounds());
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(Storage.getSelectedBackground());
  
  const [purchasedNumberColors, setPurchasedNumberColors] = useState<string[]>(Storage.getPurchasedNumberColors());
  const [selectedNumberColorId, setSelectedNumberColorId] = useState<string>(Storage.getSelectedNumberColor());

  const [purchasedSoundPacks, setPurchasedSoundPacks] = useState<string[]>(Storage.getPurchasedSoundPacks());
  const [selectedSoundPackId, setSelectedSoundPackId] = useState<string>(Storage.getSelectedSoundPack());
  
  const [purchasedSkills, setPurchasedSkills] = useState<string[]>(Storage.getPurchasedSkills());
  const [enabledSkills, setEnabledSkills] = useState<string[]>(Storage.getEnabledSkills());
  const [starterPackPurchased, setStarterPackPurchased] = useState<boolean>(Storage.isStarterPackPurchased());
  
  // Unlocked Packs State - For Immediate UI Reactivity
  const [unlockedPacks2, setUnlockedPacks2] = useState<string[]>(Storage.getUnlockedPacks2());
  const [unlockedPacks3, setUnlockedPacks3] = useState<string[]>(Storage.getUnlockedPacks3());

  const [showSettings, setShowSettings] = useState(false);
  const [replayLevelId, setReplayLevelId] = useState<number | null>(null);
  
  const [purchaseCandidate, setPurchaseCandidate] = useState<{id: string, name: string, cost: number, type: 'bg' | 'num' | 'skill' | 'sound', description?: string} | null>(null);
  const [paymentOffer, setPaymentOffer] = useState<DiamondOffer | null>(null);
  
  const [showNotEnoughPoints, setShowNotEnoughPoints] = useState(false);
  
  const [nextBonusClaimTime, setNextBonusClaimTime] = useState(Storage.getNextBonusClaimTime());
  
  // Track actual dark mode state for JS logic
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize Native Storage, Orientation, IAP
  useEffect(() => {
    const initStorage = async () => {
        // Initialize native storage
        await Storage.initializeNative();
        
        // Get updated data
        const data = Storage.getStoredData();
        
        setPoints(data.points);
        setSettings(data.settings);
        setPurchasedBackgrounds(data.purchasedBackgrounds);
        setPurchasedNumberColors(data.purchasedNumberColors);
        setPurchasedSoundPacks(data.purchasedSoundPacks || ['snd-zen']);
        setSelectedSoundPackId(data.selectedSoundPack || 'snd-zen');
        setPurchasedSkills(data.purchasedSkills);
        setEnabledSkills(data.enabledSkills || [...data.purchasedSkills]);
        setStarterPackPurchased(data.starterPackPurchased || false);
        setUnlockedPacks2(data.unlockedPack2 || []);
        setUnlockedPacks3(data.unlockedPack3 || []);
        setNextBonusClaimTime(data.nextBonusClaimTime || 0);
        
        const isDark = data.settings.appearance === 'dark' || (data.settings.appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setIsDarkMode(isDark);
        if (isDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    };
    initStorage();

    // Init IAP
    IAP.initialize();

    // Lock Orientation to Portrait
    const lockOrientation = async () => {
        try {
            // Native Lock (Capacitor)
            await ScreenOrientation.lock({ orientation: 'portrait' });
        } catch (e) {
            console.log("Native lock failed or not supported, trying web API");
            // Web API Fallback
            try {
                if (window.screen && window.screen.orientation && typeof (window.screen.orientation as any).lock === 'function') {
                    await (window.screen.orientation as any).lock('portrait');
                }
            } catch (err) {
                // Ignore errors (e.g. desktop browser doesn't support locking)
            }
        }
    };
    
    lockOrientation();

    // Re-lock on visibility change (sometimes needed on Android resume)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            lockOrientation();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Theme Detection
  useEffect(() => {
      const applyTheme = () => {
          const isDark = settings.appearance === 'dark' || (settings.appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          setIsDarkMode(isDark);
          
          if (isDark) {
              document.documentElement.classList.add('dark');
              document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000');
          } else {
              document.documentElement.classList.remove('dark');
              document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fafaf9');
          }
      };
      applyTheme();
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
          if (settings.appearance === 'system') applyTheme();
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.appearance]);

  useEffect(() => { 
      sounds.setEnabled(settings.sound); 
      sounds.setVibrationEnabled(settings.vibration);
      sounds.setProfile(selectedSoundPackId);
  }, [settings.sound, settings.vibration, selectedSoundPackId]);

  useEffect(() => {
    const timer = setTimeout(() => {
        setDirection(1);
        setScreen('difficulty');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
     setPurchasedBackgrounds(Storage.getPurchasedBackgrounds());
     setSelectedBackgroundId(Storage.getSelectedBackground());
     setPurchasedNumberColors(Storage.getPurchasedNumberColors());
     setSelectedNumberColorId(Storage.getSelectedNumberColor());
     setPurchasedSoundPacks(Storage.getPurchasedSoundPacks());
     setSelectedSoundPackId(Storage.getSelectedSoundPack());
     setPurchasedSkills(Storage.getPurchasedSkills());
     setEnabledSkills(Storage.getEnabledSkills());
     setStarterPackPurchased(Storage.isStarterPackPurchased());
     setPoints(Storage.getPoints());
     setUnlockedPacks2(Storage.getUnlockedPacks2());
     setUnlockedPacks3(Storage.getUnlockedPacks3());
     setNextBonusClaimTime(Storage.getNextBonusClaimTime());
  }, [screen]);

  const navigate = (nextScreen: Screen, dir: 'forward' | 'back' | 'none' = 'forward') => {
      setDirection(dir === 'forward' ? 1 : dir === 'back' ? -1 : 0);
      setScreen(nextScreen);
      setPoints(Storage.getPoints());
  };

  const handleDifficultySelect = (diff: Difficulty) => {
    sounds.playClick();
    setSelectedDifficulty(diff);
    navigate('levels', 'forward');
  };

  const handleLevelBack = () => { sounds.playClick(); navigate('difficulty', 'back'); };
  const handleGameBack = () => { sounds.playClick(); navigate('levels', 'back'); };
  const handleReturnToMenu = () => { sounds.playClick(); navigate('difficulty', 'back'); };
  const handleStoreBack = () => { sounds.playClick(); navigate('difficulty', 'back'); };
  const handleDiamondShopBack = () => { sounds.playClick(); navigate('difficulty', 'back'); };
  const handleStatsBack = () => { sounds.playClick(); navigate('difficulty', 'back'); };

  const handleLevelSelect = (levelId: number) => {
    const progress = Storage.getLevelProgress(selectedDifficulty!, levelId);
    if (progress?.status === 'completed') {
        sounds.playClick();
        setReplayLevelId(levelId);
    } else {
        sounds.playLevelEnter();
        setSelectedLevel(levelId);
        navigate('game', 'forward');
    }
  };

  const confirmReplay = () => {
      sounds.playLevelEnter();
      if (selectedDifficulty && replayLevelId) {
          Storage.clearLevelProgress(selectedDifficulty, replayLevelId);
          setReplayLevelId(null);
          setSelectedLevel(replayLevelId);
          navigate('game', 'forward');
      }
  };

  const toggleSetting = (key: keyof AppSettings) => {
    sounds.playClick();
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    Storage.saveSettings(newSettings);
  };

  const handleToggleDifficultyVisibility = (diff: Difficulty) => {
      sounds.playTap();
      const currentHidden = settings.hiddenDifficulties || [];
      let newHidden: Difficulty[];
      
      if (currentHidden.includes(diff)) {
          newHidden = currentHidden.filter(d => d !== diff);
      } else {
          // Prevent hiding the last visible difficulty
          const allDiffs = Object.values(Difficulty);
          if (allDiffs.length - currentHidden.length <= 1) {
             // Maybe play error sound?
             return; 
          }
          newHidden = [...currentHidden, diff];
      }
      
      const newSettings = { ...settings, hiddenDifficulties: newHidden };
      setSettings(newSettings);
      Storage.saveSettings(newSettings);
  };

  const setAppearance = (val: 'system' | 'light' | 'dark') => {
      const newSettings = { ...settings, appearance: val };
      setSettings(newSettings);
      Storage.saveSettings(newSettings);
  };

  const resetProgress = async () => {
      sounds.playClick();
      if (confirm("Are you sure you want to reset all progress? This will clear data from Local Storage and Cloud Backup.")) {
          await Storage.resetAllData();
          window.location.reload();
      }
  };

  const handleSelectBackground = (id: string) => {
      sounds.playClick();
      Storage.selectBackground(id);
      setSelectedBackgroundId(id);
  };
  
  const handleSelectNumberColor = (id: string) => {
      sounds.playClick();
      Storage.selectNumberColor(id);
      setSelectedNumberColorId(id);
  };

  const handleSelectSoundPack = (id: string) => {
    Storage.selectSoundPack(id);
    setSelectedSoundPackId(id);
  };

  const handleToggleSkill = (id: string) => {
    const next = Storage.toggleSkillEnabled(id);
    setEnabledSkills([...next]);
  };

  const handleEarnPoints = (amount: number) => {
    const newTotal = Storage.addPoints(amount);
    setPoints(newTotal);
  };
  
  const handleClaimBonus = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now < nextBonusClaimTime) return;
    sounds.playWin();
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
    const nextTime = nextDate.getTime();

    Storage.setNextBonusClaimTime(nextTime);
    setNextBonusClaimTime(nextTime);
    handleEarnPoints(10);
  };
  
  const initiatePurchase = (item: any, type: 'bg' | 'num' | 'skill' | 'sound') => {
      if (type !== 'sound') {
          sounds.playPop();
      }
      setPurchaseCandidate({ ...item, type });
  };

  const confirmPurchase = () => {
      if (!purchaseCandidate) return;
      if (points >= purchaseCandidate.cost) {
          if (purchaseCandidate.type === 'bg') {
             if(Storage.purchaseBackground(purchaseCandidate.id, purchaseCandidate.cost)) {
                setPurchasedBackgrounds([...purchasedBackgrounds, purchaseCandidate.id]);
                handleSelectBackground(purchaseCandidate.id);
             }
          } else if (purchaseCandidate.type === 'num') {
             if(Storage.purchaseNumberColor(purchaseCandidate.id, purchaseCandidate.cost)) {
                setPurchasedNumberColors([...purchasedNumberColors, purchaseCandidate.id]);
                handleSelectNumberColor(purchaseCandidate.id);
             }
          } else if (purchaseCandidate.type === 'skill') {
             if(Storage.purchaseSkill(purchaseCandidate.id, purchaseCandidate.cost)) {
                setPurchasedSkills(Storage.getPurchasedSkills());
                setEnabledSkills(Storage.getEnabledSkills());
             }
          } else if (purchaseCandidate.type === 'sound') {
            if(Storage.purchaseSoundPack(purchaseCandidate.id, purchaseCandidate.cost)) {
               setPurchasedSoundPacks([...purchasedSoundPacks, purchaseCandidate.id]);
               handleSelectSoundPack(purchaseCandidate.id);
            }
          }
          setPoints(Storage.getPoints());
          setPurchaseCandidate(null);
      } else {
          setPurchaseCandidate(null);
          setShowNotEnoughPoints(true);
      }
  };

  const handleNavigateToShop = () => {
      setShowNotEnoughPoints(false);
      navigate('diamondShop', 'forward');
  };

  const handleGoPlay = () => {
      setShowNotEnoughPoints(false);
      setPurchaseCandidate(null);
      if (screen === 'store') {
          navigate('difficulty', 'back');
      }
  };

  const handleBuyOffer = (offer: DiamondOffer) => {
      sounds.playClick();
      if (offer.type === 'starter' && starterPackPurchased) return;
      if (offer.priceLabel === '') return;
      setPaymentOffer(offer);
  };

  const finalizeRealMoneyPurchase = () => {
      if (!paymentOffer) return;
      const offer = paymentOffer;
      
      handleEarnPoints(offer.diamonds);
      
      if (offer.type === 'starter') {
          Storage.setStarterPackPurchased();
          setStarterPackPurchased(true);
          Storage.purchaseSkill('skill-auto', 0);
          Storage.purchaseSkill('skill-scan', 0);
          Storage.purchaseSoundPack('snd-piano', 0);
      } else if (offer.type === 'support') {
          Storage.unlockPepino();
      }

      setPurchasedSkills(Storage.getPurchasedSkills());
      setEnabledSkills(Storage.getEnabledSkills());
      setPurchasedNumberColors(Storage.getPurchasedNumberColors());
      setPurchasedBackgrounds(Storage.getPurchasedBackgrounds());
      setPurchasedSoundPacks(Storage.getPurchasedSoundPacks());
      setPaymentOffer(null);
  };

  const handleUnlockPack2 = () => {
      if (!selectedDifficulty) return;
      const cost = getPackCost(selectedDifficulty, 2);
      if (points >= cost) {
          sounds.playPop();
          if (Storage.unlockPack2(selectedDifficulty, cost)) {
              setPoints(Storage.getPoints());
              setUnlockedPacks2(Storage.getUnlockedPacks2());
              sounds.playWin();
          }
      } else {
          sounds.playClick();
          setShowNotEnoughPoints(true);
      }
  };

  const handleUnlockPack3 = () => {
      if (!selectedDifficulty) return;
      const cost = getPackCost(selectedDifficulty, 3);
      if (points >= cost) {
          sounds.playPop();
          if (Storage.unlockPack3(selectedDifficulty, cost)) {
              setPoints(Storage.getPoints());
              setUnlockedPacks3(Storage.getUnlockedPacks3());
              sounds.playWin();
          }
      } else {
          sounds.playClick();
          setShowNotEnoughPoints(true);
      }
  };

  let activeBackgroundClass = "bg-paper dark:bg-black"; 
  
  // Logic: In Dark Mode, override selection to ensure OLED Black background
  // In Light Mode, respect user selection
  if (selectedBackgroundId && !isDarkMode) {
      const bg = ALL_BACKGROUNDS.find(b => b.id === selectedBackgroundId);
      if (bg) {
          activeBackgroundClass = bg.class;
      }
  } else if (isDarkMode) {
      activeBackgroundClass = "bg-black";
  }

  const numberColorClass = NUMBER_COLORS.find(n => n.id === selectedNumberColorId)?.class || 'text-blue-600';
  
  // Calculate overlay opacity in JS for better reliability
  const isGradient = activeBackgroundClass.includes('bg-gradient');
  let overlayOpacityValue = 0;
  const baseOverlayOpacity = isDarkMode ? 0.5 : 0; // Base opacity for dark mode

  if (isGradient) {
      if (screen === 'game') {
          overlayOpacityValue = baseOverlayOpacity * 1.6;
      } else {
          overlayOpacityValue = baseOverlayOpacity;
      }
  } else if (screen === 'game') {
      overlayOpacityValue = baseOverlayOpacity * 0.6;
  }

  const variants: Variants = {
    initial: (dir: number) => ({
      x: dir > 0 ? '100%' : (dir < 0 ? '-100%' : 0),
      opacity: 0
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: { 
          type: "spring", 
          stiffness: 260, 
          damping: 25
      }
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      transition: { 
          type: "spring", 
          stiffness: 260, 
          damping: 25
      }
    })
  };

  return (
      <>
          {/* Main App Wrapper: Fixed, Full Viewport, No Overflow */}
          <div className="fixed inset-0 z-0 w-full h-full overflow-hidden select-none touch-none">
              
              {/* Force Landscape Blocker */}
              <LandscapeBlocker />

              {/* Background Layer (Persistent) */}
              <div 
                className={`absolute inset-0 z-0 transition-all ease-in-out duration-500 ${activeBackgroundClass}`} 
                style={{ width: '100%', height: '100%' }}
              />
              <div 
                className="absolute inset-0 z-[1] bg-black pointer-events-none transition-opacity duration-500" 
                style={{ opacity: overlayOpacityValue }} 
              />

              {/* Diamond Shop Background (Behind Safe Area Wrapper) */}
              {screen === 'diamondShop' && <DiamondBackground />}

              {/* Content Wrapper with Safe Areas */}
              <div 
                 className="relative z-10 w-full h-full flex flex-col pt-safe pb-safe"
              >
                <div className="flex-1 relative w-full h-full overflow-hidden">
                    <AnimatePresence custom={direction} initial={false}>
                        <motion.div
                            key={screen}
                            custom={direction}
                            variants={variants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent"
                            style={{ pointerEvents: 'auto' }}
                        >
                            {screen === 'splash' && <SplashScreen />}

                            {screen === 'difficulty' && (
                                <DifficultyScreen 
                                    points={points}
                                    onDifficultySelect={handleDifficultySelect}
                                    onOpenSettings={() => setShowSettings(true)}
                                    onOpenStore={() => navigate('store', 'forward')}
                                    onOpenDiamondShop={() => navigate('diamondShop', 'forward')}
                                    onClaimBonus={handleClaimBonus}
                                    onOpenStats={() => navigate('stats', 'forward')}
                                    nextBonusClaimTime={nextBonusClaimTime}
                                    hiddenDifficulties={settings.hiddenDifficulties}
                                />
                            )}

                            {screen === 'diamondShop' && (
                                <DiamondShopScreen 
                                    points={points}
                                    onBack={handleDiamondShopBack}
                                    onBuyOffer={handleBuyOffer}
                                    onEarnPoints={handleEarnPoints}
                                    starterPackPurchased={starterPackPurchased}
                                />
                            )}
                            
                            {screen === 'stats' && (
                                <StatsScreen 
                                    onBack={handleStatsBack}
                                    onEarnPoints={handleEarnPoints}
                                    points={points}
                                />
                            )}
                            
                            {screen === 'levels' && selectedDifficulty && (
                                <LevelsScreen 
                                    difficulty={selectedDifficulty}
                                    points={points}
                                    unlockedPacks2={unlockedPacks2}
                                    unlockedPacks3={unlockedPacks3}
                                    onBack={handleLevelBack}
                                    onLevelSelect={handleLevelSelect}
                                    onOpenSettings={() => setShowSettings(true)}
                                    onUnlockPack2={handleUnlockPack2}
                                    onUnlockPack3={handleUnlockPack3}
                                />
                            )}

                            {screen === 'store' && (
                                <StoreScreen 
                                    points={points}
                                    onBack={handleStoreBack}
                                    purchasedSkills={purchasedSkills}
                                    enabledSkills={enabledSkills}
                                    purchasedBackgrounds={purchasedBackgrounds}
                                    purchasedNumberColors={purchasedNumberColors}
                                    purchasedSoundPacks={purchasedSoundPacks}
                                    selectedBackgroundId={selectedBackgroundId}
                                    selectedNumberColorId={selectedNumberColorId}
                                    selectedSoundPackId={selectedSoundPackId}
                                    onPurchase={initiatePurchase}
                                    onSelectBackground={handleSelectBackground}
                                    onSelectNumberColor={handleSelectNumberColor}
                                    onSelectSoundPack={handleSelectSoundPack}
                                    onToggleSkill={handleToggleSkill}
                                />
                            )}
                            
                            {screen === 'game' && selectedDifficulty && selectedLevel && (
                                <SudokuGame
                                    difficulty={selectedDifficulty}
                                    levelId={selectedLevel}
                                    onBack={handleGameBack}
                                    onReturnToMenu={handleReturnToMenu}
                                    onComplete={() => {
                                        setPoints(Storage.getPoints());
                                    }}
                                    onSettingsOpen={() => setShowSettings(true)}
                                    settings={settings}
                                    onEarnPoints={handleEarnPoints}
                                    currentPoints={points}
                                    isSettingsOpen={showSettings}
                                    backgroundClass={activeBackgroundClass}
                                    numberColor={numberColorClass}
                                    purchasedSkills={enabledSkills}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Modals & Overlays */}
                {showSettings && (
                    <SettingsModal 
                        settings={settings} 
                        onToggle={toggleSetting} 
                        onToggleDifficulty={handleToggleDifficultyVisibility}
                        onSetAppearance={setAppearance}
                        onReset={resetProgress}
                        onClose={() => setShowSettings(false)} 
                    />
                )}
                {replayLevelId !== null && selectedDifficulty && (
                    <ReplayModal 
                        levelId={replayLevelId}
                        onConfirm={confirmReplay}
                        onCancel={() => setReplayLevelId(null)}
                    />
                )}
                {purchaseCandidate && (
                    <PurchaseModal 
                        item={purchaseCandidate} 
                        onConfirm={confirmPurchase} 
                        onCancel={() => setPurchaseCandidate(null)} 
                    />
                )}
                {paymentOffer && (
                    <PaymentModal
                        offer={paymentOffer}
                        onComplete={finalizeRealMoneyPurchase}
                        onCancel={() => setPaymentOffer(null)}
                    />
                )}
                {showNotEnoughPoints && (
                    <NotEnoughPointsModal 
                        onClose={() => setShowNotEnoughPoints(false)} 
                        onGetMore={handleNavigateToShop} 
                        onGoPlay={handleGoPlay} 
                    />
                )}
              </div>
          </div>
      </>
  );
}
