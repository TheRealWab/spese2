import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validaCategoria, puoArchiviare, puoEliminare, puoUnire, pianoUnione, prossimoOrdine, coloreSuggerito,
  pulisciNomeCategoria, LUNGHEZZA_MAX_NOME_CATEGORIA,
} from '../js/model/categorie.js';
import { COLORI_CATEGORIA } from '../js/model/palette.js';

// Dati inventati.
const categorie = [
  { id: 'a', nome: 'Alfa', tipo: 'spesa', colore: 'corallo', ordine: 0 },
  { id: 'b', nome: 'Beta caffè', tipo: 'spesa', colore: 'arancio', ordine: 1 },
  { id: 'c', nome: 'Gamma', tipo: 'spesa', colore: 'corallo', ordine: 2, archiviata: true },
  { id: 'e', nome: 'Alfa', tipo: 'entrata', colore: 'verde', ordine: 3 },
  { id: 's', nome: 'Paga', tipo: 'entrata', colore: 'smeraldo', ordine: 4, ruolo: 'stipendio' },
];

test('pulisciNomeCategoria toglie spazi ai bordi e doppi', () => {
  assert.equal(pulisciNomeCategoria('  Pane   e  latte '), 'Pane e latte');
  assert.equal(pulisciNomeCategoria(null), '');
});

test('validaCategoria: nome obbligatorio, lunghezza e tipo', () => {
  assert.match(validaCategoria({ nome: '   ', tipo: 'spesa' }, categorie), /Scrivi il nome/);
  assert.match(validaCategoria({ nome: 'x'.repeat(LUNGHEZZA_MAX_NOME_CATEGORIA + 1), tipo: 'spesa' }, categorie), /al massimo/);
  assert.match(validaCategoria({ nome: 'Nuova', tipo: 'altro' }, categorie), /Tipo di categoria/);
  assert.equal(validaCategoria({ nome: 'Nuova', tipo: 'spesa' }, categorie), null);
  assert.equal(validaCategoria({ nome: 'x'.repeat(LUNGHEZZA_MAX_NOME_CATEGORIA), tipo: 'spesa' }, categorie), null);
});

test('validaCategoria: nome già usato nello stesso tipo (senza badare a maiuscole, accenti, spazi)', () => {
  assert.match(validaCategoria({ nome: ' alfa ', tipo: 'spesa' }, categorie), /Esiste già una categoria con questo nome/);
  assert.match(validaCategoria({ nome: 'BETA CAFFE', tipo: 'spesa' }, categorie), /Esiste già/);
  assert.match(validaCategoria({ nome: 'gamma', tipo: 'spesa' }, categorie), /archiviata.*ripristinala/);
});

test('validaCategoria: lo stesso nome è lecito in un altro tipo, e rinominando se stessa si può confermare', () => {
  assert.equal(validaCategoria({ nome: 'Beta caffè', tipo: 'entrata' }, categorie), null);
  assert.equal(validaCategoria({ nome: 'Alfa', tipo: 'spesa' }, categorie, { escludiId: 'a' }), null);
  assert.match(validaCategoria({ nome: 'Alfa', tipo: 'spesa' }, categorie, { escludiId: 'b' }), /Esiste già/);
});

test('la categoria Stipendio non si archivia, elimina né unisce', () => {
  const stipendio = categorie.find((c) => c.ruolo === 'stipendio');
  assert.equal(puoArchiviare(stipendio).ok, false);
  assert.match(puoArchiviare(stipendio).motivo, /Ti restano/);
  assert.equal(puoEliminare(stipendio, { movimenti: 0 }).ok, false);
  assert.equal(puoUnire(stipendio, categorie[3]).ok, false);
  assert.equal(puoArchiviare(categorie[0]).ok, true);
});

test('puoEliminare: solo se vuota, con motivo chiaro altrimenti', () => {
  assert.equal(puoEliminare(categorie[0], { movimenti: 0, ricorrenti: 0 }).ok, true);
  const conUno = puoEliminare(categorie[0], { movimenti: 1 });
  assert.equal(conUno.ok, false);
  assert.match(conUno.motivo, /Ha 1 movimento: non si può eliminare/);
  assert.match(puoEliminare(categorie[0], { movimenti: 7 }).motivo, /Ha 7 movimenti/);
  assert.match(puoEliminare(categorie[0], { movimenti: 0, ricorrenti: 2 }).motivo, /ricorrenti/);
});

test('puoUnire: stesso tipo, categoria diversa', () => {
  assert.equal(puoUnire(categorie[0], categorie[1]).ok, true);
  assert.equal(puoUnire(categorie[0], categorie[0]).ok, false);
  assert.match(puoUnire(categorie[0], categorie[3]).motivo, /stesso tipo/);
});

test('pianoUnione: sposta solo i movimenti e i ricorrenti dell\'origine, senza toccare gli originali', () => {
  const movimenti = [
    { id: 'm1', categoriaId: 'a', importo: 100, modificatoIl: 'prima' },
    { id: 'm2', categoriaId: 'b', importo: 200, modificatoIl: 'prima' },
    { id: 'm3', categoriaId: 'a', importo: 300, modificatoIl: 'prima' },
  ];
  const ricorrenti = [{ id: 'r1', modello: { categoriaId: 'a', importo: 5 } }, { id: 'r2', modello: { categoriaId: 'b' } }];
  const copia = structuredClone({ movimenti, ricorrenti });
  const piano = pianoUnione({ movimenti, ricorrenti }, 'a', 'b', 'ADESSO');
  assert.deepEqual(piano.movimenti.map((m) => [m.id, m.categoriaId, m.modificatoIl]), [['m1', 'b', 'ADESSO'], ['m3', 'b', 'ADESSO']]);
  assert.deepEqual(piano.ricorrenti.map((r) => [r.id, r.modello.categoriaId, r.modello.importo]), [['r1', 'b', 5]]);
  assert.deepEqual({ movimenti, ricorrenti }, copia);
  assert.deepEqual(pianoUnione({ movimenti: [] }, 'a', 'b', 'x'), { movimenti: [], ricorrenti: [] });
});

test('prossimoOrdine: in fondo a tutte, anche senza categorie', () => {
  assert.equal(prossimoOrdine(categorie), 5);
  assert.equal(prossimoOrdine([]), 0);
});

test('coloreSuggerito: il meno usato del tipo, a parità il primo della tavolozza', () => {
  assert.equal(coloreSuggerito([], 'spesa'), COLORI_CATEGORIA[0]);
  // tra le spese "corallo" è usato due volte e "arancio" una: il primo libero è "ambra"
  assert.equal(coloreSuggerito(categorie, 'spesa'), 'ambra');
  // le entrate usano "verde" e "smeraldo"; il primo mai usato è "corallo"
  assert.equal(coloreSuggerito(categorie, 'entrata'), 'corallo');
  const tutte = COLORI_CATEGORIA.map((colore, i) => ({ id: String(i), tipo: 'spesa', colore, ordine: i }));
  assert.equal(coloreSuggerito([...tutte, { id: 'x', tipo: 'spesa', colore: COLORI_CATEGORIA[0], ordine: 99 }], 'spesa'), COLORI_CATEGORIA[1]);
});
