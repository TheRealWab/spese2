# App Spese 2.0 — Specifiche, roadmap e prompt per Claude Code

Documento di riferimento per il rifacimento completo dell'app spese di Alessandro.
Va copiato nella cartella del progetto come `SPEC.md` e Claude Code deve rileggerlo all'inizio di ogni fase.

---

## 1. Visione e principi

Un'app personale per tracciare spese, entrate e patrimonio, usata ogni giorno dal telefono (Samsung Galaxy S25, Android, Chrome).
L'app attuale è funzionale ma sembra datata: questo rifacimento mantiene **la struttura e i collegamenti tra le aree**, e rifà da zero **aspetto, inserimento, icone e grafici**.

Principi:

1. **I numeri sono i protagonisti.** Ogni schermata ha una cifra principale grande e chiara; tutto il resto è secondario.
2. **Inserire una spesa deve essere velocissimo.** Una spesa normale si registra in tre tocchi: importo → categoria → salva.
3. **Coerenza assoluta.** Ogni categoria ha un solo colore e una sola icona, identici in elenchi, inserimento e grafici. Un unico set di icone, un unico stile.
4. **Tutto è collegato.** Le spese muovono i saldi dei conti, i conti formano il patrimonio, i grafici portano all'elenco delle spese che rappresentano.
5. **Ogni grafico risponde a una domanda precisa.** Niente grafici decorativi o vuoti.
6. **I dati restano sul telefono.** Nessun server, nessun dato personale su GitHub.

---

## 2. Piattaforma e vincoli tecnici

- **Tipo di app:** PWA (Progressive Web App) installabile, pubblicata su GitHub Pages, funzionante offline.
- **Dispositivo target:** Samsung Galaxy S25, Chrome per Android. Larghezze da testare: 360–412 px. Deve funzionare anche su desktop, ma il mobile ha la priorità.
- **Tecnologie:** HTML, CSS e JavaScript "vanilla" con moduli ES (`import`/`export`), **senza passaggi di build** obbligatori. Codice **diviso in file separati** per responsabilità (niente file unico con tutto dentro).
- **Librerie esterne:** ammesse solo se salvate localmente nel progetto (cartella `vendor/`), così l'app funziona offline. Indicazioni:
  - Grafici: Chart.js (o grafici SVG scritti a mano, se più semplici e coerenti con il design).
  - Icone: Lucide (licenza ISC), usate come SVG inline o sprite.
- **Archiviazione:** IndexedDB (con un piccolo strato di accesso in `db.js`). Importi salvati **in centesimi interi** per evitare errori di arrotondamento.
- **Formato numeri e date:** italiano (`1.234,56 €`, `14 ottobre 2026`), tramite `Intl.NumberFormat('it-IT')` e `Intl.DateTimeFormat('it-IT')`. Cifre con `font-variant-numeric: tabular-nums`.
- **Lingua dell'interfaccia:** italiano.
- **Niente notifiche push.**

### 2.1 Attenzione: origine condivisa su GitHub Pages

Tutte le app pubblicate come `therealwab.github.io/<nome-repo>` condividono la **stessa origine** (`therealwab.github.io`). Conseguenze:

- `localStorage` e IndexedDB sono condivisi tra il diario stoico, la vecchia app spese e la nuova: tutti i nomi di database e chiavi devono avere un **prefisso univoco** (es. `spese2_`), per non sovrascrivere i dati delle altre app.
- Il service worker deve avere lo **scope limitato al percorso** dell'app (es. `/spese/` o `/spese2/`).
- Vantaggio: se la nuova app è sulla stessa origine, può **leggere direttamente i dati della vecchia app** per la migrazione, oltre a importarne il file di export (vedi §8).

### 2.2 Privacy dei dati

