// ─── Classificação de etapa pela nomenclatura da turma ──────────────────────
// Extraído de Analitico.tsx para ser compartilhado com outras telas (ex.:
// Bilhetes) sem duplicar a mesma lógica em dois lugares.

export type Etapa = 'Infantil' | 'Fundamental' | 'EJA' | 'AEE';

export function etapaDaTurma(nomeTurma: string): Etapa {
  const nome = nomeTurma.toUpperCase();
  if (/^AEE\b/.test(nome)) return 'AEE';
  if (/\bEJA\b/.test(nome)) return 'EJA';
  if (/ETAPA/.test(nome)) return 'Infantil';
  return 'Fundamental';
}
