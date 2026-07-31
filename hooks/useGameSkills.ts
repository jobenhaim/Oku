import React, { Dispatch, SetStateAction, useState } from 'react';
import { Board, MoveLogEntry } from '../types';
import { sounds } from '../utils/sound';
import { Storage } from '../utils/storage';

interface UseGameSkillsProps {
    board: Board;
    setBoard: Dispatch<SetStateAction<Board>>;
    moveLog: React.MutableRefObject<MoveLogEntry[]>;
    onSaveProgress: (
        board: Board,
        scanUses?: number,
        revealUses?: number,
        moveLog?: MoveLogEntry[],
        hasMadeMistake?: boolean,
        scanRefillsPurchased?: number
    ) => void;
    onScanResult?: (hasErrors: boolean) => void;
    solvedBoard: number[][];
    elapsedSeconds: number;
    isGameLocked?: () => boolean;
}

export const useGameSkills = ({
    board,
    setBoard,
    solvedBoard,
    moveLog,
    onSaveProgress,
    onScanResult,
    elapsedSeconds,
    isGameLocked,
}: UseGameSkillsProps) => {
    const [scanUses, setScanUses] = useState(3);
    const [scanRefillsPurchased, setScanRefillsPurchased] = useState(0);
    const [isScanning, setIsScanning] = useState(false);
    const [scanCooldown, setScanCooldown] = useState(false);
    const [isScanSuccess, setIsScanSuccess] = useState(false);

    const handleScan = (
        isPaused: boolean,
        isCompleted: boolean,
        availableUsesOverride?: number,
        refillCountOverride?: number
    ) => {
        const availableUses = availableUsesOverride ?? scanUses;
        if (availableUses <= 0 || isScanning || scanCooldown || isPaused || isCompleted || isGameLocked?.()) return;
        const scanAchievementTime = elapsedSeconds;
        setIsScanning(true);
        setScanCooldown(true);
        sounds.playScan();
        window.setTimeout(() => {
            // Completing the puzzle locks the board synchronously. A Scan that
            // began just before the final move must never overwrite that win
            // with a delayed in-progress save.
            if (isGameLocked?.()) {
                setIsScanning(false);
                setScanCooldown(false);
                return;
            }
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
            const nextScanUses = Math.max(0, availableUses - 1);
            const currentRefillCount = refillCountOverride ?? scanRefillsPurchased;
            setIsScanning(false);
            setScanUses(nextScanUses);
            setScanRefillsPurchased(currentRefillCount);
            Storage.recordScanUse(scanAchievementTime);
            onSaveProgress(newBoard, nextScanUses, undefined, moveLog.current, undefined, currentRefillCount);
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
        scanRefillsPurchased,
        setScanRefillsPurchased,
        isScanning,
        isScanSuccess,
        scanCooldown,
        handleScan
    };
};
