// Backup cifrato (SPEC §9.2): cifratura con password, lettura, controlli e unione dei dati.
// Solo funzioni pure + Web Crypto: niente database (lo fa backup-db.js), così si testa tutto in Node.
//
// File: JSON con intestazione in chiaro { formato, versione, cifratura: { algoritmo, kdf, iterazioni, sale, iv }, creato }
// e il contenuto cifrato in `dati`. Chiave: PBKDF2-SHA-256 dalla password; cifratura: AES-GCM 256 (autenticata:
// una password sbagliata o un file alterato vengono rifiutati, mai letti a metà).

import { dataValida, giorniTra } from '../util/date.js';
import { TIPI } from './movimenti.js';

export const FORMATO = 'spese2-backup';
export const VERSIONE_FORMATO = 1;
export const ITERAZIONI = 600_000; // SPEC: almeno 310.000
export const MINIMO_ITERAZIONI = 100_000; // sotto questa soglia un file viene rifiutato (non è stato creato da noi)
export const MASSIMO_ITERAZIONI = 5_000_000; // sopra, un file malevolo potrebbe bloccare il telefono
export const LUNGHEZZA_MINIMA_PASSWORD = 8;
export const GIORNI_AVVISO_BACKUP = 30;

export const ARCHIVI_BACKUP = ['conti', 'categorie', 'movimenti', 'valoriInvestimento', 'ricorrenti', 'impostazioni'];

export class ErroreBackup extends Error {}

const codifica = new TextEncoder();
const decodifica = new TextDecoder();
const datiAggiuntivi = codifica.encode(`${FORMATO}:${VERSIONE_FORMATO}`); // legati al cifrato: un file di altro tipo non si apre

// ---- base64 ----

export function aBase64(byte) {
  let testo = '';
  for (let i = 0; i < byte.length; i += 0x8000) testo += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(testo);
}

export function daBase64(testo) {
  try {
    return Uint8Array.from(atob(testo), (c) => c.charCodeAt(0));
  } catch {
    throw new ErroreBackup('Il file è danneggiato.');
  }
}

// ---- Cifratura ----

async function derivaChiave(password, sale, iterazioni) {
  const base = await crypto.subtle.importKey('raw', codifica.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sale, iterations: iterazioni, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra i dati e restituisce il testo del file di backup. */
export async function cifra(dati, password, { iterazioni = ITERAZIONI, adesso = new Date() } = {}) {
  if (typeof password !== 'string' || password.length < LUNGHEZZA_MINIMA_PASSWORD) {
    throw new ErroreBackup(`La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.`);
  }
  const sale = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiave = await derivaChiave(password, sale, iterazioni);
  const cifrato = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: datiAggiuntivi },
    chiave,
    codifica.encode(JSON.stringify(dati)),
  );
  return JSON.stringify({
    formato: FORMATO,
    versione: VERSIONE_FORMATO,
    cifratura: { algoritmo: 'AES-GCM', kdf: 'PBKDF2-SHA-256', iterazioni, sale: aBase64(sale), iv: aBase64(iv) },
    creato: adesso.toISOString(),
    dati: aBase64(new Uint8Array(cifrato)),
  });
}

/** Controlla l'intestazione del file (senza password) e la restituisce. */
export function leggiIntestazione(testo, { minimoIterazioni = MINIMO_ITERAZIONI } = {}) {
  let file;
  try {
    file = JSON.parse(testo);
  } catch {
    throw new ErroreBackup('Il file non è leggibile: non sembra un backup di Spese 2.0.');
  }
  if (file?.formato !== FORMATO) throw new ErroreBackup('Questo file non è un backup di Spese 2.0.');
  if (file.versione > VERSIONE_FORMATO) throw new ErroreBackup('Il backup è stato creato da una versione più recente dell\'app.');
  const c = file.cifratura;
  const iterazioniOk = Number.isInteger(c?.iterazioni) && c.iterazioni >= minimoIterazioni && c.iterazioni <= MASSIMO_ITERAZIONI;
  if (c?.algoritmo !== 'AES-GCM' || c?.kdf !== 'PBKDF2-SHA-256' || !iterazioniOk
    || typeof c.sale !== 'string' || typeof c.iv !== 'string' || typeof file.dati !== 'string') {
    throw new ErroreBackup('Il file di backup è incompleto o danneggiato.');
  }
  return { iterazioni: c.iterazioni, sale: daBase64(c.sale), iv: daBase64(c.iv), creato: file.creato ?? null, dati: daBase64(file.dati) };
}

/** Apre il backup con la password e restituisce i dati (già controllati). */
export async function decifra(testo, password, opzioni = {}) {
  const intestazione = leggiIntestazione(testo, opzioni);
  let chiaro;
  try {
    const chiave = await derivaChiave(password ?? '', intestazione.sale, intestazione.iterazioni);
    chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: intestazione.iv, additionalData: datiAggiuntivi }, chiave, intestazione.dati);
  } catch {
    throw new ErroreBackup('Password errata oppure file danneggiato.');
  }
  let dati;
  try {
    dati = JSON.parse(decodifica.decode(chiaro));
  } catch {
    throw new ErroreBackup('Il contenuto del backup non è leggibile.');
  }
  validaDatiBackup(dati);
  return dati;
}

