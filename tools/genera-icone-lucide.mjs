// Genera i file delle icone Lucide a partire dal pacchetto npm `lucide-static` (licenza ISC).
//
//   npm pack lucide-static --ignore-scripts      (scarica il pacchetto)
//   tar -xzf lucide-static-*.tgz                 (crea la cartella "package")
//   node tools/genera-icone-lucide.mjs <cartella-package>
//
// Scrive:
//   vendor/lucide/icone.js  tutte le icone (nome → markup interno dell'SVG, viewBox 24x24)
//   vendor/lucide/tag.js    nome → parole chiave inglesi (servono alla ricerca delle icone)

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pacchetto = process.argv[2];
if (!pacchetto) {
  console.error('Uso: node tools/genera-icone-lucide.mjs <cartella-del-pacchetto-lucide-static>');
  process.exit(1);
}

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const versione = JSON.parse(readFileSync(join(pacchetto, 'package.json'), 'utf8')).version;
const cartellaIcone = join(pacchetto, 'icons');

const interno = (svg) => svg
  .slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
  .replace(/\s*\/>/g, '/>')
  .replace(/>\s+</g, '><')
  .trim();

const icone = {};
for (const file of readdirSync(cartellaIcone).filter((f) => f.endsWith('.svg')).sort()) {
  icone[file.slice(0, -4)] = interno(readFileSync(join(cartellaIcone, file), 'utf8'));
}

const intestazione = (cosa) => `// ${cosa} Lucide (https://lucide.dev) v${versione} — licenza ISC, vedi LICENSE in questa cartella.
// File GENERATO da tools/genera-icone-lucide.mjs: non modificarlo a mano.
`;

const righe = Object.entries(icone).map(([nome, markup]) => `  ${JSON.stringify(nome)}: ${JSON.stringify(markup)},`);
writeFileSync(join(radice, 'vendor/lucide/icone.js'),
  `${intestazione('Icone')}export const ICONE = {\n${righe.join('\n')}\n};\n`);

const tagOriginali = JSON.parse(readFileSync(join(pacchetto, 'tags.json'), 'utf8'));
const tag = {};
for (const nome of Object.keys(icone)) {
  const parole = [...new Set((tagOriginali[nome] ?? []).map((t) => t.toLowerCase()))];
  if (parole.length) tag[nome] = parole.join(' ');
}
const righeTag = Object.entries(tag).map(([nome, parole]) => `  ${JSON.stringify(nome)}: ${JSON.stringify(parole)},`);
writeFileSync(join(radice, 'vendor/lucide/tag.js'),
  `${intestazione('Parole chiave delle icone')}export const TAG = {\n${righeTag.join('\n')}\n};\n`);

console.log(`Lucide ${versione}: ${Object.keys(icone).length} icone, ${Object.keys(tag).length} con parole chiave.`);
