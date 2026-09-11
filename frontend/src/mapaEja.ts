// Cálculos do Mapa EJA — espelha o "Mapa do Mês" da SED (sistema MAPA da
// Prefeitura de Santo André), reaproveitando os mesmos dados que já
// importamos (situação, datas de matrícula/movimentação, data de nascimento)
// em vez de exigir preenchimento manual de tudo de novo.

export interface FaixaEtariaLinha {
  label: string;
  min: number;
  max: number; // Infinity para "acima de X"
}

// Cortes oficiais do mapa EJA-I (vistos no relatório real da SED).
export const FAIXAS_ETARIAS_EJA: FaixaEtariaLinha[] = [
  { label: '15 a 17', min: 15, max: 17 },
  { label: '18 a 24', min: 18, max: 24 },
  { label: '25 a 29', min: 25, max: 29 },
  { label: '30 a 39', min: 30, max: 39 },
  { label: '40 a 59', min: 40, max: 59 },
  { label: 'acima de 60 anos', min: 60, max: Infinity },
];

function parseDataBR(valor: unknown): Date | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const data = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(data.getTime()) ? null : data;
  }
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const data = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(data.getTime()) ? null : data;
  }
  return null;
}

export function calcularIdade(dataNascimento: unknown, dataReferencia: Date): number | null {
  const nasc = parseDataBR(dataNascimento);
  if (!nasc) return null;
  let idade = dataReferencia.getFullYear() - nasc.getFullYear();
  const aindaNaoFezAniversario = dataReferencia.getMonth() < nasc.getMonth()
    || (dataReferencia.getMonth() === nasc.getMonth() && dataReferencia.getDate() < nasc.getDate());
  if (aindaNaoFezAniversario) idade--;
  return idade;
}

export function faixaEtariaDe(idade: number | null): string {
  if (idade === null) return 'Não informada';
  const faixa = FAIXAS_ETARIAS_EJA.find(f => idade >= f.min && idade <= f.max);
  return faixa?.label ?? 'Não informada';
}

export function ehTurmaEja(nomeTurma: unknown): boolean {
  return /\bEJA\b/i.test(String(nomeTurma ?? ''));
}

