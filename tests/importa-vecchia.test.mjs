import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leggiEsportazione, analizza, proponiAbbinamenti, converti, saldoCalcolato,
  pulisciNome, chiaveNome, iconaSuggerita, ErroreImportazione,
} from '../js/model/importa-vecchia.js';
import { CATEGORIE_INIZIALI, CONTI_INIZIALI } from '../js/model/seed.js';
import { ICONE } from '../vendor/lucide/icone.js';
import { COLORI_CATEGORIA, ESADECIMALI_CHIARI, coloreVicino } from '../js/model/palette.js';

// Tutti i dati sono INVENTATI. Le emoji sono scritte come sequenze di escape, mai come caratteri.
const RADIOATTIVO = '☢️';

const esportazione = () => ({
  app: 'le-mie-spese',
  versione: 2,
  mesi: {
    '2026-03': [
      { id: 'a1', data: '2026-03-02', cent: 1250, cat: 'Spesa alimentare', nota: '  pane  e latte ', ts: 1772000000000, conto: 'Conto principale' },
      { id: 'a2', data: '2026-03-03', cent: 300, cat: `Macchinette - ${RADIOATTIVO}`, nota: '', ts: 1772100000000, conto: 'Contanti' },
      { id: 'a3', data: '2026-03-05', cent: 150000, cat: 'Stipendio', tipo: 'entrata', nota: '', ts: 1772200000000, conto: 'Conto principale' },
      { id: 'a4', data: '2026-03-06', cent: 20, cat: 'Interessi extra', tipo: 'entrata', nota: '', ts: 1772300000000, conto: 'Conto principale' },
      { id: 'a5', data: '2026-03-07', cent: 40000, cat: 'Fondo Alfa', tipo: 'investimento', nota: '', ts: 1772400000000, conto: 'Conto principale' },
      { id: 'a6', data: '2026-03-08', cent: 800, cat: 'Spesa alimentare', nota: '', ts: 1772500000000 }, // senza conto
    ],
  },
  config: {
    categorie: [
      { nome: 'Spesa alimentare', colore: '#1baf7a' },
      { nome: `Macchinette - ${RADIOATTIVO}`, colore: '#e34948' },
      { nome: 'Hobby strani', colore: '#c2410c' },
    ],
    entrate: [{ nome: 'Stipendio', colore: '#1baf7a' }, { nome: 'Interessi extra', colore: '#0f8b8d' }],
    budget: 0,
  },
  patrimonio: {
    conti: [
      { nome: 'Conto principale', tipo: 'liquidita', colore: '#2a78d6', storico: [{ data: '2026-03-04', cent: 100000, ts: 1 }] },
      { nome: 'Contanti', tipo: 'liquidita', colore: '#0f8b8d', storico: [] },
      { nome: 'Banca Beta', tipo: 'liquidita', colore: '#64748b', storico: [{ data: '2026-03-01', cent: 5000 }] },
      { nome: 'Fondo Alfa', tipo: 'investimento', colore: '#4a3aa7', storico: [], versatoIniziale: 200000 },
    ],
  },
});

const contiEsistenti = () => CONTI_INIZIALI.map((c, i) => ({ ...c, saldoIniziale: 0, dataSaldoIniziale: '2026-03-10', ordine: i, archiviato: false }));
const categorieEsistenti = () => CATEGORIE_INIZIALI.map((c, i) => ({ ...c, ordine: i, archiviata: false }));

let contatore = 0;
const generaId = () => `id-${++contatore}`;
const contesto = (extra = {}) => ({ categorieEsistenti: categorieEsistenti(), contiEsistenti: contiEsistenti(), generaId, adesso: '2026-03-10T10:00:00.000Z', ...extra });

function preparaTutto(modifica) {
  const analisi = analizza(leggiEsportazione(JSON.stringify(esportazione())));
  const scelte = proponiAbbinamenti(analisi, categorieEsistenti(), contiEsistenti(), 'conto-principale');
  modifica?.(scelte);
  return { analisi, scelte };
}

