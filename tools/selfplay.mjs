// Headless matches, for tuning the opponent. No dependencies.
//
//   node tools/selfplay.mjs                    the three of them vs both baselines
//   node tools/selfplay.mjs graziano greedy 2000
//   node tools/selfplay.mjs --differ 200       how often each pair plays a different card
//   node tools/selfplay.mjs --probe            the questions §4 iteration 2 asks
//   node tools/selfplay.mjs --ladder KEY 1,2,3  what one weight costs and buys
//   node tools/selfplay.mjs --piero 6 100      what a rolled Piero is worth
//   node tools/selfplay.mjs --try KEY=V,KEY=V   a whole candidate at once
//   node tools/selfplay.mjs --golden > tools/golden.json
//
// SEED_FROM=5001 moves any of them onto seeds the tuning never saw.
//
// Every match is played twice from the same seed with the seats swapped, so a
// reported edge is the player's and not the deal's. A win rate on unmirrored
// deals mostly measures who was dealt the assi.

import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";

runInThisContext(readFileSync(
  fileURLToPath(new URL("../public/engine.js", import.meta.url)), "utf8"));

const { BASSO, ALTO, terzi, prende, mosseLegali, rngSeed, newDeal, gioca,
        scoreDeal, rollProfiles, compGioca, fuori, sicura, weights,
        WEIGHT_KEYS, CODA_FROM } = globalThis;

const PROFILES = rollProfiles(rngSeed(1));

/* ---- the players ----------------------------------------------------------- */

const legalFor = state => {
  const me = state.deveGiocare;
  const led = me === state.perPrimo ? null : state.played[state.perPrimo];
  return { me, led, slots: mosseLegali(state.hands[me], led) };
};

// Nothing but legal. The floor: anything that cannot beat this is not playing.
const randomLegal = (state, rng) => {
  const { slots } = legalFor(state);
  return slots[Math.floor(rng() * slots.length)];
};

// Takes the trick whenever it can, as cheaply as it can, and otherwise throws
// the least it can. It never looks past the trick in front of it, which is the
// habit a real opponent has to beat — not randomness.
const greedyTake = state => {
  const { me, led, slots } = legalFor(state);
  const hand = state.hands[me];
  const cheapest = list =>
    list.reduce((a, b) => terzi(hand[b].n) < terzi(hand[a].n) ? b : a);
  if (led === null) return cheapest(slots);
  const taking = slots.filter(i => prende(hand[i], led));
  return taking.length ? cheapest(taking) : cheapest(slots);
};

const profile = P => state => compGioca(state, P);

const PLAYERS = {
  franco:   profile(PROFILES.Franco),
  valerio:  profile(PROFILES.Valerio),
  graziano: profile(PROFILES.Graziano),
  piero:    profile(PROFILES.Piero),
  flat:     profile({ ...PROFILES.Franco, LATE_FACTOR: 0 }),   // k === 1 everywhere
  random:   randomLegal,
  greedy:   greedyTake
};

/* ---- one deal -------------------------------------------------------------- */

// `basso` and `alto` are the two players; the seed fixes the shuffle, so the
// same seed with the seats swapped is the same deal from the other side.
function playDeal(seed, basso, alto, watch, watched){
  const rng = rngSeed(seed);
  const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
  const sit = [basso, alto];
  while (!state.over){
    const who = state.deveGiocare;
    // `watched` is the seat the profile is actually sitting in this half of the
    // mirror. Watching a fixed seat counts the baseline's decisions for half
    // the deals, which is what the first version of this did.
    if (watch && who === watched) watch(state, who);
    gioca(state, who, sit[who](state, rng));
  }
  return scoreDeal(state);
}

// A match is a mirrored pair: the same deal played from both sides.
// SEED_FROM moves the whole run onto seeds the tuning never saw, which is how
// a candidate chosen on seeds 1..150 is checked: `SEED_FROM=5001 node
// tools/selfplay.mjs 300`.
const SEED_FROM = Number(process.env.SEED_FROM ?? 1);

