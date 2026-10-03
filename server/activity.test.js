import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { parseCalendar, createActivityHandler, fetchCalendarWithRetry, saveActivity } from './activity.js';
import { validateActivity } from '../src/activity-data.js';

const fixture = await readFile(new URL('../artifacts/heatmap-review/github.html', import.meta.url), 'utf8');
const annual = await readFile(new URL('../artifacts/heatmap-review/arc/github-2026.html', import.meta.url), 'utf8');
const snapshot = { ...parseCalendar(annual, 2026), fetchedAt: '2026-09-30T12:00:00Z' };
const offline = async () => { throw new Error('offline'); };
const options = { fetchCalendar: offline, fetchSnapshot: offline, readSaved: offline, readSnapshot: () => JSON.stringify(snapshot), writeSaved: async () => {}, wait: async () => {}, warn: () => {} };
async function serve(overrides, run) {
  const handler = createActivityHandler({ ...options, ...overrides });
  const server = createServer((req, res) => handler(req, res, () => res.writeHead(404).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/github/activity`;
    await run(async (suffix = '?year=2026') => { const response = await fetch(url + suffix); return { status: response.status, data: await response.json() }; }, url);
  } finally { await new Promise(resolve => server.close(resolve)); }
}

test('real calendar counts, leap years and consecutive dates are validated', async () => {
  const data = parseCalendar(fixture);
  assert.equal(data.days.length, 368); assert.equal(data.total, 538);
  assert.throws(() => parseCalendar('<html>Not a calendar</html>'));
  assert.throws(() => parseCalendar(fixture.replace(/<tool-tip\b[\s\S]*?<\/tool-tip>/, '')));
  for (const year of [2026, 2025, 2024]) {
    const html = await readFile(new URL(`../artifacts/heatmap-review/arc/github-${year}.html`, import.meta.url), 'utf8');
    const result = parseCalendar(html, year);
    assert.equal(result.total, { 2026: 537, 2025: 2, 2024: 0 }[year]);
    assert.equal(result.days.length, year === 2024 ? 366 : 365);
    assert.throws(() => parseCalendar(html, year + 1));
  }
  const duplicate = structuredClone(snapshot); duplicate.days[1] = duplicate.days[0];
  assert.throws(() => validateActivity(duplicate, 2026));
  assert.throws(() => validateActivity({ ...snapshot, total: -1 }, 2026));
  assert.throws(() => validateActivity({ ...snapshot, fetchedAt: 'bad' }, 2026));
});

test('network errors and transient HTTP errors retry; permanent errors and broken HTML do not', async () => {
  let calls = 0;
  const result = await fetchCalendarWithRetry(2026, async () => {
    calls++; if (calls === 1) throw new Error('timeout'); return new Response(annual);
  }, 2, async () => {});
  assert.equal(calls, 2); assert.equal(result.total, 537);
  calls = 0;
  await fetchCalendarWithRetry(2026, async () => new Response(++calls === 1 ? '' : annual, { status: calls === 1 ? 503 : 200 }), 2, async () => {});
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(fetchCalendarWithRetry(2026, async () => { calls++; return new Response('', { status: 404 }); }, 2, async () => {}));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(fetchCalendarWithRetry(2026, async () => { calls++; return new Response('bad HTML'); }, 2, async () => {}));
  assert.equal(calls, 1);
});

test('concurrent requests share retries and stale fallback; API methods and years are restricted', async () => {
  let calls = 0;
  await serve({ fetchCalendar: async () => { calls++; throw new Error('offline'); } }, async (get, url) => {
    const results = await Promise.all(Array.from({ length: 5 }, () => get()));
    assert.equal(calls, 2);
    assert.ok(results.every(({ data }) => data.stale && data.total === snapshot.total && data.source === 'saved'));
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
    assert.equal((await get('?year=2023')).status, 400);
    assert.equal((await get('?year=garbage')).status, 400);
  });
});

test('failed sync backs off, picks a newer disk snapshot over memory and recovers on next attempt', async () => {
  let time = Date.parse('2026-10-03T12:00:00Z'), current = { ...snapshot, fetchedAt: '2026-09-30T12:00:00Z' }, healthy = false, calls = 0;
  await serve({ now: () => time, readSnapshot: () => current, fetchCalendar: async () => { calls++; if (!healthy) throw new Error('offline'); return new Response(annual); } }, async get => {
    const first = (await get()).data;
    assert.equal(Date.parse(first.retryAt) - time, 60_000);
    time += 60_001;
    current = { ...snapshot, fetchedAt: '2026-10-03T11:59:00Z' };
    const second = (await get()).data;
    assert.equal(second.fetchedAt, current.fetchedAt);
    assert.equal(Date.parse(second.retryAt) - time, 120_000);
    time += 120_001; healthy = true;
    const third = (await get()).data;
    assert.equal(third.stale, false); assert.equal(third.source, 'github');
    assert.equal(Date.parse(third.retryAt) - time, 3_600_000);
    assert.equal(calls, 5);
  });
});

test('force refresh bypasses hourly cache after one minute but cannot create a request storm', async () => {
  let time = Date.parse('2026-10-03T12:00:00Z'), calls = 0;
  await serve({ now: () => time, readSnapshot: offline, fetchCalendar: async () => { calls++; return new Response(annual); } }, async get => {
    await get(); await get('?year=2026&refresh=1'); assert.equal(calls, 1);
    time += 60_001;
    await get('?year=2026&refresh=1'); assert.equal(calls, 2);
    await get('?year=2026&refresh=1'); assert.equal(calls, 2);
  });
});

test('fresh cloud snapshot can replace failed live scraping; old snapshots remain explicitly stale', async () => {
  const time = Date.parse('2026-10-03T12:00:00Z');
  let cloud = { ...snapshot, fetchedAt: new Date(time - 1000).toISOString() }, saved;
  await serve({ now: () => time, fetchSnapshot: async () => cloud, writeSaved: async data => { saved = data; } }, async get => {
    const { data } = await get(); assert.equal(data.stale, false); assert.equal(data.source, 'github-snapshot'); assert.equal(saved.fetchedAt, cloud.fetchedAt);
  });
  cloud = { ...snapshot, fetchedAt: '2026-09-29T12:00:00Z' };
  await serve({ now: () => time, fetchSnapshot: async () => cloud, readSnapshot: offline }, async get => assert.equal((await get()).data.stale, true));
});

test('successful results persist and survive server restart; persistence failure does not discard live data', async () => {
  let saved;
  await serve({ readSnapshot: offline, fetchCalendar: async () => new Response(annual), writeSaved: async data => { saved = JSON.stringify(data); } }, async get => assert.equal((await get()).data.stale, false));
  await serve({ readSnapshot: offline, readSaved: async () => saved }, async get => { const { data } = await get(); assert.equal(data.total, 537); assert.equal(data.fetchedAt, JSON.parse(saved).fetchedAt); assert.equal(data.stale, true); });
  await serve({ fetchCalendar: async () => new Response(annual), writeSaved: offline }, async get => assert.equal((await get()).data.stale, false));
});

test('corrupt or absent fallbacks produce 503 and cannot silently invent counts', async () => {
  await serve({ readSnapshot: () => ({ ...snapshot, total: 999 }), readSaved: () => 'bad JSON', fetchSnapshot: async () => ({ ...snapshot, year: 2025 }) }, async get => assert.equal((await get()).status, 503));
});

test('saved cache uses atomic files in configured persistent directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'activity-test-'));
  const previous = process.env.GITHUB_ACTIVITY_DATA_DIR;
  process.env.GITHUB_ACTIVITY_DATA_DIR = directory;
  try { await saveActivity(snapshot, 2026); assert.deepEqual(JSON.parse(await readFile(join(directory, 'github-activity-2026.json'), 'utf8')), snapshot); }
  finally { if (previous === undefined) delete process.env.GITHUB_ACTIVITY_DATA_DIR; else process.env.GITHUB_ACTIVITY_DATA_DIR = previous; await rm(directory, { recursive: true, force: true }); }
});
