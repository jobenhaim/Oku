
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Difficulty, AppSettings, Board, MoveLogEntry, CellValue, HintCandidateProgress } from '../types';
import { useSudokuBoard } from '../hooks/useSudokuBoard';
import { useGameSkills } from '../hooks/useGameSkills';
import { useGameTimer } from '../hooks/useGameTimer';
import { SudokuGrid } from './game/SudokuGrid';
import { GameControls, type HintNotice } from './game/GameControls';
import { HintTheater } from './game/HintTheater';
import { NumberPad } from './game/NumberPad';
import { WinModal } from './game/WinModal';
import { generateReplayVideo, ReplayMove } from '../utils/replay';
import { hasPlayerBoardInput, Storage } from '../utils/storage';
import { sounds } from '../utils/sound';
import { Icons } from './ui/Icons';
import { DiamondBalancePill } from './ui/DiamondBalancePill';
import { formatTimeShort, getHintCost, getScanRefillCost } from '../utils/constants';
import {
  applyHintCandidateProgress,
  applyHintCandidatePlan,
  cloneHintBoard,
  createHintPlan,
  type HintPlan,
} from '../utils/hints';
import {
  createDevHintPreview,
  scopeDevHintPreview,
  type DevHintPreview,
} from '../utils/devHintPreview';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';

interface SudokuGameProps {
  difficulty: Difficulty;
  levelId: number;
  onBack: () => void;
  onReturnToMenu: () => void;
  onComplete: () => void;
  onSettingsOpen: () => void;
  settings: AppSettings;
  onPointsChanged: (points: number) => void;
  currentPoints: number;
  isSettingsOpen: boolean;
  backgroundClass: string;
  numberColor: string;
  purchasedSkills: string[];
  devHintPreview?: DevHintPreview;
}

const SCAN_ERROR_MESSAGES = [
  "Something looks wrong.",
  "Better erase those.",
  "Something's out of place.",
  "A few numbers need attention."
];

const SCAN_CLEAN_MESSAGES = [
  "All good here.",
  "Very clean!",
  "Looking spotless.",
  "Nothing to fix."
];

const LEVEL_START_MESSAGES = [
  "Good luck!"
];

const HALFWAY_MESSAGES = [
  "Halfway there!",
  "Halfway done!",
  "You're halfway!",
  "Halfway through!"
];

const COMPLETE_MESSAGES = [
  "Sudoku complete!",
  "Puzzle solved!",
  "Nicely done!",
  "Beautiful work!",
  "You did it!",
  "All finished!",
  "Well played!",
  "Great solve!",
  "Board complete!",
  "Another one solved!",
  "That's a win!"
];

const LIGHT_IDLE_DELAY_MS = 5000;
const LIGHT_VISIBLE_MS = 8000;

type PillMessageType = 'scan-error' | 'scan-clean' | 'start' | 'warning' | 'halfway' | 'notes' | 'complete';

interface PillMessage {
  id: number;
  text: string;
  type: PillMessageType;
  holdMs: number;
}

interface PreparedHint {
  puzzleKey: string;
  board: Board;
  plan: HintPlan;
  signature: string;
  expectedHintsUsed: number;
}

interface ActiveHint {
  puzzleKey: string;
  board: Board;
  plan: HintPlan;
  candidateProgress?: HintCandidateProgress | null;
}

const EMPTY_HINT_SET = new Set<string>();

const boardHintPresentationSignature = (board: Board) => board.map(row => row.map(cell => (
    `${cell.value ?? 0}:${[...(cell.notes ?? [])].sort((left, right) => left - right).join('')}`
)).join('|')).join('/');

