// Blocco dell'app (SPEC §9.1): regole pure e PIN. Nessun accesso a database o interfaccia, così si testa in Node.
//
// Onestà sul livello di protezione: il blocco è una barriera dell'INTERFACCIA. Non cifra i dati nel browser:
// tiene fuori chi prende il telefono sbloccato e apre l'app, non chi smonta i dati del browser.

export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const ITERAZIONI_PIN = 200_000;
export const ERRORI_PER_PAUSA = 5; // ogni 5 PIN sbagliati l'app fa aspettare
export const PAUSA_BASE_SECONDI = 30;
export const PAUSA_MASSIMA_SECONDI = 900;
export const MINUTI_BLOCCO = [1, 5, 15];

export const SICUREZZA_PREDEFINITA = { attiva: false, pin: null, impronta: null, minuti: 1 };

/** Impostazioni di sicurezza complete, anche se nel database ne è salvata solo una parte. */
export const leggiSicurezza = (salvate) => ({ ...SICUREZZA_PREDEFINITA, ...(salvate ?? {}) });

// ---- base64 (URL-safe, per gli identificativi WebAuthn) ----

export function aBase64Url(byte) {
  let testo = '';
  for (let i = 0; i < byte.length; i += 0x8000) testo += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(testo).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function daBase64Url(testo) {
  const standard = testo.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(standard + '='.repeat((4 - (standard.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

// ---- PIN ----

/** Messaggio d'errore in italiano, oppure null se il PIN è accettabile. */
export function validaPin(pin) {
  if (typeof pin !== 'string' || !new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)) {
    return `Il PIN deve avere da ${PIN_MIN} a ${PIN_MAX} cifre.`;
  }
  const cifre = [...pin].map(Number);
  const tutteUguali = cifre.every((c) => c === cifre[0]);
  const scala = (passo) => cifre.every((c, i) => i === 0 || c - cifre[i - 1] === passo);
  if (tutteUguali || scala(1) || scala(-1)) return 'Questo PIN è troppo semplice: scegline un altro.';
  return null;
}

const codifica = new TextEncoder();

async function derivaHash(pin, sale, iterazioni) {
  const base = await crypto.subtle.importKey('raw', codifica.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sale, iterations: iterazioni, hash: 'SHA-256' }, base, 256);
  return new Uint8Array(bit);
}

/** Dati da salvare per riconoscere il PIN più tardi. Il PIN stesso non viene mai salvato. */
export async function creaVerificaPin(pin, iterazioni = ITERAZIONI_PIN) {
  const sale = crypto.getRandomValues(new Uint8Array(16));
  return { sale: aBase64Url(sale), hash: aBase64Url(await derivaHash(pin, sale, iterazioni)), iterazioni, lunghezza: pin.length };
}

export async function verificaPin(pin, verifica) {
  if (!verifica || typeof pin !== 'string') return false;
  const atteso = daBase64Url(verifica.hash);
  const calcolato = await derivaHash(pin, daBase64Url(verifica.sale), verifica.iterazioni);
  let differenze = atteso.length ^ calcolato.length; // confronto a tempo costante
  for (let i = 0; i < Math.min(atteso.length, calcolato.length); i += 1) differenze |= atteso[i] ^ calcolato[i];
  return differenze === 0;
}

// ---- Tentativi sbagliati ----

export const TENTATIVI_INIZIALI = { errori: 0, finoA: 0 };

/** Secondi di attesa dopo `errori` PIN sbagliati: 0 finché non si raggiunge la soglia, poi 30 s, 60 s, 120 s… fino a 15 min. */
export function pausaDopoErrori(errori) {
  if (errori < ERRORI_PER_PAUSA || errori % ERRORI_PER_PAUSA !== 0) return 0;
  const volte = errori / ERRORI_PER_PAUSA;
  return Math.min(PAUSA_BASE_SECONDI * 2 ** (volte - 1), PAUSA_MASSIMA_SECONDI);
}

export function registraErrore(stato, adesso) {
  const errori = (stato?.errori ?? 0) + 1;
  const pausa = pausaDopoErrori(errori);
  return { errori, finoA: pausa ? adesso + pausa * 1000 : 0 };
}

/** { bloccato, secondi }: se l'app sta ancora facendo aspettare e quanto. */
export function attesaRimasta(stato, adesso) {
  const restante = (stato?.finoA ?? 0) - adesso;
  return restante > 0 ? { bloccato: true, secondi: Math.ceil(restante / 1000) } : { bloccato: false, secondi: 0 };
}

// ---- Quando bloccare ----

/**
 * Serve la schermata di blocco?
 *  - blocco non attivo: mai;
 *  - app non ancora sbloccata in questa sessione (apertura da zero): sì;
 *  - tornando da lontano: sì se è rimasta in background più di `minuti` minuti.
 * Una ricarica della pagina (es. aggiornamento automatico) mantiene lo stato "sbloccato": non richiede il PIN.
 */
export function deveBloccare({ attiva, sbloccato, nascostaIl, adesso, minuti }) {
  if (!attiva) return false;
  if (!sbloccato) return true;
  return Boolean(nascostaIl) && adesso - nascostaIl > minuti * 60_000;
}
