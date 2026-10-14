// Calcoli puri (nessun accesso a DB o DOM): facili da testare e riusabili dalle altre fasi.
// Importi in centesimi interi. I Map passati sono id → oggetto (conti, categorie).

/** Dall'80% di uscite sullo stipendio la barra diventa arancione (SPEC §6.1). */
export const SOGLIA_ATTENZIONE = 80;

export const normalizzaNota = (nota) => (nota ?? '').trim().replace(/\s+/g, ' ');

/**
 * Un trasferimento "verso investimenti" (es. il PAC) riduce i soldi disponibili ma non il patrimonio.
 * Conta solo se la destinazione è un conto investimenti e l'origine no: spostare denaro tra due conti
 * investimenti non toglie nulla dai soldi disponibili.
 */
export function eTrasferimentoVersoInvestimenti(movimento, conti) {
  return movimento.tipo === 'trasferimento'
    && conti.get(movimento.contoDestinazioneId)?.tipo === 'investimenti'
    && conti.get(movimento.contoId)?.tipo !== 'investimenti';
}

/** Entrate, spese e risparmio (entrate − spese) di un insieme di movimenti. I trasferimenti non contano. */
export function totaliPeriodo(movimenti) {
  let entrate = 0;
  let spese = 0;
  for (const m of movimenti) {
    if (m.tipo === 'entrata') entrate += m.importo;
    else if (m.tipo === 'spesa') spese += m.importo;
  }
  return { entrate, spese, risparmio: entrate - spese };
}

/**
 * Indicatore "Ti restano X di Y" (SPEC §6.1).
 * - stipendio = entrate del ciclo nella categoria con ruolo "stipendio"
 * - uscite = spese + trasferimenti verso conti investimenti
 * stato: "assente" (nessuno stipendio registrato) | "ok" (<80%) | "attenzione" (80–100%) | "superato" (>100%)
 */
export function indicatoreStipendio(movimenti, categorie, conti) {
  let stipendio = 0;
  let spese = 0;
  let versoInvestimenti = 0;
  for (const m of movimenti) {
    if (m.tipo === 'entrata') {
      if (categorie.get(m.categoriaId)?.ruolo === 'stipendio') stipendio += m.importo;
    } else if (m.tipo === 'spesa') {
      spese += m.importo;
    } else if (eTrasferimentoVersoInvestimenti(m, conti)) {
      versoInvestimenti += m.importo;
    }
  }
  const uscite = spese + versoInvestimenti;
  if (stipendio === 0) {
    return { stato: 'assente', stipendio, uscite, spese, versoInvestimenti, restano: null, superamento: 0, percentuale: 0 };
  }
  // Confronti in interi (niente virgola mobile) per i casi limite esatti 80% e 100%.
  let stato = 'ok';
  if (uscite > stipendio) stato = 'superato';
  else if (uscite * 100 >= stipendio * SOGLIA_ATTENZIONE) stato = 'attenzione';
  return {
    stato,
    stipendio,
    uscite,
    spese,
    versoInvestimenti,
    restano: stipendio - uscite,
    superamento: Math.max(0, uscite - stipendio),
    percentuale: (uscite / stipendio) * 100,
  };
}

/**
 * Raggruppa per giorno, dal più recente. Dentro il giorno, l'ultimo inserito per primo.
 * `totale` = entrate − spese del giorno (i trasferimenti non contano); `haTotale` è false se il giorno
 * contiene solo trasferimenti.
 */
export function raggruppaPerGiorno(movimenti) {
  const perGiorno = new Map();
  for (const m of movimenti) {
    if (!perGiorno.has(m.data)) perGiorno.set(m.data, []);
    perGiorno.get(m.data).push(m);
  }
  return [...perGiorno.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([data, lista]) => {
      lista.sort((x, y) => (x.creatoIl < y.creatoIl ? 1 : x.creatoIl > y.creatoIl ? -1 : 0));
      const { entrate, spese } = totaliPeriodo(lista);
      return { data, movimenti: lista, totale: entrate - spese, haTotale: lista.some((m) => m.tipo !== 'trasferimento') };
    });
}

/**
 * Note già usate (di solito in una categoria) con quante volte, dalla più frequente.
 * Note uguali a meno di maiuscole/spazi sono la stessa; si mostra la grafia usata per ultima.
 */
export function contaNote(movimenti) {
  const mappa = new Map();
  for (const m of movimenti) {
    const nota = normalizzaNota(m.nota);
    if (!nota) continue;
    const chiave = nota.toLowerCase();
    const quando = m.creatoIl ?? m.data;
    const voce = mappa.get(chiave);
    if (!voce) {
      mappa.set(chiave, { nota, conteggio: 1, ultimoUso: quando });
    } else {
      voce.conteggio += 1;
      if (quando >= voce.ultimoUso) { voce.ultimoUso = quando; voce.nota = nota; }
    }
  }
  return [...mappa.values()].sort((a, b) =>
    b.conteggio - a.conteggio
    || (a.ultimoUso < b.ultimoUso ? 1 : a.ultimoUso > b.ultimoUso ? -1 : 0)
    || a.nota.localeCompare(b.nota, 'it'));
}

/**
 * Suggerimenti mentre si scrive la nota: prima quelle che iniziano con il testo, poi quelle che lo
 * contengono; senza testo, le più usate. Una nota identica a quella già scritta non si ripropone.
 */
export function suggerisciNote(noteContate, testo, massimo = 8) {
  const t = normalizzaNota(testo).toLowerCase();
  if (!t) return noteContate.slice(0, massimo);
  const iniziano = [];
  const contengono = [];
  for (const voce of noteContate) {
    const n = voce.nota.toLowerCase();
    if (n === t) continue;
    if (n.startsWith(t)) iniziano.push(voce);
    else if (n.includes(t)) contengono.push(voce);
  }
  return [...iniziano, ...contengono].slice(0, massimo);
}
