// Crea o modifica una categoria (SPEC §6.4): nome, icona (con ricerca) e colore; per quelle esistenti anche
// unisci, archivia/ripristina ed elimina. Risolve con l'esito, oppure undefined se si chiude senza fare nulla.

import { apriPannello } from './pannello.js';
import { conferma, scegliAbbinamento } from './selettori.js';
import { scegliIcona } from './selettore-icona.js';
import { mostraToast } from './toast.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { oggiIso } from '../util/date.js';
import { impostazioni } from '../model/impostazioni.js';
import { tutteLeCategorieInMemoria, categoriaPerId } from '../model/catalogo.js';
import { COLORI_CATEGORIA } from '../model/palette.js';
import { statoUltimoBackup } from '../model/backup.js';
import {
  LUNGHEZZA_MAX_NOME_CATEGORIA, coloreSuggerito, puoArchiviare, puoEliminare, puoUnire,
} from '../model/categorie.js';
import {
  ErroreCategoria, creaCategoria, aggiornaCategoria, archiviaCategoria, eliminaCategoria, unisciCategorie, contaUsi,
} from '../model/categorie-db.js';

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
const ETICHETTA_COLORE = {
  corallo: 'Corallo', arancio: 'Arancio', ambra: 'Ambra', lime: 'Lime', verde: 'Verde', smeraldo: 'Smeraldo', turchese: 'Turchese',
  ciano: 'Ciano', azzurro: 'Azzurro', blu: 'Blu', indaco: 'Indaco', viola: 'Viola', fucsia: 'Fucsia', rosa: 'Rosa', ardesia: 'Ardesia',
};

/**
 * @param {{categoriaId?: string|null, tipo?: 'spesa'|'entrata'}} opzioni  senza `categoriaId` se ne crea una nuova
 */
