import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

const bundle = await build({ entryPoints: ['utils/holdNotesGesture.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createHoldNotesGesture, NOTE_HOLD_DELAY_MS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
assert.equal(NOTE_HOLD_DELAY_MS, 500, 'Hold must take exactly half a second');

// Browser timers reject a foreign receiver, unlike Node timers or fake clocks.
// Exercise the default timer path so an illegal invocation cannot regress.
const browserBundle = await build({ entryPoints: ['utils/holdNotesGesture.ts'], bundle: true, format: 'iife', globalName: 'HoldNotes', write: false });
let scheduled;
let cleared = false;
const browserGesture = runInNewContext(`${browserBundle.outputFiles[0].text}; HoldNotes.createHoldNotesGesture(() => {}, () => {}, () => {})`, {
    setTimeout: function (callback, delay) {
        assert.equal(this, undefined, 'Native timers must not receive the clock object');
        assert.equal(delay, 500);
        scheduled = callback;
        return 123;
    },
    clearTimeout: function (id) {
        assert.equal(this, undefined, 'Timer cancellation must not receive the clock object');
        assert.equal(id, 123);
        cleared = true;
    },
});
browserGesture.begin(1, 0, 0);
assert.equal(typeof scheduled, 'function');
browserGesture.end(1);
assert.equal(cleared, true);

let now = 0;
let nextId = 0;
const timers = new Map();
const clock = {
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
};
function advance(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) {
        if (timer.at <= now) { timers.delete(id); timer.callback(); }
    }
}
let hidden = false;
let haptics = 0;
let releaseHaptics = 0;
const gesture = createHoldNotesGesture(value => { hidden = value; }, () => haptics++, () => releaseHaptics++, clock);

// A normal tap continues to the existing deselect handler.
gesture.begin(1, 100, 600);
advance(150);
gesture.end(1);
advance(1000);
assert.equal(hidden, false);
assert.equal(haptics, 0);
assert.equal(releaseHaptics, 0, 'Quick taps must not play hold feedback');
assert.equal(gesture.consumeClick(), false);

// Hide only after the threshold, then restore immediately, without a click.
gesture.begin(2, 100, 600);
advance(NOTE_HOLD_DELAY_MS - 1);
assert.equal(hidden, false);
advance(1);
assert.equal(hidden, true);
assert.equal(haptics, 1);
advance(10000);
assert.equal(haptics, 1, 'No repeating timer or haptic while held');
gesture.end(99);
assert.equal(hidden, true, 'An unrelated pointer release must not end the hold');
assert.equal(releaseHaptics, 0);
gesture.end(2);
assert.equal(hidden, false);
assert.equal(releaseHaptics, 1, 'Restoring notes on release gives one gentle tick');
gesture.end(2);
assert.equal(releaseHaptics, 1, 'Duplicate release events stay silent');
assert.equal(gesture.consumeClick(), true, 'A held release must not deselect');
assert.equal(gesture.consumeClick(), false);

// Finger jitter is tolerated, but swiping cancels before activation.
gesture.begin(3, 0, 0);
gesture.move(3, 4, 4);
advance(200);
gesture.move(3, 20, 0);
advance(500);
assert.equal(hidden, false);
assert.equal(haptics, 1);
assert.equal(gesture.consumeClick(), true);

// Movement also restores an already-hidden board.
gesture.begin(4, 0, 0);
advance(NOTE_HOLD_DELAY_MS);
assert.equal(hidden, true);
gesture.move(4, 0, 20);
assert.equal(hidden, false);

// Pause, blur, pointer cancellation, multitouch, and unmount share cancellation.
gesture.begin(5, 0, 0);
advance(NOTE_HOLD_DELAY_MS);
assert.equal(hidden, true);
gesture.cancel();
assert.equal(hidden, false);
assert.equal(timers.size, 0);
gesture.begin(6, 0, 0);
advance(200);
gesture.cancel();
advance(500);
assert.equal(hidden, false);
assert.equal(timers.size, 0);

// A new tap must not inherit click suppression from an interrupted hold.
gesture.begin(7, 0, 0);
gesture.end(7);
assert.equal(gesture.consumeClick(), false);
assert.equal(gesture.pointerId, null);
assert.equal(releaseHaptics, 1, 'Movement, interruption, and quick taps do not play release feedback');
console.log('Hold-to-hide notes: timing, release, haptics, tap, drag, interruptions, and click suppression passed.');
