// Strato di accesso a IndexedDB. Tutto il resto dell'app passa da qui.
//
// ATTENZIONE: l'origine therealwab.github.io è condivisa con altre app (diario, vecchia app spese).
// Il nome del database ha quindi un prefisso univoco: non va mai cambiato né usato altrove.

export const NOME_DB = 'spese2_db';
export const VERSIONE_DB = 1;

// Tutti gli archivi del modello dati (SPEC §4) esistono già dalla versione 1,
// così le fasi successive non richiedono migrazioni dello schema.
const ARCHIVI = {
  conti: { chiave: 'id', indici: [] },
  categorie: { chiave: 'id', indici: [['tipo', 'tipo']] },
  movimenti: {
    chiave: 'id',
    indici: [['data', 'data'], ['categoriaId', 'categoriaId'], ['contoId', 'contoId'], ['ricorrenteId', 'ricorrenteId']],
  },
  valoriInvestimento: { chiave: 'id', indici: [['contoId', 'contoId'], ['data', 'data']] },
  ricorrenti: { chiave: 'id', indici: [] },
  impostazioni: { chiave: 'id', indici: [] },
};

let connessione = null;

export function apriDb() {
  connessione ??= new Promise((ok, ko) => {
    const richiesta = indexedDB.open(NOME_DB, VERSIONE_DB);
    richiesta.onupgradeneeded = () => {
      const db = richiesta.result;
      for (const [nome, { chiave, indici }] of Object.entries(ARCHIVI)) {
        if (db.objectStoreNames.contains(nome)) continue;
        const archivio = db.createObjectStore(nome, { keyPath: chiave });
        for (const [nomeIndice, percorso] of indici) archivio.createIndex(nomeIndice, percorso);
      }
    };
    richiesta.onsuccess = () => {
      // Se un'altra scheda aggiorna lo schema, chiudiamo per non bloccarla.
      richiesta.result.onversionchange = () => { richiesta.result.close(); connessione = null; };
      ok(richiesta.result);
    };
    richiesta.onerror = () => { connessione = null; ko(richiesta.error); };
    richiesta.onblocked = () => ko(new Error('Database bloccato da un\'altra scheda aperta.'));
  });
  return connessione;
}

const comePromessa = (richiesta) => new Promise((ok, ko) => {
  richiesta.onsuccess = () => ok(richiesta.result);
  richiesta.onerror = () => ko(richiesta.error);
});

// Una scrittura è terminata solo quando la transazione è completata (dati su disco).
const transazioneCompletata = (tx) => new Promise((ok, ko) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => ko(tx.error);
  tx.onabort = () => ko(tx.error ?? new Error('Transazione annullata.'));
});

async function archivio(nome, modo = 'readonly') {
  const db = await apriDb();
  const tx = db.transaction(nome, modo);
  return { tx, store: tx.objectStore(nome) };
}

export async function tutti(nome) {
  const { store } = await archivio(nome);
  return comePromessa(store.getAll());
}

export async function leggi(nome, id) {
  const { store } = await archivio(nome);
  return comePromessa(store.get(id));
}

export async function salva(nome, oggetto) {
  const { tx, store } = await archivio(nome, 'readwrite');
  store.put(oggetto);
  return transazioneCompletata(tx);
}

/** Salva più oggetti di più archivi in un'unica transazione: o tutto o niente. */
export async function salvaGruppo(perArchivio) {
  const nomi = Object.keys(perArchivio);
  const db = await apriDb();
  const tx = db.transaction(nomi, 'readwrite');
  for (const [nome, oggetti] of Object.entries(perArchivio)) {
    const store = tx.objectStore(nome);
    for (const oggetto of oggetti) store.put(oggetto);
  }
  return transazioneCompletata(tx);
}

/** Svuota e riempie gli archivi indicati in un'unica transazione: se qualcosa fallisce, non cambia nulla. */
export async function sostituisciArchivi(perArchivio) {
  const nomi = Object.keys(perArchivio);
  const db = await apriDb();
  const tx = db.transaction(nomi, 'readwrite');
  for (const [nome, oggetti] of Object.entries(perArchivio)) {
    const store = tx.objectStore(nome);
    store.clear();
    for (const oggetto of oggetti) store.put(oggetto);
  }
  return transazioneCompletata(tx);
}

export async function elimina(nome, id) {
  const { tx, store } = await archivio(nome, 'readwrite');
  store.delete(id);
  return transazioneCompletata(tx);
}

/** Oggetti il cui valore nell'indice è compreso tra `da` e `a` (estremi inclusi). */
export async function perIntervallo(nome, indice, da, a) {
  const { store } = await archivio(nome);
  return comePromessa(store.index(indice).getAll(IDBKeyRange.bound(da, a)));
}

export async function perChiave(nome, indice, valore) {
  const { store } = await archivio(nome);
  return comePromessa(store.index(indice).getAll(IDBKeyRange.only(valore)));
}
