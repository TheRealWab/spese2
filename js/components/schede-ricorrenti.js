// Schede di conferma dei ricorrenti "con conferma" (SPEC §7): «Stipendio di ottobre: 1.450 € — Conferma / Modifica
// importo / Salta». Compaiono da sole all'apertura dell'app.
//
// Come l'avviso di aggiornamento NON usano apriPannello: un pannello aggiunge una voce alla cronologia con
// history.pushState, e Chrome su Android considera "saltabile" la voce precedente se il push avviene senza un tocco
// dell'utente (qui la scheda compare da sola). Quindi è un dialogo senza cronologia.

import { esc, movimentoRidotto } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, etichettaGiorno, leggiImporto, centesimiInDigitato } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { tutti } from '../db.js';
import { categoriaPerId, contoPerId } from '../model/catalogo.js';
import { etichettaScadenza } from '../model/ricorrenti.js';
import { ErroreRicorrente, confermaScadenza, saltaScadenza } from '../model/ricorrenti-db.js';
import { mostraToast } from './toast.js';
import { nomeRicorrente } from './ricorrenti-elenco.js';

let aperta = false;

/**
 * @param {{ricorrenteId: string, data: string}[]} inAttesa  le scadenze da chiedere, nell'ordine
 * @returns {Promise<void>} si risolve quando le schede sono finite o l'utente sceglie «Più tardi»
 */
export async function mostraSchedeRicorrenti(inAttesa) {
  if (aperta || !inAttesa.length) return;
  aperta = true;
  const ricorrenti = new Map((await tutti('ricorrenti')).map((r) => [r.id, r]));
  const coda = inAttesa.filter((x) => ricorrenti.has(x.ricorrenteId));
  if (!coda.length) { aperta = false; return; }

  const sfondo = document.createElement('div');
  sfondo.className = 'pannello-sfondo pannello-dialogo avviso-app'; // niente "pannello-aperto": non è nella pila dei pannelli
  document.getElementById('strato-pannelli').append(sfondo);
  requestAnimationFrame(() => requestAnimationFrame(() => sfondo.classList.add('aperto')));

  let indice = 0;
  let modificando = false;
  let errore = '';

  return new Promise((risolvi) => {
    const chiudi = () => {
      if (!aperta) return;
      aperta = false;
      sfondo.classList.remove('aperto');
      setTimeout(() => sfondo.remove(), movimentoRidotto() ? 0 : 280);
      risolvi();
    };

    function disegna() {
      const voce = coda[indice];
      const r = ricorrenti.get(voce.ricorrenteId);
      const m = r.modello;
      const categoria = categoriaPerId(m.categoriaId);
      const entrata = m.tipo === 'entrata';
      const titolo = etichettaScadenza(nomeRicorrente(r), r, voce.data);
      const cerchio = m.tipo === 'trasferimento'
        ? `<span class="cerchio cerchio-neutro" style="--dim:56px">${icona('arrow-left-right', 28)}</span>`
        : cerchioIcona(categoria?.icona ?? 'package', categoria?.colore ?? 'ardesia', 56);
      const conto = contoPerId(m.contoId)?.nome ?? '—';
      const dettaglio = m.tipo === 'trasferimento' ? `${conto} → ${contoPerId(m.contoDestinazioneId)?.nome ?? '—'}` : conto;
      sfondo.innerHTML = `
        <div class="pannello" role="alertdialog" aria-modal="true" aria-label="${esc(titolo)}" tabindex="-1">
          <div class="dialogo-corpo scheda-ric">
            ${coda.length > 1 ? `<p class="scheda-ric-passo">${indice + 1} di ${coda.length}</p>` : ''}
            ${cerchio}
            <h2>${esc(titolo)}</h2>
            ${modificando
              ? `<div class="campo scheda-ric-campo"><label for="sr-importo" class="solo-sr">Importo</label>
                   <input id="sr-importo" class="campo-testo" type="text" inputmode="decimal" value="${esc((m.importo / 100).toFixed(2).replace('.', ','))}"></div>`
              : `<p class="scheda-ric-importo ${entrata ? 'importo-entrata' : ''}">${entrata ? '+' : (m.tipo === 'trasferimento' ? '' : '−')}${esc(euro(m.importo))}</p>`}
            <p class="scheda-ric-sotto">${esc(dettaglio)} · ${esc(etichettaGiorno(voce.data, oggiIso()))}</p>
            ${errore ? `<p class="flusso-errore" role="alert">${icona('triangle-alert', 18)}<span>${esc(errore)}</span></p>` : ''}
          </div>
          <div class="dialogo-azioni dialogo-azioni-colonna">
            <button type="button" class="pulsante" data-az="conferma">${modificando ? 'Conferma con questo importo' : 'Conferma'}</button>
            <div class="scheda-ric-secondarie">
              <button type="button" class="pulsante pulsante-secondario" data-az="${modificando ? 'annulla-modifica' : 'modifica'}">${modificando ? 'Annulla' : 'Modifica importo'}</button>
              <button type="button" class="pulsante pulsante-secondario" data-az="salta">Salta</button>
            </div>
            <button type="button" class="scheda-ric-dopo" data-az="dopo">Più tardi</button>
          </div>
        </div>`;
      sfondo.firstElementChild.focus({ preventScroll: true });
    }

    function avanti() {
      modificando = false;
      errore = '';
      indice += 1;
      if (indice >= coda.length) chiudi(); else disegna();
    }

    async function agisci(az) {
      const voce = coda[indice];
      try {
        if (az === 'conferma') {
          let importo = null;
          if (modificando) {
            importo = leggiImporto(sfondo.querySelector('#sr-importo')?.value);
            if (importo === null || importo <= 0) { errore = 'Scrivi un importo maggiore di zero, per esempio 1.450,00.'; disegna(); return; }
          }
          await confermaScadenza(voce.ricorrenteId, voce.data, importo);
          mostraToast('Movimento registrato');
          avanti();
        } else if (az === 'salta') {
          await saltaScadenza(voce.ricorrenteId, voce.data);
          mostraToast('Scadenza saltata');
          avanti();
        }
      } catch (e) {
        if (!(e instanceof ErroreRicorrente)) console.error(e);
        errore = e instanceof ErroreRicorrente ? e.message : 'Non sono riuscito a completare l\'operazione. Riprova.';
        disegna();
      }
    }

    sfondo.addEventListener('click', (e) => {
      const az = e.target.closest('[data-az]')?.dataset.az;
      if (az === 'modifica') { modificando = true; errore = ''; disegna(); sfondo.querySelector('#sr-importo')?.select(); }
      else if (az === 'annulla-modifica') { modificando = false; errore = ''; disegna(); }
      else if (az === 'dopo') chiudi();
      else if (az) agisci(az);
    });
    sfondo.addEventListener('submit', (e) => e.preventDefault());
    sfondo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'sr-importo') { e.preventDefault(); agisci('conferma'); } });
    disegna();
  });
}
