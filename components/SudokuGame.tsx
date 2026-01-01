
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, AppSettings, Board, MoveLogEntry } from '../types';
import { useSudokuBoard } from '../hooks/useSudokuBoard';
import { useGameSkills } from '../hooks/useGameSkills';
import { useGameTimer } from '../hooks/useGameTimer';
import { SudokuGrid } from './game/SudokuGrid';
import { GameControls } from './game/GameControls';
import { NumberPad } from './game/NumberPad';
import { WinModal } from './game/WinModal';
import { generateReplayVideo, ReplayMove } from '../utils/replay';
import { Storage } from '../utils/storage';
import { sounds } from '../utils/sound';
import { Icons } from './ui/Icons';
import { formatTimeShort } from '../utils/constants';

interface SudokuGameProps {
  difficulty: Difficulty;
  levelId: number;
  onBack: () => void;
  onReturnToMenu: () => void;
  onComplete: () => void;
  onSettingsOpen: () => void;
  settings: AppSettings;
  onEarnPoints: (amount: number) => void;
  currentPoints: number;
  isSettingsOpen: boolean;
  backgroundClass: string;
  numberColor: string;
  purchasedSkills: string[];
}

export const SudokuGame: React.FC<SudokuGameProps> = ({
  difficulty,
  levelId,
  onBack,
  onReturnToMenu,
  onComplete,
  onSettingsOpen,
  settings,
  onEarnPoints,
  currentPoints,
  isSettingsOpen,
  backgroundClass,
  numberColor,
  purchasedSkills
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  
  const [isGeneratingReplay, setIsGeneratingReplay] = useState(false);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);

  const [animatingSections, setAnimatingSections] = useState<Set<string>>(new Set());
  const [showStartHint, setShowStartHint] = useState(false);
  
  // Timer hook
  const { timer, setTimer } = useGameTimer(
      settings,
      isPaused,
      isCompleted,
      isEnding,
      isSettingsOpen,
      0
  );

  const saveProgress = (currentBoard: Board, scanUsesVal?: number, revealUsesVal?: number, moveLog?: MoveLogEntry[], isPerfect: boolean = false) => {
      if (isCompleted || isEnding) return;
      Storage.saveLevelProgress({
          levelId,
          difficulty,
          status: 'in-progress',
          timeElapsed: timer,
          boardState: currentBoard,
          moveLog: moveLog,
          lastPlayed: Date.now(),
          scanUses: scanUsesVal !== undefined ? scanUsesVal : scanUses,
          revealUses: revealUsesVal !== undefined ? revealUsesVal : revealUses,
      }, isPerfect);
  };

  const handleSectionComplete = useCallback((sections: string[]) => {
      if (sections.length > 0) {
          setAnimatingSections(prev => {
              const next = new Set(prev);
              sections.forEach(s => next.add(s));
              return next;
          });
          setTimeout(() => {
              setAnimatingSections(prev => {
                  const next = new Set(prev);
                  sections.forEach(s => next.delete(s));
                  return next;
              });
          }, 1000);
      }
  }, []);

  const handleGameComplete = (completedBoard: Board, completedMoveLog: MoveLogEntry[], isPerfect: boolean) => {
      if (isCompleted || isEnding) return;
      setIsEnding(true);
      sounds.playWin();
      
      setAnimatingSections(new Set(['full-board']));
      setTimeout(() => {
          setAnimatingSections(new Set());
      }, 1500);
      
      let points = 0;
      switch(difficulty) {
          case Difficulty.SuperEasy: points = 5; break;
          case Difficulty.Easy: points = 10; break;
          case Difficulty.Normal: points = 15; break;
          case Difficulty.Hard: points = 20; break;
          case Difficulty.Intense: points = 30; break;
          case Difficulty.Impossible: points = 50; break;
      }
      
      onEarnPoints(points);
      setEarnedPoints(points);
      
      Storage.saveLevelProgress({
          levelId,
          difficulty,
          status: 'completed',
          timeElapsed: timer,
          boardState: completedBoard,
          moveLog: completedMoveLog,
          lastPlayed: Date.now(),
          scanUses,
          revealUses,
      }, isPerfect);
      
      // Grant Pepino Gift on Win
      Storage.grantPepinoGift();
      
      if (settings.generateReplay) {
          // Pass true to indicate auto-generation
          generateReplay();
      }
      
      setTimeout(() => {
          setIsCompleted(true);
          onComplete();
      }, 1500);
  };

  const {
      board,
      setBoard,
      solvedBoard,
      initialBoardRef,
      history,
      setHistory,
      moveLog,
      isPencilMode,
      setIsPencilMode,
      selectedCell,
      setSelectedCell,
      activeNumber,
      setActiveNumber,
      conflicts,
      numberCounts,
      initializeBoard,
      handleCellClick,
      handleNumberInput,
      handleUndo,
      handleErase,
      checkCompletion,
      removeNotesFromPeers
  } = useSudokuBoard({
      difficulty,
      levelId,
      settings,
      onComplete: handleGameComplete,
      onBoardChange: (newBoard, currentMoveLog) => saveProgress(newBoard, undefined, undefined, currentMoveLog),
      onSectionComplete: handleSectionComplete
  });

  const {
      scanUses,
      setScanUses,
      isScanning,
      scanCooldown,
      revealUses,
      setRevealUses,
      revealingCell,
      setRevealingCell,
      animatingCell,
      setAnimatingCell,
      isAutoAvailable,
      handleAutoFill,
      handleScan,
      handleReveal,
  } = useGameSkills({
      board,
      setBoard,
      solvedBoard,
      setHistory,
      moveLog,
      selectedCell,
      activeNumber,
      settings,
      difficulty,
      removeNotesFromPeers,
      checkCompletion,
      onSaveProgress: (b, s, r, ml) => saveProgress(b, s, r, ml),
      onSectionComplete: handleSectionComplete,
      timer
  });

  useEffect(() => {
      const progress = Storage.getLevelProgress(difficulty, levelId);
      if (progress && progress.status === 'in-progress' && progress.boardState) {
          initializeBoard(progress.boardState, progress.moveLog);
          setTimer(progress.timeElapsed);
          
          // Restore skills
          if (progress.scanUses !== undefined) setScanUses(progress.scanUses);
          else setScanUses(3);

          if (progress.revealUses !== undefined) setRevealUses(progress.revealUses);
          else setRevealUses(1);
      } else {
          initializeBoard();
          setTimer(0);
          
          // Reset skills
          setScanUses(3);
          setRevealUses(1);
      }
      setIsCompleted(false);
      setIsEnding(false);
      setIsPaused(false);
      setShowRestartConfirm(false);
      setReplayUrl(null);
      setShowReplay(false);
      setAnimatingSections(new Set());
      
      setShowStartHint(true);
      const hintTimer = setTimeout(() => setShowStartHint(false), 5000);
      return () => clearTimeout(hintTimer);
  }, [difficulty, levelId, initializeBoard, setTimer, setScanUses, setRevealUses]);
  
  const generateReplay = () => {
        if (isGeneratingReplay || replayUrl) return;
        setIsGeneratingReplay(true);
        
        try {
            let cleanMoves: ReplayMove[] = [];
            
            // 1. Try to use real history if available
            if (moveLog.current.length > 0) {
                const finalMoveMap = new Map<string, number>();
                moveLog.current.forEach(move => {
                    // Only include moves that match final solution
                    if (solvedBoard[move.r] && solvedBoard[move.r][move.c] && move.v === solvedBoard[move.r][move.c]) {
                        finalMoveMap.set(`${move.r}-${move.c}`, move.t);
                    }
                });

                for(let r=0; r<9; r++) {
                    for(let c=0; c<9; c++) {
                        const cell = initialBoardRef.current[r][c];
                        if (!cell.isFixed) {
                            const t = finalMoveMap.get(`${r}-${c}`);
                            if (t !== undefined) {
                                cleanMoves.push({ row: r, col: c, value: solvedBoard[r][c], t });
                            }
                        }
                    }
                }
                cleanMoves.sort((a, b) => (a.t || 0) - (b.t || 0));
            }

            // Calculate total non-fixed cells (holes)
            let totalHoles = 0;
            if (initialBoardRef.current && initialBoardRef.current.length > 0) {
                for(let r=0; r<9; r++) {
                    for(let c=0; c<9; c++) {
                        if (!initialBoardRef.current[r][c].isFixed) totalHoles++;
                    }
                }
            }

            // 2. Smart Fallback: If incomplete moves, reconstruct a "Zen" flow
            if (cleanMoves.length < totalHoles) {
                cleanMoves = [];
                for(let r=0; r<9; r++) {
                    for(let c=0; c<9; c++) {
                        const cell = initialBoardRef.current[r][c];
                        if (!cell.isFixed) {
                            // Create artificial timestamp based on position to create a satisfying fill order
                            cleanMoves.push({ row: r, col: c, value: solvedBoard[r][c], t: (r * 9 + c) * 100 });
                        }
                    }
                }
            }
            
            const isDark = document.documentElement.classList.contains('dark');
            
            // This promise resolves when the recording is complete
            generateReplayVideo(initialBoardRef.current, cleanMoves, difficulty, levelId, isDark, timer)
                .then(url => {
                    setReplayUrl(url);
                    setIsGeneratingReplay(false);
                })
                .catch(err => {
                    console.error("Replay generation error:", err);
                    setIsGeneratingReplay(false);
                });
        } catch (e) {
            console.error("Replay preparation error:", e);
            setIsGeneratingReplay(false);
        }
  };

  const handleShareReplay = async () => {
      if (!replayUrl) return;
      try {
          const blob = await fetch(replayUrl).then(r => r.blob());
          const isMp4 = blob.type.includes('mp4');
          const ext = isMp4 ? 'mp4' : 'webm';
          const mime = isMp4 ? 'video/mp4' : 'video/webm';

          const file = new File([blob], `Oku_${difficulty}_${levelId}.${ext}`, { type: mime });
          if (navigator.share && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: 'Oku Replay',
                  text: `I solved Level ${levelId} (${difficulty}) in ${formatTimeShort(timer)}!`
              });
          } else {
              const a = document.createElement('a');
              a.href = replayUrl;
              a.download = `sudoku_${difficulty}_${levelId}.${ext}`;
              a.click();
          }
      } catch (e) {
          console.error("Share failed", e);
      }
  };

  const handleRestart = () => {
      sounds.playClick();
      Storage.clearLevelProgress(difficulty, levelId); 
      initializeBoard(); 
      setTimer(0); 
      setScanUses(3); 
      setRevealUses(1); 
      setShowRestartConfirm(false); 
      setIsPaused(false);
      setAnimatingSections(new Set());
      
      setShowStartHint(true);
      setTimeout(() => setShowStartHint(false), 5000);
  };
  
  const handleBackgroundClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          setSelectedCell(null);
      }
  };

  // Determine if erase is possible for the selected cell (value or notes)
  const canErase = !!selectedCell && (() => {
      const [r, c] = selectedCell;
      const cell = board[r][c];
      return !cell.isFixed && (cell.value !== null || cell.notes.length > 0);
  })();

  // Memoize click handlers to avoid passing new functions on every timer tick
  const onCellClickWrapper = useCallback((e: React.MouseEvent, r: number, c: number) => {
      handleCellClick(r, c, isPaused, isCompleted);
  }, [handleCellClick, isPaused, isCompleted]);

  const onNumberClickWrapper = useCallback((e: React.MouseEvent, n: number) => {
      handleNumberInput(n, isPaused, isCompleted);
  }, [handleNumberInput, isPaused, isCompleted]);

  return (
    <>
      <div className="w-full flex justify-center px-6 pt-4 pb-4 relative z-40 shrink-0">
          <div className="w-full max-w-md flex items-center justify-between relative">
              {/* Left Column: Back Button */}
              <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-200/50 transition -ml-2 text-t-icon relative z-30">
                  <Icons.Back className="w-6 h-6" />
              </button>

              {/* Center Column: Title & Timer - Absolute Centered */}
              <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                  {settings.showTimer ? (
                      <span className="text-xl font-bold text-t-primary tabular-nums leading-none">{formatTimeShort(timer)}</span>
                  ) : (
                      <span className="text-xl font-bold text-t-primary leading-none">Level {levelId}</span>
                  )}
                  <span className="text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-widest mt-1">
                    {difficulty} {settings.showTimer && `• ${levelId}`}
                  </span>
              </div>
              
              {/* Right Column: Actions */}
              <div className="flex items-center gap-1 relative z-30 -mr-2">
                  <button onClick={() => { sounds.playClick(); setIsPaused(true); }} className="p-2 rounded-full hover:bg-stone-200/50 transition text-t-icon">
                      <Icons.Pause className="w-6 h-6" />
                  </button>
                  <button onClick={onSettingsOpen} className="p-2 rounded-full hover:bg-stone-200/50 transition text-t-icon">
                      <Icons.Settings className="w-6 h-6" />
                  </button>
              </div>
          </div>
      </div>

      <div 
          className="flex-1 w-full flex flex-col items-center justify-start relative cursor-default" 
          onClick={handleBackgroundClick}
      >
         <div className="contents">
            <SudokuGrid 
                board={board}
                selectedCell={selectedCell}
                activeNumber={activeNumber}
                conflicts={conflicts}
                revealingCell={revealingCell}
                animatingCell={animatingCell}
                isScanning={isScanning}
                animatingSections={animatingSections}
                settings={settings}
                numberColor={numberColor}
                onCellClick={onCellClickWrapper}
            />
         </div>

         {/* Number Pad - Wider [500px] to match grid */}
         <div className="w-full max-w-[500px] px-2 mt-4 relative z-[100]" onClick={(e) => e.stopPropagation()}>
             <NumberPad 
                 activeNumber={activeNumber}
                 numberCounts={numberCounts}
                 isPencilMode={isPencilMode}
                 numberColor={numberColor}
                 onNumberClick={onNumberClickWrapper}
             />
         </div>

         {/* Game Controls - Increased spacing (mt-10) */}
         <div className="w-full max-w-md px-6 mt-10 relative z-[100]" onClick={(e) => e.stopPropagation()}>
             <GameControls 
                 canUndo={history.length > 0}
                 canErase={canErase}
                 isPencilMode={isPencilMode}
                 onUndo={(e) => handleUndo(isPaused, isCompleted)}
                 onErase={(e) => handleErase(isPaused, isCompleted)}
                 onTogglePencil={() => { sounds.playClick(); setIsPencilMode(!isPencilMode); }}
                 purchasedSkills={purchasedSkills}
                 isAutoAvailable={isAutoAvailable}
                 scanUses={scanUses}
                 isScanning={isScanning}
                 scanCooldown={scanCooldown}
                 revealUses={revealUses}
                 revealingCell={revealingCell}
                 onAutoFill={() => handleAutoFill(purchasedSkills)}
                 onScan={() => handleScan(isPaused, isCompleted)}
                 onReveal={() => handleReveal(isPaused, isCompleted)}
                 timer={timer}
             />
         </div>
         
         {/* Deselect Text - Increased spacing (mt-8) */}
         <div className={`mt-8 mb-4 pointer-events-none transition-opacity duration-1000 ${showStartHint ? 'opacity-100' : 'opacity-0'}`}>
             <span className="text-xs font-light text-stone-400 dark:text-stone-500 tracking-wide">Tap here to deselect</span>
         </div>
      </div>

      {(isPaused || showRestartConfirm) && (
          <div className="fixed inset-0 bg-stone-50/90 dark:bg-stone-900/90 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
              {!showRestartConfirm ? (
                  <div className="flex flex-col gap-4 w-48 animate-pop">
                    <h2 className="text-2xl font-bold text-stone-800 dark:text-t-primary mb-4 text-center">Game Paused</h2>
                    <button onClick={() => { sounds.playClick(); setIsPaused(false); }} className="flex items-center justify-center gap-2 p-4 bg-stone-800 text-white dark:bg-blue-600 dark:text-white rounded-xl shadow-lg active:scale-95 transition hover:opacity-90">
                        <Icons.Play className="w-5 h-5 fill-current" /> Resume
                    </button>
                    <button onClick={() => { sounds.playClick(); setShowRestartConfirm(true); }} className="flex items-center justify-center gap-2 p-4 bg-white text-stone-800 border border-stone-200 dark:bg-t-surface dark:text-t-primary dark:border-t-border rounded-xl active:scale-95 transition hover:bg-stone-50 dark:hover:bg-t-surface-sec">
                        <Icons.Reset className="w-5 h-5" /> Restart Level
                    </button>
                    <button onClick={() => { sounds.playClick(); onBack(); }} className="flex items-center justify-center gap-2 p-4 text-stone-500 hover:text-stone-800 dark:text-t-secondary dark:hover:text-t-primary transition font-medium">
                        Quit Game
                    </button>
                  </div>
              ) : (
                  <div className="bg-white dark:bg-t-surface p-6 rounded-2xl shadow-xl w-full max-w-sm text-center animate-pop">
                     <h3 className="text-lg font-bold text-stone-800 dark:text-t-primary mb-2">Restart Level?</h3>
                     <p className="text-stone-500 dark:text-t-secondary text-sm mb-6">Are you sure? This will reset your progress on this level.</p>
                     <div className="flex gap-3">
                         <button onClick={() => { sounds.playClick(); setShowRestartConfirm(false); }} className="flex-1 py-3 text-stone-600 bg-stone-100 dark:bg-t-surface-sec dark:text-t-primary rounded-xl font-medium active:scale-95 transition">Cancel</button>
                         <button onClick={handleRestart} className="flex-1 py-3 text-white bg-red-500 rounded-xl font-medium shadow-md active:scale-95 transition">Restart</button>
                     </div>
                  </div>
              )}
          </div>
      )}

      {isCompleted && (
          <WinModal 
              difficulty={difficulty}
              levelId={levelId}
              timer={timer}
              points={earnedPoints}
              isGeneratingReplay={isGeneratingReplay}
              replayUrl={replayUrl}
              showReplay={showReplay}
              generateReplayEnabled={settings.generateReplay}
              onReplay={(e) => { e.stopPropagation(); setShowReplay(true); }}
              onShareReplay={handleShareReplay}
              onCloseReplay={() => setShowReplay(false)}
              onGenerateReplay={generateReplay}
              onBack={onBack}
              onReturnToMenu={onReturnToMenu}
          />
      )}
    </>
  );
};
