import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['utils/appReview.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['@capacitor/core'] });
function harness(platform = 'ios', pluginAvailable = true) {
    const calls = [];
    let finish;
    let fail = false;
    const module = { exports: {} };
    runInNewContext(result.outputFiles[0].text, {
        module, exports: module.exports,
        console: { warn() {} },
        window: { open: (...args) => calls.push(['open', ...args]) },
        require: () => ({
            Capacitor: { getPlatform: () => platform, isPluginAvailable: () => pluginAvailable },
            registerPlugin: name => {
                assert.equal(name, 'OkuAppReview');
                return {
                    recordCompletion: async options => {
                        calls.push(['record', options.puzzleId]);
                        if (fail) throw new Error('unavailable');
                        await new Promise(resolve => { finish = resolve; });
                    },
                    requestIfEligible: async () => { calls.push(['request']); return { requested: true }; },
                    openReviewPage: async () => { calls.push(['nativeOpen']); },
                };
            },
        }),
    });
    return { api: module.exports.AppReview, calls, finish: () => finish(), fail: () => { fail = true; } };
}

const native = harness();
native.api.recordCompletion('Easy', 2);
const request = native.api.requestIfEligible(() => true);
await Promise.resolve();
assert.deepEqual(native.calls, [['record', 'Easy:2']], 'request must wait for completion persistence');
native.finish();
await request;
assert.deepEqual(native.calls.at(-1), ['request']);
await native.api.requestIfEligible(() => false);
assert.equal(native.calls.filter(([type]) => type === 'request').length, 1, 'navigation cancellation prevents a late popup');
await native.api.openReviewPage();
assert.deepEqual(native.calls.at(-1), ['nativeOpen']);

for (const [platform, available] of [['web', true], ['ios', false]]) {
    const web = harness(platform, available);
    web.api.recordCompletion('Easy', 1);
    await web.api.requestIfEligible(() => true);
    assert.equal(web.calls.length, 0, 'no native prompt when unavailable');
    await web.api.openReviewPage();
    assert.deepEqual(web.calls[0], ['open', 'https://apps.apple.com/app/id6757077544?action=write-review', '_blank', 'noopener,noreferrer']);
}
const failure = harness();
failure.fail();
failure.api.recordCompletion('Easy', 1);
await failure.api.requestIfEligible(() => false);
assert.equal(failure.calls.length, 1, 'plugin failures must not crash gameplay');

// Guard native persistence and eligibility, plus the victory-to-menu integration.
const swift = await readFile('ios/App/App/OkuNavigation.swift', 'utf8');
assert.match(swift, /registerPluginInstance\(reviewPlugin\)/);
assert.match(swift, /completed\.count < 2 && !completed\.contains\(puzzleId\)/);
assert.match(swift, /stringArray\(forKey: completedKey\) \?\? \[\]\)\.count >= 2/);
assert.match(swift, /120 \* 24 \* 60 \* 60/);
assert.match(swift, /lastRequest == 0 \|\| now - lastRequest >= cooldown/);
assert.match(swift, /scene\.activationState == \.foregroundActive/);
assert.ok(swift.indexOf('defaults.set(now, forKey: lastRequestKey)') < swift.indexOf('AppStore.requestReview(in: scene)'));
const app = await readFile('App.tsx', 'utf8');
assert.match(app, /onComplete=\{\(\) => \{\s*AppReview.recordCompletion\(selectedDifficulty, selectedLevel\)/);
assert.match(app, /screen !== 'levels' && screen !== 'difficulty'/);
assert.match(app, /tabNavigationBlocked \|\| isScreenTransitioning/);
assert.match(app, /cancelled = true; window.clearTimeout\(timer\)/);
const storage = await readFile('utils/storage.ts', 'utf8');
assert.doesNotMatch(storage, /oku\.review\./, 'review eligibility must not be reset with game progress');
console.log('App review bridge, cancellation, fallback, and native policy guards passed.');
