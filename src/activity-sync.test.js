import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadActivityYear, syncDelay } from './activity-sync.js';

const snapshot = JSON.parse(await readFile(new URL('../public/data/github-activity-2026.json', import.meta.url), 'utf8'));
const newer = { ...snapshot, fetchedAt: '2026-10-04T12:00:00Z' };
test('stale responses retry after 1/2/4/5 minutes instead of waiting until tomorrow', () => {
  assert.deepEqual([1, 2, 3, 4, 100].map(n => syncDelay(true, n)), [60_000, 120_000, 240_000, 300_000, 300_000]);
  assert.equal(syncDelay(false), 3_600_000);
});
test('newer bundled snapshot wins over stale server cache', async () => {
  const result = await loadActivityYear(2026, { fetcher: async url => new Response(JSON.stringify(url.startsWith('/api/') ? { ...snapshot, stale: true } : newer)) });
  assert.equal(result.fetchedAt, newer.fetchedAt); assert.equal(result.stale, true);
});
test('one failed year keeps its previous data; malformed calendar cannot overwrite it', async () => {
  const result = await loadActivityYear(2026, { previous: newer, fetcher: async () => new Response(JSON.stringify({ ...snapshot, total: 999 })) });
  assert.equal(result.total, newer.total); assert.equal(result.stale, true);
  await assert.rejects(loadActivityYear(2025, { fetcher: async () => new Response('', { status: 503 }) }));
});
test('healthy API clears stale state, uses no-store and passes manual-refresh flag', async () => {
  const requests = [];
  const result = await loadActivityYear(2026, { previous: snapshot, force: true, fetcher: async (url, options) => {
    requests.push({ url, cache: options.cache });
    return new Response(JSON.stringify(url.startsWith('/api/') ? { ...newer, stale: false } : snapshot));
  } });
  assert.equal(result.stale, false); assert.equal(result.fetchedAt, newer.fetchedAt);
  assert.ok(requests.some(r => r.url.endsWith('&refresh=1'))); assert.ok(requests.every(r => r.cache === 'no-store'));
});
test('initial preview reads snapshot alone without starting upstream requests', async () => {
  let calls = 0;
  const result = await loadActivityYear(2026, { snapshotOnly: true, fetcher: async url => { calls++; assert.ok(url.startsWith('/data/')); return new Response(JSON.stringify(snapshot)); } });
  assert.equal(calls, 1); assert.equal(result.stale, true);
});
