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
public/decks/*      six sprite sheets: five byte-identical copies from discola-web,
                    and Bresciane, imported and photographic, hence .jpg
public/fonts/*.woff2  Bodoni Moda and Barlow, latin subset, so the page needs no network
public/icons/*.png  the tre di coppe, for the tab and the home screen
assets/*.png        the same icon at 1024, the launcher's source, not served
tools/check_ui.mjs  the UI check, forked from Discola and extended for the fan (§3.7)
tools/engine.test.mjs  unit tests on node --test, no dependencies
tools/selfplay.mjs  headless matches: profile vs profile, vs baselines; the tuning loop
tools/serve.mjs     public/ over http, for what file:// cannot do
tools/make_icons.mjs, tools/import_bresciane.mjs  the two asset makers
tools/package_release.mjs, tools/publish_release.mjs  the APK and the exe, built and released
tools/pack_cards.py the packer, carried over unchanged in case a deck is ever repacked
mobile/             the Capacitor wrapper: webDir ../public, no build step (ANDROID.md)
desktop/            the Tauri wrapper: frontendDist ../../public, no build step (DESKTOP.md)
netlify.toml        publish "public", cache decks/* for a year, revalidate index.html
package.json        the scripts, and playwright-core as the one dev dependency
CLAUDE.md, README.md, SPEC.md (when built), ANDROID.md, .claude/skills/ui-check/
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
hands[2][10]       BASSO = 0 (you), ALTO = 1 (them); null = empty slot.
                   Never reordered: a slot is a card's identity. §3.7.
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
voidAt[2][4]       where the tallone stood when each of those was shown, so
                   the opponent can weigh a void by how much they have drawn
                   since; -1 is "never shown"
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
  inference Tressette is played on; Briscola never had it — and while the
  tallone lasts it is a fact with a shelf life, because every card they draw
  afterwards may be the suit they just showed out of. It is not dropped on the
  first draw and not believed whole either: `voidAt` records when it was
  shown, and the term is scaled by

  ```
  p = (1 − unseen of that suit / unseen)^(draws they have taken since)
  ```

  which is 1 the moment it is shown and decays toward nothing. Past the
  tallone nothing is drawn, p stays 1, and a void is permanent — which is
  where this term does most of its work, and is the same rule a player is told
  on the about screen.

**Leading** — the question is which suit to open and how high.

```
v = terzi(c);  s = suit(c);  late = min(1, tricks / 10);  k = 1 + late × LATE_FACTOR
sure(c):              score += LEAD_SURE_BONUS × k
liscio (v == 0):      score += LEAD_LISCIO_BONUS
                      score += (cards held in s − 1) × LEAD_LONG_SUIT
asso not sure:        score −= LEAD_ACE_EXPOSED_PENALTY × |controls(s) above the asso|
3 or 2, not sure:     score −= LEAD_CONTROL_PENALTY × k
voids[BASSO][s]:      score −= LEAD_INTO_VOID_PENALTY × p  (p: still void, above)
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
| LEAD_INTO_VOID_PENALTY | do not feed a suit they have shown void, scaled by how likely it still is |
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

**A hand is held sorted**, by suit and, within a suit, from the strongest card
down — which is how a hand is held away from a screen, and the change the owner
asked for after the game shipped. Two things follow, and both matter more than
the sorting does.

The first is that the engine does not sort. A slot is a card's identity:
`mosseLegali` answers in slot indices, `gioca` takes one, and `compGioca`
breaks ties on the lowest of them, so a hand that reordered itself would move
all three under their callers and change which card the opponent plays — which
is the golden fixture's whole subject. `ordinaMano(hand)` returns the slots in
the order the fan shows them and touches nothing; the page is its only caller.
It lives in the engine anyway, because the order is a fact about Tressette's
rank order, which is `rango`, and because the tests can then hold it to that.

The second is that a sorted hand closes up. Holes are an artefact of a
ten-long array, not of a hand, so the fan shows only the cards in it and the
empty slot — the subject of issue #7 — no longer exists inside a hand. The
button is a *place* in the fan rather than a card, which is why it carries
`data-slot` and reads it on the click instead of closing over its index, and
why the number keys count places: `1` is the leftmost card you are holding,
and a hand of six has no `7`.

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
every number came from, the seven rules the reviews and the breaks bought, and
the known gaps — the unsaved deal in progress, the 28ms search, Piero's thin
variety, and the seven weights that move almost nothing.

**One thing this iteration could not check itself.** The live URL is not
reachable from the container the work is done in — the network policy denies
it — so nothing here can assert that production plays. The owner played it and
confirmed it does, which is the only way that box could be ticked from inside
this project, and is worth knowing for the next thing that wants to check a
deployment: the check that runs here asserts the directory `netlify.toml`
publishes, and a human asserts the URL.

**Total: 7–8 days**, with the opponent the one estimate that can slip.

### After it shipped — the hand is held sorted

The owner, playing the shipped game: a hand must always be sorted by suit and,
within a suit, from the strongest card down. §3.7 has the design; this is what
the work found.

**The sort is in the page, not in the engine.** The tempting version — sort
`state.hands[who]` — moves a card's slot, and a slot is what `mosseLegali`
answers in, what `gioca` takes, and what `compGioca` breaks ties on. Sorting
the array would have changed the opponent's play in every deal and invalidated
the golden fixture, to make a hand look tidy. `ordinaMano(hand)` returns slot
indices in fan order and mutates nothing; the engine never calls it.

**Five deliberate breaks, per rule 1, and the fifth is the one worth writing
down.** No sort at all, the holes kept in the fan, the ranks ascending, and the
click closing over its build index instead of reading `data-slot` — all four
were caught, three of them by the new assertion naming the exact place in the
fan where the order went wrong.

The fifth was the number keys indexing slots instead of places in the fan,
which is the defect this change most obviously invites, and **the check passed
it**. The keyboard assertion that existed was one-sided: it pressed the key of
a card the follow-suit rule forbids and asserted that card was *not* raised. A
keyboard indexing the wrong thing satisfies that by raising a different, legal
card. An assertion that can only fail one way cannot see a defect that moves
sideways, so there is a second one now — press a key, and the card raised must
be the card at that place — and the break fails it by name.

That is rule 1 earning its keep on an assertion written the same afternoon, and
it sharpens what rule 1 is for: **an assertion has to be broken in the
direction the change can actually go wrong**, not in the direction that is easy
to break. Four of these five breaks confirmed what the new assertions were
written to catch. The fifth found a hole in an old one.

**And then the new assertion broke the pass it lives in.** It pressed a key and
left the card raised, and a raised card is scaled and on top of its neighbours,
so the pointer tap that followed landed on a card the page thought was already
chosen and the reachability rule then found the raised card sitting in front of
the one it was aiming at. It failed on some deals and passed on others, because
whether it mattered depended on which card the sort had put next to which —
so the run before it was green and the run after it was not, on identical code.
Clearing the selection after the assertion fixes it, and three consecutive runs
on three different deals are green.

**And the review found the regression none of that caught.** A hand that closes
up ends the deal with nothing in it, and a flex row with nothing in it is zero
tall — so the table re-centred itself twice in the last trick, moving the
player's own hand **74px up at 393x852, 101px at 1440x900, while they were
choosing the card that decides the deal**. `min-height: var(--ch)` on `.hand`
fixes it, and the numbers go back to the ones `main` measures exactly.

It is §7.7's oldest rule arriving from the other side. §7.7 says
a row that costs nothing while empty moves every card below it the moment it
fills; this was a row that had cost something all deal and then stopped. And it
went unseen for the usual reason: `measure()` runs on a table that has just
been dealt, and the deal pass reads the hand's *order* after every play but
never its geometry. **An assertion only ever sees the states the check
renders** — the third rule, on the change that retired the second half of the
seventh. The table pass empties both hands and re-renders now, at every
viewport and in every deck, and asserts the three rows have not moved.

The same review found three more, each one line: the fan never compared a
card's *picture* to the slot it names, so a render painting its neighbour's
face passed everything, because the click, the reachability rule and the deal
pass all go by the name; the keyboard-place assertion fired once a deal on
`legal[0]`, which when you lead is slot 0, and a slot-indexing keyboard is only
visible when a card's place differs from its slot — true of all but 10.0% of
dealt hands, so it would have missed its own motivating break one run in ten;
and a hidden place kept `aria-pressed="true"`, so a query for the raised card
could find a node with no slot to its name.

Which is a seventh rule, and the sharpest one the deal pass has taught:
**a pass that drives the page has to leave it as it found it.** The clause
issue #7 added to §4's iteration-4 record said a pass that drives the page is
not the same as a pass that reads it. This is the other half: a pass that
drives the page is also a pass that can *change* it, and an assertion whose own
side effect reaches the next assertion is not measuring the page any more. A
check that fails one run in three is worse than one that never fails, because the first thing anyone does with it is
run it again.

### After it shipped — the about screen says the rules, twice

Issue #13, from the owner. `RULES.md` had promised since iteration 0 that the
about screen would carry the Italian rules; it carries both languages now, in
short, and both documents say that the screen and the document are not
independent — a rule written twice in two places drifts.

**The prose is a statement about `engine.js`, and a false one reads exactly
like a true one.** No assertion can tell them apart and neither can a reviewer
who does not open the engine, which is why the two house rules this game does
*not* play were checked against the source before being written down rather
than after: following suit is compulsory from the first trick, not from when
the tallone runs out (`mosseLegali` filters on the led suit with no test on
`state.next`), and a hand is not worth one point or two by the margin — the
terzi are floored, the deck holds 32 of them, the ultima is worth 3, and 35 mod
3 is 2, so **the two scores always sum to exactly 11**. Both are real rules
somewhere, which is what makes them easy to write down by mistake.

**Each language is a `section[lang]`, and the check reads each on its own.**
"The rules are in both languages" asserted as *a `lang` attribute exists
somewhere* passes a page whose English paragraphs are tagged Italian — what a
screen reader and a hyphenator then go by.

**And the sharper half of the same lesson, which seven breaks found.** Six of
them — no `lang` on the English, both halves tagged `it`, the eleven points
cut, the English cut to four blocks, Back always going home, following suit cut
— failed by name. The seventh was the English half replaced by the Italian
text under an `en` tag, which is the defect the row exists to catch, and **the
row passed it**: every content probe was written to match either language
(`/undici|eleven/`, `/3, 2, (asso|ace)/`), which reads like thoroughness and is
the opposite. A probe that accepts either language cannot tell the two apart.
The table is per language now and the break fails four ways.

That is last round's rule arriving in a new place: **an assertion has to be
broken in the direction the change can actually go wrong.** Here the direction
was the one the assertion's own comment named.

**What the review then found, which no break would have.** The screen gave the
rank order, said there is no briscola, and never said **who takes the
trick** — the one rule a player cannot do without, and the one `REGOLE.md`
calls the first thing that surprises anyone coming from briscola. Nor that the winner
takes both cards' terzi, draws first and leads next, which left "i terzi di
ciascuno" with nothing to refer back to: the reader was told what cards are
worth and never told how one comes to hold them. A paragraph a side, checked
against `resolveTrick` before it was written. **A rule that is absent from both
halves is not drift, and nothing that compares the halves can see it.**

It also found the row could abort the run rather than fail it: the Back click
was unguarded, so renaming one attribute threw inside `page.evaluate` and took
the table, tight-token and deal passes with it — one missing attribute hiding
every other assertion in the file. A row reports; it does not decide whether
the rest of the check happens.

And one gap the seven breaks left: `section[lang="en"]{ display: none }` passed
every rule in the row, because every rule reads `textContent`, which a half
that is not painted still has. In a project whose defects are all invisible in
the diff and throw no error, that one belongs in the row, so each section has
to have a box as well as words.

### After it shipped — the divergences Discola made after the fork

Issue #15, from the owner: a list of six things `diegoami/discola-web` had changed
since this project forked its page, its tooling and its decks. Discola is a
moving reference — §7.5 said so — and this is the first time that cost
something to reconcile. Each item was verified against this copy before it was
adopted, and one of the six turned out not to apply.

**The fonts were the one that mattered, and the check could not see it.** The
three faces came from `fonts.googleapis.com`. Nothing fails when they do not
arrive: the browser falls back to a generic serif, the wordmark sets some 12%
narrower, and every threshold in the check is calibrated against metrics the
offline page never has — while the check itself always runs with the network
up. That is the project's own lesson in a new place: **the check measures the
states it renders**, and it had never rendered the page without a network. It
does now, with every non-`file://` request aborted, and the page carries its own
subset. The same pass asserts that no subresource comes from outside at all,
which is what makes "nothing leaves the device" a fact rather than a claim.

**A sixth deck is a sixth ratio, and a hard-coded five.** Bresciane is
photographic, so it is a JPEG and the two places that named a sheet had
`.png` written into them; the picker's `repeat(5, 1fr)` would have wrapped it
onto a second row and pushed the sheet's own controls down, quietly, in the one
place a player changes something. Both are now derived from the deck table.
The deck is also not 1997 art, and the about screen, the README and the SPEC
say so in the same breath as they name it — the provenance is part of the
sentence, not a footnote somewhere else.

**The dropdown defect is the shape this project keeps meeting.** A `<select>`
with `background: transparent` opens a popup the operating system draws, in
this page's ivory ink on the system's white ground: illegible on Windows,
perfect in every screenshot, and invisible to any assertion that measures a
box, because the popup is not in the document. The assertion that catches it
asks the only thing that decides it — whether the select and its options paint
an opaque ground of their own — and it was run against the broken page first.

**One of the six was already fixed here.** Discola's cards flashed back to full
view for a frame after a trick, because its sweep stripped the animation class
on a timer and emptied the slots in a later one. `flushSweep()` does both in the
same task, so there is no frame in between. A list of another project's fixes
is a list of *its* defects: the reconciliation is checking, not copying.

**And the packaging, which the fonts had been blocking.** Capacitor wraps
`public/` unchanged — no build step, `webDir` is the directory Netlify serves —
and a debug APK builds at 7.4 MB. At that point it had not been launched: there
was no device and no emulator image on this machine, and the offline behaviour
an APK exists to have is asserted by the fonts pass rather than observed.
`ANDROID.md` says so, and says which of the remaining steps are the owner's
because they are a secret or are outward-facing. (It has since been launched;
`ANDROID.md` §6 is where that stands.)

### After it shipped — the void that had stopped being true

Issue #21, and the first change to the opponent since v1.0. It began as a
player's question — the opponent discarded on a led bastoni and two tricks
later played one, which looks exactly like cheating — and the rules answer
that one: the tallone refills a hand, and the answer is now on the about
screen in both languages. The machine's half took longer, because the machine
was making the same mistake against the player.

`state.voids` was set when someone failed to follow and never cleared. The
opponent read it as current fact and led into that suit believing the trick
was free. Measured on the shipped engine over 480 deals: of 764 leads that
scored on a void, **552 — 72% — were stale**, the player having drawn since.

**The fix the issue asked for makes it play worse, and that is why this is
written down.** Dropping the void on the first draw is correct in the strict
sense and loses: 800 mirrored deals, the strict version against the shipped
one, **46.9%**, −0.24 points a deal. One unknown card rarely fills a suit, so
the stale flag was a decent guess and throwing it away costs more than the
occasional wrong lead.

So the flag decays instead of expiring. `voidAt` records where the tallone
stood when the void was shown, and the eleventh weight is multiplied by the
chance that no card drawn since was that suit. Three matches, Franco, 800
mirrored deals each:

| | wins | points/deal |
|---|---|---|
| believing it whole (shipped) vs dropping it on a draw | 53.1% | 6.17 vs 5.93 |
| decaying vs dropping it on a draw | 53.1% | 6.16 vs 5.94 |
| **decaying vs believing it whole** | **49.8% ± 3.5** | 6.04 vs 6.06 |

The last row is the one that decided it: the decay plays the same game as the
version that claimed certainty — they differ in 58 deals out of 800 — while
never claiming it. Strength was not the argument for the change; it was the
price the change was not allowed to charge.

**No twelfth weight.** p multiplies the eleventh, and is computed from what
the engine already knows — `fuori`, the set of cards not played and not mine.
§3.4 still names eleven and the settings sheet still shows eleven.

**And the exponent is not a weight either.** A later question — should the decay
exponent become a tunable "coefficient of forgetting", so a profile could be
credulous or suspicious by temperament? — was measured and rejected (PR #42).
Across exponents from "believe the void whole" to "forget fast" the opponent
plays the same card essentially every time, and only the instant-forget extreme
moves 2–4% of plays without making it stronger or weaker. A real style moves
about 20% of plays; the exponent is a belief about the world, not a preference,
so it would be a weight that cannot move a play — the same reason there is no
twelfth. `FORGETTING.md` and `tools/forgetting.mjs` hold the numbers and
reproduce them.

**And the eleventh was re-laddered, because its meaning changed.**
`LEAD_INTO_VOID_PENALTY` was tuned when the term always fired at full
strength; under the decay its average strength is lower, so its optimum could
have moved with it. A ladder at 300 seeds suggested it had — 87.0% at −4
climbing to 87.7% at −12 — and the suggestion did not survive being asked
properly. On held-out seeds at four times the sample:

| LEAD_INTO_VOID_PENALTY | vs greedy | vs random | differs from Franco |
|---|---|---|---|
| −4 (unchanged) | 86.7% | 87.1% | — |
| −8 | 86.7% | 87.2% | 3.6% |
| −12 | 86.3% | 87.3% | 4.0% |

1,200 deals each, all inside the harness's noise floor, which is the rule in
`SPEC.md` for calling a difference nothing. The weight stays at −4. This is
recorded because a recalibration that was checked and a recalibration that was
skipped leave exactly the same diff.

**The golden fixture was re-baselined**, the first time since it was frozen:
6 of its 60 deals and 332 of its 9,540 plays changed. That is the fixture
doing its job rather than failing — it exists to make a change to the
opponent visible, and the rule in §7.7 is that the formula does not
move without the owner deciding it should. This one was measured three ways
first and decided by the owner on the numbers.

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

### 7.1 One iteration per session, one implementer per harness

There is no orchestrator agent. This document is the plan and the owner
decides when each iteration starts.

Two harnesses work in this repository, each with its own process: **OpenCode** —
DeepSeek implements, Luna reviews — and **Claude Code** — Claude implements, and
each release is reviewed before its tag by a model that is not Claude (§7.4,
"A milestone is a release"). `AGENTS.md` and `CLAUDE.md` record those
processes, and §7.7 holds the rules both share. Neither harness applies the
other's process.

Each harness file is amended by its own harness: `AGENTS.md` through OpenCode's
process, `CLAUDE.md` through Claude Code's. A change to this document — §7.7 and
the shared facts in §7 included — goes through the process of whichever harness
makes it, like any other change.

Each iteration is one session, opened with:

> Do iteration N of PLAN.md in `diegoami/Tressette`. Read PLAN.md in full
> first, then `diegoami/discola-web` (`CLAUDE.md`, `SPEC.md`,
> `public/index.html`, `tools/check_ui.mjs`, `.claude/skills/ui-check`), then
> the previous iteration's pull request. Work on a branch named
> `iteration-N-<slug>` off the default branch. Stop at the iteration's "Done
> when": do not start the next one. Finish with every check green, commit,
> push, and open a pull request with the description in §7.4.

That opener was for iterations 0 to 6, which are done. A session since then
works on one issue or one change, and does not read this whole document first:
it reads §7 and §7.7, then the issue, then the sections of this document the
change touches. §7.7 says which files to read, and where the session works: in
a worktree of its own, never in the main checkout ("Who works where").

Why one iteration and not several: the defects this kind of page ships are
invisible in a diff and show up only in the check or at the table, and a
session that holds the whole of one iteration in context catches them. A
handoff in the middle of the fan or the opponent loses exactly that.

Why no orchestrator: the iterations are sequential and coupled — the table
needs the engine's API, the check needs the table's markup, the profiles need
the harness. At most a day could run in parallel, and an orchestrator would
never see the code. Subagents earn their keep in two places: read-only
exploration of Discola while the builder works, and the OpenCode reviewer
(§7.3).

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

Every change is reviewed from a **fresh context** — a session or subagent that
has not seen the work — at high effort, same tier as the builder. The harness
decides who reviews and when. OpenCode reviews every pull request, with Luna as
a cross-harness subagent (`AGENTS.md`). Claude Code reviews each milestone, a
release, before its tag: Claude opens a milestone issue holding the prompt, the
owner runs it in a model that is not Claude, and the reviewer answers there
with AGREE or BLOCK. Merges go on while it is open; only the tag waits
(`CLAUDE.md`). Fresh matters more than different: the builder cannot see its
own diff, and a reviewer that shares its context cannot either.

The reviewer is given three things: this document, the diff, and the check
output. The diff is a pull request's, or, at a milestone,
`<previous tag>..<candidate SHA>`. The check output is pasted into a pull
request, and a milestone reviewer produces it by running the gates itself. It
checks, in order:

1. the rules against §2, line by line — ranking, terzi, following suit, the
   ultima, the declarations, the draw order;
2. the opponent against §3.4 — the formula as written, the weights named as
   listed, no DOM or `Math.random` in `engine.js`;
3. that the UI check actually ran, on this commit, and that every assertion
   still names a defect (a new threshold with no story behind it is a
   finding);
4. the iteration's "Done when", item by item;
5. Italian on the page, English in comments and commits.

The reviewer reports; it does not fix. On a pull request, the builder fixes in
the same pull request, and the reviewer looks once more. A milestone's findings
are issues of their own, fixed in new pull requests, and the candidate moves to
the commit that fixes them. A finding the builder disagrees with goes to the
owner, in the pull request or the issue, not into a silent merge.

### 7.4 GitHub, at the lowest useful ceremony

- **One pull request per iteration.** It is the unit of work, review and CI.
  Its description has four parts: what was built; the iteration's "Done when"
  as a ticked list; the check output, verbatim; what was left out and why.
- **CI on every pull request**: the engine tests from iteration 1, the UI
  check from iteration 3. A red check does not merge. Nothing is skipped or
  quarantined to get to green.
- **A DESIGN issue per OpenCode change, and defect issues otherwise.** The
  OpenCode harness opens a DESIGN issue before implementing, and Luna reviews it
  there (`AGENTS.md`) — an explicit exception to "no issue per iteration". Claude
  Code has no design-issue stage. Otherwise, issues are for defects found by
  playing after an iteration has merged: label them `defect`. Each is closed by a
  pull request that fixes the page *and* adds the assertion that would have
  caught it, per the `ui-check` skill: the assertion is written against the
  broken commit first. This is how every threshold in Discola's check got its
  story.
- **A PR that completes an issue says so.** After the four parts, the body
  ends with a footer of one `Closes #N` line per issue the PR completes —
  design issue or defect issue. The footer is metadata, not a fifth part, and
  it stays outside the verbatim check-output block. A reference is a link;
  only the keyword closes. A PR that does not complete an issue (a first
  pass, a partial fix) adds no line for it.
- **No project board, no GitHub milestones.** The plan lives in this document,
  and a second copy goes stale. The DESIGN issue is the one issue a change
  opens, and it holds the design, not the plan. A milestone issue and the
  finding issues its review opens (`CLAUDE.md`) hold a release's review, not
  the plan.
- **A milestone is a release.** It is an annotated tag `vX.Y.Z` on `main`, on
  the exact commit the published release is built from, and nothing else: not
  a branch, a pull request, a proposal, a count of merged pull requests, or a
  change to a particular file. The binaries go to `diegoami/tressette-releases`;
  the tag goes on this repository's `main`, and the release notes name its
  commit. The independent review is per milestone and before the tag, never per
  pull request; the tag is placed on exactly the reviewed commit, and the
  release is built from the tag (`ANDROID.md` §4). Work merged after the
  candidate belongs to the next milestone. The owner may tag without a review,
  and the milestone issue then says so.
- **A pull request does not merge while its review is still running.** Added
  after iteration 5 merged with its review in flight and the review then found
  the iteration's central conclusion wrong — a table with a hole in it, which
  the next pull request had to undo and redo. If the owner asks to merge and a
  review is out, say so and what the last reviews found, and let them decide
  with that in hand. The review is part of the work, not a formality after it.
  A Claude Code pull request has no review of its own, so this rule does not
  hold it up. Its review comes with the next milestone's, and that review holds
  up the tag, not the merge.
- **Commit messages** as in Discola's history: one line saying what changed
  and why, in English, imperative mood, no ticket numbers. The pull request's
  title becomes that line when it is squash-merged, so the title follows the
  same rule. The `(#N)` GitHub appends to a squash merge is the only issue or
  pull request number a commit on `main` carries; a version or any other
  number that is part of what changed stays. The issues a pull request
  completes go in its `Closes #N` footer, not its title.

### 7.5 What outlives a session

Nothing lives in a session's memory. Anything learned goes into one of three
files: a decision into §0 of this document, a rule either harness must follow
into §7.7 of this document, and everything a stranger needs into `SPEC.md`, which
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
| self-hosted fonts, the fonts pass, `serve.mjs`, the Bresciane deck, the Capacitor wrapper and the two release scripts | `5307c14` | issue #15, after it shipped |
| the Tauri wrapper, its `Cargo.lock`, and the `desktop window` viewport | `8574702` | the desktop wrapper, after it shipped |

### 7.6 The owner's part

Start each iteration. Answer the two open defaults in §0 (declarations,
opponent names) before iteration 4 and iteration 5 respectively. Play the game
after iterations 3 and 5 — the harness measures strength, and only a player
can measure whether it is fun — and file what you find as `defect` issues.

### 7.7 Working rules

The rules every harness follows; read them before changing anything. Each
harness's file (`AGENTS.md`, `CLAUDE.md`) points here and adds only its own
process. This document is the architecture and the plan, and the reference for
anything these rules do not state;
[Discola](https://github.com/diegoami/discola-web) is the reference for
everything the plan does not state either; clone it beside this repo if it is
not already there.

**Read this much, and no more.** Normally inspect `public/index.html`,
`public/engine.js`, `tools/*`, the root `*.md`, `.github/workflows/*`,
`.claude/skills/*`. Normally ignore `node_modules/`, `.git/`, `public/decks/`,
`public/fonts/`, `public/icons/`, `assets/`, `dist-release/`, Gradle wrapper
files, `desktop/src-tauri/target/`, `desktop/src-tauri/icons/`, and any
binary. Read `package-lock.json` and `desktop/src-tauri/Cargo.lock` only when
dependencies are the task, and open files under `mobile/android/` individually
instead of walking the tree. Never read or paste `mobile/android/keystore.properties` or `*.jks`.
Ignoring a path here does not mean it should be deleted or gitignored.

**Change the smallest thing.** Prefer targeted reads and diffs to repeating
whole files: search first, then read the range you need, and show changes as a
diff (`git diff -- <path>`, `git show HEAD:<path>`) rather than reprinting a
file. Make edits with focused replacements instead of rewriting a file to change
a few lines.

**Keep command output short.** Prefer the repository's own commands over ad-hoc
exploration, and cap their output. On PowerShell:

```powershell
npm test 2>&1 | Select-Object -Last 20
npm run check 2>&1 | Select-Object -Last 40
node tools/selfplay.mjs 2>&1 | Select-Object -Last 20
gh pr view <n> --json title,state --jq .
```

On Windows PowerShell, run
`[Console]::OutputEncoding = [Text.Encoding]::UTF8` once per session before
any of them. The console defaults to an OEM code page, which turns the test
runner's `✔` into `Ô£ö`, and output pasted into a pull request is then not
the output the command printed. Saving output with `>` or `Out-File -Encoding
utf8` on Windows PowerShell 5.1 writes a byte-order mark, which lands in the
pull request as an invisible first character; paste from the console, or drop
the mark before pasting.

On bash, `| tail -40` instead of `Select-Object -Last 40`. Use `node --check
<file>` for a syntax check instead of running a script, and scope file searches
to source directories rather than searching from the repository root.

**Who works where.** One layout, for every session of either harness. `<main>`
is the main checkout, the parent directory of
`git rev-parse --path-format=absolute --git-common-dir`; here it is
`Tressette/`, and `<default>` is what
`git symbolic-ref --short refs/remotes/origin/HEAD` names (`origin/main`).

- **`Tressette/`, the main checkout, is the planner's or orchestrator's
  only.** No implementer or reviewer works there, and none checks out a branch
  or a commit there: no `git checkout`, `git switch` or `gh pr checkout`. Its
  branch and uncommitted files may be someone's work in progress.
- **A session opened in `Tressette/` may update it once, at startup, and only
  this way.** It runs `git fetch origin`; then it runs `git pull --ff-only`
  **only if** the checkout is on the default branch (`git symbolic-ref --short
  HEAD` prints the default branch name, `main` here) **and**
  `git status --porcelain` is empty. If either does not hold — another branch,
  a detached HEAD, or any uncommitted change — it leaves the checkout exactly
  as it is and tells the owner why. It never runs `git reset`, `git stash` or
  `git merge` there. An implementer then leaves `Tressette/` and starts its
  work from `origin/<default>` in a worktree of its own, as below.
- **Every session that implements works in a worktree of its own**, one per
  change, never in `Tressette/`. A Claude Code forked subagent uses the tool's
  own worktree isolation (`.claude/worktrees/`). Every other session, whether a
  new session the owner opened in `Tressette/` and asked to implement a
  feature, OpenCode, Codex, a headless session, or a worktree the main session
  makes, first runs `git fetch origin`, then makes its worktree beside the main
  checkout, from `origin/<default>`:
  `git worktree add --no-track -b <branch> <main>/../Tressette-work/<branch> origin/<default>`.
  If that branch or path exists, it adds a UTC stamp to both. It works only
  there, naming the worktree in every command, since a tool's shell may return
  to `Tressette/` after each command, and its first push is
  `git push -u origin <branch>`. Without `--no-track`, a branch made from
  `origin/<default>` tracks it (git's default), and a bare push would head for
  the default branch instead of its own. A Claude Code fork in the tool's own
  worktree is the one exception to making a worktree this way; it is never an
  exception to working outside `Tressette/`.
- **Every worktree installs its own dependencies** before any check runs in it,
  as the project's setup says (`npm ci`, then `npm run setup` if Chromium is
  missing), and never copies or links them from `Tressette/`. This holds for
  implementers and reviewers alike.
- **On Windows, `git config --global core.longpaths true` is a prerequisite**,
  since nested worktree paths can pass the path limit. The owner sets it on the
  machine; a session does not.
- **If it finds itself about to edit, commit or switch branches in
  `Tressette/`, it stops and makes the worktree first.**
- **After the merge, an implementer that is still running removes only the
  worktree it made** (`git worktree remove`) **and deletes its merged branch.**
  A reviewer removes only its own worktree, and only after it has recorded its
  verdict on the issue or pull request. A worktree whose session ended before
  cleanup, or one the owner made, is a leftover: the owner clears it (below),
  and no session infers which worktrees are unused.
- **Reviewers work in worktrees of their own**, one per review round, detached
  at the exact commit under review, under
  `Tressette-review/review-<first 12 of the SHA>-<UTC stamp YYYYMMDDTHHMMSSZ>`
  beside the main checkout. They fetch first, in this order: the exact full SHA
  (`git fetch origin <SHA>`), which brings an untagged commit even into a clone
  whose refspec leaves out the default branch; and, when the target is a pull
  request, `git fetch origin pull/<N>/head`. Only then do they check
  `git cat-file -t <SHA>` — a commit they cannot see is not missing until they
  have fetched — and only then do they create the detached worktree at exactly
  that SHA. A milestone candidate is a commit on the default branch, not a pull
  request, so its review does not use `pull/<N>/head`. They install the
  dependencies in their worktree before any check (`CLAUDE.md`'s milestone
  prompt spells the steps out).
- **The owner clears one leftover worktree at a time**, naming it exactly:
  `node tools/remove_worktree.mjs <path>`. It acts on exactly that one path and
  refuses a second argument, the main checkout, an unregistered or locked
  worktree, and any worktree with tracked changes or untracked files. It prints
  the exact path, the branch or detached SHA and the clean status, then requires
  the owner to type the exact path and to attest that no session is using the
  worktree before it runs plain `git worktree remove` — never `--force`, never a
  branch delete, never `git worktree prune`. It never selects by age and never
  batches. It proves the repository, path and cleanliness conditions only; that
  the worktree is unused is the owner's attestation, which the tool cannot make
  for itself.
- **In a cloud session**, the session's own clone takes the place of these
  folders; the fetch and commit checks still apply.
- **A session removes only worktrees it made.**

**Sessions and handoff.** Start a fresh session after a completed logical unit —
a merged PR, a finished fix, a documentation pass — or when a thread has grown
long. Carry forward a short handoff:

- **Completed:** what is now true (and any verification that ran).
- **Files / decisions:** the paths touched and the decisions made, with reasons.
- **Next:** the next task, or "nothing open".

Durable facts belong in the repository (this document, the docs, the PR body),
not in the conversation.

**After any UI change, run the UI check.**

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

**After any engine change, run the unit tests.**

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

**The card size is a budget, and it has two terms.** Discola's budget was height
alone. A hand of ten cards adds a width term, and `--cw` is the smaller of the
two:

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
this document are written against a broken fan before the good one.

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

**The engine is ours, and then it is frozen.** `engine.js` holds the rules and
the opponent as pure functions over a plain state object. Nothing in it touches
`document`, `window`, timers or `Math.random` — that is what lets Node run the
same file as the browser, which is what makes the self-play harness and the
golden fixture possible. Randomness arrives as an injectable `rng`,
`rollProfiles(rng)` included.

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

**The about screen says the rules, and says them twice.** It is the one screen
here that is *read* rather than glanced at, and it carries the rules in Italian
and in English — `RULES.md` and `REGOLE.md` are the long form, this is the short
one, and the two are not independent: a rule stated twice in two places drifts,
so a change to one is a change to both.

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

**Conventions.**

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

**Principles.**

- Reproduce every finding before acting, and your own claims before publishing
  them. When a check fails, suspect your harness first.
- For each passing check, say what it would have caught had the code been
  wrong — never let implementer and reviewer share a blind spot.
- A passing test is not a working feature: assert what a person would notice.
- A threshold from one measurement is a coin toss.
- Flag out-of-scope defects rather than fixing them silently.
- Show diffs, not whole files.

**Gates.** The canonical local commands, and what CI runs:

| gate | local | CI |
|---|---|---|
| unit tests | `npm test` | `node --test 'tools/**/*.test.mjs'` (`.github/workflows/check.yml:36`) |
| UI check | `node tools/check_ui.mjs` | `npm run check` (`.github/workflows/check.yml:52`) |

The full suite is both gates. Run it three times before pushing anything that
touches the primary logic — the engine and the opponent — and read the pass
count, not the absence of a FAIL. A red gate does not merge.

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
