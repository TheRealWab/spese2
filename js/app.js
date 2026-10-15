// Avvio dell'app: database, dati iniziali, tema, navigazione tra le cinque aree, service worker.

import { apriDb } from './db.js';
import { eseguiSeedSeServe } from './model/seed.js';
import { caricaImpostazioni, impostazioni, applicaTema, seguiTemaDiSistema } from './model/impostazioni.js';
import { caricaCatalogo } from './model/catalogo.js';
import { oggiIso } from './util/date.js';
import { icona } from './util/icone.js';
import { esc } from './util/dom.js';
import { apriInserimento } from './components/inserimento.js';
import { impostaGestoreIndietro } from './components/pannello.js';
import { mostraToast } from './components/toast.js';
import { inizializzaBlocco, controllaBlocco } from './components/blocco.js';
import { VERSIONE_APP } from './versione.js';
import * as mese from './views/mese.js';
import * as altro from './views/altro.js';
import * as categorie from './views/categorie.js';
import { creaVistaSegnaposto } from './views/segnaposto.js';

const grafici = creaVistaSegnaposto({
  titolo: 'Grafici',
  icona: 'chart-pie',
  colore: 'indaco',
  domanda: 'Dove sono finiti i soldi?',
  punti: ['Ciambella per categoria, con importi e percentuali', 'Confronto con il periodo precedente', 'Entrate, spese e risparmio nel tempo'],
});
const patrimonio = creaVistaSegnaposto({
  titolo: 'Patrimonio',
  icona: 'landmark',
  colore: 'smeraldo',
  domanda: 'Quanto vale tutto, e come cresce?',
  punti: ['Saldo di ogni conto', 'Investimenti: versato, valore e guadagno', 'Andamento del patrimonio nel tempo'],
});

const ROTTE = [
  { id: 'mese', etichetta: 'Mese', icona: 'calendar-days', vista: mese },
  { id: 'grafici', etichetta: 'Grafici', icona: 'chart-no-axes-column', vista: grafici },
  { id: 'patrimonio', etichetta: 'Patrimonio', icona: 'landmark', vista: patrimonio },
  { id: 'categorie', etichetta: 'Categorie', icona: 'layout-grid', vista: categorie },
  { id: 'altro', etichetta: 'Altro', icona: 'ellipsis', vista: altro },
];

const vista = document.getElementById('vista');
let rottaCorrente = null;
let istanza = null;

