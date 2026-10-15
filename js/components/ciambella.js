// Ciambella delle spese per categoria, in SVG scritto a mano: ogni fetta è un cerchio tratteggiato (lunghezza = percentuale).
// I colori sono quelli delle categorie. Le fette "si disegnano" una dopo l'altra; un tocco su una fetta apre la categoria.

import { esc } from '../util/dom.js';
import { euroCompatto } from '../util/formato.js';
import { categoriaPerId } from '../model/catalogo.js';

const RAGGIO = 46;
const SPAZIO = 0.7; // vuoto tra una fetta e l'altra, in % della circonferenza

/**
 * @param {HTMLElement} contenitore
 * @param {{fette: {categoriaId: string|null, percentuale: number, altre: boolean}[], totale: number, etichetta: string,
 *          alTocco: (categoriaId: string) => void}} opzioni
 */
export function creaCiambella(contenitore, { fette, totale, etichetta, alTocco }) {
  let cumulata = 0;
  const cerchi = fette.map((f, i) => {
    const lunghezza = Math.max(fette.length > 1 ? f.percentuale - SPAZIO : f.percentuale, 0.3);
    const colore = f.altre ? '' : (categoriaPerId(f.categoriaId)?.colore ?? 'ardesia');
    const nome = f.altre ? 'Altre' : (categoriaPerId(f.categoriaId)?.nome ?? 'Categoria eliminata');
    const html = `
      <circle class="cia-fetta ${f.altre ? 'cia-altre' : `col-${esc(colore)}`}" ${f.altre ? '' : `data-id="${esc(f.categoriaId)}"`}
              cx="60" cy="60" r="${RAGGIO}" pathLength="100" transform="rotate(-90 60 60)"
              stroke-dasharray="0 100" stroke-dashoffset="${(-cumulata).toFixed(3)}"
              data-lunghezza="${lunghezza.toFixed(3)}" style="--i:${i}"><title>${esc(nome)}</title></circle>`;
    cumulata += f.percentuale;
    return html;
  }).join('');

  contenitore.innerHTML = `
    <div class="cia" role="img" aria-label="Spese per categoria">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="cia-fondo" cx="60" cy="60" r="${RAGGIO}"/>
        ${cerchi}
      </svg>
      <div class="cia-centro"><span class="cia-et">${esc(etichetta)}</span><span class="cia-tot">${esc(euroCompatto(totale))}</span></div>
    </div>`;

  contenitore.querySelectorAll('.cia-fetta').forEach((c) => {
    const lunghezza = Number(c.dataset.lunghezza);
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDasharray = `${lunghezza} ${100 - lunghezza}`; }));
  });
  contenitore.addEventListener('click', (e) => {
    const id = e.target.closest('.cia-fetta[data-id]')?.dataset.id;
    if (id) alTocco(id);
  });
}
