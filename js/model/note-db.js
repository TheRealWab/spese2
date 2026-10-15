// Rinomina e unione delle note nel database: cambia la nota di tutti i movimenti di una categoria, in un'unica
// operazione (tutto o niente). Le regole stanno in note.js; qui si leggono i dati, si applicano e si avvisano le viste.

import { perChiave, applicaModifiche } from '../db.js';
import { scomponiPerNota, validaNomeNota, risolviNuovoNome, pianoNota } from './note.js';

/** Errore con un messaggio già pronto da mostrare all'utente. */
export class ErroreNota extends Error {}

const avvisa = (azione) => document.dispatchEvent(new CustomEvent('spese2:movimenti', { detail: { azione } }));

/** Tutte le note di una categoria (di ogni periodo), con quante volte e quanto: l'elenco per la gestione. */
export async function noteDellaCategoria(categoriaId) {
  return scomponiPerNota(await perChiave('movimenti', 'categoriaId', categoriaId));
}

/**
 * Dà un nuovo nome alla nota `chiaveOrigine` in tutti i movimenti della categoria. Se il nome esiste già in
 * un'altra nota, le due si uniscono. Restituisce { nome, conteggio, unita, originali } (`originali` serve per annullare).
 */
export async function cambiaNota(categoriaId, chiaveOrigine, nuovoNome) {
  const errore = validaNomeNota(nuovoNome);
  if (errore) throw new ErroreNota(errore);
  const movimenti = await perChiave('movimenti', 'categoriaId', categoriaId);
  const { nome, unisceCon } = risolviNuovoNome(scomponiPerNota(movimenti), chiaveOrigine, nuovoNome);
  const { originali, modificati } = pianoNota(movimenti, chiaveOrigine, nome, new Date().toISOString());
  if (!modificati.length) return { nome, conteggio: 0, unita: Boolean(unisceCon), originali: [] };
  await applicaModifiche({ salva: { movimenti: modificati } });
  avvisa(unisceCon ? 'unione-note' : 'rinomina-nota');
  return { nome, conteggio: modificati.length, unita: Boolean(unisceCon), originali };
}

/** Annulla un cambio di nota rimettendo i movimenti com'erano. */
export async function annullaCambioNota(originali) {
  if (!originali.length) return;
  await applicaModifiche({ salva: { movimenti: originali } });
  avvisa('annulla-note');
}
