// Pannello di inserimento e modifica dei movimenti (SPEC §5).
// Obiettivo: una spesa normale in tre tocchi — importo → categoria → salva.

import { apriPannello } from './pannello.js';
import { creaTastierino, applicaTasto } from './tastierino.js';
import { scegliConto, scegliData, conferma } from './selettori.js';
import { mostraToast } from './toast.js';
import { esc, $, animaClasse, vibra, attendi, movimentoRidotto } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { formattaDigitato, digitatoInCentesimi, centesimiInDigitato, etichettaGiorno, dataLunga, euro } from '../util/formato.js';
import { oggiIso, aggiungiGiorni } from '../util/date.js';
import { impostazioni } from '../model/impostazioni.js';
import { contiAttivi, tutteLeCategorieInMemoria, contoPerId, categoriaPerId } from '../model/catalogo.js';
import { categoriePerInserimento } from '../model/categorie.js';
import { destinazioneProposta } from '../model/conti.js';
import {
  creaMovimento, aggiornaMovimento, eliminaMovimento, validaMovimento, movimentiPeriodo, noteUsate,
} from '../model/movimenti.js';
import { suggerisciNote } from '../model/calcoli.js';

const GIORNI_PER_FREQUENZA = 90; // finestra di movimenti passata all'ordinamento per uso
const ETICHETTA_SALVA = { spesa: 'Salva spesa', entrata: 'Salva entrata', trasferimento: 'Salva trasferimento' };

/**
 * Apre il pannello.
 * @param {{movimento?: object, iniziale?: {tipo?: string, categoriaId?: string}}} opzioni
 *   `movimento` → modalità modifica; `iniziale` → valori di partenza per un nuovo movimento.
 * @returns {Promise<object|undefined>} il movimento salvato, oppure undefined se chiuso senza salvare
 */
