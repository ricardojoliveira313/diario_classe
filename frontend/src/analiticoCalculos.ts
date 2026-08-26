// ─── Funções puras do Painel Analítico ──────────────────────────────────────
// Extraídas de Analitico.tsx para serem testáveis isoladamente (auditoria
// externa apontou que não havia nenhum teste automatizado para os cálculos
// desta aba).

// Data de referência oficial do INEP para distorção idade-série: 31/03.
export function calcIdadeEm31Marco(dataNasc: string, ano: number): number {
  if (!dataNasc) return 0;
  const partes = dataNasc.split('/');
  if (partes.length !== 3) return 0;
  const nasc = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
  if (isNaN(nasc.getTime())) return 0;
  const ref = new Date(ano, 2, 31);
  let idade = ref.getFullYear() - nasc.getFullYear();
  const m = ref.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function extrairSerie(nomeTurma: string): number | null {
  const m = nomeTurma.match(/^(\d)/);
  return m ? parseInt(m[1], 10) : null;
}

export type Etapa = 'Infantil' | 'Fundamental' | 'EJA' | 'AEE';

export function etapaDaTurma(nomeTurma: string): Etapa {
  const nome = nomeTurma.toUpperCase();
  if (/^AEE\b/.test(nome)) return 'AEE';
  if (/\bEJA\b/.test(nome)) return 'EJA';
  if (/ETAPA/.test(nome)) return 'Infantil';
  return 'Fundamental';
}

// Um registro de Falta com faltas=0 só representa presença real quando foi
// EXPLICITAMENTE confirmado (conferido_sem_faltas) — mesma regra da aba
// BF-Frequência. Sem essa confirmação, é um mês ainda não conferido pela
// escola, e contá-lo como 100% de frequência infla artificialmente qualquer
// média. Por isso todo cálculo de frequência (%) deste painel ignora esses
// registros pendentes por completo, em vez de tratá-los como presença.
export function estaPendente(f: { faltas?: number | null; conferido_sem_faltas?: boolean }): boolean {
  return (f.faltas ?? 0) === 0 && f.conferido_sem_faltas !== true;
}

// Só um registro lançado dia a dia na Grade tem posições de dia reais — o
// Lançamento Rápido empilha os totais digitados nos primeiros dias letivos
// do mês (diasFromCounts, em Faltas.tsx) só para fins de contagem, o que
// tornaria qualquer cálculo de "sequência consecutiva" fictício.
export function contaParaSequenciaReal(f: { origem_frequencia?: string | null }): boolean {
  return f.origem_frequencia === 'DIA_A_DIA';
}