const shuffledCopy = (messages: string[]) => {
  const shuffled = [...messages];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const SudokuGame: React.FC<SudokuGameProps> = ({
  difficulty,
  levelId,
  onBack,
  onReturnToMenu,
  onComplete,
  onSettingsOpen,
  settings,
  onPointsChanged,
  currentPoints,
  isSettingsOpen,
  backgroundClass,
  numberColor,
  purchasedSkills,
  devHintPreview,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isEraseMode, setIsEraseMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [areCompletionNumbersLocked, setAreCompletionNumbersLocked] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  
  const [isGeneratingReplay, setIsGeneratingReplay] = useState(false);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);

  const puzzleKey = `${difficulty}-${levelId}`;
  const activeDevHintPreview = scopeDevHintPreview(
      devHintPreview,
      difficulty,
      levelId,
  );
  const devHintState = useMemo<ActiveHint | null>(() => {
      if (!import.meta.env.DEV || !activeDevHintPreview) return null;
      return {
          ...createDevHintPreview(activeDevHintPreview),
          puzzleKey,
      };
  }, [activeDevHintPreview, puzzleKey]);
  const [hintUses, setHintUses] = useState(() => (
      Storage.getHintEconomy(difficulty, levelId).hintsUsed
  ));
  const [isHintPreparing, setIsHintPreparing] = useState(false);
  const [activeHint, setActiveHint] = useState<ActiveHint | null>(() => devHintState);
  const [hintFrameIndex, setHintFrameIndex] = useState(0);
  const [hintNotice, setHintNotice] = useState<HintNotice | null>(null);
  const hintTransactionRef = useRef(false);
  const hintPlacementRef = useRef(false);
  const shouldRestoreHintFocusRef = useRef(false);
  const isHintTheaterOpen = activeHint !== null;
  const presentHintNotice = useCallback((notice: HintNotice) => {
      hintTransactionRef.current = false;
      setIsHintPreparing(false);
      setHintNotice(notice);
  }, []);
  const dismissHintNotice = useCallback(() => {
      hintTransactionRef.current = false;
      setIsHintPreparing(false);
      setHintNotice(null);
  }, []);

  useEffect(() => {
      if (devHintState) {
          setHintUses(0);
          return;
      }
      const unsubscribe = Storage.subscribe((data) => {
          const key = `${difficulty}-${levelId}`;
          setHintUses(Math.max(0, Math.floor(data.hintUsageByPuzzle?.[key] ?? 0)));
      });
      return () => { unsubscribe(); };
  }, [devHintState, difficulty, levelId]);

  const [animatingSections, setAnimatingSections] = useState<Set<string>>(new Set());
  const [hintUpdatedCells, setHintUpdatedCells] = useState<Set<string>>(new Set());
  const [nudgeCue, setNudgeCue] = useState<{r: number, c: number, key: number} | null>(null);
  const [nudgeActivityVersion, setNudgeActivityVersion] = useState(0);
  const [showStartHint, setShowStartHint] = useState(false);
  const [pillMessage, setPillMessage] = useState<PillMessage | null>(null);
  const scanErrorDeckRef = useRef(shuffledCopy(SCAN_ERROR_MESSAGES));
  const scanCleanDeckRef = useRef(shuffledCopy(SCAN_CLEAN_MESSAGES));
  const halfwayDeckRef = useRef(shuffledCopy(HALFWAY_MESSAGES));
  const completeDeckRef = useRef(shuffledCopy(COMPLETE_MESSAGES));
  const scanErrorIndexRef = useRef(0);
  const scanCleanIndexRef = useRef(0);
  const halfwayIndexRef = useRef(0);
  const completeIndexRef = useRef(0);
  const pillMessageIdRef = useRef(0);
  const pillMessageRef = useRef<PillMessage | null>(null);
  const pendingPillRef = useRef<PillMessage | null>(null);
  const isPillExitingRef = useRef(false);
  const halfwayShownRef = useRef(false);
  const halfwayTrackingReadyRef = useRef(false);
  const notesReadyShownRef = useRef(false);
  const hasUsedNotesRef = useRef(false);
  const shownNudgeStatesRef = useRef<Set<string>>(new Set());
  const countedNudgeCuesRef = useRef<Set<number>>(new Set());
  const nudgeCueIdRef = useRef(0);
  const saveCurrentProgressRef = useRef<() => void>(() => {});
  const hasMadeMistakeRef = useRef<() => boolean>(() => false);
  const currentHintCandidateProgressRef = useRef<HintCandidateProgress | null>(null);
  const lastLifecycleSaveAtRef = useRef(0);
  const gameFinishedRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const hintUpdatePulseTimerRef = useRef<number | null>(null);
  const isGuardActive = purchasedSkills.includes('skill-scribe');
  
  // Timer hook
  const { timer, setTimer } = useGameTimer(
      settings,
      isPaused,
      isCompleted,
      isEnding,
      isSettingsOpen || isHintTheaterOpen,
      0
  );

  const saveProgress = (
      currentBoard: Board,
      scanUsesVal?: number,
      _revealUsesVal?: number,
      moveLog?: MoveLogEntry[],
      hasMadeMistake?: boolean,
      scanRefillsPurchasedVal?: number,
      scanAchievementElapsedSeconds?: number,
      hintCandidateProgressVal?: HintCandidateProgress | null,
  ) => {
      if (devHintState) return;
      if (gameFinishedRef.current || isCompleted || isEnding) return;
      // A fresh or fully reset board is not a resumable game. Avoid creating
      // Continue Game entries for merely opening a puzzle, and remove an old
      // in-progress snapshot when the player returns the board to its start.
      if (currentBoard.length !== 9) return;
      const candidateProgressToSave = hintCandidateProgressVal === undefined
          ? currentHintCandidateProgressRef.current
          : hintCandidateProgressVal;
      if (!hasPlayerBoardInput(currentBoard) && !candidateProgressToSave) {
          Storage.saveLevelScanEconomy(
              difficulty,
              levelId,
              scanUsesVal !== undefined ? scanUsesVal : scanUses,
              scanRefillsPurchasedVal !== undefined
                  ? scanRefillsPurchasedVal
                  : scanRefillsPurchased,
              scanAchievementElapsedSeconds,
          );
          return;
      }
      const progress = {
          levelId,
          difficulty,
          status: 'in-progress',
          timeElapsed: timer,
          boardState: currentBoard,
          moveLog: moveLog,
          lastPlayed: Date.now(),
          scanUses: scanUsesVal !== undefined ? scanUsesVal : scanUses,
          scanRefillsPurchased: scanRefillsPurchasedVal !== undefined
              ? scanRefillsPurchasedVal
              : scanRefillsPurchased,
          hasMadeMistake: hasMadeMistake ?? hasMadeMistakeRef.current(),
          hasUsedNotes: hasUsedNotesRef.current,
          hintCandidateProgress: candidateProgressToSave ?? undefined,
      } as const;

      if (scanAchievementElapsedSeconds !== undefined) {
          Storage.saveScannedLevelProgress(progress, scanAchievementElapsedSeconds);
      } else {
          Storage.saveLevelProgress(progress);
      }
  };

  const handleSectionComplete = useCallback((sections: string[]) => {
      if (sections.length > 0) {
          // Play the minimalistic, addictive section complete sound
          sounds.playSectionComplete();

          // Generate unique IDs for each completed section so multiple triggers can occur/repeat instantly
          const uniqueSections = sections.map(s => `${s}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
          
          setAnimatingSections(prev => {
              const next = new Set(prev);
              uniqueSections.forEach(s => next.add(s));
              return next;
          });
          setTimeout(() => {
              setAnimatingSections(prev => {
                  const next = new Set(prev);
                  uniqueSections.forEach(s => next.delete(s));
                  return next;
              });
          }, 2000);
      }
  }, []);

  const pulseHintCandidateUpdates = useCallback((cells: Array<{ row: number; col: number }>) => {
      if (hintUpdatePulseTimerRef.current !== null) {
          window.clearTimeout(hintUpdatePulseTimerRef.current);
      }
      setHintUpdatedCells(new Set(cells.map(cell => `${cell.row}:${cell.col}`)));
      hintUpdatePulseTimerRef.current = window.setTimeout(() => {
          hintUpdatePulseTimerRef.current = null;
          setHintUpdatedCells(new Set());
      }, 1300);
  }, []);

  useEffect(() => () => {
      if (hintUpdatePulseTimerRef.current !== null) {
          window.clearTimeout(hintUpdatePulseTimerRef.current);
      }
  }, []);

  const dismissCurrentPill = useCallback(() => {
      if (!pillMessageRef.current) return;
      pillMessageRef.current = null;
      isPillExitingRef.current = true;
      setPillMessage(null);
  }, []);

  const enqueuePill = useCallback((message: Omit<PillMessage, 'id'>, deduplicate = false) => {
      if (settings.pillNotifications === false) return;
      const isSameMessage = (candidate: PillMessage) => candidate.type === message.type && candidate.text === message.text;
      if (deduplicate && pillMessageRef.current && isSameMessage(pillMessageRef.current)) return;
      if (deduplicate && pendingPillRef.current && isSameMessage(pendingPillRef.current)) return;

      pillMessageIdRef.current += 1;
      const nextMessage = { ...message, id: pillMessageIdRef.current };

      // Keep at most one pending notification. A new action replaces anything
      // that has not appeared yet, so feedback can never build up into a queue.
      if (pillMessageRef.current || isPillExitingRef.current) {
          pendingPillRef.current = nextMessage;
          dismissCurrentPill();
          return;
      }

      pillMessageRef.current = nextMessage;
      setPillMessage(nextMessage);
  }, [dismissCurrentPill, settings.pillNotifications]);

  useEffect(() => {
      if (settings.pillNotifications !== false) return;
      pendingPillRef.current = null;
      pillMessageRef.current = null;
      isPillExitingRef.current = false;
      setPillMessage(null);
  }, [settings.pillNotifications]);

  useEffect(() => {
      if (!pillMessage) return;
      // The completion message can remain behind the dimmed win modal. It is
      // cleared naturally when the player leaves this completed game screen.
      if (pillMessage.type === 'complete') return;
      const displayTimer = window.setTimeout(() => {
          if (pillMessageRef.current?.id === pillMessage.id) {
              dismissCurrentPill();
          }
      }, 300 + pillMessage.holdMs);
      return () => window.clearTimeout(displayTimer);
  }, [dismissCurrentPill, pillMessage]);

  const handlePillExitComplete = useCallback(() => {
      isPillExitingRef.current = false;
      const nextMessage = pendingPillRef.current;
      pendingPillRef.current = null;
      if (!nextMessage || settings.pillNotifications === false) return;

      pillMessageRef.current = nextMessage;
      setPillMessage(nextMessage);
  }, [settings.pillNotifications]);

  const handleScanResult = useCallback((hasErrors: boolean) => {
      const deck = hasErrors ? scanErrorDeckRef.current : scanCleanDeckRef.current;
      const indexRef = hasErrors ? scanErrorIndexRef : scanCleanIndexRef;
      const text = deck[indexRef.current % deck.length];
      indexRef.current = (indexRef.current + 1) % deck.length;
      enqueuePill({ text, type: hasErrors ? 'scan-error' : 'scan-clean', holdMs: 2500 });
  }, [enqueuePill]);

  useEffect(() => {
      pendingPillRef.current = null;
      pillMessageRef.current = null;
      isPillExitingRef.current = false;
      setPillMessage(null);
      halfwayShownRef.current = false;
  }, [difficulty, levelId]);

  useEffect(() => {
      if (settings.goodLuckMessage === false) return;
      const startMessageTimer = window.setTimeout(() => {
          const text = LEVEL_START_MESSAGES[Math.floor(Math.random() * LEVEL_START_MESSAGES.length)];
          enqueuePill({ text, type: 'start', holdMs: 1000 });
      }, 500);

      return () => {
          window.clearTimeout(startMessageTimer);
      };
  }, [difficulty, levelId, enqueuePill, settings.goodLuckMessage]);

  useEffect(() => {
      const isStrictMode = difficulty === Difficulty.Normal
          || difficulty === Difficulty.Hard
          || difficulty === Difficulty.Intense
          || difficulty === Difficulty.Impossible;
      const warningTimer = isStrictMode && settings.scanWarningNotifications !== false ? window.setTimeout(() => {
          enqueuePill({ text: 'Mistakes stay hidden.', type: 'warning', holdMs: 3000 });
      }, 2100) : null;

      return () => {
          if (warningTimer !== null) window.clearTimeout(warningTimer);
      };
  }, [difficulty, levelId, enqueuePill, settings.scanWarningNotifications]);

  const handleGameComplete = (completedBoard: Board, completedMoveLog: MoveLogEntry[], isPerfect: boolean) => {
      // This ref changes synchronously, unlike React state. It makes the win
      // atomic and rejects duplicate completion calls in the same render frame.
      if (gameFinishedRef.current || isCompleted || isEnding) return;
      gameFinishedRef.current = true;
      setActiveHint(null);
      setHintNotice(null);
      setIsEnding(true);
      // Let the final number render in its selected style first, then smoothly
      // settle every player-entered number into the completed-board color.
      window.setTimeout(() => setAreCompletionNumbersLocked(true), 150);
      sounds.playPuzzleVictory();
      
      // Clear selection and active numbers immediately
      setSelectedCell(null);
      setActiveNumber(null);
      
      let points = 0;
      switch(difficulty) {
          case Difficulty.SuperEasy: points = 5; break;
          case Difficulty.Easy: points = 10; break;
          case Difficulty.Normal: points = 15; break;
          case Difficulty.Hard: points = 20; break;
          case Difficulty.Intense: points = 30; break;
          case Difficulty.Impossible: points = 50; break;
      }

      // The local Hint preview is a fully playable sandbox. Let it reach the
      // normal completed state without awarding diamonds or changing the
      // player's real Hard-level progress, stats, or achievements.
      if (devHintState) {
          setEarnedPoints(0);
          window.setTimeout(() => {
              setIsEnding(false);
              setIsCompleted(true);
          }, 350);
          return;
      }
      
      setEarnedPoints(points);

      // A completed puzzle is one durable transaction. Diamonds, stats,
      // progress, achievements, and Pepino's pending gift must never split
      // across different local/cloud snapshots when iOS suspends the app.
      const completion = Storage.completePuzzle({
          progress: {
              levelId,
              difficulty,
              status: 'completed',
              timeElapsed: timer,
              boardState: completedBoard,
              moveLog: completedMoveLog,
              lastPlayed: Date.now(),
              scanUses,
              scanRefillsPurchased,
              hasUsedNotes: hasUsedNotesRef.current,
          },
          isPerfectGame: isPerfect,
          diamonds: points,
      });
      onPointsChanged(completion.data.points);
      
      if (settings.generateReplay) {
          // Pass true to indicate auto-generation
          generateReplay();
      }
      
      const completionText = completeDeckRef.current[completeIndexRef.current % completeDeckRef.current.length];
      completeIndexRef.current = (completeIndexRef.current + 1) % completeDeckRef.current.length;

      // The completion message always takes priority over any queued gameplay tip.
      if (settings.pillNotifications !== false) {
          pendingPillRef.current = null;
          pillMessageIdRef.current += 1;
          const completionMessage: PillMessage = {
              id: pillMessageIdRef.current,
              text: completionText,
              type: 'complete',
              holdMs: 1000
          };
          pillMessageRef.current = completionMessage;
          isPillExitingRef.current = false;
          setPillMessage(completionMessage);
      }

      window.setTimeout(() => {
          pendingPillRef.current = null;
          isPillExitingRef.current = false;
          setIsCompleted(true);
          onComplete();
      }, 2000);
  };

  const {
      board,
      setBoard,
      hintCandidateProgress,
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
      guardRejectedCell,
      conflicts,
      numberCounts,
      initializeBoard,
      handleCellClick,
      handleNumberInput,
      placeNumberAt,
      applyHintCandidateUpdate,
      handleUndo,
      handleErase,
      checkCompletion,
      hasMadeMistake
  } = useSudokuBoard({
      difficulty,
      levelId,
      settings,
      guardEnabled: isGuardActive,
      onComplete: handleGameComplete,
      onBoardChange: (newBoard, currentMoveLog, hasMadeMistake, candidateProgress, source) => {
          currentHintCandidateProgressRef.current = candidateProgress;
          if (source === 'player-note' && !hasUsedNotesRef.current) {
              hasUsedNotesRef.current = true;
          }
          saveProgress(
              newBoard,
              undefined,
              undefined,
              currentMoveLog,
              hasMadeMistake,
              undefined,
              undefined,
              candidateProgress,
          );
      },
      onSectionComplete: handleSectionComplete,
  });
  currentHintCandidateProgressRef.current = hintCandidateProgress;
  hasMadeMistakeRef.current = hasMadeMistake;

  // Switching input styles must also clear the numpad's selected digit.
  // Otherwise a Digit-First selection can remain highlighted while the
  // board has already returned to normal cell-first input behavior.
  useEffect(() => {
      setActiveNumber(null);
      setIsEraseMode(false);
  }, [settings.digitFirst, setActiveNumber]);

  const {
      scanUses,
      setScanUses,
      scanRefillsPurchased,
      setScanRefillsPurchased,
      isScanning,
      isScanSuccess,
      scanCooldown,
      cancelScan,
      handleScan,
  } = useGameSkills({
      board,
      setBoard,
      solvedBoard,
      moveLog,
      onSaveProgress: (b, s, r, ml, mistake, refills, scanElapsed) => (
          saveProgress(b, s, r, ml, mistake, refills, scanElapsed)
      ),
      onScanResult: handleScanResult,
      elapsedSeconds: timer,
      isGameLocked: () => gameFinishedRef.current,
  });

  useEffect(() => {
      if (activeHint || !shouldRestoreHintFocusRef.current) return;
      shouldRestoreHintFocusRef.current = false;
      const frame = window.requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>('[data-hint-button]')
              ?? document.querySelector<HTMLElement>('[aria-label="Back to levels"]');
          target?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
  }, [activeHint]);

  const closeHintUi = useCallback((restoreFocus = true) => {
      shouldRestoreHintFocusRef.current = restoreFocus;
      setActiveHint(null);
      setHintNotice(null);
      setIsHintPreparing(false);
      hintTransactionRef.current = false;
      // Keep the placement lock through the unmount. The next Hint resets it
      // when its fresh plan opens, preventing a rapid double-tap from reusing
      // the stale final-frame handler.
  }, []);

  const handleHintComplete = useCallback(() => {
      if (
          hintPlacementRef.current
          || gameFinishedRef.current
          || !activeHint
          || hintFrameIndex !== activeHint.plan.frames.length - 1
      ) return;
      if (activeHint.puzzleKey !== puzzleKey) {
          closeHintUi(false);
          return;
      }
      hintPlacementRef.current = true;

      const boardIsStillFrozen = boardHintPresentationSignature(board)
          === boardHintPresentationSignature(activeHint.board);
      if (!boardIsStillFrozen) {
          shouldRestoreHintFocusRef.current = true;
          setActiveHint(null);
          setHintFrameIndex(0);
          presentHintNotice({
              kind: 'error',
              message: 'The board changed. Tap Hint to try again.',
          });
          return;
      }

      if (activeHint.plan.outcome === 'candidate') {
          const nextProgress = applyHintCandidatePlan(
              board,
              solvedBoard,
              hintCandidateProgress,
              activeHint.plan,
          );
          const update = nextProgress
              ? applyHintCandidateUpdate(
                  activeHint.plan.noteUpdates,
                  nextProgress,
                  isPaused,
                  isCompleted || isEnding,
              )
              : { applied: false, updatedCells: [] };
          if (!update.applied) {
              shouldRestoreHintFocusRef.current = true;
              setActiveHint(null);
              setHintFrameIndex(0);
              presentHintNotice({
                  kind: 'error',
                  message: 'The candidates changed. Tap Hint to try again.',
              });
              return;
          }

          // Candidate updates are a real board action, just like placing a
          // number. Confirm the successful mutation with the active sound
          // pack and one medium haptic; stale/failed updates stay silent.
          sounds.playPlacementTap();
          pulseHintCandidateUpdates(update.updatedCells);
          setIsEraseMode(false);
          if (isFocusMode) {
              setIsFocusMode(false);
              enqueuePill({
                  text: 'Notes visible',
                  type: 'notes',
                  holdMs: 2500,
              }, true);
          }
          closeHintUi(true);
          return;
      }

      const { row, col, value } = activeHint.plan.target;
      const carriedProgress = activeHint.plan.candidateEliminations?.length
          ? applyHintCandidateProgress(
              board,
              solvedBoard,
              hintCandidateProgress,
              activeHint.plan,
          )
          : undefined;
      if (activeHint.plan.candidateEliminations?.length && !carriedProgress) {
          shouldRestoreHintFocusRef.current = true;
          setActiveHint(null);
          setHintFrameIndex(0);
          presentHintNotice({
              kind: 'error',
              message: 'The candidates changed. Tap Hint to try again.',
          });
          return;
      }
      const placed = placeNumberAt(
          row,
          col,
          value,
          isPaused,
          isCompleted || isEnding,
          carriedProgress ?? undefined,
      );
      if (!placed) {
          shouldRestoreHintFocusRef.current = true;
          setActiveHint(null);
          setHintFrameIndex(0);
          presentHintNotice({
              kind: 'error',
              message: 'The board changed. Tap Hint to try again.',
          });
          return;
      }

      setIsEraseMode(false);
      closeHintUi(true);
  }, [
      activeHint,
      board,
      closeHintUi,
      hintFrameIndex,
      isCompleted,
      isEnding,
      isPaused,
      applyHintCandidateUpdate,
      enqueuePill,
      hintCandidateProgress,
      isFocusMode,
      placeNumberAt,
      presentHintNotice,
      pulseHintCandidateUpdates,
      puzzleKey,
      solvedBoard,
  ]);

  const showPreparedHint = useCallback((prepared: PreparedHint) => {
      // Revalidate both the visible board and the logical plan immediately
      // before the atomic charge, even though Hint now opens with one tap.
      if (prepared.puzzleKey !== puzzleKey) {
          presentHintNotice({ kind: 'error', message: 'The puzzle changed. Tap Hint again.' });
          return;
      }
      if (boardHintPresentationSignature(board) !== prepared.signature) {
          presentHintNotice({ kind: 'error', message: 'The puzzle changed. Tap Hint again.' });
          return;
      }

      const freshResult = createHintPlan(board, solvedBoard, { candidateProgress: hintCandidateProgress });
      if (freshResult.status !== 'ready') {
          presentHintNotice({ kind: 'error', message: 'Hint could not open. Nothing was charged.' });
          return;
      }

      const samePlan = JSON.stringify(freshResult.plan) === JSON.stringify(prepared.plan);
      if (!samePlan) {
          presentHintNotice({ kind: 'error', message: 'A better move appeared. Tap Hint again.' });
          return;
      }

      if (!devHintState) {
          const consumption = Storage.consumeHint(difficulty, levelId, prepared.expectedHintsUsed);
          if (!consumption.success) {
              const economy = Storage.getHintEconomy(difficulty, levelId);
              setHintUses(economy.hintsUsed);
              presentHintNotice(consumption.reason === 'insufficient-points'
                  ? { kind: 'insufficient' }
                  : {
                      kind: 'error',
                      message: consumption.reason === 'stale'
                          ? 'The price changed. Check it and tap Hint again.'
                          : 'Hint could not open. Nothing was charged.',
                  });
              return;
          }

          setHintUses(consumption.hintsUsed);
          onPointsChanged(consumption.points);
      }

      setHintNotice(null);
      pendingPillRef.current = null;
      pillMessageRef.current = null;
      isPillExitingRef.current = false;
      setPillMessage(null);
      setNudgeCue(null);
      setHintFrameIndex(0);
      hintPlacementRef.current = false;
      setActiveHint({
          puzzleKey: prepared.puzzleKey,
          board: prepared.board,
          plan: freshResult.plan,
      });
  }, [board, devHintState, difficulty, hintCandidateProgress, levelId, onPointsChanged, presentHintNotice, puzzleKey, solvedBoard]);

  const handleHintRequest = useCallback(() => {
      if (
          hintTransactionRef.current
          || gameFinishedRef.current
          || isPaused
          || isCompleted
          || isEnding
          || isScanning
          || isHintTheaterOpen
          || board.length !== 9
          || solvedBoard.length !== 9
      ) return;

      hintTransactionRef.current = true;
      setHintNotice(null);
      setIsHintPreparing(true);
      sounds.playClick();

      try {
          const result = createHintPlan(board, solvedBoard, { candidateProgress: hintCandidateProgress });
          if (result.status === 'wrong-board') {
              presentHintNotice({
                  kind: 'wrong-board',
                  canUseScan: purchasedSkills.includes('skill-scan') && scanUses > 0,
              });
              return;
          }
          if (result.status === 'complete') {
              presentHintNotice({ kind: 'complete' });
              return;
          }
          if (result.status === 'unsupported') {
              presentHintNotice({ kind: 'unsupported' });
              return;
          }
          if (result.status !== 'ready') {
              presentHintNotice({
                  kind: 'error',
                  message: 'Hint could not open. Nothing was charged.',
              });
              return;
          }

          const prepared: PreparedHint = {
              puzzleKey,
              board: cloneHintBoard(board),
              plan: result.plan,
              signature: boardHintPresentationSignature(board),
              // Charge against the price the player actually saw. If cloud or
              // another session changed usage meanwhile, consumeHint rejects
              // this stale count and the player can confirm the refreshed price.
              expectedHintsUsed: devHintState ? 0 : hintUses,
          };

          showPreparedHint(prepared);
      } catch {
          presentHintNotice({
              kind: 'error',
              message: 'Hint could not open. Nothing was charged.',
          });
      } finally {
          setIsHintPreparing(false);
      }
  }, [
      board,
      devHintState,
      difficulty,
      isCompleted,
      isEnding,
      isHintTheaterOpen,
      isPaused,
      isScanning,
      hintUses,
      hintCandidateProgress,
      levelId,
      presentHintNotice,
      purchasedSkills,
      puzzleKey,
      scanUses,
      showPreparedHint,
      solvedBoard,
  ]);

  // Keep lifecycle listeners stable while always saving the latest render's
  // board, timer, move log, and remaining skill uses.
  saveCurrentProgressRef.current = () => {
      if (gameFinishedRef.current) return;
      saveProgress(board, scanUses, undefined, moveLog.current, undefined, scanRefillsPurchased);
  };

  useEffect(() => {
      let disposed = false;
      let nativeListener: { remove: () => Promise<void> } | undefined;

      const saveWhenInactive = () => {
          const now = Date.now();
          // iOS can emit both native and web lifecycle events for one change.
          if (now - lastLifecycleSaveAtRef.current < 500) return;
          lastLifecycleSaveAtRef.current = now;
          saveCurrentProgressRef.current();
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden') saveWhenInactive();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) saveWhenInactive();
      }).then((listener) => {
          if (disposed) void listener.remove();
          else nativeListener = listener;
      }).catch(() => {
          // The browser preview is covered by visibilitychange.
      });

      return () => {
          disposed = true;
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          if (nativeListener) void nativeListener.remove();
      };
  }, [difficulty, levelId]);

  useEffect(() => {
      halfwayTrackingReadyRef.current = false;
      notesReadyShownRef.current = false;
      gameFinishedRef.current = false;
      cancelScan();
      const progress = devHintState
          ? null
          : Storage.getLevelProgress(difficulty, levelId);
      if (devHintState) {
          hasUsedNotesRef.current = false;
          initializeBoard(
              cloneHintBoard(devHintState.board),
              undefined,
              false,
              devHintState.candidateProgress,
          );
          setTimer(0);
      } else if (progress && progress.status === 'in-progress' && progress.boardState) {
          hasUsedNotesRef.current = progress.hasUsedNotes !== undefined
              ? progress.hasUsedNotes
              : (
                  !progress.hintCandidateProgress
                  && progress.boardState.some(row => row.some(cell => (
                      !cell.isFixed && cell.notes.length > 0
                  )))
              );
          initializeBoard(
              progress.boardState,
              progress.moveLog,
              progress.hasMadeMistake,
              progress.hintCandidateProgress,
          );
          setTimer(progress.timeElapsed);
          
      } else {
          hasUsedNotesRef.current = false;
          initializeBoard();
          setTimer(0);
          
      }
      // Scan economy belongs to this puzzle attempt even when its board was
      // reset and therefore has no resumable board snapshot.
      setScanUses(progress?.scanUses ?? 3);
      setScanRefillsPurchased(progress?.scanRefillsPurchased ?? 0);
      setHintUses(devHintState ? 0 : Storage.getHintEconomy(difficulty, levelId).hintsUsed);
      setActiveHint(devHintState);
      setHintFrameIndex(0);
      setHintNotice(null);
      setIsHintPreparing(false);
      hintTransactionRef.current = false;
      hintPlacementRef.current = false;
      shouldRestoreHintFocusRef.current = false;
      setIsCompleted(false);
      setIsEnding(false);
      setAreCompletionNumbersLocked(false);
      setIsPaused(false);
      setIsFocusMode(false);
      setShowRestartConfirm(false);
      setReplayUrl(null);
      setShowReplay(false);
      setAnimatingSections(new Set());
      setHintUpdatedCells(new Set());

      const editableCells = initialBoardRef.current.flat().filter(cell => !cell.isFixed).length;
      const currentBoard = devHintState?.board ?? progress?.boardState ?? initialBoardRef.current;
      const filledEditableCells = currentBoard.flat().filter(cell => !cell.isFixed && cell.value !== null).length;
      halfwayShownRef.current = editableCells > 0 && filledEditableCells >= Math.ceil(editableCells / 2);
      
      setShowStartHint(true);
      const hintTimer = setTimeout(() => setShowStartHint(false), 5000);
      const trackingTimer = setTimeout(() => {
          halfwayTrackingReadyRef.current = true;
      }, 0);
      return () => {
          clearTimeout(hintTimer);
          clearTimeout(trackingTimer);
      };
  }, [difficulty, levelId, initializeBoard, setTimer, setScanUses, setScanRefillsPurchased, cancelScan, devHintState]);

  useEffect(() => {
      if (
          gameFinishedRef.current ||
          isEnding ||
          isCompleted ||
          !halfwayTrackingReadyRef.current ||
          halfwayShownRef.current ||
          board.length === 0
      ) return;
      const editableCells = initialBoardRef.current.flat().filter(cell => !cell.isFixed).length;
      const filledEditableCells = board.flat().filter(cell => !cell.isFixed && cell.value !== null).length;
      if (editableCells > 0 && filledEditableCells >= Math.ceil(editableCells / 2)) {
          halfwayShownRef.current = true;
          const deck = halfwayDeckRef.current;
          const text = deck[halfwayIndexRef.current % deck.length];
          halfwayIndexRef.current = (halfwayIndexRef.current + 1) % deck.length;
          enqueuePill({ text, type: 'halfway', holdMs: 2500 });
      }
  }, [board, enqueuePill, isCompleted, isEnding]);

  useEffect(() => {
      shownNudgeStatesRef.current.clear();
      countedNudgeCuesRef.current.clear();
      setNudgeCue(null);
  }, [difficulty, levelId]);

  useEffect(() => {
      setNudgeCue(null);
      if (
          !purchasedSkills.includes('skill-nudge') ||
          board.length !== 9 ||
          isPaused ||
          isCompleted ||
          isEnding ||
          isSettingsOpen ||
          isHintTheaterOpen
      ) return;

      const boardSignature = board
          .flat()
          .map(cell => cell.value ?? 0)
          .join('');
      if (shownNudgeStatesRef.current.has(boardSignature)) return;

      const qualifyingCells = new Map<string, {r: number, c: number, score: number}>();
      const addCell = (r: number, c: number) => {
          const key = `${r}-${c}`;
          const existing = qualifyingCells.get(key);
          qualifyingCells.set(key, { r, c, score: (existing?.score ?? 0) + 1 });
      };

      for (let index = 0; index < 9; index++) {
          const rowEmpty = board[index]
              .map((cell, c) => cell.value === null ? { r: index, c } : null)
              .filter((cell): cell is {r: number, c: number} => cell !== null);
          if (rowEmpty.length === 1) addCell(rowEmpty[0].r, rowEmpty[0].c);

          const colEmpty = board
              .map((row, r) => row[index].value === null ? { r, c: index } : null)
              .filter((cell): cell is {r: number, c: number} => cell !== null);
          if (colEmpty.length === 1) addCell(colEmpty[0].r, colEmpty[0].c);
      }

      for (let boxRow = 0; boxRow < 3; boxRow++) {
          for (let boxCol = 0; boxCol < 3; boxCol++) {
              const boxEmpty: {r: number, c: number}[] = [];
              for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
                  for (let colOffset = 0; colOffset < 3; colOffset++) {
                      const r = boxRow * 3 + rowOffset;
                      const c = boxCol * 3 + colOffset;
                      if (board[r][c].value === null) boxEmpty.push({ r, c });
                  }
              }
              if (boxEmpty.length === 1) addCell(boxEmpty[0].r, boxEmpty[0].c);
          }
      }

      const target = [...qualifyingCells.values()]
          .sort((a, b) => b.score - a.score || a.r - b.r || a.c - b.c)[0];
      if (!target) return;

      let clearTimer: number | undefined;
      const showTimer = window.setTimeout(() => {
          shownNudgeStatesRef.current.add(boardSignature);
          nudgeCueIdRef.current += 1;
          setNudgeCue({ r: target.r, c: target.c, key: nudgeCueIdRef.current });
          clearTimer = window.setTimeout(() => setNudgeCue(null), LIGHT_VISIBLE_MS);
      }, LIGHT_IDLE_DELAY_MS);

      return () => {
          window.clearTimeout(showTimer);
          if (clearTimer !== undefined) window.clearTimeout(clearTimer);
      };
  }, [board, purchasedSkills, isPaused, isCompleted, isEnding, isSettingsOpen, isHintTheaterOpen, nudgeActivityVersion]);

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
            generateReplayVideo(initialBoardRef.current, cleanMoves, difficulty, levelId, isDark, timer, settings.showTimer)
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
                  text: settings.showTimer
                      ? `I solved Level ${levelId} (${difficulty}) in ${formatTimeShort(timer)}!`
                      : `I solved Level ${levelId} (${difficulty})!`
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
      if (isRestarting) return;
      sounds.playClick();
      cancelScan();
      setIsRestarting(true);

      // Let the current attempt fade away before rebuilding the puzzle. A
      // manual restart is a completely fresh attempt, including its Scan
      // allowance and refill-price ladder. Previously spent diamonds remain
      // spent and are never refunded here.
      restartTimerRef.current = window.setTimeout(() => {
          if (!devHintState) Storage.clearLevelProgress(difficulty, levelId, true);
          setActiveHint(null);
          setHintFrameIndex(0);
          setHintNotice(null);
          setIsHintPreparing(false);
          hintTransactionRef.current = false;
          hintPlacementRef.current = false;
          shouldRestoreHintFocusRef.current = false;
          initializeBoard();
          setTimer(0);
          setScanUses(3);
          setScanRefillsPurchased(0);
          setShowRestartConfirm(false);
          setIsPaused(false);
          setIsFocusMode(false);
          setIsEraseMode(false);
          setAnimatingSections(new Set());
          setNudgeCue(null);
          gameFinishedRef.current = false;
          notesReadyShownRef.current = false;
          hasUsedNotesRef.current = false;
          shownNudgeStatesRef.current.clear();
          countedNudgeCuesRef.current.clear();
          halfwayShownRef.current = false;
          halfwayTrackingReadyRef.current = true;
          pendingPillRef.current = null;
          pillMessageRef.current = null;
          isPillExitingRef.current = false;
          setPillMessage(null);

          setShowStartHint(true);
          window.setTimeout(() => setShowStartHint(false), 5000);
          restartTimerRef.current = null;
          setIsRestarting(false);
      }, 800);
  };

  useEffect(() => () => {
      if (restartTimerRef.current !== null) {
          window.clearTimeout(restartTimerRef.current);
      }
  }, []);
  
  const handleDevSolve = () => {
      if (gameFinishedRef.current || isCompleted || isEnding) return;
      sounds.playPuzzleVictory();
      
      const newBoard = board.map((row, r) => row.map((cell, c) => ({
          ...cell,
          value: solvedBoard[r][c] as CellValue,
          notes: [],
          isError: false,
          isMarkedWrong: false
      })));
      
      setBoard(newBoard);
      
      // Since checkCompletion relies on state, and state update is async, 
      // we can manually trigger complete logic or assume checkCompletion handles it.
      // useSudokuBoard's checkCompletion uses the passed board argument, so it's safe.
      checkCompletion(newBoard);
  };
  
  const handleBackgroundClick = (e: React.MouseEvent) => {
      if (isHintTheaterOpen) return;
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
  const registerNudgeActivity = useCallback(() => {
      // Interaction postpones Light only while it is waiting to appear. Once
      // visible, its full display time is protected from ordinary touches.
      if (nudgeCue) return;
      setNudgeActivityVersion(current => current + 1);
  }, [nudgeCue]);

  const onCellClickWrapper = useCallback((e: React.MouseEvent, r: number, c: number) => {
      if (gameFinishedRef.current || isHintTheaterOpen || isScanning) return;
      if (
          nudgeCue?.r === r &&
          nudgeCue?.c === c &&
          !countedNudgeCuesRef.current.has(nudgeCue.key)
      ) {
          countedNudgeCuesRef.current.add(nudgeCue.key);
          if (!devHintState) Storage.recordNudgeCellClick();
      }
      setNudgeCue(current => current?.r === r && current?.c === c ? null : current);
      if (settings.digitFirst && isEraseMode) {
          handleErase(isPaused, isCompleted || isEnding, [r, c]);
          return;
      }
      handleCellClick(r, c, isPaused, isCompleted || isEnding);
  }, [handleCellClick, handleErase, isPaused, isCompleted, isEnding, settings.digitFirst, isEraseMode, nudgeCue, isHintTheaterOpen, isScanning]);

  const onCellLongPressWrapper = useCallback((r: number, c: number) => {
      if (gameFinishedRef.current || isHintTheaterOpen || isScanning || !settings.digitFirst || !isPencilMode || activeNumber === null) return;
      handleCellClick(r, c, isPaused, isCompleted || isEnding, true);
  }, [handleCellClick, isPaused, isCompleted, isEnding, settings.digitFirst, isPencilMode, activeNumber, isHintTheaterOpen, isScanning]);

  const onCellExploreWrapper = useCallback((r: number, c: number) => {
      if (gameFinishedRef.current || isHintTheaterOpen || isScanning || isPaused || isCompleted || isEnding) return;
      setSelectedCell([r, c]);
  }, [isPaused, isCompleted, isEnding, setSelectedCell, isHintTheaterOpen, isScanning]);

  const onNumberClickWrapper = useCallback((e: React.MouseEvent, n: number) => {
      if (gameFinishedRef.current || isHintTheaterOpen || isScanning) return;
      setIsEraseMode(false);
      handleNumberInput(n, isPaused, isCompleted || isEnding);
  }, [handleNumberInput, isPaused, isCompleted, isEnding, isHintTheaterOpen, isScanning]);

  const onNumberLongPressWrapper = useCallback((_e: React.MouseEvent, n: number) => {
      if (gameFinishedRef.current || isHintTheaterOpen || isScanning) return;
      handleNumberInput(n, isPaused, isCompleted || isEnding, true);
  }, [handleNumberInput, isPaused, isCompleted, isEnding, isHintTheaterOpen, isScanning]);

  const handleBackToLevels = () => {
      if (gameFinishedRef.current) return;
      const cancelledPendingScan = cancelScan();
      // A purchased refill is committed before its Scan animation starts.
      // When Back cancels that animation, keep the persisted, unconsumed use
      // instead of overwriting it with the pre-purchase React render.
      const persistedProgress = cancelledPendingScan && !devHintState
          ? Storage.getLevelProgress(difficulty, levelId)
          : null;
      // Board actions already save progress. This exit save also captures time
      // spent thinking since the player's last move without writing every second.
      saveProgress(
          board,
          persistedProgress?.scanUses ?? scanUses,
          undefined,
          moveLog.current,
          undefined,
          persistedProgress?.scanRefillsPurchased ?? scanRefillsPurchased,
      );
      onBack();
  };

  return (
    <>
      <AnimatePresence>
          {activeHint && (
              <motion.div
                  key="hint-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-[300] bg-stone-900/40 dark:bg-black/60 backdrop-blur-[2px]"
                  aria-hidden="true"
              />
          )}
      </AnimatePresence>

      <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex justify-center px-6 md:px-0 pt-4 md:pt-7 pb-4 md:pb-5 relative z-40 shrink-0"
          aria-hidden={isHintTheaterOpen || undefined}
      >
          <div className="w-full max-w-md md:max-w-[700px] flex items-center justify-between relative">
              {/* Left Column: Back Button */}
              <button onClick={handleBackToLevels} aria-label="Back to levels" className="p-2 md:p-2.5 rounded-full -ml-2 text-t-icon relative z-30 active:scale-95 transition">
                  <Icons.Back className="w-6 h-6 md:w-7 md:h-7" />
              </button>
              <div className="absolute left-8 md:left-10 z-30">
                  <DiamondBalancePill points={currentPoints} className="h-8 md:h-10 min-w-[68px] md:min-w-[76px] px-2.5 md:px-3" />
              </div>

              {/* Center Column: Title & Timer - Absolute Centered */}
              <div className="flex flex-col items-center absolute left-0 right-0 pointer-events-none z-20">
                  {settings.showTimer ? (
                      <span className="text-xl md:text-2xl font-bold text-t-primary tabular-nums leading-none">{formatTimeShort(timer)}</span>
                  ) : (
                      <span className="text-xl md:text-2xl font-bold text-t-primary leading-none">Level {levelId}</span>
                  )}
                  <span className="text-[10px] md:text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-widest mt-1 md:mt-1.5">
                    {difficulty} {settings.showTimer && `• ${levelId}`}
                  </span>
              </div>
              
              {/* Right Column: Actions */}
              <div className="flex items-center gap-1 relative z-30 -mr-2">
                  {settings.devAutoSolve && (
                      <button 
                          onClick={() => {
                              if (gameFinishedRef.current) return;
                              sounds.playClick();
                              handleDevSolve();
                          }}
                          className="p-2 md:p-2.5 rounded-full transition text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 active:scale-90"
                          title="Dev Auto Solve"
                      >
                          <Icons.Dev className="w-6 h-6 md:w-7 md:h-7" />
                      </button>
                  )}
                  <button onClick={() => {
                      if (gameFinishedRef.current || isHintTheaterOpen || isScanning) return;
                      sounds.playClick();
                      setIsPaused(true);
                  }} aria-label="Pause game" aria-disabled={isScanning || undefined} className="p-2 md:p-2.5 rounded-full transition text-t-icon active:scale-95">
                      <Icons.Pause className="w-6 h-6 md:w-7 md:h-7" />
                  </button>
                  <button onClick={() => {
                      if (gameFinishedRef.current || isHintTheaterOpen || isScanning) return;
                      sounds.playClick();
                      onSettingsOpen();
                  }} aria-label="Game settings" aria-disabled={isScanning || undefined} className="p-2 md:p-2.5 rounded-full transition text-t-icon active:scale-95">
                      <Icons.Settings className="w-6 h-6 md:w-7 md:h-7" />
                  </button>
              </div>
          </div>
      </motion.div>

      <div 
          className="flex-1 w-full flex flex-col items-center justify-start relative cursor-default" 
          onClick={handleBackgroundClick}
      >
         {/* Fixed notification slot prevents the Sudoku grid from shifting. */}
         <div className="w-full h-8 md:h-10 relative z-20" />

         <motion.div 
             initial={{ opacity: 0, scale: 0.96 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 0.5, delay: 0.08, type: "spring", stiffness: 100, damping: 15 }}
             className={`w-full flex justify-center relative overflow-visible ${activeHint ? 'z-[310]' : ''}`}
         >
            <AnimatePresence mode="wait" onExitComplete={handlePillExitComplete}>
                {pillMessage && !activeHint && (
                    <motion.div
                        key={pillMessage.id}
                        initial={{ y: 44, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 44, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="absolute inset-x-0 bottom-full h-[31px] md:h-10 z-0 pointer-events-none whitespace-nowrap flex items-center justify-center px-4"
                    >
                        <span className="text-[12px] md:text-[15px] font-semibold text-stone-600 dark:text-stone-100 bg-stone-50 dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700 px-[18px] md:px-[22px] py-[7px] md:py-[9px] rounded-full inline-flex items-center gap-[7px] md:gap-[9px] leading-none shadow-md dark:shadow-black/30">
                            {pillMessage.type === 'warning' ? (
                                <>
                                    <Icons.Info className="w-[15px] h-[15px] md:w-[18px] md:h-[18px] shrink-0 text-stone-500 dark:text-stone-300" />
                                    {pillMessage.text}
                                    <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                                        <Icons.Scan className="w-[15px] h-[15px] md:w-[18px] md:h-[18px] shrink-0 text-red-500" />
                                        Scan Recommended
                                    </span>
                                </>
                            ) : (
                                <>
                                    {pillMessage.type === 'scan-error' ? (
                                        <Icons.Close className="w-[15px] h-[15px] md:w-[18px] md:h-[18px] shrink-0 text-red-500" />
                                    ) : pillMessage.type === 'scan-clean' ? (
                                        <Icons.Check className="w-[15px] h-[15px] md:w-[18px] md:h-[18px] shrink-0 text-emerald-500" />
                                    ) : pillMessage.type === 'notes' ? (
                                        <Icons.Info className="w-[15px] h-[15px] md:w-[18px] md:h-[18px] shrink-0 text-stone-500 dark:text-stone-300" />
                                    ) : null}
                                    {pillMessage.text}
                                </>
                            )}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className="relative z-10 w-full flex justify-center"
                onPointerDown={activeHint ? undefined : registerNudgeActivity}
                aria-hidden={activeHint ? true : undefined}
            >
                <SudokuGrid
                    board={activeHint?.board ?? board}
                    selectedCell={activeHint ? null : selectedCell}
                    activeNumber={activeHint ? null : activeNumber}
                    conflicts={activeHint ? EMPTY_HINT_SET : conflicts}
                    guardRejectedCell={activeHint ? null : guardRejectedCell}
                    nudgeCue={activeHint ? null : nudgeCue}
                    isScanning={activeHint ? false : isScanning}
                    isScanSuccess={activeHint ? false : isScanSuccess}
                    animatingSections={activeHint ? EMPTY_HINT_SET : animatingSections}
                    settings={settings}
                    numberColor={activeHint ? 'text-stone-700 dark:text-stone-300' : numberColor}
                    onCellClick={onCellClickWrapper}
                    onCellExplore={onCellExploreWrapper}
                    enableDragExplore={!activeHint && !isScanning && !settings.digitFirst}
                    onCellLongPress={onCellLongPressWrapper}
                    enableCellLongPress={!activeHint && !isScanning && settings.digitFirst && isPencilMode && activeNumber !== null}
                    hideNotes={activeHint ? true : isFocusMode}
                    lockPlayerNumbers={activeHint ? true : areCompletionNumbersLocked}
                    interactive={!activeHint && !isScanning}
                    hintFrame={activeHint?.plan.frames[hintFrameIndex]}
                    hintUpdatedCells={activeHint ? EMPTY_HINT_SET : hintUpdatedCells}
                />
            </div>
         </motion.div>

         {activeHint && (
             <div
                 className="fixed inset-x-0 bottom-0 z-[320] w-full flex items-end justify-center pointer-events-none"
                 onClick={(event) => event.stopPropagation()}
             >
                 <div className="w-full flex justify-center pointer-events-auto">
                     <HintTheater
                         plan={activeHint.plan}
                         frameIndex={hintFrameIndex}
                         onFrameIndexChange={setHintFrameIndex}
                         onCompleteHint={handleHintComplete}
                     />
                 </div>
             </div>
         )}

         {/* Number Pad */}
         {!activeHint && (
         <motion.div 
             initial={{ opacity: 0, y: 15 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.45, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
             className="w-full max-w-[500px] md:max-w-[560px] px-2 md:px-0 mt-4 md:mt-5 relative z-[100]"
             onPointerDown={registerNudgeActivity}
             onClick={(e) => e.stopPropagation()}
         >
             <NumberPad 
                activeNumber={activeNumber}
                numberCounts={numberCounts}
                isPencilMode={isPencilMode}
                numberColor={numberColor}
                onNumberClick={onNumberClickWrapper}
                onNumberLongPress={onNumberLongPressWrapper}
             />
         </motion.div>
         )}

         {/* Game Controls - Increased spacing (mt-10) */}
         {!activeHint && (
         <motion.div 
             initial={{ opacity: 0, y: 15 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.45, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
             className="w-full max-w-md md:max-w-[540px] px-6 md:px-0 mt-10 md:mt-8 relative z-[100]"
             onClick={(e) => e.stopPropagation()}
         >
             <GameControls 
                 canUndo={history.length > 0}
                 canErase={settings.digitFirst || canErase}
                 isEraseMode={settings.digitFirst && isEraseMode}
                 isPencilMode={isPencilMode}
                 isFocusMode={isFocusMode}
                 onUndo={() => {
                     if (gameFinishedRef.current || isScanning) return;
                     handleUndo(isPaused, isCompleted || isEnding);
                 }}
                 onErase={() => {
                     if (gameFinishedRef.current || isScanning) return;
                     if (settings.digitFirst) {
                         sounds.playClick();
                         setIsEraseMode(current => !current);
                         setActiveNumber(null);
                         setSelectedCell(null);
                         return;
                     }
                     handleErase(isPaused, isCompleted || isEnding);
                 }}
                 onTogglePencil={() => {
                     if (gameFinishedRef.current || isEnding || isScanning) return;
                     sounds.playClick();
                     const nextPencilMode = !isPencilMode;
                     const isRevealingFocusedNotes = nextPencilMode && isFocusMode;
                     if (isRevealingFocusedNotes) {
                         setIsFocusMode(false);
                         enqueuePill({
                             text: 'Notes visible',
                             type: 'notes',
                             holdMs: 2500
                         }, true);
                     }
                     setIsPencilMode(nextPencilMode);
                     if (nextPencilMode && !isRevealingFocusedNotes && !notesReadyShownRef.current) {
                         notesReadyShownRef.current = true;
                         enqueuePill({
                             text: settings.digitFirst
                                 ? 'Long press a cell to place a number'
                                 : 'Long press a number to place it',
                             type: 'notes',
                             holdMs: 4000
                         });
                     }
                 }}
                 onToggleFocus={() => {
                     if (gameFinishedRef.current || isEnding || isScanning) return;
                     sounds.playClick();
                     const nextFocusMode = !isFocusMode;
                     setIsFocusMode(nextFocusMode);
                     if (nextFocusMode && isPencilMode) {
                         setIsPencilMode(false);
                     }
                     enqueuePill({
                         text: nextFocusMode ? 'Notes hidden' : 'Notes visible',
                         type: 'notes',
                         holdMs: 2500
                     }, true);
                 }}
                 purchasedSkills={purchasedSkills}
                 scanUses={scanUses}
                 scanRefillCost={getScanRefillCost(scanRefillsPurchased)}
                 currentPoints={currentPoints}
                 isScanning={isScanning}
                 scanCooldown={scanCooldown}
                 hintCost={devHintState ? 0 : getHintCost(hintUses)}
                 hintDisabled={
                     isPaused
                     || isCompleted
                     || isEnding
                     || isScanning
                     || isHintTheaterOpen
                     || board.length !== 9
                     || solvedBoard.length !== 9
                 }
                 isHintPreparing={isHintPreparing}
                 hintNotice={hintNotice}
                 onHintRequest={handleHintRequest}
                 onDismissHintNotice={dismissHintNotice}
                 onScan={() => {
                     if (gameFinishedRef.current) return;
                     handleScan(isPaused, isCompleted || isEnding);
                 }}
                 onPurchaseScanRefill={() => {
                     if (gameFinishedRef.current || isPaused || isCompleted || isEnding || scanUses > 0) return false;
                     if (devHintState) return false;
                     const result = Storage.purchaseScanRefill(difficulty, levelId);
                     if (!result.success) return false;

                     onPointsChanged(result.points);
                     setScanRefillsPurchased(result.scanRefillsPurchased);
                     sounds.playSelectionHaptic();
                     handleScan(
                         isPaused,
                         isCompleted || isEnding,
                         result.scanUses,
                         result.scanRefillsPurchased
                     );
                     return true;
                 }}
                 onDevSolve={settings.devAutoSolve ? handleDevSolve : undefined}
             />
         </motion.div>
         )}
         
         {/* Deselect Text - Increased spacing (mt-8) */}
         {!activeHint && (
         <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: showStartHint ? 1 : 0 }}
             transition={{ duration: 1, delay: 0.3 }}
             className="mt-8 mb-4 pointer-events-none"
         >
             <span className="text-xs font-light text-stone-500 dark:text-stone-400 tracking-wide">Tap here to deselect</span>
         </motion.div>
         )}
      </div>

      <AnimatePresence>
          {isRestarting && (
              <motion.div
                  key="restart-fade"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="fixed inset-0 z-[220] bg-t-bg"
                  aria-hidden="true"
              />
          )}
      </AnimatePresence>

      <AnimatePresence>
      {(isPaused || showRestartConfirm) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-200/90 dark:bg-stone-950/95 backdrop-blur-sm"
          >
              <div className="w-full max-w-[240px] md:max-w-[300px] flex flex-col items-center text-center relative z-10">
                  <AnimatePresence mode="wait">
                      {!showRestartConfirm ? (
                          <motion.div 
                            key="pause-menu"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="w-[240px] md:w-[300px] flex flex-col items-center rounded-[2rem] px-5 md:px-7 py-6 md:py-8 bg-white dark:bg-stone-900 shadow-xl"
                          >
                            {/* Smaller, cleaner title */}
                            <h2 className="text-2xl md:text-3xl font-bold text-stone-800 dark:text-stone-100 mb-6 md:mb-7 tracking-tight">Paused</h2>
                            
                            <div className="flex flex-col gap-3 w-full">
                                {/* Resume - Primary */}
                                <button onClick={() => { sounds.playClick(); setIsPaused(false); }} className="w-full h-14 bg-stone-800 dark:bg-blue-600 text-white rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2.5">
                                    <Icons.Play className="w-5 h-5 fill-current" /> Resume
                                </button>
                                
                                {/* Restart - Secondary (Subtle) */}
                                <button onClick={() => { sounds.playClick(); setShowRestartConfirm(true); }} className="w-full h-14 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-2xl font-bold text-base active:scale-95 transition-all flex items-center justify-center gap-2.5">
                                    <Icons.Reset className="w-5 h-5" /> Restart
                                </button>
                            </div>
                          </motion.div>
                      ) : (
                          <motion.div 
                            key="restart-confirm"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="w-[240px] md:w-[300px] flex flex-col items-center rounded-[2rem] px-5 md:px-7 py-6 md:py-8 bg-white dark:bg-stone-900 shadow-xl"
                          >
                             <div className="space-y-1 mb-5 w-full">
                                <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 leading-tight">Restart Level?</h3>
                                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Progress in this level will be lost.</p>
                             </div>
                             
                             <div className="flex flex-col gap-3 w-full">
                                 {/* Restart - Destructive */}
                                 <button disabled={isRestarting} onClick={handleRestart} className="w-full h-14 bg-red-500 text-white rounded-2xl font-bold text-base shadow-xl active:scale-95 transition-all flex items-center justify-center disabled:pointer-events-none">
                                    Restart
                                 </button>
                                 {/* Cancel */}
                                 <button onClick={() => { sounds.playClick(); setShowRestartConfirm(false); }} className="w-full h-14 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-2xl font-bold text-base active:scale-95 transition-all flex items-center justify-center">
                                    Cancel
                                 </button>
                             </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>
          </motion.div>
      )}
      </AnimatePresence>

      {isCompleted && (
          <WinModal 
              difficulty={difficulty}
              levelId={levelId}
              timer={timer}
              showTimer={settings.showTimer}
              points={earnedPoints}
              isGeneratingReplay={isGeneratingReplay}
              replayUrl={replayUrl}
              showReplay={showReplay}
              generateReplayEnabled={settings.generateReplay}
              onReplay={(e) => {
                  e.stopPropagation();
                  if (!devHintState) Storage.recordReplayWatch(`${difficulty}-${levelId}`);
                  setShowReplay(true);
              }}
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
