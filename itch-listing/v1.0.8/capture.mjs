import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '..', '..');
const index = path.join(root, 'public', 'index.html');
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({
  viewport: { width: 480, height: 720 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('tressette.settings', JSON.stringify({ language: 'en' })));
await page.goto(pathToFileURL(index).href);
await page.locator('#decks .deck-opt').first().waitFor();
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
await page.screenshot({ path: path.join(out, '01-start-portrait.png') });
await page.locator('#play').click();
await page.locator('#viewTable').waitFor({ state: 'visible' });
await page.evaluate(() => { state.speed = 2000; });
await page.waitForFunction(() => state.deveGiocare === BASSO);
await page.evaluate(() => {
  const card = document.querySelector('.hand--you .card:not([hidden]):not([disabled])');
  if (!card) throw new Error('No legal card to play');
  const slot = Number(card.dataset.slot);
  tapped(slot);
  tapped(slot);
});
await page.waitForFunction(() =>
  document.querySelector('#slotOpp').dataset.empty === 'false' &&
  document.querySelector('#slotYou').dataset.empty === 'false');
await page.setViewportSize({ width: 1280, height: 800 });
await page.screenshot({ path: path.join(out, '02-gameplay-desktop.png') });
await page.setViewportSize({ width: 480, height: 720 });
await page.screenshot({ path: path.join(out, '03-gameplay-portrait.png') });

await page.locator('#btnSettings').click();
await page.locator('#viewSettings').waitFor({ state: 'visible' });
await page.screenshot({ path: path.join(out, '04-settings.png') });
await page.locator('#viewSettings [data-back]').click();
await page.locator('#btnAbout').click();
await page.locator('#viewAbout').waitFor({ state: 'visible' });
await page.screenshot({ path: path.join(out, '05-rules-english.png') });

const table = readFileSync(path.join(out, '02-gameplay-desktop.png')).toString('base64');
const font = readFileSync(path.join(root, 'public', 'fonts', 'bodoni-moda.woff2')).toString('base64');
const cover = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 1 });
await cover.setContent(`<!doctype html><html><head><style>
  @font-face{font-family:Bodoni;src:url(data:font/woff2;base64,${font})}
  *{box-sizing:border-box}body{margin:0;background:#173c31;color:#fff}
  .frame{position:relative;width:630px;height:500px;overflow:hidden;border:12px solid #cdb888}
  .game{position:absolute;width:900px;height:563px;object-fit:cover;left:-135px;top:-26px;filter:saturate(1.08) contrast(1.08)}
  .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,40,32,.94),rgba(13,40,32,.68) 47%,rgba(13,40,32,.08) 85%)}
  .mark{position:absolute;left:32px;top:48px;font:600 14px Arial,sans-serif;letter-spacing:.22em;color:#e5d8aa}
  h1{position:absolute;left:30px;top:112px;margin:0;font:700 57px Bodoni,Georgia,serif;letter-spacing:-.04em;text-shadow:0 3px 10px #102b27}
  .rule{position:absolute;left:33px;top:207px;width:126px;height:3px;background:#c6aa68}
  .sub{position:absolute;left:32px;top:229px;font:600 20px Arial,sans-serif;letter-spacing:.08em}
  .details{position:absolute;left:32px;bottom:50px;font:600 15px Arial,sans-serif;line-height:1.65;letter-spacing:.045em;color:#f3e9d4}
  .border{position:absolute;inset:8px;border:1px solid rgba(247,230,186,.6);pointer-events:none}
</style></head><body><div class="frame"><img class="game" src="data:image/png;base64,${table}"><div class="shade"></div><div class="border"></div><div class="mark">ITALIAN CARD GAME</div><h1>Tressettette</h1><div class="rule"></div><div class="sub">TWO-PLAYER TRESSETTE</div><div class="details">SIX REGIONAL DECKS<br>FOUR OPPONENTS</div></div></body></html>`);
await cover.evaluate(() => document.fonts.ready);
await cover.screenshot({ path: path.join(out, 'cover-630x500.png') });

await browser.close();
if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
console.log(`Created cover and five real game screenshots in ${out}`);