// ---- Contenuto ----

/** Lancia ErroreBackup se i dati non hanno la forma attesa (meglio rifiutare che ripristinare dati storti). */
export function validaDatiBackup(dati) {
  if (dati?.app !== 'spese2') throw new ErroreBackup('Il backup non contiene dati di Spese 2.0.');
  for (const nome of ARCHIVI_BACKUP) {
    if (!Array.isArray(dati[nome])) throw new ErroreBackup(`Nel backup manca la sezione «${nome}».`);
  }
  for (const nome of ARCHIVI_BACKUP) {
    for (const x of dati[nome]) {
      if (typeof x?.id !== 'string' || !x.id) throw new ErroreBackup('Il backup contiene elementi senza identificativo.');
    }
  }
  for (const m of dati.movimenti) {
    if (!TIPI.includes(m.tipo) || !Number.isInteger(m.importo) || m.importo <= 0 || !dataValida(m.data)) {
      throw new ErroreBackup('Il backup contiene movimenti non validi.');
    }
  }
}

/** Contenuto da cifrare: tutti gli archivi, senza le impostazioni che riguardano solo questo telefono. */
export function pacchettoDati(archivi, adesso = new Date()) {
  const impostazioni = archivi.impostazioni.map((i) => {
    const { sicurezza, ultimoBackup, ...resto } = i; // il blocco e la data dell'ultimo backup non si portano in giro
    return resto;
  });
  return { app: 'spese2', versioneDati: 1, creato: adesso.toISOString(), ...archivi, impostazioni };
}

export function riepilogoBackup(dati) {
  const date = dati.movimenti.map((m) => m.data).sort();
  return {
    creato: dati.creato ?? null,
    movimenti: dati.movimenti.length,
    categorie: dati.categorie.length,
    conti: dati.conti.length,
    periodo: date.length ? { da: date[0], a: date[date.length - 1] } : null,
  };
}

export const nomeFileBackup = (oggi) => `spese-backup-${oggi}.json`;

// ---- Ultimo backup ----

/** Giorni dall'ultimo backup (null se non è mai stato fatto) e se è il caso di avvisare. */
export function statoUltimoBackup(ultimoBackup, oggi) {
  if (!dataValida(ultimoBackup)) return { giorni: null, daFare: true };
  const giorni = Math.max(0, giorniTra(ultimoBackup, oggi));
  return { giorni, daFare: giorni > GIORNI_AVVISO_BACKUP };
}

export function descriviUltimoBackup({ giorni }) {
  if (giorni === null) return 'Nessun backup ancora';
  if (giorni === 0) return 'Ultimo backup: oggi';
  if (giorni === 1) return 'Ultimo backup: ieri';
  return `Ultimo backup: ${giorni} giorni fa`;
}

// ---- Unione ----

/**
 * "Unisci": aggiunge ciò che manca, senza cancellare né duplicare.
 *  - conti, categorie, valori, ricorrenti, impostazioni: per id; se esistono già, resta la versione di questo telefono;
 *  - movimenti: per id (vince il più recente per `modificatoIl`); un movimento importato dalla vecchia app
 *    (stesso `origineId`) non viene aggiunto di nuovo con un id diverso.
 * Restituisce { daSalvare: {archivio: [oggetti]}, aggiunti, aggiornati, saltati } (nulla viene scritto qui).
 */
export function unisci(locali, dalBackup) {
  const daSalvare = { conti: [], categorie: [], movimenti: [], valoriInvestimento: [], ricorrenti: [] };
  const conteggi = { aggiunti: 0, aggiornati: 0, saltati: 0 };

  for (const nome of ['conti', 'categorie', 'valoriInvestimento', 'ricorrenti']) {
    const presenti = new Set(locali[nome].map((x) => x.id));
    for (const x of dalBackup[nome]) {
      if (presenti.has(x.id)) conteggi.saltati += 1;
      else { daSalvare[nome].push(x); conteggi.aggiunti += 1; }
    }
  }

  const perId = new Map(locali.movimenti.map((m) => [m.id, m]));
  const origini = new Set(locali.movimenti.map((m) => m.origineId).filter(Boolean));
  for (const m of dalBackup.movimenti) {
    const attuale = perId.get(m.id);
    if (attuale) {
      if ((m.modificatoIl ?? '') > (attuale.modificatoIl ?? '')) { daSalvare.movimenti.push(m); conteggi.aggiornati += 1; }
      else conteggi.saltati += 1;
    } else if (m.origineId && origini.has(m.origineId)) {
      conteggi.saltati += 1;
    } else {
      daSalvare.movimenti.push(m);
      conteggi.aggiunti += 1;
    }
  }
  return { daSalvare, ...conteggi };
}
