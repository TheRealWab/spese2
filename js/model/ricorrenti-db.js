// Movimenti ricorrenti nel database (SPEC §7): crea, modifica, pausa, elimina e, soprattutto, la generazione all'apertura.
// Le regole stanno in ricorrenti.js (funzioni pure e testate); qui si leggono i dati, si applicano e si avvisano le viste.
//
// Garanzia "mai doppioni": prima di registrare una scadenza si controlla se esiste già un movimento di quel ricorrente
// per quel giorno, e ogni registrazione avanza `ultimaGenerazione` nella stessa operazione (tutto o niente).

import { tutti, leggi, salva, elimina, perChiave, applicaModifiche } from '../db.js';
import { nuovoId } from '../util/id.js';
import { oggiIso, aggiungiGiorni } from '../util/date.js';
import { normalizzaNota } from './calcoli.js';
import { validaMovimento } from './movimenti.js';
import {
  MAX_PER_APERTURA, scadenzeDovute, datiMovimento, validaRicorrente,
} from './ricorrenti.js';

/** Errore con un messaggio già pronto da mostrare all'utente. */
export class ErroreRicorrente extends Error {}

const avvisa = (azione, id) => document.dispatchEvent(new CustomEvent('spese2:ricorrenti', { detail: { azione, id } }));
const avvisaMovimenti = (azione) => document.dispatchEvent(new CustomEvent('spese2:movimenti', { detail: { azione } }));

export async function tuttiIRicorrenti() {
  return tutti('ricorrenti');
}

/** Tiene solo i campi del modello e azzera quelli che non servono alla frequenza scelta. */
function pulisci(dati) {
  const m = dati.modello;
  const trasferimento = m.tipo === 'trasferimento';
  return {
    modello: {
      tipo: m.tipo,
      importo: m.importo,
      categoriaId: trasferimento ? null : (m.categoriaId ?? null),
      contoId: m.contoId,
      contoDestinazioneId: trasferimento ? (m.contoDestinazioneId ?? null) : null,
      nota: normalizzaNota(m.nota),
    },
    frequenza: dati.frequenza,
    giornoSettimana: dati.frequenza === 'settimanale' ? dati.giornoSettimana : null,
    giornoDelMese: dati.frequenza === 'mensile' ? dati.giornoDelMese : null,
    intervallo: dati.frequenza === 'ogni_n' ? dati.intervallo : null,
    unita: dati.frequenza === 'ogni_n' ? dati.unita : null,
    dataInizio: dati.dataInizio,
    dataFine: dati.dataFine || null,
    modalita: dati.modalita,
  };
}

/**
 * Crea un ricorrente. Se la data di inizio è passata, `registraPassate` decide: true = si registrano anche le
 * scadenze passate (alla prossima elaborazione), false = si parte da oggi.
 */
export async function creaRicorrente(dati, { registraPassate = true } = {}) {
  const oggi = oggiIso();
  const r = { id: nuovoId(), ...pulisci(dati), attivo: true, ultimaGenerazione: dati.ultimaGenerazione ?? null };
  if (!registraPassate && r.dataInizio < oggi) r.ultimaGenerazione = aggiungiGiorni(oggi, -1);
  const errore = validaRicorrente(r);
  if (errore) throw new ErroreRicorrente(errore);
  await salva('ricorrenti', r);
  avvisa('creato', r.id);
  return r;
}

/** Modifica un ricorrente. Le scadenze già chiuse restano chiuse (ultimaGenerazione non torna indietro). */
export async function aggiornaRicorrente(id, dati) {
  const attuale = await leggi('ricorrenti', id);
  if (!attuale) throw new ErroreRicorrente('Il ricorrente non esiste più.');
  const r = { ...attuale, ...pulisci(dati) };
  const errore = validaRicorrente(r);
  if (errore) throw new ErroreRicorrente(errore);
  await salva('ricorrenti', r);
  avvisa('modificato', id);
  return r;
}

/** Pausa o ripresa. Alla ripresa si riparte da oggi: il periodo in pausa non si recupera. */
export async function impostaAttivo(id, attivo) {
  const attuale = await leggi('ricorrenti', id);
  if (!attuale) throw new ErroreRicorrente('Il ricorrente non esiste più.');
  const ieri = aggiungiGiorni(oggiIso(), -1);
  const ultima = attivo && (!attuale.ultimaGenerazione || attuale.ultimaGenerazione < ieri) ? ieri : attuale.ultimaGenerazione;
  const r = { ...attuale, attivo, ultimaGenerazione: ultima };
  await salva('ricorrenti', r);
  avvisa(attivo ? 'ripreso' : 'in-pausa', id);
  return r;
}

