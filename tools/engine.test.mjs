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
  prende, mosseLegali, accusi, puntiAccusi, pesca, newDeal, gioca, scoreDeal, vincitore
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

  // Every suit, because a loop over the suits is exactly the thing that can be
  // narrowed without anything else noticing: the 10,000-deal invariant derives
  // what was declared from state.accusi itself, so both sides of it move
  // together and a napoletana of bastoni could go undeclared all game.
  for (let s = 0; s < 4; s++){
    const napoletana = [card(s, 1), card(s, 2), card(s, 3), ...rest.filter(c => c.s !== s)];
    assert.deepEqual(accusi(napoletana), [{ kind: "napoletana", suit: s, points: 3 }],
      `the napoletana of ${SUITS[s]}`);
  }

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
  let last = null;
  while (!state.over){
    const who = state.deveGiocare;
    const led = who === state.perPrimo ? null : state.played[state.perPrimo];
    const legal = mosseLegali(state.hands[who], led);
    const { trick } = gioca(state, who, legal[Math.floor(rng() * legal.length)]);
    if (trick) last = trick;
  }
  return last;
}

// A constructed position: two hands, a leader, and as much tallone as the
// draws need. Everything a trick touches and nothing else, so a rule can be
// asserted on its own instead of somewhere inside a random deal.
function position({ hands, perPrimo = BASSO, tallone = [] }){
  return {
    cards: tallone, next: 0,
    hands: hands.map(h => h.slice()),
    played: [null, null],
    terzi: [0, 0],
    voids: [[false, false, false, false], [false, false, false, false]],
    seen: [], accusi: [[], []], detti: [true, true],
    tricks: 0, over: false,
    perPrimo, deveGiocare: perPrimo, partitaPrimo: BASSO
  };
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
    const state = newDeal(fresh(seed % 2 === 0 ? BASSO : ALTO), rng);
    playOut(state, rng);

    const [basso, alto] = scoreDeal(state);
    const declared = puntiAccusi(state.accusi[BASSO]) + puntiAccusi(state.accusi[ALTO]);
    assert.equal(basso + alto, 11 + declared,
      `seed ${seed}: ${basso} + ${alto} is not 11 + ${declared}`);
    assert.equal(state.terzi[BASSO] + state.terzi[ALTO], 32,
      `seed ${seed}: the terzi on the table do not add up`);
  }
});

test("the trick goes to the higher card of the led suit, and so does everything else", () => {
  // The three §2.3 rules that a random deal cannot pin down, because inverting
  // any of them leaves the terzi summing to 32 and the deal scoring 11: who
  // takes the trick, who is credited for it, and who leads next.
  const cases = [
    { what: "a higher card of the led suit takes it",
      led: card(0, 1), answer: card(0, 3), winner: ALTO, value: 4 },
    { what: "a lower card of the led suit does not",
      led: card(0, 1), answer: card(0, 10), winner: BASSO, value: 4 },
    { what: "the strongest card of another suit never takes",
      led: card(0, 4), answer: card(1, 3), winner: BASSO, value: 1 }
  ];

  for (const c of cases){
    const state = position({ hands: [[c.led], [c.answer]], perPrimo: BASSO });
    gioca(state, BASSO, 0);
    const { trick } = gioca(state, ALTO, 0);
    const loser = c.winner === BASSO ? ALTO : BASSO;

    assert.equal(trick.winner, c.winner, c.what);
    assert.equal(trick.terzi, c.value, `${c.what}: the trick is worth ${c.value}`);
    assert.equal(state.terzi[c.winner], c.value, `${c.what}: credited to the winner`);
    assert.equal(state.terzi[loser], 0, `${c.what}: and not to the loser`);
    assert.equal(state.perPrimo, c.winner, `${c.what}: the winner leads next`);
    assert.equal(state.deveGiocare, c.winner, `${c.what}: and plays next`);
  }
});

