// Area "Altro" (SPEC §6.5). In Fase 1 funzionano: ciclo mensile, tema, conto predefinito, ordine categorie.
// Le voci delle fasi successive sono visibili ma disattivate.

import { $, esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { impostazioni, salvaImpostazioni } from '../model/impostazioni.js';
import { contiAttivi, contoPerId } from '../model/catalogo.js';
import { scegliConto, scegliNumero, scegliAbbinamento } from '../components/selettori.js';
import { apriImportazione } from '../components/importa-guidata.js';
import { apriSicurezza } from '../components/sicurezza-ui.js';
import { sicurezza } from '../model/blocco.js';
import { apriEsportaBackup } from '../components/backup-esporta.js';
import { apriRipristinaBackup } from '../components/backup-ripristina.js';
import { statoUltimoBackup, descriviUltimoBackup } from '../model/backup.js';
import { oggiIso } from '../util/date.js';
import { VERSIONE_APP, FASE_APP } from '../versione.js';

const TEMI = [['auto', 'Automatico'], ['chiaro', 'Chiaro'], ['scuro', 'Scuro']];
const ORDINI = [['frequenza', 'Più usate'], ['manuale', 'Manuale']];

const VOCI_FUTURE = [
  ['repeat', 'Movimenti ricorrenti', 'Stipendio, PAC, abbonamenti'],
];

const segmentato = (opzioni, attivo, nome) => `
  <div class="segmentato" role="group" aria-label="${nome}">
    ${opzioni.map(([valore, etichetta]) => `<button type="button" data-${nome === 'Tema' ? 'tema' : 'ordine'}="${valore}" aria-pressed="${valore === attivo}">${etichetta}</button>`).join('')}
  </div>`;

export function monta(radice) {
  function disegna() {
    const imp = impostazioni();
    const conto = contoPerId(imp.contoPredefinito);
    const giorno = imp.giornoInizioMese;
    const backup = statoUltimoBackup(imp.ultimoBackup, oggiIso());
    const blocco = sicurezza();

    radice.innerHTML = `
      <h1 class="vista-titolo">Altro</h1>

      <section class="gruppo">
        <h2 class="gruppo-titolo">Preferenze</h2>
        <div class="scheda">
          <button type="button" class="riga-lista" data-az="ciclo">
            <span class="cerchio cerchio-neutro">${icona('calendar-days', 20)}</span>
            <span class="riga-testo">
              <span class="riga-titolo">Inizio del mese</span>
              <span class="riga-sotto">${giorno === 1 ? 'Mese di calendario' : `Il periodo parte il giorno ${giorno}`}</span>
            </span>
            <span class="riga-valore">${giorno === 1 ? '1°' : giorno}</span>${icona('chevron-right', 18)}
          </button>

          <button type="button" class="riga-lista" data-az="conto">
            ${cerchioIcona(conto?.icona ?? 'landmark', conto?.colore, 40)}
            <span class="riga-testo">
              <span class="riga-titolo">Conto predefinito</span>
              <span class="riga-sotto">${esc(conto?.nome ?? '—')}</span>
            </span>${icona('chevron-right', 18)}
          </button>

          <div class="riga-lista riga-colonna">
            <span class="riga-titolo">Tema</span>
            ${segmentato(TEMI, imp.tema, 'Tema')}
          </div>

          <div class="riga-lista riga-colonna">
            <span class="riga-titolo">Ordine delle categorie nell'inserimento</span>
            ${segmentato(ORDINI, imp.ordineCategorieInserimento, 'Ordine')}
          </div>
        </div>
      </section>

      <section class="gruppo">
        <h2 class="gruppo-titolo">Dati e sicurezza</h2>
        <div class="scheda">
          <button type="button" class="riga-lista" data-az="importa">
            <span class="cerchio cerchio-neutro">${icona('upload', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Importa dalla vecchia app</span><span class="riga-sotto">Porta qui movimenti, categorie e conti</span></span>${icona('chevron-right', 18)}
          </button>
          <button type="button" class="riga-lista" data-az="backup">
            <span class="cerchio cerchio-neutro">${icona('download', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Backup</span><span class="riga-sotto">${descriviUltimoBackup(backup)}</span></span>
            ${backup.daFare ? '<span class="badge badge-avviso">Da fare</span>' : ''}${icona('chevron-right', 18)}
          </button>
          <button type="button" class="riga-lista" data-az="sicurezza">
            <span class="cerchio cerchio-neutro">${icona('shield-check', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Sicurezza</span><span class="riga-sotto">${blocco.attiva ? (blocco.impronta ? 'Blocco attivo con PIN e impronta' : 'Blocco attivo con PIN') : 'Sblocco con impronta e PIN'}</span></span>${icona('chevron-right', 18)}
          </button>
          ${VOCI_FUTURE.map(([nomeIcona, titolo, sotto]) => `
            <button type="button" class="riga-lista" disabled aria-disabled="true">
              <span class="cerchio cerchio-neutro">${icona(nomeIcona, 20)}</span>
              <span class="riga-testo"><span class="riga-titolo">${titolo}</span><span class="riga-sotto">${sotto}</span></span>
              <span class="badge">In arrivo</span>
            </button>`).join('')}
        </div>
      </section>

      <section class="gruppo">
        <h2 class="gruppo-titolo">Informazioni</h2>
        <div class="scheda">
          <div class="riga-lista">
            <span class="cerchio cerchio-neutro">${icona('info', 20)}</span>
            <span class="riga-testo">
              <span class="riga-titolo">Spese 2.0</span>
              <span class="riga-sotto">Versione ${VERSIONE_APP} · ${FASE_APP}</span>
            </span>
          </div>
          <div class="riga-lista">
            <span class="cerchio cerchio-neutro">${icona('smartphone', 20)}</span>
            <span class="riga-testo">
              <span class="riga-titolo">Uso offline</span>
              <span class="riga-sotto" data-r="offline">Verifica in corso…</span>
            </span>
          </div>
        </div>
        <p class="nota-fondo">I tuoi dati restano su questo dispositivo. Nessun server, nessun invio.</p>
      </section>`;

    mostraStatoOffline();
  }

  async function mostraStatoOffline() {
    const campo = $('[data-r="offline"]', radice);
    if (!campo) return;
    try {
      const registrazione = await navigator.serviceWorker?.getRegistration();
      campo.textContent = registrazione?.active
        ? 'Pronta: funziona anche senza connessione'
        : 'Non ancora pronta per l\'uso offline';
    } catch {
      campo.textContent = 'Non disponibile in questo browser';
    }
  }

  radice.addEventListener('click', async (e) => {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const tema = e.target.closest('[data-tema]')?.dataset.tema;
    const ordine = e.target.closest('[data-ordine]')?.dataset.ordine;
    const imp = impostazioni();

    if (tema) {
      await salvaImpostazioni({ tema });
      disegna();
    } else if (ordine) {
      await salvaImpostazioni({ ordineCategorieInserimento: ordine });
      disegna();
    } else if (az === 'ciclo') {
      const scelto = await scegliNumero({
        titolo: 'Il mese inizia il giorno',
        descrizione: '1 = mese di calendario. Se ricevi lo stipendio il 27, scegli 27: ogni periodo andrà dal 27 al 26.',
        da: 1,
        a: 28,
        selezionato: imp.giornoInizioMese,
      });
      if (scelto && scelto !== imp.giornoInizioMese) {
        await salvaImpostazioni({ giornoInizioMese: scelto });
        disegna();
      }
    } else if (az === 'importa') {
      apriImportazione();
    } else if (az === 'sicurezza') {
      apriSicurezza();
    } else if (az === 'backup') {
      const scelta = await scegliAbbinamento({
        titolo: 'Backup',
        opzioni: [
          { id: 'esporta', nome: 'Crea un backup cifrato', icona: 'download', colore: 'indaco', sotto: 'Un file protetto da password, da conservare al sicuro' },
          { id: 'ripristina', nome: 'Ripristina da un backup', icona: 'upload', colore: 'azzurro', sotto: 'Unisci o sostituisci i dati con un file di backup' },
        ],
      });
      if (scelta === 'esporta') apriEsportaBackup();
      else if (scelta === 'ripristina') apriRipristinaBackup();
    } else if (az === 'conto') {
      const scelto = await scegliConto({ titolo: 'Conto predefinito', conti: contiAttivi(), selezionatoId: imp.contoPredefinito });
      if (scelto && scelto !== imp.contoPredefinito) {
        await salvaImpostazioni({ contoPredefinito: scelto });
        disegna();
      }
    }
  });

  disegna();
  return { aggiorna: disegna };
}
