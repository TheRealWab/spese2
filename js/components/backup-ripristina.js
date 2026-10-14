// Schermata "Ripristina da un backup" (SPEC §9.2): file e password, anteprima, scelta tra unire e sostituire.

import { apriPannello } from './pannello.js';
import { conferma } from './selettori.js';
import { esc } from '../util/dom.js';
import { icona } from '../util/icone.js';
import { dataLunga } from '../util/formato.js';
import { ErroreBackup, decifra, riepilogoBackup } from '../model/backup.js';
import { contaDatiAttuali, ripristinaBackup } from '../model/backup-db.js';

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

export function apriRipristinaBackup() {
  const stato = { fase: 'file', testo: null, nomeFile: '', dati: null, riepilogo: null, modo: 'unisci', errore: '', esito: null };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Ripristina da un backup',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('change', (e) => { if (e.target.id === 'rip-file') scegliFile(e.target.files?.[0]); });
      el.addEventListener('submit', (e) => { e.preventDefault(); apri(); });
      disegna();
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function disegna() {
    const corpo = { file: corpoFile, attesa: corpoAttesa, anteprima: corpoAnteprima, fatto: corpoFatto }[stato.fase]();
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">Ripristina da un backup</h2>
        </header>
        <div class="flusso-corpo">${corpo.html}</div>
        <footer class="flusso-piede">${corpo.piede}</footer>
      </div>`;
  }

  // ---- 1: file e password ----

  function corpoFile() {
    return {
      html: `
        <section class="scheda flusso-intro">
          <span class="cerchio col-azzurro" style="--dim:56px">${icona('upload', 28)}</span>
          <h3>Apri un backup</h3>
          <p>Scegli il file <strong>spese-backup-….json</strong> e scrivi la password che hai usato per crearlo.</p>
        </section>
        <form class="campo-gruppo" autocomplete="off">
          <button type="button" class="pulsante pulsante-secondario" data-az="scegli-file">${icona('upload', 18)} ${stato.testo ? 'Cambia file' : 'Scegli il file'}</button>
          ${stato.testo ? `<p class="riga-sotto" role="status">File scelto: ${esc(stato.nomeFile)}</p>` : ''}
          <div class="campo">
            <label for="rip-pwd">Password del backup</label>
            <input id="rip-pwd" class="campo-testo" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false">
          </div>
          <input type="file" id="rip-file" accept=".json,application/json" hidden>
        </form>
        ${stato.errore ? `<p class="flusso-errore" role="alert">${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>` : ''}`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="apri">Apri il backup</button>',
    };
  }

  async function scegliFile(file) {
    if (!file) return;
    const password = radice.querySelector('#rip-pwd')?.value ?? '';
    try {
      stato.testo = await file.text();
      stato.nomeFile = file.name;
      stato.errore = '';
    } catch (e) {
      console.error(e);
      stato.errore = 'Non sono riuscito a leggere il file.';
    }
    disegna();
    radice.querySelector('#rip-pwd').value = password;
  }

  function corpoAttesa() {
    return {
      html: `<div class="stato-vuoto flusso-attesa" role="status">${icona('refresh-cw', 32)}<h2>Apro il backup…</h2></div>`,
      piede: '',
    };
  }

  async function apri() {
    const password = radice.querySelector('#rip-pwd')?.value ?? '';
    if (!stato.testo) { avviso('Scegli prima il file di backup.', password); return; }
    if (!password) { avviso('Scrivi la password del backup.', password); return; }
    stato.fase = 'attesa';
    disegna();
    try {
      stato.dati = await decifra(stato.testo, password);
      stato.riepilogo = riepilogoBackup(stato.dati);
      stato.errore = '';
      stato.fase = 'anteprima';
    } catch (e) {
      if (!(e instanceof ErroreBackup)) console.error(e);
      stato.errore = e instanceof ErroreBackup ? e.message : 'Non sono riuscito ad aprire il backup.';
      stato.fase = 'file';
    }
    disegna();
  }

  function avviso(testo, password) {
    stato.errore = testo;
    disegna();
    radice.querySelector('#rip-pwd').value = password;
  }

  // ---- 2: anteprima e scelta ----

  function corpoAnteprima() {
    const r = stato.riepilogo;
    const riga = (nomeIcona, titolo, sotto, valore) => `
      <div class="riga-lista">
        <span class="cerchio cerchio-neutro">${icona(nomeIcona, 20)}</span>
        <span class="riga-testo"><span class="riga-titolo">${titolo}</span><span class="riga-sotto">${sotto}</span></span>
        ${valore ? `<span class="riga-valore">${valore}</span>` : ''}
      </div>`;
    const opzione = (modo, titolo, testo) => `
      <button type="button" class="opzione" role="radio" aria-checked="${stato.modo === modo}" data-az="modo" data-modo="${modo}">
        <span class="opzione-testo">${titolo}<br><span class="riga-sotto">${testo}</span></span>
        ${stato.modo === modo ? `<span class="opzione-spunta">${icona('check', 22)}</span>` : ''}
      </button>`;
    return {
      html: `
        <p class="flusso-guida">Backup aperto. Ecco cosa contiene; nulla è stato ancora ripristinato.</p>
        <div class="scheda">
          ${r.creato ? riga('calendar-days', 'Creato il', esc(dataLunga(r.creato.slice(0, 10))), '') : ''}
          ${riga('list-checks', 'Movimenti', r.periodo ? `dal ${dataLunga(r.periodo.da)}<br>al ${dataLunga(r.periodo.a)}` : 'nessun movimento', String(r.movimenti))}
          ${riga('layout-grid', 'Categorie', '', String(r.categorie))}
          ${riga('landmark', 'Conti', '', String(r.conti))}
        </div>
        <section class="gruppo">
          <h3 class="gruppo-titolo">Come vuoi ripristinarlo?</h3>
          <div class="opzioni" role="radiogroup" aria-label="Modalità di ripristino">
            ${opzione('unisci', 'Unisci ai dati attuali', 'Aggiunge ciò che manca, senza cancellare nulla e senza doppioni.')}
            ${opzione('sostituisci', 'Sostituisci tutto', 'Cancella i dati attuali di questa app e li rimpiazza con quelli del backup.')}
          </div>
        </section>`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="ripristina">Ripristina</button>',
    };
  }

  async function ripristina() {
    if (stato.modo === 'sostituisci') {
      const adesso = await contaDatiAttuali();
      const ok = await conferma({
        titolo: 'Sostituire tutti i dati?',
        testo: `Verranno eliminati i dati attuali (${plurale(adesso.movimenti, 'movimento', 'movimenti')}) e sostituiti con quelli del backup (${plurale(stato.riepilogo.movimenti, 'movimento', 'movimenti')}). L'operazione non si può annullare.`,
        etichettaConferma: 'Sostituisci',
        pericolo: true,
      });
      if (!ok) return;
    }
    stato.fase = 'attesa';
    disegna();
    try {
      stato.esito = await ripristinaBackup(stato.dati, stato.modo);
      stato.fase = 'fatto';
    } catch (e) {
      console.error(e);
      stato.errore = 'Non sono riuscito a ripristinare i dati. Non è cambiato nulla: puoi riprovare.';
      stato.fase = 'anteprima';
    }
    disegna();
  }

  // ---- 3: esito ----

  function corpoFatto() {
    const e = stato.esito;
    const righe = e.modo === 'unisci'
      ? [plurale(e.aggiunti, 'elemento aggiunto', 'elementi aggiunti'), ...(e.aggiornati ? [plurale(e.aggiornati, 'movimento aggiornato', 'movimenti aggiornati')] : []), `${plurale(e.saltati, 'elemento già presente', 'elementi già presenti')}`]
      : [plurale(e.movimenti, 'movimento', 'movimenti'), plurale(e.categorie, 'categoria', 'categorie'), plurale(e.conti, 'conto', 'conti')];
    return {
      html: `
        <div class="flusso-esito" role="status">
          <span class="cerchio col-verde" style="--dim:64px">${icona('check', 32)}</span>
          <h2>${e.modo === 'unisci' ? 'Backup unito ai dati' : 'Dati ripristinati'}</h2>
          <ul>${righe.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="chiudi">Fine</button>',
    };
  }

  function suTocco(e, c) {
    const voce = e.target.closest('[data-az]');
    if (!voce) return;
    switch (voce.dataset.az) {
      case 'chiudi': c.chiudi(stato.esito ?? undefined); break;
      case 'scegli-file': radice.querySelector('#rip-file').click(); break;
      case 'apri': apri(); break;
      case 'modo': stato.modo = voce.dataset.modo; disegna(); break;
      case 'ripristina': ripristina(); break;
      default: break;
    }
  }
}
