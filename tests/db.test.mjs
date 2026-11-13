// Accesso al database e salvataggio delle impostazioni, con un IndexedDB finto (in Node quello vero non c'è).
// Il finto fa solo ciò che serve qui: archivi per chiave, risposte in ritardo come quello vero, connessione che si
// può chiudere. Dati inventati.

import test from 'node:test';
import assert from 'node:assert/strict';

function fintoIndexedDB() {
  const archivi = new Map(); // nome → Map(id → oggetto)
  const archivio = (nome) => { if (!archivi.has(nome)) archivi.set(nome, new Map()); return archivi.get(nome); };
  const stato = { aperture: 0, connessioni: [] };

  const richiestaCon = (calcola) => {
    const richiesta = {};
    setTimeout(() => { richiesta.result = calcola(); richiesta.onsuccess?.(); }, 1);
    return richiesta;
  };

  function nuovaConnessione() {
    const db = {
      chiusa: false,
      objectStoreNames: { contains: () => true },
      close() { db.chiusa = true; },
      transaction() {
        if (db.chiusa) throw Object.assign(new Error('La connessione è chiusa.'), { name: 'InvalidStateError' });
        const tx = {};
        setTimeout(() => tx.oncomplete?.(), 5); // dopo le richieste, come una transazione vera
        tx.objectStore = (nome) => ({
          get: (id) => richiestaCon(() => structuredClone(archivio(nome).get(id))),
          getAll: () => richiestaCon(() => [...archivio(nome).values()].map((x) => structuredClone(x))),
          put: (oggetto) => richiestaCon(() => { archivio(nome).set(oggetto.id, structuredClone(oggetto)); }),
          delete: (id) => richiestaCon(() => { archivio(nome).delete(id); }),
          clear: () => richiestaCon(() => { archivio(nome).clear(); }),
        });
        return tx;
      },
    };
    stato.connessioni.push(db);
    return db;
  }

  return {
    stato,
    open() {
      stato.aperture += 1;
      const richiesta = {};
      setTimeout(() => { richiesta.result = nuovaConnessione(); richiesta.onsuccess?.(); }, 1);
      return richiesta;
    },
  };
}

const finto = fintoIndexedDB();
globalThis.indexedDB = finto;
globalThis.document = { dispatchEvent() {}, documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {} } };

const db = await import('../js/db.js');
const { salvaImpostazioni, caricaImpostazioni, impostazioni } = await import('../js/model/impostazioni.js');

test('db: salva e rilegge', async () => {
  await db.salva('conti', { id: 'c1', nome: 'Conto di prova' });
  assert.deepEqual(await db.tutti('conti'), [{ id: 'c1', nome: 'Conto di prova' }]);
  assert.equal(finto.stato.aperture, 1, 'una sola connessione per tutte le operazioni');
});

test('db: se la connessione viene chiusa, la prossima operazione ne apre una nuova', async () => {
  (await db.apriDb()).close(); // quello che fa il browser quando libera risorse, senza avvisare
  assert.deepEqual(await db.tutti('conti'), [{ id: 'c1', nome: 'Conto di prova' }]);
  assert.equal(finto.stato.aperture, 2);
  await db.salva('conti', { id: 'c2', nome: 'Altro conto' }); // anche le scritture
  assert.equal((await db.tutti('conti')).length, 2);
  assert.equal(finto.stato.aperture, 2, 'la connessione nuova viene riusata');
});

test('db: quando il browser avvisa della chiusura, la connessione vecchia non si usa più', async () => {
  const vecchia = await db.apriDb();
  vecchia.chiusa = true;
  vecchia.onclose(); // l'avviso del browser
  const nuova = await db.apriDb();
  assert.notEqual(nuova, vecchia);
  assert.equal((await db.tutti('conti')).length, 2);
});

test('db: due operazioni che trovano la connessione chiusa ne aprono una sola', async () => {
  (await db.apriDb()).close();
  const prima = finto.stato.aperture;
  await Promise.all([db.tutti('conti'), db.tutti('conti'), db.leggi('conti', 'c1')]);
  assert.equal(finto.stato.aperture, prima + 1);
});

test('impostazioni: due salvataggi partiti insieme non si cancellano a vicenda', async () => {
  await caricaImpostazioni();
  await Promise.all([salvaImpostazioni({ giornoInizioMese: 27 }), salvaImpostazioni({ contoPredefinito: 'conto-di-prova' })]);
  const salvate = await db.leggi('impostazioni', 'principale');
  assert.equal(salvate.giornoInizioMese, 27);
  assert.equal(salvate.contoPredefinito, 'conto-di-prova');
  assert.equal(impostazioni().giornoInizioMese, 27);
  assert.equal(impostazioni().contoPredefinito, 'conto-di-prova');
});

test('impostazioni: un salvataggio fallito non blocca quelli dopo', async () => {
  const connessione = await db.apriDb();
  const originale = connessione.transaction;
  connessione.transaction = () => { throw new Error('disco pieno'); };
  await assert.rejects(salvaImpostazioni({ giornoInizioMese: 5 }), /disco pieno/);
  connessione.transaction = originale;
  await salvaImpostazioni({ giornoInizioMese: 10 });
  assert.equal((await db.leggi('impostazioni', 'principale')).giornoInizioMese, 10);
  assert.equal(impostazioni().giornoInizioMese, 10);
});
