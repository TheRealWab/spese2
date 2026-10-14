// Importazione dalla vecchia app "le-mie-spese" (SPEC §8). Solo funzioni pure: leggono il file e
// preparano i dati da salvare, senza toccare il database (lo fa il componente della procedura guidata).
//
// Formato della vecchia app (versione 2): { app, versione, creato, mesi: { "AAAA-MM": [movimento] },
// config: { categorie, entrate, ... }, patrimonio: { conti: [{ nome, tipo, colore, storico, versatoIniziale }] } }.
// Un movimento ha: id, data, cent, cat (nome della categoria), nota, ts, conto (nome) e `tipo` assente (= spesa),
// "entrata" oppure "investimento" (versamento verso un conto investimenti).

import { dataValida, aggiungiGiorni } from '../util/date.js';
import { nuovoId } from '../util/id.js';
import { normalizzaNota } from './calcoli.js';
import { coloreVicino } from './palette.js';

export const ORIGINE = 'le-mie-spese';

export class ErroreImportazione extends Error {}

// ---- Nomi ----

const EMOJI = /[\p{Extended_Pictographic}︎️‍\u{1F3FB}-\u{1F3FF}]/gu;

/** Toglie emoji e trattini avanzati dai bordi: "Macchinette - <emoji>" diventa "Macchinette". */
export function pulisciNome(nome) {
  return String(nome ?? '')
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—·|:]+|[\s\-–—·|:]+$/g, '');
}

/** Chiave per confrontare i nomi senza badare a maiuscole, accenti e punteggiatura. */
export const chiaveNome = (nome) => pulisciNome(nome)
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const PAROLE_ICONA = [
  [/interess/, 'piggy-bank'], [/stipend|paga|salari/, 'wallet'], [/regal/, 'gift'], [/rimbors/, 'undo-2'],
  [/affitt|casa|bolletta/, 'house'], [/supermerc|aliment|spesa/, 'shopping-cart'], [/benzin|diesel|auto|trasport/, 'car'],
  [/bar|caff/, 'coffee'], [/ristor|cena|pranzo/, 'utensils'], [/salute|farmac|medic/, 'pill'],
];

export function iconaSuggerita(nome, tipo) {
  const chiave = chiaveNome(nome);
  return PAROLE_ICONA.find(([schema]) => schema.test(chiave))?.[1] ?? (tipo === 'entrata' ? 'banknote' : 'tag');
}

// ---- Lettura del file ----

/** Legge il testo del file e restituisce i dati, oppure lancia ErroreImportazione con un messaggio in italiano. */
export function leggiEsportazione(testo) {
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new ErroreImportazione('Il file non è leggibile: non sembra un file di esportazione.');
  }
  if (dati?.app !== ORIGINE) throw new ErroreImportazione('Questo file non arriva dalla vecchia app Spese.');
  if (typeof dati.mesi !== 'object' || dati.mesi === null) throw new ErroreImportazione('Nel file non ci sono movimenti.');
  return dati;
}

const TIPI_VECCHI = ['spesa', 'entrata', 'investimento'];

/**
 * Trasforma i dati grezzi in una descrizione ordinata: movimenti validi, movimenti scartati (con il motivo),
 * categorie e conti trovati, periodo coperto.
 */
