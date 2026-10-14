// Cancella tutti i dati di Spese 2.0 su questo telefono. Serve a chi ha dimenticato il PIN: l'unico modo
// di rientrare è ripartire da zero e ripristinare un backup cifrato.

import { sostituisciArchivi } from '../db.js';
import { ARCHIVI_BACKUP } from './backup.js';

export async function cancellaTuttiIDati() {
  await sostituisciArchivi(Object.fromEntries(ARCHIVI_BACKUP.map((nome) => [nome, []])));
  try {
    for (const chiave of Object.keys(localStorage)) if (chiave.startsWith('spese2_')) localStorage.removeItem(chiave);
    for (const chiave of Object.keys(sessionStorage)) if (chiave.startsWith('spese2_')) sessionStorage.removeItem(chiave);
  } catch { /* storage non disponibile */ }
  location.reload(); // al riavvio l'app ricrea i dati di partenza, senza blocco
}
