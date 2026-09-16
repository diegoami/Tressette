# Tressette

A two-player Tressette game for the browser: one static page, no build step,
the 1997 card art from [Discola](https://github.com/diegoami/discola-web).

`PLAN.md` is the architecture and the plan; iteration 6 rewrites this file
properly.

## The opponents

Three players, one formula, eleven weights — of which **two decide the game a
profile plays**: whether it opens its longest suit, and what a liscio is worth
leading. The roster is the three corners those two make that are worth
standing in.

| | opens the long suit | keeps its lisci |
|---|---|---|
| **Franco** — the house standard | no | yes |
| **Graziano** — another game, not a worse one | yes | no |
| **Piero** — rolled fresh every session | yes | yes |

On seeds the tuning never saw, 500 mirrored deals each:

| | vs random-legal | vs greedy-take | choices differing from Franco |
|---|---|---|---|
| Franco | 86.6% | 84.8% | — |
| Graziano | 88.4% | 86.8% | 21.4% |
| Piero\* | 86.8% | 81.8% | 24.8% |

Head to head they are within a few points of even — 42%, 56%, 60% — which is
the point: characters, not difficulty tiers.

\* one session of him. Piero's two deciding weights are fixed, so that he
cannot roll into somebody else's game; the other nine are drawn fresh each
session, and over eight sessions he ran 82.1–85.8% against greedy-take and
20.5–25.1% away from Franco. Most of those nine barely move a play, which is
why his sessions differ less than his weights do.

The settings sheet discloses all eleven weights for whoever you are playing.
From the fourteenth trick the weights stop mattering: the opponent enumerates
the rest of the deal and plays it exactly, and all three play those seven
tricks alike.
