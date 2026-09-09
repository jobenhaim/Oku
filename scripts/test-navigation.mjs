import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const compile = async (entryPoint, legacy = false, savedGame = null) => {
    const result = await build({ entryPoints: [entryPoint], bundle: true, platform: 'node', format: 'cjs', write: false,
        external: ['react', 'react-dom'], define: { 'import.meta.env.VITE_OKU_NAVIGATION': JSON.stringify(legacy ? 'legacy' : '') },
        plugins: [{ name: 'isolate-navigation', setup(builder) {
            builder.onResolve({ filter: /utils\/(storage|sound)$/ }, args => ({path: args.path, namespace: 'mock'}));
            builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path.endsWith('/sound') ?
                'export const sounds = { playClick(){} };' :
                `export const Storage = { getCompletedCount:()=>0, isPack2Unlocked:()=>false, isPack3Unlocked:()=>false, getLastPlayedGame:()=>(${JSON.stringify(savedGame)}) };`
            }));
        } }],
    });
    const module = { exports: {} };
    runInNewContext(result.outputFiles[0].text, {module, exports: module.exports, require, console, setTimeout, clearTimeout});
    return module.exports;
};
const policy = await compile('utils/navigation.ts');
assert.deepEqual([...policy.MAIN_TABS.map(tab => tab.label)], ['Play', 'Market', 'Oku Shop', 'Stats', 'Profile']);
assert.equal(policy.TABBED_NAVIGATION_ENABLED, true);
assert.equal((await compile('utils/navigation.ts', true)).TABBED_NAVIGATION_ENABLED, false);
for (const tab of policy.MAIN_TABS) assert.equal(policy.tabForScreen(tab.id), tab.id);
assert.equal(policy.tabForScreen('levels'), 'difficulty');
for (const hidden of ['game', 'splash', 'settings', 'unknown']) assert.equal(policy.tabForScreen(hidden), null);
const { BottomNavigation } = await compile('components/ui/BottomNavigation.tsx');
const { DiamondBalancePill } = await compile('components/ui/DiamondBalancePill.tsx');
for (const points of [0, 15715, 1000000]) {
    const balance = renderToStaticMarkup(React.createElement(DiamondBalancePill, { points }));
    assert.match(balance, /h-\[35px\] min-w-\[67\.5px\]/, 'Balance has one shared, 25% larger size across all screens');
    assert.match(balance, /text-\[13\.75px\]/);
    assert.match(balance, new RegExp(`aria-label="${points} diamonds"`));
    assert.doesNotMatch(balance, /md:h-|md:min-w-/);
}
for (const screen of ['components/SudokuGame.tsx', 'components/screens/DifficultyScreen.tsx']) {
    assert.doesNotMatch(readFileSync(screen, 'utf8'), /<DiamondBalancePill[^>]*className=/, 'Screens cannot override the shared balance dimensions');
}
for (const selected of policy.MAIN_TABS.map(tab => tab.id)) {
    const markup = renderToStaticMarkup(React.createElement(BottomNavigation, {selected, onSelect(){}, shopBadge:true, profileBadge:true}));
    assert.equal((markup.match(/<button\b/g) || []).length, 5);
    assert.equal((markup.match(/aria-current="page"/g) || []).length, 1);
    assert.equal((markup.match(/class="oku-navigation-badge"/g) || []).length, 2);
    assert.match(markup, /aria-label="Main navigation"/);
}
const { DifficultyScreen } = await compile('components/screens/DifficultyScreen.tsx');
const props = {points:1234, onDifficultySelect(){}, onOpenSettings(){}, onOpenProfile(){}, onOpenStore(){}, onOpenDiamondShop(){}, onClaimBonus(){}, onOpenStats(){}, nextBonusClaimTime:0};
const fresh = renderToStaticMarkup(React.createElement(DifficultyScreen, {...props, tabNavigation:true}));
assert.match(fresh, /oku-main-header/);
const homeLogo = fresh.match(/<div class="oku-home-logo[^"]*"[^>]*>/)?.[0];
assert.ok(homeLogo, 'Homepage displays the Oku logo');
assert.doesNotMatch(homeLogo, /opacity-0|animate-|animation/, 'Homepage logo must appear immediately without fading');
const appSource = readFileSync('App.tsx', 'utf8');
const homeFrame = appSource.slice(appSource.indexOf("{screen === 'difficulty' && ("), appSource.indexOf("{screen === 'diamondShop' && ("));
assert.doesNotMatch(homeFrame, /motion\.div|variants=|initial=/, 'Homepage controls must not inherit a screen entrance transition');
assert.match(fresh, /aria-label="Settings"/);
assert.doesNotMatch(fresh, /Claim daily gift|oku-shop-daily-gift/, 'Daily gift belongs in Oku Shop, not Play');
assert.doesNotMatch(fresh, />Market<|>Oku Shop<|>Stats<|aria-label="Profile/);
assert.equal((fresh.match(/oku-difficulty-card-tactile/g) || []).length, 6);
assert.doesNotMatch(fresh, /oku-continue-card|Continue playing/, 'No saved puzzle means no empty Continue card');
const savedGame = { difficulty: 'Impossible', levelId: 58, boardState: [[{ value: 7, isFixed: true }]] };
const { DifficultyScreen: SavedDifficultyScreen } = await compile('components/screens/DifficultyScreen.tsx', false, savedGame);
const withContinue = renderToStaticMarkup(React.createElement(SavedDifficultyScreen, {...props, tabNavigation:true}));
assert.match(withContinue, /aria-label="Continue playing Impossible, Level 58"/);
assert.match(withContinue, /oku-saved-board-preview/);
assert.equal((withContinue.match(/oku-difficulty-card-tactile/g) || []).length, 6);
assert.ok(withContinue.lastIndexOf('oku-difficulty-card-tactile') < withContinue.indexOf('oku-continue-card'));
assert.doesNotMatch(withContinue, /oku-shop-daily-gift/);
for (let count = 1; count <= 6; count++) {
    const difficulties = ['Super Easy','Easy','Normal','Hard','Intense','Impossible'];
    const markup = renderToStaticMarkup(React.createElement(DifficultyScreen, {...props, tabNavigation:true, hiddenDifficulties:difficulties.slice(count)}));
    assert.equal((markup.match(/oku-difficulty-card-tactile/g) || []).length, count);
}
const legacy = renderToStaticMarkup(React.createElement(DifficultyScreen, props));
assert.doesNotMatch(legacy.match(/<div class="[^"]*mt-6 md:mt-8 mb-2[^"]*"/)?.[0] ?? '', /animate-|opacity-0/, 'Legacy homepage controls also appear without an entrance animation');
assert.match(legacy, />Market</);
assert.match(legacy, />Oku Shop</);
const swift = readFileSync('ios/App/App/OkuNavigation.swift','utf8');
assert.match(swift, /UITabBarController, UITabBarControllerDelegate/);
assert.match(swift, /final class OkuRootViewController: UIViewController/);
assert.equal((swift.match(/addChild\(appBridge\)/g) || []).length, 1, 'The WebView is mounted exactly once');
assert.doesNotMatch(swift, /attachBridge|removeFromSuperview|removeFromParent/, 'Tab changes must never detach the WebView');
assert.match(swift, /navigationOverlay\.addSubview\(navigationShell\.view\)/);
assert.match(swift, /guard navigationVisible, let tabBar, !tabBar\.isHidden else \{ return false \}/);
assert.match(swift, /tabBar\.point\(inside: convert\(point, to: tabBar\), with: event\)/, 'Only the native bar intercepts touches');
assert.match(readFileSync('ios/App/App/AppDelegate.swift', 'utf8'), /OkuRootViewController\(appBridge: bridge\)/);
assert.match(swift, /registerPluginInstance\(navigationPlugin\)/);
assert.match(swift, /setTabBarHidden\(!visible, animated: false\)/);
assert.match(swift, /tabBarMinimizeBehavior = \.never/);
assert.doesNotMatch(swift, /performWithoutAnimation|view\.layoutIfNeeded\(\)/, 'Do not suppress or force layout through native selection animation');
assert.match(swift, /shouldSelect viewController: UIViewController\) -> Bool \{[\s\S]*?return navigationVisible && navigationEnabled/);
assert.match(swift, /didSelect viewController: UIViewController\) \{[\s\S]*?selectionId \+= 1[\s\S]*?notifyListeners\("tabSelected"/);
assert.match(swift, /guard acknowledgedSelectionId >= selectionId else \{ return \}/, 'Stale acknowledgements cannot undo a newer native tap');
assert.match(swift, /guard appliedVisibility != visible else \{ return \}/);
assert.match(readFileSync('App.tsx','utf8'), /const needsSettle = dir !== 'none'/, 'Ordinary tab switches must not disable native interaction');
assert.match(readFileSync('App.tsx','utf8'), /currentScreenRef\.current = nextScreen/, 'Rapid taps route against the latest requested screen');
assert.doesNotMatch(swift, /Timer\.|CADisplayLink|UIVisualEffectView|WKWebView\(/);
assert.match(readFileSync('App.tsx','utf8'), /!nativeNavigation.native && !tabNavigationBlocked/);
assert.doesNotMatch(readFileSync('App.tsx','utf8'), /marginBottom: navigationSpace/, 'The screen must not stop above the bar');
assert.match(readFileSync('App.tsx','utf8'), /'--oku-navigation-inset': navigationSpace/);
for (const screen of ['Difficulty', 'Levels', 'Store', 'DiamondShop', 'Stats', 'Profile']) {
    assert.match(readFileSync(`components/screens/${screen}Screen.tsx`, 'utf8'), /data-navigation-scroll/, `${screen} has reachable scroll content above the overlay`);
}
const css = readFileSync('index.css','utf8');
assert.match(readFileSync('App.tsx','utf8'), /shopBadge: pepinoState\.hasPendingGift \|\| hasDailyGift/, 'Native shop badge includes the free daily gift');
assert.match(readFileSync('App.tsx','utf8'), /shopBadge=\{pepinoState\.hasPendingGift \|\| hasDailyGift\}/, 'Browser shop badge includes the free daily gift');
const instantHome = renderToStaticMarkup(React.createElement(DifficultyScreen, {...props, tabNavigation:true, skipEntranceAnimation:true}));
assert.match(instantHome, /oku-home-instant/);
assert.doesNotMatch(instantHome, /disabled=""/, 'Returning to Play must not wait for its initial entrance animation');
assert.match(css, /\.oku-home-instant \.animate-fade-in-long \{ animation: none; opacity: 1; transform: none; \}/);
assert.match(css, /\.oku-navigation-overlay \[data-navigation-scroll\] \{\s*padding-bottom: calc\(var\(--oku-navigation-inset, 0px\) \+ 24px\)/);
assert.match(css, /\.oku-navigation-item\[aria-current="page"\] \{ color: #292524;/);
assert.match(swift, /UIColor\(red: 41 \/ 255, green: 37 \/ 255, blue: 36 \/ 255, alpha: 1\)/);
const modalLines = readFileSync('components/ui/Modals.tsx','utf8').split('\n').filter(line => line.includes('className=') && line.includes('fixed inset-0'));
assert.ok(modalLines.every(line => line.includes('data-navigation-blocking')), 'Every full-screen shared modal blocks native navigation');
const profileSource = readFileSync('components/screens/ProfileScreen.tsx', 'utf8');
const achievementListSource = profileSource.slice(profileSource.indexOf('const AchievementList:'), profileSource.indexOf('export const ProfileScreen:'));
assert.doesNotMatch(achievementListSource, /motion\.|animate-fade|layout="position"/, 'Achievements must not fade or spring into place when Profile opens');
assert.match(profileSource, /AnimatePresence initial=\{false\} custom=\{achievementCategoryDirection\}/, 'Category slides only run after an interaction, not on Profile entry');
assert.match(profileSource, /\{!hasAccountCard && \(/, 'Reserve the guest account subtitle during loading to avoid moving achievements');
assert.doesNotMatch(profileSource, /!hasAccountCard && !authLoading/, 'Account loading must not collapse the subtitle space');
assert.match(profileSource, /hasAccountCard \? 'h-11 md:h-12' : 'h-12 md:h-13'/, 'Loading and loaded account cards have matching heights');
assert.match(profileSource, /oku-profile-title-badge/);
assert.match(css, /animation: oku-profile-title-sweep/, 'Preserve the shiny title animation');
console.log('Navigation: five tabs, route visibility, badges, 1–6 difficulties, legacy rollback, native integration, and modal guards passed.');

// Exercise the real hook with deterministic React scheduling and a fake native bridge.
// Multiple callbacks can arrive before React commits: only the newest acknowledgement wins.
const slots = [];
let cursor = 0;
let rerender = true;
let effects = [];
const fakeReact = {
    useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], value => { slots[index] = value; rerender = true; }];
    },
    useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = {current: initial};
        return slots[index];
    },
    useEffect(callback, dependencies) {
        const index = cursor++;
        const previous = slots[index];
        if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
            effects.push(() => {
                previous?.cleanup?.();
                slots[index] = { dependencies, cleanup: callback() };
            });
        }
    },
};
const listeners = new Map();
const configurations = [];
let nativeCounter = 0;
let nativeVisible = false;
const bridge = {
    addListener: async (name, callback) => { listeners.set(name, callback); return {remove(){ listeners.delete(name); }}; },
    configure: async state => {
        configurations.push({...state});
        // Match Swift's stale-ack guard, including after a React-only reset.
        if (state.selectionId >= nativeCounter) nativeVisible = state.visible;
        return {bottomInset: nativeVisible ? 96 : 0, selectionId: nativeCounter};
    },
};
const hookBuild = await build({entryPoints:['hooks/useNativeNavigation.ts'], bundle:true, platform:'node', format:'cjs', write:false,
    external:['react','@capacitor/core'], define:{'import.meta.env.VITE_OKU_NAVIGATION': '""'}});
const hookModule = {exports:{}};
runInNewContext(hookBuild.outputFiles[0].text, {module:hookModule, exports:hookModule.exports, console,
    require: name => name === 'react' ? fakeReact : name === '@capacitor/core' ? {
        Capacitor:{getPlatform:()=> 'ios', isPluginAvailable:()=>true}, registerPlugin:()=>bridge,
    } : require(name)});
let state = {selected:'difficulty', visible:true, enabled:true, dark:false, shopBadge:false, profileBadge:false};
const received = [];
const settle = async () => {
    for (let tick = 0; tick < 12; tick++) {
        if (rerender) {
            rerender = false; cursor = 0;
            hookModule.exports.useNativeNavigation(true, state, tab => {received.push(tab); state = {...state, selected:tab}; rerender = true;});
            const pending = effects; effects = []; pending.forEach(effect => effect());
        }
        await Promise.resolve();
    }
};
await settle();
assert.equal(configurations.at(-1).selectionId, 0);
const select = (tab, selectionId) => {
    nativeCounter = Math.max(nativeCounter, selectionId);
    listeners.get('tabSelected')({tab, selectionId});
};
select('store', 1);
select('profile', 2);
await settle();
assert.equal(configurations.at(-1).selected, 'profile');
assert.equal(configurations.at(-1).selectionId, 2);
assert.equal(configurations.filter(config => config.selectionId === 1).length, 0);
const count = configurations.length;
select('store', 1); // Out-of-order delivery must not reroute or acknowledge an old selection.
await settle();
assert.equal(configurations.length, count);
state = {...state, visible:false, enabled:false}; rerender = true; await settle();
select('stats', 3); // Native tap raced with a modal: reconcile to the existing screen.
await settle();
assert.equal(configurations.at(-1).selectionId, 3);
assert.equal(configurations.at(-1).selected, 'profile');
assert.equal(configurations.at(-1).visible, false);
assert.deepEqual(received, ['store', 'profile']);
state = {...state, visible:true, enabled:true}; rerender = true; await settle();
select('difficulty', 4);
select('profile', 5); // Return to the original screen before React commits.
await settle();
assert.equal(configurations.at(-1).selected, 'profile');
assert.equal(configurations.at(-1).selectionId, 5);
select('profile', 6); // Reselect also needs an acknowledgement even without a route change.
await settle();
assert.equal(configurations.at(-1).selectionId, 6);
assert.equal(configurations.at(-1).enabled, true);
for (let reset = 0; reset < 2; reset++) {
    for (const slot of slots) slot?.cleanup?.();
    assert.equal(nativeVisible, false, 'Unmount hides the native bar');
    slots.length = 0;
    state = {...state, selected:'difficulty', visible:true, enabled:true};
    rerender = true;
    await settle();
    assert.equal(configurations.at(-1).selectionId, nativeCounter, 'Remount catches up to retained native counter');
    assert.equal(nativeVisible, true, 'Progress reset restores the bar without restarting the app');
    assert.equal(configurations.at(-1).selected, 'difficulty');
    select('store', nativeCounter + 1);
    await settle();
    assert.equal(configurations.at(-1).selected, 'store', 'Tabs still respond after reset');
}
assert.match(swift, /"selectionId": shell.selectionId/, 'Native replies report retained selection counter');
console.log('Native bridge: rapid taps, return taps, stale events, modal rejection, reselection, and acknowledgements passed.');
