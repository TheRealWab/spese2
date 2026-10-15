// Area "Categorie" (SPEC §6.4): quanto si è speso (o incassato) per categoria nel periodo, e il dettaglio di ognuna.

import { $, esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, euroCompatto, percentuale } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { animaNumero } from '../util/animazione.js';
import { abilitaSwipe } from '../util/swipe.js';
import { impostazioni } from '../model/impostazioni.js';
import { movimentiPeriodo } from '../model/movimenti.js';
import { categoriaPerId } from '../model/catalogo.js';
import { totaliPerCategoria } from '../model/categorie.js';
import { periodoContenente, periodoValido } from '../model/periodi.js';
import { creaSelettorePeriodo } from '../components/selettore-periodo.js';
import { apriDettaglioCategoria } from '../components/dettaglio-categoria.js';
import { apriEditorCategoria } from '../components/editor-categoria.js';
import { apriGestioneCategorie } from '../components/gestione-categorie.js';

// Stato che sopravvive al cambio di area: tornando su Categorie si ritrova lo stesso periodo e lo stesso tipo.
let periodo = null;
let tipo = 'spesa';
let ultimoValoreMostrato = 0;

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

export function monta(radice) {
  radice.classList.add('vista-categorie');
  radice.innerHTML = `
    <div data-r="selettore"></div>
    <div class="segmentato ct-tipo" role="group" aria-label="Spese o entrate">
      <button type="button" data-tipo="spesa" aria-pressed="${tipo === 'spesa'}">Spese</button>
      <button type="button" data-tipo="entrata" aria-pressed="${tipo === 'entrata'}">Entrate</button>
    </div>
    <div class="mese-contenuto" data-r="contenuto"></div>`;

  const contenuto = $('[data-r="contenuto"]', radice);
  const giornoInizio = () => impostazioni().giornoInizioMese;
  if (!periodoValido(periodo, giornoInizio())) periodo = periodoContenente('mese', oggiIso(), giornoInizio());
  let sequenza = 0;

  const selettore = creaSelettorePeriodo($('[data-r="selettore"]', radice), {
    periodo,
    giornoInizio,
    alCambio: (nuovo, direzione) => { periodo = nuovo; disegna({ direzione }); },
  });
  abilitaSwipe(radice, (direzione) => selettore.vai(direzione));

  function htmlRiga(r, indice) {
    const categoria = categoriaPerId(r.categoriaId);
    return `
      <button type="button" class="riga-cat col-${esc(categoria?.colore ?? 'ardesia')}" data-id="${esc(r.categoriaId)}">
        ${cerchioIcona(categoria?.icona ?? 'package', categoria?.colore ?? 'ardesia', 44)}
        <span class="ct-testo">
          <span class="ct-nome">${esc(categoria?.nome ?? 'Categoria eliminata')}${categoria?.archiviata ? ' <span class="badge">Archiviata</span>' : ''}</span>
          <span class="ct-sotto">${plurale(r.conteggio, 'movimento', 'movimenti')} · ${percentuale(r.percentuale)}</span>
          <span class="ct-barra" aria-hidden="true"><span class="ct-barra-riempi" style="--l:${r.percentuale.toFixed(1)}%; --i:${indice}"></span></span>
        </span>
        <span class="ct-importo">${euro(r.totale)}</span>
      </button>`;
  }

  function htmlAzioni() {
    const entrata = tipo === 'entrata';
    return `
      <div class="scheda ct-azioni">
        <button type="button" class="riga-lista" data-azcat="nuova">
          <span class="cerchio col-indaco" style="--dim:40px">${icona('plus', 20)}</span>
          <span class="riga-testo"><span class="riga-titolo">Nuova categoria</span><span class="riga-sotto">Aggiungi una categoria di ${entrata ? 'entrata' : 'spesa'}</span></span>${icona('chevron-right', 18)}
        </button>
        <button type="button" class="riga-lista" data-azcat="gestisci">
          <span class="cerchio cerchio-neutro">${icona('layers', 20)}</span>
          <span class="riga-testo"><span class="riga-titolo">Gestisci categorie</span><span class="riga-sotto">Modifica, archivia, unisci</span></span>${icona('chevron-right', 18)}
        </button>
      </div>`;
  }

  async function disegna({ direzione = 0 } = {}) {
    const mia = ++sequenza;
    const corrente = periodo;
    const movimenti = await movimentiPeriodo(corrente.da, corrente.a);
    if (mia !== sequenza) return; // nel frattempo l'utente ha cambiato periodo o tipo

    const t = totaliPerCategoria(movimenti, tipo);
    const etichetta = tipo === 'spesa' ? 'Spese' : 'Entrate';
    contenuto.innerHTML = `
      <section class="scheda indicatore ct-totale">
        <p class="ind-et">${etichetta} del periodo</p>
        <div class="ind-riga"><span class="ind-valore" data-r="hero"></span></div>
        <p class="ind-sotto">${t.conteggio ? `${plurale(t.conteggio, 'movimento', 'movimenti')} in ${plurale(t.righe.length, 'categoria', 'categorie')}` : 'Nessun movimento in questo periodo'}</p>
      </section>
      ${t.righe.length
        ? `<div class="scheda lista-cat">${t.righe.map(htmlRiga).join('')}</div>`
        : `<div class="stato-vuoto">
             <span class="cerchio cerchio-neutro" style="--dim:64px">${icona('inbox', 30)}</span>
             <h2>${tipo === 'spesa' ? 'Nessuna spesa' : 'Nessuna entrata'}</h2>
             <p>In questo periodo non c'è ancora nulla da mostrare per categoria.</p>
           </div>`}
      ${htmlAzioni()}`;

    contenuto.classList.remove('slide-avanti', 'slide-indietro');
    if (direzione) {
      void contenuto.offsetWidth;
      contenuto.classList.add(direzione > 0 ? 'slide-avanti' : 'slide-indietro');
    }
    animaNumero($('[data-r="hero"]', contenuto), ultimoValoreMostrato, t.totale, euroCompatto);
    ultimoValoreMostrato = t.totale;

    // Le barre partono da 0 e si riempiono (la transizione CSS fa il resto).
    requestAnimationFrame(() => requestAnimationFrame(() => contenuto.querySelectorAll('.ct-barra-riempi').forEach((b) => b.classList.add('piena'))));
  }

  radice.addEventListener('click', (e) => {
    const nuovoTipo = e.target.closest('[data-tipo]')?.dataset.tipo;
    if (nuovoTipo && nuovoTipo !== tipo) {
      tipo = nuovoTipo;
      radice.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo)));
      ultimoValoreMostrato = 0;
      disegna();
      return;
    }
    const azioneCategorie = e.target.closest('[data-azcat]')?.dataset.azcat;
    if (azioneCategorie === 'nuova') { apriEditorCategoria({ tipo }); return; }
    if (azioneCategorie === 'gestisci') { apriGestioneCategorie({ tipo }); return; }
    const riga = e.target.closest('.riga-cat');
    if (riga) apriDettaglioCategoria({ categoriaId: riga.dataset.id, periodo, tipo });
  });

  disegna();

  return {
    /** Chiamata quando cambiano movimenti o impostazioni. */
    aggiorna(dettaglio = {}) {
      if (dettaglio.evento === 'impostazioni' && !periodoValido(periodo, giornoInizio())) {
        periodo = periodoContenente('mese', oggiIso(), giornoInizio());
        selettore.imposta(periodo);
      } else if (dettaglio.evento === 'impostazioni') {
        selettore.aggiorna();
      }
      disegna();
    },
  };
}
