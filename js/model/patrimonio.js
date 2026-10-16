// Patrimonio e investimenti (SPEC §4 e §6.3). Solo funzioni pure: niente DB, niente DOM. Importi in centesimi.
//
// Regole:
// - Saldo di un conto = saldo iniziale + i movimenti DOPO la data del saldo iniziale (vale a fine giornata di quella
//   data): entrate +, spese −, trasferimenti − in uscita e + in arrivo. Per le date PRIMA del saldo iniziale si
//   ricostruisce all'indietro (si tolgono i movimenti compresi tra quella data e il saldo iniziale).
// - Conto investimenti: "versato" = il saldo calcolato come sopra; "valore" = l'ultimo valore inserito a mano più i
//   versamenti fatti dopo quella data (un versamento aumenta il valore anche se non l'hai ancora aggiornato: così
//   un trasferimento da Conto a Investimenti non cambia il patrimonio). Senza valori inseriti, valore = versato.
// - Patrimonio = somma dei conti non archiviati.

import { aggiungiGiorni, aggiungiMesi, giorniTra } from '../util/date.js';

/** Di quanto un movimento cambia il saldo di un conto (0 se non lo riguarda). */
export function effettoMovimento(m, contoId) {
  if (m.tipo === 'entrata') return m.contoId === contoId ? m.importo : 0;
  if (m.tipo === 'spesa') return m.contoId === contoId ? -m.importo : 0;
  if (m.tipo === 'trasferimento') {
    return (m.contoDestinazioneId === contoId ? m.importo : 0) - (m.contoId === contoId ? m.importo : 0);
  }
  return 0;
}

/** Quanti elementi di `date` (ordinate) sono <= `limite`. */
function contaFinoA(date, limite) {
  let basso = 0;
  let alto = date.length;
  while (basso < alto) {
    const medio = (basso + alto) >> 1;
    if (date[medio] <= limite) basso = medio + 1; else alto = medio;
  }
  return basso;
}

/**
 * Prepara un conto per rispondere in fretta "quanto valeva alla data X": somme cumulate dei movimenti e valori
 * ordinati. Serve a costruire il grafico (decine di date × pochi conti) senza rileggere tutti i movimenti ogni volta.
 */
export function creaStoriaConto(conto, movimenti, valori = []) {
  const eventi = [];
  for (const m of movimenti) {
    const effetto = effettoMovimento(m, conto.id);
    if (effetto !== 0) eventi.push({ data: m.data, effetto });
  }
  eventi.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const date = [];
  const cumulati = [];
  let somma = 0;
  for (const e of eventi) {
    somma += e.effetto;
    if (date.length && date[date.length - 1] === e.data) cumulati[cumulati.length - 1] = somma;
    else { date.push(e.data); cumulati.push(somma); }
  }
  const cumulatoAl = (data) => { const n = contaFinoA(date, data); return n ? cumulati[n - 1] : 0; };

  const valoriConto = valori
    .filter((v) => v.contoId === conto.id)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const dateValori = valoriConto.map((v) => v.data);

  const versatoAl = (data) => (conto.saldoIniziale ?? 0) + cumulatoAl(data) - cumulatoAl(conto.dataSaldoIniziale);
  const ultimoValoreAl = (data) => { const n = contaFinoA(dateValori, data); return n ? valoriConto[n - 1] : null; };
  const saldoAl = (data) => {
    if (conto.tipo !== 'investimenti') return versatoAl(data);
    const ultimo = ultimoValoreAl(data);
    return ultimo ? ultimo.valore + cumulatoAl(data) - cumulatoAl(ultimo.data) : versatoAl(data);
  };
  return { conto, versatoAl, ultimoValoreAl, saldoAl };
}

/**
 * I movimenti che riguardano il conto ma NON entrano nel suo saldo, perché sono del giorno del saldo iniziale o prima
 * (il saldo iniziale vale a fine giornata di quella data e li comprende già). Serve ad avvisare l'utente: un movimento
 * "perso" così, per esempio un trasferimento verso un conto appena creato, fa sembrare sbagliato il patrimonio.
 */
export function movimentiEsclusi(conto, movimenti) {
  return movimenti.filter((m) => effettoMovimento(m, conto.id) !== 0 && m.data <= conto.dataSaldoIniziale);
}

/** Le storie di tutti i conti, per id. */
export function creaStorie(conti, movimenti, valori = []) {
  return new Map(conti.map((c) => [c.id, creaStoriaConto(c, movimenti, valori)]));
}

/** Patrimonio alla fine della data: somma dei saldi dei conti non archiviati. */
export function patrimonioAl(storie, data) {
  let totale = 0;
  for (const s of storie.values()) if (!s.conto.archiviato) totale += s.saldoAl(data);
  return totale;
}

/**
 * Versato, valore, guadagno e "quanto è vecchio" l'ultimo valore inserito, per un conto investimenti.
 * guadagnoPercentuale è null se non c'è nulla di versato.
 */
export function riepilogoInvestimento(storia, oggi) {
  const versato = storia.versatoAl(oggi);
  const valore = storia.saldoAl(oggi);
  const ultimo = storia.ultimoValoreAl(oggi);
  const guadagno = valore - versato;
  return {
    versato,
    valore,
    guadagno,
    guadagnoPercentuale: versato > 0 ? (guadagno / versato) * 100 : null,
    ultimoAggiornamento: ultimo?.data ?? null,
    giorniDaAggiornamento: ultimo ? giorniTra(ultimo.data, oggi) : null,
  };
}

