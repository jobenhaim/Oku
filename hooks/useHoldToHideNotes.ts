import { useEffect, useMemo, useState, type MouseEvent, type PointerEvent } from 'react';
import { createHoldNotesGesture } from '../utils/holdNotesGesture';
import { sounds } from '../utils/sound';

export function useHoldToHideNotes(disabled: boolean, puzzleKey: string) {
    const [hidden, setHidden] = useState(false);
    const gesture = useMemo(() => createHoldNotesGesture(
        setHidden,
        () => sounds.playNoteHoldHaptic(),
        () => sounds.playNoteHoldHaptic(),
    ), []);

    useEffect(() => {
        gesture.cancel();
        return gesture.cancel;
    }, [disabled, puzzleKey, gesture]);

    useEffect(() => {
        const end = (event: globalThis.PointerEvent) => gesture.end(event.pointerId);
        const cancel = (event: globalThis.PointerEvent) => {
            if (gesture.pointerId === event.pointerId) gesture.cancel();
        };
        const move = (event: globalThis.PointerEvent) => gesture.move(event.pointerId, event.clientX, event.clientY);
        const secondPointer = (event: globalThis.PointerEvent) => {
            if (gesture.pointerId !== null && event.pointerId !== gesture.pointerId) gesture.cancel();
        };
        const visibility = () => { if (document.hidden) gesture.cancel(); };
        window.addEventListener('pointerup', end, true);
        window.addEventListener('pointercancel', cancel, true);
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerdown', secondPointer, true);
        window.addEventListener('blur', gesture.cancel);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            window.removeEventListener('pointerup', end, true);
            window.removeEventListener('pointercancel', cancel, true);
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerdown', secondPointer, true);
            window.removeEventListener('blur', gesture.cancel);
            document.removeEventListener('visibilitychange', visibility);
            gesture.cancel();
        };
    }, [gesture]);

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        // Never intercept cell input, keypad long-press, or other controls.
        if (disabled || !event.isPrimary || event.button !== 0) return;
        if ((event.target as Element).closest('[data-no-note-hold], button, a, input, [role="button"]')) return;
        gesture.begin(event.pointerId, event.clientX, event.clientY);
        // Window listeners track release even outside the blank area, without
        // needing to transfer native touch capture to this wrapper.
    };

    const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
        if (event.detail > 0 && gesture.consumeClick()) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    return {
        notesHidden: hidden && !disabled,
        cancelNoteHold: gesture.cancel,
        noteHoldHandlers: {
            onPointerDown,
            onClickCapture,
            onContextMenu: (event: MouseEvent<HTMLDivElement>) => {
                if (gesture.pointerId !== null) event.preventDefault();
            },
        },
    };
}
