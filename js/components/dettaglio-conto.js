// Dettaglio di un conto (SPEC §6.3): saldo, per gli investimenti versato/valore/guadagno con lo storico dei valori,
// e l'elenco dei movimenti del conto. Si apre da Patrimonio; rispetta l'occhio che nasconde gli importi.

import { apriPannello } from './pannello.js';
import { apriInserimento } from './inserimento.js';
import { apriAggiornaValore } from './aggiorna-valore.js';
import { apriEditorConto } from './editor-conto.js';
import { htmlRigaMovimento } from './riga-movimento.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euroConSegno, etichettaGiorno, percentualeConSegno, dataBreve } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { importiNascosti, mostraImporto, MASCHERA_IMPORTO } from '../util/importi-privati.js';
import { tutti } from '../db.js';
import { contoPerId } from '../model/catalogo.js';
import { raggruppaPerGiorno } from '../model/calcoli.js';
import { creaStoriaConto, riepilogoInvestimento, etichettaAggiornamento, movimentiDelConto } from '../model/patrimonio.js';
import { ETICHETTA_TIPO_CONTO } from '../model/conti.js';
import { tuttiIValori } from '../model/conti-db.js';

const PAGINA = 40; // movimenti mostrati per volta
const classeVariazione = (cent) => (cent > 0 ? 'pt-su' : (cent < 0 ? 'pt-giu' : ''));

