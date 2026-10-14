import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cifra, decifra, leggiIntestazione, pacchettoDati, validaDatiBackup, riepilogoBackup, unisci,
  statoUltimoBackup, descriviUltimoBackup, nomeFileBackup, aBase64, daBase64, ErroreBackup,
  FORMATO, ITERAZIONI, MASSIMO_ITERAZIONI,
} from '../js/model/backup.js';
import { giorniTra } from '../js/util/date.js';

// Dati inventati. Poche iterazioni nei test (la derivazione della chiave è lenta apposta): si abbassa la soglia minima.
const VELOCE = { iterazioni: 1000 };
const APRI = { minimoIterazioni: 1 };
const PASSWORD = 'password-di-prova-1';

const archivi = () => ({
  conti: [{ id: 'c1', nome: 'Conto di prova', tipo: 'conto', saldoIniziale: 1000, dataSaldoIniziale: '2026-01-01' }],
  categorie: [{ id: 'k1', nome: 'Categoria di prova', tipo: 'spesa' }],
  movimenti: [
    { id: 'm1', tipo: 'spesa', importo: 250, data: '2026-02-03', categoriaId: 'k1', contoId: 'c1', modificatoIl: '2026-02-03T10:00:00.000Z' },
    { id: 'm2', tipo: 'spesa', importo: 990, data: '2026-02-05', categoriaId: 'k1', contoId: 'c1', modificatoIl: '2026-02-05T10:00:00.000Z', origineId: 'le-mie-spese:x1' },
  ],
  valoriInvestimento: [],
  ricorrenti: [],
  impostazioni: [{ id: 'principale', tema: 'scuro', giornoInizioMese: 5, seedVersione: 1, sicurezza: { attiva: true, pin: 'x' }, ultimoBackup: '2026-01-01' }],
});

test('cifra e decifra restituiscono gli stessi dati', async () => {
  const dati = pacchettoDati(archivi(), new Date('2026-03-01T10:00:00Z'));
  const file = await cifra(dati, PASSWORD, VELOCE);
  assert.deepEqual(await decifra(file, PASSWORD, APRI), dati);
});

test('il file ha intestazione in chiaro e nessun dato leggibile', async () => {
  const file = await cifra(pacchettoDati(archivi()), PASSWORD, VELOCE);
  const testo = JSON.parse(file);
  assert.equal(testo.formato, FORMATO);
  assert.equal(testo.cifratura.algoritmo, 'AES-GCM');
  assert.equal(testo.cifratura.kdf, 'PBKDF2-SHA-256');
  assert.equal(testo.cifratura.iterazioni, 1000);
  assert.ok(testo.cifratura.sale && testo.cifratura.iv);
  assert.ok(!file.includes('Conto di prova') && !file.includes('Categoria di prova'));
});

test('ogni backup ha sale e IV casuali: due file degli stessi dati sono diversi', async () => {
  const dati = pacchettoDati(archivi());
  const [a, b] = [await cifra(dati, PASSWORD, VELOCE), await cifra(dati, PASSWORD, VELOCE)];
  assert.notEqual(JSON.parse(a).cifratura.sale, JSON.parse(b).cifratura.sale);
  assert.notEqual(JSON.parse(a).dati, JSON.parse(b).dati);
});

test('password sbagliata: messaggio chiaro, nessun dato', async () => {
  const file = await cifra(pacchettoDati(archivi()), PASSWORD, VELOCE);
  await assert.rejects(decifra(file, 'password-sbagliata', APRI), /Password errata/);
  await assert.rejects(decifra(file, '', APRI), ErroreBackup);
});

test('un file alterato viene rifiutato (cifratura autenticata)', async () => {
  const file = JSON.parse(await cifra(pacchettoDati(archivi()), PASSWORD, VELOCE));
  const byte = daBase64(file.dati);
  byte[10] ^= 0xff;
  await assert.rejects(decifra(JSON.stringify({ ...file, dati: aBase64(byte) }), PASSWORD, APRI), /Password errata oppure file danneggiato/);
});

test('la password è normalizzata (stessa parola scritta con accenti composti o scomposti)', async () => {
  const file = await cifra(pacchettoDati(archivi()), 'perché-1234', VELOCE);
  assert.ok(await decifra(file, 'perché-1234', APRI));
});

test('password troppo corta rifiutata prima di cifrare', async () => {
  await assert.rejects(cifra(pacchettoDati(archivi()), 'corta', VELOCE), /almeno 8 caratteri/);
});

test('leggiIntestazione rifiuta file di altro tipo, versioni future e iterazioni fuori misura', async () => {
  assert.throws(() => leggiIntestazione('non json'), /non è leggibile/);
  assert.throws(() => leggiIntestazione('{"formato":"altro"}'), /non è un backup/);
  const file = JSON.parse(await cifra(pacchettoDati(archivi()), PASSWORD, VELOCE));
  assert.throws(() => leggiIntestazione(JSON.stringify({ ...file, versione: 99 }), APRI), /più recente/);
  assert.throws(() => leggiIntestazione(JSON.stringify(file)), /incompleto o danneggiato/, 'sotto il minimo di iterazioni');
  const enorme = { ...file, cifratura: { ...file.cifratura, iterazioni: MASSIMO_ITERAZIONI + 1 } };
  assert.throws(() => leggiIntestazione(JSON.stringify(enorme), APRI), /incompleto o danneggiato/);
});

test('le iterazioni predefinite rispettano la specifica (almeno 310.000)', () => {
  assert.ok(ITERAZIONI >= 310_000);
});

