# Tressette

A two-player **Tressette a due** for the browser: one static page, no build
step, no runtime dependencies, and the 1997 card art from
[Discola](https://github.com/diegoami/discola-web) in five decks.

You against one of four opponents, one deal at a time. Everything — your
settings, your last hundred hands — stays in your browser.

## Playing

A tap on a card raises it, a second tap plays it: on a phone a hand of ten
cards is a fan, and a card's uncovered strip is about 29px, which is no width
for a decision that costs the deal. The keyboard does the same with `1`–`9`,
`0` and `Enter`. Cards the follow-suit rule forbids are dimmed and inert, so
the rule is taught by the table rather than by an error message after the fact.

## The rules it plays

Tressette has as many house rules as it has houses. **[`RULES.md`](RULES.md)**
states this one plainly in English, **[`REGOLE.md`](REGOLE.md)** in Italian.
The short version:

- **3 · 2 · A · re · cavallo · fante · 7 · 6 · 5 · 4**, and no trump.
- Points in thirds: an asso is a whole point, a 3, a 2 and each figure a third,
  the rest nothing. The last trick is worth a point. Eleven points in all, plus
  declarations.
- Declarations count from the ten cards dealt and only those, and announce
  themselves when their owner plays their first card.
- Ten cards each, twenty tricks, drawing from the tallone until it runs out.

## The opponents

Four players, one formula, eleven weights — of which **two decide the game a
profile plays**: whether it opens its longest suit, and what a liscio is worth
leading. Those two make four corners, and there is a player in each.

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
differ less than his weight vectors do. Twenty rolls —
`SEED_FROM=90001 node tools/selfplay.mjs --piero 8 500` and
`node tools/selfplay.mjs --piero 12 400` — ran 83.6% to 87.2% against
random-legal, 80.5% to 85.2% against greedy-take, and 18.9% to 24.3% away from
Franco.

From the fourteenth trick the weights stop mattering: the opponent enumerates
the rest of the deal and plays it exactly, and all four play those seven tricks
alike. The settings sheet discloses all eleven weights for whoever you are
playing.

## Working on it

```sh
node --test 'tools/**/*.test.mjs'   # 46 tests, no dependencies
node tools/check_ui.mjs             # the UI check: needs playwright-core
node tools/selfplay.mjs             # the opponents against the baselines
```

Both checks run in CI on every pull request, and a red one does not merge.
**[`SPEC.md`](SPEC.md)** is the handover document: the architecture, the
contracts, the measurements and the known gaps. **[`PLAN.md`](PLAN.md)** is the
record of how it was built, including what it got wrong on the way — which is
most of what the project is worth.

## Provenance

The cards are the original bitmaps from the Delphi 3 **Discola** of 1997,
copied byte for byte, in five decks: Trevisane, Piacentine, Napoletane,
Romagnole and Francesi. The page and its stylesheet are forked from
[`diegoami/discola-web`](https://github.com/diegoami/discola-web).

The opponent is this game's own. There was no 1997 Tressette to transcribe, so
the formula was designed here and tuned by self-play.
