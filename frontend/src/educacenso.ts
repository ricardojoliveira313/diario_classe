export type SexoEducacenso = '' | 'M' | 'F';

export interface LinhaEducacenso {
  nome: string;
  dataNascimento: unknown;
  cpf: string;
  deficiencia: string;
  corRaca: string;
  sexo: SexoEducacenso;
  turma: string;
}

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\-_,;:!?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarSexoEducacenso(valor: unknown): SexoEducacenso {
  const sexo = normalizar(valor);
  if (sexo === 'M' || sexo === 'MASCULINO' || sexo === 'HOMEM') return 'M';
  if (sexo === 'F' || sexo === 'FEMININO' || sexo === 'MULHER') return 'F';
  return '';
}

/**
 * Extrai o relatório Relação de Alunos por Escola do Educacenso.
 * O cabeçalho pode mudar de linha/posição; a identificação é feita pelos
 * títulos oficiais, sem depender de índices fixos da planilha.
 */
export function extrairLinhasEducacenso(rows: unknown[][]): LinhaEducacenso[] {
  let headerIdx = -1;
  let idxNome = -1;
  let idxNasc = -1;
  let idxCPF = -1;
  let idxDef = -1;
  let idxCor = -1;
  let idxSexo = -1;
  let idxTurma = -1;

  for (let r = 0; r < rows.length; r++) {
    const row = Array.isArray(rows[r]) ? rows[r] : [];
    const cabecalhos = row.map(normalizar);
    const nome = cabecalhos.indexOf('NOME');
    const cpf = cabecalhos.indexOf('CPF');
    if (nome < 0 || cpf < 0) continue;

    headerIdx = r;
    idxNome = nome;
    idxCPF = cpf;
    idxNasc = cabecalhos.indexOf('DATA DE NASCIMENTO');
    idxDef = cabecalhos.findIndex(valor => valor.startsWith('TIPO(S) DE DEFICIENCIA'));
    idxCor = cabecalhos.indexOf('COR RACA');
    idxSexo = cabecalhos.findIndex(valor => valor === 'SEXO' || valor === 'GENERO');
    idxTurma = cabecalhos.indexOf('NOME DA TURMA');
    break;
  }

  if (headerIdx < 0) return [];

  const resultado: LinhaEducacenso[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = Array.isArray(rows[r]) ? rows[r] : [];
    const nome = String(row[idxNome] ?? '').trim();
    if (!nome || nome === '--') continue;
    const cpf = String(row[idxCPF] ?? '').replace(/\D/g, '');
    const deficiencia = idxDef >= 0 ? String(row[idxDef] ?? '').trim() : '';
    const corRaca = idxCor >= 0 ? String(row[idxCor] ?? '').trim() : '';
    resultado.push({
      nome,
      dataNascimento: idxNasc >= 0 ? row[idxNasc] : '',
      cpf: cpf.length === 11 ? cpf : '',
      deficiencia: !deficiencia || deficiencia === '--' ? '' : deficiencia,
      corRaca: !corRaca || corRaca === '--' ? '' : corRaca,
      sexo: idxSexo >= 0 ? normalizarSexoEducacenso(row[idxSexo]) : '',
      turma: idxTurma >= 0 ? String(row[idxTurma] ?? '').trim() : '',
    });
  }
  return resultado;
}
