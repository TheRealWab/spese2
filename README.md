# Spese 2.0

App personale per tracciare spese, entrate e patrimonio. PWA installabile, funziona offline,
**i dati restano sul telefono** (IndexedDB): nessun server, nessun invio.

Specifiche e roadmap: [SPEC.md](SPEC.md). Stato attuale: **Fase 1** (fondamenta e inserimento).

## Provarla in locale

Serve solo Node (nessuna installazione di pacchetti):

```bash
node tools/server.mjs
```

Poi apri <http://localhost:8080/>. Su `localhost` il service worker usa la rete prima della cache,
così le modifiche al codice si vedono subito (offline resta valida la cache).

Test automatici (date, cicli mensili, indicatore stipendio, formati, tastierino, coerenza del progetto):

```bash
node --test "tests/*.test.mjs"
```

## Provarla sul telefono (Samsung S25, Chrome)

Il service worker e l'installazione richiedono **HTTPS o localhost**: aprire `http://192.168.x.x:8080`
dal telefono mostra l'app ma non la rende installabile né offline. Due strade:

1. **Debug USB (prima dei commit):** sul telefono attiva *Opzioni sviluppatore → Debug USB*, collega il
   cavo, sul PC apri `chrome://inspect/#devices`, *Port forwarding* → `8080` → `localhost:8080`.
   Poi su Chrome del telefono apri `http://localhost:8080/`.
2. **GitHub Pages:** dopo il push apri `https://therealwab.github.io/spese2/` dal telefono.

Per installarla: menu ⋮ di Chrome → *Installa app* (o *Aggiungi a schermata Home*).

## Aggiornare l'app dopo una modifica

Ogni rilascio cambia la versione in **due** punti (un test controlla che siano uguali):
`js/versione.js` (`VERSIONE_APP`) e `sw.js` (`VERSIONE`). Se si aggiunge o si rimuove un file, va
aggiornato anche l'elenco `FILE` in `sw.js` (un test segnala le dimenticanze).
Sul telefono, alla riapertura compare "Nuova versione disponibile → Aggiorna".

## Privacy

- La cartella `_privato/` e qualsiasi backup/export sono esclusi da Git (`.gitignore`).
  Lì vanno export della vecchia app, backup e screenshot con dati reali.
- Nel codice e nei test ci sono solo dati inventati.
- L'origine `therealwab.github.io` è condivisa con altre app: database `spese2_db`, chiavi
  `spese2_*`, cache `spese2-*`, service worker con scope limitato alla cartella dell'app.

## Struttura

```
index.html · manifest.webmanifest · sw.js
css/      tokens.css (colori, spazi, raggi) · base.css · components.css · inserimento.css · viste.css
js/       app.js (avvio, navigazione) · db.js (IndexedDB) · versione.js
  util/       date, formato (euro/date italiani), icone, dom, animazione, id
  model/      seed, catalogo, conti, categorie, movimenti, impostazioni, calcoli (puri), palette
  views/      mese, altro, segnaposto
  components/ inserimento, tastierino, selettori, pannello, riga-movimento, toast
vendor/lucide/   icone Lucide (ISC) usate dall'app
icons/           icone della PWA (generate da tools/genera-icone-pwa.mjs)
tools/           server locale e generatore icone
tests/           test con Node su dati inventati
```

## Note tecniche

- Importi in **centesimi interi**; date come stringhe `AAAA-MM-GG` (nessun fuso, nessuno scarto di un giorno).
- Tema con `light-dark()` (Chrome 123+): una dichiarazione per token, scelta manuale con `data-tema` su `<html>`.
- Icone: solo Lucide, nessuna emoji (un test lo verifica).
