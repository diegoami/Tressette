// Headless matches, for tuning the opponent. No dependencies.
//
//   node tools/selfplay.mjs                    valerio vs both baselines
//   node tools/selfplay.mjs valerio greedy 2000
//   node tools/selfplay.mjs --probe            the questions §4 iteration 2 asks
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
        WEIGHT_KEYS } = globalThis;

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
  valerio: profile(PROFILES.Valerio),
  flat:    profile({ ...PROFILES.Valerio, LATE_FACTOR: 0 }),   // k === 1 everywhere
  random:  randomLegal,
  greedy:  greedyTake
};

/* ---- one deal -------------------------------------------------------------- */

// `basso` and `alto` are the two players; the seed fixes the shuffle, so the
// same seed with the seats swapped is the same deal from the other side.
function playDeal(seed, basso, alto, watch){
  const rng = rngSeed(seed);
  const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
  const sit = [basso, alto];
  while (!state.over){
    const who = state.deveGiocare;
    if (watch) watch(state, who);
    gioca(state, who, sit[who](state, rng));
  }
  return scoreDeal(state);
}

// A match is a mirrored pair: the same deal played from both sides.
function match(n, a, b, watch){
  let wins = 0, losses = 0, draws = 0, points = 0, deals = 0;
  for (let seed = 1; seed <= n; seed++){
    for (const aIsBasso of [true, false]){
      const score = aIsBasso
        ? playDeal(seed, PLAYERS[a], PLAYERS[b], watch)
        : playDeal(seed, PLAYERS[b], PLAYERS[a], watch);
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

  // 1. How often is a sure card even available to lead, before trick ten?
  let leads = 0, leadsEarly = 0, sureEarly = 0, sureLate = 0, leadsLate = 0;
  // 2. Tempo: does it decline a trick it could take while holding a sure card?
  let declined = 0, declinedHoldingSure = 0;

  const watch = (state, who) => {
    if (who !== ALTO) return;                 // watch one seat, to count once
    const still = fuori(state, who);
    const hand = state.hands[who];
    const led = who === state.perPrimo ? null : state.played[state.perPrimo];
    const slots = mosseLegali(hand, led);
    const holdsSure = slots.some(i => sicura(still, hand[i]));

    if (led === null){
      leads++;
      if (state.tricks < 10){ leadsEarly++; if (holdsSure) sureEarly++; }
      else { leadsLate++; if (holdsSure) sureLate++; }
    } else {
      const chosen = compGioca(state, PROFILES.Valerio);
      const couldTake = slots.some(i => prende(hand[i], led));
      if (couldTake && !prende(hand[chosen], led)){
        declined++;
        if (hand.some(c => c && sicura(still, c))) declinedHoldingSure++;
      }
    }
  };

  match(n, "valerio", "greedy", watch);

  const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : "—";
  console.log(`  a sure card was available to lead:`);
  console.log(`    before trick ten   ${pct(sureEarly, leadsEarly)}  (${sureEarly} of ${leadsEarly} leads)`);
  console.log(`    from trick ten on  ${pct(sureLate, leadsLate)}  (${sureLate} of ${leadsLate} leads)`);
  console.log(`  tricks declined that it could have taken: ${declined}`);
  console.log(`    while holding a sure card:              ${declinedHoldingSure}` +
              `  (${pct(declinedHoldingSure, declined)} of them)`);

  console.log(`\n  and with k forced to 1 (LATE_FACTOR = 0):`);
  report(match(n, "flat", "random"));
  report(match(n, "flat", "greedy"));
}

/* ---- run ------------------------------------------------------------------- */

const argv = process.argv.slice(2);
if (argv[0] === "--probe"){
  probe(Number(argv[1] ?? 500));
} else if (argv.length >= 2){
  report(match(Number(argv[2] ?? 1000), argv[0], argv[1]));
} else {
  const n = Number(argv[0] ?? 1000);
  console.log(`\nseeds 1..${n}, each played from both sides\n`);
  const vsRandom = report(match(n, "valerio", "random"));
  const vsGreedy = report(match(n, "valerio", "greedy"));
  report(match(n, "random", "greedy"));
  console.log(`\nacceptance (§3.4): random-legal ≥ 95%  ${vsRandom >= 0.95 ? "PASS" : "FAIL"}` +
              `   greedy-take ≥ 70%  ${vsGreedy >= 0.70 ? "PASS" : "FAIL"}`);
}
