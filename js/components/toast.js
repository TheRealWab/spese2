// Messaggi brevi in basso, con un'azione facoltativa (es. "Aggiorna").

import { esc } from '../util/dom.js';

export function mostraToast(testo, { azione = null, durata = 3200 } = {}) {
  const strato = document.getElementById('strato-toast');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<span>${esc(testo)}</span>${azione ? `<button type="button">${esc(azione.etichetta)}</button>` : ''}`;
  strato.append(toast);

  const chiudi = () => {
    toast.classList.add('esce');
    setTimeout(() => toast.remove(), 260);
  };
  if (azione) {
    toast.querySelector('button').addEventListener('click', () => { azione.alClick(); chiudi(); });
  }
  if (durata > 0) setTimeout(chiudi, durata);
  return chiudi;
}
