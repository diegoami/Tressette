---
name: ui-check
description: Run Tressette's UI checks across every screen, dialog and viewport. Use after any change to public/index.html's markup, CSS, screen flow or typography — and always before committing or publishing a UI change. Also use when a layout or readability bug is reported, to reproduce it and to confirm the fix.
---

# UI check

Tressette is one HTML file — the start sheet and the table today, five screens
and two dialogs from iteration 4 — and it has to work from a 360px phone to a
1920px desktop, in both orientations, with five decks whose cards have
different aspect ratios. Nearly every UI defect this
check was written for was invisible to code review and threw no error. It
exists because reading the diff was repeatedly not enough — in Discola, where
every threshold below was calibrated.

## Live since iteration 3

The check and this skill were copied from `discola-web` in iteration 0, before
there was anything to check, and sat dormant while `public/index.html` held
nothing but a title and the font links. Iteration 3 built the table, added the
fan assertions of §3.7 — against a deliberately broken fan first — and gave
`check.yml` the job that runs it. The rule at the top of `CLAUDE.md` now
applies without exception: after any UI change, run it, and a red check does
not merge.

## Run it

```sh
node tools/check_ui.mjs
```

Exit code 0 means clean. It takes a few minutes; let it finish rather than
interrupting it.

It needs `playwright-core` and a Chromium binary:

```sh
npm i playwright-core && npx playwright-core install chromium
CHROME=/path/to/chrome node tools/check_ui.mjs      # if Chromium is elsewhere
```

To check a file that is not `public/index.html` — an older revision, say — pass it as
an argument. That is how you confirm an assertion really catches the bug it
was written for:

```sh
git show <commit>:public/index.html > .old.html
node tools/check_ui.mjs "$PWD/.old.html"; rm .old.html
```

## What it covers

**Document pass** — one page load, four facts about the document rather than
its layout: a viewport meta setting `width=device-width`, standards mode, UTF-8,
and a `lang` on `<html>`. These cannot be layout assertions, because Playwright's
`viewport` option sets the layout viewport directly and the tag is only consulted
under mobile emulation — the page measures identically with or without it.

**Screens pass** — every screen the page has, and every state worth looking at,
at five real device shapes: the start sheet, the table, the table with a card
raised, and the table with the longest declaration the game can say. Settings, history,
about, the confirm scrim and the result dialog each get a row in `SCREENS`
when iteration 4 builds them; a row pointing at a screen that does not exist
is a check that silently passes, so the rows are added with the screens. Asserts exactly one screen is visible, no sideways
scroll, no text below its size floor, no text clipped by a container that
cannot scroll, no tap target under 32px, and no script or console errors.

**Table pass** — the card table at all nineteen viewports in all five decks.
Asserts the trick never overlaps either hand, your hand is never below the
fold, nothing overflows the table, no element runs past the screen edge, and
the rows never drift apart. Then it
repeats the tightest viewports with the spacing tokens inflated, which fails if
anyone replaces the derived `--chrome` with a hard-coded number.

**Deal pass** — one whole deal against Valerio at one viewport in one deck,
played by tapping: the strip of a legal card to raise it, the raised card to
play it, twenty times over. The two passes above measure a table that has just
been dealt, so this is the only one that fails when the page and the engine come
apart — or when anything throws in the middle of a deal. It also asserts the two
things that only exist mid-deal: **both cards of a trick are on the table at
once** before it is swept, and a number key cannot raise a card the follow-suit
rule forbids.

**The fan** — the assertions this game needs and Briscola did not, because a
hand of ten cards overlaps. The step of the fan matches the page's own
`--strip`, which catches margins that have drifted from the token at any
`--overlap`; and the strip is either 24px wide or at least `.45` of a card,
which is the share the design gives its tightest orientation. Both terms are
needed: a card on its 32px clamp floor shows a good 22px strip and must pass,
while a desktop fan cut from `.7` to `.42` must fail — a `min(24px, .4 of a
card)` floor passed that break at every viewport, because its absolute term is
inert below a 60px card. The steps are even to within a pixel, the fan stays
inside the table on both edges — on the right that is also "the last card is
whole", one subtraction and so one message — and a raised card is entirely
inside the table and above the fold. Three more came out of the defect the
raised-card assertion found: the line above your hand that names the raised card
is never zero-height, never clips what it holds, and counts as content rather
than as a gap when the rows are measured for drift. And dimming means one thing
— the rule forbids this card — so the number of dimmed cards has to equal the
number of illegal ones, which is zero while the opponent is thinking. All of it
in every deck, at every viewport, with the spacing tokens inflated.

