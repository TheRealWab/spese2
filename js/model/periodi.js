// Periodi per le analisi (Categorie ora; Grafici nella Fase 5): "mese" (il ciclo scelto in Altro), "anno" (di calendario)
// e "sempre". Un periodo è { modo, da, a } con le date "AAAA-MM-GG" incluse. Solo funzioni pure.

import { daIso, aIso, cicloContenente, cicloPrecedente, cicloSuccessivo } from '../util/date.js';
import { etichettaCiclo } from '../util/formato.js';

export const MODI_PERIODO = ['mese', 'anno', 'sempre'];

// Per "sempre" bastano due date che stanno prima e dopo qualsiasi movimento (le date sono testo ordinabile).
export const INIZIO_STORIA = '0000-01-01';
export const FINE_STORIA = '9999-12-31';

/** Il periodo del tipo richiesto che contiene la data. */
export function periodoContenente(modo, iso, giornoInizio = 1) {
  if (modo === 'mese') {
    const ciclo = cicloContenente(iso, giornoInizio);
    return { modo, da: ciclo.inizio, a: ciclo.fine };
  }
  if (modo === 'anno') {
    const { a } = daIso(iso);
    return { modo, da: aIso(a, 1, 1), a: aIso(a, 12, 31) };
  }
  return { modo: 'sempre', da: INIZIO_STORIA, a: FINE_STORIA };
}

const comeCiclo = (p) => ({ inizio: p.da, fine: p.a });

export function periodoPrecedente(p, giornoInizio = 1) {
  if (p.modo === 'mese') {
    const c = cicloPrecedente(comeCiclo(p), giornoInizio);
    return { modo: 'mese', da: c.inizio, a: c.fine };
  }
  if (p.modo === 'anno') return periodoContenente('anno', aIso(daIso(p.da).a - 1, 1, 1));
  return p;
}

export function periodoSuccessivo(p, giornoInizio = 1) {
  if (p.modo === 'mese') {
    const c = cicloSuccessivo(comeCiclo(p), giornoInizio);
    return { modo: 'mese', da: c.inizio, a: c.fine };
  }
  if (p.modo === 'anno') return periodoContenente('anno', aIso(daIso(p.da).a + 1, 1, 1));
  return p;
}

/** Un periodo "mese" salvato non è più valido se nel frattempo è cambiato il giorno di inizio del mese. */
export function periodoValido(p, giornoInizio = 1) {
  if (!p || !MODI_PERIODO.includes(p.modo)) return false;
  return p.modo !== 'mese' || cicloContenente(p.da, giornoInizio).inizio === p.da;
}

export const contieneData = (p, iso) => iso >= p.da && iso <= p.a;

/** Passa a un altro tipo di periodo restando "vicino": quello che contiene oggi, se il periodo attuale lo contiene. */
export function cambiaModo(p, modo, oggi, giornoInizio = 1) {
  if (modo === p.modo) return p;
  return periodoContenente(modo, contieneData(p, oggi) ? oggi : p.da, giornoInizio);
}

export function etichettaPeriodo(p, giornoInizio = 1) {
  if (p.modo === 'mese') return etichettaCiclo(comeCiclo(p), giornoInizio);
  if (p.modo === 'anno') return String(daIso(p.da).a);
  return 'Tutto lo storico';
}
