// Tavolozza delle categorie. I nomi corrispondono ai token --cat-<nome> in css/tokens.css
// e alle classi .col-<nome> in css/components.css (un test verifica che restino allineati).

export const COLORI_CATEGORIA = [
  'corallo', 'arancio', 'ambra', 'lime', 'verde', 'smeraldo', 'turchese', 'ciano',
  'azzurro', 'blu', 'indaco', 'viola', 'fucsia', 'rosa', 'ardesia',
];

// Valori del tema chiaro (gli stessi di --cat-<nome> in tokens.css; un test li confronta).
// Servono a trovare il colore più vicino a un colore esadecimale, per esempio quello della vecchia app.
export const ESADECIMALI_CHIARI = {
  corallo: '#e5484d', arancio: '#e8710a', ambra: '#b7791f', lime: '#5f9d12', verde: '#1f9d55',
  smeraldo: '#0b8f6a', turchese: '#0e8f9c', ciano: '#0891c7', azzurro: '#2f7de1', blu: '#3b5bdb',
  indaco: '#5b4fe0', viola: '#9b4fd8', fucsia: '#cf3ba8', rosa: '#e23f7b', ardesia: '#5f6b7e',
};

/** Colore della tavolozza più vicino a un colore "#rrggbb". Se il valore non è valido: "ardesia" (neutro). */
export function coloreVicino(esadecimale) {
  const rgb = (h) => (/^#[0-9a-f]{6}$/i.test(h ?? '') ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null);
  const cercato = rgb(esadecimale);
  if (!cercato) return 'ardesia';
  let migliore = 'ardesia';
  let distanzaMinima = Infinity;
  for (const [nome, hex] of Object.entries(ESADECIMALI_CHIARI)) {
    const distanza = rgb(hex).reduce((somma, v, i) => somma + (v - cercato[i]) ** 2, 0);
    if (distanza < distanzaMinima) { distanzaMinima = distanza; migliore = nome; }
  }
  return migliore;
}