/** Elimina il ricorrente; i movimenti già registrati restano dove sono. */
export async function eliminaRicorrente(id) {
  await elimina('ricorrenti', id);
  avvisa('eliminato', id);
}

// ---- Generazione ----

function costruisciMovimento(r, data, importo) {
  const ora = new Date().toISOString();
  const m = { id: nuovoId(), ...datiMovimento(r, data, importo), creatoIl: ora, modificatoIl: ora };
  return { movimento: m, errore: validaMovimento(m) };
}

/**
 * Da chiamare all'apertura dell'app. Per ogni ricorrente attivo chiude le scadenze dovute fino a oggi:
 * - "automatico": registra il movimento;
 * - "conferma": non registra nulla, le elenca in `inAttesa` (nell'ordine) perché l'utente decida.
 * Le scadenze che hanno già un movimento (per esempio dopo un ripristino) si chiudono senza duplicarlo.
 * Restituisce { registrati, inAttesa: [{ ricorrenteId, data }], problemi: [{ nome, motivo }], altre }.
 */
export async function elaboraRicorrenti(oggi = oggiIso()) {
  const attivi = (await tutti('ricorrenti')).filter((r) => r.attivo);
  const esito = { registrati: 0, inAttesa: [], problemi: [], altre: false };

  for (const r of attivi) {
    const { date, altre } = scadenzeDovute(r, oggi, MAX_PER_APERTURA);
    if (!date.length) continue;
    if (altre) esito.altre = true;
    const giaRegistrate = new Set((await perChiave('movimenti', 'ricorrenteId', r.id)).map((m) => m.data));

    const nuovi = [];
    let ultima = r.ultimaGenerazione;
    for (let i = 0; i < date.length; i += 1) {
      const data = date[i];
      if (giaRegistrate.has(data)) { ultima = data; continue; }
      if (r.modalita === 'conferma') {
        // Da qui in poi decide l'utente: si elencano questa e le successive non ancora registrate.
        for (const dopo of date.slice(i)) if (!giaRegistrate.has(dopo)) esito.inAttesa.push({ ricorrenteId: r.id, data: dopo });
        break;
      }
      const { movimento, errore } = costruisciMovimento(r, data);
      if (errore) esito.problemi.push({ nome: r.modello.nota || 'Movimento ricorrente', motivo: errore });
      else nuovi.push(movimento);
      ultima = data; // anche se non registrabile si va avanti: non deve riprovare a ogni apertura
    }

    if (nuovi.length || ultima !== r.ultimaGenerazione) {
      await applicaModifiche({ salva: { movimenti: nuovi, ricorrenti: [{ ...r, ultimaGenerazione: ultima }] } });
      esito.registrati += nuovi.length;
    }
  }
  if (esito.registrati) avvisaMovimenti('ricorrenti');
  return esito;
}

/**
 * Conferma una scadenza in attesa: registra il movimento (con `importo` diverso se l'utente lo ha modificato)
 * e la chiude. Restituisce il movimento, oppure null se la scadenza era già chiusa.
 */
export async function confermaScadenza(ricorrenteId, data, importo = null) {
  const r = await leggi('ricorrenti', ricorrenteId);
  if (!r) throw new ErroreRicorrente('Il ricorrente non esiste più.');
  if (r.ultimaGenerazione && data <= r.ultimaGenerazione) return null;
  const giaRegistrata = (await perChiave('movimenti', 'ricorrenteId', r.id)).some((m) => m.data === data);
  let movimento = null;
  if (!giaRegistrata) {
    const costruito = costruisciMovimento(r, data, importo ?? r.modello.importo);
    if (costruito.errore) throw new ErroreRicorrente(costruito.errore);
    movimento = costruito.movimento;
  }
  await applicaModifiche({ salva: { movimenti: movimento ? [movimento] : [], ricorrenti: [{ ...r, ultimaGenerazione: data }] } });
  avvisa('confermato', r.id);
  if (movimento) avvisaMovimenti('ricorrenti');
  return movimento;
}

/** Salta una scadenza in attesa: viene chiusa senza registrare nulla. */
export async function saltaScadenza(ricorrenteId, data) {
  const r = await leggi('ricorrenti', ricorrenteId);
  if (!r) throw new ErroreRicorrente('Il ricorrente non esiste più.');
  if (r.ultimaGenerazione && data <= r.ultimaGenerazione) return;
  await salva('ricorrenti', { ...r, ultimaGenerazione: data });
  avvisa('saltato', r.id);
}
