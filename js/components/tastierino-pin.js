// Tastierino per il PIN: pallini + tasti numerici. Due modi:
//  - lunghezza fissa (sblocco): quando le cifre raggiungono la lunghezza del PIN si chiama `alCompleto`;
//  - lunghezza libera (scelta del PIN, da PIN_MIN a PIN_MAX cifre): il tasto "fatto" chiama `alCompleto`.

import { icona } from '../util/icone.js';
import { vibra, animaClasse } from '../util/dom.js';
import { PIN_MIN, PIN_MAX } from '../model/sicurezza.js';

/**
 * @param {HTMLElement} contenitore
 * @param {{lunghezza?: number|null, alCompleto: (pin: string) => void}} opzioni
 * @returns {{azzera(): void, scuoti(): void, abilita(si: boolean): void, distruggi(): void}}
 */
export function creaTastierinoPin(contenitore, { lunghezza = null, alCompleto }) {
  let pin = '';
  let abilitato = true;
  const massimo = lunghezza ?? PIN_MAX;
  const numeroPunti = lunghezza ?? PIN_MAX;

  const tasti = ['1', '2', '3', '4', '5', '6', '7', '8', '9', lunghezza ? 'vuoto' : 'fatto', '0', 'cancella'];
  contenitore.classList.add('pin');
  contenitore.innerHTML = `
    <div class="pin-punti" role="img" aria-label="PIN" data-r="punti">
      ${Array.from({ length: numeroPunti }, () => '<span class="pin-punto"></span>').join('')}
    </div>
    <div class="tastierino pin-tasti">
      ${tasti.map((t) => {
        if (t === 'vuoto') return '<span aria-hidden="true"></span>';
        if (t === 'cancella') return `<button type="button" class="tasto tasto-azione" data-tasto="cancella" aria-label="Cancella l'ultima cifra">${icona('delete', 24)}</button>`;
        if (t === 'fatto') return `<button type="button" class="tasto tasto-azione" data-tasto="fatto" aria-label="Conferma il PIN">${icona('check', 26)}</button>`;
        return `<button type="button" class="tasto" data-tasto="${t}">${t}</button>`;
      }).join('')}
    </div>`;
  const punti = [...contenitore.querySelectorAll('.pin-punto')];

  function disegna() {
    punti.forEach((p, i) => p.classList.toggle('pieno', i < pin.length));
    const fatto = contenitore.querySelector('[data-tasto="fatto"]');
    if (fatto) fatto.disabled = pin.length < PIN_MIN;
  }

  function tasto(t) {
    if (!abilitato) return;
    if (t === 'cancella') pin = pin.slice(0, -1);
    else if (t === 'fatto') { if (pin.length >= PIN_MIN) alCompleto(pin); return; }
    else if (/^\d$/.test(t) && pin.length < massimo) pin += t;
    else return;
    vibra(8);
    disegna();
    if (lunghezza && pin.length === lunghezza) alCompleto(pin);
  }

  contenitore.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tasto]')?.dataset.tasto;
    if (t) tasto(t);
  });

  // Tastiera fisica (utile sul computer)
  const suTasto = (e) => {
    if (/^\d$/.test(e.key)) tasto(e.key);
    else if (e.key === 'Backspace') tasto('cancella');
    else if (e.key === 'Enter') tasto('fatto');
  };
  document.addEventListener('keydown', suTasto);

  disegna();
  return {
    azzera() { pin = ''; disegna(); },
    scuoti() { animaClasse(contenitore.querySelector('[data-r="punti"]'), 'scuoti'); vibra(40); },
    abilita(si) { abilitato = si; contenitore.classList.toggle('pin-spento', !si); },
    distruggi() { document.removeEventListener('keydown', suTasto); },
  };
}
