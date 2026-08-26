// ─── Pertencimento ao Educacenso pela DATA DE CORTE ─────────────────────────
// Um aluno pertence ao Educacenso da escola conforme a situação dele NA DATA
// DE CORTE (data-base do Censo) — nunca pela situação ATUAL. Na hora em que
// o operador faz o cruzamento (semanas ou meses depois do corte), um aluno
// transferido DEPOIS do corte já está com situação de saída no cadastro,
// mas ainda era nosso na data-base e tem que contar; e um aluno matriculado
// DEPOIS do corte pode já estar ATIVO hoje, mas na data-base ainda não era
// nosso.

import { parseData, situacaoNormalizada, ehAtivo } from './situacoes';

export function estavaMatriculadoNaData(aluno: any, dataCorte: Date): boolean {
  const inicio = parseData(aluno.data_inicio_matricula);
  if (inicio && inicio.getTime() > dataCorte.getTime()) return false; // matriculado depois do corte
  if (ehAtivo(situacaoNormalizada(aluno))) return true; // ainda ativo hoje e já matriculado até o corte
  // Situação de saída: só conta se a saída aconteceu DEPOIS do corte (ainda
  // era nosso na data-base). Sem data de saída registrada, não dá pra
  // confirmar — trata como não-nosso na data (mais seguro que assumir que sim).
  const saida = parseData(aluno.data_movimentacao) ?? parseData(aluno.data_fim_matricula);
  return saida ? saida.getTime() >= dataCorte.getTime() : false;
}
