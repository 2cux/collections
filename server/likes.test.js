import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLikesHandler } from './likes.js';

test('cumulative likes: repeated clicks, realtime, concurrency, no cancellation and restart persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-likes-'));
  const file = join(directory, 'likes.json');
  let likes, server;
  const streams = new AbortController();
  async function boot() {
    likes = await createLikesHandler({ file });
    server = createServer((req, res) => likes.handler(req, res));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    likes.close(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  try {
    let base = await boot();
    const first = await fetch(`${base}/api/likes`);
    assert.deepEqual(await first.json(), { count: 0 });
    const events = await fetch(`${base}/api/likes/events`, { signal: streams.signal });
    const reader = events.body.getReader();
    await reader.read();
    const update = () => fetch(`${base}/api/likes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json());
    assert.deepEqual(await update(), { count: 1 });
    const event = await reader.read();
    assert.match(new TextDecoder().decode(event.value), /"count":1/);
    assert.equal((await update()).count, 2);
    await Promise.all(Array.from({ length: 20 }, update));
    assert.deepEqual(await (await fetch(`${base}/api/likes`)).json(), { count: 22 });
    const cancellation = await fetch(`${base}/api/likes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"liked":false}' });
    assert.equal(cancellation.status, 400);
    const invalid = await fetch(`${base}/api/likes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(invalid.status, 400);
    streams.abort();
    await stop(); base = await boot();
    assert.deepEqual(await (await fetch(`${base}/api/likes`)).json(), { count: 22 });
    await stop();
    await writeFile(file, JSON.stringify({ voters: ['a', 'b', 'a'] }));
    base = await boot();
    assert.deepEqual(await (await fetch(`${base}/api/likes`)).json(), { count: 2 });
    assert.deepEqual(await update(), { count: 3 });
  } finally {
    streams.abort();
    if (server?.listening) await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
