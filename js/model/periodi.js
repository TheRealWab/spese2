// Periodi per le analisi (Categorie, Patrimonio, Grafici): un periodo è { modo, da, a } con le date "AAAA-MM-GG" incluse.
// Modi: "giorno", "settimana" (lunedì–domenica), "mese" (il ciclo scelto in Altro), "6mesi" (6 cicli consecutivi,
// l'ultimo è quello che contiene la data), "anno" (di calendario), "personalizzato" (date scelte a mano) e "sempre".
// Solo funzioni pure.

import {
  daIso, aIso, aggiungiGiorni, aggiungiMesi, giorniTra, dataValida, cicloContenente, cicloPrecedente, cicloSuccessivo,
} from '../util/date.js';
import { etichettaCiclo, etichettaIntervallo, etichettaGiorno, meseBreveAnno } from '../util/formato.js';

/** I modi di Categorie e Patrimonio. */
export const MODI_PERIODO = ['mese', 'anno', 'sempre'];
/** I modi dei Grafici, nell'ordine in cui compaiono. */
export const MODI_GRAFICI = ['giorno', 'settimana', 'mese', '6mesi', 'anno', 'personalizzato', 'sempre'];

// Per "sempre" bastano due date che stanno prima e dopo qualsiasi movimento (le date sono testo ordinabile).
export const INIZIO_STORIA = '0000-01-01';
export const FINE_STORIA = '9999-12-31';

/** Giorno della settimana con lunedì = 0 … domenica = 6. */
function giornoSettimana(iso) {
  const { a, m, g } = daIso(iso);
  return (new Date(Date.UTC(a, m - 1, g)).getUTCDay() + 6) % 7;
}

/** Fine di un periodo di 6 cicli che inizia al ciclo `da`. */
const fineSeiMesi = (da) => aggiungiGiorni(aggiungiMesi(da, 6), -1);

/** Il periodo del tipo richiesto che contiene la data. "personalizzato": solo quella data (poi si scelgono le altre). */
export function periodoContenente(modo, iso, giornoInizio = 1) {
  if (modo === 'giorno') return { modo, da: iso, a: iso };
  if (modo === 'settimana') {
    const lunedi = aggiungiGiorni(iso, -giornoSettimana(iso));
    return { modo, da: lunedi, a: aggiungiGiorni(lunedi, 6) };
  }
  if (modo === 'mese') {
    const ciclo = cicloContenente(iso, giornoInizio);
    return { modo, da: ciclo.inizio, a: ciclo.fine };
  }
  if (modo === '6mesi') {
    const ciclo = cicloContenente(iso, giornoInizio);
    return { modo, da: aggiungiMesi(ciclo.inizio, -5), a: ciclo.fine };
  }
  if (modo === 'anno') {
    const { a } = daIso(iso);
    return { modo, da: aIso(a, 1, 1), a: aIso(a, 12, 31) };
  }
  if (modo === 'personalizzato') return { modo, da: iso, a: iso };
  return { modo: 'sempre', da: INIZIO_STORIA, a: FINE_STORIA };
}

const comeCiclo = (p) => ({ inizio: p.da, fine: p.a });
const lunghezzaGiorni = (p) => giorniTra(p.da, p.a) + 1;

/** Il periodo equivalente che viene prima ("sempre" resta uguale). */
export function periodoPrecedente(p, giornoInizio = 1) {
  if (p.modo === 'giorno') return { modo: 'giorno', da: aggiungiGiorni(p.da, -1), a: aggiungiGiorni(p.da, -1) };
  if (p.modo === 'settimana') return { modo: 'settimana', da: aggiungiGiorni(p.da, -7), a: aggiungiGiorni(p.a, -7) };
  if (p.modo === 'mese') {
    const c = cicloPrecedente(comeCiclo(p), giornoInizio);
    return { modo: 'mese', da: c.inizio, a: c.fine };
  }
  if (p.modo === '6mesi') { const da = aggiungiMesi(p.da, -6); return { modo: '6mesi', da, a: fineSeiMesi(da) }; }
  if (p.modo === 'anno') return periodoContenente('anno', aIso(daIso(p.da).a - 1, 1, 1));
  if (p.modo === 'personalizzato') {
    const n = lunghezzaGiorni(p);
    return { modo: 'personalizzato', da: aggiungiGiorni(p.da, -n), a: aggiungiGiorni(p.a, -n) };
  }
  return p;
}

