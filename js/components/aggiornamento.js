// Avviso "è disponibile un aggiornamento": chiede all'utente se aggiornare ora o più tardi.
//
// Non usa apriPannello: un pannello aggiunge una voce alla cronologia con history.pushState, e Chrome su Android
// considera "saltabile" la voce precedente se il push avviene senza un tocco dell'utente (qui l'avviso compare da solo).
// Quindi è un semplice dialogo senza cronologia; il tasto indietro di Android non lo chiude.

import { esc, movimentoRidotto } from '../util/dom.js';

let aperto = false;

/** Mostra l'avviso. Risolve true se l'utente sceglie "Aggiorna", false per "Più tardi". */
export function chiediAggiornamento({ versione = '' } = {}) {
  if (aperto) return Promise.resolve(false);
  aperto = true;

  const sfondo = document.createElement('div');
  sfondo.className = 'pannello-sfondo pannello-dialogo avviso-app'; // niente "pannello-aperto": non è nella pila dei pannelli
  const titolo = 'Aggiornamento disponibile';
  const testo = versione
    ? `È pronta la versione ${versione} di Wallet. Vuoi aggiornare ora? I tuoi dati restano dove sono.`
    : 'È pronta una nuova versione di Wallet. Vuoi aggiornare ora? I tuoi dati restano dove sono.';
  sfondo.innerHTML = `
    <div class="pannello" role="alertdialog" aria-modal="true" aria-label="${esc(titolo)}" tabindex="-1">
      <div class="dialogo-corpo"><h2>${esc(titolo)}</h2><p>${esc(testo)}</p></div>
      <div class="dialogo-azioni">
        <button type="button" class="pulsante pulsante-secondario" data-esito="dopo">Più tardi</button>
        <button type="button" class="pulsante" data-esito="ora">Aggiorna</button>
      </div>
    </div>`;
  document.getElementById('strato-pannelli').append(sfondo);
  requestAnimationFrame(() => requestAnimationFrame(() => sfondo.classList.add('aperto')));
  sfondo.firstElementChild.focus({ preventScroll: true });

  return new Promise((risolvi) => {
    const chiudi = (esito) => {
      if (!aperto) return;
      aperto = false;
      sfondo.classList.remove('aperto');
      setTimeout(() => sfondo.remove(), movimentoRidotto() ? 0 : 280);
      risolvi(esito);
    };
    sfondo.addEventListener('click', (e) => {
      const esito = e.target.closest('[data-esito]')?.dataset.esito;
      if (esito) chiudi(esito === 'ora');
    });
    sfondo.addEventListener('pointerdown', (e) => { if (e.target === sfondo) chiudi(false); });
  });
}
