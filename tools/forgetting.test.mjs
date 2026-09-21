// Guards the seam tools/forgetting.mjs measures through.
//
// The experiment swaps `globalThis.stillVoid` and reads `compGioca`'s choice.
// That only proves anything if compGioca actually resolves the swapped
// identifier — if it closed over the original lexically, every gamma row would
// be identical and the sweep would "find" that forgetting changes nothing.
// So this asserts the seam moves plays, which is the assumption the whole
// prototype rests on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";

runInThisContext(readFileSync(
  fileURLToPath(new URL("../public/engine.js", import.meta.url)), "utf8"));

const { BASSO, ALTO, rngSeed, newDeal, gioca, compGioca, rollProfiles,
        scoreDeal, stillVoid } = globalThis;

const P = rollProfiles(rngSeed(1)).Franco;
const ORIGINAL = stillVoid;

// Plays one deal as Franco under a given stillVoid and returns the string of
// slots chosen, so two runs are compared card by card rather than by score.
function plays(seed, impl){
  globalThis.stillVoid = impl;
  const rng = rngSeed(seed);
  const state = newDeal({ hands: [], partitaPrimo: seed % 2 ? BASSO : ALTO }, rng);
  const chosen = [];
  while (!state.over){
    const who = state.deveGiocare;
    const slot = compGioca(state, P);
    chosen.push(slot);
    gioca(state, who, slot);
  }
  globalThis.stillVoid = ORIGINAL;
  return chosen.join(",");
}

test("compGioca resolves stillVoid through globalThis, not lexically", () => {
  // The gamma=1 wrapper the experiment uses is the original function itself, so
  // it must be an exact identity on the deal it plays.
  const base = plays(169, ORIGINAL);
  assert.equal(plays(169, ORIGINAL), base);

  // gamma=0 ("believe the void whole", the pre-#21 opponent) must move at least
  // one play across a run of deals. Measured at ~0.4% of decisions, so 50 deals
  // carry several; zero here means the seam is dead and every row would lie.
  let differingDeals = 0;
  for (let seed = 1; seed <= 50; seed++)
    if (plays(seed, () => 1) !== plays(seed, ORIGINAL)) differingDeals++;

  assert.ok(differingDeals > 0,
    "overriding stillVoid changed no play in 50 deals: the experiment's seam does not work");
});

test("gamma=1 reproduces the shipped decision exactly", () => {
  // powers of one on a wrapper: p^1 === p, so the control row is the engine.
  const identity = (state, still, who, suit) =>
    Math.pow(ORIGINAL(state, still, who, suit), 1);
  for (let seed = 1; seed <= 20; seed++)
    assert.equal(plays(seed, identity), plays(seed, ORIGINAL));
});
