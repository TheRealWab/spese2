// Scorrimento orizzontale come gesto per cambiare periodo (solo gesti decisamente orizzontali).

const SOGLIA_SWIPE = 70;

/** `alSwipe(1)` = verso sinistra (successivo), `alSwipe(-1)` = verso destra (precedente). */
export function abilitaSwipe(elemento, alSwipe) {
  let inizioX = 0;
  let inizioY = 0;
  let inizioT = 0;
  elemento.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    inizioX = e.touches[0].clientX;
    inizioY = e.touches[0].clientY;
    inizioT = Date.now();
  }, { passive: true });
  elemento.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - inizioX;
    const dy = t.clientY - inizioY;
    if (Math.abs(dx) > SOGLIA_SWIPE && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - inizioT < 700) {
      alSwipe(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}
