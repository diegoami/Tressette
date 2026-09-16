# Tressette

A two-player Tressette game for the browser, built in the spirit of
[Discola](https://github.com/diegoami/discola-web): one static page, no build
step, the 1997 card art, one opponent formula with three weight vectors.

`PLAN.md` is the architecture and the plan, and it is the reference for
anything this file does not state. Section 7 says how the work is organised:
one iteration per session, a fresh-context review per pull request, CI on every
pull request. Section 0 lists the decisions already made and the two still
open. Discola is the reference for everything the plan does not state either;
clone it beside this repo if it is not already there.

## After any UI change, run the UI check

```sh
node tools/check_ui.mjs
```

Not optional, and not only when something looks wrong. It runs in CI on every
pull request as well, and a red check does not merge.

Every UI defect Discola shipped was invisible in the diff and threw no error:
cards overlapping the hand, the player's own hand pushed below the fold, the
table drifting apart until it stopped reading as one surface, body copy at
12.5px, and every screen rendering at once behind a click-eating overlay. This
game forks that table, so it inherits every one of those ways to fail, plus the
fan's own. Reading the diff catches none of them; the check catches each one it
has a row for.

That last clause is the whole of it. **An assertion only sees the states the
check renders.** Iteration 3 shipped a table where a finished trick was never
drawn, a declaration was cut in half at every phone width, and your own name
plate hung below the fold — with every assertion green, because no pass ever
rendered a finished trick, an announcement, or measured anything below your
cards. When the page gains a state, the check gains the row that puts it there,
and that is the harder half of the work.

The `ui-check` skill explains what it covers and how to read a failure.

## The card size is a budget, and it has two terms

Discola's budget was height alone. A hand of ten cards adds a width term, and
`--cw` is the smaller of the two:

```
height:  (100dvh − --chrome) / --rows / --ratio
width:   (table width − 2 × --pad-inline) / (1 + 9 × --overlap)
```

`--chrome` is **derived** from the spacing tokens next to it — never hard-code
it. It was hand-estimated three times in Discola and wrong three times,
silently, because a card too tall for its row does not error, it just lands on
the hand below. `--rows` is 3 in landscape and 4 in portrait.

The width term is this project's own way to fail silently: ten cards do not fit
side by side on a phone, so the hand is a fan, each card showing a strip of
`--cw × --overlap`. A strip too narrow to touch does not error either — it just
makes a card unreachable, and a misplay costs the deal. That is why a tap
raises a card and a second tap plays it, and why the fan assertions in §3.7 of
`PLAN.md` are written against a broken fan before the good one.

Anything that takes vertical space on the table is in the budget, and is in the
flow whether or not it has something in it: the line that names the raised card
costs `--say` whether or not a card is raised, because a row that costs nothing
while empty moves every card below it the moment it fills. Anything that cannot
be budgeted — a declaration is a sentence, and three of them at once is three
lines — does not go in the flow at all; it floats over the table and out of the
budget.

**Every term of `--chrome` is derived, including the ones that look like
constants.** `--plates` was 76px, forked from Discola, against two name plates
that cost 120px on a 770px-wide screen, because their type is expressed in vw —
and the player's own plate hung below the fold while the check said `pass`. A
number in that block is a defect waiting for the screen that disagrees with it.

## The engine is ours, and then it is frozen

`engine.js` holds the rules and the opponent as pure functions over a plain
state object. Nothing in it touches `document`, `window`, timers or
`Math.random` — that is what lets Node run the same file as the browser, which
is what makes the self-play harness and the golden fixture possible. Randomness
arrives as an injectable `rng`, `rollProfiles(rng)` included.

Discola's engine was a transcription of a 1997 original, so its rule was
*change a weight, not the formula*. Here the formula is ours until v1.0 — and
from v1.0 the same rule applies for a different reason: the golden fixture
freezes the plays, and a formula change invalidates it. There are **eleven**
weights, and the settings sheet discloses eleven; a twelfth is not invented to
match Discola's count.

One exception to "score every legal card and play the highest" is deliberate
and belongs in the source with its reason: from `CODA_FROM` on — the last seven
tricks, where the tallone is empty and the opponent's information is already
perfect — `compGioca` enumerates the position and plays it out exactly. All
three opponents play those seven tricks alike, which is also why those
decisions are not in the denominator when the roster is measured for
difference: there is nothing there for a weight to change. A
weight that cannot move a play does not belong in the eleven.

Piero's weights are rolled once per session, as in Discola, where `SetProfiles`
ran from `FormCreate`. It is a house tradition now, not a Delphi accident.

## Conventions

- Player-facing text is Italian. Comments, commit messages and documents are
  English.
- No build step and no runtime dependencies. `playwright-core` is for the UI
  check only and is gitignored.
- The card art is the original 1997 bitmaps, copied byte for byte from Discola.
  Do not redraw it and do not repack it. `tools/pack_cards.py` is carried over
  in case a deck is ever repacked, from the BMPs in `diegoami/briscola-JS`.
