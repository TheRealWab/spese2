// Movimenti (spese, entrate, trasferimenti): validazione e accesso al database.
//
//   Movimento: id, tipo, importo (centesimi, > 0), data (AAAA-MM-GG), categoriaId (null per i
//   trasferimenti), contoId, contoDestinazioneId (solo trasferimenti), nota, ricorrenteId,
//   creatoIl, modificatoIl.

import { leggi, salva, elimina, perIntervallo, perChiave } from '../db.js';
import { nuovoId } from '../util/id.js';
import { dataValida } from '../util/date.js';
import { contaNote, normalizzaNota } from './calcoli.js';

export const TIPI = ['spesa', 'entrata', 'trasferimento'];

/** Restituisce un messaggio d'errore in italiano, oppure null se il movimento è valido. */
export function validaMovimento(m) {
  if (!TIPI.includes(m.tipo)) return 'Tipo di movimento non valido.';
  if (!Number.isInteger(m.importo) || m.importo <= 0) return 'Inserisci un importo maggiore di zero.';
  if (!dataValida(m.data)) return 'Data non valida.';
  if (!m.contoId) return 'Scegli il conto.';
  if (m.tipo === 'trasferimento') {
    if (!m.contoDestinazioneId) return 'Scegli il conto di destinazione.';
    if (m.contoDestinazioneId === m.contoId) return 'I due conti devono essere diversi.';
  } else if (!m.categoriaId) {
    return 'Scegli una categoria.';
  }
  return null;
}

/** Tiene solo i campi del modello e li normalizza (nota ripulita, campi non pertinenti azzerati). */
function pulisci(dati) {
  const trasferimento = dati.tipo === 'trasferimento';
  return {
    tipo: dati.tipo,
    importo: dati.importo,
    data: dati.data,
    categoriaId: trasferimento ? null : (dati.categoriaId ?? null),
    contoId: dati.contoId,
    contoDestinazioneId: trasferimento ? (dati.contoDestinazioneId ?? null) : null,
    nota: normalizzaNota(dati.nota),
    ricorrenteId: dati.ricorrenteId ?? null,
  };
}

export async function creaMovimento(dati) {
  const ora = new Date().toISOString();
  const movimento = { id: nuovoId(), ...pulisci(dati), creatoIl: ora, modificatoIl: ora };
  const errore = validaMovimento(movimento);
  if (errore) throw new Error(errore);
  await salva('movimenti', movimento);
  return movimento;
}

export async function aggiornaMovimento(id, dati) {
  const precedente = await leggi('movimenti', id);
  if (!precedente) throw new Error('Movimento non trovato.');
  const movimento = { ...precedente, ...pulisci(dati), id, modificatoIl: new Date().toISOString() };
  const errore = validaMovimento(movimento);
  if (errore) throw new Error(errore);
  await salva('movimenti', movimento);
  return movimento;
}

export const eliminaMovimento = (id) => elimina('movimenti', id);

/** Movimenti con data compresa tra `da` e `a` (inclusi). */
export const movimentiPeriodo = (da, a) => perIntervallo('movimenti', 'data', da, a);

/** Note già usate in una categoria, dalla più frequente (per i suggerimenti nell'inserimento). */
export async function noteUsate(categoriaId) {
  return contaNote(await perChiave('movimenti', 'categoriaId', categoriaId));
}
