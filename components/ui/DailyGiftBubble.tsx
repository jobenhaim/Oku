import React, { useEffect, useState } from 'react';
import { DAILY_GIFT_REWARDS, getDailyGiftState, normalizeDailyGiftClaims } from '../../utils/dailyGift';
import { Icons } from './Icons';

type Props = {
    nextClaimTime: number;
    now: number;
    claims?: number;
    pressed: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const DailyGiftBubble: React.FC<Props> = ({ nextClaimTime, now, claims = 0, pressed, disabled, ...buttonProps }) => {
    const gift = getDailyGiftState(nextClaimTime, now);
    const count = normalizeDailyGiftClaims(claims);
    // Keep the just-claimed day visible during cooldown, including day 7.
    const day = gift.ready ? count % 7 : Math.max(0, count - 1) % 7;
    const reward = DAILY_GIFT_REWARDS[day];
    const animateEntry = gift.ready && day > 0;
    const entryKey = `${count}:${gift.ready}`;
    const [entry, setEntry] = useState({ key: entryKey, advanced: !animateEntry, arrived: !animateEntry });
    // New account data or midnight must not briefly reuse the prior day's gold state.
    const advanced = entry.key === entryKey ? entry.advanced : !animateEntry;
    const arrived = entry.key === entryKey ? entry.arrived : !animateEntry;

    useEffect(() => {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!animateEntry || reduceMotion) {
            setEntry({ key: entryKey, advanced: true, arrived: true });
            return;
        }
        setEntry({ key: entryKey, advanced: false, arrived: false });
        const start = window.setTimeout(() => setEntry({ key: entryKey, advanced: true, arrived: false }), 40);
        const finish = window.setTimeout(() => setEntry({ key: entryKey, advanced: true, arrived: true }), 540);
        return () => { window.clearTimeout(start); window.clearTimeout(finish); };
    }, [animateEntry, entryKey]);

    const litDay = gift.ready ? (arrived ? day : Math.max(0, day - 1)) : -1;
    const fillDay = gift.ready && !advanced ? Math.max(0, day - 1) : day;

    return (
        <div className={`oku-shop-daily-gift ${!gift.ready ? 'oku-shop-daily-gift--waiting' : ''}`}
            role="group" aria-label="Seven-day daily gifts">
            <div className="oku-gift-timeline">
                <span className="oku-gift-track" aria-hidden="true">
                    <span className="oku-gift-track-fill" style={{ width: `${fillDay / 6 * 100}%` }} />
                </span>
                <ol className="oku-gift-days" aria-label="Daily rewards">
                {DAILY_GIFT_REWARDS.map((amount, index) => {
                    const claimed = gift.ready ? index < day : count > 0 && index <= day;
                    return (
                        <li key={index} className={`oku-gift-day ${index === litDay ? 'oku-gift-day--active' : ''}`}
                            aria-current={gift.ready && index === day ? 'step' : undefined}
                            aria-label={`Day ${index + 1}: ${amount} diamonds${claimed ? ', claimed' : index === day && gift.ready ? ', available' : ', upcoming'}`}>
                            <span className="oku-gift-day-label">Day {index + 1}</span>
                            <span className={`oku-gift-milestone ${claimed && index !== litDay ? 'oku-gift-milestone--claimed' : ''}`} aria-hidden="true">
                                {claimed && index !== litDay ? <Icons.Check /> : <Icons.Diamond className="fill-current" />}
                            </span>
                            <span className="oku-gift-day-amount" aria-hidden="true">{amount}<Icons.Diamond className="fill-current" /></span>
                        </li>
                    );
                })}
                </ol>
            </div>
            <span className="oku-shop-gift-status">
                <button {...buttonProps} type="button" disabled={disabled || !gift.ready}
                    className={`oku-shop-gift-action ${gift.ready ? '' : 'oku-shop-gift-action--waiting'} ${pressed && gift.ready ? 'oku-shop-gift-action--pressed' : ''}`}
                    aria-label={gift.ready ? `Claim daily gift: ${reward} diamonds, day ${day + 1}` : `Daily gift available in ${gift.label}, at midnight`}
                    title={gift.ready ? `Claim ${reward} diamonds` : 'Next gift at local midnight'}>
                    {gift.ready ? <><span>Claim</span><span className="oku-gift-reward">+{reward}<Icons.Diamond className="fill-current" aria-hidden="true" /></span></>
                        : <span className="oku-shop-gift-countdown"><Icons.Clock className="oku-gift-clock" aria-hidden="true" /><span className="oku-gift-time">{gift.label}</span></span>}
                </button>
            </span>
        </div>
    );
};
