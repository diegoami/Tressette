# Tressette

A two-player Tressette game for the browser: one static page, no build step,
the 1997 card art from [Discola](https://github.com/diegoami/discola-web).

`PLAN.md` is the architecture and the plan; iteration 6 rewrites this file
properly.

## The opponents

Three players, one formula, eleven weights. They are told apart by how often
they put down a different card in the same position — measured over dealt
positions with more than one legal card, on seeds the tuning never saw.

| | vs random-legal | vs greedy-take | plays differing from Franco |
|---|---|---|---|
| **Franco** — the house standard, balanced | 88.6% | 88.2% | — |
| **Graziano** — loose and quick, a little easier | 88.8% | 80.8% | 11.1% |
| **Piero** — rolled fresh every session | 86.8%\* | 78.6%\* | 22.7%\* |

\* one session of him. Over six: 73–84% against greedy-take, 12–30% different.

Franco's weights are tuned; Graziano's buy their difference with the liscio
bonus, which costs about a point of win rate per percent of plays changed;
Piero's are drawn from ranges once per session, as they were in the 1997
original, where `SetProfiles` ran from `FormCreate`.

The settings sheet discloses all eleven weights for whoever you are playing.
From the fourteenth trick the weights stop mattering: the opponent enumerates
the rest of the deal and plays it exactly, and all three play those seven
tricks alike.
