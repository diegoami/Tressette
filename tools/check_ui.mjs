#!/usr/bin/env node
/**
 * UI check for Tressette. Run it after any UI change.
 *
 *   node tools/check_ui.mjs [path-to-index.html]   # defaults to public/index.html
 *
 * Needs playwright-core and a Chromium binary:
 *   npm run setup                                    # or npm i && npx playwright-core install chromium
 *   CHROME=/path/to/chrome node tools/check_ui.mjs   # or name one yourself
 *
 * Five passes. The middle two are Discola's, because the failures that project
 * shipped came in two different shapes; the last plays a deal, because a table
 * can measure perfectly and still not be wired to the engine.
 *
 * 0. DOCUMENT — the four document facts that cannot be expressed as a layout
 *    assertion: the viewport meta, the doctype, the charset and <html lang>.
 *
 * 1. FONTS — the page must not need the internet: every character it sets is
 *    inside the subset in fonts/, every @font-face loads with the network cut,
 *    and nothing at all is fetched from outside. A face that does not arrive
 *    throws nothing and simply sets narrower than every threshold below.
 *
 * 2. SCREENS — every screen and both dialogs, at a handful of real device
 *    shapes. Catches things that are wrong anywhere: more than one screen
 *    visible at once, text set too small to read, clipped labels, tap targets
 *    below the thumb, sideways scroll, script errors.
 *
 * 3. TABLE — the card table only, at every viewport and in all six decks, and
 *    then the tightest five again with the spacing tokens inflated.
 *    The card size is a budget, (viewport height - chrome) / rows, and when
 *    that budget is wrong nothing throws and nothing looks broken in review:
 *    the cards quietly overlap, or your hand slides below the fold, or the
 *    rows drift apart until the table stops reading as one surface. Each of
 *    those shipped once. They are assertions now.
 *
 * 4. DEAL — one whole deal against the house opponent, played through the fan by tapping,
 *    at one viewport in one deck, then a second deal abandoned through the
 *    confirm. It asserts the game can be finished, recorded and walked away
 *    from, not how it looks.
 *
 * Every threshold below is calibrated against a real defect, not taste. If you
 * relax one, check it still fails the commit that introduced the bug it names.
 */
import { chromium } from 'playwright-core';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// fileURLToPath, not URL.pathname, and pathToFileURL, not 'file://' + path.
// On Windows a file URL's pathname is "/C:/...", which path.resolve then reads
// as a relative path and prefixes with the cwd's drive, producing "C:\C:\..." —
// the check could not find the page it exists to measure, on the platform this
// game is most often built on. These two node:url helpers are right on both.
const FILE = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../public/index.html', import.meta.url)));
const URL_ = pathToFileURL(FILE).href;

// Three ways to find a Chromium, in order: the one CHROME names, the one this
// development container ships, and the one `playwright-core install chromium`
// put in its own cache — which is the only one CI has. Passing a path that does
// not exist fails at launch with a message about the path rather than about the
// missing browser, so the fallback is a check for the file, not a try/catch.
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME || (existsSync(PINNED) ? PINNED : null);

/* ---- viewports ------------------------------------------------------------ */

// Real device shapes. The tall ones in the middle are where the table drifted
// apart: big enough for the cards to hit their cap, after which the leftover
// height had to go somewhere.
const VIEWPORTS = [
  ['Android small',     360,  800],
  ['iPhone 15',         393,  852],
  ['Pixel',             412,  915],
  ['iPhone Pro Max',    430,  932],
  ['narrow and tall',   360, 1200],
  ['big phone',         600, 1200],
  ['tall phone A',      700, 1400],
  ['tall phone B',      770, 1475],
  ['tall phone C',      800, 1600],
  ['tablet portrait',   600,  853],
  ['iPad',              768, 1024],
  ['iPad Air',          820, 1180],
  ['iPad Pro',         1024, 1366],
  ['tablet landscape', 1180,  820],
  ['phone landscape',   980,  385],
  ['phone desktop-mode',1045, 2265],
  ['laptop',           1440,  900],
  ['laptop short',     1366,  700],
  ['desktop',          1920, 1080],
];

// Enough shapes to cover the ways a screen can go wrong, without visiting all
// eight screens at all nineteen sizes.
const SCREEN_VIEWPORTS = ['Android small', 'iPhone Pro Max', 'tablet portrait',
                          'phone landscape', 'laptop'];

// The tightest ones; worth re-running the table budget against inflated spacing.
const TIGHT = ['phone landscape', 'laptop short', 'iPad', 'tablet portrait', 'Android small'];

// Every deck the page offers, and the table pass renders all of them: each one
// has its own --ratio, and the card budget is divided by that ratio, so a deck
// is a different table. Bresciane is the tallest of the six.
const DECKS = ['Trevisane', 'Romagnole', 'Napoletane', 'Piacentine', 'Francesi', 'Bresciane'];

// Raising a card is a transition, and every measurement below is taken on the
// tick that starts it — where the box is still the unraised one. The raised-card
// assertions were reading the geometry they exist to catch: reversing the lift
// so a raised card hangs off the bottom of the screen passed the whole check.
// Motion off for the measuring passes, so a measurement is of where the page
// settles rather than of where it starts.
const STILL = '*, *::before, *::after{ transition: none !important; animation: none !important; }';

/* ---- getting to each screen ----------------------------------------------- */

