// Foto scelte dalla galleria: lettura, ridimensionamento e ritaglio. Tutto resta sul telefono (canvas del browser).
// Una foto del telefono pesa megabyte: prima di salvarla si riduce, così nelle impostazioni e nel backup ne occupa poche centinaia di KB.

import { riquadroQuadrato } from '../model/aspetto.js';

export class ErroreImmagine extends Error {}

const DIMENSIONE_MASSIMA_FILE = 40 * 1024 * 1024;

/** Legge il file scelto e restituisce l'immagine pronta da disegnare (con l'orientamento corretto). */
export async function apriImmagine(file) {
  if (!file || !String(file.type).startsWith('image/')) throw new ErroreImmagine('Il file scelto non è un\'immagine.');
  if (file.size > DIMENSIONE_MASSIMA_FILE) throw new ErroreImmagine('L\'immagine è troppo grande.');
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ErroreImmagine('Non riesco a leggere questa immagine. Prova con un\'altra foto.');
  }
}

function suCanvas(larghezza, altezza, disegna) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(larghezza));
  canvas.height = Math.max(1, Math.round(altezza));
  const contesto = canvas.getContext('2d');
  contesto.fillStyle = '#ffffff'; // le immagini trasparenti diventano bianche (il JPEG non ha trasparenza)
  contesto.fillRect(0, 0, canvas.width, canvas.height);
  contesto.imageSmoothingQuality = 'high';
  disegna(contesto, canvas);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/** L'immagine ridotta (lato lungo al massimo `latoMax`), come testo da salvare. Per lo sfondo. */
export function riduci(immagine, latoMax = 1600) {
  const scala = Math.min(1, latoMax / Math.max(immagine.width, immagine.height));
  return suCanvas(immagine.width * scala, immagine.height * scala, (c, canvas) => c.drawImage(immagine, 0, 0, canvas.width, canvas.height));
}

/** Il ritaglio quadrato scelto (vedi riquadroQuadrato), a `lato` pixel. Per la foto profilo. */
export function ritaglia(immagine, { zoom, cx, cy }, lato = 256) {
  const r = riquadroQuadrato({ larghezza: immagine.width, altezza: immagine.height, zoom, cx, cy });
  return suCanvas(lato, lato, (c) => c.drawImage(immagine, r.x, r.y, r.lato, r.lato, 0, 0, lato, lato));
}

/** Disegna il ritaglio in un canvas già esistente (l'anteprima mentre si trascina). */
export function disegnaRitaglio(canvas, immagine, { zoom, cx, cy }) {
  const r = riquadroQuadrato({ larghezza: immagine.width, altezza: immagine.height, zoom, cx, cy });
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.imageSmoothingQuality = 'high';
  c.drawImage(immagine, r.x, r.y, r.lato, r.lato, 0, 0, canvas.width, canvas.height);
  return r;
}
