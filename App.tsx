
import React, { useState, useEffect, useRef } from 'react';
import { Difficulty, AppSettings, DiamondOffer, PepinoState } from './types';
import { SudokuGame } from './components/SudokuGame';
import { Storage } from './utils/storage';
import { sounds } from './utils/sound';
import { getPackCost, NUMBER_COLORS, ALL_BACKGROUNDS } from './utils/constants';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { IAP } from './utils/iap';
import type { SuccessfulIAPPurchase } from './utils/iap';

// UI Components
import { PurchaseModal, ReplayModal, NotEnoughPointsModal, SettingsModal, PaymentModal, ResetConfirmModal } from './components/ui/Modals';
import { WelcomeGiftModal } from './components/ui/WelcomeGiftModal';
import { getStoredClaimedProfileRank, MAX_PROFILE_RANK, ProfileModal } from './components/ui/ProfileModal';
import { LandscapeBlocker } from './components/ui/LandscapeBlocker';

// Screens
import { SplashScreen } from './components/screens/SplashScreen';
import { DifficultyScreen } from './components/screens/DifficultyScreen';
import { LevelsScreen } from './components/screens/LevelsScreen';
import { StoreScreen } from './components/screens/StoreScreen';
import { DiamondShopScreen } from './components/screens/DiamondShopScreen';
import { StatsScreen } from './components/screens/StatsScreen';

type Screen = 'splash' | 'difficulty' | 'levels' | 'game' | 'settings' | 'store' | 'diamondShop' | 'stats';

const SCREEN_SETTLE_MS = 180;

