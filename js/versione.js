// Versione dell'app. Va tenuta uguale alla costante VERSIONE in sw.js (lo verifica un test):
// cambiare versione cambia il nome della cache e fa scaricare i file aggiornati.

export const VERSIONE_APP = '2.0.1';

// Il nome che si legge nell'app. Dentro il codice e i file di backup restano gli identificativi tecnici
// "spese2" (database, cache, formato del backup): cambiarli farebbe perdere i dati già salvati.
export const NOME_APP = 'Wallet';
export const CREATORE = 'WAB2012';

// Mostrata nella schermata di blocco (Warren Buffett).
export const FRASE = {
  testo: 'La prima regola: non perdere denaro. La seconda: non dimenticare mai la prima.',
  autore: 'Warren Buffett',
};
