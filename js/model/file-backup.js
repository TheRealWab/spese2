// Dove salvare il backup: scelta della cartella e del nome (File System Access API) e sovrascrittura del file
// scelto la volta prima. Il "riferimento" al file (handle) si ricorda in un piccolo database a parte, non nei dati
// dell'app: così non finisce nei backup. Dove il browser non offre la scelta, si ripiega sul download normale.

const NOME_DB = 'spese2_file';
const ARCHIVIO = 'riferimenti';
const CHIAVE = 'backup';

/** Il browser può far scegliere dove salvare? (Chrome su computer e, nelle versioni recenti, su Android.) */
export const sceltaFileDisponibile = () => typeof window.showSaveFilePicker === 'function';

function apriDb() {
  return new Promise((ok, ko) => {
    const richiesta = indexedDB.open(NOME_DB, 1);
    richiesta.onupgradeneeded = () => richiesta.result.createObjectStore(ARCHIVIO);
    richiesta.onsuccess = () => ok(richiesta.result);
    richiesta.onerror = () => ko(richiesta.error);
  });
}

async function operazione(modo, azione) {
  const db = await apriDb();
  try {
    const tx = db.transaction(ARCHIVIO, modo);
    const risultato = await new Promise((ok, ko) => {
      const richiesta = azione(tx.objectStore(ARCHIVIO));
      richiesta.onsuccess = () => ok(richiesta.result);
      richiesta.onerror = () => ko(richiesta.error);
    });
    await new Promise((ok, ko) => { tx.oncomplete = ok; tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error); });
    return risultato;
  } finally {
    db.close();
  }
}

/** Il file scelto l'ultima volta, oppure null (anche se il browser non permette di ricordarlo). */
export async function leggiFileBackup() {
  try { return (await operazione('readonly', (s) => s.get(CHIAVE))) ?? null; } catch { return null; }
}

export async function ricordaFileBackup(handle) {
  try { await operazione('readwrite', (s) => s.put(handle, CHIAVE)); } catch { /* non ricordarlo non è un errore: la prossima volta si sceglie di nuovo */ }
}

export async function dimenticaFileBackup() {
  try { await operazione('readwrite', (s) => s.delete(CHIAVE)); } catch { /* idem */ }
}

/** Apre la finestra di sistema "salva con nome". Lancia AbortError se l'utente annulla. */
export function scegliNuovoFile(nomeSuggerito) {
  return window.showSaveFilePicker({
    suggestedName: nomeSuggerito,
    types: [{ description: 'Backup di Spese 2.0', accept: { 'application/json': ['.json'] } }],
  });
}

/**
 * Il permesso di scrivere sul file ricordato: se serve lo chiede (va chiamato dentro un tocco dell'utente).
 * Restituisce true se si può scrivere.
 */
export async function permessoDiScrittura(handle) {
  try {
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/** Scrive il testo sul file. La sostituzione è atomica: o resta il vecchio file, o c'è il nuovo intero. */
export async function scriviSuFile(handle, testo) {
  const scrivibile = await handle.createWritable();
  try {
    await scrivibile.write(testo);
  } catch (errore) {
    await scrivibile.abort().catch(() => {});
    throw errore;
  }
  await scrivibile.close();
}

/** Condividere il file con un'altra app (Drive, File…), dove il browser lo permette. */
export function condivisioneDisponibile(file) {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}
