// Service worker di Wallet: rende l'app disponibile offline.
//
// SCOPE: il file sta nella cartella dell'app (es. /spese2/sw.js), quindi controlla SOLO quel percorso.
// L'origine therealwab.github.io è condivisa con altre app: non vanno toccate le loro cache,
// per questo le nostre hanno il prefisso "spese2-" e ne cancelliamo solo di quel tipo.

// Va tenuta uguale a VERSIONE_APP in js/versione.js (lo verifica un test).
// Cambiarla a ogni rilascio: cambia il nome della cache e i file vengono riscaricati.
const VERSIONE = '2.0.0';
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
  'css/flusso.css',
  'css/importa.css',
  'css/viste.css',
  'css/blocco.css',
  'css/categorie.css',
  'css/patrimonio.css',
  'css/grafici.css',
  'css/ricorrenti.css',
  'css/profilo.css',
  'js/app.js',
  'js/db.js',
  'js/versione.js',
  'js/util/animazione.js',
  'js/util/immagine.js',
  'js/util/marchio.js',
  'js/util/sfondo-app.js',
  'js/util/swipe.js',
  'js/util/scarica.js',
  'js/util/date.js',
  'js/util/dom.js',
  'js/util/formato.js',
  'js/util/importi-privati.js',
  'js/util/icone.js',
  'js/util/id.js',
  'js/model/azzera.js',
  'js/model/aspetto.js',
  'js/model/backup.js',
  'js/model/backup-db.js',
  'js/model/calcoli.js',
  'js/model/catalogo.js',
  'js/model/categorie.js',
  'js/model/categorie-db.js',
  'js/model/conti.js',
  'js/model/importa-vecchia.js',
  'js/model/importazione.js',
  'js/model/blocco.js',
  'js/model/conti-db.js',
  'js/model/file-backup.js',
  'js/model/grafici.js',
  'js/model/impostazioni.js',
  'js/model/impronta.js',
  'js/model/movimenti.js',
  'js/model/note.js',
  'js/model/note-db.js',
  'js/model/palette.js',
  'js/model/patrimonio.js',
  'js/model/parole-icone.js',
  'js/model/periodi.js',
  'js/model/ricerca-icone.js',
  'js/model/ricorrenti.js',
  'js/model/ricorrenti-db.js',
  'js/model/seed.js',
  'js/model/sicurezza.js',
  'js/views/altro.js',
  'js/views/categorie.js',
  'js/views/grafici.js',
  'js/views/mese.js',
  'js/views/patrimonio.js',
  'js/components/aggiornamento.js',
  'js/components/avatar.js',
  'js/components/editor-profilo.js',
  'js/components/scegli-sfondo.js',
  'js/components/gestione-note.js',
  'js/components/importa-guidata.js',
  'js/components/aggiorna-valore.js',
  'js/components/backup-esporta.js',
  'js/components/blocco.js',
  'js/components/backup-ripristina.js',
  'js/components/ciambella.js',
  'js/components/dettaglio-categoria.js',
  'js/components/dettaglio-conto.js',
  'js/components/editor-categoria.js',
  'js/components/editor-ricorrente.js',
  'js/components/editor-conto.js',
  'js/components/gestione-categorie.js',
  'js/components/gestione-conti.js',
  'js/components/grafico-andamento.js',
  'js/components/grafico-barre.js',
  'js/components/inserimento.js',
  'js/components/pannello.js',
  'js/components/riga-movimento.js',
  'js/components/ricorrenti-elenco.js',
  'js/components/schede-ricorrenti.js',
  'js/components/selettore-icona.js',
  'js/components/selettore-periodo.js',
  'js/components/selettori.js',
  'js/components/sicurezza-ui.js',
  'js/components/tastierino.js',
  'js/components/tastierino-pin.js',
  'js/components/toast.js',
  'vendor/lucide/icone.js',
  'vendor/lucide/tag.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

// In sviluppo (localhost) si preferisce la rete, così le modifiche si vedono subito; offline vale la cache.
const SVILUPPO = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

self.addEventListener('install', (evento) => {
  // La nuova versione NON si attiva da sola: resta "in attesa" finché l'utente, dall'avviso dell'app,
  // sceglie "Aggiorna" (messaggio 'attiva' qui sotto).
  // cache: 'reload' salta la cache HTTP di GitHub Pages (max-age=600): senza, per ~10 minuti dopo una
  // pubblicazione la nuova cache potrebbe riempirsi di file vecchi.
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILE.map((file) => new Request(file, { cache: 'reload' })));
  })());
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
  if (evento.data?.tipo === 'versione') evento.ports[0]?.postMessage(VERSIONE); // per scriverla nell'avviso di aggiornamento
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
