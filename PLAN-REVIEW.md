# Review of PLAN.md, rounds four and five

Round four's two objections to §3.7 are unchanged and restated below; nothing
has answered them yet. Round five adds four more, all arising from `discola-web`
moving twice since iteration 0 copied from it — once for a security fix and once
to close the issue iteration 0 filed.

**One of the six has already been acted on in the repo, not just raised.** The
publish root is a live exposure rather than a wording problem, so `106584f`
moved the site into `public/`. That leaves the tree disagreeing with §3.1 and
§3.9, deliberately and disclosed. Objection 1 asks for the plan to be brought
into line; the alternative is to revert the commit, and the case against that is
in the objection.

Line numbers are against `PLAN.md` at `d6fcd54`. Discola is cited at `22c4b9c`.

---

## 1. §3.9's "publish root" ships the plan to the public web

**Where:** `PLAN.md:149`, `PLAN.md:479`, and the tree at `PLAN.md:140-152`.

> `netlify.toml        publish ".", cache decks/* for a year, revalidate index.html`
>
> Netlify site linked to `main`, publish root, `decks/*` immutable

Netlify uploads every file under the published directory as a site asset. With
`publish = "."` the repo root *is* the site, so `PLAN.md`, `CLAUDE.md`,
`README.md`, this review and `netlify.toml` itself are all served, and a private
repository is no protection: the files are on a public URL for anyone who
guesses a name.

This is not hypothetical. Discola shipped exactly this and found it concretely
(`diegoami/discola-web@00679b4`): the deploy summary reported "2 new files
uploaded" and `SPEC.md` and `ROADMAP.md` became readable at
`discola.netlify.app` from a private repo. `README.md`, `CLAUDE.md` and
`netlify.toml` had been readable all along.

This repo is a worse case than Discola's, because its root is documents almost
entirely. At iteration 6, `PLAN.md`, `SPEC.md` and whatever review is in flight
would all go up with the game.

**Done, not just proposed.** `106584f` moves the page and the sprite sheets to
`public/` and publishes that. It is a whitelist rather than a blacklist — a 404
rule for `/*.md` would have covered today's root and missed whatever lands there
tomorrow — and it was done now, while the site is one empty page and five PNGs,
rather than at iteration 6 after the CSS, the check and the skill all have paths
in them. The header rules are untouched: they match URL paths, which do not
change.

**What the plan needs.** Three edits, or a decision to revert:

- `PLAN.md:142-149` — the tree becomes `public/index.html`, `public/decks/*.png`,
  and `netlify.toml publish "public"`.
- `PLAN.md:479` — "publish root" becomes "publish `public/`".
- `PLAN.md:488` — iteration 0's copy list should say where the decks land.

§1's "one static page ... it must open from a folder in ten years" is unaffected:
`public/index.html` opens from a folder exactly as `index.html` did.

---

## 2. `tools/check_ui.mjs` was copied two commits before it grew the assertion this project asked for

**Where:** `PLAN.md:146`, `PLAN.md:487-489`.

Iteration 0 copied the check on 15 September. Discola has since added two
assertions, both written against a broken file first, and both now in this repo
via `106584f`:

- **A document pass**: viewport meta setting `width=device-width`, standards
  mode, UTF-8, `lang` on `<html>`. This is the assertion iteration 0's pull
  request argued could not be a layout assertion, and Discola reached the same
  conclusion for the same reason — Playwright's `viewport` sets the layout
  viewport directly, so the tag is never consulted.
- **Content past the screen edge**: the table sets `overflow: hidden auto`, so a
  too-wide row is clipped rather than scrollable and "no sideways scroll" never
  fires. That is how a clipped card survived nineteen viewports.

Both are recorded in the skill with the defect each names, per §7.3 item 3.

**The document pass passes on this scaffold.** Iteration 0 added four head tags
that the iteration did not name, disclosed them for review, and was told to keep
them. An assertion written independently in another repo now requires exactly
those four. That is the judgment call confirmed from outside, and it is worth one
line in the plan: §4's iteration 0 should name the head tags rather than leave
the next reader to relitigate them.

**The standing lesson is bigger than this copy.** The plan treats Discola as a
fixed reference — "clone it beside this repo" — but Discola is a live repository
with an active session working on it. Anything forked from it is a snapshot with
a date. §7.5 is the right place for a sentence saying so: when an iteration forks
from Discola, record the commit it forked at, and check for movement before the
next fork. Iteration 3 forks the CSS; that fork should be from a named commit.

