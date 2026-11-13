// Rischio ed etichette dei conti investimenti, e la divisione del patrimonio per gruppi. Dati inventati, importi in centesimi.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creaStorie, gruppoDelConto, ripartizionePatrimonio, dettaglioGruppo, patrimonioAl, GRUPPI_PATRIMONIO, NOME_GRUPPO,
} from '../js/model/patrimonio.js';
import {
  normalizzaClasse, etichetteUsate, etichettaCoerente, pulisciEtichetta, LUNGHEZZA_MAX_ETICHETTA, RISCHI, ETICHETTE_PROPOSTE,
} from '../js/model/conti.js';

const OGGI = '2026-03-01';
const conto = (id, tipo, saldoIniziale, extra = {}) =>
  ({ id, nome: id, tipo, saldoIniziale, dataSaldoIniziale: '2026-01-01', archiviato: false, ordine: 0, colore: 'indaco', ...extra });
const inv = (id, saldo, rischio, etichetta = '', extra = {}) => conto(id, 'investimenti', saldo, { rischio, etichetta, ...extra });

// ---- Rischio ed etichetta sul conto ----

test('normalizzaClasse: solo gli investimenti hanno rischio ed etichetta, e solo con valori validi', () => {
  assert.deepEqual(normalizzaClasse({ tipo: 'investimenti', rischio: 'alto', etichetta: '  ETF   azionari ' }), { rischio: 'alto', etichetta: 'ETF azionari' });
  assert.deepEqual(normalizzaClasse({ tipo: 'investimenti', rischio: 'medio', etichetta: null }), { rischio: null, etichetta: '' });
  assert.deepEqual(normalizzaClasse({ tipo: 'investimenti' }), { rischio: null, etichetta: '' });
  assert.deepEqual(normalizzaClasse({ tipo: 'conto', rischio: 'alto', etichetta: 'ETF' }), { rischio: null, etichetta: '' });
});

test('pulisciEtichetta: spazi ripuliti e lunghezza massima', () => {
  assert.equal(pulisciEtichetta('  BTP  '), 'BTP');
  assert.equal(pulisciEtichetta('x'.repeat(50)).length, LUNGHEZZA_MAX_ETICHETTA);
  assert.equal(pulisciEtichetta(undefined), '');
});

test('etichetteUsate: dalla più usata, senza doppioni per una maiuscola, solo dai conti investimenti', () => {
  const conti = [
    inv('a', 100, 'alto', 'ETF'), inv('b', 100, 'alto', 'etf'), inv('c', 100, 'alto', 'ETF'),
    inv('d', 100, 'basso', 'BTP'), inv('e', 100, 'basso', ''), conto('f', 'conto', 100, { etichetta: 'Finta' }),
  ];
  assert.deepEqual(etichetteUsate(conti), ['ETF', 'BTP']);
  assert.deepEqual(etichetteUsate([]), []);
});

test('etichettaCoerente: scrivendo «etf» si ottiene la grafia già usata; una nuova resta com\'è', () => {
  const conti = [inv('a', 100, 'alto', 'ETF')];
  assert.equal(etichettaCoerente('etf', conti), 'ETF');
  assert.equal(etichettaCoerente(' Azioni ', conti), 'Azioni');
  assert.equal(etichettaCoerente('', conti), '');
  // Senza conti già etichettati vale la grafia delle proposte; quella già usata ha la precedenza.
  assert.equal(etichettaCoerente('etf', []), 'ETF');
  assert.equal(etichettaCoerente('btp', []), 'BTP');
  assert.equal(etichettaCoerente('btp', [inv('b', 100, 'basso', 'Btp')]), 'Btp');
  assert.equal(etichettaCoerente('Oro fisico', []), 'Oro fisico');
});

test('le etichette proposte esistono per ogni rischio e rispettano la lunghezza massima', () => {
  for (const r of RISCHI) {
    assert.ok(ETICHETTE_PROPOSTE[r].length > 0);
    for (const e of ETICHETTE_PROPOSTE[r]) assert.equal(pulisciEtichetta(e), e);
  }
});

// ---- Gruppi ----

test('gruppoDelConto: investimenti secondo il rischio, il resto è liquidità', () => {
  assert.equal(gruppoDelConto(inv('a', 0, 'alto')), 'alto');
  assert.equal(gruppoDelConto(inv('a', 0, 'basso')), 'basso');
  assert.equal(gruppoDelConto(inv('a', 0, null)), 'da-classificare');
  assert.equal(gruppoDelConto(inv('a', 0, 'boh')), 'da-classificare');
  assert.equal(gruppoDelConto(conto('a', 'conto', 0)), 'liquidita');
  assert.equal(gruppoDelConto(conto('a', 'liquidità', 0, { rischio: 'alto' })), 'liquidita');
  for (const g of GRUPPI_PATRIMONIO) assert.ok(NOME_GRUPPO[g]);
});

