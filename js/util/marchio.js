// Il nome dell'app come titolo: la prima lettera (la W) nel colore dell'app, il resto normale.

import { NOME_APP } from '../versione.js';

export function marchioHtml() {
  return `<span class="marchio"><span class="marchio-w">${NOME_APP.slice(0, 1)}</span>${NOME_APP.slice(1)}</span>`;
}
