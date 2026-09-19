# Tressette a due — the rules as this game plays them

Tressette has as many house rules as it has houses. This is the version the
game deals, stated plainly, so that you can tell whether it is playing the
Tressette you know. The Italian version is `REGOLE.md`.

The about screen inside the game carries the same rules in both languages, in
short: eight paragraphs a side, which is what fits a screen somebody reads on a
phone mid-hand. This file is the long form and the two are not independent — a
rule stated twice in two places drifts — so when a rule changes here, the
screen's wording of it changes with it, and `node tools/check_ui.mjs` asserts
that both halves of that screen are still the rules rather than a note.

## The deck

Forty Italian cards: **denari, coppe, spade, bastoni**, numbered 1 to 10. There
are no 8, 9 and 10 as such — the figures are the **fante** (8), the **cavallo**
(9) and the **re** (10).

## Which card beats which

This is the first thing that surprises a Briscola player. The **tre** and the
**due** are the strongest cards in the deck, above the asso:

> **3 · 2 · A · re · cavallo · fante · 7 · 6 · 5 · 4**

There is **no trump suit**. A card wins only by being of the suit that was led
and ranking above it. The strongest card in the deck loses to a 4 of another
suit if that 4 was led.

## What the cards are worth

Points are counted in **terzi** — thirds of a point:

| card | value |
|---|---|
| asso | 1 point |
| tre, due, re, cavallo, fante | ⅓ point each |
| 7, 6, 5, 4 | nothing (a *liscio*) |

The whole deck is worth 10 ⅔ points. The last trick of the deal — the
**ultima** — is worth one more. Each player's thirds are rounded **down** at
the end, and the leftovers are simply lost, which is why every deal comes to
exactly **11 points** between the two players, no matter how the cards fell.

## The deal

Ten cards each. The remaining twenty are the **tallone**, face down.

You lead the first deal of a session. After that whoever did *not* lead the
last deal leads the next one.

## Playing a trick

The leader plays any card. **You must follow suit if you can** — this is the
rule Tressette is built on. If you cannot follow, you may play anything.

You are never obliged to try to win a trick. You may follow suit with your
lowest card and let it go.

The higher card of the **led suit** takes the trick, along with both cards'
thirds. The winner then **draws first** from the tallone, the loser draws
second, and the winner leads the next trick. That first draw is a real
advantage, and it is why winning cheap tricks is not always cheap.

The tallone lasts ten tricks. After that hands only shrink, and the deal ends
after twenty tricks, when both hands are empty.

## Declarations (accusi)

Some hands are worth points before a card is played. You are paid for what you
were **dealt** — a set you complete later by drawing from the tallone does not
count:

| you hold | points |
|---|---|
| the asso, due and tre of one suit — a **napoletana** | 3 |
| three assi, or three due, or three tre | 3 |
| all four assi, or all four due, or all four tre | 4 |

They stack: one hand can hold a napoletana and three assi and three tre, and
all of it counts. They are announced when you play your first card of the deal.

## Winning

A *partita* is one deal. Eleven points are at stake plus any declarations, and
the higher total wins. Eleven is odd, so without declarations there can be no
draw — with them there can, and it is recorded as one.

## What to actually do

Four things, if you have never played:

1. **Lead your rubbish.** A liscio costs nothing when it loses. Leading a fante
   into a waiting tre hands over two thirds of a point.
2. **The 3 and the 2 are not for winning tricks, they are for catching assi.**
   Spending your tre to take a trick worth a third is how you lose the asso
   later.
3. **Watch what they cannot follow.** The moment someone fails to follow a
   suit, you know something about their whole hand — and because there is no
   trump, a suit they cannot follow is a trick they cannot take. **While the
   tallone lasts, that knowledge expires**: they draw a card after every trick,
   so a suit they were void in at trick 3 may be back in their hand at trick 9.
   From the eleventh trick nothing is drawn and a void is permanent.
4. **Count to the last trick.** It is worth a whole point, as much as an asso,
   and it is decided by which card you keep, not by which you play.

## What this game does not do

No four-player Tressette with partners and signals. No match to 21 across
several deals — one deal is one *partita*. No variant scoring: declarations
come from the dealt ten only, and that is fixed.
