import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validaPin, creaVerificaPin, verificaPin, pausaDopoErrori, registraErrore, attesaRimasta, deveBloccare,
  aBase64Url, daBase64Url, leggiSicurezza, TENTATIVI_INIZIALI, SICUREZZA_PREDEFINITA,
  PAUSA_MASSIMA_SECONDI, ITERAZIONI_PIN,
} from '../js/model/sicurezza.js';

// PIN inventati. Poche iterazioni: la derivazione è lenta apposta.
const VELOCE = 1000;

test('validaPin: da 4 a 6 cifre, né banali né con lettere', () => {
  assert.equal(validaPin('4827'), null);
  assert.equal(validaPin('905317'), null);
  assert.match(validaPin('123'), /da 4 a 6 cifre/);
  assert.match(validaPin('1234567'), /da 4 a 6 cifre/);
  assert.match(validaPin('48a7'), /da 4 a 6 cifre/);
  assert.match(validaPin(''), /da 4 a 6 cifre/);
  assert.match(validaPin(null), /da 4 a 6 cifre/);
  for (const banale of ['0000', '1111', '1234', '4321', '123456', '987654']) {
    assert.match(validaPin(banale), /troppo semplice/, banale);
  }
});

test('creaVerificaPin non salva il PIN e verificaPin lo riconosce', async () => {
  const verifica = await creaVerificaPin('4827', VELOCE);
  assert.ok(!JSON.stringify(verifica).includes('4827'));
  assert.equal(verifica.lunghezza, 4);
  assert.equal(verifica.iterazioni, VELOCE);
  assert.equal(await verificaPin('4827', verifica), true);
  assert.equal(await verificaPin('4828', verifica), false);
  assert.equal(await verificaPin('', verifica), false);
  assert.equal(await verificaPin('48270', verifica), false);
});

test('ogni PIN ha un sale diverso: stesso PIN, hash diversi', async () => {
  const [a, b] = [await creaVerificaPin('4827', VELOCE), await creaVerificaPin('4827', VELOCE)];
  assert.notEqual(a.sale, b.sale);
  assert.notEqual(a.hash, b.hash);
});

test('verificaPin senza PIN configurato risponde no', async () => {
  assert.equal(await verificaPin('4827', null), false);
  assert.equal(await verificaPin(4827, await creaVerificaPin('4827', VELOCE)), false);
});

test('le iterazioni predefinite del PIN sono robuste', () => {
  assert.ok(ITERAZIONI_PIN >= 100_000);
});

test('pausaDopoErrori: nessuna pausa sotto soglia, poi 30 s, 60 s, 120 s… con tetto', () => {
  for (const n of [0, 1, 4, 6, 9]) assert.equal(pausaDopoErrori(n), 0, `errori ${n}`);
  assert.equal(pausaDopoErrori(5), 30);
  assert.equal(pausaDopoErrori(10), 60);
  assert.equal(pausaDopoErrori(15), 120);
  assert.equal(pausaDopoErrori(1000), PAUSA_MASSIMA_SECONDI);
});

test('registraErrore e attesaRimasta: la pausa scatta al quinto errore e scade', () => {
  let stato = TENTATIVI_INIZIALI;
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i += 1) {
    stato = registraErrore(stato, t0);
    assert.equal(attesaRimasta(stato, t0).bloccato, false);
  }
  stato = registraErrore(stato, t0);
  assert.equal(stato.errori, 5);
  assert.deepEqual(attesaRimasta(stato, t0), { bloccato: true, secondi: 30 });
  assert.deepEqual(attesaRimasta(stato, t0 + 10_500), { bloccato: true, secondi: 20 });
  assert.equal(attesaRimasta(stato, t0 + 30_000).bloccato, false);
});

test('attesaRimasta con stato assente non blocca', () => {
  assert.deepEqual(attesaRimasta(undefined, 5), { bloccato: false, secondi: 0 });
});

test('deveBloccare: apertura da zero, ritorno rapido, ritorno dopo il tempo, ricarica', () => {
  const base = { attiva: true, sbloccato: true, nascostaIl: null, adesso: 10_000_000, minuti: 1 };
  assert.equal(deveBloccare({ ...base, attiva: false, sbloccato: false }), false, 'blocco spento');
  assert.equal(deveBloccare({ ...base, sbloccato: false }), true, 'app appena aperta');
  assert.equal(deveBloccare(base), false, 'ricarica della pagina: resta sbloccata');
  assert.equal(deveBloccare({ ...base, nascostaIl: base.adesso - 30_000 }), false, '30 s in background');
  assert.equal(deveBloccare({ ...base, nascostaIl: base.adesso - 60_000 }), false, 'esattamente 1 minuto');
  assert.equal(deveBloccare({ ...base, nascostaIl: base.adesso - 60_001 }), true, 'oltre 1 minuto');
  assert.equal(deveBloccare({ ...base, minuti: 5, nascostaIl: base.adesso - 200_000 }), false, 'con 5 minuti');
  assert.equal(deveBloccare({ ...base, minuti: 5, nascostaIl: base.adesso - 301_000 }), true);
});

test('base64url: andata e ritorno, senza + / =', () => {
  const byte = Uint8Array.from({ length: 70 }, (_, i) => (i * 37) % 256);
  const testo = aBase64Url(byte);
  assert.ok(!/[+/=]/.test(testo));
  assert.deepEqual(daBase64Url(testo), byte);
});

test('leggiSicurezza completa i campi mancanti senza modificare l\'originale', () => {
  const salvata = { attiva: true };
  assert.deepEqual(leggiSicurezza(salvata), { ...SICUREZZA_PREDEFINITA, attiva: true });
  assert.deepEqual(salvata, { attiva: true });
  assert.deepEqual(leggiSicurezza(undefined), SICUREZZA_PREDEFINITA);
});
