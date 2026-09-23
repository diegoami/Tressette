#!/usr/bin/env node
/**
 * Cut the app icon out of the Napoletane sheet.
 *
 *   node tools/make_icons.mjs            # writes assets/ and public/icons/
 *
 * The icon is the top half of the tre di coppe, Napoletane: the tre is the
 * highest card in tressette, and a cup at this size reads as an object rather
 * than as a pattern. The top half is where the card puts its subject — a cup
 * whole, and the top of the second — which is also how Italian court cards are
 * drawn and how Discola cut its own icon.
 *
 * Nothing here redraws anything. The crop is nearest-neighbour scaled
 * (`image-rendering: pixelated`), so every output pixel is one source pixel
 * repeated — the 1997 bitmap, larger. Smooth scaling was tried in Discola and
 * rejected: at icon sizes it turns the art to mush, and PLAN.md §7.7 is explicit
 * that the card art is not to be redrawn. Interpolation invents pixels, which
 * is redrawing by another name.
 *
 * Two crops, not one. The half card is the icon everywhere it is drawn at
 * 48px or more; at 32px two cups in one square are two smudges, so the favicon
 * is the top cup alone, filling it. The card is still what a tab shows when
 * the tab is large enough to show anything.
 *
 * Outputs, and who consumes them:
 *
 *   assets/icon-only.png         1024  @capacitor/assets -> every Android density
 *   assets/icon-foreground.png   1024  the adaptive icon's foreground layer
 *   assets/icon-background.png   1024  the adaptive icon's background layer
 *   public/icons/icon-512.png     512  web app manifest
 *   public/icons/icon-192.png     192  web app manifest
 *   public/icons/apple-touch-icon.png  180
 *   public/icons/favicon-32.png    32  <link rel=icon>, and what stops the
 *                                      browser asking for /favicon.ico
 *   desktop/src-tauri/icons/32x32.png         32  Tauri bundle.icon
 *   desktop/src-tauri/icons/128x128.png      128  Tauri bundle.icon
 *   desktop/src-tauri/icons/128x128@2x.png   256  Tauri bundle.icon
 *   desktop/src-tauri/icons/icon.png         512  Tauri bundle.icon
 *   desktop/src-tauri/icons/icon.ico  16/32/48/256  the Windows resource: the
 *                                      window, the taskbar and the .exe itself
 *
 * The .ico is a real multi-size icon, PNG frames in an ICO container (Windows
 * reads those since Vista), so Windows picks the frame it needs instead of
 * scaling one. Its 16 and 32 frames are the cup, like the favicon, for the
 * same reason: below 48px the half card is two smudges.
 *
 * playwright-core does the drawing, as it does in tools/import_bresciane.mjs:
 * it is already the one dev dependency, and a browser screenshot is an exact
 * PNG of an exact box. No image library enters the project for this.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHEET = 'data:image/png;base64,' +
  readFileSync(ROOT + 'public/decks/napoletane.png').toString('base64');

// The Napoletane cell, on pack_cards.py's 11x4 grid: columns 0..9 are card
// numbers 1..10, rows 0..3 are the suits in TSeme order (Denari, Coppe, Spade,
// Bastoni). The tre di coppe is column 2, row 1.
const CW = 78, CH = 128, COL = 2, ROW = 1;

// Crops inside that cell, in card pixels, measured off the 78x128 cell. HALF
// is the top half of the card, taken just inside its printed border so the
// rounded corners do not clip into the felt; CUP is the upper cup alone, which
// sits at y 11..61 between x 6 and x 42.
const HALF = { x: 3, y: 3, w: 72, h: 58 };
const CUP = { x: 6, y: 11, w: 36, h: 50 };

// The ground under the card. --felt and --rail from public/index.html: the
// icon is the same table, lit the same way.
const FELT = '#1e5140', FELT_LIT = '#2a6b54';

// pad is the share of the square left as felt on each side. The adaptive
// foreground needs much more of it: Android masks an adaptive icon to a shape
// that can cut a quarter off every edge, so the card has to sit well inside.
const OUT = [
  ['assets/icon-only.png',             1024, HALF, 0.12],
  ['assets/icon-foreground.png',       1024, HALF, 0.26],
  ['public/icons/icon-512.png',         512, HALF, 0.12],
  ['public/icons/icon-192.png',         192, HALF, 0.12],
  ['public/icons/apple-touch-icon.png', 180, HALF, 0.12],
  ['public/icons/favicon-32.png',        32, CUP, 0.05],
  ['desktop/src-tauri/icons/32x32.png',        32, CUP, 0.05],
  ['desktop/src-tauri/icons/128x128.png',     128, HALF, 0.12],
  ['desktop/src-tauri/icons/128x128@2x.png',  256, HALF, 0.12],
  ['desktop/src-tauri/icons/icon.png',        512, HALF, 0.12],
];

// The .ico's frames: the crop each size gets follows the same 48px line.
const ICO = 'desktop/src-tauri/icons/icon.ico';
const ICO_FRAMES = [[16, CUP, 0.05], [32, CUP, 0.05], [48, HALF, 0.12], [256, HALF, 0.12]];

// An ICO of PNG frames: a 6-byte header, a 16-byte entry per frame, then the
// PNGs back to back. A size of 256 is written as 0, which is how the format
// spells it in a byte.
const ico = frames => {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(([size, png], i) => {
    const e = 6 + 16 * i, dim = size >= 256 ? 0 : size;
    header.writeUInt8(dim, e);
    header.writeUInt8(dim, e + 1);
    header.writeUInt16LE(1, e + 4);            // colour planes
    header.writeUInt16LE(32, e + 6);           // bits per pixel
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map(([, png]) => png)]);
};

const square = (size, crop, pad) => {
  // Scale the crop so its longest side fills what the padding leaves.
  const inner = size * (1 - 2 * pad);
  const k = Math.min(inner / crop.w, inner / crop.h);
  return `<body style="margin:0;width:${size}px;height:${size}px;display:flex;
    align-items:center;justify-content:center;
    background:radial-gradient(120% 120% at 50% 0%, ${FELT_LIT}, ${FELT} 70%)">
    <div style="width:${crop.w * k}px;height:${crop.h * k}px;
      background-image:url(${SHEET});
      background-size:${CW * 11 * k}px ${CH * 4 * k}px;
      background-position:-${(COL * CW + crop.x) * k}px -${(ROW * CH + crop.y) * k}px;
      image-rendering:pixelated"></div></body>`;
};

mkdirSync(ROOT + 'assets', { recursive: true });
mkdirSync(ROOT + 'public/icons', { recursive: true });
mkdirSync(ROOT + 'desktop/src-tauri/icons', { recursive: true });

const browser = await chromium.launch();
const shoot = async (size, crop, pad, path) => {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(square(size, crop, pad));
  const png = await page.screenshot(path ? { path } : {});
  await page.close();
  return png;
};
for (const [file, size, crop, pad] of OUT) {
  await shoot(size, crop, pad, ROOT + file);
  console.log(`wrote ${file}  ${size}x${size}`);
}
const frames = [];
for (const [size, crop, pad] of ICO_FRAMES) frames.push([size, await shoot(size, crop, pad)]);
writeFileSync(ROOT + ICO, ico(frames));
console.log(`wrote ${ICO}  ${ICO_FRAMES.map(([s]) => s).join('/')}`);

// The adaptive icon's background layer is the felt alone — no card, because
// Android slides the two layers against each other and anything drawn here
// would drift out from under the foreground.
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;width:1024px;height:1024px;
  background:radial-gradient(120% 120% at 50% 0%, ${FELT_LIT}, ${FELT} 70%)"></body>`);
await page.screenshot({ path: ROOT + 'assets/icon-background.png' });
console.log('wrote assets/icon-background.png  1024x1024');
await browser.close();
