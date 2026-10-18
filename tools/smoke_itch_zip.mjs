#!/usr/bin/env node
/**
 * Smoke-test the itch.io HTML5 zip that tools/package_itch.mjs wrote.
 *
 *   node tools/smoke_itch_zip.mjs [path-to-zip]
 *
 * The default is the zip for the version in mobile/android/app/build.gradle, in
 * dist-itch/vX.Y.Z/. Pass a path to smoke a candidate:
 *   node tools/smoke_itch_zip.mjs dist-itch/candidate-<sha>/Tressette-X.Y.Z-itch-html5.zip
 *
 * Run it after `package_itch.mjs --confirm` and before the tag. It checks, in
 * order:
 *
 *   1. the zip's SHA-256 matches its line in SHA256SUMS.txt;
 *   2. an extractor that is not ours (tar or unzip) opens it, and index.html is
 *      at the root — the packager's zip writer is hand-rolled, and this is its
 *      only independent check;
 *   3. the extracted files are exactly public/'s files, byte for byte;
 *   4. the extracted page, served over http as itch.io would, loads with no
 *      script or console errors and shows all six decks and Gioca at the
 *      480x720 embed, whose start sheet does not scroll and whose controls are
 *      all on screen;
 *   5. the same page works at 640x480, a supported alternate window. #93's
 *      owner correction supersedes the old no-scroll rule there, so only the
 *      controls and the absence of errors are asserted.
 *
 * Nothing here touches the live itch.io page.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const fail = (msg) => { console.error(`\nsmoke_itch_zip: ${msg}`); process.exit(1); };
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function defaultZip(){
  const gradle = readFileSync(path.join(ROOT, 'mobile/android/app/build.gradle'), 'utf8');
  const version = /versionName\s+["']([^"']+)["']/.exec(gradle)?.[1];
  if (!version) fail('could not read versionName from mobile/android/app/build.gradle');
  return path.join(ROOT, 'dist-itch', `v${version}`, `Tressette-${version}-itch-html5.zip`);
}
const ZIP = path.resolve(process.argv[2] ?? defaultZip());
if (!existsSync(ZIP)) fail(`zip not found: ${ZIP}`);

const checks = [];
const check = (name, ok, detail = '') => checks.push([name, ok, detail]);

// 1. The hash the release will publish.
const zipBytes = readFileSync(ZIP);
const sumsPath = path.join(path.dirname(ZIP), 'SHA256SUMS.txt');
if (!existsSync(sumsPath)) fail(`SHA256SUMS.txt is missing next to the zip`);
const recorded = new Map(readFileSync(sumsPath, 'utf8').trim().split('\n').filter(Boolean)
  .map((line) => { const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/.exec(line); return m ? [m[2], m[1]] : [line, null]; }));
check('zip hash matches SHA256SUMS.txt', recorded.get(path.basename(ZIP)) === sha256(zipBytes),
  recorded.has(path.basename(ZIP)) ? 'hash differs' : 'no line for this zip');

// 2. Extract with a tool that did not write the archive.
const SCRATCH = mkdtempSync(path.join(tmpdir(), 'tressette-itch-smoke-'));
process.on('exit', () => rmSync(SCRATCH, { recursive: true, force: true }));
const SITE = path.join(SCRATCH, 'site');
mkdirSync(SITE);
// On Windows, System32's bsdtar reads zip; Git Bash's GNU tar is first on PATH
// and cannot, and treats "C:" as a remote host.
const [cmd, args] = process.platform === 'linux'
  ? ['unzip', ['-q', ZIP, '-d', SITE]]
  : [process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar',
     ['-xf', ZIP, '-C', SITE]];
const ex = spawnSync(cmd, args, { encoding: 'utf8' });
check(`${path.basename(cmd)} extracts the zip`, ex.status === 0, (ex.stderr || ex.error?.message || '').trim());
check('index.html is at the zip root', existsSync(path.join(SITE, 'index.html')));

// 3. Exactly public/, byte for byte.
function* walk(dir, prefix = ''){
  for (const name of readdirSync(dir)){
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(abs).isDirectory()) yield* walk(abs, rel);
    else yield rel;
  }
}
if (existsSync(SITE)){
  const want = [...walk(PUBLIC)].sort();
  const got = [...walk(SITE)].sort();
  check('same file list as public/', JSON.stringify(want) === JSON.stringify(got),
    `missing: ${want.filter((f) => !got.includes(f)).join(', ') || '-'}; ` +
    `extra: ${got.filter((f) => !want.includes(f)).join(', ') || '-'}`);
  const differ = want.filter((f) => !got.includes(f)
    || !readFileSync(path.join(PUBLIC, f)).equals(readFileSync(path.join(SITE, f))));
  check('every file is byte-identical to public/', differ.length === 0, differ.join(', '));
}

// 4 & 5. The page, from the extracted tree, over http.
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(SITE, '.' + rel);
  if (!file.startsWith(SITE) || !existsSync(file) || statSync(file).isDirectory()){
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const inspect = () => {
  const out = { decks: 0, art: false, play: false, scroll: null, client: null, controls: [] };
  out.decks = document.querySelectorAll('#viewStart .deck-opt').length;
  const art = document.querySelector('#viewStart .deck-opt .card');
  out.art = !!art && art.offsetWidth > 0 && art.offsetHeight > 0;
  const r = document.querySelector('#play').getBoundingClientRect();
  out.play = r.bottom <= innerHeight + 1 && r.top >= -1 && r.width > 0 && r.height > 0;
  const sheet = document.querySelector('#viewStart .sheet-body');
  out.scroll = sheet.scrollHeight; out.client = sheet.clientHeight;
  for (const el of document.querySelectorAll('#viewStart .tool, #viewStart .chip, #viewStart .deck-opt, #viewStart .hero-link a, #play')){
    if (!el.getClientRects().length) continue;
    const b = el.getBoundingClientRect();
    out.controls.push({ id: el.id || el.className.split(' ')[0],
      ok: b.top >= -1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.right <= innerWidth + 1 });
  }
  return out;
};

let browser;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ executablePath: process.env.CHROME || chromium.executablePath() });
  if (existsSync(path.join(SITE, 'index.html'))){
    for (const [w, h] of [[480, 720], [640, 480]]){
      const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'it-IT' });
      const errs = [];
      page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
      page.on('requestfailed', (r) => errs.push(`request failed: ${r.url()}`));
      page.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
      await page.goto(base);
      await page.waitForTimeout(500);
      const got = await page.evaluate(inspect);
      check(`${w}x${h}: six decks on the start screen`, got.decks === 6, String(got.decks));
      check(`${w}x${h}: deck art is drawn`, got.art);
      check(`${w}x${h}: Gioca is on screen`, got.play);
      // The 480x720 embed is the canonical one (#95): the whole first screen
      // fits, controls included, and does not scroll. 640x480 is a supported
      // alternate window only, so the sheet may scroll there and its controls
      // need not all be above the fold (#93 supersedes the old no-scroll rule).
      if (w === 480){
        const off = got.controls.filter((c) => !c.ok).map((c) => c.id);
        check('480x720: every start control is on screen', off.length === 0, off.join(', '));
        check('480x720: the start sheet does not scroll', got.scroll <= got.client + 1,
          `${got.scroll} in ${got.client}`);
      }
      check(`${w}x${h}: no script, console or network errors`, errs.length === 0, errs.join(' | '));
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.close();
  rmSync(SCRATCH, { recursive: true, force: true });
}

let failed = 0;
for (const [name, ok, detail] of checks){
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failed++;
}
if (failed) fail(`${failed} check(s) failed`);
console.log('\nsmoke ok.');
