export function validateActivity(data, year) {
  if (!data || data.username !== '2cux' || (year && data.year !== year) || !Number.isFinite(Date.parse(data.fetchedAt)) || !Array.isArray(data.days)) throw new Error('Invalid calendar metadata');
  const length = year ? (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365) : null;
  if (length ? data.days.length !== length : data.days.length < 350 || data.days.length > 371) throw new Error('Incomplete calendar');
  let previous, total = 0;
  for (const day of data.days) {
    const time = Date.parse(`${day.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== day.date || (year && !day.date.startsWith(`${year}-`)) || (previous !== undefined && time - previous !== 86_400_000) || !Number.isSafeInteger(day.count) || day.count < 0 || !Number.isInteger(day.level) || day.level < 0 || day.level > 4) throw new Error('Invalid calendar day');
    previous = time;
    total += day.count;
  }
  if (year && (data.days[0].date !== `${year}-01-01` || data.days.at(-1).date !== `${year}-12-31`)) throw new Error('Wrong calendar year');
  if (!Number.isSafeInteger(data.total) || data.total !== total) throw new Error('Invalid calendar total');
  return data;
}

export function newestActivity(...items) {
  return items.filter(Boolean).sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0];
}