function match(n, a, b, watch){
  let wins = 0, losses = 0, draws = 0, points = 0, deals = 0;
  for (let seed = SEED_FROM; seed < SEED_FROM + n; seed++){
    for (const aIsBasso of [true, false]){
      const score = aIsBasso
        ? playDeal(seed, PLAYERS[a], PLAYERS[b], watch, BASSO)
        : playDeal(seed, PLAYERS[b], PLAYERS[a], watch, ALTO);
      const mine = aIsBasso ? score[BASSO] : score[ALTO];
      const theirs = aIsBasso ? score[ALTO] : score[BASSO];
      points += mine; deals++;
      if (mine > theirs) wins++; else if (mine < theirs) losses++; else draws++;
    }
  }
  return { a, b, deals, wins, losses, draws, points };
}

// The noise floor: how far a win rate can wander on this many deals before it
// means anything. Two identical players differ by about this much.
const floor95 = (p, n) => 1.96 * Math.sqrt(p * (1 - p) / n);

function report(r){
  const rate = r.wins / r.deals;
  const floor = floor95(rate, r.deals);
  console.log(
    `${r.a} vs ${r.b}`.padEnd(22) +
    `${(100 * rate).toFixed(1)}%`.padStart(7) + ` ± ${(100 * floor).toFixed(1)}` +
    `   won ${r.wins} lost ${r.losses} drew ${r.draws}` +
    `   ${(r.points / r.deals).toFixed(2)} points/deal   ${r.deals} deals`);
  return rate;
}

/* ---- the questions §4 asks before the freeze -------------------------------- */

function probe(n){
  console.log(`\nprobe, ${n} seeds mirrored\n`);

  // 1. §4 asks how often the sure bonus *fires* — not how often a sure card is
  //    available, which is the question the first version of this answered and
  //    got a misleading yes to. A tre is sure from the deal, so availability is
  //    near-universal; what matters is whether the bonus changes the lead.
  let leadsEarly = 0, firedEarly = 0, leadsLate = 0, firedLate = 0;
  const noSure = { ...PROFILES.Franco, LEAD_SURE_BONUS: 0 };
  // 2. Tempo: does it decline a trick it could take while holding a sure card?
  let declined = 0, declinedHoldingSure = 0;

  const watch = (state, who) => {
    const still = fuori(state, who);
    const hand = state.hands[who];
    const led = who === state.perPrimo ? null : state.played[state.perPrimo];
    const slots = mosseLegali(hand, led);

    if (led === null){
      if (slots.length < 2) return;            // no choice, so nothing fired
      const fired = compGioca(state, PROFILES.Franco) !== compGioca(state, noSure);
      if (state.tricks < 10){ leadsEarly++; if (fired) firedEarly++; }
      else { leadsLate++; if (fired) firedLate++; }
    } else {
      const chosen = compGioca(state, PROFILES.Franco);
      const couldTake = slots.some(i => prende(hand[i], led));
      if (couldTake && !prende(hand[chosen], led)){
        declined++;
        if (hand.some(c => c && sicura(still, c))) declinedHoldingSure++;
      }
    }
  };

  match(n, "franco", "greedy", watch);

  const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : "—";
  console.log(`  the sure bonus changed the card led:`);
  console.log(`    before trick ten   ${pct(firedEarly, leadsEarly)}  (${firedEarly} of ${leadsEarly} leads with a choice)`);
  console.log(`    from trick ten on  ${pct(firedLate, leadsLate)}  (${firedLate} of ${leadsLate} leads with a choice)`);
  console.log(`  tricks declined that it could have taken: ${declined}`);
  console.log(`    while holding a sure card:              ${declinedHoldingSure}` +
              `  (${pct(declinedHoldingSure, declined)} of them)`);

  console.log(`\n  and with k forced to 1 (LATE_FACTOR = 0):`);
  report(match(n, "flat", "random"));
  report(match(n, "flat", "greedy"));
}