test('pulisciNome toglie emoji e trattini avanzati, chiaveNome ignora maiuscole e accenti', () => {
  assert.equal(pulisciNome(`Macchinette - ${RADIOATTIVO}`), 'Macchinette');
  assert.equal(pulisciNome('  Ristoranti   e bar '), 'Ristoranti e bar');
  assert.equal(chiaveNome('Caffè  DEL bar'), 'caffe del bar');
  assert.equal(pulisciNome(`${RADIOATTIVO}`), '');
});

test('leggiEsportazione rifiuta file non validi con messaggi in italiano', () => {
  assert.throws(() => leggiEsportazione('non è json'), ErroreImportazione);
  assert.throws(() => leggiEsportazione('{"app":"altra-app","mesi":{}}'), /vecchia app Spese/);
  assert.throws(() => leggiEsportazione('{"app":"le-mie-spese"}'), /movimenti/);
});

test('analizza: conteggi, periodo, categorie e conti trovati', () => {
  const a = analizza(esportazione());
  assert.equal(a.movimenti.length, 6);
  assert.deepEqual(a.conteggi, { spese: 3, entrate: 2, versamenti: 1 });
  assert.deepEqual(a.periodo, { da: '2026-03-02', a: '2026-03-08' });
  assert.equal(a.senzaConto, 1);
  assert.deepEqual(a.categorie.map((c) => c.nome).sort(), ['Hobby strani', 'Interessi extra', 'Macchinette', 'Spesa alimentare', 'Stipendio']);
  assert.equal(a.conti.length, 4);
  assert.equal(a.movimenti[0].nota, 'pane e latte');
});

test('analizza scarta i movimenti non validi con il motivo', () => {
  const dati = {
    app: 'le-mie-spese',
    mesi: {
      m: [
        { id: 'x1', data: '2026-03-02', cent: 0, cat: 'A' },
        { id: 'x2', data: '2026-13-40', cent: 100, cat: 'A' },
        { id: 'x3', data: '2026-03-02', cent: 100, cat: '' },
        { id: 'x4', data: '2026-03-02', cent: 100, cat: 'A', tipo: 'boh' },
        { id: 'x5', data: '2026-03-02', cent: 100, cat: 'A' },
      ],
    },
  };
  const a = analizza(dati);
  assert.equal(a.movimenti.length, 1);
  assert.equal(a.scartati.length, 4);
});

test('i movimenti senza id ricevono un id stabile e distinto anche se identici', () => {
  const dati = { app: 'le-mie-spese', mesi: { m: [{ data: '2026-03-02', cent: 100, cat: 'A' }, { data: '2026-03-02', cent: 100, cat: 'A' }] } };
  const uno = analizza(dati).movimenti.map((m) => m.idOrigine);
  const due = analizza(dati).movimenti.map((m) => m.idOrigine);
  assert.deepEqual(uno, due);
  assert.notEqual(uno[0], uno[1]);
});

test('proponiAbbinamenti: per nome quando coincide, nuova altrimenti', () => {
  const { scelte } = preparaTutto();
  const per = (nome) => scelte.categorie.find((c) => c.nome === nome);
  assert.equal(per('Spesa alimentare').azione, 'esistente');
  assert.equal(per('Spesa alimentare').id, 'cat-spesa-alimentare');
  assert.equal(per('Macchinette').id, 'cat-macchinette');
  assert.equal(per('Stipendio').id, 'cat-stipendio');
  assert.equal(per('Hobby strani').azione, 'nuova');
  assert.ok(per('Hobby strani').nuova.icona in ICONE);
  assert.ok(COLORI_CATEGORIA.includes(per('Hobby strani').nuova.colore));
});

