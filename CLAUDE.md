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

## Read this much, and no more

Normally inspect: `public/index.html`, `public/engine.js`, `tools/*`, the root
`*.md`, `.github/workflows/*`, `.claude/skills/*`.

Normally ignore: `node_modules/`, `.git/`, `public/decks/`, `public/fonts/`,
`public/icons/`, `assets/`, `dist-release/`, Gradle wrapper files, and any
binary. Read `package-lock.json` only when dependencies are the task, and open
files under `mobile/android/` individually instead of walking the tree.

Never read or paste `mobile/android/keystore.properties` or `*.jks`.

Ignoring a path here does not mean it should be deleted or gitignored.

## Change the smallest thing

Prefer targeted reads and diffs to repeating whole files: search first, then
read the range you need, and show changes as a diff (`git diff -- <path>`,
`git show HEAD:<path>`) rather than reprinting a file. Make edits with focused
replacements instead of rewriting a file to change a few lines.

## Keep command output short

Prefer the repository's own commands over ad-hoc exploration, and cap their
output. On PowerShell:

```powershell
npm test 2>&1 | Select-Object -Last 20
npm run check 2>&1 | Select-Object -Last 40
node tools/selfplay.mjs 2>&1 | Select-Object -Last 20
gh pr view <n> --json title,state --jq .
```

On bash, `| tail -40` instead of `Select-Object -Last 40`. Use `node --check
<file>` for a syntax check instead of running a script, and scope file searches
to source directories rather than searching from the repository root.

## Sessions and handoff

Start a fresh session after a completed logical unit — a merged PR, a finished
fix, a documentation pass — or when a thread has grown long. Carry forward a
short handoff:

- **Completed:** what is now true (and any verification that ran).
- **Files / decisions:** the paths touched and the decisions made, with reasons.
- **Next:** the next task, or "nothing open".

Durable facts belong in the repository (this file, the docs, the PR body), not
in the conversation.

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

## After any engine change, run the unit tests

```sh
npm test
```

They are deterministic — the shuffle and Piero's roll both arrive as a seeded
rng — and they cover what the UI check cannot see: the rank order, `prende` with
no trump, the eleven points every deal scores, the trap positions, the search
that refuses a position it cannot deduce, and the golden fixture's sixty frozen
deals. They live in `tools/engine.test.mjs` and `tools/opponent.test.mjs`.

This rule is not optional for the same reason the UI one is not. The golden
fixture freezes the plays: a formula change moves them by accident and the test
says so, and a weight change moves them deliberately and the fixture is
re-recorded in the same commit — `node tools/selfplay.mjs --golden >
tools/golden.json` (§3 of `SPEC.md`). `npm test` and `node tools/check_ui.mjs`
are the two jobs in `.github/workflows/check.yml`, on every pull request and
every push to `main`, and a red one does not merge.

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
four opponents play those seven tricks alike, which is also why those
decisions are not in the denominator when the roster is measured for
difference: there is nothing there for a weight to change. A
weight that cannot move a play does not belong in the eleven.

Piero's weights are rolled once per session, as in Discola, where `SetProfiles`
ran from `FormCreate`. It is a house tradition now, not a Delphi accident.

## The about screen says the rules, and says them twice

It is the one screen here that is *read* rather than glanced at, and it carries
the rules in Italian and in English — `RULES.md` and `REGOLE.md` are the long
form, this is the short one, and the two are not independent: a rule stated
twice in two places drifts, so a change to one is a change to both.

Each language is a `section[lang]`, and that is not decoration. "The rules are
in both languages" asserted as *a `lang` attribute exists somewhere* passes a
page whose English paragraphs are tagged Italian, which is what a screen reader
and a hyphenator would then go by. The check measures each section on its own —
enough blocks and enough words to be the rules rather than a note, and the four
things a tressette player has to be told — and it clicks Back, because a Back
that always lands on the start sheet abandons the hand of anyone who opened the
rules mid-deal to check what a napoletana is worth.

**And each probe is in the language it is probing.** The first version of this
row asked whether the text said `/undici|eleven/` and `/3, 2, (asso|ace)/`,
which reads like thoroughness and is the opposite: a page whose English half
was the Italian text under an `en` tag passed every one of them, because every
one of them matched the Italian. That is the exact defect the row exists to
catch, and the row could not catch it. A probe that accepts either language
cannot tell the two apart, so the table is per language, and `napoletana` — the
same word in both — is never the only thing asked.

## Conventions

- Player-facing text is Italian. The about screen says the *rules* twice, once
  per language; its heading, its Back button and its footer line are Italian
  like everything else. Comments, commit messages and documents are English.
- No build step and no runtime dependencies. Nothing under `public/` imports
  anything, and the page opens from a folder. `playwright-core` is a dev
  dependency of the UI check, pinned in `package.json` so CI and a local run
  measure the page with the same browser; `node_modules` stays gitignored.
  `mobile/` is packaging tooling and is not part of the game.
- Nothing the page loads comes from the network. The fonts are the subset in
  `public/fonts/`, and the check's `fonts` pass asserts that no subresource is
  fetched from outside — the Google Fonts link it replaced set the wordmark 12%
  narrower whenever it failed to load, silently, and made "nothing leaves the
  device" untrue.
- The card art is the original 1997 bitmaps, copied byte for byte from Discola.
  Do not redraw it and do not repack it. `tools/pack_cards.py` is carried over
  in case a deck is ever repacked, from the BMPs in `diegoami/briscola-JS`.
  The sixth deck, Bresciane, is not 1997 art and says so wherever it is named;
  `tools/import_bresciane.mjs` records where it comes from. The icon is a crop
  of the Napoletane sheet, nearest-neighbour scaled by `tools/make_icons.mjs`,
  because interpolation is redrawing by another name.