export function apriEditorCategoria({ categoriaId = null, tipo = 'spesa' } = {}) {
  const esistente = categoriaId ? categoriaPerId(categoriaId) : null;
  const stato = {
    tipo: esistente?.tipo ?? tipo,
    nome: esistente?.nome ?? '',
    icona: esistente?.icona ?? 'tag',
    colore: esistente?.colore ?? coloreSuggerito(tutteLeCategorieInMemoria(), tipo),
    errore: '',
    salvando: false,
    usi: null, // { movimenti, ricorrenti }, letto solo per le categorie esistenti
  };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: esistente ? 'Modifica categoria' : 'Nuova categoria',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('input', (e) => { if (e.target.id === 'ed-nome') { stato.nome = e.target.value; if (stato.errore) segnalaErrore(''); } });
      el.addEventListener('submit', (e) => { e.preventDefault(); salvaTutto(c); });
      disegna();
      if (esistente) contaUsi(esistente.id).then((usi) => { stato.usi = usi; disegna(); });
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function categoriaCorrente() { return esistente ? (categoriaPerId(esistente.id) ?? esistente) : null; }

  function disegna() {
    const nuova = !esistente;
    const corrente = categoriaCorrente();
    radice.innerHTML = `
      <div class="flusso col-${esc(stato.colore)}">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">${nuova ? 'Nuova categoria' : 'Modifica categoria'}</h2>
        </header>
        <form class="flusso-corpo" id="form-categoria" autocomplete="off" novalidate>
          <section class="scheda ed-anteprima">
            ${cerchioIcona(stato.icona, stato.colore, 72)}
            <div class="campo">
              <label for="ed-nome">Nome</label>
              <input id="ed-nome" class="campo-testo" type="text" maxlength="${LUNGHEZZA_MAX_NOME_CATEGORIA}" value="${esc(stato.nome)}"
                     placeholder="Per esempio Palestra" enterkeyhint="done" autocapitalize="sentences">
            </div>
          </section>

          ${nuova ? `
            <div class="segmentato" role="group" aria-label="Tipo di categoria">
              <button type="button" data-tipo="spesa" aria-pressed="${stato.tipo === 'spesa'}">Spesa</button>
              <button type="button" data-tipo="entrata" aria-pressed="${stato.tipo === 'entrata'}">Entrata</button>
            </div>` : `<p class="flusso-guida">Categoria di ${stato.tipo === 'entrata' ? 'entrata' : 'spesa'}${corrente?.archiviata ? ' · archiviata' : ''}.</p>`}

          <div class="scheda">
            <button type="button" class="riga-lista" data-az="icona">
              ${cerchioIcona(stato.icona, stato.colore, 40)}
              <span class="riga-testo"><span class="riga-titolo">Icona</span><span class="riga-sotto">Tocca per cambiarla o cercarne un'altra</span></span>${icona('chevron-right', 18)}
            </button>
          </div>

          <section class="gruppo">
            <h3 class="gruppo-titolo">Colore</h3>
            <div class="ed-colori" role="radiogroup" aria-label="Colore">
              ${COLORI_CATEGORIA.map((col) => `
                <button type="button" class="ed-colore col-${col}" role="radio" aria-checked="${col === stato.colore}" aria-label="${ETICHETTA_COLORE[col]}" data-colore="${col}">
                  <span class="ed-pallino">${col === stato.colore ? icona('check', 18) : ''}</span>
                </button>`).join('')}
            </div>
          </section>

          ${nuova ? '' : htmlAzioni(corrente)}
          <p class="flusso-errore" role="alert" data-r="errore" ${stato.errore ? '' : 'hidden'}>${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>
        </form>
        <footer class="flusso-piede">
          <button type="button" class="pulsante pulsante-grande" data-az="salva" ${stato.salvando ? 'disabled' : ''}>${nuova ? 'Crea la categoria' : 'Salva le modifiche'}</button>
        </footer>
      </div>`;
  }

  function htmlAzioni(corrente) {
    if (!corrente) return '';
    const altre = tutteLeCategorieInMemoria().filter((x) => x.tipo === corrente.tipo && !x.archiviata && x.id !== corrente.id);
    const eStipendio = corrente.ruolo === 'stipendio';
    const permessoElimina = stato.usi ? puoEliminare(corrente, stato.usi) : { ok: false, motivo: 'Controllo i movimenti…' };
    const riga = (az, nomeIcona, titolo, sotto, extra = '') => `
      <button type="button" class="riga-lista ${extra}" data-az="${az}">
        <span class="cerchio cerchio-neutro">${icona(nomeIcona, 20)}</span>
        <span class="riga-testo"><span class="riga-titolo">${titolo}</span>${sotto ? `<span class="riga-sotto">${esc(sotto)}</span>` : ''}</span>${icona('chevron-right', 18)}
      </button>`;
    return `
      <section class="gruppo">
        <h3 class="gruppo-titolo">Altre azioni</h3>
        <div class="scheda">
          ${eStipendio
            ? `<p class="ed-nota">${icona('info', 18)}<span>${esc(puoArchiviare(corrente).motivo)}</span></p>`
            : `${altre.length ? riga('unisci', 'layers', 'Unisci con un\'altra categoria', 'I movimenti passano alla categoria scelta') : ''}
               ${riga(corrente.archiviata ? 'ripristina' : 'archivia', corrente.archiviata ? 'rotate-ccw' : 'inbox', corrente.archiviata ? 'Ripristina' : 'Archivia', corrente.archiviata ? 'Torna disponibile nell\'inserimento' : 'Sparisce dall\'inserimento, lo storico resta')}
               ${permessoElimina.ok
                 ? riga('elimina', 'trash-2', 'Elimina', 'È vuota: si può eliminare', 'ed-pericolo')
                 : `<p class="ed-nota">${icona('info', 18)}<span>${esc(permessoElimina.motivo)}</span></p>`}`}
        </div>
      </section>`;
  }

  function segnalaErrore(testo) {
    stato.errore = testo;
    const campo = radice.querySelector('[data-r="errore"]');
    if (!campo) return;
    campo.hidden = !testo;
    campo.querySelector('span').textContent = testo;
  }

  async function salvaTutto(c) {
    if (stato.salvando) return;
    stato.salvando = true;
    radice.querySelector('[data-az="salva"]')?.setAttribute('disabled', '');
    try {
      if (esistente) {
        await aggiornaCategoria(esistente.id, { nome: stato.nome, icona: stato.icona, colore: stato.colore });
        mostraToast('Modifiche salvate');
        c.chiudi({ azione: 'modificata', id: esistente.id });
      } else {
        const creata = await creaCategoria({ nome: stato.nome, tipo: stato.tipo, icona: stato.icona, colore: stato.colore });
        mostraToast(`Categoria «${creata.nome}» creata`);
        c.chiudi({ azione: 'creata', id: creata.id });
      }
    } catch (e) {
      stato.salvando = false;
      radice.querySelector('[data-az="salva"]')?.removeAttribute('disabled');
      if (e instanceof ErroreCategoria) { segnalaErrore(e.message); radice.querySelector('#ed-nome')?.focus(); return; }
      console.error(e);
      segnalaErrore('Non sono riuscito a salvare. Riprova.');
    }
  }

  async function unisci(c) {
    const origine = categoriaCorrente();
    const opzioni = tutteLeCategorieInMemoria()
      .filter((x) => x.tipo === origine.tipo && !x.archiviata && x.id !== origine.id)
      .map((x) => ({ id: x.id, nome: x.nome, icona: x.icona, colore: x.colore }));
    const destinazioneId = await scegliAbbinamento({
      titolo: `Unisci «${origine.nome}» con`,
      descrizione: 'I movimenti passeranno alla categoria scelta e questa verrà eliminata.',
      opzioni,
    });
    const destinazione = destinazioneId ? categoriaPerId(destinazioneId) : null;
    if (!destinazione) return;
    const permesso = puoUnire(origine, destinazione);
    if (!permesso.ok) { segnalaErrore(permesso.motivo); return; }
    const usi = stato.usi ?? await contaUsi(origine.id);
    const backup = statoUltimoBackup(impostazioni().ultimoBackup, oggiIso());
    const ok = await conferma({
      titolo: 'Unire le categorie?',
      testo: `${plurale(usi.movimenti, 'movimento', 'movimenti')} di «${origine.nome}» passeranno a «${destinazione.nome}» e «${origine.nome}» verrà eliminata. L'operazione non si può annullare.${backup.daFare ? ' Non hai un backup recente: conviene farlo prima (Altro → Backup).' : ''}`,
      etichettaConferma: 'Unisci',
      pericolo: true,
    });
    if (!ok) return;
    try {
      const spostati = await unisciCategorie(origine.id, destinazione.id);
      mostraToast(`${plurale(spostati, 'movimento spostato', 'movimenti spostati')} in «${destinazione.nome}»`);
      c.chiudi({ azione: 'unita', id: destinazione.id });
    } catch (e) {
      console.error(e);
      segnalaErrore(e instanceof ErroreCategoria ? e.message : 'Non sono riuscito a unire le categorie. Non è cambiato nulla.');
    }
  }

  async function archivia(c, archiviata) {
    try {
      await archiviaCategoria(esistente.id, archiviata);
      mostraToast(archiviata ? 'Categoria archiviata' : 'Categoria ripristinata', archiviata
        ? { azione: { etichetta: 'Annulla', alClick: () => archiviaCategoria(esistente.id, false).catch(console.error) } }
        : {});
      c.chiudi({ azione: archiviata ? 'archiviata' : 'ripristinata', id: esistente.id });
    } catch (e) {
      console.error(e);
      segnalaErrore(e instanceof ErroreCategoria ? e.message : 'Non sono riuscito a completare l\'operazione.');
    }
  }

  async function eliminaQuesta(c) {
    const corrente = categoriaCorrente();
    const ok = await conferma({
      titolo: 'Eliminare la categoria?',
      testo: `«${corrente.nome}» non ha movimenti e verrà eliminata. L'operazione non si può annullare.`,
      etichettaConferma: 'Elimina',
      pericolo: true,
    });
    if (!ok) return;
    try {
      await eliminaCategoria(corrente.id);
      mostraToast('Categoria eliminata');
      c.chiudi({ azione: 'eliminata', id: corrente.id });
    } catch (e) {
      console.error(e);
      segnalaErrore(e instanceof ErroreCategoria ? e.message : 'Non sono riuscito a eliminarla.');
    }
  }

  async function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const colore = e.target.closest('[data-colore]')?.dataset.colore;
    const nuovoTipo = e.target.closest('[data-tipo]')?.dataset.tipo;
    if (colore) { stato.colore = colore; disegna(); return; }
    if (nuovoTipo && nuovoTipo !== stato.tipo) {
      stato.tipo = nuovoTipo;
      stato.colore = coloreSuggerito(tutteLeCategorieInMemoria(), nuovoTipo);
      stato.errore = '';
      disegna();
      return;
    }
    switch (az) {
      case 'chiudi': c.chiudi(undefined); break;
      case 'salva': await salvaTutto(c); break;
      case 'icona': {
        const scelta = await scegliIcona({ colore: stato.colore, selezionata: stato.icona });
        if (scelta) { stato.icona = scelta; disegna(); }
        break;
      }
      case 'unisci': await unisci(c); break;
      case 'archivia': await archivia(c, true); break;
      case 'ripristina': await archivia(c, false); break;
      case 'elimina': await eliminaQuesta(c); break;
      default: break;
    }
  }
}
