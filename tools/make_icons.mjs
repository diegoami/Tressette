#!/usr/bin/env node
/**
 * Cut the app icon out of the Trevisane sheet.
 *
 *   node tools/make_icons.mjs            # writes assets/ and public/icons/
 *
 * The icon is the tre di denari: the highest card in tressette, and the one
 * that names the game twice over. Three coins, and at a glance they read as
 * three of something — which is all an icon has to do.
 *
 * Nothing here redraws anything. The crop is nearest-neighbour scaled
 * (`image-rendering: pixelated`), so every output pixel is one source pixel
 * repeated — the 1997 bitmap, larger. Smooth scaling was tried in Discola and
 * rejected: at icon sizes it turns the art to mush, and CLAUDE.md is explicit
 * that the card art is not to be redrawn. Interpolation invents pixels, which
 * is redrawing by another name.
 *
 * Two crops, not one. The whole card is the icon everywhere it is drawn at
 * 48px or more; at 32px the three coins collapse into three smudges, so the
 * favicon is the middle coin alone, filling the square. The card is still what
 * a tab shows when the tab is large enough to show anything.
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
 *
 * playwright-core does the drawing, as it does in tools/import_bresciane.mjs:
 * it is already the one dev dependency, and a browser screenshot is an exact
 * PNG of an exact box. No image library enters the project for this.
 */
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHEET = 'data:image/png;base64,' +
  readFileSync(ROOT + 'public/decks/trevisane.png').toString('base64');

// The Trevisane cell, on pack_cards.py's 11x4 grid: columns 0..9 are card
// numbers 1..10, rows 0..3 are the suits in TSeme order (Denari, Coppe, Spade,
// Bastoni). The tre di denari is column 2, row 0.
const CW = 60, CH = 125, COL = 2, ROW = 0;

// Crops inside that cell, in card pixels, measured off the 60x125 cell: the
// three coins run from y 5 to y 118 between x 7 and x 53, and the middle one
// sits at y 44..84.
const CARD = { x: 7, y: 5, w: 46, h: 113 };
const COIN = { x: 10, y: 44, w: 40, h: 40 };

// The ground under the card. --felt and --rail from public/index.html: the
// icon is the same table, lit the same way.
const FELT = '#1e5140', FELT_LIT = '#2a6b54';

// pad is the share of the square left as felt on each side. The adaptive
// foreground needs much more of it: Android masks an adaptive icon to a shape
// that can cut a quarter off every edge, so the card has to sit well inside.
const OUT = [
  ['assets/icon-only.png',             1024, CARD, 0.12],
  ['assets/icon-foreground.png',       1024, CARD, 0.26],
  ['public/icons/icon-512.png',         512, CARD, 0.12],
  ['public/icons/icon-192.png',         192, CARD, 0.12],
  ['public/icons/apple-touch-icon.png', 180, CARD, 0.12],
  ['public/icons/favicon-32.png',        32, COIN, 0.05],
];

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

const browser = await chromium.launch();
for (const [file, size, crop, pad] of OUT) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(square(size, crop, pad));
  await page.screenshot({ path: ROOT + file });
  await page.close();
  console.log(`wrote ${file}  ${size}x${size}`);
}

// The adaptive icon's background layer is the felt alone — no card, because
// Android slides the two layers against each other and anything drawn here
// would drift out from under the foreground.
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;width:1024px;height:1024px;
  background:radial-gradient(120% 120% at 50% 0%, ${FELT_LIT}, ${FELT} 70%)"></body>`);
await page.screenshot({ path: ROOT + 'assets/icon-background.png' });
console.log('wrote assets/icon-background.png  1024x1024');
await browser.close();
