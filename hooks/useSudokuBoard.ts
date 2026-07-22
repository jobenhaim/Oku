
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Board, Difficulty, CellValue, AppSettings, MoveLogEntry } from '../types';
import { generateLevel } from '../utils/sudoku';
import { sounds } from '../utils/sound';

interface UseSudokuBoardProps {
  difficulty: Difficulty;
  levelId: number;
  settings: AppSettings;
  guardEnabled?: boolean;
  onBoardChange?: (board: Board, moveLog: MoveLogEntry[], hasMadeMistake: boolean) => void;
  onComplete?: (completedBoard: Board, moveLog: MoveLogEntry[], isPerfect: boolean) => void;
  onSectionComplete?: (sections: string[]) => void;
}

const checkSectionCompletion = (board: Board, solvedBoard: number[][], r: number, c: number, difficulty: Difficulty) => {
    const sections: string[] = [];
    const isStrictMode = difficulty === Difficulty.Hard || difficulty === Difficulty.Intense || difficulty === Difficulty.Impossible;
    const isCompleteCell = (value: CellValue, expected: number) => value !== null && (isStrictMode || value === expected);

    // Row
    if (board[r].every((cell, idx) => isCompleteCell(cell.value, solvedBoard[r][idx]))) sections.push(`row_${r}:${r}_${c}`);
    // Col
    if (board.every((row, idx) => isCompleteCell(row[c].value, solvedBoard[idx][c]))) sections.push(`col_${c}:${r}_${c}`);
    // Box
    const startR = Math.floor(r/3)*3;
    const startC = Math.floor(c/3)*3;
    const boxIdx = Math.floor(r/3)*3 + Math.floor(c/3);
    let boxOk = true;
    for(let i=0; i<3; i++) {
        for(let j=0; j<3; j++) {
            if(!isCompleteCell(board[startR+i][startC+j].value, solvedBoard[startR+i][startC+j])) {
                boxOk = false;
                break;
            }
        }
    }
    if (boxOk) sections.push(`box_${boxIdx}:${r}_${c}`);
    return sections;
};

const hasPeerConflict = (board: Board, row: number, col: number, value: number) => {
    for (let index = 0; index < 9; index++) {
        if (index !== col && board[row][index].value === value) return true;
        if (index !== row && board[index][col].value === value) return true;
    }

    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
        for (let colOffset = 0; colOffset < 3; colOffset++) {
            const peerRow = startRow + rowOffset;
            const peerCol = startCol + colOffset;
            if ((peerRow !== row || peerCol !== col) && board[peerRow][peerCol].value === value) return true;
        }
    }

    return false;
};