/**
 * Come si divide il patrimonio tra investito (conti investimenti) e non investito (tutti gli altri conti attivi).
 * Le percentuali sono intere e sommano 100. Restituisce null se non ha senso dividerlo (patrimonio zero o negativo,
 * oppure una delle due parti negativa, per esempio uno scoperto): in quel caso la barra non si mostra.
 */
export function ripartizioneInvestito(storie, data) {
  let investito = 0;
  let nonInvestito = 0;
  for (const s of storie.values()) {
    if (s.conto.archiviato) continue;
    if (s.conto.tipo === 'investimenti') investito += s.saldoAl(data); else nonInvestito += s.saldoAl(data);
  }
  const totale = investito + nonInvestito;
  if (totale <= 0 || investito < 0 || nonInvestito < 0) return null;
  const percentualeInvestito = Math.round((investito / totale) * 100);
  return { investito, nonInvestito, totale, percentualeInvestito, percentualeNonInvestito: 100 - percentualeInvestito };
}

/** Variazione del patrimonio rispetto a un mese prima. `percentuale` è null se un mese fa era zero o negativo. */
export function variazioneRispettoAMeseFa(storie, oggi) {
  const prima = patrimonioAl(storie, aggiungiMesi(oggi, -1));
  const adesso = patrimonioAl(storie, oggi);
  return { prima, adesso, assoluta: adesso - prima, percentuale: prima > 0 ? ((adesso - prima) / prima) * 100 : null };
}

/** Le date da disegnare nel grafico: tutti i giorni se sono pochi, altrimenti a passo fisso, sempre con l'ultima. */
export function dateCampione(da, a, massimoPunti = 90) {
  if (da > a) return [];
  const giorni = giorniTra(da, a);
  if (giorni + 1 <= massimoPunti) return Array.from({ length: giorni + 1 }, (_, i) => aggiungiGiorni(da, i));
  const passo = Math.ceil(giorni / (massimoPunti - 1));
  const date = [];
  for (let i = 0; i < giorni; i += passo) date.push(aggiungiGiorni(da, i));
  date.push(a);
  return date;
}

/**
 * Andamento del patrimonio: [{ data, valore }] per le date campione tra `da` e `a`. Le `dateExtra` (per esempio i
 * giorni in cui si è aggiornato il valore di un investimento) si aggiungono se cadono nell'intervallo.
 */
export function serieAndamento(storie, da, a, massimoPunti = 90, dateExtra = []) {
  const date = new Set(dateCampione(da, a, massimoPunti));
  for (const d of dateExtra) if (d >= da && d <= a) date.add(d);
  return [...date].sort().map((data) => ({ data, valore: patrimonioAl(storie, data) }));
}

/**
 * La data più vecchia in cui c'è qualcosa (movimento, valore o un saldo iniziale diverso da zero), mai dopo oggi.
 * Senza dati: oggi.
 */
export function primaDataConDati(movimenti, valori, oggi, conti = []) {
  let prima = oggi;
  for (const c of conti) if (!c.archiviato && c.saldoIniziale && c.dataSaldoIniziale < prima) prima = c.dataSaldoIniziale;
  for (const m of movimenti) if (m.data < prima) prima = m.data;
  for (const v of valori) if (v.data < prima) prima = v.data;
  return prima;
}

/**
 * Intervallo del grafico per un periodo: dal più tardi tra l'inizio del periodo e la prima data con dati,
 * fino al più presto tra la fine del periodo e oggi. null se non c'è un intervallo da mostrare.
 */
export function intervalloGrafico(periodo, primaData, oggi) {
  const da = periodo.da > primaData ? periodo.da : primaData;
  const a = periodo.a < oggi ? periodo.a : oggi;
  return da <= a ? { da, a } : null;
}

/** "Valore aggiornato 4 mesi fa": { testo, vecchio } — `vecchio` dopo 30 giorni, per un promemoria più visibile. */
export function etichettaAggiornamento(ultimaData, oggi) {
  if (!ultimaData) return { testo: 'Valore non ancora inserito', vecchio: true };
  const giorni = Math.max(0, giorniTra(ultimaData, oggi));
  const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
  let quando;
  if (giorni === 0) quando = 'oggi';
  else if (giorni === 1) quando = 'ieri';
  else if (giorni < 14) quando = `${giorni} giorni fa`;
  else if (giorni < 60) quando = `${plurale(Math.floor(giorni / 7), 'settimana', 'settimane')} fa`;
  else if (giorni < 730) quando = `${Math.floor(giorni / 30.44)} mesi fa`;
  else quando = `${Math.floor(giorni / 365.25)} anni fa`;
  return { testo: `Valore aggiornato ${quando}`, vecchio: giorni >= 30 };
}

/** I movimenti che riguardano un conto (in uscita, in entrata o come destinazione di un trasferimento), dal più recente. */
export function movimentiDelConto(movimenti, contoId) {
  return movimenti
    .filter((m) => m.contoId === contoId || m.contoDestinazioneId === contoId)
    .sort((a, b) => (a.data === b.data ? (b.creatoIl ?? '').localeCompare(a.creatoIl ?? '') : (a.data < b.data ? 1 : -1)));
}
