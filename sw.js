// Service worker di Spese 2.0: rende l'app disponibile offline.
//
// SCOPE: il file sta nella cartella dell'app (es. /spese2/sw.js), quindi controlla SOLO quel percorso.
// L'origine therealwab.github.io è condivisa con altre app: non vanno toccate le loro cache,
// per questo le nostre hanno il prefisso "spese2-" e ne cancelliamo solo di quel tipo.

// Va tenuta uguale a VERSIONE_APP in js/versione.js (lo verifica un test).
// Cambiarla a ogni rilascio: cambia il nome della cache e i file vengono riscaricati.
const VERSIONE = '1.0.4';
const PREFISSO_CACHE = 'spese2-';
const CACHE = `${PREFISSO_CACHE}${VERSIONE}`;

// Tutti i file dell'app (un test verifica che l'elenco sia completo e che i file esistano).
const FILE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/base.css',
  'css/components.css',
  'css/inserimento.css',
  'css/viste.css',
  'js/app.js',
  'js/db.js',
  'js/versione.js',
  'js/util/animazione.js',
  'js/util/date.js',
  'js/util/dom.js',
  'js/util/formato.js',
  'js/util/icone.js',
  'js/util/id.js',
  'js/model/calcoli.js',
  'js/model/catalogo.js',
  'js/model/categorie.js',
  'js/model/conti.js',
  'js/model/impostazioni.js',
  'js/model/movimenti.js',
  'js/model/palette.js',
  'js/model/seed.js',
  'js/views/altro.js',
  'js/views/mese.js',
  'js/views/segnaposto.js',
  'js/components/inserimento.js',
  'js/components/pannello.js',
  'js/components/riga-movimento.js',
  'js/components/selettori.js',
  'js/components/tastierino.js',
  'js/components/toast.js',
  'vendor/lucide/icone.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

// In sviluppo (localhost) si preferisce la rete, così le modifiche si vedono subito; offline vale la cache.
const SVILUPPO = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

self.addEventListener('install', (evento) => {
  // La nuova versione si attiva subito, senza aspettare che l'app venga chiusa: la pagina aperta
  // si ricarica da sola (vedi app.js) e l'utente non deve fare nulla.
  self.skipWaiting();
  // cache: 'reload' salta la cache HTTP di GitHub Pages (max-age=600): senza, per ~10 minuti dopo una
  // pubblicazione la nuova cache potrebbe riempirsi di file vecchi.
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILE.map((file) => new Request(file, { cache: 'reload' })))));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi
      .filter((nome) => nome.startsWith(PREFISSO_CACHE) && nome !== CACHE)
      .map((nome) => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'attiva') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;
  if (new URL(richiesta.url).origin !== self.location.origin) return;
  evento.respondWith(SVILUPPO ? reteConRiserva(richiesta) : cacheConRiserva(richiesta));
});

async function cacheConRiserva(richiesta) {
  const cache = await caches.open(CACHE); // solo la nostra cache, mai quelle delle altre app
  const trovata = await cache.match(richiesta, { ignoreSearch: true });
  if (trovata) return trovata;
  try {
    return await fetch(richiesta);
  } catch (errore) {
    if (richiesta.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
    throw errore;
  }
}

async function reteConRiserva(richiesta) {
  const cache = await caches.open(CACHE);
  try {
    return await fetch(richiesta);
  } catch (errore) {
    const trovata = await cache.match(richiesta, { ignoreSearch: true });
    if (trovata) return trovata;
    if (richiesta.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
    throw errore;
  }
}