export function analizza(dati) {
  const scartati = [];
  const movimenti = [];
  const conteggioChiavi = new Map(); // per dare un id stabile ai movimenti senza id
  let indice = 0;

  for (const lista of Object.values(dati.mesi ?? {})) {
    if (!Array.isArray(lista)) continue;
    for (const m of lista) {
      indice += 1;
      const tipo = m?.tipo ?? 'spesa';
      if (!TIPI_VECCHI.includes(tipo)) { scartati.push({ indice, motivo: `tipo "${tipo}" non riconosciuto` }); continue; }
      if (!Number.isInteger(m.cent) || m.cent <= 0) { scartati.push({ indice, motivo: 'importo non valido' }); continue; }
      if (!dataValida(m.data)) { scartati.push({ indice, motivo: 'data non valida' }); continue; }
      const categoria = pulisciNome(m.cat);
      if (tipo !== 'investimento' && !categoria) { scartati.push({ indice, motivo: 'categoria mancante' }); continue; }

      const nota = normalizzaNota(m.nota);
      const conto = pulisciNome(m.conto) || null;
      let idOrigine = m.id ? String(m.id) : null;
      if (!idOrigine) {
        const chiave = [m.data, m.cent, tipo, categoria, nota, conto].join('|');
        const n = (conteggioChiavi.get(chiave) ?? 0) + 1;
        conteggioChiavi.set(chiave, n);
        idOrigine = `senza-id:${chiave}:${n}`;
      }
      movimenti.push({ idOrigine, tipo, importo: m.cent, data: m.data, categoria, nota, conto, ts: Number.isFinite(m.ts) ? m.ts : null });
    }
  }

  // Categorie: quelle configurate più quelle usate dai movimenti (i versamenti investimento non sono categorie).
  const categorie = new Map();
  const aggiungiCategoria = (nome, tipo, colore) => {
    const pulito = pulisciNome(nome);
    if (!pulito) return;
    const chiave = `${tipo}|${chiaveNome(pulito)}`;
    if (!categorie.has(chiave)) categorie.set(chiave, { chiave, nome: pulito, tipo, coloreVecchio: colore ?? null, usi: 0 });
  };
  for (const c of dati.config?.categorie ?? []) aggiungiCategoria(c?.nome, 'spesa', c?.colore);
  for (const c of dati.config?.entrate ?? []) aggiungiCategoria(c?.nome, 'entrata', c?.colore);
  for (const m of movimenti) {
    if (m.tipo === 'investimento') continue;
    aggiungiCategoria(m.categoria, m.tipo, null);
    categorie.get(`${m.tipo}|${chiaveNome(m.categoria)}`).usi += 1;
  }

  // Conti: quelli del patrimonio più quelli citati nei movimenti.
  const conti = new Map();
  for (const c of dati.patrimonio?.conti ?? []) {
    const nome = pulisciNome(c?.nome);
    if (!nome) continue;
    const storico = (Array.isArray(c.storico) ? c.storico : [])
      .filter((s) => dataValida(s?.data) && Number.isInteger(s?.cent))
      .sort((a, b) => a.data.localeCompare(b.data) || (a.ts ?? 0) - (b.ts ?? 0));
    conti.set(chiaveNome(nome), {
      chiave: chiaveNome(nome),
      nome,
      tipoVecchio: c.tipo === 'investimento' ? 'investimento' : 'liquidita',
      coloreVecchio: c.colore ?? null,
      storico,
      versato: Number.isInteger(c.versatoIniziale) && c.versatoIniziale > 0 ? c.versatoIniziale : null,
      usi: 0,
    });
  }
  let senzaConto = 0;
  for (const m of movimenti) {
    if (!m.conto) { senzaConto += 1; continue; }
    const chiave = chiaveNome(m.conto);
    if (!conti.has(chiave)) {
      conti.set(chiave, { chiave, nome: m.conto, tipoVecchio: 'liquidita', coloreVecchio: null, storico: [], versato: null, usi: 0 });
    }
    conti.get(chiave).usi += 1;
  }

  const date = movimenti.map((m) => m.data).sort();
  return {
    movimenti,
    scartati,
    categorie: [...categorie.values()],
    conti: [...conti.values()],
    senzaConto,
    periodo: date.length ? { da: date[0], a: date[date.length - 1] } : null,
    conteggi: {
      spese: movimenti.filter((m) => m.tipo === 'spesa').length,
      entrate: movimenti.filter((m) => m.tipo === 'entrata').length,
      versamenti: movimenti.filter((m) => m.tipo === 'investimento').length,
    },
  };
}

// ---- Abbinamenti proposti ----

/**
 * Propone come abbinare categorie e conti della vecchia app a quelli già presenti:
 * per nome quando coincidono; per i conti rimasti, un conto "vuoto" dello stesso tipo, altrimenti uno nuovo.
 */
