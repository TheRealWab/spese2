// Schermata "Crea un backup cifrato" (SPEC §9.2): password, cifratura e salvataggio del file.
// Dove il browser lo permette si sceglie cartella e nome del file, e si può sostituire il backup della volta
// prima (un solo file invece di tanti); altrimenti il file va nella cartella Download.

import { apriPannello } from './pannello.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { oggiIso } from '../util/date.js';
import { scaricaFile } from '../util/scarica.js';
import { LUNGHEZZA_MINIMA_PASSWORD, nomeFileBackup } from '../model/backup.js';
import { creaBackup, segnaBackupFatto } from '../model/backup-db.js';
import {
  sceltaFileDisponibile, leggiFileBackup, ricordaFileBackup, dimenticaFileBackup, scegliNuovoFile,
  permessoDiScrittura, scriviSuFile, condivisioneDisponibile,
} from '../model/file-backup.js';

const CHIAVE_MODO = 'spese2_backup_modo'; // "nuovo" | "sovrascrivi": si ricorda l'ultima scelta

const leggiModoPreferito = () => { try { return localStorage.getItem(CHIAVE_MODO) === 'sovrascrivi' ? 'sovrascrivi' : 'nuovo'; } catch { return 'nuovo'; } };
const salvaModoPreferito = (modo) => { try { localStorage.setItem(CHIAVE_MODO, modo); } catch { /* facoltativo */ } };

