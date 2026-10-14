// Identificatori univoci (UUID v4). randomUUID richiede un contesto sicuro (https/localhost):
// il ripiego permette di provare l'app anche da http in rete locale.

export function nuovoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const byte = globalThis.crypto.getRandomValues(new Uint8Array(16));
  byte[6] = (byte[6] & 0x0f) | 0x40;
  byte[8] = (byte[8] & 0x3f) | 0x80;
  const hex = [...byte].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
