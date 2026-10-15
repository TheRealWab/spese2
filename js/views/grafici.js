// Area "Grafici" (SPEC §6.2): un selettore di periodo unico e cinque grafici, ognuno con la sua domanda. Cambiando
// periodo si aggiornano tutti insieme. Un grafico che non ha senso per il periodo si nasconde; con dati scarsi
// compare un messaggio breve al posto del grafico (mai un grafico vuoto).

import { $, esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, euroCompatto, euroConSegno, percentuale, percentualeConSegno } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { animaNumero } from '../util/animazione.js';
import { importiNascosti } from '../util/importi-privati.js';
import { impostazioni, salvaImpostazioni } from '../model/impostazioni.js';
import { tutti } from '../db.js';
import { categoriaPerId } from '../model/catalogo.js';
import { tuttiIConti } from '../model/conti.js';
import { totaliPerCategoria } from '../model/categorie.js';
import { MODI_GRAFICI, periodoContenente, periodoValido } from '../model/periodi.js';
import {
  periodoEffettivo, sottoperiodi, totaliPerSottoperiodo, confrontoSpese, nomePeriodoPrecedente, fetteCiambella,
} from '../model/grafici.js';
import { creaStorie, serieAndamento, primaDataConDati, intervalloGrafico } from '../model/patrimonio.js';
import { creaSelettorePeriodo } from '../components/selettore-periodo.js';
import { creaCiambella } from '../components/ciambella.js';
import { creaGraficoBarre } from '../components/grafico-barre.js';
import { creaGrafico } from '../components/grafico-andamento.js';
import { apriDettaglioCategoria } from '../components/dettaglio-categoria.js';

// Stato che sopravvive al cambio di area: tornando su Grafici si ritrova lo stesso periodo.
let periodo = null;
let ultimaSpesa = null; // per far scorrere la cifra del confronto

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/** Il periodo da mostrare all'apertura: l'ultimo scelto (stesso tipo, aggiornato a oggi), altrimenti il mese. */
function periodoIniziale(giornoInizio) {
  const salvato = impostazioni().ultimoPeriodoGrafici;
  const oggi = oggiIso();
  if (salvato?.modo === 'personalizzato' && periodoValido(salvato, giornoInizio)) return salvato;
  if (salvato && MODI_GRAFICI.includes(salvato.modo) && salvato.modo !== 'personalizzato') return periodoContenente(salvato.modo, oggi, giornoInizio);
  return periodoContenente('mese', oggi, giornoInizio);
}