- I dati personali **non devono mai finire su GitHub**: solo il codice.
- Qualsiasi file reale (export della vecchia app, backup, screenshot con dati) va tenuto nella cartella `_privato/`, esclusa con `.gitignore`.
- Nel codice e nei test si usano solo **dati di esempio inventati**.

---

## 3. Struttura dell'app

Barra di navigazione in basso con cinque aree (come l'app attuale):

| Area | Contenuto |
|---|---|
| **Mese** | Indicatore stipendio, elenco movimenti del mese raggruppati per giorno |
| **Grafici** | Analisi con periodo selezionabile |
| **Patrimonio** | Conti, saldi, investimenti, andamento del patrimonio |
| **Categorie** | Spese/entrate per categoria nel periodo, gestione categorie |
| **Altro** | Impostazioni, ricorrenti, backup, sicurezza, importazione |

Più un **pulsante "+" fisso** (in basso a destra, sopra la barra), raggiungibile col pollice da qualsiasi area, che apre l'inserimento.

---

## 4. Modello dati

```
Conto
  id, nome, tipo ("liquidità" | "conto" | "investimenti" | "altro"),
  saldoIniziale (centesimi), dataSaldoIniziale, colore, icona,
  ordine, archiviato (bool)

Categoria
  id, nome, tipo ("spesa" | "entrata"), icona (nome icona Lucide),
  colore (dalla tavolozza), ordine, archiviata (bool)

Movimento
  id, tipo ("spesa" | "entrata" | "trasferimento"),
  importo (centesimi, sempre positivo), data (YYYY-MM-DD),
  categoriaId (null per i trasferimenti),
  contoId (conto di uscita per spese/trasferimenti, di arrivo per entrate),
  contoDestinazioneId (solo trasferimenti),
  nota (testo, facoltativa),
  ricorrenteId (se generato da un ricorrente),
  creatoIl, modificatoIl

ValoreInvestimento   // aggiornamenti manuali del valore di mercato
  id, contoId, data, valore (centesimi)

Ricorrente
  id, modello (tipo, importo, categoriaId, contoId, contoDestinazioneId, nota),
  frequenza ("settimanale" | "mensile" | "annuale" | "ogni_n"),
  intervallo (n), unità ("giorni" | "settimane" | "mesi"),
  giornoDelMese (1–31 oppure "ultimo"), giornoSettimana,
  dataInizio, dataFine (facoltativa),
  modalità ("automatico" | "conferma"), attivo (bool), ultimaGenerazione

Impostazioni
  giornoInizioMese (1–28), tema ("auto" | "chiaro" | "scuro"),
  contoPredefinito, ordineCategorieInserimento ("frequenza" | "manuale"),
  ultimoPeriodoGrafici, ultimoBackup, sicurezza (vedi §9)
```

Regole di calcolo:

- **Saldo di un conto** = saldo iniziale + entrate − spese ± trasferimenti.
- **Saldo di un conto investimenti** = valore dell'ultimo `ValoreInvestimento` se presente, altrimenti la somma dei versamenti.
- **Patrimonio totale** = somma dei saldi di tutti i conti non archiviati.
- I **trasferimenti** non sono né spese né entrate: non compaiono nei grafici delle spese e non cambiano il patrimonio.

---

## 5. Inserimento movimenti

Si apre dal pulsante "+" come pannello a tutto schermo che sale dal basso.

1. **Selettore tipo** in cima: `Spesa · Entrata · Trasferimento`. Preselezionata: Spesa.
2. **Importo** grande al centro, con **tastierino numerico personalizzato** (cifre, virgola, cancella). Il cursore è subito sull'importo all'apertura.
3. **Categoria** in una griglia di icone (4 per riga), ciascuna in un cerchio del suo colore con il nome sotto. Ordine: per frequenza d'uso (default) oppure manuale, a scelta nelle impostazioni. Per Entrata compaiono solo le categorie di entrata; per Trasferimento la griglia è sostituita da "Da conto → A conto".
4. **Campi secondari**, compatti in una riga sotto, già preimpostati:
   - **Conto:** il conto predefinito (o l'ultimo usato); un tocco per cambiarlo. Per le spese è "da", per le entrate è "verso".
   - **Data:** "Oggi" di default; si modifica solo toccandola.
   - **Nota:** facoltativa. Mentre si scrive, l'app suggerisce **le note già usate in quella categoria**, ordinate per frequenza (es. scegliendo *Spesa alimentare* compaiono subito Supermercato, Panificio, Macelleria). Un tocco su un suggerimento lo inserisce; si può sempre scrivere qualcosa di nuovo.
5. **Salva** in basso, grande. Dopo il salvataggio: breve conferma animata e ritorno alla schermata precedente, con il movimento già visibile.

Un movimento si **modifica** o **elimina** toccandolo in qualsiasi elenco (stesso pannello, precompilato). L'eliminazione chiede conferma.

---

## 6. Le cinque aree nel dettaglio

### 6.1 Mese

- **Intestazione:** nome del periodo (es. "Ottobre 2026", oppure "10 ott – 9 nov" se il ciclo non parte dal 1°) con frecce ‹ › e swipe per cambiare periodo.
- **Indicatore stipendio** (cifra protagonista):
  > **Ti restano 620 €** di 1.450 €
  > barra di avanzamento · uscite 830 € (57%)
  - Riferimento = **entrate del ciclo nella categoria Stipendio** (si adatta se un mese prendi di più o di meno; tredicesima e quattordicesima sono categorie separate e non contano qui).
  - Uscite = **spese + trasferimenti verso conti investimenti** (il PAC riduce i soldi disponibili sul conto, anche se non riduce il patrimonio).
  - Colore della barra: neutro sotto l'80%, arancione dall'80% al 100%, rosso oltre il 100% con testo "Hai superato di 45 €".
  - Se nel ciclo non c'è ancora uno stipendio registrato: messaggio discreto "Stipendio non ancora registrato" con collegamento rapido all'inserimento.
- **Riepilogo sintetico:** entrate, spese, risparmio del ciclo, in tre piccole schede.
- **Elenco movimenti** raggruppati per giorno ("Oggi", "Ieri", "12 ottobre") con totale del giorno. Ogni riga: icona categoria nel cerchio colorato, nome categoria, nota (in grigio), conto (piccolo), importo allineato a destra (spese neutre, entrate in verde, trasferimenti con icona di freccia).

### 6.2 Grafici

**Selettore periodo** in alto, unico per tutta la pagina:
`Giorno · Settimana · Mese · 6 mesi · Anno · Personalizzato` (quest'ultimo con data inizio e fine), più frecce ‹ › per scorrere i periodi. "Mese" rispetta il giorno di inizio del ciclo. L'app ricorda l'ultimo periodo scelto.

Ogni grafico risponde a una domanda:

| Domanda | Grafico | Note |
|---|---|---|
| Dove sono finiti i soldi? | Ciambella per categoria + elenco ordinato con importi e % | Totale al centro |
| Sto spendendo più o meno di prima? | Cifra con variazione % rispetto al periodo precedente equivalente, e rispetto alla media | Es. "+12% rispetto a settembre" |
| Come sono andate le spese nel tempo? | Barre per sotto-periodo (giorni se il periodo è un mese, mesi se è 6 mesi o un anno) | Con il periodo "Giorno" diventa l'elenco orario o si nasconde |
| Quanto riesco a risparmiare? | Barre entrate vs spese per sotto-periodo, con linea del risparmio | |
| Come cresce il patrimonio? | Linea del patrimonio totale, con i punti degli aggiornamenti del valore degli investimenti | Area sottostante sfumata |

Regole:
- **Colori delle categorie identici** a quelli di icone ed elenchi.
- **Tutti i grafici si aggiornano insieme** al cambio di periodo.
- Un grafico che non ha senso per il periodo scelto **si adatta o si nasconde**; mai grafici vuoti. Con dati insufficienti, un messaggio breve al posto del grafico.
- **Tocco su una categoria** in un grafico → apre il dettaglio di quella categoria nel periodo (vedi §6.4).
- Animazione leggera di comparsa (i grafici "si disegnano").

### 6.3 Patrimonio

- **Cifra protagonista:** patrimonio totale, con variazione rispetto a un mese fa.
- **Grafico** dell'andamento del patrimonio (stesso del §6.2, periodo selezionabile).
- **Schede dei conti** (Contanti, Conto corrente, Investimenti, …) con saldo; un tocco apre l'elenco dei movimenti di quel conto.
- **Scheda Investimenti:**
  - **Versato** (somma dei trasferimenti verso il conto), **valore attuale** (ultimo aggiornamento manuale), **guadagno/perdita** in euro e in %, verde o rosso.
  - Pulsante **"Aggiorna valore"**: si inserisce la cifra vista sulla piattaforma di investimento, data = oggi di default. Storico degli aggiornamenti consultabile e modificabile.
  - Promemoria visivo discreto: "Valore aggiornato 4 mesi fa".
- Gestione conti: aggiungere, rinominare, cambiare icona/colore, impostare saldo iniziale, archiviare.

### 6.4 Categorie

- Intestazione con periodo e frecce (come nell'app attuale), selettore `Spese · Entrate`.
- Elenco categorie con icona, nome, totale del periodo e numero di movimenti.
- **Dettaglio categoria** (tocco su una riga o su un grafico):
  - totale del periodo;
  - **scomposizione per nota**: barra orizzontale divisa in segmenti più elenco, es.
    > **Spesa alimentare · ottobre — 180 €**
    > Supermercato 95 € · Panificio 38 € · Macelleria 32 € · Senza nota 15 €
  - tocco su una nota → filtra l'elenco a quelle spese;
  - sotto, l'elenco dei movimenti della categoria nel periodo.
- **Gestione categorie** (sempre modificabili):
  - aggiungere, rinominare, cambiare icona (scelta da libreria Lucide con **ricerca per parola**, es. "gatto", "caffè") e colore (da tavolozza);
  - **riordinare** trascinando;
  - **archiviare** invece di cancellare quando ci sono movimenti collegati (lo storico resta); eliminare solo se vuota;
  - **unire** due categorie (i movimenti passano nella categoria di destinazione).
- **Gestione note:** per ogni categoria, elenco delle note usate con conteggio; possibilità di **rinominare** una nota o **unirne** due (es. "pane" → "Panificio"), aggiornando tutti i movimenti.

**Categorie di spesa iniziali** (quelle attuali, invariate):
Spesa alimentare · Trasporti · Ristoranti e bar · Svago e hobby · Abbonamenti · Salute · Abbigliamento · Regali · Gatti · Commissioni e tasse · Altro · Macchinette

**Categorie di entrata iniziali:**
Stipendio · Tredicesima e quattordicesima · Rimborsi · Regali ricevuti · Altro

Icone suggerite (Lucide), da rivedere in fase di design: carrello (Spesa alimentare), autobus o auto (Trasporti), tazza di caffè (Ristoranti e bar), gamepad (Svago e hobby), frecce circolari (Abbonamenti), pillola o cuore (Salute), maglietta (Abbigliamento), regalo (Regali), gatto (Gatti), ricevuta (Commissioni e tasse), pacco (Altro), lattina o moneta (Macchinette), portafoglio (Stipendio).

### 6.5 Altro (impostazioni)

- **Ciclo mensile:** giorno di inizio del mese finanziario (1 = mese di calendario).
- **Tema:** automatico (default), chiaro, scuro.
- **Conto predefinito** per l'inserimento.
- **Ordine categorie nell'inserimento:** per frequenza o manuale.
- **Movimenti ricorrenti** (vedi §7).
- **Backup:** export cifrato, import, indicatore "Ultimo backup: N giorni fa" (vedi §9).
- **Sicurezza:** sblocco con impronta (vedi §9).
- **Importa dalla vecchia app** (vedi §8).
- Informazioni sull'app (versione).

---

## 7. Movimenti ricorrenti

- Valgono per **spese, entrate e trasferimenti** (es. stipendio, PAC, abbonamenti, affitto).
- **Frequenze:** settimanale (giorno della settimana), mensile (giorno fisso o ultimo giorno del mese; se il giorno non esiste nel mese, si usa l'ultimo), annuale, oppure ogni N giorni/settimane/mesi.
- **Data di inizio** e **data di fine facoltativa**.
- **Modalità per singolo ricorrente:**
  - *Automatico*: il movimento viene registrato da solo.
  - *Con conferma*: all'apertura dell'app compare una scheda "Stipendio di ottobre: 1.450 € — Conferma / Modifica importo / Salta".
  - Default proposto alla creazione: *con conferma* per le entrate, *automatico* per spese e trasferimenti.
- **Generazione all'apertura:** l'app non gira in background, quindi all'avvio genera tutti i movimenti dovuti dall'ultima generazione (recupero dei giorni mancati), senza mai creare doppioni.
- Sezione dedicata in **Altro** con l'elenco dei ricorrenti, prossima data, possibilità di mettere in pausa, modificare, eliminare.
- Si può creare un ricorrente anche **da un movimento esistente** ("Rendi ricorrente").

---

## 8. Migrazione dalla vecchia app

- La vecchia app ha già una funzione di export. Un file di export reale verrà messo in `_privato/` (esclusa da Git) **solo per far capire il formato** a Claude Code.
- Funzione **"Importa dalla vecchia app"** in Altro, con una procedura guidata:
  1. scelta del file di export (e, se la nuova app è sulla stessa origine, in alternativa lettura diretta dei dati della vecchia app);
  2. anteprima: numero di movimenti, periodo coperto, categorie trovate;
  3. **abbinamento categorie**: per ogni vecchia categoria si sceglie la nuova corrispondente (abbinamento automatico per nome quando coincide) oppure "crea nuova";
  4. scelta del **conto da assegnare** ai vecchi movimenti (che non avevano un conto);
  5. importazione e riepilogo finale.
- L'importazione deve essere **ripetibile senza creare doppioni** (es. riconoscendo i movimenti già importati).
- Emoji e icone della vecchia app vengono ignorate: le categorie importate ricevono icone del nuovo set.

---

## 9. Sicurezza e backup

### 9.1 Sblocco con impronta
- Blocco all'apertura dell'app (e al ritorno dopo alcuni minuti in background) tramite **WebAuthn** con autenticatore della piattaforma (impronta del S25).
- **PIN di riserva** se l'impronta non è disponibile o fallisce.
- Attivabile e disattivabile dalle impostazioni.
- Nota onesta da riportare nell'interfaccia di configurazione: l'impronta protegge l'**accesso all'app**; i dati nel browser non sono cifrati dall'impronta stessa. La protezione completa viene dall'insieme di blocco del telefono, impronta sull'app ed export cifrato.

### 9.2 Export e import cifrati
- Export in **file JSON cifrato con password** tramite Web Crypto API: chiave derivata con PBKDF2 (SHA-256, almeno 310.000 iterazioni, salt casuale), cifratura AES-GCM (IV casuale). Salt, IV, numero di iterazioni e versione del formato salvati in chiaro nell'intestazione del file.
- Nome file con data, es. `spese-backup-2026-10-14.json`.
- Avviso chiaro al momento della scelta della password: **se la password viene dimenticata, il backup non è recuperabile**. Conferma della password digitandola due volte.
- **Import:** richiesta password, verifica, anteprima, poi scelta tra *sostituire tutto* o *unire* (senza doppioni).
- Indicatore **"Ultimo backup: N giorni fa"** in Altro, che diventa evidente dopo 30 giorni.

---

## 10. Design

Riferimento estetico: app bancarie moderne in stile Revolut (solo come ispirazione per i principi; nessun elemento di marchio, logo o colore distintivo copiato).

- **Tema:** automatico, segue il sistema (`prefers-color-scheme`), con scelta manuale nelle impostazioni.
  - Chiaro: sfondo grigio chiarissimo, schede bianche.
  - Scuro: sfondo quasi nero, schede grigio scuro.
- **Colori:** definiti come variabili CSS (design tokens) in un unico file `tokens.css`. Un solo colore di accento (es. blu/indaco) per pulsanti e selezioni. Verde per entrate e guadagni, rosso per sforamenti e perdite, arancione per gli avvisi.
- **Tavolozza categorie:** 12–16 colori armonizzati, ciascuno con variante per tema chiaro e scuro. Icona nel cerchio: sfondo del colore al 15–20% di opacità, icona a colore pieno.
- **Tipografia:** font di sistema (`system-ui`), cifre tabellari. Gerarchia netta: cifra protagonista molto grande (36–44 px), titoli medi, testo secondario in grigio.
- **Forme:** schede con angoli molto arrotondati (16–20 px), ombre leggere o nessuna nel tema scuro, ampio spazio vuoto, pochissimi bordi.
- **Icone:** esclusivamente dal set Lucide, stesso spessore ovunque. **Niente emoji** nell'interfaccia.
- **Animazioni:** brevi e morbide (150–300 ms): cifre che scorrono quando cambiano, grafici che si disegnano, pannelli che salgono dal basso, transizioni tra aree. Rispettare `prefers-reduced-motion`.
- **Ergonomia:** elementi interattivi di almeno 44×44 px, azioni principali nella metà inferiore dello schermo, rispetto delle aree sicure (`env(safe-area-inset-*)`).
- **Accessibilità:** contrasto sufficiente in entrambi i temi, etichette per lettori di schermo sui pulsanti con sola icona.

---

## 11. Struttura del progetto (indicativa)

```
/
├── index.html
├── manifest.webmanifest
├── sw.js                    # service worker, scope limitato al percorso dell'app
├── css/
│   ├── tokens.css           # colori, spaziature, raggi, tipografia
│   ├── base.css
│   └── components.css
├── js/
│   ├── app.js               # avvio, navigazione, router
│   ├── db.js                # IndexedDB (prefisso univoco)
│   ├── model/               # conti, categorie, movimenti, ricorrenti, calcoli
│   ├── views/               # mese, grafici, patrimonio, categorie, altro
│   ├── components/          # inserimento, tastierino, selettore periodo, grafici…
│   ├── security/            # webauthn, pin, crypto export
│   └── import/              # migrazione dalla vecchia app
├── vendor/                  # librerie salvate localmente (Chart.js, Lucide)
├── icons/                   # icone della PWA
├── _privato/                # MAI su GitHub (in .gitignore)
├── .gitignore
├── README.md
└── SPEC.md                  # questo documento
```

---

## 12. Roadmap a fasi

Ogni fase si chiude con un'app **funzionante e utilizzabile**, un riepilogo di cosa è stato fatto e una checklist di prova da eseguire sul telefono. Si passa alla fase successiva solo dopo la verifica.

**Fase 1 — Fondamenta e inserimento**
Struttura del progetto, design tokens e tema automatico, IndexedDB, conti e categorie iniziali, inserimento completo (spesa, entrata, trasferimento, con nota e suggerimenti), modifica ed eliminazione, area **Mese** con ciclo personalizzabile, indicatore stipendio ed elenco per giorno. PWA installabile e offline. Barra di navigazione con le cinque aree (le non ancora pronte mostrano un segnaposto curato).
*Completata quando:* si installa sul S25, si inseriscono spese in tre tocchi, l'indicatore "ti restano" è corretto, funziona offline, tema chiaro/scuro corretto.

**Fase 2 — Migrazione, backup e sicurezza**
Importazione guidata dalla vecchia app, export/import cifrati con password, indicatore ultimo backup, sblocco con impronta e PIN di riserva.
*Completata quando:* tutti i dati della vecchia app sono nella nuova con categorie e conti corretti; un backup cifrato si esporta e si reimporta senza perdite; l'impronta blocca l'app.

**Fase 3 — Categorie e note**
Area **Categorie** completa: elenco per periodo, dettaglio con scomposizione per nota, gestione (icone con ricerca, colori, riordino, archiviazione, unione), gestione note (rinomina, unione).
*Completata quando:* si vede quanto speso in Panificio vs Supermercato in un mese; si può creare una categoria nuova con icona e colore e vederla subito nell'inserimento.

**Fase 4 — Patrimonio e investimenti**
Area **Patrimonio**: saldi dei conti calcolati, schede conti, investimenti con versato/valore/guadagno, aggiornamento manuale del valore, promemoria, grafico del patrimonio, gestione conti.
*Completata quando:* il PAC sposta denaro da Conto a Investimenti senza cambiare il patrimonio; aggiornando il valore si vede guadagno/perdita.

**Fase 5 — Grafici**
Area **Grafici** completa: selettore periodo unico, i cinque grafici, confronto col periodo precedente, adattamento ai periodi, collegamento tocco → dettaglio categoria.
*Completata quando:* cambiando periodo tutti i grafici si aggiornano coerentemente e nessun grafico appare vuoto o fuori luogo.

**Fase 6 — Movimenti ricorrenti**
Creazione e gestione ricorrenti, generazione all'apertura con recupero, schede di conferma, "Rendi ricorrente".
*Completata quando:* stipendio (con conferma) e PAC (automatico) si registrano correttamente anche dopo giorni senza aprire l'app, senza doppioni.

**Fase 7 — Rifinitura**
Animazioni, micro-interazioni, prestazioni con molti dati (es. 5 anni di movimenti), accessibilità, revisione visiva completa di ogni schermata in tema chiaro e scuro, README.
*Completata quando:* l'app è fluida, coerente e piacevole in ogni schermata.

### Repository e pubblicazione (deciso)
- **Nuovo repository pubblico `spese2`**, pubblicato su `therealwab.github.io/spese2/`. La vecchia app `spese` resta intatta finché la migrazione non è verificata.
- La cartella locale del progetto è collegata al repository: Claude Code fa i commit e il push direttamente, **solo dopo la conferma di Alessandro** e solo dopo aver mostrato `git status` per verificare che nessun file privato sia incluso.
- Il primo commit contiene il `.gitignore` (con `_privato/`, backup ed export), prima di qualsiasi altro file.
- Un tag Git per ogni fase completata (`fase-1`, `fase-2`, …), così si può tornare indietro se qualcosa si rompe.

### Fuori ambito per ora
Budget per categoria, sottocategorie vere, notifiche, sincronizzazione tra dispositivi, import dai report bancari, integrazione con il bot Telegram, valori degli investimenti aggiornati automaticamente.

### Decisioni aperte (da chiarire con Alessandro durante lo sviluppo)
- Libreria grafici: Chart.js o SVG scritti a mano.

---

## 13. Prompt per Claude Code

### 13.1 Prompt iniziale (Fase 1)

Incollare in Claude Code, con questo documento salvato come `SPEC.md` nella cartella del progetto:

```
Ciao! Costruiamo insieme la nuova versione della mia app personale per
tracciare spese, entrate e patrimonio. Tutte le specifiche sono nel file
SPEC.md in questa cartella: leggilo per intero prima di fare qualsiasi cosa,
e rileggilo all'inizio di ogni fase.

Contesto:
- Sono Alessandro, uso l'app dal mio Samsung Galaxy S25 (Chrome, Android).
- È una PWA pubblicata su GitHub Pages, sotto l'origine therealwab.github.io,
  condivisa con altre mie app: usa prefissi univoci per IndexedDB/localStorage
  e limita lo scope del service worker al percorso dell'app (vedi SPEC §2.1).
- Esiste già una vecchia versione dell'app: questa è un rifacimento completo.
  La vecchia era funzionale ma esteticamente datata. La priorità di questa
  versione è un design moderno, coerente e piacevole (SPEC §10) e un
  inserimento delle spese velocissimo (SPEC §5).

Regole di lavoro:
1. I miei dati personali non devono MAI finire su GitHub. Crea subito un
   .gitignore che escluda la cartella _privato/ e qualsiasi file di backup
   o export. Nel codice e nei test usa solo dati inventati.
2. HTML, CSS e JavaScript vanilla con moduli ES, senza build obbligatoria.
   Codice diviso in file separati per responsabilità (SPEC §11).
   Librerie solo se salvate localmente in vendor/.
3. Importi in centesimi interi, formati italiani per numeri e date.
4. Interfaccia in italiano. Solo icone Lucide, niente emoji.
5. Lavora per fasi (SPEC §12). Ora realizziamo SOLO la Fase 1.
6. Prima di scrivere codice, mostrami un breve piano della Fase 1: file che
   creerai, struttura dei dati, eventuali scelte non coperte da SPEC.md.
   Aspetta la mia conferma.
7. Se una richiesta di SPEC.md ti sembra sbagliata, poco pratica o in
   contrasto con altro, dimmelo e proponi un'alternativa invece di
   decidere da solo.
8. Cura il design fin da subito: design tokens in tokens.css, tema
   automatico chiaro/scuro, layout pensato per 360–412 px di larghezza.
9. A fine fase dammi: riepilogo di cosa hai fatto, istruzioni per provarla
   in locale e sul telefono, una checklist di verifica basata sui criteri
   di completamento della fase. Quando ti confermo che va bene, mostrami
   git status, poi fai commit, tag della fase e push sul repository
   spese2 (SPEC §12, "Repository e pubblicazione").

Iniziamo: leggi SPEC.md e mostrami il piano della Fase 1.
```

### 13.2 Prompt per le fasi successive

```
La Fase [N-1] è verificata e funziona. Passiamo alla Fase [N] —
[nome della fase] (SPEC.md §12).

Rileggi SPEC.md, in particolare le sezioni [sezioni pertinenti].
Prima di scrivere codice mostrami il piano della fase e aspetta conferma.
Valgono le stesse regole di lavoro del prompt iniziale: dati personali mai
su GitHub, codice in file separati, design coerente con tokens.css, niente
emoji, interfaccia in italiano. Non modificare il comportamento delle fasi
già completate se non necessario, e in quel caso dimmelo.
A fine fase: riepilogo, istruzioni di prova e checklist di verifica.
Dopo la mia conferma: git status, commit, tag fase-[N] e push.
```

Sezioni pertinenti per fase: Fase 2 → §8, §9 · Fase 3 → §6.4 · Fase 4 → §4, §6.3 · Fase 5 → §6.2 · Fase 6 → §7 · Fase 7 → §10.

### 13.3 Per la migrazione (Fase 2)

Prima di iniziare la Fase 2, esportare i dati dalla vecchia app e salvare il file in `_privato/`. Aggiungere al prompt della fase:

```
Nella cartella _privato/ trovi un file di export reale della vecchia app.
Usalo SOLO per capire il formato dei dati: non copiarne il contenuto nel
codice, nei test o in qualsiasi file che finisca su Git. Prima di scrivere
l'importazione, descrivimi il formato che hai trovato e come intendi
convertirlo nel nuovo modello dati.
```
