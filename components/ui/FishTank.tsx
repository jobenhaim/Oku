
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Storage } from '../../utils/storage';
import { sounds } from '../../utils/sound';
import { Icons } from './Icons';
import { PepinoState } from '../../types';

// 300+ Unique Pepino Messages
const PEPINO_MESSAGES = [
    "Splash.", "Hello.", "Nice phone.", "Screen is clean.", "Fish approves.",
    "Hi there!", "Clean water.", "Just swimming.", "Snack?", "Watching you.",
    "You are smart.", "Take a break?", "Stay hydrated.", "I live here.", "Cozy tank.",
    "Did you blink?", "Sudoku master?", "I am a fish.", "Simulation.", "Dry water.",
    "Pixels taste funny.", "Goldfish? Nope.", "Welcome back!", "Nice to see you.",
    "Stay a while.", "Peaceful here.", "Oops.", "Winning?", "Shiny diamonds.",
    "I like blue.", "I'm your fan!", "Bubbles...", "Good morning?", "Good evening?",
    "Rate 5 stars?", "I'm shy.", "Catch me.", "Tiny brain.", "E = mc²",
    "The universe.", "Brain bubbles.", "Just floating...", "I see you.", "Nice case.",
    "No case? Brave.", "Battery fine.", "Fancy device.", "Fish alert!", "Zero thumbs.",
    "Full-time fish.", "Bubble expert.", "Wet forever.", "Fish.", "No gift yet.",
    ":)", "Uninstall ocean.", "Blame the crab.", "Bloop.", "Overthinking...",
    "Memory optional.", "Proud of you.", "Thanks for waiting.", "Boo!", "Rock moved.",
    "Hehe.", "Wi-Fish.", "Panicked.", "Aquarium CEO.", "Dramatic fish.", 
    "Snacks please.", "Bloop wisdom.", "Ate a 7.", "How are you?", "Bubble trouble.", 
    "Fin itches.", "Swimmingly.", "Water thinking?", "Organic pixels.", "Tap gently.", 
    "We are champions.", "Hold my poodle!", "Wet.", "Fluent in Bubbles.", "Glub.", 
    "Thinking cap.", "Hint button?", "Just a fish.", "Nice moves.", "Castle please?", 
    "Precise water.", "Finish line.", "Meow.", "Woof.", "Moo.", 
    "Bilingual.", "Hola.", "Bonjour.", "Tasty pixels.", "Binary bubbles.", 
    "010101.", "Glub glub.", "Splash zone.", "No fishing.", "I am real.", 
    "Philosophy.", "Deep thoughts.", "Shallow water.", "Nice hair.", "Blink twice.", 
    "Dizzy.", "Round and round.", "Left is right.", "Up is down.", "Gravity check.", 
    "Float on.", "Zen mode.", "Ommmmm.", "Peace.", "Quiet please.", 
    "Loud noises.", "Sneeze.", "Bless you.", "Good vibes.", "Bad math.", 
    "1 + 1 = 3.", "Fish math.", "Bubble math.", "Counting scales.", "One two fish.", 
    "Red fish.", "Blue fish.", "Colorful.", "Glowing?", "Bioluminescence.", 
    "Shiny object.", "Look there.", "Made you look.", "Ninja fish.", "Stealth mode.", 
    "Camouflage.", "Invisible.", "See me?", "Peekaboo.", "Hide seek.", 
    "Found me.", "Tag you're it.", "Race you.", "I win.", "Speedy.", 
    "Turbo fin.", "Nitro bubbles.", "Vroom vroom.", "Beep beep.", "Traffic jam.", 
    "School of fish.", "Skipped school.", "Homework ate me.", "Too much logic.", "Brain hurts.", 
    "Big heart.", "Love you.", "Platonic only.", "Just friends.", "Fish hug.", 
    "Wet hug.", "Slippery.", "Soap?", "Bubble bath.", "Rubber ducky.", 
    "Quack.", "I'm a duck.", "Identity crisis.", "Who am I?", "What is life?", 
    "42.", "Don't panic.", "Towel?", "Dry land.", "Miss legs.", 
    "Evolution.", "Walking soon.", "Maybe tomorrow.", "Procrastinating.", "Later.", 
    "Nap time.", "Zzzzz.", "Sleep swimming.", "Dreaming worms.", "Yum worms.", 
    "Flakes again?", "Pizza please.", "Tacos?", "Sushi bad.", "Friends not food.", 
    "Veggie fish.", "Algae smoothie.", "Green diet.", "Healthy fish.", "Gym time.", 
    "Fin ups.", "Tail press.", "Strong fish.", "Muscle beach.", "Flexing.", 
    "Do you lift?", "Heavy water.", "Light water.", "Sparkling.", "Fizz.", 
    "Pop.", "Snap.", "Crackle.", "Cereal?", "Breakfast.", 
    "Lunch.", "Dinner.", "Snack time.", "Hungry.", "Feed me.", 
    "Tap to feed.", "Just kidding.", "Virtual food.", "Bytes.", "Megabytes.", 
    "Gigabytes.", "Terabytes.", "Data stream.", "Streaming.", "Influencer.", 
    "Subscribe.", "Follow me.", "Trending.", "Viral bubble.", "Hashtag fish.", 
    "Selfie?", "No camera.", "Say cheese.", "Smile.", "Frown.", 
    "Grumpy.", "Happy.", "Silly.", "Crazy.", "Loco.", 
    "Go fish.", "Card game.", "Ace.", "Royal flush.", "Poker face.", 
    "Bluffing.", "All in.", "Fold.", "Checkmate.", "Wrong game.", 
    "Sudoku rules.", "Grid life.", "Boxed in.", "Row 1.", "Column 9.", 
    "Center box.", "Corner piece.", "Missing number.", "Is it 5?", "Try 7.", 
    "Maybe 3.", "Definite 9.", "Guessing.", "Logic wins.", "Smarty pants.", 
    "Genius.", "Brainiac.", "Nerd.", "Geek.", "Cool kid.", 
    "Hipster.", "Vintage.", "Retro.", "Old school.", "New wave.", 
    "Current.", "Shocking.", "Electric eel.", "Not me.", "Cousin eel.", 
    "Uncle crab.", "Aunt whale.", "Big family.", "Reunion.", "Ocean party.", 
    "DJ Fish.", "Drop bass.", "Bass fish.", "Music lover.", "Humming.", 
    "La la la.", "Singing.", "Opera.", "High note.", "Glass breaks.", 
    "My bad.", "Fix it.", "Glitch.", "Bug?", "Feature.", 
    "It works.", "Ship it.", "Dev mode.", "Console log.", "Print hello.", 
    "Hello world.", "System ready.", "Access granted.", "Hacking...", "Mainframe.", 
    "Cyber fish.", "Neon lights.", "Glow up.", "Shine bright.", "Star fish.", 
    "Moon fish.", "Sun fish.", "Planet earth.", "Alien.", "Take me home.", 
    "UFO.", "Unidentified.", "Flying saucer.", "Swimming saucer.", "Tea cup.", 
    "Tea time.", "Earl Grey.", "Hot.", "Cold.", "Lukewarm.", 
    "Perfect temp.", "Cozy.", "Blanket?", "Pillow?", "Bed time.", 
    "Wake up.", "Alarm clock.", "Snooze.", "Five mins.", "Morning.", 
    "Night.", "Noon.", "Time flies.", "Time swims.", "Clock ticking.", 
    "Tick tock.", "Hurry up.", "Slow down.", "Speed limit.", "Police fish.", 
    "Siren.", "Wee woo.", "Pull over.", "License?", "Registration?", 
    "Officer.", "Detained?", "Free fish.", "Liberty.", "Justice.", 
    "Law.", "Order.", "Dismissed.", "Objection.", "Sustained.", 
    "Overruled.", "Briefcase.", "Suit tie.", "Formal.", "Tuxedo.", 
    "Penguin?", "Wrong bird.", "I can fly.", "Flying fish.", "Sky high.", 
    "Clouds.", "Rain.", "More water.", "Flood.", "Boat ride.", 
    "Seasick.", "Land ho.", "Island.", "Treasure.", "X marks spot.", 
    "Gold coins.", "Pirate.", "Arrgh.", "Matey.", "Captain.", 
    "Hook.", "Peg leg.", "Eye patch.", "Silence.", "Golden.", 
    "Silver.", "Bronze.", "Medal.", "Champion.", "Winner.", 
    "Loser.", "Try again.", "Game over.", "Continue?", "Insert coin.", 
    "Press start.", "Player 1.", "Ready.", "Fight.", "Round 1.", 
    "Knockout.", "Victory.", "Defeat.", "Draw.", "Tie game.", 
    "Sudden death.", "Extra time.", "Penalty.", "Goal.", "Score.", 
    "Net.", "Ball.", "Sports.", "Team.", "Coach.", 
    "Whistle.", "Referee.", "Foul.", "Red card.", "Ejected.", 
    "Bench.", "Water boy.", "Hydrate.", "H2O.", "Molecule.", 
    "Atom.", "Science.", "Chemistry.", "Biology.", "Physics.", 
    "Math.", "History.", "Geography.", "Map.", "Compass.", 
    "North.", "South.", "East.", "West.", "Lost.", 
    "Found.", "Path.", "Road.", "Street.", "Avenue.", 
    "Lane.", "Drive.", "Way.", "Route.", "GPS.", 
    "Recalculating.", "Turn left.", "Turn right.", "Straight on.", "Destination.", 
    "Arrived.", "Home.", "Sweet home.", "Tank sweet tank.", "I am a cat.", 
    "Baah.", "Gravity is a suggestion.", "The glass is solid.", "Is this real?", "Philosophish.", 
    "To be or not.", "I think therefore swim.", "Where is the ocean?", "Tiny pool.", "Big dreams.", 
    "Giant squid?", "No sharks here.", "Safe space.", "Cozy corner.", "Bubbles tickle.", 
    "My fins are tired.", "Leg day.", "I have no legs.", "Sad fish.", "Happy fish.", 
    "Angry fish.", "Grumpy gills.", "Smiley face.", "Fish face.", "Duck face.", 
    "Selfie time.", "No filter.", "Natural glow.", "Bioluminescent.", "I glow in dark.", 
    "Turn off lights.", "Too bright.", "Sunnies on.", "Cool dude.", "Ice cold.", 
    "Frozen fish.", "Thawing out.", "Warm water.", "Jacuzzi.", "Spa day.", 
    "Cucumber slices.", "Relaxing.", "Stress free.", "Zen garden.", "Raking sand.", 
    "Sand castle.", "King of tank.", "Queen of tank.", "Jester.", "Funny joke.", 
    "Knock knock.", "Who is there?", "Water you doing?", "Sea what I did?", "Shell we dance?", 
    "Whale hello there.", "Krilling it.", "Good luck today!", "Tuna in later.", "Salmon says.", 
    "Carppe diem.", "Holy mackerel.", "Oh my cod.", "For shore.", "Beach vibes.", 
    "Surfs up.", "Cowabunga.", "Radical.", "Tubular.", "Totally.", 
    "Awesome.", "Sweet.", "Dude.", "Bro.", "Mate.", 
    "Pal.", "Buddy.", "Chum.", "Friend.", "Bestie.", 
    "BFF.", "Pen pal.", "Tap me.", "No hands.", ":)", 
    "Wow!", "Squid ink.", "Messy.", "Clean up.", "Janitor fish.", 
    "Algae eater.", "Lil Fish.", "Green smoothie.", "Diet starts Monday.", "Cheat day.", 
    "Pizza?", "Burger?", "Fries?", "Chips?", "Fish and chips?", 
    ":D", "Oh?", "Oh!", "Dreams come true.", "Swim away.", 
    "Fast swim.", "Slow swim.", "Floating.", "Drifting.", "Current events.", 
    "News anchor.", "Weather report.", "It is wet.", "100% chance of water.", "Rain dance.", 
    "Umbrella?", "Underwater rain.", "Impossible.", "Science.", "Magic.", 
    "Wizard fish.", "You shall not pass.", "Abracadabra.", "Poof.", "Waka waka, eh eh.", 
    "Invisible.", "Can you see me?", "Ghost fish.", "Spooky.", "La Macarena.", 
    "Taco Tuesday.", "Pepino.", "Pepino means cucumber.", "Life is good.", "In this economy?!", 
    "Roar.", "Tiny roar.", "Squeak.", "Mouse?", "Cheese?", 
    "Dobby... :(", "Expecto Patronum!", "Communication is key.", "Write a poem.", "I need a towel.", 
    "Glory!.", "Sounds fishy.", "Any-fin is possible.", "It's o-fish-ial!", "Nice plants!", 
    "Local.", "Drop the bass.", "Eco friendly.", "Recycle.", "Plastic bad.", 
    "Save the ocean.", "Hero.", "Super fish.", "Catch you later!", "Batman!", 
    "Potato in pajamas.", "Angry tiny muffin.", "Error: Brain full.", "Floor is lava!", "Just Pepino.", 
    "Oh yeah!", "Tiny Pepino.", "CEO of Bad Ideas.", "Absolute chaos.", "Legendary.", 
    "Epic.", "Danger noodle.", "Wet bread.", "Wet rocks", "Wet plants.", 
    "Burrito nap.", "Jackpot.", "Winner.", "Chicken dinner.", "Winner winner.", 
    "Level up.", "Space cat.", "Flamingo stance.", "Number one.", "Gold medal.", 
    "Elbow sneeze.", "...!", "Take a picture.", "Stand tall.", "Stand proud.", 
    "Good job.", "Well done.", "Nice work.", "Keep going.", "Don't stop.", 
    "Add me on Instagram.", "I saw a snail.", "Expeliarmus!"
];

