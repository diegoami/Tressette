// Tests for public/engine.js, on node --test. No dependencies.
//
// The engine is a classic script so the page can load it from a folder, so the
// tests load it the way Node can: read the text, run it in this context, and
// take the names off globalThis. That is the same file the page runs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext, runInContext, createContext } from "node:vm";
import { fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("../public/engine.js", import.meta.url));
const TEXT = readFileSync(SOURCE, "utf8");
runInThisContext(TEXT);

const {
  SUITS, BASSO, ALTO, rango, terzi, buildDeck, mescola, rngSeed,
  prende, mosseLegali, accusi, puntiAccusi, newDeal, gioca, scoreDeal, vincitore
} = globalThis;

const card = (s, n) => ({ s, n });
const fresh = (partitaPrimo = BASSO) => ({ hands: [], partitaPrimo });

/* --- the engine runs anywhere ---------------------------------------------- */

// Comments are stripped first, or this check trips on the sentence in
// engine.js that promises not to do any of it. The engine has no string
// containing // or /*, so the stripping is safe here and nowhere else.
const CODE = TEXT.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, "");
const BROWSER_ONLY = [/\bdocument\b/, /\bwindow\b/, /\bsetTimeout\b/,
                      /\bsetInterval\b/, /Math\.random/];

test("the engine reaches for nothing a browser has", () => {
  // §3.2: no DOM, no timers, no Math.random, because Node runs this same file.
  for (const forbidden of BROWSER_ONLY)
    assert.equal(forbidden.test(CODE), false,
      `engine.js uses ${forbidden} — it has to run under Node too`);

  // An assertion that cannot fail is worse than none, and stripping comments is
  // exactly the kind of step that quietly empties one. Prove it still bites.
  assert.ok(BROWSER_ONLY.some(f => f.test("el = document.body")), "document");
  assert.ok(BROWSER_ONLY.some(f => f.test("const r = Math.random()")), "Math.random");
  assert.ok(BROWSER_ONLY.some(f => f.test("setTimeout(go, 900)")), "setTimeout");
});

test("a whole deal plays in a context with no globals at all", () => {
  // The textual check above says what the file does not mention; this one says
  // what it does not need. A bare vm context has no document, no window and no
  // require — if the engine wanted any of them, this throws.
  const bare = createContext({});
  runInContext(TEXT, bare);
  const tricks = runInContext(`
    const rng = rngSeed(11);
    const s = newDeal({ hands: [], partitaPrimo: BASSO }, rng);
    while (!s.over){
      const who = s.deveGiocare;
      const led = who === s.perPrimo ? null : s.played[s.perPrimo];
      const legal = mosseLegali(s.hands[who], led);
      gioca(s, who, legal[Math.floor(rng() * legal.length)]);
    }
    s.tricks;
  `, bare);
  assert.equal(tricks, 20);
});

/* --- cards ------------------------------------------------------------------ */

test("the rank order is tre, due, asso, re, cavallo, fante, then by number", () => {
  const strongestFirst = [3, 2, 1, 10, 9, 8, 7, 6, 5, 4];
  for (let i = 1; i < strongestFirst.length; i++)
    assert.ok(rango(strongestFirst[i - 1]) > rango(strongestFirst[i]),
      `${strongestFirst[i - 1]} should outrank ${strongestFirst[i]}`);
  assert.equal(new Set(strongestFirst.map(rango)).size, 10, "no two cards tie");
});

test("terzi: an asso is three, a figure or a due or a tre is one, a liscio none", () => {
  assert.equal(terzi(1), 3);
  for (const n of [2, 3, 8, 9, 10]) assert.equal(terzi(n), 1, `${n} is one terzo`);
  for (const n of [4, 5, 6, 7]) assert.equal(terzi(n), 0, `${n} is a liscio`);

  const deck = buildDeck();
  assert.equal(deck.length, 40);
  assert.equal(deck.reduce((t, c) => t + terzi(c.n), 0), 32, "the deck holds 32 terzi");
  assert.equal(new Set(deck.map(c => `${c.s}-${c.n}`)).size, 40, "no card twice");
});

test("mescola keeps every card and takes its randomness from the argument", () => {
  const a = mescola(buildDeck(), rngSeed(7));
  const b = mescola(buildDeck(), rngSeed(7));
  const c = mescola(buildDeck(), rngSeed(8));
  assert.deepEqual(a, b, "the same seed deals the same deck");
  assert.notDeepEqual(a, c, "a different seed deals a different one");
  assert.equal(new Set(a.map(x => `${x.s}-${x.n}`)).size, 40, "all 40 survive the shuffle");
});

/* --- a trick ---------------------------------------------------------------- */

