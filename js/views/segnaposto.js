// Segnaposto curato per le aree che arrivano nelle fasi successive (Grafici, Patrimonio, Categorie).

import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';

/**
 * @param {{titolo: string, icona: string, colore: string, domanda: string, punti: string[]}} opzioni
 * @returns {{monta: (radice: HTMLElement) => void}}
 */
export function creaVistaSegnaposto({ titolo, icona: nomeIcona, colore, domanda, punti }) {
  return {
    monta(radice) {
      radice.innerHTML = `
        <h1 class="vista-titolo">${esc(titolo)}</h1>
        <section class="scheda segnaposto">
          <span class="cerchio col-${esc(colore)}" style="--dim:84px">${icona(nomeIcona, 40)}</span>
          <span class="badge">In arrivo</span>
          <h2>${esc(domanda)}</h2>
          <ul class="segnaposto-elenco">
            ${punti.map((p) => `<li><span class="segnaposto-spunta">${icona('check', 16)}</span>${esc(p)}</li>`).join('')}
          </ul>
        </section>`;
    },
  };
}
