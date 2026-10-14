// Area "Mese" (SPEC §6.1): indicatore stipendio, riepilogo del ciclo ed elenco dei movimenti per giorno.

import { $ } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { euro, euroCompatto, euroArrotondato, euroConSegno, etichettaCiclo, etichettaGiorno, percentuale } from '../util/formato.js';
import { oggiIso, cicloContenente, cicloPrecedente, cicloSuccessivo, dentroCiclo } from '../util/date.js';
import { animaNumero } from '../util/animazione.js';
import { impostazioni } from '../model/impostazioni.js';
import { movimentiPeriodo } from '../model/movimenti.js';
import { mappaDelleCategorie, mappaDeiConti, categoriaStipendio } from '../model/catalogo.js';
import { indicatoreStipendio, totaliPeriodo, raggruppaPerGiorno } from '../model/calcoli.js';
import { htmlRigaMovimento } from '../components/riga-movimento.js';
import { apriInserimento } from '../components/inserimento.js';

// Stato che sopravvive al cambio di area: tornando su Mese si ritrova lo stesso periodo.
let ciclo = null;
let ultimoValoreMostrato = 0;

const SOGLIA_SWIPE = 70;

function cicloValido(giornoInizio) {
  return ciclo && cicloContenente(ciclo.inizio, giornoInizio).inizio === ciclo.inizio;
}

