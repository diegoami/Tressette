# Tressette — what was built, and why it is the way it is

The handover document. `PLAN.md` was the plan and is kept as the record of how
the project got here, including what it got wrong; this file describes the
thing that exists, and is what a stranger taking the project over should read
first.

The game is live at the Netlify site linked to `main`, which publishes `public/`
and nothing else.

---

## 1. What it is

A two-player Tressette a due for the browser: one static page, no build step, no
runtime dependencies, the 1997 card art from
[Discola](https://github.com/diegoami/discola-web) in five decks. You against
one of four opponents, one deal at a time, everything kept in the browser.

Player-facing text is Italian. Comments, commit messages and documents are
English.

## 2. The repository

```
public/index.html    the whole page: styles, markup, and the code that
                     renders a state object and turns taps into calls
public/engine.js     the rules and the opponent, as pure functions
public/decks/        five sprite sheets, the original 1997 bitmaps
tools/engine.test.mjs    the rules, on node --test
tools/opponent.test.mjs  the trap positions, the roster, the golden fixture
tools/selfplay.mjs       the harness every number in this file came from
tools/golden.json        sixty frozen deals and four weight vectors
tools/check_ui.mjs       the UI check: four passes, 111 rows
tools/pack_cards.py      carried from Discola, for repacking a deck
netlify.toml         publish public/, cache the decks hard, never the page
RULES.md / REGOLE.md the rules as this game plays them, English and Italian
PLAN.md              the plan and the record, iteration by iteration
CLAUDE.md            the four rules a builder has to follow
```

Nothing is generated at build time. `npm i playwright-core` and a Chromium are
needed only to run the UI check, and are gitignored.

## 3. The engine contract

`public/engine.js` is a classic script. It touches no `document`, no `window`,
no timer and no `Math.random`, which is what lets Node run the very same file
the browser runs — `vm.runInThisContext` — and that is what makes the tests, the
self-play harness and the golden fixture possible at all. Randomness arrives as
an injected `rng`, `rollProfiles(rng)` included.

Everything is a pure function over a plain state object; the page owns the
timers, the DOM and `Math.random`.

```
newDeal(state, rng)        shuffle, ten each, non-dealer leads
mosseLegali(hand, led)     slot indices; follow suit if you can
gioca(state, who, slot)    play a card; resolves the trick when both have
scoreDeal(state)           [you, them], floors of terzi plus declarations
compGioca(state, P)        the opponent's choice, given a weight vector
rollProfiles(rng)          {Franco, Valerio, Graziano, Piero}
```

**From v1.0 the rule is: change a weight, not the formula.** The golden fixture
freezes sixty deals play by play; a formula change moves them by accident and
the test says so, and a weight change moves them deliberately and the fixture is
re-recorded in the same commit:

```sh
node tools/selfplay.mjs --golden > tools/golden.json
```

## 4. The rules as implemented

`RULES.md` (English) and `REGOLE.md` (Italian) state them for a player. The
engine facts a maintainer needs:

- Rank order **3 · 2 · A · re · cavallo · fante · 7 · 6 · 5 · 4**, no trump.
- Points in **terzi**: an asso is 3, a 3, a 2 and each figure is 1, the rest 0.
  The deck holds 32 terzi and the last trick is worth 3 more, so 35 are dealt
  out; 35 mod 3 is 2, which is why the two floors always sum to exactly 11.
  Everything is counted in thirds as integers, because a deal scored in floats
  rounds to the wrong number of points.
- **Follow suit if you can.** The table dims what the rule forbids, and
  `gioca` throws on an illegal slot: every caller is code.
- **Declarations** from the ten cards dealt and only those — napoletana 3,
  three of a kind 3, four of a kind 4 — announced when their owner plays their
  first card, scored on top of the eleven (§0, decision 4).
- Twenty tricks: ten while the tallone lasts, ten more without drawing. The
  winner of a trick draws first and leads next.
- A *partita* is one deal (§0, decision 3).

## 5. The opponent

Three branches. Leading and following score every legal card with the profile's
eleven weights and play the highest, ties to the lowest slot. The third branch
is the endgame: **from `CODA_FROM` (13) — the last seven tricks, where the
tallone is empty and the position is fully determined — `compGioca` enumerates
it and plays it out exactly.** All four profiles play those seven tricks alike,
which is also why those decisions are excluded whenever the roster is measured
for difference: there is nothing there for a weight to change.

That search is worth about four points of win rate over stopping at the last
two tricks, and costs a median 28ms on the first searched decision (p95 64ms).
Moving `CODA_FROM` means re-tuning the late weights, not just re-recording the
fixture: the search silently revalues them.

### The four

**Two of the eleven weights decide the game a profile plays** — whether it opens
its longest suit (`LEAD_LONG_SUIT`, which is a switch, not a dial) and what a
liscio is worth leading (`LEAD_LISCIO_BONUS`). Those two make four corners, and
there is a player in each:

| | opens the long suit | keeps its lisci | |
|---|---|---|---|
| **Franco** | no | yes | the house standard, tuned by coordinate ascent |
| **Graziano** | yes | no | another game, not a worse one |
| **Piero** | yes | yes | all eleven weights rolled per session |
| **Valerio** | no | no | the loosest of the four |

On seeds 90001+, which nothing has been tuned or reported on, 2,000 mirrored
deals a matchup (`SEED_FROM=90001 node tools/selfplay.mjs 1000`):

| | vs random-legal | vs greedy-take |
|---|---|---|
| Franco | 85.5% ± 1.5 | 86.6% ± 1.5 |
| Valerio | 85.8% ± 1.5 | 81.3% ± 1.7 |
| Graziano | 87.0% ± 1.5 | 86.5% ± 1.5 |
| Piero (one session) | 84.7% ± 1.6 | 80.3% ± 1.7 |

Head to head the six pairs run 44% to 58%. The share of *choices the weights
actually make* on which two of them differ runs from 10.8% (Graziano and Piero,
who share a corner's long suit) to 26.8% (Valerio and Piero).

**§3.4 of `PLAN.md` asks for 82% against random-legal and 78% against
greedy-take**, and every profile above clears both. Those floors were 85% and
80% until the review of iteration 5: they had been set from one profile on
about a thousand deals, before the endgame search existed, and a rolled Piero
lands on either side of 85% depending on the seed range rather than on the
player. **The table above is the claim about how strong these players are; the
floors are a regression guard.**

**All eleven of Piero's weights are drawn**, four of them from bands narrow
enough to hold his corner and seven from the wide ranges. He is rolled once per
session, as in 1997 where `SetProfiles` ran from `FormCreate`. Most of the seven
barely move a play, so his sessions differ less than his weight vectors do:
twenty rolls (`SEED_FROM=90001 … --piero 8 500` and `… --piero 12 400`) ran
80.5–85.2% against greedy-take and 18.9–24.3% away from Franco, with five of
the twelve falling into two groups identical to the decimal.

The four bands cost him about two points against greedy-take, and buy the
corner: with all eleven drawn wide, one roll in eight comes out 5.6% from
Franco — Franco under another name, which is what retired the name Valerio the
first time.

### Measuring any of this

```sh
node tools/selfplay.mjs                     all four against both baselines,
                                            head to head, and the §3.4 verdict
node tools/selfplay.mjs --differ 200        how often each pair differs
node tools/selfplay.mjs --ladder KEY 1,2,3  what one weight costs and buys
node tools/selfplay.mjs --try KEY=V,KEY=V   a whole candidate vector
node tools/selfplay.mjs --piero 8 500       what a rolled Piero is worth
SEED_FROM=5001 node tools/selfplay.mjs      any of them, on held-out seeds
```

Every match is mirrored — the same deal played from both sides — because an
unmirrored win rate mostly measures who was dealt the assi. The harness prints
its own noise floor; treat a difference smaller than that as nothing.

## 6. The layout

The card size is a budget with two terms, and `--cw` is the smaller of them:

```
height:  (100dvh − --chrome) / --rows / --ratio
width:   (table width − 2 × --pad-inline) / (1 + 9 × --overlap)
```

`--rows` is 3 in landscape and 4 in portrait. **`--chrome` is derived from the
spacing tokens beside it and is never hand-set** — every term of it, including
the name plates, whose type is expressed in `vw` and which cost 120px on a
770px-wide screen against a hard-coded 76px that had been there since the fork.

A hand of ten cannot sit side by side on a phone, so it is a **fan**: each card
after the first shows a strip of `--cw × --overlap`. A strip is not a tap
target, so a tap raises a card — it lifts 40% of its own height, clear of the
fan, and the line above the hand says what the next tap will do — and a second
tap plays it. Empty slots are `pointer-events: none`, because the hand keeps its
holes all deal and an empty slot sitting on top of a card swallowed every tap
meant for it.

Anything that takes vertical space on the table is in the budget and is in the
flow whether or not it has anything in it. Anything that cannot be budgeted —
a declaration can run to three lines — floats over the table instead.

## 7. The checks

```sh
node --test 'tools/**/*.test.mjs'   46 tests, no dependencies
node tools/check_ui.mjs             111 rows, needs playwright-core + Chromium
```

Both run in CI on every pull request; a red check does not merge.

The UI check has four passes: the **document** (four head tags that cannot be
layout assertions), the **screens** (every screen and every state worth looking
at, at five device shapes, every opponent included), the **table** (19
viewports × 5 decks, then the tightest five again with the spacing tokens
inflated), and a **deal** — twenty cards tapped through the fan, a result, a
history entry, and a second deal abandoned through the confirm. `.claude/skills/ui-check/SKILL.md` explains what
each threshold is calibrated against.

**Every threshold in it was calibrated against a defect that actually shipped.**
Change one only after running the check against the commit that introduced the
bug it names, and confirming it still fails there.

## 8. Persistence

`localStorage`, wrapped in try/catch, never leaving the device.

| key | shape |
|---|---|
| `tressette.settings` | `{opponent, deck, felt, speed, showPoints, sound}` |
| `tressette.history` | `[{t, o, d, y, a}, …]` newest first, capped at 100 |

Everything read back out is validated, because what comes out of storage is not
necessarily what this build wrote: one entry of another shape took the history
sheet down along with the button that clears it.

Nothing in progress is saved. A deal abandoned or reloaded is gone, as in
Discola.

## 9. What this project learned, which is most of its value

Six rules, each bought by a review finding something that was green and wrong.
They are in `PLAN.md` beside the iteration that paid for them, and they are the
part worth carrying to another project:

1. **Break the thing an assertion protects and watch it fail, or it is
   decoration.** 31 deliberate breaks in iteration 1, 30 caught.
2. **A position or a page state built by hand to be convenient is built to be
   wrong in the way that matters.** Four tests in three iterations were written
   against positions where their own bug could not appear.
3. **An assertion only ever sees the states the check renders.** Iteration 3
   shipped a trick that was never drawn, a declaration cut in half, and a name
   plate below the fold, with every assertion green — because nothing ever put
   the page into those states. Adding the state is the harder half of adding
   the assertion.
4. **An assertion that waits, or that looks after the page has had a chance to
   put itself right, passes on the defect it was written for.** Two assertions
   written *with* their fixes did exactly that.
5. **A measured number and a remembered one look the same in a comment.**
   Iteration 5 concluded that character costs a point of win rate per percent
   of plays changed, from a ladder that had never priced one of the two weights
   that matter. Every figure not followed by how it was obtained is a claim.
6. **A fix can orphan a measurement.** Warming `rngSeed` changed which deals
   seeds 5001+ produce, and every number measured before it silently stopped
   reproducing from the command printed beside it — including the table the
   round turned on. A change to an rng is a change to the code that produced
   every measurement.

## 10. Known gaps

- **A deal in progress is not saved.** Reload and it is gone.
- **The opponent's search is exact but not fast**: the first searched decision
  is a median 28ms and a p95 of 64ms. Alpha-beta and `CODA_FROM = 12` is the
  named next move, and it would need the late weights re-measured.
- **Piero's variety is thinner than his name promises.** Four of his eleven
  weights are drawn from bands narrow enough that he cannot roll into another
  player's game, and most of the seven drawn wide barely move a play. The
  bands cost him about two points of win rate; without them one roll in eight
  is Franco under another name, so the trade is deliberate and priced.
- **Seven of the eleven weights move almost nothing.** `DISCARD_GUARD_PENALTY`
  moves 2 choices in 3,437 at one end of its range and none at all at the
  other. They are disclosed in the settings sheet because they are what the
  opponent is made of, not because they all do something.
- **No four-player Tressette, no match to 21, no online play.** §5 of `PLAN.md`
  says why each is out of scope.
- **The UI check needs a browser**, so it is the one thing in the repository
  with a dependency.

## 11. Provenance

The card images are the original 1997 bitmaps from the Delphi 3 Discola, copied
byte for byte from `diegoami/discola-web`, which packed them from the BMPs in
`diegoami/briscola-JS`. Do not redraw them. `tools/pack_cards.py` is carried
over in case a deck is ever repacked.

The page and its stylesheet are forked from Discola at `22c4b9c` and changed
where a ten-card fan and a trumpless game needed something different. The
opponent is this game's own: there was no 1997 Tressette to transcribe, which
is §0's first decision and the reason the formula had to be designed and tuned
here.
