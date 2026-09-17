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

On seeds nothing was ever tuned or reported on, 2,000 deals a matchup —
`SEED_FROM=90001 node tools/selfplay.mjs 1000` for the win rates,
`SEED_FROM=90001 node tools/selfplay.mjs --differ 200` for the last column:

| | vs random-legal | vs greedy-take | choices differing from Franco |
|---|---|---|---|
| Franco | 85.5% ± 1.5 | 86.6% ± 1.5 | — |
| Valerio | 85.8% ± 1.5 | 81.3% ± 1.7 | 14.0% |
| Graziano | 87.0% ± 1.5 | 86.5% ± 1.5 | 20.7% |
| Piero\* | 84.7% ± 1.6 | 80.3% ± 1.7 | 24.0% |

Head to head the six pairs run 44% to 58% — characters, not difficulty tiers.
The closest two, Graziano and Piero, still play a different card in 10.8% of
the decisions the weights actually make; the pair that retired the name Valerio
in the first place played the same card 99 times in a hundred.

\* one session of him, and a session is a roll of all eleven weights. Four of
them are drawn from bands narrow enough that he cannot roll into somebody
else's game — that corner costs him about two points of win rate, and without
it one roll in eight comes out as Franco under another name. The other seven
are drawn wide, and most of them barely move a play, which is why his sessions
differ less than his weight vectors do. Twenty
rolls — `SEED_FROM=90001 node tools/selfplay.mjs --piero 8 500` and
`node tools/selfplay.mjs --piero 12 400` — ran 83.6% to 87.2% against
random-legal, 80.5% to 85.2% against greedy-take, and 18.9% to 24.3% away from
Franco.

The settings sheet discloses all eleven weights for whoever you are playing.
From the fourteenth trick the weights stop mattering: the opponent enumerates
the rest of the deal and plays it exactly, and all four play those seven
tricks alike.
