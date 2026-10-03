import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createLikesHandler } from './likes.js';
import { createActivityHandler } from './activity.js';

const root = resolve('dist');
const likes = await createLikesHandler();
const activity = createActivityHandler();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  activity(req, res, () => likes.handler(req, res, async () => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
      if (!file.startsWith(`${root}${sep}`)) { res.writeHead(403).end(); return; }
      const info = await stat(file);
      if (!info.isFile()) { res.writeHead(404).end(); return; }
      const headers = { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' };
      let start = 0, end = info.size - 1, code = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!range || (!range[1] && !range[2])) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
        start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
        if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
        code = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      headers['Content-Length'] = end - start + 1;
      res.writeHead(code, headers);
      if (req.method === 'HEAD') res.end();
      else createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    } catch { if (!res.headersSent) res.writeHead(404).end(); else res.destroy(); }
  })).catch(() => { if (!res.headersSent) res.writeHead(500).end(); else res.destroy(); });
});
server.once('close', likes.close);
server.listen(Number(process.env.PORT || 8787), process.env.HOST || '0.0.0.0', () => console.log(`Website: http://localhost:${server.address().port}`));
