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
| 3 | What is a *partita*? | **A match to 21 points across several deals.** A deal (*mano*) is worth 11 points plus declarations, so a match is 2–5 deals. | Discola's "one deal is one match" would make a partita last five minutes and turn every 6–5 into a coin toss. Playing to 21 is how the game is played. |
| 4 | Declarations (*accusi*)? | **Yes, from the ten cards dealt, declared automatically when the first card is played.** | Off would remove one dialog and one scoring branch; declaring completed-by-draw sets would add state. |
| 5 | The opponents | **The same four names — Valerio, Graziano, Piero, Franco — with Tressette temperaments.** | New names cost nothing technically; the four are kept because they are the house. |
| 6 | Where the engine lives | **`engine.js`, a classic script beside `index.html`.** Still static, still no build. | One-file-only means the self-play tuner has to slice the script out of the HTML. See §3.1. |
| 7 | A match survives a reload | **The score between deals is saved; a deal in progress is not.** | Matches are longer than Discola's hands, so losing one to a tab reload matters more. |

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
| A match spans deals | Two result dialogs instead of one: end of deal, end of match. The plate shows both the match score and the current deal. |
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
  not lead this deal leads the next — Discola's rule, and Tressette's.

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

To 21. The deal's points are added to each player's match score at its end.
The match ends after any deal that leaves at least one player at 21 or more;
the higher score wins, and a tie plays another deal. Discola's 61-of-120 is
one deal; this is several. The option of 31 is cheap and can be a setting.

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

// a match
matchOver(state, target)           // {over, winner} — both at 21+, higher wins

// the opponent
compGioca(state, P)                // slot to play, given the profile's weights
```

Nothing in this file touches `document`, `window`, timers or `Math.random`
directly. That is what lets the same file run under Node.

### 3.3 State

One mutable object, as in Discola. `render()` reads it and writes the DOM.

```
cards[40]          the shuffled deck
next               index of the next card to draw; 40 − next is the tallone
hands[2][10]       BASSO = 0 (you), ALTO = 1 (them); null = empty slot
played[2]          the two cards on the table, or null
terzi[2]           points taken this deal, in thirds
accusi[2]          declarations, credited at first play
match[2]           whole points across the match
deals              deals played this match
perPrimo           who led this trick
deveGiocare        whose turn it is
dealerNext         who leads the next deal; alternates
tricks             tricks completed this deal, 0..20
seen[]             what the opponent has seen: its own draws, every card played
voids[2][4]        suits a player has shown they cannot follow
selected           the slot you have raised but not yet played (§3.7)
over, dealt, cheat
opponent, deck, felt, speed, showPoints, sound, target   settings
```

### 3.4 The opponent

**Shape.** Identical to `CompGioca`: score every legal card in hand, play the
highest, ties to the lowest slot. Two branches, leading and following. `P` is
the profile's weights; the features come from the hand, `seen`, `voids`, the
tallone and the trick count.

**Knowledge.** Three derived facts drive everything, all computed from `seen`
and the opponent's own hand:

- `outstanding(suit)`: which of the 3, 2 and asso of a suit are neither seen
  nor in hand — the cards that can still beat or be beaten.
- `sure(card)`: no outstanding card outranks it. A sure card led wins the
  trick.
- `voids[BASSO][suit]`: the human failed to follow this suit. This is the
  inference Tressette is played on; Briscola never had it.

**Leading** — the question is which suit to open and how high.

```
v = terzi(c);  s = suit(c);  late = tricks / 20
sure(c):              score += LEAD_SURE_BONUS × (1 + late × LATE_FACTOR)
liscio (v == 0):      score += LEAD_LISCIO_BONUS
                      score += (cards held in s − 1) × LEAD_LONG_SUIT
asso not sure:        score −= LEAD_ACE_EXPOSED_PENALTY × |outstanding 3/2 in s|
3 or 2, not sure:     score −= LEAD_CONTROL_PENALTY
voids[BASSO][s]:      score −= LEAD_INTO_VOID_PENALTY      (they discard for free)
```

**Following** — the question is whether the trick is worth what it costs.

```
takes = prende(c, led);  L = terzi(led);  v = terzi(c)
takes:      score = (L + v) × TAKE_TERZI_WEIGHT
else:       score = −v × GIVE_TERZI_WEIGHT
takes with a 3 or 2 onto a trick worth < SPEND_CONTROL_FLOOR terzi:
            score −= SPEND_CONTROL_PENALTY
void in the led suit and c guards an asso (only other card of its suit):
            score −= DISCARD_GUARD_PENALTY