/** @param {{contoId: string}} opzioni */
export function apriDettaglioConto({ contoId }) {
  const stato = { movimenti: [], valori: [], mostrati: PAGINA };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: contoPerId(contoId)?.nome ?? 'Conto',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      disegna();
      carica();
    },
  });
  // Movimenti, conti (saldo iniziale, nome…) e occhio: in tutti i casi si rilegge e si ridisegna.
  const eventi = ['spese2:movimenti', 'spese2:conti', 'spese2:impostazioni'];
  for (const evento of eventi) document.addEventListener(evento, carica);
  ctrl.chiuso.then(() => { for (const evento of eventi) document.removeEventListener(evento, carica); });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  async function carica() {
    const [movimenti, valori] = await Promise.all([tutti('movimenti'), tuttiIValori()]);
    stato.movimenti = movimenti;
    stato.valori = valori;
    if (radice) disegna();
  }

  function disegna() {
    const conto = contoPerId(contoId);
    const oggi = oggiIso();
    const corpo = radice.querySelector('.flusso-corpo');
    const posizione = corpo?.scrollTop ?? 0;
    if (!conto) { radice.innerHTML = '<p class="flusso-guida">Il conto non esiste più.</p>'; return; }

    const storia = creaStoriaConto(conto, stato.movimenti, stato.valori);
    const saldo = storia.saldoAl(oggi);
    const investimento = conto.tipo === 'investimenti';
    const elenco = movimentiDelConto(stato.movimenti, contoId);

    radice.innerHTML = `
      <div class="flusso col-${esc(conto.colore)}">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">${esc(conto.nome)}</h2>
          <button type="button" class="btn-icona" data-az="modifica" aria-label="Modifica il conto">${icona('pencil', 22)}</button>
        </header>
        <div class="flusso-corpo">
          <section class="scheda ct-hero">
            ${cerchioIcona(conto.icona, conto.colore, 56)}
            <div class="ct-hero-testo">
              <p class="ind-et">${investimento ? 'Valore attuale' : 'Saldo'}${conto.archiviato ? ' · archiviato' : ''}</p>
              <span class="ind-valore ct-hero-valore ${saldo < 0 ? 'pt-giu' : ''}">${esc(mostraImporto(saldo))}</span>
              <p class="ind-sotto">${esc(ETICHETTA_TIPO_CONTO[conto.tipo] ?? '')} · ${elenco.length === 1 ? '1 movimento' : `${elenco.length} movimenti`}</p>
            </div>
          </section>
          ${investimento ? htmlInvestimento(storia, oggi) : ''}
          ${htmlElenco(elenco, oggi)}
        </div>
      </div>`;
    if (posizione) radice.querySelector('.flusso-corpo').scrollTop = posizione;
  }

  function htmlInvestimento(storia, oggi) {
    const r = riepilogoInvestimento(storia, oggi);
    const agg = etichettaAggiornamento(r.ultimoAggiornamento, oggi);
    const perc = r.guadagnoPercentuale === null ? '' : percentualeConSegno(r.guadagnoPercentuale);
    const valoriOrdinati = stato.valori.filter((v) => v.contoId === contoId).sort((a, b) => (a.data < b.data ? 1 : -1));
    return `
      <section class="scheda pt-inv">
        <dl class="pt-inv-dati">
          <div><dt>Versato</dt><dd>${esc(mostraImporto(r.versato))}</dd></div>
          <div><dt>Valore attuale</dt><dd>${esc(mostraImporto(r.valore))}</dd></div>
          <div class="${classeVariazione(r.guadagno)}"><dt>Guadagno</dt><dd>${esc(importiNascosti() ? MASCHERA_IMPORTO : euroConSegno(r.guadagno))}${perc ? `<span class="pt-perc">${esc(perc)}</span>` : ''}</dd></div>
        </dl>
        <div class="pt-inv-piede">
          <span class="pt-aggiornato ${agg.vecchio ? 'vecchio' : ''}">${icona('clock', 14)} ${esc(agg.testo)}</span>
          <button type="button" class="pulsante pulsante-piccolo" data-az="valore">Aggiorna valore</button>
        </div>
      </section>
      <section class="gruppo">
        <h3 class="gruppo-titolo">Storico dei valori</h3>
        ${valoriOrdinati.length ? `
          <div class="scheda">
            ${valoriOrdinati.map((v, i) => {
              const precedente = valoriOrdinati[i + 1];
              const differenza = precedente ? v.valore - precedente.valore : null;
              return `
                <button type="button" class="riga-lista" data-valore="${esc(v.id)}">
                  <span class="riga-testo"><span class="riga-titolo">${esc(mostraImporto(v.valore))}</span><span class="riga-sotto">${esc(dataBreve(v.data))}</span></span>
                  ${differenza === null ? '' : `<span class="riga-valore ${classeVariazione(differenza)}">${esc(importiNascosti() ? MASCHERA_IMPORTO : euroConSegno(differenza))}</span>`}
                  ${icona('chevron-right', 18)}
                </button>`;
            }).join('')}
          </div>
          <p class="nota-fondo">Tocca un valore per correggerlo o eliminarlo.</p>` : '<p class="flusso-guida">Non hai ancora inserito nessun valore: finché non lo fai, il valore coincide con il versato.</p>'}
      </section>`;
  }

  function htmlElenco(elenco, oggi) {
    if (!elenco.length) return '<p class="flusso-guida">Nessun movimento su questo conto.</p>';
    const visibili = elenco.slice(0, stato.mostrati);
    const formato = (cent) => mostraImporto(cent);
    const giorni = raggruppaPerGiorno(visibili);
    return `
      <h3 class="gruppo-titolo pt-titolo-movimenti">Movimenti</h3>
      ${giorni.map((g) => `
        <section class="giorno">
          <header class="giorno-testata"><h2>${etichettaGiorno(g.data, oggi)}</h2></header>
          <div class="scheda lista-mov">${g.movimenti.map((m) => htmlRigaMovimento(m, { formato })).join('')}</div>
        </section>`).join('')}
      ${elenco.length > visibili.length ? `<button type="button" class="pulsante pulsante-secondario pulsante-grande" data-az="altri">Mostra altri movimenti (${elenco.length - visibili.length})</button>` : ''}`;
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const valoreId = e.target.closest('[data-valore]')?.dataset.valore;
    const riga = e.target.closest('.riga-mov');
    if (az === 'chiudi') c.chiudi(undefined);
    else if (az === 'modifica') apriEditorConto({ contoId });
    else if (az === 'valore') apriAggiornaValore({ contoId });
    else if (az === 'altri') { stato.mostrati += PAGINA; disegna(); }
    else if (valoreId) apriAggiornaValore({ contoId, valoreId });
    else if (riga) apriInserimento({ movimento: stato.movimenti.find((m) => m.id === riga.dataset.id) });
  }
}
