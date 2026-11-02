// Development server: serves src/ as it is (plain ES modules, no build step) at
// http://localhost:5173. Edit a file, then reload the browser. Uses only Node's
// built-in modules. Stop it with Ctrl+C.
//
// Why a server at all? Browsers refuse to load ES modules from file:// pages. The
// single-file build (npm run build) is what you double-click; this is for editing.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteConfigFromEnv, siteConfigModule, describeSiteConfig } from './site-config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
// Site settings from the environment, as in the build (e.g. BUSINESS_NAME=… npm run dev).
let siteConfig;
try { siteConfig = siteConfigFromEnv(); } catch (e) { console.error(e.message); process.exit(1); }
const port = Number(process.env.PORT) || 5173;
const host = process.env.HOST || '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep) || !TYPES[path.extname(file)]) { res.writeHead(404).end('Not found'); return; }
  if (rel === '/site-config.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }).end(siteConfigModule(siteConfig)); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)], 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Business Dashboard Starter (development): http://localhost:${port}/`);
  console.log('Serving src/ unbundled. Reload the page after editing. Ctrl+C stops the server.');
  console.log(describeSiteConfig(siteConfig));
});
