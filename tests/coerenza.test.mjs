import test from 'node:test';
import assert from 'node:assert/strict';
import { creaStorie, patrimonioAl, serieAndamento, ripartizioneInvestito, movimentiEsclusi, riepilogoInvestimento } from '../js/model/patrimonio.js';
import { totaliPeriodo, indicatoreStipendio } from '../js/model/calcoli.js';
import { totaliPerCategoria } from '../js/model/categorie.js';
import { sottoperiodi, totaliPerSottoperiodo, periodoEffettivo, confrontoSpese } from '../js/model/grafici.js';
import { periodoContenente } from '../js/model/periodi.js';
import { scadenzeDovute, datiMovimento } from '../js/model/ricorrenti.js';

// Una piccola "vita" inventata che attraversa tutte le sezioni: conti, spese, entrate, trasferimenti, PAC,
// valori di un investimento, un conto nuovo e un ricorrente. Si controlla che i numeri tornino tra loro.
const OGGI = '2026-10-16';
const conti = [
  { id: 'banca', nome: 'Banca', tipo: 'conto', saldoIniziale: 300000, dataSaldoIniziale: '2026-01-01', archiviato: false },
  { id: 'cash', nome: 'Contanti', tipo: 'liquidità', saldoIniziale: 10000, dataSaldoIniziale: '2026-01-01', archiviato: false },
  { id: 'etf', nome: 'ETF', tipo: 'investimenti', saldoIniziale: 100000, dataSaldoIniziale: '2026-01-01', archiviato: false },
  { id: 'nuovo', nome: 'Nuovo', tipo: 'conto', saldoIniziale: 119, dataSaldoIniziale: '2026-10-15', archiviato: false }, // creato ieri
];
const categorie = new Map([['stip', { id: 'stip', ruolo: 'stipendio' }], ['cibo', { id: 'cibo' }], ['casa', { id: 'casa' }]]);
const mappaConti = new Map(conti.map((c) => [c.id, c]));
let n = 0;
const m = (extra) => ({ id: `m${++n}`, nota: '', categoriaId: null, contoDestinazioneId: null, ...extra });
const movimenti = [
  m({ tipo: 'entrata', importo: 200000, data: '2026-09-27', contoId: 'banca', categoriaId: 'stip' }),
  m({ tipo: 'entrata', importo: 200000, data: '2026-08-27', contoId: 'banca', categoriaId: 'stip' }),
  m({ tipo: 'spesa', importo: 4500, data: '2026-10-02', contoId: 'banca', categoriaId: 'cibo' }),
  m({ tipo: 'spesa', importo: 3000, data: '2026-10-09', contoId: 'cash', categoriaId: 'cibo' }),
  m({ tipo: 'spesa', importo: 60000, data: '2026-09-01', contoId: 'banca', categoriaId: 'casa' }),
  m({ tipo: 'trasferimento', importo: 20000, data: '2026-09-05', contoId: 'banca', contoDestinazioneId: 'etf' }), // PAC
  m({ tipo: 'trasferimento', importo: 20000, data: '2026-10-05', contoId: 'banca', contoDestinazioneId: 'etf' }), // PAC
  m({ tipo: 'trasferimento', importo: 10000, data: OGGI, contoId: 'banca', contoDestinazioneId: 'nuovo' }), // verso il conto nuovo
];
const valori = [{ id: 'v1', contoId: 'etf', data: '2026-09-20', valore: 125000 }];
const storie = creaStorie(conti, movimenti, valori);

test('il patrimonio è la somma dei saldi dei conti, e il grafico finisce sul patrimonio di oggi', () => {
  const somma = [...storie.values()].reduce((s, st) => s + st.saldoAl(OGGI), 0);
  assert.equal(patrimonioAl(storie, OGGI), somma);
  const serie = serieAndamento(storie, '2026-09-01', OGGI);
  assert.equal(serie.at(-1).valore, patrimonioAl(storie, OGGI));
});

test('un trasferimento sposta soldi tra due conti e il patrimonio non cambia (anche verso investimenti e verso un conto nuovo)', () => {
  // Senza valori inseriti a mano (che per scelta hanno la precedenza), togliere i trasferimenti non cambia il patrimonio:
  // i conti di partenza e di arrivo si compensano.
  const conTrasf = creaStorie(conti, movimenti, []);
  const senza = creaStorie(conti, movimenti.filter((x) => x.tipo !== 'trasferimento'), []);
  assert.equal(patrimonioAl(conTrasf, OGGI), patrimonioAl(senza, OGGI));
  assert.equal(conTrasf.get('nuovo').saldoAl(OGGI), 119 + 10000); // arriva anche sul conto nuovo
  assert.equal(conTrasf.get('banca').saldoAl(OGGI), senza.get('banca').saldoAl(OGGI) - 20000 - 20000 - 10000);
  assert.equal(conTrasf.get('etf').saldoAl(OGGI), 100000 + 20000 + 20000);
});

