#!/usr/bin/env node
/**
 * Build public/decks/bresciane.jpg from the mhamilt/Italian-decks repo, in the
 * same 11x4 sprite-sheet layout the other decks use. A JPEG and not a PNG, for
 * the reason given at OUT below.
 *
 *   node tools/import_bresciane.mjs
 *
 * Provenance and licence, to be exact about it: the source is
 * https://github.com/mhamilt/Italian-decks (labelled GPLv3), and the images are
 * a scan of a commercial Teodomiro Dal Negro "Bresciane" deck — the Asso di
 * denari carries the maker's stamp. That is the same copyright grey area as the
 * decks this project already ships (originals from a 1997 program), not a
 * cleanly-licensed set. Recorded here so the next person is not surprised.
 *
 * Mapping. The source has 13 cards per suit (1..13); tressette uses ten:
 *   our column 0..6  -> source 1..7   (pips)
 *   our column 7     -> source 11     (fante)
 *   our column 8     -> source 12     (cavallo)
 *   our column 9     -> source 13     (re)
 * Rows are the suits in TSeme order (Denari, Coppe, Spade, Bastoni); the source
 * prefixes are d, c, s, b. Column 10 row 0 is the back.
 *
 * The source cards are ~270x564 JPEGs (named .png). Each is drawn to fill its
 * cell, so the card aspect ratio — what DECK_RATIO needs — is CELL_H / CELL_W.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAW = 'https://raw.githubusercontent.com/mhamilt/Italian-decks/main/decks';
// JPEG, not PNG: these cells are photographic scans, and lossless PNG of them
// runs to ~12 MB. JPEG brings it under a megabyte. Transparency is not needed —
// the only cells the game ever reads are the 40 faces and the back, all opaque.
const OUT = fileURLToPath(new URL('../public/decks/bresciane.jpg', import.meta.url));
// Cards display at <=168px, so the cell need not be much larger. Width and JPEG
// quality are overridable (BW, BQ env vars) to tune the size/sharpness balance;
// the ratio is fixed at the source cards' ~2.095 so DECK_RATIO stays valid.
const CELL_W = Number(process.env.BW) || 160;
const RATIO = 486 / 232;                             // the source cards' aspect
const CELL_H = Math.round(CELL_W * RATIO);
const QUALITY = Number(process.env.BQ) || 78;
export { RATIO };

const ROWS = ['d', 'c', 's', 'b'];                  // Denari, Coppe, Spade, Bastoni
const NUM_FOR_COL = [1, 2, 3, 4, 5, 6, 7, 11, 12, 13]; // our col -> source number

async function dataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Gather every cell as {x, y, uri}.
const cells = [];
for (let row = 0; row < ROWS.length; row++) {
  for (let col = 0; col < 10; col++) {
    const name = `${ROWS[row]}${NUM_FOR_COL[col]}`;
    cells.push({ x: col * CELL_W, y: row * CELL_H, uri: await dataUri(`${RAW}/bresciane/${name}.png`) });
    process.stdout.write('.');
  }
}
cells.push({ x: 10 * CELL_W, y: 0, uri: await dataUri(`${RAW}/backs/1.png`) });
process.stdout.write(' fetched\n');

// Lay them out at exact pixel size and screenshot, transparent where empty.
const divs = cells.map(c =>
  `<div style="position:absolute;left:${c.x}px;top:${c.y}px;width:${CELL_W}px;height:${CELL_H}px;` +
  `background-image:url(${c.uri});background-size:100% 100%"></div>`).join('');
const W = CELL_W * 11, H = CELL_H * 4;
// White ground: unused cells (column 10, rows 1-3) are never read by the game,
// and JPEG has no transparency anyway.
const html = `<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;position:relative;background:#fff">${divs}</body></html>`;

const browser = await chromium.launch({ executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(async () => { await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
await page.screenshot({ path: OUT, type: 'jpeg', quality: QUALITY });
await browser.close();
console.log(`wrote ${OUT}  (ratio ${RATIO.toFixed(4)})`);
