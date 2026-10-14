// Diario di bordo temporaneo per capire il tasto indietro sul telefono: sopravvive alla chiusura
// dell'app (localStorage), così dopo l'uscita si può leggere cosa è successo. Da rimuovere a problema risolto.

const CHIAVE = 'spese2_diag';
const MAX_VOCI = 14;

export function leggiDiagnostica() {
  try { return JSON.parse(localStorage.getItem(CHIAVE)) ?? []; } catch { return []; }
}

export function scriviDiagnostica(testo) {
  try {
    const ora = new Date().toTimeString().slice(0, 8);
    const voci = [...leggiDiagnostica(), `${ora} ${testo}`].slice(-MAX_VOCI);
    localStorage.setItem(CHIAVE, JSON.stringify(voci));
  } catch { /* storage non disponibile: la diagnostica è facoltativa */ }
}

export function azzeraDiagnostica() {
  try { localStorage.removeItem(CHIAVE); } catch { /* idem */ }
}