export function apriEsportaBackup() {
  const stato = {
    fase: 'form', errore: '', mostra: false,
    scelta: sceltaFileDisponibile(), // il browser sa far scegliere dove salvare?
    precedente: null, // il file scelto la volta prima, se c'è ancora
    modo: 'nuovo', // "nuovo" | "sovrascrivi"
    esito: null, // { tipo: "file" | "download", nome, sostituito, condivisibile }
  };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Crea un backup cifrato',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('submit', (e) => { e.preventDefault(); crea(); });
      disegna();
      if (stato.scelta) {
        leggiFileBackup().then((handle) => {
          if (!handle || !radice?.isConnected || stato.fase !== 'form') return;
          stato.precedente = handle;
          stato.modo = leggiModoPreferito();
          conservandoICampi(disegna);
        });
      }
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  /** Ridisegna senza perdere le password già scritte. */
  function conservandoICampi(azione) {
    const valori = [radice.querySelector('#pwd1')?.value ?? '', radice.querySelector('#pwd2')?.value ?? ''];
    azione();
    const [p1, p2] = [radice.querySelector('#pwd1'), radice.querySelector('#pwd2')];
    if (p1) p1.value = valori[0];
    if (p2) p2.value = valori[1];
  }

  function disegna() {
    const corpo = { form: corpoForm, attesa: corpoAttesa, fatto: corpoFatto }[stato.fase]();
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Backup cifrato</h2>
        </header>
        <div class="flusso-corpo">${corpo.html}</div>
        <footer class="flusso-piede">${corpo.piede}</footer>
      </div>`;
  }

  function htmlDoveSalvare() {
    if (!stato.scelta) {
      return `<p class="flusso-nota">${icona('info', 18)}<span>Su questo browser il file viene salvato nella cartella Download. Dopo il salvataggio potrai condividerlo o spostarlo dove vuoi.</span></p>`;
    }
    const opzione = (modo, titolo, sotto) => `
      <button type="button" class="opzione" role="radio" aria-checked="${stato.modo === modo}" data-modo="${modo}">
        <span class="opzione-testo">${titolo}<br><span class="riga-sotto">${sotto}</span></span>
        ${stato.modo === modo ? `<span class="opzione-spunta">${icona('check', 22)}</span>` : ''}
      </button>`;
    return `
      <section class="gruppo">
        <h3 class="gruppo-titolo">Dove salvarlo</h3>
        <div class="opzioni" role="radiogroup" aria-label="Dove salvare il backup">
          ${opzione('nuovo', 'Scegli dove salvare', 'Si apre la scelta della cartella e del nome del file')}
          ${stato.precedente ? opzione('sovrascrivi', 'Sostituisci il backup precedente', `«${esc(stato.precedente.name)}» viene sostituito: terrai un solo file`) : ''}
        </div>
      </section>`;
  }

  function corpoForm() {
    const tipo = stato.mostra ? 'text' : 'password';
    return {
      html: `
        <section class="scheda flusso-intro">
          <span class="cerchio col-indaco" style="--dim:56px">${icona('download', 28)}</span>
          <h3>Metti i tuoi dati al sicuro</h3>
          <p>Il backup è un file cifrato con una password che scegli ora. Senza la password nessuno può leggerlo.</p>
        </section>

        <form id="form-backup" class="campo-gruppo" autocomplete="off">
          <div class="campo">
            <label for="pwd1">Password (almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri)</label>
            <input id="pwd1" class="campo-testo" type="${tipo}" autocomplete="new-password" autocapitalize="none" spellcheck="false">
          </div>
          <div class="campo">
            <label for="pwd2">Ripeti la password</label>
            <input id="pwd2" class="campo-testo" type="${tipo}" autocomplete="new-password" autocapitalize="none" spellcheck="false">
          </div>
          <button type="button" class="chip" data-az="mostra" aria-pressed="${stato.mostra}">${icona(stato.mostra ? 'check' : 'search', 16)} Mostra le password</button>
        </form>

        ${htmlDoveSalvare()}

        <p class="flusso-nota flusso-nota-avviso">${icona('triangle-alert', 18)}<span>Se dimentichi la password, il backup <strong>non si può recuperare</strong>: nessuno può farlo, nemmeno questa app. Annotala in un posto sicuro.${stato.modo === 'sovrascrivi' && stato.precedente ? ' Sostituendo il vecchio file, vale la password che scrivi adesso.' : ''}</span></p>
        ${stato.errore ? `<p class="flusso-errore" role="alert">${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>` : ''}`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="crea">Crea e salva il backup</button>',
    };
  }

  function corpoAttesa() {
    return {
      html: `<div class="stato-vuoto flusso-attesa" role="status">${icona('refresh-cw', 32)}<h2>Cifratura in corso…</h2><p>Può servire qualche secondo.</p></div>`,
      piede: '',
    };
  }

  function corpoFatto() {
    const e = stato.esito;
    const dove = e.tipo === 'file'
      ? `<li>${esc(e.nome)}</li><li>${e.sostituito ? 'Il backup precedente è stato sostituito' : 'nella posizione che hai scelto'}</li>`
      : `<li>${esc(e.nome)}</li><li>nella cartella Download del telefono</li>`;
    return {
      html: `
        <div class="flusso-esito" role="status">
          <span class="cerchio col-verde" style="--dim:64px">${icona('check', 32)}</span>
          <h2>Backup salvato</h2>
          <ul>${dove}</ul>
        </div>
        <p class="flusso-nota flusso-nota-avviso">${icona('triangle-alert', 18)}<span>Copia il file anche fuori dal telefono (computer, cavo USB, altro dispositivo): se perdi il telefono, perdi anche il backup.</span></p>`,
      piede: `
        <div class="sic-azioni">
          ${e.condivisibile ? `<button type="button" class="pulsante pulsante-grande pulsante-secondario" data-az="condividi">Condividi o sposta il file</button>` : ''}
          <button type="button" class="pulsante pulsante-grande" data-az="chiudi">Fine</button>
        </div>`,
    };
  }

  // ---- Salvataggio ----

  /**
   * Il file su cui scrivere: quello della volta prima (se si è scelto di sostituirlo e c'è ancora) oppure uno nuovo,
   * scelto con la finestra di sistema. Va chiamata subito dopo il tocco dell'utente. Lancia AbortError se annulla.
   */
  async function ottieniFile(nomeFile) {
    if (stato.modo === 'sovrascrivi' && stato.precedente) {
      const attuale = stato.precedente;
      let disponibile = await permessoDiScrittura(attuale);
      if (disponibile) {
        try { await attuale.getFile(); } catch { disponibile = false; /* il file è stato spostato o cancellato */ }
      }
      if (disponibile) return attuale;
      await dimenticaFileBackup();
      stato.precedente = null;
    }
    return scegliNuovoFile(nomeFile);
  }

  async function crea() {
    const [p1, p2] = [radice.querySelector('#pwd1')?.value ?? '', radice.querySelector('#pwd2')?.value ?? ''];
    if (p1.length < LUNGHEZZA_MINIMA_PASSWORD) { errore(`La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.`); return; }
    if (p1 !== p2) { errore('Le due password non coincidono.'); return; }

    const nomeFile = nomeFileBackup(oggiIso());
    const sostituisce = stato.modo === 'sovrascrivi' && Boolean(stato.precedente);
    let file = null;
    if (stato.scelta) {
      try {
        file = await ottieniFile(nomeFile);
      } catch (e) {
        if (e?.name === 'AbortError') return; // ha chiuso la finestra senza scegliere: resta tutto com'è
        console.warn('Scelta del file non riuscita, si usa il download:', e);
      }
    }

    stato.fase = 'attesa';
    disegna();
    try {
      const testo = await creaBackup(p1);
      if (file) {
        await scriviSuFile(file, testo);
        await ricordaFileBackup(file);
        salvaModoPreferito(sostituisce ? 'sovrascrivi' : 'nuovo');
        stato.esito = { tipo: 'file', nome: file.name, sostituito: sostituisce && file === stato.precedente, condivisibile: null };
      } else {
        scaricaFile(nomeFile, testo);
        const condivisibile = new File([testo], nomeFile, { type: 'application/json' });
        stato.esito = { tipo: 'download', nome: nomeFile, sostituito: false, condivisibile: condivisioneDisponibile(condivisibile) ? condivisibile : null };
      }
      await segnaBackupFatto();
      stato.fase = 'fatto';
    } catch (e) {
      console.error(e);
      stato.fase = 'form';
      stato.errore = file ? 'Non sono riuscito a scrivere il file. Riprova, magari scegliendo un\'altra posizione.' : 'Non sono riuscito a creare il backup. Riprova.';
    }
    disegna();
  }

  function errore(testo) {
    stato.errore = testo;
    conservandoICampi(disegna);
  }

  async function condividi() {
    const file = stato.esito?.condivisibile;
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'Backup di Wallet' });
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('Condivisione non riuscita:', e);
    }
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const modo = e.target.closest('[data-modo]')?.dataset.modo;
    if (modo && modo !== stato.modo) {
      stato.modo = modo;
      conservandoICampi(disegna);
    } else if (az === 'chiudi') {
      c.chiudi(undefined);
    } else if (az === 'crea') {
      crea();
    } else if (az === 'condividi') {
      condividi();
    } else if (az === 'mostra') {
      stato.mostra = !stato.mostra;
      stato.errore = '';
      conservandoICampi(disegna);
    }
  }
}
