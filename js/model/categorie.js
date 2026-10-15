// Categorie: lettura e ordinamento per la griglia di inserimento.

import { tutti } from '../db.js';
import { COLORI_CATEGORIA } from './palette.js';

export async function tutteLeCategorie() {
  const lista = await tutti('categorie');
  return lista.sort((a, b) => a.ordine - b.ordine);
}

/** Ordine manuale scelto dall'utente (campo `ordine`). Non modifica l'array ricevuto. */
export function ordinaManuale(categorie) {
  return [...categorie].sort((a, b) => a.ordine - b.ordine);
}

/**
 * Ordina le categorie per frequenza d'uso, per la griglia dell'inserimento (SPEC §5):
 * le più usate vengono per prime, così la categoria giusta è quasi sempre a portata di pollice.
 *
 * @param {Array} categorie  categorie da ordinare (già filtrate per tipo: solo spese oppure solo entrate)
 * @param {Array} movimenti  movimenti recenti (il chiamante passa gli ultimi 90 giorni); ogni movimento
 *                           ha `categoriaId` (null per i trasferimenti) e `data` ("AAAA-MM-GG")
 * @param {string} oggi      data di oggi "AAAA-MM-GG", utile se si vuole dare più peso agli usi recenti
 * @returns {Array} nuovo array ordinato (non modificare `categorie`)
 *
 * Regola: si contano i movimenti degli ultimi 90 giorni per categoria (semplice e stabile: la griglia
 * non "balla"). A parità di conteggio vale l'ordine manuale (`ordine`), quindi senza movimenti la
 * griglia resta quella scelta a mano. Un'alternativa possibile è dare più peso agli usi recenti
 * (es. `oggi` per distinguere gli ultimi 7 giorni), ma si preferisce la stabilità.
 */
export function ordinaPerUso(categorie, movimenti, oggi) { // eslint-disable-line no-unused-vars
  const usi = new Map();
  for (const m of movimenti) {
    if (m.categoriaId) usi.set(m.categoriaId, (usi.get(m.categoriaId) ?? 0) + 1);
  }
  const conteggio = (c) => usi.get(c.id) ?? 0;
  return ordinaManuale(categorie).sort((a, b) => conteggio(b) - conteggio(a)); // sort stabile: pari merito = ordine manuale
}

/**
 * Totali per categoria dei movimenti di un tipo ("spesa" o "entrata"): i trasferimenti non contano.
 * Restituisce { righe: [{ categoriaId, totale, conteggio, percentuale }], totale, conteggio } con le righe
 * dalla categoria con più importo; a parità, più movimenti.
 */
export function totaliPerCategoria(movimenti, tipo) {
  const perCategoria = new Map();
  for (const m of movimenti) {
    if (m.tipo !== tipo || !m.categoriaId) continue;
    const voce = perCategoria.get(m.categoriaId) ?? { categoriaId: m.categoriaId, totale: 0, conteggio: 0 };
    voce.totale += m.importo;
    voce.conteggio += 1;
    perCategoria.set(m.categoriaId, voce);
  }
  const righe = [...perCategoria.values()]
    .sort((a, b) => b.totale - a.totale || b.conteggio - a.conteggio || a.categoriaId.localeCompare(b.categoriaId));
  const totale = righe.reduce((somma, r) => somma + r.totale, 0);
  const conteggio = righe.reduce((somma, r) => somma + r.conteggio, 0);
  return { righe: righe.map((r) => ({ ...r, percentuale: totale ? (r.totale / totale) * 100 : 0 })), totale, conteggio };
}

/** Categorie di un tipo, nell'ordine scelto nelle impostazioni, senza quelle archiviate. */
export function categoriePerInserimento(tutte, tipo, movimentiRecenti, oggi, modo) {
  const attive = tutte.filter((c) => c.tipo === tipo && !c.archiviata);
  return modo === 'frequenza' ? ordinaPerUso(attive, movimentiRecenti, oggi) : ordinaManuale(attive);
}

// ---- Gestione: regole e validazione (SPEC §6.4). Funzioni pure, usate da categorie-db.js e dalle schermate. ----

export const TIPI_CATEGORIA = ['spesa', 'entrata'];
export const LUNGHEZZA_MAX_NOME_CATEGORIA = 30;

/** Nome ripulito: niente spazi ai bordi né doppi. */
export const pulisciNomeCategoria = (nome) => String(nome ?? '').trim().replace(/\s+/g, ' ');

