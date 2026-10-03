import { validateActivity, newestActivity } from './activity-data.js';

export function syncDelay(stale, failures = 1) {
  return stale ? Math.min(300_000, 60_000 * 2 ** Math.min(Math.max(0, failures - 1), 3)) : 3_600_000;
}

export async function loadActivityYear(year, { fetcher = fetch, signal, previous, force = false, snapshotOnly = false } = {}) {
  const urls = snapshotOnly ? [`/data/github-activity-${year}.json`] : [`/api/github/activity?year=${year}${force ? '&refresh=1' : ''}`, `/data/github-activity-${year}.json`];
  const results = await Promise.all(urls.map(async url => {
    try {
      const timeout = AbortSignal.timeout(22_000);
      const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cache: 'no-store' });
      if (!response.ok) throw new Error('Activity unavailable');
      const data = validateActivity(await response.json(), year);
      return { ...data, stale: Boolean(data.stale || url.startsWith('/data/')) };
    } catch { return undefined; }
  }));
  const data = newestActivity(...results, previous);
  if (!data) throw new Error('Year unavailable');
  return data === previous ? { ...previous, stale: true } : data;
}