test('pacchettoDati toglie dalle impostazioni blocco e data dell\'ultimo backup', () => {
  const pacchetto = pacchettoDati(archivi());
  const imp = pacchetto.impostazioni[0];
  assert.equal(imp.sicurezza, undefined);
  assert.equal(imp.ultimoBackup, undefined);
  assert.equal(imp.tema, 'scuro');
  assert.equal(imp.seedVersione, 1);
});

test('validaDatiBackup rifiuta contenuti storti', () => {
  const buono = pacchettoDati(archivi());
  assert.doesNotThrow(() => validaDatiBackup(buono));
  assert.throws(() => validaDatiBackup({ ...buono, app: 'altra' }), /non contiene dati/);
  assert.throws(() => validaDatiBackup({ ...buono, conti: undefined }), /manca la sezione/);
  assert.throws(() => validaDatiBackup({ ...buono, movimenti: [{ id: 'z', tipo: 'spesa', importo: -5, data: '2026-01-01' }] }), /movimenti non validi/);
  assert.throws(() => validaDatiBackup({ ...buono, categorie: [{ nome: 'senza id' }] }), /senza identificativo/);
});

test('riepilogoBackup: conteggi e periodo', () => {
  const r = riepilogoBackup(pacchettoDati(archivi(), new Date('2026-03-01T10:00:00Z')));
  assert.deepEqual({ m: r.movimenti, c: r.categorie, k: r.conti, p: r.periodo }, { m: 2, c: 1, k: 1, p: { da: '2026-02-03', a: '2026-02-05' } });
});

test('statoUltimoBackup e descrizione: mai, oggi, ieri, N giorni, oltre 30 giorni', () => {
  assert.deepEqual(statoUltimoBackup(null, '2026-03-10'), { giorni: null, daFare: true });
  assert.deepEqual(statoUltimoBackup('2026-03-10', '2026-03-10'), { giorni: 0, daFare: false });
  assert.deepEqual(statoUltimoBackup('2026-03-09', '2026-03-10'), { giorni: 1, daFare: false });
  assert.deepEqual(statoUltimoBackup('2026-02-08', '2026-03-10'), { giorni: 30, daFare: false });
  assert.deepEqual(statoUltimoBackup('2026-02-07', '2026-03-10'), { giorni: 31, daFare: true });
  assert.equal(descriviUltimoBackup({ giorni: null }), 'Nessun backup ancora');
  assert.equal(descriviUltimoBackup({ giorni: 0 }), 'Ultimo backup: oggi');
  assert.equal(descriviUltimoBackup({ giorni: 1 }), 'Ultimo backup: ieri');
  assert.equal(descriviUltimoBackup({ giorni: 12 }), 'Ultimo backup: 12 giorni fa');
});

test('giorniTra attraversa mesi e anni bisestili', () => {
  assert.equal(giorniTra('2026-02-27', '2026-03-02'), 3);
  assert.equal(giorniTra('2028-02-28', '2028-03-01'), 2);
  assert.equal(giorniTra('2026-03-10', '2026-03-01'), -9);
});

test('nome del file di backup', () => {
  assert.equal(nomeFileBackup('2026-10-14'), 'spese-backup-2026-10-14.json');
});

test('base64: viaggio di andata e ritorno anche con tanti byte', () => {
  const grande = Uint8Array.from({ length: 100_000 }, (_, i) => i % 251);
  assert.deepEqual(daBase64(aBase64(grande)), grande);
});

// ---- Unione ----

test('unisci: aggiunge ciò che manca e non duplica', () => {
  const locali = archivi();
  const backup = pacchettoDati(archivi());
  backup.movimenti.push({ id: 'm3', tipo: 'entrata', importo: 5000, data: '2026-02-10', categoriaId: 'k1', contoId: 'c1', modificatoIl: '2026-02-10T10:00:00.000Z' });
  backup.categorie.push({ id: 'k2', nome: 'Altra categoria', tipo: 'entrata' });
  const r = unisci(locali, backup);
  assert.deepEqual(r.daSalvare.movimenti.map((m) => m.id), ['m3']);
  assert.deepEqual(r.daSalvare.categorie.map((c) => c.id), ['k2']);
  assert.equal(r.aggiunti, 2);
  assert.equal(r.aggiornati, 0);
  assert.equal(r.saltati, 4, 'conto, categoria e 2 movimenti già presenti');
});

test('unisci: per i movimenti vince il più recente', () => {
  const locali = archivi();
  const backup = pacchettoDati(archivi());
  backup.movimenti[0] = { ...backup.movimenti[0], importo: 300, modificatoIl: '2026-04-01T00:00:00.000Z' }; // più recente
  backup.movimenti[1] = { ...backup.movimenti[1], importo: 1, modificatoIl: '2020-01-01T00:00:00.000Z' }; // più vecchio
  const r = unisci(locali, backup);
  assert.deepEqual(r.daSalvare.movimenti.map((m) => [m.id, m.importo]), [['m1', 300]]);
  assert.equal(r.aggiornati, 1);
});

test('unisci: un movimento della vecchia app già presente con altro id non si duplica', () => {
  const locali = archivi();
  const backup = pacchettoDati(archivi());
  backup.movimenti = [{ id: 'altro-id', tipo: 'spesa', importo: 990, data: '2026-02-05', categoriaId: 'k1', contoId: 'c1', origineId: 'le-mie-spese:x1' }];
  assert.equal(unisci(locali, backup).daSalvare.movimenti.length, 0);
});

test('unisci non modifica gli archivi ricevuti', () => {
  const locali = archivi();
  const copia = structuredClone(locali);
  unisci(locali, pacchettoDati(archivi()));
  assert.deepEqual(locali, copia);
});