---

## 3. The `vw` caps were calibrated against a viewport width that never existed

**Where:** `PLAN.md:422`, `PLAN.md:425-426`, against
`discola-web@22c4b9c`.

This sharpens round four's objection 1 rather than replacing it. Discola's
commit message for the head-tags fix says the missing viewport meta was the real
cause of three earlier rounds of mobile sizing work: the CSS comment claiming
Android browsers report 700–1000 CSS px for a six-inch screen was wrong — the
browser reported 980 because the file had no viewport tag. Measured there:
layout width 980 on a 393px device, and body copy computing to 55px because
Chrome's text autosizing was inflating it to compensate. After the fix, 393 and
18.1px.

The `9vw` and `22vw` caps §3.7 tells this project to keep sit directly below
that corrected comment. They are unchanged in Discola — kept "on their own
merits" — but they were chosen while the browser was reporting a phantom 980px.
So the plan asks Tressette to keep numbers tuned against a width no phone ever
had, in a section that then contradicts them with an explicit width term. The
case for dropping the `vw` term in favour of the width term is stronger than
round four made it.

---

## 4. Iteration 3 should fork a named commit, and not the one it would have forked

**Where:** `PLAN.md:543-546`.

> Fork Discola's CSS and table markup.

The CSS is no longer what it was when the plan said that. `22c4b9c` changed the
seat layout: a seat was `grid-template-columns: 1fr auto 1fr`, so a row cost two
name plates plus the hand and was wider than a phone; on phone-shaped screens
the plate now stacks above or below the hand, paid for out of the card budget
through a new `--plates` token rather than pretended to be free, and the tallone
may shrink and wrap.

That token is part of the `--chrome` derivation this project inherits, and
Tressette's row is a ten-card fan rather than three cards, so the interaction is
not the same. Iteration 3 should fork from `22c4b9c` or later, and the plan
should say so rather than leave "Discola's CSS" to mean whatever is there on the
day.

---

## Round four, restated — still open

### 4a. §3.7 keeps a `vw` cap it does not mention, and it halves the card

`PLAN.md:422`, `:425-426`, `:436-437`, `:461`, against
`discola-web/public/index.html:53` and `:696`.

§3.7 quotes Discola's landscape clamp, says "all of that is kept", and then says
`--cw` is "the minimum of the height term and the width term". Those disagree.
Three terms are in play: the height term, the width term, and the `9vw` cap that
"all of that is kept" preserves. At 360px, `9vw` is **32.4px** against a width
term of about 64px, so a literal implementation gives a 32px card — half what
the section works out two paragraphs later — and a 14.6px strip, which fails the
section's own first fan assertion at `PLAN.md:451`.

Discola avoids this with a second clamp: `public/index.html:53` is the landscape
one with `9vw`; `:696` overrides it in portrait with **`22vw`**, together with
`--rows: 4` and a higher floor and cap. §3.7 quotes only the landscape form, and
`PLAN.md:461` carries across only the `--rows` half of that override. The `22vw`
appears nowhere in the plan. At 360px it is 79px, comfortably above the width
term — which is why the worked example comes out right when Discola's real
portrait rule is in force and wrong when the quoted one is.

Decide rather than clarify: drop the `vw` term, since the width term does the
same job and knows about the fan; or keep it per-orientation and state both
numbers, saying which term is expected to bind on a phone.

### 4b. The CSS iteration 3 forks was authored in quirks mode

Measured, both pages from `file://` in the check's own Chromium at 360×800:
Discola before its fix was `BackCompat`; this repo's page is `CSS1Compat`. Every
rule in the stylesheet iteration 3 forks was tuned in quirks mode. Two quirks
that bite hardest were checked and do not apply — no percentage heights, and
cards are `background-image` on buttons rather than `<img>`, so no baseline gap.
But numbers carried over are a starting point for the check to re-measure, not
constants to trust. One line in §3.7 or in iteration 3 closes it.

Discola has since fixed its own doctype, so this is now a note about provenance
rather than a divergence between the two repos.

---

## Not an objection

`tools/check_ui.mjs` is still Briscola-shaped inside beyond the assertions: it
seeds `discola.history` where §3.8 specifies `tressette.history`, and it fakes a
result screen with three-card hands. Iteration 3's "extend `check_ui.mjs` with
the three fan assertions" (`PLAN.md:545-546`) therefore understates that day: the
fixtures and the storage key have to be rewritten too. A half-sentence removes
the surprise.
