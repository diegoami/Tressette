# Tressette

A two-player Tressette game for the browser: one static page, no build step,
the 1997 card art from [Discola](https://github.com/diegoami/discola-web).

`PLAN.md` is the architecture and the plan; iteration 6 rewrites this file
properly.

## The opponents

Four players, one formula, eleven weights — of which **two decide the game a
profile plays**: whether it opens its longest suit, and what a liscio is worth
leading. Two weights make four corners, and there is a player in each.

| | opens the long suit | keeps its lisci |
|---|---|---|
| **Franco** — the house standard | no | yes |
| **Graziano** — another game, not a worse one | yes | no |
| **Piero** — rolled fresh every session | yes | yes |
| **Valerio** — the loosest of the four | no | no |

On seeds the tuning never saw, 500 mirrored deals each:

| | vs random-legal | vs greedy-take | choices differing from Franco |
|---|---|---|---|
| Franco | 86.6% | 84.8% | — |
| Valerio | 87.6% | 80.6% | 15.0% |
| Graziano | 88.4% | 86.8% | 21.6% |
| Piero\* | 86.8% | 81.8% | 25.2% |

Head to head the six pairs run 42% to 60% — characters, not difficulty tiers.
The closest two, Graziano and Piero, still play a different card in 11.6% of
the decisions the weights actually make; the pair that retired the name Valerio
in the first place played the same card 99 times in a hundred.

\* one session of him. Piero's two deciding weights are fixed, so that he
cannot roll into somebody else's game; the other nine are drawn fresh each
session, and over eight sessions he ran 82.1–85.8% against greedy-take and
20.5–25.1% away from Franco. Most of those nine barely move a play, which is
why his sessions differ less than his weights do.

The settings sheet discloses all eleven weights for whoever you are playing.
From the fourteenth trick the weights stop mattering: the opponent enumerates
the rest of the deal and plays it exactly, and all three play those seven
tricks alike.
