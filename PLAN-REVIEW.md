# Review of PLAN.md

A fresh-context read of `PLAN.md` at `0fd3030`, against the repository as it
stands (two files, no code) and against `diegoami/discola-web`, which the plan
uses as its reference throughout.

The plan is complete enough to start: §7 gives a cold builder the opening
prompt, the branch name, the effort tier, the review protocol and the pull
request format, which is more than most plans of this size carry. Iteration 0
could begin today with no questions asked.

What follows is what a builder would hit anyway. Findings 1 to 3 all land in
§3.4 — the opponent — which §4 and §6 both name as the place this project can
fail quietly. They are cheap to fix now and expensive to fix after iteration 2
freezes the golden fixture.

Each finding cites the line it is about. Line numbers are against `PLAN.md` at
`0fd3030`.

---

## 1. `sure()` is wrong as specified — it will lead a liscio into a Fante

**Where:** `PLAN.md:218-220`, used at `PLAN.md:229`.

> - `outstanding(suit)`: which of the 3, 2 and asso of a suit are neither seen
>   nor in hand — the cards that can still beat or be beaten.
> - `sure(card)`: no outstanding card outranks it. A sure card led wins the
>   trick.

`outstanding` tracks three cards per suit. `sure` is then defined over that set.
That composes correctly only for cards no lower than the Re, because the rank
order at `PLAN.md:73-81` is 3, 2, asso, Re, Cavallo, Fante, 7, 6, 5, 4 — and
only the 3, 2 and asso outrank a Re.

For anything below the Re it breaks. Once the 3, 2 and asso of bastoni have been
seen, `outstanding('bastoni')` is empty, so `sure(7 di bastoni)` is true and
`LEAD_SURE_BONUS` is paid at `PLAN.md:229` — for a card the Re, the Cavallo and
the Fante of that suit all beat. The opponent leads a liscio believing it wins,
and does this most often late in the deal, when `LATE_FACTOR` has steepened the
bonus and the mistake costs the most.

Nothing downstream catches it. The acceptance numbers at `PLAN.md:279-287` are
win rates against random-legal and greedy-take, and a habit this narrow hides
inside a win rate — which is exactly the reason the trap suite exists in the
same paragraph.

**Suggested fix.** Define `outstanding(suit)` as every card of the suit
outranking a given card — or keep the cheap three-card set for the control
questions at `PLAN.md:232-233`, where 3/2/asso is genuinely what is being asked,
and give `sure()` its own full-rank test. Then add a trap position for it: the
3, 2 and asso of a suit gone, a 7 and a figure of that suit in hand.

---

## 2. The twelve weights do not match the formula they belong to

**Where:** the pseudocode at `PLAN.md:228-248`, the table at `PLAN.md:254-267`.

Three mismatches between the two.

**`ULTIMA_WEIGHT` is named but never used.** The table at `PLAN.md:266` lists it
as "how much the last trick's point counts". The formula spends the ultima as a
hard-coded constant at `PLAN.md:247`: `tricks == 19 (the ultima): L += 3 before
scoring`. Either the line should read `L += ULTIMA_WEIGHT`, or the weight is not
one of the twelve. As written a builder tuning `ULTIMA_WEIGHT` in iteration 5
would find it moves nothing, and the reviewer's check at `PLAN.md:578-579` —
"the weights named as listed" — passes a formula that ignores one of them.

**`SPEND_CONTROL_FLOOR` is used but not listed.** `PLAN.md:243` reads "takes
with a 3 or 2 onto a trick worth < SPEND_CONTROL_FLOOR terzi". It is a tunable
number with a threshold's job, and it is absent from the table. So there are
thirteen constants, not twelve, unless it is meant to be fixed — in which case
say so and give it a value.

This matters more than bookkeeping, because "twelve, to mirror the twelve"
(`PLAN.md:250-252`) is the count the settings sheet discloses (`PLAN.md:47`)
and the README table publishes (§4.5).

**`LATE_FACTOR` has two different meanings.** At `PLAN.md:248` it multiplies the
entire following score; at `PLAN.md:229` it multiplies only the sure bonus,
leaving the five other leading terms flat. If that asymmetry is deliberate it is
worth one sentence, because it is the kind of thing a later reader will
"fix" into symmetry and silently invalidate the golden fixture.

Related, smaller: `late = tricks / 20` at `PLAN.md:228`, while `PLAN.md:267`
describes the factor as steepening "as the tallone empties". The tallone is
empty after trick ten (`PLAN.md:105-106`), so `late` reaches 0.5 at the moment
the description says it should be at its maximum. One of the two is wrong, and
`tricks / 10` capped at 1 is probably what was meant.

---

## 3. Nothing says where the profiles live, and Piero cannot be rolled where they do

**Where:** `PLAN.md:180`, `PLAN.md:183`, `PLAN.md:268-272`, `PLAN.md:435`.

`compGioca(state, P)` takes the weights from its caller (`PLAN.md:180`), and the
API listing in §3.2 contains no profile table, no `PROFILES`, no accessor. So
where the four weight vectors live is unstated — and three different callers
need them: the page, `tools/selfplay.mjs`, and the golden test.

The natural home is `engine.js`, since the harness and the test both run under
Node with no DOM. But that collides with two other commitments:

