// Procedura guidata "Importa dalla vecchia app" (SPEC §8), a tutto schermo, in cinque passi:
// 1 scelta del file · 2 anteprima · 3 abbinamento categorie · 4 abbinamento conti · 5 esito e controllo saldi.
// La logica di conversione sta in model/importa-vecchia.js; qui c'è solo l'interfaccia.

import { apriPannello } from './pannello.js';
import { scegliAbbinamento, scegliConto } from './selettori.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro, dataLunga } from '../util/formato.js';
import { impostazioni } from '../model/impostazioni.js';
import {
  ORIGINE, ErroreImportazione, leggiEsportazione, analizza, proponiAbbinamenti, converti,
} from '../model/importa-vecchia.js';
import { datiPerImportazione, salvaImportazione, saldiAttuali } from '../model/importazione.js';

const PASSI = 5;
const ETICHETTA_TIPO_CONTO = { conto: 'Conto', investimenti: 'Investimenti', 'liquidità': 'Liquidità', altro: 'Altro' };
const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

export function apriImportazione() {
  const stato = { passo: 1, analisi: null, scelte: null, dati: null, errore: '', risultato: null, saldi: [], inCorso: false };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: 'Importa dalla vecchia app',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('change', (e) => { if (e.target.id === 'imp-file') leggiFile(e.target.files?.[0]); });
      disegna();
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function disegna() {
    const { passo } = stato;
    const corpo = { 1: corpoFile, 2: corpoAnteprima, 3: corpoCategorie, 4: corpoConti, 5: corpoEsito }[passo]();
    const puoTornare = passo > 1 && passo < 5;
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="${puoTornare ? 'indietro' : 'chiudi'}" aria-label="${puoTornare ? 'Passo precedente' : 'Chiudi'}">${icona(puoTornare ? 'chevron-left' : 'x', 24)}</button>
          <h2 class="flusso-titolo">Importa dalla vecchia app</h2>
          <span class="flusso-passo">${passo} di ${PASSI}</span>
        </header>
        <div class="flusso-corpo" data-r="corpo">${corpo.html}</div>
        <footer class="flusso-piede">${corpo.piede}</footer>
      </div>`;
  }

  // ---- Passo 1: file ----

  function corpoFile() {
    return {
      html: `
        <section class="scheda flusso-intro">
          <span class="cerchio col-indaco" style="--dim:56px">${icona('upload', 28)}</span>
          <h3>Porta qui i dati della vecchia app</h3>
          <p>Scegli il file di esportazione (.json) salvato dalla vecchia app. Il file resta su questo telefono: non viene inviato da nessuna parte.</p>
          <p>Non viene cancellato nulla: i dati si aggiungono a quelli già presenti, e importare due volte lo stesso file non crea doppioni.</p>
        </section>
        ${stato.errore ? `<p class="flusso-errore" role="alert">${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>` : ''}
        <input type="file" id="imp-file" accept=".json,application/json" hidden>`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="scegli-file">Scegli il file</button>',
    };
  }

  async function leggiFile(file) {
    if (!file) return;
    try {
      const analisi = analizza(leggiEsportazione(await file.text()));
      if (!analisi.movimenti.length) throw new ErroreImportazione('Nel file non ci sono movimenti da importare.');
      stato.dati = await datiPerImportazione();
      stato.analisi = analisi;
      stato.scelte = proponiAbbinamenti(analisi, stato.dati.categorieEsistenti, stato.dati.contiEsistenti, impostazioni().contoPredefinito);
      stato.errore = '';
      stato.passo = 2;
    } catch (errore) {
      if (!(errore instanceof ErroreImportazione)) console.error(errore);
      stato.errore = errore instanceof ErroreImportazione ? errore.message : 'Non sono riuscito a leggere il file. Riprova.';
    }
    disegna();
  }

  // ---- Passo 2: anteprima ----

  function corpoAnteprima() {
    const { analisi, scelte, dati } = stato;
    const c = analisi.conteggi;
    const duplicati = analisi.movimenti.filter((m) => dati.giaImportati.has(`${ORIGINE}:${m.idOrigine}`)).length;
    const nuove = scelte.categorie.filter((x) => x.azione === 'nuova').length;
    const riga = (nomeIcona, titolo, sotto, valore) => `
      <div class="riga-lista">
        <span class="cerchio cerchio-neutro">${icona(nomeIcona, 20)}</span>
        <span class="riga-testo"><span class="riga-titolo">${titolo}</span><span class="riga-sotto">${sotto}</span></span>
        ${valore ? `<span class="riga-valore">${valore}</span>` : ''}
      </div>`;
    return {
      html: `
        <p class="flusso-guida">Ecco cosa c'è nel file. Nulla è stato ancora importato.</p>
        <div class="scheda">
          ${riga('list-checks', 'Movimenti', `${plurale(c.spese, 'spesa', 'spese')} · ${plurale(c.entrate, 'entrata', 'entrate')} · ${plurale(c.versamenti, 'versamento', 'versamenti')} verso investimenti`, String(analisi.movimenti.length))}
          ${riga('calendar-days', 'Periodo coperto', `dal ${dataLunga(analisi.periodo.da)}<br>al ${dataLunga(analisi.periodo.a)}`, '')}
          ${riga('layout-grid', 'Categorie', `${scelte.categorie.length - nuove} già presenti · ${nuove} da creare`, String(scelte.categorie.length))}
          ${riga('landmark', 'Conti', 'da abbinare al passo 4', String(scelte.conti.length))}
        </div>
        ${duplicati ? `<p class="flusso-nota">${icona('circle-check', 18)}<span>${plurale(duplicati, 'movimento è', 'movimenti sono')} già in questa app e verr${duplicati === 1 ? 'à' : 'anno'} saltat${duplicati === 1 ? 'o' : 'i'}.</span></p>` : ''}
        ${analisi.scartati.length ? `<p class="flusso-nota flusso-nota-avviso">${icona('triangle-alert', 18)}<span>${plurale(analisi.scartati.length, 'movimento non è valido e non verrà importato', 'movimenti non sono validi e non verranno importati')}.</span></p>` : ''}`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="avanti">Continua</button>',
    };
  }

  // ---- Passo 3: categorie ----

  function categoriaPerId(id) { return stato.dati.categorieEsistenti.find((x) => x.id === id); }

  function corpoCategorie() {
    const riga = (s, i) => {
      const destinazione = s.azione === 'esistente' ? categoriaPerId(s.id) : null;
      const aspetto = destinazione ?? s.nuova;
      const sotto = destinazione
        ? (destinazione.nome === s.nome ? 'Già presente' : `Diventa «${destinazione.nome}»`)
        : 'Verrà creata come nuova categoria';
      return `
        <button type="button" class="riga-lista" data-az="categoria" data-i="${i}">
          ${cerchioIcona(aspetto.icona, aspetto.colore, 40)}
          <span class="riga-testo">
            <span class="riga-titolo">${esc(s.nome)}</span>
            <span class="riga-sotto">${esc(sotto)} · ${s.tipo === 'entrata' ? 'entrata' : 'spesa'}${s.usi ? ` · ${plurale(s.usi, 'movimento', 'movimenti')}` : ''}</span>
          </span>${icona('chevron-right', 18)}
        </button>`;
    };
    const indicate = stato.scelte.categorie.map((s, i) => ({ s, i }));
    const daControllare = indicate.filter(({ s }) => s.azione === 'nuova');
    const automatiche = indicate.filter(({ s }) => s.azione !== 'nuova');
    const gruppo = (titolo, lista) => (lista.length
      ? `<section class="gruppo"><h3 class="gruppo-titolo">${titolo} (${lista.length})</h3><div class="scheda">${lista.map(({ s, i }) => riga(s, i)).join('')}</div></section>`
      : '');
    return {
      html: `
        <p class="flusso-guida">Abbino le categorie per nome. Quelle senza corrispondenza diventano categorie nuove: tocca una riga per sceglierne un'altra.</p>
        ${gruppo('Da controllare', daControllare)}
        ${gruppo('Abbinate automaticamente', automatiche)}`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="avanti">Continua</button>',
    };
  }

  async function cambiaCategoria(i) {
    const s = stato.scelte.categorie[i];
    const scelta = await scegliAbbinamento({
      titolo: `«${s.nome}» corrisponde a`,
      opzioni: stato.dati.categorieEsistenti.filter((x) => x.tipo === s.tipo && !x.archiviata).map((x) => ({ id: x.id, nome: x.nome, icona: x.icona, colore: x.colore })),
      selezionatoId: s.azione === 'esistente' ? s.id : '__nuova__',
      nuova: { nome: `Crea la categoria «${s.nuova.nome}»`, icona: s.nuova.icona, colore: s.nuova.colore },
    });
    if (!scelta) return;
    if (scelta === '__nuova__') Object.assign(s, { azione: 'nuova', id: null });
    else Object.assign(s, { azione: 'esistente', id: scelta });
    disegna();
  }

  // ---- Passo 4: conti ----

  function contoPerId(id) { return stato.dati.contiEsistenti.find((x) => x.id === id); }

  function descrizioneConto(s) {
    const parti = [];
    const ultimo = s.storico.at(-1);
    if (s.tipoVecchio === 'investimento') {
      if (s.versato) parti.push(`Versato ${euro(s.versato)}`);
      if (ultimo) parti.push(`Valore ${euro(ultimo.cent)} al ${dataLunga(ultimo.data)}`);
    } else if (ultimo) {
      parti.push(`Saldo ${euro(ultimo.cent)} al ${dataLunga(ultimo.data)}`);
    }
    if (s.usi) parti.push(plurale(s.usi, 'movimento', 'movimenti'));
    return parti.join(' · ') || 'Nessun saldo nel file';
  }

  function corpoConti() {
    const righe = stato.scelte.conti.map((s, i) => {
      const destinazione = s.azione === 'esistente' ? contoPerId(s.id) : null;
      const aspetto = destinazione ?? s.nuovo;
      let verso;
      if (!destinazione) verso = `Verrà creato come nuovo conto «${s.nuovo.nome}»`;
      else if (s.rinomina) verso = `Conto «${s.nome}» (prima «${destinazione.nome}»)`;
      else verso = `Conto «${destinazione.nome}»`;
      const rinomina = destinazione && destinazione.nome !== s.nome
        ? `<div class="riga-lista imp-rinomina"><button type="button" class="chip ${s.rinomina ? 'chip-attivo' : ''}" data-az="rinomina" data-i="${i}" aria-pressed="${s.rinomina}">
             ${icona(s.rinomina ? 'check' : 'pencil', 16)} Chiama il conto «${esc(s.nome)}»</button></div>`
        : '';
      return `
        <div class="scheda imp-conto">
          <button type="button" class="riga-lista" data-az="conto" data-i="${i}">
            ${cerchioIcona(aspetto.icona, aspetto.colore, 40)}
            <span class="riga-testo">
              <span class="riga-titolo">${esc(s.nome)}</span>
              <span class="riga-sotto">${esc(descrizioneConto(s))}</span>
              <span class="imp-verso">${icona('arrow-right', 14)} ${esc(verso)}</span>
            </span>${icona('chevron-right', 18)}
          </button>
          ${rinomina}
        </div>`;
    }).join('');

    const senzaConto = stato.analisi.senzaConto
      ? (() => {
        const conto = contoPerId(stato.scelte.contoSenzaConto);
        return `
          <section class="gruppo">
            <h3 class="gruppo-titolo">Movimenti senza conto</h3>
            <div class="scheda">
              <button type="button" class="riga-lista" data-az="senza-conto">
                ${cerchioIcona(conto?.icona ?? 'landmark', conto?.colore, 40)}
                <span class="riga-testo">
                  <span class="riga-titolo">${plurale(stato.analisi.senzaConto, 'movimento', 'movimenti')} senza conto</span>
                  <span class="riga-sotto">Li assegno a «${esc(conto?.nome ?? '—')}»</span>
                </span>${icona('chevron-right', 18)}
              </button>
            </div>
          </section>`;
      })()
      : '';

    return {
      html: `
        <p class="flusso-guida">Abbino i conti. Chi ha lo stesso nome è già abbinato; gli altri vanno su un conto ancora vuoto dello stesso tipo, che puoi rinominare. Il saldo del file diventa il saldo di partenza.</p>
        ${righe}
        ${senzaConto}
        ${stato.errore ? `<p class="flusso-errore" role="alert">${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>` : ''}`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="importa">Importa</button>',
    };
  }

  async function cambiaConto(i) {
    const s = stato.scelte.conti[i];
    const scelta = await scegliAbbinamento({
      titolo: `«${s.nome}» corrisponde a`,
      opzioni: stato.dati.contiEsistenti.filter((x) => !x.archiviato).map((x) => ({
        id: x.id, nome: x.nome, icona: x.icona, colore: x.colore, sotto: ETICHETTA_TIPO_CONTO[x.tipo] ?? '',
      })),
      selezionatoId: s.azione === 'esistente' ? s.id : '__nuova__',
      nuova: { nome: `Crea il conto «${s.nuovo.nome}»`, icona: s.nuovo.icona, colore: s.nuovo.colore },
    });
    if (!scelta) return;
    if (scelta === '__nuova__') Object.assign(s, { azione: 'nuovo', id: null, rinomina: false });
    else Object.assign(s, { azione: 'esistente', id: scelta, rinomina: scelta === s.id ? s.rinomina : false });
    disegna();
  }

  async function cambiaContoSenzaConto() {
    const scelto = await scegliConto({
      titolo: 'Conto per i movimenti senza conto',
      conti: stato.dati.contiEsistenti.filter((x) => !x.archiviato),
      selezionatoId: stato.scelte.contoSenzaConto,
    });
    if (scelto) { stato.scelte.contoSenzaConto = scelto; disegna(); }
  }

  // ---- Importazione ----

  async function importa() {
    stato.inCorso = true;
    stato.passo = 5;
    stato.errore = '';
    disegna();
    try {
      const dati = await datiPerImportazione(); // riletti: potrebbero essere cambiati nel frattempo
      const risultato = converti(stato.analisi, stato.scelte, dati);
      await salvaImportazione(risultato);
      stato.risultato = risultato;
      stato.saldi = await saldiAttuali(risultato.conti.map((x) => x.id));
    } catch (errore) {
      console.error(errore);
      stato.errore = 'Non sono riuscito a importare i dati. Non è stato salvato nulla: puoi riprovare.';
      stato.passo = 4;
    }
    stato.inCorso = false;
    disegna();
  }

  // ---- Passo 5: esito ----

  function corpoEsito() {
    if (stato.inCorso) {
      return { html: `<div class="stato-vuoto flusso-attesa" role="status">${icona('refresh-cw', 32)}<h2>Importo i dati…</h2></div>`, piede: '' };
    }
    const r = stato.risultato;
    const righe = [`${plurale(r.movimenti.length, 'movimento importato', 'movimenti importati')}`];
    if (r.categorie.length) righe.push(`${plurale(r.categorie.length, 'categoria creata', 'categorie create')}`);
    if (r.duplicati) righe.push(`${plurale(r.duplicati, 'movimento già presente, saltato', 'movimenti già presenti, saltati')}`);
    if (r.scartati.length) righe.push(`${plurale(r.scartati.length, 'movimento non importato', 'movimenti non importati')}`);
    return {
      html: `
        <div class="flusso-esito" role="status">
          <span class="cerchio col-verde" style="--dim:64px">${icona('check', 32)}</span>
          <h2>Importazione completata</h2>
          <ul>${righe.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
        <section class="gruppo">
          <h3 class="gruppo-titolo">Saldi calcolati oggi</h3>
          <div class="scheda">
            ${stato.saldi.map(({ conto, saldo }) => `
              <div class="riga-lista">
                ${cerchioIcona(conto.icona, conto.colore, 40)}
                <span class="riga-testo"><span class="riga-titolo">${esc(conto.nome)}</span><span class="riga-sotto">${esc(ETICHETTA_TIPO_CONTO[conto.tipo] ?? '')}</span></span>
                <span class="riga-valore imp-saldo">${euro(saldo)}</span>
              </div>`).join('')}
          </div>
          <p class="nota-fondo">Controllali con la tua banca e con la vecchia app. Se un saldo non torna, di solito va corretto il saldo di partenza di quel conto (la gestione dei conti arriva con la sezione Patrimonio).</p>
        </section>`,
      piede: '<button type="button" class="pulsante pulsante-grande" data-az="chiudi">Fine</button>',
    };
  }

  // ---- Tocchi ----

  function suTocco(e, c) {
    const voce = e.target.closest('[data-az]');
    if (!voce) return;
    const i = Number(voce.dataset.i);
    switch (voce.dataset.az) {
      case 'chiudi': c.chiudi(stato.risultato ?? undefined); break;
      case 'indietro': stato.passo -= 1; stato.errore = ''; disegna(); break;
      case 'avanti': stato.passo += 1; disegna(); break;
      case 'scegli-file': radice.querySelector('#imp-file').click(); break;
      case 'categoria': cambiaCategoria(i); break;
      case 'conto': cambiaConto(i); break;
      case 'rinomina': stato.scelte.conti[i].rinomina = !stato.scelte.conti[i].rinomina; disegna(); break;
      case 'senza-conto': cambiaContoSenzaConto(); break;
      case 'importa': importa(); break;
      default: break;
    }
  }
}
