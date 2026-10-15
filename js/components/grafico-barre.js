// Barre per sotto-periodo (giorni, settimane, mesi, anni), con una o due serie affiancate e, se serve, una linea
// (il risparmio). Le barre sono HTML (così si animano e hanno gli angoli arrotondati), la linea è un SVG sopra.
// Si tocca o si trascina il dito per leggere i valori di un sotto-periodo.

import { esc } from '../util/dom.js';
import { euro, euroArrotondato } from '../util/formato.js';

const MAX_ETICHETTE = 7; // etichette sull'asse: abbastanza per leggere, non troppe per stare in 360 px

/**
 * @param {HTMLElement} contenitore
 * @returns {{aggiorna(dati: {
 *   voci: {breve: string, lunga: string}[],
 *   serie: {nome: string, classe: string, valori: number[]}[],
 *   linea?: {nome: string, valori: number[]}|null,
 * }): void}}
 */
export function creaGraficoBarre(contenitore) {
  let dati = null;
  let colonne = 0;

  contenitore.classList.add('gb');
  contenitore.addEventListener('pointerdown', suPuntatore);
  contenitore.addEventListener('pointermove', suPuntatore);
  contenitore.addEventListener('pointerup', finePuntatore);
  contenitore.addEventListener('pointercancel', finePuntatore);
  contenitore.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') finePuntatore(); });

  function aggiorna(nuovi) {
    dati = nuovi;
    colonne = dati.voci.length;
    disegna();
  }

  function disegna() {
    const { voci, serie, linea } = dati;
    const valori = [...serie.flatMap((s) => s.valori), ...(linea ? linea.valori : [])];
    const minimo = Math.min(0, ...valori);
    const massimo = Math.max(0, ...valori);
    const intervallo = massimo - minimo || 1;
    const y = (v) => ((massimo - v) / intervallo) * 100; // posizione dall'alto, in %
    const zero = y(0);

    const barra = (valore, classe, i) => {
      const positivo = valore >= 0;
      const alto = positivo ? y(valore) : zero;
      const altezza = Math.abs(y(valore) - zero);
      return `<span class="gb-sl"><span class="gb-barra ${classe} ${positivo ? '' : 'gb-neg'}" style="--t:${alto.toFixed(2)}%; --h:${Math.max(altezza, valore === 0 ? 0 : 0.8).toFixed(2)}%; --i:${i}"></span></span>`;
    };
    const colonneHtml = voci.map((_, i) => `
      <div class="gb-col" data-i="${i}">${serie.map((s) => barra(s.valori[i], s.classe, i)).join('')}</div>`).join('');

    let lineaHtml = '';
    if (linea) {
      const punti = linea.valori.map((v, i) => `${(((i + 0.5) / colonne) * 100).toFixed(2)},${y(v).toFixed(2)}`);
      const pallini = colonne <= 16
        ? linea.valori.map((v, i) => `<span class="gb-pallino" style="left:${(((i + 0.5) / colonne) * 100).toFixed(2)}%; top:${y(v).toFixed(2)}%"></span>`).join('')
        : '';
      lineaHtml = `
        <svg class="gb-linea" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${punti.join(' ')}" fill="none" vector-effect="non-scaling-stroke"/>
        </svg>${pallini}`;
    }

    const passo = Math.max(1, Math.ceil(colonne / MAX_ETICHETTE));
    const asse = voci.map((v, i) => `<span>${i % passo === 0 ? esc(v.breve) : ''}</span>`).join('');
    const legenda = [...serie, ...(linea ? [{ nome: linea.nome, classe: 'gb-leg-linea' }] : [])]
      .map((s) => `<span class="gb-leg"><span class="gb-leg-punto ${s.classe}"></span>${esc(s.nome)}</span>`).join('');

    contenitore.innerHTML = `
      <div class="gb-area" style="--n:${colonne}" role="img" aria-label="${esc(serie.map((s) => s.nome).join(', '))} per periodo">
        <span class="gb-zero" style="top:${zero.toFixed(2)}%"></span>
        <div class="gb-colonne">${colonneHtml}</div>
        ${lineaHtml}
        <span class="gb-estremo gb-alto">${esc(euroArrotondato(massimo))}</span>
        ${minimo < 0 ? `<span class="gb-estremo gb-basso">${esc(euroArrotondato(minimo))}</span>` : ''}
        <span class="gb-tip" role="status" hidden></span>
      </div>
      <div class="gb-asse" style="--n:${colonne}">${asse}</div>
      <div class="gb-legenda">${legenda}</div>`;
    // Le barre partono da zero e crescono (la transizione CSS fa il resto).
    requestAnimationFrame(() => requestAnimationFrame(() => contenitore.querySelector('.gb-area')?.classList.add('piena')));
  }

  function indiceVicino(e) {
    const area = contenitore.querySelector('.gb-area');
    if (!area || !colonne) return -1;
    const r = area.getBoundingClientRect();
    return Math.max(0, Math.min(colonne - 1, Math.floor(((e.clientX - r.left) / r.width) * colonne)));
  }

  function suPuntatore(e) {
    if (!dati) return;
    if (e.type === 'pointermove' && e.pointerType !== 'mouse' && !contenitore.dataset.attivo) return;
    if (e.type === 'pointerdown') contenitore.dataset.attivo = '1';
    const i = indiceVicino(e);
    if (i < 0) return;
    const area = contenitore.querySelector('.gb-area');
    area.querySelectorAll('.gb-col.attiva').forEach((c) => c.classList.remove('attiva'));
    area.querySelector(`.gb-col[data-i="${i}"]`)?.classList.add('attiva');
    const righe = [
      ...dati.serie.map((s) => `<span><i class="gb-leg-punto ${s.classe}"></i>${esc(s.nome)} <strong>${esc(euro(s.valori[i]))}</strong></span>`),
      ...(dati.linea ? [`<span><i class="gb-leg-punto gb-leg-linea"></i>${esc(dati.linea.nome)} <strong>${esc(euro(dati.linea.valori[i]))}</strong></span>`] : []),
    ];
    const tip = area.querySelector('.gb-tip');
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(dati.voci[i].lunga)}</b>${righe.join('')}`;
    tip.style.left = `${Math.max(22, Math.min(78, ((i + 0.5) / colonne) * 100))}%`;
  }

  function finePuntatore() {
    delete contenitore.dataset.attivo;
    contenitore.querySelectorAll('.gb-col.attiva').forEach((c) => c.classList.remove('attiva'));
    const tip = contenitore.querySelector('.gb-tip');
    if (tip) tip.hidden = true;
  }

  return { aggiorna };
}
