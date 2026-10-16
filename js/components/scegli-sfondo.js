// Pannello "Sfondo": sfondi pronti (sfumature), sfondo semplice, oppure una foto dalla galleria con un cursore che la attenua.
// La scelta si applica subito (si vede dietro al pannello) e si salva a ogni tocco.

import { apriPannello } from './pannello.js';
import { mostraToast } from './toast.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { apriImmagine, riduci, ErroreImmagine } from '../util/immagine.js';
import { applicaSfondo } from '../util/sfondo-app.js';
import { impostazioni, salvaImpostazioni } from '../model/impostazioni.js';
import { SFONDI, ID_SFONDO_FOTO, ATTENUA_MASSIMA, fotoValida, normalizzaSfondo } from '../model/aspetto.js';

export function apriScegliSfondo() {
  let radice = null;
  let errore = '';

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Sfondo',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      disegna();
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function sfondo() { return normalizzaSfondo(impostazioni().sfondo); }

  function htmlTessera(id, nome, stile, scelto) {
    return `
      <button type="button" class="sf-tessera ${scelto ? 'scelta' : ''}" data-sfondo="${esc(id)}" role="radio" aria-checked="${scelto}" aria-label="${esc(nome)}">
        <span class="sf-anteprima" ${stile}>${scelto ? `<span class="sf-spunta">${icona('check', 16)}</span>` : ''}</span>
        <span class="sf-nome">${esc(nome)}</span>
      </button>`;
  }

  function disegna() {
    const s = sfondo();
    const posizione = radice.querySelector('.flusso-corpo')?.scrollTop ?? 0;
    const tessere = SFONDI.map((x) => htmlTessera(
      x.id, x.nome,
      `style="--s:${esc(x.anteprima ?? x.css)}"`,
      s.id === x.id,
    ));
    if (s.foto) tessere.push(htmlTessera(ID_SFONDO_FOTO, 'La tua foto', 'data-foto', s.id === ID_SFONDO_FOTO));

    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Sfondo</h2>
        </header>
        <div class="flusso-corpo">
          <div class="sf-griglia" role="radiogroup" aria-label="Sfondi">${tessere.join('')}</div>
          <label class="chip sf-carica">${icona('image-plus', 18)} ${s.foto ? 'Cambia la tua foto' : 'Scegli una foto dalla galleria'}
            <input type="file" accept="image/*" class="solo-sr" data-r="file">
          </label>
          ${s.id === ID_SFONDO_FOTO ? `
            <div class="campo">
              <label for="sf-attenua">Attenua la foto</label>
              <input id="sf-attenua" type="range" min="0" max="${ATTENUA_MASSIMA}" step="1" value="${s.attenua}" class="pr-zoom">
              <p class="flusso-guida">Più la attenui, più i numeri si leggono bene.</p>
            </div>` : ''}
          <p class="flusso-errore" role="alert" ${errore ? '' : 'hidden'}>${esc(errore)}</p>
        </div>
      </div>`;

    // L'anteprima della foto sta fuori dall'HTML: è un testo lungo.
    const miniatura = radice.querySelector('.sf-anteprima[data-foto]');
    if (miniatura && fotoValida(s.foto)) miniatura.style.backgroundImage = `url("${s.foto}")`;
    if (posizione) radice.querySelector('.flusso-corpo').scrollTop = posizione;

    radice.querySelector('[data-r="file"]').addEventListener('change', suFile);
    const cursore = radice.querySelector('#sf-attenua');
    if (cursore) {
      // Mentre si trascina si vede subito il risultato; si salva quando si lascia il cursore.
      cursore.addEventListener('input', () => applicaSfondo({ ...sfondo(), attenua: Number(cursore.value) }));
      cursore.addEventListener('change', () => salva({ ...sfondo(), attenua: Number(cursore.value) }, false));
    }
  }

  async function salva(nuovo, ridisegna = true) {
    try {
      await salvaImpostazioni({ sfondo: normalizzaSfondo(nuovo) });
    } catch (e) {
      console.error(e);
      errore = 'Non sono riuscito a salvare. Riprova.';
    }
    if (ridisegna) disegna();
  }

  async function suFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const foto = riduci(await apriImmagine(file));
      errore = '';
      await salva({ ...sfondo(), id: ID_SFONDO_FOTO, foto });
      mostraToast('Sfondo cambiato');
    } catch (errorePrevisto) {
      if (!(errorePrevisto instanceof ErroreImmagine)) console.error(errorePrevisto);
      errore = errorePrevisto instanceof ErroreImmagine ? errorePrevisto.message : 'Non sono riuscito a usare la foto. Riprova.';
      disegna();
    }
  }

  function suTocco(e, c) {
    if (e.target.closest('[data-az="chiudi"]')) { c.chiudi(undefined); return; }
    const id = e.target.closest('[data-sfondo]')?.dataset.sfondo;
    if (id && id !== sfondo().id) { errore = ''; salva({ ...sfondo(), id }); }
  }
}
