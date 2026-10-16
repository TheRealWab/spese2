// Genera le icone PNG della PWA (192, 512, maskable 512) senza librerie: un piccolo rasterizzatore
// con antialiasing e un codificatore PNG. Uso:  node tools/genera-icone-pwa.mjs
// Il disegno è originale: una W che sale (con la punta di una freccia) su sfondo indaco.

import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cartellaIcone = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(cartellaIcone, { recursive: true });

// Disegno su una griglia 96x96: linee con estremi arrotondati.
// La W è la lettera del creatore e allo stesso tempo l'andamento di un grafico che sale.
const GRIGLIA = 96;
const TRATTI = [
  { spessore: 9, punti: [[17, 38], [31, 70], [45, 44], [59, 70], [77, 27]] }, // la W
  { spessore: 7, punti: [[66, 24], [79, 24], [79, 37]] }, // la punta della freccia
];

// Sfondo: gradiente diagonale indaco.
const COLORE_A = [99, 102, 241];
const COLORE_B = [67, 56, 202];

function dentroRettArrotondato(x, y, cx, cy, mezzaL, mezzaA, raggio) {
  const dx = Math.abs(x - cx) - (mezzaL - raggio);
  const dy = Math.abs(y - cy) - (mezzaA - raggio);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) <= raggio;
}

function distanzaDalSegmento(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function sulTratto(x, y) {
  const px = x * GRIGLIA;
  const py = y * GRIGLIA;
  return TRATTI.some(({ spessore, punti }) => punti.slice(1).some((p, i) => distanzaDalSegmento(px, py, punti[i], p) <= spessore / 2));
}

function colorePixel(x, y, { raggioSfondo, scala = 1 }) {
  // Sfondo (trasparente fuori dal rettangolo arrotondato; pieno per le maskable)
  const sfondo = raggioSfondo === 0
    ? true
    : dentroRettArrotondato(x, y, 0.5, 0.5, 0.5, 0.5, raggioSfondo);
  if (!sfondo) return [0, 0, 0, 0];
  // Il disegno si rimpicciolisce attorno al centro per stare nell'area sicura delle icone "maskable" (cerchio r=0.4).
  if (sulTratto((x - 0.5) / scala + 0.5, (y - 0.5) / scala + 0.5)) return [255, 255, 255, 255];
  const t = (x + y) / 2;
  return COLORE_A.map((c, i) => Math.round(c + (COLORE_B[i] - c) * t)).concat(255);
}

function disegna(dimensione, opzioni) {
  const campioni = 3; // supersampling 3×3
  const righe = [];
  for (let py = 0; py < dimensione; py += 1) {
    const riga = Buffer.alloc(1 + dimensione * 4); // primo byte = filtro PNG 0
    for (let px = 0; px < dimensione; px += 1) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < campioni; sy += 1) {
        for (let sx = 0; sx < campioni; sx += 1) {
          const [cr, cg, cb, ca] = colorePixel((px + (sx + 0.5) / campioni) / dimensione, (py + (sy + 0.5) / campioni) / dimensione, opzioni);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const n = campioni * campioni;
      const o = 1 + px * 4;
      riga[o] = a ? Math.round(r / a) : 0;
      riga[o + 1] = a ? Math.round(g / a) : 0;
      riga[o + 2] = a ? Math.round(b / a) : 0;
      riga[o + 3] = Math.round(a / n);
    }
    righe.push(riga);
  }
  return codificaPng(dimensione, Buffer.concat(righe));
}

function blocco(tipo, dati) {
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo) >>> 0);
  return Buffer.concat([lunghezza, corpo, crc]);
}

function codificaPng(dimensione, pixel) {
  const testata = Buffer.alloc(13);
  testata.writeUInt32BE(dimensione, 0);
  testata.writeUInt32BE(dimensione, 4);
  testata[8] = 8; // 8 bit per canale
  testata[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco('IHDR', testata),
    blocco('IDAT', deflateSync(pixel, { level: 9 })),
    blocco('IEND', Buffer.alloc(0)),
  ]);
}

const icone = [
  ['icon-192.png', 192, { raggioSfondo: 0.22 }],
  ['icon-512.png', 512, { raggioSfondo: 0.22 }],
  ['icon-maskable-512.png', 512, { raggioSfondo: 0, scala: 0.8 }],
];
for (const [nome, dimensione, opzioni] of icone) {
  writeFileSync(join(cartellaIcone, nome), disegna(dimensione, opzioni));
  console.log(`${nome} (${dimensione}×${dimensione})`);
}

// Versione vettoriale, usata come favicon.
const tratti = TRATTI.map(({ spessore, punti }) => {
  const elenco = punti.map(([x, y]) => `${x},${y}`).join(' ');
  return `<polyline points="${elenco}" fill="none" stroke="#fff" stroke-width="${spessore}" stroke-linecap="round" stroke-linejoin="round"/>`;
}).join('');
writeFileSync(join(cartellaIcone, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${COLORE_A})"/><stop offset="1" stop-color="rgb(${COLORE_B})"/></linearGradient></defs>
<rect width="96" height="96" rx="21" fill="url(#g)"/>${tratti}</svg>
`);
console.log('icon.svg');
