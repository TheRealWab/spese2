// Collegamento tra il backup (funzioni pure in backup.js) e il database.

import { tutti, salvaGruppo, sostituisciArchivi } from '../db.js';
import { oggiIso } from '../util/date.js';
import { caricaCatalogo } from './catalogo.js';
import { caricaImpostazioni, impostazioni, applicaTema, salvaImpostazioni, ID_IMPOSTAZIONI } from './impostazioni.js';
import { ARCHIVI_BACKUP, cifra, pacchettoDati, unisci } from './backup.js';
import { aspettoDopoRipristino, normalizzaProfilo } from './aspetto.js';
import { applicaSfondo } from '../util/sfondo-app.js';

async function leggiArchivi() {
  const lista = await Promise.all(ARCHIVI_BACKUP.map((nome) => tutti(nome)));
  return Object.fromEntries(ARCHIVI_BACKUP.map((nome, i) => [nome, lista[i]]));
}

/** Crea il backup cifrato di tutti i dati. Restituisce il testo del file. */
export async function creaBackup(password) {
  return cifra(pacchettoDati(await leggiArchivi()), password);
}

export const segnaBackupFatto = () => salvaImpostazioni({ ultimoBackup: oggiIso() });

/** Quanti movimenti, categorie e conti ci sono adesso (per avvisare prima di sostituire). */
export async function contaDatiAttuali() {
  const a = await leggiArchivi();
  return { movimenti: a.movimenti.length, categorie: a.categorie.length, conti: a.conti.length };
}

async function aggiornaMemoria() {
  await caricaImpostazioni();
  applicaTema(impostazioni().tema);
  applicaSfondo(impostazioni().sfondo);
  await caricaCatalogo();
  document.dispatchEvent(new CustomEvent('spese2:impostazioni', { detail: { ripristino: true } }));
  document.dispatchEvent(new CustomEvent('spese2:movimenti', { detail: { azione: 'ripristinato' } }));
}

/**
 * Ripristina i dati di un backup già decifrato e controllato.
 *  - "sostituisci": gli archivi vengono svuotati e riempiti con quelli del backup (tutto o niente);
 *    restano invariati il blocco con impronta/PIN e la data dell'ultimo backup di questo telefono.
 *  - "unisci": si aggiunge solo ciò che manca (vedi unisci() in backup.js).
 */
export async function ripristinaBackup(dati, modo) {
  if (modo === 'unisci') {
    const risultato = unisci(await leggiArchivi(), dati);
    await salvaGruppo(risultato.daSalvare);
    // Il profilo di questo telefono non si tocca; se è ancora vuoto, si prende quello del backup.
    const profiloLocale = impostazioni().profilo;
    const profiloBackup = normalizzaProfilo(dati.impostazioni.find((i) => i.id === ID_IMPOSTAZIONI)?.profilo);
    if (!profiloLocale.nome && !profiloLocale.foto && (profiloBackup.nome || profiloBackup.foto)) {
      await salvaImpostazioni({ profilo: profiloBackup });
    }
    await aggiornaMemoria();
    return { modo, aggiunti: risultato.aggiunti, aggiornati: risultato.aggiornati, saltati: risultato.saltati };
  }

  const attuali = impostazioni();
  const dalBackup = dati.impostazioni.find((i) => i.id === ID_IMPOSTAZIONI) ?? {};
  const impostazioniFinali = {
    ...attuali,
    ...dalBackup,
    id: ID_IMPOSTAZIONI,
    ...aspettoDopoRipristino(attuali, dalBackup), // un backup senza profilo e sfondo non cancella quelli di questo telefono
    sicurezza: attuali.sicurezza,
    ultimoBackup: attuali.ultimoBackup,
    seedVersione: dalBackup.seedVersione ?? attuali.seedVersione ?? 1, // senza, l'app ricreerebbe i dati di partenza
  };
  await sostituisciArchivi({
    conti: dati.conti,
    categorie: dati.categorie,
    movimenti: dati.movimenti,
    valoriInvestimento: dati.valoriInvestimento,
    ricorrenti: dati.ricorrenti,
    impostazioni: [impostazioniFinali],
  });
  await aggiornaMemoria();
  return { modo, movimenti: dati.movimenti.length, categorie: dati.categorie.length, conti: dati.conti.length };
}
