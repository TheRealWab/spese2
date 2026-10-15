// Grafico ad area dell'andamento nel tempo, in SVG scritto a mano (nessuna libreria). Si riusa nei Grafici (Fase 5).
// Il disegno è un SVG che si stira sulla larghezza della scheda; etichette, guida e pallino sono HTML sopra l'SVG,
// così il testo non si deforma. Si tocca o si trascina il dito per leggere data e valore di un punto.

import { esc } from '../util/dom.js';
import { giorniTra } from '../util/date.js';
import { dataBreve, euro, euroArrotondato } from '../util/formato.js';
import { MASCHERA_IMPORTO } from '../util/importi-privati.js';

const ALTEZZA = 100; // sistema di coordinate dell'SVG: 100 × 100, la forma la dà il CSS
let contatoreGrafici = 0; // l'id della sfumatura deve essere unico nella pagina

/**
 * @param {HTMLElement} contenitore
 * @returns {{aggiorna(dati: {punti: {data: string, valore: number}[], nascosto?: boolean}): void}}
 */
export function creaGrafico(contenitore) {
  const idSfumatura = `gr-sfumatura-${++contatoreGrafici}`;
  let punti = [];
  let nascosto = false;
  let xDi = [];
  let yDi = [];

  contenitore.classList.add('gr');
  contenitore.addEventListener('pointerdown', suPuntatore);
  contenitore.addEventListener('pointermove', suPuntatore);
  contenitore.addEventListener('pointerup', finePuntatore);
  contenitore.addEventListener('pointercancel', finePuntatore);
  contenitore.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') finePuntatore(); });

  function aggiorna(dati) {
    punti = dati.punti ?? [];
    nascosto = Boolean(dati.nascosto);
    disegna();
  }

  function disegna() {
    if (punti.length < 2) {
      contenitore.innerHTML = '<p class="gr-vuoto">Servono almeno due giorni di dati per disegnare l\'andamento.</p>';
      return;
    }
    const valori = punti.map((p) => p.valore);
    let minimo = Math.min(...valori);
    let massimo = Math.max(...valori);
    if (minimo === massimo) { minimo -= 1; massimo += 1; }
    const margine = (massimo - minimo) * 0.12;
    minimo -= margine;
    massimo += margine;
    const giorniTotali = Math.max(1, giorniTra(punti[0].data, punti.at(-1).data));
    xDi = punti.map((p) => (giorniTra(punti[0].data, p.data) / giorniTotali) * 100);
    yDi = punti.map((p) => ALTEZZA - ((p.valore - minimo) / (massimo - minimo)) * ALTEZZA);

    const linea = punti.map((_, i) => `${i ? 'L' : 'M'}${xDi[i].toFixed(2)} ${yDi[i].toFixed(2)}`).join(' ');
    const area = `${linea} L100 ${ALTEZZA} L0 ${ALTEZZA} Z`;
    const etichettaValore = (v) => (nascosto ? MASCHERA_IMPORTO : euroArrotondato(v));
    const alto = Math.max(...valori);
    const basso = Math.min(...valori);

    contenitore.innerHTML = `
      <div class="gr-area" role="img" aria-label="Andamento dal ${esc(dataBreve(punti[0].data))} al ${esc(dataBreve(punti.at(-1).data))}">
        <svg viewBox="0 0 100 ${ALTEZZA}" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="${idSfumatura}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="currentColor" stop-opacity="0.28"/>
              <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path class="gr-riempimento" d="${area}" fill="url(#${idSfumatura})"/>
          <path class="gr-linea" d="${linea}" fill="none" vector-effect="non-scaling-stroke"/>
        </svg>
        <span class="gr-estremo gr-alto">${esc(etichettaValore(alto))}</span>
        <span class="gr-estremo gr-basso">${esc(etichettaValore(basso))}</span>
        <span class="gr-guida" hidden></span>
        <span class="gr-pallino" hidden></span>
        <span class="gr-tip" role="status" hidden></span>
      </div>
      <div class="gr-date"><span>${esc(dataBreve(punti[0].data))}</span><span>${esc(dataBreve(punti.at(-1).data))}</span></div>`;
  }

  function indiceVicino(e) {
    const area = contenitore.querySelector('.gr-area');
    if (!area || punti.length < 2) return -1;
    const r = area.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    let migliore = 0;
    for (let i = 1; i < xDi.length; i += 1) if (Math.abs(xDi[i] - x) < Math.abs(xDi[migliore] - x)) migliore = i;
    return migliore;
  }

  function suPuntatore(e) {
    if (e.type === 'pointermove' && e.pointerType !== 'mouse' && !contenitore.dataset.attivo) return;
    if (e.type === 'pointerdown') contenitore.dataset.attivo = '1';
    const i = indiceVicino(e);
    if (i < 0) return;
    const area = contenitore.querySelector('.gr-area');
    const guida = area.querySelector('.gr-guida');
    const pallino = area.querySelector('.gr-pallino');
    const tip = area.querySelector('.gr-tip');
    guida.hidden = false; pallino.hidden = false; tip.hidden = false;
    guida.style.left = `${xDi[i]}%`;
    pallino.style.left = `${xDi[i]}%`;
    pallino.style.top = `${yDi[i]}%`;
    tip.innerHTML = `<strong>${nascosto ? MASCHERA_IMPORTO : esc(euro(punti[i].valore))}</strong><span>${esc(dataBreve(punti[i].data))}</span>`;
    // La nota resta dentro la scheda: vicino ai bordi si ancora a sinistra o a destra del punto.
    tip.style.left = `${Math.max(14, Math.min(86, xDi[i]))}%`;
  }

  function finePuntatore() {
    delete contenitore.dataset.attivo;
    contenitore.querySelectorAll('.gr-guida, .gr-pallino, .gr-tip').forEach((n) => { n.hidden = true; });
  }

  return { aggiorna };
}
