// Elenco di gestione dei conti (SPEC §6.3): tutti i conti, anche gli archiviati, con accesso alla modifica e alla creazione.

import { apriPannello } from './pannello.js';
import { apriEditorConto } from './editor-conto.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { tuttiIContiInMemoria } from '../model/catalogo.js';
import { ETICHETTA_TIPO_CONTO } from '../model/conti.js';

export function apriGestioneConti() {
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Gestisci conti',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      disegna();
    },
  });
  // Quando si crea, modifica o archivia un conto, l'elenco si aggiorna da solo.
  document.addEventListener('spese2:conti', aggiorna);
  ctrl.chiuso.then(() => document.removeEventListener('spese2:conti', aggiorna));
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function aggiorna() { if (radice) disegna(); }

  function riga(conto) {
    return `
      <button type="button" class="riga-lista" data-conto="${esc(conto.id)}">
        ${cerchioIcona(conto.icona, conto.colore, 40)}
        <span class="riga-testo"><span class="riga-titolo">${esc(conto.nome)}</span><span class="riga-sotto">${esc(ETICHETTA_TIPO_CONTO[conto.tipo] ?? '')}</span></span>
        ${conto.archiviato ? '<span class="badge">Archiviato</span>' : ''}${icona('chevron-right', 18)}
      </button>`;
  }

  function disegna() {
    const posizione = radice.querySelector('.flusso-corpo')?.scrollTop ?? 0;
    const conti = tuttiIContiInMemoria();
    const attivi = conti.filter((c) => !c.archiviato);
    const archiviati = conti.filter((c) => c.archiviato);
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Gestisci conti</h2>
        </header>
        <div class="flusso-corpo">
          <div class="scheda">${attivi.map(riga).join('')}</div>
          ${archiviati.length ? `
            <section class="gruppo">
              <h3 class="gruppo-titolo">Archiviati (${archiviati.length})</h3>
              <div class="scheda">${archiviati.map(riga).join('')}</div>
              <p class="nota-fondo">I conti archiviati non contano nel patrimonio e non compaiono nell'inserimento, ma i loro movimenti restano nello storico.</p>
            </section>` : ''}
        </div>
        <footer class="flusso-piede">
          <button type="button" class="pulsante pulsante-grande" data-az="nuovo">${icona('plus', 20)} Nuovo conto</button>
        </footer>
      </div>`;
    if (posizione) radice.querySelector('.flusso-corpo').scrollTop = posizione;
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const contoId = e.target.closest('[data-conto]')?.dataset.conto;
    if (az === 'chiudi') c.chiudi(undefined);
    else if (az === 'nuovo') apriEditorConto({});
    else if (contoId) apriEditorConto({ contoId });
  }
}