test('investito + liquidità = patrimonio; l\'investimento è l\'ultimo valore più i versamenti successivi', () => {
  const r = ripartizioneInvestito(storie, OGGI);
  assert.equal(r.investito + r.nonInvestito, patrimonioAl(storie, OGGI));
  const inv = riepilogoInvestimento(storie.get('etf'), OGGI);
  assert.equal(inv.valore, 125000 + 20000); // il PAC di ottobre è dopo il valore del 20 settembre
  assert.equal(inv.versato, 100000 + 20000 + 20000);
  assert.equal(r.investito, inv.valore);
});

test('Categorie, Mese e Grafici danno gli stessi totali di spesa per lo stesso periodo', () => {
  const ottobre = periodoContenente('mese', OGGI, 1);
  const dentro = movimenti.filter((x) => x.data >= ottobre.da && x.data <= ottobre.a);
  const categorieTot = totaliPerCategoria(dentro, 'spesa').totale; // area Categorie
  const meseTot = totaliPeriodo(dentro).spese; // area Mese
  const parti = sottoperiodi(periodoEffettivo(ottobre, '2026-01-01', OGGI), 1, OGGI);
  const graficiTot = totaliPerSottoperiodo(movimenti, parti).reduce((s, x) => s + x.spese, 0); // barre dei Grafici
  const confronto = confrontoSpese({ movimenti, periodo: ottobre, giornoInizio: 1, primaData: '2026-01-01', oggi: OGGI }).totale; // confronto
  assert.deepEqual([categorieTot, meseTot, graficiTot, confronto], [7500, 7500, 7500, 7500]);
});

test('entrate, spese e risparmio per sotto-periodo sommano ai totali del periodo', () => {
  const anno = periodoContenente('anno', OGGI);
  const parti = sottoperiodi(periodoEffettivo(anno, '2026-01-01', OGGI), 1, OGGI);
  const t = totaliPerSottoperiodo(movimenti, parti);
  const tot = totaliPeriodo(movimenti.filter((x) => x.data >= anno.da && x.data <= anno.a));
  assert.equal(t.reduce((s, x) => s + x.entrate, 0), tot.entrate);
  assert.equal(t.reduce((s, x) => s + x.spese, 0), tot.spese);
  assert.equal(t.reduce((s, x) => s + x.risparmio, 0), tot.risparmio);
});

test('"Ti restano": il PAC verso gli investimenti conta come uscita, un trasferimento tra conti normali no', () => {
  const ottobre = movimenti.filter((x) => x.data >= '2026-10-01' && x.data <= '2026-10-31');
  const stip = [...ottobre, m({ tipo: 'entrata', importo: 200000, data: '2026-10-01', contoId: 'banca', categoriaId: 'stip' })];
  const ind = indicatoreStipendio(stip, categorie, mappaConti);
  assert.equal(ind.versoInvestimenti, 20000); // il PAC di ottobre, non il trasferimento verso il conto "Nuovo"
  assert.equal(ind.spese, 7500);
  assert.equal(ind.restano, 200000 - 7500 - 20000);
});

test('un movimento dello stesso giorno del saldo iniziale non conta, ed è segnalato (qui nessuno lo è)', () => {
  // Il conto "nuovo" parte da ieri: il trasferimento di oggi conta e non c'è nulla da segnalare.
  assert.deepEqual(movimentiEsclusi(conti[3], movimenti), []);
  // Se invece partisse da oggi, il trasferimento verrebbe lasciato fuori e l'app deve accorgersene.
  assert.equal(movimentiEsclusi({ ...conti[3], dataSaldoIniziale: OGGI }, movimenti).length, 1);
});

test('un ricorrente genera movimenti coerenti con il resto: stessa categoria, stessi conti, il PAC non cambia il patrimonio', () => {
  const pac = {
    id: 'r1', frequenza: 'mensile', giornoDelMese: 5, intervallo: 1, unita: 'mesi', dataInizio: '2026-11-05', dataFine: null,
    modalita: 'automatico', attivo: true, ultimaGenerazione: null,
    modello: { tipo: 'trasferimento', importo: 20000, categoriaId: null, contoId: 'banca', contoDestinazioneId: 'etf', nota: 'PAC' },
  };
  const dovute = scadenzeDovute(pac, '2026-12-20').date;
  assert.deepEqual(dovute, ['2026-11-05', '2026-12-05']);
  const generati = dovute.map((d, i) => ({ id: `g${i}`, ...datiMovimento(pac, d) }));
  const dopo = creaStorie(conti, [...movimenti, ...generati], valori);
  const prima = creaStorie(conti, movimenti, valori);
  assert.equal(patrimonioAl(dopo, '2026-12-20'), patrimonioAl(prima, '2026-12-20'));
  assert.ok(generati.every((g) => g.ricorrenteId === 'r1' && g.categoriaId === null));
});
