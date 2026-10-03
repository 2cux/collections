import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateActivity, newestActivity } from '../src/activity-data.js';

const filename = year => `github-activity${year ? '-' + year : ''}.json`;
const savedDirectory = () => resolve(process.env.GITHUB_ACTIVITY_DATA_DIR || 'data/github-activity');
export async function saveActivity(data, year) {
  const directory = savedDirectory();
  await mkdir(directory, { recursive: true });
  const target = resolve(directory, filename(year));
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data) + '\n');
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
}

export async function fetchGitHubCalendar(year) {
  return fetch('https://github.com/users/2cux/contributions' + (year ? `?from=${year}-01-01&to=${year}-12-31` : ''), {
    headers: { 'User-Agent': 'Cao-Bo-Portfolio', Accept: 'text/html', 'Accept-Language': 'en-US' },
    signal: AbortSignal.timeout(6000),
  });
}

export async function fetchCalendarWithRetry(year, fetchCalendar = fetchGitHubCalendar, attempts = 2, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response;
    try { response = await fetchCalendar(year); }
    catch (error) { if (attempt === attempts - 1) throw error; await wait(300 * 2 ** attempt); continue; }
    if (response.ok) return parseCalendar(await response.text(), year);
    if ((response.status !== 429 && response.status < 500) || attempt === attempts - 1) throw new Error(`GitHub HTTP ${response.status}`);
    await wait(300 * 2 ** attempt);
  }
}

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
  return validateActivity({ username: '2cux', ...(year ? { year } : {}), total: days.reduce((sum, day) => sum + day.count, 0), days, fetchedAt: new Date().toISOString() }, year);
}

export function createActivityHandler({
  fetchCalendar = fetchGitHubCalendar,
  fetchSnapshot = async year => {
    const response = await fetch(`https://raw.githubusercontent.com/2cux/collections/HEAD/public/data/${filename(year)}`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`Snapshot HTTP ${response.status}`);
    return response.json();
  },
  readSnapshot = year => readFile(new URL(`../public/data/${filename(year)}`, import.meta.url), 'utf8'),
  readSaved = year => readFile(resolve(savedDirectory(), filename(year)), 'utf8'),
  writeSaved = saveActivity,
  now = Date.now,
  wait,
  warn = message => console.warn(message),
} = {}) {
  const entries = new Map();
  async function readValid(reader, year) {
    try { const value = await reader(year); return validateActivity(typeof value === 'string' ? JSON.parse(value) : value, year); }
    catch { return undefined; }
  }
  async function refresh(entry, year) {
    entry.attemptedAt = now();
    // Read disk on every refresh: a newer deployment/manual snapshot must replace old memory.
    const local = Promise.all([readValid(readSaved, year), readValid(readSnapshot, year)]);
    let data, source = 'github';
    try {
      data = await fetchCalendarWithRetry(year, fetchCalendar, 2, wait);
    } catch (error) {
      source = 'saved';
      // Independent GitHub-hosted domain; cloud-generated snapshots do not need local scraping.
      data = await readValid(fetchSnapshot, year);
      if (data) source = 'github-snapshot';
      const reason = /^GitHub HTTP \d+$/.test(error.message) ? error.message : error.cause?.code || error.name;
      warn(`[github-activity] ${year || 'rolling'}: live sync failed (${reason}); using ${source}`);
    }
    const [saved, snapshot] = await local;
    const newest = newestActivity(data, saved, snapshot, entry.cache);
    if (!newest) throw new Error('Activity unavailable');
    const stale = !data || newest !== data || (source !== 'github' && now() - Date.parse(data.fetchedAt) > 3_600_000);
    entry.failures = stale ? (entry.failures || 0) + 1 : 0;
    entry.expires = now() + (stale ? Math.min(300_000, 60_000 * 2 ** Math.min(entry.failures - 1, 3)) : 3_600_000);
    entry.cache = { ...newest, stale, source: newest === data ? source : 'saved', lastAttemptAt: new Date(entry.attemptedAt).toISOString(), retryAt: new Date(entry.expires).toISOString() };
    if (data && newest === data) {
      try { await writeSaved(data, year); }
      catch { warn(`[github-activity] ${year || 'rolling'}: could not persist latest data`); }
    }
  }
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/github/activity') return next();
    if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }).end(); return; }
    const value = url.searchParams.get('year');
    const year = value === null ? null : Number(value);
    const current = new Date(now()).getUTCFullYear();
    if (value !== null && (!/^\d{4}$/.test(value) || year < current - 2 || year > current)) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Choose one of the latest three years' })); return;
    }
    let entry = entries.get(year);
    if (!entry) { entry = { expires: 0 }; entries.set(year, entry); }
    try {
      const force = url.searchParams.get('refresh') === '1' && now() - (entry.attemptedAt ?? -Infinity) >= 60_000;
      if (!entry.cache || now() >= entry.expires || force) {
        entry.pending ??= refresh(entry, year).finally(() => { entry.pending = null; });
        await entry.pending;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(entry.cache));
    } catch { res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Activity unavailable' })); }
  };
}