/* ---- do they play differently? --------------------------------------------- */

// The question tuning cannot answer with a win rate: two profiles can score the
// same and still be the same player. This counts how often they would put down
// a different card in the *same* position — positions a real game reaches,
// because they come from a real game: `who` plays out a match against
// greedy-take and every decision it faces is put to every profile.
//
// Two kinds of decision are left out, and the second one was in until the
// review of iteration 5 found it.
//
//   Forced moves — one legal card — because a forced move is not a
//   temperament. Measured over 8,000 plays, 15.3% are forced: 5.0% of leads
//   and 25.5% of follows. (An earlier comment here said "about half", which
//   was three times the truth and nobody had counted.)
//
//   Everything from CODA_FROM on, because there the weights are not consulted
//   at all: compGioca enumerates the rest of the deal and every profile plays
//   the same card by construction. Those were 30.9% of the decisions this
//   counted, all of them zero-difference, so every figure it printed was 1.45
//   times too small — including the one in Graziano's dossier.
function differ(n, names, driver = "greedy"){
  const profiles = names.map(name => PROFILES[cap(name)]);
  const pairs = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) pairs.push([i, j, 0]);
  let decisions = 0;

  let endgame = 0;
  const watch = (state, who) => {
    const led = who === state.perPrimo ? null : state.played[state.perPrimo];
    if (mosseLegali(state.hands[who], led).length < 2) return;
    if (state.tricks >= CODA_FROM){ endgame++; return; }
    decisions++;
    const choice = profiles.map(P => compGioca(state, P));
    for (const pair of pairs) if (choice[pair[0]] !== choice[pair[1]]) pair[2]++;
  };

  // Every profile drives in turn, so the positions are not one player's alone:
  // a loose player reaches different hands from a tight one, and asking only
  // about the tight player's positions would flatter whichever drove.
  for (const name of names) match(n, name, driver, watch);

  return { decisions, endgame, pairs: pairs.map(([i, j, count]) => ({
    a: names[i], b: names[j], count, share: count / decisions })) };
}

const cap = s => s[0].toUpperCase() + s.slice(1);

function differTable(n){
  const names = ["franco", "valerio", "graziano", "piero"];
  const { decisions, endgame, pairs } = differ(n, names);
  console.log(`\nchoices that differ, over ${decisions} decisions the weights actually made\n`);
  for (const p of pairs.sort((x, y) => y.share - x.share))
    console.log(`  ${(p.a + " vs " + p.b).padEnd(22)}${(100 * p.share).toFixed(1)}%`.padEnd(34) +
                `${p.count} of ${decisions}`);
  console.log(`\n  ${endgame} further decisions were from trick ${CODA_FROM + 1} on, where the search` +
              `\n  answers and all three play alike. They are not in the denominator.`);
}

/* ---- what each weight costs, and what it buys ------------------------------- */

// One weight at a time, moved away from Franco's value: how much strength it
// costs against greedy-take, and how many choices it changes. Character is
// paid for in win rate, and this is the exchange rate — the point of the table
// is to find the weights where the rate is good, because iteration 2 showed
// most of them move nothing at any price.
function ladder(key, values, n){
  const base = PROFILES.Franco;
  console.log(`\n${key}, from Franco's ${base[key]}, ${n} seeds mirrored\n`);
  console.log("  value   vs greedy   differs from Franco");

  for (const v of values){
    const P = { ...base, [key]: v };
    PLAYERS.__try = profile(P);

    let differs = 0, decisions = 0;
    const watch = (state, who) => {
      const led = who === state.perPrimo ? null : state.played[state.perPrimo];
      if (mosseLegali(state.hands[who], led).length < 2) return;
      if (state.tricks >= CODA_FROM) return;    // the search, not the weights
      decisions++;
      if (compGioca(state, P) !== compGioca(state, base)) differs++;
    };

    const r = match(n, "__try", "greedy", watch);
    const rate = r.wins / r.deals;
    console.log(`  ${String(v).padStart(5)}   ${(100 * rate).toFixed(1)}%`.padEnd(20) +
                `${(100 * differs / decisions).toFixed(1)}%  (${differs} of ${decisions})`);
  }
}

