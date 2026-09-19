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
import { runInThisContext, runInContext, createContext } from "node:vm";
import { fileURLToPath } from "node:url";

const here = rel => fileURLToPath(new URL(rel, import.meta.url));

runInThisContext(readFileSync(here("../public/engine.js"), "utf8"));

const { BASSO, ALTO, SUITS, mosseLegali, rngSeed, newDeal, gioca, compGioca,
        scoreDeal, rollProfiles, fuori, sicura, controlli, WEIGHT_KEYS,
        coda, CODA_FROM, manoDedotta } = globalThis;

const P = rollProfiles(rngSeed(1)).Franco;
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
    // The led card counts as played, not as held — it is face up on the table.
    // Modelling it as still in hand made the deduced hand one card too big and
    // sent the opponent back to the formula in a position built to test the
    // search.
    const held = new Set([...alto, ...basso]
      .filter(c => !(led && c.s === led.s && c.n === led.n))
      .map(c => c.s * 11 + c.n));
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
    voidAt: [[-1, -1, -1, -1], [-1, -1, -1, -1]],
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

// Every trap asserts two things: that the opponent played the card it should,
// and that it had a choice at all. The second used to be a separate test with a
// hand-copied list of positions, which drifted to covering four of seven — so
// it lives here now, where a new trap gets it whether or not anyone remembers.
// The rule comes from iteration 1: a position where every legal play is forced
// asserts nothing about how the opponent chooses.
const chooses = (state, expected, why) => {
  const led = state.deveGiocare === state.perPrimo ? null : state.played[state.perPrimo];
  assert.ok(mosseLegali(state.hands[ALTO], led).length > 1,
    `${why}\n   this position leaves only one legal card, so it tests nothing`);
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

test("what it knows survives a copy of the state", () => {
  // fuori() used to key its set on card objects, so any state that had been
  // through JSON, structuredClone or a defensive copy in render() looked like
  // one where every held card had already been played — and every card would
  // then be sure. It threw nothing and logged nothing; it just led into cards
  // that were still out.
  //
  // This has to be a dealt position, not one built by table(). In a built one
  // the hands and the deck are separate objects, so identity and value keying
  // agree and the bug cannot show — which is how the first version of this test
  // passed against the very code it was written for.
  const rng = rngSeed(3);
  const state = newDeal({ hands: [], partitaPrimo: BASSO }, rng);
  for (let i = 0; i < 8; i++) gioca(state, state.deveGiocare, compGioca(state, P));

  const direct = fuori(state, ALTO);
  const copied = fuori(JSON.parse(JSON.stringify(state)), ALTO);
  assert.deepEqual(copied, direct, "a copy of the position is the same position");
  assert.equal(direct.flat().filter(Boolean).length, copied.flat().filter(Boolean).length,
    "and it knows the same number of cards are still out");
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
  // Written against the numbers rather than against CODA_FROM: an assertion
  // phrased in terms of the constant moves with it and cannot fail when it
  // changes, which is the one change most worth noticing here.
  assert.equal(CODA_FROM, 13, "if this moved, the two counts below have to move with it");
  assert.equal(searched, 350, "seven tricks of search, both seats, 25 deals");
  assert.equal(scored, 650, "and thirteen tricks of formula");
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

test("following, at three cards: it throws the liscio and keeps the re", () => {
  // The following seat had no endgame trap at all, in three reviews. This one
  // also pins the trick-to-trick hand-off inside the search — getting the next
  // leader wrong is worth seventeen points of win rate, and until now only the
  // golden fixture noticed, which is a file that gets re-recorded.
  //
  // They lead the 4 di coppe and the opponent is void, so it is a free discard
  // and they take the trick either way. Throw the 7 di bastoni and the re di
  // denari is still there to take their fante di denari, with the ultima on it:
  // five terzi. Throw the re instead and it scores them a terzo now and hands
  // over the card that would have taken the last trick: nothing.
  const state = table({
    led: card(1, 4),                                    // 4 di coppe
    basso: [card(1, 4), card(2, 9), card(0, 8)],        // 4 di coppe, cavallo di spade, fante di denari
    alto: [card(3, 7), card(0, 10), card(3, 8)],        // 7 di bastoni, re di denari, fante di bastoni
    tricks: 17, endgame: true
  });
  chooses(state, card(3, 7), "the liscio goes; the re has a trick left in it");
});

test("leading, at three cards: it does not walk into the suit they hold", () => {
  // Found by searching for a position where a search that forgets follow-suit
  // answers differently — the filter is in the search as well as in
  // mosseLegali, and nothing but the fixture was checking it.
  //
  // Leading the 4 di bastoni runs into their 7, and they then keep the tre di
  // coppe to take the last trick: nothing. Leading the re di denari, which they
  // cannot follow, wins a terzo and leaves the 4 to lose harmlessly later.
  const state = table({
    alto: [card(3, 4), card(0, 10), card(1, 10)],       // 4 di bastoni, re di denari, re di coppe
    basso: [card(3, 7), card(1, 9), card(1, 3)],        // 7 di bastoni, cavallo and tre di coppe
    tricks: 17, endgame: true
  });
  chooses(state, card(0, 10), "lead the suit they cannot follow, not into their 7");
});

test("the hand it deduces is exactly the hand they hold", () => {
  // The guard checks a count, and the claim is that the count is enough: fuori's
  // set always contains their whole hand and never contains mine, so the right
  // size implies the right cards. That is an argument; this is the measurement.
  // A test may look at both hands, which is the one thing the engine may not.
  let checked = 0;
  for (let seed = 1; seed <= 60; seed++){
    const rng = rngSeed(seed);
    const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
    while (!state.over){
      const me = state.deveGiocare, them = me === BASSO ? ALTO : BASSO;
      if (state.tricks >= CODA_FROM){
        const key = c => c.s * 11 + c.n;
        const deduced = manoDedotta(state, me).map(key).sort((a, b) => a - b);
        const actual = state.hands[them].filter(c => c).map(key).sort((a, b) => a - b);
        assert.deepEqual(deduced, actual,
          `seed ${seed}, trick ${state.tricks}: the deduction is not their hand`);
        checked++;
      }
      gioca(state, me, compGioca(state, P));
    }
  }
  assert.ok(checked > 800, `only ${checked} deductions checked`);
});

test("following, it takes with the card that banks the most", () => {
  // The capture term: §3.4 scores a trick it takes as the cards on it. Drop it
  // and both winning cards look alike, and it takes with the wrong one. Only
  // the fixture noticed, and the fixture is re-recorded whenever a weight moves.
  //
  // They lead the 4 di bastoni. Both the asso and the re of bastoni take it.
  // The asso banks its own three terzi; the re banks one and leaves the asso
  // in hand for a trick it may not get.
  const state = table({
    led: card(3, 4),                                            // 4 di bastoni
    basso: [card(3, 4), card(2, 5), card(2, 7), card(3, 5)],
    alto: [card(1, 5), card(3, 1), card(3, 10), card(0, 2)],    // asso and re di bastoni
    tricks: 16, endgame: true
  });
  chooses(state, card(3, 1), "take with the asso, not the re");
});

test("the ultima is worth three terzi, not one and not six", () => {
  // Its presence and its timing are trapped; its size was not, and a last trick
  // priced at one or at six changes which card is kept for it. Here the 4 di
  // bastoni is the discard at three terzi and the due di bastoni is the discard
  // at one.
  const tooCheap = table({
    led: card(3, 9),                                            // cavallo di bastoni
    basso: [card(3, 9), card(0, 9), card(3, 1), card(0, 5)],
    alto: [card(2, 8), card(3, 2), card(3, 4), card(2, 9)],
    tricks: 16, endgame: true
  });
  chooses(tooCheap, card(3, 4), "priced at three terzi, the 4 is the card to give");

  // And one that goes the other way, because a single position only ever
  // catches the error on one side of the right answer: this one changes its
  // mind if the last trick is priced at six.
  const tooDear = table({
    led: card(1, 5),                                            // 5 di coppe
    basso: [card(1, 5), card(2, 2), card(2, 3), card(1, 10)],
    alto: [card(1, 2), card(0, 2), card(1, 4), card(0, 3)],
    tricks: 16, endgame: true
  });
  chooses(tooDear, card(1, 2), "priced at three, the due di coppe takes this trick");
});

// The inference this game is played on, and the one that expires. A player who
// cannot follow says so publicly — and then draws, and the card is unknown, so
// what they said stops being certain. The opponent used to believe it whole
// for the rest of the deal: 72% of the leads that scored a suit as "they
// cannot take this" were scoring a void the drawer had already had a chance to
// fill (552 of 764, over 480 deals).
//
// Dropping it on the first draw was measured and is worse — 46.9% of 800
// mirrored games against believing it whole, because one unknown card rarely
// fills a suit. So it decays instead: p is the chance no card they drew since
// was of that suit, the eleventh weight is multiplied by it, and there is no
// twelfth.
test("a void decays as they draw, and is permanent once the tallone is empty", () => {
  const state = newDeal({ hands: [], partitaPrimo: BASSO }, rngSeed(169 * 7919));

  // Shown this instant: nothing has been drawn since, so it is worth all of it.
  state.voids[ALTO][3] = true;
  state.voidAt[ALTO][3] = state.next;
  assert.equal(stillVoid(state, fuori(state, BASSO), ALTO, 3), 1,
    "a void shown with no draw since is certain");

  // Four cards out of the tallone, two of them theirs: p is the chance neither
  // was that suit, so it is below 1 and above 0, and falls as they draw again.
  const before = state.next;
  state.next += 4;
  const two = stillVoid(state, fuori(state, BASSO), ALTO, 3);
  state.next += 4;
  const four = stillVoid(state, fuori(state, BASSO), ALTO, 3);
  assert.ok(two < 1 && two > 0, `two draws left p at ${two}`);
  assert.ok(four < two, `four draws (${four}) has to be worth less than two (${two})`);
  state.next = before;

  // And the half that makes the other half worth having: past the tallone
  // state.next stops moving, so a void shown then is permanent.
  const dry = newDeal({ hands: [], partitaPrimo: BASSO }, rngSeed(169 * 7919));
  dry.next = dry.cards.length;
  dry.voids[ALTO][3] = true;
  dry.voidAt[ALTO][3] = dry.next;
  assert.equal(stillVoid(dry, fuori(dry, BASSO), ALTO, 3), 1,
    "with nothing left to draw, a void is a void for the rest of the deal");

  // It changes a play, which is the point of it. This deal reaches trick ten
  // with BASSO to lead and ALTO shown out of spade and bastoni; believing that
  // whole leads the due di spade into the void, while the same position with
  // the same voids shown five draws earlier leads the due di bastoni instead.
  const P = rollProfiles(rngSeed(1)).Franco;
  const deal = newDeal({ hands: [], partitaPrimo: BASSO }, rngSeed(169 * 7919));
  while (!(deal.tricks === 9 && deal.deveGiocare === deal.perPrimo))
    gioca(deal, deal.deveGiocare, compGioca(deal, P));
  assert.equal(deal.deveGiocare, BASSO, "the position is BASSO's to lead");
  assert.deepEqual(deal.voids[ALTO], [false, false, true, true],
    "and ALTO has shown out of spade and bastoni");

  const clone = () => JSON.parse(JSON.stringify(deal));
  const fresh = clone(), stale = clone();
  for (const suit of [2, 3]){
    fresh.voidAt[ALTO][suit] = fresh.next;        // shown this trick
    stale.voidAt[ALTO][suit] = stale.next - 10;   // shown five of their draws ago
  }
  const fromFresh = deal.hands[BASSO][compGioca(fresh, P)];
  const fromStale = deal.hands[BASSO][compGioca(stale, P)];
  assert.deepEqual(fromFresh, { s: 2, n: 2 }, "a fresh void is led into: the due di spade");
  assert.deepEqual(fromStale, { s: 3, n: 2 }, "a decayed one is not: the due di bastoni");
});

test("the transposition table changes the speed and not the answer", () => {
  // The memo is the only part of the search that can be wrong while the search
  // looks right: a key that loses the led card, or whose turn it is, returns a
  // real answer to a different question. Ask the same positions with the memo
  // doing nothing and compare.
  // Newlines normalised first. This reads the file as text and cuts two lines
  // out of it by name, so on a Windows checkout — where the working copy is
  // CRLF — the pattern matched nothing, the "un-memoised" search was the
  // memoised one, and the test compared the search against itself. It failed
  // on the assertion below rather than passing quietly, which is the only
  // reason it was ever noticed.
  const source = readFileSync(here("../public/engine.js"), "utf8")
    .replace(/\r\n/g, "\n");
  const naked = source
    .replace("  const seen = memo.get(key);\n  if (seen !== undefined) return seen;", "");
  assert.notEqual(naked, source,
    "the memo lookup has to be the thing that was removed");
  const bare = createContext({});
  runInContext(naked, bare);

  // From trick 16 on, where an un-memoised search is still cheap. The key is
  // the same key at every depth, so four cards exercises it as well as seven
  // and finishes in a second rather than a minute.
  let compared = 0;
  for (let seed = 1; seed <= 25; seed++){
    const rng = rngSeed(seed);
    const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
    while (!state.over){
      if (state.tricks >= 16){
        const mine = coda(state, state.deveGiocare);
        const theirs = bare.coda(JSON.parse(JSON.stringify(state)), state.deveGiocare);
        assert.equal(mine, theirs,
          `seed ${seed}, trick ${state.tricks}: memoised and un-memoised disagree`);
        compared++;
      }
      gioca(state, state.deveGiocare, compGioca(state, P));
    }
  }
  assert.ok(compared >= 200, `only ${compared} positions compared`);
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
  const profiles = rollProfiles(rngSeed(1));

  // Every weight of every player, Piero's rolled eleven included: a change to
  // his ranges, or to the order they are drawn in, moves numbers nobody wrote
  // by hand and this is what notices.
  assert.deepEqual(profiles, golden.profiles,
    "the weights have moved: re-record the fixture in the same commit " +
    "(node tools/selfplay.mjs --golden > tools/golden.json), and say so");

  const short = c => `${["A","2","3","4","5","6","7","F","C","R"][c.n - 1]}${"dcsb"[c.s]}`;
  for (const deal of golden.deals){
    const P = profiles[deal.who];
    const rng = rngSeed(deal.seed);
    const state = newDeal({ hands: [], partitaPrimo: deal.seed % 2 ? BASSO : ALTO }, rng);
    const plays = [];
    while (!state.over){
      const who = state.deveGiocare;
      const slot = compGioca(state, P);
      plays.push(`${who === BASSO ? "B" : "A"}${short(state.hands[who][slot])}`);
      gioca(state, who, slot);
    }
    assert.equal(plays.join(" "), deal.plays, `${deal.who}, seed ${deal.seed}: the plays have changed`);
    assert.deepEqual(scoreDeal(state), deal.score, `${deal.who}, seed ${deal.seed}: the score has changed`);
  }
});

test("the fixture covers both seats and enough of the deal to be worth freezing", () => {
  // A fixture that only ever recorded one seat, or only the first few tricks,
  // would freeze very little while looking thorough.
  const golden = JSON.parse(readFileSync(here("./golden.json"), "utf8"));

  // Twenty deals each for the three tuned players. Piero's weights are frozen
  // above but his deals are not: he is rolled, so freezing his plays would
  // freeze one session of a player whose whole point is that he changes.
  assert.equal(golden.deals.length, 60);
  for (const who of ["Franco", "Valerio", "Graziano"])
    assert.equal(golden.deals.filter(d => d.who === who).length, 20,
      `${who} should have twenty deals in the fixture`);
  for (const P of Object.values(golden.profiles))
    assert.deepEqual(Object.keys(P).sort(), [...WEIGHT_KEYS].sort(),
      "the fixture records every weight, so a new one cannot slip in unrecorded");
  for (const deal of golden.deals){
    const plays = deal.plays.split(" ");
    assert.equal(plays.length, 40, `${deal.who}, seed ${deal.seed}: a full deal is forty plays`);
    assert.ok(plays.some(p => p[0] === "B"), `${deal.who}, seed ${deal.seed}: no plays from the lower seat`);
    assert.ok(plays.some(p => p[0] === "A"), `${deal.who}, seed ${deal.seed}: no plays from the upper seat`);
  }
  for (const deal of golden.deals)
    assert.equal(deal.plays.split(" ")[0][0], deal.lead,
      `seed ${deal.seed}: the recorded leader is not who played first`);
  assert.ok(golden.deals.some(d => d.lead === "B") && golden.deals.some(d => d.lead === "A"),
    "the deals should not all be led by the same seat");
});

/* --- the roster -------------------------------------------------------------- */

test("four players, and each one plays a different game", () => {
  // §4 iteration 5's "done when", made checkable. A roster where two names
  // choose the same card is what dropped Valerio: iteration 2 measured him and
  // Franco agreeing on 99% of choices, and a table cannot carry two names for
  // one player.
  //
  // Counted over dealt positions with more than one legal card, because a
  // forced move is not a temperament. `SEED_FROM=5001 node tools/selfplay.mjs
  // --differ 200` prints the share: 13.8% of 32,000 plays, 6.2% of leads and
  // 24.0% of follows. (A comment here used to say "about half", which was
  // three times the truth and nobody had counted.)
  const P4 = rollProfiles(rngSeed(1));
  const names = ["Franco", "Valerio", "Graziano", "Piero"];
  assert.deepEqual(Object.keys(P4).sort(), [...names].sort());

  const pairs = names.flatMap((a, i) => names.slice(i + 1).map(b => [a, b]));
  const differ = Object.fromEntries(pairs.map(p => [p.join(" vs "), 0]));
  let decisions = 0;

  for (let seed = 1; seed <= 24; seed++){
    const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rngSeed(seed));
    // A different profile drives each deal. One driver's positions are one
    // player's positions — a loose player reaches different hands from a tight
    // one — and asking every question about Franco's hands flattered the pairs
    // that play like Franco.
    const driver = P4[names[seed % names.length]];
    while (!state.over){
      const who = state.deveGiocare;
      const led = who === state.perPrimo ? null : state.played[state.perPrimo];
      // Decisions the weights actually make: not the forced moves, and not the
      // endgame, where compGioca enumerates the rest of the deal and all four
      // play the same card whatever their weights say. Counting the endgame
      // put 31% of zero-difference decisions in the denominator and made every
      // figure 1.45 times too small.
      if (mosseLegali(state.hands[who], led).length > 1 && state.tricks < CODA_FROM){
        decisions++;
        const chose = Object.fromEntries(names.map(k => [k, compGioca(state, P4[k])]));
        for (const [a, b] of pairs) if (chose[a] !== chose[b]) differ[`${a} vs ${b}`]++;
      }
      gioca(state, who, compGioca(state, driver));
    }
  }

  // Twenty-four seeds and a 5% floor, both measured rather than picked. Over 40
  // disjoint twenty-four-seed windows the tightest pair — Graziano and Piero,
  // who share a corner's long suit and differ on the lisci — ran 6.4% to 12.3%,
  // so the floor sits 1.4 points under the worst window seen. Pooled over
  // 19,000 decisions that pair is 11.6% on seeds 5001+ and 10.8% on 90001+
  // (`--differ 200`), which is the size of the thing this floor guards.
  //
  // The first version of this test used eight seeds and a 5% floor on a metric
  // that counted the endgame, where every profile plays alike by construction:
  // there the same statistic ran as low as 4.5% and the suite passed only
  // because seeds 1 to 8 are a lucky window. That is the review's finding, and
  // the reason every number in this comment says where it came from.
  //
  // It is a floor against sameness, not a target: what the roster is worth is
  // measured by tools/selfplay.mjs --differ, not here.
  for (const [pair, count] of Object.entries(differ))
    assert.ok(count / decisions >= 0.05,
      `${pair} choose the same card ${(100 * (1 - count / decisions)).toFixed(1)}% of the time: ` +
      `that is one player with two names`);
});

test("Piero is rolled once per session, and the same roll twice is the same Piero", () => {
  // The 1997 behaviour §0 keeps: SetProfiles ran from FormCreate. Two sessions
  // get two Pieros; one seed gets one Piero, which is what makes the fixture
  // and these tests possible at all.
  const a = rollProfiles(rngSeed(1)).Piero;
  const b = rollProfiles(rngSeed(1)).Piero;
  const c = rollProfiles(rngSeed(2)).Piero;
  assert.deepEqual(a, b, "the same seed has to give the same Piero");
  assert.notDeepEqual(a, c, "two sessions have to give two Pieros");

  // And every Piero stands where neither of the other two does. Two weights
  // decide the game a profile plays — whether it leads its long suit, and what
  // a liscio is worth leading — and Franco and Graziano hold two of the four
  // corners between them. Piero draws one of the other two, so he cannot roll
  // into somebody else's game: the first version of this could, and did, at
  // 98.4% the same card as Graziano.
  const rolled = new Set();
  for (const seed of [1, 2, 3, 17, 99, 1234, 20260916]){
    const P = rollProfiles(rngSeed(seed)).Piero;
    assert.equal(Object.keys(P).length, WEIGHT_KEYS.length);
    for (const key of WEIGHT_KEYS) assert.ok(Number.isFinite(P[key]), `${key} is not a number`);

    // Every Piero stands in the corner the other two leave empty: he leads the
    // long suit like Graziano and keeps his lisci like Franco. Those two
    // weights are his stance and are not rolled — a Piero who rolled into
    // somebody else's corner was 98.4% the same card as Graziano, which is the
    // two-names-one-player problem that dropped Valerio.
    assert.ok(P.LEAD_LONG_SUIT >= 0.3, `seed ${seed}: a Piero who does not lead his long suit is a Franco`);
    assert.ok(P.LEAD_LISCIO_BONUS >= 12, `seed ${seed}: a Piero who spends his lisci is a Graziano`);
    rolled.add(WEIGHT_KEYS.map(k => P[k]).join(","));
  }
  assert.equal(rolled.size, 7, "two sessions drew the same Piero: the roll is not rolling");
});

// Reported from a real deal: the opponent discarded on a led bastoni and two
// tricks later played one. That is the tallone, not a rule break — for the
// first ten tricks both players draw after every trick, so a void shown at
// trick 3 says nothing about trick 9 — but nothing in this suite said so, and
// "did the opponent just cheat?" deserves an answer that is checked rather
// than argued.
//
// The check does not trust `state.perPrimo`. The led card is whatever is
// already on the table when a player acts, whoever put it there: if perPrimo
// were ever wrong, gioca's own legality test would be asking the wrong
// question and would let an off-suit card through without throwing, which is
// exactly the defect this names. Asking the position directly is the only way
// to see that.
test("it follows suit whenever it holds the led suit, and the tallone is why it can look otherwise", () => {
  const profiles = rollProfiles(rngSeed(1));
  let following = 0, drewBackIn = 0, dryVoids = 0;

  for (const who of Object.keys(profiles)){
    for (let seed = 1; seed <= 30; seed++){
      const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rngSeed(seed * 7919));
      // Voids each seat has actually shown, by this test's own bookkeeping,
      // and which of them were shown with the tallone already empty.
      const shown = [[false, false, false, false], [false, false, false, false]];
      const dry = [new Set(), new Set()];

      while (!state.over){
        const me = state.deveGiocare;
        const other = me === BASSO ? ALTO : BASSO;
        const led = state.played[other];
        const hand = state.hands[me].filter(Boolean);
        const drawsLeft = state.next < state.cards.length;
        const slot = compGioca(state, profiles[who]);
        const played = state.hands[me][slot];

        if (led){
          if (hand.some(c => c.s === led.s)){
            following++;
            assert.equal(played.s, led.s,
              `${who}, seed ${seed}, trick ${state.tricks + 1}: led ${name(led)}, ` +
              `played ${name(played)} holding ${hand.filter(c => c.s === led.s).map(name).join(", ")}`);
          } else {
            shown[me][led.s] = true;
            if (!drawsLeft) dry[me].add(led.s);
          }
        } else if (shown[me][played.s]){
          // It led a suit it had shown void in: it drew one. This is the thing
          // that looks like cheating and is not, and it has to keep happening
          // or the count below would be asserting nothing.
          drewBackIn++;
        }

        // A void shown with the tallone empty is permanent — no card can reach
        // that hand any more — so holding that suit again would be a real
        // defect rather than the draw explaining it away.
        if (dry[me].has(played.s))
          assert.fail(`${who}, seed ${seed}, trick ${state.tricks + 1}: played ${name(played)} ` +
            `after showing void in ${SUITS[played.s]} with the tallone already empty`);

        gioca(state, me, slot);
      }
      dryVoids += dry[BASSO].size + dry[ALTO].size;
    }
  }

  assert.ok(following > 1500, `only ${following} decisions where the suit could be followed`);
  assert.ok(drewBackIn > 10,
    `a void was drawn back into only ${drewBackIn} times — either the tallone stopped ` +
    `being dealt from, or this test is no longer watching the thing it was written for`);
  assert.ok(dryVoids > 10, `only ${dryVoids} voids shown after the tallone ran out`);
});
