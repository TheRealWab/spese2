// Salva un testo come file sul telefono (cartella Download), senza server né librerie.

export function scaricaFile(nome, testo, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([testo], { type: tipo }));
  const collegamento = document.createElement('a');
  collegamento.href = url;
  collegamento.download = nome;
  document.body.append(collegamento);
  collegamento.click();
  collegamento.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}
