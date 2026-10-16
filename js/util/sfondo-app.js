// Mette lo sfondo scelto sulla pagina: la variabile --sfondo-sfumato (css/tokens.css) viene usata dallo strato fisso
// dietro all'app, dai pannelli a tutto schermo e dalla schermata di blocco.

import { cssSfondo } from '../model/aspetto.js';

export function applicaSfondo(sfondo) {
  const css = cssSfondo(sfondo);
  const stile = document.documentElement.style;
  if (css) stile.setProperty('--sfondo-sfumato', css);
  else stile.removeProperty('--sfondo-sfumato'); // torna quello del tema
}
