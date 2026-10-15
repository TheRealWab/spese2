// Ricerca delle icone Lucide per parola, in italiano o in inglese. Solo funzioni pure.
//
// Si cerca tra i nomi delle icone ("shopping-cart") e le loro parole chiave inglesi; le parole italiane vengono
// tradotte con il dizionario in parole-icone.js. Ogni parola scritta deve trovare qualcosa (E logica tra le parole).

import { PAROLE_IT } from './parole-icone.js';

/** Minuscole e senza accenti: "Caffè" → "caffe". */
export const normalizza = (testo) => String(testo ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

/**
 * Parole inglesi collegate a una parola italiana. Una parola identica a una del dizionario pesa di più di una
 * scritta solo in parte ("gatt" → gatto): così "auto" mette "car" prima di "bus" (che viene da "autobus").
 */
function traduci(parola) {
  if (parola.length < 2) return [];
  const trovate = new Map();
  const aggiungi = (inglese, peso) => trovate.set(inglese, Math.max(trovate.get(inglese) ?? 0, peso));
  for (const [it, inglesi] of Object.entries(PAROLE_IT)) {
    // Le traduzioni sono scritte dalla più pertinente alla meno: un piccolo sconto per posizione le tiene in ordine.
    if (it === parola) inglesi.forEach((i, k) => aggiungi(i, 0.9 - 0.01 * k));
    else if (parola.length >= 3 && it.startsWith(parola)) inglesi.forEach((i, k) => aggiungi(i, 0.6 - 0.01 * k));
  }
  return [...trovate].map(([tradotta, peso]) => ({ parola: tradotta, peso, tradotta: true }));
}

const parole = (testo) => testo.split(/[\s-]+/).filter(Boolean);

// Punteggio di una parola cercata su un'icona: 0 = nessuna corrispondenza. Le parole tradotte dal dizionario sono
// precise (nomi di icone e parole inglesi intere): per loro valgono solo le corrispondenze esatte, senza rumore.
function punteggio(cercata, nome, paroleNome, paroleTag, tradotta) {
  if (nome === cercata) return 120;
  if (paroleNome.includes(cercata)) return 100;
  if (paroleTag.includes(cercata)) return 50;
  if (tradotta) return 0;
  if (paroleNome.some((p) => p.startsWith(cercata))) return 75;
  if (cercata.length >= 3 && paroleTag.some((p) => p.startsWith(cercata))) return 30;
  if (cercata.length >= 3 && nome.includes(cercata)) return 20;
  return 0;
}

/**
 * @param {string} ricerca  quello che scrive l'utente
 * @param {string[]} nomi  nomi di tutte le icone
 * @param {Record<string,string>} tag  nome → parole chiave separate da spazi
 * @param {number} massimo  quante icone restituire al massimo
 * @returns {string[]} nomi delle icone, dalla più pertinente
 */
export function cercaIcone(ricerca, nomi, tag, massimo = 120) {
  const cercate = normalizza(ricerca).split(/\s+/).filter(Boolean);
  if (!cercate.length) return [];
  // Per ogni parola: quella scritta (peso pieno) e le sue traduzioni.
  const alternative = cercate.map((c) => [{ parola: c, peso: 1, tradotta: false }, ...traduci(c)]);

  const risultati = [];
  for (const nome of nomi) {
    const paroleNome = parole(nome);
    const paroleTag = parole(tag[nome] ?? '');
    let totale = 0;
    for (const opzioni of alternative) {
      let migliore = 0;
      for (const { parola, peso, tradotta } of opzioni) {
        migliore = Math.max(migliore, punteggio(parola, nome, paroleNome, paroleTag, tradotta) * peso);
      }
      if (!migliore) { totale = 0; break; } // ogni parola scritta deve trovare qualcosa
      totale += migliore;
    }
    if (totale) risultati.push({ nome, totale });
  }
  return risultati
    .sort((a, b) => b.totale - a.totale || a.nome.length - b.nome.length || a.nome.localeCompare(b.nome))
    .slice(0, massimo)
    .map((r) => r.nome);
}
