// Pannello "Il tuo profilo": nome e foto. La foto si sceglie dalla galleria e si ritaglia in un cerchio
// (trascinando e ingrandendo); resta solo su questo telefono, e nel backup.

import { apriPannello } from './pannello.js';
import { htmlAvatar } from './avatar.js';
import { mostraToast } from './toast.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { apriImmagine, ritaglia, disegnaRitaglio, ErroreImmagine } from '../util/immagine.js';
import { impostazioni, salvaImpostazioni } from '../model/impostazioni.js';
import { LUNGHEZZA_MASSIMA_NOME, ZOOM_MASSIMO, normalizzaProfilo } from '../model/aspetto.js';

const LATO_ANTEPRIMA = 280; // pixel CSS del riquadro di ritaglio

/** @returns {Promise<{profilo: object}|undefined>} */
export function apriEditorProfilo() {
  const bozza = { ...impostazioni().profilo };
  let ritaglioScelto = null; // { immagine, zoom, cx, cy } mentre si sceglie il ritaglio
  let errore = '';
  let radice = null;
  let pannello = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Il tuo profilo',
    riempi(el, c) {
      radice = el;
      pannello = c;
      el.addEventListener('click', suTocco);
      disegna();
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function disegna() {
    if (ritaglioScelto) disegnaRitaglioScelto();
    else disegnaProfilo();
  }

  function disegnaProfilo() {
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Il tuo profilo</h2>
        </header>
        <form class="flusso-corpo" autocomplete="off" novalidate>
          <div class="pr-foto">
            ${htmlAvatar(bozza, 120)}
            <div class="pr-foto-azioni">
              <label class="chip">${icona('image-plus', 18)} ${bozza.foto ? 'Cambia foto' : 'Scegli una foto'}
                <input type="file" accept="image/*" class="solo-sr" data-r="file">
              </label>
              ${bozza.foto ? `<button type="button" class="chip" data-az="togli-foto">${icona('trash-2', 18)} Togli</button>` : ''}
            </div>
          </div>
          <div class="campo">
            <label for="pr-nome">Il tuo nome</label>
            <input id="pr-nome" class="campo-testo" type="text" maxlength="${LUNGHEZZA_MASSIMA_NOME}" enterkeyhint="done"
                   placeholder="Come ti chiami?" value="${esc(bozza.nome)}">
          </div>
          <p class="flusso-guida">Nome e foto restano su questo telefono (e nel tuo backup): non vengono inviati a nessuno.</p>
          <p class="flusso-errore" role="alert" ${errore ? '' : 'hidden'}>${esc(errore)}</p>
        </form>
        <div class="flusso-piede"><button type="button" class="pulsante pulsante-grande" data-az="salva">Salva</button></div>
      </div>`;

    const campoNome = radice.querySelector('#pr-nome');
    campoNome.addEventListener('input', () => { bozza.nome = campoNome.value; });
    radice.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); salva(); });
    radice.querySelector('[data-r="file"]').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // permette di scegliere di nuovo lo stesso file
      if (!file) return;
      try {
        const immagine = await apriImmagine(file);
        ritaglioScelto = { immagine, zoom: 1, cx: immagine.width / 2, cy: immagine.height / 2 };
        errore = '';
      } catch (errorePrevisto) {
        if (!(errorePrevisto instanceof ErroreImmagine)) console.error(errorePrevisto);
        errore = errorePrevisto instanceof ErroreImmagine ? errorePrevisto.message : 'Non sono riuscito a leggere la foto. Riprova.';
      }
      disegna();
    });
  }

  function disegnaRitaglioScelto() {
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="annulla-ritaglio" aria-label="Annulla">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Ritaglia la foto</h2>
        </header>
        <div class="flusso-corpo">
          <p class="flusso-guida">Trascina la foto per spostarla e usa il cursore per ingrandirla.</p>
          <div class="pr-ritaglio" style="--lato:${LATO_ANTEPRIMA}px">
            <canvas width="${LATO_ANTEPRIMA * 2}" height="${LATO_ANTEPRIMA * 2}" data-r="tela" role="img" aria-label="Anteprima del ritaglio"></canvas>
            <span class="pr-maschera" aria-hidden="true"></span>
          </div>
          <div class="campo">
            <label for="pr-zoom">Ingrandimento</label>
            <input id="pr-zoom" type="range" min="1" max="${ZOOM_MASSIMO}" step="0.01" value="${ritaglioScelto.zoom}" class="pr-zoom">
          </div>
        </div>
        <div class="flusso-piede"><button type="button" class="pulsante pulsante-grande" data-az="usa-ritaglio">Usa questa foto</button></div>
      </div>`;

    const tela = radice.querySelector('[data-r="tela"]');
    let riquadro = disegnaRitaglio(tela, ritaglioScelto.immagine, ritaglioScelto);

    radice.querySelector('#pr-zoom').addEventListener('input', (e) => {
      ritaglioScelto.zoom = Number(e.target.value);
      riquadro = disegnaRitaglio(tela, ritaglioScelto.immagine, ritaglioScelto);
    });

    // Trascinamento: il dito sposta la foto, quindi il centro del ritaglio va nel verso opposto.
    let ultimo = null;
    tela.addEventListener('pointerdown', (e) => { ultimo = { x: e.clientX, y: e.clientY }; tela.setPointerCapture(e.pointerId); });
    tela.addEventListener('pointermove', (e) => {
      if (!ultimo) return;
      const fattore = riquadro.lato / LATO_ANTEPRIMA; // pixel dell'originale per pixel dello schermo
      ritaglioScelto.cx -= (e.clientX - ultimo.x) * fattore;
      ritaglioScelto.cy -= (e.clientY - ultimo.y) * fattore;
      ultimo = { x: e.clientX, y: e.clientY };
      riquadro = disegnaRitaglio(tela, ritaglioScelto.immagine, ritaglioScelto);
      ritaglioScelto.cx = riquadro.x + riquadro.lato / 2; // il centro resta dentro l'immagine
      ritaglioScelto.cy = riquadro.y + riquadro.lato / 2;
    });
    const rilascia = () => { ultimo = null; };
    tela.addEventListener('pointerup', rilascia);
    tela.addEventListener('pointercancel', rilascia);
  }

  function suTocco(e) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    if (az === 'chiudi') pannello.chiudi(undefined);
    else if (az === 'togli-foto') { bozza.foto = null; disegna(); }
    else if (az === 'salva') salva();
    else if (az === 'annulla-ritaglio') { ritaglioScelto = null; disegna(); }
    else if (az === 'usa-ritaglio') {
      bozza.foto = ritaglia(ritaglioScelto.immagine, ritaglioScelto);
      ritaglioScelto = null;
      disegna();
    }
  }

  async function salva() {
    try {
      const profilo = normalizzaProfilo(bozza);
      await salvaImpostazioni({ profilo });
      mostraToast('Profilo salvato');
      pannello.chiudi({ profilo });
    } catch (e) {
      console.error(e);
      errore = 'Non sono riuscito a salvare. Riprova.';
      disegna();
    }
  }
}