// Inner Application Component that contains all state and logic
const OkuApp: React.FC<{ onHardReset: () => Promise<void> }> = ({ onHardReset }) => {
  const [screen, setScreen] = useState<Screen>('difficulty');
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null);
  const [direction, setDirection] = useState<number>(0);
  const [difficultyAnimationKey, setDifficultyAnimationKey] = useState(0);
  const [isScreenTransitioning, setIsScreenTransitioning] = useState(false);
  const isNavigatingRef = useRef(false);
  const screenTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const [pepinoState, setPepinoState] = useState<PepinoState>(Storage.getPepinoState());
  const [redeemedCoupons, setRedeemedCoupons] = useState<string[]>([]);

  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [stats, setStats] = useState(Storage.getStoredData().stats || { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 });
  const [claimedProfileRank, setClaimedProfileRank] = useState(() => getStoredClaimedProfileRank(Storage.getStoredData().stats?.totalGamesWon || 0));
  const [replayLevelId, setReplayLevelId] = useState<number | null>(null);
  
  const [purchaseCandidate, setPurchaseCandidate] = useState<{id: string, name: string, cost: number, type: 'bg' | 'num' | 'skill' | 'sound', description?: string} | null>(null);
  const [paymentOffer, setPaymentOffer] = useState<DiamondOffer | null>(null);
  
  const [showNotEnoughPoints, setShowNotEnoughPoints] = useState(false);
  
  // Added Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const [nextBonusClaimTime, setNextBonusClaimTime] = useState(Storage.getNextBonusClaimTime());
  
  // Track actual dark mode state for JS logic
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Welcome Gift Popup State
  const [showWelcomeGift, setShowWelcomeGift] = useState(false);

  // Initialize Native Storage, Orientation, IAP
  useEffect(() => {
    const initStorage = async () => {
        // Initialize native storage
        await Storage.initializeNative();

        // RevenueCat remains the source of truth for permanent purchases.
        await IAP.initialize();
        const ownership = await IAP.getOwnership();
        if (ownership && (ownership.premiumOwned || ownership.starterOwned || ownership.transactionIds.length > 0)) {
            Storage.restorePermanentPurchases(ownership);
        }
        
        // Get updated data
        const data = Storage.getStoredData();
        
        setPoints(data.points);
        setSettings(data.settings);
        setStats(data.stats || { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 });
        setClaimedProfileRank(getStoredClaimedProfileRank(data.stats?.totalGamesWon || 0));
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
        setPepinoState(data.pepino || {
          unlocked: false,
          hasPendingGift: false,
          pendingGiftCount: 0,
          firstGiftClaimed: false,
          firstMessageShown: false
        });
        setRedeemedCoupons(data.redeemedCoupons || []);
        
        const isDark = data.settings.appearance === 'dark' || (data.settings.appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setIsDarkMode(isDark);
        if (isDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        // Check and trigger welcome gift
        if (!Storage.isWelcomeGiftClaimed()) {
            setShowWelcomeGift(true);
        }
    };
    initStorage();

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

  useEffect(() => {
      const earnedRank = Math.min(MAX_PROFILE_RANK, Math.floor(stats.totalGamesWon / 20));
      setClaimedProfileRank(current => Math.min(current, earnedRank));
  }, [stats.totalGamesWon]);

  useEffect(() => {
      try {
          const stored = localStorage.getItem('zen_profile');
          const profile = stored ? JSON.parse(stored) : {};
          if (profile.claimedRank !== claimedProfileRank) {
              localStorage.setItem('zen_profile', JSON.stringify({
                  ...profile,
                  claimedRank: claimedProfileRank,
                  lastSeenRank: claimedProfileRank
              }));
          }
      } catch {
          // A storage failure should never interrupt the game.
      }
  }, [claimedProfileRank]);

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
     setStats(Storage.getStoredData().stats || { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 });
     setUnlockedPacks2(Storage.getUnlockedPacks2());
     setUnlockedPacks3(Storage.getUnlockedPacks3());
     setNextBonusClaimTime(Storage.getNextBonusClaimTime());
     setPepinoState(Storage.getPepinoState());
     // We don't refresh redeemedCoupons here because it's updated via onRedeemCode
  }, [screen]);

  useEffect(() => () => {
      if (screenTransitionTimer.current) clearTimeout(screenTransitionTimer.current);
  }, []);

  const navigate = (nextScreen: Screen, dir: 'forward' | 'back' | 'none' = 'forward') => {
      if (nextScreen === screen || isNavigatingRef.current) return;

      isNavigatingRef.current = true;
      setIsScreenTransitioning(true);
      setDirection(dir === 'forward' ? 1 : dir === 'back' ? -1 : 0);
      setPrevScreen(screen);
      if (nextScreen === 'difficulty') {
          setDifficultyAnimationKey((current) => current + 1);
      }
      setScreen(nextScreen);
      setPoints(Storage.getPoints());

      screenTransitionTimer.current = setTimeout(() => {
          setIsScreenTransitioning(false);
          isNavigatingRef.current = false;
          screenTransitionTimer.current = null;
      }, SCREEN_SETTLE_MS);
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

  const resetProgress = () => {
      sounds.playClick();
      setShowResetConfirm(true);
  };

  const handleFinalReset = async () => {
      await onHardReset();
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
    sounds.playSelectionHaptic();
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

  const refreshCommerceState = () => {
      const data = Storage.getStoredData();
      setPoints(data.points);
      setStats(data.stats || { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 });
      setStarterPackPurchased(Boolean(data.starterPackPurchased));
      setPepinoState(Storage.getPepinoState());
      setPurchasedSkills(data.purchasedSkills);
      setEnabledSkills(data.enabledSkills || [...data.purchasedSkills]);
      setPurchasedNumberColors(data.purchasedNumberColors);
      setPurchasedBackgrounds(data.purchasedBackgrounds);
      setPurchasedSoundPacks(data.purchasedSoundPacks || ['snd-zen']);
  };

  const handleClaimWelcomeGift = (amount: number) => {
      Storage.claimWelcomeGift();
      handleEarnPoints(amount);
      setShowWelcomeGift(false);
  };
  
  const handleClaimBonus = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now < nextBonusClaimTime) return;
    sounds.playGiftClaim();
    
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

  const handleReturnHome = () => {
      setShowNotEnoughPoints(false);
      setPurchaseCandidate(null);
      if (screen !== 'difficulty') {
          navigate('difficulty', 'back');
      }
  };

  const handleBuyOffer = (offer: DiamondOffer) => {
      sounds.playClick();
      if (offer.type === 'starter' && starterPackPurchased) return;
      if (offer.priceLabel === '') return;
      setPaymentOffer(offer);
  };

  const finalizeRealMoneyPurchase = (purchase: SuccessfulIAPPurchase) => {
      if (!paymentOffer) return;
      const offer = paymentOffer;

      if (purchase.productIdentifier !== offer.productId) {
          console.error('IAP: Refusing to fulfill a mismatched product', { offer, purchase });
          setPaymentOffer(null);
          return;
      }

      if (purchase.status === 'restored') {
          const ownsExpectedProduct =
              (offer.type === 'support' && purchase.ownership.premiumOwned) ||
              (offer.type === 'starter' && purchase.ownership.starterOwned);

          if (!ownsExpectedProduct) {
              console.error('IAP: Refusing to restore an unverified permanent product', { offer, purchase });
              setPaymentOffer(null);
              return;
          }

          Storage.restorePermanentPurchases({
              premiumOwned: purchase.ownership.premiumOwned,
              starterOwned: purchase.ownership.starterOwned,
              transactionIds: purchase.transactionIdentifier
                  ? [...purchase.ownership.transactionIds, purchase.transactionIdentifier]
                  : purchase.ownership.transactionIds
          });
      } else {
          Storage.fulfillStorePurchase({
              transactionId: purchase.transactionIdentifier,
              diamonds: offer.diamonds,
              unlock: offer.type === 'support' ? 'premium' : offer.type === 'starter' ? 'starter' : null
          });
      }

      refreshCommerceState();
      setPaymentOffer(null);
  };

  const handleRestorePurchases = async (): Promise<'restored' | 'none' | 'failed'> => {
      const ownership = await IAP.restore();
      if (!ownership) return 'failed';

      const hasPermanentPurchase = ownership.premiumOwned || ownership.starterOwned;
      if (!hasPermanentPurchase) return 'none';

      Storage.restorePermanentPurchases(ownership);
      refreshCommerceState();
      return 'restored';
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

  const handleRedeemCode = (code: string): boolean => {
      const normalizedCode = code.trim();
      
      if (Storage.isCouponRedeemed(normalizedCode)) {
          sounds.playClick();
          return false;
      }

      const lowerCode = normalizedCode.toLowerCase();

      if (lowerCode === 'haha5000') {
          sounds.playWin();
          handleEarnPoints(5000);
          Storage.markCouponRedeemed(normalizedCode);
          setRedeemedCoupons(Storage.getStoredData().redeemedCoupons || []);
          return true;
      }

      if (lowerCode === 'hahapepino') {
          sounds.playWin();
          Storage.unlockPepino();
          setPepinoState(Storage.getPepinoState());
          Storage.markCouponRedeemed(normalizedCode);
          setRedeemedCoupons(Storage.getStoredData().redeemedCoupons || []);
          return true;
      }

      if (lowerCode === 'hahadev') {
          sounds.playWin();
          const newSettings = { ...settings, devAutoSolve: true };
          setSettings(newSettings);
          Storage.saveSettings(newSettings);
          Storage.markCouponRedeemed(normalizedCode);
          setRedeemedCoupons(Storage.getStoredData().redeemedCoupons || []);
          return true;
      }

      if (lowerCode === 'slvse100') {
          sounds.playWin();
          Storage.completeSuperEasyLevels();
          Storage.markCouponRedeemed(normalizedCode);
          const updatedData = Storage.getStoredData();
          setStats(updatedData.stats || { totalGamesWon: 0, totalDiamondsEarned: 0, perfectGames: 0 });
          setRedeemedCoupons(updatedData.redeemedCoupons || []);
          return true;
      }
      
      sounds.playClick();
      return false;
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
    initial: {
      opacity: 1,
      y: 6,
      pointerEvents: 'none' as any
    },
    animate: {
      opacity: 1,
      y: 0,
      pointerEvents: 'auto' as any,
      transition: {
          y: { duration: SCREEN_SETTLE_MS / 1000, ease: [0.16, 1, 0.3, 1] },
          pointerEvents: { duration: 0 }
      }
    },
    exit: {
      opacity: 1,
      y: 0,
      pointerEvents: 'none' as any,
      transition: { duration: 0, pointerEvents: { duration: 0 } }
    }
  };

  return (
      <>
          {/* Main App Wrapper: Fixed, Full Viewport, No Overflow */}
          <div className="fixed inset-0 z-0 w-full h-full overflow-hidden select-none touch-none">
              
              {/* Force Landscape Blocker */}
              <LandscapeBlocker />

              {/* Background layers crossfade instead of replacing the color in one frame. */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={isDarkMode ? 'dark-background' : (selectedBackgroundId || 'default-background')}
                    className={`absolute inset-0 ${isScreenTransitioning ? 'atmosphere-paused' : ''} ${activeBackgroundClass}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'linear' }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </AnimatePresence>
              </div>
              <div 
                className="absolute inset-0 z-[1] bg-black pointer-events-none transition-opacity duration-500" 
                style={{ opacity: overlayOpacityValue }} 
              />

              {/* Content Wrapper */}
              <div 
                 className={`relative z-10 w-full h-full flex flex-col transition-all duration-500 ${showWelcomeGift ? 'blur-sm pointer-events-none' : ''}`}
              >
                <div className="flex-1 relative w-full h-full overflow-hidden">
                    {/* Old screens unmount immediately; the new screen settles in by 6px. */}
                    <>
                        {screen === 'splash' && (
                            <motion.div
                                key="splash"
                                custom={direction}
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent pt-safe pb-safe"
                            >
                                <SplashScreen />
                            </motion.div>
                        )}

                        {screen === 'difficulty' && (
                            <motion.div
                                key={`difficulty-${difficultyAnimationKey}`}
                                custom={direction}
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent pt-safe pb-safe"
                            >
                                <DifficultyScreen 
                                    points={points}
                                    onDifficultySelect={handleDifficultySelect}
                                    onOpenSettings={() => setShowSettings(true)}
                                    onOpenProfile={() => setShowProfile(true)}
                                    onOpenStore={() => navigate('store', 'forward')}
                                    onOpenDiamondShop={() => navigate('diamondShop', 'forward')}
                                    onClaimBonus={handleClaimBonus}
                                    onOpenStats={() => navigate('stats', 'forward')}
                                    cascadeDelayMs={prevScreen !== null ? 50 : 0}
                                    nextBonusClaimTime={nextBonusClaimTime}
                                    hiddenDifficulties={settings.hiddenDifficulties}
                                    hasPendingPepinoGift={pepinoState.hasPendingGift}
                                    hasProfileTitleUpgrade={Math.min(MAX_PROFILE_RANK, Math.floor(stats.totalGamesWon / 20)) > claimedProfileRank}
                                    onContinue={(diff, levelId) => {
                                        sounds.playLevelEnter();
                                        setSelectedDifficulty(diff);
                                        setSelectedLevel(levelId);
                                        navigate('game', 'forward');
                                    }}
                                />
                            </motion.div>
                        )}

                        {screen === 'diamondShop' && (
                            <motion.div
                                key="diamondShop"
                                custom={direction}
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent pt-safe pb-safe"
                            >
                                <DiamondShopScreen 
                                    points={points}
                                    onBack={handleDiamondShopBack}
                                    onBuyOffer={handleBuyOffer}
                                    onEarnPoints={handleEarnPoints}
                                    onRestorePurchases={handleRestorePurchases}
                                    starterPackPurchased={starterPackPurchased}
                                />
                            </motion.div>
                        )}
                        
                        {screen === 'levels' && selectedDifficulty && (
                            <motion.div
                                key="levels"
                                custom={direction}
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent pt-safe pb-safe"
                            >
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
                            </motion.div>
                        )}

                        {screen === 'store' && (
                            <motion.div
                                key="store"
                                custom={direction}
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent pt-safe pb-safe"
                            >
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
                            </motion.div>
                        )}
                        
                        {screen === 'game' && selectedDifficulty && selectedLevel && (
                            <motion.div
                                key="game"
                                custom={direction}
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent pt-safe pb-safe"
                            >
                                <SudokuGame
                                    difficulty={selectedDifficulty}
                                    levelId={selectedLevel}
                                    onBack={handleGameBack}
                                    onReturnToMenu={handleReturnToMenu}
                                    onComplete={() => {
                                        setPoints(Storage.getPoints());
                                        setPepinoState(Storage.getPepinoState());
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
                            </motion.div>
                        )}

                        {screen === 'stats' && (
                            <motion.div
                                key="stats"
                                custom={direction}
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="absolute inset-0 z-20 w-full h-full flex flex-col items-center justify-center font-sans text-t-primary overflow-hidden bg-transparent pt-safe pb-safe"
                            >
                                <StatsScreen
                                    onBack={handleStatsBack}
                                    onEarnPoints={handleEarnPoints}
                                    points={points}
                                />
                            </motion.div>
                        )}
                    </>
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
                        onRedeemCode={handleRedeemCode}
                        redeemedCoupons={redeemedCoupons}
                    />
                )}
                {showProfile && (
                        <ProfileModal
                            onClose={() => setShowProfile(false)}
                            claimedRank={claimedProfileRank}
                            onTitleClaimed={setClaimedProfileRank}
                            stats={stats}
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
                        onShop={handleNavigateToShop}
                        onHome={handleReturnHome}
                    />
                )}
                {showResetConfirm && (
                    <ResetConfirmModal 
                        onConfirm={handleFinalReset}
                        onCancel={() => setShowResetConfirm(false)}
                    />
                )}
              </div>

              {showWelcomeGift && (
                  <WelcomeGiftModal 
                      onClose={handleClaimWelcomeGift}
                  />
              )}
          </div>
      </>
  );
}

// Wrapper to handle Key-based App Reset
export function App() {
    const [uniqueKey, setUniqueKey] = useState(0);

    const handleReset = async () => {
        await Storage.resetAllData();
        // Force remount of the entire app to re-initialize state from wiped storage
        setUniqueKey(prev => prev + 1);
    };

    return <OkuApp key={uniqueKey} onHardReset={handleReset} />;
}
