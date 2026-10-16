// Controlli di coerenza sul progetto: cose che, se si rompono, l'app si rompe in silenzio sul telefono.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { CATEGORIE_INIZIALI, CONTI_INIZIALI } from '../js/model/seed.js';
import { PREDEFINITE } from '../js/model/impostazioni.js';
import { COLORI_CATEGORIA } from '../js/model/palette.js';
import { ICONE } from '../vendor/lucide/icone.js';
import { VERSIONE_APP } from '../js/versione.js';

const radice = join(fileURLToPath(import.meta.url), '..', '..');
const leggi = (percorso) => readFileSync(join(radice, percorso), 'utf8');

function elencaFile(cartella, estensioni) {
  const risultato = [];
  for (const voce of readdirSync(join(radice, cartella))) {
    const percorso = join(cartella, voce);
    if (statSync(join(radice, percorso)).isDirectory()) risultato.push(...elencaFile(percorso, estensioni));
    else if (estensioni.some((e) => voce.endsWith(e))) risultato.push(percorso.split('\\').join('/'));
  }
  return risultato;
}

// ---- Service worker ----

const elencoSw = () => [...leggi('sw.js').matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);

test('sw.js: ogni file in elenco esiste', () => {
  for (const file of elencoSw()) {
    if (file === './') continue;
    assert.ok(existsSync(join(radice, file)), `manca il file ${file}`);
  }
});

test('sw.js: tutti i file dell\'app sono in elenco (offline completo)', () => {
  const inElenco = new Set(elencoSw());
  const necessari = [
    'index.html', 'manifest.webmanifest',
    ...elencaFile('css', ['.css']),
    ...elencaFile('js', ['.js']),
    'vendor/lucide/icone.js', 'vendor/lucide/tag.js',
    ...elencaFile('icons', ['.png', '.svg']),
  ];
  for (const file of necessari) assert.ok(inElenco.has(file), `${file} non è nella cache offline di sw.js`);
});

test('sw.js: stessa versione di js/versione.js e cache con prefisso univoco', () => {
  const sw = leggi('sw.js');
  assert.equal(sw.match(/const VERSIONE = '([^']+)'/)[1], VERSIONE_APP);
  assert.match(sw, /PREFISSO_CACHE = 'spese2-'/);
});

test('manifest: scope e start_url relativi (mai l\'intera origine condivisa), icone esistenti', () => {
  const manifest = JSON.parse(leggi('manifest.webmanifest'));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  for (const icona of manifest.icons) assert.ok(existsSync(join(radice, icona.src)), `manca ${icona.src}`);
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
});

// ---- Prefissi univoci (origine condivisa) ----

test('chiavi di localStorage e nome del database hanno il prefisso spese2_', () => {
  const sorgenti = [...elencaFile('js', ['.js']), 'index.html'].map(leggi).join('\n');
  const chiavi = [...sorgenti.matchAll(/(?:getItem|setItem)\(\s*(?:'([^']+)'|(\w+))/g)];
  assert.ok(chiavi.length > 0);
  assert.match(leggi('js/db.js'), /NOME_DB = 'spese2_db'/);
  assert.match(leggi('js/model/impostazioni.js'), /CHIAVE_TEMA = 'spese2_tema'/);
  assert.match(leggi('index.html'), /getItem\('spese2_tema'\)/);
});

// ---- Palette e seed ----

test('ogni colore della palette ha token e classe CSS', () => {
  const tokens = leggi('css/tokens.css');
  const componenti = leggi('css/components.css');
  for (const colore of COLORI_CATEGORIA) {
    assert.match(tokens, new RegExp(`--cat-${colore}:`), `manca --cat-${colore} in tokens.css`);
    assert.match(componenti, new RegExp(`\\.col-${colore} \\{ --c: var\\(--cat-${colore}\\); \\}`), `manca .col-${colore}`);
  }
});

test('seed: id unici, icone Lucide esistenti, colori in palette', () => {
  const tutti = [...CATEGORIE_INIZIALI, ...CONTI_INIZIALI];
  assert.equal(new Set(tutti.map((x) => x.id)).size, tutti.length, 'id duplicati');
  for (const x of tutti) {
    assert.ok(x.icona in ICONE, `icona "${x.icona}" non presente in vendor/lucide/icone.js (${x.nome})`);
    assert.ok(COLORI_CATEGORIA.includes(x.colore), `colore "${x.colore}" non in palette (${x.nome})`);
  }
});

test('seed: categorie e conti attesi', () => {
  assert.equal(CATEGORIE_INIZIALI.filter((c) => c.tipo === 'spesa').length, 12);
  assert.equal(CATEGORIE_INIZIALI.filter((c) => c.tipo === 'entrata').length, 5);
  assert.equal(CATEGORIE_INIZIALI.filter((c) => c.ruolo === 'stipendio').length, 1);
  assert.deepEqual(CONTI_INIZIALI.map((c) => c.nome),
    ['Conto principale', 'Conto secondario', 'Conto investimenti', 'Investito', 'Contanti']);
  assert.ok(CONTI_INIZIALI.some((c) => c.id === PREDEFINITE.contoPredefinito), 'conto predefinito inesistente');
  assert.ok(CONTI_INIZIALI.some((c) => c.tipo === 'investimenti'));
});

// ---- Regole del progetto ----

test('nessuna emoji nell\'interfaccia (solo icone Lucide)', () => {
  const file = [...elencaFile('js', ['.js']), ...elencaFile('css', ['.css']), 'index.html'];
  for (const f of file) {
    const trovata = leggi(f).match(/\p{Extended_Pictographic}/u);
    assert.ok(!trovata, `emoji "${trovata?.[0]}" in ${relative(radice, join(radice, f))}`);
  }
});

test('.gitignore esclude la cartella privata e i backup', () => {
  const gitignore = leggi('.gitignore');
  assert.match(gitignore, /^_privato\/$/m);
  assert.match(gitignore, /^spese-backup-\*\.json$/m);
});

test('ogni file JavaScript dell\'app ha una sintassi valida (un errore qui bloccherebbe l\'intera app)', () => {
  const elenco = [];
  const visita = (cartella) => {
    for (const nome of readdirSync(cartella)) {
      const percorso = join(cartella, nome);
      if (statSync(percorso).isDirectory()) visita(percorso);
      else if (nome.endsWith('.js')) elenco.push(percorso);
    }
  };
  visita(join(radice, 'js'));
  elenco.push(join(radice, 'sw.js'));
  for (const file of elenco) {
    const esito = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(esito.status, 0, `${relative(radice, file)}: ${esito.stderr.split('\n').slice(0, 4).join(' | ')}`);
  }
});
