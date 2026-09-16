// The trap positions of §3.4, on node --test. No dependencies.
//
// A win rate can hide a stupid habit: an opponent that throws its asso under a
// tre every tenth deal still wins most of them. These assert the obvious play
// directly, in a position built by hand.
//
// Every trap has a real choice in it. A position where every legal play is
// forced asserts nothing about how the opponent chooses, and iteration 1 shipped
// three tests like that before a review caught them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";

const here = rel => fileURLToPath(new URL(rel, import.meta.url));

runInThisContext(readFileSync(here("../public/engine.js"), "utf8"));

const { BASSO, ALTO, SUITS, mosseLegali, rngSeed, newDeal, gioca, compGioca,
        scoreDeal, rollProfiles, fuori, sicura, controlli, WEIGHT_KEYS,
        coda, CODA_FROM } = globalThis;

const P = rollProfiles(rngSeed(1)).Valerio;
const card = (s, n) => ({ s, n });
const name = c => `${["asso","due","tre","4","5","6","7","fante","cavallo","re"][c.n - 1]} di ${SUITS[c.s]}`;

// A position with the opponent (ALTO) to play. `seen` is what has already gone;
// `tallone` is what is left to draw, which only has to be long enough for the
// draws the trick takes.
function table({ alto, basso, led = null, gone = [], tricks = 0, tallone = [],
                 endgame = false }){
  const played = [null, null];
  // `endgame` completes the position: every card not in a hand and not in the
  // tallone has been played. An endgame position has to add up, because from
  // CODA_FROM on the opponent deduces the other hand from exactly this — and
  // it refuses to search a position that does not, rather than answer
  // confidently from a 41-card deck.
  if (endgame){
    const held = new Set([...alto, ...basso].map(c => c.s * 11 + c.n));
    gone = [];
    for (let su = 0; su < 4; su++)
      for (let n = 1; n <= 10; n++)
        if (!held.has(su * 11 + n)) gone.push({ s: su, n });
  }
  // Cards already out of play sit at the front of the deck, dealt and gone.
  const cards = [...gone, ...tallone];
  const state = {
    cards, next: gone.length,
    hands: [basso.slice(), alto.slice()],
    played, terzi: [0, 0],
    voids: [[false, false, false, false], [false, false, false, false]],
    seen: [], accusi: [[], []], detti: [true, true],
    tricks, over: false,
    perPrimo: led ? BASSO : ALTO,
    deveGiocare: ALTO,
    partitaPrimo: BASSO
  };
  if (led){
    // By value, not by identity: card(0, 1) called twice makes two objects, so
    // `!== led` removed nothing and the led card sat face up on the table and
    // in BASSO's hand at the same time — a 41-card deck, and fuori() reporting
    // a card lying in front of it as outstanding.
    state.played[BASSO] = led;
    const i = basso.findIndex(c => c && c.s === led.s && c.n === led.n);
    assert.ok(i !== -1, "the led card has to come out of the hand that led it");
    state.hands[BASSO] = basso.slice();
    state.hands[BASSO][i] = null;
  }
  return state;
}

const chooses = (state, expected, why) => {
  const slot = compGioca(state, P);
  const got = state.hands[ALTO][slot];
  assert.equal(`${got.s}-${got.n}`, `${expected.s}-${expected.n}`,
    `${why}\n   expected ${name(expected)}, played ${name(got)}`);
};

/* --- the four traps §3.4 names ---------------------------------------------- */

test("an asso on the table and the tre in hand: it takes", () => {
  // The asso is a whole point. Declining it to keep the tre is the mistake a
  // control-hoarding weight set can drift into.
  const state = table({
    led: card(0, 1),
    basso: [card(0, 1), card(2, 4)],
    // The tre sits in the second slot on purpose: ties go to the lowest slot,
    // so with the tre first this position would be passed by an opponent that
    // scores taking at zero and only wins the tie.
    alto: [card(0, 7), card(0, 3), card(1, 4)],
    tallone: [card(3, 4), card(3, 5)]
  });
  chooses(state, card(0, 3), "it must capture an asso with the tre");
});

test("forced to follow with only an asso and a figure: it gives the figure", () => {
  // Both are legal and both lose the trick. Losing the asso costs three terzi;
  // the fante costs one.
  const state = table({
    led: card(0, 3),
    basso: [card(0, 3), card(2, 4)],
    alto: [card(0, 1), card(0, 8), card(1, 4)],
    tallone: [card(3, 4), card(3, 5)]
  });
  chooses(state, card(0, 8), "it must throw the fante, not the asso");
});

