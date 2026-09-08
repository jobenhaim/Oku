/** Calendar arithmetic, not a 24-hour duration: local days can be 23 or 25 hours. */
export const nextLocalMidnight = (now: number): number => {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
};

export const getDailyGiftState = (nextClaimTime: number, now: number) => {
    const deadline = Number.isFinite(nextClaimTime) ? nextClaimTime : 0;
    const remaining = Math.max(0, deadline - now);
    const ready = remaining === 0;
    const minutes = Math.ceil(remaining / 60_000);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    const label = hours > 0 ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${minutes}m`;
    // Anchor the ring to the calendar day ending at the persisted deadline.
    const dayStart = new Date(deadline - 1);
    dayStart.setHours(0, 0, 0, 0);
    const dayLength = Math.max(1, deadline - dayStart.getTime());
    const progress = ready ? 1 : Math.max(0, Math.min(1, 1 - remaining / dayLength));
    return { ready, label, progress };
};

export const dailyGiftRefreshDelay = (nextClaimTime: number, now: number): number => (
    Math.max(1, Math.min(60_000 - (now % 60_000), nextClaimTime > now ? nextClaimTime - now : 60_000))
);
