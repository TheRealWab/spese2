// Calcoli dei Grafici (SPEC §6.2). Solo funzioni pure: periodi, sotto-periodi, confronti e ripartizioni. Importi in centesimi.

import { aggiungiGiorni, giorniTra, daIso, aIso, cicloContenente, cicloSuccessivo } from '../util/date.js';
import { etichettaCiclo, etichettaIntervallo, meseBreve, meseAnno, nomeMese } from '../util/formato.js';
import { periodoPrecedente, contieneData } from './periodi.js';

const MAX_PERIODI_MEDIA = 6; // la media si fa sugli ultimi 6 periodi equivalenti
const MIN_PERIODI_MEDIA = 2; // sotto questo numero la media non dice nulla

/** Il periodo con date vere: "sempre" va dalla prima data con dati a oggi. */
export function periodoEffettivo(periodo, primaData, oggi) {
  if (periodo.modo !== 'sempre') return periodo;
  return { modo: 'sempre', da: primaData < oggi ? primaData : oggi, a: oggi };
}

// ---- Sotto-periodi (le barre nel tempo) ----

/**
 * In quante parti dividere il periodo per le barre: "giorno", "settimana", "mese", "anno", oppure null se il periodo
 * è un solo giorno (le barre nel tempo non servono). Mese e settimana → giorni; 6 mesi e anno → mesi;
 * personalizzato e sempre dipendono da quanto è lungo l'intervallo.
 */
export function granularita(p) {
  if (p.modo === 'giorno') return null;
  if (p.modo === 'settimana' || p.modo === 'mese') return 'giorno';
  if (p.modo === '6mesi' || p.modo === 'anno') return 'mese';
  const giorni = giorniTra(p.da, p.a) + 1;
  if (giorni <= 31) return 'giorno';
  if (giorni <= 182) return 'settimana';
  if (giorni <= 730) return 'mese';
  return 'anno';
}

/**
 * Le parti del periodo, in ordine: [{ da, a, breve, lunga }] (`breve` per l'asse, `lunga` per la nota al tocco).
 * Non include quelle che iniziano dopo oggi. Il periodo va già "effettivo" (vedi periodoEffettivo).
 */
export function sottoperiodi(p, giornoInizio, oggi) {
  const gran = granularita(p);
  if (!gran) return [];
  const parti = [];
  const min = (x, y) => (x < y ? x : y);
  const max = (x, y) => (x > y ? x : y);

  if (gran === 'giorno') {
    for (let d = p.da; d <= p.a && d <= oggi; d = aggiungiGiorni(d, 1)) {
      parti.push({ da: d, a: d, breve: String(daIso(d).g), lunga: etichettaIntervallo(d, d) });
    }
  } else if (gran === 'settimana') {
    let lunedi = aggiungiGiorni(p.da, -((new Date(Date.UTC(daIso(p.da).a, daIso(p.da).m - 1, daIso(p.da).g)).getUTCDay() + 6) % 7));
    for (; lunedi <= p.a && lunedi <= oggi; lunedi = aggiungiGiorni(lunedi, 7)) {
      const da = max(lunedi, p.da);
      const a = min(aggiungiGiorni(lunedi, 6), p.a);
      const { g, m } = daIso(da);
      parti.push({ da, a, breve: `${g}/${m}`, lunga: etichettaIntervallo(da, a) });
    }
  } else if (gran === 'mese') {
    for (let ciclo = cicloContenente(p.da, giornoInizio); ciclo.inizio <= p.a && ciclo.inizio <= oggi; ciclo = cicloSuccessivo(ciclo, giornoInizio)) {
      const meta = aggiungiGiorni(ciclo.inizio, 14); // il ciclo dal 27 al 26 è "quasi tutto" nel mese dopo
      parti.push({
        da: max(ciclo.inizio, p.da),
        a: min(ciclo.fine, p.a),
        breve: meseBreve(meta),
        lunga: giornoInizio === 1 ? meseAnno(meta) : etichettaCiclo(ciclo, giornoInizio),
      });
    }
  } else {
    for (let anno = daIso(p.da).a; anno <= daIso(p.a).a && aIso(anno, 1, 1) <= oggi; anno += 1) {
      parti.push({ da: max(aIso(anno, 1, 1), p.da), a: min(aIso(anno, 12, 31), p.a), breve: String(anno), lunga: String(anno) });
    }
  }
  return parti;
}

/** Entrate, spese e risparmio per ogni parte. I trasferimenti non contano. */
export function totaliPerSottoperiodo(movimenti, parti) {
  return parti.map((parte) => {
    let entrate = 0;
    let spese = 0;
    for (const m of movimenti) {
      if (m.data < parte.da || m.data > parte.a) continue;
      if (m.tipo === 'entrata') entrate += m.importo;
      else if (m.tipo === 'spesa') spese += m.importo;
    }
    return { ...parte, entrate, spese, risparmio: entrate - spese };
  });
}

