import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isMainTab, type MainTab } from '../utils/navigation';

interface NavigationState {
    selected: MainTab;
    visible: boolean;
    enabled: boolean;
    dark: boolean;
    shopBadge: boolean;
    profileBadge: boolean;
}
interface NativeNavigationPlugin {
    configure(state: NavigationState & { selectionId: number }): Promise<{ bottomInset: number; selectionId?: number }>;
    addListener(event: 'tabSelected', callback: (event: { tab: string; selectionId: number }) => void): Promise<PluginListenerHandle>;
    addListener(event: 'layoutChanged', callback: (event: { bottomInset: number }) => void): Promise<PluginListenerHandle>;
}
const NativeNavigation = registerPlugin<NativeNavigationPlugin>('OkuNavigation');

// Only observes insertion/removal of dialogs, never animation styles or game frames.
// Native controls sit outside the WebView, so CSS z-index cannot cover them.
export const useNavigationDialog = () => {
    const [blocked, setBlocked] = useState(false);
    useEffect(() => {
        const update = () => setBlocked(Boolean(
            document.querySelector('[aria-modal="true"], [data-navigation-blocking]') ||
            document.activeElement?.matches('input, textarea, [contenteditable="true"]')
        ));
        const observer = new MutationObserver(update);
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('focusin', update);
        document.addEventListener('focusout', update);
        update();
        return () => {
            observer.disconnect();
            document.removeEventListener('focusin', update);
            document.removeEventListener('focusout', update);
        };
    }, []);
    return blocked;
};

export const useNativeNavigation = (active: boolean, state: NavigationState, onSelect: (tab: MainTab) => void) => {
    const [native, setNative] = useState(false);
    const [bottomInset, setBottomInset] = useState(0);
    const callback = useRef(onSelect);
    callback.current = onSelect;
    const latestState = useRef(state);
    latestState.current = state;
    const [ready, setReady] = useState(false);
    const [selectionId, setSelectionId] = useState(0);
    const latestSelectionId = useRef(0);

    useEffect(() => {
        if (!active || Capacitor.getPlatform() !== 'ios' || !Capacitor.isPluginAvailable('OkuNavigation')) return;
        let disposed = false;
        const handles: PluginListenerHandle[] = [];
        const listen = async () => {
            try {
                const selection = await NativeNavigation.addListener('tabSelected', ({ tab, selectionId: incomingId }) => {
                    if (disposed || !Number.isSafeInteger(incomingId) || incomingId <= latestSelectionId.current) return;
                    latestSelectionId.current = incomingId;
                    if (latestState.current.visible && latestState.current.enabled && isMainTab(tab)) callback.current(tab);
                    // Always acknowledge, even when a dialog/transition rejected the tap.
                    // React batches this with the route update; native only reconciles a mismatch.
                    setSelectionId(incomingId);
                });
                if (disposed) { await selection.remove(); return; }
                handles.push(selection);
                const layout = await NativeNavigation.addListener('layoutChanged', ({ bottomInset: inset }) => {
                    if (!disposed && inset > 0) setBottomInset(inset);
                });
                if (disposed) { await layout.remove(); return; }
                handles.push(layout);
                setReady(true);
            } catch (error) { console.warn('Native navigation unavailable; using web navigation.', error); }
        };
        void listen();
        return () => {
            disposed = true;
            handles.forEach(handle => { void handle.remove(); });
            void NativeNavigation.configure({ ...latestState.current, selectionId: latestSelectionId.current, visible: false, enabled: false }).catch(() => {});
        };
    }, [active]);

    useEffect(() => {
        if (!ready) return;
        let disposed = false;
        void NativeNavigation.configure({ ...state, selectionId }).then(({ bottomInset: inset, selectionId: nativeSelectionId }) => {
            if (disposed) return;
            // The native controller survives a progress reset (React remount).
            // Catch up to its counter, then resend the current screen/visibility.
            // Never move backwards if a newer tap arrived while awaiting this reply.
            if (Number.isSafeInteger(nativeSelectionId) && nativeSelectionId! > latestSelectionId.current) {
                latestSelectionId.current = nativeSelectionId!;
                setSelectionId(nativeSelectionId!);
            }
            if (inset > 0) setBottomInset(inset);
            setNative(true);
        }).catch(error => {
            console.warn('Native navigation update failed.', error);
            // Do not render duplicate web controls after a native bar was established.
        });
        return () => { disposed = true; };
    }, [ready, selectionId, state.selected, state.visible, state.enabled, state.dark, state.shopBadge, state.profileBadge]);

    return { native, bottomInset };
};