export const useSudokuBoard = ({
  difficulty,
  levelId,
  settings,
  guardEnabled = false,
  onBoardChange,
  onComplete,
  onSectionComplete
}: UseSudokuBoardProps) => {
  const [board, setBoard] = useState<Board>([]);
  const [solvedBoard, setSolvedBoard] = useState<number[][]>([]);
  const initialBoardRef = useRef<Board>([]);
  
  const [history, setHistory] = useState<Board[]>([]);
  const [isPencilMode, setIsPencilMode] = useState(false);
  
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [activeNumber, setActiveNumber] = useState<number | null>(null);
  const [guardRejectedCell, setGuardRejectedCell] = useState<{ row: number; col: number; key: number } | null>(null);

  const moveLog = useRef<MoveLogEntry[]>([]);
  const errorCountRef = useRef<number>(0);

  // Refs to always have the latest values of fast-changing states
  const boardRef = useRef(board);
  boardRef.current = board;

  const isPencilModeRef = useRef(isPencilMode);
  isPencilModeRef.current = isPencilMode;

  const activeNumberRef = useRef(activeNumber);
  activeNumberRef.current = activeNumber;

  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const guardEnabledRef = useRef(guardEnabled);
  guardEnabledRef.current = guardEnabled;

  const guardFeedbackTimerRef = useRef<number | null>(null);
  const showGuardRejection = useCallback((row: number, col: number) => {
      if (guardFeedbackTimerRef.current !== null) window.clearTimeout(guardFeedbackTimerRef.current);
      sounds.playSelectionHaptic();
      setGuardRejectedCell({ row, col, key: Date.now() });
      guardFeedbackTimerRef.current = window.setTimeout(() => {
          setGuardRejectedCell(null);
          guardFeedbackTimerRef.current = null;
      }, 320);
  }, []);

  useEffect(() => () => {
      if (guardFeedbackTimerRef.current !== null) window.clearTimeout(guardFeedbackTimerRef.current);
  }, []);
  
  const initializeBoard = useCallback((savedBoard?: Board, savedMoveLog?: MoveLogEntry[], savedHasMadeMistake = false) => {
    setHistory([]);
    setSelectedCell(null);
    setActiveNumber(null);
    errorCountRef.current = savedHasMadeMistake ? 1 : 0;
    
    if (savedMoveLog) {
        moveLog.current = savedMoveLog;
    } else {
        moveLog.current = [];
    }
    
    if (savedBoard) {
      setBoard(savedBoard);
      const { initial, solved } = generateLevel(difficulty, levelId);
      initialBoardRef.current = JSON.parse(JSON.stringify(initial));
      setSolvedBoard(solved);
    } else {
      const { initial, solved } = generateLevel(difficulty, levelId);
      initialBoardRef.current = JSON.parse(JSON.stringify(initial));
      setBoard(initial);
      setSolvedBoard(solved);
    }
  }, [difficulty, levelId]);

  const removeNotesFromPeers = useCallback((currentBoard: Board, r: number, c: number, val: number) => {
      for(let i=0; i<9; i++) {
         if (currentBoard[r][i].notes.includes(val)) {
             currentBoard[r][i].notes = currentBoard[r][i].notes.filter(n => n !== val);
         }
         if (currentBoard[i][c].notes.includes(val)) {
             currentBoard[i][c].notes = currentBoard[i][c].notes.filter(n => n !== val);
         }
      }
      const startR = Math.floor(r/3)*3;
      const startC = Math.floor(c/3)*3;
      for(let i=0; i<3; i++){
         for(let j=0; j<3; j++){
             const cell = currentBoard[startR+i][startC+j];
             if (cell.notes.includes(val)) {
                 cell.notes = cell.notes.filter(n => n !== val);
             }
         }
      }
  }, []);

  const isBoardComplete = useCallback((currentBoard: Board) => {
      if (solvedBoard.length === 0) return false;
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
      return filled === 81 && correct === 81;
  }, [solvedBoard]);

  const checkCompletion = useCallback((currentBoard: Board) => {
      if (isBoardComplete(currentBoard)) {
          if (onComplete) onComplete(currentBoard, moveLog.current, errorCountRef.current === 0);
      }
  }, [isBoardComplete, onComplete]);

  const hasMadeMistake = useCallback(() => errorCountRef.current > 0, []);

  // Memoize handlers using references to prevent any hook recreation
  const handleCellClick = useCallback((row: number, col: number, isPaused: boolean, isCompleted: boolean, forcePlace: boolean = false) => {
    if (isPaused || isCompleted) return;
    
    const currentBoard = boardRef.current;
    const currentIsPencilMode = isPencilModeRef.current;
    const currentActiveNumber = activeNumberRef.current;
    const currentSelectedCell = selectedCellRef.current;
    const currentSettings = settingsRef.current;

    if (currentSettings.digitFirst) {
        if (currentActiveNumber !== null) {
            const currentCell = currentBoard[row][col];
            if (currentCell.isFixed || currentCell.isRevealed) return;

            const shouldUsePencil = currentIsPencilMode && !forcePlace;
            const isAddingBlockedNote = shouldUsePencil
                && guardEnabledRef.current
                && !currentCell.notes.includes(currentActiveNumber)
                && hasPeerConflict(currentBoard, row, col, currentActiveNumber);
            if (isAddingBlockedNote) {
                showGuardRejection(row, col);
                return;
            }

            if (forcePlace) sounds.playNumber(currentActiveNumber);
            else sounds.playTap();
            
            setHistory(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(currentBoard))]);
            const newBoard = currentBoard.map(r => [...r]);
            const newCell = { ...newBoard[row][col] };
            newCell.isMarkedWrong = false;

            if (shouldUsePencil) {
                 if (newCell.notes.includes(currentActiveNumber)) {
                     newCell.notes = newCell.notes.filter(n => n !== currentActiveNumber);
                 } else {
                     newCell.notes = [...newCell.notes, currentActiveNumber].sort();
                 }
                 newBoard[row][col] = newCell;
            } else {
                 if (newCell.value === currentActiveNumber) {
                     newCell.value = null;
                     newCell.isError = false;
                     newBoard[row][col] = newCell;
                 } else {
                     const hasImmediateConflict = hasPeerConflict(currentBoard, row, col, currentActiveNumber);
                     newCell.value = currentActiveNumber as any;
                     newCell.notes = [];
                     
                     const isHarderDifficulty = difficulty === Difficulty.Hard || difficulty === Difficulty.Intense || difficulty === Difficulty.Impossible;
                     const isError = currentActiveNumber !== solvedBoard[row][col];
                     
                     if (!isHarderDifficulty) newCell.isError = isError;
                     else newCell.isError = false;
                     
                     if (isError) {
                         errorCountRef.current += 1;
                     }

                     newBoard[row][col] = newCell;

                     if (newCell.value) {
                        moveLog.current.push({ r: row, c: col, v: newCell.value, t: Date.now() });
                        
                        // Check if this move completes the whole board
                        const isFinishingMove = isBoardComplete(newBoard);
                        
                        // Only trigger section complete if NOT finishing the whole board
                        if (!newCell.isError && !isFinishingMove) {
                            const completedSections = checkSectionCompletion(newBoard, solvedBoard, row, col, difficulty);
                            if (completedSections.length > 0 && onSectionComplete) onSectionComplete(completedSections);
                        }
                     }

                     // A visibly invalid move is likely temporary. Preserve its peer notes
                     // so removing the red number restores the board naturally.
                     if (currentSettings.autoEraseNotes && !newCell.isError && !hasImmediateConflict) {
                         removeNotesFromPeers(newBoard, row, col, currentActiveNumber);
                     }
                 }
            }
            setBoard(newBoard);
            if (onBoardChange) onBoardChange(newBoard, moveLog.current, errorCountRef.current > 0);
            if (!shouldUsePencil && newCell.value) checkCompletion(newBoard);
        } else {
             sounds.playTap();
             if (currentSelectedCell && currentSelectedCell[0] === row && currentSelectedCell[1] === col) {
                 setSelectedCell(null);
             } else {
                 setSelectedCell([row, col]);
             }
        }
    } else {
        sounds.playTap();
        if (currentSelectedCell && currentSelectedCell[0] === row && currentSelectedCell[1] === col) {
            setSelectedCell(null);
        } else {
            setSelectedCell([row, col]);
        }
    }
  }, [difficulty, solvedBoard, onBoardChange, onComplete, onSectionComplete, removeNotesFromPeers, checkCompletion, isBoardComplete, showGuardRejection]);

  const handleNumberInput = useCallback((num: number, isPaused: boolean, isCompleted: boolean, forcePlace: boolean = false) => {
    if (isPaused || isCompleted) return;
    
    const currentBoard = boardRef.current;
    const currentIsPencilMode = isPencilModeRef.current;
    const currentActiveNumber = activeNumberRef.current;
    const currentSelectedCell = selectedCellRef.current;
    const currentSettings = settingsRef.current;

    if (currentSettings.digitFirst && !forcePlace) {
        sounds.playClick();
        if (currentActiveNumber === num) {
            setActiveNumber(null);
        } else {
            setActiveNumber(num);
            setSelectedCell(null);
        }
        return;
    }

    if (!currentSelectedCell) return;
    const [r, c] = currentSelectedCell;
    const currentCell = currentBoard[r][c];
    if (currentCell.isFixed || currentCell.isRevealed) return; 

    const shouldUsePencil = currentIsPencilMode && !forcePlace;
    const isAddingBlockedNote = shouldUsePencil
        && guardEnabledRef.current
        && !currentCell.notes.includes(num)
        && hasPeerConflict(currentBoard, r, c, num);
    if (isAddingBlockedNote) {
        showGuardRejection(r, c);
        return;
    }

    sounds.playNumber(num);

    setHistory(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(currentBoard))]);
    const newBoard = currentBoard.map(row => [...row]);
    const newCell = { ...newBoard[r][c] };

    newCell.isMarkedWrong = false;

    if (shouldUsePencil) {
      if (newCell.notes.includes(num)) newCell.notes = newCell.notes.filter(n => n !== num);
      else newCell.notes = [...newCell.notes, num].sort();
      newBoard[r][c] = newCell;
    } else {
      if (newCell.value === num) { 
          newCell.value = null; 
          newCell.isError = false; 
          newBoard[r][c] = newCell;
      } else {
        const hasImmediateConflict = hasPeerConflict(currentBoard, r, c, num);
        newCell.value = num as any;
        newCell.notes = [];
        const isHarderDifficulty = difficulty === Difficulty.Hard || difficulty === Difficulty.Intense || difficulty === Difficulty.Impossible;
        const isError = num !== solvedBoard[r][c];
        
        if (!isHarderDifficulty) newCell.isError = isError;
        else newCell.isError = false; 
        
        if (isError) {
             errorCountRef.current += 1;
        }
        
        newBoard[r][c] = newCell;

        if (newCell.value) {
            moveLog.current.push({ r, c, v: newCell.value, t: Date.now() });
            
            // Check if this move completes the whole board
            const isFinishingMove = isBoardComplete(newBoard);
            
            // Only trigger section complete if NOT finishing the whole board
            if (!newCell.isError && !isFinishingMove) {
                const completedSections = checkSectionCompletion(newBoard, solvedBoard, r, c, difficulty);
                if (completedSections.length > 0 && onSectionComplete) onSectionComplete(completedSections);
            }
        }

        // Hidden mistakes in strict modes still behave like ordinary paper entries,
        // but an immediately visible duplicate must not destroy useful notes.
        if (currentSettings.autoEraseNotes && !newCell.isError && !hasImmediateConflict) {
             removeNotesFromPeers(newBoard, r, c, num);
        }
      }
    }
    
    setBoard(newBoard);
    if (onBoardChange) onBoardChange(newBoard, moveLog.current, errorCountRef.current > 0);
    if (!shouldUsePencil && newCell.value) checkCompletion(newBoard);
  }, [difficulty, solvedBoard, onBoardChange, onComplete, onSectionComplete, removeNotesFromPeers, checkCompletion, isBoardComplete, showGuardRejection]);

  const handleUndo = useCallback((isPaused: boolean, isCompleted: boolean) => {
    if (isPaused || isCompleted) return;
    setHistory(prevHistory => {
        if (prevHistory.length === 0) return prevHistory;
        sounds.playClick();
        const previous = prevHistory[prevHistory.length - 1];
        setBoard(previous);
        if (onBoardChange) onBoardChange(previous, moveLog.current, errorCountRef.current > 0);
        return prevHistory.slice(0, -1);
    });
  }, [onBoardChange]);

  const handleErase = useCallback((isPaused: boolean, isCompleted: boolean) => {
    const currentSelectedCell = selectedCellRef.current;
    const currentBoard = boardRef.current;
    if (!currentSelectedCell || isPaused || isCompleted) return;
    sounds.playClick();
    const [r, c] = currentSelectedCell;
    const currentCell = currentBoard[r][c];
    if (currentCell.isFixed || currentCell.isRevealed) return; 

    setHistory(prev => [...prev, JSON.parse(JSON.stringify(currentBoard))]);
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[r][c].value = null; 
    newBoard[r][c].notes = []; 
    newBoard[r][c].isError = false;
    newBoard[r][c].isMarkedWrong = false; 
    setBoard(newBoard);
    if (onBoardChange) onBoardChange(newBoard, moveLog.current, errorCountRef.current > 0);
  }, [onBoardChange]);

  const conflicts = useMemo(() => {
      const conf = new Set<string>();
      if (board.length === 0) return conf;
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
      rows.forEach((rowMap, r) => rowMap.forEach((indices) => { if (indices.length > 1) indices.forEach(c => conf.add(`${r}-${c}`)); }));
      cols.forEach((colMap, c) => colMap.forEach((indices) => { if (indices.length > 1) indices.forEach(r => conf.add(`${r}-${c}`)); }));
      boxes.forEach((boxMap, b) => boxMap.forEach((indices) => { if (indices.length > 1) indices.forEach(flat => { const r = Math.floor(flat/9); const c = flat%9; conf.add(`${r}-${c}`); }); }));
      return conf;
  }, [board]);

  const numberCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    if (board.length === 0) return counts;
    board.forEach(row => row.forEach(cell => { if (cell.value !== null) counts[cell.value]++; }));
    return counts;
  }, [board]);

  return {
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
      guardRejectedCell,
      conflicts,
      numberCounts,
      initializeBoard,
      handleCellClick,
      handleNumberInput,
      handleUndo,
      handleErase,
      checkCompletion,
      hasMadeMistake,
      removeNotesFromPeers
  };
};
