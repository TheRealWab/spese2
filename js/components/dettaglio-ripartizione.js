// Foglio "cosa c'è dentro questo gruppo": si apre toccando una voce della barra del Patrimonio (Alto rischio,
// Basso rischio, Da classificare, Liquidità) ed elenca i conti raccolti per etichetta, con i totali.
// Rispetta l'occhio che nasconde gli importi. Un tocco su un conto lo apre.

import { apriPannello } from './pannello.js';
import { apriDettaglioConto } from './dettaglio-conto.js';
import { apriEditorConto } from './editor-conto.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { percentuale } from '../util/formato.js';
import { oggiIso } from '../util/date.js';
import { mostraImporto } from '../util/importi-privati.js';
import { tutti } from '../db.js';
import { tuttiIConti } from '../model/conti.js';
import { creaStorie, dettaglioGruppo, ripartizionePatrimonio, NOME_GRUPPO } from '../model/patrimonio.js';

const SPIEGAZIONE = {
  alto: 'Investimenti che possono salire e scendere molto.',
  basso: 'Investimenti più stabili.',
  'da-classificare': 'Per questi conti non hai ancora scelto il rischio: tocca un conto per farlo.',
  liquidita: 'Conti, contanti e tutto ciò che non è investito.',
};

/** @param {{gruppo: 'alto'|'basso'|'da-classificare'|'liquidita'}} opzioni */
export function apriDettaglioRipartizione({ gruppo }) {
  let radice = null;
  let aperto = true;

  const ctrl = apriPannello({
    tipo: 'sheet',
    etichetta: NOME_GRUPPO[gruppo],
    riempi(el, c) {
      radice = el;
      el.innerHTML = `<h2 class="foglio-titolo">${NOME_GRUPPO[gruppo]}</h2><div class="foglio-corpo" data-r="corpo"></div>`;
      el.addEventListener('click', (e) => {
        const contoId = e.target.closest('[data-conto]')?.dataset.conto;
        if (!contoId) return;
        c.chiudi(undefined);
        // Un conto da classificare si apre direttamente in modifica: è lì che si sceglie il rischio.
        if (gruppo === 'da-classificare') apriEditorConto({ contoId }); else apriDettaglioConto({ contoId });
      });
      carica();
    },
  });
  ctrl.chiuso.then(() => { aperto = false; });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  async function carica() {
    const [conti, movimenti, valori] = await Promise.all([tuttiIConti(), tutti('movimenti'), tutti('valoriInvestimento')]);
    if (!aperto) return;
    const oggi = oggiIso();
    const storie = creaStorie(conti, movimenti, valori);
    const voci = dettaglioGruppo(storie, oggi, gruppo);
    const quota = ripartizionePatrimonio(storie, oggi)?.voci.find((v) => v.gruppo === gruppo);
    const totale = voci.reduce((s, v) => s + v.importo, 0);

    const rigaConto = ({ conto, saldo }) => `
      <button type="button" class="riga-lista" data-conto="${esc(conto.id)}">
        ${cerchioIcona(conto.icona, conto.colore, 40)}
        <span class="riga-testo"><span class="riga-titolo">${esc(conto.nome)}</span></span>
        <span class="pt-saldo ${saldo < 0 ? 'pt-giu' : ''}">${esc(mostraImporto(saldo))}</span>
      </button>`;
    // Con una sola voce senza etichetta (la liquidità, o investimenti mai etichettati) l'intestazione non serve.
    const conIntestazioni = voci.length > 1 || (voci[0]?.etichetta ?? '') !== '';
    const gruppoEtichetta = (v) => `
      <section class="gruppo">
        ${conIntestazioni ? `<h3 class="gruppo-titolo rip-etichetta"><span>${esc(v.etichetta || 'Senza etichetta')}</span><span>${esc(mostraImporto(v.importo))}${totale > 0 ? ` · ${percentuale((v.importo / totale) * 100)}` : ''}</span></h3>` : ''}
        <div class="scheda">${v.conti.map(rigaConto).join('')}</div>
      </section>`;

    radice.querySelector('[data-r="corpo"]').innerHTML = `
      <div class="rip-testa">
        <span class="pt-rip-punto pt-seg-${gruppo}"></span>
        <p class="rip-totale">${esc(mostraImporto(totale))}${quota ? ` <span class="riga-sotto">· ${quota.percentuale}% del patrimonio</span>` : ''}</p>
      </div>
      <p class="riga-sotto">${SPIEGAZIONE[gruppo]}</p>
      ${voci.length ? voci.map(gruppoEtichetta).join('') : `<p class="nota-fondo">${icona('info', 14)} Nessun conto in questo gruppo.</p>`}`;
  }
}
