# Review of PLAN.md, round three

A read of `8c55bba` — "Play the last two tricks exactly, and drop the inert
ultima weight" — against round two (`PLAN-REVIEW.md` at `4f0e4af`, in history).

The finding is closed, and closed better than the review asked for. Round two
offered two routes: add a retained-card term, or drop the weight and play the
last trick blind. The fold took a third that is better than either — solve the
endgame exactly, where the information is already perfect — and refused to
invent a twelfth weight to keep Discola's count (`PLAN.md:303-308`). Naming the
tempo term as a candidate to be decided by the harness in iteration 2, rather
than shipped on a hunch, is the right place for that decision to live.

What remains is the documentation catching up with the change. Finding 1 is a
real gap in the new rule; findings 2 and 3 are text that now describes an
engine the plan no longer specifies. None of them is the kind of thing that
fails quietly in iteration 2, which is why this is a short list.

Line numbers are against `PLAN.md` at `8c55bba`.

---

## 1. The endgame rule covers only the seat that leads

**Where:** `PLAN.md:287-290`.

> So at `tricks == 18` `compGioca` enumerates instead: for each of its two
> cards, the human's best legal reply, then the forced last trick, summing its
> own terzi over both tricks with the ultima's 3 included; it plays the higher,
> ties to the lower slot. Four cards, at most four lines of play.

"For each of its two cards, the human's best legal reply" presupposes that the
opponent is leading trick nineteen. It is the follower in about half of them —
whoever won trick eighteen leads — and then there is no reply to enumerate. The
human has already played; `compGioca` chooses among its own legal cards, which
may be one or two depending on the led suit, and trick twenty is forced from
whatever is left. Two lines, not four, and the tree has a different shape.

A builder reaching this line in the following seat has no rule. Worth stating
both seats explicitly, because the enumeration is small enough that being
explicit costs a sentence:

- **Leading:** for each of its two cards, the human's best legal reply, then the
  forced last trick. At most four lines.
- **Following:** for each of its legal cards, the forced last trick. At most two
  lines.

Both sum the opponent's own terzi across the two tricks with the ultima's 3
included, and both tie to the lower slot.

**Related, smaller.** "The human's best legal reply" does not say best by what
measure. It is unambiguous in effect, because the two players' totals over the
two tricks sum to a constant — the four cards' terzi plus the ultima's 3 — so
the reply that maximises the human's total is the one that minimises the
opponent's. But that is a step the builder has to derive. One clause saying so,
and saying that "best" therefore means minimising the opponent's two-trick
total, removes the ambiguity and documents why the minimax is well defined.

---

## 2. §1's contract now promises something the engine does not do

**Where:** `PLAN.md:45-47`, against `PLAN.md:280-290`.

> - **One formula, four weight vectors.** The opponent scores every legal card
>   and plays the highest. The four opponents differ only in their weights, and
>   the weights are shown in the settings sheet, as in Discola.

After `8c55bba` the opponent does not score every legal card in the last two
tricks; it enumerates lines of play and takes the best. Both sentences of that
bullet are now false in the endgame, and the second is the one that matters,
because it is what the settings sheet and the dossier promise the player: the
four opponents no longer differ only in their weights. They play the last two
tricks identically and optimally. Graziano the loose and Franco the tight are
the same player for the final two tricks of every deal.

That is a defensible design — exact play beats a temperament when the answer is
knowable, and two tricks in twenty is a small surrender — but it is a decision,
not a detail, and §1 is where the plan says decisions of this kind live. The
bullet needs the exception written into it, in the same breath as the promise,
so that nobody reading §1 alone is surprised by §3.4.

It also bears on iteration 5, whose "Done when" is that each opponent has "a
one-line character you can recognise across a few deals" (`PLAN.md:550-552`).
The recognisable difference now has eighteen tricks to appear in, not twenty.
That is almost certainly still enough — but if a profile's character turns out
to live mostly in how it handles the endgame, the harness will report four
opponents that are more alike than intended, and the reason should be on record
before that happens rather than rediscovered.

---

## 3. §3.4's "Shape" still says two branches

**Where:** `PLAN.md:221-222`.

> **Shape.** Identical to `CompGioca`: score every legal card in hand, play the
> highest, ties to the lowest slot. Two branches, leading and following.

There are three now, and the third neither scores nor uses `P`. The paragraph
that opens §3.4 is the first thing a builder reads before implementing
`compGioca`, and it currently describes the function as it was two commits ago.

"Identical to `CompGioca`" is also doing work it can no longer do. The
resemblance to the 1997 original is now a resemblance in the two heuristic
branches only, which is worth saying plainly: the endgame solver has no
ancestor in `UGiocatore.pas`, because Briscola's last two tricks are not a
position anyone needed to solve.

---

## What holds up

Checked rather than assumed, since a review that only lists objections says
nothing about what it read.

- **The worked example at `PLAN.md:292-297` is exact.** Replayed both lines:
  leading the Re forces the Fante, wins 2 terzi, then the 7 di spade loses to
  the asso and the ultima — 2 to 6. Leading the 7 forces the asso, then the
  Fante is led into the Re — 5 to 3. And the Re is genuinely `sure` under
  `outstanding` with perfect information, so the formula really would lead it.
  The example proves the thing it is there to prove.
- **The perfect-information claim at `PLAN.md:280-283`.** From trick eleven the
  opponent knows its own ten cards and the twenty played; the complement is
  exactly the human's ten. Correct, and correctly dated to trick eleven rather
  than to the tallone's last draw.
- **"At most four lines of play"** is right for the leading seat: two leads by
  at most two legal replies.
- **Eleven, everywhere.** `PLAN.md:150`, `:182`, `:277-278`, `:303`, and the
  table at `:312-322` holds exactly eleven rows. The only surviving "twelve" is
  the deliberate historical reference to `Global.pas`.
- **The trap suite** (`PLAN.md:341-347`) replaced the forced ultima position
  with the Re-and-7 position at `tricks == 18`, and added the general rule that
  a position where every legal play is forced asserts nothing — which is the
  round-two finding turned into a standing rule, and the right generalisation.
- **Iteration 2** (`PLAN.md:506-514`) carries both harness questions, with the
  commitment to simplify rather than tune around a mechanism that turns out to
  do nothing.
