// Forget the void, or remember it: what does one coefficient buy?
//
// Prototype for the question "should the void's decay be a tunable parameter
// that gives a profile a different playing style?". It answers it by sweeping
// the exponent of the shipped decay,
//
//   p = (1 - unseen of the suit / unseen) ^ (draws taken since the void showed)
//
// against a wrapper p -> p^gamma:
//
//   gamma = 0     believe the void whole            the pre-#29 opponent
//   gamma = 1     the shipped decay                 (the control: this row is
//                                                    the engine as it ships)
//   gamma -> inf  drop it the moment it goes stale  the strict fix #21 proposed
//
// Nothing in public/engine.js is touched. `compGioca` calls `stillVoid` as a
// free identifier, and a vm Script resolves that through `globalThis`, so the
// experiment swaps in a wrapper — the golden fixture and the shipped engine are
// exactly what the control row measures. Reproduce with:
//
//   node tools/forgetting.mjs 500            Franco, seeds 1..500 mirrored
//   node tools/forgetting.mjs 500 --roster   every fixed profile
//   node tools/forgetting.mjs --validate 800 #29's strict-vs-whole anchor
//   SEED_FROM=5001 node tools/forgetting.mjs 500
//
// The protocol is tools/selfplay.mjs's: each seed is played from both seats, the
// win rate is against greedy-take (a real opponent) and random-legal (the
// floor), and the noise floor is the same 95% band, so a row inside it is not a
// difference.

