// Elenco dei movimenti ricorrenti (SPEC §7, in Altro): cosa si ripete, ogni quanto, la prossima data; un tocco apre
// la modifica (pausa, elimina). Da qui si crea anche un ricorrente nuovo.

import { apriPannello } from './pannello.js';
import { apriEditorRicorrente } from './editor-ricorrente.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, etichettaGiorno } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { categoriaPerId, contoPerId } from '../model/catalogo.js';
import { descriviFrequenza, prossimaScadenza } from '../model/ricorrenti.js';
import { tuttiIRicorrenti } from '../model/ricorrenti-db.js';

/** Nome da mostrare per un ricorrente: la nota se c'è, altrimenti la categoria (o «Trasferimento»). */
export function nomeRicorrente(r) {
  if (r.modello.nota) return r.modello.nota;
  if (r.modello.tipo === 'trasferimento') return 'Trasferimento';
  return categoriaPerId(r.modello.categoriaId)?.nome ?? 'Movimento ricorrente';
}

export function apriRicorrenti() {
  const stato = { ricorrenti: null };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Movimenti ricorrenti',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      disegna();
      carica();
    },
  });
  document.addEventListener('spese2:ricorrenti', carica);
  document.addEventListener('spese2:movimenti', carica);
  ctrl.chiuso.then(() => {
    document.removeEventListener('spese2:ricorrenti', carica);
    document.removeEventListener('spese2:movimenti', carica);
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  async function carica() {
    stato.ricorrenti = await tuttiIRicorrenti();
    if (radice) disegna();
  }

  function riga(r, oggi) {
    const entrata = r.modello.tipo === 'entrata';
    const trasferimento = r.modello.tipo === 'trasferimento';
    const categoria = categoriaPerId(r.modello.categoriaId);
    const cerchio = trasferimento
      ? `<span class="cerchio cerchio-neutro" style="--dim:44px">${icona('arrow-left-right', 22)}</span>`
      : cerchioIcona(categoria?.icona ?? 'package', categoria?.colore ?? 'ardesia', 44);
    const prossima = prossimaScadenza(r);
    let quando;
    if (!r.attivo) quando = 'In pausa';
    else if (!prossima) quando = 'Serie terminata';
    else if (prossima <= oggi) quando = r.modalita === 'conferma' ? 'Da confermare' : `Prossima: ${etichettaGiorno(prossima, oggi)}`;
    else quando = `Prossima: ${etichettaGiorno(prossima, oggi)}`;
    const dettaglio = trasferimento ? `${contoPerId(r.modello.contoId)?.nome ?? '—'} → ${contoPerId(r.modello.contoDestinazioneId)?.nome ?? '—'}` : descriviFrequenza(r);
    return `
      <button type="button" class="riga-lista" data-id="${esc(r.id)}">
        ${cerchio}
        <span class="riga-testo">
          <span class="riga-titolo">${esc(nomeRicorrente(r))}</span>
          <span class="riga-sotto">${esc(trasferimento ? `${descriviFrequenza(r)} · ${dettaglio}` : dettaglio)}</span>
          <span class="riga-sotto er-quando ${r.attivo ? '' : 'in-pausa'}">${esc(quando)}${r.modalita === 'conferma' && quando !== 'Da confermare' ? ' · con conferma' : ''}</span>
        </span>
        <span class="riga-valore er-importo ${entrata ? 'importo-entrata' : ''}">${entrata ? '+' : (trasferimento ? '' : '−')}${esc(euro(r.modello.importo))}</span>
      </button>`;
  }

  function disegna() {
    const oggi = oggiIso();
    const lista = stato.ricorrenti;
    let corpo = '';
    if (lista === null) {
      corpo = '';
    } else if (!lista.length) {
      corpo = `
        <div class="stato-vuoto">
          <span class="cerchio cerchio-neutro" style="--dim:64px">${icona('repeat', 30)}</span>
          <h2>Nessun movimento ricorrente</h2>
          <p>Stipendio, PAC, abbonamenti, affitto: crea qui ciò che si ripete e l'app lo registra per te.</p>
        </div>`;
    } else {
      const ordina = (a, b) => (prossimaScadenza(a) ?? '9999') < (prossimaScadenza(b) ?? '9999') ? -1 : 1;
      const attivi = lista.filter((r) => r.attivo).sort(ordina);
      const inPausa = lista.filter((r) => !r.attivo).sort(ordina);
      corpo = `
        ${attivi.length ? `<div class="scheda">${attivi.map((r) => riga(r, oggi)).join('')}</div>` : ''}
        ${inPausa.length ? `
          <section class="gruppo">
            <h3 class="gruppo-titolo">In pausa (${inPausa.length})</h3>
            <div class="scheda">${inPausa.map((r) => riga(r, oggi)).join('')}</div>
          </section>` : ''}
        <p class="nota-fondo">Tocca un ricorrente per modificarlo, metterlo in pausa o eliminarlo. Puoi anche creare un ricorrente da un movimento già inserito: aprilo e tocca «Rendi ricorrente».</p>`;
    }
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Movimenti ricorrenti</h2>
        </header>
        <div class="flusso-corpo">${corpo}</div>
        <footer class="flusso-piede">
          <button type="button" class="pulsante pulsante-grande" data-az="nuovo">${icona('plus', 20)} Nuovo ricorrente</button>
        </footer>
      </div>`;
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (az === 'chiudi') c.chiudi(undefined);
    else if (az === 'nuovo') apriEditorRicorrente({});
    else if (id) apriEditorRicorrente({ ricorrenteId: id });
  }
}
