
import { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types';

export const useGameTimer = (
  settings: AppSettings,
  isPaused: boolean,
  isCompleted: boolean,
  isEnding: boolean,
  isSettingsOpen: boolean,
  initialTime: number = 0
) => {
  const [timer, setTimer] = useState(initialTime);
  const timerRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Screen Wake Lock
  useEffect(() => {
    const requestWakeLock = async () => {
        if (settings.screenWakeLock && 'wakeLock' in navigator && !isPaused && !isCompleted && !isEnding && !isSettingsOpen) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            } catch (err) {
                // Ignore errors
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            } catch (err) {
                // Ignore
            }
        }
    };

    if (settings.screenWakeLock && !isPaused && !isCompleted) {
        requestWakeLock();
    } else {
        releaseWakeLock();
    }

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && settings.screenWakeLock && !isPaused) {
            requestWakeLock();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
        releaseWakeLock();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.screenWakeLock, isPaused, isCompleted, isEnding, isSettingsOpen]);

  // Timer Interval
  useEffect(() => {
    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    };
    const stopTimer = () => { 
        if (timerRef.current) { 
            clearInterval(timerRef.current); 
            timerRef.current = null; 
        } 
    };

    if (!isPaused && !isCompleted && !isEnding && !isSettingsOpen) {
        startTimer();
    } else {
        stopTimer();
    }
    
    return () => stopTimer();
  }, [isPaused, isCompleted, isEnding, isSettingsOpen]);

  return { timer, setTimer };
};
