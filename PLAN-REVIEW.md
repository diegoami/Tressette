# Review of PLAN.md, round two

A read of `41aeb9d` — "Fold the fresh-context review into the plan" — against
the five findings of the previous round (`PLAN-REVIEW.md` at `1a73b79`, kept in
history now that the file is gone).

Four of the five are closed, and closed properly rather than papered over. One
is not: `ULTIMA_WEIGHT` is still inert, for a sibling of the reason the last
round's `LATE_FACTOR` was. That is finding 1 below and it is the only thing
here that needs doing.

Line numbers are against `PLAN.md` at `41aeb9d`.

---

## 1. `ULTIMA_WEIGHT` is still inert: at `tricks == 19` both plays are forced

**Where:** `PLAN.md:257`, against `PLAN.md:94`, `PLAN.md:105-108` and
`PLAN.md:211`.

> ```
> tricks == 19 (the ultima):  L += ULTIMA_WEIGHT before anything else
> ```

Count the cards at that moment. Ten are dealt to each player (`PLAN.md:94`);
each trick for the first ten, both players draw (`PLAN.md:105-106`), so hands
stay at ten until the tallone is empty; the last ten tricks have no drawing
(`PLAN.md:107-108`). And `tricks` is "tricks completed this deal"
(`PLAN.md:211`), so `tricks == 19` is the twentieth trick — by which point each
player holds `10 − 9 = 1` card.

One card is one legal move. `mosseLegali` returns a single slot, `compGioca`
takes the argmax over a singleton, and it returns that slot whatever `L` is.
The same holds for the leader, who is equally forced. So the line at
`PLAN.md:257` changes no decision in any deal, and `ULTIMA_WEIGHT` can be set
to 3, to 30 or to zero without altering a single play.

This is the failure mode the round-one fix diagnosed so well at
`PLAN.md:271-273` — "a common multiplier leaves the argmax where it was" —
appearing one line further down in a different costume: a term that only
applies where there is nothing to choose between. The weight moved from a
position where it could not bite to another position where it cannot bite.

**Where the ultima is actually decided.** At `tricks == 18` each player holds
two cards, and the card they do *not* play is the one that contests the last
trick. That is the only choice in the deal that decides the ultima, and the
formula has no term for the card retained — both branches score the card being
played.

So this is not fixable by changing 19 to 18. Trick nineteen is not the ultima
and its `L` is not what is at stake; adding `ULTIMA_WEIGHT` to it would pay for
winning the wrong trick. Making the weight live needs a term over the card
kept — roughly, at `tricks >= 18`, a bonus for playing the card that leaves the
stronger one in hand, scaled by `ULTIMA_WEIGHT`. That is a genuine change to the
formula in §3.4, which is exactly why it is worth making now: after iteration 2
freezes the golden fixture, the contract at `PLAN.md:305-308` makes it
expensive.

The honest alternative is to drop `ULTIMA_WEIGHT` from the twelve, keep the
ultima's 3 terzi in `scoreDeal` where the rules put it, and let the opponent
play the last trick blind — as it does today. That is a defensible choice, and
it would need the `ULTIMA_WEIGHT` row at `PLAN.md:296` and the count at
`PLAN.md:281` and `PLAN.md:277-279` adjusted to match. What is not
defensible is keeping a weight in the disclosed twelve that a player can move
with no effect on how the opponent plays.

**The trap position inherits the problem.** `PLAN.md:318` lists "the ultima"
among the trap positions that assert the obvious plays directly. In any real
deal that position is forced for both players, so the assertion passes no
matter what the opponent does — an assertion that cannot fail, which is the
thing `.claude/skills/ui-check` warns about for layout and which applies just
as well here. If the retained-card term goes in, this trap should be set at
`tricks == 18`, with a high card and a liscio in hand, asserting that the liscio
goes.

---

## 2. Closed: the four others

Recorded so the next reader knows they were checked, not assumed.

- **`sure()` over the full rank order** (`PLAN.md:228-237`). `outstanding` is
  now every rank and `controls` is the 3/2/asso subset, with the Re-versus-7
  case written out. The leading branch uses `controls(s) above the asso` for
  ace exposure (`PLAN.md:248`), which is the 3 and the 2 — what the original
  line meant. The dead-7 trap is in the suite at `PLAN.md:318-320`.
- **Profiles and Piero** (`PLAN.md:182-195`). `WEIGHT_KEYS` and
  `rollProfiles(rng)` live in `engine.js`; the page passes `Math.random`, the
  harness and the fixture pass their seeded rng. The ban at `PLAN.md:187` stays
  literally true, the reviewer's check at §7.3 still means what it says, and a
  fixture containing Piero is reproducible.
- **Iteration 0** (`PLAN.md:443-456`). It now names what it creates, carries the
  UI check over dormant with the reason, and says §3.1 describes the finished
  repo. The "Done when" is checkable.
- **The first dealer** (`PLAN.md:96-98`). Verified against the reference rather
  than taken on trust: `discola-web/index.html:1096` is `partitaPrimo: BASSO`.
  The claim is accurate.

**And one the fold got right that this review had only half-seen.** Round one
asked whether the `LATE_FACTOR` asymmetry was deliberate. The better answer is
the one at `PLAN.md:271-273`: a positive multiplier over a whole branch cannot
move an argmax, so the weight was inert, not merely asymmetric. Confining `k`
to the four control terms fixes it, and `late = min(1, tricks / 10)`
(`PLAN.md:244`) now saturates where the prose says it does.

---

## 3. One thing to watch in iteration 2, not an objection

`sure()` is conservative about the tallone by construction: a card counts as
sure only when nothing outstanding beats it, and while twenty cards lie face
down almost nothing qualifies. `k` then grows with `late` on top of that. So the
sure bonus is suppressed twice early and sharpened twice late.

That may be exactly right — cashing winners late is good Tressette. But it is a
compound effect nobody chose, and it will be hard to see in a win rate. Worth
asking the harness about directly in iteration 2: how often does the sure bonus
fire before trick ten, and does forcing `k = 1` change the acceptance numbers at
`PLAN.md:312-316`? If the answer is no, one of the two mechanisms is doing
nothing and should be simplified away rather than tuned around in iteration 5.
