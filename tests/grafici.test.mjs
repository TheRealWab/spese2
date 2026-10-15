import test from 'node:test';
import assert from 'node:assert/strict';
import {
  periodoContenente, periodoPrecedente, periodoSuccessivo, periodoValido, cambiaModo, etichettaPeriodo, MODI_GRAFICI,
} from '../js/model/periodi.js';
import {
  periodoEffettivo, granularita, sottoperiodi, totaliPerSottoperiodo, confrontoSpese, nomePeriodoPrecedente, fetteCiambella,
} from '../js/model/grafici.js';

// Dati inventati. 2026-10-15 è un giovedì.
const OGGI = '2026-10-15';
const spesa = (importo, data) => ({ tipo: 'spesa', importo, data, categoriaId: 'c' });
const entrata = (importo, data) => ({ tipo: 'entrata', importo, data, categoriaId: 's' });

// ---- Periodi nuovi ----

test('periodoContenente: giorno, settimana (lunedì–domenica), 6 mesi, personalizzato', () => {
  assert.deepEqual(periodoContenente('giorno', OGGI), { modo: 'giorno', da: OGGI, a: OGGI });
  assert.deepEqual(periodoContenente('settimana', OGGI), { modo: 'settimana', da: '2026-10-12', a: '2026-10-18' });
  assert.deepEqual(periodoContenente('settimana', '2026-10-18'), { modo: 'settimana', da: '2026-10-12', a: '2026-10-18' }); // domenica
  assert.deepEqual(periodoContenente('settimana', '2026-10-12'), { modo: 'settimana', da: '2026-10-12', a: '2026-10-18' }); // lunedì
  assert.deepEqual(periodoContenente('6mesi', OGGI, 1), { modo: '6mesi', da: '2026-05-01', a: '2026-10-31' });
  assert.deepEqual(periodoContenente('6mesi', OGGI, 27), { modo: '6mesi', da: '2026-04-27', a: '2026-10-26' });
  assert.deepEqual(periodoContenente('personalizzato', OGGI), { modo: 'personalizzato', da: OGGI, a: OGGI });
});

test('periodoPrecedente e Successivo: ogni modo, e tornano al punto di partenza', () => {
  const giorno = periodoContenente('giorno', '2026-03-01');
  assert.deepEqual(periodoPrecedente(giorno), { modo: 'giorno', da: '2026-02-28', a: '2026-02-28' });
  const sett = periodoContenente('settimana', OGGI);
  assert.deepEqual(periodoPrecedente(sett), { modo: 'settimana', da: '2026-10-05', a: '2026-10-11' });
  assert.deepEqual(periodoSuccessivo(sett), { modo: 'settimana', da: '2026-10-19', a: '2026-10-25' });
  const sei = periodoContenente('6mesi', OGGI, 1);
  assert.deepEqual(periodoPrecedente(sei, 1), { modo: '6mesi', da: '2025-11-01', a: '2026-04-30' });
  assert.deepEqual(periodoSuccessivo(sei, 1), { modo: '6mesi', da: '2026-11-01', a: '2027-04-30' });
  const sei27 = periodoContenente('6mesi', OGGI, 27);
  assert.deepEqual(periodoPrecedente(sei27, 27), { modo: '6mesi', da: '2025-10-27', a: '2026-04-26' });
  const pers = { modo: 'personalizzato', da: '2026-10-05', a: '2026-10-14' }; // 10 giorni
  assert.deepEqual(periodoPrecedente(pers), { modo: 'personalizzato', da: '2026-09-25', a: '2026-10-04' });
  assert.deepEqual(periodoSuccessivo(pers), { modo: 'personalizzato', da: '2026-10-15', a: '2026-10-24' });
  for (const modo of ['giorno', 'settimana', 'mese', '6mesi', 'anno', 'personalizzato']) {
    const p = modo === 'personalizzato' ? pers : periodoContenente(modo, OGGI, 1);
    assert.deepEqual(periodoSuccessivo(periodoPrecedente(p, 1), 1), p, modo);
  }
});

