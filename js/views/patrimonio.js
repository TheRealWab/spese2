// Area "Patrimonio" (SPEC §6.3): quanto vale tutto, come cresce, i conti con il loro saldo e gli investimenti con
// versato, valore e guadagno. L'occhio in alto nasconde gli importi (restano le percentuali e la forma del grafico).

import { $, esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, euroCompatto, euroConSegno, percentualeConSegno } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { animaNumero } from '../util/animazione.js';
import { importiNascosti, mostraImporto } from '../util/importi-privati.js';
import { impostazioni, salvaImpostazioni } from '../model/impostazioni.js';
import { tutti } from '../db.js';
import { tuttiIConti } from '../model/conti.js';
import { periodoContenente, periodoValido } from '../model/periodi.js';
import {
  creaStorie, patrimonioAl, ripartizioneInvestito, riepilogoInvestimento, variazioneRispettoAMeseFa, serieAndamento, primaDataConDati,
  intervalloGrafico, etichettaAggiornamento,
} from '../model/patrimonio.js';
import { ETICHETTA_TIPO_CONTO } from '../model/conti.js';
import { creaSelettorePeriodo } from '../components/selettore-periodo.js';
import { creaGrafico } from '../components/grafico-andamento.js';
import { apriDettaglioConto } from '../components/dettaglio-conto.js';
import { apriAggiornaValore } from '../components/aggiorna-valore.js';
import { apriEditorConto } from '../components/editor-conto.js';
import { apriGestioneConti } from '../components/gestione-conti.js';

// Stato che sopravvive al cambio di area: tornando su Patrimonio si ritrova lo stesso periodo.
let periodo = null;
let ultimoValoreMostrato = null;

const classeVariazione = (cent) => (cent > 0 ? 'pt-su' : (cent < 0 ? 'pt-giu' : ''));

export function monta(radice) {
  radice.classList.add('vista-patrimonio');
  radice.innerHTML = `
    <div class="pt-testata">
      <h1 class="vista-titolo">Patrimonio</h1>
      <button type="button" class="btn-icona pt-occhio" data-az="occhio"></button>
    </div>
    <div class="mese-contenuto" data-r="contenuto"></div>`;

  const contenuto = $('[data-r="contenuto"]', radice);
  const giornoInizio = () => impostazioni().giornoInizioMese;
  if (!periodoValido(periodo, giornoInizio())) periodo = periodoContenente('anno', oggiIso(), giornoInizio());

  let dati = null; // { conti, movimenti, valori, storie, oggi }
  let selettore = null;
  let grafico = null;
  let sequenza = 0;

  function disegnaOcchio() {
    const nascosti = importiNascosti();
    const pulsante = $('[data-az="occhio"]', radice);
    pulsante.innerHTML = icona(nascosti ? 'eye-off' : 'eye', 24);
    pulsante.setAttribute('aria-pressed', String(nascosti));
    pulsante.setAttribute('aria-label', nascosti ? 'Mostra gli importi' : 'Nascondi gli importi');
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
    return `
      <section class="scheda indicatore pt-hero">
        <p class="ind-et">Patrimonio totale</p>
        <div class="ind-riga"><span class="ind-valore" data-r="totale"></span></div>
        <p class="pt-variazione ${classeVariazione(segnoCent)}">${icona(segnoCent < 0 ? 'trending-down' : 'trending-up', 18)}<span>${esc(importo + percentuale)} nell'ultimo mese</span></p>
        ${htmlRipartizione()}
      </section>`;
  }

  /** La barra "investito / liquidità" sotto il totale (assente se il patrimonio non è divisibile in modo sensato). */
  function htmlRipartizione() {
    const r = ripartizioneInvestito(dati.storie, dati.oggi);
    if (!r) return '';
    const voce = (classe, nome, percentuale, cent) => `
      <div class="pt-rip-voce">
        <span class="pt-rip-punto ${classe}"></span>
        <span class="pt-rip-testo"><span class="pt-rip-nome">${nome} <strong>${percentuale}%</strong></span><span class="pt-rip-importo">${esc(mostraImporto(cent))}</span></span>
      </div>`;
    return `
      <div class="pt-rip" role="group" aria-label="Divisione tra investito e liquidità">
        <div class="pt-rip-barra" role="img" aria-label="Investito ${r.percentualeInvestito}%, liquidità ${r.percentualeNonInvestito}%">
          <span class="pt-rip-seg pt-inv-seg" style="flex:${Math.max(r.percentualeInvestito, r.investito > 0 ? 2 : 0)}"></span>
          <span class="pt-rip-seg pt-non-seg" style="flex:${Math.max(r.percentualeNonInvestito, r.nonInvestito > 0 ? 2 : 0)}"></span>
        </div>
        <div class="pt-rip-legenda">
          ${voce('pt-inv-seg', 'Investito', r.percentualeInvestito, r.investito)}
          ${voce('pt-non-seg', 'Liquidità', r.percentualeNonInvestito, r.nonInvestito)}
        </div>
      </div>`;
  }

  function htmlRigaConto(conto) {
    const saldo = dati.storie.get(conto.id).saldoAl(dati.oggi);
    return `
      <button type="button" class="riga-lista" data-conto="${esc(conto.id)}">
        ${cerchioIcona(conto.icona, conto.colore, 44)}
        <span class="riga-testo"><span class="riga-titolo">${esc(conto.nome)}</span><span class="riga-sotto">${esc(ETICHETTA_TIPO_CONTO[conto.tipo] ?? '')}</span></span>
        <span class="pt-saldo ${saldo < 0 ? 'pt-giu' : ''}">${esc(mostraImporto(saldo))}</span>
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
          <span class="riga-testo"><span class="riga-titolo">${esc(conto.nome)}</span><span class="riga-sotto">Investimenti</span></span>
          ${icona('chevron-right', 18)}
        </button>
        <dl class="pt-inv-dati">
          <div><dt>Versato</dt><dd>${esc(mostraImporto(r.versato))}</dd></div>
          <div><dt>Valore attuale</dt><dd>${esc(mostraImporto(r.valore))}</dd></div>
          <div class="${classeVariazione(r.guadagno)}"><dt>Guadagno</dt><dd>${esc(importiNascosti() ? '•••••' : euroConSegno(r.guadagno))}${perc ? `<span class="pt-perc">${esc(perc)}</span>` : ''}</dd></div>
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
    disegnaOcchio();
    const attivi = dati.conti.filter((c) => !c.archiviato);
    const normali = attivi.filter((c) => c.tipo !== 'investimenti');
    const investimenti = attivi.filter((c) => c.tipo === 'investimenti');
    const totale = patrimonioAl(dati.storie, dati.oggi);

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

    const elTotale = $('[data-r="totale"]', contenuto);
    if (importiNascosti()) { elTotale.textContent = mostraImporto(totale); ultimoValoreMostrato = null; }
    else { animaNumero(elTotale, ultimoValoreMostrato ?? totale, totale, euroCompatto); ultimoValoreMostrato = totale; }

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
    if (az === 'occhio') { salvaImpostazioni({ nascondiImportiPatrimonio: !importiNascosti() }).catch(console.error); return; }
    if (az === 'nuovo') { apriEditorConto({}); return; }
    if (az === 'gestisci') { apriGestioneConti(); return; }
    if (az === 'valore' && contoId) { apriAggiornaValore({ contoId }); return; }
    if (contoId) apriDettaglioConto({ contoId });
  });

  disegnaOcchio();
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
