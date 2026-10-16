// Schermata di blocco: copre tutta l'app (anche i pannelli aperti, che restano com'erano) finché non si
// inserisce il PIN o si conferma l'impronta. Si attiva all'apertura dell'app e quando si torna da lontano.

import { icona } from '../util/icone.js';
import { esc } from '../util/dom.js';
import { marchioHtml } from '../util/marchio.js';
import { FRASE } from '../versione.js';
import { creaTastierinoPin } from './tastierino-pin.js';
import { sicurezza, serveBlocco, segnaSbloccato, segnaBloccato, segnaNascosta, azzeraNascosta, leggiTentativi, salvaTentativi, azzeraTentativi } from '../model/blocco.js';
import { verificaPin, registraErrore, attesaRimasta } from '../model/sicurezza.js';
import { verificaImpronta } from '../model/impronta.js';
import { cancellaTuttiIDati } from '../model/azzera.js';

let elemento = null; // la schermata, finché è visibile

const radice = document.documentElement;
const rimuoviCopertura = () => { delete radice.dataset.copri; delete radice.dataset.bloccato; };

/**
 * Da chiamare una volta all'avvio: gestisce l'app che va in background e ritorna.
 *
 * Android scatta la miniatura delle app recenti subito all'inizio del gesto, spesso PRIMA che la pagina risulti
 * "nascosta": per questo si copre al primo segnale (perdita del focus, uscita dalla pagina) e si scopre solo
 * quando l'app torna in primo piano. Una pagina web non può impedire la miniatura come fa un'app nativa:
 * è un tentativo che dipende dalla velocità del telefono.
 */
export function inizializzaBlocco() {
  const copri = () => { if (sicurezza().attiva) radice.dataset.copri = '1'; };

  /** L'app è di nuovo in primo piano: serve lo sblocco, oppure si toglie la copertura. */
  const alRitorno = ({ riprovaImpronta = false } = {}) => {
    if (!sicurezza().attiva) return;
    if (elemento) { if (riprovaImpronta) mostraBlocco(); return; } // già bloccata: nulla da fare
    if (serveBlocco()) { mostraBlocco(); return; }
    azzeraNascosta(); // un ritorno rapido non deve far scattare un blocco più tardi
    rimuoviCopertura();
  };

  window.addEventListener('blur', copri);
  window.addEventListener('pagehide', copri);
  document.addEventListener('visibilitychange', () => {
    if (!sicurezza().attiva) return;
    if (document.visibilityState === 'hidden') { segnaNascosta(); copri(); } else alRitorno({ riprovaImpronta: true });
  });
  window.addEventListener('focus', () => { if (document.visibilityState === 'visible') alRitorno(); });
  window.addEventListener('pageshow', () => alRitorno());
  // Rete di sicurezza: se per qualche motivo la copertura resta, il primo tocco la toglie (o mostra il blocco).
  window.addEventListener('pointerdown', () => { if (radice.dataset.copri) alRitorno(); }, true);
}

/** All'avvio: se serve, mostra il blocco; altrimenti toglie la copertura messa da index.html. */
export function controllaBlocco() {
  if (serveBlocco()) mostraBlocco();
  else if (!elemento) rimuoviCopertura();
}

/** Blocca subito (voce "Blocca ora" in Sicurezza). */
export function bloccaOra() {
  segnaBloccato();
  mostraBlocco();
}

