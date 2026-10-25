# Tressette — downloads, rules and credits

**[Italiano](#italiano) · [English](#english)**

**Source code / Codice sorgente:** [Tressette](https://github.com/diegoami/Tressette)

Tressette a due for the browser, with the 1997 card art of
[Discola](https://discola.netlify.app). Here you'll find the Android app and
the rules — to play in the browser right now, go to
**<https://tresettette.netlify.app>**.

---

## Italiano

Tressette a due, con le carte del **Discola** del 1997. Qui trovi l'app per
Android e le regole; per giocare subito nel browser vai su
**<https://tresettette.netlify.app>**.

### Scarica

- **Windows:** scarica il file `.exe` portabile dall’[ultima release](https://github.com/diegoami/Tressette/releases/latest) e avvialo. Non serve un programma di installazione.
- **Android:** prendi il file `.apk` dall'[ultima release](https://github.com/diegoami/Tressette/releases/latest),
  aprilo sul telefono e consenti l'installazione da questa fonte. È la stessa
  versione del sito, ma si gioca senza connessione: le carte, i caratteri e
  tutto il resto sono dentro l'app, e niente lascia il telefono.

Ogni release riporta il checksum SHA-256 dei file in `SHA256SUMS.txt`. Android
può avvisarti che l'app viene da uno sviluppatore sconosciuto: è normale per
un'app distribuita fuori dagli store.

### Le regole

Il tressette ha tante varianti quante sono le case in cui si gioca. Questa è la
versione che il programma distribuisce, detta chiaramente, così da poter
giudicare se è il tressette che conosci.

**Il mazzo.** Quaranta carte italiane: **denari, coppe, spade, bastoni**,
dall'1 al 10. Le figure sono il **fante** (8), il **cavallo** (9) e il **re**
(10).

**Quale carta batte quale.** È la prima cosa che sorprende chi viene dalla
briscola. Il **tre** e il **due** sono le carte più forti del mazzo, sopra
l'asso:

> **3 · 2 · A · re · cavallo · fante · 7 · 6 · 5 · 4**

**Non c'è briscola.** Una carta vince solo se è del seme di uscita e lo supera
di grado. La carta più forte del mazzo perde contro un 4 di un altro seme, se
quel 4 è uscito per primo.

**Quanto valgono le carte.** I punti si contano in **terzi**:

| carta | valore |
|---|---|
| asso | 1 punto |
| tre, due, re, cavallo, fante | ⅓ di punto ciascuna |
| 7, 6, 5, 4 | niente: sono *lisci* |

Tutto il mazzo vale 10 punti e ⅔. L'ultima presa della mano — l'**ultima** — ne
vale uno in più. Alla fine i terzi di ciascuno si arrotondano **per difetto** e
i resti si perdono: per questo ogni mano fa esattamente **11 punti** fra i due
giocatori, comunque siano cadute le carte.

**La distribuzione.** Dieci carte a testa. Le altre venti restano coperte e
formano il **tallone**. La prima mano della sessione la apri tu; poi apre
sempre chi non ha aperto la mano precedente.

**Come si gioca una presa.** Chi apre gioca la carta che vuole. **Bisogna
rispondere a colore**, se si può: è la regola su cui il tressette è costruito.
Chi non ha il seme gioca quel che vuole. Non si è mai obbligati a prendere: si
può rispondere a colore con la carta più bassa e lasciar andare la presa.

Prende la carta più alta **del seme di uscita**, insieme ai terzi di entrambe
le carte. Chi prende **pesca per primo** dal tallone, l'altro pesca dopo, e chi
ha preso gioca per primo la presa successiva. Pescare per primi è un vantaggio
vero, ed è il motivo per cui prendere una presa da poco non è mai davvero da
poco. Il tallone dura dieci prese; dopo, le mani si assottigliano soltanto, e
la mano finisce dopo venti prese.

**Gli accusi.** Certe mani valgono punti prima ancora di giocare una carta. Si
viene pagati per quello che è stato **distribuito**: una combinazione
completata più tardi pescando dal tallone non vale.

| se hai in mano | punti |
|---|---|
| asso, due e tre dello stesso seme — la **napoletana** | 3 |
| tre assi, o tre due, o tre tre | 3 |
| tutti e quattro gli assi, o i due, o i tre | 4 |

Si sommano, e si dichiarano quando si gioca la prima carta della mano.

**Chi vince.** Una *partita* è una mano sola. In palio ci sono undici punti più
gli accusi, e vince chi ne fa di più. Undici è dispari, quindi senza accusi il
pareggio non esiste; con gli accusi sì.

**Cosa conviene fare**, se non ci hai mai giocato:

1. **Apri con gli scarti.** Un liscio, quando perde, non costa niente. Aprire
   con un fante mentre l'avversario aspetta con il tre gli regala due terzi.
2. **Il 3 e il 2 non servono a prendere, servono ad acchiappare gli assi.**
3. **Guarda cosa non riesce a rispondere.** Nel momento in cui qualcuno non
   risponde a colore, sai qualcosa di tutta la sua mano — e siccome non c'è
   briscola, un seme che non può rispondere è una presa che non può prendere.
4. **Conta fino all'ultima.** Vale un punto pieno, come un asso, e la decide la
   carta che tieni, non quella che giochi.

### Cosa questo gioco non fa

Niente tressette in quattro con i compagni e i segni. Niente partita ai 21 su
più mani: una mano è una *partita*. Gli accusi valgono solo sulle dieci carte
distribuite.

---

## English

Tressette for two players, with the card images of the 1997 **Discola**. The
Android app and the rules are here; to play in the browser, go to
**<https://tresettette.netlify.app>**.

### Download

- **Windows:** download the portable `.exe` from the [latest release](https://github.com/diegoami/Tressette/releases/latest) and run it. No installer is needed.
- **Android:** take the `.apk` from the [latest release](https://github.com/diegoami/Tressette/releases/latest),
  open it on the phone and allow installation from this source. It is the same
  version as the website, but it plays with no connection: the cards, the fonts
  and everything else are inside the app, and nothing leaves the phone.

Every release carries the SHA-256 checksums of its files in `SHA256SUMS.txt`.
Android may warn you that the app comes from an unknown developer, which is
normal for an app distributed outside the stores.

### The rules

Tressette has as many house rules as it has houses. This is the version the
game deals, stated plainly, so that you can tell whether it is playing the
Tressette you know.

**The deck.** Forty Italian cards: **denari, coppe, spade, bastoni**, numbered
1 to 10. The figures are the **fante** (8), the **cavallo** (9) and the **re**
(10).

**Which card beats which.** This is the first thing that surprises a Briscola
player. The **tre** and the **due** are the strongest cards in the deck, above
the asso:

> **3 · 2 · A · re · cavallo · fante · 7 · 6 · 5 · 4**

There is **no trump suit**. A card wins only by being of the suit that was led
and ranking above it. The strongest card in the deck loses to a 4 of another
suit if that 4 was led.

**What the cards are worth.** Points are counted in **terzi** — thirds of a
point:

| card | value |
|---|---|
| asso | 1 point |
| tre, due, re, cavallo, fante | ⅓ point each |
| 7, 6, 5, 4 | nothing (a *liscio*) |

The whole deck is worth 10 ⅔ points. The last trick of the deal — the
**ultima** — is worth one more. Each player's thirds are rounded **down** at
the end and the leftovers are lost, which is why every deal comes to exactly
**11 points** between the two players, no matter how the cards fell.

**The deal.** Ten cards each. The remaining twenty are the **tallone**, face
down. You lead the first deal of a session; after that whoever did *not* lead
the last deal leads the next one.

**Playing a trick.** The leader plays any card. **You must follow suit if you
can** — this is the rule Tressette is built on. If you cannot follow, you may
play anything. You are never obliged to try to win a trick: you may follow suit
with your lowest card and let it go.

The higher card of the **led suit** takes the trick, along with both cards'
thirds. The winner then **draws first** from the tallone, the loser draws
second, and the winner leads the next trick. That first draw is a real
advantage, and it is why winning cheap tricks is not always cheap. The tallone
lasts ten tricks; after that hands only shrink, and the deal ends after twenty.

**Declarations (accusi).** Some hands are worth points before a card is played.
You are paid for what you were **dealt** — a set you complete later by drawing
from the tallone does not count:

| you hold | points |
|---|---|
| the asso, due and tre of one suit — a **napoletana** | 3 |
| three assi, or three due, or three tre | 3 |
| all four assi, or all four due, or all four tre | 4 |

They stack, and they are announced when you play your first card of the deal.

**Winning.** A *partita* is one deal. Eleven points are at stake plus any
declarations, and the higher total wins. Eleven is odd, so without declarations
there can be no draw; with them there can.

**What to actually do**, if you have never played:

1. **Lead your rubbish.** A liscio costs nothing when it loses. Leading a fante
   into a waiting tre hands over two thirds of a point.
2. **The 3 and the 2 are not for winning tricks, they are for catching assi.**
3. **Watch what they cannot follow.** The moment someone fails to follow a
   suit, you know something about their whole hand — and because there is no
   trump, a suit they cannot follow is a trick they cannot take.
4. **Count to the last trick.** It is worth a whole point, as much as an asso,
   and it is decided by which card you keep, not by which you play.

### What this game does not do

No four-player Tressette with partners and signals. No match to 21 across
several deals — one deal is one *partita*. Declarations come from the dealt ten
only.

---

The opponent is this game's own: there was no 1997 Tressette to port, so the
formula was designed and tuned for it. The card images are the original
bitmaps of Discola, plus an imported Bresciane deck.


[Privacy e contatti / Privacy and contact](PRIVACY.md).
