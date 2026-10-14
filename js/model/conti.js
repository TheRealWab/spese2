// Conti: lettura e ordinamento. (La gestione — aggiungi, rinomina, archivia — arriva nella Fase 4.)

import { tutti } from '../db.js';

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
