import assert from 'node:assert/strict';
import { mountLikes } from '../../src/likes.js';

const count = { textContent: '—' }, status = { textContent: '' }, listeners = new Map();
const button = {
  disabled: true, setAttribute() {}, classList: { add() {}, remove() {} },
  addEventListener(name, fn, capture) { if (!capture) listeners.set(name, fn); },
  removeEventListener() {},
};
globalThis.document = { querySelector: selector => ({ '#like-button': button, '#like-count': count, '#like-status': status })[selector] };
globalThis.window = { clearTimeout() {}, setTimeout() {} };
globalThis.EventSource = class { close() {} };
let stored = 7, requests = 0, complete;
globalThis.fetch = async (url, options) => {
  if (options.method === 'POST') {
    requests += 1;
    assert.equal(options.body, '{}');
    await new Promise(resolve => { complete = resolve; });
    stored += 1;
  }
  const saved = stored;
  return { ok: true, json: async () => ({ count: saved }) };
};
const dispose = mountLikes();
await new Promise(setImmediate);
assert.equal(count.textContent, '7');
const click = listeners.get('click');
const first = click();
click(); click();
assert.equal(count.textContent, '10');
assert.equal(button.disabled, false);
for (let i = 0; i < 3; i += 1) { complete(); await new Promise(setImmediate); }
await first;
assert.equal(requests, 3);
assert.equal(stored, 10);
assert.equal(count.textContent, '10');
dispose();
console.log('PASS: three rapid clicks queue three increments, without toggling or disabling the button.');
