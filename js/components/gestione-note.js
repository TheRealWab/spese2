// Gestione delle note di una categoria (SPEC §6.4): elenco con quante volte è usata ciascuna, rinomina e unione.
// La modifica vale per tutti i movimenti della categoria, di ogni periodo, ed è sempre annullabile dal messaggio.

import { apriPannello } from './pannello.js';
import { conferma } from './selettori.js';
import { mostraToast } from './toast.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { categoriaPerId } from '../model/catalogo.js';
import { CHIAVE_SENZA_NOTA, LUNGHEZZA_MAX_NOTA, risolviNuovoNome } from '../model/note.js';
import { noteDellaCategoria, cambiaNota, annullaCambioNota, ErroreNota } from '../model/note-db.js';

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/** @param {{categoriaId: string}} opzioni */
export function apriGestioneNote({ categoriaId }) {
  const stato = { voci: [], caricato: false };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Gestisci note',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      disegna();
      carica();
    },
  });
  // Dopo ogni modifica (anche annullata) l'elenco si rilegge dal database.
  document.addEventListener('spese2:movimenti', carica);
  ctrl.chiuso.then(() => document.removeEventListener('spese2:movimenti', carica));
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  async function carica() {
    stato.voci = await noteDellaCategoria(categoriaId);
    stato.caricato = true;
    if (radice) disegna();
  }

  function disegna() {
    const categoria = categoriaPerId(categoriaId);
    const conNota = stato.voci.filter((v) => v.chiave !== CHIAVE_SENZA_NOTA);
    const senza = stato.voci.find((v) => v.chiave === CHIAVE_SENZA_NOTA);
    let corpo;
    if (!stato.caricato) corpo = '';
    else if (!conNota.length) corpo = '<p class="flusso-guida">In questa categoria non ci sono ancora note. Le scrivi quando inserisci un movimento.</p>';
    else {
      corpo = `
        <div class="scheda">
          ${conNota.map((v) => `
            <button type="button" class="riga-lista" data-nota="${esc(v.chiave)}">
              <span class="riga-testo"><span class="riga-titolo">${esc(v.nota)}</span><span class="riga-sotto">${plurale(v.conteggio, 'movimento', 'movimenti')}</span></span>
              ${icona('pencil', 18)}
            </button>`).join('')}
        </div>
        ${senza ? `<p class="nota-fondo">${plurale(senza.conteggio, 'movimento', 'movimenti')} senza nota.</p>` : ''}`;
    }
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Note · ${esc(categoria?.nome ?? 'Categoria')}</h2>
        </header>
        <div class="flusso-corpo">
          <p class="flusso-nota">${icona('info', 18)}<span>Tocca una nota per cambiarne il nome o unirla a un'altra. La modifica vale per tutti i movimenti di questa categoria, di ogni periodo.</span></p>
          ${corpo}
        </div>
      </div>`;
  }

  /** Foglio "Modifica nota": nuovo nome oppure unione con un'altra nota. Risolve con l'esito della modifica, o undefined. */
  async function modificaNota(chiave) {
    const voce = stato.voci.find((v) => v.chiave === chiave);
    if (!voce) return;
    const altre = stato.voci.filter((v) => v.chiave !== chiave && v.chiave !== CHIAVE_SENZA_NOTA);

    const esito = await new Promise((risolvi) => {
      const foglio = apriPannello({
        tipo: 'sheet',
        etichetta: `Modifica la nota ${voce.nota}`,
        riempi(el, c) {
          el.innerHTML = `
            <h2 class="foglio-titolo">Modifica nota</h2>
            <form class="foglio-corpo" autocomplete="off">
              <p class="riga-sotto">«${esc(voce.nota)}» · ${plurale(voce.conteggio, 'movimento', 'movimenti')}</p>
              <div class="campo">
                <label for="nota-nome">Nuovo nome</label>
                <input id="nota-nome" class="campo-testo" type="text" maxlength="${LUNGHEZZA_MAX_NOTA}" value="${esc(voce.nota)}" autocapitalize="sentences" spellcheck="false">
              </div>
              <p class="flusso-errore" role="alert" data-r="errore" hidden></p>
              <p class="nota-fondo" data-r="avviso" hidden></p>
              <button type="submit" class="pulsante pulsante-grande">Salva</button>
              ${altre.length ? `
                <section class="gruppo ct-unisci">
                  <h3 class="gruppo-titolo">Oppure unisci a un'altra nota</h3>
                  <div class="scheda">
                    ${altre.map((v) => `
                      <button type="button" class="riga-lista" data-unisci="${esc(v.chiave)}">
                        <span class="riga-testo"><span class="riga-titolo">${esc(v.nota)}</span><span class="riga-sotto">${plurale(v.conteggio, 'movimento', 'movimenti')}</span></span>
                        ${icona('chevron-right', 18)}
                      </button>`).join('')}
                  </div>
                </section>` : ''}
            </form>`;
          const campo = el.querySelector('#nota-nome');
          const errore = el.querySelector('[data-r="errore"]');
          const avviso = el.querySelector('[data-r="avviso"]');
          const mostra = (nodo, testo) => { nodo.textContent = testo; nodo.hidden = !testo; };

          // Mentre si scrive: se il nome è già di un'altra nota, si avvisa che verranno unite.
          campo.addEventListener('input', () => {
            mostra(errore, '');
            const { unisceCon } = risolviNuovoNome(stato.voci, chiave, campo.value);
            mostra(avviso, unisceCon ? `Esiste già «${unisceCon.nota}»: salvando, le due note vengono unite.` : '');
          });

          const applica = async (nome) => {
            const { unisceCon } = risolviNuovoNome(stato.voci, chiave, nome);
            if (unisceCon) {
              const totale = voce.conteggio + unisceCon.conteggio;
              const ok = await conferma({
                titolo: 'Unire le note?',
                testo: `«${voce.nota}» e «${unisceCon.nota}» diventano un'unica nota «${unisceCon.nota}» (${plurale(totale, 'movimento', 'movimenti')}). Potrai annullare subito dopo.`,
                etichettaConferma: 'Unisci',
              });
              if (!ok) return;
            }
            try {
              c.chiudi(await cambiaNota(categoriaId, chiave, nome));
            } catch (e) {
              if (!(e instanceof ErroreNota)) console.error(e);
              mostra(errore, e instanceof ErroreNota ? e.message : 'Non sono riuscito a salvare la modifica. Riprova.');
            }
          };

          el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); applica(campo.value); });
          el.addEventListener('click', (e) => {
            const scelta = e.target.closest('[data-unisci]')?.dataset.unisci;
            const altra = scelta && stato.voci.find((v) => v.chiave === scelta);
            if (altra) applica(altra.nota);
          });
        },
      });
      foglio.chiuso.then((valore) => risolvi(valore));
    });

    if (!esito) return;
    if (!esito.conteggio) { mostraToast('Nessuna modifica'); return; }
    mostraToast(
      esito.unita ? `Note unite in «${esito.nome}» (${plurale(esito.conteggio, 'movimento', 'movimenti')})` : `Nota rinominata «${esito.nome}» (${plurale(esito.conteggio, 'movimento', 'movimenti')})`,
      {
        durata: 7000,
        azione: {
          etichetta: 'Annulla',
          alClick: () => annullaCambioNota(esito.originali).then(() => mostraToast('Modifica annullata')).catch(() => mostraToast('Non sono riuscito ad annullare')),
        },
      },
    );
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const nota = e.target.closest('[data-nota]')?.dataset.nota;
    if (az === 'chiudi') c.chiudi(undefined);
    else if (nota !== undefined) modificaNota(nota);
  }
}