// Every screen and dialog the page has, and the states worth looking at inside
// them. A row that cannot reach its screen is a check that silently passes, so
// rows arrive with their screens — these five came with iteration 4.
const SCREENS = [
  { name: 'start, after a hand', open: async p => {
      // #lastResult only exists once something has been played, and the screens
      // pass clears the history before every row, so this line had never been
      // on screen when any rule ran.
      await p.evaluate(() => {
        localStorage.setItem('tressette.history', JSON.stringify(
          [{ t: Date.now(), o: 'Graziano', d: 'Trevisane', y: 11, a: 4 }]));
        renderLastResult();
      });
    } },
  // The review of iteration 5: nothing ever rendered an opponent other than the
  // default, so two new dossiers and a rolled weights table went into the game
  // without a single rule ever looking at them. Rule 3 again.
  { name: 'start, an opponent other than the default', open: async p => {
      // Valerio's dossier, four lines on a phone where Graziano's is three. The
      // row used to select Graziano and call him the loosest, both of which were
      // true of the vector that is now Valerio's: the name moved and the row did
      // not follow it, so the screen rules were reading the shortest of the four.
      // Which one is longest is not this row's business — the rule below cycles
      // all four, and that is what caught Piero's dossier growing to five lines
      // and pushing the deck row 15px down the phone.
      await p.evaluate(() => selectOpponent('Valerio'));
    },
    // The dossier holds three lines open so that switching opponent does not
    // move the deck row under the player's thumb. That is a claim about a
    // layout, so it is measured: pick each of them in turn and watch the row.
    check: () => {
      const top = () => Math.round(document.querySelector('.decks').getBoundingClientRect().top);
      const was = state.opponent;
      const tops = Object.keys(PROFILES).map(name => { selectOpponent(name); return [name, top()]; });
      selectOpponent(was);
      const spread = Math.max(...tops.map(t => t[1])) - Math.min(...tops.map(t => t[1]));
      return spread > 1
        ? [`the deck row moves ${spread}px when the opponent changes (` +
           tops.map(([n, t]) => `${n} ${t}`).join(', ') + ')']
        : [];
    } },
  { name: "settings, the rolled opponent's weights", open: async p => {
      await p.evaluate(() => selectOpponent('Piero'));
      await p.click('#play');
      await p.click('#btnSettings');
      await p.evaluate(() => { document.querySelector('#viewSettings details').open = true; });
    } },
  { name: 'start', open: async () => {},
    // The primary action has to be reachable without hunting for it. Readable
    // type pushed it past the fold once; a pinned footer is the fix, and this
    // is what stops it drifting back.
    check: () => {
      const r = document.querySelector('#play').getBoundingClientRect();
      return (r.bottom > window.innerHeight + 1 || r.top < -1)
        ? [`Gioca is off screen (bottom ${Math.round(r.bottom)} vs viewport ${window.innerHeight})`]
        : [];
    } },
  { name: 'table',  open: async p => { await p.click('#play'); } },
  // The longest thing the game can say: a hand of ten can hold a napoletana and
  // three sets at once. announce() is the page's own, so this is the real text
  // at the real size, in the place the page really puts it.
  { name: 'table, a declaration', open: async p => {
      await p.click('#play');
      await p.evaluate(() => announce(ALTO, [
        { kind: 'napoletana', suit: 0, points: 3 },
        { kind: 'set', n: 1, count: 3, points: 3 },
        { kind: 'set', n: 2, count: 3, points: 3 },
        { kind: 'set', n: 3, count: 3, points: 3 }]));
    },
    // It floats over the table, so the two things that make that safe are
    // assertions: it stays on the table, and it never reaches the cards you are
    // choosing between.
    check: () => {
      const a = document.querySelector('.announce').getBoundingClientRect();
      const t = document.querySelector('.table').getBoundingClientRect();
      const you = document.querySelector('.seat--you').getBoundingClientRect();
      return [
        (a.top < t.top - 1 || a.bottom > t.bottom + 1 || a.left < t.left - 1 || a.right > t.right + 1)
          && `the declaration is outside the table (${Math.round(a.top)}…${Math.round(a.bottom)} `
             + `vs ${Math.round(t.top)}…${Math.round(t.bottom)})`,
        a.bottom > you.top && `the declaration covers your own seat by ${Math.round(a.bottom - you.top)}px`,
      ].filter(Boolean);
    } },
  { name: 'settings', open: async p => {
      await p.click('#play');
      await p.click('#btnSettings');
      // The disclosure is shut by default, and the weights table is the state
      // somebody reading their opponent is in. It has to be opened here rather
      // than in `check`: the audit has already run by the time a row's own
      // check is called, so a table of weights opened there was never audited.
      await p.evaluate(() => { document.querySelector('#viewSettings details').open = true; });
    } },
  { name: 'history, empty', open: async p => { await p.click('#play'); await p.click('#btnHistory'); } },
  { name: 'history, a hundred hands', open: async p => {
      // The cap, so the tally, the per-opponent table and the log are all at
      // their widest: three-figure counts and four names.
      await p.evaluate(() => {
        const now = Date.now();
        localStorage.setItem('tressette.history', JSON.stringify(
          Array.from({ length: 100 }, (_, i) => ({
            t: now - i * 36e5, o: ['Franco', 'Valerio', 'Graziano', 'Piero'][i % 4],
            d: 'Trevisane', y: 15 - (i % 16), a: i % 16 }))));
      });
      await p.click('#play');
      await p.click('#btnHistory');
    } },
  { name: 'history, written by something else', open: async p => {
      // Entries from another shape — an older build, a null, a number. They
      // used to throw mid-render and leave the sheet without its log and
      // without the button that clears it, so there was no way out from inside
      // the game.
      await p.evaluate(() => {
        localStorage.setItem('tressette.history', JSON.stringify(
          [null, 7, { o: 'Franco' }, { t: Date.now(), o: 'Franco', d: 'Trevisane', y: 6, a: 5 }]));
      });
      await p.click('#play');
      await p.click('#btnHistory');
    },
    check: () => [...document.querySelectorAll('#historyBody button')]
      .some(b => /Cancella/.test(b.textContent))
      ? [] : ['the history has no way to clear itself'] },
  // The one screen here that is READ rather than glanced at, and since the
  // owner asked for it, the one that says the same rules twice. Both halves are
  // asserted, because "the rules are in both languages" checked as *a lang
  // attribute exists somewhere* passes a page whose English is tagged Italian.
  { name: 'about', open: async p => { await p.click('#play'); await p.click('#btnAbout'); },
    check: () => {
      const out = [];
      const section = lang => document.querySelector(`#viewAbout section[lang="${lang}"]`);
      const blocks = lang => {
        const sec = section(lang);
        return sec ? [...sec.querySelectorAll('p, h3')]
          .map(e => e.textContent.replace(/\s+/g, ' ').trim()) : [];
      };
      // The four things a tressette player has to be told — and the probe for
      // each is in that language, which is the whole point of the row. Written
      // as one table matching either language (`/undici|eleven/`, `/3, 2,
      // (asso|ace)/`), the rule passed a page whose English half was the
      // Italian text under an `en` tag: every probe matched the Italian. That
      // is the defect this row exists to catch, so the probes have to be able
      // to tell the two apart. `napoletana` is the same word in both and
      // cannot, which is why it is not the only one.
      // Five, because the review of the first version found the screen gave the
      // rank order, said there is no briscola, and never said who *takes* the
      // trick — the one rule a player cannot do without. A rule missing from
      // both halves is not drift, so nothing that compares the halves can see
      // it; only a rule that names it can.
      const SAYS = {
        it: [['card order', /3, 2, asso/], ['declarations', /napoletana/],
             ['following suit', /a colore/], ['eleven points', /undici/],
             ['trick-taking rule', /carta più alta/]],
        en: [['card order', /3, 2, ace/], ['declarations', /napoletana/],
             ['following suit', /follow/], ['eleven points', /eleven/],
             ['trick-taking rule', /highest card/]],
      };
      const said = {};
      for (const lang of ['it', 'en']) {
        const bs = blocks(lang);
        const words = bs.join(' ').split(' ').filter(Boolean).length;
        if (bs.length < 5)
          out.push(`the rules have ${bs.length} block(s) in ${lang}, want at least 5`);
        if (words < 200)
          out.push(`the rules run to ${words} words in ${lang}, which is a note and not the rules`);
        const text = bs.join(' ').toLowerCase();
        said[lang] = text;
        for (const [what, re] of SAYS[lang])
          if (!re.test(text)) out.push(`the rules in ${lang} never state the ${what}`);
        // Everything above reads textContent, which a half that is not painted
        // still has: `section[lang="en"]{ display: none }` passed every rule in
        // this row. In a project whose defects are all invisible in the diff and
        // throw no error, a rule that cannot tell a rendered half from a hidden
        // one is not measuring the screen.
        const sec = section(lang);
        if (sec && !sec.getClientRects().length)
          out.push(`the rules in ${lang} are in the page but not on the screen`);
      }
      // And the cheapest statement of the same thing: two halves that are the
      // same text are one half told twice, whatever they are tagged.
      if (said.it && said.it === said.en)
        out.push('both halves of the rules are the same text');
      // And back goes to the deal it was opened from: a Back that always lands
      // on the start sheet abandons the hand of anyone who opened the rules to
      // check what a napoletana is worth.
      const backButton = document.querySelector('#viewAbout [data-back]');
      if (!backButton) {
        // Unguarded, this threw inside page.evaluate and took the whole run
        // with it: the table, tight-token and deal passes never ran, so one
        // missing attribute hid every other assertion in the file. A row
        // reports; it does not decide whether the rest of the check happens.
        out.push('the rules have no Back button');
      } else {
        backButton.click();
        if (document.getElementById('viewTable').hidden)
          out.push('the rules were opened from the table and went back to the start sheet');
      }
      return out;
    } },
  { name: 'the abandon confirm', open: async p => { await p.click('#play'); await p.click('#again'); },
    // Without this the row passes on a page that never asks: a new deal is a
    // perfectly good screen, and the audit has nothing to object to.
    check: () => document.querySelector('#confirmScrim').hidden
      ? ['the confirm did not open over a deal in play'] : [] },
  { name: 'the result, with declarations', open: async p => {
      await p.click('#play');
      // The dialog at its longest: both players declaring, which is where the
      // extra line and the widest numbers are.
      await p.evaluate(() => {
        state.over = true;
        state.terzi = [17, 15];
        // A hand the deck can deal: the opponent holds the napoletana di denari
        // and three 2s, you hold the three 3s that are left. Four assi against
        // a napoletana di denari needs the asso di denari twice.
        state.accusi[BASSO] = [{ kind: 'set', n: 3, count: 3, points: 3 }];
        state.accusi[ALTO] = [{ kind: 'napoletana', suit: 0, points: 3 },
                              { kind: 'set', n: 2, count: 3, points: 3 }];
        state.prese = [11, 9];
        finish();
      });
    } },
  { name: 'the result, reached from a sheet', open: async p => {
      await p.click('#play');
      await p.click('#btnHistory');
      await p.evaluate(() => { state.over = true; state.terzi = [17, 15]; state.prese = [12, 8]; finish(); });
    },
    // The deal ends while you are reading the history: the dialog used to open
    // over the sheet, and "Ancora" dealt the next hand behind it, under a list
    // still saying no hand had ever been played.
    check: () => [
      screen !== 'table' && `the result opened over the ${screen} sheet`,
      ...[...document.querySelectorAll('.view')].filter(v => !v.hidden && v.id !== 'viewTable')
        .map(v => `${v.id} is still on screen under the result`),
    ].filter(Boolean) },
  { name: 'the result, over the abandon confirm', open: async p => {
      await p.click('#play');
      await p.click('#again');
      await p.evaluate(() => { state.over = true; state.terzi = [12, 20]; state.prese = [8, 12]; finish(); });
    },
    // The hand ends while the confirm is up. The question is about a deal that
    // no longer exists, and its promise that nothing is written down stopped
    // being true the moment finish() recorded it.
    check: () => document.querySelector('#confirmScrim').hidden ? []
      : ['the abandon confirm is still open under the result dialog'] },
  { name: "table, the opponent's hand face up", open: async p => {
      // The 1997 easter egg, typed the way it is typed — on the start sheet,
      // because at the table every digit is a card key and the word has four
      // of them in it. It is also the only row that drives the page entirely
      // through the keyboard.
      await p.keyboard.type('6winouj64ie');
      await p.click('#play');
    },
    check: () => {
      const backs = [...document.querySelectorAll('.hand--opp .card')]
        .filter(c => c.style.getPropertyValue('--col') === '10').length;
      return [
        document.querySelector('#cheatNote').hidden && 'the face-up note is not shown',
        backs > 0 && `${backs} of the opponent's cards are still face down`,
      ].filter(Boolean);
    } },
  { name: 'table, a card raised', open: async p => {
      await p.click('#play');
      // Raised straight through the state, because this pass is about how the
      // screen reads, not about whether a tap reaches the strip — the deal pass
      // taps for real, ten times a deal.
      await p.evaluate(() => { state.selected = 0; render(); });
    } },
];