export function monta(radice) {
  radice.classList.add('vista-mese');
  radice.innerHTML = `
    <header class="mese-testata">
      <button type="button" class="btn-icona" data-az="prec" aria-label="Periodo precedente">${icona('chevron-left', 24)}</button>
      <button type="button" class="mese-titolo" data-az="oggi" data-r="titolo" aria-label="Torna al periodo corrente"></button>
      <button type="button" class="btn-icona" data-az="succ" aria-label="Periodo successivo">${icona('chevron-right', 24)}</button>
    </header>
    <div class="mese-contenuto" data-r="contenuto"></div>`;

  const contenuto = $('[data-r="contenuto"]', radice);
  const titolo = $('[data-r="titolo"]', radice);
  let sequenza = 0;
  let movimentiMostrati = new Map();

  const giornoInizio = () => impostazioni().giornoInizioMese;
  if (!cicloValido(giornoInizio())) ciclo = cicloContenente(oggiIso(), giornoInizio());

  function htmlIndicatore(ind) {
    if (ind.stato === 'assente') {
      return `
        <section class="scheda indicatore indicatore-assente" aria-label="Indicatore stipendio">
          <p class="ind-et">Uscite del periodo</p>
          <div class="ind-riga"><span class="ind-valore" data-r="hero"></span></div>
          <button type="button" class="ind-avviso" data-az="registra-stipendio">
            ${icona('circle-alert', 18)}<span>Stipendio non ancora registrato</span><strong>Registralo</strong>
          </button>
        </section>`;
    }
    const superato = ind.stato === 'superato';
    return `
      <section class="scheda indicatore stato-${ind.stato}" aria-label="Indicatore stipendio">
        <p class="ind-et">${superato ? 'Hai superato di' : 'Ti restano'}</p>
        <div class="ind-riga">
          <span class="ind-valore" data-r="hero"></span>
          <span class="ind-di">di ${euroCompatto(ind.stipendio)}</span>
        </div>
        <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"
             aria-valuenow="${Math.min(100, Math.round(ind.percentuale))}" aria-label="Uscite rispetto allo stipendio">
          <div class="barra-riempi" data-larghezza="${Math.min(100, ind.percentuale).toFixed(1)}"></div>
        </div>
        <p class="ind-sotto">Uscite ${euroCompatto(ind.uscite)} (${percentuale(ind.percentuale)})</p>
      </section>`;
  }

  function htmlRiepilogo(t) {
    const scheda = (et, valore, nomeIcona, classe) => `
      <div class="scheda mini ${classe}">
        <span class="mini-et">${icona(nomeIcona, 16)}${et}</span>
        <span class="mini-valore">${valore}</span>
      </div>`;
    return `
      <div class="riepilogo" aria-label="Riepilogo del periodo">
        ${scheda('Entrate', euroArrotondato(t.entrate), 'arrow-down-left', 'mini-entrate')}
        ${scheda('Spese', euroArrotondato(t.spese), 'arrow-up-right', '')}
        ${scheda('Risparmio', euroArrotondato(t.risparmio), 'piggy-bank', t.risparmio < 0 ? 'mini-negativo' : '')}
      </div>`;
  }

  function htmlElenco(gruppi, oggi, evidenziaId) {
    if (!gruppi.length) {
      return `
        <div class="stato-vuoto">
          <span class="cerchio cerchio-neutro" style="--dim:64px">${icona('inbox', 30)}</span>
          <h2>Nessun movimento</h2>
          <p>In questo periodo non c'è ancora nulla. Tocca il pulsante + per aggiungere una spesa.</p>
        </div>`;
    }
    return gruppi.map((g) => `
      <section class="giorno">
        <header class="giorno-testata">
          <h2>${etichettaGiorno(g.data, oggi)}</h2>
          ${g.haTotale ? `<span class="giorno-totale">${g.totale === 0 ? euro(0) : euroConSegno(g.totale)}</span>` : ''}
        </header>
        <div class="scheda lista-mov">
          ${g.movimenti.map((m) => htmlRigaMovimento(m, { evidenzia: m.id === evidenziaId })).join('')}
        </div>
      </section>`).join('');
  }

  async function disegna({ direzione = 0, evidenziaId = null } = {}) {
    const mia = ++sequenza;
    const corrente = ciclo;
    const movimenti = await movimentiPeriodo(corrente.inizio, corrente.fine);
    if (mia !== sequenza) return; // nel frattempo l'utente ha cambiato periodo

    const oggi = oggiIso();
    const categorie = mappaDelleCategorie();
    const ind = indicatoreStipendio(movimenti, categorie, mappaDeiConti());
    const valoreEroe = ind.stato === 'assente' ? ind.uscite : Math.abs(ind.restano);

    movimentiMostrati = new Map(movimenti.map((m) => [m.id, m]));
    titolo.textContent = etichettaCiclo(corrente, giornoInizio());
    contenuto.innerHTML = htmlIndicatore(ind) + htmlRiepilogo(totaliPeriodo(movimenti))
      + htmlElenco(raggruppaPerGiorno(movimenti), oggi, evidenziaId);

    contenuto.classList.remove('slide-avanti', 'slide-indietro');
    if (direzione) {
      void contenuto.offsetWidth;
      contenuto.classList.add(direzione > 0 ? 'slide-avanti' : 'slide-indietro');
    }

    animaNumero($('[data-r="hero"]', contenuto), ultimoValoreMostrato, valoreEroe, euroCompatto);
    ultimoValoreMostrato = valoreEroe;

    // La barra parte da 0 e si riempie (la transizione CSS fa il resto).
    const barra = $('.barra-riempi', contenuto);
    if (barra) requestAnimationFrame(() => requestAnimationFrame(() => { barra.style.width = `${barra.dataset.larghezza}%`; }));

    if (evidenziaId) $('.appena-aggiunto', contenuto)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function vai(direzione) {
    ciclo = direzione > 0 ? cicloSuccessivo(ciclo, giornoInizio()) : cicloPrecedente(ciclo, giornoInizio());
    disegna({ direzione });
  }

  function tornaAdOggi() {
    const corrente = cicloContenente(oggiIso(), giornoInizio());
    if (corrente.inizio === ciclo.inizio) return;
    const direzione = corrente.inizio > ciclo.inizio ? 1 : -1;
    ciclo = corrente;
    disegna({ direzione });
  }

  radice.addEventListener('click', (e) => {
    const az = e.target.closest('[data-az]')?.dataset.az;
    if (az === 'prec') vai(-1);
    else if (az === 'succ') vai(1);
    else if (az === 'oggi') tornaAdOggi();
    else if (az === 'registra-stipendio') {
      const stipendio = categoriaStipendio();
      apriInserimento({ iniziale: { tipo: 'entrata', categoriaId: stipendio?.id ?? null } });
    } else {
      const riga = e.target.closest('.riga-mov');
      if (riga) apriInserimento({ movimento: movimentiMostrati.get(riga.dataset.id) });
    }
  });

  // Scorrimento orizzontale = cambio periodo (solo gesti decisamente orizzontali).
  let inizioX = 0;
  let inizioY = 0;
  let inizioT = 0;
  radice.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    inizioX = e.touches[0].clientX;
    inizioY = e.touches[0].clientY;
    inizioT = Date.now();
  }, { passive: true });
  radice.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - inizioX;
    const dy = t.clientY - inizioY;
    if (Math.abs(dx) > SOGLIA_SWIPE && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - inizioT < 700) {
      vai(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  disegna();

  return {
    /** Chiamata quando cambiano movimenti o impostazioni. */
    aggiorna(dettaglio = {}) {
      if (dettaglio.evento === 'impostazioni') {
        if (!cicloValido(giornoInizio())) ciclo = cicloContenente(oggiIso(), giornoInizio());
        disegna();
        return;
      }
      // Dopo un salvataggio il movimento dev'essere visibile: se è fuori dal periodo mostrato, ci si sposta.
      const salvato = dettaglio.azione === 'creato' || dettaglio.azione === 'modificato';
      let direzione = 0;
      if (salvato && dettaglio.data && !dentroCiclo(dettaglio.data, ciclo)) {
        const nuovo = cicloContenente(dettaglio.data, giornoInizio());
        direzione = nuovo.inizio > ciclo.inizio ? 1 : -1;
        ciclo = nuovo;
      }
      disegna({ direzione, evidenziaId: salvato ? dettaglio.id : null });
    },
  };
}
