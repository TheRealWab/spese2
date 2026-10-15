// Dettaglio di una categoria in un periodo (SPEC §6.4): totale, scomposizione per nota ed elenco dei movimenti.
// Si apre da Categorie (e, nella Fase 5, dai grafici): riceve il periodo, quindi vale per qualsiasi intervallo.

import { apriPannello } from './pannello.js';
import { apriInserimento } from './inserimento.js';
import { apriGestioneNote } from './gestione-note.js';
import { htmlRigaMovimento } from './riga-movimento.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, etichettaGiorno, percentuale } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { impostazioni } from '../model/impostazioni.js';
import { movimentiPeriodo } from '../model/movimenti.js';
import { categoriaPerId } from '../model/catalogo.js';
import { raggruppaPerGiorno } from '../model/calcoli.js';
import { etichettaPeriodo } from '../model/periodi.js';
import { scomponiPerNota, segmentiBarra, filtraPerNota, CHIAVE_SENZA_NOTA, CHIAVE_ALTRE } from '../model/note.js';

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
const CHIAVE_DOM_SENZA_NOTA = '__senza__'; // un attributo HTML vuoto non è distinguibile da "assente"
const SFUMATURE = [100, 78, 60, 46, 36, 28]; // percentuale di colore dei segmenti, dal più grande al più piccolo

/**
 * @param {{categoriaId: string, periodo: {modo: string, da: string, a: string}, tipo: 'spesa'|'entrata'}} opzioni
 */
