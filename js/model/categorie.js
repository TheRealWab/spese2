// Categorie: lettura e ordinamento per la griglia di inserimento.

import { tutti } from '../db.js';

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

/** Categorie di un tipo, nell'ordine scelto nelle impostazioni, senza quelle archiviate. */
export function categoriePerInserimento(tutte, tipo, movimentiRecenti, oggi, modo) {
  const attive = tutte.filter((c) => c.tipo === tipo && !c.archiviata);
  return modo === 'frequenza' ? ordinaPerUso(attive, movimentiRecenti, oggi) : ordinaManuale(attive);
}
