# Tressette

A two-player Tressette game for the browser, built in the spirit of
[Discola](https://github.com/diegoami/discola-web): one static page, no build
step, the 1997 card art, one opponent formula with four weight vectors.

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
fan's own. Reading the diff catches none of them; the check catches all of
them.

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

Anything that appears on the table while a deal is running — the line that
names the raised card, a declaration — is in the budget too, and is in the flow
whether or not it has something to say. A row that costs nothing while empty
moves every card below it the moment it fills.

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
and belongs in the source with its reason: for the last two tricks, where the
opponent's information is already perfect, `compGioca` enumerates the position
and plays it out exactly. All four opponents play those two tricks alike. A
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
