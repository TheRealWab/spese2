// Formati italiani per importi, date e cifre digitate. Gli importi sono sempre centesimi interi.

import { daIso, aggiungiGiorni } from './date.js';

// `useGrouping: 'always'` è necessario: per it-IT Intl, di norma, non raggruppa i numeri a 4 cifre
// ("1234,56 €"), mentre l'app mostra sempre "1.234,56 €".
const fmtEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmtEuroIntero = new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: 'always',
});
const fmtNumero = new Intl.NumberFormat('it-IT', { useGrouping: 'always' });

// Intl scrive i negativi con il trattino "-": nell'app si usa sempre il meno vero (U+2212).
const meno = (testo) => testo.replace('-', '−');

/** 123456 → "1.234,56 €" */
export function euro(centesimi) {
  return meno(fmtEuro.format(centesimi / 100));
}

/** Senza decimali se l'importo è tondo: 62000 → "620 €", 62050 → "620,50 €". */
export function euroCompatto(centesimi) {
  return meno(centesimi % 100 === 0 ? fmtEuroIntero.format(centesimi / 100) : fmtEuro.format(centesimi / 100));
}

/** Arrotonda all'euro (per le schede piccole): 123456 → "1.235 €". */
export function euroArrotondato(centesimi) {
  return meno(fmtEuroIntero.format(Math.round(centesimi / 100)));
}

/** Con segno esplicito: "+1.450,00 €" / "−12,50 €" (meno vero, U+2212). Lo zero non ha segno. */
export function euroConSegno(centesimi) {
  if (centesimi === 0) return euro(0);
  return (centesimi > 0 ? '+' : '−') + euro(Math.abs(centesimi));
}

export function percentuale(valore) {
  return `${fmtNumero.format(Math.round(valore))}%`;
}

const fmtPercentualeDecimale = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Con un decimale e il segno: "+4,2%" / "−1,5%" (meno vero, U+2212); "0,0%" senza segno. */
export function percentualeConSegno(valore) {
  const arrotondato = Math.round(valore * 10) / 10;
  if (arrotondato === 0) return '0,0%';
  return (arrotondato > 0 ? '+' : '−') + fmtPercentualeDecimale.format(Math.abs(arrotondato)) + '%';
}

// ---- Cifre digitate sul tastierino ----

/** "1234,5" → "1.234,5" (separatore delle migliaia mentre si digita). */
export function formattaDigitato(testo) {
  if (!testo) return '0';
  const [intero, decimali] = testo.split(',');
  const gruppi = intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimali === undefined ? gruppi : `${gruppi},${decimali}`;
}

/** "12,5" → 1250. "" → 0. */
export function digitatoInCentesimi(testo) {
  if (!testo) return 0;
  const [intero, decimali = ''] = testo.split(',');
  return Number(intero || '0') * 100 + Number(decimali.padEnd(2, '0').slice(0, 2));
}

/** 1250 → "12,5"; 1200 → "12"; 1205 → "12,05" (per precompilare la modifica). */
export function centesimiInDigitato(centesimi) {
  const intero = Math.floor(centesimi / 100);
  const resto = centesimi % 100;
  if (resto === 0) return String(intero);
  return `${intero},${String(resto).padStart(2, '0').replace(/0$/, '')}`;
}

/**
 * Legge un importo scritto a mano in un campo di testo ("1.234,56", "1234,5", "12.50", "-30", "€ 99") e lo
 * restituisce in centesimi; null se non è un importo valido. La virgola è il separatore decimale; un punto seguito
 * da esattamente tre cifre (e senza virgola) è un separatore delle migliaia, altrimenti è un decimale.
 */
