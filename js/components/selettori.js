// Selettori in foglio dal basso (conto, data, numero) e dialogo di conferma.
// Ognuno restituisce una Promise: il valore scelto, oppure undefined se l'utente chiude senza scegliere.

import { apriPannello } from './pannello.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { aggiungiGiorni, dataValida } from '../util/date.js';

const ETICHETTA_TIPO_CONTO = {
  conto: 'Conto',
  investimenti: 'Investimenti',
  'liquidità': 'Liquidità',
  altro: 'Altro',
};

export function scegliConto({ titolo, conti, selezionatoId }) {
  const ctrl = apriPannello({
    tipo: 'sheet',
    etichetta: titolo,
    riempi(el, c) {
      el.innerHTML = `
        <h2 class="foglio-titolo">${esc(titolo)}</h2>
        <div class="foglio-corpo" role="radiogroup" aria-label="${esc(titolo)}">
          ${conti.map((conto) => `
            <button type="button" class="opzione" role="radio" aria-checked="${conto.id === selezionatoId}" data-id="${esc(conto.id)}">
              ${cerchioIcona(conto.icona, conto.colore, 40)}
              <span class="opzione-testo">${esc(conto.nome)}<br><span class="riga-sotto">${esc(ETICHETTA_TIPO_CONTO[conto.tipo] ?? '')}</span></span>
              ${conto.id === selezionatoId ? `<span class="opzione-spunta">${icona('check', 22)}</span>` : ''}
            </button>`).join('')}
        </div>`;
      el.addEventListener('click', (e) => {
        const voce = e.target.closest('[data-id]');
        if (voce) c.chiudi(voce.dataset.id);
      });
    },
  });
  return ctrl.chiuso;
}

export function scegliData({ data, oggi }) {
  const ctrl = apriPannello({
    tipo: 'sheet',
    etichetta: 'Scegli la data',
    riempi(el, c) {
      el.innerHTML = `
        <h2 class="foglio-titolo">Data</h2>
        <div class="foglio-corpo">
          <div class="chip-riga">
            <button type="button" class="chip ${data === oggi ? 'chip-attivo' : ''}" data-data="${oggi}">Oggi</button>
            <button type="button" class="chip ${data === aggiungiGiorni(oggi, -1) ? 'chip-attivo' : ''}" data-data="${aggiungiGiorni(oggi, -1)}">Ieri</button>
          </div>
          <label class="solo-sr" for="campo-data">Altra data</label>
          <input id="campo-data" class="campo-data" type="date" value="${esc(data)}">
        </div>`;
      el.addEventListener('click', (e) => {
        const scelta = e.target.closest('[data-data]');
        if (scelta) c.chiudi(scelta.dataset.data);
      });
      el.querySelector('#campo-data').addEventListener('change', (e) => {
        if (dataValida(e.target.value)) c.chiudi(e.target.value);
      });
    },
  });
  return ctrl.chiuso;
}

/**
 * Foglio con un elenco di scelte (es. "a quale categoria corrisponde?"). Ogni opzione: { id, nome, icona, colore, sotto }.
 * Risolve con l'id scelto, oppure undefined se l'utente chiude. `nuova` aggiunge in fondo una voce "crea nuovo".
 */
export function scegliAbbinamento({ titolo, descrizione = '', opzioni, selezionatoId, nuova = null }) {
  const ctrl = apriPannello({
    tipo: 'sheet',
    etichetta: titolo,
    riempi(el, c) {
      const voce = (o) => `
        <button type="button" class="opzione" role="radio" aria-checked="${o.id === selezionatoId}" data-id="${esc(o.id)}">
          ${cerchioIcona(o.icona, o.colore, 40)}
          <span class="opzione-testo">${esc(o.nome)}${o.sotto ? `<br><span class="riga-sotto">${esc(o.sotto)}</span>` : ''}</span>
          ${o.id === selezionatoId ? `<span class="opzione-spunta">${icona('check', 22)}</span>` : ''}
        </button>`;
      el.innerHTML = `
        <h2 class="foglio-titolo">${esc(titolo)}</h2>
        <div class="foglio-corpo" role="radiogroup" aria-label="${esc(titolo)}">
          ${descrizione ? `<p class="riga-sotto">${esc(descrizione)}</p>` : ''}
          ${opzioni.map(voce).join('')}
          ${nuova ? voce({ ...nuova, id: '__nuova__' }) : ''}
        </div>`;
      el.addEventListener('click', (e) => {
        const scelta = e.target.closest('[data-id]');
        if (scelta) c.chiudi(scelta.dataset.id);
      });
    },
  });
  return ctrl.chiuso;
}

/** Griglia di numeri (es. il giorno di inizio del mese: 1–28). */
export function scegliNumero({ titolo, descrizione = '', da, a, selezionato }) {
  const numeri = Array.from({ length: a - da + 1 }, (_, i) => da + i);
  const ctrl = apriPannello({
    tipo: 'sheet',
    etichetta: titolo,
    riempi(el, c) {
      el.innerHTML = `
        <h2 class="foglio-titolo">${esc(titolo)}</h2>
        <div class="foglio-corpo">
          ${descrizione ? `<p class="riga-sotto">${esc(descrizione)}</p>` : ''}
          <div class="griglia-numeri" role="radiogroup" aria-label="${esc(titolo)}">
            ${numeri.map((n) => `<button type="button" role="radio" aria-checked="${n === selezionato}" data-n="${n}">${n}</button>`).join('')}
          </div>
        </div>`;
      el.addEventListener('click', (e) => {
        const voce = e.target.closest('[data-n]');
        if (voce) c.chiudi(Number(voce.dataset.n));
      });
    },
  });
  return ctrl.chiuso;
}

/** Dialogo di conferma. Risolve true solo se l'utente conferma. */
export async function conferma({ titolo, testo, etichettaConferma = 'Conferma', pericolo = false }) {
  const ctrl = apriPannello({
    tipo: 'dialogo',
    etichetta: titolo,
    riempi(el, c) {
      el.innerHTML = `
        <div class="dialogo-corpo"><h2>${esc(titolo)}</h2><p>${esc(testo)}</p></div>
        <div class="dialogo-azioni">
          <button type="button" class="pulsante pulsante-secondario" data-esito="no">Annulla</button>
          <button type="button" class="pulsante ${pericolo ? 'pulsante-pericolo' : ''}" data-esito="si">${esc(etichettaConferma)}</button>
        </div>`;
      el.addEventListener('click', (e) => {
        const esito = e.target.closest('[data-esito]')?.dataset.esito;
        if (esito) c.chiudi(esito === 'si');
      });
    },
  });
  return (await ctrl.chiuso) === true;
}