/* ---- what counts as a defect ---------------------------------------------- */

// Runs in the page. Returns a list of strings; empty means clean.
const audit = () => {
  const out = [];
  const name = el => el.id ? '#' + el.id
    : (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/)[0]
        : el.tagName.toLowerCase());

  const shown = el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  // Exactly one screen. An author `display` rule beats the UA stylesheet's
  // [hidden]{display:none}, which once left every screen stacked on top of one
  // another with an invisible scrim swallowing every click.
  const open = [...document.querySelectorAll('.view')].filter(v => !v.hidden);
  if (open.length !== 1) out.push(`${open.length} screens visible at once`);

  if (document.documentElement.scrollWidth > window.innerWidth + 1)
    out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${window.innerWidth})`);

  // Sideways scroll is not enough on its own. The table sets `overflow: hidden
  // auto`, so anything too wide is clipped rather than scrollable and the
  // document width never betrays it — the opponent's third card was being cut
  // off a phone screen while that assertion passed. Ask the elements directly.
  // .chips and .decks are the settings sheet's, from iteration 4; they select
  // nothing yet and cost nothing, and the rule is the same when they arrive.
  const past = [...document.querySelectorAll('.hand, .trick, .tallone, .plate, .announce, .chips, .decks')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
    });
  for (const el of past.slice(0, 3)) {
    const r = el.getBoundingClientRect();
    out.push(`${name(el)} runs off the screen (${Math.round(r.left)}…${Math.round(r.right)} `
      + `vs 0…${window.innerWidth})`);
  }

  // The deck picker is one row, whatever the deck table holds. A sixth deck
  // against a hard-coded repeat(5, 1fr) wraps onto a second row and pushes the
  // controls under it down — no overflow, no clipped text, no small tap
  // target, so every other rule here passes a picker that has quietly folded
  // in half. Sharing a top is the whole of "one row", and it is what says the
  // column count JS sets and the deck table it comes from are still in step.
  // Not the CSS fallback beside it: buildDecks sets --deck-cols before the
  // element has any children, so a fallback that disagreed would never be
  // painted, never mind measured.
  const opts = [...document.querySelectorAll('.deck-opt')];
  if (opts.length) {
    const tops = new Set(opts.map(b => Math.round(b.getBoundingClientRect().top)));
    if (tops.size !== 1)
      out.push(`the deck picker is on ${tops.size} rows, not one `
        + `(${opts.length} decks at tops ${[...tops].join(', ')})`);
  }

  // The dropdown a <select> opens is drawn by the operating system, not by
  // this stylesheet, and it inherits the page's ink without inheriting the
  // page's ground: a select left `background: transparent` opened a white
  // system menu with ivory text on it, and the deck names were all but
  // invisible on Windows. Nothing here can measure that popup — which is why
  // this asks the only thing that decides it, and why the options are asked
  // separately from the select. An option inside a closed select reports no
  // box at all, so the loop below never sees one.
  for (const el of document.querySelectorAll('select, select option')) {
    const bg = getComputedStyle(el).backgroundColor;
    const alpha = Number(/^rgba?\(([^)]*)\)/.exec(bg)?.[1].split(',')[3] ?? 1);
    if (!(alpha >= 1))
      out.push(`${name(el)} <${el.tagName.toLowerCase()}> has no ground of its own `
        + `(background-color ${bg}) — the OS draws its popup white`);
  }

  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    // A closed <details> still hands out live geometry for what it is hiding,
    // so without this the rules below measure text nobody is looking at — and
    // report a defect in a state that cannot be reached.
    if (el.closest('details:not([open])') && !el.closest('summary')) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    // Text this element owns directly, not what its children hold.
    const text = [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join(' ').trim();

    if (text) {
      const size = parseFloat(cs.fontSize);
      // Two tiers: a short uppercase label can run smaller than a sentence
      // somebody has to read. Body copy sat at 12.5px until it was measured.
      const floor = text.length > 40 ? 14.5 : 12.5;
      if (size < floor - 0.05)
        out.push(`${name(el)} text ${size.toFixed(1)}px, want ${floor} — "${text.slice(0, 32)}"`);

      // Clipped by a container that cannot scroll, so nobody can reach it.
      if (cs.overflowX === 'hidden' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll'
          && el.scrollWidth > el.clientWidth + 1)
        out.push(`${name(el)} clips its text (${el.scrollWidth} > ${el.clientWidth})`);

      // Cut off from above or below by an ancestor that cannot scroll. The rule
      // above cannot see it, because the element that clips is not the element
      // that holds the text: a declaration inside a strip sized for one line
      // lost half a line off the top and half off the bottom at every phone
      // width, and every assertion here passed.
      for (let up = el; up && up !== document.body; up = up.parentElement) {
        const ucs = getComputedStyle(up);
        if (ucs.overflowY !== 'hidden' || ucs.overflowX === 'auto' || ucs.overflowX === 'scroll') continue;
        const ur = up.getBoundingClientRect();
        const cut = up === el
          ? Math.max(0, el.scrollHeight - el.clientHeight)
          : Math.max(0, ur.top - r.top) + Math.max(0, r.bottom - ur.bottom);
        if (cut > 1)
          out.push(`${name(el)} is cut off by ${Math.round(cut)}px inside ${name(up)}, `
            + `which cannot scroll — "${text.slice(0, 32)}"`);
        break;
      }
    }

    // Thumb-sized targets. Two exclusions: cards, whose size is the table's
    // budget and is asserted by the second pass; and links flowing inline in a
    // sentence, which cannot be 32px tall without wrecking the paragraph they
    // sit in. Standalone controls have no such excuse.
    const inlineLink = el.tagName === 'A' && cs.display.startsWith('inline');
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !el.classList.contains('card') && !inlineLink) {
      const small = Math.min(r.width, r.height);
      if (small < 32)
        out.push(`${name(el)} tap target ${Math.round(r.width)}x${Math.round(r.height)}, want 32`);
    }
  }
  return out;
};

