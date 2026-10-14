import test from 'node:test';
import assert from 'node:assert/strict';
import { applicaTasto, MAX_CIFRE_INTERE } from '../js/components/tastierino.js';

const digita = (sequenza) => [...sequenza].reduce((testo, t) => applicaTasto(testo, t === '<' ? 'cancella' : t), '');

test('cifre semplici', () => {
  assert.equal(digita('1250'), '1250');
});

test('la virgola: una sola, e con importo vuoto parte da "0,"', () => {
  assert.equal(digita(','), '0,');
  assert.equal(digita('12,,5'), '12,5');
  assert.equal(digita('1,2,3'), '1,23');
});

test('al massimo due decimali', () => {
  assert.equal(digita('1,2345'), '1,23');
});

test('niente zeri iniziali', () => {
  assert.equal(digita('0'), '0');
  assert.equal(digita('00'), '0');
  assert.equal(digita('05'), '5');
  assert.equal(digita('0,05'), '0,05');
});

test('limite di cifre intere', () => {
  const lungo = digita('1'.repeat(MAX_CIFRE_INTERE + 3));
  assert.equal(lungo.length, MAX_CIFRE_INTERE);
});

test('cancella e azzera', () => {
  assert.equal(digita('123<'), '12');
  assert.equal(digita('1,5<<'), '1');
  assert.equal(digita('<<<'), '');
  assert.equal(applicaTasto('123,45', 'azzera'), '');
});

test('tasti sconosciuti sono ignorati', () => {
  assert.equal(applicaTasto('12', 'x'), '12');
});
