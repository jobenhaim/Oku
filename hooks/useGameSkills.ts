
import React, { useState, useMemo, SetStateAction, Dispatch, useCallback } from 'react';
import { Board, Difficulty, CellValue, AppSettings, MoveLogEntry } from '../types';
import { sounds } from '../utils/sound';

interface UseGameSkillsProps {
    board: Board;
    setBoard: Dispatch<SetStateAction<Board>>;
    solvedBoard: number[][];
    setHistory: Dispatch<SetStateAction<Board[]>>;
    moveLog: React.MutableRefObject<MoveLogEntry[]>;
    selectedCell: [number, number] | null;
    activeNumber: number | null;
    settings: AppSettings;
    difficulty: Difficulty;
    removeNotesFromPeers: (board: Board, r: number, c: number, val: number) => void;
    checkCompletion: (board: Board) => void;
    onSaveProgress: (board: Board, scanUses?: number, revealUses?: number, moveLog?: MoveLogEntry[], autoUses?: number) => void;
    onSectionComplete?: (sections: string[]) => void;
    timer: number;
}

const checkSectionCompletion = (board: Board, solvedBoard: number[][], r: number, c: number) => {
    const sections: string[] = [];
    // Row
    if (board[r].every((cell, idx) => cell.value === solvedBoard[r][idx])) sections.push(`row_${r}:${r}_${c}`);
    // Col
    if (board.every((row, idx) => row[c].value === solvedBoard[idx][c])) sections.push(`col_${c}:${r}_${c}`);
    // Box
    const startR = Math.floor(r/3)*3;
    const startC = Math.floor(c/3)*3;
    const boxIdx = Math.floor(r/3)*3 + Math.floor(c/3);
    let boxOk = true;
    for(let i=0; i<3; i++) {
        for(let j=0; j<3; j++) {
            if(board[startR+i][startC+j].value !== solvedBoard[startR+i][startC+j]) {
                boxOk = false;
                break;
            }
        }
    }
    if (boxOk) sections.push(`box_${boxIdx}:${r}_${c}`);
    return sections;
};