export function monta(radice) {
  radice.classList.add('vista-grafici');
  radice.innerHTML = `
    <h1 class="vista-titolo">Grafici</h1>
    <section class="scheda gf-selettore"><div data-r="selettore"></div></section>
    <div class="mese-contenuto" data-r="contenuto"></div>`;

  const contenuto = $('[data-r="contenuto"]', radice);
  const giornoInizio = () => impostazioni().giornoInizioMese;
  if (!periodoValido(periodo, giornoInizio())) periodo = periodoIniziale(giornoInizio());

  let dati = null; // { conti, movimenti, valori, storie, oggi, primaData }
  let sequenza = 0;

  const selettore = creaSelettorePeriodo($('[data-r="selettore"]', radice), {
    periodo,
    giornoInizio,
    modi: MODI_GRAFICI,
    alCambio: (nuovo, direzione) => {
      periodo = nuovo;
      // L'ultimo periodo si ricorda (come tipo; per "personalizzato" anche le date).
      salvaImpostazioni({ ultimoPeriodoGrafici: nuovo.modo === 'personalizzato' ? nuovo : { modo: nuovo.modo } }).catch(console.error);
      disegna({ direzione });
    },
  });

  async function carica() {
    const mia = ++sequenza;
    const [conti, movimenti, valori] = await Promise.all([tuttiIConti(), tutti('movimenti'), tutti('valoriInvestimento')]);
    if (mia !== sequenza) return;
    const oggi = oggiIso();
    dati = { conti, movimenti, valori, oggi, storie: creaStorie(conti, movimenti, valori), primaData: primaDataConDati(movimenti, valori, oggi, conti) };
    disegna();
  }

  // ---- Le cinque schede ----

  const scheda = (domanda, corpo, classe = '') => `
    <section class="scheda gf-scheda ${classe}"><h2 class="gf-domanda">${esc(domanda)}</h2>${corpo}</section>`;
  const messaggio = (testo) => `<p class="gf-messaggio">${icona('info', 16)}<span>${esc(testo)}</span></p>`;

  function schedaCategorie(movimentiPeriodo) {
    const t = totaliPerCategoria(movimentiPeriodo, 'spesa');
    if (!t.righe.length) return scheda('Dove sono finiti i soldi?', messaggio('Nessuna spesa in questo periodo.'));
    const fette = fetteCiambella(t.righe);
    const riga = (r) => {
      if (r.altre) {
        return `
          <div class="riga-cat gf-riga-altre">
            <span class="cerchio cerchio-neutro" style="--dim:44px">${icona('ellipsis', 22)}</span>
            <span class="ct-testo"><span class="ct-nome">Altre categorie</span><span class="ct-sotto">${plurale(r.conteggio, 'movimento', 'movimenti')} · ${percentuale(r.percentuale)}</span></span>
            <span class="ct-importo">${euro(r.totale)}</span>
          </div>`;
      }
      const c = categoriaPerId(r.categoriaId);
      return `
        <button type="button" class="riga-cat col-${esc(c?.colore ?? 'ardesia')}" data-id="${esc(r.categoriaId)}">
          ${cerchioIcona(c?.icona ?? 'package', c?.colore ?? 'ardesia', 44)}
          <span class="ct-testo"><span class="ct-nome">${esc(c?.nome ?? 'Categoria eliminata')}</span><span class="ct-sotto">${plurale(r.conteggio, 'movimento', 'movimenti')} · ${percentuale(r.percentuale)}</span></span>
          <span class="ct-importo">${euro(r.totale)}</span>
        </button>`;
    };
    return scheda('Dove sono finiti i soldi?', `
      <div data-r="ciambella"></div>
      <div class="gf-elenco">${fette.map(riga).join('')}</div>`);
  }

  function schedaConfronto(movimentiPeriodo) {
    if (periodo.modo === 'sempre') return ''; // un confronto con "il periodo prima" non esiste
    const c = confrontoSpese({ movimenti: dati.movimenti, periodo, giornoInizio: giornoInizio(), primaData: dati.primaData, oggi: dati.oggi });
    const classe = (perc) => (perc > 0.5 ? 'pt-giu' : (perc < -0.5 ? 'pt-su' : '')); // spendere di più è "male": rosso
    const freccia = (perc) => icona(perc > 0.5 ? 'trending-up' : (perc < -0.5 ? 'trending-down' : 'minus'), 18);
    const righe = [];
    if (!c.precedente) {
      righe.push(`<p class="gf-confronto">Non ci sono ancora dati completi di un periodo precedente da confrontare.</p>`);
    } else {
      const nome = nomePeriodoPrecedente(c.precedente.periodo, giornoInizio(), dati.oggi);
      if (c.variazione.percentuale === null) {
        righe.push(`<p class="gf-confronto">${c.precedente.totale === 0 && c.totale === 0 ? 'Nessuna spesa né ora né prima.' : `Prima non avevi speso nulla (${nome}).`}</p>`);
      } else {
        righe.push(`<p class="gf-confronto ${classe(c.variazione.percentuale)}">${freccia(c.variazione.percentuale)}<span><strong>${percentualeConSegno(c.variazione.percentuale)}</strong> rispetto ${esc(nome)} <span class="gf-sotto">(${esc(euroConSegno(c.variazione.assoluta))})</span></span></p>`);
      }
      if (c.media) {
        const m = c.media.percentuale === null ? '' : `<p class="gf-confronto ${classe(c.media.percentuale)}">${freccia(c.media.percentuale)}<span><strong>${percentualeConSegno(c.media.percentuale)}</strong> rispetto alla tua media <span class="gf-sotto">(${esc(euroCompatto(c.media.valore))} su ${c.media.periodi} periodi)</span></span></p>`;
        righe.push(m);
      }
      if (c.inCorso) righe.push('<p class="gf-sotto">Il periodo è in corso: il confronto è fatto sugli stessi giorni dei periodi precedenti.</p>');
    }
    return scheda('Sto spendendo più o meno di prima?', `
      <div class="gf-cifra"><span class="gf-cifra-et">Spese del periodo</span><span class="ind-valore" data-r="spese"></span></div>
      ${righe.join('')}`);
  }

  function partiDelPeriodo() {
    const effettivo = periodoEffettivo(periodo, dati.primaData, dati.oggi);
    return sottoperiodi(effettivo, giornoInizio(), dati.oggi);
  }

  function schedaSpeseNelTempo(parti) {
    if (parti.length < 2) return ''; // niente barre nel tempo per un solo giorno
    const t = totaliPerSottoperiodo(dati.movimenti, parti);
    if (t.every((x) => x.spese === 0)) return scheda('Come sono andate le spese nel tempo?', messaggio('Nessuna spesa in questo periodo.'));
    return scheda('Come sono andate le spese nel tempo?', '<div data-r="barre-spese"></div>');
  }

  function schedaRisparmio(parti) {
    if (parti.length < 2) return '';
    const t = totaliPerSottoperiodo(dati.movimenti, parti);
    if (t.every((x) => x.spese === 0 && x.entrate === 0)) return scheda('Quanto riesco a risparmiare?', messaggio('Nessuna entrata né spesa in questo periodo.'));
    return scheda('Quanto riesco a risparmiare?', '<div data-r="barre-risparmio"></div>');
  }

  function schedaPatrimonio() {
    if (periodo.modo === 'giorno') return ''; // un giorno solo non fa un andamento
    return scheda('Come cresce il patrimonio?', `<div data-r="andamento"></div><p class="pt-nota-grafico" data-r="nota-andamento"></p>`);
  }

  // ---- Disegno ----

  function disegna({ direzione = 0 } = {}) {
    if (!dati) return;
    const movimentiPeriodo = dati.movimenti.filter((m) => m.data >= periodo.da && m.data <= periodo.a);
    const parti = partiDelPeriodo();

    contenuto.innerHTML = [
      schedaCategorie(movimentiPeriodo),
      schedaConfronto(movimentiPeriodo),
      schedaSpeseNelTempo(parti),
      schedaRisparmio(parti),
      schedaPatrimonio(),
    ].join('');

    contenuto.classList.remove('slide-avanti', 'slide-indietro');
    if (direzione) {
      void contenuto.offsetWidth;
      contenuto.classList.add(direzione > 0 ? 'slide-avanti' : 'slide-indietro');
    }
    montaGrafici(movimentiPeriodo, parti);
  }

  function montaGrafici(movimentiPeriodo, parti) {
    const elCiambella = $('[data-r="ciambella"]', contenuto);
    if (elCiambella) {
      const t = totaliPerCategoria(movimentiPeriodo, 'spesa');
      creaCiambella(elCiambella, {
        fette: fetteCiambella(t.righe), totale: t.totale, etichetta: 'Spese',
        alTocco: (categoriaId) => apriDettaglioCategoria({ categoriaId, periodo, tipo: 'spesa' }),
      });
    }

    const elSpese = $('[data-r="spese"]', contenuto);
    if (elSpese) {
      const totale = movimentiPeriodo.reduce((s, m) => (m.tipo === 'spesa' ? s + m.importo : s), 0);
      animaNumero(elSpese, ultimaSpesa ?? totale, totale, euroCompatto);
      ultimaSpesa = totale;
    }

    const elBarreSpese = $('[data-r="barre-spese"]', contenuto);
    const elBarreRisparmio = $('[data-r="barre-risparmio"]', contenuto);
    if (elBarreSpese || elBarreRisparmio) {
      const t = totaliPerSottoperiodo(dati.movimenti, parti);
      const voci = t.map((x) => ({ breve: x.breve, lunga: x.lunga }));
      if (elBarreSpese) {
        creaGraficoBarre(elBarreSpese).aggiorna({ voci, serie: [{ nome: 'Spese', classe: 'gb-ser-spese', valori: t.map((x) => x.spese) }] });
      }
      if (elBarreRisparmio) {
        creaGraficoBarre(elBarreRisparmio).aggiorna({
          voci,
          serie: [
            { nome: 'Entrate', classe: 'gb-ser-entrate', valori: t.map((x) => x.entrate) },
            { nome: 'Spese', classe: 'gb-ser-spese', valori: t.map((x) => x.spese) },
          ],
          linea: { nome: 'Risparmio', valori: t.map((x) => x.risparmio) },
        });
      }
    }

    const elAndamento = $('[data-r="andamento"]', contenuto);
    if (elAndamento) {
      const intervallo = intervalloGrafico(periodo, dati.primaData, dati.oggi);
      const dateValori = dati.valori.map((v) => v.data);
      const punti = intervallo ? serieAndamento(dati.storie, intervallo.da, intervallo.a, 90, dateValori) : [];
      const marcatori = intervallo ? dateValori.filter((d) => d >= intervallo.da && d <= intervallo.a) : [];
      creaGrafico(elAndamento).aggiorna({ punti, nascosto: importiNascosti(), marcatori });
      const nota = $('[data-r="nota-andamento"]', contenuto);
      if (punti.length >= 2) {
        const differenza = punti.at(-1).valore - punti[0].valore;
        nota.className = `pt-nota-grafico ${differenza > 0 ? 'pt-su' : (differenza < 0 ? 'pt-giu' : '')}`;
        nota.textContent = `Nel periodo: ${importiNascosti() ? '•••••' : euroConSegno(differenza)}${marcatori.length ? ' · i cerchi sono gli aggiornamenti del valore degli investimenti' : ''}`;
      }
    }
  }

  radice.addEventListener('click', (e) => {
    const riga = e.target.closest('.riga-cat[data-id]');
    if (riga) apriDettaglioCategoria({ categoriaId: riga.dataset.id, periodo, tipo: 'spesa' });
  });

  carica();

  return {
    /** Chiamata quando cambiano movimenti, conti, categorie o impostazioni. */
    aggiorna(dettaglio = {}) {
      if (dettaglio.evento === 'impostazioni') {
        // Salvare l'ultimo periodo scelto non deve ridisegnare di nuovo tutto.
        const soloPeriodo = Object.keys(dettaglio).filter((k) => k !== 'evento').every((k) => k === 'ultimoPeriodoGrafici');
        if (soloPeriodo) return;
        if (!periodoValido(periodo, giornoInizio())) { periodo = periodoContenente('mese', oggiIso(), giornoInizio()); selettore.imposta(periodo); } else selettore.aggiorna();
        if (dettaglio.ripristino) { carica(); return; }
        disegna(); // l'occhio o il giorno di inizio mese: i dati sono gli stessi
        return;
      }
      carica();
    },
  };
}