Two mechanical notes, both of them bugs once. The measuring passes run with
`transition` and `animation` off, because a measurement taken on the tick that
*starts* the raise reads the unraised box — the raised-card assertions were
blind to the geometry they exist to catch. And the fold is measured from
`.seat--you`, not from `.hand--you`: in portrait your name plate is below your
hand, and it hung 15px off the bottom of the screen at 770x1475 while this pass
printed `pass`. Cards are already excluded from the 32px tap-target rule, and were
before this game existed: `check_ui.mjs:163-168` excludes them because a card's
size is the table's budget, asserted by the table pass rather than by a
thumb-sized floor. The fan gives that exclusion a second reason rather than its
first — a strip is narrower than 32px by design, which is why a card is raised
by one tap and played by a second.

## The thing this check cannot do for you

**An assertion only sees the states the check renders.** Iteration 3 shipped a
table where a finished trick was never drawn, a declaration was cut in half at
every phone width, and the player's own name plate hung below the fold — with
every assertion green, because no pass rendered a finished trick, no pass showed
an announcement, and nothing measured below the cards. None of those was a weak
threshold; the page was simply never in the state that shows them.

So when the page gains a state, the check gains the row that puts it there. That
is the harder half of adding an assertion, and it is the half that gets skipped.

## Reading a failure

Each line names the screen, the viewport and the element. Fix the page, not the
threshold. Every threshold is calibrated against a defect that actually
shipped — in Discola, which is the same table and the same budget:

| assertion | the bug it was written for |
|---|---|
| one screen visible | `.view` and `.scrim` declare `display`, which beats the UA `[hidden]{display:none}`; every screen rendered at once behind a click-eating scrim |
| text floors, 12.5px label / 14.5px body | opponent descriptions ran at 12.5px and deck labels at 11.5px |
| your hand above the fold | a portrait tablet pushed the player's own hand off screen |
| trick vs hands | a phone in landscape collapsed the middle row and the played cards landed on top of the hand |
| rows drift apart | cards hit their cap, and the grid handed the leftover height to the gaps until a third of the table was empty |
| inflated spacing | `--chrome` was hand-estimated three times and was wrong three times |
| head tags | no viewport meta, so a 393px phone laid the page out at 980px and scaled it down; Chrome's text autosizing then inflated body copy to 55px, and three rounds of mobile sizing work chased the symptom |
| past the screen edge | the table sets `overflow: hidden auto`, so a too-wide row is clipped rather than scrollable and "no sideways scroll" never fires — the opponent's third card was cut off a phone screen through nineteen viewports |
| the fan has collapsed | written against `--overlap: .08`, which leaves 5px of each card showing; a strip too narrow to single out makes a card unreachable, and a misplay costs the deal |
| the fan runs past the table | written against a `--cw` with the width term dropped, which sizes ten cards by height alone and runs the hand up to 227px past the edge |
| a raised card below the fold | the line naming the raised card was `hidden` until it had something to say, so raising a card added a row and moved every card 31px down, past the fold in landscape |
| the name strip takes no space | the same defect, named where it starts rather than where it shows |
| both cards of a trick | `gioca` resolves a trick and clears it in the same call, so a table that renders straight from the engine blanked both cards the instant the second one landed and swept two empty boxes |
| cut off inside an ancestor | a declaration in a strip sized for one line lost half a line off the top and half off the bottom at every phone width; the horizontal rule could not see it, because the element that clips is not the element that holds the text |
| your seat below the fold | `--plates` was a hand-set 76px against two name plates that cost 120px at 770x1475, and the fold was measured from the hand, not from the plate below it |
| a key raised an illegal card | the pointer cannot reach one — it is a disabled button — so the keyboard path raised a forbidden card and threw on the second press |
| dimmed but not illegal | every card dims while the opponent thinks, saying "wait" in the mark that means "illegal", with ten translucent cards showing through one another |

If you believe a threshold is genuinely wrong, change it — then run the check
against the commit that introduced the bug it names and confirm it still fails
there. A threshold that no longer catches its own bug is worse than none.

## Extending it

Add a screen to `SCREENS` with a function that navigates to it. Add a device to
`VIEWPORTS`, and to `SCREEN_VIEWPORTS` if that shape can break a sheet rather
than only the table.

When adding an assertion, first make it fail on the broken version. An
assertion written against already-correct code tends to encode what the code
happens to do rather than what it should do — the gap metric in Discola was
written that way once and passed the broken layout while failing every good one.
