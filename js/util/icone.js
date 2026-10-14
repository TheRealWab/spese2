// Disegna le icone Lucide (SVG inline). Il tratto è lo stesso ovunque (--spessore-icona in tokens.css).

import { ICONE } from '../../vendor/lucide/icone.js';
import { esc } from './dom.js';

export const esisteIcona = (nome) => nome in ICONE;

/** Markup SVG dell'icona. Nome sconosciuto → icona "pacco" (mai un buco vuoto). */
export function icona(nome, dimensione = 22) {
  const interno = ICONE[nome] ?? ICONE.package;
  return `<svg class="icona" width="${dimensione}" height="${dimensione}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${interno}</svg>`;
}

/** Cerchio colorato con l'icona di una categoria o di un conto: stessa resa in elenchi, inserimento, grafici. */
export function cerchioIcona(nomeIcona, colore, dimensione = 40) {
  const interna = Math.round(dimensione * 0.5);
  const classe = colore ? `col-${esc(colore)}` : 'cerchio-neutro';
  return `<span class="cerchio ${classe}" style="--dim:${dimensione}px">${icona(nomeIcona, interna)}</span>`;
}
