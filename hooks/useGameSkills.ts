import React, { useEffect, useRef, useState, SetStateAction, Dispatch } from 'react';
import { Board, MoveLogEntry } from '../types';
import { sounds } from '../utils/sound';

export type ScribeResult = 'added' | 'blocked' | 'unchanged' | 'select-cell' | 'filled-cell';

interface UseGameSkillsProps {
    board: Board;
    setBoard: Dispatch<SetStateAction<Board>>;
    setHistory: Dispatch<SetStateAction<Board[]>>;
    moveLog: React.MutableRefObject<MoveLogEntry[]>;
    selectedCell: [number, number] | null;
    onSaveProgress: (board: Board, scanUses?: number, revealUses?: number, moveLog?: MoveLogEntry[], scribeUses?: number) => void;
    onScanResult?: (hasErrors: boolean) => void;
    onScribeResult?: (result: ScribeResult) => void;
    solvedBoard: number[][];
}

const candidatesForCell = (board: Board, row: number, col: number) => {
    const used = new Set<number>();

    board[row].forEach(cell => {
        if (cell.value !== null) used.add(cell.value);
    });
    board.forEach(currentRow => {
        const value = currentRow[col].value;
        if (value !== null) used.add(value);
    });

    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
            const value = board[r][c].value;
            if (value !== null) used.add(value);
        }
    }

    return Array.from({ length: 9 }, (_, index) => index + 1).filter(value => !used.has(value));
};

export const useGameSkills = ({
    board,
    setBoard,
    solvedBoard,
    setHistory,
    moveLog,
    selectedCell,
    onSaveProgress,
    onScanResult,
    onScribeResult
}: UseGameSkillsProps) => {
    const [scanUses, setScanUses] = useState(3);
    const [isScanning, setIsScanning] = useState(false);
    const [scanCooldown, setScanCooldown] = useState(false);
    const [isScanSuccess, setIsScanSuccess] = useState(false);

    const [scribeUses, setScribeUses] = useState(4);
    const [scribingCell, setScribingCell] = useState<{ r: number; c: number; key: number } | null>(null);
    const scribeTimersRef = useRef<number[]>([]);

    const scheduleScribe = (callback: () => void, delay: number) => {
        const timerId = window.setTimeout(callback, delay);
        scribeTimersRef.current.push(timerId);
    };

    useEffect(() => () => {
        scribeTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
        scribeTimersRef.current = [];
    }, []);

    const handleScribe = (purchasedSkills: string[], isPaused: boolean, isCompleted: boolean) => {
        if (!purchasedSkills.includes('skill-scribe') || isPaused || isCompleted || isScanning || scribingCell || scribeUses <= 0) return;

        if (!selectedCell) {
            sounds.playClick();
            onScribeResult?.('select-cell');
            return;
        }

        const [r, c] = selectedCell;
        const cell = board[r]?.[c];
        if (!cell || cell.isFixed || cell.isRevealed || cell.value !== null) {
            sounds.playClick();
            onScribeResult?.('filled-cell');
            return;
        }

        const candidates = candidatesForCell(board, r, c);
        if (candidates.length === 0) {
            sounds.playClick();
            onScribeResult?.('blocked');
            return;
        }

        const currentNotes = [...cell.notes].sort((a, b) => a - b);
        if (currentNotes.length === candidates.length && currentNotes.every((value, index) => value === candidates[index])) {
            sounds.playClick();
            onScribeResult?.('unchanged');
            return;
        }

        sounds.playScribe(candidates.length);
        const newBoard = board.map(row => row.map(currentCell => ({ ...currentCell, notes: [...currentCell.notes] })));
        newBoard[r][c] = { ...newBoard[r][c], notes: candidates, isMarkedWrong: false };

        setScribingCell({ r, c, key: Date.now() });
        const nextScribeUses = Math.max(0, scribeUses - 1);

        // Keep the cell genuinely empty until the scanner reaches the bottom.
        scheduleScribe(() => {
            setHistory(previous => [...previous.slice(-20), JSON.parse(JSON.stringify(board))]);
            setBoard(newBoard);
            setScribeUses(nextScribeUses);
            onSaveProgress(newBoard, undefined, undefined, moveLog.current, nextScribeUses);
        }, 360);

        const animationDuration = 360 + ((candidates.length - 1) * 45) + 180;
        scheduleScribe(() => onScribeResult?.('added'), animationDuration + 40);
        scheduleScribe(() => setScribingCell(null), animationDuration + 100);
    };

    const handleScan = (isPaused: boolean, isCompleted: boolean) => {
        if (scanUses <= 0 || isScanning || scanCooldown || isPaused || isCompleted || scribingCell) return;
        setIsScanning(true);
        setScanCooldown(true);
        sounds.playScan();
        window.setTimeout(() => {
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
            const nextScanUses = Math.max(0, scanUses - 1);
            setIsScanning(false);
            setScanUses(nextScanUses);
            onSaveProgress(newBoard, nextScanUses, undefined, moveLog.current, scribeUses);
            setScanCooldown(false);
            onScanResult?.(hasErrors);

            if (!hasErrors) {
                setIsScanSuccess(true);
                sounds.playCheck();
                window.setTimeout(() => setIsScanSuccess(false), 1000);
            }
        }, 1200);
    };

    return {
        scanUses,
        setScanUses,
        isScanning,
        isScanSuccess,
        scanCooldown,
        scribeUses,
        setScribeUses,
        scribingCell,
        handleScribe,
        handleScan
    };
};
