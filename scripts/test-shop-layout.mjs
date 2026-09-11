import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const result = await build({
    entryPoints: ['components/screens/DiamondShopScreen.tsx'], bundle: true,
    platform: 'node', format: 'cjs', write: false, external: ['react', 'react-dom'],
    plugins: [{ name: 'isolate-shop-services', setup(builder) {
        builder.onResolve({ filter: /(?:utils\/(?:storage|sound|iap)|ui\/FishTank)$/ }, args => ({ path: args.path, namespace: 'mock' }));
        builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents:
            args.path.endsWith('/storage') ? 'export const Storage = {getPepinoState: () => ({unlocked:false})};' :
            args.path.endsWith('/sound') ? 'export const sounds = {playClick: () => {}};' :
            args.path.endsWith('/iap') ? 'export const IAP = {getLocalizedPrices: async () => ({})};' :
            'export const FishTank = () => null;'
        }));
    } }],
});
const module = { exports: {} };
runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require, console, setTimeout, clearTimeout });
const { DiamondShopScreen } = module.exports;
const noop = () => {};
const props = {
    nextBonusClaimTime: 0, dailyGiftNow: Date.now(), onClaimBonus: noop,
    points: 110, onBack: noop, onBuyOffer: noop, onPointsChanged: noop, onRestorePurchases: noop,
    starterPackPurchased: false, books2AllOwned: false, books3AllOwned: false, booksForeverOwned: false,
    book2BundlePrice: '€1.99', book3BundlePrice: '€1.99', booksForeverPrice: '€4.99',
    isPurchasingBook2Bundle: false, isPurchasingBook3Bundle: false, isPurchasingBooksForever: false,
    onPurchaseAllBooks2: noop, onPurchaseAllBooks3: noop, onPurchaseBooksForever: noop,
};
const render = extra => renderToStaticMarkup(React.createElement(DiamondShopScreen, {...props, ...extra}));
const fresh = render({});
assert.doesNotMatch(fresh, /diamonds included/);
assert.match(fresh, /Oku is made by one developer\. Bringing Pepino home supports my work and helps Oku grow\. Thank you! ♥/);
assert.match(fresh, /Claim daily gift: 5 diamonds/);
assert.ok(fresh.indexOf('premium-heading') < fresh.indexOf('oku-shop-daily-gift'));
assert.ok(fresh.indexOf('oku-shop-daily-gift') < fresh.indexOf('starter-heading'));
const claimedGift = render({nextBonusClaimTime: props.dailyGiftNow + 3_600_000});
assert.doesNotMatch(fresh + claimedGift, /A little boost|Claimed today|oku-shop-gift-description/);
assert.match(claimedGift, /Daily gift available in 1h, at midnight/);
assert.match(fresh, /shop-navbar-title[^>]*><h1[^>]*>Oku Shop<\/h1>/, 'Oku Shop title belongs in the top navigation');
assert.equal((fresh.match(/<h1\b/g) || []).length, 1);
assert.doesNotMatch(fresh, /shop-large-title/);
assert.match(fresh, /Five rewards to get started/);
assert.doesNotMatch(fresh, /Six rewards/);
assert.equal((fresh.match(/shop-diamond-row/g) || []).length, 4);
assert.match(fresh, /shop-book-group/);
assert.match(fresh, /shop-aquarium/);
assert.equal((fresh.match(/class="shop-aquarium-plant /g) || []).length, 2);
assert.doesNotMatch(fresh, /shop-aquarium-(bubble|rock)/);
assert.match(fresh, /aria-controls="books-forever-details"/);
assert.match(fresh, /All Books Forever<\/h3><button[^>]+How All Books Forever works/, 'Information button belongs beside the title');
assert.match(fresh, /€1.99/);
assert.match(fresh, /€4.99/);
assert.doesNotMatch(fresh, /Oku Book 3/);
const owned = render({starterPackPurchased: true, books2AllOwned: true, booksForeverOwned: true});
assert.match(owned, /Oku Book 3/);
assert.equal((owned.match(/>Owned</g) || []).length, 3);
assert.equal((owned.match(/disabled=""/g) || []).length, 3);
const purchasing = render({isPurchasingBook2Bundle: true, isPurchasingBooksForever: true});
assert.equal((purchasing.match(/aria-busy="true"/g) || []).length, 2);
assert.equal((purchasing.match(/disabled=""/g) || []).length, 2);
const source = readFileSync('components/screens/DiamondShopScreen.tsx', 'utf8');
assert.match(source, /IntersectionObserver/);
assert.match(source, /prefers-reduced-motion/);
assert.match(source, /appStateChange/);
assert.match(source, /visibilitychange/);
assert.match(source, /duration - 180/);
assert.match(source, /movement\?\.cancel\(\)/);
assert.match(source, /clearTimeout\(timer\)/);
const css = readFileSync('index.css', 'utf8');
assert.match(css, /\.oku-shop-daily-gift \{[^}]*height: 94px;[^}]*min-height: 94px;[^}]*box-sizing: border-box;/, 'Gift card height stays identical before and after claiming');
assert.match(css, /\.oku-shop-gift-status \{[^}]*width: 64px;/, 'Claim and countdown reserve the same horizontal space');
assert.match(css, /\.oku-shop-gift-status::before \{[^}]*position: absolute;[^}]*width: 1px;[^}]*height: 44px;/, 'A subtle divider separates the timeline without changing its layout');
const tank = readFileSync('components/ui/FishTank.tsx', 'utf8');
for (const file of [
    'components/screens/DiamondShopScreen.tsx',
    'components/ui/FishTank.tsx',
    'components/ui/DailyGiftBubble.tsx',
    'components/ui/MainScreenHeader.tsx',
    'components/ui/DiamondBalancePill.tsx',
]) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /hover:|whileHover|onMouseEnter|onMouseOver|onPointerEnter|onPointerOver/, `${file} must not add hover effects to Oku Shop`);
}
assert.match(tank, /className="pepino-tank /, 'Owned tank uses the matching aquarium styling');
assert.match(tank, /shop-aquarium-light/);
assert.match(tank, /shop-aquarium-pebbles/);
assert.equal((tank.match(/className="shop-aquarium-plant /g) || []).length, 2);
assert.equal((tank.match(/className="pepino-tank-plant-motion /g) || []).length, 4, 'The big tank has four distinct plant clusters');
assert.match(tank, /z-\[34\] pointer-events-none" aria-hidden="true">\s*<div className="pepino-tank-plant-motion pepino-tank-plant-motion--right"/, 'The right plant is above Pepino and below the hiding rock');
assert.doesNotMatch(fresh, /pepino-tank-plant-motion--(?:single|sprout)/, 'Extra plants stay exclusive to the big tank');
assert.match(tank, /pepino-tank-hideaway-rock absolute z-\[35\] pointer-events-none/, 'The hiding rock sits in front of Pepino without intercepting taps');
assert.doesNotMatch(fresh, /pepino-tank-hideaway-rock/, 'The small shop preview stays unchanged');
assert.equal((tank.match(/className="pepino-tank-stone /g) || []).length, 4, 'Four irregular stones decorate the big tank');
assert.doesNotMatch(fresh, /pepino-tank-stone/, 'Small preview does not gain the new stones');
assert.match(css, /width: 42\.88px; height: 25\.46px/, 'Shop Pepino is 33% smaller');
assert.match(css, /transition: transform 500ms ease/, 'Turns match the owned Pepino');
assert.match(css, /height: 82px; margin-left: 0; object-fit: contain; padding: 3px/, 'Book artwork stays inside the clipped row');
console.log('Shop layout: product groups, localized book prices, ownership, loading states, and aquarium lifecycle guards passed.');
