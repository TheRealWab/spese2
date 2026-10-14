// Server statico minimale per provare l'app in locale (nessuna dipendenza).
// Uso:  node tools/server.mjs [porta]      →  http://localhost:8080/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const radice = join(fileURLToPath(import.meta.url), '..', '..');
const porta = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (richiesta, risposta) => {
  try {
    const percorsoUrl = decodeURIComponent(new URL(richiesta.url, 'http://x').pathname);
    let file = normalize(join(radice, percorsoUrl));
    // Non servire nulla fuori dalla cartella del progetto, né la cartella privata.
    if (!file.startsWith(radice) || file.split(sep).includes('_privato')) {
      risposta.writeHead(403).end('Vietato');
      return;
    }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const dati = await readFile(file);
    risposta.writeHead(200, {
      'Content-Type': TIPI[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    risposta.end(dati);
  } catch {
    risposta.writeHead(404).end('Non trovato');
  }
}).listen(porta, () => {
  console.log(`Spese in locale:  http://localhost:${porta}/`);
  for (const lista of Object.values(networkInterfaces())) {
    for (const i of lista ?? []) if (i.family === 'IPv4' && !i.internal) console.log(`Nella rete locale: http://${i.address}:${porta}/  (da qui il service worker NON funziona: serve https o localhost)`);
  }
});
