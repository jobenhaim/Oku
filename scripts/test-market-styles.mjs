import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const constants = readFileSync(new URL('utils/constants.ts', root), 'utf8');
const css = readFileSync(new URL('index.css', root), 'utf8');
const catalog = constants.split('export const NUMBER_COLORS = [')[1].split('];')[0];
const entries = [...catalog.matchAll(/id: '([^']+)', name: '[^']+', cost: (\d+)/g)];
const prices = new Map(entries.map(([, id, cost]) => [id, Number(cost)]));
assert.equal(entries.length, 12);
assert.equal(prices.size, 12, 'Style IDs must stay unique');
for (const [id, price] of Object.entries({
    'num-default': 0, 'num-purple': 100, 'num-teal': 100,
    'num-fuchsia': 100, 'num-orange': 100, 'num-shine': 250,
    'num-rgb': 250, 'num-ruby': 250, 'num-matcha': 250, 'num-rainbow': 250,
    'num-ink': 100, 'num-forest': 100,
})) assert.equal(prices.get(id), price, `${id} ownership ID and price must be preserved`);

function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const palette of ['text-palette-sunset', 'text-palette-caribbean', 'text-palette-sapphire', 'text-palette-matcha', 'text-shine-rainbow']) {
    for (const dark of [false, true]) {
        for (let digit = 1; digit <= 9; digit++) {
            const selector = `${dark ? '.dark ' : ''}.${palette}[data-premium-number="${digit}"]`;
            const rule = css.split('\n').find(line => line.startsWith(`${selector} {`));
            assert.ok(rule, `Missing ${selector}`);
            const color = rule.match(/color: (#[0-9a-f]{6})/)[1];
            assert.ok(contrast(color, dark ? '#292524' : '#ffffff') >= 4.5, `${selector} needs readable contrast`);
        }
    }
}
const preview = readFileSync(new URL('components/ui/ScenePreview.tsx', root), 'utf8');
assert.equal((preview.match(/bg-white text-stone-800/g) || []).length, 3, 'Grid, controls, and numpad must have opaque white surfaces');
assert.ok(!preview.includes('bg-white/'), 'Preview surfaces must not be translucent');
console.log('Market styles: 12 unique styles, ownership/prices preserved, 90 palette shades checked, opaque scene surfaces.');
