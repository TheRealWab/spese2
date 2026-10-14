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
 * TODO(Alessandro): scegli la regola. Opzioni da considerare:
 *   A) contare tutti i movimenti ricevuti (semplice e stabile);
 *   B) dare più peso agli usi recenti, es. peso = 1 per ogni uso negli ultimi 7 giorni, 0,5 oltre
 *      (la griglia si adatta più in fretta ai cambi di abitudine, ma "balla" di più);
 *   C) come A, ma con una soglia minima (sotto N usi resta l'ordine manuale, per non spostare le
 *      categorie per un solo movimento).
 * In ogni caso, a parità di punteggio vale l'ordine manuale (`ordine`), così la griglia è prevedibile.
 *
 * Finché non è implementata, restituisce l'ordine manuale (l'app funziona già).
 * I test in tests/categorie.test.mjs sono marcati `todo`: togli `todo: true` quando hai finito.
 */
export function ordinaPerUso(categorie, movimenti, oggi) { // eslint-disable-line no-unused-vars
  return ordinaManuale(categorie);
}

/** Categorie di un tipo, nell'ordine scelto nelle impostazioni, senza quelle archiviate. */
export function categoriePerInserimento(tutte, tipo, movimentiRecenti, oggi, modo) {
  const attive = tutte.filter((c) => c.tipo === tipo && !c.archiviata);
  return modo === 'frequenza' ? ordinaPerUso(attive, movimentiRecenti, oggi) : ordinaManuale(attive);
}
