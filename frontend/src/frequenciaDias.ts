// ─── Codificação dia a dia da frequência ───────────────────────────────────
// O campo Falta.frequencia guarda o status de cada dia letivo do mês como uma
// string "DIAS:PPPFPP..." (um caractere por dia). Extraído de Faltas.tsx para
// ser reaproveitado por qualquer tela que precise decodificar isso (ex.:
// Painel Analítico, para calcular sequências de faltas seguidas).

export type StatusDia = 'P' | 'F' | 'J' | 'A';
export const CICLO_STATUS: StatusDia[] = ['P', 'F', 'J', 'A'];

export function decodeDias(freq: string, n: number): StatusDia[] {
  if (freq?.startsWith('DIAS:')) {
    const chars = freq.slice(5).split('');
    return Array(n).fill('P').map((_, i) =>
      CICLO_STATUS.includes(chars[i] as StatusDia) ? (chars[i] as StatusDia) : 'P'
    ) as StatusDia[];
  }
  return Array(n).fill('P') as StatusDia[];
}

// Maior sequência de faltas ('F') não justificadas seguidas dentro de um único
// array de dias (um mês). Dias não letivos já ficam fora do array, então a
// contagem naturalmente pula recesso/férias/fins de semana.
export function maiorSequenciaFalta(dias: StatusDia[]): number {
  let maior = 0;
  let atual = 0;
  for (const dia of dias) {
    if (dia === 'F') { atual++; maior = Math.max(maior, atual); }
    else atual = 0;
  }
  return maior;
}
