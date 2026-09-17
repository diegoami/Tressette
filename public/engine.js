/* ===========================================================================
   Tressette — the rules, as §2 of PLAN.md states them.

   Pure functions over a plain state object. Nothing here touches `document`,
   `window`, timers or `Math.random`: the page loads this file with
   <script src="engine.js"> and Node runs the same text with
   vm.runInThisContext, which is what lets the tests, the self-play harness and
   the golden fixture run the code the page runs.

   Randomness always arrives as an argument. `rng` is any () => [0,1).

   Naming follows Discola's Pascal-flavoured Italian so the two read alike.
   Where the two games differ the difference is the comment.
   =========================================================================== */

/* --- cards ------------------------------------------------------------------ */

// Sprite-sheet order: row per suit, column n-1 for card number n. Same sheets
// as Discola, so the same order.
const SUITS = ["denari", "coppe", "spade", "bastoni"];

const BASSO = 0; // the human player, at the bottom of the table
const ALTO  = 1; // the opponent, at the top

// §2.1. Tressette's order is not Briscola's: the tre and the due outrank the
// asso, and the asso outranks the re. Everything below the fante is by number.
// Higher is stronger; the scale is ordinal and means nothing else.
const RANGHI = [0, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7]; // indexed by card number
function rango(n){ return RANGHI[n]; }

// §2.1, in thirds. An asso is a whole point, a figure or a due or a tre is a
// third, a liscio is nothing. Integers, so no float ever reaches a score:
// 4 + 1/3 + 1/3 + 1/3 is not reliably 5 in binary floating point, and a deal
// that scores 10.999999 would round to the wrong number of points.
function terzi(n){
  if (n === 1) return 3;
  if (n === 2 || n === 3 || n >= 8) return 1;
  return 0;
}

// 40 cards, suit-major.
function buildDeck(){
  const cards = [];
  for (let s = 0; s < 4; s++)
    for (let n = 1; n <= 10; n++)
      cards.push({ s, n });
  return cards;
}

// §2.2. Discola kept the original's 200 + Random(100) swaps because that was
// the artefact. There is no artefact here, so: Fisher-Yates, which is uniform,
// and an injected rng, which is what makes a fixture reproducible.
function mescola(cards, rng){
  for (let i = cards.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
  }
  return cards;
}

