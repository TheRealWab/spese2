import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinaManuale, ordinaPerUso, categoriePerInserimento } from '../js/model/categorie.js';

// Dati inventati.
const categorie = [
  { id: 'a', nome: 'Alfa', tipo: 'spesa', ordine: 0 },
  { id: 'b', nome: 'Beta', tipo: 'spesa', ordine: 1 },
  { id: 'c', nome: 'Gamma', tipo: 'spesa', ordine: 2 },
  { id: 'd', nome: 'Delta', tipo: 'spesa', ordine: 3, archiviata: true },
  { id: 'e', nome: 'Entrata', tipo: 'entrata', ordine: 4 },
];
const oggi = '2026-10-14';
const uso = (categoriaId, giorniFa = 1) => ({ categoriaId, data: `2026-10-${String(14 - giorniFa).padStart(2, '0')}` });

test('ordinaManuale segue il campo ordine e non modifica l\'originale', () => {
  const mescolate = [categorie[2], categorie[0], categorie[1]];
  assert.deepEqual(ordinaManuale(mescolate).map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(mescolate.map((c) => c.id), ['c', 'a', 'b']);
});

test('categoriePerInserimento: solo il tipo richiesto e niente archiviate', () => {
  const lista = categoriePerInserimento(categorie, 'spesa', [], oggi, 'manuale');
  assert.deepEqual(lista.map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(categoriePerInserimento(categorie, 'entrata', [], oggi, 'manuale').map((c) => c.id), ['e']);
});

// --- Test dell'ordinamento per uso -----------------------------------------------------------
// Regole valide per qualsiasi scelta di ordinamento per uso (finestra, pesi, soglia).

test('ordinaPerUso: la categoria più usata viene prima', () => {
  const lista = ordinaPerUso(categorie.slice(0, 3), [uso('c'), uso('c'), uso('c'), uso('b')], oggi);
  assert.equal(lista[0].id, 'c');
  assert.equal(lista[1].id, 'b');
});

test('ordinaPerUso: a parità di uso vale l\'ordine manuale', () => {
  const lista = ordinaPerUso(categorie.slice(0, 3), [uso('c'), uso('b')], oggi);
  assert.deepEqual(lista.map((c) => c.id), ['b', 'c', 'a']);
});

test('ordinaPerUso: senza movimenti restituisce l\'ordine manuale', () => {
  assert.deepEqual(ordinaPerUso(categorie.slice(0, 3), [], oggi).map((c) => c.id), ['a', 'b', 'c']);
});

test('ordinaPerUso: ignora i trasferimenti (categoriaId null) e non modifica gli argomenti', () => {
  const lista = categorie.slice(0, 3);
  const copia = lista.map((c) => ({ ...c }));
  const risultato = ordinaPerUso(lista, [{ categoriaId: null, data: '2026-10-13' }], oggi);
  assert.equal(risultato.length, 3);
  assert.deepEqual(lista, copia);
});
