// Stato del blocco: impostazioni salvate, "sbloccato in questa sessione", quando l'app è finita in background
// e tentativi sbagliati. Le chiavi hanno il prefisso spese2_ (l'origine è condivisa con altre app).
//
// - localStorage `spese2_blocco`: promemoria letto da index.html PRIMA del primo disegno, per non mostrare i dati
//   nemmeno per un istante. È solo un'indicazione grafica, non una protezione.
// - sessionStorage: vive finché l'app resta aperta (si perde chiudendola dalle app recenti, quindi alla prossima
//   apertura serve lo sblocco) e sopravvive alle ricariche della pagina (aggiornamenti automatici).

import { impostazioni, salvaImpostazioni } from './impostazioni.js';
import { leggiSicurezza, deveBloccare, TENTATIVI_INIZIALI } from './sicurezza.js';

const CHIAVE_PROMEMORIA = 'spese2_blocco';
const CHIAVE_SBLOCCATO = 'spese2_sbloccato';
const CHIAVE_NASCOSTA = 'spese2_nascosta_il';
const CHIAVE_TENTATIVI = 'spese2_tentativi';

const provaStorage = (azione) => { try { return azione(); } catch { return undefined; /* storage non disponibile */ } };

export const sicurezza = () => leggiSicurezza(impostazioni().sicurezza);

/** Salva uno o più valori di sicurezza e aggiorna il promemoria usato all'avvio. */
export async function salvaSicurezza(parziale) {
  const nuove = { ...sicurezza(), ...parziale };
  await salvaImpostazioni({ sicurezza: nuove });
  provaStorage(() => (nuove.attiva
    ? localStorage.setItem(CHIAVE_PROMEMORIA, '1')
    : localStorage.removeItem(CHIAVE_PROMEMORIA)));
  return nuove;
}

export function segnaSbloccato() {
  provaStorage(() => { sessionStorage.setItem(CHIAVE_SBLOCCATO, '1'); sessionStorage.removeItem(CHIAVE_NASCOSTA); });
}

export function segnaBloccato() {
  provaStorage(() => sessionStorage.removeItem(CHIAVE_SBLOCCATO));
}

export function segnaNascosta(adesso = Date.now()) {
  provaStorage(() => sessionStorage.setItem(CHIAVE_NASCOSTA, String(adesso)));
}

export function serveBlocco(adesso = Date.now()) {
  const s = sicurezza();
  return deveBloccare({
    attiva: s.attiva,
    sbloccato: provaStorage(() => sessionStorage.getItem(CHIAVE_SBLOCCATO)) === '1',
    nascostaIl: Number(provaStorage(() => sessionStorage.getItem(CHIAVE_NASCOSTA))) || null,
    adesso,
    minuti: s.minuti,
  });
}

export function leggiTentativi() {
  return provaStorage(() => JSON.parse(localStorage.getItem(CHIAVE_TENTATIVI))) ?? TENTATIVI_INIZIALI;
}

export function salvaTentativi(stato) {
  provaStorage(() => localStorage.setItem(CHIAVE_TENTATIVI, JSON.stringify(stato)));
}

export function azzeraTentativi() {
  provaStorage(() => localStorage.removeItem(CHIAVE_TENTATIVI));
}
