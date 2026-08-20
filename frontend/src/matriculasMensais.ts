export type SexoContagem = 'M' | 'F' | 'NI';

export interface ContagemSexo {
  masculino: number;
  feminino: number;
  naoInformado: number;
  total: number;
}

export interface LinhaMatriculasMes {
  mes: number;
  matriculados: ContagemSexo;
  entradas: ContagemSexo;
  saidas: ContagemSexo;
}

export interface ResumoMatriculasMensais {
  meses: LinhaMatriculasMes[];
  totalPeriodo: ContagemSexo;
  totalEntradas: ContagemSexo;
  totalSaidas: ContagemSexo;
  semSexo: number;
  semDataInicio: number;
  semDataSaida: number;
  pendentesSexo: Array<{
    chave: string;
    ids: string[];
    nome: string;
    ra: string;
    turmaId: string;
  }>;
}

const SITUACOES_SAIDA = new Set(['BXTR', 'TRAN', 'N COM', 'ABAN']);

export function normalizarSexo(valor: unknown): '' | 'M' | 'F' {
  const texto = String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (texto === 'M' || texto === 'MASCULINO' || texto === 'HOMEM') return 'M';
  if (texto === 'F' || texto === 'FEMININO' || texto === 'MULHER') return 'F';
  return '';
}

function dataSED(valor: unknown): Date | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  let ano: number;
  let mes: number;
  let dia: number;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) {
    ano = Number(iso[1]); mes = Number(iso[2]); dia = Number(iso[3]);
  } else if (br) {
    dia = Number(br[1]); mes = Number(br[2]); ano = Number(br[3]);
  } else {
    return null;
  }
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia
    ? data
    : null;
}

