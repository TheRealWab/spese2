// Versioni "piene" delle icone della barra in basso: la voce selezionata passa dal contorno all'icona piena.
// Sono disegni a mano sulla stessa griglia 24x24 delle icone Lucide, con lo stesso peso visivo.
// Le parti "scavate" (la riga e i puntini del calendario) hanno il colore del cerchio dietro la voce attiva.

import { icona } from './icone.js';

const SCAVO = 'var(--accento-tenue)';
const PIENO = 'fill="currentColor" stroke="none"';
const LINEA = 'fill="none" stroke="currentColor"';

const PIENE = {
  // Calendario: corpo pieno, due linguette, riga sotto l'intestazione e puntini scavati.
  'calendar-days': `
    <path ${LINEA} stroke-width="2" d="M8 2.5v3M16 2.5v3"/>
    <rect ${PIENO} x="3" y="3.5" width="18" height="18" rx="3.2"/>
    <path fill="none" stroke="${SCAVO}" stroke-width="1.6" d="M3 9.5h18"/>
    <path fill="none" stroke="${SCAVO}" stroke-width="2.2" stroke-linecap="round" d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01"/>`,
  // Barre: le tre barre diventano spesse, con gli estremi arrotondati.
  'chart-no-axes-column': `<path ${LINEA} stroke-width="4.4" stroke-linecap="round" d="M5 19v-3.5M12 19.5V4.5M19 19.5v-8"/>`,
  // Banca: tetto pieno, quattro colonne spesse e base.
  landmark: `
    <path ${PIENO} d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7.5h-17a.5.5 0 0 1-.22-.949z"/>
    <path ${LINEA} stroke-width="2.8" d="M6 11v7M10 11v7M14 11v7M18 11v7"/>
    <path ${LINEA} stroke-width="2.4" stroke-linecap="round" d="M3.5 21.5h17"/>`,
  // Quattro riquadri pieni.
  'layout-grid': `
    <rect ${PIENO} x="3" y="3" width="8" height="8" rx="2"/>
    <rect ${PIENO} x="13" y="3" width="8" height="8" rx="2"/>
    <rect ${PIENO} x="13" y="13" width="8" height="8" rx="2"/>
    <rect ${PIENO} x="3" y="13" width="8" height="8" rx="2"/>`,
  // Tre puntini più grandi.
  ellipsis: `<circle ${PIENO} cx="5" cy="12" r="2.4"/><circle ${PIENO} cx="12" cy="12" r="2.4"/><circle ${PIENO} cx="19" cy="12" r="2.4"/>`,
};

/** Icona piena, oppure quella a contorno se non ne esiste una piena. */
export function iconaPiena(nome, dimensione = 22) {
  if (!(nome in PIENE)) return icona(nome, dimensione);
  return `<svg class="icona icona-piena" width="${dimensione}" height="${dimensione}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PIENE[nome]}</svg>`;
}
