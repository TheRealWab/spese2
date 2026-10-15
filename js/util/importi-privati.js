// Importi nell'area Patrimonio: con l'occhio "nascondi" attivo si vedono dei pallini al posto delle cifre
// (le percentuali restano visibili: non rivelano quanto vale il patrimonio).

import { euro } from './formato.js';
import { impostazioni } from '../model/impostazioni.js';

export const MASCHERA_IMPORTO = '••••• €';

export const importiNascosti = () => Boolean(impostazioni().nascondiImportiPatrimonio);

/** L'importo formattato, oppure i pallini se gli importi sono nascosti. `formato` è uno dei formattatori di formato.js. */
export function mostraImporto(centesimi, formato = euro) {
  return importiNascosti() ? MASCHERA_IMPORTO : formato(centesimi);
}
