# Review of PLAN.md, round four

Two objections to §3.7, raised from iteration 0 rather than from a read of the
document. Both are things the iteration 3 builder hits on their first day, and
both are a clause each to close.

Iteration 0 is merged (`2701c9a`). Nothing in it is blocked by either of these:
the scaffold carries no CSS. They are filed now because §3.7 is the section
iteration 3 implements, and §7.5 puts what a session learned into this document
rather than into a session's memory.

Line numbers are against `PLAN.md` at `2701c9a`.

---

## 1. §3.7 keeps a `vw` cap it does not mention, and it halves the card

**Where:** `PLAN.md:422`, `PLAN.md:425-426`, `PLAN.md:436-437` and
`PLAN.md:461`, against `discola-web/index.html:47` and `:679`.

The section opens by quoting Discola's budget:

> ```
> --cw = clamp(min, min(9vw, (100dvh − --chrome) / --rows / --ratio), max)
> ```
>
> with `--chrome` derived from the spacing tokens, never hand-set. All of that
> is kept.

and closes the arithmetic with:

> so `--cw` is the minimum of the height term and the width term. On a 360px
> phone that gives a 64px card and a 29px strip.

Those two sentences disagree, and the second is the one the rest of the section
is built on. Three terms are in play, not two: the height term, the new width
term, and the `9vw` cap that "all of that is kept" preserves. At 360px, `9vw`
is **32.4px**. The width term is about 64px. So a literal implementation gives
a 32px card — half of what the section works out two paragraphs later — and a
strip of 14.6px, which fails the section's own first fan assertion at
`PLAN.md:451` and makes the raise-then-play interaction pointless, since a
strip that small is not a tap target under any reading.

**Why the omission is easy to miss.** Discola does not use one clamp, it uses
two. `discola-web/index.html:47` is the landscape one with `9vw`;
`:679` overrides it in portrait with **`22vw`**, together with `--rows: 4` and
a higher floor and cap:

```css
/* :47  */ --cw: clamp(32px, min( 9vw, calc((100dvh - var(--chrome)) / var(--rows) / var(--ratio))), 156px);
/* :679 */ --cw: clamp(40px, min(22vw, calc((100dvh - var(--chrome)) / var(--rows) / var(--ratio))), 168px);
```

§3.7 quotes only the landscape form, and `PLAN.md:461` mentions only the other
half of that override: "`--rows` stays 3 in landscape and 4 in portrait." The
`22vw` never appears in the plan. At 360px, `22vw` is 79px, comfortably above
the 64px width term — which is exactly why the section's worked example comes
out right when Discola's real portrait rule is in force, and wrong when the
quoted one is.

**What to decide, not just to clarify.** The `vw` cap and the new width term do
the same job — stopping the hand from outgrowing the table sideways — and the
width term does it properly, because it knows about the fan. Two candidates:

- **Drop the `vw` term.** `--cw` becomes `min(height term, width term)`,
  clamped to a floor and a cap. This is what `PLAN.md:436` already says and what
  `CLAUDE.md` was written from. It is the honest reading: a cap that was a proxy
  for the width constraint is redundant once the constraint is expressed.
- **Keep it per-orientation,** as Discola has it, and state both numbers. Then
  say which of the three terms is expected to bind in portrait on a phone, so
  the builder knows what they are aiming at.

Either way the sentence "all of that is kept" should stop covering a term the
section then contradicts. One clause, before iteration 3 forks the CSS.

---

## 2. The CSS iteration 3 forks was authored in quirks mode

**Where:** §3.7 generally; nothing in the plan says this today.

Measured just now, both pages loaded from `file://` in the check's own Chromium
at 360×800:

| | `document.compatMode` | viewport meta | `innerWidth` |
|---|---|---|---|
| `discola-web/index.html` | `BackCompat` | absent | 360 |
| `Tressette/index.html` (after iteration 0) | `CSS1Compat` | present | 360 |

Discola has no doctype, so every rule in the stylesheet iteration 3 forks was
tuned with the browser in quirks mode. Tressette's page has one, so the forked
rules will land in standards mode. The differences are usually small, and two
of the ones that bite hardest were checked and do not apply here — Discola uses
no percentage heights, and its cards are `background-image` on buttons rather
than `<img>`, so there is no inline-baseline gap under the cards. But "usually
small" is not "none", and the budget is measured in pixels against a `--chrome`
derived from spacing tokens.

The consequence for iteration 3 is one line of guidance: numbers carried over
from Discola's CSS are a starting point to be re-measured by the check, not
constants to be trusted. That the check re-measures the budget anyway is what
makes this a note rather than a risk — but the builder should know it before
they wonder why a token that was right in Discola is off by a few pixels here.

The same table row explains why `innerWidth` is 360 for both: the check sets the
layout viewport directly, so the missing viewport meta is invisible to it. That
half is Discola's defect and is filed as `diegoami/discola-web#1`; only the
rendering-mode divergence belongs in this plan.

---

## Not an objection

Iteration 0 carried `tools/check_ui.mjs` over unchanged, which is what "carried
over dormant" means and what the iteration asked for. It is worth knowing that
the file is still Briscola-shaped inside beyond the assertions: it seeds
`discola.history` where §3.8 specifies `tressette.history`, and it fakes a
result screen with three-card hands. Iteration 3's "extend `check_ui.mjs` with
the three fan assertions" (`PLAN.md:545-546`) is therefore an underestimate of that
day's work — the fixtures and the storage key have to be rewritten too. No
change to the plan is needed if that is already understood; a half-sentence in
iteration 3 would remove the surprise.