import { readFileSync } from "node:fs";
import { runInThisContext, runInContext, createContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { gammaStillVoid } from "./forgetting_lib.mjs";

const ENGINE_SRC = readFileSync(
  fileURLToPath(new URL("../public/engine.js", import.meta.url)), "utf8");

runInThisContext(ENGINE_SRC);

const { BASSO, ALTO, terzi, prende, mosseLegali, rngSeed, newDeal, gioca,
        scoreDeal, rollProfiles, compGioca, CODA_FROM } = globalThis;

const PROFILES = rollProfiles(rngSeed(1));
const ORIGINAL_STILL_VOID = globalThis.stillVoid;

// gamma === 1 is a no-op wrapper on purpose: the control row then measures the
// shipped engine through the same call path as every other row. The wrapper has
// one trap — `Math.pow(1, Infinity)` is NaN, and stillVoid returns exactly 1 for
// the permanent voids — and it is handled, and asserted, in forgetting_lib.mjs.
function setGamma(gamma){
  globalThis.stillVoid = gammaStillVoid(gamma, ORIGINAL_STILL_VOID);
}

// A second, isolated copy of the engine whose stillVoid is wrapped with a fixed
// gamma and never touched again. This is what lets a variant play the shipped
// engine head-to-head: the global swap cannot, because both seats share the one
// stillVoid. The isolated copy reads the same plain state objects the global
// `gioca` mutates, so the two engines play each other on one deal.
// A fresh context per gamma kept every engine copy alive, and a roster run
// (three profiles x eight gammas) died in the endgame search. So the experiment
// uses one context per place it needs an engine: one for a sweep's head-to-head
// rows (its opponent is the global engine, so it can be re-wrapped per gamma),
// and two for a policy-vs-policy anchor. The engine holds no cross-deal state.
// The pristine stillVoid is stashed first, so a wrap never wraps a previous one.
function isolatedContext(){
  const ctx = createContext({});
  runInContext(ENGINE_SRC, ctx);
  runInContext("globalThis.__shippedStillVoid = stillVoid;", ctx);
  return ctx;
}

function wrapStillVoid(ctx, gamma){
  runInContext(
    `stillVoid = (function(orig){ return function(state, still, who, suit){
       var p = orig(state, still, who, suit);
       return ${gamma === Infinity ? "(p === 1 ? 1 : 0)" : `Math.pow(p, ${gamma})`};
     }; })(globalThis.__shippedStillVoid);`, ctx);
  return ctx.compGioca;
}

/* ---- the same baselines as tools/selfplay.mjs ------------------------------ */

const legalFor = state => {
  const me = state.deveGiocare;
  const led = me === state.perPrimo ? null : state.played[state.perPrimo];
  return { me, led, slots: mosseLegali(state.hands[me], led) };
};

const randomLegal = (state, rng) => {
  const { slots } = legalFor(state);
  return slots[Math.floor(rng() * slots.length)];
};

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

const SEED_FROM = Number(process.env.SEED_FROM ?? 1);

function playDeal(seed, basso, alto, watch, watched){
  const rng = rngSeed(seed);
  const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
  const sit = [basso, alto];
  while (!state.over){
    const who = state.deveGiocare;
    if (watch && who === watched) watch(state, who);
    gioca(state, who, sit[who](state, rng));
  }
  return scoreDeal(state);
}

function match(n, a, b, watch){
  let wins = 0, losses = 0, draws = 0, points = 0, deals = 0;
  for (let seed = SEED_FROM; seed < SEED_FROM + n; seed++){
    for (const aIsBasso of [true, false]){
      const score = aIsBasso
        ? playDeal(seed, a, b, watch, BASSO)
        : playDeal(seed, b, a, watch, ALTO);
      const mine = aIsBasso ? score[BASSO] : score[ALTO];
      const theirs = aIsBasso ? score[ALTO] : score[BASSO];
      points += mine; deals++;
      if (mine > theirs) wins++; else if (mine < theirs) losses++; else draws++;
    }
  }
  return { deals, wins, losses, draws, points };
}

const floor95 = (p, n) => 1.96 * Math.sqrt(p * (1 - p) / n);
const pct = x => `${(100 * x).toFixed(1)}%`;

/* ---- the sweep ------------------------------------------------------------- */

// Two kinds of decision do not count, for the reasons selfplay.mjs's differ()
// gives: a forced move is not a choice the weights made, and from CODA_FROM on
// the search answers and every profile plays alike by construction.
function decisions(state, who){
  const led = who === state.perPrimo ? null : state.played[state.perPrimo];
  if (mosseLegali(state.hands[who], led).length < 2) return false;
  return state.tricks < CODA_FROM;
}

const GAMMAS = [0, 0.25, 0.5, 1, 2, 4, 8, Infinity];
const LABEL = { 0: "believe whole", 1: "shipped decay", Infinity: "drop on first draw" };

function sweep(name, n){
  const P = PROFILES[name];
  const base = profile(P);          // global engine, always gamma 1
  const variant = profile(P);       // global engine, whatever gamma is set
  const shipped = profile(P);       // global engine, forced to gamma 1 for h2h
  const isoCtx = isolatedContext(); // one isolated engine, re-wrapped per gamma

  console.log(`\n${name}, ${n} seeds mirrored (${2 * n} deals a row)` +
              `, seeds ${SEED_FROM}..${SEED_FROM + n - 1}`);
  console.log(`  gamma   meaning                 vs greedy        vs random` +
              `        pts/deal  differs from gamma=1   head-to-head vs shipped`);

  setGamma(1);

  for (const gamma of GAMMAS){
    let differs = 0, total = 0;
    const watch = (state, who) => {
      if (!decisions(state, who)) return;
      total++;
      setGamma(1);                    // no wrapper: the engine as it ships
      const a = base(state);
      setGamma(gamma);                // the experiment's wrapper
      const b = variant(state);
      if (a !== b) differs++;
    };

    setGamma(gamma);
    const g = match(n, variant, greedyTake, watch);
    const r = match(n, variant, randomLegal);

    // Head-to-head: an isolated variant against the shipped opponent. The global
    // engine must read gamma 1 for the shipped seat, hence the isolated copy.
    setGamma(1);
    const iso = wrapStillVoid(isoCtx, gamma);
    const h = match(n, state => iso(state, P), shipped);

    const gr = g.wins / g.deals;
    const hr = h.wins / h.deals;
    const label = LABEL[gamma] ?? "";
    console.log(
      `  ${String(gamma).padStart(6)}  ${label.padEnd(22)}` +
      `${pct(gr).padStart(6)} ± ${(100 * floor95(gr, g.deals)).toFixed(1)}`.padEnd(18) +
      `${pct(r.wins / r.deals).padStart(6)}`.padEnd(17) +
      `${(g.points / g.deals).toFixed(2)}`.padEnd(10) +
      `${pct(total ? differs / total : 0).padStart(6)}  (${differs} of ${total})`.padEnd(28) +
      `${pct(hr).padStart(6)} ± ${(100 * floor95(hr, h.deals)).toFixed(1)}`);
  }
}

/* ---- anchor against #29 ---------------------------------------------------- */

// #29 measured the strict fix against the version that believed the void whole:
// 46.9% over 800 mirrored deals. Reproducing that number through this seam is
// what says the isolated engine and the binary limit are right, rather than
// merely plausible. Both seats are Franco; only the void policy differs.
function validate(n){
  const P = PROFILES.Franco;
  const strict = wrapStillVoid(isolatedContext(), Infinity);
  const whole  = wrapStillVoid(isolatedContext(), 0);
  const r = match(n, state => strict(state, P), state => whole(state, P));
  console.log(`\nvalidate: strict (gamma=inf) vs believe-whole (gamma=0), Franco, ` +
              `${n} seeds mirrored (${2 * n} deals)\n`);
  console.log(`  strict wins ${pct(r.wins / r.deals)} ± ${(100 * floor95(r.wins / r.deals, r.deals)).toFixed(1)}` +
              `   won ${r.wins} lost ${r.losses} drew ${r.draws}` +
              `   ${(r.points / r.deals).toFixed(2)} points/deal`);
  console.log(`  #29 reported 46.9% for this match over 800 deals.`);
}

/* ---- run ------------------------------------------------------------------- */

const argv = process.argv.slice(2).filter(a => a !== "--roster");

if (argv[0] === "--validate"){
  validate(Number(argv[1] ?? 800));
} else {
  const n = Number(argv[0] ?? 500);
  const roster = process.argv.includes("--roster");
  const names = roster ? ["Franco", "Valerio", "Graziano"] : ["Franco"];
  for (const name of names) sweep(name, n);
}
