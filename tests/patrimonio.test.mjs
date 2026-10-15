import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effettoMovimento, creaStoriaConto, creaStorie, patrimonioAl, riepilogoInvestimento, variazioneRispettoAMeseFa,
  dateCampione, serieAndamento, primaDataConDati, intervalloGrafico, etichettaAggiornamento, movimentiDelConto,
} from '../js/model/patrimonio.js';
import {
  validaConto, puoArchiviareConto, coloreContoSuggerito, prossimoOrdineConto, validaValore,
} from '../js/model/conti.js';
import { leggiImporto } from '../js/util/formato.js';

// Dati inventati. Importi in centesimi.
const conto = (id, tipo = 'conto', saldoIniziale = 0, dataSaldoIniziale = '2026-01-01', extra = {}) =>
  ({ id, nome: id, tipo, saldoIniziale, dataSaldoIniziale, archiviato: false, ordine: 0, colore: 'indaco', ...extra });
const spesa = (contoId, importo, data) => ({ id: `s${data}${importo}`, tipo: 'spesa', contoId, importo, data, categoriaId: 'c' });
const entrata = (contoId, importo, data) => ({ id: `e${data}${importo}`, tipo: 'entrata', contoId, importo, data, categoriaId: 'c' });
const giro = (da, a, importo, data) => ({ id: `t${data}${importo}`, tipo: 'trasferimento', contoId: da, contoDestinazioneId: a, importo, data });
const valore = (contoId, data, cent) => ({ id: `v${data}`, contoId, data, valore: cent });

// ---- Saldi ----

test('effettoMovimento: entrate +, spese −, trasferimenti − in uscita e + in arrivo, altri conti 0', () => {
  assert.equal(effettoMovimento(entrata('a', 500, '2026-02-01'), 'a'), 500);
  assert.equal(effettoMovimento(spesa('a', 300, '2026-02-01'), 'a'), -300);
  assert.equal(effettoMovimento(giro('a', 'b', 700, '2026-02-01'), 'a'), -700);
  assert.equal(effettoMovimento(giro('a', 'b', 700, '2026-02-01'), 'b'), 700);
  assert.equal(effettoMovimento(spesa('a', 300, '2026-02-01'), 'b'), 0);
});

test('saldo di un conto: saldo iniziale + movimenti dopo la data del saldo iniziale', () => {
  const c = conto('a', 'conto', 100000, '2026-02-10');
  const movimenti = [
    spesa('a', 1000, '2026-02-05'), // prima del saldo iniziale: già incluso, non conta
    spesa('a', 2000, '2026-02-10'), // stesso giorno: il saldo iniziale vale a fine giornata, non conta
    spesa('a', 3000, '2026-02-11'),
    entrata('a', 50000, '2026-02-12'),
    entrata('b', 99999, '2026-02-12'), // altro conto
  ];
  const s = creaStoriaConto(c, movimenti);
  assert.equal(s.saldoAl('2026-02-10'), 100000);
  assert.equal(s.saldoAl('2026-02-11'), 97000);
  assert.equal(s.saldoAl('2026-03-01'), 147000);
});

test('saldo prima della data del saldo iniziale: si ricostruisce all\'indietro', () => {
  const c = conto('a', 'conto', 100000, '2026-02-10');
  const s = creaStoriaConto(c, [spesa('a', 1000, '2026-02-05'), entrata('a', 4000, '2026-02-08')]);
  assert.equal(s.saldoAl('2026-02-10'), 100000);
  assert.equal(s.saldoAl('2026-02-08'), 100000 - 0); // niente tra l'8 e il 10 oltre al saldo
  assert.equal(s.saldoAl('2026-02-07'), 100000 - 4000);
  assert.equal(s.saldoAl('2026-02-04'), 100000 - 4000 + 1000);
});

test('il saldo di un conto senza movimenti è il saldo iniziale; più movimenti nello stesso giorno si sommano', () => {
  assert.equal(creaStoriaConto(conto('a', 'conto', 5000), []).saldoAl('2030-01-01'), 5000);
  const s = creaStoriaConto(conto('a', 'conto', 0), [spesa('a', 100, '2026-03-01'), spesa('a', 250, '2026-03-01')]);
  assert.equal(s.saldoAl('2026-03-01'), -350);
});

// ---- Investimenti ----

