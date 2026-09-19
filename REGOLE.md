# Tressette a due — le regole come le gioca questo programma

Il tressette ha tante varianti quante sono le case in cui si gioca. Questa è la
versione che il programma distribuisce, detta chiaramente, così da poter
giudicare se è il tressette che conosci. La versione inglese è `RULES.md`.

La schermata delle informazioni, dentro al programma — il pulsante in alto a
destra sul tavolo — porta le stesse regole in entrambe le lingue, in breve:
otto paragrafi per lingua, quel che sta in una schermata che si legge sul
telefono a mano iniziata. Questo file è la versione
lunga, e le due non sono indipendenti — una regola scritta due volte in due
posti prima o poi diverge — perciò quando qui cambia una regola cambia anche
come la dice la schermata, e `node tools/check_ui.mjs` verifica che le due metà
di quella schermata siano ancora le regole e non un appunto.

## Il mazzo

Quaranta carte italiane: **denari, coppe, spade, bastoni**, dall'1 al 10. Le
figure sono il **fante** (8), il **cavallo** (9) e il **re** (10).

## Quale carta batte quale

È la prima cosa che sorprende chi viene dalla briscola. Il **tre** e il **due**
sono le carte più forti del mazzo, sopra l'asso:

> **3 · 2 · A · re · cavallo · fante · 7 · 6 · 5 · 4**

**Non c'è briscola.** Una carta vince solo se è del seme di uscita e lo supera
di grado. La carta più forte del mazzo perde contro un 4 di un altro seme, se
quel 4 è uscito per primo.

## Quanto valgono le carte

I punti si contano in **terzi**:

| carta | valore |
|---|---|
| asso | 1 punto |
| tre, due, re, cavallo, fante | ⅓ di punto ciascuna |
| 7, 6, 5, 4 | niente: sono *lisci* |

Tutto il mazzo vale 10 punti e ⅔. L'ultima presa della mano — l'**ultima** —
ne vale uno in più. Alla fine i terzi di ciascuno si arrotondano **per
difetto** e i resti si perdono: per questo ogni mano fa esattamente **11
punti** fra i due giocatori, comunque siano cadute le carte.

## La distribuzione

Dieci carte a testa. Le altre venti restano coperte e formano il **tallone**.

La prima mano della sessione la apri tu. Poi apre sempre chi non ha aperto la
mano precedente.

## Come si gioca una presa

Chi apre gioca la carta che vuole. **Bisogna rispondere a colore**, se si può:
è la regola su cui il tressette è costruito. Chi non ha il seme gioca quel che
vuole.

Non si è mai obbligati a prendere. Si può rispondere a colore con la carta più
bassa e lasciar andare la presa.

Prende la carta più alta **del seme di uscita**, insieme ai terzi di entrambe
le carte. Chi prende **pesca per primo** dal tallone, l'altro pesca dopo, e chi
ha preso gioca per primo la presa successiva. Pescare per primi è un vantaggio
vero, ed è il motivo per cui prendere una presa da poco non è mai davvero da
poco.

Il tallone dura dieci prese. Dopo, le mani si assottigliano soltanto, e la mano
finisce dopo venti prese, quando entrambi sono a carte finite.

**Finché c'è il tallone un vuoto non è per sempre, ed è la cosa che sembra un
imbroglio.** Se l'avversario risponde al tuo bastoni con un altro seme, di
bastoni non ne ha *in quel momento* — ma pesca dopo ognuna delle prime dieci
prese, e alla nona può risponderti con un bastoni pescato alla settima. È
regolare, e capita in circa una mano su tre. Dall'undicesima presa non si pesca
più e un vuoto è definitivo: chi in quel momento è fuori da un seme ci resta
fino alla fine della mano.

## Gli accusi

Certe mani valgono punti prima ancora di giocare una carta. Si viene pagati per
quello che è stato **distribuito**: una combinazione completata più tardi
pescando dal tallone non vale.

| se hai in mano | punti |
|---|---|
| asso, due e tre dello stesso seme — la **napoletana** | 3 |
| tre assi, o tre due, o tre tre | 3 |
| tutti e quattro gli assi, o i due, o i tre | 4 |

Si sommano: una sola mano può contenere una napoletana, tre assi e tre tre, e
vale tutto. Si dichiarano quando si gioca la prima carta della mano.

## Chi vince

Una *partita* è una mano sola. In palio ci sono undici punti più gli accusi, e
vince chi ne fa di più. Undici è dispari, quindi senza accusi il pareggio non
esiste; con gli accusi sì, e viene registrato come tale.

## Cosa conviene fare

Quattro cose, se non ci hai mai giocato:

1. **Apri con gli scarti.** Un liscio, quando perde, non costa niente. Aprire
   con un fante mentre l'avversario aspetta con il tre gli regala due terzi.
2. **Il 3 e il 2 non servono a prendere, servono ad acchiappare gli assi.**
   Spendere il tre per una presa da un terzo è il modo di perdere l'asso più
   avanti.
3. **Guarda cosa non riesce a rispondere.** Nel momento in cui qualcuno non
   risponde a colore, sai qualcosa di tutta la sua mano — e siccome non c'è
   briscola, un seme che non può rispondere è una presa che non può prendere.
   Ricorda che finché c'è il tallone quel che sai scade, come sopra: vale di
   più dall'undicesima presa in avanti, quando non si pesca più.
4. **Conta fino all'ultima.** Vale un punto pieno, come un asso, e la decide la
   carta che tieni, non quella che giochi.

## Cosa questo gioco non fa

Niente tressette in quattro con i compagni e i segni. Niente partita ai 21 su
più mani: una mano è una *partita*. Niente punteggi alternativi: gli accusi
valgono solo sulle dieci carte distribuite, e questo non cambia.