test('proponiAbbinamenti: i conti senza corrispondenza usano un conto vuoto dello stesso tipo, da rinominare', () => {
  const { scelte } = preparaTutto();
  const conto = (nome) => scelte.conti.find((c) => c.nome === nome);
  assert.equal(conto('Conto principale').id, 'conto-principale');
  assert.equal(conto('Contanti').id, 'conto-contanti');
  assert.equal(conto('Banca Beta').id, 'conto-secondario');
  assert.equal(conto('Banca Beta').rinomina, true);
  assert.equal(conto('Fondo Alfa').id, 'conto-investimenti');
  assert.equal(scelte.contoSenzaConto, 'conto-principale');
});

test('converti: spese, entrate e versamento (trasferimento verso il conto investimenti)', () => {
  const { analisi, scelte } = preparaTutto();
  const r = converti(analisi, scelte, contesto());
  assert.equal(r.movimenti.length, 6);
  assert.equal(r.scartati.length, 0);
  const per = (origine) => r.movimenti.find((m) => m.origineId === `le-mie-spese:${origine}`);

  assert.deepEqual(
    { tipo: per('a1').tipo, importo: per('a1').importo, categoriaId: per('a1').categoriaId, contoId: per('a1').contoId },
    { tipo: 'spesa', importo: 1250, categoriaId: 'cat-spesa-alimentare', contoId: 'conto-principale' },
  );
  assert.equal(per('a2').categoriaId, 'cat-macchinette');
  assert.equal(per('a3').tipo, 'entrata');
  assert.equal(per('a3').categoriaId, 'cat-stipendio');
  assert.equal(per('a6').contoId, 'conto-principale', 'senza conto: quello scelto');

  const versamento = per('a5');
  assert.equal(versamento.tipo, 'trasferimento');
  assert.equal(versamento.categoriaId, null);
  assert.equal(versamento.contoId, 'conto-principale');
  assert.equal(versamento.contoDestinazioneId, 'conto-investimenti');
  assert.equal(per('a1').creatoIl, new Date(1772000000000).toISOString());
});

test('converti: categorie nuove con id, ordine in coda e senza duplicati', () => {
  const { analisi, scelte } = preparaTutto();
  const r = converti(analisi, scelte, contesto());
  assert.deepEqual(r.categorie.map((c) => c.nome).sort(), ['Hobby strani', 'Interessi extra']);
  const massimo = Math.max(...categorieEsistenti().map((c) => c.ordine));
  for (const c of r.categorie) assert.ok(c.ordine > massimo);
  const ids = r.categorie.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const interessi = r.categorie.find((c) => c.nome === 'Interessi extra');
  assert.equal(r.movimenti.find((m) => m.origineId === 'le-mie-spese:a4').categoriaId, interessi.id);
});

test('converti: i conti ricevono saldo iniziale e data; rinomina solo se richiesto', () => {
  const { analisi, scelte } = preparaTutto();
  const r = converti(analisi, scelte, contesto());
  const conto = (id) => r.conti.find((c) => c.id === id);
  assert.equal(conto('conto-principale').saldoIniziale, 100000);
  assert.equal(conto('conto-principale').dataSaldoIniziale, '2026-03-04');
  assert.equal(conto('conto-principale').nome, 'Conto principale');
  assert.equal(conto('conto-secondario').nome, 'Banca Beta');
  assert.equal(conto('conto-secondario').saldoIniziale, 5000);
  assert.equal(conto('conto-investimenti').saldoIniziale, 200000, 'versato iniziale');
  assert.equal(conto('conto-investimenti').dataSaldoIniziale, '2026-03-01', 'il giorno prima del primo movimento');
  assert.equal(conto('conto-contanti').saldoIniziale, 0);
});

test('converti: un saldo già inserito dall\'utente non viene mai sovrascritto', () => {
  const { analisi, scelte } = preparaTutto();
  const conti = contiEsistenti();
  conti.find((c) => c.id === 'conto-principale').saldoIniziale = 777;
  const r = converti(analisi, scelte, contesto({ contiEsistenti: conti }));
  assert.equal(r.conti.find((c) => c.id === 'conto-principale').saldoIniziale, 777);
});

