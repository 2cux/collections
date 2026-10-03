import { readFile } from 'node:fs/promises';

export function parseCalendar(html, year) {
  const counts = new Map();
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const id = /\bfor="([^"]+)"/.exec(match[1])?.[1];
    const count = /^(No|[\d,]+) contributions?\b/.exec(match[2].trim());
    if (id && count) counts.set(id, count[1] === 'No' ? 0 : Number(count[1].replaceAll(',', '')));
  }
  const days = [];
  for (const match of html.matchAll(/<td\b[^>]*data-date="\d{4}-\d{2}-\d{2}"[^>]*>/g)) {
    const attr = name => new RegExp(`\\b${name}="([^"]+)"`).exec(match[0])?.[1];
    const count = counts.get(attr('id'));
    const level = Number(attr('data-level'));
    if (count === undefined || !Number.isInteger(level) || level < 0 || level > 4) throw new Error('Invalid calendar');
    days.push({ date: attr('data-date'), count, level });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 350 || days.length > 371) throw new Error('Incomplete calendar');
  if (year && (days.length !== (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365) || days.some(day => !day.date.startsWith(String(year))) || days[0].date !== year + '-01-01' || days.at(-1).date !== year + '-12-31')) throw new Error('Wrong calendar year');
  return { username: '2cux', ...(year ? { year } : {}), total: days.reduce((sum, day) => sum + day.count, 0), days, fetchedAt: new Date().toISOString() };
}

export function createActivityHandler({ fetchCalendar = year => fetch('https://github.com/users/2cux/contributions' + (year ? `?from=${year}-01-01&to=${year}-12-31` : ''), {
  headers: { 'User-Agent': 'Cao-Bo-Portfolio', Accept: 'text/html', 'Accept-Language': 'en-US' },
  signal: AbortSignal.timeout(10_000),
}), readSnapshot = year => readFile(new URL(`../public/data/github-activity${year ? '-' + year : ''}.json`, import.meta.url), 'utf8') } = {}) {
  const entries = new Map();
  async function refresh(entry, year) {
    try {
      const response = await fetchCalendar(year);
      if (!response.ok) throw new Error('GitHub unavailable');
      entry.cache = { ...parseCalendar(await response.text(), year), stale: false };
      entry.expires = Date.now() + 3_600_000;
    } catch {
      const data = entry.cache || JSON.parse(await readSnapshot(year));
      if (year && data.year !== year) throw new Error('Wrong snapshot year');
      entry.cache = { ...data, stale: true };
      entry.expires = Date.now() + 60_000;
    }
  }
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/github/activity') return next();
    if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }).end(); return; }
    const value = url.searchParams.get('year');
    const year = value === null ? null : Number(value);
    const current = new Date().getUTCFullYear();
    if (value !== null && (!/^\d{4}$/.test(value) || year < current - 2 || year > current)) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Choose one of the latest three years' })); return;
    }
    let entry = entries.get(year);
    if (!entry) { entry = { expires: 0 }; entries.set(year, entry); }
    try {
      if (!entry.cache || Date.now() >= entry.expires) {
        entry.pending ??= refresh(entry, year).finally(() => { entry.pending = null; });
        await entry.pending;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(entry.cache));
    } catch { res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Activity unavailable' })); }
  };
}
