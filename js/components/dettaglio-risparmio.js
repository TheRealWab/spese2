// Foglio "da dove viene il risparmio": si apre toccando la scheda Risparmio in Mese. Mostra il conto
// (entrate − spese), quanta parte delle entrate è rimasta, quanto è andato sugli investimenti e il confronto
// con il periodo precedente.

import { apriPannello } from './pannello.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { euro, euroConSegno, etichettaCiclo, percentuale } from '../util/formato.js';
import { cicloPrecedente } from '../util/date.js';
import { movimentiPeriodo } from '../model/movimenti.js';
import { mappaDeiConti } from '../model/catalogo.js';
import { riepilogoRisparmio } from '../model/calcoli.js';

/** @param {{ciclo: {inizio: string, fine: string}, giornoInizio: number}} opzioni */
export function apriDettaglioRisparmio({ ciclo, giornoInizio }) {
  let radice = null;
  let aperto = true;
  const titolo = `Risparmio · ${etichettaCiclo(ciclo, giornoInizio)}`;

  const ctrl = apriPannello({
    tipo: 'sheet',
    etichetta: titolo,
    riempi(el) {
      radice = el;
      el.innerHTML = `<h2 class="foglio-titolo">${esc(titolo)}</h2><div class="foglio-corpo" data-r="corpo"></div>`;
      carica();
    },
  });
  ctrl.chiuso.then(() => { aperto = false; });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  async function carica() {
    const prima = cicloPrecedente(ciclo, giornoInizio);
    const [movimenti, movimentiPrima] = await Promise.all([
      movimentiPeriodo(ciclo.inizio, ciclo.fine), movimentiPeriodo(prima.inizio, prima.fine),
    ]);
    if (!aperto) return;
    const conti = mappaDeiConti();
    const r = riepilogoRisparmio(movimenti, conti);
    const p = riepilogoRisparmio(movimentiPrima, conti);

    let frase;
    if (r.tasso === null) frase = r.spese ? 'In questo periodo non ci sono entrate: tutto ciò che hai speso riduce il risparmio.' : 'In questo periodo non ci sono ancora entrate né spese.';
    else if (r.risparmio < 0) frase = `Hai speso ${euro(-r.risparmio)} più di quanto è entrato.`;
    else frase = `Ti è rimasto il ${percentuale(r.tasso)} di quello che è entrato.`;

    const differenza = r.risparmio - p.risparmio;
    const confronto = (p.entrate || p.spese)
      ? `${euroConSegno(p.risparmio)} (${differenza === 0 ? 'uguale' : `ora ${euro(Math.abs(differenza))} ${differenza > 0 ? 'in più' : 'in meno'}`})`
      : 'nessun movimento';

    const riga = (nome, valore, classe = '') => `<div class="risp-riga ${classe}"><dt>${nome}</dt><dd>${esc(valore)}</dd></div>`;
    radice.querySelector('[data-r="corpo"]').innerHTML = `
      <dl class="scheda risp-conto">
        ${riga('Entrate', euro(r.entrate), 'tono-entrata')}
        ${riga('Spese', r.spese ? `−${euro(r.spese)}` : euro(0), 'tono-spesa')}
        ${riga('Risparmio', euroConSegno(r.risparmio), `risp-totale ${r.risparmio < 0 ? 'tono-negativo' : 'tono-risparmio'}`)}
      </dl>
      <p class="risp-frase">${icona(r.risparmio < 0 ? 'trending-down' : 'piggy-bank', 18)}<span>${esc(frase)}</span></p>
      <dl class="scheda risp-conto">
        ${r.versoInvestimenti ? riga('Spostati sugli investimenti', euro(r.versoInvestimenti)) : ''}
        ${riga(`Periodo prima (${etichettaCiclo(prima, giornoInizio)})`, confronto, 'risp-colonna')}
      </dl>
      <p class="nota-fondo">I trasferimenti tra i tuoi conti non sono né entrate né spese: spostare soldi sugli investimenti non riduce il risparmio.</p>`;
  }
}