export function apriDettaglioCategoria({ categoriaId, periodo, tipo }) {
  const stato = { movimenti: [], filtro: null };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: categoriaPerId(categoriaId)?.nome ?? 'Categoria',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      carica();
    },
  });
  // Se si modifica un movimento da qui (o dal pannello sopra), l'elenco si aggiorna da solo.
  document.addEventListener('spese2:movimenti', carica);
  ctrl.chiuso.then(() => document.removeEventListener('spese2:movimenti', carica));
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  async function carica() {
    const tutti = await movimentiPeriodo(periodo.da, periodo.a);
    stato.movimenti = tutti.filter((m) => m.categoriaId === categoriaId && m.tipo === tipo);
    if (stato.filtro !== null && !filtraPerNota(stato.movimenti, stato.filtro).length) stato.filtro = null;
    if (radice) disegna();
  }

  function disegna() {
    const categoria = categoriaPerId(categoriaId);
    const colore = categoria?.colore ?? 'ardesia';
    const totale = stato.movimenti.reduce((somma, m) => somma + m.importo, 0);
    const voci = scomponiPerNota(stato.movimenti);
    const mostrati = stato.filtro === null ? stato.movimenti : filtraPerNota(stato.movimenti, stato.filtro);
    const corpoScorrimento = radice.querySelector('.flusso-corpo');
    const posizione = corpoScorrimento?.scrollTop ?? 0;

    radice.innerHTML = `
      <div class="flusso col-${esc(colore)}">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">${esc(categoria?.nome ?? 'Categoria')}</h2>
        </header>
        <div class="flusso-corpo">
          <section class="scheda ct-hero">
            ${cerchioIcona(categoria?.icona ?? 'package', colore, 56)}
            <div class="ct-hero-testo">
              <p class="ind-et">${esc(etichettaPeriodo(periodo, impostazioni().giornoInizioMese))}</p>
              <span class="ind-valore ct-hero-valore">${euro(totale)}</span>
              <p class="ind-sotto">${stato.movimenti.length ? plurale(stato.movimenti.length, 'movimento', 'movimenti') : 'Nessun movimento in questo periodo'}</p>
            </div>
          </section>
          ${stato.movimenti.length ? htmlNote(voci) : ''}
          ${htmlFiltro(mostrati)}
          ${htmlElenco(mostrati)}
        </div>
      </div>`;
    if (posizione) radice.querySelector('.flusso-corpo').scrollTop = posizione;
  }

  function htmlNote(voci) {
    // Tutte senza nota: la scomposizione non dice nulla, meglio un suggerimento.
    if (voci.length === 1 && voci[0].chiave === CHIAVE_SENZA_NOTA) {
      return `<p class="flusso-guida ct-suggerimento">Nessuna nota in questi movimenti: scrivendo una nota (per esempio «Panificio») qui vedrai come si divide la spesa.</p>`;
    }
    const segmenti = segmentiBarra(voci);
    const totaleNote = voci.reduce((somma, v) => somma + v.importo, 0);
    const sfumatura = (i) => SFUMATURE[Math.min(i, SFUMATURE.length - 1)];
    const classeSegmento = (s) => (s.chiave === CHIAVE_SENZA_NOTA ? "nota-seg-neutro" : (s.chiave === CHIAVE_ALTRE ? "nota-seg-altre" : ""));
    const stileSegmento = (s, i) => (classeSegmento(s) ? "" : `--q:${sfumatura(i)}`);

    const barra = segmenti.map((s, i) => `<span class="nota-seg ${classeSegmento(s)}" style="flex:${Math.max(s.percentuale, 2).toFixed(2)};${stileSegmento(s, i)}"></span>`).join("");
    const indiceSegmento = new Map(segmenti.map((s, i) => [s.chiave, i]));
    const righe = voci.map((v) => {
      const i = indiceSegmento.get(v.chiave);
      const punto = v.chiave === CHIAVE_SENZA_NOTA
        ? '<span class="nota-punto nota-seg-neutro"></span>'
        : (i === undefined
          ? '<span class="nota-punto nota-seg-altre"></span>' // nota oltre le prime: nella barra sta in "Altre"
          : `<span class="nota-punto" style="--q:${sfumatura(i)}"></span>`);
      const chiaveDom = v.chiave === CHIAVE_SENZA_NOTA ? CHIAVE_DOM_SENZA_NOTA : v.chiave;
      const attiva = stato.filtro === v.chiave;
      return `
        <button type="button" class="riga-nota ${attiva ? 'attiva' : ''}" data-nota="${esc(chiaveDom)}" aria-pressed="${attiva}">
          ${punto}
          <span class="nota-nome">${v.chiave === CHIAVE_SENZA_NOTA ? 'Senza nota' : esc(v.nota)}</span>
          <span class="nota-dati">${plurale(v.conteggio, 'volta', 'volte')} · ${percentuale((v.importo / totaleNote) * 100)}</span>
          <span class="nota-importo">${euro(v.importo)}</span>
        </button>`;
    }).join('');

    return `
      <section class="scheda ct-note" aria-label="Scomposizione per nota">
        <div class="ct-note-testata">
          <h3 class="ct-note-titolo">Per nota</h3>
          <button type="button" class="chip" data-az="gestisci-note">${icona('pencil', 16)} Gestisci note</button>
        </div>
        <div class="nota-barra" role="img" aria-label="Scomposizione per nota">${barra}</div>
        <div class="nota-elenco">${righe}</div>
        <p class="ct-note-aiuto">Tocca una nota per vedere solo quei movimenti.</p>
      </section>`;
  }

  function htmlFiltro(mostrati) {
    if (stato.filtro === null) return '';
    const voce = scomponiPerNota(stato.movimenti).find((v) => v.chiave === stato.filtro);
    const nome = stato.filtro === CHIAVE_SENZA_NOTA ? 'Senza nota' : (voce?.nota ?? '');
    const somma = mostrati.reduce((s, m) => s + m.importo, 0);
    return `
      <div class="ct-filtro" role="status">
        <span><strong>${esc(nome)}</strong> · ${plurale(mostrati.length, 'movimento', 'movimenti')} · ${euro(somma)}</span>
        <button type="button" class="chip" data-az="togli-filtro" aria-label="Togli il filtro">${icona('x', 16)} Tutti</button>
      </div>`;
  }

  function htmlElenco(mostrati) {
    if (!mostrati.length) return '';
    const oggi = oggiIso();
    return raggruppaPerGiorno(mostrati).map((g) => `
      <section class="giorno">
        <header class="giorno-testata">
          <h2>${etichettaGiorno(g.data, oggi)}</h2>
          <span class="giorno-totale">${euro(g.movimenti.reduce((s, m) => s + m.importo, 0))}</span>
        </header>
        <div class="scheda lista-mov">${g.movimenti.map((m) => htmlRigaMovimento(m)).join('')}</div>
      </section>`).join('');
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const nota = e.target.closest('[data-nota]')?.dataset.nota;
    const riga = e.target.closest('.riga-mov');
    if (az === 'chiudi') {
      c.chiudi(undefined);
    } else if (az === 'gestisci-note') {
      apriGestioneNote({ categoriaId });
    } else if (az === 'togli-filtro') {
      stato.filtro = null;
      disegna();
    } else if (nota !== undefined) {
      const chiave = nota === CHIAVE_DOM_SENZA_NOTA ? CHIAVE_SENZA_NOTA : nota;
      stato.filtro = stato.filtro === chiave ? null : chiave; // un secondo tocco toglie il filtro
      disegna();
    } else if (riga) {
      apriInserimento({ movimento: stato.movimenti.find((m) => m.id === riga.dataset.id) });
    }
  }
}
