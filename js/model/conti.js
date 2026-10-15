// Conti: lettura, ordinamento e regole di gestione (SPEC §6.3). Le regole sono funzioni pure, usate da conti-db.js
// e dalle schermate; il calcolo dei saldi sta in patrimonio.js.

import { tutti } from '../db.js';
import { dataValida } from '../util/date.js';
import { COLORI_CATEGORIA } from './palette.js';

export async function tuttiIConti() {
  const lista = await tutti('conti');
  return lista.sort((a, b) => a.ordine - b.ordine);
}

/**
 * Conto di destinazione proposto per un nuovo trasferimento: il primo conto investimenti diverso
 * dall'origine (il caso tipico è il versamento PAC), altrimenti il primo conto diverso.
 */
export function destinazioneProposta(conti, origineId) {
  const altri = conti.filter((c) => !c.archiviato && c.id !== origineId);
  return (altri.find((c) => c.tipo === 'investimenti') ?? altri[0])?.id ?? null;
}

// ---- Gestione ----

export const TIPI_CONTO = ['conto', 'liquidità', 'investimenti', 'altro'];
export const ETICHETTA_TIPO_CONTO = { conto: 'Conto', 'liquidità': 'Liquidità', investimenti: 'Investimenti', altro: 'Altro' };
export const LUNGHEZZA_MAX_NOME_CONTO = 30;

/** Nome ripulito: niente spazi ai bordi né doppi. */
export const pulisciNomeConto = (nome) => String(nome ?? '').trim().replace(/\s+/g, ' ');

// Per confrontare i nomi: "Conto " e "conto" sono lo stesso nome.
const perConfronto = (nome) => pulisciNomeConto(nome).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Messaggio d'errore in italiano, oppure null se i dati vanno bene. Due conti non possono chiamarsi uguale
 * (nemmeno se uno è archiviato). Il saldo iniziale può essere negativo (carta di credito, scoperto).
 */
export function validaConto({ nome, tipo, saldoIniziale, dataSaldoIniziale }, conti, { escludiId = null } = {}) {
  const pulito = pulisciNomeConto(nome);
  if (!pulito) return 'Scrivi il nome del conto.';
  if (pulito.length > LUNGHEZZA_MAX_NOME_CONTO) return `Il nome può avere al massimo ${LUNGHEZZA_MAX_NOME_CONTO} caratteri.`;
  if (!TIPI_CONTO.includes(tipo)) return 'Tipo di conto non valido.';
  if (!Number.isInteger(saldoIniziale)) return 'Il saldo iniziale non è valido.';
  if (!dataValida(dataSaldoIniziale)) return 'La data del saldo iniziale non è valida.';
  const uguale = conti.find((c) => c.id !== escludiId && perConfronto(c.nome) === perConfronto(pulito));
  if (uguale) return uguale.archiviato ? 'Esiste già un conto archiviato con questo nome: ripristinalo.' : 'Esiste già un conto con questo nome.';
  return null;
}

/**
 * Un conto si archivia se non è quello predefinito (altrimenti l'inserimento non saprebbe dove registrare) e se
 * ne resta almeno un altro attivo.
 */
export function puoArchiviareConto(conto, conti, contoPredefinitoId) {
  if (conto.id === contoPredefinitoId) {
    return { ok: false, motivo: 'È il conto predefinito: scegline un altro in Altro → Conto predefinito, poi potrai archiviarlo.' };
  }
  if (!conti.some((c) => c.id !== conto.id && !c.archiviato)) {
    return { ok: false, motivo: 'È l\'unico conto attivo: ne serve almeno uno.' };
  }
  return { ok: true };
}

/** Posizione per un conto nuovo: in fondo a tutti. */
export const prossimoOrdineConto = (conti) => Math.max(-1, ...conti.map((c) => c.ordine ?? 0)) + 1;

/** Colore proposto per un conto nuovo: il meno usato tra i conti (a parità, l'ordine della tavolozza). */
export function coloreContoSuggerito(conti) {
  const usi = new Map(COLORI_CATEGORIA.map((c) => [c, 0]));
  for (const c of conti) if (usi.has(c.colore)) usi.set(c.colore, usi.get(c.colore) + 1);
  return COLORI_CATEGORIA.reduce((migliore, c) => (usi.get(c) < usi.get(migliore) ? c : migliore), COLORI_CATEGORIA[0]);
}

/** Icona proposta per un conto nuovo, secondo il tipo. */
export const ICONA_PREDEFINITA_CONTO = { conto: 'landmark', 'liquidità': 'banknote', investimenti: 'chart-line', altro: 'wallet' };

// ---- Valori degli investimenti ----

/** Messaggio d'errore per un valore inserito a mano, oppure null. Il valore può essere zero (investimento azzerato). */
export function validaValore({ valore, data }, oggi) {
  if (!Number.isInteger(valore) || valore < 0) return 'Inserisci il valore attuale (zero o più).';
  if (!dataValida(data)) return 'Data non valida.';
  if (data > oggi) return 'La data non può essere nel futuro.';
  return null;
}
