// Movimenti ricorrenti (SPEC §7). Solo funzioni pure: date delle scadenze, validazione, descrizioni. Importi in centesimi.
//
//   Ricorrente: id, modello { tipo, importo, categoriaId, contoId, contoDestinazioneId, nota },
//   frequenza ("settimanale" | "mensile" | "annuale" | "ogni_n"),
//   giornoSettimana (0 = lunedì … 6 = domenica) per "settimanale",
//   giornoDelMese (1–31 oppure "ultimo") per "mensile",
//   intervallo (n) e unita ("giorni" | "settimane" | "mesi") per "ogni_n",
//   dataInizio, dataFine (facoltativa), modalita ("automatico" | "conferma"), attivo,
//   ultimaGenerazione: l'ultima scadenza già chiusa (registrata, confermata o saltata) — da lì si riparte.

import {
  daIso, aIso, aggiungiGiorni, aggiungiMesi, giorniNelMese, dataValida, giornoSettimana,
} from '../util/date.js';
import { dataBreve, nomeMese } from '../util/formato.js';
import { TIPI } from './movimenti.js';

export const FREQUENZE = ['settimanale', 'mensile', 'annuale', 'ogni_n'];
export const UNITA = ['giorni', 'settimane', 'mesi'];
export const MODALITA = ['automatico', 'conferma'];
/** Per ogni ricorrente e a ogni apertura si registrano al massimo tante scadenze (le altre arrivano dopo). */
export const MAX_PER_APERTURA = 120;

const NOMI_GIORNO = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
export const NOME_GIORNO_SETTIMANA = NOMI_GIORNO;
const MAX_PASSI = 100000; // rete di sicurezza contro cicli infiniti

/** Modalità proposta alla creazione: le entrate (stipendio) con conferma, il resto automatico. */
export const modalitaPredefinita = (tipo) => (tipo === 'entrata' ? 'conferma' : 'automatico');

// ---- Date delle scadenze ----

/** La k-esima data teorica (k = 0, 1, 2…) della serie, prima di tagliare con inizio e fine. */
function dataTeorica(r, k) {
  const inizio = daIso(r.dataInizio);
  if (r.frequenza === 'settimanale') {
    const primo = aggiungiGiorni(r.dataInizio, (r.giornoSettimana - giornoSettimana(r.dataInizio) + 7) % 7);
    return aggiungiGiorni(primo, 7 * k);
  }
  if (r.frequenza === 'mensile') {
    const totale = inizio.a * 12 + (inizio.m - 1) + k;
    const a = Math.floor(totale / 12);
    const m = (totale % 12) + 1;
    const ultimo = giorniNelMese(a, m);
    return aIso(a, m, r.giornoDelMese === 'ultimo' ? ultimo : Math.min(r.giornoDelMese, ultimo));
  }
  if (r.frequenza === 'annuale') {
    const a = inizio.a + k;
    return aIso(a, inizio.m, Math.min(inizio.g, giorniNelMese(a, inizio.m)));
  }
  // ogni_n: sempre calcolata dalla data di inizio (non a catena), così un 31 non "scivola" al 28 per sempre
  if (r.unita === 'giorni') return aggiungiGiorni(r.dataInizio, k * r.intervallo);
  if (r.unita === 'settimane') return aggiungiGiorni(r.dataInizio, k * r.intervallo * 7);
  return aggiungiMesi(r.dataInizio, k * r.intervallo);
}

/** Le scadenze della serie in ordine, da dataInizio fino a dataFine (se c'è). Si ferma quando il chiamante smette di chiedere. */
export function* scadenze(r) {
  for (let k = 0; k < MAX_PASSI; k += 1) {
    const data = dataTeorica(r, k);
    if (data < r.dataInizio) continue; // la prima del mese/giorno può cadere prima dell'inizio
    if (r.dataFine && data > r.dataFine) return;
    yield data;
  }
}

/**
 * Le scadenze da chiudere: dopo l'ultima generazione e fino a oggi (incluso). `massimo` ne limita il numero;
 * `altre` dice se ce ne sono ancora oltre il limite.
 */
export function scadenzeDovute(r, oggi, massimo = Infinity) {
  const date = [];
  let altre = false;
  for (const data of scadenze(r)) {
    if (data > oggi) break;
    if (r.ultimaGenerazione && data <= r.ultimaGenerazione) continue;
    if (date.length >= massimo) { altre = true; break; }
    date.push(data);
  }
  return { date, altre };
}

/** La prossima scadenza non ancora chiusa (può essere già passata e in attesa), oppure null se la serie è finita. */
export function prossimaScadenza(r) {
  for (const data of scadenze(r)) {
    if (r.ultimaGenerazione && data <= r.ultimaGenerazione) continue;
    return data;
  }
  return null;
}

/** Le prossime `n` scadenze (anche passate se non chiuse), per l'anteprima nell'editor. */
export function anteprimaScadenze(r, n = 3) {
  const date = [];
  for (const data of scadenze(r)) {
    if (r.ultimaGenerazione && data <= r.ultimaGenerazione) continue;
    date.push(data);
    if (date.length >= n) break;
  }
  return date;
}