// This used to swallow the Google Fonts stylesheet failing on a machine with
// no network. The fonts are served from fonts/ now, so every request the page
// makes is a file:// one and a network error means the page reached for the
// internet, which is a defect rather than noise. Nothing is filtered.
const noise = () => false;

/* ---- pass 0: the document itself ------------------------------------------- */

// A layout assertion cannot catch a missing viewport meta: Playwright's
// `viewport` option sets the layout viewport directly, and the tag is only
// consulted under mobile emulation. So the page measures identically with or
// without it here, while a real phone lays it out at ~980px and scales the
// result down. These are document facts instead, checked once — cheap, and the
// only thing that would have caught it.
async function checkDocument(browser) {
  console.log('\ndocument');
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.goto(URL_);
  const bad = await page.evaluate(() => {
    const out = [];
    const vp = document.querySelector('meta[name="viewport"]');
    if (!vp) out.push('no viewport meta — a phone will lay the page out at ~980px and scale it down');
    else if (!/width\s*=\s*device-width/.test(vp.content))
      out.push(`viewport meta does not set width=device-width: "${vp.content}"`);
    if (document.compatMode !== 'CSS1Compat')
      out.push('quirks mode — no doctype, so box sizing and table layout differ from every browser default');
    if (document.characterSet !== 'UTF-8')
      out.push(`charset is ${document.characterSet}, not UTF-8 — accented Italian will render as mojibake over file://`);
    if (!document.documentElement.lang)
      out.push('no lang on <html> — screen readers and hyphenation have no language to work from');
    return out;
  });
  await page.close();
  console.log(`  ${bad.length ? 'FAIL' : 'pass'}  head tags`);
  bad.forEach(b => console.log(`        ${b}`));
  return bad.length ? 1 : 0;
}

/* ---- pass 1: the fonts ----------------------------------------------------- */

// The three faces used to be a <link> to fonts.googleapis.com. Nothing failed
// when they did not load: the browser fell back to a generic serif and the
// wordmark set some 12% narrower than every threshold below is calibrated
// against. This check never saw it, because this check has always had the
// network up — and an APK, which is meant to run with the radio off, is where
// that fallback would have shipped. These three assertions are why it cannot
// come back, and the first of them is why the copy cannot outgrow the subset
// without saying so.

// The latin subset the woff2 files were cut to. A character outside it has no
// glyph in what we ship and falls back on its own, mid-word.
const LATIN = (cp) =>
  cp <= 0xFF || cp === 0x131 || (cp >= 0x152 && cp <= 0x153) || (cp >= 0x2BB && cp <= 0x2BC) ||
  cp === 0x2C6 || cp === 0x2DA || cp === 0x2DC || cp === 0x304 || cp === 0x308 || cp === 0x329 ||
  (cp >= 0x2000 && cp <= 0x206F) || cp === 0x20AC || cp === 0x2122 || cp === 0x2191 ||
  cp === 0x2193 || cp === 0x2212 || cp === 0x2215 || cp === 0xFEFF || cp === 0xFFFD;

// Only the ones the page uses; an unknown entity is left alone and will read as
// ASCII, which is harmless here because ASCII is inside the subset anyway.
const ENTITIES = {
  rsquo: 0x2019, lsquo: 0x2018, ldquo: 0x201C, rdquo: 0x201D, laquo: 0xAB, raquo: 0xBB,
  middot: 0xB7, nbsp: 0xA0, mdash: 0x2014, ndash: 0x2013, hellip: 0x2026,
};