// Ciclo (Alfa/Pós/Multi) a partir do nome da turma — mesma normalização já
// usada no cruzamento de série (normSerieKey em Importar.tsx), simplificada
// só pro rótulo do Mapa EJA.
export function cicloEjaDaTurma(nomeTurma: unknown): 'ALFA' | 'POS' | 'MULTI' {
  const nome = String(nomeTurma ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (nome.includes('MULTISSERIADA') || nome.includes('MULTI')) return 'MULTI';
  if (nome.includes('POS')) return 'POS';
  return 'ALFA';
}

const SITUACOES_ELIMINACAO: Record<string, 'EVASAO' | 'TRANSFERENCIA' | 'NUNCA_COMPARECEU'> = {
  ABAN: 'EVASAO',
  BXTR: 'TRANSFERENCIA',
  TRAN: 'TRANSFERENCIA',
  'N COM': 'NUNCA_COMPARECEU',
};

export interface LinhaTurmaEja {
  turmaId: string;
  turmaNome: string;
  professora: string;
  periodo: string;
  ciclo: 'ALFA' | 'POS' | 'MULTI';
  matriculaGeral: number;
  evasao: number;
  transferencia: number;
  obito: number;
  nuncaCompareceram: number;
  totalEliminadosGeral: number;
  alunosFrequentes: number;
  // Matriculados no mês
  vieramDoMesAnterior: number;
  matriculaNova: number;
  rematricula: number;
  cade: number;
  medidasSocioeducativas: number;
  // Eliminados no mês / resultados finais
  evadidoMes: number;
  transferidoMes: number;
  obitoMes: number;
  nuncaCompareceuMes: number;
  promovido: number;
  permanece: number;
  // Reclassificados (situação CLASSIFICADO vinda da SED)
  reclassificados: number;
  // Retorno de ex-alunos no mês (voltou a ficar ATIVO depois de ter saído)
  retornoEvasao: number;
  retornoTransferencia: number;
  retornoNuncaCompareceu: number;
}

export interface ResumoMapaEja {
  linhas: LinhaTurmaEja[];
  faixaEtaria: Array<{ label: string; atendimento: number; evasao: number; nuncaComp: number }>;
  distribuicaoPorPeriodo: Record<string, Record<'ALFA' | 'POS' | 'MULTI', { alunos: number; classes: number }>>;
}

function situacaoDe(aluno: any): string {
  return String(aluno.situacao ?? '').trim().toUpperCase();
}

function ehAtivo(situacao: string): boolean {
  return situacao === '' || situacao === 'ATIVO';
}

// ─── Reconstrução do estado do aluno NO MÊS selecionado ─────────────────────
// O cadastro do Aluno guarda só a situação ATUAL (o import sobrescreve a cada
// SED novo) — não um histórico mês a mês. Por isso, ao selecionar Fevereiro,
// o Mapa não pode simplesmente usar a situação de hoje: um aluno que hoje
// está BXTR/N COM/ABAN pode ter saído em Agosto, e em Fevereiro ele ainda
// estava ATIVO — e um aluno matriculado em Junho não existia em Fevereiro.
// Reconstrói isso a partir das datas que a SED já manda (data de início de
// matrícula e data de movimentação/fim de matrícula): se a mudança de
// situação só ocorreu DEPOIS do mês selecionado, o aluno ainda era ATIVO
// naquele mês; se a matrícula só começou DEPOIS do mês selecionado, o aluno
// ainda não existia no cadastro daquele mês.
function aindaNaoMatriculadoNoMes(aluno: any, fimMes: Date): boolean {
  const dIni = parseDataBR(aluno.data_inicio_matricula);
  return !!dIni && dIni > fimMes;
}

function situacaoNoMes(aluno: any, fimMes: Date): string {
  const sit = situacaoDe(aluno);
  if (ehAtivo(sit)) return sit;
  const dMov = parseDataBR(aluno.data_fim_matricula) ?? parseDataBR(aluno.data_movimentacao);
  // Sem data pra comparar, mantém a situação atual (conservador — é o que já
  // fazíamos antes desta reconstrução por mês).
  if (dMov && dMov > fimMes) return ''; // mudança ainda não tinha ocorrido nesse mês
  return sit;
}

export function calcularMapaEja(
  alunos: any[],
  turmas: any[],
  mes: number,
  ano: number,
  hoje: Date,
): ResumoMapaEja {
  const turmasEja = turmas.filter(t => ehTurmaEja(t.nome));
  const turmaMap = new Map(turmasEja.map(t => [t.id, t]));
  const alunosEja = alunos.filter(a => turmaMap.has(a.turmaId));

  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);
  const dataRef = hoje < fimMes ? hoje : fimMes;

  const linhas: LinhaTurmaEja[] = turmasEja.map(turma => {
    const doTurma = alunosEja
      .filter(a => a.turmaId === turma.id)
      .filter(a => !aindaNaoMatriculadoNoMes(a, fimMes));
    const ativos = doTurma.filter(a => ehAtivo(situacaoNoMes(a, fimMes)));
    const eliminados = doTurma.filter(a => situacaoNoMes(a, fimMes) in SITUACOES_ELIMINACAO);
    const evasao = eliminados.filter(a => SITUACOES_ELIMINACAO[situacaoNoMes(a, fimMes)] === 'EVASAO' && !a.obito);
    const transferencia = eliminados.filter(a => SITUACOES_ELIMINACAO[situacaoNoMes(a, fimMes)] === 'TRANSFERENCIA');
    const obitoTodos = doTurma.filter(a => a.obito === true);
    const nuncaCompareceram = eliminados.filter(a => SITUACOES_ELIMINACAO[situacaoNoMes(a, fimMes)] === 'NUNCA_COMPARECEU');

    const dataMovimentacao = (a: any) => parseDataBR(a.data_fim_matricula) ?? parseDataBR(a.data_movimentacao);
    const noMes = (a: any) => {
      const d = dataMovimentacao(a);
      return d && d >= inicioMes && d <= fimMes;
    };
    const dataInicio = (a: any) => parseDataBR(a.data_inicio_matricula);
    const entrouNoMes = (a: any) => {
      const d = dataInicio(a);
      return d && d >= inicioMes && d <= fimMes;
    };

    const vieramDoMesAnterior = ativos.filter(a => !entrouNoMes(a)).length;
    const matriculaNova = ativos.filter(a => entrouNoMes(a) && !a.rematricula).length;
    const rematricula = ativos.filter(a => entrouNoMes(a) && a.rematricula === true).length;
    // CADE (atendimento a alunos com deficiência) é automático — vem direto do
    // campo "deficiencia" que a SED já manda na importação (ex.: "AUTISTA
    // INFANTIL", "SÍNDROME DE DOWN"), sem precisar de conferência manual.
    const cade = ativos.filter(a => String(a.deficiencia ?? '').trim() !== '').length;
    const medidasSocioeducativas = ativos.filter(a => a.medida_socioeducativa).length;

    const reclassificados = doTurma.filter(a => situacaoDe(a) === 'CLASSIFICADO').length;

    // Ajuste manual fixo: alunos N COM/ABAN que a SED parou de listar e não
    // têm mais como virar um registro de Aluno de verdade (nome/RA
    // perdidos). Lançado uma vez pela escola na Conferência Manual — não
    // some do Mapa EJA mesmo que nenhum import volte a trazer esses alunos.
    // Uma evasão NOVA continua detectada automaticamente pela situação ABAN
    // real do aluno (linha `evasao` acima) — este ajuste só cobre o que já
    // foi perdido antes de existir esse recurso.
    const ajusteNuncaCompareceram = Number(turma.ajuste_nunca_compareceram) || 0;
    const ajusteEvasao = Number(turma.ajuste_evasao) || 0;

    return {
      turmaId: turma.id,
      turmaNome: turma.nome,
      professora: turma.professora ?? '',
      periodo: turma.periodo ?? '',
      ciclo: cicloEjaDaTurma(turma.nome),
      matriculaGeral: ativos.length + eliminados.length + ajusteNuncaCompareceram + ajusteEvasao,
      evasao: evasao.length + ajusteEvasao,
      transferencia: transferencia.length,
      obito: obitoTodos.length,
      nuncaCompareceram: nuncaCompareceram.length + ajusteNuncaCompareceram,
      totalEliminadosGeral: evasao.length + transferencia.length + obitoTodos.length + nuncaCompareceram.length + ajusteNuncaCompareceram + ajusteEvasao,
      alunosFrequentes: ativos.length,
      vieramDoMesAnterior,
      matriculaNova,
      rematricula,
      cade,
      medidasSocioeducativas,
      evadidoMes: evasao.filter(noMes).length,
      transferidoMes: transferencia.filter(noMes).length,
      obitoMes: obitoTodos.filter(noMes).length,
      nuncaCompareceuMes: nuncaCompareceram.filter(noMes).length,
      promovido: doTurma.filter(a => a.resultado_final === 'PROMOVIDO').length,
      permanece: doTurma.filter(a => a.resultado_final === 'PERMANECE').length,
      reclassificados,
      retornoEvasao: 0,
      retornoTransferencia: 0,
      retornoNuncaCompareceu: 0,
    };
  });

  const alunosEjaNoMes = alunosEja.filter(a => !aindaNaoMatriculadoNoMes(a, fimMes));
  const idadesAtivos = alunosEjaNoMes
    .filter(a => ehAtivo(situacaoNoMes(a, fimMes)))
    .map(a => calcularIdade(a.data_nascimento, dataRef));
  const idadesEvasao = alunosEjaNoMes
    .filter(a => SITUACOES_ELIMINACAO[situacaoNoMes(a, fimMes)] === 'EVASAO')
    .map(a => calcularIdade(a.data_nascimento, dataRef));
  const idadesNuncaComp = alunosEjaNoMes
    .filter(a => SITUACOES_ELIMINACAO[situacaoNoMes(a, fimMes)] === 'NUNCA_COMPARECEU')
    .map(a => calcularIdade(a.data_nascimento, dataRef));

  // Ajustes manuais fixos de Nunca Comp./Evasão (ver linhas acima), somados
  // na faixa etária que a escola indicou pra cada turma — não vêm de aluno
  // nenhum.
  const somarAjustePorFaixa = (qtdCampo: string, faixaCampo: string) => {
    const porFaixa = new Map<string, number>();
    for (const turma of turmasEja) {
      const qtd = Number(turma[qtdCampo]) || 0;
      const faixaLabel = String(turma[faixaCampo] ?? '').trim();
      if (qtd > 0 && faixaLabel) {
        porFaixa.set(faixaLabel, (porFaixa.get(faixaLabel) ?? 0) + qtd);
      }
    }
    return porFaixa;
  };
  const ajustesNuncaCompPorFaixa = somarAjustePorFaixa('ajuste_nunca_compareceram', 'ajuste_faixa_nunca_compareceram');
  const ajustesEvasaoPorFaixa = somarAjustePorFaixa('ajuste_evasao', 'ajuste_faixa_evasao');

  const faixaEtaria = FAIXAS_ETARIAS_EJA.map(faixa => ({
    label: faixa.label,
    atendimento: idadesAtivos.filter(i => i !== null && i >= faixa.min && i <= faixa.max).length,
    evasao: idadesEvasao.filter(i => i !== null && i >= faixa.min && i <= faixa.max).length
      + (ajustesEvasaoPorFaixa.get(faixa.label) ?? 0),
    nuncaComp: idadesNuncaComp.filter(i => i !== null && i >= faixa.min && i <= faixa.max).length
      + (ajustesNuncaCompPorFaixa.get(faixa.label) ?? 0),
  }));

  const periodos = ['Manhã', 'Tarde', 'Vespertino', 'Noite'];
  const distribuicaoPorPeriodo: ResumoMapaEja['distribuicaoPorPeriodo'] = {};
  for (const periodo of periodos) {
    distribuicaoPorPeriodo[periodo] = { ALFA: { alunos: 0, classes: 0 }, POS: { alunos: 0, classes: 0 }, MULTI: { alunos: 0, classes: 0 } };
  }
  for (const linha of linhas) {
    const periodo = periodos.find(p => p.toUpperCase() === (linha.periodo ?? '').toUpperCase()) ?? 'Noite';
    distribuicaoPorPeriodo[periodo][linha.ciclo].alunos += linha.alunosFrequentes;
    distribuicaoPorPeriodo[periodo][linha.ciclo].classes += 1;
  }

  return { linhas, faixaEtaria, distribuicaoPorPeriodo };
}
