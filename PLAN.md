# Tressette — architecture and plan

A two-player Tressette game for the browser, in the spirit of
[Discola](https://github.com/diegoami/discola-web): one static page, no build
step, the 1997 card art, a table lit from above, four named opponents who
share one formula and differ only in their weights, and a UI check calibrated
against the defects that actually ship.

**Status: nothing is built.** This document is the plan. It becomes `SPEC.md`
once the game exists, the way Discola's did.

---

## 0. Decisions that are the owner's to make

Each has a default so the plan is complete without waiting. Change any of them
and the sections below say what moves.

| # | Decision | Default in this plan | What it changes |
|---|---|---|---|
| 1 | Is there a 1997 original to transcribe? | **No.** No Tressette source exists among the repos; the opponent is designed here and tuned by self-play. | If one exists, §3.3 becomes a transcription and the fidelity contract in §1 applies to it, exactly as in Discola. |
| 2 | Two players with a stock, or four with partners? | **Two players, with the tallone** (Tressette a due). Same table shape as Discola: you at the bottom, them at the top. | Four-player is a different game: partners, signalling, three opponents to render. See §5. |
| 3 | What is a *partita*? | **One deal, as in Discola.** Twenty tricks, 11 points plus declarations, the higher total wins. Chosen by the owner. | The traditional match to 21 across deals would add a running score, a second result dialog and a match saved between deals. The engine's `scoreDeal` is where it would plug in; see §5. |
| 4 | Declarations (*accusi*)? | **Yes, from the ten cards dealt, declared automatically when the first card is played.** | Off would remove one dialog and one scoring branch; declaring completed-by-draw sets would add state. |
| 5 | The opponents | **The same four names — Valerio, Graziano, Piero, Franco — with Tressette temperaments.** | New names cost nothing technically; the four are kept because they are the house. |
| 6 | Where the engine lives | **`engine.js`, a classic script beside `index.html`.** Still static, still no build. | One-file-only means the self-play tuner has to slice the script out of the HTML. See §3.1. |

Decisions 1, 2, 3 and 6 were confirmed by the owner; 4 and 5 are defaults
still open to change.

## 1. What "in the spirit of Discola" means here

The contract, in one list. Everything else is detail.

- **One static page.** `index.html` plus one script and the sprite sheets.
  No framework, no bundler, no runtime dependency. Netlify publishes the repo
  root. It must open from a folder in ten years.
- **The same art, untouched.** Tressette uses the same forty-card Italian deck
  as Briscola, so the five sprite sheets from `discola-web/decks/` are copied
  byte for byte. Nothing is redrawn and nothing is repacked.
- **The same table.** Green baize under warm light, the icon bar, the name
  plates in the corners, the trick in the middle, the sheets for start,
  settings, history and about. The CSS is forked from Discola and changed
  where Tressette needs it, not restyled.
- **One formula, four weight vectors.** The opponent scores every legal card
  and plays the highest. The four opponents differ only in their weights, and
  the weights are shown in the settings sheet, as in Discola.
- **Player-facing text is Italian.** Comments, commits and documents are
  English.
- **The UI check runs after every UI change**, and every threshold in it names
  the defect it was written for.
- **What is different is different because the game is**, not because of
  taste. The list:

| Tressette differs | Consequence for the port |
|---|---|
| No trump suit | No face-up card under the stock; the tallone is just a pile and a count. |
| You must follow suit if you can | The engine has a `legalMoves` function and the UI has to show which cards are playable. Discola never needed either. |
| Ten cards in hand, not three | The card-size budget gains a **width** term and the hand becomes a fan. This is the layout risk of the project. §3.7. |
| Points come in thirds | Scores are kept in *terzi* (integers) and shown as whole points; fractions are dropped at the end of each deal. |
| Declarations | One more scoring branch and one announcement. |
| No 1997 author tuned the opponent | Tuning is real work here, not a transcription. A headless self-play harness is part of the architecture, not an afterthought. §3.4. |

## 2. Rules as they will be implemented

Tressette a due, the common two-player form. Where house rules vary, this is
the one the game plays, stated in the about screen.

### 2.1 Cards

Forty cards, four suits (denari, coppe, spade, bastoni), numbered 1–10.

| Card | Number | Rank (high to low) | Points |
|---|---|---|---|
| Tre | 3 | 1st | ⅓ |
| Due | 2 | 2nd | ⅓ |
| Asso | 1 | 3rd | 1 |
| Re | 10 | 4th | ⅓ |
| Cavallo | 9 | 5th | ⅓ |
| Fante | 8 | 6th | ⅓ |
| 7, 6, 5, 4 | 7…4 | by number | 0 |

Internally every value is in thirds: an asso is 3 *terzi*, a figure or a 2 or
a 3 is 1, a *liscio* is 0. The deck holds 32 terzi; the last trick is worth 3
more; each player's total is floored to whole points at the end of the deal,
which always leaves exactly 11 points per deal between the two players.

### 2.2 The deal

- Shuffle. Discola kept the original's 200 + `Random(100)` swaps because that
  was the artefact; here there is no artefact, so the shuffle is a plain
  Fisher–Yates over an **injectable random source**. That is what makes the
  golden tests and the self-play harness reproducible.
- Ten cards each; twenty remain face down as the tallone.
- The non-dealer leads the first trick. The deal alternates, so whoever did
  not lead this deal leads the next — Discola's rule, and Tressette's. On a
  cold start you lead the first deal, as in Discola, where `partitaPrimo`
  begins at `BASSO`.

### 2.3 A trick

- The leader plays any card. The follower must play a card of the same suit
  if they hold one; otherwise any card. Taking is never compulsory.
- The trick goes to the higher card of the led suit. There is no trump.
- The winner takes both cards' terzi, draws first from the tallone, then the
  loser draws. The winner leads the next trick.
- Twenty tricks per deal: ten while the tallone lasts, ten more with no
  drawing. The last trick is worth 3 terzi (one point) on top of its cards.

### 2.4 Declarations (accusi)

Checked on the ten cards dealt, announced when that player plays their first
card of the deal. Points go to the declarer immediately.

| Declaration | Points |
|---|---|
| Napoletana: asso, due and tre of one suit | 3 |
| Three of the assi, or of the due, or of the tre | 3 |
| Four of the assi, or of the due, or of the tre | 4 |

Several declarations in one hand all count. Whether cards completed by drawing
can be declared is a house rule; here they cannot (decision 4).

### 2.5 The match

A partita is one deal, as Discola's is one hand of forty cards. Eleven points
plus declarations are at stake; the higher total wins. Eleven is odd, so
without declarations there is no draw; with them there can be one (7–4 with a
napoletana to the loser is 7–7), and it is recorded as a draw, as Discola
records 60–60. Whoever did not lead this deal leads the next.

## 3. Architecture

### 3.1 Files

```
index.html          markup, CSS, and the UI script: screens, rendering, input, storage
engine.js           rules + opponent. Pure functions over a plain state object. No DOM.
decks/*.png         the five sprite sheets, byte-identical copies from discola-web
tools/check_ui.mjs  the UI check, forked from Discola and extended for the fan (§3.7)
tools/engine.test.mjs  unit tests on node --test, no dependencies
tools/selfplay.mjs  headless matches: profile vs profile, vs baselines; the tuning loop
tools/pack_cards.py the packer, carried over unchanged in case a deck is ever repacked
netlify.toml        publish ".", cache decks/* for a year, revalidate index.html
CLAUDE.md, README.md, SPEC.md (when built), .claude/skills/ui-check/
```

**Why a second file.** Discola's engine is inline and that is right for
Discola: the formula was tuned in 1997 and nothing needs to run it outside a
browser. Here the formula is new, and the only way to tune twelve weights
honestly is to play tens of thousands of hands headlessly. `engine.js` is a
classic script — `<script src="engine.js">`, no `type="module"`, so it loads
over `file://` — and Node runs the same file with `vm.runInThisContext`. No
build, no bundler, no import syntax. Everything the page needs to open from a
folder still holds.

If the owner prefers the strict single file (decision 6), the harness instead
reads `index.html`, slices the script between the `cards` banner and the
`sound` banner, and runs that. It works; it is just a regex holding the tuner
together.

### 3.2 The engine (`engine.js`)

Naming follows Discola's Pascal-flavoured Italian so the two read alike.

```js
// cards
SUITS, rango(n), terzi(n)          // rank order and point value in thirds
buildDeck(), mescola(cards, rng)   // rng: () => [0,1)

// a deal
newDeal(state, rng)                // shuffle, deal ten each, set who leads
pesca(state, who)                  // draw one, winner first
mosseLegali(hand, led)             // slots you may play: follow suit if you can
prende(follow, led)                // does the follower's card beat the led card?
gioca(state, who, slot)            // play a card; resolves the trick when complete
accusi(hand)                       // [{kind, suit?, points}], from the dealt ten
scoreDeal(state)                   // floors terzi, adds ultima, adds accusi
vincitore(state)                   // BASSO, ALTO or null for a draw

// the opponent
WEIGHT_KEYS                        // the twelve names, in table order
rollProfiles(rng)                  // {Valerio, Graziano, Piero, Franco}; Piero drawn from rng
compGioca(state, P)                // slot to play, given one profile's weights
```

Nothing in this file touches `document`, `window`, timers or `Math.random`
directly. That is what lets the same file run under Node.

The profiles live here, not in the page, because three callers need them: the
page, the self-play harness and the golden test. Piero's roll takes the same
injectable rng as `mescola`. The page calls `rollProfiles(Math.random)` once
at startup, which keeps Discola's once-per-session tradition; the harness and
the golden test call it with their seeded rng, so a fixture that includes
Piero is still reproducible.

### 3.3 State

One mutable object, as in Discola. `render()` reads it and writes the DOM.

```
cards[40]          the shuffled deck
next               index of the next card to draw; 40 − next is the tallone
hands[2][10]       BASSO = 0 (you), ALTO = 1 (them); null = empty slot
played[2]          the two cards on the table, or null
terzi[2]           points taken this deal, in thirds
accusi[2]          declarations, credited at first play
perPrimo           who led this trick
deveGiocare        whose turn it is
partitaPrimo       who leads the next deal; BASSO on a cold start, then alternates
tricks             tricks completed this deal, 0..20
seen[]             what the opponent has seen: its own draws, every card played
voids[2][4]        suits a player has shown they cannot follow
selected           the slot you have raised but not yet played (§3.7)
over, dealt, cheat
opponent, deck, felt, speed, showPoints, sound   settings
```

### 3.4 The opponent

**Shape.** Identical to `CompGioca`: score every legal card in hand, play the
highest, ties to the lowest slot. Two branches, leading and following. `P` is
the profile's weights; the features come from the hand, `seen`, `voids`, the
tallone and the trick count.

**Knowledge.** Four derived facts drive everything, all computed from `seen`
and the opponent's own hand:

- `outstanding(suit)`: every card of the suit, at any rank, that is neither
  seen nor in hand — what the human may still hold.
- `controls(suit)`: which of the 3, 2 and asso are among them — the cards
  that decide who captures the asso.
- `sure(card)`: no outstanding card of its suit outranks it. A sure card led
  wins the trick. This is tested over the full rank order, not over
  `controls`: once the 3, 2 and asso of bastoni are gone, the Re of bastoni is
  sure and the 7 of bastoni is not, because the Re, Cavallo and Fante still
  beat it.
- `voids[BASSO][suit]`: the human failed to follow this suit. This is the
  inference Tressette is played on; Briscola never had it.

**Leading** — the question is which suit to open and how high.

```
v = terzi(c);  s = suit(c);  late = min(1, tricks / 10);  k = 1 + late × LATE_FACTOR
sure(c):              score += LEAD_SURE_BONUS × k
liscio (v == 0):      score += LEAD_LISCIO_BONUS
                      score += (cards held in s − 1) × LEAD_LONG_SUIT
asso not sure:        score −= LEAD_ACE_EXPOSED_PENALTY × |controls(s) above the asso|
3 or 2, not sure:     score −= LEAD_CONTROL_PENALTY × k
voids[BASSO][s]:      score −= LEAD_INTO_VOID_PENALTY      (they discard for free)
```

**Following** — the question is whether the trick is worth what it costs.

```
takes = prende(c, led);  L = terzi(led);  v = terzi(c);  k as above
tricks == 19 (the ultima):  L += ULTIMA_WEIGHT before anything else
takes:      score = (L + v) × TAKE_TERZI_WEIGHT
else:       score = −v × GIVE_TERZI_WEIGHT
takes with a 3 or 2 onto a trick worth less than an asso (L + v < 3):
            score −= SPEND_CONTROL_PENALTY × k
void in the led suit and c guards an asso (only other card of its suit):
            score −= DISCARD_GUARD_PENALTY × k
```

**What `late` does, and does not, touch.** `k` multiplies the four control
terms only — the sure bonus, the two control penalties and the guard penalty
— and never the point terms. Two reasons. Points on the table are worth the
same on trick one as on trick twenty, while a control card's certainty grows
as the tallone empties and `seen` approaches the whole deck; by trick ten the
information is complete, which is why `late` saturates there. And a factor
applied to a whole branch would change nothing: `compGioca` takes the argmax
within the branch, and a common multiplier leaves the argmax where it was.
Later readers will be tempted to "fix" the asymmetry into symmetry; doing so
silently invalidates the golden fixture and makes the weight inert.

The floor of 3 terzi in the spend-control line is an asso's worth. It is a
constant, not a weight: there are twelve weights, and the settings sheet
discloses twelve.

**The weights, v1.** Twelve, to mirror the twelve, and because that was
enough to give four opponents four characters.

| Weight | What it does |
|---|---|
| LEAD_SURE_BONUS | cash a card nothing can beat |
| LEAD_LISCIO_BONUS | open with a worthless card |
| LEAD_LONG_SUIT | prefer the suit you hold most of |
| LEAD_ACE_EXPOSED_PENALTY | do not lead an asso while its 3 or 2 are out |
| LEAD_CONTROL_PENALTY | do not waste a 3 or 2 that is not yet sure |
| LEAD_INTO_VOID_PENALTY | do not feed a suit they have shown void |
| TAKE_TERZI_WEIGHT | value of points captured |
| GIVE_TERZI_WEIGHT | cost of points handed over |
| SPEND_CONTROL_PENALTY | cost of using a 3 or 2 on a cheap trick |
| DISCARD_GUARD_PENALTY | cost of leaving an asso unguarded |
| ULTIMA_WEIGHT | the last trick's bonus, in terzi; 3 is the rule's value, more makes the ultima a goal |
| LATE_FACTOR | how much the four control terms steepen as the tallone empties |

**The four temperaments.** Valerio balanced and the default; Graziano loose,
cashing sure cards early and spending 3s freely; Franco tight, hoarding control
and guarding every asso; Piero rolled once per session by `rollProfiles`, as
in Discola, because that is now a house tradition rather than a Delphi
accident.

**The contract, from v1.0 on.** Discola's rule was *change a weight, not the
formula* because the formula was the 1997 artefact. Here the formula is ours
until it ships; after that the same rule applies, for the same reason: the
golden tests freeze the plays, and a formula change invalidates them.

**Tuning.** `tools/selfplay.mjs` plays N matches between any two players from
{profile, random-legal, greedy-take} with a seeded rng and reports win rate,
mean points per deal and the noise floor. Discola's 40,000-hand comparison is
the model. Acceptance for v1: every profile beats random-legal in at least
95% of deals and greedy-take in at least 70%, and no profile beats another by
more than 65% — they should be characters, not tiers. A small suite of
*trap positions* asserts the obvious plays directly, because a win rate can
hide a stupid habit: an asso on the table and the 3 in hand; forced to follow
with only an asso and a figure; the ultima; and the 3, 2 and asso of a suit
all gone with a 7 and a Cavallo of that suit in hand, where the 7 must not be
led as if it were sure.

### 3.5 Turn flow

Discola's, with a draw phase that ends halfway through the deal.

```
newDeal ──► render ──► (if they lead) computerPlay
humanPlay ──► trick complete? ──► resolve ──► draw (while tallone) ──► computerPlay
                      └── no ──► computerPlay
resolve ──► 20 tricks? ──► finish ──► scoreDeal ──► record ──► result dialog
```

Timers drive the opponent through `later()` with the epoch guard, exactly as
in Discola, for exactly the same reason: an abandoned deal must not keep
playing itself behind the start screen.

### 3.6 Screens

The same five views and the same two scrims. Discola's screen map holds
exactly.

```
start ──Gioca──► table ──┬─ reload icon ─► confirm ─► start
                         ├─ history icon ─► history ─back─► table
                         ├─ settings icon ─► settings ─back─► table
                         └─ about icon ────► about ───back─► table
table ──20 tricks──► result ──┬─ Ancora ────► table (new deal)
                              └─ Cambia ────► start
```

- **start** — opponent chips and dossier, deck row, Gioca pinned in the
  footer. Unchanged in structure.
- **table** — the icon bar; the plates show this deal's points with their
  thirds (`4⅔`), since the thirds are what a Tressette player is counting;
  the trick; the tallone as a pile with a count and no face-up card; an
  "Ultima presa" marker on trick twenty; a transient line for declarations
  ("Napoletana di coppe: 3 punti").
- **settings** — deck, felt, rhythm, show points, sound, change opponent,
  and the weights disclosure. The same list as Discola's.
- **history** — tally, record against each opponent, the last hundred
  partite.
- **about** — what the game is, which Tressette it plays, where the cards
  come from.
- **confirm** — guards abandoning a deal in progress.
- **result** — end of the deal: both scores, the declarations if any, a
  one-line note, Ancora and Cambia.

Keys: `1`–`9` and `0` select a card, `Enter` plays the selected one, `Escape`
backs out of a sheet. The `6winouj64ie` easter egg is kept; it is the house's.

### 3.7 Layout: the budget gains a width term

Discola's card size is a **height** budget:

```
--cw = clamp(min, min(9vw, (100dvh − --chrome) / --rows / --ratio), max)
```

with `--chrome` derived from the spacing tokens, never hand-set. All of that is
kept. What changes is that a hand of ten cannot sit side by side on a phone —
ten cards across 328px is 30px each — so the hand is a **fan**: cards overlap
and each one after the first shows a strip of width `--strip`.

```
hand width = --cw + 9 × --strip
--strip    = --cw × --overlap             (--overlap ≈ .45 on a phone, .7 on a desktop)
--cw       ≤ (table width − 2 × --pad-inline) / (1 + 9 × --overlap)
```

so `--cw` is the minimum of the height term and the width term. On a 360px
phone that gives a 64px card and a 29px strip. The opponent's hand is the same
fan, face down.

**Selection instead of a direct tap.** A 29px strip is under any sane tap
target, and a misplay in Tressette costs the deal. So a tap on a card *raises*
it — it lifts clear of the fan, fully visible, and its name shows — and a
second tap, or Enter, plays it. Cards that would break the follow-suit rule
are dimmed and inert, so the rule is taught by the table rather than by an
error message. On a desktop the raised state is also the hover state, so the
second click is what a mouse user does anyway.

**The UI check gains three assertions**, written against a deliberately
broken fan before the good one, per the rule in the `ui-check` skill:

1. every card in your hand has an uncovered strip at least `--strip` wide and
   the last card is fully visible — no card can be unreachable;
2. a raised card is entirely inside the table and above the fold;
3. the fan never exceeds the table's width, in every deck, at every viewport,
   with the spacing tokens inflated.

The remaining assertions — one screen visible, text floors, tap targets,
trick versus hands, hand above the fold, rows drift, inflated spacing — carry
over unchanged, because the defects they name are just as possible here.

`--rows` stays 3 in landscape and 4 in portrait; the tallone is smaller with
no briscola lying across it, which gives portrait a little back.

### 3.8 Persistence

`localStorage`, wrapped in `try`/`catch`, never leaving the device.

| Key | Shape |
|---|---|
| `tressette.settings` | `{opponent, deck, felt, speed, showPoints, sound}` |
| `tressette.history` | `[{t, o, d, y, a}, …]` newest first, capped at 100 |

The same two keys as Discola, under a different prefix. Nothing in progress
is saved: a deal abandoned or reloaded is gone, as in Discola.

### 3.9 Sound, motion, deployment

Card sounds synthesised with WebAudio as in Discola. `prefers-reduced-motion`
honoured. Netlify site linked to `main`, publish root, `decks/*` immutable,
`index.html` revalidated on every load.

## 4. Iterations

Each is independently shippable, and each ends with its check green.

### 0 — Scaffold (½ day)

Copy from `discola-web`: `decks/`, `tools/pack_cards.py`, `netlify.toml`,
`.gitignore`, the `ui-check` skill. Expand the stub `CLAUDE.md` into this
repo's version of Discola's (the same three rules, reworded: the fan budget,
the engine contract, Italian text). Empty `index.html` with the title and the
font links. A two-line `README.md` pointing at `PLAN.md`; iteration 6
rewrites it.

The `ui-check` skill and `check_ui.mjs` are carried over **dormant**: the
check drives screens that do not exist until iteration 3, so do not try to
make it pass, and word the rule in `CLAUDE.md` as taking effect once
`index.html` has a table. `engine.js`, the tests, the harness and `SPEC.md`
belong to later iterations; §3.1 describes the finished repo, not this one.

**Done when** the repo holds exactly what the two paragraphs above name, and
nothing else.

### 1 — Engine and tests (1 day)

`engine.js` per §3.2, with a seeded rng. `tools/engine.test.mjs` on
`node --test`: ranking; terzi; every deal of 10,000 random ones scores exactly
11 points plus declarations; `mosseLegali` forces the suit; `prende` with no
trump; declarations detected in fixed hands; `vincitore` returns the higher
total and null on the one kind of tie declarations can produce.

Add `.github/workflows/check.yml`: on every push and pull request, run
`node --test tools/` on the current Node LTS. No dependencies to install.

**Done when** the tests pass locally and in the Action, and the engine has no
DOM reference.

### 2 — Opponent v1 and the self-play harness (1–2 days)

The formula in §3.4 with one profile; `tools/selfplay.mjs` with the two
baselines; the trap suite. Tune until the acceptance numbers hold. Then the
golden test: seed 1..20, both seats `compGioca`, the sequence of plays frozen
in a fixture.

**Done when** the acceptance numbers in §3.4 hold and the golden fixture is
committed.

**Risk.** This is where the project can quietly fail: an opponent that is
merely legal is no fun, and one that is only strong is no fun either. Budget
a second day and play it yourself before moving on.

### 3 — The table (2 days)

Fork Discola's CSS and table markup. Build the fan, the selection state, the
follow-suit dimming, the plates with two scores, the tallone without a
briscola, the ultima marker, the trick sweep. Extend `check_ui.mjs` with the
three fan assertions — against a broken fan first. Run it at all nineteen
viewports in all five decks.

Add a second job to `check.yml` that installs `playwright-core` and Chromium
(`npx playwright install --with-deps chromium`) and runs
`node tools/check_ui.mjs`. Discola listed "no CI" as a known gap; this closes
it here, so no pull request can merge with a layout the check rejects.

**Done when** a full deal can be played against Valerio and both jobs are
green.

### 4 — Result and sheets (1 day)

The result dialog, the declarations line, the start, settings, history and
about sheets, the confirm scrim, keys, sound, the easter egg.

**Done when** a deal can be played end to end, abandoned with the confirm,
and shows up in history with the right score.

### 5 — The four opponents (1 day)

Four weight vectors, tuned by self-play to the acceptance numbers and to feel
different. Dossier text. The weights disclosure. The README table.

**Done when** the four beat the baselines, none dominates another, and each
has a one-line character you can recognise across a few deals.

### 6 — Ship (½ day)

Netlify site. README with the rules as played and provenance. `SPEC.md`
written from this document and what actually got built, including the
"known gaps" list.

**Done when** the live URL plays and the handover document would let a
stranger take the project over.

**Total: 7–8 days**, with the opponent the one estimate that can slip.

## 5. Out of scope, deliberately

| Not built | Why |
|---|---|
| Four-player Tressette with partners | A different game: partner signals (*bussare*, *striscio*, *volo*), three opponents to render, a partner AI to trust. Worth its own plan if wanted; nothing here precludes it, because the engine's trick and scoring rules are the same. |
| Multiplayer, accounts, a server | Same reason as Discola: any server is an operational liability that outlives interest. |
| A framework or build step | Same reason as Discola. The one concession is a second script file, and it is still static. |
| A match to 21 across deals | The traditional form, left out on the owner's call to keep Discola's rhythm of one deal per partita. `scoreDeal` returns per-deal points, so a running total, a second dialog and a saved match are additions, not a redesign. |
| Other variants (Tressette a perdere, Terziglio, Quintiglio) | Scope is one game done properly. |
| Localisation | The terms of art are Italian. |
| A difficulty slider | The four opponents are the difficulty, as in Discola. |
| Card counting aids | Counting is the game. The easter egg is already more than enough. |

## 6. Risks, in order

1. **The opponent.** No author tuned it; §3.4's harness and trap suite are
   the mitigation, and iteration 2 has the slack.
2. **The fan on phones.** A second budget dimension and a two-tap interaction
   that has to feel natural. The three new assertions and the select-then-play
   pattern are the mitigation; the fallback is two rows of five on portrait
   phones, which the budget can express as `--rows: 5`.
3. **House rules.** Tressette has more variants than Briscola. The about
   screen states the rules played, and the engine keeps the variable points
   — declarations from the deal only, one deal per partita — as single
   constants so a later change is one line.

## 7. How this gets built

Written for a builder starting with no context. Read this section, then the
rest of this document, then Discola.

### 7.1 One builder, one iteration per session

There is no orchestrator agent. This document is the plan and the owner
decides when each iteration starts. Each iteration is one session, opened
with:

> Do iteration N of PLAN.md in `diegoami/Tressette`. Read PLAN.md in full
> first, then `diegoami/discola-web` (`CLAUDE.md`, `SPEC.md`, `index.html`,
> `tools/check_ui.mjs`, `.claude/skills/ui-check`), then the previous
> iteration's pull request. Work on a branch named `iteration-N-<slug>` off
> the default branch. Stop at the iteration's "Done when": do not start the
> next one. Finish with every check green, commit, push, and open a pull
> request with the description in §7.4.

Why one iteration and not several: the defects this kind of page ships are
invisible in a diff and show up only in the check or at the table, and a
session that holds the whole of one iteration in context catches them. A
handoff in the middle of the fan or the opponent loses exactly that.

Why no orchestrator: the iterations are sequential and coupled — the table
needs the engine's API, the check needs the table's markup, the profiles need
the harness. At most a day could run in parallel, and an orchestrator would
never see the code. Subagents earn their keep in one place: read-only
exploration of Discola while the builder works.

Discola is the reference for everything not stated here. If it is not already
beside this repo, clone it: `https://github.com/diegoami/discola-web`.

### 7.2 Model and effort

| Iteration | Effort | Why |
|---|---|---|
| 0 Scaffold | medium | copying and rewording |
| 1 Engine and tests | medium | well specified in §2 and §3.2 |
| 2 Opponent and harness | **high** | the project's first way to fail quietly; §4 gives it slack |
| 3 The table | **high** | the second; may take two sessions, fan first, then the check |
| 4 Result and sheets | medium | Discola's screens, forked |
| 5 The four opponents | medium | the harness does the work; the builder reads numbers |
| 6 Ship | medium | docs in Discola's voice |

The builder is the Opus tier throughout. Do not drop to a smaller model on the
cheap iterations: the saving over eight days is small, and a missed layout
defect costs more than it saves. Exploration subagents the builder spawns to
read Discola can be the small tier.

Iterations 2 and 3 run alone. Nothing else is in flight while either is open.

### 7.3 The reviewer

Every pull request gets one review from a **fresh context** — a new session or
a subagent that has not seen the work — at high effort, same tier as the
builder. Fresh matters more than different: the builder cannot see its own
diff, and a reviewer that shares its context cannot either.

The reviewer is given three things: this document, the diff, and the check
output pasted into the pull request. It checks, in order:

1. the rules against §2, line by line — ranking, terzi, following suit, the
   ultima, the declarations, the draw order;
2. the opponent against §3.4 — the formula as written, the weights named as
   listed, no DOM or `Math.random` in `engine.js`;
3. that the UI check actually ran, on this commit, and that every assertion
   still names a defect (a new threshold with no story behind it is a
   finding);
4. the iteration's "Done when", item by item;
5. Italian on the page, English in comments and commits.

The reviewer reports; it does not fix. The builder fixes in the same pull
request, and the reviewer looks once more. A finding the builder disagrees
with goes to the owner, in the pull request, not into a silent merge.

### 7.4 GitHub, at the lowest useful ceremony

- **One pull request per iteration.** It is the unit of work, review and CI.
  Its description has four parts: what was built; the iteration's "Done when"
  as a ticked list; the check output, verbatim; what was left out and why.
- **CI on every pull request**: the engine tests from iteration 1, the UI
  check from iteration 3. A red check does not merge. Nothing is skipped or
  quarantined to get to green.
- **Issues only for defects found by playing** after an iteration has merged.
  Label them `defect`. Each is closed by a pull request that fixes the page
  *and* adds the assertion that would have caught it, per the `ui-check`
  skill: the assertion is written against the broken commit first. This is
  how every threshold in Discola's check got its story.
- **No project board, no milestones, no issue per iteration.** This document
  holds the plan; a second copy goes stale.
- **Commit messages** as in Discola's history: one line saying what changed
  and why, in English, imperative mood, no ticket numbers.

### 7.5 What outlives a session

Nothing lives in a session's memory. Anything learned goes into one of three
files: a decision into §0 of this document, a rule the builder must follow
into `CLAUDE.md`, and, at iteration 6, everything a stranger needs into
`SPEC.md`. If a session ends with something only it knows, that is a defect
in the handoff.

### 7.6 The owner's part

Start each iteration. Answer the two open defaults in §0 (declarations,
opponent names) before iteration 4 and iteration 5 respectively. Play the game
after iterations 3 and 5 — the harness measures strength, and only a player
can measure whether it is fun — and file what you find as `defect` issues.

## 8. Glossary

| Italian | Meaning |
|---|---|
| tressette | the game; "three sevens", though nobody agrees why |
| tallone | the stock, the twenty undealt cards |
| mano | a deal, twenty tricks |
| partita | a match; here one deal, as in Discola |
| presa | a trick |
| ultima | the last trick, worth an extra point |
| terzo, terzi | a third of a point, the unit the engine counts in |
| liscio | a worthless card, 4 through 7 |
| carico | a point card; above all the asso |
| accuso, accusi | a declaration: napoletana, tre assi, and so on |
| napoletana, napola | asso, due and tre of one suit |
| rispondere a colore | to follow suit, which is compulsory |
| sicura | a card nothing outstanding can beat |
| avversario | opponent |
| mazzo | deck |