/** Il periodo equivalente che viene dopo ("sempre" resta uguale). */
export function periodoSuccessivo(p, giornoInizio = 1) {
  if (p.modo === 'giorno') return { modo: 'giorno', da: aggiungiGiorni(p.da, 1), a: aggiungiGiorni(p.da, 1) };
  if (p.modo === 'settimana') return { modo: 'settimana', da: aggiungiGiorni(p.da, 7), a: aggiungiGiorni(p.a, 7) };
  if (p.modo === 'mese') {
    const c = cicloSuccessivo(comeCiclo(p), giornoInizio);
    return { modo: 'mese', da: c.inizio, a: c.fine };
  }
  if (p.modo === '6mesi') { const da = aggiungiMesi(p.da, 6); return { modo: '6mesi', da, a: fineSeiMesi(da) }; }
  if (p.modo === 'anno') return periodoContenente('anno', aIso(daIso(p.da).a + 1, 1, 1));
  if (p.modo === 'personalizzato') {
    const n = lunghezzaGiorni(p);
    return { modo: 'personalizzato', da: aggiungiGiorni(p.da, n), a: aggiungiGiorni(p.a, n) };
  }
  return p;
}

/** Un periodo salvato non è più valido se nel frattempo è cambiato il giorno di inizio del mese (o i dati non tornano). */
export function periodoValido(p, giornoInizio = 1) {
  if (!p || !MODI_GRAFICI.includes(p.modo)) return false;
  if (p.modo === 'sempre') return true;
  if (!dataValida(p.da) || !dataValida(p.a) || p.da > p.a) return false;
  if (p.modo === 'giorno') return p.da === p.a;
  if (p.modo === 'settimana') return giornoSettimana(p.da) === 0 && p.a === aggiungiGiorni(p.da, 6);
  if (p.modo === 'mese') return cicloContenente(p.da, giornoInizio).inizio === p.da;
  if (p.modo === '6mesi') return cicloContenente(p.da, giornoInizio).inizio === p.da && p.a === fineSeiMesi(p.da);
  return true;
}

export const contieneData = (p, iso) => iso >= p.da && iso <= p.a;

/**
 * Passa a un altro tipo di periodo restando "vicino": quello che contiene oggi, se il periodo attuale lo contiene.
 * Verso "personalizzato" si tiene l'intervallo che si stava guardando (per "sempre": gli ultimi 30 giorni).
 */
export function cambiaModo(p, modo, oggi, giornoInizio = 1) {
  if (modo === p.modo) return p;
  if (modo === 'personalizzato') {
    return p.modo === 'sempre'
      ? { modo, da: aggiungiGiorni(oggi, -29), a: oggi }
      : { modo, da: p.da, a: p.a };
  }
  return periodoContenente(modo, contieneData(p, oggi) ? oggi : p.da, giornoInizio);
}

/** Il testo del periodo. Con `oggi` il giorno si scrive "Oggi" / "Ieri". */
export function etichettaPeriodo(p, giornoInizio = 1, oggi = null) {
  if (p.modo === 'giorno') return oggi ? etichettaGiorno(p.da, oggi) : etichettaIntervallo(p.da, p.da);
  if (p.modo === 'settimana' || p.modo === 'personalizzato') return etichettaIntervallo(p.da, p.a);
  if (p.modo === 'mese') return etichettaCiclo(comeCiclo(p), giornoInizio);
  if (p.modo === '6mesi') return `${meseBreveAnno(p.da)} – ${meseBreveAnno(p.a)}`;
  if (p.modo === 'anno') return String(daIso(p.da).a);
  return 'Tutto lo storico';
}
