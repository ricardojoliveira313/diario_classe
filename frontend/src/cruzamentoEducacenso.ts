import type { LinhaEducacenso, SexoEducacenso } from './educacenso';

// Mostrado na lista "Somente SED/app" quando existe um candidato parecido no
// Educacenso que não bateu — poupa o admin de abrir os dois arquivos na mão
// pra descobrir se é diferença de grafia (fácil) ou nascimento divergente
// (precisa decidir se é a mesma criança com dado errado num dos dois lados).
export interface CandidatoDivergente {
  nome: string;
  dataNascimentoSED: string;
  dataNascimentoEducacenso: string;
  motivo: 'nome parecido, nascimento diferente' | 'nascimento igual, nome muito diferente';
}

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
  // "id" só existe do lado SED (é o registro do nosso cadastro) — permite
  // oferecer um botão de definir Menino/Menina manualmente pra quem não
  // teve correspondência confirmada com o Educacenso.
  somenteSED: Array<{ id: string; nome: string; turma: string; candidato?: CandidatoDivergente }>;
  somenteEducacenso: Array<{ nome: string; turma: string }>;
  ambiguos: Array<{ id?: string; nome: string; origem: 'SED' | 'Educacenso' }>;
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

// YYYYMMDD (formato interno de comparação) → DD/MM/YYYY (formato de leitura,
// usado só na exibição da divergência pro admin comparar de relance).
function dataParaExibicao(valor: unknown): string {
  const normalizada = dataNormalizada(valor);
  const m = normalizada.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto(valor);
}

function cpfNormalizado(valor: unknown): string {
  const cpf = texto(valor).replace(/\D/g, '');
  return cpf.length === 11 ? cpf : '';
}

function chaveNomeData(nome: unknown, data: unknown): string {
  return `${nomeNormalizado(nome)}|${dataNormalizada(data)}`;
}

// Pontua a semelhança entre dois nomes pela interseção de palavras — mesma
// lógica já validada na Conferência Educacenso, usada aqui como 2ª tentativa
// (a 1ª exige nome normalizado idêntico, que quebra com qualquer diferença de
// sobrenome/grafia entre a base do app e o arquivo oficial do Educacenso).
function palavras(valor: unknown): string[] {
  return texto(valor).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}
function matchScoreNome(a: unknown, b: unknown): number {
  const pa = palavras(a), pb = palavras(b);
  if (pa.length === 0 || pb.length === 0) return 0;
  const intersecao = pa.filter(palavra => pb.includes(palavra)).length;
  return intersecao / Math.max(pa.length, pb.length);
}

export function cruzarSEDComEducacenso(alunos: any[], turmas: any[], educacenso: LinhaEducacenso[]): ResultadoCruzamentoEducacenso {
  const turmaMap = new Map(turmas.map(turma => [String(turma.id), turma]));
  const regularesAtivos = alunos.filter(aluno => {
    // A fotografia atual exige ATIVO — ou situação vazia/nula, tratada como
    // ATIVO em todo o app (Dashboard, Alunos, Faltas; regra em CLAUDE.md).
    // REMA só representa a turma de origem; quando o remanejamento foi
    // concluído, o mesmo RA aparece como ATIVO (ou vazio) no destino.
    const situacao = String(aluno.situacao ?? '').trim().toUpperCase();
    if (situacao !== '' && situacao !== 'ATIVO') return false;
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
  const ambiguos: Array<{ id?: string; nome: string; origem: 'SED' | 'Educacenso' }> = [];
  const pendentes: Array<{ id: string; nome: string; turma: string; dataNascimento: unknown }> = [];

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
      ambiguos.push({ id: String(aluno.id), nome: texto(aluno.nome), origem: 'SED' });
    } else {
      // Não bateu por CPF nem por nome+nascimento IDÊNTICOS — antes de dar como
      // "somente SED", tenta pelo nome parecido (2ª tentativa, ver abaixo).
      pendentes.push({ id: String(aluno.id), nome: texto(aluno.nome), turma, dataNascimento: aluno.data_nascimento });
    }
  }

  // 2ª tentativa: nome parecido (mesma técnica da Conferência Educacenso) +
  // mesma data de nascimento — cobre diferenças de sobrenome/grafia entre a
  // base do app e o arquivo oficial que a comparação exata não tolerava.
  const somenteSED: Array<{ id: string; nome: string; turma: string; candidato?: CandidatoDivergente }> = [];
  for (const pendente of pendentes) {
    const nascPendente = dataNormalizada(pendente.dataNascimento);
    let melhorIndice = -1;
    let melhorScore = 0;
    educacenso.forEach((linha, indice) => {
      if (usados.has(indice)) return;
      if (nascPendente && dataNormalizada(linha.dataNascimento) !== nascPendente) return;
      const score = matchScoreNome(pendente.nome, linha.nome);
      if (score > melhorScore) { melhorScore = score; melhorIndice = indice; }
    });
    if (melhorIndice >= 0 && melhorScore >= 0.7) {
      usados.add(melhorIndice);
      encontrados.push({ id: pendente.id, nome: pendente.nome, turma: pendente.turma, sexo: educacenso[melhorIndice].sexo });
      continue;
    }

    // Não achou respeitando a MESMA data — antes de desistir, procura o melhor
    // candidato IGNORANDO a data (nome idêntico/parecido mas nascimento
    // diferente é o caso real mais comum: erro de digitação num dos dois
    // sistemas). Mostra a divergência pronta na tela em vez de fazer o admin
    // caçar os dois arquivos na mão pra descobrir isso.
    let melhorIndiceSemData = -1;
    let melhorScoreSemData = 0;
    educacenso.forEach((linha, indice) => {
      if (usados.has(indice)) return;
      const score = matchScoreNome(pendente.nome, linha.nome);
      if (score > melhorScoreSemData) { melhorScoreSemData = score; melhorIndiceSemData = indice; }
    });
    let candidato: CandidatoDivergente | undefined;
    if (melhorIndiceSemData >= 0 && melhorScoreSemData >= 0.7) {
      candidato = {
        nome: texto(educacenso[melhorIndiceSemData].nome),
        dataNascimentoSED: dataParaExibicao(pendente.dataNascimento),
        dataNascimentoEducacenso: dataParaExibicao(educacenso[melhorIndiceSemData].dataNascimento),
        motivo: 'nome parecido, nascimento diferente',
      };
    } else if (nascPendente) {
      // Nome não bateu, mas existe alguém com a MESMA data de nascimento —
      // pode ser homônimo real ou nome digitado muito diferente; vale conferir.
      const candidatoData = educacenso.findIndex((linha, indice) =>
        !usados.has(indice) && dataNormalizada(linha.dataNascimento) === nascPendente);
      if (candidatoData >= 0) {
        candidato = {
          nome: texto(educacenso[candidatoData].nome),
          dataNascimentoSED: dataParaExibicao(pendente.dataNascimento),
          dataNascimentoEducacenso: dataParaExibicao(educacenso[candidatoData].dataNascimento),
          motivo: 'nascimento igual, nome muito diferente',
        };
      }
    }
    somenteSED.push({ id: pendente.id, nome: pendente.nome, turma: pendente.turma, candidato });
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
