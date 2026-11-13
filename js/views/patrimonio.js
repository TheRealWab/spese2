// Area "Patrimonio" (SPEC §6.3): quanto vale tutto, come cresce, i conti con il loro saldo e gli investimenti con
// versato, valore e guadagno. L'occhio in alto nasconde gli importi (restano le percentuali e la forma del grafico).

import { $, esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, euroCompatto, euroConSegno, percentualeConSegno } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { animaCifre, attrCifra } from '../util/animazione.js';
import { importiNascosti, mostraImporto } from '../util/importi-privati.js';
import { impostazioni, salvaImpostazioni } from '../model/impostazioni.js';
import { tutti } from '../db.js';
import { tuttiIConti } from '../model/conti.js';
import { periodoContenente, periodoValido } from '../model/periodi.js';
import {
  creaStorie, patrimonioAl, ripartizionePatrimonio, gruppoDelConto, NOME_GRUPPO, riepilogoInvestimento, variazioneRispettoAMeseFa,
  serieAndamento, primaDataConDati, intervalloGrafico, etichettaAggiornamento,
} from '../model/patrimonio.js';
import { ETICHETTA_TIPO_CONTO } from '../model/conti.js';
import { creaSelettorePeriodo } from '../components/selettore-periodo.js';
import { creaGrafico } from '../components/grafico-andamento.js';
import { apriDettaglioConto } from '../components/dettaglio-conto.js';
import { apriAggiornaValore } from '../components/aggiorna-valore.js';
import { apriEditorConto } from '../components/editor-conto.js';
import { apriGestioneConti } from '../components/gestione-conti.js';
import { apriDettaglioRipartizione } from '../components/dettaglio-ripartizione.js';

// Stato che sopravvive al cambio di area: tornando su Patrimonio si ritrova lo stesso periodo.
let periodo = null;
const cifreMostrate = new Map(); // ultime cifre viste: la prossima animazione parte da lì (la prima volta da 0)

const classeVariazione = (cent) => (cent > 0 ? 'pt-su' : (cent < 0 ? 'pt-giu' : ''));

