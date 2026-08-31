import React, {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
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
        scanRefillsPurchased?: number,
        scanAchievementElapsedSeconds?: number
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
    const scanTimerRef = useRef<number | null>(null);
    const scanSuccessTimerRef = useRef<number | null>(null);
    const scanRunTokenRef = useRef(0);
    const isMountedRef = useRef(true);
    const boardRef = useRef(board);
    const solvedBoardRef = useRef(solvedBoard);
    boardRef.current = board;
    solvedBoardRef.current = solvedBoard;

    const cancelScan = useCallback(() => {
        const hadPendingScan = scanTimerRef.current !== null;
        scanRunTokenRef.current += 1;
        if (scanTimerRef.current !== null) {
            window.clearTimeout(scanTimerRef.current);
            scanTimerRef.current = null;
        }
        if (scanSuccessTimerRef.current !== null) {
            window.clearTimeout(scanSuccessTimerRef.current);
            scanSuccessTimerRef.current = null;
        }
        if (!isMountedRef.current) return hadPendingScan;
        setIsScanning(false);
        setScanCooldown(false);
        setIsScanSuccess(false);
        return hadPendingScan;
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            scanRunTokenRef.current += 1;
            if (scanTimerRef.current !== null) {
                window.clearTimeout(scanTimerRef.current);
                scanTimerRef.current = null;
            }
            if (scanSuccessTimerRef.current !== null) {
                window.clearTimeout(scanSuccessTimerRef.current);
                scanSuccessTimerRef.current = null;
            }
        };
    }, []);

    const handleScan = (
        isPaused: boolean,
        isCompleted: boolean,
        availableUsesOverride?: number,
        refillCountOverride?: number
    ) => {
        const availableUses = availableUsesOverride ?? scanUses;
        if (
            availableUses <= 0
            || scanTimerRef.current !== null
            || isScanning
            || scanCooldown
            || isPaused
            || isCompleted
            || isGameLocked?.()
        ) return;
        const scanAchievementTime = elapsedSeconds;
        const runToken = scanRunTokenRef.current + 1;
        scanRunTokenRef.current = runToken;
        if (scanSuccessTimerRef.current !== null) {
            window.clearTimeout(scanSuccessTimerRef.current);
            scanSuccessTimerRef.current = null;
        }
        setIsScanSuccess(false);
        setIsScanning(true);
        setScanCooldown(true);
        sounds.playScan();
        scanTimerRef.current = window.setTimeout(() => {
            scanTimerRef.current = null;
            if (!isMountedRef.current || scanRunTokenRef.current !== runToken) return;
            // Completing the puzzle locks the board synchronously. A Scan that
            // began just before the final move must never overwrite that win
            // with a delayed in-progress save.
            if (isGameLocked?.()) {
                setIsScanning(false);
                setScanCooldown(false);
                return;
            }
            let hasErrors = false;
            // Read the current board at completion. In normal play input is
            // locked during the animation, but this also prevents a delayed
            // callback from restoring a stale render if another safe state
            // transition happened in the meantime.
            const currentBoard = boardRef.current;
            const currentSolution = solvedBoardRef.current;
            const newBoard = currentBoard.map(row => row.map(cell => {
                if (!cell.isFixed && cell.value !== null) {
                    const isCorrect = cell.value === currentSolution[cell.row][cell.col];
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
            onSaveProgress(
                newBoard,
                nextScanUses,
                undefined,
                moveLog.current,
                undefined,
                currentRefillCount,
                scanAchievementTime,
            );
            setScanCooldown(false);
            onScanResult?.(hasErrors);

            if (!hasErrors) {
                setIsScanSuccess(true);
                sounds.playCheck();
                scanSuccessTimerRef.current = window.setTimeout(() => {
                    scanSuccessTimerRef.current = null;
                    if (!isMountedRef.current || scanRunTokenRef.current !== runToken) return;
                    setIsScanSuccess(false);
                }, 1000);
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
        cancelScan,
        handleScan
    };
};
