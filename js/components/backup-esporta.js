// Schermata "Crea un backup cifrato" (SPEC §9.2): scelta della password, cifratura, salvataggio del file.

import { apriPannello } from './pannello.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { oggiIso } from '../util/date.js';
import { scaricaFile } from '../util/scarica.js';
import { LUNGHEZZA_MINIMA_PASSWORD, nomeFileBackup } from '../model/backup.js';
import { creaBackup, segnaBackupFatto } from '../model/backup-db.js';

export function apriEsportaBackup() {
  const stato = { fase: 'form', errore: '', mostra: false, nomeFile: '' };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Crea un backup cifrato',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('submit', (e) => { e.preventDefault(); crea(); });
      disegna();
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

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

        <p class="flusso-nota flusso-nota-avviso">${icona('triangle-alert', 18)}<span>Se dimentichi la password, il backup <strong>non si può recuperare</strong>: nessuno può farlo, nemmeno questa app. Annotala in un posto sicuro.</span></p>
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
    return {
      html: `
        <div class="flusso-esito" role="status">
          <span class="cerchio col-verde" style="--dim:64px">${icona('check', 32)}</span>
          <h2>Backup salvato</h2>
          <ul><li>${esc(stato.nomeFile)}</li><li>nella cartella Download del telefono</li></ul>
        </div>
        <p class="flusso-nota flusso-nota-avviso">${icona('triangle-alert', 18)}<span>Copia il file anche fuori dal telefono (computer, cavo USB, altro dispositivo): se perdi il telefono, perdi anche il backup.</span></p>`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="chiudi">Fine</button>',
    };
  }

  async function crea() {
    const [p1, p2] = [radice.querySelector('#pwd1')?.value ?? '', radice.querySelector('#pwd2')?.value ?? ''];
    if (p1.length < LUNGHEZZA_MINIMA_PASSWORD) { errore(`La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.`); return; }
    if (p1 !== p2) { errore('Le due password non coincidono.'); return; }

    stato.fase = 'attesa';
    disegna();
    try {
      const testo = await creaBackup(p1);
      stato.nomeFile = nomeFileBackup(oggiIso());
      scaricaFile(stato.nomeFile, testo);
      await segnaBackupFatto();
      stato.fase = 'fatto';
    } catch (e) {
      console.error(e);
      stato.fase = 'form';
      stato.errore = 'Non sono riuscito a creare il backup. Riprova.';
    }
    disegna();
  }

  function errore(testo) {
    stato.errore = testo;
    const ripristino = [radice.querySelector('#pwd1')?.value ?? '', radice.querySelector('#pwd2')?.value ?? ''];
    disegna();
    radice.querySelector('#pwd1').value = ripristino[0];
    radice.querySelector('#pwd2').value = ripristino[1];
  }

  function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    if (az === 'chiudi') c.chiudi(undefined);
    else if (az === 'crea') crea();
    else if (az === 'mostra') {
      const valori = [radice.querySelector('#pwd1').value, radice.querySelector('#pwd2').value];
      stato.mostra = !stato.mostra;
      stato.errore = '';
      disegna();
      radice.querySelector('#pwd1').value = valori[0];
      radice.querySelector('#pwd2').value = valori[1];
    }
  }
}