test('investimenti senza valori inseriti: valore = versato, guadagno zero', () => {
  const inv = conto('i', 'investimenti', 0, '2026-01-01');
  const s = creaStoriaConto(inv, [giro('a', 'i', 20000, '2026-02-01'), giro('a', 'i', 20000, '2026-03-01')]);
  const r = riepilogoInvestimento(s, '2026-03-15');
  assert.deepEqual([r.versato, r.valore, r.guadagno], [40000, 40000, 0]);
  assert.equal(r.ultimoAggiornamento, null);
});

test('investimenti: valore = ultimo valore inserito + versamenti successivi; guadagno e percentuale', () => {
  const inv = conto('i', 'investimenti', 0, '2026-01-01');
  const movimenti = [giro('a', 'i', 20000, '2026-02-01'), giro('a', 'i', 20000, '2026-03-01'), giro('a', 'i', 10000, '2026-04-01')];
  const s = creaStoriaConto(inv, movimenti, [valore('i', '2026-03-10', 42000), valore('altro', '2026-03-10', 1)]);
  const r = riepilogoInvestimento(s, '2026-04-15');
  assert.equal(r.versato, 50000);
  assert.equal(r.valore, 42000 + 10000); // il versamento di aprile è dopo l'ultimo valore
  assert.equal(r.guadagno, 2000);
  assert.equal(r.guadagnoPercentuale, 4);
  assert.equal(r.ultimoAggiornamento, '2026-03-10');
  assert.equal(r.giorniDaAggiornamento, 36);
});

test('investimenti: una perdita è negativa; con versato zero la percentuale non esiste', () => {
  const inv = conto('i', 'investimenti', 100000, '2026-01-01');
  const perdita = riepilogoInvestimento(creaStoriaConto(inv, [], [valore('i', '2026-02-01', 90000)]), '2026-03-01');
  assert.deepEqual([perdita.guadagno, perdita.guadagnoPercentuale], [-10000, -10]);
  const vuoto = riepilogoInvestimento(creaStoriaConto(conto('i', 'investimenti', 0), [], []), '2026-03-01');
  assert.equal(vuoto.guadagnoPercentuale, null);
});

test('investimenti: il valore alla data usa l\'ultimo valore fino a quella data, non i successivi', () => {
  const inv = conto('i', 'investimenti', 100000, '2026-01-01');
  const s = creaStoriaConto(inv, [], [valore('i', '2026-02-01', 110000), valore('i', '2026-04-01', 130000)]);
  assert.equal(s.saldoAl('2026-01-15'), 100000); // prima del primo valore: versato
  assert.equal(s.saldoAl('2026-03-01'), 110000);
  assert.equal(s.saldoAl('2026-04-01'), 130000);
});

// ---- Patrimonio ----

test('il PAC (trasferimento da Conto a Investimenti) non cambia il patrimonio', () => {
  const conti = [conto('a', 'conto', 300000), conto('i', 'investimenti', 100000)];
  const prima = patrimonioAl(creaStorie(conti, [], [valore('i', '2026-01-02', 105000)]), '2026-03-01');
  const dopo = patrimonioAl(creaStorie(conti, [giro('a', 'i', 20000, '2026-02-01')], [valore('i', '2026-01-02', 105000)]), '2026-03-01');
  assert.equal(prima, 405000);
  assert.equal(dopo, 405000);
});

test('aggiornare il valore cambia il patrimonio della sola differenza (guadagno o perdita)', () => {
  const conti = [conto('a', 'conto', 300000), conto('i', 'investimenti', 100000)];
  const con = (v) => patrimonioAl(creaStorie(conti, [], [valore('i', '2026-02-01', v)]), '2026-03-01');
  assert.equal(con(120000) - con(100000), 20000);
});

test('i conti archiviati non contano nel patrimonio; spese ed entrate sì', () => {
  const conti = [conto('a', 'conto', 100000), conto('b', 'conto', 50000, '2026-01-01', { archiviato: true })];
  const movimenti = [spesa('a', 1000, '2026-02-01'), entrata('a', 5000, '2026-02-02')];
  assert.equal(patrimonioAl(creaStorie(conti, movimenti), '2026-03-01'), 104000);
});

