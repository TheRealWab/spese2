import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SFONDI, SFONDO_PREDEFINITO, ID_SFONDO_FOTO, ATTENUA_MASSIMA, LUNGHEZZA_MASSIMA_NOME,
  fotoValida, normalizzaSfondo, cssSfondo, nomeSfondo, normalizzaNome, normalizzaProfilo, iniziali, primoAvvioStimato,
  riquadroQuadrato, aspettoDopoRipristino,
} from '../js/model/aspetto.js';
import { pacchettoDati } from '../js/model/backup.js';

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMD';

test('ci sono dieci sfondi pronti, più quello semplice, tutti con un identificativo diverso', () => {
  const ids = SFONDI.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(SFONDI.filter((s) => s.id !== 'semplice').length, 10);
  assert.ok(ids.includes('predefinito') && ids.includes('semplice'));
  for (const s of SFONDI) assert.ok(s.nome);
});

test('ogni sfondo pronto produce un CSS valido nei due temi; quello predefinito lascia i colori del tema', () => {
  assert.equal(cssSfondo({ id: 'predefinito' }), null);
  for (const s of SFONDI.filter((x) => x.css)) {
    const css = cssSfondo({ id: s.id });
    assert.match(css, /gradient/);
    if (s.id !== 'semplice') assert.match(css, /light-dark\(/); // intensità diversa in chiaro e in scuro
  }
});

test('una foto di sfondo diventa un CSS con la foto e il velo del colore del tema', () => {
  const css = cssSfondo({ id: ID_SFONDO_FOTO, foto: FOTO, attenua: 40 });
  assert.match(css, /var\(--sfondo\) 40%/);
  assert.ok(css.includes(`url("${FOTO}")`));
});

test('valori strani delle impostazioni o di un backup tornano ai valori predefiniti', () => {
  assert.deepEqual(normalizzaSfondo(undefined), SFONDO_PREDEFINITO);
  assert.deepEqual(normalizzaSfondo({ id: 'inventato', foto: 5, attenua: 'x' }), SFONDO_PREDEFINITO);
  assert.equal(normalizzaSfondo({ id: ID_SFONDO_FOTO, foto: null }).id, 'predefinito'); // "foto" senza foto non esiste
  assert.equal(normalizzaSfondo({ id: 'oceano', attenua: 500 }).attenua, ATTENUA_MASSIMA);
  assert.equal(normalizzaSfondo({ id: 'oceano', attenua: -3 }).attenua, 0);
});

test('solo una vera immagine in forma di testo è accettata: niente che possa rompere il CSS o l\'HTML', () => {
  assert.ok(fotoValida(FOTO));
  assert.ok(!fotoValida('data:image/jpeg;base64,AAAA") ; background:url("http://x'));
  assert.ok(!fotoValida('https://esempio.it/foto.jpg'));
  assert.ok(!fotoValida('data:text/html;base64,AAAA'));
  assert.ok(!fotoValida('data:image/svg+xml;base64,AAAA')); // gli SVG possono contenere script
  assert.ok(!fotoValida(`data:image/jpeg;base64,${'A'.repeat(2_000_001)}`)); // troppo lunga
  assert.ok(!fotoValida(null));
  assert.equal(cssSfondo({ id: ID_SFONDO_FOTO, foto: 'data:image/jpeg;base64,x") y', attenua: 10 }), null);
});

test('il nome dello sfondo scelto', () => {
  assert.equal(nomeSfondo({ id: 'tramonto' }), 'Tramonto');
  assert.equal(nomeSfondo({ id: ID_SFONDO_FOTO, foto: FOTO }), 'La tua foto');
  assert.equal(nomeSfondo(undefined), 'Wallet');
});

test('il nome del profilo: spazi sistemati, lunghezza limitata, iniziali per il cerchio', () => {
  assert.equal(normalizzaNome('  Mario   Rossi  '), 'Mario Rossi');
  assert.equal(normalizzaNome('x'.repeat(100)).length, LUNGHEZZA_MASSIMA_NOME);
  assert.equal(normalizzaNome(null), '');
  assert.equal(iniziali('Mario Rossi'), 'MR');
  assert.equal(iniziali('mario'), 'M');
  assert.equal(iniziali('Anna Maria De Luca'), 'AL');
  assert.equal(iniziali(''), '');
  assert.deepEqual(normalizzaProfilo({ nome: ' Ale ', foto: 'no' }), { nome: 'Ale', foto: null });
});

test('"Attivo dal": il giorno del primo movimento creato qui, senza contare quelli importati; altrimenti oggi', () => {
  const oggi = '2026-10-16';
  const creati = [{ creatoIl: '2026-10-14T09:30:00.000Z' }, { creatoIl: '2026-10-15T18:00:00.000Z' }];
  assert.equal(primoAvvioStimato(creati, oggi), '2026-10-14');
  // un movimento importato dalla vecchia app ha la data di allora: non è l'inizio dell'uso di questa app
  assert.equal(primoAvvioStimato([{ creatoIl: '2024-01-05T10:00:00.000Z', origineId: 'vecchio-1' }, ...creati], oggi), '2026-10-14');
  assert.equal(primoAvvioStimato([], oggi), oggi);
  assert.equal(primoAvvioStimato([{ creatoIl: '2030-01-01T00:00:00.000Z' }], oggi), oggi); // data nel futuro: si ignora
  assert.equal(primoAvvioStimato([{ id: 'x' }], oggi), oggi); // movimento senza data di creazione
});

test('il ritaglio quadrato resta sempre dentro la foto e ingrandire stringe il riquadro', () => {
  const base = { larghezza: 4000, altezza: 3000 };
  assert.deepEqual(riquadroQuadrato(base), { x: 500, y: 0, lato: 3000 }); // centrato, il quadrato più grande possibile
  const dentro = riquadroQuadrato({ ...base, zoom: 2 });
  assert.equal(dentro.lato, 1500);
  const angolo = riquadroQuadrato({ ...base, zoom: 2, cx: -500, cy: 99999 }); // centro fuori dalla foto
  assert.deepEqual([angolo.x, angolo.y], [0, 1500]);
  assert.equal(riquadroQuadrato({ ...base, zoom: 99 }).lato, 750); // l'ingrandimento ha un massimo
  assert.equal(riquadroQuadrato({ ...base, zoom: 0.2 }).lato, 3000); // e non si rimpicciolisce sotto il quadrato intero
});

test('nel backup viaggiano profilo e sfondo (non il blocco né la data dell\'ultimo backup)', () => {
  const archivi = {
    conti: [], categorie: [], movimenti: [], valoriInvestimento: [], ricorrenti: [],
    impostazioni: [{ id: 'principale', profilo: { nome: 'Ale', foto: FOTO }, sfondo: { id: 'oceano', foto: null, attenua: 35 }, sicurezza: { attiva: true }, ultimoBackup: '2026-10-01' }],
  };
  const impostazioni = pacchettoDati(archivi).impostazioni[0];
  assert.equal(impostazioni.profilo.nome, 'Ale');
  assert.equal(impostazioni.profilo.foto, FOTO);
  assert.equal(impostazioni.sfondo.id, 'oceano');
  assert.ok(!('sicurezza' in impostazioni) && !('ultimoBackup' in impostazioni));
});

test('ripristinando un backup vecchio (senza profilo e sfondo) quelli di questo telefono restano; con un backup nuovo vale il backup', () => {
  const attuali = { profilo: { nome: 'Ale', foto: FOTO }, sfondo: { id: 'tramonto', foto: null, attenua: 35 } };
  const vecchio = aspettoDopoRipristino(attuali, { giornoInizioMese: 1 });
  assert.equal(vecchio.profilo.nome, 'Ale');
  assert.equal(vecchio.profilo.foto, FOTO);
  assert.equal(vecchio.sfondo.id, 'tramonto');

  const nuovo = aspettoDopoRipristino(attuali, { profilo: { nome: 'Sara', foto: null }, sfondo: { id: 'notte', foto: null, attenua: 20 } });
  assert.equal(nuovo.profilo.nome, 'Sara');
  assert.equal(nuovo.profilo.foto, null);
  assert.equal(nuovo.sfondo.id, 'notte');

  // un backup con dati storti non rompe nulla
  const storto = aspettoDopoRipristino(attuali, { profilo: 'x', sfondo: { id: 'foto', foto: 'http://x' } });
  assert.deepEqual(storto.profilo, { nome: '', foto: null });
  assert.equal(storto.sfondo.id, 'predefinito');
});
