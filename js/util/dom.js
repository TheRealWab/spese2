// Piccoli aiuti per il DOM. Nessuna logica di business qui.

const MAPPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape del testo inserito dall'utente (note, nomi) prima di metterlo in un template HTML. */
export const esc = (valore) => String(valore ?? '').replace(/[&<>"']/g, (c) => MAPPA[c]);

export const $ = (selettore, radice = document) => radice.querySelector(selettore);
export const $$ = (selettore, radice = document) => [...radice.querySelectorAll(selettore)];

export const movimentoRidotto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Piccola vibrazione di feedback, dove supportata. */
export function vibra(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* non supportata */ }
}

/** Riavvia un'animazione CSS di classe (es. "scuoti") sull'elemento. */
export function animaClasse(elemento, classe) {
  elemento.classList.remove(classe);
  void elemento.offsetWidth; // forza il ricalcolo per rilanciare l'animazione
  elemento.classList.add(classe);
}
