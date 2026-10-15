// Gestione delle categorie nel database (SPEC §6.4): crea, modifica, archivia, elimina, unisce.
// Le regole stanno in categorie.js (funzioni pure e testate); qui si leggono i dati, si applicano e si avvisano le viste.

import { tutti, leggi, salva, elimina, perChiave, applicaModifiche } from '../db.js';
import { nuovoId } from '../util/id.js';
import { esisteIcona } from '../util/icone.js';
import { caricaCatalogo } from './catalogo.js';
import { COLORI_CATEGORIA } from './palette.js';
import {
  validaCategoria, puoArchiviare, puoEliminare, puoUnire, pianoUnione, prossimoOrdine, pulisciNomeCategoria,
} from './categorie.js';

/** Errore con un messaggio già pronto da mostrare all'utente. */
export class ErroreCategoria extends Error {}

/** Ricarica il catalogo in memoria e avvisa le viste (Categorie, Mese, inserimento al prossimo apertura…). */
async function avvisa(dettaglio) {
  await caricaCatalogo();
  document.dispatchEvent(new CustomEvent('spese2:categorie', { detail: dettaglio }));
}

function controllaIconaEColore(icona, colore) {
  if (!esisteIcona(icona)) throw new ErroreCategoria('Scegli un\'icona.');
  if (!COLORI_CATEGORIA.includes(colore)) throw new ErroreCategoria('Scegli un colore.');
}

async function trova(id) {
  const categoria = await leggi('categorie', id);
  if (!categoria) throw new ErroreCategoria('La categoria non esiste più.');
  return categoria;
}

/** Quanti movimenti e ricorrenti usano la categoria. */
export async function contaUsi(id) {
  const [movimenti, ricorrenti] = await Promise.all([perChiave('movimenti', 'categoriaId', id), tutti('ricorrenti')]);
  return { movimenti: movimenti.length, ricorrenti: ricorrenti.filter((r) => r.modello?.categoriaId === id).length };
}

export async function creaCategoria({ nome, tipo, icona, colore }) {
  const esistenti = await tutti('categorie');
  const errore = validaCategoria({ nome, tipo }, esistenti);
  if (errore) throw new ErroreCategoria(errore);
  controllaIconaEColore(icona, colore);
  const categoria = {
    id: nuovoId(), nome: pulisciNomeCategoria(nome), tipo, icona, colore, ordine: prossimoOrdine(esistenti), archiviata: false,
  };
  await salva('categorie', categoria);
  await avvisa({ azione: 'creata', id: categoria.id });
  return categoria;
}

/** Cambia nome, icona e colore. Il tipo, la posizione e il ruolo (es. Stipendio) restano quelli di prima. */
export async function aggiornaCategoria(id, { nome, icona, colore }) {
  const [attuale, esistenti] = await Promise.all([trova(id), tutti('categorie')]);
  const errore = validaCategoria({ nome, tipo: attuale.tipo }, esistenti, { escludiId: id });
  if (errore) throw new ErroreCategoria(errore);
  controllaIconaEColore(icona, colore);
  const categoria = { ...attuale, nome: pulisciNomeCategoria(nome), icona, colore };
  await salva('categorie', categoria);
  await avvisa({ azione: 'modificata', id });
  return categoria;
}

/** Archivia (sparisce dall'inserimento, lo storico resta) o ripristina. */
export async function archiviaCategoria(id, archiviata = true) {
  const attuale = await trova(id);
  if (archiviata) {
    const permesso = puoArchiviare(attuale);
    if (!permesso.ok) throw new ErroreCategoria(permesso.motivo);
  }
  await salva('categorie', { ...attuale, archiviata });
  await avvisa({ azione: archiviata ? 'archiviata' : 'ripristinata', id });
}

/** Elimina una categoria vuota. */
export async function eliminaCategoria(id) {
  const attuale = await trova(id);
  const permesso = puoEliminare(attuale, await contaUsi(id));
  if (!permesso.ok) throw new ErroreCategoria(permesso.motivo);
  await elimina('categorie', id);
  await avvisa({ azione: 'eliminata', id });
}

/** Sposta tutti i movimenti di `origineId` in `destinazioneId` ed elimina l'origine, in un'unica operazione. */
export async function unisciCategorie(origineId, destinazioneId) {
  const [origine, destinazione, movimenti, ricorrenti] = await Promise.all([
    trova(origineId), trova(destinazioneId), perChiave('movimenti', 'categoriaId', origineId), tutti('ricorrenti'),
  ]);
  const permesso = puoUnire(origine, destinazione);
  if (!permesso.ok) throw new ErroreCategoria(permesso.motivo);
  const piano = pianoUnione({ movimenti, ricorrenti }, origineId, destinazioneId, new Date().toISOString());
  await applicaModifiche({
    salva: { movimenti: piano.movimenti, ricorrenti: piano.ricorrenti },
    elimina: { categorie: [origineId] },
  });
  await avvisa({ azione: 'unita', id: destinazioneId, origineId });
  document.dispatchEvent(new CustomEvent('spese2:movimenti', { detail: { azione: 'unione' } }));
  return piano.movimenti.length;
}
