import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export async function createLikesHandler({ file = resolve(process.env.LIKES_DATA_FILE || 'data/likes.json') } = {}) {
  await mkdir(dirname(file), { recursive: true });
  let count = 0;
  try {
    const stored = JSON.parse(await readFile(file, 'utf8'));
    if (Number.isSafeInteger(stored.count) && stored.count >= 0) count = stored.count;
    else if (Array.isArray(stored.voters) && stored.voters.every(v => typeof v === 'string')) {
      // Preserve the existing total when upgrading the former toggle format.
      count = new Set(stored.voters).size;
    } else throw new Error('Invalid likes data');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const clients = new Set();
  let queue = Promise.resolve();
  const state = () => ({ count });
  const send = res => { if (!res.write(`data: ${JSON.stringify(state())}\n\n`)) res.destroy(); };
  const heartbeat = setInterval(() => {
    for (const res of clients.keys()) if (!res.write(': heartbeat\n\n')) res.destroy();
  }, 20000);
  heartbeat.unref();
  function json(res, code, body) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }
  async function handler(req, res, next = () => json(res, 404, { error: 'Not found' })) {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path !== '/api/likes' && path !== '/api/likes/events') return next();
    if (req.method === 'GET' && path.endsWith('/events')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.flushHeaders(); clients.add(res);
      res.on('close', () => clients.delete(res)); send(res); return;
    }
    if (path.endsWith('/events')) return json(res, 405, { error: 'Method not allowed' });
    if (req.method === 'GET') return json(res, 200, state());
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Cross-site request denied' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Expected JSON' });
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 1024) { json(res, 413, { error: 'Body too large' }); return; }
      }
      const payload = JSON.parse(body);
      if (!payload || Array.isArray(payload) || typeof payload !== 'object' || Object.keys(payload).length) {
        return json(res, 400, { error: 'Expected an empty object; each request adds one like' });
      }
      const operation = queue.then(async () => {
        const updated = count + 1;
        if (!Number.isSafeInteger(updated)) throw new Error('Like count exceeds safe integer range');
        await writeFile(`${file}.tmp`, JSON.stringify({ count: updated }), { flush: true });
        await rename(`${file}.tmp`, file); count = updated;
        for (const client of clients) send(client);
      });
      queue = operation.catch(() => {});
      await operation; json(res, 200, state());
    } catch (error) { json(res, error instanceof SyntaxError ? 400 : 503, { error: 'Unable to save like' }); }
  }
  return { handler, close() { clearInterval(heartbeat); for (const res of clients.keys()) res.end(); } };
}