export function monta(radice) {
  radice.classList.add('vista-patrimonio');
  radice.innerHTML = `
    <h1 class="solo-sr">Patrimonio</h1>
    <div class="mese-contenuto" data-r="contenuto"></div>`;

  const contenuto = $('[data-r="contenuto"]', radice);
  const giornoInizio = () => impostazioni().giornoInizioMese;
  if (!periodoValido(periodo, giornoInizio())) periodo = periodoContenente('anno', oggiIso(), giornoInizio());

  let dati = null; // { conti, movimenti, valori, storie, oggi }
  let selettore = null;
  let grafico = null;
  let sequenza = 0;

  /** L'occhio che nasconde gli importi: sta in alto a destra nella scheda del totale. */
  function htmlOcchio() {
    const nascosti = importiNascosti();
    return `<button type="button" class="btn-icona pt-occhio" data-az="occhio" aria-pressed="${nascosti}" aria-label="${nascosti ? 'Mostra gli importi' : 'Nascondi gli importi'}">${icona(nascosti ? 'eye-off' : 'eye', 22)}</button>`;
  }

  async function carica() {
    const mia = ++sequenza;
    const [conti, movimenti, valori] = await Promise.all([tuttiIConti(), tutti('movimenti'), tutti('valoriInvestimento')]);
    if (mia !== sequenza) return;
    dati = { conti, movimenti, valori, storie: creaStorie(conti, movimenti, valori), oggi: oggiIso() };
    disegna();
  }

  // ---- Pezzi della schermata ----

  function htmlHero() {
    const v = variazioneRispettoAMeseFa(dati.storie, dati.oggi);
    const segnoCent = v.assoluta;
    const percentuale = v.percentuale === null ? '' : ` (${percentualeConSegno(v.percentuale)})`;
    const importo = importiNascosti() ? '•••••' : euroConSegno(segnoCent);
    const totale = patrimonioAl(dati.storie, dati.oggi);
    return `
      <section class="scheda indicatore pt-hero">
        <div class="pt-hero-testa"><p class="ind-et">Patrimonio totale</p>${htmlOcchio()}</div>
        <div class="ind-riga"><span class="ind-valore" data-r="totale" ${attrCifra('totale', totale, 'compatto', true)}>${esc(mostraImporto(totale, euroCompatto))}</span></div>
        <p class="pt-variazione ${classeVariazione(segnoCent)}">${icona(segnoCent < 0 ? 'trending-down' : 'trending-up', 18)}<span><span ${attrCifra('variazione', segnoCent, 'segno', true)}>${esc(importo)}</span>${esc(percentuale)} nell'ultimo mese</span></p>
        ${htmlRipartizione()}
      </section>`;
  }

  /**
   * La barra sotto il totale: investimenti ad alto e basso rischio, quelli ancora da classificare e la liquidità.
   * Assente se il patrimonio non è divisibile in modo sensato o se c'è un gruppo solo (non direbbe nulla).
   * Ogni voce della legenda si tocca per vedere i conti del gruppo, raccolti per etichetta.
   */
  function htmlRipartizione() {
    const r = ripartizionePatrimonio(dati.storie, dati.oggi);
    if (!r || r.voci.length < 2) return '';
    const voce = (v) => `
      <button type="button" class="pt-rip-voce" data-gruppo="${v.gruppo}" aria-label="${NOME_GRUPPO[v.gruppo]}, ${v.percentuale}%: vedi i conti">
        <span class="pt-rip-punto pt-seg-${v.gruppo}"></span>
        <span class="pt-rip-testo"><span class="pt-rip-nome">${NOME_GRUPPO[v.gruppo]}</span><span class="pt-rip-importo"><strong>${v.percentuale}%</strong> · <span ${attrCifra(`rip:${v.gruppo}`, v.importo, 'euro', true)}>${esc(mostraImporto(v.importo))}</span></span></span>
      </button>`;
    return `
      <div class="pt-rip" role="group" aria-label="Come è diviso il patrimonio">
        <div class="pt-rip-barra" role="img" aria-label="${r.voci.map((v) => `${NOME_GRUPPO[v.gruppo]} ${v.percentuale}%`).join(', ')}">
          ${r.voci.map((v) => `<span class="pt-rip-seg pt-seg-${v.gruppo}" style="flex:${Math.max(v.percentuale, 2)}"></span>`).join('')}
        </div>
        <div class="pt-rip-legenda">${r.voci.map(voce).join('')}</div>
      </div>`;
  }

  /** «Alto rischio · ETF», «Basso rischio», oppure l'invito a classificare. */
  function sottotitoloInvestimento(conto) {
    const gruppo = gruppoDelConto(conto);
    if (gruppo === 'da-classificare') return '<span class="badge badge-avviso">Da classificare</span>';
    return esc([NOME_GRUPPO[gruppo], conto.etichetta].filter(Boolean).join(' · '));
  }

  function htmlRigaConto(conto) {
    const saldo = dati.storie.get(conto.id).saldoAl(dati.oggi);
    return `
      <button type="button" class="riga-lista" data-conto="${esc(conto.id)}">
        ${cerchioIcona(conto.icona, conto.colore, 44)}
        <span class="riga-testo"><span class="riga-titolo">${esc(conto.nome)}</span><span class="riga-sotto">${esc(ETICHETTA_TIPO_CONTO[conto.tipo] ?? '')}</span></span>
        <span class="pt-saldo ${saldo < 0 ? 'pt-giu' : ''}" ${attrCifra(`conto:${conto.id}`, saldo, 'euro', true)}>${esc(mostraImporto(saldo))}</span>
      </button>`;
  }

  function htmlSchedaInvestimento(conto) {
    const r = riepilogoInvestimento(dati.storie.get(conto.id), dati.oggi);
    const agg = etichettaAggiornamento(r.ultimoAggiornamento, dati.oggi);
    const perc = r.guadagnoPercentuale === null ? '' : percentualeConSegno(r.guadagnoPercentuale);
    return `
      <section class="scheda pt-inv" data-conto="${esc(conto.id)}">
        <button type="button" class="pt-inv-testa" data-conto="${esc(conto.id)}">
          ${cerchioIcona(conto.icona, conto.colore, 44)}
          <span class="riga-testo"><span class="riga-titolo">${esc(conto.nome)}</span><span class="riga-sotto">${sottotitoloInvestimento(conto)}</span></span>
          ${icona('chevron-right', 18)}
        </button>
        <dl class="pt-inv-dati">
          <div><dt>Versato</dt><dd ${attrCifra(`versato:${conto.id}`, r.versato, 'euro', true)}>${esc(mostraImporto(r.versato))}</dd></div>
          <div><dt>Valore attuale</dt><dd ${attrCifra(`valore:${conto.id}`, r.valore, 'euro', true)}>${esc(mostraImporto(r.valore))}</dd></div>
          <div class="${classeVariazione(r.guadagno)}"><dt>Guadagno</dt><dd><span ${attrCifra(`guadagno:${conto.id}`, r.guadagno, 'segno', true)}>${esc(importiNascosti() ? '•••••' : euroConSegno(r.guadagno))}</span>${perc ? `<span class="pt-perc">${esc(perc)}</span>` : ''}</dd></div>
        </dl>
        <div class="pt-inv-piede">
          <span class="pt-aggiornato ${agg.vecchio ? 'vecchio' : ''}">${icona('clock', 14)} ${esc(agg.testo)}</span>
          <button type="button" class="pulsante pulsante-piccolo" data-az="valore" data-conto="${esc(conto.id)}">Aggiorna valore</button>
        </div>
      </section>`;
  }

  function htmlGrafico() {
    return `
      <section class="scheda pt-grafico">
        <div data-r="selettore"></div>
        <div data-r="grafico"></div>
        <p class="pt-nota-grafico" data-r="nota"></p>
      </section>`;
  }

  function disegna() {
    if (!dati) return;
    const attivi = dati.conti.filter((c) => !c.archiviato);
    const normali = attivi.filter((c) => c.tipo !== 'investimenti');
    const investimenti = attivi.filter((c) => c.tipo === 'investimenti');

    contenuto.innerHTML = `
      ${htmlHero()}
      ${htmlGrafico()}
      ${normali.length ? `
        <section class="gruppo">
          <h2 class="gruppo-titolo">I tuoi conti</h2>
          <div class="scheda">${normali.map(htmlRigaConto).join('')}</div>
        </section>` : ''}
      ${investimenti.length ? `
        <section class="gruppo">
          <h2 class="gruppo-titolo">Investimenti</h2>
          ${investimenti.map(htmlSchedaInvestimento).join('')}
        </section>` : ''}
      <div class="scheda pt-azioni">
        <button type="button" class="riga-lista" data-az="nuovo">
          <span class="cerchio col-indaco" style="--dim:40px">${icona('plus', 20)}</span>
          <span class="riga-testo"><span class="riga-titolo">Nuovo conto</span><span class="riga-sotto">Contanti, conto, investimenti…</span></span>${icona('chevron-right', 18)}
        </button>
        <button type="button" class="riga-lista" data-az="gestisci">
          <span class="cerchio cerchio-neutro">${icona('layers', 20)}</span>
          <span class="riga-testo"><span class="riga-titolo">Gestisci conti</span><span class="riga-sotto">Modifica, saldo iniziale, archivia</span></span>${icona('chevron-right', 18)}
        </button>
      </div>`;

    animaCifre(contenuto, cifreMostrate);

    selettore = creaSelettorePeriodo($('[data-r="selettore"]', contenuto), {
      periodo,
      giornoInizio,
      alCambio: (nuovo) => { periodo = nuovo; disegnaGrafico(); },
    });
    grafico = creaGrafico($('[data-r="grafico"]', contenuto));
    disegnaGrafico();
  }

  function disegnaGrafico() {
    if (!dati || !grafico) return;
    const prima = primaDataConDati(dati.movimenti, dati.valori, dati.oggi, dati.conti);
    const intervallo = intervalloGrafico(periodo, prima, dati.oggi);
    const punti = intervallo ? serieAndamento(dati.storie, intervallo.da, intervallo.a) : [];
    grafico.aggiorna({ punti, nascosto: importiNascosti() });
    const nota = $('[data-r="nota"]', contenuto);
    if (punti.length >= 2) {
      const differenza = punti.at(-1).valore - punti[0].valore;
      nota.className = `pt-nota-grafico ${classeVariazione(differenza)}`;
      nota.textContent = `Nel periodo: ${importiNascosti() ? '•••••' : euroConSegno(differenza)}`;
    } else {
      nota.className = 'pt-nota-grafico';
      nota.textContent = '';
    }
  }

  // ---- Interazioni ----

  radice.addEventListener('click', (e) => {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const contoId = e.target.closest('[data-conto]')?.dataset.conto;
    const gruppo = e.target.closest('[data-gruppo]')?.dataset.gruppo;
    if (gruppo) { apriDettaglioRipartizione({ gruppo }); return; }
    if (az === 'occhio') { salvaImpostazioni({ nascondiImportiPatrimonio: !importiNascosti() }).catch(console.error); return; }
    if (az === 'nuovo') { apriEditorConto({}); return; }
    if (az === 'gestisci') { apriGestioneConti(); return; }
    if (az === 'valore' && contoId) { apriAggiornaValore({ contoId }); return; }
    if (contoId) apriDettaglioConto({ contoId });
  });

  carica();

  return {
    /** Chiamata quando cambiano movimenti, conti, categorie o impostazioni. */
    aggiorna(dettaglio = {}) {
      if (dettaglio.evento === 'impostazioni') {
        if (!periodoValido(periodo, giornoInizio())) periodo = periodoContenente('anno', oggiIso(), giornoInizio());
        if (dettaglio.ripristino) { carica(); return; }
        disegna(); // l'occhio o il giorno di inizio mese: i dati sono gli stessi
        return;
      }
      carica();
    },
  };
}
