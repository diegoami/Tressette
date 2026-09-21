# The coefficient of forgetting — a prototype, and what it measured

**Status: experiment, on the branch `experiment/forgetting-coefficient`. Not
merged, and not a proposal to merge.** `public/engine.js` and `tools/golden.json`
are untouched, so the shipped engine and the fixture are exactly what the
control row measures. If this ever became a real change it would take §3.4's
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
`LEAD_INTO_VOID_PENALTY`. The question this experiment asks is whether `p`'s
exponent should instead be a **tunable coefficient of forgetting**, a knob a
profile could be given so its suspicion of a stale void becomes part of its
playing style.

## Method, and why it need not touch the engine

`compGioca` calls `stillVoid` as a free identifier, and the engine is loaded as
a vm Script, so that identifier resolves through `globalThis`. The experiment
swaps in a wrapper `p → p^γ` and reads `compGioca`'s choice. `γ = 1` swaps in the
original function itself, so the control row *is* the shipped opponent.

| γ | what it means |
|---|---|
| `0` | believe the void whole — the pre-#21 opponent |
| `1` | the shipped decay — the control |
| `∞` | drop it the moment it goes stale — the strict fix #21 proposed |

Everything else is `tools/selfplay.mjs`'s protocol: profiles rolled from
`rngSeed(1)`, each seed played from both seats, win rates against greedy-take and
random-legal, the same 95% noise floor, and "differs" counting only decisions the
weights actually make (forced moves and the last seven searched tricks
excluded).

## Reproduce

```sh
node tools/forgetting.mjs 800            # Franco, seeds 1..800 mirrored
node tools/forgetting.mjs 500 --roster   # all three fixed profiles
SEED_FROM=5001 node tools/forgetting.mjs 800   # seeds the tuning never saw
npm test                                 # guards the seam the sweep measures through
```

## Results

Franco, seeds 1..800 mirrored (1,600 deals a row):

| γ | vs greedy | vs random | pts/deal | differs from γ=1 |
|---|---|---|---|---|
| 0 (believe whole) | 85.8% ± 1.7 | 85.3% | 8.56 | 0.4% (69 of 18,804) |
| 0.25 | 85.9% ± 1.7 | 85.4% | 8.56 | 0.0% (0 of 18,801) |
| 0.5 | 85.9% ± 1.7 | 85.4% | 8.56 | 0.0% |
| **1 (shipped)** | **85.9% ± 1.7** | **85.4%** | **8.56** | — |
| 2 | 85.9% ± 1.7 | 85.4% | 8.56 | 0.0% |
| 4 | 85.9% ± 1.7 | 85.4% | 8.56 | 0.0% (1 of 18,800) |
| 8 | 85.9% ± 1.7 | 85.4% | 8.56 | 0.0% (1 of 18,800) |
| ∞ (drop immediately) | 84.9% ± 1.8 | 84.3% | 8.41 | 4.3% (810 of 18,702) |

The roster agrees, at 500 seeds mirrored (1,000 deals a row). `differs` is
against each profile's own shipped γ=1:

| profile | γ=0 differs | γ=8 differs | γ=∞ differs | γ=∞ vs greedy | shipped vs greedy |
|---|---|---|---|---|---|
| Franco | 0.3% | 0.0% | 4.1% | 85.0% | 86.3% |
| Valerio | 0.1% | 1.1% | 7.8% | 77.4% | 80.6% |
| Graziano | 0.7% | 2.1% | 7.8% | 83.4% | 84.7% |

Points a deal move the same way: Franco 8.56 → 8.41, Valerio 8.13 → 7.95,
Graziano 8.48 → 8.42 only at γ=∞, and not at all in between.

## What it means

1. **Between "believe it whole" and "forget it fast" the coefficient changes
   essentially nothing.** Over γ ∈ [0, 8] the largest play difference any
   profile shows is Graziano's 2.1%, and its win rate and points a deal are
   flat inside the noise floor. A dial that is inert across its whole useful
   range is the defect `PLAN.md` names — "a weight that cannot move a play does
   not belong in the eleven."

2. **Only the binary extreme moves anything, and it always makes the opponent
   weaker.** At γ=∞ plays change by 4–8% and every profile loses 1.3 to 3.2
   points of win rate and points a deal. That is not a style; it is the strict
   fix #21 proposed, which the project already measured and rejected because it
   "plays worse."

3. **It cannot create a distinct player.** Graziano is a different player from
   Franco because he plays a different card in **21.9%** of the decisions the
   weights make. The largest difference any forgetting coefficient produces
   inside the noise is 2.1%. A coefficient cannot reach a personality.

The recommendation is the one the earlier analysis reached: **keep `p` as the
computed probability and do not add a forgetting coefficient.** A profile's
attitude to a stale void already lives in `LEAD_INTO_VOID_PENALTY` — the weight
that `p` multiplies — and the post-#21 re-ladder already showed that weight is
itself inside the noise floor from −4 to −12. The levers that measured real are
`LEAD_LONG_SUIT` and `LEAD_LISCIO_BONUS`; style is bought there, not here.
