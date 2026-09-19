#!/usr/bin/env node
/**
 * A static server for public/, so the game can be played locally the way it is
 * played on the web.
 *
 *   node tools/serve.mjs [port]      # defaults to 8080
 *
 * file:// is enough for the UI check, but not for everything: a service worker
 * and a web app manifest only load over http, and the Android wrapper serves
 * the same directory over a real origin rather than from disk. Testing over
 * http is what makes the local run resemble the shipped one.
 *
 * Node's standard library only — this stays a project with no runtime
 * dependencies, and a dev server is not worth breaking that for.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  // Resolve first, then confirm the result is still inside public/. Joining a
  // path that contains ".." and trusting it is how a static server ends up
  // serving PLAN.md — the thing netlify.toml's publish setting exists to stop.
  const file = path.resolve(ROOT, '.' + rel);
  if (file !== ROOT.slice(0, -1) && !file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: rel + '/' }).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // Never cache locally, whatever netlify.toml says for production: an
      // edit you cannot see is a worse way to lose an afternoon than a reload.
      'Cache-Control': 'no-store',
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

// 0.0.0.0, not localhost: this is also how the game gets opened on a phone on
// the same network, which is the only honest way to test the portrait layout.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tressette on http://localhost:${PORT}/  (serving ${ROOT})`);
  console.log('On a phone on the same network, use this machine\'s LAN address.');
});
