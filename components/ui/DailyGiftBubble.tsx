import React from 'react';
import { getDailyGiftState } from '../../utils/dailyGift';
import { Icons } from './Icons';

type Props = {
    nextClaimTime: number;
    now: number;
    pressed: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const DailyGiftBubble: React.FC<Props> = ({ nextClaimTime, now, pressed, disabled, ...buttonProps }) => {
    const gift = getDailyGiftState(nextClaimTime, now);
    return (
        <button {...buttonProps} type="button" disabled={disabled || !gift.ready}
            className={`oku-shop-daily-gift ${!gift.ready ? 'oku-shop-daily-gift--waiting' : ''}`}
            aria-label={gift.ready ? 'Claim daily gift: 10 diamonds' : `Daily gift available in ${gift.label}, at midnight`}
            title={gift.ready ? 'Claim 10 diamonds' : 'Next gift at local midnight'}>
            <span className="oku-shop-gift-icon" aria-hidden="true"><Icons.Gift className="w-6 h-6" /></span>
            <span className="oku-shop-gift-copy">
                <span className="oku-shop-gift-title">Daily gift</span>
            </span>
            <span className="oku-shop-gift-status">
            {gift.ready ? <span className={`oku-shop-gift-action ${pressed ? 'oku-shop-gift-action--pressed' : ''}`}>
                <span>Claim</span>
                <span className="oku-gift-reward">+10 <Icons.Diamond className="w-3 h-3 fill-current" aria-hidden="true" /></span>
            </span> : <span className="oku-shop-gift-countdown">
                <Icons.Clock className="oku-gift-clock w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="oku-gift-time">{gift.label}</span>
            </span>}
            </span>
        </button>
    );
};
