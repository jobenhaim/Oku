export const NOTE_HOLD_DELAY_MS = 500;
const MOVE_TOLERANCE_PX = 12;

// Presentation-only gesture: intentionally has no access to board or storage.
export function createHoldNotesGesture(
    onHiddenChange: (hidden: boolean) => void,
    onActivate: () => void,
    onRelease: () => void,
    // Native browser timers cannot be called with `clock` as their receiver.
    // Wrappers preserve their normal global invocation (including in WKWebView).
    clock = {
        setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
        clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
    },
) {
    let pointer: { id: number; x: number; y: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hidden = false;
    let suppressClick = false;

    const cancel = () => {
        if (timer !== null) clock.clearTimeout(timer);
        timer = null;
        pointer = null;
        if (hidden) onHiddenChange(false);
        hidden = false;
    };

    return {
        cancel,
        get pointerId() { return pointer?.id ?? null; },
        begin(id: number, x: number, y: number) {
            cancel();
            suppressClick = false;
            pointer = { id, x, y };
            timer = clock.setTimeout(() => {
                timer = null;
                if (!pointer) return;
                hidden = true;
                suppressClick = true;
                onHiddenChange(true);
                onActivate();
            }, NOTE_HOLD_DELAY_MS);
        },
        move(id: number, x: number, y: number) {
            if (pointer?.id !== id) return;
            if (Math.hypot(x - pointer.x, y - pointer.y) > MOVE_TOLERANCE_PX) {
                suppressClick = true;
                cancel();
            }
        },
        end(id: number) {
            if (pointer?.id !== id) return;
            const wasHidden = hidden;
            cancel();
            if (wasHidden) onRelease();
        },
        consumeClick() {
            const shouldSuppress = suppressClick;
            suppressClick = false;
            return shouldSuppress;
        },
    };
}
