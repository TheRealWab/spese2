// Riga di un movimento negli elenchi: stessa resa ovunque (Mese ora; Categorie e Patrimonio più avanti).

import { esc } from '../util/dom.js';
import { icona, cerchioIcona } from '../util/icone.js';
import { euro } from '../util/formato.js';
import { categoriaPerId, contoPerId } from '../model/catalogo.js';

const MENO = '−';

/** HTML di una riga. È un <button>: un tocco apre la modifica. */
export function htmlRigaMovimento(m, { evidenzia = false } = {}) {
  const conto = contoPerId(m.contoId);
  let cerchio;
  let titolo;
  let dettaglio;
  let importo;
  let classeImporto = '';

  if (m.tipo === 'trasferimento') {
    const destinazione = contoPerId(m.contoDestinazioneId);
    cerchio = `<span class="cerchio cerchio-neutro" style="--dim:44px">${icona('arrow-left-right', 22)}</span>`;
    titolo = 'Trasferimento';
    dettaglio = `${esc(conto?.nome ?? '—')} → ${esc(destinazione?.nome ?? '—')}`;
    importo = euro(m.importo);
    classeImporto = 'importo-trasferimento';
  } else {
    const categoria = categoriaPerId(m.categoriaId);
    cerchio = cerchioIcona(categoria?.icona ?? 'package', categoria?.colore ?? 'ardesia', 44);
    titolo = esc(categoria?.nome ?? 'Senza categoria');
    const nota = m.nota ? `<span class="mov-nota">${esc(m.nota)}</span>` : '';
    const nomeConto = `<span class="mov-conto">${esc(conto?.nome ?? '—')}</span>`;
    dettaglio = nota ? `${nota} · ${nomeConto}` : nomeConto;
    if (m.tipo === 'entrata') { importo = `+${euro(m.importo)}`; classeImporto = 'importo-entrata'; }
    else importo = `${MENO}${euro(m.importo)}`;
  }

  return `
    <button type="button" class="riga-mov ${evidenzia ? 'appena-aggiunto' : ''}" data-id="${esc(m.id)}">
      ${cerchio}
      <span class="mov-testo">
        <span class="mov-titolo">${titolo}</span>
        <span class="mov-dettaglio">${dettaglio}</span>
      </span>
      <span class="mov-importo ${classeImporto}">${importo}</span>
    </button>`;
}
