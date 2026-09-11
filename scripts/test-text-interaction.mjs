import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const swift = await readFile('ios/App/App/OkuNavigation.swift', 'utf8');
const script = swift.match(/let textInteractionScript = """([\s\S]*?)"""/)?.[1];
assert.ok(script, 'native focus script must be present');
assert.match(swift, /super\.webViewConfiguration\(for: instanceConfiguration\)/);
assert.match(swift, /configuration\.preferences\.isTextInteractionEnabled = false/);
assert.match(swift, /weak var owner: OkuBridgeViewController\?/);
assert.match(swift, /guard message\.frameInfo\.isMainFrame, let enabled = message\.body as\? Bool/);
assert.match(swift, /configuration\.preferences\.isTextInteractionEnabled = enabled/);
assert.match(swift, /injectionTime: \.atDocumentStart, forMainFrameOnly: true/);
assert.doesNotMatch(script, /preventDefault|stopPropagation|touchstart|touchmove/);

class HTMLElement {
    constructor(tag, { disabled = false, readOnly = false, contentEditable = false } = {}) {
        Object.assign(this, { tag, disabled, readOnly, isContentEditable: contentEditable });
    }
    matches(selector) {
        assert.equal(selector, 'input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])');
        return ['input', 'textarea'].includes(this.tag) && !this.disabled && !this.readOnly;
    }
}
const listeners = new Map();
const messages = [];
const microtasks = [];
const document = {
    activeElement: new HTMLElement('body'),
    addEventListener: (type, handler) => listeners.set(type, handler),
};
runInNewContext(script, {
    document, HTMLElement, queueMicrotask: callback => microtasks.push(callback),
    window: { webkit: { messageHandlers: { okuTextInteraction: { postMessage: value => messages.push(value) } } } },
});
listeners.get('DOMContentLoaded')();
assert.equal(messages.at(-1), false, 'menu starts without text interaction');
for (const [element, expected] of [
    [new HTMLElement('input'), true],
    [new HTMLElement('textarea'), true],
    [new HTMLElement('div', { contentEditable: true }), true],
    [new HTMLElement('input', { disabled: true }), false],
    [new HTMLElement('input', { readOnly: true }), false],
    [new HTMLElement('button'), false],
    [null, false],
]) {
    document.activeElement = element;
    listeners.get('focusin')();
    assert.equal(messages.at(-1), expected);
}
document.activeElement = new HTMLElement('input');
listeners.get('focusin')();
listeners.get('focusout')();
document.activeElement = new HTMLElement('textarea');
microtasks.shift()();
assert.equal(messages.at(-1), true, 'moving between fields preserves editing');
listeners.get('focusout')();
document.activeElement = new HTMLElement('body');
microtasks.shift()();
assert.equal(messages.at(-1), false, 'leaving a field disables the loupe again');
const css = await readFile('index.css', 'utf8');
assert.match(css, /input, textarea, \[contenteditable="true"\], \[contenteditable="plaintext-only"\] \{\s*user-select: text;\s*-webkit-user-select: text;/);
console.log('Text-interaction configuration guards and focus/blur behavior passed.');