export const useGameSkills = ({
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
    onSaveProgress,
    onSectionComplete,
    timer
}: UseGameSkillsProps) => {
    
    const [scanUses, setScanUses] = useState(3);
    const [isScanning, setIsScanning] = useState(false);
    const [scanCooldown, setScanCooldown] = useState(false);
    const [isScanSuccess, setIsScanSuccess] = useState(false);
    
    const [revealUses, setRevealUses] = useState(1);
    const [autoUses, setAutoUses] = useState(5);
    const [revealingCell, setRevealingCell] = useState<{r: number, c: number} | null>(null);
    
    const [animatingCell, setAnimatingCell] = useState<{r: number, c: number, value: number} | null>(null);

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

    const isAutoAvailable = useMemo(() => {
        if (autoUses <= 0) return false;
        if (!selectedCell || board.length === 0) return false;
        let r = selectedCell[0];
        let c = selectedCell[1];
        const cell = board[r][c];
        if (cell.value !== null || cell.isRevealed) return false;

        let rowCount = 0;
        for(let i=0; i<9; i++) if (board[r][i].value !== null) rowCount++;
        if (rowCount === 8) return true;

        let colCount = 0;
        for(let i=0; i<9; i++) if (board[i][c].value !== null) colCount++;
        if (colCount === 8) return true;

        let boxCount = 0;
        const startR = Math.floor(r/3)*3;
        const startC = Math.floor(c/3)*3;
        for(let i=0; i<3; i++)
            for(let j=0; j<3; j++)
                if (board[startR+i][startC+j].value !== null) boxCount++;
        if (boxCount === 8) return true;

        return false;
    }, [board, selectedCell, autoUses]);

    const handleAutoFill = (purchasedSkills: string[]) => {
        if (!purchasedSkills.includes('skill-auto') || !isAutoAvailable || autoUses <= 0 || !selectedCell || isScanning || revealingCell) return;
        sounds.playZap(); 
        const [r, c] = selectedCell;
        
        let valToFill: number | null = null;
        
        const getMissing = (values: (number | null)[]) => {
            const vals = new Set(values.filter(v => v !== null));
            for (let i = 1; i <= 9; i++) if (!vals.has(i)) return i;
            return null;
        };

        if (board[r].filter(cell => cell.value !== null).length === 8) {
            valToFill = getMissing(board[r].map(c => c.value));
        }
        if (valToFill === null) {
            const colVals = board.map(row => row[c].value);
            if (colVals.filter(v => v !== null).length === 8) {
                valToFill = getMissing(colVals);
            }
        }
        if (valToFill === null) {
            const startR = Math.floor(r/3)*3;
            const startC = Math.floor(c/3)*3;
            const boxVals = [];
            for(let i=0; i<3; i++) for(let j=0; j<3; j++) boxVals.push(board[startR+i][startC+j].value);
            if (boxVals.filter(v => v !== null).length === 8) {
                valToFill = getMissing(boxVals);
            }
        }

        if (valToFill === null) valToFill = solvedBoard[r][c];
        
        const val = valToFill as number;
        setAnimatingCell({ r, c, value: 1 });
        setHistory(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(board))]);
        const newBoard = board.map(row => [...row]);
        
        const isHarderDifficulty = difficulty === Difficulty.Hard || difficulty === Difficulty.Intense || difficulty === Difficulty.Impossible;
        const isCorrect = val === solvedBoard[r][c];

        newBoard[r][c] = {
            ...newBoard[r][c],
            value: val as any,
            notes: [],
            isError: !isHarderDifficulty ? !isCorrect : false,
            isMarkedWrong: false
        };
        
        moveLog.current.push({ r, c, v: val, t: Date.now() });

        if (settings.autoEraseNotes) {
             removeNotesFromPeers(newBoard, r, c, val);
        }
        
        setBoard(newBoard);
        
        setAutoUses(prev => {
            const next = prev - 1;
            onSaveProgress(newBoard, undefined, undefined, moveLog.current, next);
            return next;
        });
        
        const isFinishingMove = isBoardComplete(newBoard);
        if (!newBoard[r][c].isError && !isFinishingMove) {
            const completedSections = checkSectionCompletion(newBoard, solvedBoard, r, c);
            if (completedSections.length > 0 && onSectionComplete) onSectionComplete(completedSections);
        }

        const startTime = performance.now();
        const duration = 300; 
        const animate = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentVal = Math.floor(1 + (val - 1) * progress);
            setAnimatingCell({ r, c, value: currentVal });
            if (progress < 1) requestAnimationFrame(animate);
            else setAnimatingCell(null);
        };
        requestAnimationFrame(animate);
        checkCompletion(newBoard);
    };

    const handleScan = (isPaused: boolean, isCompleted: boolean) => {
        if (scanUses <= 0 || isScanning || scanCooldown || isPaused || isCompleted || revealingCell) return;
        setIsScanning(true);
        setScanCooldown(true);
        sounds.playScan();
        setTimeout(() => {
            let hasErrors = false;
            const newBoard = board.map(row => row.map(cell => {
                if (!cell.isFixed && cell.value !== null) {
                    const isCorrect = cell.value === solvedBoard[cell.row][cell.col];
                    if (!isCorrect) {
                        hasErrors = true;
                        return { ...cell, isMarkedWrong: true };
                    }
                }
                return cell;
            }));
            setBoard(newBoard);
            setIsScanning(false);
            setScanUses(prev => {
                const next = prev - 1;
                onSaveProgress(newBoard, next, undefined, moveLog.current, autoUses);
                return next;
            });
            setScanCooldown(false);

            if (!hasErrors) {
                setIsScanSuccess(true);
                sounds.playCheck();
                setTimeout(() => {
                    setIsScanSuccess(false);
                }, 1000);
            }
        }, 1200); 
    };

    const handleReveal = (isPaused: boolean, isCompleted: boolean) => {
        if (isPaused || isCompleted || revealingCell || isScanning) return;
        
        // 1 Minute Restriction for Reveal
        if (timer < 60) {
            sounds.playClick();
            return;
        }

        if (revealUses <= 0) {
            sounds.playClick();
            return;
        }

        const eligible = [];
        for(let r=0; r<9; r++) {
            for(let c=0; c<9; c++) {
                const cell = board[r][c];
                if (cell.value === null && !cell.isFixed && !cell.isRevealed) {
                    eligible.push({r, c});
                }
            }
        }
        if (eligible.length === 0) return;

        sounds.playReveal(); 
        const target = eligible[Math.floor(Math.random() * eligible.length)];
        setRevealingCell(target);

        setTimeout(() => {
            setHistory(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(board))]);
            const newBoard = board.map(row => [...row]);
            const correctVal = solvedBoard[target.r][target.c];

            newBoard[target.r][target.c] = {
                ...newBoard[target.r][target.c],
                value: correctVal as CellValue,
                notes: [],
                isFixed: false, 
                isRevealed: true, 
                isError: false,
                isMarkedWrong: false
            };
            
            moveLog.current.push({ r: target.r, c: target.c, v: correctVal, t: Date.now() });

            if (settings.autoEraseNotes) {
                 removeNotesFromPeers(newBoard, target.r, target.c, correctVal);
            }

            setBoard(newBoard);
            setRevealUses(prev => {
                const next = prev - 1;
                onSaveProgress(newBoard, undefined, next, moveLog.current, autoUses);
                return next;
            });

            const isFinishingMove = isBoardComplete(newBoard);
            if (!isFinishingMove) {
                const completedSections = checkSectionCompletion(newBoard, solvedBoard, target.r, target.c);
                if (completedSections.length > 0 && onSectionComplete) onSectionComplete(completedSections);
            }
            
            setTimeout(() => {
                setRevealingCell(null);
                checkCompletion(newBoard);
            }, 300); 
        }, 500); 
    };

    return {
        scanUses,
        setScanUses,
        isScanning,
        isScanSuccess,
        scanCooldown,
        revealUses,
        setRevealUses,
        autoUses,
        setAutoUses,
        revealingCell,
        setRevealingCell,
        animatingCell,
        setAnimatingCell,
        isAutoAvailable,
        handleAutoFill,
        handleScan,
        handleReveal
    };
};