test('periodoValido: i periodi salvati devono tornare; "sempre" è sempre valido', () => {
  assert.equal(periodoValido(periodoContenente('settimana', OGGI), 1), true);
  assert.equal(periodoValido({ modo: 'settimana', da: '2026-10-13', a: '2026-10-19' }, 1), false); // non parte di lunedì
  assert.equal(periodoValido({ modo: 'giorno', da: OGGI, a: '2026-10-16' }, 1), false);
  assert.equal(periodoValido(periodoContenente('6mesi', OGGI, 27), 27), true);
  assert.equal(periodoValido(periodoContenente('6mesi', OGGI, 27), 1), false);
  assert.equal(periodoValido({ modo: 'personalizzato', da: '2026-10-10', a: '2026-10-01' }, 1), false); // al contrario
  assert.equal(periodoValido({ modo: 'personalizzato', da: '2026-10-01', a: '2026-13-01' }, 1), false);
  assert.equal(periodoValido({ modo: 'personalizzato', da: '2026-10-01', a: '2026-10-10' }, 1), true);
  assert.equal(periodoValido(periodoContenente('sempre', OGGI), 1), true);
  assert.deepEqual(MODI_GRAFICI, ['giorno', 'settimana', 'mese', '6mesi', 'anno', 'personalizzato', 'sempre']);
});

test('cambiaModo verso "personalizzato": si tiene l\'intervallo che si guardava', () => {
  const mese = periodoContenente('mese', OGGI, 1);
  assert.deepEqual(cambiaModo(mese, 'personalizzato', OGGI, 1), { modo: 'personalizzato', da: '2026-10-01', a: '2026-10-31' });
  assert.deepEqual(cambiaModo(periodoContenente('sempre', OGGI), 'personalizzato', OGGI, 1), { modo: 'personalizzato', da: '2026-09-16', a: OGGI });
  assert.deepEqual(cambiaModo(mese, 'settimana', OGGI, 1), periodoContenente('settimana', OGGI)); // il mese contiene oggi
});

test('etichettaPeriodo dei nuovi modi', () => {
  assert.equal(etichettaPeriodo(periodoContenente('giorno', OGGI), 1, OGGI), 'Oggi');
  assert.equal(etichettaPeriodo(periodoContenente('giorno', '2026-10-14'), 1, OGGI), 'Ieri');
  assert.equal(etichettaPeriodo(periodoContenente('giorno', '2026-03-02'), 1, OGGI), '2 marzo');
  assert.equal(etichettaPeriodo(periodoContenente('settimana', OGGI), 1), '12 ott – 18 ott 2026');
  assert.equal(etichettaPeriodo(periodoContenente('6mesi', OGGI, 1), 1), 'mag 2026 – ott 2026');
  assert.equal(etichettaPeriodo({ modo: 'personalizzato', da: '2025-12-20', a: '2026-01-10' }, 1), '20 dic 2025 – 10 gen 2026');
});

// ---- Sotto-periodi ----

test('granularita: per modo, e per lunghezza con personalizzato e sempre', () => {
  assert.equal(granularita(periodoContenente('giorno', OGGI)), null);
  assert.equal(granularita(periodoContenente('settimana', OGGI)), 'giorno');
  assert.equal(granularita(periodoContenente('mese', OGGI)), 'giorno');
  assert.equal(granularita(periodoContenente('6mesi', OGGI)), 'mese');
  assert.equal(granularita(periodoContenente('anno', OGGI)), 'mese');
  const pers = (da, a) => granularita({ modo: 'personalizzato', da, a });
  assert.equal(pers('2026-10-01', '2026-10-31'), 'giorno');
  assert.equal(pers('2026-10-01', '2026-11-01'), 'settimana');
  assert.equal(pers('2026-01-01', '2026-06-30'), 'settimana');
  assert.equal(pers('2026-01-01', '2026-07-31'), 'mese');
  assert.equal(pers('2023-01-01', '2026-10-01'), 'anno');
});

test('sottoperiodi: giorni del mese fino a oggi, mesi dell\'anno fino a oggi', () => {
  const giorni = sottoperiodi(periodoContenente('mese', OGGI, 1), 1, OGGI);
  assert.equal(giorni.length, 15); // dal 1 al 15 ottobre: il futuro non c'è
  assert.deepEqual([giorni[0].da, giorni[0].a, giorni[0].breve], ['2026-10-01', '2026-10-01', '1']);
  assert.equal(giorni.at(-1).a, OGGI);
  const mesi = sottoperiodi(periodoContenente('anno', OGGI), 1, OGGI);
  assert.equal(mesi.length, 10); // gennaio … ottobre
  assert.deepEqual([mesi[0].da, mesi[0].a, mesi[0].breve], ['2026-01-01', '2026-01-31', 'gen']);
  assert.equal(mesi[1].a, '2026-02-28');
  assert.equal(mesi.at(-1).breve, 'ott');
  const passati = sottoperiodi(periodoContenente('anno', '2024-06-01'), 1, OGGI);
  assert.equal(passati.length, 12);
  assert.equal(passati[1].a, '2024-02-29'); // bisestile
});

