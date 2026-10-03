import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { parseCalendar, createActivityHandler } from './activity.js';

const fixture = await readFile(new URL('../artifacts/heatmap-review/github.html', import.meta.url), 'utf8');
test('real calendar has chronological days, exact tooltip counts and a consistent total', () => {
  const data = parseCalendar(fixture);
  assert.equal(data.days.length, 368);
  assert.equal(data.total, 538);
  assert.ok(data.days.every((day, index) => !index || day.date > data.days[index - 1].date));
  assert.throws(() => parseCalendar('<html>Not a calendar</html>'));
  assert.throws(() => parseCalendar(fixture.replace(/<tool-tip\b[\s\S]*?<\/tool-tip>/, '')));
});
test('concurrent requests share refresh; failed upstream returns explicitly stale real snapshot', async () => {
  let calls = 0;
  const handler = createActivityHandler({ fetchCalendar: async () => { calls++; throw new Error('offline'); } });
  const server = createServer((req, res) => handler(req, res, () => res.writeHead(404).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/github/activity`;
    const results = await Promise.all(Array.from({ length: 5 }, () => fetch(url).then(r => r.json())));
    assert.equal(calls, 1);
    assert.ok(results.every(data => data.stale && data.total === 538 && data.days.length === 368));
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('annual calendars preserve full years, leap day and independent year caches', async () => {
  const totals = { 2026: 537, 2025: 2, 2024: 0 };
  for (const year of [2026, 2025, 2024]) {
    const html = await readFile(new URL(`../artifacts/heatmap-review/arc/github-${year}.html`, import.meta.url), 'utf8');
    const data = parseCalendar(html, year);
    assert.equal(data.total, totals[year]);
    assert.equal(data.days.length, year === 2024 ? 366 : 365);
    assert.equal(data.days[0].date, `${year}-01-01`);
    assert.equal(data.days.at(-1).date, `${year}-12-31`);
    assert.throws(() => parseCalendar(html, year + 1));
  }
  const requested = [];
  const handler = createActivityHandler({ fetchCalendar: async year => { requested.push(year); throw new Error('offline'); } });
  const server = createServer((req, res) => handler(req, res, () => res.writeHead(404).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/github/activity`;
    for (const year of [2026, 2025, 2024, 2026]) {
      const result = await fetch(`${url}?year=${year}`).then(r => r.json());
      assert.equal(result.year, year); assert.equal(result.total, totals[year]); assert.equal(result.stale, true);
    }
    assert.deepEqual(requested, [2026, 2025, 2024]);
    assert.equal((await fetch(`${url}?year=2023`)).status, 400);
    assert.equal((await fetch(`${url}?year=garbage`)).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