const rottaDaHash = () => ROTTE.find((r) => r.id === location.hash.replace(/^#\/?/, '')) ?? ROTTE[0];

function costruisciNavigazione() {
  document.getElementById('nav').innerHTML = ROTTE.map((r) => `
    <button type="button" class="nav-voce" data-rotta="${r.id}">
      <span class="nav-pillola">${icona(r.icona, 22)}</span><span class="nav-etichetta">${r.etichetta}</span>
    </button>`).join('');
  document.getElementById('nav').addEventListener('click', (e) => {
    const id = e.target.closest('[data-rotta]')?.dataset.rotta;
    if (id) naviga(id);
  });
  document.getElementById('fab').innerHTML = icona('plus', 28);
  document.getElementById('fab').addEventListener('click', () => apriInserimento());
}

/** Cambio d'area chiesto dall'utente (tocco sulla barra): aggiorna la cronologia e la schermata. */
/**
 * La barra in basso resta ferma ma si compatta (solo icone) quando si scorre verso il basso e si riespande
 * (icone e nomi) quando si risale o si torna in cima. Il pulsante + la segue.
 */
function inizializzaBarra() {
  const SOGLIA_CIMA = 24; // sotto questa posizione la barra è sempre estesa
  const SCATTO = 10; // quanto si deve scorrere prima di cambiare stato (evita sfarfallii)
  let ultimaY = window.scrollY;
  let inAttesa = false;
  const imposta = (compatta) => { document.documentElement.dataset.nav = compatta ? 'compatta' : 'estesa'; };
  window.addEventListener('scroll', () => {
    if (inAttesa) return;
    inAttesa = true;
    requestAnimationFrame(() => {
      inAttesa = false;
      const y = window.scrollY;
      const dy = y - ultimaY;
      if (y < SOGLIA_CIMA) imposta(false);
      else if (dy > SCATTO) imposta(true);
      else if (dy < -SCATTO) imposta(false);
      if (Math.abs(dy) > SCATTO || y < SOGLIA_CIMA) ultimaY = y;
    });
  }, { passive: true });
}

function naviga(id) {
  const rotta = ROTTE.find((r) => r.id === id) ?? ROTTE[0];
  if (rotta === rottaCorrente) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  aggiornaCronologia(rotta);
  mostra(rotta);
}

/**
 * Cronologia: base (Mese) → app (Mese) → area (un'altra area). Mese è sempre la voce sotto le altre aree,
 * così "indietro" da un'area ci torna da solo. Qui si fanno push SOLO dentro un tocco (vedi preparaCronologia).
 */
function aggiornaCronologia(rotta) {
  const tipo = history.state?.spese2;
  const url = `#/${rotta.id}`;
  if (rotta.id === 'mese') {
    if (tipo === 'area') history.back(); // torna alla voce Mese che sta sotto
    else history.replaceState(history.state, '', url);
  } else if (tipo === 'app') {
    history.pushState({ spese2: 'area' }, '', url);
  } else {
    history.replaceState(history.state, '', url);
  }
}

/** Disegna un'area senza toccare la cronologia. */
function mostra(rotta) {
  if (rotta === rottaCorrente) return;
  const contenitore = document.createElement('div');
  contenitore.className = 'vista-entra';
  vista.replaceChildren(contenitore);
  istanza = rotta.vista.monta(contenitore) ?? {};
  rottaCorrente = rotta;

  document.querySelectorAll('.nav-voce').forEach((b) => {
    if (b.dataset.rotta === rotta.id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

// ---- Tasto indietro ----
// La cronologia ha tre livelli: base (Mese) → app (Mese) → area (un'altra area). Mese sta sempre sotto
// le altre aree, quindi "indietro" da un'area ci torna da solo. Da Mese si arriva sulla voce di base:
// qui compare l'avviso e la pagina RESTA lì, così un secondo "indietro" esce dall'app in modo nativo.
//
// REGOLA D'ORO: push solo dentro un tocco. Chrome (Android) salta col tasto indietro le voci su cui la
// pagina fa pushState senza azione dell'utente ("history manipulation intervention"): un push dentro
// l'evento popstate faceva saltare la voce di base e il secondo "indietro" usciva senza avviso.

const MESSAGGIO_USCITA = 'Premi ancora il tasto indietro per uscire dall\'app';

// Dopo una ricarica la cronologia c'è già se la voce corrente è una delle nostre (app/area/base) o di un pannello.
let cronologiaPronta = false;

/** A ogni tocco: se la cronologia non è pronta (primo tocco) o siamo rimasti sulla base (dopo l'avviso), la ripristina. */
function preparaCronologia() {
  const tipo = history.state?.spese2;
  if (tipo === 'base') {
    history.pushState({ spese2: 'app' }, '', '#/mese'); // l'utente è rimasto: si risale sopra la base
    cronologiaPronta = true;
    return;
  }
  // Con un pannello aperto lo stato è { pannello }, non { spese2 }: senza questo segno ogni tocco dentro
  // un pannello rifarebbe la cronologia da capo.
  if (cronologiaPronta || tipo || history.state?.pannello !== undefined) { cronologiaPronta = true; return; }
  cronologiaPronta = true;
  const area = rottaCorrente?.id ?? 'mese';
  history.replaceState({ spese2: 'base' }, '', '#/mese');
  history.pushState({ spese2: 'app' }, '', '#/mese');
  if (area !== 'mese') history.pushState({ spese2: 'area' }, '', `#/${area}`);
}

/** Chiamata dal gestore unico di popstate quando "indietro" non riguarda un pannello. */
function suCronologia() {
  const tipo = history.state?.spese2;
  if (tipo === 'base') {
    mostra(ROTTE[0]);
    mostraToast(MESSAGGIO_USCITA, { durata: 5000 }); // niente push qui: resta sulla base
    return;
  }
  mostra(rottaDaHash()); // app o area: la schermata segue la voce raggiunta
}

function mostraErrore(errore) {
  console.error(errore);
  vista.innerHTML = `
    <div class="scheda stato-vuoto" role="alert">
      <h2>Non riesco ad aprire i dati</h2>
      <p>Il database del browser non è disponibile. Succede, ad esempio, in navigazione privata.</p>
      <p class="riga-sotto">${esc(errore?.message ?? '')}</p>
      <button type="button" class="pulsante" onclick="location.reload()">Riprova</button>
    </div>`;
}

const CHIAVE_AGGIORNATA = 'spese2_aggiornata';

/** Ricarica l'app per applicare l'aggiornamento, ma mai mentre si sta compilando un movimento. */
function ricaricaQuandoLibero() {
  const pannelloAperto = () => document.querySelector('.pannello-sfondo') !== null;
  const ricarica = () => {
    try { sessionStorage.setItem(CHIAVE_AGGIORNATA, '1'); } catch { /* facoltativo: serve solo al messaggio */ }
    location.reload();
  };
  if (!pannelloAperto()) { ricarica(); return; }
  const attesa = setInterval(() => {
    if (pannelloAperto()) return;
    clearInterval(attesa);
    ricarica();
  }, 1000);
}

function avvisaSeAggiornata() {
  try {
    if (sessionStorage.getItem(CHIAVE_AGGIORNATA) !== '1') return;
    sessionStorage.removeItem(CHIAVE_AGGIORNATA);
    mostraToast(`App aggiornata alla versione ${VERSIONE_APP}`);
  } catch { /* storage non disponibile */ }
}

async function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const avevaControllo = Boolean(navigator.serviceWorker.controller);
  try {
    // Nessun "scope" esplicito: è la cartella dell'app (es. /spese2/), mai l'intera origine condivisa.
    const registrazione = await navigator.serviceWorker.register('./sw.js');

    // Aggiornamento automatico: il nuovo service worker si attiva da solo (skipWaiting in sw.js) e,
    // quando prende il controllo, la pagina si ricarica per usare i file nuovi.
    let ricaricato = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!avevaControllo || ricaricato) return; // la prima installazione non deve ricaricare la pagina
      ricaricato = true;
      ricaricaQuandoLibero();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registrazione.update().catch(() => {});
    });
  } catch (errore) {
    console.warn('Service worker non registrato:', errore);
  }
}

async function avvia() {
  try {
    await apriDb();
    await eseguiSeedSeServe(oggiIso());
    await caricaImpostazioni();
    await caricaCatalogo();
  } catch (errore) {
    mostraErrore(errore);
    return;
  }

  applicaTema(impostazioni().tema);
  seguiTemaDiSistema();
  costruisciNavigazione();
  inizializzaBarra();
  inizializzaBlocco();
  controllaBlocco(); // con il blocco attivo, copre subito tutto: i dati non restano visibili
  impostaGestoreIndietro(suCronologia);
  const rottaIniziale = rottaDaHash();
  mostra(rottaIniziale);
  history.replaceState(history.state, '', `#/${rottaIniziale.id}`);
  // click e tasti (non Esc) sono azioni "vere" per Chrome: solo lì si può modificare la cronologia.
  window.addEventListener('click', preparaCronologia, true);
  window.addEventListener('keydown', (e) => { if (e.key !== 'Escape') preparaCronologia(); }, true);
  avvisaSeAggiornata();

  document.addEventListener('spese2:movimenti', (e) => istanza?.aggiorna?.({ evento: 'movimenti', ...e.detail }));
  document.addEventListener('spese2:impostazioni', (e) => istanza?.aggiorna?.({ evento: 'impostazioni', ...e.detail }));
  document.addEventListener('spese2:categorie', (e) => istanza?.aggiorna?.({ evento: 'categorie', ...e.detail }));
  // Tornando all'app dopo ore (o a mezzanotte passata) "Oggi" e i totali vanno riletti.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') istanza?.aggiorna?.({ evento: 'visibile' });
  });

  navigator.storage?.persist?.().catch(() => {}); // chiede al browser di non cancellare i dati se serve spazio
  registraServiceWorker();
}

avvia();
