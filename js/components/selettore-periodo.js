// Selettore di periodo: frecce, titolo (un tocco torna al periodo corrente) e scelta del tipo di periodo.
// Usato da Categorie e Patrimonio (Mese · Anno · Sempre) e dai Grafici (tutti i modi, con date a scelta).
// Non conosce i dati: avvisa con `alCambio(periodo, direzione)`.

import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { oggiIso, dataValida } from '../util/date.js';
import {
  MODI_PERIODO, periodoContenente, periodoPrecedente, periodoSuccessivo, cambiaModo, etichettaPeriodo,
} from '../model/periodi.js';

const ETICHETTE_MODO = {
  giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese', '6mesi': '6 mesi', anno: 'Anno', personalizzato: 'Personalizzato', sempre: 'Sempre',
};

/**
 * @param {HTMLElement} contenitore
 * @param {{periodo: object, giornoInizio: () => number, alCambio: (periodo: object, direzione: number) => void, modi?: string[]}} opzioni
 * @returns {{periodo(): object, imposta(p: object): void, vai(direzione: number): void, aggiorna(): void}}
 */
export function creaSelettorePeriodo(contenitore, { periodo, giornoInizio, alCambio, modi = MODI_PERIODO }) {
  let corrente = periodo;
  let errore = '';
  const scorrevole = modi.length > 3; // con molti modi i pulsanti non stanno in riga: la riga scorre di lato

  function disegna() {
    const sempre = corrente.modo === 'sempre';
    const personalizzato = corrente.modo === 'personalizzato';
    contenitore.innerHTML = `
      <header class="mese-testata">
        <button type="button" class="btn-icona" data-sel="prec" aria-label="Periodo precedente" ${sempre ? 'disabled' : ''}>${icona('chevron-left', 24)}</button>
        <button type="button" class="mese-titolo" data-sel="oggi" aria-label="Torna al periodo corrente">${esc(etichettaPeriodo(corrente, giornoInizio(), oggiIso()))}</button>
        <button type="button" class="btn-icona" data-sel="succ" aria-label="Periodo successivo" ${sempre ? 'disabled' : ''}>${icona('chevron-right', 24)}</button>
      </header>
      <div class="segmentato sel-modi ${scorrevole ? 'sel-scorri' : ''}" role="group" aria-label="Tipo di periodo">
        ${modi.map((m) => `<button type="button" data-modo="${m}" aria-pressed="${m === corrente.modo}">${ETICHETTE_MODO[m]}</button>`).join('')}
      </div>
      ${personalizzato ? `
        <div class="sel-date">
          <label class="campo"><span>Dal</span><input type="date" class="campo-data" data-data="da" value="${esc(corrente.da)}"></label>
          <label class="campo"><span>Al</span><input type="date" class="campo-data" data-data="a" value="${esc(corrente.a)}"></label>
        </div>
        <p class="sel-errore" role="alert" ${errore ? '' : 'hidden'}>${esc(errore)}</p>` : ''}`;
    if (scorrevole) {
      const attivo = contenitore.querySelector('.sel-modi [aria-pressed="true"]');
      attivo?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    }
  }

  function imposta(nuovo, direzione = 0) {
    corrente = nuovo;
    errore = '';
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
      if (corrente.modo === 'personalizzato') return; // non c'è un "periodo corrente" per un intervallo scelto a mano
      const adesso = periodoContenente(corrente.modo, oggi, giornoInizio());
      if (adesso.da !== corrente.da) imposta(adesso, adesso.da > corrente.da ? 1 : -1);
    } else if (modo && modo !== corrente.modo) {
      imposta(cambiaModo(corrente, modo, oggi, giornoInizio()));
    }
  });

  // Date scelte a mano (solo "personalizzato"): si applicano quando sono entrambe valide e nell'ordine giusto.
  contenitore.addEventListener('change', (e) => {
    const quale = e.target.dataset?.data;
    if (!quale || corrente.modo !== 'personalizzato') return;
    const da = contenitore.querySelector('[data-data="da"]').value;
    const a = contenitore.querySelector('[data-data="a"]').value;
    if (!dataValida(da) || !dataValida(a)) return;
    if (da > a) {
      errore = 'La data di fine deve essere uguale o successiva a quella di inizio.';
      const nota = contenitore.querySelector('.sel-errore');
      nota.textContent = errore;
      nota.hidden = false;
      return;
    }
    imposta({ modo: 'personalizzato', da, a });
  });

  disegna();
  return {
    periodo: () => corrente,
    imposta: (p) => { corrente = p; errore = ''; disegna(); },
    vai,
    aggiorna: disegna,
  };
}
