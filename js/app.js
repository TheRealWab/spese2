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
import * as mese from './views/mese.js';
import * as altro from './views/altro.js';
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
const categorie = creaVistaSegnaposto({
  titolo: 'Categorie',
  icona: 'layout-grid',
  colore: 'arancio',
  domanda: 'Su cosa spendi, nel dettaglio?',
  punti: ['Totale per categoria nel periodo', 'Scomposizione per nota (es. Panificio e Supermercato)', 'Icone, colori e ordine a tuo piacere'],
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
      <span class="nav-pillola">${icona(r.icona, 22)}</span>${r.etichetta}
    </button>`).join('');
  document.getElementById('nav').addEventListener('click', (e) => {
    const id = e.target.closest('[data-rotta]')?.dataset.rotta;
    if (id) naviga(id);
  });
  document.getElementById('fab').innerHTML = icona('plus', 28);
  document.getElementById('fab').addEventListener('click', () => apriInserimento());
}

function naviga(id) {
  const rotta = ROTTE.find((r) => r.id === id) ?? ROTTE[0];
  if (rotta === rottaCorrente) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const contenitore = document.createElement('div');
  contenitore.className = 'vista-entra';
  vista.replaceChildren(contenitore);
  istanza = rotta.vista.monta(contenitore) ?? {};
  rottaCorrente = rotta;

  document.querySelectorAll('.nav-voce').forEach((b) => {
    if (b.dataset.rotta === rotta.id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  // replaceState: cambiare area non riempie la cronologia (il tasto indietro è gestito da gestisciIndietro).
  history.replaceState({ spese2: 'app' }, '', `#/${rotta.id}`);
  window.scrollTo(0, 0);
}

// ---- Tasto indietro ----
// Nella cronologia teniamo due voci: una "guardia" sotto e quella dell'app sopra. Premendo indietro
// si arriva sulla guardia, dove decidiamo noi: da un'area diversa da Mese si torna a Mese; da Mese
// la prima volta si avvisa, la seconda (entro pochi secondi) si esce davvero.

const FINESTRA_USCITA_MS = 2500;
let uscitaPronta = false;
let timerUscita = null;

function preparaCronologia() {
  if (history.state?.spese2 === 'app') return; // ricarica della pagina: la guardia c'è già sotto
  history.replaceState({ spese2: 'guardia' }, '', '#/mese');
  history.pushState({ spese2: 'app' }, '');
}

function gestisciIndietro() {
  if (history.state?.spese2 !== 'guardia') return; // non è il nostro "indietro" (es. cambio di indirizzo a mano)

  if (uscitaPronta) {
    clearTimeout(timerUscita);
    uscitaPronta = false;
    history.back(); // secondo "indietro" ravvicinato: si esce dall'app
    return;
  }

  history.pushState({ spese2: 'app' }, '', `#/${rottaCorrente?.id ?? 'mese'}`); // risale sopra la guardia
  if (rottaCorrente?.id !== 'mese') {
    naviga('mese');
    return;
  }
  mostraToast('Premi ancora il tasto indietro per uscire dall\'app', { durata: FINESTRA_USCITA_MS });
  uscitaPronta = true;
  timerUscita = setTimeout(() => { uscitaPronta = false; }, FINESTRA_USCITA_MS);
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

async function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const avevaControllo = Boolean(navigator.serviceWorker.controller);
  try {
    // Nessun "scope" esplicito: è la cartella dell'app (es. /spese2/), mai l'intera origine condivisa.
    const registrazione = await navigator.serviceWorker.register('./sw.js');

    const proponiAggiornamento = (worker) => mostraToast('Nuova versione disponibile', {
      durata: 0,
      azione: { etichetta: 'Aggiorna', alClick: () => worker.postMessage({ tipo: 'attiva' }) },
    });
    if (registrazione.waiting && avevaControllo) proponiAggiornamento(registrazione.waiting);
    registrazione.addEventListener('updatefound', () => {
      const nuovo = registrazione.installing;
      nuovo?.addEventListener('statechange', () => {
        if (nuovo.state === 'installed' && navigator.serviceWorker.controller) proponiAggiornamento(nuovo);
      });
    });

    let ricaricato = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!avevaControllo || ricaricato) return; // la prima installazione non deve ricaricare la pagina
      ricaricato = true;
      location.reload();
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
  const rottaIniziale = rottaDaHash().id; // da leggere prima che preparaCronologia tocchi l'indirizzo
  preparaCronologia();
  impostaGestoreIndietro(gestisciIndietro);
  naviga(rottaIniziale);

  window.addEventListener('hashchange', () => naviga(rottaDaHash().id));
  document.addEventListener('spese2:movimenti', (e) => istanza?.aggiorna?.({ evento: 'movimenti', ...e.detail }));
  document.addEventListener('spese2:impostazioni', (e) => istanza?.aggiorna?.({ evento: 'impostazioni', ...e.detail }));
  // Tornando all'app dopo ore (o a mezzanotte passata) "Oggi" e i totali vanno riletti.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') istanza?.aggiorna?.({ evento: 'visibile' });
  });

  navigator.storage?.persist?.().catch(() => {}); // chiede al browser di non cancellare i dati se serve spazio
  registraServiceWorker();
}

avvia();
