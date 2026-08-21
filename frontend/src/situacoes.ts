// ─── Consolidação de situação por aluno ────────────────────────────────────
// Um mesmo aluno pode ter mais de um registro na tabela Aluno ao longo do
// tempo (ex.: uma baixa por transferência BXTR seguida de uma matrícula nova
// ATIVO em outra data). Antes de decidir se ele deve aparecer como
// "transferido", é preciso comparar TODOS os registros da mesma pessoa e
// fazer o mais recente prevalecer — nunca listar com base num registro
// isolado, ignorando os outros.

export const SITUACOES_NAO_ATIVAS = ['REMA', 'BXTR', 'TRAN', 'N COM', 'ABAN'];

export interface RegistroVencedor {
  aluno: any;
  situacaoNorm: string;
  data: Date | null;
}

// Mesmo parser de data usado em matriculasMensais.ts (aceita ISO e dd/mm/aaaa).
export function parseData(valor: unknown): Date | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  let ano: number, mes: number, dia: number;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) { ano = Number(iso[1]); mes = Number(iso[2]); dia = Number(iso[3]); }
  else if (br) { dia = Number(br[1]); mes = Number(br[2]); ano = Number(br[3]); }
  else return null;
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : null;
}

export function formatarData(data: Date | null): string {
  if (!data) return '—';
  return data.toLocaleDateString('pt-BR');
}

export function situacaoNormalizada(aluno: any): string {
  const situacao = String(aluno.situacao ?? '').trim().toUpperCase();
  return situacao || 'ATIVO';
}

export function ehAtivo(situacaoNorm: string): boolean {
  return situacaoNorm === 'ATIVO';
}

// Mesma chave de agrupamento usada em matriculasMensais.ts: RA quando existe,
// senão nome normalizado + data de nascimento — para juntar todos os registros
// da MESMA pessoa (ex.: BXTR de saída + ATIVO de uma matrícula nova depois).
export function chaveAluno(aluno: any): string {
  if (aluno.ra) return `RA:${String(aluno.ra)}`;
  const nome = String(aluno.nome ?? '')
    .toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
  const nascimento = String(aluno.data_nascimento ?? '').replace(/\D/g, '');
  return nome ? `NOME:${nome}|NASC:${nascimento}` : `ID:${aluno.id}`;
}

// Data que representa "quando esse registro passou a valer": para um registro
// ATIVO é a data de início de matrícula (nova entrada); para qualquer situação
// de saída é a data de movimentação/transferência (com data_fim_matricula como
// reserva quando data_movimentacao estiver vazia).
export function dataReferencia(aluno: any): Date | null {
  const situacaoNorm = situacaoNormalizada(aluno);
  if (ehAtivo(situacaoNorm)) return parseData(aluno.data_inicio_matricula);
  return parseData(aluno.data_movimentacao) ?? parseData(aluno.data_fim_matricula);
}

// Entre todos os registros do MESMO aluno (mesma chave), decide qual "vale"
// hoje: o de maior data de referência. Em empate de data, ATIVO prevalece
// sobre qualquer situação de saída (uma matrícula nova no mesmo dia da baixa
// anterior significa que o aluno já está ativo de novo). Um registro sem
// nenhuma data perde sempre para um registro com data — só vence quando
// TODOS os registros do grupo estiverem sem data (não há como comparar).
export function registroVencedor(grupo: any[]): RegistroVencedor {
  let vencedor = grupo[0];
  let dataVencedor = dataReferencia(vencedor);
  for (let i = 1; i < grupo.length; i++) {
    const candidato = grupo[i];
    const dataCandidato = dataReferencia(candidato);
    if (dataCandidato && !dataVencedor) {
      vencedor = candidato; dataVencedor = dataCandidato; continue;
    }
    if (!dataCandidato) continue;
    if (dataVencedor && dataCandidato.getTime() > dataVencedor.getTime()) {
      vencedor = candidato; dataVencedor = dataCandidato; continue;
    }
    if (dataVencedor && dataCandidato.getTime() === dataVencedor.getTime()) {
      const ativoCandidato = ehAtivo(situacaoNormalizada(candidato));
      const ativoVencedor = ehAtivo(situacaoNormalizada(vencedor));
      if (ativoCandidato && !ativoVencedor) { vencedor = candidato; dataVencedor = dataCandidato; }
    }
  }
  return { aluno: vencedor, situacaoNorm: situacaoNormalizada(vencedor), data: dataVencedor };
}

// Agrupa TODOS os registros de Aluno pela mesma pessoa e retorna um único
// registro vencedor por pessoa — a base para qualquer filtro posterior
// (situação, período, turma, Bolsa Família etc.) já ser aplicado só uma vez
// por pessoa, nunca por registro histórico isolado.
export function consolidarPorAluno(alunos: any[]): RegistroVencedor[] {
  const grupos = new Map<string, any[]>();
  for (const aluno of alunos) {
    const chave = chaveAluno(aluno);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(aluno);
  }
  return [...grupos.values()].map(registroVencedor);
}
