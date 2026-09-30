import { defineConfig } from 'vite';
import { createLikesHandler } from './server/likes.js';

export default defineConfig({
  plugins: [{
    name: 'shared-likes',
    async configureServer(server) {
      const likes = await createLikesHandler();
      server.middlewares.use((req, res, next) => { likes.handler(req, res, next).catch(next); });
      server.httpServer?.once('close', likes.close);
    },
    async configurePreviewServer(server) {
      const likes = await createLikesHandler();
      server.middlewares.use((req, res, next) => { likes.handler(req, res, next).catch(next); });
      server.httpServer?.once('close', likes.close);
    },
  }],
});
