import React, { Dispatch, SetStateAction, useState } from 'react';
import { Board, MoveLogEntry } from '../types';
import { sounds } from '../utils/sound';

interface UseGameSkillsProps {
    board: Board;
    setBoard: Dispatch<SetStateAction<Board>>;
    moveLog: React.MutableRefObject<MoveLogEntry[]>;
    onSaveProgress: (board: Board, scanUses?: number, revealUses?: number, moveLog?: MoveLogEntry[]) => void;
    onScanResult?: (hasErrors: boolean) => void;
    solvedBoard: number[][];
}

export const useGameSkills = ({
    board,
    setBoard,
    solvedBoard,
    moveLog,
    onSaveProgress,
    onScanResult
}: UseGameSkillsProps) => {
    const [scanUses, setScanUses] = useState(3);
    const [isScanning, setIsScanning] = useState(false);
    const [scanCooldown, setScanCooldown] = useState(false);
    const [isScanSuccess, setIsScanSuccess] = useState(false);

    const handleScan = (isPaused: boolean, isCompleted: boolean) => {
        if (scanUses <= 0 || isScanning || scanCooldown || isPaused || isCompleted) return;
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
            onSaveProgress(newBoard, nextScanUses, undefined, moveLog.current);
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
        handleScan
    };
};
