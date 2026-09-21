// The wrapper tools/forgetting.mjs applies to stillVoid, kept in its own file so
// the regression test can import it without running the sweep.
//
//   p -> p^gamma, for finite gamma
//   p -> (p === 1 ? 1 : 0), for gamma === Infinity
//
// The infinite case is the one with a trap: `Math.pow(1, Infinity)` is NaN, not
// 1, and stillVoid returns exactly 1 for a fresh void and for a void shown once
// the tallone is empty — both permanent. Feeding that NaN into
// `score -= LEAD_INTO_VOID_PENALTY * p` makes `score > bestScore` false for
// reasons unrelated to the rule, so the binary limit is written out.
export function gammaStillVoid(gamma, original){
  if (gamma === 1) return original;
  if (gamma === Infinity)
    return (state, still, who, suit) =>
      original(state, still, who, suit) === 1 ? 1 : 0;
  return (state, still, who, suit) =>
    Math.pow(original(state, still, who, suit), gamma);
}
