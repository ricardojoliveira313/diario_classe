import type { LinhaEducacenso, SexoEducacenso } from './educacenso';

export interface AlunoCruzadoEducacenso {
  id: string;
  nome: string;
  turma: string;
  sexo: SexoEducacenso;
}

export interface ResultadoCruzamentoEducacenso {
  totalSED: number;
  totalEducacenso: number;
  encontrados: AlunoCruzadoEducacenso[];
  somenteSED: Array<{ nome: string; turma: string }>;
  somenteEducacenso: Array<{ nome: string; turma: string }>;
  ambiguos: Array<{ nome: string; origem: 'SED' | 'Educacenso' }>;
  masculino: number;
  feminino: number;
  naoInformado: number;
}

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function nomeNormalizado(valor: unknown): string {
  return texto(valor).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
}

function dataNormalizada(valor: unknown): string {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}${String(valor.getMonth() + 1).padStart(2, '0')}${String(valor.getDate()).padStart(2, '0')}`;
  }
  const bruto = texto(valor);
  const br = bruto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}${br[2].padStart(2, '0')}${br[1].padStart(2, '0')}`;
  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  return bruto.replace(/\D/g, '');
}

function cpfNormalizado(valor: unknown): string {
  const cpf = texto(valor).replace(/\D/g, '');
  return cpf.length === 11 ? cpf : '';
}

function chaveNomeData(nome: unknown, data: unknown): string {
  return `${nomeNormalizado(nome)}|${dataNormalizada(data)}`;
}

export function cruzarSEDComEducacenso(alunos: any[], turmas: any[], educacenso: LinhaEducacenso[]): ResultadoCruzamentoEducacenso {
  const turmaMap = new Map(turmas.map(turma => [String(turma.id), turma]));
  const regularesAtivos = alunos.filter(aluno => {
    if (aluno.situacao && aluno.situacao !== 'ATIVO') return false;
    const turma = turmaMap.get(String(aluno.turmaId));
    const nomeTurma = texto(turma?.nome).toUpperCase();
    return aluno.aee !== true && turma?.tipo !== 'AEE' && !/^AEE\b/.test(nomeTurma);
  });

  const pessoasSED = new Map<string, any[]>();
  for (const aluno of regularesAtivos) {
    const chave = aluno.ra ? `RA:${aluno.ra}` : chaveNomeData(aluno.nome, aluno.data_nascimento);
    const grupo = pessoasSED.get(chave) ?? [];
    grupo.push(aluno);
    pessoasSED.set(chave, grupo);
  }

  const porCPF = new Map<string, number[]>();
  const porNomeData = new Map<string, number[]>();
  educacenso.forEach((linha, indice) => {
    if (linha.cpf) porCPF.set(linha.cpf, [...(porCPF.get(linha.cpf) ?? []), indice]);
    const chave = chaveNomeData(linha.nome, linha.dataNascimento);
    porNomeData.set(chave, [...(porNomeData.get(chave) ?? []), indice]);
  });

  const usados = new Set<number>();
  const encontrados: AlunoCruzadoEducacenso[] = [];
  const somenteSED: Array<{ nome: string; turma: string }> = [];
  const ambiguos: Array<{ nome: string; origem: 'SED' | 'Educacenso' }> = [];

  for (const grupo of pessoasSED.values()) {
    const aluno = grupo.find(item => !item.situacao || item.situacao === 'ATIVO') ?? grupo[0];
    const cpf = cpfNormalizado(aluno.cpf);
    let indices = cpf ? (porCPF.get(cpf) ?? []) : [];
    if (indices.length === 0) indices = porNomeData.get(chaveNomeData(aluno.nome, aluno.data_nascimento)) ?? [];
    const disponiveis = indices.filter(indice => !usados.has(indice));
    const turma = texto(turmaMap.get(String(aluno.turmaId))?.nome) || 'Sem turma';
    if (disponiveis.length === 1) {
      const indice = disponiveis[0];
      usados.add(indice);
      encontrados.push({ id: String(aluno.id), nome: texto(aluno.nome), turma, sexo: educacenso[indice].sexo });
    } else if (disponiveis.length > 1) {
      ambiguos.push({ nome: texto(aluno.nome), origem: 'SED' });
    } else {
      somenteSED.push({ nome: texto(aluno.nome), turma });
    }
  }

  const somenteEducacenso: Array<{ nome: string; turma: string }> = [];
  educacenso.forEach((linha, indice) => {
    if (usados.has(indice)) return;
    const chave = chaveNomeData(linha.nome, linha.dataNascimento);
    const duplicado = (porNomeData.get(chave) ?? []).length > 1;
    if (duplicado) ambiguos.push({ nome: linha.nome, origem: 'Educacenso' });
    else somenteEducacenso.push({ nome: linha.nome, turma: linha.turma });
  });

  const masculino = encontrados.filter(item => item.sexo === 'M').length;
  const feminino = encontrados.filter(item => item.sexo === 'F').length;
  return {
    totalSED: pessoasSED.size,
    totalEducacenso: educacenso.length,
    encontrados,
    somenteSED,
    somenteEducacenso,
    ambiguos,
    masculino,
    feminino,
    naoInformado: pessoasSED.size - masculino - feminino,
  };
}
