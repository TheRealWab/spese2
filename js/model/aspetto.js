// Aspetto personale dell'app: sfondo e profilo (nome e foto). Solo funzioni pure, così si provano in Node.
// I valori stanno nel record delle impostazioni (chiavi `profilo` e `sfondo`) e quindi viaggiano nel backup.

export const LUNGHEZZA_MASSIMA_NOME = 30;
export const ATTENUA_PREDEFINITA = 50; // % di "velo" del colore del tema sopra la foto di sfondo
export const ATTENUA_MASSIMA = 85;

// Una foto salvata è un'immagine in forma di testo (data URL). Si accetta solo questa forma esatta: finisce dentro
// un url("…") di CSS e in un attributo src, quindi niente virgolette, parentesi o altro.
const FORMA_FOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const LIMITE_FOTO = 2_000_000; // caratteri: una foto ridimensionata ne occupa molti meno

export const fotoValida = (x) => typeof x === 'string' && x.length <= LIMITE_FOTO && FORMA_FOTO.test(x);

export const PROFILO_PREDEFINITO = { nome: '', foto: null };
export const SFONDO_PREDEFINITO = { id: 'predefinito', foto: null, attenua: ATTENUA_PREDEFINITA };

// ---- Sfondi pronti ----
// Ognuno è fatto di due aloni di colore sopra lo sfondo di base del tema. Il colore è lo stesso in chiaro e in scuro,
// cambia l'intensità (più tenue sul chiaro, un po' più viva sullo scuro).
const alone = (colore, posizione, [chiaro, scuro]) =>
  `radial-gradient(120% 55% at ${posizione}, light-dark(color-mix(in srgb, ${colore} ${chiaro}%, transparent), color-mix(in srgb, ${colore} ${scuro}%, transparent)), transparent 72%)`;

// `anteprima` è la stessa sfumatura più marcata: nelle tessere piccole della scelta si distinguerebbe poco.
const coppia = (a, posA, b, posB, forza = [20, 26]) => ({
  css: `${alone(a, posA, forza)}, ${alone(b, posB, forza)}`,
  anteprima: `${alone(a, posA, forza.map((f) => Math.min(70, f * 2)))}, ${alone(b, posB, forza.map((f) => Math.min(70, f * 2)))}`,
});

export const SFONDI = [
  { id: 'predefinito', nome: 'Wallet', css: null, anteprima: coppia('#4f46e5', '0% 0%', '#0e8f9c', '100% 100%').anteprima }, // lo sfondo vero usa i colori del tema (tokens.css)
  { id: 'tramonto', nome: 'Tramonto', ...coppia('#ff8a3d', '100% 0%', '#e23f7b', '0% 100%') },
  { id: 'oceano', nome: 'Oceano', ...coppia('#2f7de1', '50% 0%', '#0e8f9c', '50% 100%') },
  { id: 'foresta', nome: 'Foresta', ...coppia('#1f9d55', '0% 0%', '#5f9d12', '100% 100%') },
  { id: 'lavanda', nome: 'Lavanda', ...coppia('#9b4fd8', '100% 0%', '#f27fd3', '0% 100%') },
  { id: 'ambra', nome: 'Ambra', ...coppia('#f5a524', '0% 0%', '#e5484d', '100% 100%') },
  { id: 'ghiaccio', nome: 'Ghiaccio', ...coppia('#4cc3f0', '0% 0%', '#6aa8ff', '100% 100%') },
  { id: 'fucsia', nome: 'Fucsia', ...coppia('#cf3ba8', '100% 0%', '#5b4fe0', '0% 100%') },
  { id: 'notte', nome: 'Notte', ...coppia('#3b5bdb', '0% 0%', '#5b4fe0', '100% 100%', [26, 38]) },
  { id: 'grafite', nome: 'Grafite', ...coppia('#5f6b7e', '0% 0%', '#5f6b7e', '100% 100%', [20, 26]) },
  { id: 'semplice', nome: 'Semplice', css: 'linear-gradient(transparent, transparent)', anteprima: null }, // solo il colore di base
];

export const ID_SFONDO_FOTO = 'foto';

export const sfondoPerId = (id) => SFONDI.find((s) => s.id === id) ?? null;

