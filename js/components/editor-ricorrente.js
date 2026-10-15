// Crea o modifica un movimento ricorrente (SPEC §7): cosa registrare, ogni quanto, da quando a quando e se da solo o
// con conferma. Si apre anche da un movimento esistente ("Rendi ricorrente"). Risolve con l'esito, o undefined.

import { apriPannello } from './pannello.js';
import { conferma, scegliConto, scegliAbbinamento, scegliNumero } from './selettori.js';
import { mostraToast } from './toast.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { oggiIso, aggiungiGiorni, daIso, giornoSettimana } from '../util/date.js';
import { dataBreve, leggiImporto, centesimiInDigitato } from '../util/formato.js';
import { contiAttivi, contoPerId, tutteLeCategorieInMemoria, categoriaPerId } from '../model/catalogo.js';
import { destinazioneProposta } from '../model/conti.js';
import {
  FREQUENZE, UNITA, NOME_GIORNO_SETTIMANA, modalitaPredefinita, ricorrenteDaMovimento, validaRicorrente, anteprimaScadenze,
} from '../model/ricorrenti.js';
import {
  ErroreRicorrente, creaRicorrente, aggiornaRicorrente, impostaAttivo, eliminaRicorrente, tuttiIRicorrenti,
} from '../model/ricorrenti-db.js';

const ETICHETTA_FREQUENZA = { settimanale: 'Settimanale', mensile: 'Mensile', annuale: 'Annuale', ogni_n: 'Ogni N' };
const ETICHETTA_UNITA = { giorni: 'Giorni', settimane: 'Settimane', mesi: 'Mesi' };
const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

/** Chiede se registrare anche le scadenze passate. Risolve 'si', 'no' oppure undefined (annullato). */
function chiediPassate(dataInizio) {
  const ctrl = apriPannello({
    tipo: 'dialogo',
    etichetta: 'Scadenze passate',
    riempi(el, c) {
      el.innerHTML = `
        <div class="dialogo-corpo">
          <h2>Registro anche le scadenze passate?</h2>
          <p>La data di inizio è il ${esc(dataBreve(dataInizio))}, già passata. Posso registrare anche le scadenze da quel giorno a oggi, oppure partire da oggi.</p>
        </div>
        <div class="dialogo-azioni dialogo-azioni-colonna">
          <button type="button" class="pulsante" data-esito="si">Sì, registrale</button>
          <button type="button" class="pulsante pulsante-secondario" data-esito="no">No, parti da oggi</button>
        </div>`;
      el.addEventListener('click', (e) => {
        const esito = e.target.closest('[data-esito]')?.dataset.esito;
        if (esito) c.chiudi(esito);
      });
    },
  });
  return ctrl.chiuso;
}

/**
 * @param {{ricorrenteId?: string|null, daMovimento?: object|null}} opzioni
 *   senza opzioni se ne crea uno nuovo; con `daMovimento` parte da quel movimento
 */