async function checkFonts(browser) {
  console.log('\nfonts');
  let failed = 0;

  // Both files that ship, and every kind of entity. engine.js holds the
  // opponents' names and the em dashes of its own comments, so "every
  // character in the page" that reads only index.html is a claim about half
  // the source; and a numeric reference is a character the page sets just as
  // much as a named one is.
  const source = [FILE, path.join(path.dirname(FILE), 'engine.js')]
    .filter(f => existsSync(f))
    .map(f => readFileSync(f, 'utf8'))
    .join('\n')
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => (ENTITIES[name] ? String.fromCodePoint(ENTITIES[name]) : m));
  const outside = new Map();
  for (const ch of source) {
    const cp = ch.codePointAt(0);
    if (cp > 0x7F && !LATIN(cp)) outside.set(ch, 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  }
  console.log(`  ${outside.size ? 'FAIL' : 'pass'}  every character is in the latin subset`);
  if (outside.size) {
    failed++;
    for (const [ch, cp] of outside)
      console.log(`        ${cp} ${ch} — no glyph in fonts/; widen the subset or do not use it`);
  }

  // Everything but the page itself is cut off, which is what an APK sees.
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const external = [];
  await page.route('**', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    external.push(url);
    return route.abort();
  });
  await page.goto(URL_);
  // Ask for each face explicitly. A browser only fetches a face when something
  // on the current screen uses it, so reading .status after load tells you
  // which weights the start screen happens to draw with — not whether the
  // files are there. load() is the question we actually mean.
  const faces = await page.evaluate(async () => {
    const declared = [...document.fonts];
    return Promise.all(declared.map(async (f) => {
      try { await f.load(); } catch { /* status below carries the verdict */ }
      return { family: f.family, weight: f.weight, status: f.status };
    }));
  });
  await page.close();

  const unloaded = faces.filter((f) => f.status !== 'loaded');
  const ok = faces.length > 0 && unloaded.length === 0;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  all ${faces.length} @font-face rules load with the network down`);
  if (!ok) {
    failed++;
    if (!faces.length) console.log('        no @font-face rules at all — the page is on system fonts');
    unloaded.forEach((f) => console.log(`        ${f.family} ${f.weight}: ${f.status}`));
  }

  console.log(`  ${external.length ? 'FAIL' : 'pass'}  no subresource comes from the network`);
  if (external.length) {
    failed++;
    [...new Set(external)].forEach((u) => console.log(`        ${u}`));
  }
  return failed;
}

/* ---- pass 2: every screen -------------------------------------------------- */

async function checkScreens(browser) {
  console.log('\nscreens');
  let failed = 0;
  for (const vname of SCREEN_VIEWPORTS) {
    const [, width, height] = VIEWPORTS.find(v => v[0] === vname);
    for (const screen of SCREENS) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errs = [];
      page.on('pageerror', e => errs.push('script error: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push('console: ' + m.text()); });

      // Load once to clear what an earlier run stored, then again so the page
      // starts from the state it reads at load.
      await page.goto(URL_);
      await page.evaluate(() => localStorage.removeItem('tressette.history'));
      await page.goto(URL_);
      await page.addStyleTag({ content: STILL });
      await page.waitForTimeout(350);
      await screen.open(page);
      await page.waitForTimeout(350);

      const issues = [
        ...(await page.evaluate(audit)),
        ...(screen.check ? await page.evaluate(screen.check) : []),
        ...errs,
      ];
      if (issues.length) failed++;
      console.log(`  ${issues.length ? 'FAIL' : 'pass'}  ${vname.padEnd(16)} ${screen.name}`);
      issues.forEach(i => console.log(`        ${i}`));
      await page.close();
    }
  }
  return failed;
}

/* ---- pass 3: the card table ----------------------------------------------- */

const measure = () => {
  const r = s => document.querySelector(s).getBoundingClientRect();
  const oppHand = r('.hand--opp'), trick = r('.trick'), tallone = r('.tallone');
  const youHand = r('.hand--you'), table = r('.table'), card = r('.hand--you .card');
  // Your whole seat, not just your cards: in portrait the name plate is below
  // the hand, so a hand that clears the fold says nothing about the plate. At
  // 770x1475 the plate hung 15px past the bottom of the screen while this pass
  // printed `pass`, because --plates was a constant and this was measured from
  // the hand.
  const youSeat = r('.seat--you');
  // The strip above your hand that names the raised card. It is content, not
  // space, so it belongs in the boxes below: left out, the room it takes reads
  // as a gap and every good layout fails the drift assertion.
  //
  // It is also the defect that wrote this line. The strip was `hidden` until it
  // had something to say, so it took no space empty and raising a card pushed
  // every card below it down 31px — off the bottom of the screen in landscape.
  // A strip of zero height is that bug, so say so rather than let the numbers
  // below turn to nonsense measuring a box at the origin.
  const say = r('.say');
  const sayShown = say.height > 0;

  // Landscape puts the trick and the tallone side by side; portrait stacks
  // them. Sort the content boxes and measure whatever ends up adjacent, so the
  // numbers mean the same thing in both. Measuring a fixed pair counted the
  // tallone as empty space in portrait — a metric that failed every good
  // layout and passed the bad one.
  const boxes = [oppHand, trick, tallone, ...(sayShown ? [say] : []), youHand].sort((a, b) => a.top - b.top);
  const gaps = [];
  for (let i = 1; i < boxes.length; i++) gaps.push(boxes[i].top - boxes[i - 1].bottom);

  // --- the fan (§3.7) ------------------------------------------------------
  // Ten cards overlap, so each one shows only a strip of itself. Three ways
  // that goes wrong, all of them silent: the strips collapse and a card cannot
  // be singled out; the last card runs under the table's edge; a raised card
  // lifts off the screen.
  const cards = [...document.querySelectorAll('.hand--you .card')].map(c => c.getBoundingClientRect());
  const steps = cards.slice(1).map((c, i) => Math.round(c.left - cards[i].left));
  const pad = parseFloat(getComputedStyle(document.querySelector('.table')).paddingLeft);

  // Dimming has to mean one thing: the follow-suit rule forbids this card. Both
  // states that test it are forced, because a freshly dealt table shows
  // neither — the first deal of a session is always yours to lead, so nothing
  // is forbidden and it is never the opponent's turn. Measured as it was
  // dealt, this assertion could not fail: every card dimmed while the opponent
  // thought, ten translucent cards showing through one another down the fan,
  // and the numbers still agreed.
  const dimmedNow = () => [...document.querySelectorAll('.hand--you .card')]
    .filter(c => parseFloat(getComputedStyle(c).opacity) < 1).length;
  const keep = { turn: state.deveGiocare, primo: state.perPrimo, played: state.played.slice() };

  state.deveGiocare = ALTO; render();
  const dimmedWaiting = dimmedNow();

  // A card of a suit you hold, led against you: the cards of every other suit
  // are the ones the rule forbids, and they are the ones that may dim.
  const suit = state.hands[BASSO].find(c => c).s;
  state.perPrimo = ALTO; state.deveGiocare = BASSO;
  state.played = [null, null];
  state.played[ALTO] = { s: suit, n: 4 };
  render();
  const dimmedFollowing = dimmedNow();
  const forbidden = state.hands[BASSO].filter(c => c && c.s !== suit).length;

  state.deveGiocare = keep.turn; state.perPrimo = keep.primo; state.played = keep.played;
  render();

  // Raise one, measure it, put it back. The raised card is the whole point of
  // the two-tap interaction, and it is the one state that can leave the table.
  const wasSelected = state.selected;
  // The leftmost card in the fan. It used to be written as slot 0, which was
  // the same thing while a hand was shown in the order it was dealt; a sorted
  // hand puts slot 0 anywhere, and this assertion is about the card at the
  // edge of the fan.
  state.selected = ordinaMano(state.hands[BASSO])[0]; render();
  const raised = document.querySelector('.hand--you .card[aria-pressed="true"]').getBoundingClientRect();
  // Raised is also when the name line has something in it, so this is where to
  // check that --say is still in step with the type it reserves room for: the
  // strip clips what does not fit, silently.
  const nameH = document.querySelector('.sel-name').getBoundingClientRect().height;
  // Issue #6: the raise has to read as a state, not as a nudge. Two things
  // make it one, and both are measured here — how far the card comes out of
  // the fan, and whether the line above the hand says what the next tap does.
  // At 18% of a card the lift was shorter than the strip the card came out of,
  // and the line just named the card, so the second tap read as a repeat of
  // the first.
  const raisedLift = Math.round(cards[0].top - raised.top);
  const saysNext = /^Gioca /.test(document.querySelector('.sel-name').textContent);
  state.selected = wasSelected; render();

  // The hand empties, and that is a state no pass had ever rendered. A hand is
  // held sorted now, so it closes up, and a flex row with nothing in it is zero
  // tall: the table re-centred itself twice in the last trick and moved the
  // player's own hand 74px up at 393x852 — while they were choosing the card
  // that decides the deal. It is the failure CLAUDE.md names, arriving
  // sideways: not a row that costs nothing while empty, but a row that has
  // cost something all deal and then stops.
  //
  // Both hands, because they empty one after the other and the first of the two
  // lurches was the opponent's last card leaving, not the player's.
  const rowTops = () =>
    ['.hand--opp', '.trick', '.hand--you'].map(sel => Math.round(r(sel).top));
  const withCards = rowTops();
  const heldHands = state.hands.map(h => h.slice());
  state.hands = [new Array(10).fill(null), new Array(10).fill(null)];
  render();
  const emptied = rowTops();
  state.hands = heldHands; render();
  const rowShift = Math.max(...withCards.map((v, i) => Math.abs(v - emptied[i])));

  return {
    dimmedWaiting, dimmedFollowing, forbidden,
    overlap: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--overlap')),
    minStep: Math.min(...steps),
    stepSpread: Math.max(...steps) - Math.min(...steps),
    fanSpillRight: Math.round(Math.max(0, cards[9].right - (table.right - pad))),
    fanSpillLeft: Math.round(Math.max(0, (table.left + pad) - cards[0].left)),
    raisedAbove: Math.round(table.top - raised.top),
    raisedBelowFold: Math.round(raised.bottom - window.innerHeight),
    sayClip: Math.round(sayShown ? Math.max(0, nameH - say.height) : 0),
    raisedLift, saysNext, rowShift,
    gapTop: Math.round(trick.top - oppHand.bottom),
    sayMissing: !sayShown,
    gapBot: Math.round((sayShown ? say.top : youHand.top) - Math.max(trick.bottom, tallone.bottom)),
    belowFold: Math.round(youSeat.bottom - window.innerHeight),
    overflow: Math.round(youSeat.bottom - table.bottom),
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    maxGap: Math.round(Math.max(0, ...gaps)),
    gapRatio: Math.max(0, ...gaps) / card.height,
    cw: Math.round(card.width), ch: Math.round(card.height),
  };
};

const tableFaults = r => [
  r.gapTop < 0 && `trick overlaps the opponent's hand by ${-r.gapTop}px`,
  r.gapBot < 0 && `trick overlaps your hand by ${-r.gapBot}px`,
  r.sayMissing && 'the name strip takes no space while it is empty, so filling it moves every card below it',
  r.dimmedWaiting > 0 &&
    `${r.dimmedWaiting} cards of your hand are dimmed while the opponent is thinking: ` +
    'dimming says the rule forbids a card, not that you have to wait',
  r.dimmedFollowing !== r.forbidden &&
    `${r.dimmedFollowing} cards are dimmed against a led suit that forbids ${r.forbidden}`,
  r.sayClip > 0 && `the name of the raised card is clipped by ${r.sayClip}px: --say is out of step with its type`,
  r.belowFold > 0 && `your seat — hand and name plate — is ${r.belowFold}px below the fold`,
  r.overflow > 0 && `your seat overflows the table by ${r.overflow}px`,
  r.hScroll && 'table scrolls sideways',
  r.rowShift > 1 &&
    `the table moves ${r.rowShift}px as the hands empty: the last trick shifts the ` +
    'row the player is reaching into',
  // Both terms are needed. The ratio alone misjudges a viewport so tight the
  // card sits on its floor, where an ordinary gap is a large share of a small
  // card; the absolute alone misjudges a big screen, where a wide gap beside a
  // tall card is breathing room.
  (r.gapRatio > 0.25 && r.maxGap > 48) &&
    `rows drift apart: widest gap ${r.maxGap}px, ${r.gapRatio.toFixed(2)} of a card`,

  // §3.7, assertion 1, in two terms, because one cannot do the work.
  //
  // The first is arithmetic: the row is built out of negative margins, and a
  // margin that has drifted from --strip makes a fan that no longer shows what
  // the budget says it shows. Measured against the page's own token, so it
  // holds at any --overlap.
  Math.abs(r.minStep - r.cw * r.overlap) > 1.5 &&
    `the fan's step is ${r.minStep}px but --strip is ${Math.round(r.cw * r.overlap)}px: ` +
    `the margins have drifted from the token`,

  // The second is the floor, and it cannot be a pixel count alone: at 980x385
  // with the spacing inflated the card sits on its 32px clamp floor, where 70%
  // of it is a 22px strip — as good a fan as a 32px card allows. Nor can it be
  // a share alone: .45 is the designed share in portrait, so a share floor that
  // would fail a desktop fan halved from .7 to .42 also fails every good phone.
  // So: a strip is either wide enough to single out, or it shows at least the
  // share the design gives its tightest orientation. `--overlap: .08` fails
  // both; landscape cut from .7 to .42 fails the second, which is the break
  // that a `min(24px, .4 of a card)` floor let through at every viewport.
  (r.minStep < 24 && r.minStep < 0.44 * r.cw) &&
    `the fan has collapsed: cards are ${r.minStep}px apart, ` +
    `${(r.minStep / r.cw).toFixed(2)} of a card, so one cannot be singled out from the next`,
  r.stepSpread > 1 && `the fan is uneven: steps differ by ${r.stepSpread}px`,

  // §3.7, assertion 3, which on the right-hand edge is also the rest of
  // assertion 1: the last card of a fan that runs past the table is the card
  // that is cut off. One measurement, so one message.
  r.fanSpillRight > 0 && `the fan runs ${r.fanSpillRight}px past the table's right edge, cutting off the last card of your hand`,
  r.fanSpillLeft > 0 && `the fan runs ${r.fanSpillLeft}px past the table's left edge`,

  // §3.7, assertion 2: a raised card is what you are about to play, so it has
  // to be wholly on the table and wholly on screen.
  r.raisedAbove > 0 && `a raised card lifts ${r.raisedAbove}px above the table`,

  // Issue #6. .3 of a card is not taste: it is the point at which the lift is
  // longer than the strip the card came out of, so the card reads as out of
  // the fan rather than nudged within it. At .18, where this started, the two
  // taps felt like one thing done twice.
  r.raisedLift < 0.3 * r.ch &&
    `a raised card lifts ${r.raisedLift}px, ${(r.raisedLift / r.ch).toFixed(2)} of a card: ` +
    'not far enough to read as raised',
  !r.saysNext && 'the line above your hand does not say what the next tap will do',
  r.raisedBelowFold > 0 && `a raised card sits ${r.raisedBelowFold}px below the fold`,
].filter(Boolean);

