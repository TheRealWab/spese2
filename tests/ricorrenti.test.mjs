import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scadenze, scadenzeDovute, prossimaScadenza, anteprimaScadenze, datiMovimento, ricorrenteDaMovimento, validaRicorrente,
  descriviFrequenza, etichettaScadenza, modalitaPredefinita, MAX_PER_APERTURA,
} from '../js/model/ricorrenti.js';

// Dati inventati. 2026-10-15 è un giovedì (lunedì = 0 → giovedì = 3).
const modello = { tipo: 'spesa', importo: 1500, categoriaId: 'c', contoId: 'a', contoDestinazioneId: null, nota: 'Palestra' };
const ric = (extra) => ({
  id: 'r1', modello, frequenza: 'mensile', giornoDelMese: 27, giornoSettimana: 0, intervallo: 1, unita: 'mesi',
  dataInizio: '2026-01-01', dataFine: null, modalita: 'automatico', attivo: true, ultimaGenerazione: null, ...extra,
});
const prime = (r, n) => { const out = []; for (const d of scadenze(r)) { out.push(d); if (out.length >= n) break; } return out; };

// ---- Le date ----

test('mensile: giorno fisso, dalla data di inizio in poi', () => {
  assert.deepEqual(prime(ric({}), 3), ['2026-01-27', '2026-02-27', '2026-03-27']);
  // se il giorno è già passato nel mese di inizio, si parte dal mese dopo
  assert.deepEqual(prime(ric({ dataInizio: '2026-10-28' }), 2), ['2026-11-27', '2026-12-27']);
  assert.deepEqual(prime(ric({ dataInizio: '2026-10-27' }), 1), ['2026-10-27']); // lo stesso giorno conta
});

