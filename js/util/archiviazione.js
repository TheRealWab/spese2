// Archiviazione persistente: per default il browser può cancellare i dati di un sito quando il telefono ha poco spazio.
// Chiedendo l'archiviazione "persistente" (navigator.storage.persist) i dati dell'app sono protetti da questa pulizia.
// Chrome di solito la concede all'app installata. Non sostituisce il backup: resta il modo sicuro di non perdere nulla.

/** Chiede la protezione (una volta all'avvio è sufficiente). true = concessa, false = negata, null = non supportata. */
export async function richiediArchiviazionePersistente() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** Lo stato attuale, senza chiedere nulla: true / false / null (non lo si può sapere). */
export async function statoArchiviazione() {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