function mostraBlocco() {
  if (elemento) { elemento.querySelector('[data-az="impronta"]')?.click(); return; } // già visibile: riprova l'impronta
  const { pin, impronta } = sicurezza();
  radice.dataset.bloccato = '1';

  elemento = document.createElement('div');
  elemento.id = 'blocco';
  elemento.className = 'blocco';
  elemento.setAttribute('role', 'dialog');
  elemento.setAttribute('aria-modal', 'true');
  elemento.setAttribute('aria-label', 'App bloccata');
  elemento.innerHTML = `
    <div class="blocco-testa">
      <span class="cerchio col-indaco" style="--dim:64px">${icona('lock', 30)}</span>
      <h1>${marchioHtml()}</h1>
      <p class="blocco-stato" role="status" data-r="stato">Inserisci il PIN</p>
    </div>
    <div class="blocco-pin" data-r="pin"></div>
    <div class="blocco-conferma" data-r="conferma" hidden>
      <h2>Cancellare tutti i dati?</h2>
      <p>Se hai dimenticato il PIN, l'unico modo per rientrare è cancellare tutti i dati di questa app su questo telefono e poi ripristinarli da un backup cifrato (Altro → Backup → Ripristina). Senza un backup i dati andranno persi.</p>
      <div class="dialogo-azioni">
        <button type="button" class="pulsante pulsante-secondario" data-az="annulla-reset">Annulla</button>
        <button type="button" class="pulsante pulsante-pericolo" data-az="conferma-reset">Cancella tutto</button>
      </div>
    </div>
    <figure class="blocco-frase" data-r="frase">
      <blockquote><q>${esc(FRASE.testo)}</q></blockquote>
      <figcaption><cite>${esc(FRASE.autore)}</cite></figcaption>
    </figure>
    <div class="blocco-azioni">
      ${impronta ? `<button type="button" class="pulsante pulsante-secondario" data-az="impronta">${icona('fingerprint-pattern', 20)} Usa l'impronta</button>` : ''}
      <button type="button" class="blocco-link" data-az="dimenticato">Ho dimenticato il PIN</button>
    </div>`;
  document.body.append(elemento);

  const stato = elemento.querySelector('[data-r="stato"]');
  let timerAttesa = null;

  const tastierino = creaTastierinoPin(elemento.querySelector('[data-r="pin"]'), {
    lunghezza: pin?.lunghezza ?? 4,
    alCompleto: async (digitato) => {
      if (await verificaPin(digitato, pin)) { sblocca(); return; }
      salvaTentativi(registraErrore(leggiTentativi(), Date.now()));
      tastierino.scuoti();
      tastierino.azzera();
      stato.textContent = 'PIN errato';
      controllaAttesa();
    },
  });

  /** Dopo troppi errori l'app fa aspettare: tastierino spento e conto alla rovescia. */
  function controllaAttesa() {
    clearInterval(timerAttesa);
    const attesa = attesaRimasta(leggiTentativi(), Date.now());
    tastierino.abilita(!attesa.bloccato);
    if (!attesa.bloccato) return;
    const aggiorna = () => {
      const resto = attesaRimasta(leggiTentativi(), Date.now());
      if (!resto.bloccato) { clearInterval(timerAttesa); tastierino.abilita(true); stato.textContent = 'Inserisci il PIN'; return; }
      stato.textContent = `Troppi tentativi. Riprova tra ${resto.secondi} s`;
    };
    aggiorna();
    timerAttesa = setInterval(aggiorna, 1000);
  }

  function sblocca() {
    clearInterval(timerAttesa);
    tastierino.distruggi();
    azzeraTentativi();
    segnaSbloccato();
    elemento.remove();
    elemento = null;
    rimuoviCopertura();
  }

  async function provaImpronta() {
    if (!impronta || !elemento) return;
    if (attesaRimasta(leggiTentativi(), Date.now()).bloccato) return;
    if (await verificaImpronta(impronta.id)) sblocca();
  }

  elemento.addEventListener('click', async (e) => {
    const az = e.target.closest('[data-az]')?.dataset.az;
    if (az === 'impronta') provaImpronta();
    else if (az === 'dimenticato') mostraConferma(true);
    else if (az === 'annulla-reset') mostraConferma(false);
    else if (az === 'conferma-reset') await cancellaTuttiIDati();
  });

  /** La conferma sta DENTRO il blocco: i pannelli normali sarebbero coperti dalla schermata di blocco. */
  function mostraConferma(si) {
    elemento.querySelector('[data-r="conferma"]').hidden = !si;
    elemento.querySelector('.blocco-testa').hidden = si;
    elemento.querySelector('[data-r="pin"]').hidden = si;
    elemento.querySelector('[data-r="frase"]').hidden = si;
    elemento.querySelector('.blocco-azioni').hidden = si;
  }

  controllaAttesa();
  if (!attesaRimasta(leggiTentativi(), Date.now()).bloccato) provaImpronta(); // propone subito l'impronta, se c'è
}