// ---- Dal modello al movimento ----

/** I dati del movimento per una scadenza (con `importo` diverso se l'utente lo modifica al volo). */
export function datiMovimento(r, data, importo = r.modello.importo) {
  const trasferimento = r.modello.tipo === 'trasferimento';
  return {
    tipo: r.modello.tipo,
    importo,
    data,
    categoriaId: trasferimento ? null : (r.modello.categoriaId ?? null),
    contoId: r.modello.contoId,
    contoDestinazioneId: trasferimento ? (r.modello.contoDestinazioneId ?? null) : null,
    nota: r.modello.nota ?? '',
    ricorrenteId: r.id,
  };
}

/** Un ricorrente nuovo a partire da un movimento ("Rendi ricorrente"): mensile nello stesso giorno, quel movimento è già la prima scadenza. */
export function ricorrenteDaMovimento(m) {
  return {
    modello: {
      tipo: m.tipo, importo: m.importo, categoriaId: m.categoriaId ?? null, contoId: m.contoId,
      contoDestinazioneId: m.contoDestinazioneId ?? null, nota: m.nota ?? '',
    },
    frequenza: 'mensile',
    giornoSettimana: giornoSettimana(m.data),
    giornoDelMese: daIso(m.data).g,
    intervallo: 1,
    unita: 'mesi',
    dataInizio: m.data,
    dataFine: null,
    modalita: modalitaPredefinita(m.tipo),
    attivo: true,
    ultimaGenerazione: m.data,
  };
}

// ---- Validazione ----

/** Messaggio d'errore in italiano, oppure null se il ricorrente è valido. */
export function validaRicorrente(r) {
  const m = r.modello ?? {};
  if (!TIPI.includes(m.tipo)) return 'Scegli il tipo: spesa, entrata o trasferimento.';
  if (!Number.isInteger(m.importo) || m.importo <= 0) return 'Inserisci un importo maggiore di zero.';
  if (!m.contoId) return 'Scegli il conto.';
  if (m.tipo === 'trasferimento') {
    if (!m.contoDestinazioneId) return 'Scegli il conto di destinazione.';
    if (m.contoDestinazioneId === m.contoId) return 'I due conti devono essere diversi.';
  } else if (!m.categoriaId) {
    return 'Scegli una categoria.';
  }
  if (!FREQUENZE.includes(r.frequenza)) return 'Scegli ogni quanto si ripete.';
  if (r.frequenza === 'settimanale' && !(Number.isInteger(r.giornoSettimana) && r.giornoSettimana >= 0 && r.giornoSettimana <= 6)) return 'Scegli il giorno della settimana.';
  if (r.frequenza === 'mensile' && r.giornoDelMese !== 'ultimo' && !(Number.isInteger(r.giornoDelMese) && r.giornoDelMese >= 1 && r.giornoDelMese <= 31)) return 'Scegli il giorno del mese.';
  if (r.frequenza === 'ogni_n') {
    if (!Number.isInteger(r.intervallo) || r.intervallo < 1 || r.intervallo > 999) return 'Scrivi ogni quanti giorni, settimane o mesi (da 1 a 999).';
    if (!UNITA.includes(r.unita)) return 'Scegli giorni, settimane o mesi.';
  }
  if (!dataValida(r.dataInizio)) return 'La data di inizio non è valida.';
  if (r.dataFine && !dataValida(r.dataFine)) return 'La data di fine non è valida.';
  if (r.dataFine && r.dataFine < r.dataInizio) return 'La data di fine deve essere dopo quella di inizio.';
  if (!MODALITA.includes(r.modalita)) return 'Scegli se registrare da solo o con conferma.';
  return null;
}

// ---- Descrizioni ----

const plurale = (n, uno, molti) => (n === 1 ? uno : molti);

/** «Ogni mese, il 27», «Ogni settimana, il lunedì», «Ogni 3 mesi»… */
export function descriviFrequenza(r) {
  if (r.frequenza === 'settimanale') return `Ogni settimana, il ${NOMI_GIORNO[r.giornoSettimana]}`;
  if (r.frequenza === 'mensile') return r.giornoDelMese === 'ultimo' ? 'Ogni mese, l\'ultimo giorno' : `Ogni mese, il ${r.giornoDelMese}`;
  if (r.frequenza === 'annuale') {
    const { m, g } = daIso(r.dataInizio);
    return `Ogni anno, il ${g} ${nomeMese(aIso(2000, m, 1))}`;
  }
  const n = r.intervallo;
  const unita = { giorni: ['giorno', 'giorni'], settimane: ['settimana', 'settimane'], mesi: ['mese', 'mesi'] }[r.unita] ?? ['giorno', 'giorni'];
  return n === 1 ? `Ogni ${unita[0]}` : `Ogni ${n} ${plurale(n, unita[0], unita[1])}`;
}

/** «Stipendio di ottobre» per le scadenze mensili, altrimenti «Stipendio · 27 ott 2026». */
export function etichettaScadenza(nome, r, data) {
  return r.frequenza === 'mensile' ? `${nome} di ${nomeMese(data)}` : `${nome} · ${dataBreve(data)}`;
}
