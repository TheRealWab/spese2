// Schermata Altro → Sicurezza (SPEC §9.1): attiva e gestisce il blocco con PIN e impronta.
// Ogni "fase" disegna una schermata; il PIN si scrive sempre con il tastierino in fondo.

import { apriPannello } from './pannello.js';
import { mostraToast } from './toast.js';
import { creaTastierinoPin } from './tastierino-pin.js';
import { bloccaOra } from './blocco.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { oggiIso } from '../util/date.js';
import { impostazioni } from '../model/impostazioni.js';
import { statoUltimoBackup, descriviUltimoBackup } from '../model/backup.js';
import { sicurezza, salvaSicurezza, segnaSbloccato, leggiTentativi, salvaTentativi, azzeraTentativi } from '../model/blocco.js';
import {
  MINUTI_BLOCCO, PIN_MIN, PIN_MAX, validaPin, creaVerificaPin, verificaPin, registraErrore, attesaRimasta,
} from '../model/sicurezza.js';
import { improntaDisponibile, registraImpronta } from '../model/impronta.js';

const NOTA_ONESTA = 'L\'impronta e il PIN proteggono l\'accesso all\'app, ma i dati nel browser non sono cifrati da essi. La protezione completa viene dall\'insieme di blocco del telefono, impronta sull\'app e backup cifrato.';

