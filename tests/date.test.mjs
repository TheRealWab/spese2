import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggiungiGiorni, aggiungiMesi, cicloContenente, cicloPrecedente, cicloSuccessivo,
  dataValida, dentroCiclo, giorniNelMese, oggiIso,
} from '../js/util/date.js';

test('oggiIso usa la data locale', () => {
  assert.equal(oggiIso(new Date(2026, 9, 14, 23, 59)), '2026-10-14');
  assert.equal(oggiIso(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
});

test('giorniNelMese e anni bisestili', () => {
  assert.equal(giorniNelMese(2026, 2), 28);
  assert.equal(giorniNelMese(2028, 2), 29);
  assert.equal(giorniNelMese(2026, 12), 31);
});

test('dataValida', () => {
  assert.ok(dataValida('2026-10-14'));
  assert.ok(dataValida('2028-02-29'));
  assert.ok(!dataValida('2026-02-29'));
  assert.ok(!dataValida('2026-13-01'));
  assert.ok(!dataValida('14/10/2026'));
  assert.ok(!dataValida(null));
});

test('aggiungiGiorni attraversa mesi e anni', () => {
  assert.equal(aggiungiGiorni('2026-10-31', 1), '2026-11-01');
  assert.equal(aggiungiGiorni('2026-01-01', -1), '2025-12-31');
  assert.equal(aggiungiGiorni('2028-02-28', 1), '2028-02-29');
});

test('aggiungiMesi usa l\'ultimo giorno se il giorno non esiste', () => {
  assert.equal(aggiungiMesi('2026-01-31', 1), '2026-02-28');
  assert.equal(aggiungiMesi('2028-01-31', 1), '2028-02-29');
  assert.equal(aggiungiMesi('2026-12-15', 1), '2027-01-15');
  assert.equal(aggiungiMesi('2026-01-15', -2), '2025-11-15');
});

test('ciclo con inizio il 1° = mese di calendario', () => {
  assert.deepEqual(cicloContenente('2026-10-14', 1), { inizio: '2026-10-01', fine: '2026-10-31' });
  assert.deepEqual(cicloContenente('2026-02-10', 1), { inizio: '2026-02-01', fine: '2026-02-28' });
  assert.deepEqual(cicloContenente('2028-02-29', 1), { inizio: '2028-02-01', fine: '2028-02-29' });
});

test('ciclo con inizio il 27: prima e dopo il giorno di inizio', () => {
  assert.deepEqual(cicloContenente('2026-10-14', 27), { inizio: '2026-09-27', fine: '2026-10-26' });
  assert.deepEqual(cicloContenente('2026-10-26', 27), { inizio: '2026-09-27', fine: '2026-10-26' });
  assert.deepEqual(cicloContenente('2026-10-27', 27), { inizio: '2026-10-27', fine: '2026-11-26' });
});

test('ciclo a cavallo dell\'anno e di febbraio', () => {
  assert.deepEqual(cicloContenente('2026-01-05', 27), { inizio: '2025-12-27', fine: '2026-01-26' });
  assert.deepEqual(cicloContenente('2026-02-27', 28), { inizio: '2026-01-28', fine: '2026-02-27' });
  assert.deepEqual(cicloContenente('2026-03-10', 28), { inizio: '2026-02-28', fine: '2026-03-27' });
});

test('ciclo precedente e successivo sono contigui e senza buchi', () => {
  for (const giorno of [1, 15, 27, 28]) {
    let ciclo = cicloContenente('2026-10-14', giorno);
    for (let i = 0; i < 30; i += 1) {
      const dopo = cicloSuccessivo(ciclo, giorno);
      assert.equal(dopo.inizio, aggiungiGiorni(ciclo.fine, 1));
      assert.deepEqual(cicloPrecedente(dopo, giorno), ciclo);
      ciclo = dopo;
    }
  }
});

test('dentroCiclo include gli estremi', () => {
  const c = { inizio: '2026-09-27', fine: '2026-10-26' };
  assert.ok(dentroCiclo('2026-09-27', c));
  assert.ok(dentroCiclo('2026-10-26', c));
  assert.ok(!dentroCiclo('2026-10-27', c));
});
