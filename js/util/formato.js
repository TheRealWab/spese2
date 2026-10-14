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
