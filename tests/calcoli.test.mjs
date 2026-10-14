import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contaNote, eTrasferimentoVersoInvestimenti, indicatoreStipendio, raggruppaPerGiorno,
  suggerisciNote, totaliPeriodo,
} from '../js/model/calcoli.js';

// Dati inventati.
const conti = new Map([
  ['principale', { id: 'principale', tipo: 'conto' }],
  ['secondario', { id: 'secondario', tipo: 'conto' }],
  ['broker', { id: 'broker', tipo: 'investimenti' }],
  ['fondo', { id: 'fondo', tipo: 'investimenti' }],
]);
const categorie = new Map([
  ['stip', { id: 'stip', tipo: 'entrata', ruolo: 'stipendio' }],
  ['tredicesima', { id: 'tredicesima', tipo: 'entrata' }],
  ['spesa', { id: 'spesa', tipo: 'spesa' }],
]);

const spesa = (importo, extra = {}) => ({ tipo: 'spesa', importo, categoriaId: 'spesa', contoId: 'principale', data: '2026-10-05', ...extra });
const entrata = (importo, categoriaId = 'stip') => ({ tipo: 'entrata', importo, categoriaId, contoId: 'principale', data: '2026-10-01' });
const trasf = (importo, da, a) => ({ tipo: 'trasferimento', importo, categoriaId: null, contoId: da, contoDestinazioneId: a, data: '2026-10-03' });

test('totaliPeriodo ignora i trasferimenti', () => {
  const t = totaliPeriodo([entrata(145000), spesa(30000), spesa(5000), trasf(20000, 'principale', 'broker')]);
  assert.deepEqual(t, { entrate: 145000, spese: 35000, risparmio: 110000 });
});

test('trasferimento verso investimenti: solo da conto normale a conto investimenti', () => {
  assert.ok(eTrasferimentoVersoInvestimenti(trasf(1, 'principale', 'broker'), conti));
  assert.ok(!eTrasferimentoVersoInvestimenti(trasf(1, 'broker', 'fondo'), conti));
  assert.ok(!eTrasferimentoVersoInvestimenti(trasf(1, 'principale', 'secondario'), conti));
  assert.ok(!eTrasferimentoVersoInvestimenti(trasf(1, 'broker', 'principale'), conti));
});

test('indicatore: esempio dello spec (1.450 € di stipendio, 830 € di uscite)', () => {
  const r = indicatoreStipendio([entrata(145000), spesa(83000)], categorie, conti);
  assert.equal(r.stato, 'ok');
  assert.equal(r.restano, 62000);
  assert.equal(r.uscite, 83000);
  assert.equal(Math.round(r.percentuale), 57);
});

test('indicatore: il PAC conta tra le uscite, la tredicesima non è stipendio', () => {
  const r = indicatoreStipendio(
    [entrata(100000), entrata(100000, 'tredicesima'), spesa(30000), trasf(20000, 'principale', 'broker'), trasf(5000, 'principale', 'secondario')],
    categorie, conti,
  );
  assert.equal(r.stipendio, 100000);
  assert.equal(r.uscite, 50000);
  assert.equal(r.restano, 50000);
});

test('indicatore: soglie esatte 80% e 100%', () => {
  const con = (uscite) => indicatoreStipendio([entrata(100000), spesa(uscite)], categorie, conti).stato;
  assert.equal(con(79999), 'ok');
  assert.equal(con(80000), 'attenzione');
  assert.equal(con(100000), 'attenzione');
  assert.equal(con(100001), 'superato');
});

test('indicatore: superamento', () => {
  const r = indicatoreStipendio([entrata(145000), spesa(149500)], categorie, conti);
  assert.equal(r.stato, 'superato');
  assert.equal(r.superamento, 4500);
  assert.equal(r.restano, -4500);
});

test('indicatore: stipendio non registrato', () => {
  const r = indicatoreStipendio([spesa(12000), entrata(5000, 'tredicesima')], categorie, conti);
  assert.equal(r.stato, 'assente');
  assert.equal(r.restano, null);
  assert.equal(r.uscite, 12000);
});

test('indicatore: più stipendi nel ciclo si sommano', () => {
  const r = indicatoreStipendio([entrata(100000), entrata(20000), spesa(60000)], categorie, conti);
  assert.equal(r.stipendio, 120000);
  assert.equal(r.restano, 60000);
});

test('raggruppaPerGiorno: giorni dal più recente, totale = entrate − spese', () => {
  const lista = [
    { ...spesa(1000), id: 'a', data: '2026-10-05', creatoIl: '2026-10-05T08:00:00Z' },
    { ...spesa(2500), id: 'b', data: '2026-10-05', creatoIl: '2026-10-05T12:00:00Z' },
    { ...entrata(5000), id: 'c', data: '2026-10-07', creatoIl: '2026-10-07T09:00:00Z' },
    { ...trasf(9000, 'principale', 'broker'), id: 'd', data: '2026-10-06', creatoIl: '2026-10-06T09:00:00Z' },
  ];
  const gruppi = raggruppaPerGiorno(lista);
  assert.deepEqual(gruppi.map((g) => g.data), ['2026-10-07', '2026-10-06', '2026-10-05']);
  assert.equal(gruppi[0].totale, 5000);
  assert.equal(gruppi[1].haTotale, false);
  assert.equal(gruppi[2].totale, -3500);
  assert.deepEqual(gruppi[2].movimenti.map((m) => m.id), ['b', 'a']); // l'ultimo inserito per primo
});

test('contaNote: frequenza, maiuscole e spazi ignorati, note vuote escluse', () => {
  const movs = [
    { nota: 'Supermercato', creatoIl: '2026-10-01' },
    { nota: ' supermercato ', creatoIl: '2026-10-02' },
    { nota: 'Panificio', creatoIl: '2026-10-03' },
    { nota: 'Supermercato', creatoIl: '2026-10-04' },
    { nota: '', creatoIl: '2026-10-05' },
    { nota: undefined, creatoIl: '2026-10-06' },
  ];
  const note = contaNote(movs);
  assert.deepEqual(note.map((n) => [n.nota, n.conteggio]), [['Supermercato', 3], ['Panificio', 1]]);
});

test('contaNote: a pari frequenza prima la più recente', () => {
  const note = contaNote([
    { nota: 'Macelleria', creatoIl: '2026-09-01' },
    { nota: 'Panificio', creatoIl: '2026-10-01' },
  ]);
  assert.deepEqual(note.map((n) => n.nota), ['Panificio', 'Macelleria']);
});

test('suggerisciNote: senza testo le più usate, con testo prima chi inizia poi chi contiene', () => {
  const note = contaNote([
    { nota: 'Supermercato', creatoIl: '1' }, { nota: 'Supermercato', creatoIl: '2' },
    { nota: 'Panificio', creatoIl: '3' }, { nota: 'Mercato rionale', creatoIl: '4' },
  ]);
  assert.deepEqual(suggerisciNote(note, '').map((n) => n.nota), ['Supermercato', 'Mercato rionale', 'Panificio']);
  assert.deepEqual(suggerisciNote(note, 'mer').map((n) => n.nota), ['Mercato rionale', 'Supermercato']);
  assert.deepEqual(suggerisciNote(note, 'Panificio'), []); // già scritta per intero
  assert.equal(suggerisciNote(note, '', 2).length, 2);
});
