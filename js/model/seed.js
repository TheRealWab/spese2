// Dati iniziali al primo avvio: conti e categorie di partenza (SPEC §6.4).
// Gli ID sono fissi e leggibili, così il seed è ripetibile e l'importazione (Fase 2) può abbinare per ID.
// Sono tutti dati di esempio/struttura: nessun dato personale.

import { salvaGruppo, leggi } from '../db.js';
import { ID_IMPOSTAZIONI, PREDEFINITE } from './impostazioni.js';

export const VERSIONE_SEED = 1;

// `ruolo: "stipendio"` marca la categoria usata dall'indicatore "Ti restano":
// così continua a funzionare anche se la categoria viene rinominata.
export const CATEGORIE_INIZIALI = [
  { id: 'cat-spesa-alimentare', nome: 'Spesa alimentare', tipo: 'spesa', icona: 'shopping-cart', colore: 'verde' },
  { id: 'cat-trasporti', nome: 'Trasporti', tipo: 'spesa', icona: 'bus', colore: 'azzurro' },
  { id: 'cat-ristoranti-bar', nome: 'Ristoranti e bar', tipo: 'spesa', icona: 'coffee', colore: 'arancio' },
  { id: 'cat-svago-hobby', nome: 'Svago e hobby', tipo: 'spesa', icona: 'gamepad-2', colore: 'viola' },
  { id: 'cat-abbonamenti', nome: 'Abbonamenti', tipo: 'spesa', icona: 'repeat', colore: 'indaco' },
  { id: 'cat-salute', nome: 'Salute', tipo: 'spesa', icona: 'heart-pulse', colore: 'corallo' },
  { id: 'cat-abbigliamento', nome: 'Abbigliamento', tipo: 'spesa', icona: 'shirt', colore: 'fucsia' },
  { id: 'cat-regali', nome: 'Regali', tipo: 'spesa', icona: 'gift', colore: 'rosa' },
  { id: 'cat-gatti', nome: 'Gatti', tipo: 'spesa', icona: 'cat', colore: 'ambra' },
  { id: 'cat-commissioni-tasse', nome: 'Commissioni e tasse', tipo: 'spesa', icona: 'receipt', colore: 'turchese' },
  { id: 'cat-altro-spesa', nome: 'Altro', tipo: 'spesa', icona: 'package', colore: 'ardesia' },
  { id: 'cat-macchinette', nome: 'Macchinette', tipo: 'spesa', icona: 'cup-soda', colore: 'lime' },

  { id: 'cat-stipendio', nome: 'Stipendio', tipo: 'entrata', icona: 'wallet', colore: 'smeraldo', ruolo: 'stipendio' },
  { id: 'cat-tredicesima', nome: 'Tredicesima e quattordicesima', tipo: 'entrata', icona: 'calendar-plus', colore: 'ciano' },
  { id: 'cat-rimborsi', nome: 'Rimborsi', tipo: 'entrata', icona: 'undo-2', colore: 'blu' },
  { id: 'cat-regali-ricevuti', nome: 'Regali ricevuti', tipo: 'entrata', icona: 'party-popper', colore: 'rosa' },
  { id: 'cat-altro-entrata', nome: 'Altro', tipo: 'entrata', icona: 'banknote', colore: 'ardesia' },
];

export const CONTI_INIZIALI = [
  { id: 'conto-principale', nome: 'Conto principale', tipo: 'conto', icona: 'landmark', colore: 'indaco' },
  { id: 'conto-secondario', nome: 'Conto secondario', tipo: 'conto', icona: 'credit-card', colore: 'azzurro' },
  { id: 'conto-investimenti', nome: 'Conto investimenti', tipo: 'investimenti', icona: 'chart-line', colore: 'viola' },
  { id: 'conto-investito', nome: 'Investito', tipo: 'investimenti', icona: 'trending-up', colore: 'smeraldo' },
  { id: 'conto-contanti', nome: 'Contanti', tipo: 'liquidità', icona: 'banknote', colore: 'ambra' },
];

/** Crea i dati iniziali una sola volta (e in un'unica transazione). Restituisce true se li ha creati. */
export async function eseguiSeedSeServe(oggi) {
  const esistenti = await leggi('impostazioni', ID_IMPOSTAZIONI);
  if (esistenti?.seedVersione) return false;

  await salvaGruppo({
    categorie: CATEGORIE_INIZIALI.map((c, i) => ({ ...c, ordine: i, archiviata: false })),
    conti: CONTI_INIZIALI.map((c, i) => ({
      ...c, saldoIniziale: 0, dataSaldoIniziale: oggi, ordine: i, archiviato: false,
    })),
    impostazioni: [{ ...PREDEFINITE, id: ID_IMPOSTAZIONI, seedVersione: VERSIONE_SEED }],
  });
  return true;
}