test("the ultima's point goes to whoever took the last trick", () => {
  for (const seed of [42, 77, 101, 2024]){
    const rng = rngSeed(seed);
    const state = newDeal(fresh(seed % 2 ? BASSO : ALTO), rng);
    const last = playOut(state, rng);      // the trick, from gioca, not from state
    assert.equal(last.ultima, true, `seed ${seed}: the twentieth trick says so`);

    const withIt = scoreDeal(state);
    state.over = false;                    // the same terzi, no last-trick bonus
    const without = scoreDeal(state);
    state.over = true;

    const other = last.winner === BASSO ? ALTO : BASSO;
    assert.equal(withIt[last.winner] - without[last.winner], 1,
      `seed ${seed}: the point goes to the player who took the last trick`);
    assert.equal(withIt[other] - without[other], 0,
      `seed ${seed}: and not to the other one`);
  }
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

test("a void is remembered against the right player, in the suit that was led", () => {
  // Written as a position rather than a deal: at the seed this test used to
  // run on, the follower happened to hold the led suit, so the assertion
  // reduced to voids[ALTO][3] === false, which is true of any fresh deal
  // whatever the code does. §3.4 calls this the inference Tressette is played
  // on, so all three ways of getting it wrong are asserted.
  const off = position({ hands: [[card(0, 1)], [card(1, 5)]], perPrimo: BASSO });
  gioca(off, BASSO, 0);
  gioca(off, ALTO, 0);
  assert.equal(off.voids[ALTO][0], true, "void in the suit they could not follow");
  assert.equal(off.voids[ALTO][1], false, "not in the suit they discarded");
  assert.equal(off.voids[BASSO][0], false, "and not against the player who led it");

  const followed = position({ hands: [[card(0, 1)], [card(0, 5)]], perPrimo: BASSO });
  gioca(followed, BASSO, 0);
  gioca(followed, ALTO, 0);
  assert.equal(followed.voids[ALTO][0], false, "following suit shows nothing");
});

test("a declaration is announced once, on that player's first card", () => {
  const state = position({
    hands: [[card(0, 1), card(0, 2)], [card(1, 5), card(1, 6)]],
    perPrimo: BASSO
  });
  state.accusi = [[{ kind: "napoletana", suit: 0, points: 3 }], []];
  state.detti = [false, false];

  const opening = gioca(state, BASSO, 0);
  assert.deepEqual(opening.announced, [{ kind: "napoletana", suit: 0, points: 3 }]);
  assert.notEqual(opening.announced, state.accusi[BASSO],
    "the caller gets a copy, not the array the score is read from");

  assert.deepEqual(gioca(state, ALTO, 0).announced, [], "they have nothing to declare");
  assert.deepEqual(gioca(state, BASSO, 1).announced, [],
    "and it is not announced a second time");
});

test("a set completed from the tallone is not a declaration", () => {
  // Decision 4, the house rule §6 ranks as risk 3. accusi is read once, in
  // newDeal, from the ten dealt — so the way to hold the rule is to assert
  // that twenty draws cannot change the answer.
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]){
    const rng = rngSeed(seed);
    const state = newDeal(fresh(BASSO), rng);
    const atDeal = [accusi(state.hands[BASSO].slice()), accusi(state.hands[ALTO].slice())];
    assert.deepEqual(state.accusi, atDeal, `seed ${seed}: read from the ten dealt`);

    playOut(state, rng);
    assert.deepEqual(state.accusi, atDeal,
      `seed ${seed}: the tallone cannot add a declaration, or take one away`);
  }
});

test("the opponent sees its own cards and every card the human plays", () => {
  const rng = rngSeed(6);
  const state = newDeal(fresh(BASSO), rng);

  assert.equal(state.seen.length, 10, "at the deal, the ten it was given");
  assert.equal(state.seen.every(c => state.hands[ALTO].includes(c)), true,
    "and nothing else — it cannot see the human's hand");

  playOut(state, rng);
  assert.equal(state.seen.length, 40,
    "by the end: its own twenty, and the human's twenty as they were played");
  assert.equal(new Set(state.seen).size, 40, "and no card counted twice");
});

test("a second deal clears the table, and the other player leads", () => {
  const rng = rngSeed(21);
  const state = newDeal(fresh(BASSO), rng);
  assert.equal(state.perPrimo, BASSO);
  playOut(state, rng);

  newDeal(state, rng);        // the same object, as Ancora will reuse it
  assert.equal(state.perPrimo, ALTO, "whoever did not lead this deal leads the next");
  assert.deepEqual(state.terzi, [0, 0], "no points carried over");
  assert.deepEqual(state.detti, [false, false], "declarations to be announced again");
  assert.deepEqual(state.played, [null, null]);
  assert.equal(state.tricks, 0);
  assert.equal(state.over, false);
  assert.equal(state.next, 20, "a fresh tallone");
  assert.equal(state.seen.length, 10,
    "and it has forgotten the last deal — otherwise it starts the next one "
    + "holding forty cards it has already seen, and nothing is outstanding");
  assert.equal(state.voids.flat().some(v => v), false, "and nothing inferred yet");

  playOut(state, rng);
  newDeal(state, rng);
  assert.equal(state.perPrimo, BASSO, "and it alternates back");
});

test("the tallone runs out rather than dealing cards that are not there", () => {
  // position() stands on this guard, so it is worth pinning: with the deck
  // size hard-coded to 40 instead of read from state.cards, a short deck does
  // not stop the draw, it fills hands with undefined and the failure surfaces
  // somewhere else entirely.
  const state = position({ hands: [[card(0, 1)], [card(0, 5)]], tallone: [] });
  gioca(state, BASSO, 0);
  gioca(state, ALTO, 0);
  assert.deepEqual(state.hands[BASSO], [null], "nothing to draw, so nothing drawn");
  assert.deepEqual(state.hands[ALTO], [null]);
});

test("pesca refuses a full hand instead of dropping the card", () => {
  // Unreachable in a deal — a player draws only just after playing — but the
  // harness calls pesca directly, and a card that vanished between the tallone
  // and a hand would surface much later as a deal that does not add up.
  const full = position({ hands: [[card(0, 1)], [card(0, 5)]], tallone: [card(1, 1)] });
  assert.throws(() => pesca(full, BASSO), /full hand/);
});

test("mescola can reach every arrangement, not just most of them", () => {
  // §2.2 says plain Fisher-Yates, which is uniform. Stopping the loop one step
  // early leaves a shuffle that is still a permutation and still passes every
  // other assertion here, while never swapping the last two cards. Two cards
  // and a spread of seeds says it deterministically, with no statistics.
  const orders = new Set();
  for (let seed = 1; seed <= 20; seed++)
    orders.add(mescola([card(0, 1), card(0, 2)], rngSeed(seed)).map(c => c.n).join(""));
  assert.deepEqual([...orders].sort(), ["12", "21"], "both orders come up");
});

test("newDeal starts a cold state with you leading", () => {
  const state = newDeal({ hands: [] }, rngSeed(2));   // no partitaPrimo at all
  assert.equal(state.perPrimo, BASSO, "§3.3: BASSO on a cold start");
  assert.equal(state.deveGiocare, BASSO);
});
