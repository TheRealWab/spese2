import test from 'node:test';
import assert from 'node:assert/strict';
import { totaliPerCategoria } from '../js/model/categorie.js';
import { scomponiPerNota, segmentiBarra, filtraPerNota, CHIAVE_SENZA_NOTA, CHIAVE_ALTRE } from '../js/model/note.js';
import {
  periodoContenente, periodoPrecedente, periodoSuccessivo, periodoValido, cambiaModo, etichettaPeriodo, contieneData,
  INIZIO_STORIA, FINE_STORIA,
} from '../js/model/periodi.js';

// Dati inventati.
const spesa = (categoriaId, importo, nota = '', data = '2026-03-10') => ({ tipo: 'spesa', categoriaId, importo, nota, data });
const entrata = (categoriaId, importo, data = '2026-03-10') => ({ tipo: 'entrata', categoriaId, importo, nota: '', data });

// ---- Totali per categoria ----

test('totaliPerCategoria: somma per categoria, ordine per importo, percentuali', () => {
  const movimenti = [spesa('a', 1000), spesa('b', 3000), spesa('a', 500), spesa('c', 500), entrata('s', 150000)];
  const r = totaliPerCategoria(movimenti, 'spesa');
  assert.deepEqual(r.righe.map((x) => [x.categoriaId, x.totale, x.conteggio]), [['b', 3000, 1], ['a', 1500, 2], ['c', 500, 1]]);
  assert.equal(r.totale, 5000);
  assert.equal(r.conteggio, 4);
  assert.equal(r.righe[0].percentuale, 60);
  assert.equal(r.righe.reduce((s, x) => s + x.percentuale, 0), 100);
});

test('totaliPerCategoria: le entrate e i trasferimenti non finiscono tra le spese e viceversa', () => {
  const movimenti = [spesa('a', 100), entrata('s', 900), { tipo: 'trasferimento', categoriaId: null, importo: 5000, data: '2026-03-10' }];
  assert.equal(totaliPerCategoria(movimenti, 'spesa').totale, 100);
  assert.equal(totaliPerCategoria(movimenti, 'entrata').totale, 900);
});

test('totaliPerCategoria: a parità di importo vince chi ha più movimenti; senza movimenti non divide per zero', () => {
  const r = totaliPerCategoria([spesa('x', 500), spesa('y', 250), spesa('y', 250)], 'spesa');
  assert.deepEqual(r.righe.map((x) => x.categoriaId), ['y', 'x']);
  const vuoto = totaliPerCategoria([], 'spesa');
  assert.deepEqual(vuoto, { righe: [], totale: 0, conteggio: 0 });
});

// ---- Scomposizione per nota ----

test('scomponiPerNota: maiuscole e spazi non creano note diverse, "senza nota" va in fondo', () => {
  const movimenti = [
    spesa('a', 9500, 'Supermercato'), spesa('a', 3800, 'Panificio'), spesa('a', 3200, 'Macelleria'),
    spesa('a', 1500, ''), spesa('a', 100, '  panificio '), spesa('a', 50, 'Panificio'),
  ];
  const voci = scomponiPerNota(movimenti);
  assert.deepEqual(voci.map((v) => [v.nota, v.importo, v.conteggio]), [
    ['Supermercato', 9500, 1], ['Panificio', 3950, 3], ['Macelleria', 3200, 1], ['', 1500, 1],
  ]);
  assert.equal(voci.at(-1).chiave, CHIAVE_SENZA_NOTA);
});

test('scomponiPerNota: la grafia mostrata è la più usata', () => {
  const voci = scomponiPerNota([spesa('a', 1, 'pane'), spesa('a', 1, 'Pane'), spesa('a', 1, 'Pane')]);
  assert.equal(voci.length, 1);
  assert.equal(voci[0].nota, 'Pane');
});

test('scomponiPerNota: a parità di importo, più movimenti poi ordine alfabetico; nessun movimento → nessuna voce', () => {
  const voci = scomponiPerNota([spesa('a', 200, 'zeta'), spesa('a', 100, 'alfa'), spesa('a', 100, 'beta')]);
  assert.deepEqual(voci.map((v) => v.nota), ['zeta', 'alfa', 'beta']);
  assert.deepEqual(scomponiPerNota([]), []);
});

test('segmentiBarra: prime N note, resto in "Altre", "senza nota" a parte, percentuali sul totale', () => {
  const voci = scomponiPerNota([
    spesa('a', 500, 'n1'), spesa('a', 400, 'n2'), spesa('a', 300, 'n3'), spesa('a', 200, 'n4'),
    spesa('a', 50, 'n5'), spesa('a', 50, 'n6'), spesa('a', 500, ''),
  ]);
  const segmenti = segmentiBarra(voci, 4);
  assert.deepEqual(segmenti.map((s) => s.chiave), ['n1', 'n2', 'n3', 'n4', CHIAVE_ALTRE, CHIAVE_SENZA_NOTA]);
  assert.equal(segmenti.find((s) => s.chiave === CHIAVE_ALTRE).importo, 100);
  assert.equal(segmenti.find((s) => s.chiave === CHIAVE_ALTRE).conteggio, 2);
  assert.equal(Math.round(segmenti.reduce((s, x) => s + x.percentuale, 0)), 100);
});

