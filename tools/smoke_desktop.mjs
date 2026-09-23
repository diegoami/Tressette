#!/usr/bin/env node
/**
 * Smoke-test the built desktop app: the real tressette.exe, not public/ in a
 * browser.
 *
 *   node tools/smoke_desktop.mjs                 # desktop/src-tauri/target/release/tressette.exe
 *   node tools/smoke_desktop.mjs path/to/tressette.exe
 *
 * tools/check_ui.mjs measures public/ over file://, and the app embeds those
 * same bytes, so the layout is already checked. What the check cannot see is
 * what only the wrapper can break: the page served from the app's own origin,
 * the decks and fonts over the asset protocol, and localStorage surviving a
 * restart. Discola ran this by hand, with a probe injected into a throwaway
 * build; here nothing is injected. WebView2 opens a DevTools port when
 * WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS asks for one, and playwright-core, the
 * one dev dependency, attaches to it over CDP.
 *
 * Two launches. The first plays a whole deal through the fan and changes the
 * deck in the settings; the second has to find both. WEBVIEW2_USER_DATA_FOLDER
 * points the app at a temporary profile, so the smoke never writes into the
 * player's own history, and every run starts from empty storage.
 *
 * Windows only, like the build. Exit code 0 means every check passed.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXE = process.argv[2] || join(ROOT, 'desktop/src-tauri/target/release/tressette.exe');
const PORT = 9333;
const ORIGIN = 'http://tauri.localhost';
const DECKS = ['bresciane.jpg', 'francesi.png', 'napoletane.png',
               'piacentine.png', 'romagnole.png', 'trevisane.png'];

if (!existsSync(EXE)) {
  console.error(`no app at ${EXE}: build it first (cd desktop && npm run build)`);
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), 'tressette-smoke-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (ok, what, detail = '') => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
};

async function launch() {
  const proc = spawn(EXE, [], {
    stdio: 'ignore',
    env: { ...process.env,
           WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
           WEBVIEW2_USER_DATA_FOLDER: profile },
  });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch {}
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith(ORIGIN));
    if (!page) await sleep(250);
  }
  if (!page) throw new Error(`no page at ${ORIGIN} in the app`);
  await page.waitForFunction(() => typeof state === 'object' && document.readyState === 'complete');
  return { proc, browser, page };
}

// Closed the way a player closes it: taskkill without /F posts WM_CLOSE to
// the window, so the restart finds what a real restart would. A hard kill is
// the fallback if the window does not close.
async function quit({ proc, browser }) {
  await browser.close().catch(() => {});
  const exited = new Promise(r => proc.once('exit', r));
  spawn('taskkill', ['/PID', String(proc.pid)], { stdio: 'ignore' });
  await Promise.race([exited, sleep(10000).then(() => proc.kill())]);
  await sleep(1500);   // WebView2's own processes let go of the profile after the host
}

// One legal card, the way a player plays it: a tap raises it, a second plays
// it. As in check_ui.mjs's deal pass, located by slot, because the fan is
// sorted and the nth card in the DOM is not slot n. The taps go to measured
// points through page.mouse rather than locator.click: attached to WebView2
// over CDP, Playwright's visibility check never passes for the fan's cards,
// though they are on screen at full size and the page takes the taps.
async function playDeal(page) {
  let plays = 0;
  for (let i = 0; i < 800 && plays < 20; i++) {
    await sleep(100);
    const slot = await page.evaluate(() => {
      if (state.over || state.deveGiocare !== BASSO) return null;
      const led = state.perPrimo === BASSO ? null : state.played[state.perPrimo];
      return mosseLegali(state.hands[BASSO], led)[0] ?? null;
    });
    if (slot === null) {
      if (await page.evaluate(() => state.over)) break;
      continue;
    }
    const card = page.locator(`.hand--you .card[data-slot="${slot}"]`);
    let box = await card.boundingBox();
    await page.mouse.click(box.x + 6, box.y + 20);
    await sleep(120);
    box = await card.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(120);
    plays++;
  }
  return plays;
}

try {
  console.log(`first launch  ${EXE}`);
  let app = await launch();
  let { page } = app;
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  const origin = await page.evaluate(() => location.origin);
  check(origin === ORIGIN, 'served from the app origin', origin);
  // The window's size is the webview's viewport. 1280x800 is the size the UI
  // check's 'desktop window' row measures, so it has to be what opens.
  const inner = await page.evaluate(() => [innerWidth, innerHeight]);
  check(inner[0] === 1280 && inner[1] === 800, 'the window opens at 1280x800',
        `${inner[0]}x${inner[1]}`);
  const sheets = await page.evaluate(decks => Promise.all(decks.map(d => new Promise(r => {
    const i = new Image();
    i.onload = () => r([d, i.naturalWidth]);
    i.onerror = () => r([d, 0]);
    i.src = 'decks/' + d;
  }))), DECKS);
  const missing = sheets.filter(([, w]) => !w).map(([d]) => d);
  check(!missing.length, `all ${DECKS.length} decks load over the asset protocol`,
        missing.join(', '));

  // Not the default deck, Trevisane, or a lost setting would still pass. And
  // spelt as the page spells it: an unknown name is a state no player can
  // reach, and the deal played under 'trevisane' was never recorded at all.
  await page.evaluate(() => { applyDeck('Napoletane'); save(); });
  await page.click('#play');
  await page.waitForFunction(() => document.querySelectorAll('.hand--you .card').length === 10,
                             null, { timeout: 5000 }).catch(() => {});
  const dealt = await page.locator('.hand--you .card').count();
  check(dealt === 10, 'a deal puts ten cards in your hand', String(dealt));
  const plays = await playDeal(page);
  const over = await page.waitForFunction(() => state.over, null, { timeout: 5000 })
    .then(() => true, () => false);
  check(over && plays === 20, 'a whole deal plays through the fan', `${plays} cards played`);
  await page.waitForFunction(() => !document.querySelector('#result').hidden,
                             null, { timeout: 5000 }).catch(() => {});
  const title = await page.evaluate(() => document.querySelector('#resultTitle')?.textContent.trim());
  check(!!title, 'the end of the hand shows its result', title);
  const recorded = await page.evaluate(() => JSON.parse(localStorage.getItem(HKEY) || '[]').length);
  check(recorded === 1, 'the hand is recorded in the history', `${recorded} hands`);

  // Every face the page declares, loaded from the app and not the network.
  // Fonts load on use, so they are asked for explicitly first.
  const fonts = await page.evaluate(async () => {
    await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
    return [...document.fonts].map(f => `${f.family} ${f.weight} ${f.status}`);
  });
  const unloaded = fonts.filter(f => !f.endsWith('loaded'));
  check(fonts.length && !unloaded.length, `all ${fonts.length} @font-face rules load`,
        unloaded.join(', '));
  const foreign = await page.evaluate(o => performance.getEntriesByType('resource')
    .map(e => e.name).filter(n => !n.startsWith(o)), ORIGIN);
  check(!foreign.length, 'nothing is fetched from outside the app', foreign.join(', '));
  check(!errors.length, 'no script errors', errors.join(' | '));
  await quit(app);

  console.log('second launch');
  app = await launch();
  ({ page } = app);
  const kept = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem(HKEY) || '[]').length,
    deck: state.deck,
  }));
  check(kept.history === 1, 'the hand is in the history after a restart', `${kept.history} hands`);
  check(kept.deck === 'Napoletane', 'the deck chosen before the restart is still chosen', kept.deck);
  await quit(app);
  check(readdirSync(profile).length > 0, 'the app wrote to the temporary profile, not the player\'s');
} catch (e) {
  failed++;
  console.log(`  FAIL  ${e.message}`);
} finally {
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks pass.');
process.exit(failed ? 1 : 0);