test('ripartizionePatrimonio: i gruppi con qualcosa, nell\'ordine della barra, con percentuali intere che sommano 100', () => {
  const conti = [conto('c', 'conto', 300000), inv('e', 500000, 'alto', 'ETF'), inv('b', 150000, 'basso', 'BTP'), inv('x', 50000, null)];
  const r = ripartizionePatrimonio(creaStorie(conti, []), OGGI);
  assert.equal(r.totale, 1000000);
  assert.deepEqual(r.voci, [
    { gruppo: 'alto', importo: 500000, percentuale: 50 },
    { gruppo: 'basso', importo: 150000, percentuale: 15 },
    { gruppo: 'da-classificare', importo: 50000, percentuale: 5 },
    { gruppo: 'liquidita', importo: 300000, percentuale: 30 },
  ]);
});

test('ripartizionePatrimonio: tre terzi fanno comunque 100; i gruppi vuoti non compaiono', () => {
  const r = ripartizionePatrimonio(creaStorie([conto('c', 'conto', 1000), inv('a', 1000, 'alto'), inv('b', 1000, 'basso')], []), OGGI);
  assert.equal(r.voci.reduce((s, v) => s + v.percentuale, 0), 100);
  assert.deepEqual(r.voci.map((v) => v.gruppo), ['alto', 'basso', 'liquidita']);
  const solo = ripartizionePatrimonio(creaStorie([conto('c', 'conto', 1000)], []), OGGI);
  assert.deepEqual(solo.voci, [{ gruppo: 'liquidita', importo: 1000, percentuale: 100 }]);
});

test('ripartizionePatrimonio: la somma dei gruppi è il patrimonio; investimenti al valore inserito; archiviati esclusi', () => {
  const conti = [conto('c', 'conto', 200000), inv('a', 100000, 'alto'), inv('z', 999999, 'basso', '', { archiviato: true })];
  const valori = [{ id: 'v1', contoId: 'a', data: '2026-02-01', valore: 130000 }];
  const storie = creaStorie(conti, [], valori);
  const r = ripartizionePatrimonio(storie, OGGI);
  assert.equal(r.totale, patrimonioAl(storie, OGGI));
  assert.equal(r.voci.find((v) => v.gruppo === 'alto').importo, 130000);
  assert.equal(r.voci.some((v) => v.gruppo === 'basso'), false);
});

test('ripartizionePatrimonio: un trasferimento verso un investimento sposta tra i gruppi senza cambiare il totale', () => {
  const conti = [conto('c', 'conto', 300000), inv('a', 100000, 'alto')];
  const giro = { id: 't1', tipo: 'trasferimento', contoId: 'c', contoDestinazioneId: 'a', importo: 50000, data: '2026-02-01' };
  const prima = ripartizionePatrimonio(creaStorie(conti, []), OGGI);
  const dopo = ripartizionePatrimonio(creaStorie(conti, [giro]), OGGI);
  assert.equal(prima.totale, dopo.totale);
  assert.deepEqual(dopo.voci.map((v) => v.importo), [150000, 250000]);
});

test('ripartizionePatrimonio: senza senso (zero, un gruppo in negativo) non si mostra', () => {
  assert.equal(ripartizionePatrimonio(creaStorie([conto('c', 'conto', 0)], []), OGGI), null);
  assert.equal(ripartizionePatrimonio(creaStorie([conto('c', 'conto', -5000), inv('a', 100000, 'alto')], []), OGGI), null);
});

test('dettaglioGruppo: conti raccolti per etichetta, dalla più grossa; senza etichetta in fondo', () => {
  const conti = [
    inv('etf1', 300000, 'alto', 'ETF'), inv('etf2', 100000, 'alto', 'ETF'), inv('az', 250000, 'alto', 'Azioni'),
    inv('nudo', 900000, 'alto', ''), inv('btp', 100000, 'basso', 'BTP'), conto('c', 'conto', 50000),
  ];
  const voci = dettaglioGruppo(creaStorie(conti, []), OGGI, 'alto');
  assert.deepEqual(voci.map((v) => [v.etichetta, v.importo]), [['ETF', 400000], ['Azioni', 250000], ['', 900000]]);
  assert.deepEqual(voci[0].conti.map((x) => x.conto.id), ['etf1', 'etf2']);
  assert.deepEqual(dettaglioGruppo(creaStorie(conti, []), OGGI, 'da-classificare'), []);
});

test('dettaglioGruppo: la liquidità è un elenco solo, anche se un conto avesse per errore un\'etichetta', () => {
  const conti = [conto('c1', 'conto', 50000, { etichetta: 'Finta' }), conto('c2', 'liquidità', 80000)];
  const voci = dettaglioGruppo(creaStorie(conti, []), OGGI, 'liquidita');
  assert.equal(voci.length, 1);
  assert.equal(voci[0].etichetta, '');
  assert.deepEqual(voci[0].conti.map((x) => x.conto.id), ['c2', 'c1']);
});