async function checkTable(browser, only, inflate) {
  console.log(inflate ? '\ntable, inflated spacing' : '\ntable');
  let failed = 0;
  for (const [vname, width, height] of VIEWPORTS) {
    if (only && !only.includes(vname)) continue;
    const page = await browser.newPage({ viewport: { width, height } });
    const rows = [];
    // The table only exists once a deal is dealt. The deck picker is iteration
    // 4, so each deck is applied directly for now — applyDeck is the same call
    // the picker will make, so this exercises the same code path.
    for (const deck of DECKS) {
      await page.goto(URL_);
      await page.addStyleTag({ content: STILL });
      if (inflate) await page.addStyleTag({
        content: ':root{ --pad-block: 1.5rem; --step: 1.25rem; --slack: 16px; }' });
      await page.evaluate(d => applyDeck(d), deck);
      await page.click('#play');
      await page.waitForTimeout(260);
      rows.push({ deck, ...(await page.evaluate(measure)) });
    }
    await page.close();

    const bad = rows.flatMap(r => tableFaults(r).map(f => `${r.deck}: ${f}`));
    if (bad.length) failed++;
    const margin = Math.min(...rows.map(r => Math.min(r.gapTop, r.gapBot, -r.belowFold)));
    console.log(`  ${bad.length ? 'FAIL' : 'pass'}  ${vname.padEnd(18)} ` +
      `${String(width).padStart(4)}x${String(height).padStart(4)}  ` +
      `card ${String(rows[0].cw).padStart(3)}x${String(rows[0].ch).padStart(3)}  ` +
      `margin ${String(margin).padStart(4)}px  ` +
      `gap ${Math.max(...rows.map(r => r.gapRatio)).toFixed(2)}`);
    bad.forEach(f => console.log(`        ${f}`));
  }
  return failed;
}

/* ---- pass 4: a whole deal, through the table ------------------------------- */

