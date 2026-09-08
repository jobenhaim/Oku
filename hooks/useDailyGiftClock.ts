import { useEffect, useState } from 'react';
import { dailyGiftRefreshDelay } from '../utils/dailyGift';

export const useDailyGiftClock = (nextClaimTime: number) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const refresh = () => {
            if (timer !== undefined) clearTimeout(timer);
            const time = Date.now();
            setNow(time);
            // No ticking while hidden or after the reward becomes available.
            if (!document.hidden && nextClaimTime > time) {
                timer = setTimeout(refresh, dailyGiftRefreshDelay(nextClaimTime, time));
            }
        };
        refresh();
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            if (timer !== undefined) clearTimeout(timer);
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [nextClaimTime]);
    return now;
};
