import React from 'react';
import { STATIC_BACKGROUNDS } from '../../utils/constants';
import { Icons } from './Icons';

// Decorative sample, deliberately independent of the player's board and game effects.
const SAMPLE_BOARD = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

export const ScenePreview = ({ scene }: { scene: typeof STATIC_BACKGROUNDS[number] }) => (
    <div role="img" aria-label={`${scene.name} scene preview with a sample Sudoku board and game controls`} className={`relative mx-auto w-[180px] overflow-hidden rounded-[20px] border border-black/10 p-3 ${scene.class}`}>
        <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: scene.id === 'bg-default' ? 'calc(var(--overlay-opacity) * 0.6)' : 'calc(var(--overlay-opacity) * 1.6)' }} />
        <div aria-hidden="true" className="relative text-t-primary pointer-events-none select-none">
            <div className="mb-4 flex items-center justify-between">
                <Icons.Back className="h-3 w-3" />
                <div className="text-center">
                    <div className="text-xs font-bold leading-none">04:28</div>
                    <div className="mt-1 text-[6px] font-semibold tracking-widest opacity-60">NORMAL · 12</div>
                </div>
                <Icons.Pause className="h-3 w-3" />
            </div>
            <div className="grid grid-cols-9 aspect-square overflow-hidden rounded-[5px] border-[1.5px] border-stone-800 bg-white text-stone-800">
                {Array.from(SAMPLE_BOARD, (digit, index) => (
                    <span key={index} className="flex items-center justify-center text-[10px] font-semibold leading-none" style={{
                        borderRight: index % 9 === 8 ? undefined : `${index % 3 === 2 ? '1px' : '0.5px'} solid ${index % 3 === 2 ? 'currentColor' : 'rgba(120,113,108,.3)'}`,
                        borderBottom: index >= 72 ? undefined : `${Math.floor(index / 9) % 3 === 2 ? '1px' : '0.5px'} solid ${Math.floor(index / 9) % 3 === 2 ? 'currentColor' : 'rgba(120,113,108,.3)'}`,
                    }}>{digit === '0' ? '' : digit}</span>
                ))}
            </div>
            <div className="my-3 flex justify-around">
                {[Icons.Pencil, Icons.Erase, Icons.Lightbulb].map((Icon, index) => (
                    <span key={index} className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-stone-800"><Icon className="h-3 w-3" /></span>
                ))}
            </div>
            <div className="grid grid-cols-9 gap-0.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => <span key={digit} className="rounded-[3px] bg-white text-stone-800 py-1 text-center text-[10px] font-bold">{digit}</span>)}
            </div>
        </div>
    </div>
);
