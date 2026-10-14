// Tastierino numerico personalizzato per l'importo (SPEC §5): cifre, virgola, cancella.
// La logica (applicaTasto) è pura e testata; creaTastierino costruisce solo i pulsanti.

import { icona } from '../util/icone.js';

export const MAX_CIFRE_INTERE = 8; // fino a 99.999.999,99 €
export const MAX_DECIMALI = 2;

/**
 * Applica un tasto alla stringa digitata ("12,5").
 * tasto: "0"–"9" | "," | "cancella" | "azzera"
 */
export function applicaTasto(testo, tasto) {
  if (tasto === 'azzera') return '';
  if (tasto === 'cancella') return testo.slice(0, -1);
  if (tasto === ',') {
    if (testo.includes(',')) return testo;
    return `${testo || '0'},`;
  }
  if (!/^\d$/.test(tasto)) return testo;

  if (testo.includes(',')) {
    const decimali = testo.split(',')[1];
    return decimali.length >= MAX_DECIMALI ? testo : testo + tasto;
  }
  if (testo === '0') return tasto === '0' ? testo : tasto; // niente zeri iniziali: "05" → "5"
  if (testo.length >= MAX_CIFRE_INTERE) return testo;
  return testo + tasto;
}

const TASTI = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'cancella'];

/** Costruisce il tastierino dentro `contenitore`. `alTasto(tasto)` riceve ogni pressione. */
export function creaTastierino(contenitore, alTasto) {
  contenitore.classList.add('tastierino');
  contenitore.innerHTML = TASTI.map((t) => {
    if (t === 'cancella') {
      return `<button type="button" class="tasto tasto-azione" data-tasto="cancella" aria-label="Cancella l'ultima cifra">${icona('delete', 24)}</button>`;
    }
    const etichetta = t === ',' ? 'Virgola' : t;
    return `<button type="button" class="tasto" data-tasto="${t}" aria-label="${etichetta}">${t}</button>`;
  }).join('');

  let timerLungo = null;
  let lungoScattato = false;

  contenitore.addEventListener('pointerdown', (e) => {
    const tasto = e.target.closest('[data-tasto]')?.dataset.tasto;
    if (tasto !== 'cancella') return;
    lungoScattato = false;
    timerLungo = setTimeout(() => { lungoScattato = true; alTasto('azzera'); }, 500); // pressione lunga: azzera
  });
  const annullaLungo = () => clearTimeout(timerLungo);
  contenitore.addEventListener('pointerup', annullaLungo);
  contenitore.addEventListener('pointerleave', annullaLungo);
  contenitore.addEventListener('pointercancel', annullaLungo);

  contenitore.addEventListener('click', (e) => {
    const tasto = e.target.closest('[data-tasto]')?.dataset.tasto;
    if (!tasto) return;
    if (tasto === 'cancella' && lungoScattato) { lungoScattato = false; return; }
    alTasto(tasto);
  });
  contenitore.addEventListener('contextmenu', (e) => e.preventDefault());
}
