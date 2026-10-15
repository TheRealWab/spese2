// Elenco di gestione delle categorie (SPEC §6.4): tutte le categorie di un tipo, anche quelle archiviate,
// con accesso alla modifica e alla creazione. Il riordino trascinando arriva nel rilascio successivo.

import { apriPannello } from './pannello.js';
import { apriEditorCategoria } from './editor-categoria.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { tutteLeCategorieInMemoria } from '../model/catalogo.js';
import { ordinaManuale } from '../model/categorie.js';

/** @param {{tipo?: 'spesa'|'entrata'}} opzioni  il tipo mostrato all'apertura */
export function apriGestioneCategorie({ tipo = 'spesa' } = {}) {
  const stato = { tipo };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Gestisci categorie',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      disegna();
    },
  });
  // Quando si crea, modifica, archivia o unisce una categoria, l'elenco si aggiorna da solo.
  document.addEventListener('spese2:categorie', aggiorna);
  ctrl.chiuso.then(() => document.removeEventListener('spese2:categorie', aggiorna));
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function aggiorna() { if (radice) disegna(); }

  function riga(categoria) {
    return `
      <button type="button" class="riga-lista" data-categoria="${esc(categoria.id)}">
        ${cerchioIcona(categoria.icona, categoria.colore, 40)}
        <span class="riga-testo"><span class="riga-titolo">${esc(categoria.nome)}</span>${categoria.ruolo === 'stipendio' ? '<span class="riga-sotto">Alimenta «Ti restano»</span>' : ''}</span>
        ${categoria.archiviata ? '<span class="badge">Archiviata</span>' : ''}${icona('chevron-right', 18)}
      </button>`;
  }

  function disegna() {
    const posizione = radice.querySelector('.flusso-corpo')?.scrollTop ?? 0;
    const delTipo = ordinaManuale(tutteLeCategorieInMemoria().filter((c) => c.tipo === stato.tipo));
    const attive = delTipo.filter((c) => !c.archiviata);
    const archiviate = delTipo.filter((c) => c.archiviata);
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Gestisci categorie</h2>
        </header>
        <div class="flusso-corpo">
          <div class="segmentato" role="group" aria-label="Spese o entrate">
            <button type="button" data-tipo="spesa" aria-pressed="${stato.tipo === 'spesa'}">Spese</button>
            <button type="button" data-tipo="entrata" aria-pressed="${stato.tipo === 'entrata'}">Entrate</button>
          </div>
          ${attive.length
            ? `<div class="scheda">${attive.map(riga).join('')}</div>`
            : '<p class="flusso-guida">Non ci sono categorie attive di questo tipo.</p>'}
          ${archiviate.length ? `
            <section class="gruppo">
              <h3 class="gruppo-titolo">Archiviate (${archiviate.length})</h3>
              <div class="scheda">${archiviate.map(riga).join('')}</div>
              <p class="nota-fondo">Le categorie archiviate non compaiono nell'inserimento, ma i loro movimenti restano nello storico.</p>
            </section>` : ''}
        </div>
        <footer class="flusso-piede">
          <button type="button" class="pulsante pulsante-grande" data-az="nuova">${icona('plus', 20)} Nuova categoria</button>
        </footer>
      </div>`;
    if (posizione) radice.querySelector('.flusso-corpo').scrollTop = posizione;
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const nuovoTipo = e.target.closest('[data-tipo]')?.dataset.tipo;
    const categoriaId = e.target.closest('[data-categoria]')?.dataset.categoria;
    if (nuovoTipo) { stato.tipo = nuovoTipo; disegna(); }
    else if (az === 'chiudi') c.chiudi(undefined);
    else if (az === 'nuova') apriEditorCategoria({ tipo: stato.tipo });
    else if (categoriaId) apriEditorCategoria({ categoriaId });
  }
}
