import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Board, Cell, Difficulty, LevelProgress } from '../types';
import { generateLevel, isValid, isGameSolved } from '../utils/sudoku';
import { Storage } from '../utils/storage';
import { Icons } from './ui/Icons';

interface SudokuGameProps {
  difficulty: Difficulty;
  levelId: number;
  onBack: () => void;
  onComplete: () => void;
  onSettingsOpen: () => void;
  onNextLevel: () => void;
  settings: any;
  onEarnPoints: (amount: number) => void;
  currentPoints: number;
  isSettingsOpen?: boolean;
  backgroundClass?: string;
}

export const SudokuGame: React.FC<SudokuGameProps> = ({ 
  difficulty, 
  levelId, 
  onBack, 
  onComplete, 
  onSettingsOpen,
  onNextLevel,
  settings,
  onEarnPoints,
  currentPoints,
  isSettingsOpen = false,
  backgroundClass = 'bg-paper'
}) => {
  const [board, setBoard] = useState<Board>([]);
  const [solvedBoard, setSolvedBoard] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [isPencilMode, setIsPencilMode] = useState(false);
  const [history, setHistory] = useState<Board[]>([]);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEnding, setIsEnding] = useState(false); // New state to block input before modal appears
  const [loading, setLoading] = useState(true);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [displayedPoints, setDisplayedPoints] = useState(0); // Animated points
  
  // Transition states for pause menu interactions
  const [isResuming, setIsResuming] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);

  const timerRef = useRef<any>(null);

  // Initialize Game Logic
  const initializeGame = useCallback(() => {
    setLoading(true);
    setShowRestartConfirm(false);
    setIsPaused(false);
    setIsCompleted(false);
    setIsEnding(false);
    setIsResuming(false);
    setIsRestarting(false);
    setIsQuitting(false);
    setHistory([]);
    setEarnedPoints(0);
    setDisplayedPoints(0);
    
    const savedProgress = Storage.getLevelProgress(difficulty, levelId);
    
    if (savedProgress && savedProgress.status === 'in-progress' && savedProgress.boardState) {
      setBoard(savedProgress.boardState);
      setTimer(savedProgress.timeElapsed);
      const { solved } = generateLevel(difficulty, levelId); 
      setSolvedBoard(solved);
    } else {
      const { initial, solved } = generateLevel(difficulty, levelId);
      setBoard(initial);
      setSolvedBoard(solved);
      setTimer(0);
    }
    setLoading(false);
  }, [difficulty, levelId]);

  useEffect(() => {
    initializeGame();
    return () => stopTimer();
  }, [initializeGame]);

  const handleRestart = () => {
      setIsRestarting(true);
      setTimeout(() => {
        Storage.clearLevelProgress(difficulty, levelId);
        initializeGame();
      }, 300);
  };

  const handleResume = () => {
      setIsResuming(true);
      setTimeout(() => {
          setIsPaused(false);
          setIsResuming(false);
      }, 300);
  };
  
  const handleQuit = () => {
      setIsQuitting(true);
      setTimeout(() => {
          onBack();
      }, 300);
  };

  const handleNextLevelWithAnim = () => {
      setIsQuitting(true); // Re-use quitting anim style for fading out
      setTimeout(() => {
          onNextLevel();
      }, 300);
  };

  // Timer Logic
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    // Only run timer if NOT loading, NOT paused (menu), NOT completed, NOT asking restart, NOT ending, and NOT settings open
    if (!loading && !isPaused && !isCompleted && !showRestartConfirm && !isEnding && !isSettingsOpen) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [loading, isPaused, isCompleted, showRestartConfirm, isEnding, isSettingsOpen]);

  // Point Animation Effect
  useEffect(() => {
      if (isCompleted && earnedPoints > 0) {
          let startTime: number;
          const duration = 1500; // 1.5s animation

          const animate = (time: number) => {
              if (!startTime) startTime = time;
              const elapsed = time - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Ease Out Quart
              const ease = 1 - Math.pow(1 - progress, 4);
              
              setDisplayedPoints(Math.floor(ease * earnedPoints));

              if (progress < 1) {
                  requestAnimationFrame(animate);
              } else {
                  setDisplayedPoints(earnedPoints);
              }
          };
          requestAnimationFrame(animate);
      }
  }, [isCompleted, earnedPoints]);

  // Instant Save Logic
  const saveProgressInstant = (currentBoard: Board) => {
     if (loading || isCompleted) return;
     const progress: LevelProgress = {
        levelId,
        difficulty,
        status: 'in-progress',
        timeElapsed: timer, // Note: Timer might be 1s behind due to interval, but acceptable
        lastPlayed: Date.now(),
        boardState: currentBoard,
      };
      Storage.saveLevelProgress(progress);
  };

  // Keep the interval save just in case for timer sync
  useEffect(() => {
    if (loading || isCompleted || showRestartConfirm || isEnding) return;
    const save = setInterval(() => {
      saveProgressInstant(board);
    }, 5000);
    return () => clearInterval(save);
  }, [board, timer, difficulty, levelId, loading, isCompleted, showRestartConfirm, isEnding]);


  // Calculate Conflicts
  const conflicts = useMemo(() => {
      const conf = new Set<string>();
      if (loading || board.length === 0) return conf;

      const rows = Array.from({length: 9}, () => new Map<number, number[]>());
      const cols = Array.from({length: 9}, () => new Map<number, number[]>());
      const boxes = Array.from({length: 9}, () => new Map<number, number[]>());

      board.forEach((row, r) => {
          row.forEach((cell, c) => {
              if (cell.value !== null) {
                  const val = cell.value;
                  if (!rows[r].has(val)) rows[r].set(val, []);
                  rows[r].get(val)!.push(c);
                  
                  if (!cols[c].has(val)) cols[c].set(val, []);
                  cols[c].get(val)!.push(r);

                  const b = Math.floor(r/3)*3 + Math.floor(c/3);
                  if (!boxes[b].has(val)) boxes[b].set(val, []);
                  boxes[b].get(val)!.push(r*9+c);
              }
          });
      });

      // Populate conflicts set
      rows.forEach((rowMap, r) => rowMap.forEach((indices) => {
          if (indices.length > 1) indices.forEach(c => conf.add(`${r}-${c}`));
      }));
      cols.forEach((colMap, c) => colMap.forEach((indices) => {
          if (indices.length > 1) indices.forEach(r => conf.add(`${r}-${c}`));
      }));
      boxes.forEach((boxMap, b) => boxMap.forEach((indices) => {
          if (indices.length > 1) indices.forEach(flat => {
              const r = Math.floor(flat/9);
              const c = flat%9;
              conf.add(`${r}-${c}`);
          });
      }));

      return conf;
  }, [board, loading]);

  const handleCellClick = (row: number, col: number) => {
    if (isPaused || isCompleted || isEnding || isSettingsOpen) return;
    setSelectedCell([row, col]);
  };

  const getPointsForDifficulty = (diff: Difficulty) => {
      switch(diff) {
          case Difficulty.SuperEasy: return 5;
          case Difficulty.Easy: return 10;
          case Difficulty.Normal: return 20;
          case Difficulty.Hard: return 30;
          case Difficulty.Intense: return 40;
          case Difficulty.Impossible: return 50;
          default: return 0;
      }
  };

  const handleNumberInput = (num: number) => {
    if (!selectedCell || isPaused || isCompleted || isEnding || isSettingsOpen) return;
    const [r, c] = selectedCell;
    const currentCell = board[r][c];

    if (currentCell.isFixed) return;

    // Push to history
    setHistory(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(board))]);

    // Create new board state safely
    const newBoard = board.map(row => [...row]);
    const newCell = { ...newBoard[r][c] };

    if (isPencilMode) {
      if (newCell.notes.includes(num)) {
        newCell.notes = newCell.notes.filter(n => n !== num);
      } else {
        newCell.notes = [...newCell.notes, num].sort();
      }
    } else {
      // Set value
      if (newCell.value === num) {
        newCell.value = null; 
        newCell.isError = false;
      } else {
        newCell.value = num as any;
        newCell.notes = [];

        // Error Logic
        const isHarderDifficulty = 
            difficulty === Difficulty.Normal || 
            difficulty === Difficulty.Hard || 
            difficulty === Difficulty.Intense || 
            difficulty === Difficulty.Impossible;

        if (!isHarderDifficulty) {
             newCell.isError = num !== solvedBoard[r][c];
        } else {
             newCell.isError = false; 
        }
      }
    }
    
    newBoard[r][c] = newCell;
    setBoard(newBoard);
    
    // INSTANT SAVE
    saveProgressInstant(newBoard);

    if (!isPencilMode && newCell.value) {
       checkCompletion(newBoard);
    }
  };

  const checkCompletion = (currentBoard: Board) => {
      let filled = 0;
      let correct = 0;
      for(let r=0; r<9; r++) {
          for(let c=0; c<9; c++) {
              if (currentBoard[r][c].value !== null) {
                  filled++;
                  if (currentBoard[r][c].value === solvedBoard[r][c]) correct++;
              }
          }
      }

      if (filled === 81 && correct === 81) {
          setIsEnding(true); // Freeze input
          stopTimer(); // Freeze timer
          
          setTimeout(() => {
              setIsCompleted(true); // Show modal after delay
              
              const points = getPointsForDifficulty(difficulty);
              setEarnedPoints(points);
              onEarnPoints(points);
              
              const progress: LevelProgress = {
                levelId,
                difficulty,
                status: 'completed',
                timeElapsed: timer,
                lastPlayed: Date.now(),
                boardState: undefined, 
              };
              Storage.saveLevelProgress(progress);
          }, 1000);
      }
  };

  const handleErase = () => {
    if (!selectedCell || isPaused || isEnding || isSettingsOpen) return;
    const [r, c] = selectedCell;
    if (board[r][c].isFixed) return;

    setHistory(prev => [...prev, JSON.parse(JSON.stringify(board))]);
    // Create new board state safely
    const newBoard = board.map(row => [...row]);
    newBoard[r][c].value = null;
    newBoard[r][c].notes = [];
    newBoard[r][c].isError = false;
    setBoard(newBoard);
    
    // INSTANT SAVE
    saveProgressInstant(newBoard);
  };

  const handleUndo = () => {
    if (history.length === 0 || isPaused || isEnding || isSettingsOpen) return;
    const previous = history[history.length - 1];
    setBoard(previous);
    setHistory(prev => prev.slice(0, -1));
    
    // INSTANT SAVE
    saveProgressInstant(previous);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCellClass = (cell: Cell, r: number, c: number) => {
    let classes = "w-full h-full flex items-center justify-center text-lg sm:text-2xl transition-all duration-200 cursor-pointer select-none relative ";
    const borderR = (c + 1) % 3 === 0 && c !== 8 ? "border-r-2 border-stone-300" : "border-r border-stone-200";
    const borderB = (r + 1) % 3 === 0 && r !== 8 ? "border-b-2 border-stone-300" : "border-b border-stone-200";
    classes += `${borderR} ${borderB} `;

    const isConflict = conflicts.has(`${r}-${c}`);
    const isError = cell.isError;
    const isSelected = selectedCell ? (selectedCell[0] === r && selectedCell[1] === c) : false;
    const isSameValue = selectedCell && cell.value !== null && board[selectedCell[0]][selectedCell[1]].value === cell.value;
    const isRelated = selectedCell && (selectedCell[0] === r || selectedCell[1] === c || (Math.floor(selectedCell[0]/3) === Math.floor(r/3) && Math.floor(selectedCell[1]/3) === Math.floor(c/3)));

    // Background Priority
    if (isError || isConflict) {
        classes += "bg-red-100 ";
        // If selected and error, show ring to denote selection
        if (isSelected) classes += "ring-2 ring-blue-400 z-10 ";
    } else if (isSelected) {
        classes += "bg-blue-300 ";
    } else if (settings.highlight && isSameValue) {
        classes += "bg-blue-100 ";
    } else if (settings.highlight && isRelated) {
        classes += "bg-stone-100 ";
    } else {
        classes += "bg-white ";
    }

    // Text Color Priority
    if (cell.isFixed) {
        classes += "font-semibold text-stone-900 ";
    } else {
        // User Input
        if (isSelected && !isError && !isConflict) {
             classes += "font-medium text-white "; // White text on blue selection
        } else {
             classes += "font-medium text-blue-600 "; // Blue text even if error/conflict
        }
    }
    return classes;
  };

  if (loading) return <div className="h-full w-full flex items-center justify-center">Loading...</div>;

  return (
    <div className={`h-full flex flex-col max-w-lg mx-auto px-4 pt-6 pb-4 relative ${isQuitting ? 'animate-fade-out' : 'animate-fade-in'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-14 relative">
        <button onClick={handleQuit} className="p-2 rounded-full hover:bg-stone-200 transition z-10 -ml-2">
          <Icons.Back className="w-6 h-6 text-stone-600" />
        </button>
        
        {/* Centered Title - Moved down for Dynamic Island (~72px from top) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center mt-12 pointer-events-none">
            <span className="text-xs font-bold tracking-wider text-stone-400 uppercase text-center w-48">{difficulty} &bull; Level {levelId}</span>
            <span className="text-xl font-medium tabular-nums text-stone-700">{formatTime(timer)}</span>
        </div>
        
        <div className="flex flex-col items-end gap-1 z-10 -mr-2">
            <div className="flex gap-1">
                <button onClick={() => setIsPaused(true)} className="p-2 rounded-full hover:bg-stone-200 transition">
                    <Icons.Pause className="w-6 h-6 text-stone-600" />
                </button>
                <button onClick={onSettingsOpen} className="p-2 rounded-full hover:bg-stone-200 transition">
                    <Icons.Settings className="w-6 h-6 text-stone-600" />
                </button>
            </div>
            {/* Points Display in Game */}
            <div className="flex items-center gap-1 bg-stone-100 px-2 py-1 rounded-full mr-1">
                <div className="text-blue-500">
                    <Icons.Diamond className="w-3 h-3 fill-current" />
                </div>
                <span className="text-xs font-bold text-stone-600 tabular-nums">{currentPoints}</span>
            </div>
        </div>
      </div>

      {/* Board */}
      <div className="aspect-square w-full bg-stone-300 border-2 border-stone-300 rounded-lg overflow-hidden shadow-sm">
        <div className="grid grid-rows-9 h-full">
          {board.map((row, rIndex) => (
            <div key={rIndex} className="grid grid-cols-9 h-full">
              {row.map((cell, cIndex) => (
                <div 
                    key={`${rIndex}-${cIndex}`} 
                    className={getCellClass(cell, rIndex, cIndex)}
                    onClick={() => handleCellClick(rIndex, cIndex)}
                >
                  {cell.value ? (
                      <span>{cell.value}</span>
                  ) : (
                      <div className="grid grid-cols-3 w-full h-full p-0.5">
                          {[1,2,3,4,5,6,7,8,9].map(n => (
                              <div key={n} className="flex items-center justify-center text-[8px] sm:text-[10px] leading-none text-stone-500">
                                  {cell.notes.includes(n) ? n : ''}
                              </div>
                          ))}
                      </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-col gap-4">
        {/* Actions */}
        <div className="flex justify-between px-4">
            <button onClick={handleUndo} className="flex flex-col items-center gap-1 text-stone-500 active:scale-95 transition">
                <div className="p-3 bg-white rounded-full shadow-sm border border-stone-100"><Icons.Undo className="w-5 h-5" /></div>
                <span className="text-xs">Undo</span>
            </button>
            <button onClick={() => setIsPencilMode(!isPencilMode)} className={`flex flex-col items-center gap-1 active:scale-95 transition ${isPencilMode ? 'text-blue-500' : 'text-stone-500'}`}>
                <div className={`p-3 rounded-full shadow-sm border border-stone-100 ${isPencilMode ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                    <Icons.Pencil className="w-5 h-5" />
                    {isPencilMode && <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></span>}
                </div>
                <span className="text-xs">Pencil</span>
            </button>
            <button onClick={handleErase} className="flex flex-col items-center gap-1 text-stone-500 active:scale-95 transition">
                <div className="p-3 bg-white rounded-full shadow-sm border border-stone-100"><Icons.Erase className="w-5 h-5" /></div>
                <span className="text-xs">Erase</span>
            </button>
             <button className="flex flex-col items-center gap-1 text-stone-300 cursor-not-allowed">
                <div className="p-3 bg-stone-50 rounded-full border border-stone-100"><Icons.Hint className="w-5 h-5" /></div>
                <span className="text-xs">Hint</span>
            </button>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-9 gap-1 mt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                    key={num}
                    onClick={() => handleNumberInput(num)}
                    className="aspect-[4/5] flex items-center justify-center text-xl font-medium text-blue-600 bg-white rounded-lg shadow-sm border-b-2 border-stone-100 active:border-b-0 active:translate-y-[2px] transition-all"
                >
                    {num}
                </button>
            ))}
        </div>
      </div>

      {/* Unified Pause & Restart Overlay */}
      {(isPaused || showRestartConfirm) && (
          <div className={`absolute inset-0 bg-stone-50/90 backdrop-blur-sm z-40 flex items-center justify-center 
              ${(isResuming || isRestarting) ? 'animate-fade-out' : 'animate-fade-in'}`}>
              
              {!showRestartConfirm ? (
                  /* Pause Menu Content */
                  <div className="flex flex-col gap-4 w-48 animate-pop">
                    <h2 className="text-2xl font-bold text-stone-800 mb-4 text-center">Game Paused</h2>
                    <button onClick={handleResume} className="flex items-center justify-center gap-2 p-4 bg-stone-800 text-white rounded-xl shadow-lg active:scale-95 transition hover:opacity-90">
                        <Icons.Play className="w-5 h-5" /> Resume
                    </button>
                    <button 
                        onClick={() => setShowRestartConfirm(true)} 
                        className="flex items-center justify-center gap-2 p-4 bg-white text-stone-800 border border-stone-200 rounded-xl active:scale-95 transition hover:bg-stone-50"
                    >
                        <Icons.Reset className="w-5 h-5" /> Restart Level
                    </button>
                    <button onClick={handleQuit} className="flex items-center justify-center gap-2 p-4 text-stone-500 hover:text-stone-800 transition">
                         Quit Game
                    </button>
                  </div>
              ) : (
                  /* Restart Confirm Content */
                  <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm text-center animate-pop">
                     <h3 className="text-lg font-bold text-stone-800 mb-2">Restart Level?</h3>
                     <p className="text-stone-500 text-sm mb-6">Are you sure? This will reset all progress on this level.</p>
                     <div className="flex gap-3">
                        <button onClick={() => setShowRestartConfirm(false)} className="flex-1 py-3 text-stone-600 bg-stone-100 rounded-xl font-medium active:scale-95 transition">Cancel</button>
                        <button onClick={handleRestart} className="flex-1 py-3 text-white bg-red-500 rounded-xl font-medium shadow-md active:scale-95 transition">Restart</button>
                     </div>
                  </div>
              )}
          </div>
      )}

      {/* Completion Modal */}
      {isCompleted && (
          <div className="absolute inset-0 bg-green-500/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white animate-fade-in">
              <div className="bg-white text-stone-800 p-8 rounded-2xl shadow-2xl w-80 text-center animate-pop">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                      <Icons.Check className="w-10 h-10 animate-scale-loop" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Solved!</h2>
                  <p className="text-stone-500 mb-2 text-sm">You earned</p>
                  <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="text-blue-500"><Icons.Diamond className="w-6 h-6 fill-current" /></div>
                      <span className="text-3xl font-bold text-stone-800">+{displayedPoints}</span>
                  </div>
                  <p className="text-stone-400 mb-2 text-xs uppercase tracking-wide">Time</p>
                  <p className="text-2xl font-medium mb-8 tabular-nums">{formatTime(timer)}</p>
                  
                  <div className="flex flex-col gap-3">
                    <button onClick={handleNextLevelWithAnim} className="w-full py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-700 active:scale-95 transition shadow-lg active:opacity-80">
                        Play Next Level
                    </button>
                    <button onClick={handleQuit} className="w-full py-3 bg-white text-stone-600 border border-stone-200 rounded-xl font-medium hover:bg-stone-50 active:scale-95 transition active:opacity-80">
                        Back to Menu
                    </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};