// A whole candidate vector at once, given as overrides on Franco's:
//
//   node tools/selfplay.mjs --try LEAD_LISCIO_BONUS=8,SPEND_CONTROL_PENALTY=1
//
// The ladder prices one weight at a time; this prices the combination, which is
// not the sum of the parts.
function tryCandidate(overrides, n){
  const base = PROFILES.Franco;
  const P = { ...base };
  for (const pair of overrides.split(",")){
    const [key, value] = pair.split("=");
    if (!(key in P)) throw new Error(`no such weight: ${key}`);
    P[key] = Number(value);
  }
  PLAYERS.__try = profile(P);

  let differs = 0, decisions = 0;
  const watch = (state, who) => {
    const led = who === state.perPrimo ? null : state.played[state.perPrimo];
    if (mosseLegali(state.hands[who], led).length < 2) return;
    if (state.tricks >= CODA_FROM) return;      // the search, not the weights
    decisions++;
    if (compGioca(state, P) !== compGioca(state, base)) differs++;
  };

  const vsGreedy = match(n, "__try", "greedy", watch);
  const vsRandom = match(n, "__try", "random");
  console.log(`\n${overrides}`);
  console.log(`  vs greedy  ${(100 * vsGreedy.wins / vsGreedy.deals).toFixed(1)}%` +
              `   vs random ${(100 * vsRandom.wins / vsRandom.deals).toFixed(1)}%` +
              `   differs from Franco ${(100 * differs / decisions).toFixed(1)}%` +
              `   (${n * 2} deals each)`);
}

// Piero is rolled once per session, so "how strong is Piero" is a question
// about a distribution. This rolls a few of him and plays each one, which is
// the only honest way to say what a player who meets him can expect.
function pieroSpread(rolls, n){
  console.log(`\nPiero, ${rolls} sessions of him, ${n} seeds mirrored each\n`);
  console.log("  session   stance        vs greedy   vs random   differs from Franco");
  for (let seed = 1; seed <= rolls; seed++){
    const P = rollProfiles(rngSeed(seed * 7919)).Piero;
    const stance = P.LEAD_LONG_SUIT > 0 ? "long, lisci kept" : "neither";
    PLAYERS.__try = profile(P);
    let differs = 0, decisions = 0;
    const watch = (state, who) => {
      const led = who === state.perPrimo ? null : state.played[state.perPrimo];
      if (mosseLegali(state.hands[who], led).length < 2) return;
      if (state.tricks >= CODA_FROM) return;    // the search, not the weights
      decisions++;
      if (compGioca(state, P) !== compGioca(state, PROFILES.Franco)) differs++;
    };
    const g = match(n, "__try", "greedy", watch);
    const r = match(n, "__try", "random");
    console.log(`  ${String(seed).padStart(7)}   ${stance.padEnd(16)}` +
                `${(100 * g.wins / g.deals).toFixed(1)}%`.padStart(9) +
                `${(100 * r.wins / r.deals).toFixed(1)}%`.padStart(12) +
                `${(100 * differs / decisions).toFixed(1)}%`.padStart(16));
  }
}

/* ---- the golden fixture ----------------------------------------------------- */

