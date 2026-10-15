// Selettore di periodo: frecce, titolo (un tocco torna al periodo corrente) e scelta Mese · Anno · Sempre.
// Usato da Categorie ora e dai Grafici nella Fase 5. Non conosce i dati: avvisa con `alCambio(periodo, direzione)`.

import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { oggiIso } from '../util/date.js';
import {
  MODI_PERIODO, periodoContenente, periodoPrecedente, periodoSuccessivo, cambiaModo, etichettaPeriodo,
} from '../model/periodi.js';

const ETICHETTE_MODO = { mese: 'Mese', anno: 'Anno', sempre: 'Sempre' };

/**
 * @param {HTMLElement} contenitore
 * @param {{periodo: object, giornoInizio: () => number, alCambio: (periodo: object, direzione: number) => void}} opzioni
 * @returns {{periodo(): object, imposta(p: object): void, vai(direzione: number): void, aggiorna(): void}}
 */
export function creaSelettorePeriodo(contenitore, { periodo, giornoInizio, alCambio }) {
  let corrente = periodo;

  function disegna() {
    const sempre = corrente.modo === 'sempre';
    contenitore.innerHTML = `
      <header class="mese-testata">
        <button type="button" class="btn-icona" data-sel="prec" aria-label="Periodo precedente" ${sempre ? 'disabled' : ''}>${icona('chevron-left', 24)}</button>
        <button type="button" class="mese-titolo" data-sel="oggi" aria-label="Torna al periodo corrente">${esc(etichettaPeriodo(corrente, giornoInizio()))}</button>
        <button type="button" class="btn-icona" data-sel="succ" aria-label="Periodo successivo" ${sempre ? 'disabled' : ''}>${icona('chevron-right', 24)}</button>
      </header>
      <div class="segmentato sel-modi" role="group" aria-label="Tipo di periodo">
        ${MODI_PERIODO.map((m) => `<button type="button" data-modo="${m}" aria-pressed="${m === corrente.modo}">${ETICHETTE_MODO[m]}</button>`).join('')}
      </div>`;
  }

  function imposta(nuovo, direzione = 0) {
    corrente = nuovo;
    disegna();
    alCambio(corrente, direzione);
  }

  function vai(direzione) {
    if (corrente.modo === 'sempre') return;
    imposta(direzione > 0 ? periodoSuccessivo(corrente, giornoInizio()) : periodoPrecedente(corrente, giornoInizio()), direzione);
  }

  contenitore.addEventListener('click', (e) => {
    const sel = e.target.closest('[data-sel]')?.dataset.sel;
    const modo = e.target.closest('[data-modo]')?.dataset.modo;
    const oggi = oggiIso();
    if (sel === 'prec') vai(-1);
    else if (sel === 'succ') vai(1);
    else if (sel === 'oggi') {
      const adesso = periodoContenente(corrente.modo, oggi, giornoInizio());
      if (adesso.da !== corrente.da) imposta(adesso, adesso.da > corrente.da ? 1 : -1);
    } else if (modo && modo !== corrente.modo) {
      imposta(cambiaModo(corrente, modo, oggi, giornoInizio()));
    }
  });

  disegna();
  return {
    periodo: () => corrente,
    imposta: (p) => { corrente = p; disegna(); },
    vai,
    aggiorna: disegna,
  };
}