tricks == 19 (the ultima):  L += 3 before scoring
everything above × (1 + late × LATE_FACTOR)
```

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
| ULTIMA_WEIGHT | how much the last trick's point counts |
| LATE_FACTOR | how much everything steepens as the tallone empties |

**The four temperaments.** Valerio balanced and the default; Graziano loose,
cashing sure cards early and spending 3s freely; Franco tight, hoarding control
and guarding every asso; Piero rolled once per session, as in Discola, because
that is now a house tradition rather than a Delphi accident.

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
*trap positions* (an asso on the table and the 3 in hand; forced to follow
with only an asso and a figure; the ultima) asserts the obvious plays
directly, because a win rate can hide a stupid habit.

### 3.5 Turn flow

Discola's, with a draw phase and a second dialog.

```
newDeal ──► render ──► (if they lead) computerPlay
humanPlay ──► trick complete? ──► resolve ──► draw (while tallone) ──► computerPlay
                      └── no ──► computerPlay
resolve ──► 20 tricks? ──► endDeal ──► credit match ──► dialog: fine della mano
endDeal ──► matchOver? ──► endMatch ──► record ──► dialog: fine della partita
```

Timers drive the opponent through `later()` with the epoch guard, exactly as
in Discola, for exactly the same reason: an abandoned deal must not keep
playing itself behind the start screen.

### 3.6 Screens

The same five views and the same two scrims, plus a third dialog state.

```
start ──Gioca──► table ──┬─ reload icon ─► confirm ─► start
                         ├─ history icon ─► history ─back─► table
                         ├─ settings icon ─► settings ─back─► table
                         └─ about icon ────► about ───back─► table
table ──20 tricks──► fine della mano ──Continua──► table (next deal)
fine della mano ──match over──► fine della partita ──┬─ Ancora ─► table (new match)
                                                    └─ Cambia ─► start
```

- **start** — opponent chips and dossier, deck row, Gioca pinned in the
  footer. Unchanged in structure.
- **table** — the icon bar; the plates show the match score large and this
  deal's points small (`7` and `2⅔`); the trick; the tallone as a pile with a
  count and no face-up card; an "Ultima presa" marker on trick twenty; a
  transient line for declarations ("Napoletana di coppe: 3 punti").
- **settings** — deck, felt, rhythm, show points, sound, match target (21 or
  31), change opponent, and the weights disclosure.
- **history** — tally, record against each opponent, the last hundred
  matches with their deal counts.
- **about** — what the game is, which Tressette it plays, where the cards
  come from.
- **confirm** — guards abandoning a match in progress.
- **result** — end of deal (both scores, running match, Continua) and end of
  match (Ancora, Cambia).

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
| `tressette.settings` | `{opponent, deck, felt, speed, showPoints, sound, target}` |
| `tressette.history` | `[{t, o, d, y, a, m}, …]` newest first, capped at 100; `m` = deals |
| `tressette.match` | `{o, match:[y,a], deals, dealerNext}` between deals; cleared at match end or abandon |

### 3.9 Sound, motion, deployment

Card sounds synthesised with WebAudio as in Discola. `prefers-reduced-motion`
honoured. Netlify site linked to `main`, publish root, `decks/*` immutable,
`index.html` revalidated on every load.

## 4. Iterations

Each is independently shippable, and each ends with its check green.

### 0 — Scaffold (½ day)

Copy from `discola-web`: `decks/`, `tools/pack_cards.py`, `netlify.toml`,
`.gitignore`, the `ui-check` skill. Write `CLAUDE.md` for this repo (the same
three rules, reworded: the fan budget, the engine contract, Italian text).
Empty `index.html` with the title and the font links.

**Done when** the repo has the shape in §3.1 and nothing else.

### 1 — Engine and tests (1 day)

`engine.js` per §3.2, with a seeded rng. `tools/engine.test.mjs` on
`node --test`: ranking; terzi; every deal of 10,000 random ones scores exactly
11 points plus declarations; `mosseLegali` forces the suit; `prende` with no
trump; declarations detected in fixed hands; a match ends at 21, at 22–21,
and not at 21–21.

**Done when** the tests pass and the engine has no DOM reference.

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

**Done when** a full deal can be played against Valerio and the check is
green.

### 4 — Deal, match, sheets (1 day)

The two result dialogs, the declarations line, the match saved between deals,
the start, settings, history and about sheets, the confirm scrim, keys, sound,
the easter egg.

**Done when** a match to 21 can be played end to end, abandoned, resumed after
a reload between deals, and shows up in history.

### 5 — The four opponents (1 day)

Four weight vectors, tuned by self-play to the acceptance numbers and to feel
different. Dossier text. The weights disclosure. The README table.

**Done when** the four beat the baselines, none dominates another, and each
has a one-line character you can recognise across a match.

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
3. **Match length.** Several deals per match is right for the game and slower
   than Discola. The end-of-deal dialog must be one tap, and the match must
   survive a reload.
4. **House rules.** Tressette has more variants than Briscola. The about
   screen states the rules played, and the engine keeps the two variable
   points — declarations from the deal only, target 21 — as single constants.

## 7. Glossary

| Italian | Meaning |
|---|---|
| tressette | the game; "three sevens", though nobody agrees why |
| tallone | the stock, the twenty undealt cards |
| mano | a deal, twenty tricks |
| partita | a match, to 21 |
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