export async function apriInserimento({ movimento = null, iniziale = {} } = {}) {
  const oggi = oggiIso();
  const modifica = movimento !== null;
  const imp = impostazioni();
  const recenti = await movimentiPeriodo(aggiungiGiorni(oggi, -GIORNI_PER_FREQUENZA), oggi);

  const conti = [...contiAttivi()];
  // In modifica un conto archiviato dev'essere comunque selezionabile/visibile.
  for (const id of [movimento?.contoId, movimento?.contoDestinazioneId]) {
    const c = id && contoPerId(id);
    if (c && !conti.includes(c)) conti.push(c);
  }
  const contoDefault = conti.find((c) => c.id === imp.contoPredefinito)?.id ?? conti[0]?.id ?? null;

  const stato = {
    tipo: movimento?.tipo ?? iniziale.tipo ?? 'spesa',
    cifre: movimento ? centesimiInDigitato(movimento.importo) : '',
    categoriaId: movimento?.categoriaId ?? iniziale.categoriaId ?? null,
    contoId: movimento?.contoId ?? contoDefault,
    contoDestinazioneId: movimento?.contoDestinazioneId ?? null,
    data: movimento?.data ?? oggi,
    nota: movimento?.nota ?? '',
    note: [], // note già usate nella categoria scelta (per i suggerimenti)
    modoNota: false,
    salvando: false,
  };
  if (stato.tipo === 'trasferimento' && !stato.contoDestinazioneId) {
    stato.contoDestinazioneId = destinazioneProposta(conti, stato.contoId);
  }

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: modifica ? 'Modifica movimento' : 'Nuovo movimento',
    riempi: (el, c) => costruisci(el, c),
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function costruisci(el, c) {
    el.innerHTML = `
      <div class="ins" data-tipo="${stato.tipo}">
        <header class="ins-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <div class="segmentato ins-tipi" role="group" aria-label="Tipo di movimento">
            <button type="button" data-tipo="spesa">Spesa</button>
            <button type="button" data-tipo="entrata">Entrata</button>
            <button type="button" data-tipo="trasferimento">Trasferimento</button>
          </div>
          ${modifica
            ? `<button type="button" class="btn-icona" data-az="elimina" aria-label="Elimina movimento">${icona('trash-2', 22)}</button>`
            : '<span class="btn-icona" aria-hidden="true"></span>'}
        </header>

        <div class="ins-importo" role="status" aria-live="polite">
          <span class="ins-valore" data-r="valore">0</span><span class="ins-valuta" aria-hidden="true">€</span>
          <span class="solo-sr" data-r="valore-sr"></span>
        </div>

        <div class="ins-corpo" data-r="corpo"></div>

        <div class="ins-secondario">
          <div class="ins-riga-a" data-r="riga-a"></div>
          <div class="ins-riga-b" data-r="riga-b"></div>
          <div class="ins-editor-nota" data-r="editor-nota" hidden>
            <label class="solo-sr" for="campo-nota">Nota</label>
            <input id="campo-nota" class="campo-nota" type="text" maxlength="80" autocomplete="off"
                   enterkeyhint="done" placeholder="Nota (facoltativa)" value="${esc(stato.nota)}">
            <button type="button" class="btn-icona btn-fatto" data-az="nota-fatto" aria-label="Fine nota">${icona('check', 22)}</button>
          </div>
          <div class="ins-sugg-wrap" data-r="sugg-wrap" hidden></div>
        </div>

        <div class="ins-tastierino" data-r="tastierino"></div>

        <div class="ins-azioni">
          <button type="button" class="pulsante pulsante-grande" data-az="salva" data-r="salva"></button>
        </div>
      </div>`;

    const radice = $('.ins', el);
    const r = (nome) => $(`[data-r="${nome}"]`, el);
    const campoNota = $('#campo-nota', el);
    const sfondo = el.closest('.pannello-sfondo');

    creaTastierino(r('tastierino'), (tasto) => {
      stato.cifre = applicaTasto(stato.cifre, tasto);
      aggiornaImporto();
    });

    // ---- Aggiornamenti parziali della vista ----

    function aggiornaImporto() {
      const testo = formattaDigitato(stato.cifre);
      const valore = r('valore');
      valore.textContent = testo;
      valore.classList.toggle('vuoto', stato.cifre === '');
      valore.dataset.misura = testo.length > 11 ? 's' : testo.length > 8 ? 'm' : 'l';
      r('valore-sr').textContent = `${testo} euro`;
      aggiornaSalva();
    }

    function datiMovimento() {
      const trasferimento = stato.tipo === 'trasferimento';
      return {
        tipo: stato.tipo,
        importo: digitatoInCentesimi(stato.cifre),
        data: stato.data,
        categoriaId: trasferimento ? null : stato.categoriaId,
        contoId: stato.contoId,
        contoDestinazioneId: trasferimento ? stato.contoDestinazioneId : null,
        nota: stato.nota,
        ricorrenteId: movimento?.ricorrenteId ?? null,
      };
    }

    function aggiornaSalva() {
      const bottone = r('salva');
      bottone.textContent = modifica ? 'Salva modifiche' : ETICHETTA_SALVA[stato.tipo];
      bottone.classList.toggle('incompleto', validaMovimento(datiMovimento()) !== null);
    }

    function htmlCategorie() {
      const lista = categoriePerInserimento(
        tutteLeCategorieInMemoria(), stato.tipo, recenti, oggi, imp.ordineCategorieInserimento,
      );
      // Una categoria archiviata già assegnata al movimento in modifica resta visibile.
      const attuale = categoriaPerId(stato.categoriaId);
      if (attuale && attuale.tipo === stato.tipo && !lista.includes(attuale)) lista.push(attuale);
      return `
        <div class="griglia-cat" role="radiogroup" aria-label="Categoria">
          ${lista.map((cat) => `
            <button type="button" class="cat-voce col-${esc(cat.colore)}" role="radio"
                    aria-checked="${cat.id === stato.categoriaId}" data-cat="${esc(cat.id)}">
              ${cerchioIcona(cat.icona, cat.colore, 48)}
              <span class="cat-nome">${esc(cat.nome)}</span>
            </button>`).join('')}
        </div>`;
    }

    function cardConto(ruolo, conto, etichetta) {
      return `
        <button type="button" class="trasf-conto" data-az="scegli-${ruolo}" aria-label="${etichetta}: ${esc(conto?.nome ?? 'scegli')}">
          ${cerchioIcona(conto?.icona ?? 'landmark', conto?.colore, 44)}
          <span class="trasf-testo"><span class="chip-et">${etichetta}</span><span class="trasf-nome">${esc(conto?.nome ?? 'Scegli il conto')}</span></span>
          ${icona('chevron-down', 20)}
        </button>`;
    }

    function htmlTrasferimento() {
      return `
        <div class="trasf">
          ${cardConto('da', contoPerId(stato.contoId), 'Da')}
          <button type="button" class="trasf-scambia" data-az="scambia" aria-label="Inverti i due conti">${icona('arrow-left-right', 20)}</button>
          ${cardConto('a', contoPerId(stato.contoDestinazioneId), 'A')}
        </div>`;
    }

    function aggiornaCorpo() {
      r('corpo').innerHTML = stato.tipo === 'trasferimento' ? htmlTrasferimento() : htmlCategorie();
    }

    function aggiornaChip() {
      const trasferimento = stato.tipo === 'trasferimento';
      const conto = contoPerId(stato.contoId);
      const etichettaConto = stato.tipo === 'spesa' ? 'Da' : 'Verso';
      const chipConto = trasferimento ? '' : `
        <button type="button" class="chip chip-conto" data-az="conto"
                aria-label="${stato.tipo === 'spesa' ? 'Pagato da' : 'Accreditato su'} ${esc(conto?.nome)}. Cambia conto">
          <span class="chip-et">${etichettaConto}</span>
          ${cerchioIcona(conto?.icona, conto?.colore, 24)}
          <span class="chip-testo">${esc(conto?.nome ?? 'Scegli')}</span>
        </button>`;
      const dataBreve = stato.data === oggi || stato.data === aggiungiGiorni(oggi, -1)
        ? etichettaGiorno(stato.data, oggi) : dataLunga(stato.data);
      r('riga-a').innerHTML = `${chipConto}
        <button type="button" class="chip chip-data" data-az="data" aria-label="Data: ${dataLunga(stato.data)}. Cambia data">
          ${icona('calendar', 18)}<span class="chip-testo">${esc(dataBreve)}</span>
        </button>`;
    }

    function htmlSuggerimenti(voci) {
      return voci.map((v) => `<button type="button" class="chip chip-sugg" data-sugg="${esc(v.nota)}">${esc(v.nota)}</button>`).join('');
    }

    function aggiornaNota() {
      const notaScelta = stato.nota.trim().toLowerCase();
      const chipNota = `
        <button type="button" class="chip chip-nota ${stato.nota ? 'chip-attivo' : ''}" data-az="nota"
                aria-label="${stato.nota ? `Nota: ${esc(stato.nota)}. Modifica` : 'Aggiungi una nota'}">
          ${icona('pencil', 16)}<span class="chip-testo">${stato.nota ? esc(stato.nota) : 'Aggiungi nota'}</span>
        </button>`;

      if (stato.modoNota) {
        // Mentre si scrive: suggerimenti filtrati dal testo digitato.
        const voci = suggerisciNote(stato.note, stato.nota, 8);
        r('sugg-wrap').innerHTML = htmlSuggerimenti(voci);
        r('sugg-wrap').hidden = voci.length === 0;
        return;
      }
      // Fuori dalla scrittura: le note più usate della categoria, escluso ciò che è già scritto.
      const voci = suggerisciNote(stato.note.filter((n) => n.nota.toLowerCase() !== notaScelta), '', 6);
      r('riga-b').innerHTML = chipNota + htmlSuggerimenti(voci);
      r('sugg-wrap').hidden = true;
    }

    async function caricaNote() {
      const categoria = stato.categoriaId;
      stato.note = categoria && stato.tipo !== 'trasferimento' ? await noteUsate(categoria) : [];
      if (categoria === stato.categoriaId) aggiornaNota(); // ignora risposte superate da un cambio di categoria
    }

    function impostaModoNota(attivo) {
      stato.modoNota = attivo;
      radice.classList.toggle('modo-nota', attivo);
      r('editor-nota').hidden = !attivo;
      r('riga-b').hidden = attivo;
      aggiornaNota();
      if (attivo) {
        campoNota.value = stato.nota;
        campoNota.focus();
        campoNota.setSelectionRange(campoNota.value.length, campoNota.value.length);
      } else {
        campoNota.blur();
      }
    }

    function aggiornaTutto() {
      radice.dataset.tipo = stato.tipo;
      el.querySelectorAll('.ins-tipi [data-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tipo === stato.tipo)));
      aggiornaCorpo();
      aggiornaChip();
      aggiornaNota();
      aggiornaImporto();
    }

    // ---- Azioni ----

    function impostaTipo(tipo) {
      if (tipo === stato.tipo) return;
      stato.tipo = tipo;
      if (tipo === 'trasferimento') {
        stato.categoriaId = null;
        if (!stato.contoDestinazioneId || stato.contoDestinazioneId === stato.contoId) {
          stato.contoDestinazioneId = destinazioneProposta(conti, stato.contoId);
        }
      } else if (categoriaPerId(stato.categoriaId)?.tipo !== tipo) {
        stato.categoriaId = null;
      }
      if (stato.modoNota) impostaModoNota(false);
      aggiornaTutto();
      caricaNote();
    }

    function scegliCategoria(id) {
      stato.categoriaId = id;
      el.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.cat === id)));
      stato.note = [];
      aggiornaNota();
      caricaNote();
      aggiornaSalva();
    }

    async function cambiaConto(quale) {
      const campo = quale === 'a' ? 'contoDestinazioneId' : 'contoId';
      const titolo = stato.tipo === 'trasferimento' ? (quale === 'a' ? 'Trasferisci verso' : 'Trasferisci da')
        : (stato.tipo === 'spesa' ? 'Paga con' : 'Accredita su');
      const scelto = await scegliConto({ titolo, conti, selezionatoId: stato[campo] });
      if (!scelto) return;
      if (stato.tipo === 'trasferimento') {
        const altro = quale === 'a' ? 'contoId' : 'contoDestinazioneId';
        if (stato[altro] === scelto) stato[altro] = stato[campo]; // stesso conto su entrambi i lati → li scambia
      }
      stato[campo] = scelto;
      aggiornaCorpo();
      aggiornaChip();
      aggiornaSalva();
    }

    async function cambiaData() {
      const scelta = await scegliData({ data: stato.data, oggi });
      if (!scelta) return;
      stato.data = scelta;
      aggiornaChip();
    }

    function segnalaErrore(dati, errore) {
      vibra(30);
      if (!dati.importo) {
        animaClasse(r('valore').parentElement, 'scuoti');
      } else if (dati.tipo !== 'trasferimento' && !dati.categoriaId) {
        animaClasse(r('corpo'), 'sollecito');
      } else {
        mostraToast(errore);
      }
    }

    function mostraSuccesso() {
      const ok = document.createElement('div');
      ok.className = 'ins-ok';
      ok.innerHTML = `<div class="ins-ok-cerchio">${icona('check', 44)}</div><p>${modifica ? 'Modifiche salvate' : 'Salvato'}</p>`;
      radice.append(ok);
    }

    async function salva() {
      if (stato.salvando) return;
      if (stato.modoNota) impostaModoNota(false);
      const dati = datiMovimento();
      const errore = validaMovimento(dati);
      if (errore) { segnalaErrore(dati, errore); return; }

      stato.salvando = true;
      r('salva').disabled = true;
      try {
        const salvato = modifica ? await aggiornaMovimento(movimento.id, dati) : await creaMovimento(dati);
        vibra(15);
        mostraSuccesso();
        await attendi(movimentoRidotto() ? 0 : 650);
        document.dispatchEvent(new CustomEvent('spese2:movimenti', {
          detail: { id: salvato.id, data: salvato.data, azione: modifica ? 'modificato' : 'creato' },
        }));
        c.chiudi(salvato);
      } catch (errore2) {
        console.error(errore2);
        stato.salvando = false;
        r('salva').disabled = false;
        mostraToast('Non sono riuscito a salvare. Riprova.');
      }
    }

    async function elimina() {
      const descrizione = `${euro(movimento.importo)} del ${dataLunga(movimento.data)}`;
      const ok = await conferma({
        titolo: 'Eliminare il movimento?',
        testo: `${descrizione}. L'operazione non si può annullare.`,
        etichettaConferma: 'Elimina',
        pericolo: true,
      });
      if (!ok) return;
      try {
        await eliminaMovimento(movimento.id);
        document.dispatchEvent(new CustomEvent('spese2:movimenti', {
          detail: { id: movimento.id, data: movimento.data, azione: 'eliminato' },
        }));
        c.chiudi(undefined);
        mostraToast('Movimento eliminato');
      } catch (errore) {
        console.error(errore);
        mostraToast('Non sono riuscito a eliminare. Riprova.');
      }
    }

    // ---- Eventi ----

    el.addEventListener('click', (e) => {
      const bersaglio = e.target.closest('[data-az], [data-cat], [data-tipo], [data-sugg]');
      if (!bersaglio) return;
      if (bersaglio.dataset.tipo) return impostaTipo(bersaglio.dataset.tipo);
      if (bersaglio.dataset.cat) return scegliCategoria(bersaglio.dataset.cat);
      if (bersaglio.dataset.sugg !== undefined) {
        stato.nota = bersaglio.dataset.sugg;
        campoNota.value = stato.nota;
        if (stato.modoNota) impostaModoNota(false); else aggiornaNota();
        return null;
      }
      switch (bersaglio.dataset.az) {
        case 'chiudi': return c.chiudi(undefined);
        case 'salva': return salva();
        case 'elimina': return elimina();
        case 'conto': return cambiaConto('da');
        case 'scegli-da': return cambiaConto('da');
        case 'scegli-a': return cambiaConto('a');
        case 'data': return cambiaData();
        case 'nota': return impostaModoNota(true);
        case 'nota-fatto': return impostaModoNota(false);
        case 'scambia': {
          [stato.contoId, stato.contoDestinazioneId] = [stato.contoDestinazioneId, stato.contoId];
          aggiornaCorpo();
          aggiornaSalva();
          return null;
        }
        default: return null;
      }
    });

    campoNota.addEventListener('input', () => {
      stato.nota = campoNota.value;
      aggiornaNota();
    });
    campoNota.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); impostaModoNota(false); }
    });

    // Tastiera fisica (desktop): cifre, virgola, backspace, invio. Solo se questo è il pannello in cima.
    const suTastiera = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (sfondo.parentElement.lastElementChild !== sfondo) return;
      if (e.target.closest?.('input, textarea')) return;
      let tasto = null;
      if (/^\d$/.test(e.key)) tasto = e.key;
      else if (e.key === ',' || e.key === '.') tasto = ',';
      else if (e.key === 'Backspace') tasto = 'cancella';
      else if (e.key === 'Enter') { e.preventDefault(); salva(); return; }
      if (tasto) {
        stato.cifre = applicaTasto(stato.cifre, tasto);
        aggiornaImporto();
      }
    };
    document.addEventListener('keydown', suTastiera);
    c.chiuso.then(() => document.removeEventListener('keydown', suTastiera));

    aggiornaTutto();
    if (stato.categoriaId) caricaNote();
  }
}