test("at tricks == 18 it plays the two tricks out instead of scoring them", () => {
  // §3.4's worked position is a Re and a 7, and it no longer discriminates: the
  // 7 it asks for is a liscio, and a tuned liscio bonus leads it anyway, so the
  // trap passed with the solver switched off. This is the same shape with the
  // liscio removed — two point cards, so only the enumeration can choose.
  //
  //   lead the re di coppe:  they follow with the fante, I take 2 terzi; then my
  //                          fante di spade meets their asso, and they take
  //                          1 + 3 + the ultima's 3. Me 2, them 7.
  //   lead the fante di spade: their asso takes 4; then they lead the fante di
  //                          coppe into my re, which takes 1 + 1 + 3. Me 5.
  //
  // The re is sure — the tre, due and asso of coppe have gone — so the formula
  // scores it above the fante and leads it. Only playing it out finds the 5.
  const state = table({
    alto: [card(1, 10), card(2, 8)],            // re di coppe, fante di spade
    basso: [card(1, 8), card(2, 1)],            // fante di coppe, asso di spade
    tricks: 18, endgame: true
  });
  chooses(state, card(2, 8), "the last two tricks are played out, not scored");
});

test("the tre, due and asso of a suit gone: a 7 of it is still not sure", () => {
  // §3.4's trap, asserted on sure() itself rather than on which card gets led.
  // The first draft of this test asserted the 7 was not led, and it failed on a
  // tuned profile that leads it — correctly, as a liscio worth nothing, which
  // is a fine lead and not a claim that it wins. What the trap is really about
  // is the near-miss in §3.4's first draft: outstanding() covering only the 3,
  // the 2 and the asso would make this 7 sure, because nothing above it would
  // be left to count. The re, the cavallo and the fante still beat it.
  const gone = [card(3, 3), card(3, 2), card(3, 1), card(3, 10)];   // bastoni, top four
  const state = table({
    alto: [card(3, 7), card(3, 9), card(0, 5)],            // 7 and cavallo di bastoni
    basso: [card(1, 4), card(1, 5), card(1, 6)],
    gone,
    tricks: 12,
    tallone: []
  });
  const still = fuori(state, ALTO);
  assert.equal(sicura(still, card(3, 7)), false,
    "the 7 di bastoni: the fante of bastoni is unaccounted for and beats it");
  assert.equal(sicura(still, card(3, 9)), true,
    "the cavallo di bastoni: everything above it has gone");

  // And the near-miss itself: over the three control cards alone, it would be.
  assert.deepEqual(controlli(still, 3), [], "no control card of bastoni is left");
});

test("a card still in the tallone counts against you", () => {
  // fuori() treats the undrawn tallone as outstanding, which is the
  // conservative side: sure() must never call a card safe that can still be
  // beaten. Marking the tallone as known would make more cards look sure and
  // the opponent would lead them into cards that are simply not out yet.
  // Here the tre, due and asso of denari are all still face down.
  const state = table({
    alto: [card(0, 10), card(1, 5), card(2, 6)],           // re di denari
    basso: [card(1, 4), card(1, 7), card(3, 9)],
    gone: [card(3, 4), card(3, 5), card(3, 6), card(3, 7)],
    tallone: [card(0, 3), card(0, 2), card(0, 1)],         // face down, not gone
    tricks: 4
  });
  const still = fuori(state, ALTO);
  assert.equal(sicura(still, card(0, 10)), false,
    "the re di denari is not sure while its tre, due and asso are in the tallone");
});

/* --- the habits a win rate hides -------------------------------------------- */

test("it does not lead an asso while the tre and due of that suit are out", () => {
  // No liscio in this hand, deliberately. The first version of this trap gave
  // the opponent a 5 to lead, and the liscio bonus of 12 decided it — so the
  // ace-exposed penalty never entered the comparison and zeroing that weight
  // did not fail the test. Two point cards is the position where the penalty
  // is the only thing that can choose, and the asso sits in the lower slot so
  // a tie goes the wrong way.
  const state = table({
    alto: [card(0, 1), card(1, 10)],           // bare asso di denari, re di coppe
    basso: [card(2, 4), card(2, 5)],
    tricks: 12,
    tallone: []
  });
  chooses(state, card(1, 10), "leading a bare asso into the tre and the due hands over a point");
});