test('sottoperiodi: settimane in parti, cicli dal 27, anni, giorno singolo senza barre', () => {
  const sett = sottoperiodi(periodoContenente('settimana', '2026-10-01'), 1, OGGI);
  assert.deepEqual(sett.map((s) => s.da), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  const pers = sottoperiodi({ modo: 'personalizzato', da: '2026-09-02', a: '2026-10-14' }, 1, OGGI); // 43 giorni: settimane
  assert.equal(pers[0].da, '2026-09-02'); // la prima è parziale (da mercoledì)
  assert.equal(pers[0].a, '2026-09-06');
  assert.equal(pers[1].da, '2026-09-07');
  assert.equal(pers.at(-1).a, '2026-10-14');
  const dal27 = sottoperiodi(periodoContenente('anno', OGGI), 27, OGGI);
  assert.equal(dal27[0].da, '2026-01-01'); // il primo ciclo è tagliato all'inizio dell'anno
  assert.equal(dal27[0].a, '2026-01-26');
  const anni = sottoperiodi({ modo: 'personalizzato', da: '2023-05-10', a: '2026-10-14' }, 1, OGGI);
  assert.deepEqual(anni.map((s) => s.breve), ['2023', '2024', '2025', '2026']);
  assert.equal(anni[0].da, '2023-05-10');
  assert.deepEqual(sottoperiodi(periodoContenente('giorno', OGGI), 1, OGGI), []);
});

test('totaliPerSottoperiodo: entrate, spese e risparmio; i trasferimenti non contano', () => {
  const parti = sottoperiodi(periodoContenente('anno', OGGI), 1, OGGI);
  const movimenti = [
    entrata(200000, '2026-01-05'), spesa(50000, '2026-01-20'), spesa(30000, '2026-03-01'),
    { tipo: 'trasferimento', importo: 99999, data: '2026-01-10' },
  ];
  const t = totaliPerSottoperiodo(movimenti, parti);
  assert.deepEqual([t[0].entrate, t[0].spese, t[0].risparmio], [200000, 50000, 150000]);
  assert.deepEqual([t[1].entrate, t[1].spese, t[1].risparmio], [0, 0, 0]);
  assert.deepEqual([t[2].spese, t[2].risparmio], [30000, -30000]);
});

test('periodoEffettivo: "sempre" va dalla prima data a oggi', () => {
  assert.deepEqual(periodoEffettivo(periodoContenente('sempre', OGGI), '2025-01-10', OGGI), { modo: 'sempre', da: '2025-01-10', a: OGGI });
  const mese = periodoContenente('mese', OGGI);
  assert.equal(periodoEffettivo(mese, '2025-01-10', OGGI), mese);
});

// ---- Confronto ----

test('confrontoSpese: periodo completo, confronto con il precedente e con la media', () => {
  const movimenti = [spesa(30000, '2026-05-10'), spesa(40000, '2026-06-10'), spesa(50000, '2026-07-10'), spesa(60000, '2026-08-10'), spesa(60000, '2026-09-10')];
  const c = confrontoSpese({ movimenti: [...movimenti, spesa(66000, '2026-09-20')], periodo: periodoContenente('mese', '2026-09-15'), giornoInizio: 1, primaData: '2026-05-01', oggi: OGGI });
  assert.equal(c.totale, 126000);
  assert.equal(c.inCorso, false);
  assert.equal(c.precedente.totale, 60000);
  assert.deepEqual([c.variazione.assoluta, Math.round(c.variazione.percentuale)], [66000, 110]);
  // media degli altri mesi: agosto 600, luglio 500, giugno 400, maggio 300 → 450
  assert.deepEqual([c.media.valore, c.media.periodi], [45000, 4]);
  assert.equal(Math.round(c.media.percentuale), 180);
});

test('confrontoSpese: mese in corso, si confronta con gli stessi giorni dei mesi precedenti', () => {
  const movimenti = [
    spesa(10000, '2026-09-03'), spesa(90000, '2026-09-25'), // settembre: 100 € entro il 15, 900 € dopo
    spesa(12000, '2026-10-05'), // ottobre fino a oggi: 120 €
  ];
  const c = confrontoSpese({ movimenti, periodo: periodoContenente('mese', OGGI), giornoInizio: 1, primaData: '2026-09-01', oggi: OGGI });
  assert.equal(c.inCorso, true);
  assert.equal(c.totale, 12000);
  assert.equal(c.precedente.totale, 10000); // solo i primi 15 giorni di settembre
  assert.equal(c.variazione.percentuale, 20);
  assert.equal(c.media, null); // un solo mese precedente: nessuna media
});

test('confrontoSpese: senza storia precedente nessun confronto; precedente a zero senza percentuale; "sempre" senza confronto', () => {
  const movimenti = [spesa(1000, '2026-10-02')];
  const nuovo = confrontoSpese({ movimenti, periodo: periodoContenente('mese', OGGI), giornoInizio: 1, primaData: '2026-10-02', oggi: OGGI });
  assert.deepEqual([nuovo.precedente, nuovo.variazione, nuovo.media], [null, null, null]);
  const zero = confrontoSpese({ movimenti: [spesa(1000, '2026-10-02'), entrata(5, '2026-09-02')], periodo: periodoContenente('mese', OGGI), giornoInizio: 1, primaData: '2026-09-01', oggi: OGGI });
  assert.equal(zero.precedente.totale, 0);
  assert.equal(zero.variazione.percentuale, null);
  // un periodo precedente solo in parte coperto dai dati non si confronta
  const parziale = confrontoSpese({ movimenti, periodo: periodoContenente('mese', OGGI), giornoInizio: 1, primaData: '2026-09-02', oggi: OGGI });
  assert.equal(parziale.precedente, null);
  const sempre = confrontoSpese({ movimenti, periodo: periodoContenente('sempre', OGGI), giornoInizio: 1, primaData: '2026-01-01', oggi: OGGI });
  assert.deepEqual([sempre.totale, sempre.precedente, sempre.media], [1000, null, null]);
});

test('nomePeriodoPrecedente: le frasi per «rispetto …»', () => {
  const nome = (modo, iso, g = 1) => nomePeriodoPrecedente(periodoPrecedente(periodoContenente(modo, iso, g), g), g, OGGI);
  assert.equal(nome('mese', OGGI), 'a settembre');
  assert.equal(nome('mese', '2026-01-10'), 'a dicembre 2025');
  assert.equal(nome('mese', OGGI, 27), 'al ciclo precedente');
  assert.equal(nome('giorno', OGGI), 'a ieri');
  assert.equal(nome('giorno', '2026-03-10'), 'al 9 mar 2026');
  assert.equal(nome('settimana', OGGI), 'alla settimana precedente');
  assert.equal(nome('6mesi', OGGI), 'ai 6 mesi precedenti');
  assert.equal(nome('anno', OGGI), 'al 2025');
  assert.equal(nomePeriodoPrecedente({ modo: 'personalizzato' }, 1, OGGI), 'al periodo precedente');
});

// ---- Ciambella ----

test('fetteCiambella: le prime categorie e il resto in "Altre"', () => {
  const righe = Array.from({ length: 12 }, (_, i) => ({ categoriaId: `c${i}`, totale: 1200 - i * 100, conteggio: 1, percentuale: 100 / 12 }));
  const poche = fetteCiambella(righe.slice(0, 9), 8);
  assert.equal(poche.length, 9); // 9 = massimo + 1: non conviene riunire una sola categoria
  assert.ok(poche.every((f) => !f.altre));
  const fette = fetteCiambella(righe, 8);
  assert.equal(fette.length, 9);
  assert.deepEqual([fette[8].altre, fette[8].categoriaId, fette[8].conteggio], [true, null, 4]);
  assert.equal(fette[8].totale, righe.slice(8).reduce((s, r) => s + r.totale, 0));
  assert.ok(Math.abs(fette.reduce((s, f) => s + f.percentuale, 0) - 100) < 1e-9);
});
