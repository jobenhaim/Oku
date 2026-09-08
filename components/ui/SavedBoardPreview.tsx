import React from 'react';
import type { Board } from '../../types';

/** Decorative, read-only thumbnail. Only saved values are shown, never a solution. */
export const SavedBoardPreview: React.FC<{ board?: Board }> = ({ board }) => (
    <svg className="oku-saved-board-preview" viewBox="0 0 90 90" aria-hidden="true" focusable="false">
        <rect width="90" height="90" rx="3" fill="#fff" />
        {Array.from({ length: 81 }, (_, index) => {
            const row = Math.floor(index / 9);
            const col = index % 9;
            const cell = board?.[row]?.[col];
            if (!Number.isInteger(cell?.value) || !cell?.value || cell.value < 1 || cell.value > 9) return null;
            return <text key={index} x={col * 10 + 5} y={row * 10 + 7.6} textAnchor="middle"
                fill={cell.isFixed ? '#292524' : '#2563eb'} fontSize="7" fontWeight={cell.isFixed ? '600' : '500'}>{cell.value}</text>;
        })}
        {Array.from({ length: 8 }, (_, i) => {
            const position = (i + 1) * 10;
            const major = (i + 1) % 3 === 0;
            return <path key={position} d={`M${position} 0V90 M0 ${position}H90`} fill="none"
                stroke={major ? '#78716c' : '#d6d3d1'} strokeWidth={major ? '0.9' : '0.4'} />;
        })}
        <rect x="0.5" y="0.5" width="89" height="89" rx="2.5" fill="none" stroke="#78716c" strokeWidth="1" />
    </svg>
);