function normalizarNome(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function chavePessoa(aluno: any): string {
  if (aluno.ra) return `RA:${String(aluno.ra)}`;
  const nome = normalizarNome(aluno.nome);
  const nascimento = String(aluno.data_nascimento ?? '').replace(/\D/g, '');
  return nome ? `NOME:${nome}|NASC:${nascimento}` : `ID:${aluno.id}`;
}

function sexoDoGrupo(registros: any[]): SexoContagem {
  for (const registro of registros) {
    const sexo = normalizarSexo(registro.sexo);
    if (sexo) return sexo;
  }
  return 'NI';
}

function contarSexos(sexos: Iterable<SexoContagem>): ContagemSexo {
  const contagem: ContagemSexo = { masculino: 0, feminino: 0, naoInformado: 0, total: 0 };
  for (const sexo of sexos) {
    if (sexo === 'M') contagem.masculino++;
    else if (sexo === 'F') contagem.feminino++;
    else contagem.naoInformado++;
    contagem.total++;
  }
  return contagem;
}

export function calcularMatriculasMensais(
  alunos: any[],
  turmas: any[],
  ano: number,
  mesInicio = 1,
  mesFim = 12,
  hoje = new Date(),
  incluirAEE = false,
): ResumoMatriculasMensais {
  const turmaMap = new Map(turmas.map(t => [t.id, t]));
  const regulares = alunos.filter(aluno => {
    const turma = turmaMap.get(aluno.turmaId);
    const turmaAEE = turma?.tipo === 'AEE' || /^AEE\b/i.test(turma?.nome ?? '');
    return incluirAEE || (aluno.aee !== true && !turmaAEE);
  });

  const grupos = new Map<string, any[]>();
  for (const aluno of regulares) {
    const chave = chavePessoa(aluno);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(aluno);
  }

  const fimAno = new Date(ano, 11, 31, 23, 59, 59, 999);
  const inicioPeriodo = new Date(ano, mesInicio - 1, 1);
  const fimPeriodoCompleto = new Date(ano, mesFim, 0, 23, 59, 59, 999);
  const periodoIncluiHoje = ano === hoje.getFullYear()
    && mesFim === hoje.getMonth() + 1;
  const fimPeriodo = periodoIncluiHoje && hoje < fimPeriodoCompleto
    ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999)
    : fimPeriodoCompleto;
  const pessoas = [...grupos.entries()].map(([chave, registros]) => {
    const periodos = registros.map(registro => {
      const inicio = dataSED(registro.data_inicio_matricula);
      const situacao = String(registro.situacao ?? 'ATIVO').trim().toUpperCase();
      const fimInformado = dataSED(registro.data_fim_matricula) ?? dataSED(registro.data_movimentacao);
      const saidaSemData = SITUACOES_SAIDA.has(situacao) && !fimInformado;
      // Uma situação de saída nunca pode virar período aberto. Sem data oficial,
      // encerra conservadoramente no início e mantém o caso visível no alerta.
      const fim = fimInformado ?? (situacao === 'ATIVO' ? fimAno : saidaSemData ? inicio : null);
      return { registro, inicio, fim, situacao, saidaSemData };
    });
    const inicios = periodos.map(p => p.inicio).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
    const primeiraEntrada = inicios[0] ?? null;
    const saidas = periodos
      .filter(p => SITUACOES_SAIDA.has(p.situacao) && p.fim)
      .map(p => p.fim as Date)
      .sort((a, b) => a.getTime() - b.getTime());
    const ultimaSaidaCandidata = saidas.length > 0 ? saidas[saidas.length - 1] : null;
    const houveRetornoDepois = !!ultimaSaidaCandidata
      && inicios.some(inicio => inicio.getTime() > ultimaSaidaCandidata.getTime());
    return {
      chave,
      sexo: sexoDoGrupo(registros),
      registros,
      periodos,
      primeiraEntrada,
      ultimaSaida: houveRetornoDepois ? null : ultimaSaidaCandidata,
    };
  });

  const sobrepoe = (pessoa: typeof pessoas[number], inicio: Date, fim: Date) =>
    pessoa.periodos.some(periodo => periodo.inicio
      && periodo.inicio <= fim
      && (!periodo.fim || periodo.fim >= inicio));

  const pessoasDoPeriodo = pessoas.filter(pessoa => sobrepoe(pessoa, inicioPeriodo, fimPeriodo));
  const meses = Array.from({ length: mesFim - mesInicio + 1 }, (_, indice): LinhaMatriculasMes => {
    const mes = mesInicio + indice;
    const inicioMesCorreto = new Date(ano, mes - 1, 1);
    const fimMesCompleto = new Date(ano, mes, 0, 23, 59, 59, 999);
    const fimMes = mes === mesFim ? fimPeriodo : fimMesCompleto;
    const matriculados = pessoas.filter(pessoa => sobrepoe(pessoa, inicioMesCorreto, fimMes));
    const entradas = pessoas.filter(pessoa => pessoa.primeiraEntrada
      && pessoa.primeiraEntrada >= inicioMesCorreto
      && pessoa.primeiraEntrada <= fimMes);
    const saidas = pessoas.filter(pessoa => pessoa.ultimaSaida
      && pessoa.ultimaSaida >= inicioMesCorreto
      && pessoa.ultimaSaida <= fimMes);
    return {
      mes,
      matriculados: contarSexos(matriculados.map(p => p.sexo)),
      entradas: contarSexos(entradas.map(p => p.sexo)),
      saidas: contarSexos(saidas.map(p => p.sexo)),
    };
  });

  const entradasPeriodo = pessoas.filter(pessoa => pessoa.primeiraEntrada
    && pessoa.primeiraEntrada >= inicioPeriodo
    && pessoa.primeiraEntrada <= fimPeriodo);
  const saidasPeriodo = pessoas.filter(pessoa => pessoa.ultimaSaida
    && pessoa.ultimaSaida >= inicioPeriodo
    && pessoa.ultimaSaida <= fimPeriodo);

  return {
    meses,
    totalPeriodo: contarSexos(pessoasDoPeriodo.map(p => p.sexo)),
    totalEntradas: contarSexos(entradasPeriodo.map(p => p.sexo)),
    totalSaidas: contarSexos(saidasPeriodo.map(p => p.sexo)),
    semSexo: pessoasDoPeriodo.filter(p => p.sexo === 'NI').length,
    semDataInicio: pessoas.filter(p => !p.primeiraEntrada).length,
    semDataSaida: pessoas.filter(pessoa => pessoa.periodos.some(periodo => periodo.saidaSemData)).length,
    pendentesSexo: pessoasDoPeriodo
      .filter(pessoa => pessoa.sexo === 'NI')
      .map(pessoa => {
        const representante = pessoa.registros.find(registro => !registro.situacao || registro.situacao === 'ATIVO')
          ?? pessoa.registros[0];
        return {
          chave: pessoa.chave,
          ids: pessoa.registros.map(registro => String(registro.id)).filter(Boolean),
          nome: String(representante?.nome ?? ''),
          ra: representante?.ra ? String(representante.ra) : '',
          turmaId: String(representante?.turmaId ?? ''),
        };
      }),
  };
}