export function apriSicurezza() {
  const stato = { fase: 'principale', scopo: null, pinTemp: '', errore: '', improntaDisponibile: false };
  let radice = null;
  let tastierino = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Sicurezza',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      improntaDisponibile().then((si) => { stato.improntaDisponibile = si; if (stato.fase === 'principale') disegna(); });
      disegna();
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function disegna() {
    tastierino?.distruggi();
    tastierino = null;
    const corpo = {
      principale: corpoPrincipale,
      'pin-nuovo': () => corpoPin('Scegli un PIN', `Da ${PIN_MIN} a ${PIN_MAX} cifre. Servirà quando l'impronta non è disponibile.`),
      'pin-conferma': () => corpoPin('Ripeti il PIN', 'Scrivilo di nuovo per conferma.'),
      'pin-verifica': () => corpoPin('Inserisci il PIN attuale', 'Serve per confermare la modifica.'),
      impronta: corpoImpronta,
      attesa: corpoAttesa,
    }[stato.fase]();
    const puoTornare = stato.fase !== 'principale' && stato.fase !== 'attesa';
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="${puoTornare ? 'indietro' : 'chiudi'}" aria-label="${puoTornare ? 'Indietro' : 'Chiudi'}">${icona(puoTornare ? 'chevron-left' : 'x', 24)}</button>
          <h2 class="flusso-titolo">Sicurezza</h2>
        </header>
        <div class="flusso-corpo">${corpo.html}</div>
        <footer class="flusso-piede">${corpo.piede}</footer>
      </div>`;
    if (corpo.pin) montaPin();
  }

  function errore() {
    return stato.errore ? `<p class="flusso-errore" role="alert">${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>` : '';
  }

  // ---- Schermata principale ----

  function corpoPrincipale() {
    const s = sicurezza();
    if (!s.attiva) {
      const backup = statoUltimoBackup(impostazioni().ultimoBackup, oggiIso());
      return {
        html: `
          <section class="scheda flusso-intro">
            <span class="cerchio col-indaco" style="--dim:56px">${icona('shield-check', 28)}</span>
            <h3>Blocca l'app</h3>
            <p>All'apertura e quando torni dopo un po' di tempo, l'app chiede l'impronta o il PIN.</p>
          </section>
          <p class="flusso-nota flusso-nota-avviso">${icona('triangle-alert', 18)}<span>${esc(NOTA_ONESTA)}</span></p>
          <p class="flusso-nota ${backup.daFare ? 'flusso-nota-avviso' : ''}">${icona(backup.daFare ? 'triangle-alert' : 'circle-check', 18)}<span>Se dimentichi il PIN, l'unico modo per rientrare è cancellare i dati dell'app e ripristinarli da un backup cifrato. ${backup.daFare ? 'Non hai un backup recente: fallo prima di attivare il blocco (Altro → Backup).' : `${esc(descriviUltimoBackup(backup))}.`}</span></p>
          ${errore()}`,
        piede: '<button type="button" class="pulsante pulsante-grande" data-az="attiva">Attiva il blocco</button>',
      };
    }
    const impronta = s.impronta
      ? `<button type="button" class="chip" data-az="impronta-spegni">Disattiva</button>`
      : (stato.improntaDisponibile ? `<button type="button" class="chip chip-attivo" data-az="impronta-accendi">Attiva</button>` : '');
    return {
      html: `
        <div class="scheda">
          <div class="riga-lista">
            <span class="cerchio col-verde" style="--dim:40px">${icona('shield-check', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Blocco attivo</span><span class="riga-sotto">${s.impronta ? 'PIN e impronta' : 'Solo PIN'}</span></span>
          </div>
          <div class="riga-lista">
            <span class="cerchio cerchio-neutro">${icona('fingerprint-pattern', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Impronta digitale</span><span class="riga-sotto">${s.impronta ? 'Attiva' : (stato.improntaDisponibile ? 'Non attiva' : 'Non disponibile su questo telefono')}</span></span>
            ${impronta}
          </div>
          <button type="button" class="riga-lista" data-az="cambia-pin">
            <span class="cerchio cerchio-neutro">${icona('pencil', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Cambia PIN</span></span>${icona('chevron-right', 18)}
          </button>
          <div class="riga-lista riga-colonna">
            <span class="riga-titolo">Blocca dopo</span>
            <div class="segmentato" role="group" aria-label="Blocca dopo">
              ${MINUTI_BLOCCO.map((m) => `<button type="button" data-minuti="${m}" aria-pressed="${m === s.minuti}">${m} ${m === 1 ? 'minuto' : 'minuti'}</button>`).join('')}
            </div>
            <span class="riga-sotto">Quando l'app resta in background più di così, al ritorno chiede lo sblocco.</span>
          </div>
          <button type="button" class="riga-lista" data-az="blocca-ora">
            <span class="cerchio cerchio-neutro">${icona('lock', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Blocca ora</span></span>${icona('chevron-right', 18)}
          </button>
        </div>
        <p class="flusso-nota flusso-nota-avviso">${icona('triangle-alert', 18)}<span>${esc(NOTA_ONESTA)}</span></p>
        ${errore()}`,
      piede: '<button type="button" class="pulsante pulsante-grande pulsante-pericolo" data-az="disattiva">Disattiva il blocco</button>',
    };
  }

  // ---- PIN ----

  function corpoPin(titolo, sotto) {
    return {
      html: `<div class="sic-pin-testa"><h3>${esc(titolo)}</h3><p>${esc(sotto)}</p></div>${errore()}`,
      piede: '<div data-r="pin"></div>',
      pin: true,
    };
  }

  function montaPin() {
    const verifica = stato.fase === 'pin-verifica';
    tastierino = creaTastierinoPin(radice.querySelector('[data-r="pin"]'), {
      lunghezza: verifica ? sicurezza().pin?.lunghezza ?? null : null,
      alCompleto: (pin) => suPin(pin),
    });
  }

  async function suPin(pin) {
    if (stato.fase === 'pin-nuovo') {
      const problema = validaPin(pin);
      stato.errore = problema ?? '';
      if (problema) { disegna(); return; }
      stato.pinTemp = pin;
      stato.fase = 'pin-conferma';
      disegna();
    } else if (stato.fase === 'pin-conferma') {
      if (pin !== stato.pinTemp) { stato.errore = 'I due PIN non coincidono. Riprova.'; stato.pinTemp = ''; stato.fase = 'pin-nuovo'; disegna(); return; }
      await salvaPin(pin);
    } else if (stato.fase === 'pin-verifica') {
      await controllaPinAttuale(pin);
    }
  }

  async function salvaPin(pin) {
    stato.fase = 'attesa';
    stato.errore = '';
    disegna();
    try {
      const verifica = await creaVerificaPin(pin);
      if (stato.scopo === 'cambia') {
        await salvaSicurezza({ pin: verifica });
        mostraToast('PIN cambiato');
        stato.fase = 'principale';
      } else {
        await salvaSicurezza({ attiva: true, pin: verifica, impronta: null, minuti: 1 });
        segnaSbloccato(); // lo abbiamo appena scelto: non serve chiederlo subito
        azzeraTentativi();
        stato.fase = stato.improntaDisponibile ? 'impronta' : 'principale';
        if (stato.fase === 'principale') mostraToast('Blocco attivato');
      }
    } catch (e) {
      console.error(e);
      stato.errore = 'Non sono riuscito a salvare il PIN. Riprova.';
      stato.fase = 'pin-nuovo';
    }
    stato.pinTemp = '';
    disegna();
  }

  async function controllaPinAttuale(pin) {
    const attesa = attesaRimasta(leggiTentativi(), Date.now());
    if (attesa.bloccato) {
      stato.errore = `Troppi tentativi. Riprova tra ${attesa.secondi} s.`;
      tastierino.scuoti();
      tastierino.azzera();
      disegna();
      return;
    }
    if (!await verificaPin(pin, sicurezza().pin)) {
      salvaTentativi(registraErrore(leggiTentativi(), Date.now()));
      tastierino.scuoti();
      tastierino.azzera();
      const resto = attesaRimasta(leggiTentativi(), Date.now());
      stato.errore = resto.bloccato ? `Troppi tentativi. Riprova tra ${resto.secondi} s.` : 'PIN errato.';
      radice.querySelector('.flusso-errore')?.remove();
      radice.querySelector('.flusso-corpo').insertAdjacentHTML('beforeend', errore());
      return;
    }
    azzeraTentativi();
    stato.errore = '';
    if (stato.scopo === 'cambia') {
      stato.fase = 'pin-nuovo';
    } else {
      await salvaSicurezza({ attiva: false, pin: null, impronta: null });
      mostraToast('Blocco disattivato');
      stato.fase = 'principale';
    }
    disegna();
  }

  // ---- Impronta ----

  function corpoImpronta() {
    return {
      html: `
        <section class="scheda flusso-intro">
          <span class="cerchio col-indaco" style="--dim:56px">${icona('fingerprint-pattern', 28)}</span>
          <h3>Vuoi usare anche l'impronta?</h3>
          <p>Potrai sbloccare l'app con l'impronta del telefono. Il PIN resta sempre disponibile come riserva.</p>
        </section>
        ${errore()}`,
      piede: `
        <div class="sic-azioni">
          <button type="button" class="pulsante pulsante-grande" data-az="impronta-registra">Attiva l'impronta</button>
          <button type="button" class="pulsante pulsante-grande pulsante-secondario" data-az="impronta-salta">Non ora</button>
        </div>`,
    };
  }

  async function attivaImpronta() {
    try {
      const id = await registraImpronta();
      await salvaSicurezza({ impronta: { id } });
      mostraToast('Impronta attivata');
      stato.errore = '';
      stato.fase = 'principale';
    } catch (e) {
      console.warn('Impronta non attivata:', e);
      stato.errore = 'Non sono riuscito ad attivare l\'impronta. Controlla che sul telefono ci sia un\'impronta registrata e riprova.';
    }
    disegna();
  }

  function corpoAttesa() {
    return {
      html: `<div class="stato-vuoto flusso-attesa" role="status">${icona('refresh-cw', 32)}<h2>Salvo il PIN…</h2></div>`,
      piede: '',
    };
  }

  // ---- Tocchi ----

  async function suTocco(e, c) {
    const voce = e.target.closest('[data-az], [data-minuti]');
    if (!voce) return;
    const az = voce.dataset.az;
    if (voce.dataset.minuti) {
      await salvaSicurezza({ minuti: Number(voce.dataset.minuti) });
      disegna();
    } else if (az === 'chiudi') {
      c.chiudi(undefined);
    } else if (az === 'indietro') {
      stato.fase = 'principale'; stato.errore = ''; stato.pinTemp = ''; disegna();
    } else if (az === 'attiva') {
      stato.scopo = 'attiva'; stato.fase = 'pin-nuovo'; stato.errore = ''; disegna();
    } else if (az === 'cambia-pin') {
      stato.scopo = 'cambia'; stato.fase = 'pin-verifica'; stato.errore = ''; disegna();
    } else if (az === 'disattiva') {
      stato.scopo = 'disattiva'; stato.fase = 'pin-verifica'; stato.errore = ''; disegna();
    } else if (az === 'impronta-accendi' || az === 'impronta-registra') {
      await attivaImpronta();
    } else if (az === 'impronta-spegni') {
      await salvaSicurezza({ impronta: null });
      mostraToast('Impronta disattivata');
      disegna();
    } else if (az === 'impronta-salta') {
      mostraToast('Blocco attivato');
      stato.fase = 'principale'; stato.errore = ''; disegna();
    } else if (az === 'blocca-ora') {
      c.chiudi(undefined);
      bloccaOra();
    }
  }
}