test('converti: non crea doppioni se il file viene importato di nuovo', () => {
  const { analisi, scelte } = preparaTutto();
  const primo = converti(analisi, scelte, contesto());
  const giaImportati = new Set(primo.movimenti.map((m) => m.origineId));
  const secondo = converti(analisi, scelte, contesto({ giaImportati }));
  assert.equal(secondo.movimenti.length, 0);
  assert.equal(secondo.duplicati, 6);
});

test('converti: abbinando a un conto nuovo, lo crea con i suoi dati', () => {
  const { analisi, scelte } = preparaTutto((s) => {
    const beta = s.conti.find((c) => c.nome === 'Banca Beta');
    Object.assign(beta, { azione: 'nuovo', id: null, rinomina: false });
  });
  const r = converti(analisi, scelte, contesto());
  const nuovo = r.conti.find((c) => c.nome === 'Banca Beta');
  assert.ok(nuovo.id.startsWith('id-'));
  assert.equal(nuovo.tipo, 'conto');
  assert.equal(nuovo.saldoIniziale, 5000);
  assert.ok(nuovo.icona in ICONE);
});

test('saldoCalcolato: saldo iniziale + movimenti dopo la data, con i trasferimenti nei due versi', () => {
  const { analisi, scelte } = preparaTutto();
  const r = converti(analisi, scelte, contesto());
  const principale = r.conti.find((c) => c.id === 'conto-principale');
  const investimenti = r.conti.find((c) => c.id === 'conto-investimenti');
  // Conto principale: 1000,00 (4 marzo) + stipendio 1500,00 (5) + 0,20 (6) − 400,00 versamento (7) − 8,00 (8)
  assert.equal(saldoCalcolato(principale, r.movimenti), 100000 + 150000 + 20 - 40000 - 800);
  // Investimenti: versato iniziale 2000,00 + 400,00 di versamento.
  assert.equal(saldoCalcolato(investimenti, r.movimenti), 200000 + 40000);
});

test('i valori storici di un conto investimenti diventano ValoreInvestimento, una sola volta', () => {
  const dati = esportazione();
  dati.patrimonio.conti[3].storico = [{ data: '2026-03-06', cent: 210000 }];
  const analisi = analizza(dati);
  const scelte = proponiAbbinamenti(analisi, categorieEsistenti(), contiEsistenti(), 'conto-principale');
  const primo = converti(analisi, scelte, contesto());
  assert.equal(primo.valoriInvestimento.length, 1);
  assert.equal(primo.valoriInvestimento[0].valore, 210000);
  const secondo = converti(analisi, scelte, contesto({ giaImportati: new Set(primo.valoriInvestimento.map((v) => v.origineId)) }));
  assert.equal(secondo.valoriInvestimento.length, 0);
});

test('iconaSuggerita e coloreVicino restituiscono sempre valori esistenti', () => {
  for (const nome of ['Interessi conto', 'Regali', 'Boh', 'Caffè']) {
    assert.ok(iconaSuggerita(nome, 'spesa') in ICONE);
    assert.ok(iconaSuggerita(nome, 'entrata') in ICONE);
  }
  assert.equal(coloreVicino('#e5484d'), 'corallo');
  assert.equal(coloreVicino('#2a78d6'), 'azzurro');
  assert.equal(coloreVicino('non-un-colore'), 'ardesia');
  assert.equal(coloreVicino(null), 'ardesia');
});

test('palette: i colori esadecimali coincidono con i token del tema chiaro', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
  for (const [nome, hex] of Object.entries(ESADECIMALI_CHIARI)) {
    assert.match(css, new RegExp(`--cat-${nome}: light-dark\\(${hex},`), `--cat-${nome} diverso da ${hex}`);
  }
});
