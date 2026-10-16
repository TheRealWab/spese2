// Impronta digitale tramite WebAuthn con autenticatore "di piattaforma" (il sensore del telefono).
//
// Non c'è un server che verifichi la risposta: se il telefono conferma l'impronta, il blocco si apre.
// È coerente con lo scopo (barriera dell'interfaccia) e con l'avviso mostrato all'utente in Sicurezza.

import { aBase64Url, daBase64Url } from './sicurezza.js';

const casuali = (n) => crypto.getRandomValues(new Uint8Array(n));

/** Il telefono ha un sensore di impronte (o altro sblocco biometrico) utilizzabile da una pagina web? */
export async function improntaDisponibile() {
  try {
    return Boolean(window.PublicKeyCredential) && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Crea la credenziale (il telefono chiede l'impronta). Restituisce il suo identificativo, oppure lancia un errore. */
export async function registraImpronta() {
  const credenziale = await navigator.credentials.create({
    publicKey: {
      challenge: casuali(32),
      rp: { name: 'Wallet', id: location.hostname },
      user: { id: casuali(16), name: 'spese2', displayName: 'Wallet' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  });
  return aBase64Url(new Uint8Array(credenziale.rawId));
}

/** Chiede l'impronta. true se confermata; false se annullata, fallita o non disponibile. */
export async function verificaImpronta(idCredenziale) {
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: casuali(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: daBase64Url(idCredenziale), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return true;
  } catch {
    return false;
  }
}
