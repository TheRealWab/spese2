// Il cerchio del profilo: la foto, oppure l'iniziale del nome, oppure un'icona generica.

import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { fotoValida, iniziali } from '../model/aspetto.js';

export function htmlAvatar({ nome = '', foto = null } = {}, dimensione = 64) {
  const stile = `--dim:${dimensione}px`;
  if (fotoValida(foto)) {
    return `<span class="avatar" style="${stile}"><img src="${foto}" alt="" draggable="false"></span>`;
  }
  const lettere = iniziali(nome);
  return `<span class="avatar avatar-vuoto" style="${stile}" aria-hidden="true">${lettere ? `<span class="avatar-lettere" style="font-size:${Math.round(dimensione * 0.38)}px">${esc(lettere)}</span>` : icona('user', Math.round(dimensione * 0.5))}</span>`;
}