export function leggiImporto(testo) {
  let t = String(testo ?? '').replace(/[€\s]/g, '').replace('−', '-');
  if (!t) return null;
  let segno = 1;
  if (t[0] === '-' || t[0] === '+') { if (t[0] === '-') segno = -1; t = t.slice(1); }
  if (!t || !/^[\d.,]+$/.test(t)) return null;
  const ultimaVirgola = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');
  const sep = Math.max(ultimaVirgola, ultimoPunto);
  let intero = t;
  let decimali = '';
  if (sep !== -1) {
    const dopo = t.slice(sep + 1);
    if (ultimaVirgola === -1 && /^\d{3}$/.test(dopo)) {
      intero = t.replace(/\./g, ''); // solo punti, l'ultimo seguito da tre cifre: migliaia
    } else {
      if (!/^\d{0,2}$/.test(dopo)) return null;
      const prima = t.slice(0, sep);
      // Prima della virgola ci possono essere solo punti (migliaia); prima di un punto decimale, nessun separatore.
      if (t[sep] === ',' ? prima.includes(',') : /[.,]/.test(prima)) return null;
      intero = prima.replace(/\./g, '');
      decimali = dopo;
    }
  }
  if (intero.length > 12 || (intero && !/^\d+$/.test(intero))) return null;
  if (!intero && !decimali) return null;
  return segno * (Number(intero || '0') * 100 + Number(decimali.padEnd(2, '0') || '0'));
}

// ---- Date (UTC per evitare scarti di fuso: le date sono "giorni", non istanti) ----

const opzioniUtc = { timeZone: 'UTC' };
const fmtGiornoMese = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', ...opzioniUtc });
const fmtGiornoMeseBreve = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', ...opzioniUtc });
const fmtLunga = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', ...opzioniUtc });
const fmtMeseAnno = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', ...opzioniUtc });

const comeData = (iso) => {
  const { a, m, g } = daIso(iso);
  return new Date(Date.UTC(a, m - 1, g));
};
const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const fmtBreveAnno = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', ...opzioniUtc });

/** "14 ott 2026" */
export const dataBreve = (iso) => fmtBreveAnno.format(comeData(iso));

/** "14 ottobre 2026" */
export const dataLunga = (iso) => fmtLunga.format(comeData(iso));

/** "Ottobre 2026" */
export const meseAnno = (iso) => maiuscola(fmtMeseAnno.format(comeData(iso)));

/** "Oggi", "Ieri", "12 ottobre" (con l'anno se non è quello corrente). */
export function etichettaGiorno(iso, oggi) {
  if (iso === oggi) return 'Oggi';
  if (iso === aggiungiGiorni(oggi, -1)) return 'Ieri';
  return daIso(iso).a === daIso(oggi).a ? fmtGiornoMese.format(comeData(iso)) : dataLunga(iso);
}

/** Etichetta del ciclo: "Ottobre 2026" se parte dal 1°, altrimenti "27 ott – 26 nov". */
export function etichettaCiclo(ciclo, giornoInizio) {
  if (giornoInizio === 1) return meseAnno(ciclo.inizio);
  const a1 = daIso(ciclo.inizio).a;
  const a2 = daIso(ciclo.fine).a;
  const inizio = fmtGiornoMeseBreve.format(comeData(ciclo.inizio));
  const fine = fmtGiornoMeseBreve.format(comeData(ciclo.fine));
  return a1 === a2 ? `${inizio} – ${fine}` : `${inizio} ${a1} – ${fine} ${a2}`;
}

// ---- Intervalli e mesi (periodi dei Grafici) ----

const fmtMeseBreveAnno = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric', ...opzioniUtc });
const fmtMeseBreve = new Intl.DateTimeFormat('it-IT', { month: 'short', ...opzioniUtc });
const fmtMeseLungo = new Intl.DateTimeFormat('it-IT', { month: 'long', ...opzioniUtc });

/** "5 ott – 11 ott 2026" (con l'anno su entrambe le date se sono di anni diversi). */
export function etichettaIntervallo(da, a) {
  if (da === a) return dataBreve(da);
  if (daIso(da).a === daIso(a).a) return `${fmtGiornoMeseBreve.format(comeData(da))} – ${dataBreve(a)}`;
  return `${dataBreve(da)} – ${dataBreve(a)}`;
}

/** "ott 2026" */
export const meseBreveAnno = (iso) => fmtMeseBreveAnno.format(comeData(iso)).replace('.', '');

/** "ott" */
export const meseBreve = (iso) => fmtMeseBreve.format(comeData(iso)).replace('.', '');

/** "ottobre" (minuscolo, per le frasi: «rispetto a settembre») */
export const nomeMese = (iso) => fmtMeseLungo.format(comeData(iso));
