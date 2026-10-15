// Gestione dei conti e dei valori degli investimenti nel database (SPEC §6.3). Le regole stanno in conti.js e
// patrimonio.js (funzioni pure e testate); qui si leggono i dati, si applicano e si avvisano le viste.

import { tutti, leggi, salva, elimina } from '../db.js';
import { nuovoId } from '../util/id.js';
import { esisteIcona } from '../util/icone.js';
import { oggiIso } from '../util/date.js';
import { caricaCatalogo } from './catalogo.js';
import { impostazioni } from './impostazioni.js';
import { COLORI_CATEGORIA } from './palette.js';
import { validaConto, validaValore, puoArchiviareConto, pulisciNomeConto, prossimoOrdineConto } from './conti.js';

/** Errore con un messaggio già pronto da mostrare all'utente. */
export class ErroreConto extends Error {}

/** Ricarica il catalogo in memoria e avvisa le viste (Patrimonio, inserimento al prossimo apertura…). */
async function avvisa(dettaglio) {
  await caricaCatalogo();
  document.dispatchEvent(new CustomEvent('spese2:conti', { detail: dettaglio }));
}

function controllaIconaEColore(icona, colore) {
  if (!esisteIcona(icona)) throw new ErroreConto('Scegli un\'icona.');
  if (!COLORI_CATEGORIA.includes(colore)) throw new ErroreConto('Scegli un colore.');
}

async function trova(id) {
  const conto = await leggi('conti', id);
  if (!conto) throw new ErroreConto('Il conto non esiste più.');
  return conto;
}

export const tuttiIValori = () => tutti('valoriInvestimento');

export async function creaConto({ nome, tipo, icona, colore, saldoIniziale, dataSaldoIniziale }) {
  const esistenti = await tutti('conti');
  const errore = validaConto({ nome, tipo, saldoIniziale, dataSaldoIniziale }, esistenti);
  if (errore) throw new ErroreConto(errore);
  controllaIconaEColore(icona, colore);
  const conto = {
    id: nuovoId(), nome: pulisciNomeConto(nome), tipo, icona, colore, saldoIniziale, dataSaldoIniziale,
    ordine: prossimoOrdineConto(esistenti), archiviato: false,
  };
  await salva('conti', conto);
  await avvisa({ azione: 'creato', id: conto.id });
  return conto;
}

/** Cambia nome, icona, colore e saldo iniziale. Il tipo e la posizione restano quelli di prima. */
export async function aggiornaConto(id, { nome, icona, colore, saldoIniziale, dataSaldoIniziale }) {
  const [attuale, esistenti] = await Promise.all([trova(id), tutti('conti')]);
  const errore = validaConto({ nome, tipo: attuale.tipo, saldoIniziale, dataSaldoIniziale }, esistenti, { escludiId: id });
  if (errore) throw new ErroreConto(errore);
  controllaIconaEColore(icona, colore);
  const conto = { ...attuale, nome: pulisciNomeConto(nome), icona, colore, saldoIniziale, dataSaldoIniziale };
  await salva('conti', conto);
  await avvisa({ azione: 'modificato', id });
  return conto;
}

/** Archivia (non conta più nel patrimonio né compare nell'inserimento; i movimenti restano) o ripristina. */
export async function archiviaConto(id, archiviato = true) {
  const [attuale, esistenti] = await Promise.all([trova(id), tutti('conti')]);
  if (archiviato) {
    const permesso = puoArchiviareConto(attuale, esistenti, impostazioni().contoPredefinito);
    if (!permesso.ok) throw new ErroreConto(permesso.motivo);
  }
  await salva('conti', { ...attuale, archiviato });
  await avvisa({ azione: archiviato ? 'archiviato' : 'ripristinato', id });
}

// ---- Valori degli investimenti ----

/**
 * Inserisce il valore di un conto investimenti a una data. Se per quella data c'è già un valore, lo sostituisce
 * (un solo valore per giorno). Restituisce il valore salvato.
 */
export async function salvaValore({ contoId, data, valore }) {
  const conto = await trova(contoId);
  if (conto.tipo !== 'investimenti') throw new ErroreConto('Il valore si inserisce solo per i conti investimenti.');
  const errore = validaValore({ valore, data }, oggiIso());
  if (errore) throw new ErroreConto(errore);
  const esistente = (await tuttiIValori()).find((v) => v.contoId === contoId && v.data === data);
  const record = { ...(esistente ?? {}), id: esistente?.id ?? nuovoId(), contoId, data, valore };
  await salva('valoriInvestimento', record);
  await avvisa({ azione: 'valore', id: contoId });
  return record;
}

/** Modifica un valore già inserito (importo e/o data). Se la nuova data è di un altro valore, quello viene sostituito. */
export async function aggiornaValore(id, { data, valore }) {
  const attuale = await leggi('valoriInvestimento', id);
  if (!attuale) throw new ErroreConto('Il valore non esiste più.');
  const errore = validaValore({ valore, data }, oggiIso());
  if (errore) throw new ErroreConto(errore);
  const stessaData = (await tuttiIValori()).find((v) => v.contoId === attuale.contoId && v.data === data && v.id !== id);
  if (stessaData) await elimina('valoriInvestimento', stessaData.id);
  const record = { ...attuale, data, valore };
  await salva('valoriInvestimento', record);
  await avvisa({ azione: 'valore', id: attuale.contoId });
  return record;
}

/** Elimina un valore. Restituisce quello eliminato (per poterlo ripristinare con "Annulla"). */
export async function eliminaValore(id) {
  const attuale = await leggi('valoriInvestimento', id);
  if (!attuale) return null;
  await elimina('valoriInvestimento', id);
  await avvisa({ azione: 'valore', id: attuale.contoId });
  return attuale;
}

/** Rimette un valore eliminato, così com'era. */
export async function ripristinaValore(record) {
  await salva('valoriInvestimento', record);
  await avvisa({ azione: 'valore', id: record.contoId });
}
