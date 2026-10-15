// Scelta dell'icona di una categoria, con ricerca per parola (italiano o inglese): "gatto", "caffè", "auto"…
// Risolve con il nome dell'icona scelta, oppure undefined se si chiude senza scegliere.

import { apriPannello } from './pannello.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { ICONE } from '../../vendor/lucide/icone.js';
import { cercaIcone } from '../model/ricerca-icone.js';
import { ICONE_SUGGERITE } from '../model/parole-icone.js';

const MAX_RISULTATI = 120;
const NOMI = Object.keys(ICONE);

/**
 * @param {{colore: string, selezionata?: string}} opzioni  il colore serve solo a mostrare le icone come saranno
 */
export function scegliIcona({ colore, selezionata = null }) {
  let tag = null; // le parole chiave (160 KB) si caricano solo alla prima ricerca
  let attesa = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Scegli l\'icona',
    riempi(el, c) {
      el.innerHTML = `
        <div class="flusso col-${esc(colore)}">
          <header class="flusso-testata">
            <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
            <h2 class="flusso-titolo">Scegli l'icona</h2>
          </header>
          <div class="ic-ricerca">
            <label class="solo-sr" for="ic-campo">Cerca un'icona</label>
            <input id="ic-campo" class="campo-testo" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" spellcheck="false"
                   placeholder="Cerca: gatto, caffè, auto…">
          </div>
          <div class="flusso-corpo">
            <p class="flusso-guida" data-r="stato" role="status"></p>
            <div class="ic-griglia" data-r="griglia" role="listbox" aria-label="Icone"></div>
          </div>
        </div>`;
      const campo = el.querySelector('#ic-campo');
      const stato = el.querySelector('[data-r="stato"]');
      const griglia = el.querySelector('[data-r="griglia"]');

      function mostra(nomi, messaggio) {
        stato.textContent = messaggio;
        stato.hidden = !messaggio;
        griglia.innerHTML = nomi.map((nome) => `
          <button type="button" class="ic-voce ${nome === selezionata ? 'scelta' : ''}" role="option" aria-selected="${nome === selezionata}" data-icona="${esc(nome)}" aria-label="${esc(nome)}">
            ${icona(nome, 26)}
          </button>`).join('');
      }

      function suggerite() {
        mostra(ICONE_SUGGERITE, `Scrivi una parola per cercare tra ${NOMI.length.toLocaleString('it-IT')} icone (per esempio gatto, caffè, auto).`);
      }

      async function cerca() {
        const testo = campo.value.trim();
        if (!testo) { suggerite(); return; }
        attesa ??= import('../../vendor/lucide/tag.js').then((m) => { tag = m.TAG; });
        await attesa;
        if (campo.value.trim() !== testo) return; // nel frattempo si è scritto altro
        const trovate = cercaIcone(testo, NOMI, tag, MAX_RISULTATI);
        mostra(trovate, trovate.length ? '' : `Nessuna icona per «${testo}». Prova con un'altra parola, o in inglese.`);
      }

      let timer = null;
      campo.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(cerca, 120); });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-az="chiudi"]')) { c.chiudi(undefined); return; }
        const scelta = e.target.closest('[data-icona]')?.dataset.icona;
        if (scelta) c.chiudi(scelta);
      });
      suggerite();
    },
  });
  return ctrl.chiuso;
}