test('segmentiBarra: senza "altre" quando le note stanno tutte nel limite', () => {
  const segmenti = segmentiBarra(scomponiPerNota([spesa('a', 100, 'x'), spesa('a', 100, 'y')]), 5);
  assert.deepEqual(segmenti.map((s) => s.chiave), ['x', 'y']);
  assert.deepEqual(segmentiBarra([]), []);
});

test('filtraPerNota: per chiave, anche "senza nota"', () => {
  const movimenti = [spesa('a', 1, 'Pane'), spesa('a', 2, ' pane'), spesa('a', 3, ''), spesa('a', 4, 'Latte')];
  assert.deepEqual(filtraPerNota(movimenti, 'pane').map((m) => m.importo), [1, 2]);
  assert.deepEqual(filtraPerNota(movimenti, CHIAVE_SENZA_NOTA).map((m) => m.importo), [3]);
});

// ---- Periodi ----

test('periodoContenente: mese di calendario, ciclo dal 27, anno, sempre', () => {
  assert.deepEqual(periodoContenente('mese', '2026-10-14', 1), { modo: 'mese', da: '2026-10-01', a: '2026-10-31' });
  assert.deepEqual(periodoContenente('mese', '2026-10-14', 27), { modo: 'mese', da: '2026-09-27', a: '2026-10-26' });
  assert.deepEqual(periodoContenente('anno', '2026-10-14'), { modo: 'anno', da: '2026-01-01', a: '2026-12-31' });
  assert.deepEqual(periodoContenente('sempre', '2026-10-14'), { modo: 'sempre', da: INIZIO_STORIA, a: FINE_STORIA });
});

test('periodoPrecedente e Successivo: mese, anno e sempre (resta uguale)', () => {
  const mese = periodoContenente('mese', '2026-01-15', 1);
  assert.deepEqual(periodoPrecedente(mese, 1), { modo: 'mese', da: '2025-12-01', a: '2025-12-31' });
  assert.deepEqual(periodoSuccessivo(mese, 1), { modo: 'mese', da: '2026-02-01', a: '2026-02-28' });
  const anno = periodoContenente('anno', '2026-06-01');
  assert.equal(periodoPrecedente(anno).da, '2025-01-01');
  assert.equal(periodoSuccessivo(anno).a, '2027-12-31');
  const sempre = periodoContenente('sempre', '2026-06-01');
  assert.deepEqual(periodoPrecedente(sempre), sempre);
  assert.deepEqual(periodoSuccessivo(sempre), sempre);
});

test('periodoValido: un mese salvato con un altro giorno di inizio non vale più', () => {
  const dal27 = periodoContenente('mese', '2026-10-14', 27);
  assert.equal(periodoValido(dal27, 27), true);
  assert.equal(periodoValido(dal27, 1), false);
  assert.equal(periodoValido(periodoContenente('anno', '2026-10-14'), 27), true);
  assert.equal(periodoValido(null, 1), false);
  assert.equal(periodoValido({ modo: 'boh' }, 1), false);
});

test('cambiaModo: da un mese passato resta nello stesso anno; da quello corrente va a oggi', () => {
  const oggi = '2026-10-14';
  const marzo = periodoContenente('mese', '2026-03-05', 1);
  assert.deepEqual(cambiaModo(marzo, 'anno', oggi, 1), periodoContenente('anno', '2026-03-05'));
  const corrente = periodoContenente('mese', oggi, 1);
  assert.deepEqual(cambiaModo(corrente, 'anno', oggi, 1), periodoContenente('anno', oggi));
  const annoVecchio = periodoContenente('anno', '2024-06-01');
  assert.deepEqual(cambiaModo(annoVecchio, 'mese', oggi, 1), periodoContenente('mese', '2024-01-01', 1));
  assert.deepEqual(cambiaModo(periodoContenente('sempre', oggi), 'mese', oggi, 1), corrente);
  assert.equal(cambiaModo(corrente, 'mese', oggi, 1), corrente);
});

test('etichettaPeriodo e contieneData', () => {
  assert.equal(etichettaPeriodo(periodoContenente('mese', '2026-10-14', 1), 1), 'Ottobre 2026');
  assert.equal(etichettaPeriodo(periodoContenente('mese', '2026-10-14', 27), 27), '27 set – 26 ott');
  assert.equal(etichettaPeriodo(periodoContenente('anno', '2026-10-14')), '2026');
  assert.equal(etichettaPeriodo(periodoContenente('sempre', '2026-10-14')), 'Tutto lo storico');
  const p = periodoContenente('mese', '2026-10-14', 1);
  assert.equal(contieneData(p, '2026-10-01'), true);
  assert.equal(contieneData(p, '2026-10-31'), true);
  assert.equal(contieneData(p, '2026-11-01'), false);
});
