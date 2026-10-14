// Gestore dei pannelli sovrapposti: a tutto schermo (inserimento), fogli dal basso (selettori), dialoghi.
//
// Ogni pannello aggiunge una voce alla cronologia del browser: il tasto "indietro" di Android chiude
// il pannello in cima invece di uscire dall'app. La chiusura da codice (chiudi) torna indietro nella
// cronologia in modo sincronizzato, così le voci non si accumulano.

import { esc, movimentoRidotto } from '../util/dom.js';

const pila = [];
let contatore = 0;
let attesaIndietro = null; // Promise finché un history.back() fatto da noi non è concluso
let risolviIndietro = null;

function tornaIndietroNellaCronologia() {
  attesaIndietro = new Promise((ok) => {
    risolviIndietro = ok;
    setTimeout(ok, 500); // ripiego: se popstate non arriva, non blocchiamo i pannelli successivi
  });
  history.back();
  return attesaIndietro;
}

window.addEventListener('popstate', () => {
  if (risolviIndietro) {
    const ok = risolviIndietro;
    risolviIndietro = null;
    attesaIndietro = null;
    ok();
    return;
  }
  const inCima = pila[pila.length - 1];
  if (inCima) rimuovi(inCima, undefined, true);
});

function rimuovi(p, valore, daPopstate) {
  if (p.stato !== 'aperto') return;
  p.stato = 'chiuso';
  pila.splice(pila.indexOf(p), 1);
  p.sfondo.classList.remove('aperto');
  setTimeout(() => {
    p.sfondo.remove();
    if (!pila.length) document.body.classList.remove('pannello-aperto');
  }, movimentoRidotto() ? 0 : 280);
  p.risolvi(valore);
  if (!daPopstate && p.inCronologia) tornaIndietroNellaCronologia();
}

/**
 * Apre un pannello.
 * @param {{tipo?: 'sheet'|'pieno'|'dialogo', etichetta?: string, riempi: (contenuto: HTMLElement, ctrl) => void}} opzioni
 * @returns {{el: HTMLElement, chiudi: (valore?: any) => void, chiuso: Promise<any>}}
 */
export function apriPannello({ tipo = 'sheet', etichetta = '', riempi }) {
  const sfondo = document.createElement('div');
  sfondo.className = `pannello-sfondo pannello-${tipo}`;
  sfondo.innerHTML = `<div class="pannello" role="dialog" aria-modal="true" aria-label="${esc(etichetta)}" tabindex="-1"><div class="pannello-contenuto"></div></div>`;
  const pannello = sfondo.firstElementChild;
  const contenuto = pannello.firstElementChild;

  const p = { id: ++contatore, sfondo, stato: 'aperto', inCronologia: false, risolvi: null };
  const chiuso = new Promise((ok) => { p.risolvi = ok; });
  const ctrl = { el: contenuto, chiudi: (valore) => rimuovi(p, valore, false), chiuso };

  pila.push(p);
  document.getElementById('strato-pannelli').append(sfondo);
  document.body.classList.add('pannello-aperto');
  // Due frame: serve che il pannello sia disegnato fuori schermo prima di farlo salire.
  requestAnimationFrame(() => requestAnimationFrame(() => sfondo.classList.add('aperto')));

  (async () => {
    if (attesaIndietro) await attesaIndietro;
    if (p.stato === 'aperto') {
      history.pushState({ pannello: p.id }, '');
      p.inCronologia = true;
    }
  })();

  if (tipo !== 'pieno') {
    sfondo.addEventListener('pointerdown', (e) => { if (e.target === sfondo) ctrl.chiudi(undefined); });
  }
  riempi(contenuto, ctrl);
  pannello.focus({ preventScroll: true });
  return ctrl;
}

// Tasto Esc (desktop): chiude il pannello in cima.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !pila.length) return;
  rimuovi(pila[pila.length - 1], undefined, false);
});