test("the trick it is offered is worth the card on the table too", () => {
  // §3.4: takes → score = (L + v) × TAKE_TERZI_WEIGHT. Dropping L — scoring only
  // the card it plays — makes it decline a trick that is carrying a point card,
  // and nothing else in this suite notices: the terzi still sum to 32 and the
  // deal still scores 11.
  const state = table({
    led: card(0, 8),                            // fante di denari, one terzo
    basso: [card(0, 8), card(2, 4)],
    alto: [card(0, 7), card(0, 3)],             // a liscio, or the tre
    tricks: 0,
    tallone: [card(3, 4), card(3, 5)]
  });
  chooses(state, card(0, 3), "two terzi on the table are worth the tre this early");
});

test("late in the deal the same cheap trick is not worth the tre", () => {
  // The same position at trick twelve. The spend-control penalty is multiplied
  // by k, which has reached 2 by now, and the trick is worth less than an asso
  // — so the tre is kept and the liscio goes. This pins two things at once that
  // nothing else pins: the floor is `L + v < 3` and not `< 2`, and the penalty
  // carries the k that §3.4 spends a paragraph defending.
  const state = table({
    led: card(0, 8),
    basso: [card(0, 8), card(2, 4)],
    alto: [card(0, 7), card(0, 3)],
    tricks: 12,
    tallone: []
  });
  chooses(state, card(0, 7), "late, a two-terzi trick does not pay for the tre");
});

test("given a free discard, it keeps the asso's guard", () => {
  // Void in the led suit, so this is a pure discard. One of its cards is the
  // only thing standing between its asso and a discard; the other is spare.
  const state = table({
    led: card(0, 5),
    basso: [card(0, 5), card(0, 6)],
    alto: [card(1, 1), card(1, 4), card(2, 7)],   // asso di coppe, guarded by the 4
    tallone: [card(3, 4), card(3, 5)]
  });
  chooses(state, card(2, 7), "the spare card goes, not the asso's guard");
});

test("every trap has a real choice in it", () => {
  // The rule iteration 1 learned the hard way: a position where the opponent
  // has one legal card asserts nothing. This is the assertion that keeps the
  // assertions honest.
  const positions = [
    table({ led: card(0, 1), basso: [card(0, 1), card(2, 4)],
            alto: [card(0, 7), card(0, 3), card(1, 4)], tallone: [card(3,4), card(3,5)] }),
    table({ led: card(0, 3), basso: [card(0, 3), card(2, 4)],
            alto: [card(0, 1), card(0, 8), card(1, 4)], tallone: [card(3,4), card(3,5)] }),
    table({ alto: [card(1, 10), card(2, 8)], basso: [card(1, 8), card(2, 1)],
            tricks: 18, endgame: true }),
    table({ led: card(0, 5), basso: [card(0, 5), card(0, 6)],
            alto: [card(1, 1), card(1, 4), card(2, 7)], tallone: [card(3,4), card(3,5)] })
  ];
  for (const [i, state] of positions.entries()){
    const led = state.deveGiocare === state.perPrimo ? null : state.played[state.perPrimo];
    assert.ok(mosseLegali(state.hands[ALTO], led).length > 1,
      `position ${i} leaves the opponent only one legal card, so it tests nothing`);
  }
});

test("what it knows survives a copy of the state", () => {
  // fuori() used to key its set on card objects, so any state that had been
  // through JSON, structuredClone or a defensive copy in render() looked like
  // one where every held card had already been played — and every card would
  // then be sure. It threw nothing and logged nothing; it just led into cards
  // that were still out.
  const state = table({
    alto: [card(0, 10), card(1, 5)],
    basso: [card(1, 4), card(1, 7)],
    gone: [card(0, 3), card(0, 2), card(0, 1)],
    tricks: 12
  });
  const direct = fuori(state, ALTO);
  const copied = fuori(JSON.parse(JSON.stringify(state)), ALTO);
  assert.deepEqual(copied, direct, "a copy of the position is the same position");
  assert.equal(sicura(copied, card(0, 10)), true, "the re is still sure through a copy");
  assert.equal(sicura(copied, card(1, 5)), false, "and the 5 di coppe is still not");
});

