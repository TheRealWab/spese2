// Copia in memoria di conti e categorie (poche decine di elementi): le viste li leggono di continuo
// per icone, colori e nomi. Si ricarica quando cambiano.

import { tuttiIConti } from './conti.js';
import { tutteLeCategorie } from './categorie.js';

let conti = [];
let categorie = [];
let mappaConti = new Map();
let mappaCategorie = new Map();

export async function caricaCatalogo() {
  [conti, categorie] = await Promise.all([tuttiIConti(), tutteLeCategorie()]);
  mappaConti = new Map(conti.map((c) => [c.id, c]));
  mappaCategorie = new Map(categorie.map((c) => [c.id, c]));
}

export const tuttiIContiInMemoria = () => conti;
export const contiAttivi = () => conti.filter((c) => !c.archiviato);
export const tutteLeCategorieInMemoria = () => categorie;
export const mappaDeiConti = () => mappaConti;
export const mappaDelleCategorie = () => mappaCategorie;
export const contoPerId = (id) => mappaConti.get(id);
export const categoriaPerId = (id) => mappaCategorie.get(id);
export const categoriaStipendio = () => categorie.find((c) => c.ruolo === 'stipendio' && !c.archiviata);