export function proponiAbbinamenti(analisi, categorieEsistenti, contiEsistenti, contoPredefinitoId = null) {
  const perChiave = new Map(categorieEsistenti.filter((c) => !c.archiviata).map((c) => [`${c.tipo}|${chiaveNome(c.nome)}`, c]));
  const categorie = analisi.categorie.map((v) => {
    const trovata = perChiave.get(v.chiave);
    return {
      chiave: v.chiave, nome: v.nome, tipo: v.tipo, usi: v.usi,
      azione: trovata ? 'esistente' : 'nuova',
      id: trovata?.id ?? null,
      automatico: Boolean(trovata),
      nuova: { nome: v.nome, icona: iconaSuggerita(v.nome, v.tipo), colore: coloreVicino(v.coloreVecchio) },
    };
  });

  const attivi = contiEsistenti.filter((c) => !c.archiviato);
  const perNome = new Map(attivi.map((c) => [chiaveNome(c.nome), c]));
  const occupati = new Set();
  const conti = analisi.conti.map((v) => {
    const trovato = perNome.get(v.chiave);
    if (trovato) occupati.add(trovato.id);
    return {
      chiave: v.chiave, nome: v.nome, tipoVecchio: v.tipoVecchio, usi: v.usi, storico: v.storico, versato: v.versato,
      azione: trovato ? 'esistente' : null, id: trovato?.id ?? null, rinomina: false, automatico: Boolean(trovato),
      nuovo: {
        nome: v.nome,
        tipo: v.tipoVecchio === 'investimento' ? 'investimenti' : 'conto',
        icona: v.tipoVecchio === 'investimento' ? 'trending-up' : 'landmark',
        colore: coloreVicino(v.coloreVecchio),
      },
    };
  });
  // Conti senza corrispondenza: si propone un conto esistente ancora vuoto dello stesso tipo (da rinominare).
  for (const c of conti.filter((x) => !x.azione)) {
    const libero = attivi.find((e) => !occupati.has(e.id) && e.saldoIniziale === 0
      && (c.tipoVecchio === 'investimento' ? e.tipo === 'investimenti' : e.tipo === 'conto'));
    if (libero) {
      occupati.add(libero.id);
      Object.assign(c, { azione: 'esistente', id: libero.id, rinomina: true });
    } else {
      c.azione = 'nuovo';
    }
  }

  const senzaConto = attivi.some((c) => c.id === contoPredefinitoId) ? contoPredefinitoId : (attivi[0]?.id ?? null);
  return { categorie, conti, contoSenzaConto: senzaConto };
}

// ---- Conversione ----

/**
 * Costruisce gli oggetti da salvare. `scelte` è l'esito (eventualmente corretto dall'utente) di proponiAbbinamenti.
 * Non scrive nulla: restituisce { categorie, conti, valoriInvestimento, movimenti, duplicati, scartati }.
 *
 * Contesto: categorieEsistenti, contiEsistenti, giaImportati (Set di origineId già presenti: evita i doppioni),
 * generaId (per i test), adesso (ISO).
 */
