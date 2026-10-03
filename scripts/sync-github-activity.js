import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { fetchCalendarWithRetry } from '../server/activity.js';

const year = new Date().getUTCFullYear();
const years = [year, year - 1, year - 2, null];
// Validate all responses before replacing any snapshot; errors leave saved records intact.
const updates = await Promise.all(years.map(async year => ({
  path: new URL(`../public/data/github-activity${year ? '-' + year : ''}.json`, import.meta.url),
  data: await fetchCalendarWithRetry(year, undefined, 3),
})));
for (const { path, data } of updates) {
  try {
    const previous = JSON.parse(await readFile(path, 'utf8'));
    if (Date.parse(previous.fetchedAt) > Date.parse(data.fetchedAt)) throw new Error('Refusing older snapshot');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
for (const { path, data } of updates) {
  const temporary = new URL(path.href + '.tmp');
  try {
    await writeFile(temporary, JSON.stringify(data) + '\n');
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
  console.log(`${data.year || 'rolling'}: ${data.total} contributions, ${data.fetchedAt}`);
}