/** Rende sicuro un valore letto dalle impostazioni o da un backup: ciò che non torna diventa il valore predefinito. */
export function normalizzaSfondo(x) {
  const id = typeof x?.id === 'string' ? x.id : SFONDO_PREDEFINITO.id;
  const foto = fotoValida(x?.foto) ? x.foto : null;
  const attenua = Number.isFinite(x?.attenua) ? Math.min(ATTENUA_MASSIMA, Math.max(0, Math.round(x.attenua))) : ATTENUA_PREDEFINITA;
  const esiste = id === ID_SFONDO_FOTO ? foto !== null : sfondoPerId(id) !== null;
  return { id: esiste ? id : SFONDO_PREDEFINITO.id, foto, attenua };
}

export function nomeSfondo(sfondo) {
  const s = normalizzaSfondo(sfondo);
  return s.id === ID_SFONDO_FOTO ? 'La tua foto' : (sfondoPerId(s.id)?.nome ?? '');
}

/** Il CSS per la variabile --sfondo-sfumato, oppure null per lasciare quello di tokens.css. */
export function cssSfondo(sfondo) {
  const s = normalizzaSfondo(sfondo);
  if (s.id === ID_SFONDO_FOTO) {
    const velo = `color-mix(in srgb, var(--sfondo) ${s.attenua}%, transparent)`;
    return `linear-gradient(${velo}, ${velo}), url("${s.foto}") center / cover no-repeat`;
  }
  return sfondoPerId(s.id)?.css ?? null;
}

// ---- Ritaglio quadrato della foto profilo ----

export const ZOOM_MASSIMO = 4;

/**
 * Il quadrato dell'immagine originale da mostrare nel cerchio. `zoom` 1 = il quadrato più grande possibile,
 * 2 = la metà del lato; (cx, cy) è il centro scelto, in pixel dell'originale. Il quadrato resta sempre dentro l'immagine.
 */
export function riquadroQuadrato({ larghezza, altezza, zoom = 1, cx = larghezza / 2, cy = altezza / 2 }) {
  const z = Math.min(ZOOM_MASSIMO, Math.max(1, zoom));
  const lato = Math.min(larghezza, altezza) / z;
  const x = Math.min(larghezza - lato, Math.max(0, cx - lato / 2));
  const y = Math.min(altezza - lato, Math.max(0, cy - lato / 2));
  return { x, y, lato };
}

// ---- Profilo ----

export function normalizzaNome(testo) {
  return String(testo ?? '').replace(/\s+/g, ' ').trim().slice(0, LUNGHEZZA_MASSIMA_NOME);
}

export function normalizzaProfilo(x) {
  return { nome: normalizzaNome(x?.nome), foto: fotoValida(x?.foto) ? x.foto : null };
}

/** Le due lettere del cerchio quando non c'è la foto: iniziale del nome, oppure nulla. */
export function iniziali(nome) {
  const parole = normalizzaNome(nome).split(' ').filter(Boolean);
  if (!parole.length) return '';
  return (parole.length === 1 ? parole[0].slice(0, 1) : parole[0][0] + parole[parole.length - 1][0]).toLocaleUpperCase('it-IT');
}

/**
 * Da quando si usa l'app, per chi non ha ancora una data salvata: il giorno del primo movimento creato qui
 * (i movimenti importati dalla vecchia app non contano: hanno la data della vecchia app), oppure oggi.
 */
export function primoAvvioStimato(movimenti, oggi) {
  const giorni = movimenti.filter((m) => !m.origineId && typeof m.creatoIl === 'string').map((m) => m.creatoIl.slice(0, 10)).sort();
  return giorni.length && giorni[0] < oggi ? giorni[0] : oggi;
}

/**
 * Impostazioni dopo un ripristino che sostituisce tutto: vale ciò che dice il backup, ma un backup creato da una
 * versione senza profilo e sfondo non deve cancellare quelli di questo telefono.
 */
export function aspettoDopoRipristino(attuali, dalBackup) {
  return {
    profilo: normalizzaProfilo('profilo' in dalBackup ? dalBackup.profilo : attuali.profilo),
    sfondo: normalizzaSfondo('sfondo' in dalBackup ? dalBackup.sfondo : attuali.sfondo),
  };
}
