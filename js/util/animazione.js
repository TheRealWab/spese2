// Animazioni di cifre. Rispettano prefers-reduced-motion.

import { movimentoRidotto } from './dom.js';

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
