// Collegamento tra l'importazione (funzioni pure in importa-vecchia.js) e il database.

import { tutti, salvaGruppo } from '../db.js';
import { caricaCatalogo } from './catalogo.js';
import { saldoCalcolato } from './importa-vecchia.js';

/** Categorie, conti e identificativi d'origine già presenti: servono ad abbinare e a non creare doppioni. */
export async function datiPerImportazione() {
  const [categorie, conti, movimenti, valori] = await Promise.all([
    tutti('categorie'), tutti('conti'), tutti('movimenti'), tutti('valoriInvestimento'),
  ]);
  const perOrdine = (a, b) => a.ordine - b.ordine;
  return {
    categorieEsistenti: categorie.sort(perOrdine),
    contiEsistenti: conti.sort(perOrdine),
    giaImportati: new Set([...movimenti, ...valori].map((x) => x.origineId).filter(Boolean)),
  };
}

/** Salva tutto in un'unica transazione (o tutto o niente) e avvisa le viste. */
export async function salvaImportazione(risultato) {
  await salvaGruppo({
    categorie: risultato.categorie,
    conti: risultato.conti,
    valoriInvestimento: risultato.valoriInvestimento,
    movimenti: risultato.movimenti,
  });
  await caricaCatalogo();
  document.dispatchEvent(new CustomEvent('spese2:movimenti', { detail: { azione: 'importato' } }));
}

/** Saldo di oggi dei conti indicati (per il controllo finale con la banca). */
export async function saldiAttuali(idConti) {
  const [conti, movimenti] = await Promise.all([tutti('conti'), tutti('movimenti')]);
  return conti
    .filter((c) => idConti.includes(c.id))
    .sort((a, b) => a.ordine - b.ordine)
    .map((c) => ({ conto: c, saldo: saldoCalcolato(c, movimenti) }));
}