interface FishTankProps {
    onRewardClaim: (amount: number) => void;
    showIntro?: boolean;
}

export const FishTank: React.FC<FishTankProps> = ({ onRewardClaim, showIntro = false }) => {
    const [pepinoState, setPepinoState] = useState<PepinoState>(Storage.getPepinoState());
    
    // Initialize ready state based on hasPendingGift
    const [isGiftReady, setIsGiftReady] = useState(pepinoState.hasPendingGift);
    
    // Reward Feedback State
    const [rewardFeedback, setRewardFeedback] = useState<{amount: number} | null>(null);
    const [rewardExiting, setRewardExiting] = useState(false);
    const [clickCoords, setClickCoords] = useState<{x: number, y: number} | null>(null);
    
    // Hearts Interaction State
    const [hearts, setHearts] = useState<{id: number, x: number, y: number, tx: number, rot: number}[]>([]);

    // Speech Bubble State
    const [speech, setSpeech] = useState<string | null>(null);

    // Intro State: 
    // 'waiting' (text visible, user must tap) -> 'clearing' (text fades out) -> 
    // 'appearing' (fish pops in) -> 'active' (normal swim)
    const [introState, setIntroState] = useState<'waiting' | 'clearing' | 'appearing' | 'active'>(
        showIntro ? 'waiting' : 'active'
    );
    
    // Fish movement state
    const [fishPos, setFishPos] = useState(() => ({ 
        x: 15 + Math.random() * 70, 
        y: 32 + Math.random() * 53 
    }));
    const [fishDirection, setFishDirection] = useState<'left' | 'right'>('right');
    
    // Container dimensions for smooth pixel-perfect transforms
    const [tankSize, setTankSize] = useState({ width: 0, height: 0 });
    
    // Transition Ready State (Prevents jump from 0,0)
    const [isTransitionEnabled, setIsTransitionEnabled] = useState(false);
    
    // Refs for animation logic to avoid stale closures
    const fishPosRef = useRef(fishPos);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track container size for pixel-perfect transforms
    useEffect(() => {
        if (!containerRef.current) return;
        
        const updateSize = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setTankSize({ width, height });
            }
        };

        // Initial size
        updateSize();

        const observer = new ResizeObserver(() => {
            updateSize();
        });
        
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Enable transitions only AFTER we have a valid size and position calculated
    useEffect(() => {
        if (tankSize.width > 0 && !isTransitionEnabled) {
            const t = setTimeout(() => {
                setIsTransitionEnabled(true);
            }, 150);
            return () => clearTimeout(t);
        }
    }, [tankSize.width, isTransitionEnabled]);

    // Handle Intro Flow Init (Skip if not showing intro)
    useEffect(() => {
        if (!showIntro) {
            setIntroState('active');
        }
    }, [showIntro]);

    const handleIntroTap = () => {
        if (introState !== 'waiting') return;
        
        sounds.playClick(); 
        setIntroState('clearing');
        
        setTimeout(() => {
            setIntroState('appearing'); 
            sounds.playPop(); 

            setTimeout(() => {
                setIntroState('active');
            }, 400); 
        }, 600); 
    };

    // Derived state for visibility
    const isTextVisible = introState === 'waiting';
    const isFishVisible = (introState === 'appearing' || introState === 'active') && tankSize.width > 0;

    // SPEECH BUBBLE LOGIC
    useEffect(() => {
        // Stop speech if fish isn't active or gift is ready
        if (!isFishVisible || introState !== 'active' || isGiftReady) {
            setSpeech(null); 
            return;
        }

        let timeoutId: any;

        const runCycle = () => {
            if (isGiftReady) return;

            // 1. Pick random message
            const msg = PEPINO_MESSAGES[Math.floor(Math.random() * PEPINO_MESSAGES.length)];
            setSpeech(msg);
            
            // 2. Hide after 10 seconds
            timeoutId = setTimeout(() => {
                setSpeech(null);
                // 3. Wait 5 seconds cooldown before next message
                timeoutId = setTimeout(runCycle, 5000);
            }, 10000);
        };

        // Initial speech after 1 second of being active to give space for Gift appearance
        timeoutId = setTimeout(runCycle, 1000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [isFishVisible, introState, isGiftReady]);

    // Random Swimming Logic
    useEffect(() => {
        if (introState !== 'active') return;

        let timeoutId: any;
        
        const moveFish = () => {
            const currentX = fishPosRef.current.x;
            
            // Generate new target position
            // X: 15-85% (avoid walls)
            const newX = 15 + Math.random() * 70;
            
            // Y: Limit to lower part (avoid top 50px)
            // Tank Height = 224px (h-56)
            const newY = 32 + Math.random() * 53; 
            
            // Determine direction based on CURRENT position vs NEW position
            const newDirection = newX > currentX ? 'right' : 'left';
            
            setFishDirection(newDirection);
            setFishPos({ x: newX, y: newY });
            
            // Update ref
            fishPosRef.current = { x: newX, y: newY };

            const delay = 4000 + Math.random() * 4000; // Slow, calm movement
            timeoutId = setTimeout(moveFish, delay);
        };

        // Initial delay: Start quickly after active
        const startDelay = 1000;
        timeoutId = setTimeout(moveFish, startDelay);

        return () => clearTimeout(timeoutId);
    }, [introState]); 

    const handleClaim = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isGiftReady || rewardFeedback) return;

        // Capture coordinates relative to tank
        if (containerRef.current) {
             const rect = containerRef.current.getBoundingClientRect();
             setClickCoords({
                 x: e.clientX - rect.left,
                 y: e.clientY - rect.top
             });
        }
        
        Storage.claimPepinoGift();
        const updatedPepinoState = Storage.getPepinoState();
        setPepinoState(updatedPepinoState);
        setIsGiftReady(false);

        const r = Math.random();
        let amount = 5;

        // Reward Distribution:
        // 20 Diamonds: 5%
        // 15 Diamonds: 15%
        // 10 Diamonds: 30%
        // 5 Diamonds: 50%
        
        if (r < 0.05) amount = 20;
        else if (r < 0.20) amount = 15;
        else if (r < 0.50) amount = 10;
        else amount = 5;

        if (amount > 0) {
            // New short, punchy gift claim sound
            sounds.playGiftClaim();
            onRewardClaim(amount);
            showReward({ amount }, () => {
                setIsGiftReady(updatedPepinoState.hasPendingGift);
            });
        }
    };

    const handlePepinoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        sounds.playPepinoTap(); // Play cute tap sound
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Random horizontal movement (-60px to +60px)
            const tx = (Math.random() - 0.5) * 120;
            // Random rotation (-30deg to +30deg)
            const rot = (Math.random() - 0.5) * 60;

            const newHeart = { id: Date.now() + Math.random(), x, y, tx, rot };
            setHearts(prev => [...prev, newHeart]);
            
            setTimeout(() => {
                setHearts(prev => prev.filter(h => h.id !== newHeart.id));
            }, 800);
        }
    };

    const showReward = (feedback: {amount: number}, onComplete?: () => void) => {
        setRewardFeedback(feedback);
        setRewardExiting(false);
        
        // Show for 2 seconds total
        setTimeout(() => {
            setRewardExiting(true);
            setTimeout(() => {
                setRewardFeedback(null);
                setRewardExiting(false);
                setClickCoords(null);
                onComplete?.();
            }, 300); 
        }, 1700);
    };

    
    // Scale Logic: 0 during wait/clear, 1 during appear/active
    const scaleValue = (introState === 'waiting' || introState === 'clearing') ? 0 : 1;
    
    // Transition Duration Logic
    const transitionDuration = introState === 'active' ? '4000ms' : '300ms';

    // Calculate Exact Pixel Coordinates for Transform
    // Fish is w-12 (48px) x h-8 (32px). Center offset is 24px, 16px.
    const fishX = (fishPos.x / 100) * tankSize.width - 24;
    const fishY = (fishPos.y / 100) * tankSize.height - 16;

    return (
        <div 
            ref={containerRef}
            // Size: w-24 h-16 (~20-25% smaller than original w-32 h-24)
            className="w-full h-56 relative rounded-[1.75rem] overflow-hidden bg-[#e0f7fa] dark:bg-[#173b52] shadow-xl mb-6 select-none animate-pop mx-auto"
        >
            <style>{`
                @keyframes heart-float {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(calc(-50% + var(--tx)), calc(-50% - 75px)) scale(1.1) rotate(var(--rot)); opacity: 0; }
                }
            `}</style>

            {/* Clean Water Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#e0f7fa] via-[#d1f4fa] to-[#b3e5fc] dark:from-[#173b52] dark:via-[#1f4d63] dark:to-[#2b6879]" />

            {/* --- LAYER 1: BACKGROUND PLANTS (Behind Fish) --- */}
            {/* Z-Index 5: Behind Fish (30) */}
            <div className="absolute inset-x-0 bottom-0 h-full z-[5] pointer-events-none">
                {/* Background Plants Cluster */}
                {/* Added translate3d(0,0,0) to force layer promotion and fix vibration on iOS */}
                <div 
                    className="absolute bottom-4 left-[10%] w-24 h-[60%] opacity-80 mix-blend-multiply origin-bottom"
                    style={{ transform: 'translate3d(0,0,0)' }}
                >
                     <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="plantGradientBg" x1="0.5" x2="0.5" y1="0" y2="1">
                                <stop offset="0%" stopColor="#4ade80" /> {/* green-400 */}
                                <stop offset="100%" stopColor="#14532d" /> {/* green-900 */}
                            </linearGradient>
                        </defs>
                        
                        {/* Leaf 2 (Left - Thicker Base) */}
                        <g 
                            className="origin-bottom animate-sway" 
                            style={{ transformOrigin: '30% 100%', animationDelay: '-1.5s', willChange: 'transform' }}
                        >
                           <path d="M 24 100 C 24 70 30 40 25 15 L 27 15 C 33 30 40 60 36 100 Z" fill="url(#plantGradientBg)" opacity="0.8" />
                        </g>

                        {/* Leaf 3 (Right - Thicker Base) */}
                        <g 
                            className="origin-bottom animate-sway-slow" 
                            style={{ transformOrigin: '70% 100%', animationDelay: '-3s', willChange: 'transform' }}
                        >
                           <path d="M 69 100 C 69 70 75 40 78 15 L 80 15 C 85 40 81 70 81 100 Z" fill="url(#plantGradientBg)" opacity="0.9" />
                        </g>
                     </svg>
                </div>
            </div>

            {/* --- INTRO TEXT OVERLAY --- */}
            <div 
                onClick={handleIntroTap}
                className={`absolute inset-0 flex items-center justify-center p-4 z-40 transition-opacity duration-700 cursor-pointer ${isTextVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="bg-white/90 p-6 rounded-2xl shadow-sm border border-white/40 text-center max-w-[90%]">
                    <p className="text-xl font-bold text-stone-800 mb-3 leading-tight">Meet Pepino.</p>
                    <p className="pepino-copy text-[11px] font-medium mb-1 leading-relaxed">He was around when Oku was being built.</p>
                    <p className="pepino-copy text-[11px] font-medium leading-relaxed mb-4">Feel free to check on him after every game.</p>
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-widest animate-pulse">Tap to continue</p>
                </div>
            </div>

            {/* PEPINO CONTAINER (Handles Position via Transform) */}
            {/* Z-Index 30: In front of Back Plants (5), Behind Front Plant (35) */}
            <div 
                onClick={handlePepinoClick}
                className={`absolute w-12 h-8 z-30 cursor-pointer top-0 left-0 ${isFishVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                    // CRITICAL FIX: Use translate3d with pixels for smooth iOS movement
                    // Removed 'opacity' from transition to prevent fade-in effect on subsequent moves
                    transform: `translate3d(${fishX}px, ${fishY}px, 0)`,
                    transition: isTransitionEnabled ? `transform ${transitionDuration} ease-in-out` : 'none',
                    willChange: 'transform',
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                }}
            >
                 {/* POP IN ANIMATION WRAPPER (Handles Scale) */}
                 <div 
                    className="w-full h-full transition-transform duration-300 cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    style={{ transform: `scale(${scaleValue})` }}
                 >
                     
                     {/* DIRECTION FLIPPER */}
                     <div 
                        className="w-full h-full transition-transform duration-500"
                        style={{ transform: fishDirection === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}
                     >
                         {/* WIGGLER */}
                         <div className="w-full h-full animate-wiggle" style={{ willChange: 'transform' }}>
                            {/* Pepino SVG */}
                            <svg viewBox="344.5149 210.9059 74.9591 41.2278" className="w-full h-full drop-shadow-sm filter" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>
                                <path d="M 373.193 239.648 C 379.513 254.112 400.131 252.185 404.661 240.061 C 393.45 240.02 396.193 239.089 386.193 239.648 L 373.193 239.648 Z" fill="#ef4444" opacity="0.95" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 372.793 224.525 C 379.113 207.278 399.731 209.576 404.261 224.033 C 393.05 224.081 395.793 225.192 385.793 224.525 L 372.793 224.525 Z" fill="#ef4444" opacity="0.95" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 394.515 231.681 C 379.515 206.681 344.428 201.406 344.515 231.681 C 344.565 261.131 379.515 256.681 394.515 231.681 Z" fill="#ef4444" opacity="0.95" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 394.515 231.681 C 374.515 216.681 359.515 211.681 354.515 231.681 C 359.515 251.681 374.515 246.681 394.515 231.681 Z" fill="#b91c1c" opacity="0.15" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <ellipse cx="391.474" cy="231.681" rx="28" ry="11" fill="#dc2626" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <path d="M 401.174 234.169 C 395.84 239.502 397.84 240.836 407.174 238.169 L 401.174 234.169 Z" fill="#fca5a5" opacity="0.8" style={{strokeWidth: 1, transformOrigin: '402.719px 236.836px'}} transform="matrix(0.71619296, -0.69790214, 0.69790214, 0.71619296, 0.00000291, 0.0000368)"/>
                                <circle cx="411.874" cy="230.381" r="2.5" fill="black" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                                <circle cx="412.874" cy="229.381" r="0.8" fill="white" opacity="0.9" style={{strokeWidth: 1}} transform="matrix(1, 0, 0, 1, 0, -1.4210854715202004e-14)"/>
                            </svg>
                         </div>
                     </div>
                 </div>

                 {/* SPEECH BUBBLE */}
                 {/* Positioned relative to Fish Container (Upright) */}
                 <AnimatePresence>
                    {speech && !isGiftReady && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0, y: 10, x: "-50%" }} 
                            animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, scale: 0, y: 5, x: "-50%" }}
                            transition={{ duration: 0.2 }}
                            className="absolute -top-10 left-1/2 whitespace-nowrap z-50 origin-bottom"
                        >
                            <div className="pepino-copy bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-md border border-stone-100 text-[10px] font-bold relative">
                                {speech}
                                {/* Tiny triangle */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-[5px] border-transparent border-t-white/95"></div>
                            </div>
                        </motion.div>
                    )}
                 </AnimatePresence>

                 {/* GIFT BUBBLE (Trigger) - Only visible when fish is visible */}
                 {isGiftReady && isFishVisible && !isTextVisible && (
                        <div 
                            // Moved down (-top-7 vs -top-10) and right (ml-4)
                            className="absolute -top-7 left-1/2 -translate-x-1/2 ml-4 z-20"
                            // No scaling/transform logic here, just centering relative to upright container
                            style={{ backfaceVisibility: 'hidden' }}
                        >
                             <div className="animate-scale-in origin-bottom">
                                <div 
                                    onClick={handleClaim}
                                    className="cursor-pointer hover:scale-110 transition-transform duration-200"
                                >
                                    <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-blue-100/50">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="8" width="18" height="4" rx="1" />
                                            <path d="M12 8v13" />
                                            <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                                            <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
                                        </svg>
                                    </div>
                                </div>
                             </div>
                        </div>
                 )}
            </div>

            {/* --- LAYER 2: FOREGROUND PLANT (In Front of Fish) --- */}
            {/* Z-Index 35: In front of Fish (30), Behind Scenery (40) */}
            <div className="absolute inset-x-0 bottom-0 h-full z-[35] pointer-events-none">
                {/* Added translate3d(0,0,0) to force layer promotion and fix vibration on iOS */}
                <div 
                    className="absolute bottom-4 left-[10%] w-24 h-[60%] opacity-80 mix-blend-multiply origin-bottom"
                    style={{ transform: 'translate3d(0,0,0)' }}
                >
                     <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="plantGradientFg" x1="0.5" x2="0.5" y1="0" y2="1">
                                <stop offset="0%" stopColor="#4ade80" /> {/* green-400 */}
                                <stop offset="100%" stopColor="#14532d" /> {/* green-900 */}
                            </linearGradient>
                        </defs>
                        
                        {/* Leaf 1 (Main Tall - Thicker Base) */}
                        <g 
                            className="origin-bottom animate-sway-slow" 
                            style={{ transformOrigin: '50% 100%', willChange: 'transform' }}
                        >
                           <path d="M 42 100 C 42 60 50 30 48 5 L 50 5 C 50 30 58 60 58 100 Z" fill="url(#plantGradientFg)" />
                        </g>
                     </svg>
                </div>
            </div>
            
            {/* --- SCENERY LAYER (Sand & Rocks) --- */}
            {/* Z-Index 40: Frontmost Layer (Covers plant bases & fish if low) */}
            <div className="absolute inset-x-0 bottom-0 h-20 z-40 pointer-events-none">
                
                {/* Background Rock (New Tall Rock) - Lighter color for depth, positioned behind */}
                {/* Adjusted right position from 4% to 8% to move it slightly left */}
                <div className="absolute bottom-1 right-[8%] w-16 h-14 bg-gradient-to-t from-[#a8a29e] to-[#d6d3d1] rounded-[30%_70%_70%_30%_/_30%_50%_50%_70%] rotate-[-8deg] z-0" />

                {/* Left Rock */}
                <div className="absolute bottom-2 left-[12%] w-12 h-8 bg-gradient-to-tr from-[#7d7873] to-[#a8a29e] rounded-[45%_55%_50%_50%_/_50%_50%_40%_40%] rotate-2 shadow-sm z-10" />
                
                {/* Right Small Rock (Foreground) */}
                <div className="absolute bottom-1 right-[18%] w-9 h-7 bg-gradient-to-tl from-[#8a8580] to-[#b5b0ab] rounded-[50%_50%_40%_60%] -rotate-3 shadow-sm z-10" />
                
                {/* Center Pebble */}
                <div className="absolute bottom-3 left-[45%] w-5 h-4 bg-gradient-to-t from-[#96918c] to-[#c2bdb8] rounded-full z-10" />

                {/* Sand Layer */}
                <svg className="absolute bottom-0 w-full h-full z-[20]" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="sandGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#f7eed9" /> {/* Very Light Sand */}
                            <stop offset="100%" stopColor="#ebe0c5" /> {/* Slightly Darker */}
                        </linearGradient>
                    </defs>
                    {/* Gentle Wave: Starts around y=75 (approx 15-20px high in h-20/80px container, which is ~10% of tank) */}
                    <path d="M0 100 L0 75 Q 30 82 50 78 T 100 72 L 100 100 Z" fill="url(#sandGradient)" />
                </svg>
            </div>

            {/* Hearts Layer */}
            {hearts.map(h => (
                <div 
                    key={h.id} 
                    className="absolute z-[60] pointer-events-none text-rose-500"
                    style={{ 
                        left: h.x, 
                        top: h.y,
                        '--tx': `${h.tx}px`,
                        '--rot': `${h.rot}deg`,
                        animation: 'heart-float 0.8s ease-out forwards'
                    } as React.CSSProperties}
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 drop-shadow-sm">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </div>
            ))}
            
            {/* REWARD FEEDBACK (Dynamic Position) */}
            {rewardFeedback && clickCoords && (
                <div 
                    className="absolute z-50 pointer-events-none"
                    style={{ left: clickCoords.x, top: clickCoords.y - 20 }}
                >
                    <div 
                        className={`transition-all duration-300 ease-out ${
                            rewardExiting 
                            ? 'opacity-0 scale-90' 
                            : 'opacity-100 scale-100'
                        }`}
                    >
                        <div className="bg-white px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-stone-100 animate-scale-in origin-center">
                            <>
                                <span className="text-xs font-bold text-stone-800">+{rewardFeedback.amount}</span>
                                <Icons.Diamond className="w-2.5 h-2.5 text-blue-500 fill-current" />
                            </>
                        </div>
                    </div>
                </div>
            )}

            {/* Tank Reflection */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/30 to-transparent pointer-events-none rounded-bl-full" />
        </div>
    );
};
