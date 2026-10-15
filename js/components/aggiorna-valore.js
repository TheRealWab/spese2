// Foglio "Aggiorna valore" di un conto investimenti (SPEC §6.3): si scrive la cifra vista sulla piattaforma, con la
// data di oggi già impostata. Serve anche a correggere o eliminare un valore dello storico.

import { apriPannello } from './pannello.js';
import { conferma } from './selettori.js';
import { mostraToast } from './toast.js';
import { esc } from '../util/dom.js';
import { oggiIso } from '../util/date.js';
import { euro, euroConSegno, leggiImporto, percentualeConSegno } from '../util/formato.js';
import { tutti } from '../db.js';
import { contoPerId } from '../model/catalogo.js';
import { creaStoriaConto } from '../model/patrimonio.js';
import { ErroreConto, salvaValore, aggiornaValore, eliminaValore, ripristinaValore, tuttiIValori } from '../model/conti-db.js';

/**
 * @param {{contoId: string, valoreId?: string|null}} opzioni  con `valoreId` si modifica un valore dello storico
 * @returns {Promise<{azione: string}|undefined>}
 */
export function apriAggiornaValore({ contoId, valoreId = null }) {
  const conto = contoPerId(contoId);
  const stato = { valori: [], movimenti: [], esistente: null };
  const oggi = oggiIso();

  const ctrl = apriPannello({
    tipo: 'sheet',
    etichetta: 'Aggiorna valore',
    riempi(el, c) {
      el.innerHTML = '<h2 class="foglio-titolo">Aggiorna valore</h2><div class="foglio-corpo"><p class="riga-sotto">Un momento…</p></div>';
      carica().then(() => disegna(el, c));
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  async function carica() {
    [stato.valori, stato.movimenti] = await Promise.all([tuttiIValori(), tutti('movimenti')]);
    stato.esistente = valoreId ? stato.valori.find((v) => v.id === valoreId) ?? null : null;
  }

  function disegna(el, c) {
    if (!el.isConnected) return;
    const modifica = Boolean(stato.esistente);
    const data = stato.esistente?.data ?? oggi;
    el.innerHTML = `
      <h2 class="foglio-titolo">${modifica ? 'Modifica valore' : 'Aggiorna valore'} · ${esc(conto?.nome ?? '')}</h2>
      <form class="foglio-corpo" autocomplete="off" novalidate>
        <p class="riga-sotto">${modifica ? 'Correggi la cifra o la data.' : 'Scrivi quanto vale adesso, come lo vedi sulla piattaforma di investimento.'}</p>
        <div class="campo">
          <label for="val-importo">Valore (€)</label>
          <input id="val-importo" class="campo-testo" type="text" inputmode="decimal" enterkeyhint="done"
                 placeholder="Per esempio 12.345,67" value="${modifica ? (stato.esistente.valore / 100).toFixed(2).replace('.', ',') : ''}">
        </div>
        <div class="campo">
          <label for="val-data">Data</label>
          <input id="val-data" class="campo-data" type="date" max="${oggi}" value="${esc(data)}">
        </div>
        <p class="pt-anteprima" data-r="anteprima" aria-live="polite"></p>
        <p class="flusso-errore" role="alert" data-r="errore" hidden></p>
        <button type="submit" class="pulsante pulsante-grande">Salva</button>
        ${modifica ? '<button type="button" class="pulsante pulsante-grande pulsante-pericolo-tenue" data-az="elimina">Elimina questo valore</button>' : ''}
      </form>`;

    const campoImporto = el.querySelector('#val-importo');
    const campoData = el.querySelector('#val-data');
    const anteprima = el.querySelector('[data-r="anteprima"]');
    const errore = el.querySelector('[data-r="errore"]');
    const mostraErrore = (testo) => { errore.textContent = testo; errore.hidden = !testo; };

    // Mentre si scrive: quanto risulta versato a quella data e il guadagno che ne deriva.
    const aggiornaAnteprima = () => {
      const valore = leggiImporto(campoImporto.value);
      const storia = creaStoriaConto(conto, stato.movimenti, stato.valori.filter((v) => v.id !== stato.esistente?.id));
      const versato = storia.versatoAl(campoData.value || oggi);
      if (valore === null || valore < 0) { anteprima.textContent = `Versato finora: ${euro(versato)}`; return; }
      const guadagno = valore - versato;
      const perc = versato > 0 ? ` (${percentualeConSegno((guadagno / versato) * 100)})` : '';
      anteprima.textContent = `Versato finora: ${euro(versato)} · guadagno ${euroConSegno(guadagno)}${perc}`;
    };
    campoImporto.addEventListener('input', () => { mostraErrore(''); aggiornaAnteprima(); });
    campoData.addEventListener('input', () => { mostraErrore(''); aggiornaAnteprima(); });
    aggiornaAnteprima();

    el.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const valore = leggiImporto(campoImporto.value);
      if (valore === null || valore < 0) { mostraErrore('Scrivi il valore, per esempio 12.345,67.'); campoImporto.focus(); return; }
      try {
        if (modifica) await aggiornaValore(stato.esistente.id, { data: campoData.value, valore });
        else await salvaValore({ contoId, data: campoData.value, valore });
        mostraToast(modifica ? 'Valore modificato' : 'Valore aggiornato');
        c.chiudi({ azione: modifica ? 'modificato' : 'aggiornato' });
      } catch (errorePrevisto) {
        if (!(errorePrevisto instanceof ErroreConto)) console.error(errorePrevisto);
        mostraErrore(errorePrevisto instanceof ErroreConto ? errorePrevisto.message : 'Non sono riuscito a salvare. Riprova.');
      }
    });

    el.querySelector('[data-az="elimina"]')?.addEventListener('click', async () => {
      const ok = await conferma({
        titolo: 'Eliminare questo valore?',
        testo: 'Il valore sparisce dallo storico. Potrai annullare subito dopo.',
        etichettaConferma: 'Elimina',
        pericolo: true,
      });
      if (!ok) return;
      try {
        const eliminato = await eliminaValore(stato.esistente.id);
        mostraToast('Valore eliminato', eliminato
          ? { durata: 6000, azione: { etichetta: 'Annulla', alClick: () => ripristinaValore(eliminato).catch(console.error) } }
          : {});
        c.chiudi({ azione: 'eliminato' });
      } catch (errorePrevisto) {
        console.error(errorePrevisto);
        mostraErrore('Non sono riuscito a eliminarlo. Riprova.');
      }
    });

    if (!modifica) campoImporto.focus({ preventScroll: true });
  }
}
