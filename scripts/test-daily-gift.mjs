import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
async function compile(entryPoint, overrides = {}) {
    const result = await build({ entryPoints: [entryPoint], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'] });
    const module = { exports: {} };
    runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require, Date, ...overrides });
    return module.exports;
}
const { nextLocalMidnight, getDailyGiftState, dailyGiftRefreshDelay } = await compile('utils/dailyGift.ts');
const originalTZ = process.env.TZ;
try {
    for (const zone of ['UTC', 'Asia/Jerusalem', 'America/New_York', 'Asia/Kolkata']) {
        process.env.TZ = zone;
        for (const date of ['2026-01-31T23:59:59', '2026-12-31T23:59:59', '2026-03-08T00:00:00', '2026-11-01T00:00:00']) {
            const now = new Date(date).getTime();
            const deadline = nextLocalMidnight(now);
            const midnight = new Date(deadline);
            assert.equal(midnight.getHours(), 0);
            assert.equal(midnight.getMinutes(), 0);
            assert.ok(deadline > now);
            assert.equal(getDailyGiftState(deadline, deadline - 1).ready, false);
            assert.equal(getDailyGiftState(deadline, deadline - 1).label, '1m');
            assert.equal(getDailyGiftState(deadline, deadline).ready, true);
            assert.equal(getDailyGiftState(deadline, deadline + 1).ready, true);
            assert.equal(getDailyGiftState(deadline, deadline).progress, 1);
        }
    }
    process.env.TZ = 'America/New_York';
    for (const [date, hours] of [['2026-03-08T00:00:00', 23], ['2026-11-01T00:00:00', 25]]) {
        const start = new Date(date).getTime();
        const end = nextLocalMidnight(start);
        assert.equal((end - start) / 3_600_000, hours);
        assert.equal(getDailyGiftState(end, start).progress, 0);
        assert.equal(getDailyGiftState(end, (start + end) / 2).progress, 0.5);
    }
} finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
}
const now = new Date('2026-09-08T20:30:00').getTime();
const deadline = nextLocalMidnight(now);
assert.equal(getDailyGiftState(deadline, now).label, '3h 30m');
assert.equal(getDailyGiftState(deadline, deadline - 42 * 60_000).label, '42m');
assert.equal(getDailyGiftState(deadline, deadline - 3_600_000).label, '1h');
assert.equal(getDailyGiftState(NaN, now).ready, true);
assert.equal(getDailyGiftState(0, now).ready, true);
assert.equal(dailyGiftRefreshDelay(deadline, deadline - 1), 1);
assert.ok(dailyGiftRefreshDelay(deadline, now + 123) <= 60_000);

const { DailyGiftBubble } = await compile('components/ui/DailyGiftBubble.tsx');
const renderGift = props => renderToStaticMarkup(React.createElement(DailyGiftBubble, { now, pressed: false, ...props }));
const ready = renderGift({ nextClaimTime: 0 });
assert.match(ready, /Claim daily gift: 10 diamonds/);
assert.match(ready, /\+10/);
assert.doesNotMatch(ready, /disabled=""|oku-gift-ring/);
const waiting = renderGift({ nextClaimTime: deadline });
assert.match(waiting, /disabled=""/);
assert.match(waiting, /3h 30m/);
assert.doesNotMatch(waiting, />left</);
assert.match(waiting, /oku-gift-clock/);
assert.doesNotMatch(waiting, /oku-gift-ring/);
assert.doesNotMatch(waiting, /\+10/);
assert.match(renderGift({ nextClaimTime: 0, disabled: true }), /disabled=""/);
const pressedGift = renderGift({ nextClaimTime: 0, pressed: true });
assert.doesNotMatch(pressedGift, /oku-shop-card-face--pressed/, 'Press feedback must not resize the whole gift card');
assert.match(pressedGift, /oku-shop-gift-action--pressed/);
assert.match(ready, /oku-shop-gift-status/);
assert.match(waiting, /oku-shop-gift-status/);

const { SavedBoardPreview } = await compile('components/ui/SavedBoardPreview.tsx');
const board = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => ({ row, col, value: null, isFixed: false, notes: [1, 2] })));
board[0][0].value = 5;
board[0][0].isFixed = true;
board[8][8].value = 9;
const before = JSON.stringify(board);
const preview = renderToStaticMarkup(React.createElement(SavedBoardPreview, { board }));
assert.equal((preview.match(/<text /g) || []).length, 2);
assert.match(preview, /fill="#292524"/);
assert.match(preview, /fill="#2563eb"/);
assert.match(preview, /aria-hidden="true"/);
assert.equal(JSON.stringify(board), before, 'Preview must never alter saved values or notes');
assert.doesNotMatch(renderToStaticMarkup(React.createElement(SavedBoardPreview)), /<text /);

// Exercise the hook with a fake clock and event targets, without touching app storage.
let effect, cleanup, time = now, currentNow;
let nextTimer = 0;
const timers = new Map();
const documentListeners = new Map();
const windowListeners = new Map();
const document = { hidden: false, addEventListener: (name, fn) => documentListeners.set(name, fn), removeEventListener: name => documentListeners.delete(name) };
const window = { addEventListener: (name, fn) => windowListeners.set(name, fn), removeEventListener: name => windowListeners.delete(name) };
const fakeReact = { useState: init => [init(), value => { currentNow = value; }], useEffect: fn => { effect = fn; } };
const hook = await compile('hooks/useDailyGiftClock.ts', {
    require: name => name === 'react' ? fakeReact : require(name),
    Date: { now: () => time }, document, window,
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
});
assert.equal(hook.useDailyGiftClock(deadline), now);
cleanup = effect();
assert.equal(timers.size, 1);
assert.ok([...timers.values()][0].delay <= 60_000);
document.hidden = true;
documentListeners.get('visibilitychange')();
assert.equal(timers.size, 0, 'Background countdown must not poll');
time = deadline;
document.hidden = false;
documentListeners.get('visibilitychange')();
assert.equal(currentNow, deadline, 'Returning after midnight refreshes immediately');
assert.equal(timers.size, 0, 'Ready gifts do not need a recurring timer');
cleanup();
assert.equal(documentListeners.size + windowListeners.size + timers.size, 0);
console.log('Daily gift: local midnight, DST, countdown, disabled/ready states, background cleanup, and saved-board preview passed.');