- `PLAN.md:183` — "Nothing in this file touches `document`, `window`, timers or
  `Math.random` directly", restated as a reviewer check at `PLAN.md:578-579`.
- `PLAN.md:268-272` — "Piero rolled once per session, as in Discola, because
  that is now a house tradition rather than a Delphi accident."

Piero needs randomness; `engine.js` may not have any of its own. Discola has no
such tension because its profiles sit in the page next to the roll
(`discola-web/index.html:1057-1064`), and nothing outside the browser ever needs
them.

There is also a reproducibility consequence. The golden test at `PLAN.md:435` is
"seed 1..20, both seats `compGioca`, the sequence of plays frozen in a fixture".
If either seat is Piero, or if profiles are rolled anywhere the test does not
control, the fixture is not reproducible — and the fixture is the artefact the
whole "change a weight, not the formula" contract (`PLAN.md:274-278`) rests on.

**Suggested fix.** Say in §3.2 that `engine.js` exports the profile table and a
`rollProfiles(rng)` that takes the same injectable rng as `mescola`
(`PLAN.md:88-92`), that the page calls it once at startup with `Math.random`,
and that the harness and the golden test call it with their seeded rng. That
keeps the ban at `PLAN.md:183` literally true, keeps Piero's tradition, and
makes the fixture reproducible. It is one paragraph.

---

## 4. Iteration 0's "Done when" is ambiguous about half the file list

**Where:** `PLAN.md:409-415`, against `PLAN.md:133-143`.

> **Done when** the repo has the shape in §3.1 and nothing else.

The shape in §3.1 includes `engine.js`, `tools/engine.test.mjs` and
`tools/selfplay.mjs`, which are iterations 1 and 2, and `README.md`, which
§4.6 writes at iteration 6 (`PLAN.md:479`). The copy list at `PLAN.md:409-411` names none of
them. So the first session — the one with the least context of any in the
project — has to decide whether "the shape" means empty placeholder files or
only what the copy list names, and §7.1's instruction to stop at the "Done
when" gives it nothing to check against.

Worth one clause: the shape §3.1 describes is the finished repo, and iteration 0
creates only what its own copy list names.

**Related:** `PLAN.md:409-411` copies the `ui-check` skill in iteration 0, and
`PLAN.md:410-413` expands `CLAUDE.md` with "the UI check" as a standing rule.
But `check_ui.mjs` navigates Discola's screens, and `index.html` is empty until
iteration 3 (`PLAN.md:445-452`). From iteration 0 to iteration 3, `CLAUDE.md`
carries a rule that cannot be followed. Say in iteration 0 that the skill and
the check are carried over dormant and go live in iteration 3, so the first
builder does not spend the session trying to make a check pass against an empty
page.

---

## 5. Who deals the first partita is never fixed

**Where:** `PLAN.md:95-97`, `PLAN.md:199`.

"The non-dealer leads the first trick. The deal alternates" and `partitaPrimo`
"who leads the next deal; alternates, as in Discola". Neither says what
`partitaPrimo` is on a cold start, and §3.8 says nothing is persisted between
sessions (`PLAN.md:394-395`), so this is the first thing `newDeal` reads on
every fresh load. Discola settles it; this plan should too, in one clause,
rather than leaving it to whichever builder writes `newDeal`.

---

## What I checked that holds up

Stated because a review that lists only objections gives no sense of what the
rest is worth.

- **The scoring arithmetic at `PLAN.md:83-86`.** The deck is 32 terzi — four
  assi at 3, plus twenty 2s, 3s and figures at 1. With the ultima's 3 that is 35,
  and 35 mod 3 = 2, so the two floored totals sum to exactly 11 for every
  possible split. The claim is not approximate; it is exact.
- **The deal shape at `PLAN.md:100-106`.** Twenty tallone cards, both players
  drawing each trick, is exactly ten drawing tricks and ten dry ones. Twenty
  tricks.
- **The draw at `PLAN.md:125-127`.** Eleven is odd, so declarations really are
  the only way to a draw.
- **The fan budget at `PLAN.md:350-357`.** Self-consistent: 360px minus padding
  over `1 + 9 × 0.45` gives about 66px, and 0.45 of that is about 29px — the
  numbers the paragraph quotes.
- **The 29px strip against Discola's tap-target floor.** No conflict:
  `discola-web/tools/check_ui.mjs:168` already excludes `.card` from the 32px
  assertion, with the reason in the comment above it. The carried-over
  assertions at `PLAN.md:378-380` survive the fan intact.
- **Everything iteration 0 copies exists.** `discola-web` has `decks/` (five
  sheets), `tools/pack_cards.py`, `netlify.toml`, `.gitignore` and
  `.claude/skills/ui-check/`, and it has no `.github/workflows` — so
  `PLAN.md:453-456`'s claim to close Discola's CI gap is accurate.
  `diegoami/briscola-JS`, the packer's BMP source, exists.
- **The two open decisions** (`PLAN.md:28`) are not blocking. §7.6 defers them
  to iterations 4 and 5 correctly.

---

## Recommendation

Start iteration 0. Fix findings 1 to 3 in one editing pass on §3.4 before
iteration 2 opens — they are the same paragraph, and §7.5 puts a decision in
this document rather than in a session's head. Findings 4 and 5 are one clause
each and can ride the same pass.
