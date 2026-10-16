// Crea o modifica un conto (SPEC §6.3): nome, tipo, icona, colore e saldo iniziale; per quelli esistenti anche
// archivia/ripristina. Risolve con l'esito, oppure undefined se si chiude senza fare nulla.

import { apriPannello } from './pannello.js';
import { conferma } from './selettori.js';
import { scegliIcona } from './selettore-icona.js';
import { mostraToast } from './toast.js';
import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { oggiIso, aggiungiGiorni, dataValida } from '../util/date.js';
import { euro, dataBreve, leggiImporto, centesimiInDigitato } from '../util/formato.js';
import { tutti } from '../db.js';
import { impostazioni } from '../model/impostazioni.js';
import { tuttiIContiInMemoria, contoPerId } from '../model/catalogo.js';
import { COLORI_CATEGORIA } from '../model/palette.js';
import {
  TIPI_CONTO, ETICHETTA_TIPO_CONTO, LUNGHEZZA_MAX_NOME_CONTO, ICONA_PREDEFINITA_CONTO, coloreContoSuggerito, puoArchiviareConto,
} from '../model/conti.js';
import { creaStoriaConto, movimentiEsclusi, dateCompatibili } from '../model/patrimonio.js';
import { ErroreConto, creaConto, aggiornaConto, archiviaConto, tuttiIValori } from '../model/conti-db.js';

const ETICHETTA_COLORE = {
  corallo: 'Corallo', arancio: 'Arancio', ambra: 'Ambra', lime: 'Lime', verde: 'Verde', smeraldo: 'Smeraldo', turchese: 'Turchese',
  ciano: 'Ciano', azzurro: 'Azzurro', blu: 'Blu', indaco: 'Indaco', viola: 'Viola', fucsia: 'Fucsia', rosa: 'Rosa', ardesia: 'Ardesia',
};
const DESCRIZIONE_TIPO = {
  conto: 'Conto corrente, carta, risparmio', 'liquidità': 'Contanti e simili', investimenti: 'Il valore si aggiorna a mano', altro: 'Qualsiasi altro conto',
};

