# Tressette — architecture and plan

A two-player Tressette game for the browser, in the spirit of
[Discola](https://github.com/diegoami/discola-web): one static page, no build
step, the 1997 card art, a table lit from above, four named opponents who
share one formula and differ only in their weights, and a UI check calibrated
against the defects that actually ship.

**Status: built, and live.** This document stays as the record of how it was
built — including what it got wrong on the way, which is most of what it is
worth. `SPEC.md` is the handover: what exists, how it is put together, what the
numbers are, and what is missing. Read that first; read this when you want to
know why something is the way it is.

---

## 0. Decisions that are the owner's to make

Each has a default so the plan is complete without waiting. Change any of them
and the sections below say what moves.

| # | Decision | Default in this plan | What it changes |
|---|---|---|---|
| 1 | Is there a 1997 original to transcribe? | **No.** No Tressette source exists among the repos; the opponent is designed here and tuned by self-play. | If one exists, §3.3 becomes a transcription and the fidelity contract in §1 applies to it, exactly as in Discola. |
| 2 | Two players with a stock, or four with partners? | **Two players, with the tallone** (Tressette a due). Same table shape as Discola: you at the bottom, them at the top. | Four-player is a different game: partners, signalling, three opponents to render. See §5. |
| 3 | What is a *partita*? | **One deal, as in Discola.** Twenty tricks, 11 points plus declarations, the higher total wins. Chosen by the owner. | The traditional match to 21 across deals would add a running score, a second result dialog and a match saved between deals. The engine's `scoreDeal` is where it would plug in; see §5. |
| 4 | Declarations (*accusi*)? | **Yes, from the ten cards dealt, declared automatically when the first card is played.** Confirmed by the owner before iteration 4. | Off would remove one dialog and one scoring branch; declaring completed-by-draw sets would add state. |
| 5 | The opponents | **Four: Franco, Valerio, Graziano and Piero — one to each corner of the two weights that decide the game a profile plays.** Taken in two steps. Iteration 4 dropped Valerio, because iteration 2 had measured him and Franco choosing the same card 99% of the time, and Franco inherited his tuned weights. The review of iteration 5 then found that the formula has two levers rather than one, so the corner Valerio had failed to occupy by intention exists by measurement: he is back in it, 14–27% away from all three of the others. | A fifth name would need a lever the eleven weights do not have. |
| 6 | Where the engine lives | **`engine.js`, a classic script beside `index.html`.** Still static, still no build. | One-file-only means the self-play tuner has to slice the script out of the HTML. See §3.1. |

All six were confirmed by the owner; 5 was decided during iteration 4, and the
roster is four again, one to each corner of the two weights that matter.

## 1. What "in the spirit of Discola" means here

The contract, in one list. Everything else is detail.

- **One static page.** `public/index.html` plus one script and the sprite
  sheets. No framework, no bundler, no runtime dependency. Netlify publishes
  `public/` and nothing else: the repo root is documents, and a private
  repository does not keep them off a public URL once they are uploaded as
  site assets. Discola learned that by serving its own `SPEC.md`. The page
  must open from a folder in ten years, and it does.
- **The same art, untouched.** Tressette uses the same forty-card Italian deck
  as Briscola, so the five sprite sheets from `discola-web/public/decks/` are
  copied byte for byte. Nothing is redrawn and nothing is repacked.
- **The same table.** Green baize under warm light, the icon bar, the name
  plates in the corners, the trick in the middle, the sheets for start,
  settings, history and about. The CSS is forked from Discola and changed
  where Tressette needs it, not restyled.
- **One formula, four weight vectors, and one exception.** For thirteen
  tricks the opponent scores every legal card and plays the highest, and the
  four opponents differ only in their weights, which the settings sheet shows
  as in Discola. From trick fourteen, where the tallone is empty and the other
  hand can be deduced rather than guessed at, all four play the rest of the
  deal out exactly and identically. Exact play beats a temperament where the
  answer is knowable, and it is worth about seven points of win rate.
  Measured before it was chosen, on the formula with the search switched off,
  which is the only way the question can be asked: two temperaments disagree on
  about 15% of the positions where they have a choice, and under a fifth of
  those disagreements fall in the tricks the search now takes over. In the
  opponent that ships it is none of them, by construction. §3.4 has the rule.
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
public/index.html   markup, CSS, and the UI script: screens, rendering, input, storage
public/engine.js    rules + opponent. Pure functions over a plain state object. No DOM.
public/decks/*.png  the five sprite sheets, byte-identical copies from discola-web
tools/check_ui.mjs  the UI check, forked from Discola and extended for the fan (§3.7)
tools/engine.test.mjs  unit tests on node --test, no dependencies
tools/selfplay.mjs  headless matches: profile vs profile, vs baselines; the tuning loop
tools/pack_cards.py the packer, carried over unchanged in case a deck is ever repacked
netlify.toml        publish "public", cache decks/* for a year, revalidate index.html
CLAUDE.md, README.md, SPEC.md (when built), .claude/skills/ui-check/
```

Only `public/` is the site. Everything that is served lives there, and
nothing that is not served does; a whitelist, because a 404 rule for `*.md`
would have covered today's root and missed whatever lands there next.

**Why a second file.** Discola's engine is inline and that is right for
Discola: the formula was tuned in 1997 and nothing needs to run it outside a
browser. Here the formula is new, and the only way to tune eleven weights
honestly is to play tens of thousands of hands headlessly. `engine.js` is a
classic script — `<script src="engine.js">`, no `type="module"`, so it loads
over `file://` — and Node runs the same file with `vm.runInThisContext`. No
build, no bundler, no import syntax. Everything the page needs to open from a
folder still holds.

If the owner prefers the strict single file (decision 6), the harness instead
reads `public/index.html`, slices the script between the `cards` banner and
the `sound` banner, and runs that. It works; it is just a regex holding the
tuner together.

### 3.2 The engine (`engine.js`)

Naming follows Discola's Pascal-flavoured Italian so the two read alike.

```js
// cards
SUITS, rango(n), terzi(n)          // rank order and point value in thirds
buildDeck(), mescola(cards, rng)   // rng: () => [0,1)
rngSeed(seed)                      // a seeded rng, versioned with the engine

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
WEIGHT_KEYS                        // the eleven names, in table order
rollProfiles(rng)                  // {Franco, Valerio, Graziano, Piero}; Piero drawn from rng
compGioca(state, P)                // slot to play, given one profile's weights
```

Nothing in this file touches `document`, `window`, timers or `Math.random`
directly. That is what lets the same file run under Node.

`rngSeed` is here for the same reason the profiles are: a fixture is only
reproducible if the generator that recorded it ships with the engine. Put it in
the harness and the golden test's guarantee becomes "as long as nobody edits
`selfplay.mjs`", which is not a guarantee.

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
accusi[2]          declarations, from the ten dealt; scored at the end
detti[2]           whether each player's declarations have been announced yet
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

**Shape.** Three branches. Leading and following are `CompGioca`'s shape:
score every legal card in hand with the profile's weights, play the highest,
ties to the lowest slot. The third, the last seven tricks, scores nothing and
reads no weight; it enumerates the position and has no ancestor in
`UGiocatore.pas`, because Briscola's endgame was never a position anyone
needed to solve. `P` is
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
constant, not a weight: there are eleven weights, and the settings sheet
discloses eleven.

**The endgame is played exactly, not weighed.** From trick eleven on the
opponent has perfect information: the tallone is empty, every card has been
seen, so the cards it has not seen are exactly the human's hand. `compGioca`
therefore stops scoring and starts searching — from **trick fourteen**
(`CODA_FROM = 13`, counting completed tricks), in whichever seat it finds
itself, deducing the other hand rather than reading it.

Thirteen is a budget, not a principle, and the budget is the interesting
part. Measured rather than estimated — the first of the seven decisions is
the expensive one, and quoting the mean over all seven hides it behind the
trivial ones:

| `CODA_FROM` | first searched decision | vs greedy-take |
|---|---|---|
| 13 | 28ms median, 66ms worst | 85.0% |
| 11 | 767ms median, 1,906ms worst | 89.2% |

So two tricks earlier is worth **four points** of win rate, not the one an
earlier draft of this paragraph guessed at, and costs about twenty-seven
times the time. Thirteen trades those four points to keep the worst case
near 70ms instead of near two seconds — a hang of that length once a deal,
worse on a phone, is not a trade this game should make. It is a good trade
honestly argued, which is not what it was when the numbers were guessed.

**`CODA_FROM` and the weight vector are coupled**, which is worth knowing
before anyone moves either. Every trick the search gains or gives back
revalues the weights that were doing work there, silently and without anyone
touching them. Two of the eleven moved when the search took the last seven:
`LEAD_SURE_BONUS` went from changing 15.3% of late leads to 2.9%, and
`LEAD_LONG_SUIT` went from neutral to about two points harmful and was
re-tuned to 0. So moving `CODA_FROM` means re-measuring the weights, not
just re-recording the fixture.

Those two percentages are the ones iteration 2 printed, and the review of
iteration 5 found the denominator behind them: `probe()` counted every late
lead, including the 72% of them from `CODA_FROM` on, where the search answers
and no weight can fire at all. Over the leads the weights actually decide —
trick ten to `CODA_FROM`, `SEED_FROM=5001 node tools/selfplay.mjs --probe
150` — the sure bonus changes **26.7%** of them (131 of 490), not 2.9%. The
coupling is real and the conclusion stands; the size of it was never what that
line said. `LEAD_LONG_SUIT` is the same story from the other end: it was tuned
to 0 as harmful in iteration 2's context, and the review of iteration 5 found
it is the cheapest lever this formula has for making one profile play
differently from another.

**The named next move on the formula**, while §3.4's contract still allows
one: the search is plain minimax with a transposition table, no move
ordering and no alpha-beta. Alpha-beta on a tree this shape typically buys
close to a square-root reduction, which would plausibly bring the eight-card
decision inside the budget and put `CODA_FROM = 12` — and most of those four
points — within reach without the hang. That is a lead, not a measurement.
It belongs before v1.0 freezes the fixture rather than after.

"Their best reply" is well defined because the two totals over the rest of the
deal add up to a constant: the terzi still in play plus the ultima's 3. So
the reply that maximises theirs is the one that minimises the
opponent's.

It must refuse what it cannot deduce. If the cards it believes are outstanding
do not come to a hand the size of the one they hold, the position is not the
one it thinks it is, and it falls back to the formula rather than answering
confidently from a deck that does not add up.

What this costs is stated in §1, and was measured before it was chosen: the
four opponents play these seven tricks alike. What it buys is the roster in
the acceptance table below — 84.7% to 87.0% against random-legal and 80.3% to
86.6% against greedy-take, on seeds no tuner saw. The figures this paragraph
carried before the review (79.8–86.7% and 74.5–86.7%) were iteration 2's, for
a roster of three that no longer exists.

The case that shows why the formula cannot do it: the opponent holds the Re di
coppe and the Fante di spade and leads; the human holds the Fante di coppe and
the asso di spade. Leading the Re wins two terzi and then loses the asso and
the ultima, 2 to 7. Leading the Fante loses four terzi now and wins the last
trick with the Re, 5 to 4. The formula leads the Re, because the Re is sure;
only playing it out finds the Fante.

There is no ultima weight. An earlier draft had one, applied on trick twenty,
where both players hold a single card and nothing is chosen; it could be set
to anything without moving a play. A weight the settings sheet discloses has
to do something.

**The weights, v1.** Eleven. Discola had twelve because `Global.pas` did; a
twelfth is not invented here to match the count. If iteration 2's harness
shows the opponent failing to cash sure winners because it will not take a
cheap trick to gain the lead, the candidate is a tempo term — a bonus for
taking, scaled by the sure cards in hand — and it is decided then, before the
formula freezes.

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
| LATE_FACTOR | how much the four control terms steepen as the tallone empties |

**The four temperaments.** Iteration 2 measured whether this formula can
actually tell them apart and iteration 5 priced it, twice; §4.5 and the
iteration 5 record have the answer. Two weights decide the game a profile
plays — whether it opens its longest suit, and what a liscio is worth
leading — and there is a player in each of the four corners they make.

**Franco** is the house standard and the default, balanced: no long suit, lisci
kept. He is the player iteration 2 tuned. **Graziano** opens the long suit and
keeps fewer lisci — another game, and not a worse one: 86.5% against
greedy-take where Franco is 86.6%, on the same 2,000 held-out deals. That is
the correction iteration 5's review forced: the first pass had concluded that
character costs about a point of win rate per percent of plays changed, having
never priced `LEAD_LONG_SUIT`. **Valerio** is the corner where character does
cost something: neither the long suit nor the patience, so he leads his big
cards and takes what is there, at 81.3%. He is the name iteration 4 retired,
back on a vector that earns it. **Piero** opens long *and* keeps his lisci, and
is rolled once per session by `rollProfiles`, as in Discola, because that is
now a house tradition rather than a Delphi accident.

There is still no "tight" character: the weights that would express one — the
control penalties and the guard — move almost no plays at any magnitude, which
is what iteration 2 found and iteration 5 confirmed a second way. A fifth name
would need a lever the eleven weights do not have.

**The contract, from v1.0 on.** Discola's rule was *change a weight, not the
formula* because the formula was the 1997 artefact. Here the formula is ours
until it ships; after that the same rule applies, for the same reason: the
golden tests freeze the plays, and a formula change invalidates them.

**Tuning.** `tools/selfplay.mjs` plays N matches between any two players from
{profile, random-legal, greedy-take} with a seeded rng and reports win rate,
mean points per deal and the noise floor. Discola's 40,000-hand comparison is
the model. Acceptance for v1: every profile beats random-legal in at least
**82%** of deals and greedy-take in at least **78%**, and no profile beats
another by more than 65% — they should be characters, not tiers.

**Where those two floors come from.** They have been written three times, and
only the last two were measured. They started at 95% and 70%, from intuition,
because §0 decision 1 leaves no 1997 opponent to calibrate against. Iteration 2
measured them instead: 95% was unreachable by anything — a player that cheats
outright wins 82.5% — and 70% turned out to be a real bar, one a first tuning
pass failed and a second cleared, until the endgame search cleared it by so
much that it stopped being one. So they became 85% and 80%, about two points
under the 86.7% iteration 2 measured against both baselines on seeds no tuner
had seen.

That measurement was one profile, on about a thousand deals, before the endgame
search existed. The review of iteration 5's second round asked what it says
about the roster it had since been applied to. On 2,000 deals a matchup, on a
seed range nothing had been tuned or reported on (`SEED_FROM=90001 node
tools/selfplay.mjs 1000`), that roster runs:

| | vs random-legal | vs greedy-take |
|---|---|---|
| Franco | 85.5% ± 1.5 | 86.6% ± 1.5 |
| Valerio | 85.8% ± 1.5 | 81.3% ± 1.7 |
| Graziano | 87.0% ± 1.5 | 86.5% ± 1.5 |
| Piero (one roll) | 84.7% ± 1.6 | 80.3% ± 1.7 |

Franco cleared 85% by half a point, which is a third of his own error bar, and
a rolled Piero lands on either side of it depending on the roll and on the seed
range. Twenty rolls of him, by the two commands that roll him:

| | vs random-legal | vs greedy-take |
|---|---|---|
| `SEED_FROM=90001 node tools/selfplay.mjs --piero 8 500` | 85.6–87.2% | 82.2–85.2% |
| `node tools/selfplay.mjs --piero 12 400` | 83.6–84.6% | 80.5–83.8% |

A floor that half the roster straddles on half the seed ranges is not measuring
anything, so the floor moved rather than the roster. The weakest figure anywhere
above is 83.6% against random-legal and 80.3% against greedy-take, so **82% and
78% keep between one and a half and two and a half points of margin**, which is
what a regression guard is for and not what a description is for. **The first
table is the claim about how strong these players are. The floors are only
there to catch a change that breaks one.**

A small suite of *trap positions* asserts the obvious plays directly, because a
win rate can hide a stupid habit: an asso on the table and the 3 in hand;
forced to follow with only an asso and a figure; the Re and Fante position
above, where the Fante must be led first; and the 3, 2 and asso of a suit all
gone with a 7 and a Cavallo of that suit in hand, where the 7 must not be led
as if it were sure. Every trap is a position with a real choice: a position
where every legal play is forced asserts nothing.

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
start ──Gioca──► table ──┬─ reload icon ─► confirm ─► table (new deal)
                         ├─ history icon ─► history ─back─► table
                         ├─ settings icon ─► settings ─back─► table
                         └─ about icon ────► about ───back─► table
table ──20 tricks──► result ──┬─ Ancora ────► table (new deal)
                              └─ Cambia ────► start
settings ──Cambia avversario──► confirm ─► start
```

The reload icon is labelled *nuova mano*, so it deals one: the confirm guards
throwing the deal in progress away, not leaving the table. Leaving the table is
"cambia avversario", on the settings sheet and in the result. Iteration 4 had
this map's first line and the button's label pointing in different directions,
and built something that did both — discard, go to the start sheet, then deal a
hand behind it.

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

Discola's card size is a **height** budget, `(100dvh − --chrome) / --rows /
--ratio`, clamped, with `--chrome` derived from the spacing tokens beside it
and never hand-set. That derivation is kept, including the `--plates` token
Discola added for the name plates when they stack on a phone. What is **not**
kept is the `vw` cap that Discola's clamps carry — `9vw` in landscape, `22vw`
in portrait. Those numbers were chosen while the page had no viewport meta
tag and every phone reported a phantom 980px layout width; Discola has since
added the tag and kept the caps on their own merits, but here the width term
below does their job and knows about the fan, and keeping both would bind the
wrong one: at 360px, `9vw` is 32px against a width term of 64px, half the card
this section works out.

A hand of ten cannot sit side by side on a phone — ten cards across 328px is
30px each — so the hand is a **fan**: cards overlap and each one after the
first shows a strip of width `--strip`.

```
hand width = --cw + 9 × --strip
--strip    = --cw × --overlap             (--overlap ≈ .45 on a phone, .7 on a desktop)
height     = (100dvh − --chrome) / --rows / --ratio
width      = (table width − 2 × --pad-inline) / (1 + 9 × --overlap)
--cw       = clamp(floor, min(height, width), cap)
```

Two terms, no `vw`, one clamp per orientation with Discola's floors and caps
(32px to 156px in landscape, 40px to 168px in portrait). On a phone in
portrait the width term binds and gives a 64px card and a 29px strip at 360px;
in landscape the height term binds, as it did in Discola. The opponent's hand
is the same fan, face down.

Every number forked from Discola's stylesheet is a starting point for the
check to re-measure, not a constant to trust: that stylesheet was tuned in
quirks mode, from `file://`, against the phantom width above, until Discola's
commit `22c4b9c` fixed the doctype and the head tags. The `--plates` token and
the stacked name plates arrived in the same commit, and a ten-card fan
interacts with them differently from three cards; iteration 3 measures rather
than assumes.

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
honoured. Netlify site linked to `main`, publishing `public/` and nothing
else, `decks/*` immutable, `index.html` revalidated on every load.

## 4. Iterations

Each is independently shippable, and each ends with its check green.

### 0 — Scaffold (½ day) — done

Done in `3e8198d`, forked from Discola at `44363d8`, then re-synced in
`106584f` to Discola's `22c4b9c` when Discola moved twice in between: once to
publish `public/` instead of the repo root, once to add the head tags and fix
what they exposed. Both are in this repo now.

Copy from `discola-web`: `public/decks/`, `tools/pack_cards.py`,
`netlify.toml`, `.gitignore`, the `ui-check` skill. Expand the stub
`CLAUDE.md` into this repo's version of Discola's (the same three rules,
reworded: the fan budget, the engine contract, Italian text). Empty
`public/index.html` with the doctype, `lang="it"`, the UTF-8 charset, the
viewport meta (`width=device-width, initial-scale=1`), the title and the font
links — the four head tags are what the check's document pass asserts, and
without the viewport tag a phone lays the page out at 980px. A two-line
`README.md` pointing at `PLAN.md`; iteration 6 rewrites it.

The `ui-check` skill and `check_ui.mjs` are carried over **dormant**: the
check drives screens that do not exist until iteration 3, so do not try to
make it pass, and word the rule in `CLAUDE.md` as taking effect once
`public/index.html` has a table. `engine.js`, the tests, the harness and
`SPEC.md` belong to later iterations; §3.1 describes the finished repo, not
this one.

**Done when** the repo holds exactly what the two paragraphs above name, and
nothing else.

### 1 — Engine and tests (1 day) — done

Done in `acb4203`, with `5a59078` and `cc3cde5` closing two rounds of review
and `55754ba` correcting this document. Pull request #2: 24 tests, green in
the Action.

**What this iteration got wrong, twice, and what it costs to find out.**

The test this iteration leaned on hardest plays 10,000 random deals and checks
that each one scores exactly 11 points. It is a good test, and it is not the
test it looks like. It checks that all the points are handed out — none
invented, none lost — and says nothing about **who gets them**.

So each of these breaks the game and leaves it green:

- the trick goes to the lower card instead of the higher one;
- the trick's points are credited to the player who lost it;
- the player who lost the trick leads the next one.

All three still play twenty tricks and still hand out the deck's 32 terzi plus
the last trick's 3, so the two scores still come to 11 between them. It is a
balance sheet that balances with the entries in the wrong accounts: adding up
the columns cannot find that, only reading the entries can.

Three of the tests here were also written so that they could not fail at all.
One asked the engine who won the trick and then checked that the points went to
the player the engine had named. One ran on a shuffle where the situation it
meant to test never came up, so it passed on an empty case. One searched the
engine's source for the word `document` — and found it, in the comment
promising not to use it.

The habit that fixes both: after writing a test, break the thing it is supposed
to protect and watch the test fail. If it still passes, the test is decoration.
Every assertion added since has been through that. 31 deliberate breaks, 30
caught; the one left alone is a change no forty-card deck can tell apart.

**For iteration 2 in particular:** the opponent is judged by win rate, and a
win rate hides a wrong rule even better than a total does. A player that loses
tricks it should win still wins some deals, and the number it reports will look
plausible. That is what the trap positions in §3.4 are for, and every one of
them needs a real choice in it — a position where the opponent has only one
legal card asserts nothing about how it chooses.

`engine.js` per §3.2, with a seeded rng. `tools/engine.test.mjs` on
`node --test`: ranking; terzi; every deal of 10,000 random ones scores exactly
11 points plus declarations; `mosseLegali` forces the suit; `prende` with no
trump; declarations detected in fixed hands; `vincitore` returns the higher
total and null on the one kind of tie declarations can produce.

Add `.github/workflows/check.yml`: on every pull request, and on pushes to
`main`, run `node --test 'tools/**/*.test.mjs'` on the current Node LTS. No
dependencies to install.

Two details this plan had wrong before iteration 1 ran into them. `node --test
tools/` does not work: Node 22 reads a bare directory as a module path and
fails with `MODULE_NOT_FOUND`, so the tests need a glob (or a bare `node
--test`, which searches from the root). And `on: push` with no branch filter
runs the whole suite twice for every commit on a pull request branch, once for
the push and once for the pull request — harmless while there is nothing to
install, wasteful once iteration 3 adds Chromium.

**Done when** the tests pass locally and in the Action, and the engine has no
DOM reference.

### 2 — Opponent v1 and the self-play harness (1–2 days) — done

Pull request #3, over three fresh-context reviews. The first overturned this
iteration's central claim — that 95% against random-legal was unreachable,
argued from a "cheating oracle" that turned out to be shallower than an honest
deep-searching player. The formula changed as a result: the opponent searches
the last seven tricks exactly, and §3.4's acceptance numbers are measured
rather than intuited.

**What it cost to learn, for iteration 3 and after.** The second and third
reviews were almost entirely about tests that could not fail. Four of them, in
three iterations, were written against a position where the bug they named
could not appear — including one written to catch a bug found in the review
before. The rule that came out of it: **a position built by hand to be
convenient is built to be wrong in the way that matters.** Every assertion
here is now checked by breaking the thing it protects and watching it fail,
and the real-choice check is folded into the assertion itself so a new trap
gets it whether or not anyone remembers.

The formula in §3.4 with one profile; `tools/selfplay.mjs` with the two
baselines; the trap suite. Tune until the acceptance numbers hold. Then the
golden test: seed 1..20, both seats `compGioca`, the sequence of plays frozen
in a fixture.

Two questions to put to the harness before the freeze, because they cannot
be seen in a win rate. `sure()` is suppressed early by construction (twenty
face-down cards leave almost nothing sure) and `k` suppresses the sure bonus
again on top; measure how often the bonus fires before trick ten, and whether
forcing `k = 1` moves the acceptance numbers. If it does not, one of the two
mechanisms is doing nothing and is simplified away now, not tuned around in
iteration 5. And the tempo question from §3.4: does the opponent decline
cheap tricks while holding sure winners it then never gets to lead?

**Done when** the acceptance numbers in §3.4 hold and the golden fixture is
committed.

**Risk.** This is where the project can quietly fail: an opponent that is
merely legal is no fun, and one that is only strong is no fun either. Budget
a second day and play it yourself before moving on.

### 3 — The table (2 days) — done

Fork Discola's CSS and table markup **from a named commit, `22c4b9c` or
later**, and write the commit into the pull request. Before forking, check
whether Discola has moved again since §7.5's last recorded commit. That
commit changed the seat layout: the name plate stacks above or below the hand
on phone-shaped screens and is paid for out of the card budget through
`--plates`, and the tallone may shrink and wrap. A ten-card fan meets those
rules differently from three cards, so measure.

Build the fan, the selection state, the follow-suit dimming, the plates with
the deal's points, the tallone without a briscola, the ultima marker, the
trick sweep. Then the check: the copy on hand is still Briscola inside —
three-card fixtures, a faked result screen, the `discola.history` storage key
— so rewrite the fixtures and the key for this game, keep the document pass
and the edge-clipping assertion Discola added, and add the three fan
assertions against a broken fan first. Run it at all nineteen viewports in
all five decks.

Add a second job to `check.yml` that installs `playwright-core` and Chromium
(`npx playwright install --with-deps chromium`) and runs
`node tools/check_ui.mjs`. Discola listed "no CI" as a known gap; this closes
it here, so no pull request can merge with a layout the check rejects.

**Done when** a full deal can be played against Valerio and both jobs are
green.

**What the fan assertions caught, which is not what they were written for.**
They were written against two deliberate breaks — `--overlap: .08`, which
collapses the strips to 5px, and a `--cw` with the width term removed, which
runs the fan up to 227px past the table's edge. The first fails all 24 table
rows; the second fails the ten portrait ones and no landscape one, and must,
because the width term cannot bind on a screen where the height term does. The
defect they actually found was in the good page: the line that names the raised card was `hidden` until it had something
to say, so it took no space while empty, and raising a card added a row and a
row gap and moved every card below it down 31px. In landscape there is no spare
height to absorb that, so the card you were about to play sat 5 to 10px below
the fold at five of the nineteen viewports. Nothing threw, nothing looked wrong
in the diff, and the raised state is exactly the state a player is in when they
are about to commit.

The fix is the budget's own rule applied to a line of text: `--say` is derived
from the type it reserves room for, it enters `--chrome`, and the strip is
always in flow. It rides inside your seat rather than as a table row of its
own, which is worth 20px of inflated row gap — enough that 980x385 with the
spacing inflated still fits. Three assertions came out of it: the strip is
never zero-height, its contents are never clipped by it, and the strip counts
as content when the drift metric measures the gaps between rows.

**Two calibrations worth keeping.** A 24px absolute floor for the fan's step is
wrong on its own: at 980x385 with the spacing inflated the card sits on its
32px clamp floor, and 70% of a 32px card is a 22px strip — a good fan on a
small card, not a collapsed one. The floor is `min(24px, .4 of a card)`, so the
second term asks what share of the card shows: .08 of it is the arithmetic gone
wrong at any size, .7 of it is a small screen. And the two assertions for "the
last card is whole" and "the fan stays inside the table" were the same
subtraction on the right-hand edge, reporting every defect twice; they are one
measurement per edge now.

The check gained a third pass as well. Both of its passes measure a table that
has just been dealt, and iteration 3 is done when a deal can be *played*, so
the third plays one: twenty cards, tapped through the fan the way a player
taps them, failing if the deal never reaches a result or if anything throws.

**What the review found, and the rule that comes out of it.** Every new
assertion fired when its defect was constructed — and the review still found
four defects in the page, three of them serious. All three were in **states the
check never rendered**:

- *A completed trick was never drawn.* `gioca` resolves a trick and clears
  `state.played` in the same call, so a table that renders straight from the
  engine blanks both cards the instant the second one lands, and the sweep
  animates two empty boxes. You could never see what your opponent answered
  with, for twenty tricks. The table keeps its own copy of the pair until the
  sweep is over now, and the deal pass waits for both slots to be full after
  every play.
- *A declaration was clipped, half a line off the top and half off the bottom,
  at every phone width* — and set at 13px, under the check's own 14.5px floor
  for a sentence. Two assertions would have caught it and neither ever ran,
  because no pass ever showed an announcement. It is a toast over the top of the
  table now, out of the card budget entirely, free to wrap; the strip holds the
  raised card's name, which is three words. There is a screen row for it, and
  the audit gained a vertical clipping rule — the horizontal one could not see
  it, because the element that clips is not the element that holds the text.
- *Your own name plate hung 15px below the fold at 770x1475*, one of the
  check's own nineteen viewports, while the table pass printed `pass`: it
  measured your hand, and in portrait the plate is *below* your hand. The cause
  was the last hand-set number in the budget — `--plates: 76px`, carried over
  from Discola — against two plates that cost 120px there, because `--t-pick`
  is expressed in vw. It is derived from the plate's own type now, the plate's
  height is set from the same token, and the fold is measured from your whole
  seat.
- *The keyboard could raise a card the follow-suit rule forbids, and throw on
  the second press.* The pointer cannot: an illegal card is a disabled button.
  The rule lives in `tapped` now, where both paths meet.

Two of the new assertions were also blind in ways only a break could show. The
step floor was `min(24px, .4 of a card)`, which is inert below a 60px card:
landscape cut from `.7` to `.42` — a 40% loss of the strip at the tightest
viewport — passed the whole check. And every raised-card measurement was taken
on the tick that *starts* the transition, so it read the unraised box; a raised
card that hung off the bottom of the screen passed too. The floor is two terms
now (the step matches `--strip`, and the strip is either 24px or at least the
`.45` the design gives portrait), and the measuring passes run with motion off.

The same trap caught the fix for the dimming. The assertion written with it —
dimmed cards must be exactly the forbidden ones — passed against the very break
it was written for, because the table pass measures a freshly dealt hand and the
first deal of a session is always yours to lead: nothing is forbidden, and it is
never the opponent's turn. It asks for both states now, the way it already asked
for a raised card.

**So the rule iteration 3 adds to the two from iterations 1 and 2:** an
assertion only ever sees the states the check renders. Three of these four
defects were invisible not because the assertions were weak but because nothing
ever put the page into the state that shows them. A new state — a finished
trick, a declaration, a hand that is not yours to play — needs its own row or
its own pass, and adding the state is the harder half of adding the assertion.

### 4 — Result and sheets (1 day) — done

The result dialog, the declarations line, the start, settings, history and
about sheets, the confirm scrim, keys, sound, the easter egg.

**Done when** a deal can be played end to end, abandoned with the confirm,
and shows up in history with the right score.

Decision 4 was confirmed by the owner before this iteration started: accusi
stay as §0 has them, from the ten dealt and announced automatically.

The sheets are Discola's, forked with the stylesheet in iteration 3 — the CSS
for chips, decks, fields, prose, tally, log, scrim and result was already in
the sheet and only the markup and the plumbing were missing. What changed for
this game: the history counts *mani* rather than *partite*, because a partita
here is one deal (§0, decision 3); the result dialog gained a line for the
declarations, since they are scored on top of the eleven points and the two
numbers alone cannot say where the extra came from; and the settings sheet
discloses eleven weights, with a note that the last seven tricks use none of
them: `CODA_FROM` is 13, so the search takes over at trick fourteen, and three
documents and the settings sheet all still said "the last two" from before
iteration 2 moved it.

**The result's note is computed, not chosen from a list.** It scores the deal
again without the last trick's point, and again without the declarations, and
says whichever one changed hands — "L'ultima presa ha deciso la mano", "Hanno
deciso gli accusi, non le prese" — falling back to the margin. A phrase that
can be wrong about the deal it describes is worse than no phrase.

**The easter egg had to move.** `6winouj64ie` has four digits in it, and at
this table every digit from 1 to 9 and 0 plays a card: in Discola the three
card keys left 6, 4, 9 and 0 free to fall through to the buffer, and here
nothing falls through. Letting the digits do both would play cards while you
typed the word, and a misplay costs the deal — the same reason a tap raises a
card rather than playing it. So it is typed away from the table, on the start
sheet or over a sheet, and `state.cheat` survives into the deal. The check row
that types it is what found this: it failed on the good page, which is the
only reason anyone knew.

**What the review found: ten defects, and none of them in a break.** Every one
of the ten new assertions fired when its defect was constructed, and the review
still found four paths into a broken table, three ways a dialog could sit over
the wrong thing, and a stale claim in four documents. The pattern held: they
live in states nothing rendered.

- *"Nuova mano" plus "Abbandona" dealt a hand behind the start sheet.* The
  discard went to the start sheet and **then** dealt, so a live deal ran behind
  it with the opponent leading into a table nobody could see or play. Worse,
  the new assertion for it demanded the start sheet from a button labelled
  *nuova mano* — it passed *because of* the bug. Discarding a deal and leaving
  the table are two things now: `discard()` throws the deal away wherever you
  are going, and the caller decides where that is.
- *A deal abandoned during the 420ms sweep left the sweep behind.* Its two
  classes animate `both`, so their end state — transparent, 70px away — is held
  until something removes them, and the removal was one of the callbacks the
  epoch bump cancels. Every trick of the next deal drew into two invisible
  boxes, for twenty tricks, while follow-suit dimming forbade cards nobody
  could see. It is iteration 3's "the trick was never drawn" coming back
  through a door the check did not open.
- *The card keys reached the table through the abandon dialog.* `Enter` is what
  you press to answer a dialog whose safe button has focus — and on the way
  through it played the raised card. That is the exact misplay the two-tap
  design exists to prevent.
- *The result dialog opened over whichever sheet was in front*, and "Ancora"
  dealt the next hand behind it: a deal running under a history list still
  saying no hand had ever been played. It also left the abandon confirm open
  underneath, asking whether to throw away a deal that was over and had just
  been written down — the one state where that dialog's promise, that nothing
  is recorded, is false.
- *A play that landed before the sweep ran cancelled it*, because `later` owns
  one timer and you are on turn the moment you win a trick. Sixteen plays in
  twenty left the table painting the **previous** trick. The assertion that was
  supposed to own this asked only that both slots were full — which the stale
  pair satisfies. It asks for the card you just played now.
- *The result's note claimed things the code never looks at.* Two of its five
  branches described how the opponent had played his cards — "ha tenuto i tre e
  i due fino in fondo" — from nothing but the margin, and one of them was the
  default in 312 of 400 deals. The table counts tricks taken now, one per
  sweep, so the note can say the one true thing the two totals do not: that you
  took more tricks and lost anyway.
- *The settings row opened the weights disclosure after the audit had run*, so
  the state it existed to render was never audited. A row's `check` runs after
  the rules, not before them.
- *A history entry written by something else took the sheet down* — and with
  it the button that clears the history, so there was no way out from inside
  the game. `loadHistory` drops what it cannot draw.
- *`CODA_FROM` moved to 13 in iteration 2 and four texts did not follow it*:
  `CLAUDE.md`, this document, the settings sheet and Valerio's dossier all said
  the opponent solves "the last two tricks". It is the last seven, from trick
  fourteen.

**And two of the assertions written for those fixes passed their own breaks
first time**, which is the iteration-3 rule in a third shape. One *waited*: it
asked that the trick show the card just played, with a four-second
`waitForFunction` — and the stale trick clears itself when the opponent
answers, half a second later, so the wait watched the defect go by and called
it a pass. It does not wait at all now: the card is on the table the moment you
play it, or it is a defect. The other measured *after the page had healed*: it
looked at the abandoned sweep after playing a card into the new deal, and
playing flushes the sweep, so it was watching the repair rather than the fault.
It measures the freshly dealt table, before anything lands on it.

So: **an assertion that waits, or that looks after the page has had a chance to
put itself right, passes on the defect it was written for.** Both of these were
written *with* their fixes, by someone who knew exactly what the defect was.

**And the same lesson as iteration 3, immediately.** The face-up table had
never been rendered by the check before this iteration; the row that renders
it found `#cheatNote` sitting at 11.2px, under the 12.5px floor, where it had
been since iteration 3. Six new assertions, six breaks, all caught: no
recorded deal, no confirm before abandoning, an abandon that stays on the
table, a result dialog whose numbers disagree with `scoreDeal`, a history log
at 11px, and dialog buttons 20px tall. The abandon-confirm screen row needed a
check of its own on top of the audit — a page that never asks just deals
again, and a fresh table is a perfectly good screen to audit. Eight more went
in with the review's fixes, each against its own break.

### Defects found by playing iteration 4 — issues #6 and #7

§7.6's half of the work, and it found in one sitting what nineteen viewports
and five decks could not.

**#7 — a card could not be tapped where it looked free.** The hand keeps its
holes all deal, and each slot is pulled left over the one before it, so an
empty slot sits *on top of* the card to its left. An empty slot is a button,
and a disabled button swallows a click rather than passing it on, so every tap
aimed at the part of the card underneath did nothing. It got worse as the hand
thinned, which is backwards: a card whose right-hand neighbours have been
played looks entirely free and could only be touched on its leftmost strip.
`pointer-events: none` on an empty slot, and the tap falls through to the card
under it.

The state is "a hand with holes", which does not exist until several tricks
have been played — and every pass measures a table that has just been dealt.
The deal pass plays twenty cards and still never *looked* at the hand between
them: it drove the table without reading it. It checks now, after every play,
that the middle of each held card's uncovered part belongs to that card. On
the page as it was, the deal stops after fifteen cards.

So the rule gains a clause: **a pass that drives the page is not the same as a
pass that reads it.**

**#6 — the two-tap raise was awkward.** Not the target — a raised card takes
`z-index: 3`, so its whole face is free — the *state*: at `translateY(-18%)`
the card moved less than the width of the strip it came out of, so the second
tap read as a repeat of the first. It lifts 40% now, brighter and clear of the
fan, and the line above the hand says *Gioca il tre di spade* rather than
naming the card. Drag-and-drop was considered and declined: the keyboard path
needs the raise whatever the pointer does, so a drag would be a second way in
rather than a replacement, and a fan of ten overlapping cards is a poor drag
source. Both halves are asserted — the lift is at least .3 of a card, and the
line says what the next tap will do — and both fail on the page as it was.

### 5 — The opponents (1 day) — done

Four weight vectors, tuned by self-play to the acceptance numbers and to feel
different. Dossier text. The weights disclosure. The README table.

**Read this before starting, because iteration 2 found the hard part.** Six of
the eleven weights barely move a play. Iteration 2 tuned Valerio and then
sketched the other two temperaments straight from the prose above — Graziano
loose, Franco tight — and measured how often each pair chooses a different
card, over 600 deals, counting only positions with more than one legal move:

| pair | choices that differ |
|---|---|
| Graziano vs Franco | 14.8% |
| Valerio vs Graziano | 13.7% |
| **Valerio vs Franco** | **1.0%** |

Franco is Valerio ninety-nine times in a hundred, with six weights moved hard:
the control penalties from 2.5 to 6, the guard from 1.5 to 5, ace-exposed from
3 to 8. Those are exactly the weights an ablation over 6,000 deals could not
distinguish from zero. Almost all the character on offer is Graziano's, and it
comes from the handful of weights that do move plays: the liscio bonus, the
sure bonus, and the two terzi weights.

So tuning cannot produce four characters out of this formula, because tuning
moves the same weights. That leaves three honest ways out, and it is a decision
rather than a task:

- **Give the formula a term that expresses "tight."** Franco's identity is
  holding control cards back and guarding assi, and neither penalty changes an
  argmax at any magnitude. This is a formula change, so it belongs here, before
  v1.0 freezes it — §3.4's contract says so in as many words.
- **Ship two characters and two variations**, and say so in the dossier rather
  than claiming four.
- **Find out whether a tuned Franco separates further than a sketched one.**
  Cheapest first step: tune Graziano and Franco against each other for
  *difference* rather than for strength, and measure the same table again. If
  the gap stays near 1%, the first option is the only one left.

The sketches those numbers come from are in iteration 2's pull request, not in
the repo. They are two points far enough apart that if character cannot
show between them it cannot show at all. But they are sketches, and a tuned
pair is the measurement that settles it.

**Done when** the four beat the baselines, none dominates another, and each
has a one-line character you can recognise across a few deals — or, if the
measurement above says that is not reachable with eleven weights, when the
decision taken instead is written into §0 and the dossier tells the truth.

---

**What happened: the roster is three, and character is bought with one weight.**

Dropping Valerio (§0, decision 5, taken by the owner during iteration 4) removed the pair that was 1.0% apart, and Franco kept his
weights, so the house standard is the same player under the name that stayed.
That left the real question: can Graziano be told apart from Franco without
being a worse player?

The answer is measured rather than argued. One weight at a time, moved off
Franco's value, 100 seeds mirrored against greedy-take:

| `LEAD_LISCIO_BONUS` | vs greedy | choices differing from Franco |
|---|---|---|
| 12 (Franco) | 90.0% | — |
| 9 | 88.0% | 2.6% |
| 7 | 74.0% | 15.9% |
| 5 | 69.5% | 23.7% |
| 3 | 64.0% | 24.4% |

| other weights, at their extremes | vs greedy | differing |
|---|---|---|
| `TAKE_TERZI_WEIGHT` 5 (from 1.5) | 85.5% | 3.0% |
| `SPEND_CONTROL_PENALTY` 0 (from 2) | 82.0% | 6.8% |
| `DISCARD_GUARD_PENALTY` 0 (from 1.5) | 90.0% | 2 choices in 3,437 |
| `DISCARD_GUARD_PENALTY` 3 (from 1.5) | 90.0% | **none at all** |

The conclusion drawn from that table was **wrong**, and the review of this
iteration caught it: the ladder had not priced `LEAD_LONG_SUIT`, the one weight
iteration 2 set to zero. It is the cheap lever, and it is a switch rather than a
dial — 0.5, 1 and 1.5 play identically, because the term only reorders which
liscio is led:

`SEED_FROM=5001 node tools/selfplay.mjs --try … 600`, 1,200 mirrored deals a
row, and `SEED_FROM=5001 node tools/selfplay.mjs franco greedy 600` for the
baseline. Re-measured on the shipped engine after `rngSeed` was given its
warm-up, which moved every one of these by a few tenths:

| from Franco | vs greedy | differing |
|---|---|---|
| Franco himself | 85.0% ± 2.0 | — |
| `LEAD_LISCIO_BONUS` 8 and three other weights moved | 80.8% | 15.6% |
| `LEAD_LONG_SUIT` 0.5 | 85.8% | 16.8% |
| `LEAD_LONG_SUIT` 0.5, `LEAD_LISCIO_BONUS` 8 | **86.1%** | **21.9%** |
| `LEAD_LONG_SUIT` 0.5, `LEAD_LISCIO_BONUS` 7 | 84.8% | 26.7% |

Half again the difference for none of the cost: the weight iteration 5 tuned
along buys 15.6% of plays for 4.2 points of win rate, and the one it never
priced buys 21.9% for nothing measurable at all. So the honest version:
**this formula has about two and a half levers, not one** — the long suit, the
liscio bonus, and a little from spending and taking — and the first tuning pass
found one of them and concluded there were none. The guard penalty moves two
choices in 3,437 at 0 and none at all at 3, which is iteration 2's ablation
confirmed a second way; seven of the eleven weights are like that.

The owner chose from the corrected curve: a Graziano who plays another game
rather than a worse one. And once the corrected curve had two levers on it,
**the roster went back to four**: two weights make four corners, and there is a
player in each.

| | opens the long suit | keeps its lisci | |
|---|---|---|---|
| Franco | no | yes | the house standard |
| Graziano | yes | no | |
| Piero | yes | yes | rolled per session |
| Valerio | no | no | the loosest |

Valerio is the vector this iteration first shipped as Graziano, under the name
iteration 4 retired. He went because iteration 2's sketch of him chose Franco's
card 99 times in a hundred; he is back because this corner is a different
player by measurement — 15.0% from Franco and 26–28% from the other two.

On seeds 5001+, which the tuning never saw, 500 mirrored deals each:

| | vs random-legal | vs greedy-take |
|---|---|---|
| Franco | 86.6% | 84.8% |
| Valerio | 87.6% | 80.6% |
| Graziano | 88.4% | 86.8% |
| Piero (this session) | 86.8% | 81.8% |

and the pairs, from `SEED_FROM=5001 node tools/selfplay.mjs --differ 200` —
1,600 deals, counting only the decisions the weights make:

| pair | choices that differ |
|---|---|
| Valerio vs Piero | 28.0% |
| Valerio vs Graziano | 26.2% |
| Franco vs Piero | 25.2% |
| Franco vs Graziano | 21.6% |
| Franco vs Valerio | 15.0% |
| Graziano vs Piero | 11.6% |

and §3.4's second clause, which nothing had measured until the review asked:
head to head the six pairs run 42.2% to 59.6% — characters, not tiers.

**The acceptance floors moved, and that is the part worth reading twice.** The
first version of this iteration had a quarter of its rolled Pieros under the
greedy-take floor, and the plan answered by reinterpreting the contract in a
distant paragraph rather than amending it. The review's second round then found
that re-tuning Piero could not fix it either, because the floor was not
measuring the player: `node tools/selfplay.mjs --piero 12 400` puts twelve
rolls of twelve *under* 85% against random-legal, and `SEED_FROM=90001 node
tools/selfplay.mjs --piero 8 500` puts eight of eight *over* it. 85% was never
a floor this roster stood on — Franco clears it by a third of his own error
bar. So the contract was amended out loud, from 85%/80% to 82%/78%, with the
measurement table §3.4 now carries. The floors are a regression guard; the
table is the claim.

Piero's four deciding weights are drawn from bands of their own — narrow enough
that he keeps his corner, wide enough that they are still drawn — because
rolling him across the whole of `PIERO_RANGES` put him 98.4% onto Graziano's
card once and 7.1% from Franco another time. A corner of weight space is not a
promise about plays.

**What the bands cost**, which the second review round had to ask for because
the first version of this record only said what they buy. The control is a copy
of `engine.js` with `rollPiero`'s stance lookup removed, run on the same seeds:

| `SEED_FROM=90001 … --piero 8 500` | vs greedy-take | away from Franco |
|---|---|---|
| bands on, as shipped | 82.2–85.2% | 19.9–24.2% |
| bands off, all eleven wide | 83.8–87.4% | 5.6–21.1% |

About two points of win rate, for a floor under the thing the corner is for:
one roll in eight without the bands came out **5.6% from Franco**, which is
Franco under another name, which is what retired the name Valerio in the first
place. With the bands he still clears §3.4's floors, so it is a trade and not a
cost.

**What the draw costs, measured rather than claimed:** the seven weights drawn
wide are mostly the inert ones, so his sessions vary less than the dossier used
to promise. Over twenty rolls — `SEED_FROM=90001 node tools/selfplay.mjs
--piero 8 500` and `node tools/selfplay.mjs --piero 12 400` — he runs 80.5% to
85.2% against greedy-take and 18.9% to 24.3% away from Franco, and in the
twelve-roll run five sessions fall into two groups identical to the decimal.
"You never play the same Piero twice" is true of his weights and only half
true of his play, and the dossier says the smaller thing now — at the second
attempt. The honest sentence was twenty characters longer than the dishonest
one, ran to a fifth line on a 360px phone and pushed the deck row 15px down,
and the check said so before anyone had to see it.

**A fix can orphan a measurement**, which is the second round's own
contribution to that rule. Warming `rngSeed` changed which deals seeds 5001+
produce, so every figure in the lever table above — the exhibit this whole
round turns on — stopped reproducing from the command printed beside it, by two
to ten tenths of a point. Nothing about the argument changed and the table now
reads better than it did, but nobody re-ran it: the fix and the table were in
the same commit and neither mentioned the other. A measurement is coupled to
the code that produced it, and a change to an rng is a change to the code that
produced every measurement.

**And what the review of this iteration is worth writing down**, beyond the
numbers it corrected. Every measurement in the first version was real; the
conclusion drawn from them was not, because the ladder had a hole in it and
nobody asked what was missing from the list of weights it priced. Two smaller
habits went with it: the difference metric counted 31% of decisions in which no
profile *can* differ — everything from `CODA_FROM` on, where the search answers
— so every figure it printed, including the one in a dossier, was 1.45 times
too small; and the comment defending its denominator said "about half of all
decisions have one legal card" when the measured number is 15.3%, three times
smaller. Neither was a lie anyone told: they were numbers written from
intuition beside numbers that had been measured, and they read exactly alike on
the page.

So the rule that comes out of iteration 5: **a measured number and a
remembered one look the same in a comment.** Every figure in this document that
is not followed by how it was obtained is a claim, not a measurement.

**The fixture grew with the roster.** Twenty deals each for the three fixed
players, sixty in all, plus every weight of all four — Piero's rolled eleven
included, so a change to his ranges or to the order they are drawn in moves
numbers nobody wrote by hand and the test says so. Re-recording is a command
now rather than a script someone writes twice:
`node tools/selfplay.mjs --golden > tools/golden.json`.

### 6 — Ship (½ day) — done

Netlify site. README with the rules as played and provenance. `SPEC.md`
written from this document and what actually got built, including the
"known gaps" list.

**Done when** the live URL plays and the handover document would let a
stranger take the project over.

The site was already connected by the owner during iteration 4, which is why
every pull request from #5 on carried a deploy preview — and those previews are
where both of iteration 4's defects were found. `netlify.toml` publishes
`public/` and nothing else, so this document, `SPEC.md` and `CLAUDE.md` are not
on the web; that is Discola's lesson, where publishing `.` served a private
repo's `SPEC.md` and `ROADMAP.md` to anyone who guessed the names.

`SPEC.md` is written for a stranger and says the things this document says only
in passing: the engine contract, the two weights that make the roster, where
every number came from, the five rules the reviews bought, and the known gaps —
the unsaved deal in progress, the 28ms search, Piero's thin variety, and the
seven weights that move almost nothing.

**One thing this iteration could not check itself.** The live URL is not
reachable from the container the work is done in — the network policy denies
it — so nothing here can assert that production plays. The owner played it and
confirmed it does, which is the only way that box could be ticked from inside
this project, and is worth knowing for the next thing that wants to check a
deployment: the check that runs here asserts the directory `netlify.toml`
publishes, and a human asserts the URL.

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
> first, then `diegoami/discola-web` (`CLAUDE.md`, `SPEC.md`,
> `public/index.html`, `tools/check_ui.mjs`, `.claude/skills/ui-check`), then
> the previous iteration's pull request. Work on a branch named
> `iteration-N-<slug>` off the default branch. Stop at the iteration's "Done
> when": do not start the next one. Finish with every check green, commit,
> push, and open a pull request with the description in §7.4.

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
| 5 The opponents | medium | the harness does the work; the builder reads numbers |
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
- **A pull request does not merge while its review is still running.** Added
  after iteration 5 merged with its review in flight and the review then found
  the iteration's central conclusion wrong — a table with a hole in it, which
  the next pull request had to undo and redo. If the owner asks to merge and a
  review is out, say so and what the last reviews found, and let them decide
  with that in hand. The review is part of the work, not a formality after it.
- **Commit messages** as in Discola's history: one line saying what changed
  and why, in English, imperative mood, no ticket numbers.

### 7.5 What outlives a session

Nothing lives in a session's memory. Anything learned goes into one of three
files: a decision into §0 of this document, a rule the builder must follow
into `CLAUDE.md`, and everything a stranger needs into `SPEC.md`, which
iteration 6 wrote. If a session ends with something only it knows, that is a defect
in the handoff.

**Discola is a moving reference, not a fixed one.** It is a live repository
with its own sessions, and it moved twice during iteration 0 alone. Anything
forked from it is a snapshot with a date. When an iteration forks from
Discola, it records the commit here and in its pull request, and the next
iteration that forks checks for movement first.

| Forked | From Discola at | By |
|---|---|---|
| decks, tools, skill, `netlify.toml` | `44363d8`, re-synced to `22c4b9c` | iteration 0, `3e8198d` and `106584f` |
| CSS and table markup | `22c4b9c`, still Discola's head when iteration 3 forked | iteration 3 |

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