export function converti(analisi, scelte, contesto) {
  const { categorieEsistenti, contiEsistenti, giaImportati = new Set(), generaId = nuovoId, adesso = new Date().toISOString() } = contesto;
  const scartati = [...analisi.scartati];

  // Categorie
  const idCategoria = new Map();
  const nuoveCategorie = [];
  let ordineCategoria = Math.max(-1, ...categorieEsistenti.map((c) => c.ordine ?? 0)) + 1;
  for (const s of scelte.categorie) {
    if (s.azione === 'esistente') { idCategoria.set(s.chiave, s.id); continue; }
    const chiaveNuova = `${s.tipo}|${chiaveNome(s.nuova.nome)}`;
    if (!idCategoria.has(chiaveNuova)) {
      const nuova = { id: generaId(), nome: s.nuova.nome, tipo: s.tipo, icona: s.nuova.icona, colore: s.nuova.colore, ordine: ordineCategoria++, archiviata: false };
      nuoveCategorie.push(nuova);
      idCategoria.set(chiaveNuova, nuova.id);
    }
    idCategoria.set(s.chiave, idCategoria.get(chiaveNuova));
  }

  // Conti
  const primoGiorno = analisi.periodo?.da ?? null;
  const giornoPrima = primoGiorno ? aggiungiGiorni(primoGiorno, -1) : adesso.slice(0, 10);
  const esistentiPerId = new Map(contiEsistenti.map((c) => [c.id, c]));
  const idConto = new Map();
  const contiDaSalvare = new Map();
  const valoriInvestimento = [];
  let ordineConto = Math.max(-1, ...contiEsistenti.map((c) => c.ordine ?? 0)) + 1;

  for (const s of scelte.conti) {
    const investimento = s.tipoVecchio === 'investimento';
    const ultimo = s.storico.at(-1) ?? null;
    // Per i conti investimenti lo storico è l'andamento del valore, il "versato iniziale" è il saldo di partenza.
    const saldoBase = investimento ? { cent: s.versato ?? 0, data: giornoPrima } : (ultimo ? { cent: ultimo.cent, data: ultimo.data } : { cent: 0, data: giornoPrima });

    let conto;
    if (s.azione === 'esistente') {
      const attuale = esistentiPerId.get(s.id);
      conto = { ...attuale };
      if (s.rinomina) conto.nome = s.nome;
      if (attuale.saldoIniziale === 0) { conto.saldoIniziale = saldoBase.cent; conto.dataSaldoIniziale = saldoBase.data; } // mai sovrascrivere un saldo già inserito
    } else {
      conto = {
        id: generaId(), nome: s.nuovo.nome, tipo: s.nuovo.tipo, icona: s.nuovo.icona, colore: s.nuovo.colore,
        saldoIniziale: saldoBase.cent, dataSaldoIniziale: saldoBase.data, ordine: ordineConto++, archiviato: false,
      };
    }
    idConto.set(s.chiave, conto.id);
    contiDaSalvare.set(conto.id, conto);

    if (investimento) {
      for (const v of s.storico) {
        const origineId = `${ORIGINE}:valore:${s.chiave}:${v.data}`;
        if (!giaImportati.has(origineId)) valoriInvestimento.push({ id: generaId(), contoId: conto.id, data: v.data, valore: v.cent, origineId });
      }
    }
  }

  const destinazioneVersamenti = (m) => {
    // Il versamento ha come "categoria" il nome del conto investimenti di destinazione.
    const daNome = scelte.conti.find((c) => c.chiave === chiaveNome(m.categoria) && c.tipoVecchio === 'investimento');
    if (daNome) return idConto.get(daNome.chiave);
    const unico = scelte.conti.find((c) => c.tipoVecchio === 'investimento');
    return unico ? idConto.get(unico.chiave) : null;
  };

  // Movimenti
  const movimenti = [];
  let duplicati = 0;
  for (const m of analisi.movimenti) {
    const origineId = `${ORIGINE}:${m.idOrigine}`;
    if (giaImportati.has(origineId)) { duplicati += 1; continue; }
    const contoId = m.conto ? idConto.get(chiaveNome(m.conto)) : scelte.contoSenzaConto;
    if (!contoId) { scartati.push({ motivo: 'conto non abbinato' }); continue; }
    const creatoIl = m.ts ? new Date(m.ts).toISOString() : adesso;
    const comune = { id: generaId(), importo: m.importo, data: m.data, contoId, nota: m.nota, ricorrenteId: null, creatoIl, modificatoIl: creatoIl, origineId };

    if (m.tipo === 'investimento') {
      const destinazione = destinazioneVersamenti(m);
      if (!destinazione || destinazione === contoId) { scartati.push({ motivo: 'versamento senza conto di destinazione' }); continue; }
      movimenti.push({ ...comune, tipo: 'trasferimento', categoriaId: null, contoDestinazioneId: destinazione });
    } else {
      const categoriaId = idCategoria.get(`${m.tipo}|${chiaveNome(m.categoria)}`);
      if (!categoriaId) { scartati.push({ motivo: 'categoria non abbinata' }); continue; }
      movimenti.push({ ...comune, tipo: m.tipo, categoriaId, contoDestinazioneId: null });
    }
  }

  return { categorie: nuoveCategorie, conti: [...contiDaSalvare.values()], valoriInvestimento, movimenti, duplicati, scartati };
}

// ---- Controllo dei saldi ----

/**
 * Saldo di un conto alla fine di oggi: saldo iniziale + i movimenti DOPO la data del saldo iniziale
 * (il saldo iniziale vale a fine giornata di quella data). Entrate +, spese −, trasferimenti − in uscita e + in arrivo.
 */
export function saldoCalcolato(conto, movimenti) {
  let saldo = conto.saldoIniziale ?? 0;
  for (const m of movimenti) {
    if (m.data <= conto.dataSaldoIniziale) continue;
    if (m.tipo === 'entrata' && m.contoId === conto.id) saldo += m.importo;
    else if (m.tipo === 'spesa' && m.contoId === conto.id) saldo -= m.importo;
    else if (m.tipo === 'trasferimento') {
      if (m.contoId === conto.id) saldo -= m.importo;
      if (m.contoDestinazioneId === conto.id) saldo += m.importo;
    }
  }
  return saldo;
}
