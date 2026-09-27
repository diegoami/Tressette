# Tressette

A two-player Tressette a due for the browser, in the spirit of
[Discola](https://github.com/diegoami/discola-web): one static page, no build
step, the 1997 card art, a table lit from above, four named opponents who share
one formula and differ only in their weights, and a UI check calibrated against
the defects that actually ship. `public/index.html` (the view) plus
`public/engine.js` (the rules and the opponent, loaded as a classic script so
`file://` still works).

This is the one instructions file, for every tool. `CLAUDE.md` only imports it.
`PLAN.md` is the architecture and the plan, the record of how the project got
here; `SPEC.md` is the handover. [Discola](https://github.com/diegoami/discola-web)
is the reference for everything those two do not state; clone it beside this
repository if it is not already there.

## How work flows

- **Propose first, when it is more than a fix.** Open an issue with the problem,
  the findings with `file:line` references, the design and the open questions,
  and get the owner's agreement before implementing. A small fix or a
  documentation change goes straight to a PR.
- **Branch from a fresh `origin/main`** (`git fetch origin` first), open a PR
  that references the issue, and verify it against the agreed design with the
  gates green (*Verification*). The owner merges. Say in the PR what was built,
  how it was checked, and what was left out.
- **After the owner merges**: in the main checkout,
  `git switch main && git pull --ff-only`, then `git branch -d <branch>`.
  Delete the remote branch too, unless GitHub already did.
- **Worktrees are ad hoc**, only to work in parallel with another session. Make
  one with
  `git worktree add --no-track -b <branch> <main>/../Tressette-work/<branch> origin/main`,
  install the dependencies in it as the project's setup says (`npm ci`, then
  `npm run setup` if Chromium is missing), and never copy or link
  `node_modules`. On Windows, nested paths need
  `git config --global core.longpaths true`, which the owner sets. Remove the
  worktree after the merge.
- **No per-PR and no per-design review.** The independent review runs once per
  release, below.
- **Commit messages**: one line saying what changed and why, English, imperative
  mood, no ticket numbers. The PR title becomes that line when it is
  squash-merged.

## Releases

A release is an annotated tag `vX.Y.Z` on `main`, on the exact commit the
published binaries are built from. Binaries go to
`diegoami/tressette-releases`, the tag stays here, and
`tools/publish_release.mjs` refuses anything else. Nothing but a release is a
milestone: not a PR, a run of PRs, a change to a file, or a process change.

1. **Open `Milestone vX.Y.Z`**, labelled `milestone`: the candidate SHA on
   `main`, the previous milestone tag, the PRs merged since, and the gate
   results on the candidate — `npm test`, `node tools/check_ui.mjs`, and
   `node tools/package_release.mjs --candidate`, which stages
   `dist-release/candidate-<sha>/` for the device checks and is never published.
   The `review-handoff` skill fills the issue in.
2. **Get an independent review before the tag.** A model that implemented none
   of the release reviews `<previous tag>..<candidate>` in a fresh session. The
   owner starts it on a model they pick, with
   `opencode run -m <provider/model> --command review-release <issue>`; in the
   TUI, `/new`, a model picked with `/models`, then `/review-release <issue>`.
   Neither the command nor the agent sets a model, so the one picked here is the
   one used. The reviewer follows `.opencode/agents/release-reviewer.md`: it
   opens one issue per reproduced finding and posts one verdict comment. On
   BLOCK, fix the findings in ordinary PRs, move the candidate, rerun the gates
   there and review again; after three rounds without AGREE, the owner decides.
   The owner may also tag without a review, and the issue records it.
3. **The device checks** (`ANDROID.md` §6) run on the candidate build before the
   tag.
4. **After AGREE**, create the annotated tag on exactly the reviewed SHA, push
   it, build from the tag (`ANDROID.md` §4), and publish on the owner's
   go-ahead. Work merged after the candidate waits for the next release.

When a review is in, reproduce each finding before acting on it, and say on its
issue whether it is confirmed, not reproduced, or disputed. A confirmed finding
is fixed in a PR that closes its issue; a disputed one goes to the owner, in its
issue.

## Principles

- Reproduce every finding before acting, and your own claims before publishing
  them. When a check fails, suspect your harness first.
- For each passing check, say what it would have caught had the code been
  wrong — never let implementer and reviewer share a blind spot.
- A passing test is not a working feature: assert what a person would notice.
- A threshold from one measurement is a coin toss.
- Flag out-of-scope defects rather than fixing them silently.
- Change the smallest thing: targeted reads and focused edits, and show diffs,
  not whole files.

## Verification

The two gates, and what CI runs:

| gate | local | CI |
|---|---|---|
| unit tests | `npm test` | `node --test 'tools/**/*.test.mjs'` (`.github/workflows/check.yml:36`) |
| UI check | `node tools/check_ui.mjs` | `npm run check` (`.github/workflows/check.yml:52`) |

The full suite is both gates. Run it three times before pushing anything that
touches the primary logic — the engine and the opponent — and read the pass
count, not the absence of a FAIL. Both jobs run on every pull request and every
push to `main`, and a red one does not merge.

**After any UI change, run `node tools/check_ui.mjs`.** It is not optional, and
not only when something looks wrong. Every UI defect Discola shipped was
invisible in the diff and threw no error: cards overlapping the hand, the
player's own hand pushed below the fold, the table drifting apart until it
stopped reading as one surface, body copy at 12.5px, and every screen rendering
at once behind a click-eating overlay. This game forks that table, so it
inherits every one of those ways to fail, plus the fan's own. Reading the diff
catches none of them; the check catches each one it has a row for.

That last clause is the whole of it. **An assertion only sees the states the
check renders.** Iteration 3 shipped a table where a finished trick was never
drawn, a declaration was cut in half at every phone width, and the player's own
name plate hung below the fold — with every assertion green, because no pass
ever rendered a finished trick, an announcement, or measured anything below the
cards. When the page gains a state, the check gains the row that puts it there,
and that is the harder half of the work. The `ui-check` skill explains what it
covers and how to read a failure.

**After any engine change, run `npm test`.** It is deterministic — the shuffle
and Piero's roll both arrive as a seeded `rng` — and covers what the UI check
cannot see: the rank order, `prende` with no trump, the eleven points every deal
scores, the trap positions, the search that refuses a position it cannot deduce,
and the golden fixture's sixty frozen deals. They live in
`tools/engine.test.mjs` and `tools/opponent.test.mjs`.

This rule is not optional for the same reason the UI one is not. The golden
fixture freezes the plays: a formula change moves them by accident and the test
says so, and a weight change moves them deliberately and the fixture is
re-recorded in the same commit — `node tools/selfplay.mjs --golden >
tools/golden.json` (§3 of `SPEC.md`).

## What to read

Normally inspect: `public/index.html`, `public/engine.js`, `tools/*`, the root
`*.md`, `.github/workflows/*`, `.claude/skills/*`, `.opencode/*`. Normally ignore
`node_modules/`, `.git/`, `public/decks/`, `public/fonts/`, `public/icons/`,
`assets/`, `dist-release/`, Gradle wrapper files, `desktop/src-tauri/target/`,
`desktop/src-tauri/icons/`, and any binary. Read `package-lock.json` and
`desktop/src-tauri/Cargo.lock` only when dependencies are the task, and open
files under `mobile/android/` individually instead of walking the tree.
Ignoring a path does not mean it should be deleted or gitignored.

Never read or paste `mobile/android/keystore.properties` or `*.jks`.

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
four opponents play those seven tricks alike, which is also why those decisions
are not in the denominator when the roster is measured for difference: there is
nothing there for a weight to change. A weight that cannot move a play does not
belong in the eleven.

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

**And each probe is in the language it is probing.** The first version of that
row asked whether the text said `/undici|eleven/` and `/3, 2, (asso|ace)/`,
which reads like thoroughness and is the opposite: a page whose English half was
the Italian text under an `en` tag passed every one of them, because every one
of them matched the Italian. That is the exact defect the row exists to catch,
and the row could not catch it. A probe that accepts either language cannot tell
the two apart, so the table is per language, and `napoletana` — the same word in
both — is never the only thing asked.

## Conventions

- Player-facing text is Italian. The about screen says the *rules* twice, once
  per language; its heading, its Back button and its footer line are Italian
  like everything else. Comments, commit messages and documents are English.
- No build step and no runtime dependencies. Nothing under `public/` imports
  anything, and the page opens from a folder. `playwright-core` is a dev
  dependency of the UI check, pinned in `package.json` so CI and a local run
  measure the page with the same browser; `node_modules` stays gitignored.
  `mobile/` and `desktop/` are packaging tooling and not part of the game.
- Nothing the page loads comes from the network. The fonts are the subset in
  `public/fonts/`, and the check's `fonts` pass asserts that no subresource is
  fetched from outside — the Google Fonts link it replaced set the wordmark 12%
  narrower whenever it failed to load, silently, and made "nothing leaves the
  device" untrue.
- The card art is the original 1997 bitmaps, copied byte for byte from Discola.
  Do not redraw it and do not repack it. `tools/pack_cards.py` is carried over
  in case a deck is ever repacked, from the BMPs in `diegoami/briscola-JS`. The
  sixth deck, Bresciane, is not 1997 art and says so wherever it is named;
  `tools/import_bresciane.mjs` records where it comes from. The icon is a crop
  of the Napoletane sheet, nearest-neighbour scaled by `tools/make_icons.mjs`,
  because interpolation is redrawing by another name.
- Write every GitHub issue or comment body to a file as UTF-8 without a
  byte-order mark, and pass it with `--body-file`. Sign a post with its role and
  the model that wrote it.