// Iteration 3 is done when a full deal can be played against the opponent, and that
// is a wiring claim the two passes above cannot make: they measure a table that
// has just been dealt. This plays one deal the way a player does — tap the
// strip to raise a card, tap the raised card to play it, twenty times — and
// fails if the deal does not reach a result or if anything throws on the way.
async function checkDeal(browser) {
  console.log('\na whole deal');
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const thrown = [];
  page.on('pageerror', e => thrown.push(String(e)));
  await page.goto(URL_);
  await page.click('#play');

  // Both trick slots showing a card at once. The engine clears a trick the
  // instant it resolves, so a table that renders straight from the engine
  // blanks both cards the moment the second one lands and sweeps two empty
  // boxes: the player never sees what the trick was. That shipped in this
  // iteration and nothing else here could see it, because the other two passes
  // only ever render a table that has just been dealt.
  // Your own card, on the table, the moment you play it. Not "eventually": a
  // play that lands before the sweep has run used to cancel it, and the table
  // went on painting the *previous* trick until the opponent answered — about
  // half a second, sixteen plays in twenty. Anything that waits for this waits
  // that out and calls it a pass, so this one does not wait at all.
  const yourCardShows = card => page.evaluate(c => {
    const n = document.querySelector('#slotYou');
    return n.dataset.empty === 'false'
        && n.style.getPropertyValue('--col') === String(c.n - 1)
        && n.style.getPropertyValue('--row') === String(c.s);
  }, card);

  // Both slots at once, which only the answer to a lead has to wait for.
  const bothShown = () => page.waitForFunction(
    () => [...document.querySelectorAll('.trick .card')].every(n => n.dataset.empty === 'false'),
    null, { timeout: 4000 });

  const issues = [];

  // One legal card, tapped the way a player taps it. Returns a message when
  // something goes wrong and nothing when it does not, so the stages below can
  // play a card without repeating any of this.
  const playOne = async () => {
    // Who leads alternates from deal to deal, so a new deal may open with the
    // opponent: wait for the turn rather than assuming it.
    try {
      await page.waitForFunction(() => !state.over && state.deveGiocare === BASSO,
                                 null, { timeout: 8000 });
    } catch { return 'your turn never came'; }
    const move = await page.evaluate(() => {
      const led = state.perPrimo === BASSO ? null : state.played[state.perPrimo];
      const legal = mosseLegali(state.hands[BASSO], led);
      return legal.length ? { slot: legal[0], card: state.hands[BASSO][legal[0]] } : null;
    });
    if (!move) return 'no legal card to play';
    // By slot, not by position: the fan is sorted, so the nth card in the DOM
    // is the nth card of the *hand* and not slot n. Locating by position here
    // tapped a different card than the one the move was computed for.
    const card = page.locator(`.hand--you .card[data-slot="${move.slot}"]`);
    try {
      await card.click({ position: { x: 6, y: 20 }, timeout: 4000 });
      const box = await card.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } catch { return `card ${move.slot} could not be tapped`; }
    return null;
  };

  let plays = 0;
  let keyTried = false;
  for (let i = 0; i < 600 && plays < 20; i++) {
    await page.waitForTimeout(90);
    // The first legal card. Which one it is does not matter; that a legal one
    // can be reached and played through the fan does.
    const move = await page.evaluate(() => {
      if (state.over || state.deveGiocare !== BASSO) return null;
      const led = state.perPrimo === BASSO ? null : state.played[state.perPrimo];
      const legal = mosseLegali(state.hands[BASSO], led);
      const order = ordinaMano(state.hands[BASSO]);
      const illegal = order.find(i => !legal.includes(i)) ?? null;
      return legal.length
        ? { slot: legal[0], answering: state.perPrimo !== BASSO,
            card: state.hands[BASSO][legal[0]],
            place: order.indexOf(legal[0]),
            // The keys count places in the fan, so the forbidden card has to be
            // named by its place and not by its slot.
            illegal, illegalPlace: illegal === null ? null : order.indexOf(illegal) }
        : null;
    });
    if (move === null) continue;

    // A card the rule forbids, through the keyboard, once per deal. The pointer
    // cannot reach one — it is a disabled button — so this is the only path
    // that could raise a forbidden card and throw on the second press.
    if (!keyTried && move.illegal !== null) {
      keyTried = true;
      const key = move.illegalPlace === 9 ? '0' : String(move.illegalPlace + 1);
      await page.keyboard.press(key);
      await page.keyboard.press(key);
      const raised = await page.evaluate(slot =>
        document.querySelector(`.hand--you .card[data-slot="${slot}"]`).getAttribute('aria-pressed'),
        move.illegal);
      if (raised === 'true') issues.push('a key raised a card the follow-suit rule forbids');
    }

    // And the other half of it, which the assertion above cannot do: a key has
    // to raise the card at *that* place in the fan. The forbidden-card test is
    // one-sided — it says a particular card was not raised — and a keyboard
    // that indexed slots rather than places satisfied it by raising the wrong
    // legal card instead. Once per deal, on a card the rule allows, so the
    // press gets as far as raising something.
    // Every play, not once a deal. Once a deal it fired on legal[0], which when
    // you lead is always slot 0 — and a keyboard indexing slots is only visible
    // when that card's place differs from its slot, which over 20,000 dealt
    // hands is all but 10.0% of them. An assertion that misses its own
    // motivating break one run in ten is rule 7's defect wearing rule 1's
    // clothes. One keypress a play closes it.
    {
      const key = move.place === 9 ? '0' : String(move.place + 1);
      await page.keyboard.press(key);
      const up = await page.evaluate(() => {
        const c = document.querySelector('.hand--you .card[aria-pressed="true"]');
        return c ? Number(c.dataset.slot) : null;
      });
      if (up !== move.slot)
        issues.push(`key ${key} raised ${up === null ? 'nothing' : 'slot ' + up}, ` +
                    `not the card at place ${move.place + 1} of the fan`);
      // Put it back down. An assertion that leaves the page in a state it
      // found it out of is a defect of its own: this one left a card raised,
      // and a raised card is scaled and on top of its neighbours, so the tap
      // below it became the *second* tap of a play it had not made and the
      // reachability rule then found the raised card in front of the one it
      // was aiming at. It failed on some deals and not others, which is the
      // worst way for a check to be wrong.
      await page.evaluate(() => { state.selected = null; render(); });
    }

    const card = page.locator(`.hand--you .card[data-slot="${move.slot}"]`);
    // 6px in from its left edge: everything right of the strip belongs to the
    // next card, so that is where a player's thumb has to land.
    try {
      await card.click({ position: { x: 6, y: 20 }, timeout: 4000 });
      const box = await card.boundingBox();    // it has lifted; the whole face is free now
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } catch {
      issues.push(`card ${move.slot} of your hand could not be tapped: nothing reaches its strip`);
      break;
    }
    plays++;

    // Issue #7: every card you still hold has to be reachable where it looks
    // reachable. The hand used to keep its holes all deal, and an empty slot —
    // a box the width of a card, overlapping the card to its left — swallowed
    // every tap aimed at the part it covered, so a card with played slots to
    // its right looked entirely free and could only be touched on its leftmost
    // strip. A sorted hand closes up and has no holes at all, which retires
    // that shape of the defect; the assertion stays because what it actually
    // measures is that nothing is in front of a card where a player aims, and
    // the next thing to sit there will not be an empty slot. Checked from the
    // middle of the part of each card that no later card covers.
    const unreachable = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.hand--you .card')].filter(c => !c.hidden);
      const bad = [];
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const next = cards[i + 1];
        const right = next ? Math.min(next.getBoundingClientRect().left, r.right) : r.right;
        const hit = document.elementFromPoint((r.left + right) / 2, r.top + r.height / 2);
        if (hit !== c && !c.contains(hit))
          bad.push(`${i} (${hit ? hit.id || hit.className : 'nothing'} is in front of it)`);
      });
      return bad;
    });
    for (const u of unreachable.slice(0, 2))
      issues.push(`a card you hold cannot be tapped where it looks free: place ${u} in the fan`);
    if (unreachable.length) break;

    // A hand is held sorted: by suit, and within a suit from the strongest card
    // down. Asserted here rather than in the table pass because the table pass
    // only ever sees a hand as it was dealt, and a hand as it was dealt is
    // sorted by the code that sorts it *once* — the states that can break this
    // are the ones a deal reaches, after cards have been played out of the
    // middle and drawn back into the holes they left. Contiguity is half of it:
    // a hole in a sorted hand is a card in the wrong place.
    const outOfOrder = await page.evaluate(() => {
      const shown = [...document.querySelectorAll('.hand--you .card')];
      const visible = shown.filter(c => !c.hidden);
      const held = state.hands[BASSO].filter(c => c).length;
      if (visible.length !== held)
        return `the fan shows ${visible.length} cards for a hand of ${held}`;
      if (shown.findIndex(c => c.hidden) !== -1
          && shown.findIndex(c => c.hidden) < visible.length)
        return 'the fan has a hole in it: a hidden card sits before a shown one';
      const cards = visible.map(c => state.hands[BASSO][Number(c.dataset.slot)]);
      if (cards.some(c => !c)) return 'a card in the fan points at an empty slot';
      // The sprite, not just the mapping. A place in the fan names a slot in
      // data-slot and paints a face from --col/--row, and the two are set on
      // different lines: a render that painted its neighbour's card while
      // naming its own slot showed ten wrong faces and nothing said a word,
      // because the click, the assertion below and the deal pass all went by
      // the name. Since this change made a button a place rather than a card,
      // this is how the fan can now lie.
      for (let i = 0; i < visible.length; i++){
        const col = visible[i].style.getPropertyValue('--col');
        const row = visible[i].style.getPropertyValue('--row');
        if (Number(col) !== cards[i].n - 1 || Number(row) !== cards[i].s)
          return `place ${i} names ${SUITS[cards[i].s]} ${cards[i].n} and shows ` +
                 `${SUITS[Number(row)]} ${Number(col) + 1}`;
      }
      for (let i = 1; i < cards.length; i++){
        const a = cards[i - 1], b = cards[i];
        if (b.s < a.s) return `suits out of order at place ${i}: ${SUITS[a.s]} then ${SUITS[b.s]}`;
        if (b.s === a.s && rango(b.n) >= rango(a.n))
          return `${SUITS[a.s]} out of order at place ${i}: ${a.n} then ${b.n}, not decreasing`;
      }
      return null;
    });
    if (outOfOrder){ issues.push(`the hand is not held sorted: ${outOfOrder}`); break; }

    if (!await yourCardShows(move.card)) {
      issues.push('the card you played was not on the table the moment you played it: ' +
                  'the trick before it is still there');
      break;
    }
    try { await bothShown(); }
    catch {
      issues.push(move.answering
        ? 'the trick you completed was cleared before both cards could be seen'
        : "the opponent's answer was never shown beside your card");
      break;
    }
  }

  // A deal that could not be played out says nothing about what comes after it,
  // and every stage below needs a finished one: run them only if the twenty
  // cards went down, and report the first real failure instead of a cascade of
  // clicks at buttons that are not there.
  if (plays < 20) {
    issues.push(`only ${plays} of 20 cards could be played`);
    thrown.forEach(t => issues.push(`the page threw: ${t}`));
    await page.close();
    console.log(`  FAIL  ${plays} cards played against Franco, then the deal stopped`);
    issues.forEach(i => console.log(`        ${i}`));
    return 1;
  }

  {
    try {
      await page.waitForFunction(
        () => state.over && !document.querySelector('#scrim').hidden &&
              /Hai vinto|Hai perso|Pareggio/.test(document.querySelector('#resultTitle').textContent),
        null, { timeout: 15000 });
    } catch { issues.push('the deal never reached its result dialog'); }
  }

  const end = await page.evaluate(() => ({
    tricks: state.tricks, over: state.over,
    line: [document.querySelector('#resultTitle').textContent,
           document.querySelector('#resultYou').textContent + '\u2013' +
           document.querySelector('#resultOpp').textContent].join(' '),
    you: Number(document.querySelector('#resultYou').textContent),
    them: Number(document.querySelector('#resultOpp').textContent),
    score: scoreDeal(state),
    // §4's "Done when": the deal shows up in history with the right score.
    history: JSON.parse(localStorage.getItem('tressette.history') || '[]'),
    opponent: state.opponent,
  }));
  if (end.tricks !== 20) issues.push(`${end.tricks} tricks played, not 20`);
  if (end.you !== end.score[0] || end.them !== end.score[1])
    issues.push(`the dialog says ${end.you}\u2013${end.them}, the deal scored ${end.score.join('\u2013')}`);
  const [logged] = end.history;
  if (!logged) issues.push('the deal was not written to the history');
  else if (logged.y !== end.you || logged.a !== end.them || logged.o !== end.opponent)
    issues.push(`the history says ${logged.o} ${logged.y}\u2013${logged.a}, ` +
                `the dialog says ${end.opponent} ${end.you}\u2013${end.them}`);

  // And the other half of §4's "Done when": a deal abandoned through the
  // confirm is not recorded, and the two buttons that abandon one leave you
  // where their labels say. The history count has to be read again afterwards —
  // an abandoned deal that quietly logs itself would look exactly like one that
  // did not.
  //
  // The new-hand button is the one that had this wrong: it discarded the deal,
  // went to the start sheet, and *then* dealt a new hand, which ran behind the
  // start sheet with the opponent leading into a table nobody could see. An
  // assertion that asked for the start sheet here passed on that bug.
  await page.click('#playAgain', { timeout: 4000 });
  await page.waitForTimeout(200);

  // A trick first, and then the discard has to happen while the sweep is
  // actually on the cards: its two classes animate `both`, so one left behind
  // paints every later trick transparent for the whole of the next deal. The
  // window is the 420ms the sweep lasts — waiting for the classes rather than
  // for a trick is what puts the discard inside it.
  const first = await playOne();
  if (first) issues.push(first);
  try {
    await page.waitForFunction(
      () => document.querySelector('#slotYou').className.includes('card--won'),
      null, { timeout: 8000 });
  } catch { issues.push('no trick was ever swept off the table'); }

  try { await page.click('#again', { timeout: 4000 }); }
  catch { issues.push('the new-hand button could not be clicked'); }
  const asked = await page.evaluate(() => !document.querySelector('#confirmScrim').hidden);
  if (!asked) issues.push('the new-hand button did not ask before throwing a deal away');

  // Through the dialog if it is there, through discard() if it is not, so a
  // page that never asks still reaches the assertions below.
  if (asked) await page.click('#confirmYes', { timeout: 4000 }); else await page.evaluate(() => discard());
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    screen, tricks: state.tricks, dealt: state.dealt,
    logged: JSON.parse(localStorage.getItem('tressette.history') || '[]').length,
  }));
  if (after.screen !== 'table') issues.push(`the new-hand button landed on ${after.screen}, not the table`);
  if (!after.dealt || after.tricks !== 0) issues.push('the new-hand button did not deal a new hand');
  if (after.logged !== end.history.length)
    issues.push(`the abandoned deal was written to the history (${end.history.length} \u2192 ${after.logged})`);

  // The new deal's trick, before anything is played into it. Measured here and
  // not after a play, because playing flushes the sweep too: the leak is on
  // screen from the deal until the first card lands on it, and a check that
  // plays first watches the page repair itself and calls that a pass.
  await page.waitForTimeout(500);       // the sweep's own animation is .45s
  const swept = await page.evaluate(() => {
    const o = getComputedStyle(document.querySelector('#slotYou'));
    return { opacity: Number(o.opacity), transform: o.transform,
             classes: document.querySelector('#slotYou').className };
  });
  if (swept.opacity < 1 || swept.transform !== 'none')
    issues.push(`the abandoned deal left its sweep on the table: the new deal's trick ` +
                `draws at opacity ${swept.opacity}, transform ${swept.transform} (${swept.classes})`);

  const second = await playOne();
  if (second) issues.push(second);

  // With a dialog up, the card keys are not the player's — and `Enter` least of
  // all, because it is what you press to answer a dialog whose safe button has
  // the focus. It has to be your turn for this to prove anything: `tapped`
  // refuses when it is not, so a stage that asks while the opponent is thinking
  // passes whether the guard is there or not.
  try {
    await page.waitForFunction(() => !state.over && state.deveGiocare === BASSO
                                     && !document.querySelector('#slotYou').className.includes('card--won'),
                               null, { timeout: 8000 });
    await page.click('#again', { timeout: 4000 });
    const playedBefore = await page.evaluate(() => JSON.stringify(state.played));
    await page.keyboard.press('3');
    await page.keyboard.press('Enter');
    const raised = await page.evaluate(() => state.selected);
    const moved = await page.evaluate(b => JSON.stringify(state.played) !== b, playedBefore);
    if (moved) issues.push('a card was played through the abandon dialog');
    if (raised !== null) issues.push('a card was raised through the abandon dialog');
    // Enter answered the dialog, which is the safe button; make sure of it.
    if (await page.evaluate(() => !document.querySelector('#confirmScrim').hidden))
      await page.click('#confirmNo');
  } catch { issues.push('the abandon dialog could not be opened on a turn of your own'); }

  // "Cambia avversario" is the one that does go to the start sheet.
  try {
    await page.click('#btnSettings', { timeout: 4000 });
    await page.click('#changeOpponent', { timeout: 4000 });
    if (await page.evaluate(() => !document.querySelector('#confirmScrim').hidden))
      await page.click('#confirmYes', { timeout: 4000 });
    await page.waitForTimeout(300);
    const left = await page.evaluate(() => ({ screen, dealt: state.dealt }));
    if (left.screen !== 'start') issues.push(`changing opponent landed on ${left.screen}, not the start sheet`);
    if (left.dealt) issues.push('changing opponent left the deal in play');
  } catch {
    issues.push('the settings sheet could not be reached from the table to change opponent');
  }

  thrown.forEach(t => issues.push(`the page threw: ${t}`));
  await page.close();

  console.log(`  ${issues.length ? 'FAIL' : 'pass'}  ${plays} cards played against ` +
              `Franco, ${end.tricks} tricks — ${end.line || 'no result'}, ` +
              `then one thrown away and one walked out of`);
  issues.forEach(i => console.log(`        ${i}`));
  return issues.length ? 1 : 0;
}

/* ---- run ------------------------------------------------------------------ */

const browser = await chromium.launch({ ...(CHROME && { executablePath: CHROME }), args: ['--no-sandbox'] });
let failed = 0;
failed += await checkDocument(browser);
failed += await checkFonts(browser);
failed += await checkScreens(browser);
failed += await checkTable(browser, null, false);
failed += await checkTable(browser, TIGHT, true);
failed += await checkDeal(browser);
await browser.close();

console.log(failed ? `\n${failed} case(s) failed` : '\nAll checks pass.');
process.exit(failed ? 1 : 0);