// Re-recording it is a command rather than a script someone writes twice:
//
//   node tools/selfplay.mjs --piero 6 100      what a rolled Piero is worth
//   node tools/selfplay.mjs --try KEY=V,KEY=V   a whole candidate at once
//   node tools/selfplay.mjs --golden > tools/golden.json
//
// SEED_FROM=5001 moves any of them onto seeds the tuning never saw.
//
// §3.4's contract from v1.0 is change a weight, not the formula, and this file
// is what makes that checkable — twenty deals per profile, both seats, every
// card. A weight change moves the plays deliberately and the fixture is
// re-recorded in the same commit; a formula change moves them by accident and
// the test is the thing that says so out loud.
function goldenFixture(){
  const short = c => `${["A","2","3","4","5","6","7","F","C","R"][c.n - 1]}${"dcsb"[c.s]}`;
  const recorded = ["Franco", "Valerio", "Graziano"];
  const deals = [];

  for (const who of recorded){
    const P = PROFILES[who];
    for (let seed = 1; seed <= 20; seed++){
      const rng = rngSeed(seed);
      const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
      const lead = state.deveGiocare === BASSO ? "B" : "A";
      const plays = [];
      while (!state.over){
        const seat = state.deveGiocare;
        const slot = compGioca(state, P);
        plays.push(`${seat === BASSO ? "B" : "A"}${short(state.hands[seat][slot])}`);
        gioca(state, seat, slot);
      }
      deals.push({ who, seed, lead, plays: plays.join(" "), score: scoreDeal(state) });
    }
  }

  // Piero's weights are frozen too, though his deals are not: he is rolled from
  // the rng, so a change to his ranges or to the order they are drawn in moves
  // these eleven numbers and the test says so.
  return { profiles: PROFILES, deals };
}

/* ---- run ------------------------------------------------------------------- */

const argv = process.argv.slice(2);
if (argv[0] === "--probe"){
  probe(Number(argv[1] ?? 500));
} else if (argv[0] === "--piero"){
  pieroSpread(Number(argv[1] ?? 6), Number(argv[2] ?? 100));
} else if (argv[0] === "--try"){
  tryCandidate(argv[1], Number(argv[2] ?? 100));
} else if (argv[0] === "--golden"){
  console.log(JSON.stringify(goldenFixture(), null, 1));
} else if (argv[0] === "--ladder"){
  ladder(argv[1], argv[2].split(",").map(Number), Number(argv[3] ?? 100));
} else if (argv[0] === "--differ"){
  differTable(Number(argv[1] ?? 200));
} else if (argv.length >= 2){
  report(match(Number(argv[2] ?? 1000), argv[0], argv[1]));
} else {
  const n = Number(argv[0] ?? 1000);
  console.log(`\nseeds ${SEED_FROM}..${SEED_FROM + n - 1}, each played from both sides\n`);
  const rates = {};
  for (const who of ["franco", "valerio", "graziano", "piero"]){
    rates[who] = [report(match(n, who, "random")), report(match(n, who, "greedy"))];
    console.log("");
  }
  report(match(n, "random", "greedy"));

  // §3.4's second clause, which nothing measured until the review of iteration
  // 5 asked for it: characters, not tiers.
  console.log("");
  const head = [["franco", "valerio"], ["franco", "graziano"], ["franco", "piero"],
                ["valerio", "graziano"], ["valerio", "piero"], ["graziano", "piero"]]
    .map(([a, b]) => [a, b, report(match(n, a, b))]);

  console.log("\nacceptance (§3.4): random-legal ≥ 85%, greedy-take ≥ 80%");
  for (const [who, [r, g]] of Object.entries(rates))
    console.log(`  ${who.padEnd(10)}${(100 * r).toFixed(1)}%  ${r >= 0.85 ? "PASS" : "FAIL"}` +
                `    ${(100 * g).toFixed(1)}%  ${g >= 0.80 ? "PASS" : "FAIL"}`);
  console.log("\n  and no profile beats another by more than 65%:");
  for (const [a, b, rate] of head)
    console.log(`  ${(a + " vs " + b).padEnd(22)}${(100 * rate).toFixed(1)}%  ` +
                `${rate <= 0.65 && rate >= 0.35 ? "PASS" : "FAIL"}`);
}
