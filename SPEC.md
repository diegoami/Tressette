# Tressette — what was built, and why it is the way it is

The handover document. `PLAN.md` was the plan and is kept as the record of how
the project got here, including what it got wrong; this file describes the
thing that exists, and is what a stranger taking the project over should read
first.

The game is live at **<https://tresettette.netlify.app>** — the Netlify site
linked to `main`, which publishes `public/` and nothing else. That URL is not
reachable from the container the work is done in (the network policy denies
it), so nothing in the repository asserts that it serves; see §7 of `PLAN.md`.

---

## 1. What it is

A two-player Tressette a due for the browser: one static page, no build step, no
runtime dependencies, the 1997 card art from
[Discola](https://github.com/diegoami/discola-web) in five decks, plus an
imported sixth (§10, §11). Nothing it draws with comes from the network. You
against one of four opponents, one deal at a time, everything kept in the
browser.

Player-facing text is Italian. Comments, commit messages and documents are
English.

## 2. The repository

```
public/index.html    the whole page: styles, markup, and the code that
                     renders a state object and turns taps into calls
public/engine.js     the rules and the opponent, as functions over one
                     mutable state object and nothing else
public/decks/        six sprite sheets: five are the original 1997 bitmaps,
                     the sixth (Bresciane) is an imported scan, §10
public/fonts/        Bodoni Moda and Barlow, latin subset, ~0.2 MB
public/icons/        the tre di coppe, for the tab and the home screen
assets/              the same icon at 1024, for @capacitor/assets
tools/engine.test.mjs    the rules, on node --test
tools/opponent.test.mjs  the trap positions, the roster, the golden fixture
tools/selfplay.mjs       the harness every number in this file came from
tools/golden.json        sixty frozen deals and four weight vectors
tools/check_ui.mjs       the UI check: five passes, 114 rows
tools/serve.mjs          public/ over http, standard library only
tools/make_icons.mjs     cuts the icon out of the Napoletane sheet
tools/import_bresciane.mjs  builds the sixth deck from its source repo
tools/package_release.mjs   signed APK into dist-release/
tools/publish_release.mjs   that APK to the releases repo, on --confirm
tools/pack_cards.py      carried from Discola, for repacking a deck
mobile/              the Capacitor wrapper and the Android project
.github/workflows/check.yml  the two CI jobs: the tests, and the UI check
netlify.toml         publish public/, cache the decks hard, never the page
package.json         scripts, and playwright-core as the one dev dependency
RULES.md / REGOLE.md the rules as this game plays them, English and Italian
PLAN.md              the plan and the record, iteration by iteration
ANDROID.md           the APK: what is done, what is left, and whose
CLAUDE.md            the four rules a builder has to follow
```

Nothing is generated at build time and nothing under `public/` imports
anything: the page opens from a folder, and every byte it draws with sits
beside it. `playwright-core` and a Chromium are needed only to run the UI
check; `npm run setup` installs them and `node_modules` is gitignored.

## 3. The engine contract

`public/engine.js` is a classic script. It touches no `document`, no `window`,
no timer and no `Math.random`, which is what lets Node run the very same file
the browser runs — `vm.runInThisContext` — and that is what makes the tests, the
self-play harness and the golden fixture possible at all. Randomness arrives as
an injected `rng`, `rollProfiles(rng)` included.

Every function here is a function of the state object it is handed and
nothing else — no module-level mutable state, no globals, no clock. They
*mutate* that object rather than returning a new one (`newDeal`, `pesca` and
`gioca` all do; §3.3 of `PLAN.md` chose one mutable object, as in Discola), so
a caller that wants the old state copies it first. The page owns the timers,
the DOM and `Math.random`.

```
newDeal(state, rng)        shuffle, ten each, non-dealer leads
mosseLegali(hand, led)     slot indices; follow suit if you can
ordinaMano(hand)           slot indices in the order a hand is held
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

It has been re-recorded once since v1.0, for issue #21: `voids` claimed a
certainty that a draw had already expired — 72% of the leads that scored on one
were stale — and the term is now scaled by the chance the void survived the
draws since. Three 800-deal matches decided the shape of the fix over the one
the issue proposed, and PLAN.md's "the void that had stopped being true" holds
the numbers. That is the bar for moving the formula again: measured against
what it replaces, decided by the owner, and the fixture re-recorded in the
commit that moves it.

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

Playing those tricks exactly rather than scoring them is worth **about seven
points** of win rate (§1 of `PLAN.md`, measured on the formula with the search
switched off). Thirteen is a budget rather than a principle: `CODA_FROM = 11`
is worth **four points more** — 89.2% against greedy-take where thirteen is
85.0% — and costs about twenty-seven times the time, a median 767ms and a worst
case of 1,906ms against thirteen's 28ms median and 66ms worst on the first
searched decision (`PLAN.md` §3.4 records the run). Thirteen declines those
four points to keep the worst case near 70ms rather than near two seconds.
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
twenty rolls — `SEED_FROM=90001 node tools/selfplay.mjs --piero 8 500` and
`node tools/selfplay.mjs --piero 12 400`, on deliberately different seed
ranges — ran
80.5–85.2% against greedy-take and 18.9–24.3% away from Franco, with five of
the twelve falling into two groups identical to the decimal.

The four bands cost him about two points against greedy-take, and buy the
corner: with all eleven drawn wide, one roll in eight comes out 5.6% from
Franco — Franco under another name, which is what retired the name Valerio the
first time.

### Changing it safely

The eleven weights, in the order the settings sheet discloses them:

```
LEAD_SURE_BONUS   LEAD_LISCIO_BONUS   LEAD_LONG_SUIT   LEAD_ACE_EXPOSED_PENALTY
LEAD_CONTROL_PENALTY   LEAD_INTO_VOID_PENALTY   TAKE_TERZI_WEIGHT
GIVE_TERZI_WEIGHT   SPEND_CONTROL_PENALTY   DISCARD_GUARD_PENALTY   LATE_FACTOR
```

**The scoring formula itself is §3.4 of `PLAN.md`**, written out term by term,
and the comments in `engine.js` beside each vector say what that vector is for.
Four traps are recorded there and will not be guessed at:

- **`LATE_FACTOR` multiplies the four control terms only**, never the point
  terms. The asymmetry looks like an oversight and is not: `compGioca` takes
  the argmax within a branch, so a factor applied to a whole branch changes
  nothing, and "fixing" it into symmetry makes the weight inert while
  invalidating the fixture.
- **Ties go to the lowest slot**, deterministically. Nothing in the scoring may
  reach for an rng: that tie-break is part of what makes the golden fixture a
  fixture.
- **The endgame search refuses positions it cannot deduce.** If the cards it
  believes outstanding do not come to a hand the size of the one held, it falls
  back to the formula rather than answering from a deck that does not add up.
- **Four entries of `PIERO_RANGES` are dead** — `PIERO_STANCE` overrides them
  — and they are kept rather than deleted because `rollPiero` maps the array
  onto `WEIGHT_KEYS` *by index*, so removing one silently shifts every weight
  after it. They are marked `†` in the source.

Seven of the eleven move almost nothing at any magnitude, which is measured
rather than asserted: `node tools/selfplay.mjs --ladder KEY v1,v2,v3`.

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
tap plays it.

**A hand is held sorted** — by suit, and within a suit from the strongest card
down — and therefore closes up: the fan shows the cards in the hand and nothing
else. The engine does not do the sorting and must not be made to. A slot is a
card's identity there (`mosseLegali` answers in slots, `gioca` takes one,
`compGioca` breaks ties on the lowest), so reordering `hands` would change the
opponent's play in every deal and invalidate the golden fixture. `ordinaMano`
returns the fan's order as slot indices and mutates nothing, and the page is
its only caller — `render`, and the keydown handler that turns a number key
into a place in the fan.

So a card element is a **place in the fan**, not a card. It carries the engine
slot in `data-slot` and reads it on the click rather than closing over its
build index, and the number keys count places — `1` is the leftmost card you
hold, and a hand of six has no `7`. Empty slots are still
`pointer-events: none`: no hand has holes any more, but the two slots on the
table wear the same state, and the defect the rule names (issue #7 — a
card-shaped box overlapping the card to its left, swallowing every tap aimed at
the part it covers) is a property of the fan's negative margins rather than of
the holes that used to sit in them.

Anything that takes vertical space on the table is in the budget and is in the
flow whether or not it has anything in it. Anything that cannot be budgeted —
a declaration can run to three lines — floats over the table instead.

## 7. The checks

```sh
npm test                            47 tests, no dependencies
npm run check                       114 rows, needs playwright-core + Chromium
```

Both run in CI on every pull request; a red check does not merge.

The UI check has five passes: the **document** (the four facts a layout
assertion cannot reach — the viewport meta, the doctype, the charset and
`<html lang>`), the **fonts** (every character on the page is inside the
shipped subset, every `@font-face` loads with the network cut off, and no
subresource comes from outside), the **screens** (every screen and every state
worth looking at, at five device shapes, every opponent included), the
**table** (19 viewports × 6 decks, then the tightest five again with the
spacing tokens inflated), and a **deal** — twenty cards tapped through the fan,
a result, a history entry, and a second deal abandoned through the confirm.
`.claude/skills/ui-check/SKILL.md` explains what each threshold is calibrated
against.

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

Seven rules, each bought by a review, or a break, finding something that was
green and wrong.
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
7. **A pass that drives the page has to leave it as it found it.** The
   assertion added for the sorted hand pressed a key and left the card raised;
   the tap that followed landed on a card the page thought was already chosen,
   and the next assertion found the raised card in front of the one it was
   aiming at. It failed on some deals and not others, on identical code.

## 10. Known gaps

- **A deal in progress is not saved.** Reload and it is gone.
- **The opponent's search is exact but not fast**: the first searched decision
  is a median 28ms and a worst case of 66ms. Alpha-beta and `CODA_FROM = 12`
  is the named next move, and it would need the late weights re-measured.
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
- **Every deck sheet loads on the start screen**, because the picker previews
  all of them. Adding a deck grows that eager load; the Bresciane JPEG adds
  ~0.6 MB. Lazy-loading the previews is the fix if it ever bites.
- **The Bresciane deck is not cleanly licensed.** It is a scan of a commercial
  Dal Negro deck — the same copyright grey area as the original art, a
  deliberate choice, documented in the README and in the import script.
- **The APK is live, and has been installed once, at v1.0.0.** v1.0.0, v1.0.1
  and v1.0.2 are published at `diegoami/tressette-releases`, signed and
  checksummed; the owner sideloaded v1.0.0 and played a hand. The device-only
  questions that remain — whether the `http://localhost` origin Capacitor
  serves the page over loads as a page rather than a blank screen, and whether
  `android.permission.INTERNET` can be dropped — are in `ANDROID.md` §6 and
  §7, which is the release-status source of truth.

## 11. Provenance

The card images are the original 1997 bitmaps from the Delphi 3 Discola, copied
byte for byte from `diegoami/discola-web`, which packed them from the BMPs in
`diegoami/briscola-JS`. Do not redraw them. `tools/pack_cards.py` is carried
over in case a deck is ever repacked.

The sixth deck is not 1997 art: `tools/import_bresciane.mjs` composes it from
[`mhamilt/Italian-decks`](https://github.com/mhamilt/Italian-decks), whose
images are a scan of a commercial Teodomiro Dal Negro deck. The app icon is a
crop of the Napoletane sheet, nearest-neighbour scaled by
`tools/make_icons.mjs`, so every pixel of it is still a 1997 pixel.

The typefaces are Bodoni Moda and Barlow (SIL Open Font License), subset to
latin and served from `public/fonts/`.

The page and its stylesheet are forked from Discola at `22c4b9c` and changed
where a ten-card fan and a trumpless game needed something different. The
fonts, the dev server, the release scripts, the Capacitor wrapper and the sixth
deck were adopted from Discola at `5307c14`, after it diverged — issue #15. The
opponent is this game's own: there was no 1997 Tressette to transcribe, which
is §0's first decision and the reason the formula had to be designed and tuned
here.
