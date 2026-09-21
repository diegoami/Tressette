# The coefficient of forgetting — a prototype, and what it measured

**Status: experiment, on the branch `experiment/forgetting-coefficient`. Not
merged, and not a proposal to merge.** `public/engine.js` and `tools/golden.json`
are untouched, so the shipped engine and the fixture are exactly what the control
row measures. If this ever became a real change it would take §3.4's
formula-change procedure in `SPEC.md`: measured, decided by the owner, fixture
re-recorded in the commit that moves it.

## The question

Issue #21 fixed the opponent's stale void: `state.voids` used to be set on a
failure to follow and never cleared, so the machine led into a suit the player
had refilled from the tallone. The fix shipped in `ac884d1` decays the belief
instead of expiring it:

```
p = (1 − unseen of the suit / unseen) ^ (draws taken since the void was shown)
```

`p` is the chance nothing drawn since was that suit, and it multiplies
`LEAD_INTO_VOID_PENALTY`. This experiment asks whether `p`'s exponent should
instead be a **tunable coefficient of forgetting**, a knob a profile could be
given so its suspicion of a stale void becomes part of its playing style.

## Method

`compGioca` calls `stillVoid` as a free identifier, and the engine is loaded as
a vm Script, so that identifier resolves through `globalThis`. The sweep swaps in
a wrapper `p → p^γ`; `γ = 1` swaps in the original function itself, so the
control row *is* the shipped opponent.

| γ | what it means |
|---|---|
| `0` | believe the void whole — the pre-#21 opponent |
| `1` | the shipped decay — the control |
| `∞` | drop it the moment it goes stale — the strict fix #21 proposed |

Two things are measured beyond the win rate. **differs** counts how often the
variant puts down a different card than the shipped engine in the same position
(forced moves and the last seven searched tricks excluded). **Head-to-head**
plays the variant against the shipped engine, which the global swap cannot do —
both seats would share one `stillVoid` — so the variant runs from a second,
isolated copy of the engine in its own vm context, reading the same deal state.

The protocol is `tools/selfplay.mjs`'s: profiles rolled from `rngSeed(1)`, each
seed played from both seats, the same 95% noise floor.

## Reproduce

```sh
node tools/forgetting.mjs 800            # Franco, seeds 1..800 mirrored
node tools/forgetting.mjs 500 --roster   # all three fixed profiles
node tools/forgetting.mjs --validate 800 # anchor against #29's 46.9%
SEED_FROM=5001 node tools/forgetting.mjs 800   # held-out seeds
npm test                                 # guards the seam and the binary limit
```

The head-to-head column needs an anchor, because a variant against an identical
opponent does not read 50%: draws count as neither win nor loss. `#29` measured
the strict fix against the version that believed the void whole at **46.9%** over
800 deals. This prototype reproduces it — strict vs believe-whole, Franco, 800
seeds mirrored: **48.0% ± 2.4** (won 768, lost 797, drew 35). The anchor says the
isolated engine and the binary limit are right, not merely plausible.

## Results

Franco, seeds 1..800 mirrored (1,600 deals a row):

| γ | vs greedy | vs random | pts/deal | differs | head-to-head vs shipped |
|---|---|---|---|---|---|
| 0 believe whole | 85.8% ± 1.7 | 85.3% | 8.48 | 0.4% (69 of 18,804) | 49.3% ± 2.4 |
| 0.25 | 85.9% ± 1.7 | 85.4% | 8.49 | 0.0% (0) | 48.8% ± 2.4 |
| 0.5 | 85.9% ± 1.7 | 85.4% | 8.49 | 0.0% (0) | 48.8% ± 2.4 |
| **1 shipped** | **85.9% ± 1.7** | **85.4%** | **8.49** | — | **48.8% ± 2.4** |
| 2 | 85.9% ± 1.7 | 85.4% | 8.49 | 0.0% (0) | 48.8% ± 2.4 |
| 4 | 85.9% ± 1.7 | 85.4% | 8.49 | 0.0% (1) | 48.8% ± 2.4 |
| 8 | 85.9% ± 1.7 | 85.4% | 8.49 | 0.0% (1) | 48.8% ± 2.4 |
| ∞ drop immediately | 86.1% ± 1.7 | 85.5% | 8.49 | 1.7% (314 of 18,771) | 48.4% ± 2.4 |

The roster agrees at 500 seeds mirrored (1,000 deals a row), `differs` against
each profile's own shipped γ=1, head-to-head against the same:

| profile | γ=0 | γ=8 | γ=∞ | γ=∞ vs greedy | shipped vs greedy | γ=∞ h2h | shipped h2h |
|---|---|---|---|---|---|---|---|
| Franco | 0.3% | 0.0% | 1.6% | 86.2% | 86.3% | 48.3% | 48.9% |
| Valerio | 0.1% | 1.1% | 3.3% | 80.4% | 80.6% | 48.3% | 48.8% |
| Graziano | 0.7% | 2.1% | 3.9% | 85.2% | 84.7% | 47.6% | 48.4% |

## What it means

1. **Inert between "believe it whole" and "forget it fast".** Over γ ∈ [0, 8]
   the largest play difference any profile shows is Graziano's 2.1%, and win
   rate, points a deal and the head-to-head are all flat inside the noise floor.
   A dial that is inert across its whole useful range is the defect `PLAN.md`
   names: a weight that cannot move a play does not belong in the eleven.

2. **Only the binary extreme moves anything, and it does not strengthen the
   opponent.** At γ=∞ plays change by 1.6–3.9%, win rate against greedy is a tie,
   and head-to-head each profile sits ≤0.8 points below its own shipped baseline
   — inside the ±2.4/±3.1 band. The direction is the one `#29` found (the strict
   fix loses to believing the void whole, its anchor at 46.9%), but at this
   sample it is not a strength *claim*, it is a small, unproven handicap.

3. **It cannot create a player.** Graziano is a different player from Franco
   because he plays a different card in **21.9%** of the decisions the weights
   make. The largest difference any forgetting coefficient produces, at the
   extreme, is 3.9%. A coefficient cannot reach a personality.

**Recommendation:** keep `p` as the computed probability and do not add a
forgetting coefficient. A profile's attitude to a stale void already lives in
`LEAD_INTO_VOID_PENALTY`, the weight `p` multiplies. The levers that measured
real are `LEAD_LONG_SUIT` and `LEAD_LISCIO_BONUS`; style is bought there, not
here.

## Review history

The first version of this prototype reported a γ=∞ row that lost 1.3–3.2 points
of win rate and differed in 4–8% of plays, and concluded the extreme weakened
every profile. **That row was invalid.** `Math.pow(1, Infinity)` is `NaN`, and
`stillVoid` returns exactly `1` for a fresh void and for a void shown once the
tallone is empty — both permanent. The plain power fed `NaN` into
`score -= LEAD_INTO_VOID_PENALTY * p`, so those candidates failed
`score > bestScore` for reasons unrelated to the rule. Caught in review on PR
#42. The limit is now written out as `p === 1 ? 1 : 0`, asserted in
`tools/forgetting.test.mjs`, and every γ=∞ number above is from the corrected
run. The conclusion for the finite range was never affected.