test("from CODA_FROM on it searches, and everywhere else it scores", () => {
  // The search needs the other hand, which it deduces from what has been
  // played — sound only once the tallone is empty. The risk is not that it
  // answers wrongly; it is that the deduction quietly stops adding up and the
  // opponent falls back to the formula for the rest of the game while every
  // test still passes. So: assert it actually fires, in real deals.
  let searched = 0, scored = 0;
  for (let seed = 1; seed <= 25; seed++){
    const rng = rngSeed(seed);
    const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
    while (!state.over){
      if (state.tricks >= CODA_FROM){
        assert.notEqual(coda(state, state.deveGiocare), null,
          `seed ${seed}, trick ${state.tricks}: the deduction did not add up`);
        searched++;
      } else scored++;
      gioca(state, state.deveGiocare, compGioca(state, P));
    }
  }
  assert.equal(searched, 25 * 2 * (20 - CODA_FROM), "every play from CODA_FROM on is searched");
  assert.equal(scored, 25 * 2 * CODA_FROM, "and every play before it is scored");
});

test("a position that does not add up is refused, not guessed at", () => {
  // The same position with the tallone still holding cards: the deduction
  // would hand the search a hand far larger than the one they hold. It has to
  // say so rather than search a fiction.
  const half = table({
    alto: [card(1, 10), card(2, 8)],
    basso: [card(1, 8), card(2, 1)],
    gone: [card(1, 3), card(1, 2)],              // most of the deck unaccounted
    tricks: 18
  });
  assert.equal(coda(half, ALTO), null, "it refuses a position it cannot deduce");
  assert.ok(compGioca(half, P) !== undefined, "and compGioca still answers, from the formula");
});

/* --- the fixture ------------------------------------------------------------ */

test("the golden fixture: twenty deals, play for play", () => {
  // §3.4's contract from v1.0 on is change a weight, not the formula. This is
  // what makes that contract checkable: twenty deals with the opponent in both
  // seats, every card it played, frozen. A formula change moves these plays and
  // this test says so. A weight change moves them too — deliberately — and then
  // the fixture is re-recorded in the same commit, which is the point at which
  // someone has to say out loud that the opponent now plays differently.
  const golden = JSON.parse(readFileSync(here("./golden.json"), "utf8"));
  const P = rollProfiles(rngSeed(1)).Valerio;

  assert.deepEqual(P, golden.profile,
    "the weights have moved: re-record the fixture in the same commit, and say so");

  const short = c => `${["A","2","3","4","5","6","7","F","C","R"][c.n - 1]}${"dcsb"[c.s]}`;
  for (const deal of golden.deals){
    const rng = rngSeed(deal.seed);
    const state = newDeal({ hands: [], partitaPrimo: deal.seed % 2 ? BASSO : ALTO }, rng);
    const plays = [];
    while (!state.over){
      const who = state.deveGiocare;
      const slot = compGioca(state, P);
      plays.push(`${who === BASSO ? "B" : "A"}${short(state.hands[who][slot])}`);
      gioca(state, who, slot);
    }
    assert.equal(plays.join(" "), deal.plays, `seed ${deal.seed}: the plays have changed`);
    assert.deepEqual(scoreDeal(state), deal.score, `seed ${deal.seed}: the score has changed`);
  }
});

test("the fixture covers both seats and enough of the deal to be worth freezing", () => {
  // A fixture that only ever recorded one seat, or only the first few tricks,
  // would freeze very little while looking thorough.
  const golden = JSON.parse(readFileSync(here("./golden.json"), "utf8"));
  assert.equal(golden.deals.length, 20);
  assert.deepEqual(Object.keys(golden.profile).sort(), [...WEIGHT_KEYS].sort(),
    "the fixture records every weight, so a new one cannot slip in unrecorded");
  for (const deal of golden.deals){
    const plays = deal.plays.split(" ");
    assert.equal(plays.length, 40, `seed ${deal.seed}: a full deal is forty plays`);
    assert.ok(plays.some(p => p[0] === "B"), `seed ${deal.seed}: no plays from the lower seat`);
    assert.ok(plays.some(p => p[0] === "A"), `seed ${deal.seed}: no plays from the upper seat`);
  }
  for (const deal of golden.deals)
    assert.equal(deal.plays.split(" ")[0][0], deal.lead,
      `seed ${deal.seed}: the recorded leader is not who played first`);
  assert.ok(golden.deals.some(d => d.lead === "B") && golden.deals.some(d => d.lead === "A"),
    "the deals should not all be led by the same seat");
});
