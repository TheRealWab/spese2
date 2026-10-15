import test from 'node:test';
import assert from 'node:assert/strict';
import { ICONE } from '../vendor/lucide/icone.js';
import { TAG } from '../vendor/lucide/tag.js';
import { PAROLE_IT, ICONE_SUGGERITE } from '../js/model/parole-icone.js';
import { cercaIcone, normalizza } from '../js/model/ricerca-icone.js';

const nomi = Object.keys(ICONE);
const cerca = (q, max) => cercaIcone(q, nomi, TAG, max);

test('il set contiene tutte le icone Lucide e le parole chiave', () => {
  assert.ok(nomi.length > 2000);
  assert.ok(Object.keys(TAG).length > 1500);
  for (const nome of Object.keys(TAG)) assert.ok(nome in ICONE, `parole chiave per un'icona inesistente: ${nome}`);
});

test('ogni parola italiana del dizionario trova almeno un\'icona', () => {
  const senzaRisultati = Object.keys(PAROLE_IT).filter((parola) => !cerca(normalizza(parola)).length);
  assert.deepEqual(senzaRisultati, []);
});

test('ogni traduzione del dizionario corrisponde a un\'icona o a una parola chiave reale', () => {
  const parole = new Set(nomi.flatMap((n) => [n, ...n.split('-'), ...(TAG[n] ?? '').split(/[\s-]+/)]));
  const orfane = Object.entries(PAROLE_IT).flatMap(([it, ing]) => ing.filter((i) => !parole.has(i)).map((i) => `${it}→${i}`));
  assert.deepEqual(orfane, []);
});

test('le icone suggerite esistono tutte e non ci sono doppioni', () => {
  for (const nome of ICONE_SUGGERITE) assert.ok(nome in ICONE, `icona suggerita inesistente: ${nome}`);
  assert.equal(new Set(ICONE_SUGGERITE).size, ICONE_SUGGERITE.length);
});

test('esempi italiani: gatto, caffè, auto, cane, palestra, regalo', () => {
  assert.equal(cerca('gatto')[0], 'cat');
  assert.equal(cerca('caffè')[0], 'coffee');
  assert.equal(cerca('Caffe')[0], 'coffee');
  assert.equal(cerca('auto')[0], 'car');
  assert.ok(cerca('cane', 3).includes('dog'));
  assert.equal(cerca('palestra')[0], 'dumbbell');
  assert.equal(cerca('regalo')[0], 'gift');
  assert.equal(cerca('benzina')[0], 'fuel');
});

test('si può cercare anche in inglese e per nome parziale', () => {
  assert.equal(cerca('cat')[0], 'cat');
  assert.equal(cerca('coffee')[0], 'coffee');
  assert.ok(cerca('shopping').includes('shopping-cart'));
});

test('più parole: devono trovare tutte qualcosa', () => {
  assert.ok(cerca('casa wifi').includes('house-wifi'));
  assert.deepEqual(cerca('gatto xyzxyz'), []);
});

test('ricerca vuota o senza risultati, e limite di risultati', () => {
  assert.deepEqual(cerca(''), []);
  assert.deepEqual(cerca('   '), []);
  assert.deepEqual(cerca('qqqqqqq'), []);
  assert.ok(cerca('casa', 3).length <= 3);
});

test('normalizza toglie accenti e maiuscole', () => {
  assert.equal(normalizza('  Caffè  '), 'caffe');
});
