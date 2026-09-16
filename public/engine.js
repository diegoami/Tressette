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

/* --- the surface ------------------------------------------------------------ */

// The page gets these from the classic script; Node's vm.runInThisContext does
// not hand out const bindings, so name them once, here, for both.
Object.assign(globalThis, {
  SUITS, BASSO, ALTO,
  rango, terzi, buildDeck, mescola, rngSeed,
  prende, mosseLegali, accusi, puntiAccusi,
  pesca, newDeal, gioca, scoreDeal, vincitore
});
