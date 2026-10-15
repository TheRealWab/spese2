// Elenco di gestione delle categorie (SPEC §6.4): tutte le categorie di un tipo, anche quelle archiviate,
// con accesso alla modifica e alla creazione, e riordino delle attive trascinando la maniglia.

import { apriPannello } from './pannello.js';
import { apriEditorCategoria } from './editor-categoria.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { tutteLeCategorieInMemoria } from '../model/catalogo.js';
import { ordinaManuale } from '../model/categorie.js';
import { riordinaCategorie } from '../model/categorie-db.js';
import { mostraToast } from './toast.js';

/** @param {{tipo?: 'spesa'|'entrata'}} opzioni  il tipo mostrato all'apertura */
export function apriGestioneCategorie({ tipo = 'spesa' } = {}) {
  const stato = { tipo, focusId: null };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Gestisci categorie',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('pointerdown', (e) => {
        const maniglia = e.target.closest('[data-maniglia]');
        if (maniglia && (e.button === 0 || e.pointerType !== 'mouse')) iniziaTrascinamento(e, maniglia);
      });
      el.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-maniglia]')) e.preventDefault(); });
      el.addEventListener('keydown', (e) => {
        const maniglia = e.target.closest('[data-maniglia]');
        if (!maniglia || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        spostaDi(maniglia.closest('.ct-riga').dataset.id, e.key === 'ArrowUp' ? -1 : 1);
      });
      disegna();
    },
  });
  // Quando si crea, modifica, archivia o unisce una categoria, l'elenco si aggiorna da solo.
  document.addEventListener('spese2:categorie', aggiorna);
  ctrl.chiuso.then(() => document.removeEventListener('spese2:categorie', aggiorna));
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function aggiorna() { if (radice) disegna(); }

  /** Una riga dell'elenco. Le attive hanno la maniglia per il riordino (solo se ce n'è più d'una). */
  function riga(categoria, { ordinabile = false } = {}) {
    return `
      <div class="ct-riga" data-id="${esc(categoria.id)}">
        <button type="button" class="riga-lista" data-categoria="${esc(categoria.id)}">
          ${cerchioIcona(categoria.icona, categoria.colore, 40)}
          <span class="riga-testo"><span class="riga-titolo">${esc(categoria.nome)}</span>${categoria.ruolo === 'stipendio' ? '<span class="riga-sotto">Alimenta «Ti restano»</span>' : ''}</span>
          ${categoria.archiviata ? '<span class="badge">Archiviata</span>' : ''}${ordinabile ? '' : icona('chevron-right', 18)}
        </button>
        ${ordinabile ? `<button type="button" class="ct-maniglia" data-maniglia aria-label="Sposta «${esc(categoria.nome)}»: trascina, oppure usa le frecce su e giù">${icona('grip-vertical', 22)}</button>` : ''}
      </div>`;
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
            ? `<div class="scheda ct-lista">${attive.map((c) => riga(c, { ordinabile: attive.length > 1 })).join('')}</div>`
            : '<p class="flusso-guida">Non ci sono categorie attive di questo tipo.</p>'}
          ${attive.length > 1 ? `<p class="nota-fondo">${icona('grip-vertical', 14)} Trascina per cambiare l'ordine. Si vede nell'inserimento quando in Altro l'ordine delle categorie è «Manuale»; con «Più usate» conta solo a parità di utilizzo.</p>` : ''}
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
    if (stato.focusId) { // dopo uno spostamento con le frecce, la maniglia resta selezionata
      radice.querySelector(`.ct-riga[data-id="${CSS.escape(stato.focusId)}"] .ct-maniglia`)?.focus({ preventScroll: true });
      stato.focusId = null;
    }
  }

  // ---- Riordino ----

  function idsAttivi() { return [...radice.querySelectorAll('.ct-lista .ct-riga')].map((r) => r.dataset.id); }

  async function salvaOrdine(ids) {
    try {
      await riordinaCategorie(stato.tipo, ids);
    } catch (errore) {
      console.error(errore);
      mostraToast('Non sono riuscito a salvare l\'ordine');
      disegna();
    }
  }

  /** Sposta una categoria di una posizione (frecce della tastiera): l'alternativa al trascinamento. */
  function spostaDi(id, delta) {
    const ids = idsAttivi();
    const da = ids.indexOf(id);
    const a = da + delta;
    if (da < 0 || a < 0 || a >= ids.length) return;
    ids.splice(a, 0, ids.splice(da, 1)[0]);
    stato.focusId = id;
    salvaOrdine(ids);
  }

  /**
   * Trascinamento dalla maniglia. La riga segue il dito, le altre si scostano per fare posto; al rilascio si
   * riordina l'elenco subito (senza aspettare il database) e poi si salva. Vicino ai bordi la lista scorre da sola.
   */
  function iniziaTrascinamento(e, maniglia) {
    const riga = maniglia.closest('.ct-riga');
    const lista = riga.parentElement;
    const righe = [...lista.querySelectorAll('.ct-riga')];
    const da = righe.indexOf(riga);
    if (righe.length < 2 || da < 0) return;
    e.preventDefault();
    const corpo = radice.querySelector('.flusso-corpo');
    const altezza = riga.offsetHeight;
    const y0 = e.clientY;
    const scroll0 = corpo.scrollTop;
    let yDito = y0;
    let a = da;
    let raf = 0;

    maniglia.setPointerCapture(e.pointerId);
    riga.classList.add('trascinata');
    lista.classList.add('in-riordino');
    try { navigator.vibrate?.(8); } catch { /* facoltativo */ }

    const aggiornaPosizioni = () => {
      const spostamento = Math.max(-da * altezza, Math.min((righe.length - 1 - da) * altezza, yDito - y0 + (corpo.scrollTop - scroll0)));
      riga.style.transform = `translateY(${spostamento}px)`;
      a = Math.max(0, Math.min(righe.length - 1, Math.round((da * altezza + spostamento) / altezza)));
      righe.forEach((r, i) => {
        if (r === riga) return;
        const scarto = da < a && i > da && i <= a ? -altezza : (da > a && i < da && i >= a ? altezza : 0);
        r.style.transform = scarto ? `translateY(${scarto}px)` : '';
      });
    };
    const scorriAiBordi = () => {
      const r = corpo.getBoundingClientRect();
      const zona = 72;
      const passo = yDito < r.top + zona ? -(r.top + zona - yDito) / 5 : (yDito > r.bottom - zona ? (yDito - (r.bottom - zona)) / 5 : 0);
      if (passo) { corpo.scrollTop += Math.sign(passo) * Math.max(1, Math.round(Math.abs(passo))); aggiornaPosizioni(); }
      raf = requestAnimationFrame(scorriAiBordi);
    };
    const muovi = (ev) => { yDito = ev.clientY; aggiornaPosizioni(); };
    const finisci = (conferma) => {
      cancelAnimationFrame(raf);
      maniglia.removeEventListener('pointermove', muovi);
      maniglia.removeEventListener('pointerup', alRilascio);
      maniglia.removeEventListener('pointercancel', alAnnullo);
      righe.forEach((r) => { r.style.transform = ''; });
      riga.classList.remove('trascinata');
      lista.classList.remove('in-riordino');
      if (!conferma || a === da) return;
      lista.insertBefore(riga, a > da ? righe[a].nextSibling : righe[a]);
      salvaOrdine(idsAttivi());
    };
    const alRilascio = () => finisci(true);
    const alAnnullo = () => finisci(false);
    maniglia.addEventListener('pointermove', muovi);
    maniglia.addEventListener('pointerup', alRilascio);
    maniglia.addEventListener('pointercancel', alAnnullo);
    raf = requestAnimationFrame(scorriAiBordi);
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