// ---- Confronto con il periodo precedente e con la media ----

const sommaSpese = (movimenti, da, a) => movimenti.reduce((s, m) => (m.tipo === 'spesa' && m.data >= da && m.data <= a ? s + m.importo : s), 0);

/**
 * "Sto spendendo più o meno di prima?" Spese del periodo, confronto con il periodo equivalente precedente e con la
 * media degli ultimi periodi equivalenti. Se il periodo è in corso, si confronta con lo stesso numero di giorni dei
 * periodi precedenti (altrimenti metà mese sembrerebbe un grande risparmio). Il confronto manca se il periodo precedente
 * non è completamente coperto dai dati (inizio storia dopo il suo primo giorno); la media manca con meno di due periodi precedenti completi. Con "sempre" non c'è confronto.
 */
export function confrontoSpese({ movimenti, periodo, giornoInizio, primaData, oggi }) {
  const inCorso = periodo.modo !== 'sempre' && contieneData(periodo, oggi) && oggi < periodo.a;
  const giorniTrascorsi = inCorso ? giorniTra(periodo.da, oggi) + 1 : null;
  const totale = sommaSpese(movimenti, periodo.da, periodo.a);
  const base = { totale, inCorso, precedente: null, variazione: null, media: null };
  if (periodo.modo === 'sempre') return base;

  const troncato = (p) => (inCorso ? { da: p.da, a: aggiungiGiorni(p.da, giorniTrascorsi - 1) < p.a ? aggiungiGiorni(p.da, giorniTrascorsi - 1) : p.a } : p);

  const prec = periodoPrecedente(periodo, giornoInizio);
  if (prec.da < primaData) return base; // il periodo precedente non è completo: il confronto non sarebbe giusto
  const precTotale = sommaSpese(movimenti, troncato(prec).da, troncato(prec).a);
  const precedente = { periodo: prec, totale: precTotale };
  const variazione = {
    assoluta: totale - precTotale,
    percentuale: precTotale > 0 ? ((totale - precTotale) / precTotale) * 100 : null,
  };

  const totali = [];
  for (let p = prec, i = 0; i < MAX_PERIODI_MEDIA && p.da >= primaData; p = periodoPrecedente(p, giornoInizio), i += 1) {
    totali.push(sommaSpese(movimenti, troncato(p).da, troncato(p).a));
  }
  let media = null;
  if (totali.length >= MIN_PERIODI_MEDIA) {
    const valore = Math.round(totali.reduce((s, t) => s + t, 0) / totali.length);
    media = { valore, periodi: totali.length, percentuale: valore > 0 ? ((totale - valore) / valore) * 100 : null };
  }
  return { ...base, precedente, variazione, media };
}

/** «a ieri», «alla settimana precedente», «a settembre», «ai 6 mesi precedenti», «al 2025»: per «rispetto …». */
export function nomePeriodoPrecedente(prec, giornoInizio, oggi) {
  if (prec.modo === 'giorno') return prec.da === aggiungiGiorni(oggi, -1) ? 'a ieri' : `al ${etichettaIntervallo(prec.da, prec.da)}`;
  if (prec.modo === 'settimana') return 'alla settimana precedente';
  if (prec.modo === 'mese') {
    if (giornoInizio !== 1) return 'al ciclo precedente';
    const anno = daIso(prec.da).a;
    return `a ${nomeMese(prec.da)}${anno === daIso(oggi).a ? '' : ` ${anno}`}`;
  }
  if (prec.modo === '6mesi') return 'ai 6 mesi precedenti';
  if (prec.modo === 'anno') return `al ${daIso(prec.da).a}`;
  return 'al periodo precedente';
}

// ---- Ciambella ----

/**
 * Le fette della ciambella: le prime `massimo` categorie e, se ce ne sono di più, il resto riunito in "Altre"
 * (così non ci sono decine di fette sottilissime). `righe` viene da totaliPerCategoria.
 */
export function fetteCiambella(righe, massimo = 8) {
  if (righe.length <= massimo + 1) return righe.map((r) => ({ ...r, altre: false }));
  const prime = righe.slice(0, massimo).map((r) => ({ ...r, altre: false }));
  const resto = righe.slice(massimo);
  const totale = resto.reduce((s, r) => s + r.totale, 0);
  return [...prime, {
    categoriaId: null, altre: true, totale, conteggio: resto.reduce((s, r) => s + r.conteggio, 0),
    percentuale: resto.reduce((s, r) => s + r.percentuale, 0),
  }];
}
