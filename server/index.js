import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { getLimits } from './limits.js';
import { aggregate, refresh } from './usage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = Number(process.env.PORT) || 5174;
const isProd = process.env.NODE_ENV === 'production';

const app = express();

// --- API ---
app.get('/api/limits', async (_req, res) => {
  try {
    res.json(await getLimits());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/usage', async (req, res) => {
  try {
    const { from, to, granularity } = req.query;
    res.json(await aggregate({ from: from || null, to: to || null, granularity: granularity || null }));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Фронтенд ---
// Всё на одном порту (без межпроцессного Vite-прокси): в dev Vite работает как
// middleware внутри Express, в prod отдаём собранный web/dist.
async function mountFrontend() {
  if (isProd) {
    const dist = join(ROOT, 'web', 'dist');
    if (existsSync(dist)) {
      app.use(express.static(dist));
      app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
    } else {
      console.warn('[claude-limit] web/dist не найден — сначала `npm run build`');
    }
    return;
  }

  // dev: Vite в middleware-режиме (HMR + трансформация без отдельного процесса)
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    configFile: join(ROOT, 'vite.config.js'),
    appType: 'spa',
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    try {
      const template = readFileSync(join(ROOT, 'web', 'index.html'), 'utf8');
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace?.(e);
      next(e);
    }
  });
}

const server = await mountFrontend()
  .then(() => app)
  .catch((e) => {
    console.error('[claude-limit] ошибка инициализации фронтенда:', e);
    return app;
  });

server.listen(PORT, () => {
  console.log(`[claude-limit] ${isProd ? 'prod' : 'dev'} — открой http://localhost:${PORT}`);
  refresh()
    .then(() => console.log('[claude-limit] JSONL-кэш прогрет'))
    .catch(() => {});
});
