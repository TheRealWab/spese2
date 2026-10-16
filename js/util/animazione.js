// Animazioni di cifre. Rispettano prefers-reduced-motion.

import { movimentoRidotto } from './dom.js';
import { euro, euroCompatto, euroArrotondato, euroConSegno } from './formato.js';
import { importiNascosti } from './importi-privati.js';

const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * Fa "scorrere" il valore mostrato in un elemento da `da` ad `a` (centesimi).
 * `formatta` trasforma i centesimi in testo. Annulla l'animazione precedente sullo stesso elemento.
 */
export function animaNumero(elemento, da, a, formatta, durata = 450) {
  cancelAnimationFrame(elemento._animazione);
  if (movimentoRidotto() || da === a || !Number.isFinite(da)) {
    elemento.textContent = formatta(a);
    return;
  }
  const inizio = performance.now();
  const passo = (adesso) => {
    const t = Math.min(1, (adesso - inizio) / durata);
    elemento.textContent = formatta(Math.round(da + (a - da) * easeOut(t)));
    if (t < 1) elemento._animazione = requestAnimationFrame(passo);
  };
  elemento._animazione = requestAnimationFrame(passo);
}

// ---- Un solo modo di animare le cifre grandi, uguale in tutte le sezioni ----
//
// Nell'HTML una cifra si marca con attrCifra(chiave, centesimi, formato) e si scrive già col suo testo finale.
// Dopo aver inserito l'HTML, animaCifre() le fa scorrere: dall'ultimo valore visto con la stessa chiave
// (cambio periodo, nuovo movimento…) oppure da 0 la prima volta. `memoria` è una Map che la sezione tiene viva
// anche quando si cambia area.

const FORMATI = { euro, compatto: euroCompatto, arrotondato: euroArrotondato, segno: euroConSegno };

/** Gli attributi per marcare una cifra animabile. `privata`: con l'occhio "nascondi" attivo non si anima né si tocca. */
export function attrCifra(chiave, centesimi, formato = 'euro', privata = false) {
  return `data-conta="${String(chiave).replace(/"/g, '')}" data-cent="${Math.round(centesimi)}" data-fmt="${formato}"${privata ? ' data-privata' : ''}`;
}

export function animaCifre(radice, memoria) {
  const nascosti = importiNascosti();
  radice.querySelectorAll('[data-conta]').forEach((el) => {
    const chiave = el.dataset.conta;
    const a = Number(el.dataset.cent);
    if (nascosti && el.hasAttribute('data-privata')) { memoria.delete(chiave); return; }
    const formatta = FORMATI[el.dataset.fmt] ?? euro;
    animaNumero(el, memoria.get(chiave) ?? 0, a, formatta);
    memoria.set(chiave, a);
  });
}
