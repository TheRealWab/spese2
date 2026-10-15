// Impostazioni dell'app (SPEC §4 "Impostazioni"): un unico record nell'archivio `impostazioni`.

import { leggi, salva } from '../db.js';

export const ID_IMPOSTAZIONI = 'principale';
const CHIAVE_TEMA = 'spese2_tema'; // copia in localStorage: leggibile subito, prima del primo disegno

export const PREDEFINITE = {
  giornoInizioMese: 1,
  tema: 'auto', // "auto" | "chiaro" | "scuro"
  contoPredefinito: 'conto-principale',
  ordineCategorieInserimento: 'frequenza', // "frequenza" | "manuale"
  ultimoPeriodoGrafici: null,
  nascondiImportiPatrimonio: false, // occhio nell'area Patrimonio: copre gli importi con dei pallini
  ultimoBackup: null,
  sicurezza: { attiva: false },
};

// Colori di sfondo per la barra di sistema del telefono (stessi valori di --sfondo in tokens.css).
const COLORE_BARRA = { chiaro: '#f3f4f8', scuro: '#0a0b0f' };

let correnti = { ...PREDEFINITE };

export const impostazioni = () => correnti;

export async function caricaImpostazioni() {
  const salvate = await leggi('impostazioni', ID_IMPOSTAZIONI);
  correnti = { ...PREDEFINITE, ...(salvate ?? {}) };
  return correnti;
}

/** Aggiorna uno o più valori, li salva e avvisa le viste. */
export async function salvaImpostazioni(parziale) {
  const nuove = { ...correnti, ...parziale, id: ID_IMPOSTAZIONI };
  await salva('impostazioni', nuove);
  correnti = nuove;
  if ('tema' in parziale) applicaTema(nuove.tema);
  document.dispatchEvent(new CustomEvent('spese2:impostazioni', { detail: parziale }));
}

export function applicaTema(tema) {
  const radice = document.documentElement;
  if (tema === 'chiaro' || tema === 'scuro') radice.dataset.tema = tema;
  else delete radice.dataset.tema;
  try { localStorage.setItem(CHIAVE_TEMA, tema); } catch { /* storage non disponibile */ }
  aggiornaColoreBarra(tema);
}

function aggiornaColoreBarra(tema) {
  const scuro = tema === 'scuro' || (tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = scuro ? COLORE_BARRA.scuro : COLORE_BARRA.chiaro;
  document.head.append(meta);
}

/** Con tema "auto" il colore della barra deve seguire il sistema anche mentre l'app è aperta. */
export function seguiTemaDiSistema() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (correnti.tema === 'auto') aggiornaColoreBarra('auto');
  });
}