test('mensile: il giorno che non esiste usa l\'ultimo del mese; "ultimo" è sempre l\'ultimo', () => {
  assert.deepEqual(prime(ric({ giornoDelMese: 31, dataInizio: '2026-01-01' }), 4), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual(prime(ric({ giornoDelMese: 30, dataInizio: '2026-01-01' }), 2), ['2026-01-30', '2026-02-28']);
  assert.deepEqual(prime(ric({ giornoDelMese: 'ultimo', dataInizio: '2028-01-15' }), 3), ['2028-01-31', '2028-02-29', '2028-03-31']); // 2028 è bisestile
  assert.deepEqual(prime(ric({ giornoDelMese: 29, dataInizio: '2027-01-01' }), 2), ['2027-01-29', '2027-02-28']);
});

test('mensile: attraversa il capodanno', () => {
  assert.deepEqual(prime(ric({ giornoDelMese: 15, dataInizio: '2026-11-20' }), 3), ['2026-12-15', '2027-01-15', '2027-02-15']);
});

test('settimanale: il giorno scelto, a partire dal primo dopo l\'inizio', () => {
  const lunedi = ric({ frequenza: 'settimanale', giornoSettimana: 0, dataInizio: '2026-10-15' }); // inizio di giovedì
  assert.deepEqual(prime(lunedi, 3), ['2026-10-19', '2026-10-26', '2026-11-02']);
  const giovedi = ric({ frequenza: 'settimanale', giornoSettimana: 3, dataInizio: '2026-10-15' });
  assert.deepEqual(prime(giovedi, 2), ['2026-10-15', '2026-10-22']); // lo stesso giorno conta
  const domenica = ric({ frequenza: 'settimanale', giornoSettimana: 6, dataInizio: '2026-10-15' });
  assert.deepEqual(prime(domenica, 1), ['2026-10-18']);
});

test('annuale: stessa data ogni anno; il 29 febbraio diventa il 28 negli anni non bisestili', () => {
  assert.deepEqual(prime(ric({ frequenza: 'annuale', dataInizio: '2026-03-05' }), 3), ['2026-03-05', '2027-03-05', '2028-03-05']);
  assert.deepEqual(prime(ric({ frequenza: 'annuale', dataInizio: '2028-02-29' }), 3), ['2028-02-29', '2029-02-28', '2030-02-28']);
});

test('ogni N giorni, settimane o mesi: dalla data di inizio, senza "scivolare"', () => {
  assert.deepEqual(prime(ric({ frequenza: 'ogni_n', intervallo: 10, unita: 'giorni', dataInizio: '2026-02-20' }), 3), ['2026-02-20', '2026-03-02', '2026-03-12']);
  assert.deepEqual(prime(ric({ frequenza: 'ogni_n', intervallo: 2, unita: 'settimane', dataInizio: '2026-10-15' }), 3), ['2026-10-15', '2026-10-29', '2026-11-12']);
  // ogni 1 mese dal 31 gennaio: febbraio 28, poi torna a 31 marzo (non resta al 28)
  assert.deepEqual(prime(ric({ frequenza: 'ogni_n', intervallo: 1, unita: 'mesi', dataInizio: '2026-01-31' }), 3), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(prime(ric({ frequenza: 'ogni_n', intervallo: 3, unita: 'mesi', dataInizio: '2026-01-15' }), 3), ['2026-01-15', '2026-04-15', '2026-07-15']);
});

test('la data di fine chiude la serie', () => {
  const r = ric({ dataFine: '2026-03-27' });
  assert.deepEqual([...scadenze(r)], ['2026-01-27', '2026-02-27', '2026-03-27']);
  assert.deepEqual([...scadenze(ric({ dataFine: '2026-03-26' }))], ['2026-01-27', '2026-02-27']);
});

// ---- Scadenze dovute e recupero ----

test('scadenzeDovute: tutto ciò che è passato dall\'ultima generazione, fino a oggi incluso', () => {
  const r = ric({ ultimaGenerazione: '2026-07-27' });
  assert.deepEqual(scadenzeDovute(r, '2026-10-15').date, ['2026-08-27', '2026-09-27']); // recupero dei mesi mancati
  assert.deepEqual(scadenzeDovute(r, '2026-10-27').date, ['2026-08-27', '2026-09-27', '2026-10-27']); // oggi conta
  assert.deepEqual(scadenzeDovute(ric({ ultimaGenerazione: '2026-09-27' }), '2026-10-15').date, []); // già a posto
});

test('scadenzeDovute: senza ultima generazione parte dalla data di inizio; il futuro non si genera', () => {
  assert.equal(scadenzeDovute(ric({ dataInizio: '2026-08-01' }), '2026-10-15').date.length, 2); // 27 ago, 27 set
  assert.deepEqual(scadenzeDovute(ric({ dataInizio: '2026-12-01' }), '2026-10-15').date, []);
});

test('scadenzeDovute: mai due volte la stessa data, anche richiamandola', () => {
  const r = ric({ ultimaGenerazione: '2026-08-27' });
  const prima = scadenzeDovute(r, '2026-10-15').date;
  const dopo = scadenzeDovute({ ...r, ultimaGenerazione: prima.at(-1) }, '2026-10-15').date;
  assert.deepEqual(dopo, []);
  assert.equal(new Set(prima).size, prima.length);
});

test('scadenzeDovute: il tetto per apertura e il segnale "ce ne sono altre"', () => {
  const ognuno = ric({ frequenza: 'ogni_n', intervallo: 1, unita: 'giorni', dataInizio: '2025-01-01' }); // ~650 giorni
  const r = scadenzeDovute(ognuno, '2026-10-15', MAX_PER_APERTURA);
  assert.equal(r.date.length, MAX_PER_APERTURA);
  assert.equal(r.altre, true);
  assert.equal(r.date[0], '2025-01-01');
  const poche = scadenzeDovute(ric({ ultimaGenerazione: '2026-07-27' }), '2026-10-15', MAX_PER_APERTURA);
  assert.equal(poche.altre, false);
  assert.equal(MAX_PER_APERTURA, 120);
});

test('scadenzeDovute: la fine della serie vale anche per il recupero', () => {
  const r = ric({ dataFine: '2026-08-31', ultimaGenerazione: '2026-05-27' });
  assert.deepEqual(scadenzeDovute(r, '2026-10-15').date, ['2026-06-27', '2026-07-27', '2026-08-27']);
});

test('prossimaScadenza e anteprima: la prima non chiusa (anche già passata), null a serie finita', () => {
  const r = ric({ ultimaGenerazione: '2026-08-27' });
  assert.equal(prossimaScadenza(r), '2026-09-27');
  assert.deepEqual(anteprimaScadenze(r, 3), ['2026-09-27', '2026-10-27', '2026-11-27']);
  assert.equal(prossimaScadenza(ric({ dataFine: '2026-03-27', ultimaGenerazione: '2026-03-27' })), null);
  assert.deepEqual(anteprimaScadenze(ric({ dataFine: '2026-02-28' }), 5), ['2026-01-27', '2026-02-27']);
});

// ---- Dal modello al movimento, validazione, testi ----

test('datiMovimento: il movimento di una scadenza, con il ricorrenteId; trasferimenti senza categoria', () => {
  const m = datiMovimento(ric({}), '2026-10-27');
  assert.deepEqual(m, { tipo: 'spesa', importo: 1500, data: '2026-10-27', categoriaId: 'c', contoId: 'a', contoDestinazioneId: null, nota: 'Palestra', ricorrenteId: 'r1' });
  assert.equal(datiMovimento(ric({}), '2026-10-27', 1800).importo, 1800); // importo modificato al volo
  const t = datiMovimento(ric({ modello: { tipo: 'trasferimento', importo: 20000, categoriaId: 'x', contoId: 'a', contoDestinazioneId: 'i', nota: 'PAC' } }), '2026-10-05');
  assert.deepEqual([t.categoriaId, t.contoDestinazioneId, t.tipo], [null, 'i', 'trasferimento']);
});

test('ricorrenteDaMovimento: mensile nello stesso giorno; quel movimento è già la prima scadenza', () => {
  const r = ricorrenteDaMovimento({ tipo: 'entrata', importo: 145000, categoriaId: 's', contoId: 'a', nota: 'Stipendio', data: '2026-09-27' });
  assert.deepEqual([r.frequenza, r.giornoDelMese, r.dataInizio, r.ultimaGenerazione, r.modalita], ['mensile', 27, '2026-09-27', '2026-09-27', 'conferma']);
  assert.equal(validaRicorrente({ id: 'x', ...r }), null);
  assert.equal(prossimaScadenza({ id: 'x', ...r }), '2026-10-27'); // la scadenza di settembre non si ripete
  assert.equal(ricorrenteDaMovimento({ tipo: 'spesa', importo: 100, categoriaId: 'c', contoId: 'a', data: '2026-09-05' }).modalita, 'automatico');
});

test('modalitaPredefinita: conferma per le entrate, automatico per il resto', () => {
  assert.deepEqual(['spesa', 'entrata', 'trasferimento'].map(modalitaPredefinita), ['automatico', 'conferma', 'automatico']);
});

test('validaRicorrente: i casi sbagliati hanno un messaggio, quello giusto passa', () => {
  assert.equal(validaRicorrente(ric({})), null);
  const con = (extra, mod = {}) => validaRicorrente(ric({ ...extra, modello: { ...modello, ...mod } }));
  assert.match(con({}, { tipo: 'boh' }), /tipo/);
  assert.match(con({}, { importo: 0 }), /importo/);
  assert.match(con({}, { importo: 12.5 }), /importo/);
  assert.match(con({}, { contoId: null }), /conto/);
  assert.match(con({}, { categoriaId: null }), /categoria/);
  assert.match(con({}, { tipo: 'trasferimento', contoDestinazioneId: null }), /destinazione/);
  assert.match(con({}, { tipo: 'trasferimento', contoDestinazioneId: 'a' }), /diversi/);
  assert.equal(con({}, { tipo: 'trasferimento', contoDestinazioneId: 'i', categoriaId: null }), null);
  assert.match(con({ frequenza: 'boh' }), /ogni quanto/);
  assert.match(con({ frequenza: 'settimanale', giornoSettimana: 7 }), /settimana/);
  assert.match(con({ giornoDelMese: 32 }), /giorno del mese/);
  assert.equal(con({ giornoDelMese: 'ultimo' }), null);
  assert.match(con({ frequenza: 'ogni_n', intervallo: 0 }), /quanti/);
  assert.match(con({ frequenza: 'ogni_n', intervallo: 2, unita: 'anni' }), /giorni, settimane o mesi/);
  assert.match(con({ dataInizio: '2026-02-30' }), /inizio/);
  assert.match(con({ dataFine: '2025-12-31' }), /dopo/);
  assert.match(con({ modalita: 'boh' }), /da solo/);
});

test('descriviFrequenza e etichettaScadenza', () => {
  assert.equal(descriviFrequenza(ric({})), 'Ogni mese, il 27');
  assert.equal(descriviFrequenza(ric({ giornoDelMese: 'ultimo' })), 'Ogni mese, l\'ultimo giorno');
  assert.equal(descriviFrequenza(ric({ frequenza: 'settimanale', giornoSettimana: 0 })), 'Ogni settimana, il lunedì');
  assert.equal(descriviFrequenza(ric({ frequenza: 'annuale', dataInizio: '2026-03-05' })), 'Ogni anno, il 5 marzo');
  assert.equal(descriviFrequenza(ric({ frequenza: 'ogni_n', intervallo: 1, unita: 'settimane' })), 'Ogni settimana');
  assert.equal(descriviFrequenza(ric({ frequenza: 'ogni_n', intervallo: 3, unita: 'mesi' })), 'Ogni 3 mesi');
  assert.equal(descriviFrequenza(ric({ frequenza: 'ogni_n', intervallo: 10, unita: 'giorni' })), 'Ogni 10 giorni');
  assert.equal(etichettaScadenza('Stipendio', ric({}), '2026-10-27'), 'Stipendio di ottobre');
  assert.equal(etichettaScadenza('Assicurazione', ric({ frequenza: 'annuale' }), '2026-10-27'), 'Assicurazione · 27 ott 2026');
});
