// Aritmetica sulle date. Le date dell'app sono stringhe "AAAA-MM-GG" (ordinabili come testo),
// senza orario né fuso: così non esistono scarti di un giorno dovuti all'ora legale.

const pad = (n) => String(n).padStart(2, '0');

export function daIso(iso) {
  const [a, m, g] = iso.split('-').map(Number);
  return { a, m, g };
}

export function aIso(a, m, g) {
  return `${String(a).padStart(4, '0')}-${pad(m)}-${pad(g)}`;
}

/** La data di oggi nel fuso del telefono. */
export function oggiIso(adesso = new Date()) {
  return aIso(adesso.getFullYear(), adesso.getMonth() + 1, adesso.getDate());
}

export function giorniNelMese(a, m) {
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function dataValida(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { a, m, g } = daIso(iso);
  return m >= 1 && m <= 12 && g >= 1 && g <= giorniNelMese(a, m);
}

export function aggiungiGiorni(iso, n) {
  const { a, m, g } = daIso(iso);
  const d = new Date(Date.UTC(a, m - 1, g + n));
  return aIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Giorni interi tra due date (a − da): positivo se `a` è dopo `da`. */
export function giorniTra(da, a) {
  const x = daIso(da);
  const y = daIso(a);
  return Math.round((Date.UTC(y.a, y.m - 1, y.g) - Date.UTC(x.a, x.m - 1, x.g)) / 86400000);
}

/** Somma mesi; se il giorno non esiste nel mese di arrivo usa l'ultimo (31 gen + 1 mese = 28/29 feb). */
export function aggiungiMesi(iso, n) {
  const { a, m, g } = daIso(iso);
  const totale = a * 12 + (m - 1) + n;
  const na = Math.floor(totale / 12);
  const nm = (totale % 12) + 1;
  return aIso(na, nm, Math.min(g, giorniNelMese(na, nm)));
}

/**
 * Ciclo mensile (mese "finanziario") che contiene la data.
 * giornoInizio = 1 → mese di calendario; 27 → dal 27 al 26 del mese dopo.
 * Restituisce { inizio, fine } entrambi inclusi.
 */
export function cicloContenente(iso, giornoInizio = 1) {
  const { a, m, g } = daIso(iso);
  const inizioQuestoMese = aIso(a, m, giornoInizio);
  const inizio = g >= giornoInizio ? inizioQuestoMese : aggiungiMesi(inizioQuestoMese, -1);
  const fine = aggiungiGiorni(aggiungiMesi(inizio, 1), -1);
  return { inizio, fine };
}

export function cicloPrecedente(ciclo, giornoInizio = 1) {
  return cicloContenente(aggiungiGiorni(ciclo.inizio, -1), giornoInizio);
}

export function cicloSuccessivo(ciclo, giornoInizio = 1) {
  return cicloContenente(aggiungiGiorni(ciclo.fine, 1), giornoInizio);
}

export function dentroCiclo(iso, ciclo) {
  return iso >= ciclo.inizio && iso <= ciclo.fine;
}

/** Giorno della settimana con lunedì = 0 … domenica = 6. */
export function giornoSettimana(iso) {
  const { a, m, g } = daIso(iso);
  return (new Date(Date.UTC(a, m - 1, g)).getUTCDay() + 6) % 7;
}