test("prende: the led suit decides, and there is no trump", () => {
  assert.equal(prende(card(0, 3), card(0, 1)), true, "the tre takes the asso");
  assert.equal(prende(card(0, 1), card(0, 3)), false, "the asso does not take the tre");
  assert.equal(prende(card(0, 1), card(0, 10)), true, "the asso takes the re");
  assert.equal(prende(card(0, 7), card(0, 4)), true, "seven takes four");

  // The whole difference from Briscola: nothing off-suit ever takes.
  for (const n of [3, 2, 1, 10])
    assert.equal(prende(card(1, n), card(0, 4)), false,
      `a ${n} of another suit cannot take a four`);
});

test("mosseLegali forces the suit, and answers in slots", () => {
  //        0            1            2            3
  const hand = [card(0, 3), card(1, 5), null, card(0, 10)];

  assert.deepEqual(mosseLegali(hand, null), [0, 1, 3], "leading, anything but a hole");
  assert.deepEqual(mosseLegali(hand, card(0, 1)), [0, 3], "holding denari, you follow");
  assert.deepEqual(mosseLegali(hand, card(1, 1)), [1], "one coppe, and it is forced");
  assert.deepEqual(mosseLegali(hand, card(2, 1)), [0, 1, 3], "void in spade, anything");

  assert.deepEqual(mosseLegali([null, null, card(3, 4)], card(0, 1)), [2],
    "the answer is the slot, not the card");
});

/* --- declarations ----------------------------------------------------------- */

test("accusi are read from the ten dealt, and they stack", () => {
  const rest = [card(3, 4), card(3, 5), card(3, 6), card(3, 7)];

  const napoletana = [card(0, 1), card(0, 2), card(0, 3), ...rest];
  assert.deepEqual(accusi(napoletana), [{ kind: "napoletana", suit: 0, points: 3 }]);

  const treAssi = [card(0, 1), card(1, 1), card(2, 1), ...rest];
  assert.deepEqual(accusi(treAssi), [{ kind: "set", n: 1, count: 3, points: 3 }]);

  const quattroAssi = [card(0, 1), card(1, 1), card(2, 1), card(3, 1), ...rest];
  assert.deepEqual(accusi(quattroAssi), [{ kind: "set", n: 1, count: 4, points: 4 }]);

  const quattroDue = [card(0, 2), card(1, 2), card(2, 2), card(3, 2), ...rest];
  assert.deepEqual(accusi(quattroDue), [{ kind: "set", n: 2, count: 4, points: 4 }]);

  // One hand, several declarations: the napoletana of denari, three assi and
  // three tre, all at once. 3 + 3 + 3.
  const several = [card(0, 1), card(0, 2), card(0, 3),
                   card(1, 1), card(2, 1), card(1, 3), card(2, 3),
                   card(3, 4), card(3, 5), card(3, 6)];
  assert.equal(puntiAccusi(accusi(several)), 9);
  assert.equal(accusi(several).length, 3);

  assert.deepEqual(accusi([card(0, 1), card(0, 2), card(1, 3), ...rest]), [],
    "two of a napoletana is nothing, and two tre are nothing");
  assert.deepEqual(accusi([null, null, card(0, 1)]), [], "holes are not cards");
});

/* --- a whole deal ----------------------------------------------------------- */

// A legal player that is nothing but legal: the point is the rules, not the
// play. The opponent arrives in iteration 2.
function playOut(state, rng){
  while (!state.over){
    const who = state.deveGiocare;
    const led = who === state.perPrimo ? null : state.played[state.perPrimo];
    const legal = mosseLegali(state.hands[who], led);
    gioca(state, who, legal[Math.floor(rng() * legal.length)]);
  }
  return state;
}

test("the deal: ten each, twenty tricks, and the tallone drawn dry", () => {
  const rng = rngSeed(1);
  const state = newDeal(fresh(BASSO), rng);

  assert.equal(state.hands[BASSO].filter(c => c !== null).length, 10);
  assert.equal(state.hands[ALTO].filter(c => c !== null).length, 10);
  assert.equal(state.next, 20, "twenty dealt, twenty left as the tallone");
  assert.equal(state.perPrimo, BASSO, "on a cold start you lead");
  assert.equal(state.partitaPrimo, ALTO, "and they lead the next deal");

  playOut(state, rng);

  assert.equal(state.tricks, 20);
  assert.equal(state.next, 40, "the tallone is gone");
  assert.equal(state.hands[BASSO].every(c => c === null), true, "no cards left");
  assert.equal(state.hands[ALTO].every(c => c === null), true);
  assert.equal(state.terzi[BASSO] + state.terzi[ALTO], 32, "the deck's 32 terzi, all taken");
});