test('variazione rispetto a un mese fa, in euro e in percentuale', () => {
  const conti = [conto('a', 'conto', 100000, '2026-01-01')];
  const v = variazioneRispettoAMeseFa(creaStorie(conti, [entrata('a', 10000, '2026-03-20')]), '2026-04-10');
  assert.deepEqual([v.prima, v.adesso, v.assoluta, v.percentuale], [100000, 110000, 10000, 10]);
  const daZero = variazioneRispettoAMeseFa(creaStorie([conto('a', 'conto', 0, '2026-01-01')], [entrata('a', 500, '2026-04-01')]), '2026-04-10');
  assert.equal(daZero.percentuale, null);
});

// ---- Grafico ----

test('dateCampione: tutti i giorni se sono pochi, altrimenti a passo fisso, sempre con la data finale', () => {
  assert.deepEqual(dateCampione('2026-03-01', '2026-03-04'), ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']);
  assert.deepEqual(dateCampione('2026-03-01', '2026-03-01'), ['2026-03-01']);
  assert.deepEqual(dateCampione('2026-03-05', '2026-03-01'), []);
  const lunga = dateCampione('2020-01-01', '2026-01-01', 90);
  assert.ok(lunga.length <= 91 && lunga.length > 40);
  assert.equal(lunga[0], '2020-01-01');
  assert.equal(lunga.at(-1), '2026-01-01');
  assert.deepEqual([...lunga].sort(), lunga); // in ordine, senza ripetizioni
  assert.equal(new Set(lunga).size, lunga.length);
});

test('serieAndamento: un punto per data campione con il patrimonio di quel giorno', () => {
  const conti = [conto('a', 'conto', 1000, '2026-03-01')];
  const serie = serieAndamento(creaStorie(conti, [spesa('a', 300, '2026-03-02'), entrata('a', 5000, '2026-03-04')]), '2026-03-01', '2026-03-05');
  assert.deepEqual(serie.map((p) => p.valore), [1000, 700, 700, 5700, 5700]);
  assert.deepEqual(serie.map((p) => p.data), ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
});

test('primaDataConDati e intervalloGrafico', () => {
  assert.equal(primaDataConDati([spesa('a', 1, '2025-06-10')], [valore('i', '2025-05-01', 1)], '2026-03-01'), '2025-05-01');
  assert.equal(primaDataConDati([], [], '2026-03-01'), '2026-03-01');
  // un saldo iniziale diverso da zero conta, uno a zero o di un conto archiviato no
  const conti = [conto('a', 'conto', 5000, '2025-01-01'), conto('b', 'conto', 0, '2024-01-01'), conto('c', 'conto', 9, '2023-01-01', { archiviato: true })];
  assert.equal(primaDataConDati([spesa('a', 1, '2025-06-10')], [], '2026-03-01', conti), '2025-01-01');
  const mese = { modo: 'mese', da: '2026-03-01', a: '2026-03-31' };
  assert.deepEqual(intervalloGrafico(mese, '2025-06-10', '2026-03-15'), { da: '2026-03-01', a: '2026-03-15' }); // fino a oggi
  assert.deepEqual(intervalloGrafico(mese, '2026-03-10', '2026-03-15'), { da: '2026-03-10', a: '2026-03-15' }); // dalla prima data
  assert.equal(intervalloGrafico({ modo: 'mese', da: '2026-04-01', a: '2026-04-30' }, '2025-06-10', '2026-03-15'), null); // futuro
});

test('etichettaAggiornamento: oggi, ieri, giorni, settimane, mesi e anni; vecchio dopo 30 giorni', () => {
  const e = (data) => etichettaAggiornamento(data, '2026-10-15');
  assert.deepEqual(e('2026-10-15'), { testo: 'Valore aggiornato oggi', vecchio: false });
  assert.equal(e('2026-10-14').testo, 'Valore aggiornato ieri');
  assert.equal(e('2026-10-10').testo, 'Valore aggiornato 5 giorni fa');
  assert.equal(e('2026-10-01').testo, 'Valore aggiornato 2 settimane fa');
  assert.equal(e('2026-06-15').testo, 'Valore aggiornato 4 mesi fa');
  assert.equal(e('2024-01-01').testo, 'Valore aggiornato 2 anni fa');
  assert.equal(e('2026-09-01').vecchio, true);
  assert.equal(e('2026-10-01').vecchio, false);
  assert.deepEqual(etichettaAggiornamento(null, '2026-10-15'), { testo: 'Valore non ancora inserito', vecchio: true });
});

test('movimentiDelConto: quelli in uscita, in entrata e di destinazione, dal più recente', () => {
  const movimenti = [
    spesa('a', 1, '2026-03-01'), spesa('b', 2, '2026-03-02'), giro('b', 'a', 3, '2026-03-03'), entrata('a', 4, '2026-03-05'),
  ];
  assert.deepEqual(movimentiDelConto(movimenti, 'a').map((m) => m.importo), [4, 3, 1]);
});

// ---- Regole dei conti ----

test('validaConto: nome, tipo, saldo e data; nomi doppi (anche archiviati) rifiutati', () => {
  const base = { nome: 'Risparmi', tipo: 'conto', saldoIniziale: 0, dataSaldoIniziale: '2026-03-01' };
  const esistenti = [conto('a'), conto('x', 'conto', 0, '2026-01-01', { nome: 'Vecchio', archiviato: true })];
  assert.equal(validaConto(base, esistenti), null);
  assert.match(validaConto({ ...base, nome: '  ' }, esistenti), /nome/);
  assert.match(validaConto({ ...base, nome: 'x'.repeat(31) }, esistenti), /al massimo/);
  assert.match(validaConto({ ...base, tipo: 'boh' }, esistenti), /Tipo/);
  assert.match(validaConto({ ...base, saldoIniziale: 1.5 }, esistenti), /saldo/);
  assert.match(validaConto({ ...base, dataSaldoIniziale: '2026-13-01' }, esistenti), /data/);
  assert.match(validaConto({ ...base, nome: ' a ' }, esistenti), /Esiste già un conto/);
  assert.match(validaConto({ ...base, nome: 'vecchio' }, esistenti), /archiviato/);
  assert.equal(validaConto({ ...base, saldoIniziale: -2500 }, esistenti), null); // scoperto o carta di credito
  assert.equal(validaConto({ ...base, nome: 'A' }, esistenti, { escludiId: 'a' }), null); // il conto stesso non è un doppione
});

test('puoArchiviareConto: non il predefinito, non l\'ultimo attivo', () => {
  const conti = [conto('a'), conto('b'), conto('c', 'conto', 0, '2026-01-01', { archiviato: true })];
  assert.equal(puoArchiviareConto(conti[1], conti, 'a').ok, true);
  assert.equal(puoArchiviareConto(conti[0], conti, 'a').ok, false);
  const soloUno = [conto('a'), conto('c', 'conto', 0, '2026-01-01', { archiviato: true })];
  assert.equal(puoArchiviareConto(soloUno[0], soloUno, 'zzz').ok, false);
});

test('validaValore: zero o più, data valida e non futura', () => {
  assert.equal(validaValore({ valore: 0, data: '2026-03-01' }, '2026-03-01'), null);
  assert.match(validaValore({ valore: -1, data: '2026-03-01' }, '2026-03-01'), /valore/);
  assert.match(validaValore({ valore: 1.5, data: '2026-03-01' }, '2026-03-01'), /valore/);
  assert.match(validaValore({ valore: 100, data: '2026-03-02' }, '2026-03-01'), /futuro/);
  assert.match(validaValore({ valore: 100, data: 'ieri' }, '2026-03-01'), /Data/);
});

test('coloreContoSuggerito e prossimoOrdineConto', () => {
  assert.equal(coloreContoSuggerito([]), 'corallo');
  assert.notEqual(coloreContoSuggerito([conto('a', 'conto', 0, '2026-01-01', { colore: 'corallo' })]), 'corallo');
  assert.equal(prossimoOrdineConto([conto('a', 'conto', 0, '2026-01-01', { ordine: 3 })]), 4);
  assert.equal(prossimoOrdineConto([]), 0);
});

// ---- Importi scritti a mano ----

test('leggiImporto: formati italiani e piccoli errori', () => {
  const casi = [
    ['1.234,56', 123456], ['1234,5', 123450], ['12,05', 1205], ['12', 1200], ['0,5', 50], [',5', 50],
    ['1.234', 123400], ['1.234.567', 123456700], ['12.5', 1250], ['12.50', 1250], ['€ 99', 9900], ['99 €', 9900],
    ['-30', -3000], ['−30,5', -3050], ['+7', 700], ['  1 000  ', 100000],
  ];
  for (const [testo, atteso] of casi) assert.equal(leggiImporto(testo), atteso, testo);
  for (const testo of ['', '   ', 'abc', '12,345', '1,2,3x', '--5', ',', '12,3.4,5', '€']) assert.equal(leggiImporto(testo), null, testo);
});