export async function apriEditorRicorrente({ ricorrenteId = null, daMovimento = null } = {}) {
  const oggi = oggiIso();
  const esistente = ricorrenteId ? (await tuttiIRicorrenti()).find((r) => r.id === ricorrenteId) ?? null : null;
  if (ricorrenteId && !esistente) { mostraToast('Il ricorrente non esiste più'); return undefined; }

  const base = esistente ?? (daMovimento ? ricorrenteDaMovimento(daMovimento) : null);
  const contoDefault = contiAttivi()[0]?.id ?? null;
  const stato = {
    tipo: base?.modello.tipo ?? 'spesa',
    importo: base ? centesimiInDigitato(base.modello.importo).replace('.', ',') : '',
    categoriaId: base?.modello.categoriaId ?? null,
    contoId: base?.modello.contoId ?? contoDefault,
    contoDestinazioneId: base?.modello.contoDestinazioneId ?? null,
    nota: base?.modello.nota ?? '',
    frequenza: base?.frequenza ?? 'mensile',
    giornoSettimana: base?.giornoSettimana ?? giornoSettimana(oggi),
    giornoDelMese: base?.giornoDelMese ?? daIso(oggi).g,
    intervallo: String(base?.intervallo ?? 1),
    unita: base?.unita ?? 'mesi',
    dataInizio: base?.dataInizio ?? oggi,
    dataFine: base?.dataFine ?? '',
    modalita: base?.modalita ?? modalitaPredefinita('spesa'),
    modalitaScelta: Boolean(base), // se non la tocca, segue il tipo (entrata → conferma)
    errore: '',
    salvando: false,
  };
  if (stato.tipo === 'trasferimento' && !stato.contoDestinazioneId) stato.contoDestinazioneId = destinazioneProposta(contiAttivi(), stato.contoId);
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: esistente ? 'Modifica ricorrente' : 'Nuovo ricorrente',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('input', (e) => { if (e.target.closest('input')) { ricorda(); if (stato.errore) segnalaErrore(''); aggiornaAnteprima(); } });
      el.addEventListener('submit', (e) => { e.preventDefault(); salvaTutto(c); });
      disegna();
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function contiDisponibili() {
    const conti = [...contiAttivi()];
    for (const id of [stato.contoId, stato.contoDestinazioneId]) {
      const c = id && contoPerId(id);
      if (c && !conti.includes(c)) conti.push(c);
    }
    return conti;
  }

  /** I campi di testo si copiano nello stato prima di ogni ridisegno (che li ricrea). */
  function ricorda() {
    for (const [id, chiave] of [['er-importo', 'importo'], ['er-nota', 'nota'], ['er-inizio', 'dataInizio'], ['er-fine', 'dataFine'], ['er-intervallo', 'intervallo']]) {
      const campo = radice.querySelector(`#${id}`);
      if (campo) stato[chiave] = campo.value;
    }
  }

  /** Il ricorrente come descritto dal modulo; `importo` può essere null se il testo non è valido. */
  function costruisci() {
    const importo = leggiImporto(stato.importo);
    const trasferimento = stato.tipo === 'trasferimento';
    return {
      id: esistente?.id ?? 'nuovo',
      modello: {
        tipo: stato.tipo,
        importo,
        categoriaId: trasferimento ? null : stato.categoriaId,
        contoId: stato.contoId,
        contoDestinazioneId: trasferimento ? stato.contoDestinazioneId : null,
        nota: stato.nota,
      },
      frequenza: stato.frequenza,
      giornoSettimana: stato.giornoSettimana,
      giornoDelMese: stato.giornoDelMese,
      intervallo: Number(stato.intervallo),
      unita: stato.unita,
      dataInizio: stato.dataInizio,
      dataFine: stato.dataFine || null,
      modalita: stato.modalita,
      attivo: esistente?.attivo ?? true,
      ultimaGenerazione: base?.ultimaGenerazione ?? null,
    };
  }

  function htmlAnteprima() {
    const r = costruisci();
    // L'anteprima serve solo a vedere le date: si controlla la parte "quando" con un modello di comodo.
    const prova = { ...r, modello: { tipo: 'spesa', importo: 1, categoriaId: 'x', contoId: 'x', contoDestinazioneId: null } };
    if (validaRicorrente(prova) !== null) return '';
    try {
      // Per un ricorrente nuovo si mostrano le prossime scadenze da oggi, non quelle passate.
      const serie = esistente || daMovimento ? r : { ...r, ultimaGenerazione: aggiungiGiorni(oggi, -1) };
      const date = anteprimaScadenze(serie, 3);
      if (!date.length) return 'Nessuna scadenza: la serie è già finita.';
      return `Prossime scadenze: ${date.map((d) => dataBreve(d)).join(' · ')}`;
    } catch { return ''; }
  }

  function aggiornaAnteprima() {
    const campo = radice.querySelector('[data-r="anteprima"]');
    if (campo) campo.textContent = htmlAnteprima();
  }

  function rigaScelta(az, cerchio, etichetta, valore) {
    return `
      <button type="button" class="riga-lista" data-az="${az}">
        ${cerchio}
        <span class="riga-testo"><span class="riga-sotto">${etichetta}</span><span class="riga-titolo">${esc(valore)}</span></span>${icona('chevron-down', 18)}
      </button>`;
  }

  function disegna() {
    const nuovo = !esistente;
    const trasferimento = stato.tipo === 'trasferimento';
    const conto = contoPerId(stato.contoId);
    const destinazione = contoPerId(stato.contoDestinazioneId);
    const categoria = categoriaPerId(stato.categoriaId);
    radice.innerHTML = `
      <div class="flusso">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">${nuovo ? 'Nuovo ricorrente' : 'Modifica ricorrente'}</h2>
        </header>
        <form class="flusso-corpo" id="form-ricorrente" autocomplete="off" novalidate>
          <div class="segmentato" role="group" aria-label="Tipo di movimento">
            <button type="button" data-tipo="spesa" aria-pressed="${stato.tipo === 'spesa'}">Spesa</button>
            <button type="button" data-tipo="entrata" aria-pressed="${stato.tipo === 'entrata'}">Entrata</button>
            <button type="button" data-tipo="trasferimento" aria-pressed="${stato.tipo === 'trasferimento'}">Trasferimento</button>
          </div>

          <div class="scheda er-campi">
            <div class="campo">
              <label for="er-importo">Importo (€)</label>
              <input id="er-importo" class="campo-testo" type="text" inputmode="decimal" placeholder="Per esempio 1.450,00" value="${esc(stato.importo)}">
            </div>
            <div class="campo">
              <label for="er-nota">Nota (facoltativa)</label>
              <input id="er-nota" class="campo-testo" type="text" maxlength="80" placeholder="Per esempio Palestra" value="${esc(stato.nota)}">
            </div>
          </div>

          <div class="scheda">
            ${trasferimento ? '' : rigaScelta('categoria', categoria ? cerchioIcona(categoria.icona, categoria.colore, 40) : `<span class="cerchio cerchio-neutro">${icona('layout-grid', 20)}</span>`, 'Categoria', categoria?.nome ?? 'Scegli la categoria')}
            ${rigaScelta('conto', cerchioIcona(conto?.icona ?? 'landmark', conto?.colore, 40), trasferimento ? 'Da conto' : (stato.tipo === 'entrata' ? 'Accredita su' : 'Paga con'), conto?.nome ?? 'Scegli il conto')}
            ${trasferimento ? rigaScelta('destinazione', cerchioIcona(destinazione?.icona ?? 'landmark', destinazione?.colore, 40), 'A conto', destinazione?.nome ?? 'Scegli il conto') : ''}
          </div>

          <section class="gruppo">
            <h3 class="gruppo-titolo">Ogni quanto</h3>
            <div class="segmentato sel-scorri" role="group" aria-label="Frequenza">
              ${FREQUENZE.map((f) => `<button type="button" data-freq="${f}" aria-pressed="${stato.frequenza === f}">${ETICHETTA_FREQUENZA[f]}</button>`).join('')}
            </div>
            ${htmlDettaglioFrequenza()}
          </section>

          <section class="gruppo">
            <h3 class="gruppo-titolo">Da quando a quando</h3>
            <div class="scheda er-campi">
              <div class="campo"><label for="er-inizio">Data di inizio</label><input id="er-inizio" class="campo-data" type="date" value="${esc(stato.dataInizio)}"></div>
              <div class="campo">
                <label for="er-fine">Data di fine (facoltativa)</label>
                <div class="er-fine"><input id="er-fine" class="campo-data" type="date" value="${esc(stato.dataFine)}">
                  ${stato.dataFine ? `<button type="button" class="chip" data-az="togli-fine">${icona('x', 16)} Nessuna</button>` : ''}</div>
              </div>
            </div>
          </section>

          <section class="gruppo">
            <h3 class="gruppo-titolo">Come registrarlo</h3>
            <div class="segmentato" role="group" aria-label="Modalità">
              <button type="button" data-modalita="automatico" aria-pressed="${stato.modalita === 'automatico'}">Automatico</button>
              <button type="button" data-modalita="conferma" aria-pressed="${stato.modalita === 'conferma'}">Con conferma</button>
            </div>
            <p class="nota-fondo">${stato.modalita === 'automatico'
              ? 'Il movimento viene registrato da solo alla scadenza.'
              : 'All\'apertura dell\'app ti chiedo se confermare, cambiare l\'importo o saltare.'}</p>
          </section>

          <p class="er-anteprima" data-r="anteprima" aria-live="polite">${esc(htmlAnteprima())}</p>
          ${esistente ? htmlAzioniEsistente() : ''}
          <p class="flusso-errore" role="alert" data-r="errore" ${stato.errore ? '' : 'hidden'}>${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>
        </form>
        <footer class="flusso-piede">
          <button type="button" class="pulsante pulsante-grande" data-az="salva" ${stato.salvando ? 'disabled' : ''}>${nuovo ? 'Crea il ricorrente' : 'Salva le modifiche'}</button>
        </footer>
      </div>`;
  }

  function htmlDettaglioFrequenza() {
    if (stato.frequenza === 'settimanale') {
      return `
        <div class="chip-riga er-giorni" role="radiogroup" aria-label="Giorno della settimana">
          ${GIORNI_BREVI.map((nome, i) => `<button type="button" class="chip ${stato.giornoSettimana === i ? 'chip-attivo' : ''}" role="radio" aria-checked="${stato.giornoSettimana === i}" data-gs="${i}" aria-label="${NOME_GIORNO_SETTIMANA[i]}">${nome}</button>`).join('')}
        </div>`;
    }
    if (stato.frequenza === 'mensile') {
      const ultimo = stato.giornoDelMese === 'ultimo';
      return `
        <div class="segmentato" role="group" aria-label="Giorno del mese">
          <button type="button" data-gm="fisso" aria-pressed="${!ultimo}">Giorno fisso</button>
          <button type="button" data-gm="ultimo" aria-pressed="${ultimo}">Ultimo giorno</button>
        </div>
        ${ultimo ? '<p class="nota-fondo">Ogni mese, l\'ultimo giorno (28, 29, 30 o 31).</p>' : `
          <div class="scheda">${rigaScelta('giorno-mese', `<span class="cerchio cerchio-neutro">${icona('calendar-days', 20)}</span>`, 'Giorno del mese', `Il ${stato.giornoDelMese}`)}</div>
          ${stato.giornoDelMese > 28 ? '<p class="nota-fondo">Nei mesi più corti si usa l\'ultimo giorno del mese.</p>' : ''}`}`;
    }
    if (stato.frequenza === 'annuale') return '<p class="nota-fondo">Ogni anno nello stesso giorno della data di inizio.</p>';
    return `
      <div class="scheda er-campi">
        <div class="campo"><label for="er-intervallo">Ogni quanti</label>
          <input id="er-intervallo" class="campo-testo" type="text" inputmode="numeric" maxlength="3" value="${esc(stato.intervallo)}"></div>
        <div class="segmentato" role="group" aria-label="Unità">
          ${UNITA.map((u) => `<button type="button" data-unita="${u}" aria-pressed="${stato.unita === u}">${ETICHETTA_UNITA[u]}</button>`).join('')}
        </div>
      </div>`;
  }

  function htmlAzioniEsistente() {
    return `
      <section class="gruppo">
        <h3 class="gruppo-titolo">Altre azioni</h3>
        <div class="scheda">
          <button type="button" class="riga-lista" data-az="${esistente.attivo ? 'pausa' : 'riprendi'}">
            <span class="cerchio cerchio-neutro">${icona(esistente.attivo ? 'pause' : 'play', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">${esistente.attivo ? 'Metti in pausa' : 'Riprendi'}</span><span class="riga-sotto">${esistente.attivo ? 'Non registra nulla finché non lo riprendi' : 'Riparte dalla prossima scadenza, senza recuperare la pausa'}</span></span>${icona('chevron-right', 18)}
          </button>
          <button type="button" class="riga-lista ed-pericolo" data-az="elimina">
            <span class="cerchio cerchio-neutro">${icona('trash-2', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">Elimina</span><span class="riga-sotto">I movimenti già registrati restano</span></span>${icona('chevron-right', 18)}
          </button>
        </div>
      </section>`;
  }

  function segnalaErrore(testo) {
    stato.errore = testo;
    const campo = radice.querySelector('[data-r="errore"]');
    if (!campo) return;
    campo.hidden = !testo;
    campo.querySelector('span').textContent = testo;
  }

  // ---- Azioni ----

  async function salvaTutto(c) {
    if (stato.salvando) return;
    ricorda();
    const r = costruisci();
    if (r.modello.importo === null) { segnalaErrore('Scrivi l\'importo, per esempio 1.450,00.'); radice.querySelector('#er-importo')?.focus(); return; }
    const errore = validaRicorrente(r);
    if (errore) { segnalaErrore(errore); return; }

    let registraPassate = true;
    if (!esistente && !daMovimento && r.dataInizio < oggi) {
      const scelta = await chiediPassate(r.dataInizio);
      if (!scelta) return;
      registraPassate = scelta === 'si';
    }

    stato.salvando = true;
    radice.querySelector('[data-az="salva"]')?.setAttribute('disabled', '');
    try {
      if (esistente) {
        await aggiornaRicorrente(esistente.id, r);
        mostraToast('Modifiche salvate');
        c.chiudi({ azione: 'modificato', id: esistente.id });
      } else {
        const creato = await creaRicorrente({ ...r, ultimaGenerazione: base?.ultimaGenerazione ?? null }, { registraPassate });
        mostraToast('Ricorrente creato');
        c.chiudi({ azione: 'creato', id: creato.id });
      }
    } catch (e) {
      stato.salvando = false;
      radice.querySelector('[data-az="salva"]')?.removeAttribute('disabled');
      if (!(e instanceof ErroreRicorrente)) console.error(e);
      segnalaErrore(e instanceof ErroreRicorrente ? e.message : 'Non sono riuscito a salvare. Riprova.');
    }
  }

  async function scegliCategoria() {
    const opzioni = tutteLeCategorieInMemoria()
      .filter((x) => x.tipo === stato.tipo && (!x.archiviata || x.id === stato.categoriaId))
      .map((x) => ({ id: x.id, nome: x.nome, icona: x.icona, colore: x.colore }));
    const id = await scegliAbbinamento({ titolo: 'Categoria', opzioni, selezionatoId: stato.categoriaId });
    if (id) { ricorda(); stato.categoriaId = id; disegna(); }
  }

  async function scegliContoDi(campo) {
    const titolo = campo === 'contoDestinazioneId' ? 'Trasferisci verso' : (stato.tipo === 'trasferimento' ? 'Trasferisci da' : (stato.tipo === 'entrata' ? 'Accredita su' : 'Paga con'));
    const scelto = await scegliConto({ titolo, conti: contiDisponibili(), selezionatoId: stato[campo] });
    if (!scelto) return;
    ricorda();
    if (stato.tipo === 'trasferimento') {
      const altro = campo === 'contoDestinazioneId' ? 'contoId' : 'contoDestinazioneId';
      if (stato[altro] === scelto) stato[altro] = stato[campo];
    }
    stato[campo] = scelto;
    disegna();
  }

  async function elimina(c) {
    const ok = await conferma({
      titolo: 'Eliminare il ricorrente?',
      testo: 'Non registrerà più nulla. I movimenti già registrati restano dove sono. L\'operazione non si può annullare.',
      etichettaConferma: 'Elimina',
      pericolo: true,
    });
    if (!ok) return;
    try {
      await eliminaRicorrente(esistente.id);
      mostraToast('Ricorrente eliminato');
      c.chiudi({ azione: 'eliminato', id: esistente.id });
    } catch (e) {
      console.error(e);
      segnalaErrore('Non sono riuscito a eliminarlo.');
    }
  }

  async function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const tipo = e.target.closest('[data-tipo]')?.dataset.tipo;
    const freq = e.target.closest('[data-freq]')?.dataset.freq;
    const gs = e.target.closest('[data-gs]')?.dataset.gs;
    const gm = e.target.closest('[data-gm]')?.dataset.gm;
    const unita = e.target.closest('[data-unita]')?.dataset.unita;
    const modalita = e.target.closest('[data-modalita]')?.dataset.modalita;

    if (tipo && tipo !== stato.tipo) {
      ricorda();
      stato.tipo = tipo;
      if (tipo === 'trasferimento') {
        stato.categoriaId = null;
        if (!stato.contoDestinazioneId || stato.contoDestinazioneId === stato.contoId) stato.contoDestinazioneId = destinazioneProposta(contiAttivi(), stato.contoId);
      } else if (categoriaPerId(stato.categoriaId)?.tipo !== tipo) {
        stato.categoriaId = null;
      }
      if (!stato.modalitaScelta) stato.modalita = modalitaPredefinita(tipo);
      stato.errore = '';
      disegna();
      return;
    }
    if (freq && freq !== stato.frequenza) { ricorda(); stato.frequenza = freq; disegna(); return; }
    if (gs !== undefined) { ricorda(); stato.giornoSettimana = Number(gs); disegna(); return; }
    if (gm) { ricorda(); stato.giornoDelMese = gm === 'ultimo' ? 'ultimo' : (stato.giornoDelMese === 'ultimo' ? daIso(stato.dataInizio).g : stato.giornoDelMese); disegna(); return; }
    if (unita) { ricorda(); stato.unita = unita; disegna(); return; }
    if (modalita) { ricorda(); stato.modalita = modalita; stato.modalitaScelta = true; disegna(); return; }

    switch (az) {
      case 'chiudi': c.chiudi(undefined); break;
      case 'salva': await salvaTutto(c); break;
      case 'categoria': await scegliCategoria(); break;
      case 'conto': await scegliContoDi('contoId'); break;
      case 'destinazione': await scegliContoDi('contoDestinazioneId'); break;
      case 'giorno-mese': {
        const n = await scegliNumero({ titolo: 'Giorno del mese', descrizione: 'Nei mesi più corti si usa l\'ultimo giorno.', da: 1, a: 31, selezionato: stato.giornoDelMese });
        if (n) { ricorda(); stato.giornoDelMese = n; disegna(); }
        break;
      }
      case 'togli-fine': ricorda(); stato.dataFine = ''; disegna(); break;
      case 'pausa':
      case 'riprendi': {
        try {
          await impostaAttivo(esistente.id, az === 'riprendi');
          mostraToast(az === 'riprendi' ? 'Ricorrente ripreso' : 'Ricorrente in pausa');
          c.chiudi({ azione: az, id: esistente.id });
        } catch (errore) { console.error(errore); segnalaErrore('Non sono riuscito a completare l\'operazione.'); }
        break;
      }
      case 'elimina': await elimina(c); break;
      default: break;
    }
  }
}
