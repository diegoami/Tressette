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
  return function(){
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- a deal ----------------------------------------------------------------- */

// §2.3. No trump: a card takes only by following the led suit and ranking
// above it. `led` is the card that was led, `follow` the answer to it.
function prende(follow, led){
  if (follow.s !== led.s) return false;
  return rango(follow.n) > rango(led.n);
}

// §2.3. Follow suit if you can, otherwise anything. Returns slot indices, not
// cards, because the hand keeps its holes: a played card leaves a null behind
// and a draw fills the first one, so a card's slot is its place in the fan.
function mosseLegali(hand, led){
  const full = [];
  for (let i = 0; i < hand.length; i++) if (hand[i] !== null) full.push(i);
  if (led === null || led === undefined) return full;
  const following = full.filter(i => hand[i].s === led.s);
  return following.length ? following : full;
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
function rollProfiles(rng){
  return {
    // Tuned by coordinate ascent on seeds 1..250 and chosen between candidates
    // on seeds 7001..8000, which the tuner never saw. LEAD_INTO_VOID_PENALTY is
    // negative on purpose: see below.
    Valerio: weights([
      //  SURE  LISCIO  LONG   ACE   CTRL   VOID   TAKE   GIVE  SPEND  GUARD  LATE
           4.0,   12.0,  1.0,   3.0,   2.5,  -4.0,   1.5,   1.5,   2.0,   1.5,  1.0
    ])
  };
}

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
    if (led === null){
      value = myTurn ? codaValore(rest, theirs, c, false, memo)
                     : codaValore(mine, rest, c, true, memo);
    } else {
      const takes = prende(c, led);
      const pot = terzi(c.n) + terzi(led.n) + ultima;
      value = myTurn
        ? (takes ? pot : 0) + codaValore(rest, theirs, null, takes, memo)
        : (takes ? 0 : pot) + codaValore(mine, rest, null, !takes, memo);
    }
    best = myTurn ? Math.max(best, value) : Math.min(best, value);
  }
  memo.set(key, best);
  return best;
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
    const c = hand[slot];
    const rest = mine.filter(x => x !== c);
    let value;
    if (led === null){
      value = codaValore(rest, theirs, c, false, memo);
    } else {
      const takes = prende(c, led);
      const won = takes ? terzi(c.n) + terzi(led.n)
                          + ultimaTerzi(mine.length + theirs.length) : 0;
      value = won + codaValore(rest, theirs, null, takes, memo);
    }
    // Ties to the lower slot. That is a determinism rule, not a strength one —
    // it is what makes the golden fixture reproducible — and it costs about a
    // point of win rate against the other convention. Do not "optimise" it.
    if (value > bestValue){ bestValue = value; bestSlot = slot; }
  }
  return bestSlot;
}

// §3.4. Score every legal card and play the highest, ties to the lowest slot —
// except for the last two tricks, which are enumerated instead.
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
  prende, mosseLegali, accusi, puntiAccusi,
  pesca, newDeal, gioca, scoreDeal, vincitore,
  WEIGHT_KEYS, weights, rollProfiles, compGioca, fuori, controlli, sicura, CODA_FROM, coda, manoDedotta
});
