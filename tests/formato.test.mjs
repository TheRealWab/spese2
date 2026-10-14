import test from 'node:test';
import assert from 'node:assert/strict';
import {
  centesimiInDigitato, dataLunga, digitatoInCentesimi, etichettaCiclo, etichettaGiorno, euro,
  euroArrotondato, euroCompatto, euroConSegno, formattaDigitato, meseAnno, percentuale,
} from '../js/util/formato.js';

// Intl inserisce uno spazio non separabile prima del simbolo €: lo normalizziamo per leggere i test.
const n = (testo) => testo.replace(/ /g, ' ');

test('euro in formato italiano', () => {
  assert.equal(n(euro(123456)), '1.234,56 €');
  assert.equal(n(euro(5)), '0,05 €');
  assert.equal(n(euro(0)), '0,00 €');
  assert.equal(n(euro(100000000)), '1.000.000,00 €');
});

test('euroCompatto toglie i decimali solo se l\'importo è tondo', () => {
  assert.equal(n(euroCompatto(62000)), '620 €');
  assert.equal(n(euroCompatto(62050)), '620,50 €');
  assert.equal(n(euroCompatto(145000)), '1.450 €');
});

test('euroArrotondato', () => {
  assert.equal(n(euroArrotondato(123456)), '1.235 €');
  assert.equal(n(euroArrotondato(49)), '0 €');
});

test('euroConSegno', () => {
  assert.equal(n(euroConSegno(1250)), '+12,50 €');
  assert.equal(n(euroConSegno(-1250)), '−12,50 €');
  assert.equal(n(euroConSegno(0)), '0,00 €');
});

test('percentuale', () => {
  assert.equal(percentuale(57.4), '57%');
  assert.equal(percentuale(79.5), '80%');
});

test('cifre digitate: formattazione e conversione', () => {
  assert.equal(formattaDigitato(''), '0');
  assert.equal(formattaDigitato('1234'), '1.234');
  assert.equal(formattaDigitato('1234567,5'), '1.234.567,5');
  assert.equal(formattaDigitato('0,'), '0,');
  assert.equal(digitatoInCentesimi(''), 0);
  assert.equal(digitatoInCentesimi('12'), 1200);
  assert.equal(digitatoInCentesimi('12,'), 1200);
  assert.equal(digitatoInCentesimi('12,5'), 1250);
  assert.equal(digitatoInCentesimi('12,05'), 1205);
  assert.equal(digitatoInCentesimi('0,99'), 99);
});

test('centesimi → cifre digitate (andata e ritorno)', () => {
  for (const c of [1, 5, 10, 99, 100, 1250, 1205, 99999999]) {
    assert.equal(digitatoInCentesimi(centesimiInDigitato(c)), c);
  }
  assert.equal(centesimiInDigitato(1200), '12');
  assert.equal(centesimiInDigitato(1250), '12,5');
});

test('date in italiano', () => {
  assert.equal(dataLunga('2026-10-14'), '14 ottobre 2026');
  assert.equal(meseAnno('2026-10-14'), 'Ottobre 2026');
});

test('etichettaGiorno: Oggi, Ieri, data', () => {
  assert.equal(etichettaGiorno('2026-10-14', '2026-10-14'), 'Oggi');
  assert.equal(etichettaGiorno('2026-10-13', '2026-10-14'), 'Ieri');
  assert.equal(etichettaGiorno('2026-10-12', '2026-10-14'), '12 ottobre');
  assert.equal(etichettaGiorno('2025-12-31', '2026-01-01'), 'Ieri');
  assert.equal(etichettaGiorno('2025-10-12', '2026-10-14'), '12 ottobre 2025');
});

test('etichettaCiclo', () => {
  assert.equal(etichettaCiclo({ inizio: '2026-10-01', fine: '2026-10-31' }, 1), 'Ottobre 2026');
  assert.equal(etichettaCiclo({ inizio: '2026-10-10', fine: '2026-11-09' }, 10), '10 ott – 9 nov');
  assert.equal(etichettaCiclo({ inizio: '2025-12-27', fine: '2026-01-26' }, 27), '27 dic 2025 – 26 gen 2026');
});
