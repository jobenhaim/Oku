import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const result = await build({
    entryPoints: ['components/ui/Modals.tsx'], bundle: true, platform: 'node',
    format: 'cjs', write: false, external: ['react', 'react-dom'],
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'isolate-services', setup(builder) {
        builder.onResolve({ filter: /utils\/(storage|sound|iap|appReview)$/ }, args => ({ path: args.path, namespace: 'mock' }));
        builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents:
            'export const Storage = {}; export const sounds = {}; export const IAP = {}; export const AppReview = {};'
        }));
    } }],
});
const module = { exports: {} };
runInNewContext(result.outputFiles[0].text, {
    module, exports: module.exports, require: createRequire(import.meta.url), console,
    queueMicrotask, setTimeout, clearTimeout,
});
const offer = { id: 'support_dev', productId: 'premium', title: 'Oku Premium', type: 'support', diamonds: 2500, priceLabel: '$4.99' };
const render = changes => renderToStaticMarkup(React.createElement(module.exports.PaymentModal, {
    offer: { ...offer, ...changes }, onComplete() {}, onCancel() {},
}));
const premium = render({});
assert.match(premium, /Pepino in his aquarium with a gift on top/);
assert.match(premium, /pepino-purchase-gift/);
assert.match(premium, /2,500/);
assert.match(premium, /a diamond gift after every solved puzzle/);
assert.doesNotMatch(premium, /\$4\.99|grows with you|peaceful aquarium/);
assert.match(premium, />Purchase</);
assert.match(premium, />Cancel</);
assert.ok(premium.indexOf('pepino-purchase-preview') < premium.indexOf('Oku Premium'));
for (const type of ['support', 'starter', 'pack']) {
    for (const priceLabel of ['$0.99', '$1.99', '$2.99', '$3.99', '$4.99', '$6.99', '€2.99', '₪19.90']) {
        const confirmation = render({ type, priceLabel });
        assert.ok(!confirmation.includes(priceLabel), `${type} confirmation must not show ${priceLabel}`);
        assert.match(confirmation, />Purchase</);
        assert.match(confirmation, />Cancel</);
        if (type !== 'support') assert.doesNotMatch(confirmation, /pepino-purchase-preview/);
    }
}
const preview = readFileSync('components/ui/PepinoPurchasePreview.tsx', 'utf8');
assert.doesNotMatch(preview, /useEffect|useState|setTimeout|setInterval|motion\.|onClick|Storage|IAP/);
assert.match(preview, /PepinoArtwork/);
assert.match(preview, /pepino-purchase-fish[\s\S]*pepino-purchase-gift[\s\S]*<\/div>\s*<\/div>\s*<\/div>/, 'Gift stays inside the aquarium above Pepino');
const css = readFileSync('index.css', 'utf8');
assert.match(css, /\.pepino-purchase-fish \{[^}]*width: 78px;/);
assert.match(css, /\.pepino-purchase-gift \{[^}]*border-radius: 50%;[^}]*background: #fff;[^}]*color: #3985ff;/);
const modal = readFileSync('components/ui/Modals.tsx', 'utf8');
assert.match(modal, /await IAP.purchase\(offer.productId\)/);
assert.doesNotMatch(modal, /offer\.priceLabel/, 'Shop confirmations must not render monetary prices');
console.log('Shop confirmations: no monetary prices, static Pepino preview, accurate copy, and unchanged purchase wiring passed.');
