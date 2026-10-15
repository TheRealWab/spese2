# Lucide (icone)

- Sorgente: pacchetto npm `lucide-static` v1.57.0 — licenza ISC (vedi `LICENSE`).
- `icone.js` e `tag.js` sono **generati** e contengono l'intero set (2.154 icone):
  - `icone.js`: nome → markup interno dell'SVG; l'app lo usa per disegnare tutte le icone.
  - `tag.js`: nome → parole chiave inglesi; si carica solo quando si cerca un'icona (ricerca in italiano e in inglese).
- Per aggiornare la versione:
  1. `npm pack lucide-static --ignore-scripts` e estrarre il `.tgz` in una cartella temporanea (crea `package/`);
  2. `node tools/genera-icone-lucide.mjs <cartella>/package`.
- Le parole italiane per la ricerca stanno in `js/model/parole-icone.js` (un test controlla che ogni voce trovi un'icona).