test("every deal scores exactly 11 points, plus whatever was declared", () => {
  for (let seed = 1; seed <= 10000; seed++){
    const rng = rngSeed(seed);
    const state = playOut(newDeal(fresh(seed % 2 === 0 ? BASSO : ALTO), rng), rng);

    const [basso, alto] = scoreDeal(state);
    const declared = puntiAccusi(state.accusi[BASSO]) + puntiAccusi(state.accusi[ALTO]);
    assert.equal(basso + alto, 11 + declared,
      `seed ${seed}: ${basso} + ${alto} is not 11 + ${declared}`);
    assert.equal(state.terzi[BASSO] + state.terzi[ALTO], 32,
      `seed ${seed}: the terzi on the table do not add up`);
  }
});

test("the last trick is worth a point, and it goes to whoever took it", () => {
  const rng = rngSeed(42);
  const state = playOut(newDeal(fresh(BASSO), rng), rng);
  const ultima = state.perPrimo; // the winner of a trick leads the next

  const withUltima = scoreDeal(state);
  state.over = false;           // the same terzi, without the last trick's bonus
  const without = scoreDeal(state);
  state.over = true;

  assert.equal(withUltima[ultima] + withUltima[1 - ultima] -
               (without[ultima] + without[1 - ultima]), 1,
    "the ultima is worth exactly one point");
});

/* --- the result ------------------------------------------------------------- */

test("vincitore takes the higher total, and declarations can make a draw", () => {
  // 21 terzi to 14, so seven points to four, and the ultima is already in the
  // 21. A napoletana to the loser makes it seven all — the only kind of tie
  // eleven points can produce.
  const tied = {
    terzi: [18, 14], over: true, perPrimo: BASSO,
    accusi: [[], [{ kind: "napoletana", suit: 0, points: 3 }]]
  };
  assert.deepEqual(scoreDeal(tied), [7, 7]);
  assert.equal(vincitore(tied), null, "a draw is recorded, not broken");

  const won = { terzi: [18, 14], over: true, perPrimo: BASSO, accusi: [[], []] };
  assert.deepEqual(scoreDeal(won), [7, 4]);
  assert.equal(vincitore(won), BASSO);

  const lost = { terzi: [14, 18], over: true, perPrimo: ALTO, accusi: [[], []] };
  assert.deepEqual(scoreDeal(lost), [4, 7]);
  assert.equal(vincitore(lost), ALTO);
});

/* --- the moves the rules forbid --------------------------------------------- */

test("gioca refuses what the rules do not allow", () => {
  const rng = rngSeed(3);
  const state = newDeal(fresh(BASSO), rng);

  assert.throws(() => gioca(state, ALTO, 0), /not this player's turn/);

  gioca(state, BASSO, mosseLegali(state.hands[BASSO], null)[0]);
  const led = state.played[BASSO];
  const holding = state.hands[ALTO].some(c => c !== null && c.s === led.s);
  if (holding){
    const wrong = state.hands[ALTO].findIndex(c => c !== null && c.s !== led.s);
    if (wrong !== -1)
      assert.throws(() => gioca(state, ALTO, wrong), /not a legal move/,
        "holding the suit, you must follow it");
  }
  assert.throws(() => gioca(state, BASSO, 0), /not this player's turn/);
});

test("the winner of the trick draws first", () => {
  // §2.3, and worth its own test: nothing else here notices if the two draws
  // swap. Both players still end with ten cards and the deal still scores 11,
  // so a swapped order passes every other assertion in this file while handing
  // the better half of the tallone to the wrong player all deal.
  const rng = rngSeed(9);
  const state = newDeal(fresh(BASSO), rng);

  const lead = mosseLegali(state.hands[BASSO], null)[0];
  const led = state.hands[BASSO][lead];
  gioca(state, BASSO, lead);

  const nextUp = state.next;               // the two cards about to be drawn
  const first = state.cards[nextUp];
  const second = state.cards[nextUp + 1];

  const answer = mosseLegali(state.hands[ALTO], led)[0];
  const { trick } = gioca(state, ALTO, answer);
  const loser = trick.winner === BASSO ? ALTO : BASSO;

  assert.ok(state.hands[trick.winner].includes(first),
    "the top of the tallone goes to the winner");
  assert.ok(state.hands[loser].includes(second),
    "and the next card to the loser");
});

test("a void is remembered the moment it shows", () => {
  const rng = rngSeed(5);
  const state = newDeal(fresh(BASSO), rng);
  const leadSlot = mosseLegali(state.hands[BASSO], null)[0];
  const led = state.hands[BASSO][leadSlot];
  gioca(state, BASSO, leadSlot);

  const answer = mosseLegali(state.hands[ALTO], led)[0];
  const off = state.hands[ALTO][answer].s !== led.s;
  gioca(state, ALTO, answer);
  assert.equal(state.voids[ALTO][led.s], off,
    "voided exactly when they failed to follow");
});