/** @param {{contoId?: string|null}} opzioni  senza `contoId` se ne crea uno nuovo */
export function apriEditorConto({ contoId = null } = {}) {
  const esistente = contoId ? contoPerId(contoId) : null;
  const oggi = oggiIso();
  const stato = {
    tipo: esistente?.tipo ?? 'conto',
    nome: esistente?.nome ?? '',
    icona: esistente?.icona ?? ICONA_PREDEFINITA_CONTO.conto,
    colore: esistente?.colore ?? coloreContoSuggerito(tuttiIContiInMemoria()),
    saldo: esistente ? centesimiInDigitato(esistente.saldoIniziale) : '',
    // Un conto nuovo parte da ieri: così anche i movimenti di oggi (per esempio un trasferimento verso questo conto) si sommano al saldo.
    data: esistente?.dataSaldoIniziale ?? aggiungiGiorni(oggi, -1),
    errore: '',
    salvando: false,
    movimentiConto: [], // i movimenti del conto (per avvisare di quelli che il saldo iniziale non conta)
    valori: [], // i valori dell'investimento, per l'anteprima del saldo
    obiettivo: '', // "il saldo che dovrebbe risultare oggi", per cercare la data giusta
    trovate: null, // risultato della ricerca: { esatti, vicini } oppure null
  };
  let radice = null;

  const ctrl = apriPannello({
    tipo: 'pieno',
    etichetta: esistente ? 'Modifica conto' : 'Nuovo conto',
    riempi(el, c) {
      radice = el;
      el.addEventListener('click', (e) => suTocco(e, c));
      el.addEventListener('input', (e) => {
        if (e.target.id === 'ec-nome') stato.nome = e.target.value;
        else if (e.target.id === 'ec-saldo') { stato.saldo = e.target.value; aggiornaAvvisi(); }
        else if (e.target.id === 'ec-data') { stato.data = e.target.value; aggiornaAvvisi(); }
        else if (e.target.id === 'ec-obiettivo') stato.obiettivo = e.target.value;
        else return;
        if (stato.errore) segnalaErrore('');
      });
      el.addEventListener('submit', (e) => { e.preventDefault(); salvaTutto(c); });
      disegna();
      if (esistente) {
        Promise.all([tutti('movimenti'), tuttiIValori()]).then(([movimenti, valori]) => {
          stato.movimentiConto = movimenti.filter((m) => m.contoId === esistente.id || m.contoDestinazioneId === esistente.id);
          stato.valori = valori.filter((v) => v.contoId === esistente.id);
          aggiornaAvvisi();
        });
      }
    },
  });
  return ctrl.chiuso;

  // ------------------------------------------------------------------------------------------

  function eInvestimento() { return stato.tipo === 'investimenti'; }
  function contoCorrente() { return esistente ? (contoPerId(esistente.id) ?? esistente) : null; }

  function disegna() {
    const nuovo = !esistente;
    const corrente = contoCorrente();
    radice.innerHTML = `
      <div class="flusso col-${esc(stato.colore)}">
        <header class="flusso-testata">
          <button type="button" class="btn-icona" data-az="chiudi" aria-label="Chiudi">${icona('x', 24)}</button>
          <h2 class="flusso-titolo">${nuovo ? 'Nuovo conto' : 'Modifica conto'}</h2>
        </header>
        <form class="flusso-corpo" id="form-conto" autocomplete="off" novalidate>
          <section class="scheda ed-anteprima">
            ${cerchioIcona(stato.icona, stato.colore, 72)}
            <div class="campo">
              <label for="ec-nome">Nome</label>
              <input id="ec-nome" class="campo-testo" type="text" maxlength="${LUNGHEZZA_MAX_NOME_CONTO}" value="${esc(stato.nome)}"
                     placeholder="Per esempio Conto risparmio" enterkeyhint="next" autocapitalize="sentences">
            </div>
          </section>

          ${nuovo ? `
            <section class="gruppo">
              <h3 class="gruppo-titolo">Tipo di conto</h3>
              <div class="scheda">
                ${TIPI_CONTO.map((t) => `
                  <button type="button" class="riga-lista" role="radio" aria-checked="${t === stato.tipo}" data-tipo="${t}">
                    <span class="riga-testo"><span class="riga-titolo">${ETICHETTA_TIPO_CONTO[t]}</span><span class="riga-sotto">${DESCRIZIONE_TIPO[t]}</span></span>
                    ${t === stato.tipo ? `<span class="opzione-spunta">${icona('check', 22)}</span>` : ''}
                  </button>`).join('')}
              </div>
            </section>` : `<p class="flusso-guida">Conto di tipo «${esc(ETICHETTA_TIPO_CONTO[stato.tipo] ?? '')}»${corrente?.archiviato ? ' · archiviato' : ''}.</p>`}

          <section class="gruppo">
            <h3 class="gruppo-titolo">${eInvestimento() ? 'Versato iniziale' : 'Saldo iniziale'}</h3>
            <div class="scheda ec-saldo">
              <div class="campo">
                <label for="ec-saldo">${eInvestimento() ? 'Quanto avevi già versato (€)' : 'Quanto c\'era sul conto (€)'}</label>
                <input id="ec-saldo" class="campo-testo" type="text" inputmode="decimal" placeholder="0" value="${esc(stato.saldo)}">
              </div>
              <div class="campo">
                <label for="ec-data">Saldo a fine giornata del</label>
                <input id="ec-data" class="campo-data" type="date" value="${esc(stato.data)}">
              </div>
              <p class="nota-fondo">I movimenti dei giorni dopo questa data si sommano al saldo iniziale; quelli di questo giorno o precedenti no, perché il saldo li comprende già.${nuovo ? ' Per un conto nuovo la data è ieri, così contano anche i movimenti di oggi.' : ''} Il saldo può essere negativo (carta di credito, scoperto).</p>
              ${nuovo ? '' : '<p class="ec-anteprima" role="status" aria-live="polite" data-r="anteprima-saldo"></p>'}
              <p class="flusso-errore" role="status" data-r="avviso-data" hidden>${icona('triangle-alert', 18)}<span></span></p>
              ${nuovo ? '' : htmlTrovaData()}
            </div>
          </section>

          <div class="scheda">
            <button type="button" class="riga-lista" data-az="icona">
              ${cerchioIcona(stato.icona, stato.colore, 40)}
              <span class="riga-testo"><span class="riga-titolo">Icona</span><span class="riga-sotto">Tocca per cambiarla o cercarne un'altra</span></span>${icona('chevron-right', 18)}
            </button>
          </div>

          <section class="gruppo">
            <h3 class="gruppo-titolo">Colore</h3>
            <div class="ed-colori" role="radiogroup" aria-label="Colore">
              ${COLORI_CATEGORIA.map((col) => `
                <button type="button" class="ed-colore col-${col}" role="radio" aria-checked="${col === stato.colore}" aria-label="${ETICHETTA_COLORE[col]}" data-colore="${col}">
                  <span class="ed-pallino">${col === stato.colore ? icona('check', 18) : ''}</span>
                </button>`).join('')}
            </div>
          </section>

          ${nuovo ? '' : htmlArchivia(corrente)}
          <p class="flusso-errore" role="alert" data-r="errore" ${stato.errore ? '' : 'hidden'}>${icona('triangle-alert', 18)}<span>${esc(stato.errore)}</span></p>
        </form>
        <footer class="flusso-piede">
          <button type="button" class="pulsante pulsante-grande" data-az="salva" ${stato.salvando ? 'disabled' : ''}>${nuovo ? 'Crea il conto' : 'Salva le modifiche'}</button>
        </footer>
      </div>`;
    aggiornaAvvisi();
  }

  /** «Il saldo non torna?»: si scrive il saldo giusto di oggi e l'app cerca la data del saldo iniziale che lo produce. */
  function htmlTrovaData() {
    const t = stato.trovate;
    let risultati = '';
    if (t) {
      const voce = (r) => `<button type="button" class="riga-lista" data-az="usa-data" data-d="${esc(r.data)}"><span class="riga-testo"><span class="riga-titolo">${esc(dataBreve(r.data))}</span><span class="riga-sotto">Saldo di oggi: ${esc(euro(r.saldo))}</span></span><span class="badge">Usa</span></button>`;
      if (t.esatti.length) {
        risultati = `<p class="riga-sotto">Queste date danno proprio ${esc(euro(leggiImporto(stato.obiettivo) ?? 0))}. Tocca quella che ti sembra giusta (di solito la più recente):</p><div class="scheda">${t.esatti.slice(0, 5).map(voce).join('')}</div>`;
      } else if (t.vicini.length) {
        risultati = `<p class="riga-sotto">Nessuna data dà esattamente quella cifra, forse è cambiato anche il saldo iniziale. Le più vicine:</p><div class="scheda">${t.vicini.map(voce).join('')}</div>`;
      } else {
        risultati = '<p class="riga-sotto">Questo conto non ha ancora movimenti: non c\'è nessuna data da cercare.</p>';
      }
    }
    return `
      <div class="ec-trova">
        <p class="riga-titolo">Il saldo non torna?</p>
        <p class="riga-sotto">Scrivi quanto dovrebbe risultare oggi (per esempio quello della tua banca) e cerco la data giusta.</p>
        <div class="ec-trova-riga">
          <input id="ec-obiettivo" class="campo-testo" type="text" inputmode="decimal" placeholder="Per esempio 17.945,00" value="${esc(stato.obiettivo)}">
          <button type="button" class="chip" data-az="trova-data">${icona('search', 16)} Trova la data</button>
        </div>
        ${risultati}
      </div>`;
  }

  function trovaData() {
    ricorda();
    const obiettivo = leggiImporto(stato.obiettivo);
    if (obiettivo === null) { segnalaErrore('Scrivi il saldo giusto, per esempio 17.945,00.'); return; }
    const saldoIniziale = stato.saldo.trim() === '' ? 0 : leggiImporto(stato.saldo);
    if (saldoIniziale === null) { segnalaErrore('Il saldo iniziale non è valido.'); return; }
    stato.trovate = dateCompatibili({ ...esistente, saldoIniziale }, stato.movimentiConto, stato.valori, obiettivo, oggi);
    stato.errore = '';
    disegna();
  }

  function aggiornaAvvisi() {
    aggiornaAvvisoData();
    aggiornaAnteprimaSaldo();
  }

  /** Mostra quanto varrebbe il saldo di oggi con i dati scritti nel modulo, accanto a quello di adesso: si confronta con la banca prima di salvare. */
  function aggiornaAnteprimaSaldo() {
    const campo = radice?.querySelector('[data-r="anteprima-saldo"]');
    if (!campo || !esistente) return;
    const saldoNuovo = stato.saldo.trim() === '' ? 0 : leggiImporto(stato.saldo);
    if (saldoNuovo === null || !dataValida(stato.data)) { campo.textContent = ''; return; }
    const calcola = (conto) => creaStoriaConto(conto, stato.movimentiConto, stato.valori).saldoAl(oggi);
    const con = calcola({ ...esistente, saldoIniziale: saldoNuovo, dataSaldoIniziale: stato.data });
    const adesso = calcola(contoCorrente() ?? esistente);
    campo.textContent = con === adesso
      ? `Saldo di oggi: ${euro(con)}`
      : `Con questi dati il saldo di oggi è ${euro(con)} (ora è ${euro(adesso)}). Controllalo con la tua banca prima di salvare.`;
  }

  /** Avvisa se la data scelta lascia fuori dal saldo dei movimenti già registrati su questo conto. */
  function aggiornaAvvisoData() {
    const campo = radice?.querySelector('[data-r="avviso-data"]');
    if (!campo) return;
    const esclusi = dataValida(stato.data) ? movimentiEsclusi({ id: esistente?.id, dataSaldoIniziale: stato.data }, stato.movimentiConto) : [];
    campo.hidden = esclusi.length === 0;
    if (esclusi.length) {
      const frase = esclusi.length === 1
        ? "C'è 1 movimento registrato nell'app, di questo conto, che non viene sommato al saldo perché è del giorno del saldo iniziale o precedente."
        : `Ci sono ${esclusi.length} movimenti registrati nell'app, di questo conto, che non vengono sommati al saldo perché sono del giorno del saldo iniziale o precedenti.`;
      campo.querySelector('span').textContent = `${frase} Se il conto è nuovo, scegli una data precedente al più vecchio. Quelli importati dalla vecchia app sono già nel saldo iniziale.`;
    }
  }

  function htmlArchivia(corrente) {
    if (!corrente) return '';
    const archiviato = corrente.archiviato;
    return `
      <section class="gruppo">
        <h3 class="gruppo-titolo">Altre azioni</h3>
        <div class="scheda">
          <button type="button" class="riga-lista" data-az="${archiviato ? 'ripristina' : 'archivia'}">
            <span class="cerchio cerchio-neutro">${icona(archiviato ? 'rotate-ccw' : 'inbox', 20)}</span>
            <span class="riga-testo"><span class="riga-titolo">${archiviato ? 'Ripristina' : 'Archivia'}</span><span class="riga-sotto">${archiviato ? 'Torna nel patrimonio e nell\'inserimento' : 'Non conta più nel patrimonio; i movimenti restano'}</span></span>${icona('chevron-right', 18)}
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

  async function salvaTutto(c) {
    if (stato.salvando) return;
    const saldoIniziale = stato.saldo.trim() === '' ? 0 : leggiImporto(stato.saldo);
    if (saldoIniziale === null) { segnalaErrore('Il saldo iniziale non è valido: scrivi per esempio 1.250,00.'); radice.querySelector('#ec-saldo')?.focus(); return; }
    stato.salvando = true;
    radice.querySelector('[data-az="salva"]')?.setAttribute('disabled', '');
    try {
      if (esistente) {
        const prima = { nome: esistente.nome, icona: esistente.icona, colore: esistente.colore, saldoIniziale: esistente.saldoIniziale, dataSaldoIniziale: esistente.dataSaldoIniziale };
        await aggiornaConto(esistente.id, { nome: stato.nome, icona: stato.icona, colore: stato.colore, saldoIniziale, dataSaldoIniziale: stato.data });
        // Se cambiano saldo o data (si sposta il saldo del conto) si può annullare: i valori di prima tornano subito.
        const cambiato = prima.saldoIniziale !== saldoIniziale || prima.dataSaldoIniziale !== stato.data;
        mostraToast('Modifiche salvate', cambiato
          ? { durata: 9000, azione: { etichetta: 'Annulla', alClick: () => aggiornaConto(esistente.id, prima).then(() => mostraToast('Saldo riportato a com\'era')).catch(console.error) } }
          : {});
        c.chiudi({ azione: 'modificato', id: esistente.id });
      } else {
        const creato = await creaConto({ nome: stato.nome, tipo: stato.tipo, icona: stato.icona, colore: stato.colore, saldoIniziale, dataSaldoIniziale: stato.data });
        mostraToast(`Conto «${creato.nome}» creato`);
        c.chiudi({ azione: 'creato', id: creato.id });
      }
    } catch (e) {
      stato.salvando = false;
      radice.querySelector('[data-az="salva"]')?.removeAttribute('disabled');
      if (e instanceof ErroreConto) { segnalaErrore(e.message); radice.querySelector('#ec-nome')?.focus(); return; }
      console.error(e);
      segnalaErrore('Non sono riuscito a salvare. Riprova.');
    }
  }

  async function archivia(c, archiviato) {
    const corrente = contoCorrente();
    if (archiviato) {
      const permesso = puoArchiviareConto(corrente, tuttiIContiInMemoria(), impostazioni().contoPredefinito);
      if (!permesso.ok) { segnalaErrore(permesso.motivo); return; }
      const [movimenti, valori] = await Promise.all([tutti('movimenti'), tuttiIValori()]);
      const saldo = creaStoriaConto(corrente, movimenti, valori).saldoAl(oggi);
      if (saldo !== 0) {
        const ok = await conferma({
          titolo: 'Archiviare il conto?',
          testo: `«${corrente.nome}» ha un saldo di ${euro(saldo)}: archiviandolo non conterà più nel patrimonio. Potrai ripristinarlo quando vuoi.`,
          etichettaConferma: 'Archivia',
        });
        if (!ok) return;
      }
    }
    try {
      await archiviaConto(corrente.id, archiviato);
      mostraToast(archiviato ? 'Conto archiviato' : 'Conto ripristinato', archiviato
        ? { azione: { etichetta: 'Annulla', alClick: () => archiviaConto(corrente.id, false).catch(console.error) } }
        : {});
      c.chiudi({ azione: archiviato ? 'archiviato' : 'ripristinato', id: corrente.id });
    } catch (e) {
      console.error(e);
      segnalaErrore(e instanceof ErroreConto ? e.message : 'Non sono riuscito a completare l\'operazione.');
    }
  }

  async function suTocco(e, c) {
    const az = e.target.closest('[data-az]')?.dataset.az;
    const colore = e.target.closest('[data-colore]')?.dataset.colore;
    const nuovoTipo = e.target.closest('[data-tipo]')?.dataset.tipo;
    if (colore) { stato.colore = colore; ricorda(); disegna(); return; }
    if (nuovoTipo && nuovoTipo !== stato.tipo) {
      // Se l'icona è ancora quella di default del tipo precedente, passa a quella del nuovo tipo.
      if (stato.icona === ICONA_PREDEFINITA_CONTO[stato.tipo]) stato.icona = ICONA_PREDEFINITA_CONTO[nuovoTipo];
      stato.tipo = nuovoTipo;
      stato.errore = '';
      ricorda();
      disegna();
      return;
    }
    switch (az) {
      case 'chiudi': c.chiudi(undefined); break;
      case 'salva': await salvaTutto(c); break;
      case 'icona': {
        const scelta = await scegliIcona({ colore: stato.colore, selezionata: stato.icona });
        if (scelta) { stato.icona = scelta; disegna(); }
        break;
      }
      case 'trova-data': trovaData(); break;
      case 'usa-data': {
        ricorda();
        stato.data = e.target.closest('[data-d]').dataset.d;
        stato.trovate = null;
        disegna();
        mostraToast('Data impostata: controlla il saldo qui sopra, poi salva');
        break;
      }
      case 'archivia': await archivia(c, true); break;
      case 'ripristina': await archivia(c, false); break;
      default: break;
    }
  }

  /** Prima di ridisegnare si salvano i campi di testo digitati (il ridisegno li ricrea). */
  function ricorda() {
    for (const [id, chiave] of [['ec-nome', 'nome'], ['ec-saldo', 'saldo'], ['ec-data', 'data'], ['ec-obiettivo', 'obiettivo']]) {
      const campo = radice.querySelector(`#${id}`);
      if (campo) stato[chiave] = campo.value;
    }
  }
}
