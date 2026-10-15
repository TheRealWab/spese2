// Note dei movimenti: scomposizione di una categoria per nota (SPEC §6.4). Funzioni pure.
// Due note uguali a meno di maiuscole e spazi sono la stessa nota ("Pane " = "pane").

import { normalizzaNota } from './calcoli.js';

export const CHIAVE_SENZA_NOTA = '';
export const CHIAVE_ALTRE = '__altre__';

export const chiaveNota = (nota) => normalizzaNota(nota).toLowerCase();

/**
 * Raggruppa i movimenti per nota. Restituisce [{ chiave, nota, importo, conteggio }]: prima le note con più
 * importo, in fondo "senza nota" (chiave ""). Come testo si mostra la grafia più usata del gruppo.
 */
export function scomponiPerNota(movimenti) {
  const gruppi = new Map();
  for (const m of movimenti) {
    const nota = normalizzaNota(m.nota);
    const chiave = nota.toLowerCase();
    let g = gruppi.get(chiave);
    if (!g) { g = { chiave, grafie: new Map(), importo: 0, conteggio: 0 }; gruppi.set(chiave, g); }
    g.importo += m.importo;
    g.conteggio += 1;
    g.grafie.set(nota, (g.grafie.get(nota) ?? 0) + 1);
  }
  const voci = [...gruppi.values()].map((g) => ({
    chiave: g.chiave,
    nota: [...g.grafie.entries()].sort((a, b) => b[1] - a[1])[0][0],
    importo: g.importo,
    conteggio: g.conteggio,
  }));
  const conNota = voci.filter((v) => v.chiave !== CHIAVE_SENZA_NOTA)
    .sort((a, b) => b.importo - a.importo || b.conteggio - a.conteggio || a.nota.localeCompare(b.nota, 'it'));
  const senzaNota = voci.filter((v) => v.chiave === CHIAVE_SENZA_NOTA);
  return [...conNota, ...senzaNota];
}

/**
 * Segmenti della barra: le prime `massimo` note, il resto riunito in "Altre", "senza nota" sempre a parte in fondo.
 * Ogni segmento ha la sua percentuale sul totale.
 */
export function segmentiBarra(voci, massimo = 5) {
  const totale = voci.reduce((somma, v) => somma + v.importo, 0);
  const percentuale = (importo) => (totale ? (importo / totale) * 100 : 0);
  const conNota = voci.filter((v) => v.chiave !== CHIAVE_SENZA_NOTA);
  const segmenti = conNota.slice(0, massimo).map((v) => ({ ...v, percentuale: percentuale(v.importo) }));
  const resto = conNota.slice(massimo);
  if (resto.length) {
    const importo = resto.reduce((somma, v) => somma + v.importo, 0);
    segmenti.push({ chiave: CHIAVE_ALTRE, nota: 'Altre', importo, conteggio: resto.reduce((s, v) => s + v.conteggio, 0), percentuale: percentuale(importo) });
  }
  const senza = voci.find((v) => v.chiave === CHIAVE_SENZA_NOTA);
  if (senza) segmenti.push({ ...senza, percentuale: percentuale(senza.importo) });
  return segmenti;
}

export const filtraPerNota = (movimenti, chiave) => movimenti.filter((m) => chiaveNota(m.nota) === chiave);

// ---- Gestione delle note: rinomina e unione (SPEC §6.4) ----

export const LUNGHEZZA_MAX_NOTA = 80; // come il campo nota dell'inserimento

/** Messaggio d'errore in italiano per il nuovo nome di una nota, oppure null se va bene. */
export function validaNomeNota(nome) {
  const pulito = normalizzaNota(nome);
  if (!pulito) return 'Scrivi il nome della nota.';
  if (pulito.length > LUNGHEZZA_MAX_NOTA) return `La nota può avere al massimo ${LUNGHEZZA_MAX_NOTA} caratteri.`;
  return null;
}

/**
 * Cosa succede dando `nuovoNome` alla nota `chiaveOrigine`. Se esiste già un'altra nota con quel nome (a meno di
 * maiuscole e spazi) le due si uniscono, e si usa la grafia di quella esistente: `unisceCon` è allora la sua voce.
 * `voci` viene da scomponiPerNota.
 */
export function risolviNuovoNome(voci, chiaveOrigine, nuovoNome) {
  const nome = normalizzaNota(nuovoNome);
  const esistente = voci.find((v) => v.chiave !== chiaveOrigine && v.chiave !== CHIAVE_SENZA_NOTA && v.chiave === chiaveNota(nome));
  return esistente ? { nome: esistente.nota, unisceCon: esistente } : { nome, unisceCon: null };
}

/**
 * I movimenti che cambiano quando la nota `chiaveOrigine` diventa `nuovoNome`. Restituisce `modificati` (da salvare)
 * e `originali` (gli stessi movimenti com'erano, per annullare). Chi ha già esattamente quel testo non cambia.
 */
export function pianoNota(movimenti, chiaveOrigine, nuovoNome, adesso) {
  const nome = normalizzaNota(nuovoNome);
  if (chiaveOrigine === CHIAVE_SENZA_NOTA || !nome) return { originali: [], modificati: [] };
  const originali = movimenti.filter((m) => chiaveNota(m.nota) === chiaveOrigine && normalizzaNota(m.nota) !== nome);
  return { originali, modificati: originali.map((m) => ({ ...m, nota: nome, modificatoIl: adesso })) };
}
