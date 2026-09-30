import assert from 'node:assert/strict';
import { mountLikes } from '../../src/likes.js';

const label = { textContent: '' }, count = { textContent: '—' }, status = { textContent: '' };
const button = { disabled: true, setAttribute() {}, querySelector: () => label, addEventListener() {}, removeEventListener() {} };
globalThis.document = { querySelector: selector => ({ '#like-button': button, '#like-count': count, '#like-status': status })[selector] };
let timer, delay, attempts = 0, closed = false;
globalThis.window = { setTimeout(callback, milliseconds) { timer = callback; delay = milliseconds; return 1; }, clearTimeout() { timer = undefined; } };
globalThis.fetch = async () => {
  if (++attempts === 1) throw new Error('Temporarily offline');
  return { ok: true, json: async () => ({ count: 4 }) };
};
globalThis.EventSource = class { close() { closed = true; } };
const dispose = mountLikes();
await new Promise(setImmediate);
assert.equal(status.textContent, '暂时无法连接，正在重试');
assert.equal(delay, 2000);
assert.equal(count.textContent, '—');
await timer();
assert.equal(attempts, 2);
assert.equal(count.textContent, '4');
assert.equal(button.disabled, false);
dispose();
assert.equal(timer, undefined);
assert.equal(closed, true);
console.log('PASS: initial connection failure retries automatically, restores count, and cleans up.');
