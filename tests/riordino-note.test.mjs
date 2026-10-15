import test from 'node:test';
import assert from 'node:assert/strict';
import { pianoRiordino } from '../js/model/categorie.js';
import { scomponiPerNota, validaNomeNota, risolviNuovoNome, pianoNota, LUNGHEZZA_MAX_NOTA } from '../js/model/note.js';

// Dati inventati.
const cat = (id, tipo, ordine, archiviata = false) => ({ id, nome: id, tipo, ordine, archiviata });
const mov = (id, nota, categoriaId = 'cibo', importo = 500) => ({ id, tipo: 'spesa', categoriaId, importo, nota, data: '2026-03-10' });

// ---- Riordino delle categorie ----

test('pianoRiordino: riassegna i posti già occupati dalle categorie attive del tipo', () => {
  const categorie = [cat('a', 'spesa', 0), cat('b', 'spesa', 1), cat('c', 'spesa', 2), cat('e', 'entrata', 3)];
  const cambiate = pianoRiordino(categorie, 'spesa', ['c', 'a', 'b']);
  assert.deepEqual(cambiate.map((c) => [c.id, c.ordine]).sort(), [['a', 1], ['b', 2], ['c', 0]]);
});

test('pianoRiordino: restituisce solo ciò che cambia e non tocca archiviate né l\'altro tipo', () => {
  const categorie = [cat('a', 'spesa', 0), cat('x', 'spesa', 1, true), cat('b', 'spesa', 2), cat('e', 'entrata', 3)];
  const cambiate = pianoRiordino(categorie, 'spesa', ['b', 'a']);
  assert.deepEqual(cambiate.map((c) => [c.id, c.ordine]).sort(), [['a', 2], ['b', 0]]);
  assert.equal(pianoRiordino(categorie, 'spesa', ['a', 'b']).length, 0); // stesso ordine: nulla da salvare
});

test('pianoRiordino: non modifica gli oggetti ricevuti', () => {
  const categorie = [cat('a', 'spesa', 0), cat('b', 'spesa', 1)];
  pianoRiordino(categorie, 'spesa', ['b', 'a']);
  assert.deepEqual(categorie.map((c) => c.ordine), [0, 1]);
});

test('pianoRiordino: due categorie con lo stesso valore di ordine finiscono comunque in posti diversi', () => {
  const categorie = [cat('a', 'spesa', 0), cat('b', 'spesa', 0), cat('c', 'spesa', 0)];
  const cambiate = pianoRiordino(categorie, 'spesa', ['c', 'b', 'a']);
  const finale = new Map(categorie.map((c) => [c.id, c.ordine]));
  for (const c of cambiate) finale.set(c.id, c.ordine);
  assert.equal(new Set(finale.values()).size, 3);
  assert.ok(finale.get('c') < finale.get('b') && finale.get('b') < finale.get('a'));
});

test('pianoRiordino: un elenco che non coincide con le categorie attive è un errore', () => {
  const categorie = [cat('a', 'spesa', 0), cat('b', 'spesa', 1), cat('x', 'spesa', 2, true)];
  assert.throws(() => pianoRiordino(categorie, 'spesa', ['a']));
  assert.throws(() => pianoRiordino(categorie, 'spesa', ['a', 'a']));
  assert.throws(() => pianoRiordino(categorie, 'spesa', ['a', 'x']));
  assert.throws(() => pianoRiordino(categorie, 'spesa', ['a', 'b', 'c']));
});

// ---- Rinomina e unione delle note ----

test('validaNomeNota: non vuota, non troppo lunga', () => {
  assert.equal(validaNomeNota('Panificio'), null);
  assert.match(validaNomeNota('   '), /Scrivi/);
  assert.match(validaNomeNota('x'.repeat(LUNGHEZZA_MAX_NOTA + 1)), /al massimo/);
  assert.equal(validaNomeNota('x'.repeat(LUNGHEZZA_MAX_NOTA)), null);
});

test('pianoNota: rinomina tutti i movimenti della nota, a prescindere da maiuscole e spazi', () => {
  const movimenti = [mov('1', 'pane'), mov('2', ' Pane '), mov('3', 'latte'), mov('4', '')];
  const { modificati, originali } = pianoNota(movimenti, 'pane', 'Panificio', '2026-03-11T10:00:00.000Z');
  assert.deepEqual(modificati.map((m) => [m.id, m.nota]), [['1', 'Panificio'], ['2', 'Panificio']]);
  assert.ok(modificati.every((m) => m.modificatoIl === '2026-03-11T10:00:00.000Z'));
  assert.deepEqual(originali.map((m) => m.id), ['1', '2']);
  assert.equal(movimenti[0].nota, 'pane'); // gli originali non cambiano: servono per annullare
});

test('pianoNota: solo cambio di maiuscole, e chi è già a posto non si tocca', () => {
  const movimenti = [mov('1', 'pane'), mov('2', 'Pane')];
  const { modificati } = pianoNota(movimenti, 'pane', 'Pane', 'ora');
  assert.deepEqual(modificati.map((m) => m.id), ['1']);
});

test('pianoNota: "senza nota" e nomi vuoti non si possono rinominare', () => {
  const movimenti = [mov('1', ''), mov('2', 'pane')];
  assert.equal(pianoNota(movimenti, '', 'Qualcosa', 'ora').modificati.length, 0);
  assert.equal(pianoNota(movimenti, 'pane', '  ', 'ora').modificati.length, 0);
});

test('pianoNota: annullare (salvare gli originali) riporta tutto com\'era', () => {
  const movimenti = [mov('1', 'pane'), mov('2', 'latte')];
  const { originali } = pianoNota(movimenti, 'pane', 'Panificio', 'ora');
  assert.deepEqual(originali, [movimenti[0]]);
});

test('risolviNuovoNome: un nome già usato da un\'altra nota unisce le due, con la grafia esistente', () => {
  const voci = scomponiPerNota([mov('1', 'pane'), mov('2', 'Panificio'), mov('3', 'Panificio'), mov('4', '')]);
  const unione = risolviNuovoNome(voci, 'pane', ' panificio ');
  assert.equal(unione.nome, 'Panificio');
  assert.equal(unione.unisceCon.chiave, 'panificio');
  assert.equal(unione.unisceCon.conteggio, 2);
  const semplice = risolviNuovoNome(voci, 'pane', 'Forno');
  assert.deepEqual([semplice.nome, semplice.unisceCon], ['Forno', null]);
});

test('risolviNuovoNome: cambiare solo le maiuscole della stessa nota non è un\'unione', () => {
  const voci = scomponiPerNota([mov('1', 'pane'), mov('2', 'latte')]);
  const r = risolviNuovoNome(voci, 'pane', 'PANE');
  assert.deepEqual([r.nome, r.unisceCon], ['PANE', null]);
});