// A seeded generator, so the tests, the harness and the golden fixture all
// draw from the same stream when given the same seed. It lives here rather
// than in the harness because a fixture recorded against one generator and
// replayed against another is not a fixture. mulberry32.
function rngSeed(seed){
  let a = seed >>> 0;
  const next = function(){
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Eight thrown away first. mulberry32's first output is correlated with a
  // small seed — for seeds 1 to 6 it is 0.627, 0.734, 0.720, 0.924, 0.690,
  // 0.526, all on the same side of a half — and anything that reads the first
  // value to make a structural decision inherits that. Piero's stance did:
  // six consecutive seeds drew the same one. Warming the generator is cheaper
  // than remembering which draw is safe to use.
  for (let i = 0; i < 8; i++) next();
  return next;
}

/* --- a deal ----------------------------------------------------------------- */

// §2.3. No trump: a card takes only by following the led suit and ranking
// above it. `led` is the card that was led, `follow` the answer to it.
function prende(follow, led){
  if (follow.s !== led.s) return false;
  return rango(follow.n) > rango(led.n);
}

// §2.3. Follow suit if you can, otherwise anything. Returns slot indices, not
// cards, because a slot is a card's identity for as long as it is held: a
// played card leaves a null behind, a draw fills the first one, and nothing
// here ever reorders a hand. Where a card *sits* is ordinaMano's business,
// below, and the two are deliberately not the same thing.
function mosseLegali(hand, led){
  const full = [];
  for (let i = 0; i < hand.length; i++) if (hand[i] !== null) full.push(i);
  if (led === null || led === undefined) return full;
  const following = full.filter(i => hand[i].s === led.s);
  return following.length ? following : full;
}

// §3.7. The order a hand is *held* in, as slot indices: by suit, and within a
// suit from the strongest card down. Nothing in the engine reads it — it is
// here rather than in the page because it is a fact about Tressette's rank
// order, which is `rango` and lives here, and because the tests can then hold
// it to that.
//
// It deliberately does not reorder `hands`. A slot is an identity: mosseLegali
// returns slot indices, gioca takes one, and compGioca breaks ties on the
// lowest of them, so a hand that sorted itself would move every one of those
// under its callers and change which card the opponent plays — the golden
// fixture's whole subject. So the hand is stored in the order it was dealt and
// drawn into, and shown sorted.
function ordinaMano(hand){
  const slots = [];
  for (let i = 0; i < hand.length; i++) if (hand[i] !== null) slots.push(i);
  return slots.sort((a, b) =>
    hand[a].s - hand[b].s || rango(hand[b].n) - rango(hand[a].n));
}

// §2.4, from the ten cards dealt and only those: a set completed by drawing
// cannot be declared here (decision 4). Points go to the declarer whole, and
// several declarations in one hand all count.
function accusi(hand){
  const found = [];
  const has = (s, n) => hand.some(c => c !== null && c.s === s && c.n === n);

  for (let s = 0; s < 4; s++)
    if (has(s, 1) && has(s, 2) && has(s, 3))
      found.push({ kind: "napoletana", suit: s, points: 3 });

  for (const n of [1, 2, 3]){
    const count = hand.filter(c => c !== null && c.n === n).length;
    if (count >= 3) found.push({ kind: "set", n, count, points: count === 4 ? 4 : 3 });
  }
  return found;
}

function puntiAccusi(list){
  return list.reduce((total, a) => total + a.points, 0);
}

// Draw one card into the first empty slot. Past the tallone a hand just thins
// out, as in Discola.
function pesca(state, who){
  if (state.next >= state.cards.length) return null;
  const card = state.cards[state.next++];
  // What the opponent has seen. Its own cards enter here, on the draw and on
  // the deal; the human's enter when played, in gioca. Splitting it that way
  // means no card is counted twice.
  if (who === ALTO) state.seen.push(card);
  const hand = state.hands[who];
  for (let i = 0; i < hand.length; i++)
    if (hand[i] === null){ hand[i] = card; return card; }
  // Unreachable in a deal — a player draws only just after playing, so there
  // is always exactly one hole. It throws rather than returning quietly
  // because the harness calls pesca directly, and a card that vanished
  // between the tallone and a hand would show up as a mis-scored deal much
  // later, somewhere else.
  throw new Error("pesca into a full hand");
}

// §2.2. Shuffle, ten each, and the non-dealer leads. `state` is mutated, as in
// Discola, and returned for convenience.
function newDeal(state, rng){
  state.cards = buildDeck();
  mescola(state.cards, rng);
  state.next = 0;
  state.seen = [];
  state.played = [null, null];
  state.terzi = [0, 0];
  state.voids = [[false, false, false, false], [false, false, false, false]];
  state.tricks = 0;
  state.over = false;
  state.dealt = true;
  state.selected = null;

  for (const who of [BASSO, ALTO]){
    state.hands[who] = new Array(10).fill(null);
    for (let i = 0; i < 10; i++) pesca(state, who);
  }

  // Checked on the ten dealt, announced when that player plays their first
  // card of the deal — gioca reports the announcement, scoreDeal pays it.
  state.accusi = [accusi(state.hands[BASSO]), accusi(state.hands[ALTO])];
  state.detti = [false, false];

  state.perPrimo = state.partitaPrimo ?? BASSO;   // §3.3: BASSO on a cold start
  state.deveGiocare = state.perPrimo;
  // Whoever did not lead this deal leads the next.
  state.partitaPrimo = state.perPrimo === BASSO ? ALTO : BASSO;
  return state;
}

// §2.3. Play the card in `slot`, and resolve the trick when both have played.
// Returns what the table has to show for it: any declarations this play
// announces, and the trick if this play completed one. Throws on an illegal
// move, because every caller here is code: the UI dims what cannot be played
// and the harness asks mosseLegali first, so an illegal slot is a bug, not
// a player's mistake.
function gioca(state, who, slot){
  if (state.over) throw new Error("the deal is over");
  if (who !== state.deveGiocare) throw new Error("not this player's turn");

  const led = who === state.perPrimo ? null : state.played[state.perPrimo];
  if (!mosseLegali(state.hands[who], led).includes(slot))
    throw new Error(`slot ${slot} is not a legal move`);

  const card = state.hands[who][slot];
  state.hands[who][slot] = null;
  state.played[who] = card;
  if (who === BASSO) state.seen.push(card);

  // Failing to follow is public information, and the inference Tressette is
  // played on. Briscola never needed it.
  if (led !== null && card.s !== led.s) state.voids[who][led.s] = true;

  const announced = state.detti[who] ? [] : state.accusi[who].slice();
  state.detti[who] = true;

  if (who === state.perPrimo){
    state.deveGiocare = who === BASSO ? ALTO : BASSO;
    return { announced, trick: null };
  }
  return { announced, trick: resolveTrick(state) };
}

// The trick goes to the higher card of the led suit; its winner takes both
// cards' terzi, draws first, and leads next.
function resolveTrick(state){
  const first = state.perPrimo;
  const second = first === BASSO ? ALTO : BASSO;
  const winner = prende(state.played[second], state.played[first]) ? second : first;

  const value = terzi(state.played[first].n) + terzi(state.played[second].n);
  state.terzi[winner] += value;
  state.played = [null, null];
  state.tricks++;

  // The winner draws first, which is what makes the tallone worth counting.
  pesca(state, winner);
  pesca(state, winner === BASSO ? ALTO : BASSO);

  state.perPrimo = winner;
  state.deveGiocare = winner;
  // Twenty tricks: ten while the tallone lasts, ten more with no drawing.
  if (state.tricks === 20){
    state.over = true;
    state.deveGiocare = null;
  }
  return { winner, terzi: value, ultima: state.tricks === 20 };
}

/* --- the score -------------------------------------------------------------- */

// §2.1 and §2.5. The ultima is three terzi to whoever took the last trick —
// which is perPrimo once the deal is over, because the winner of a trick leads
// the next one. Each side's terzi are floored to whole points and the
// declarations are added on top.
//
// The deck holds 32 terzi and the ultima 3, so 35 are dealt out; 35 mod 3 is
// 2, so the two floors always sum to exactly 11. That is not an accident of
// the numbers here, it is why 11 is the number.
function scoreDeal(state){
  const raw = [state.terzi[BASSO], state.terzi[ALTO]];
  if (state.over) raw[state.perPrimo] += 3;
  return [BASSO, ALTO].map(who =>
    Math.floor(raw[who] / 3) + puntiAccusi(state.accusi[who]));
}

// §2.5. Eleven is odd, so without declarations there is no draw; with them
// there can be one, and it is recorded as a draw, as Discola records 60-60.
function vincitore(state){
  const [basso, alto] = scoreDeal(state);
  if (basso === alto) return null;
  return basso > alto ? BASSO : ALTO;
}

/* --- what the player to move knows ------------------------------------------ */

// §3.4 derives the opponent's knowledge from `seen`, which is kept from ALTO's
// side of the table. The harness seats a profile in both chairs, so this is
// computed per seat instead, from facts either player can see: my own hand,
// and every card that has been put on the table. For ALTO it is the same set
// `seen` gives — 40 minus seen equals 40 minus my hand minus what has been
// played — and for BASSO it is the set `seen` would give if it were kept from
// the other side.
//
// A card still in the tallone is unknown, so it counts as outstanding. That is
// the conservative side to be on: sure() must never call a card safe that can
// still be beaten, and the word sure should mean what it says wherever it is
// read. It is not worth points — the optimistic variant is a dead heat over
// 6,000 deals — it is worth the invariant.
function fuori(state, me){
  const still = [];
  for (let s = 0; s < 4; s++) still.push(new Array(11).fill(true));

  // Keyed by suit and number, not by object: a state that has been through
  // JSON, structuredClone or any defensive copy in render() is a different
  // object graph, and identity would make every held card look played — so
  // every card would look sure and the opponent would lead into cards that are
  // still out. It would fail silently, which is the worst way to fail.
  const held = new Set();
  for (const who of [BASSO, ALTO])
    for (const c of state.hands[who]) if (c) held.add(c.s * 11 + c.n);

  for (let i = 0; i < state.next; i++){          // dealt or drawn, so seen by someone
    const c = state.cards[i];
    if (!held.has(c.s * 11 + c.n)) still[c.s][c.n] = false;   // played
  }
  for (const c of state.hands[me]) if (c) still[c.s][c.n] = false;   // and mine are mine
  return still;
}

// Which of the 3, the 2 and the asso of a suit are still against me — the
// cards that decide who captures the asso.
function controlli(still, s){
  return [3, 2, 1].filter(n => still[s][n]);
}

// Nothing outstanding in its suit outranks it, so leading it wins the trick.
// Tested over the whole rank order, not over the three control cards: once the
// 3, the 2 and the asso of bastoni are gone the Re of bastoni is sure and the
// 7 of bastoni is not, because the Re, the Cavallo and the Fante still beat it.
function sicura(still, card){
  for (let n = 1; n <= 10; n++)
    if (still[card.s][n] && rango(n) > rango(card.n)) return false;
  return true;
}

/* --- the opponent ----------------------------------------------------------- */

// §3.4's eleven, in the order the settings sheet discloses them.
const WEIGHT_KEYS = [
  "LEAD_SURE_BONUS", "LEAD_LISCIO_BONUS", "LEAD_LONG_SUIT",
  "LEAD_ACE_EXPOSED_PENALTY", "LEAD_CONTROL_PENALTY", "LEAD_INTO_VOID_PENALTY",
  "TAKE_TERZI_WEIGHT", "GIVE_TERZI_WEIGHT", "SPEND_CONTROL_PENALTY",
  "DISCARD_GUARD_PENALTY", "LATE_FACTOR"
];

function weights(values){
  const P = {};
  WEIGHT_KEYS.forEach((key, i) => { P[key] = values[i]; });
  return P;
}

// Iteration 2 tunes one profile. Graziano, Franco and Piero are iteration 5,
// which is also where `rng` starts doing something: Piero is rolled from it,
// once per session, as in Discola.
// §0 decision 5, in its final form: four players, one to a corner. Two weights
// decide the game a profile plays — whether it opens its longest suit, and what
// a liscio is worth leading — and those two make four corners:
//
//                     opens the long suit   keeps its lisci
//   Franco                    no                  yes         the house standard
//   Graziano                 yes                   no
//   Piero                    yes                  yes         rolled per session
//   Valerio                   no                   no         the loosest
//
// Valerio was dropped in iteration 4 and is back here. The reason he went was
// that iteration 2's sketch of him chose the same card as Franco 99 times in a
// hundred; the reason he is back is that this corner is a different player by
// measurement, not by intention.
const FRANCO_WEIGHTS = weights([
  //  SURE  LISCIO  LONG   ACE   CTRL   VOID   TAKE   GIVE  SPEND  GUARD  LATE
       4.0,   12.0,  0.0,   3.0,   2.5,  -4.0,   1.5,   1.5,   2.0,   1.5,  1.0
]);

// The fourth corner: no long suit and no patience with lisci. He leads his big
// cards and takes what is there, which is the loosest of the four and the
// weakest of the three fixed vectors — 81.3% against greedy-take on 2,000
// held-out deals, where Franco and Graziano are 86.6% and 86.5%. A rolled
// Piero can land under him; the fixed three cannot.
//
// This is the vector iteration 5 shipped as Graziano, under the name iteration
// 4 retired. Valerio was dropped for being Franco under a second name: they
// chose the same card 99 times in a hundred. He comes back because the corner
// is real — he differs from all three of the others on one lever or both — and
// because the house has four names.
const VALERIO_WEIGHTS = weights([
  //  SURE  LISCIO  LONG   ACE   CTRL   VOID   TAKE   GIVE  SPEND  GUARD  LATE
       4.0,    8.0,  0.0,   1.0,   2.5,  -4.0,   2.5,   1.5,   1.0,   1.5,  1.0
]);

const GRAZIANO_WEIGHTS = weights([
  //  SURE  LISCIO  LONG   ACE   CTRL   VOID   TAKE   GIVE  SPEND  GUARD  LATE
       4.0,    8.0,  0.5,   3.0,   2.5,  -4.0,   1.5,   1.5,   2.0,   1.5,  1.0
]);

function rollProfiles(rng){
  return {
    // Tuned by coordinate ascent on seeds 1..250 and chosen between candidates
    // on seeds 7001..8000, which the tuner never saw. LEAD_INTO_VOID_PENALTY is
    // negative on purpose: see below.
    //
    // LEAD_LONG_SUIT is 0 because the endgame search made it harmful. It was
    // tuned to 1.0 when the opponent scored every trick, and measured +1.9 and
    // +2.1 points better at 0 on two fresh seed ranges once the search took the
    // last seven. Every trick the search gains or gives back revalues the late
    // weights, silently — moving CODA_FROM means re-measuring these, not just
    // re-recording the fixture.
    Franco: FRANCO_WEIGHTS,
    Valerio: VALERIO_WEIGHTS,

    // He opens his long suit and keeps fewer lisci back: two weights away from
    // Franco, and a different game. On seeds 5001+, 1,200 mirrored deals
    // (`SEED_FROM=5001 node tools/selfplay.mjs --try
    // LEAD_LONG_SUIT=0.5,LEAD_LISCIO_BONUS=8 600`), he beats greedy-take 86.1%
    // against Franco's 85.0% — a gap inside the ±2.0 noise — and plays a
    // different card in 21.9% of the decisions the weights actually make. On
    // 2,000 held-out deals at seeds 90001+ the two are 86.5% and 86.6%.
    //
    // LEAD_LONG_SUIT is why he is free. Iteration 5 first tuned him along
    // LEAD_LISCIO_BONUS alone and concluded character costs about a point of
    // win rate per percent of plays changed; the review of that iteration
    // pointed out that the ladder had never priced the one weight iteration 2
    // had set to zero. It is a switch rather than a dial — 0.5, 1 and 1.5 play
    // identically, because the term only reorders which liscio is led — and the
    // exchange rate is not a rate at all: the measured axis buys 15.6% of plays
    // for 4.2 points of win rate, and this one buys 21.9% for nothing.
    Graziano: GRAZIANO_WEIGHTS,

    // Rolled once per session, as Discola's Piero is, because SetProfiles ran
    // from FormCreate in 1997. A house tradition now rather than a Delphi
    // accident — and the reason rollProfiles takes an rng at all.
    Piero: rollPiero(rng)
  };
}

// Two weights decide whether two profiles play the same game: whether the long
// suit is led from, and how much a liscio is worth leading. The other nine move
// a play now and then, and three of them move none at all at any magnitude.
//
// That is only two levers for three players, so Piero cannot simply be drawn
// from a wide range and be a third: the first version of this rolled him into
// Graziano's game — 98.4% the same card — the moment Graziano moved onto the
// long suit, which is the two-names-one-player problem that dropped Valerio,
// arriving by a different door. Re-rolling until he was far enough away in
// those two weights did not fix it either: a gap of three in the liscio bonus
// with the long suit matching is 6% of plays, and 6% is not a player.
//
// All eleven of Piero's weights are drawn. Four of them are drawn from bands of
// their own, and the other seven from PIERO_RANGES:
//
//   LEAD_LONG_SUIT and LEAD_LISCIO_BONUS put him in his corner. He leads the
//   long suit like Graziano and keeps his lisci like Franco, which is the
//   corner those two leave empty. They are drawn, not fixed — the band is what
//   holds the corner, not the value.
//
//   SPEND_CONTROL_PENALTY and TAKE_TERZI_WEIGHT are what keep him off Graziano.
//   Sharing the long suit is most of a game: with these two left in
//   PIERO_RANGES' own bands the two of them played a different card in 6.6% of
//   the decisions the weights make, which is not two players. Drawn from here
//   it is 12.3%.
//
// Piero does not roll between corners. He tried it for one round: rolled ten
// times across two corners it gave a Piero 33.1% away from Franco and a Piero
// 7.1% away, and a 7.1% Piero is Franco under another name. A corner of weight
// space is not a promise about plays, which is this project's own lesson
// arriving one more time. The corner he was borrowing is Valerio's now.
//
// What the draw does *not* buy is as measured as what it does: seven of the
// eleven weights barely move a play, so two sessions of Piero are two weight
// vectors and often one player. Thirty rolls give thirty distinct weight
// vectors and nothing like thirty players; in `node tools/selfplay.mjs --piero
// 12 400`, five of the twelve sessions fall into two groups whose win rates
// and difference from Franco agree to the decimal.
//
// And what the four bands cost, which the review of iteration 5's second round
// had to ask for because this comment only said what they buy. Same command at
// `SEED_FROM=90001 --piero 8 500`, against a copy of this file with the
// PIERO_STANCE lookup in rollPiero removed so all eleven draw from
// PIERO_RANGES:
//
//   bands on:   82.2–85.2% vs greedy-take,  19.9–24.2% away from Franco
//   bands off:  83.8–87.4% vs greedy-take,   5.6–21.1% away from Franco
//
// So the corner costs Piero about two points of win rate, and buys a floor
// under the thing the corner is for: one roll in eight without the bands came
// out at 5.6% from Franco, which is Franco under another name, which is what
// retired the name Valerio in the first place. He still clears §3.4's floors
// with the bands on, which is what makes it a trade rather than a cost.
const PIERO_STANCE = {
  LEAD_LONG_SUIT: [0.3, 1.0],
  LEAD_LISCIO_BONUS: [12, 14],
  SPEND_CONTROL_PENALTY: [0, 2.0],
  TAKE_TERZI_WEIGHT: [1.5, 3.4]
};

function rollPiero(rng){
  return weights(PIERO_RANGES.map(([lo, hi], i) => {
    const [a, b] = PIERO_STANCE[WEIGHT_KEYS[i]] ?? [lo, hi];
    return Math.round((a + rng() * (b - a)) * 10) / 10;
  }));
}

// The intervals Piero is drawn from. Wide enough that two sessions play
// differently, narrow enough that he is still playing Tressette.
//
// Four of the eleven are dead, marked † below: PIERO_STANCE overrides them and
// rollPiero never reads them. They are marked rather than deleted because
// rollPiero maps this array onto WEIGHT_KEYS by index, so removing an entry
// would silently shift every weight after it — and they are marked rather than
// left alone because a range that cannot change a draw is the same defect as a
// weight that cannot change a play, and the next reader will otherwise spend an
// afternoon tuning one. The review of iteration 5's second round found this
// after the round before it had edited one of them as though it mattered.
//
// That edit, for the record: iteration 5 had a wide liscio range here, and a
// quarter of rolled Pieros came out under the then-acceptance floor, some of
// them ten points under, because the cliff is between 9 and 7. Narrowing this
// entry to [9, 14] was the fix at the time; the stance band [12, 14]
// superseded it and this entry has been inert ever since.
const PIERO_RANGES = [
  //  SURE      LISCIO†     LONG†     ACE       CTRL       VOID
  [2, 6], [9, 14], [0, 1.0], [0.5, 5], [0.5, 4], [-5, -1],
  //  TAKE†     GIVE      SPEND†    GUARD     LATE
  [1, 3], [1, 3], [0.5, 3], [0, 3], [0.7, 1.3]
];

// The trick two cards make: does the follower take it, and what is it worth.
function presa(ledCard, followCard){
  return { leaderKeeps: !prende(followCard, ledCard),
           terzi: terzi(ledCard.n) + terzi(followCard.n) };
}

// §3.4's endgame, played out exactly rather than scored.
//
// From trick eleven the tallone is empty and every card has been seen, so the
// cards `fuori` reports as outstanding ARE the other hand — deduced, not
// peeked at. The formula is then scoring a position whose answer is knowable,
// and it is measurably worse at it: solving from here is worth about seven
// points of win rate against a random-legal opponent, and about ten against
// greedy-take.
//
// Thirteen rather than eleven is a budget, not a principle. At thirteen each
// side holds seven cards and one decision searches in single-digit
// milliseconds; two tricks earlier the tree is an order of magnitude bigger
// for a point or so of strength.
//
// What this costs: all four opponents play these seven tricks identically,
// because there is nothing to have an opinion about — §1 states that exception
// and this is its size. It was measured before it was chosen. Two temperaments
// disagree on 14.8% of the positions where they have a choice, but only 17% of
// those disagreements fall at trick thirteen or later: the character lives in
// tricks eight to twelve, where the tallone is running out and hands are still
// full. Solving the end also widens the spread between profiles rather than
// narrowing it, because it lifts a sound profile further than a loose one.
const CODA_FROM = 13;

// The last trick of the deal carries three terzi on top of its cards. One
// definition, because the search needs it and so does the per-card value below,
// and two copies of an arithmetic rule is one copy too many to keep in step.
const ultimaTerzi = cardsLeft => cardsLeft <= 2 ? 3 : 0;

// My terzi from here to the end of the deal, with both sides playing exactly.
// `led` is the card already on the table, null if I am to lead.
//
// Their best reply is the one that minimises my total, which is the same as the
// one that maximises theirs: over the rest of the deal the two sum to the terzi
// still in play plus the ultima's 3, a constant, so there is nothing else for
// "best" to mean.
function codaValore(mine, theirs, led, myTurn, memo){
  if (mine.length === 0 && theirs.length === 0) return 0;

  const key = mine.map(c => c.s * 11 + c.n).join(",") + "|"
            + theirs.map(c => c.s * 11 + c.n).join(",") + "|"
            + (led ? led.s * 11 + led.n : "-") + (myTurn ? "+" : "-");
  const seen = memo.get(key);
  if (seen !== undefined) return seen;

  const ultima = ultimaTerzi(mine.length + theirs.length);
  const hand = myTurn ? mine : theirs;
  const playable = led === null ? hand
    : (hand.some(c => c.s === led.s) ? hand.filter(c => c.s === led.s) : hand);

  let best = myTurn ? -Infinity : Infinity;
  for (const c of playable){
    const rest = hand.filter(x => x !== c);
    let value;
    if (myTurn){
      value = valoreDellaCarta(mine, theirs, led, c, memo);
    } else if (led === null){
      value = codaValore(mine, rest, c, true, memo);
    } else {
      const takes = prende(c, led);
      value = (takes ? 0 : terzi(c.n) + terzi(led.n) + ultima)
            + codaValore(mine, rest, null, !takes, memo);
    }
    best = myTurn ? Math.max(best, value) : Math.min(best, value);
  }
  memo.set(key, best);
  return best;
}

// What playing `c` is worth to me: this trick if I take it, plus everything
// after. `coda` needs it per card so it can pick a slot and break ties; the
// search needs it for every card of mine. One definition, so the ultima's
// arithmetic lives in one place — it was written out twice, and the second
// copy could only ever run where the play was forced, which is a duplicate
// no test could reach.
function valoreDellaCarta(mine, theirs, led, c, memo){
  const rest = mine.filter(x => x !== c);
  if (led === null) return codaValore(rest, theirs, c, false, memo);
  const takes = prende(c, led);
  const pot = terzi(c.n) + terzi(led.n) + ultimaTerzi(mine.length + theirs.length);
  return (takes ? pot : 0) + codaValore(rest, theirs, null, takes, memo);
}

// The other hand, deduced from what has been played. Only sound once the
// tallone is empty, which is why CODA_FROM is past it.
function manoDedotta(state, me){
  const still = fuori(state, me);
  const cards = [];
  for (let s = 0; s < 4; s++)
    for (let n = 1; n <= 10; n++)
      if (still[s][n]) cards.push({ s, n });
  return cards;
}

function coda(state, me){
  const led = me === state.perPrimo ? null : state.played[state.perPrimo];
  const hand = state.hands[me];
  const slots = mosseLegali(hand, led);
  const mine = hand.filter(c => c !== null);
  // The led card needs no special case: it has been played, so fuori has
  // already marked it gone. An earlier version subtracted it again here, which
  // was dead code that only looked live in hand-built positions.
  const theirs = manoDedotta(state, me);

  // The size check is exact, not a heuristic: fuori's set always contains their
  // whole hand — their cards are held, so it never marks them played, and they
  // are not mine, so they survive the subtraction — and it never contains mine.
  // So the right size implies the right cards — for any position a deal can
  // reach. The proof assumes the two hands are disjoint, which dealing
  // guarantees; a hand-built position that puts one card in both hands and
  // leaves another unaccounted for would deduce to the right size and the wrong
  // cards, and nothing here can see that, because fuori is not allowed to look
  // at the other hand. That is the precondition, stated rather than checked.
  //
  // Falling back to the formula is the safe answer, and it is unreachable from
  // CODA_FROM on, where the tallone is empty.
  if (theirs.length !== (led === null ? mine.length : mine.length - 1)) return null;

  const memo = new Map();
  let bestSlot = slots[0], bestValue = -Infinity;
  for (const slot of slots){
    const value = valoreDellaCarta(mine, theirs, led, hand[slot], memo);
    // Ties to the lower slot. That is a determinism rule, not a strength one —
    // it is what makes the golden fixture reproducible — and it costs about a
    // point of win rate against the other convention. Do not "optimise" it.
    if (value > bestValue){ bestValue = value; bestSlot = slot; }
  }
  return bestSlot;
}

// §3.4. Score every legal card and play the highest, ties to the lowest slot —
// except from CODA_FROM on, the last seven tricks, which are enumerated
// instead. (It was the last two when this line was written; CODA_FROM moved to
// 13 in iteration 2 and this comment did not follow it.)
function compGioca(state, P){
  const me = state.deveGiocare;

  if (state.tricks >= CODA_FROM){
    const exact = coda(state, me);
    if (exact !== null) return exact;
  }

  const them = me === BASSO ? ALTO : BASSO;
  const hand = state.hands[me];
  const led = me === state.perPrimo ? null : state.played[state.perPrimo];
  const slots = mosseLegali(hand, led);

  const still = fuori(state, me);
  const late = Math.min(1, state.tricks / 10);
  const k = 1 + late * P.LATE_FACTOR;
  const inSuit = s => hand.filter(c => c !== null && c.s === s).length;

  let bestSlot = slots[0], bestScore = -Infinity;
  for (const slot of slots){
    const c = hand[slot];
    const v = terzi(c.n);
    let score = 0;

    if (led === null){
      if (sicura(still, c)) score += P.LEAD_SURE_BONUS * k;
      // §3.4 indents the long-suit line under the liscio case, and the
      // harness agrees with the indentation: applied to every card it is worth
      // about a point and a half less against random-legal. Leading from length
      // is a thing you do with a liscio; with a point card it just leads points.
      if (v === 0){
        score += P.LEAD_LISCIO_BONUS;
        score += (inSuit(c.s) - 1) * P.LEAD_LONG_SUIT;
      }
      // §3.4: "× |controls(s) above the asso|". The filter is unreachable and
      // kept for the reader: this branch only runs when c is the asso, so the
      // asso is in hand, so it is not outstanding, so controlli never returns
      // it. Removing it changes no play in 6,000 deals — which is a reason to
      // leave it alone rather than to tidy it away and wonder later.
      if (c.n === 1 && !sicura(still, c))
        score -= P.LEAD_ACE_EXPOSED_PENALTY * controlli(still, c.s).filter(n => n !== 1).length;
      if ((c.n === 3 || c.n === 2) && !sicura(still, c)) score -= P.LEAD_CONTROL_PENALTY * k;
      // §3.4 wrote this as a penalty, reasoning that they discard for free.
      // That is Briscola's reasoning: there, a void lets them trump. Here there
      // is no trump, so a suit they cannot follow is a trick they cannot take —
      // leading into it wins for certain. The weight tunes negative, which is
      // the formula saying the same thing. Left as a penalty that happens to be
      // negative rather than renamed, because §3.4 names the eleven and the
      // settings sheet shows them.
      if (state.voids[them][c.s]) score -= P.LEAD_INTO_VOID_PENALTY;
    } else {
      const takes = prende(c, led);
      const L = terzi(led.n);
      score = takes ? (L + v) * P.TAKE_TERZI_WEIGHT : -v * P.GIVE_TERZI_WEIGHT;
      if (takes && (c.n === 3 || c.n === 2) && L + v < 3)
        score -= P.SPEND_CONTROL_PENALTY * k;
      // Discarding the only card that stands between an asso and a discard.
      if (c.s !== led.s && c.n !== 1 && inSuit(c.s) === 2
          && hand.some(x => x !== null && x.s === c.s && x.n === 1))
        score -= P.DISCARD_GUARD_PENALTY * k;
    }

    if (score > bestScore){ bestScore = score; bestSlot = slot; }
  }
  return bestSlot;
}

/* --- the surface ------------------------------------------------------------ */

// The page gets these from the classic script; Node's vm.runInThisContext does
// not hand out const bindings, so name them once, here, for both.
Object.assign(globalThis, {
  SUITS, BASSO, ALTO,
  rango, terzi, buildDeck, mescola, rngSeed,
  prende, mosseLegali, ordinaMano, accusi, puntiAccusi,
  pesca, newDeal, gioca, scoreDeal, vincitore,
  WEIGHT_KEYS, weights, rollProfiles, compGioca, fuori, controlli, sicura, CODA_FROM, coda, manoDedotta
});