// Per confrontare i nomi: "Caffè " e "caffe" sono lo stesso nome.
const perConfronto = (nome) => pulisciNomeCategoria(nome).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Messaggio d'errore in italiano, oppure null se il nome e il tipo vanno bene.
 * Due categorie dello stesso tipo non possono chiamarsi uguale (anche se una è archiviata).
 */
export function validaCategoria({ nome, tipo }, categorie, { escludiId = null } = {}) {
  const pulito = pulisciNomeCategoria(nome);
  if (!pulito) return 'Scrivi il nome della categoria.';
  if (pulito.length > LUNGHEZZA_MAX_NOME_CATEGORIA) return `Il nome può avere al massimo ${LUNGHEZZA_MAX_NOME_CATEGORIA} caratteri.`;
  if (!TIPI_CATEGORIA.includes(tipo)) return 'Tipo di categoria non valido.';
  const uguale = categorie.find((c) => c.id !== escludiId && c.tipo === tipo && perConfronto(c.nome) === perConfronto(pulito));
  if (uguale) return uguale.archiviata ? 'Esiste già una categoria archiviata con questo nome: ripristinala.' : 'Esiste già una categoria con questo nome.';
  return null;
}

const MOTIVO_STIPENDIO = 'Questa categoria alimenta l\'indicatore «Ti restano»: non si può archiviare, eliminare o unire.';

export function puoArchiviare(categoria) {
  return categoria.ruolo === 'stipendio' ? { ok: false, motivo: MOTIVO_STIPENDIO } : { ok: true };
}

/** Si può eliminare solo una categoria vuota (senza movimenti né ricorrenti): altrimenti si archivia o si unisce. */
export function puoEliminare(categoria, { movimenti = 0, ricorrenti = 0 } = {}) {
  if (categoria.ruolo === 'stipendio') return { ok: false, motivo: MOTIVO_STIPENDIO };
  if (movimenti > 0) {
    return { ok: false, motivo: `Ha ${movimenti} ${movimenti === 1 ? 'movimento' : 'movimenti'}: non si può eliminare. Puoi archiviarla (lo storico resta) oppure unirla a un'altra.` };
  }
  if (ricorrenti > 0) return { ok: false, motivo: 'È usata da movimenti ricorrenti: archiviala oppure uniscila a un\'altra categoria.' };
  return { ok: true };
}

export function puoUnire(origine, destinazione) {
  if (origine.id === destinazione.id) return { ok: false, motivo: 'Scegli un\'altra categoria.' };
  if (origine.tipo !== destinazione.tipo) return { ok: false, motivo: 'Si possono unire solo categorie dello stesso tipo.' };
  if (origine.ruolo === 'stipendio') return { ok: false, motivo: MOTIVO_STIPENDIO };
  return { ok: true };
}

/**
 * Cosa cambia unendo `origineId` in `destinazioneId`: i movimenti (e i ricorrenti) dell'origine passano alla
 * destinazione. Restituisce solo gli oggetti modificati, senza toccare quelli ricevuti.
 */
export function pianoUnione({ movimenti, ricorrenti = [] }, origineId, destinazioneId, adesso) {
  return {
    movimenti: movimenti
      .filter((m) => m.categoriaId === origineId)
      .map((m) => ({ ...m, categoriaId: destinazioneId, modificatoIl: adesso })),
    ricorrenti: ricorrenti
      .filter((r) => r.modello?.categoriaId === origineId)
      .map((r) => ({ ...r, modello: { ...r.modello, categoriaId: destinazioneId } })),
  };
}

/** Posizione per una categoria nuova: in fondo a tutte. */
export const prossimoOrdine = (categorie) => Math.max(-1, ...categorie.map((c) => c.ordine ?? 0)) + 1;

/** Colore proposto per una categoria nuova: il meno usato tra quelle dello stesso tipo (a parità, l'ordine della tavolozza). */
export function coloreSuggerito(categorie, tipo) {
  const usi = new Map(COLORI_CATEGORIA.map((c) => [c, 0]));
  for (const c of categorie) if (c.tipo === tipo && usi.has(c.colore)) usi.set(c.colore, usi.get(c.colore) + 1);
  return COLORI_CATEGORIA.reduce((migliore, c) => (usi.get(c) < usi.get(migliore) ? c : migliore), COLORI_CATEGORIA[0]);
}
