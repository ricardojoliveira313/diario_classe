import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import * as XLSX from 'xlsx';
import { theme, MESES, input } from '../styles';
import { calcularMatriculasMensais, ContagemSexo } from '../matriculasMensais';
import { sugerirSexoPeloNome } from '../nomesGenero';
import { extrairLinhasEducacenso } from '../educacenso';
import { cruzarSEDComEducacenso, type ResultadoCruzamentoEducacenso } from '../cruzamentoEducacenso';

type TipoEnsino = '' | 'INFANTIL' | 'FUNDAMENTAL' | 'EJA' | 'AEE';

interface LinhaConsolidada {
  chave: string;
  label: string;
  nivel: 'tipo' | 'serie';
  contagem: ContagemSexo;
}

function tipoEnsinoDaTurma(turma: any): Exclude<TipoEnsino, ''> {
  const nome = String(turma?.nome ?? '').toUpperCase();
  if (turma?.tipo === 'AEE' || /^AEE\b/.test(nome)) return 'AEE';
  if (/\bEJA\b/.test(nome)) return 'EJA';
  if (/\bETAPA\b/.test(nome)) return 'INFANTIL';
  return 'FUNDAMENTAL';
}

function serieDaTurma(turma: any): string {
  const nome = String(turma?.nome ?? '').trim();
  const regular = nome.match(/^(\d+[ªº]\s+(?:ETAPA|ANO))/i);
  if (regular) return regular[1].toUpperCase();
  if (/^AEE\b/i.test(nome)) return 'AEE';
  return nome.replace(/\s+/g, ' ').toUpperCase();
}

const TIPO_LABEL: Record<Exclude<TipoEnsino, ''>, string> = {
  INFANTIL: 'Educação Infantil',
  FUNDAMENTAL: 'Ensino Fundamental de 9 anos',
  EJA: 'EJA Fundamental — anos iniciais',
  AEE: 'Atendimento Educacional Especializado',
};

function CelulasContagem({ valor }: { valor: ContagemSexo }) {
  return (
    <>
      <td style={numero('#2563eb')}>{valor.masculino}</td>
      <td style={numero('#db2777')}>{valor.feminino}</td>
      <td style={numero(valor.naoInformado > 0 ? theme.orange : theme.textMuted)}>{valor.naoInformado}</td>
      <td style={{ ...numero(theme.text), fontWeight: 800 }}>{valor.total}</td>
    </>
  );
}

function numero(cor: string): CSSProperties {
  return { textAlign: 'center', padding: '8px 7px', color: cor, fontWeight: 700, whiteSpace: 'nowrap' };
}

function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function celulasRelatorio(valor: ContagemSexo): string {
  return `<td>${valor.masculino}</td><td>${valor.feminino}</td><td>${valor.naoInformado}</td><td><strong>${valor.total}</strong></td>`;
}

export default function MatriculasMensais({
  alunos,
  turmas,
  ano,
  onAnoChange,
  onAtualizarSexo,
  somenteConsulta = false,
}: {
  alunos: any[];
  turmas: any[];
  ano: number;
  onAnoChange: (ano: number) => void;
  onAtualizarSexo: (ids: string[], sexo: 'M' | 'F') => Promise<void>;
  somenteConsulta?: boolean;
}) {
  const hoje = useMemo(() => new Date(), []);
  const ultimoMesDisponivel = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(ultimoMesDisponivel);
  const [tipoEnsino, setTipoEnsino] = useState<TipoEnsino>('');
  const [serie, setSerie] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [mostrarConferenciaSexo, setMostrarConferenciaSexo] = useState(false);
  const [salvandoSexo, setSalvandoSexo] = useState('');
  const [erroSexo, setErroSexo] = useState('');
  const [resultadoEducacenso, setResultadoEducacenso] = useState<ResultadoCruzamentoEducacenso | null>(null);
  const [arquivoEducacenso, setArquivoEducacenso] = useState('');
  const [analisandoEducacenso, setAnalisandoEducacenso] = useState(false);
  const [aplicandoEducacenso, setAplicandoEducacenso] = useState(false);
  const [mensagemEducacenso, setMensagemEducacenso] = useState('');

  useEffect(() => {
    setMesInicio(1);
    setMesFim(ultimoMesDisponivel);
  }, [ano, ultimoMesDisponivel]);

  const turmasDoTipo = useMemo(
    () => turmas.filter(turma => !tipoEnsino || tipoEnsinoDaTurma(turma) === tipoEnsino),
    [turmas, tipoEnsino],
  );
  const seriesDisponiveis = useMemo(
    () => [...new Set(turmasDoTipo.map(serieDaTurma))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [turmasDoTipo],
  );
  const turmasDisponiveis = useMemo(
    () => turmasDoTipo.filter(turma => !serie || serieDaTurma(turma) === serie),
    [turmasDoTipo, serie],
  );
  const turmasFiltradas = useMemo(
    () => turmasDisponiveis.filter(turma => !turmaId || turma.id === turmaId),
    [turmasDisponiveis, turmaId],
  );
  const alunosFiltrados = useMemo(() => {
    // Mesma regra de negócio usada nas telas Dashboard e Alunos:
    // situação vazia nos registros antigos também representa matrícula ativa.
    const ativos = alunos.filter(aluno => !aluno.situacao || aluno.situacao === 'ATIVO');
    if (!tipoEnsino && !serie && !turmaId) return ativos;
    const ids = new Set(turmasFiltradas.map(turma => turma.id));
    return ativos.filter(aluno => ids.has(aluno.turmaId));
  }, [alunos, turmasFiltradas, tipoEnsino, serie, turmaId]);
  const resumo = useMemo(
    () => calcularMatriculasMensais(
      alunosFiltrados,
      turmasFiltradas,
      ano,
      mesInicio,
      mesFim,
      hoje,
      tipoEnsino === 'AEE',
    ),
    [alunosFiltrados, turmasFiltradas, ano, mesInicio, mesFim, hoje, tipoEnsino],
  );
  const linhasConsolidadas = useMemo(() => {
    const tipos: Array<Exclude<TipoEnsino, ''>> = tipoEnsino
      ? [tipoEnsino]
      : ['INFANTIL', 'FUNDAMENTAL', 'EJA'];
    const linhas: LinhaConsolidada[] = [];

    const resumoDasTurmas = (grupoTurmas: any[], incluirAEE: boolean) => {
      const ids = new Set(grupoTurmas.map(turma => turma.id));
      const grupoAlunos = alunosFiltrados.filter(aluno => ids.has(aluno.turmaId));
      return calcularMatriculasMensais(
        grupoAlunos,
        grupoTurmas,
        ano,
        mesInicio,
        mesFim,
        hoje,
        incluirAEE,
      ).totalPeriodo;
    };

    for (const tipo of tipos) {
      const grupoTurmas = turmasFiltradas.filter(turma => tipoEnsinoDaTurma(turma) === tipo);
      if (grupoTurmas.length === 0) continue;
      linhas.push({
        chave: tipo,
        label: TIPO_LABEL[tipo],
        nivel: 'tipo',
        contagem: resumoDasTurmas(grupoTurmas, tipo === 'AEE'),
      });

      const seriesDoGrupo = [...new Set(grupoTurmas.map(serieDaTurma))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
      if (tipo === 'AEE' && seriesDoGrupo.length === 1) continue;
      for (const nomeSerie of seriesDoGrupo) {
        const turmasDaSerie = grupoTurmas.filter(turma => serieDaTurma(turma) === nomeSerie);
        linhas.push({
          chave: `${tipo}-${nomeSerie}`,
          label: nomeSerie,
          nivel: 'serie',
          contagem: resumoDasTurmas(turmasDaSerie, tipo === 'AEE'),
        });
      }
    }
    return linhas;
  }, [alunosFiltrados, turmasFiltradas, ano, mesInicio, mesFim, hoje, tipoEnsino]);
  const pendentesSexoOrdenados = useMemo(() => {
    const turmaMap = new Map(turmas.map(turma => [turma.id, turma.nome]));
    return resumo.pendentesSexo
      .map(pendente => ({
        ...pendente,
        turma: turmaMap.get(pendente.turmaId) ?? 'Sem turma',
        // Sugestão pelo primeiro nome — só orienta a conferência visualmente,
        // nunca é salva sem o admin clicar num botão confirmando.
        sugestao: sugerirSexoPeloNome(pendente.nome),
      }))
      .sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR', { numeric: true })
        || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [resumo.pendentesSexo, turmas]);

  const totalComSugestao = useMemo(
    () => pendentesSexoOrdenados.filter(pendente => pendente.sugestao).length,
    [pendentesSexoOrdenados],
  );

  const confirmarSexo = async (chave: string, ids: string[], sexo: 'M' | 'F') => {
    if (somenteConsulta) return;
    setSalvandoSexo(chave);
    setErroSexo('');
    try {
      await onAtualizarSexo(ids, sexo);
    } catch (erro: any) {
      setErroSexo(`Não foi possível salvar: ${erro?.message ?? erro}`);
    } finally {
      setSalvandoSexo('');
    }
  };

  // Aplica de uma vez só as sugestões pelo primeiro nome — só depois que o
  // admin revisou a lista e clicou no botão de confirmação em lote. Nomes sem
  // sugestão (fora da lista curada) continuam exigindo conferência individual.
  const confirmarSugestoesEmLote = async () => {
    if (somenteConsulta) return;
    const comSugestao = pendentesSexoOrdenados.filter(pendente => pendente.sugestao);
    if (comSugestao.length === 0) return;
    setSalvandoSexo('__lote__');
    setErroSexo('');
    try {
      const idsM = comSugestao.filter(p => p.sugestao === 'M').flatMap(p => p.ids);
      const idsF = comSugestao.filter(p => p.sugestao === 'F').flatMap(p => p.ids);
      await Promise.all([
        idsM.length > 0 ? onAtualizarSexo(idsM, 'M') : Promise.resolve(),
        idsF.length > 0 ? onAtualizarSexo(idsF, 'F') : Promise.resolve(),
      ]);
    } catch (erro: any) {
      setErroSexo(`Não foi possível salvar as sugestões em lote: ${erro?.message ?? erro}`);
    } finally {
      setSalvandoSexo('');
    }
  };

  const analisarArquivoEducacenso = async (arquivo: File | undefined) => {
    if (somenteConsulta || !arquivo) return;
    setAnalisandoEducacenso(true);
    setMensagemEducacenso('');
    setResultadoEducacenso(null);
    setArquivoEducacenso(arquivo.name);
    try {
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: true });
      const linhas = wb.SheetNames.flatMap(nomeAba => {
        const ws = wb.Sheets[nomeAba];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
        return extrairLinhasEducacenso(rows);
      });
      if (linhas.length === 0) throw new Error('Não foi encontrado o cabeçalho oficial com Nome, CPF e Sexo.');
      const comSexo = linhas.filter(linha => linha.sexo === 'M' || linha.sexo === 'F');
      if (comSexo.length === 0) throw new Error('O relatório foi reconhecido, mas a coluna Sexo está vazia.');
      const resultado = cruzarSEDComEducacenso(alunos, turmas, linhas);
      setResultadoEducacenso(resultado);
      setMensagemEducacenso(`Arquivo reconhecido: ${linhas.length} registro(s) oficiais analisados.`);
    } catch (erro: any) {
      setMensagemEducacenso(`Erro na análise: ${erro?.message ?? erro}`);
    } finally {
      setAnalisandoEducacenso(false);
    }
  };

  const aplicarSexoEducacenso = async () => {
    if (somenteConsulta || !resultadoEducacenso) return;
    setAplicandoEducacenso(true);
    setMensagemEducacenso('');
    try {
      const idsM = resultadoEducacenso.encontrados.filter(item => item.sexo === 'M').map(item => item.id);
      const idsF = resultadoEducacenso.encontrados.filter(item => item.sexo === 'F').map(item => item.id);
      if (idsM.length > 0) await onAtualizarSexo(idsM, 'M');
      if (idsF.length > 0) await onAtualizarSexo(idsF, 'F');
      setMensagemEducacenso(`Sexo oficial aplicado em ${idsM.length + idsF.length} aluno(s) encontrado(s). Divergências permanecem separadas para conferência.`);
    } catch (erro: any) {
      setMensagemEducacenso(`Não foi possível aplicar os dados: ${erro?.message ?? erro}`);
    } finally {
      setAplicandoEducacenso(false);
    }
  };

  const nomeTipoSelecionado = tipoEnsino ? TIPO_LABEL[tipoEnsino] : 'Todos — matrícula regular';
  const nomeTurmaSelecionada = turmaId
    ? String(turmas.find(turma => turma.id === turmaId)?.nome ?? 'Turma não encontrada')
    : 'Todas as turmas';
  const periodoDescricao = `${MESES[mesInicio - 1]} a ${MESES[mesFim - 1]} de ${ano}${
    ano === hoje.getFullYear() && mesFim === hoje.getMonth() + 1
      ? ` — dados até ${hoje.toLocaleDateString('pt-BR')}`
      : ''
  }`;

  const montarRelatorioHtml = () => {
    const consolidado = linhasConsolidadas.map(linha => `
      <tr class="${linha.nivel}">
        <td>${linha.nivel === 'serie' ? '&nbsp;&nbsp;↳ ' : ''}${escaparHtml(linha.label)}</td>
        ${celulasRelatorio(linha.contagem)}
      </tr>`).join('');
    const mensal = resumo.meses.map(linha => `
      <tr>
        <td>${escaparHtml(MESES[linha.mes - 1])}</td>
        ${celulasRelatorio(linha.matriculados)}
        ${celulasRelatorio(linha.entradas)}
        ${celulasRelatorio(linha.saidas)}
      </tr>`).join('');
    const pendencias = [
      resumo.semSexo > 0 ? `${resumo.semSexo} estudante(s) com sexo não informado` : '',
      resumo.semDataInicio > 0 ? `${resumo.semDataInicio} estudante(s) sem data de início` : '',
      resumo.semDataSaida > 0 ? `${resumo.semDataSaida} estudante(s) com situação de saída, mas sem data de saída` : '',
    ].filter(Boolean);
    const aviso = pendencias.length > 0
      ? `<div class="aviso"><strong>CONFERÊNCIA NECESSÁRIA NA SED:</strong> ${escaparHtml(pendencias.join('; '))}.</div>`
      : '<div class="ok">Conferência completa: nenhum dado obrigatório pendente neste período.</div>';
    const auditoriaEducacenso = resultadoEducacenso ? `
      <h2>Cruzamento SED x Educacenso</h2>
      <table><thead><tr><th>Ativos SED/app</th><th>Educacenso</th><th>Encontrados</th><th>Somente SED</th><th>Somente Educacenso</th><th>Ambíguos</th></tr></thead>
      <tbody><tr><td>${resultadoEducacenso.totalSED}</td><td>${resultadoEducacenso.totalEducacenso}</td><td>${resultadoEducacenso.encontrados.length}</td><td>${resultadoEducacenso.somenteSED.length}</td><td>${resultadoEducacenso.somenteEducacenso.length}</td><td>${resultadoEducacenso.ambiguos.length}</td></tr></tbody></table>` : '';

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de matrículas — ${ano}</title>
      <style>
        @page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#172033;margin:20px;font-size:10.5px}
        h1{font-size:20px;margin:0 0 4px;color:#173b8f}h2{font-size:14px;margin:18px 0 7px;color:#173b8f}
        .subtitulo{color:#536179;margin-bottom:12px}.filtros{display:grid;grid-template-columns:repeat(2,1fr);gap:5px 18px;padding:10px;border:1px solid #cbd5e1;background:#f8fafc}
        .resumo{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0}.card{border:1px solid #b7c5df;padding:8px;text-align:center}.card strong{display:block;font-size:18px;color:#173b8f}
        table{width:100%;border-collapse:collapse;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}
        th,td{border:1px solid #aebbd0;padding:5px;text-align:center}th{background:#2448b8;color:white}.esquerda,td:first-child{text-align:left}.tipo td{font-weight:bold;background:#eaf0ff}.serie td:first-child{padding-left:14px}
        tfoot td{font-weight:bold;background:#e8edf7}.aviso{border:1px solid #d97706;background:#fff7ed;color:#9a3412;padding:8px;margin:10px 0}.ok{border:1px solid #16a34a;background:#f0fdf4;color:#166534;padding:8px;margin:10px 0}
        .nota{font-size:9px;color:#64748b;margin-top:6px}.assinatura{margin-top:28px;text-align:center}.linha{display:inline-block;width:280px;border-top:1px solid #333;padding-top:5px}
      </style></head><body>
      <h1>RELATÓRIO DE MATRÍCULAS POR SEXO E PERÍODO</h1>
      <div class="subtitulo">EMEIEF Luiz Gonzaga — somente matrículas ativas — gerado em ${new Date().toLocaleString('pt-BR')}</div>
      <div class="filtros">
        <div><strong>Período:</strong> ${escaparHtml(periodoDescricao)}</div><div><strong>Tipo de ensino:</strong> ${escaparHtml(nomeTipoSelecionado)}</div>
        <div><strong>Série/ciclo:</strong> ${escaparHtml(serie || 'Todas as séries')}</div><div><strong>Turma:</strong> ${escaparHtml(nomeTurmaSelecionada)}</div>
      </div>
      <div class="resumo">
        <div class="card">Meninos<strong>${resumo.totalPeriodo.masculino}</strong></div>
        <div class="card">Meninas<strong>${resumo.totalPeriodo.feminino}</strong></div>
        <div class="card">Sexo não informado<strong>${resumo.totalPeriodo.naoInformado}</strong></div>
        <div class="card">Total único<strong>${resumo.totalPeriodo.total}</strong></div>
      </div>
      ${aviso}
      ${auditoriaEducacenso}
      <h2>Consolidado por ensino e ciclo/ano</h2>
      <table><thead><tr><th class="esquerda">Ensino / ciclo / ano</th><th>Meninos</th><th>Meninas</th><th>N/I</th><th>Total</th></tr></thead>
        <tbody>${consolidado}</tbody><tfoot><tr><td>TOTAL ÚNICO CONSOLIDADO</td>${celulasRelatorio(resumo.totalPeriodo)}</tr></tfoot></table>
      <h2>Movimentação mensal</h2>
      <table><thead><tr><th rowspan="2">Mês</th><th colspan="4">Matrículas existentes</th><th colspan="4">Entradas no mês</th><th colspan="4">Saídas no mês</th></tr>
        <tr>${['Alunos', 'Alunas', 'N/I', 'Total'].map(label => `<th>${label}</th>`).join('').repeat(3)}</tr></thead>
        <tbody>${mensal}</tbody><tfoot><tr><td>TOTAL DO PERÍODO*</td>${celulasRelatorio(resumo.totalPeriodo)}${celulasRelatorio(resumo.totalEntradas)}${celulasRelatorio(resumo.totalSaidas)}</tr></tfoot></table>
      <div class="nota">* Em matrículas existentes, o total representa pessoas únicas no período selecionado e não a soma dos meses. AEE e remanejamentos não duplicam a matrícula regular.</div>
      <div class="assinatura"><span class="linha">Responsável pela conferência</span></div>
      </body></html>`;
  };

  const nomeArquivo = `Matriculas_${ano}_${String(mesInicio).padStart(2, '0')}-${String(mesFim).padStart(2, '0')}`;

  const exportarPDF = () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      window.alert('O navegador bloqueou a janela do relatório. Permita pop-ups e tente novamente.');
      return;
    }
    janela.document.write(montarRelatorioHtml());
    janela.document.close();
    janela.document.title = nomeArquivo;
    janela.focus();
    janela.setTimeout(() => janela.print(), 350);
  };

  const exportarExcel = () => {
    const resumoExcel: Array<Array<string | number>> = [
      ['RELATÓRIO DE MATRÍCULAS ATIVAS POR SEXO E PERÍODO', '', '', '', ''],
      ['Escola', 'EMEIEF Luiz Gonzaga', '', '', ''],
      ['Período', periodoDescricao, '', '', ''],
      ['Tipo de ensino', nomeTipoSelecionado, '', '', ''],
      ['Série/ciclo', serie || 'Todas as séries', '', '', ''],
      ['Turma', nomeTurmaSelecionada, '', '', ''],
      ['Gerado em', new Date().toLocaleString('pt-BR'), '', '', ''],
      [],
      ['Ensino / ciclo / ano', 'Meninos', 'Meninas', 'N/I', 'Total'],
      ...linhasConsolidadas.map(linha => [
        `${linha.nivel === 'serie' ? '   ↳ ' : ''}${linha.label}`,
        linha.contagem.masculino,
        linha.contagem.feminino,
        linha.contagem.naoInformado,
        linha.contagem.total,
      ]),
      ['TOTAL ÚNICO CONSOLIDADO', resumo.totalPeriodo.masculino, resumo.totalPeriodo.feminino, resumo.totalPeriodo.naoInformado, resumo.totalPeriodo.total],
    ];
    if (resumo.semSexo > 0) {
      resumoExcel.push([], ['CONFERÊNCIA NECESSÁRIA NA SED', `${resumo.semSexo} estudante(s) com sexo não informado`, '', '', '']);
    }

    const mensalExcel: Array<Array<string | number>> = [
      ['Mês',
        'Matrículas — Meninos', 'Matrículas — Meninas', 'Matrículas — N/I', 'Matrículas — Total',
        'Entradas — Meninos', 'Entradas — Meninas', 'Entradas — N/I', 'Entradas — Total',
        'Saídas — Meninos', 'Saídas — Meninas', 'Saídas — N/I', 'Saídas — Total'],
      ...resumo.meses.map(linha => [
        MESES[linha.mes - 1],
        linha.matriculados.masculino, linha.matriculados.feminino, linha.matriculados.naoInformado, linha.matriculados.total,
        linha.entradas.masculino, linha.entradas.feminino, linha.entradas.naoInformado, linha.entradas.total,
        linha.saidas.masculino, linha.saidas.feminino, linha.saidas.naoInformado, linha.saidas.total,
      ]),
      ['TOTAL DO PERÍODO',
        resumo.totalPeriodo.masculino, resumo.totalPeriodo.feminino, resumo.totalPeriodo.naoInformado, resumo.totalPeriodo.total,
        resumo.totalEntradas.masculino, resumo.totalEntradas.feminino, resumo.totalEntradas.naoInformado, resumo.totalEntradas.total,
        resumo.totalSaidas.masculino, resumo.totalSaidas.feminino, resumo.totalSaidas.naoInformado, resumo.totalSaidas.total],
    ];

    const wb = XLSX.utils.book_new();
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoExcel);
    wsResumo['!cols'] = [{ wch: 48 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    wsResumo['!merges'] = [XLSX.utils.decode_range('A1:E1')];
    const wsMensal = XLSX.utils.aoa_to_sheet(mensalExcel);
    wsMensal['!cols'] = [{ wch: 18 }, ...Array.from({ length: 12 }, () => ({ wch: 20 }))];
    wsMensal['!autofilter'] = { ref: `A1:M${mensalExcel.length}` };
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo consolidado');
    XLSX.utils.book_append_sheet(wb, wsMensal, 'Movimentação mensal');
    if (resultadoEducacenso) {
      const resumoCruzamento = [
        ['CRUZAMENTO SED × EDUCACENSO', 'Quantidade'],
        ['Alunos ativos na SED/app', resultadoEducacenso.totalSED],
        ['Registros no Educacenso', resultadoEducacenso.totalEducacenso],
        ['Correspondências confirmadas', resultadoEducacenso.encontrados.length],
        ['Meninos oficiais encontrados', resultadoEducacenso.masculino],
        ['Meninas oficiais encontradas', resultadoEducacenso.feminino],
        ['Somente na SED/app', resultadoEducacenso.somenteSED.length],
        ['Somente no Educacenso', resultadoEducacenso.somenteEducacenso.length],
        ['Correspondências ambíguas', resultadoEducacenso.ambiguos.length],
      ];
      const wsCruzamento = XLSX.utils.aoa_to_sheet(resumoCruzamento);
      wsCruzamento['!cols'] = [{ wch: 38 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsCruzamento, 'Cruzamento');

      const divergencias = [
        ...resultadoEducacenso.somenteSED.map(item => ({ Origem: 'Somente SED/app', Nome: item.nome, Turma: item.turma })),
        ...resultadoEducacenso.somenteEducacenso.map(item => ({ Origem: 'Somente Educacenso', Nome: item.nome, Turma: item.turma })),
        ...resultadoEducacenso.ambiguos.map(item => ({ Origem: `Ambíguo — ${item.origem}`, Nome: item.nome, Turma: '' })),
      ];
      if (divergencias.length > 0) {
        const wsDivergencias = XLSX.utils.json_to_sheet(divergencias);
        wsDivergencias['!cols'] = [{ wch: 24 }, { wch: 44 }, { wch: 28 }];
        wsDivergencias['!autofilter'] = { ref: `A1:C${divergencias.length + 1}` };
        XLSX.utils.book_append_sheet(wb, wsDivergencias, 'Divergências');
      }
    }
    XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
  };

  return (
    <section style={{
      background: theme.card,
      border: `1px solid ${theme.borderLight}`,
      borderRadius: theme.radiusMd,
      boxShadow: theme.shadow,
      marginBottom: 20,
      overflow: 'hidden',
    }} aria-labelledby="titulo-matriculas-mensais">
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.borderLight}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 id="titulo-matriculas-mensais" style={{ margin: 0, fontSize: 17, color: theme.text }}>
            📅 Matrículas por mês — {ano}
          </h2>
          {somenteConsulta && (
            <span style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--ghost-bg)', color: theme.textSecondary, fontSize: 11.5, fontWeight: 800 }}>
              👁️ Somente consulta
            </span>
          )}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button type="button" onClick={exportarPDF} className="report-action report-action-danger">
              📄 Baixar PDF
            </button>
            <button type="button" onClick={exportarExcel} className="report-action report-action-success">
              📊 Baixar Excel
            </button>
          </div>
        </div>
        <p style={{ margin: '5px 0 0', color: theme.textSecondary, fontSize: 12.5 }}>
          Somente matrículas ativas. Cada pessoa é contada uma única vez por RA; remanejamentos e AEE não duplicam o total.
        </p>
        {!somenteConsulta && <div style={{ marginTop: 12, border: `1px solid ${theme.primary}55`, borderRadius: theme.radius, background: `${theme.primary}08`, padding: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: theme.text, fontWeight: 850, fontSize: 14 }}>🔎 Cruzamento SED × Educacenso</div>
              <div style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                A base SED é o cadastro atual do aplicativo. Envie a Relação de Alunos por Escola do Educacenso para conferir CPF, nome, nascimento e sexo oficial.
              </div>
            </div>
            <input id="arquivo-educacenso-genero" className="report-file-input" type="file" accept=".xlsx,.xls"
              disabled={analisandoEducacenso} onChange={evento => analisarArquivoEducacenso(evento.target.files?.[0])} />
            <label htmlFor="arquivo-educacenso-genero" className="report-action report-action-primary"
              aria-disabled={analisandoEducacenso} aria-busy={analisandoEducacenso}>
              {analisandoEducacenso ? 'Analisando…' : '📥 Selecionar Educacenso'}
            </label>
          </div>
          {arquivoEducacenso && <div style={{ color: theme.textSecondary, fontSize: 11.5, marginTop: 7 }}>Arquivo: {arquivoEducacenso}</div>}
          {mensagemEducacenso && <div style={{ color: mensagemEducacenso.startsWith('Erro') || mensagemEducacenso.startsWith('Não') ? 'var(--report-danger)' : 'var(--report-green)', fontSize: 12, fontWeight: 700, marginTop: 7 }}>{mensagemEducacenso}</div>}

          {resultadoEducacenso && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 7 }}>
                <Resumo label="Ativos na SED/app" valor={resultadoEducacenso.totalSED} cor="var(--report-blue)" />
                <Resumo label="No Educacenso" valor={resultadoEducacenso.totalEducacenso} cor="var(--report-purple)" />
                <Resumo label="Encontrados" valor={resultadoEducacenso.encontrados.length} cor="var(--report-green)" />
                <Resumo label="Meninos oficiais" valor={resultadoEducacenso.masculino} cor="var(--report-blue)" />
                <Resumo label="Meninas oficiais" valor={resultadoEducacenso.feminino} cor="var(--report-pink)" />
                <Resumo label="Ainda não definidos" valor={resultadoEducacenso.naoInformado} cor="var(--report-orange)" />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9, alignItems: 'center' }}>
                <button type="button" onClick={aplicarSexoEducacenso} disabled={aplicandoEducacenso || resultadoEducacenso.encontrados.length === 0}
                  className="report-action report-action-success" aria-busy={aplicandoEducacenso}>
                  {aplicandoEducacenso ? 'Aplicando…' : `✅ Aplicar sexo oficial (${resultadoEducacenso.masculino + resultadoEducacenso.feminino})`}
                </button>
                <span style={{ color: theme.textSecondary, fontSize: 12 }}>
                  Somente SED: {resultadoEducacenso.somenteSED.length} · Somente Educacenso: {resultadoEducacenso.somenteEducacenso.length} · Ambíguos: {resultadoEducacenso.ambiguos.length}
                </span>
              </div>
              {(resultadoEducacenso.somenteSED.length > 0 || resultadoEducacenso.somenteEducacenso.length > 0 || resultadoEducacenso.ambiguos.length > 0) && (
                <details style={{ marginTop: 9, color: theme.textSecondary, fontSize: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--report-orange)' }}>⚠️ Ver divergências antes de concluir</summary>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
                    <ListaDivergencia titulo="Somente na SED/app" itens={resultadoEducacenso.somenteSED} />
                    <ListaDivergencia titulo="Somente no Educacenso" itens={resultadoEducacenso.somenteEducacenso} />
                    <ListaDivergencia titulo="Correspondência ambígua" itens={resultadoEducacenso.ambiguos.map(item => ({ nome: item.nome, turma: item.origem }))} />
                  </div>
                </details>
              )}
            </div>
          )}
        </div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Ano letivo
            <select value={ano} onChange={e => onAnoChange(Number(e.target.value))}
              style={{ ...input, display: 'block', margin: '4px 0 0', minWidth: 105 }}>
              {[2025, 2026, 2027].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Mês inicial
            <select value={mesInicio} onChange={e => {
              const novoInicio = Number(e.target.value);
              setMesInicio(novoInicio);
              if (novoInicio > mesFim) setMesFim(novoInicio);
            }} style={{ ...input, display: 'block', margin: '4px 0 0', minWidth: 145 }}>
              {MESES.slice(0, ultimoMesDisponivel).map((mes, indice) => <option key={mes} value={indice + 1}>{mes}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Mês final
            <select value={mesFim} onChange={e => setMesFim(Number(e.target.value))}
              style={{ ...input, display: 'block', margin: '4px 0 0', minWidth: 145 }}>
              {MESES.slice(mesInicio - 1, ultimoMesDisponivel).map((mes, indice) => (
                <option key={mes} value={mesInicio + indice}>{mes}</option>
              ))}
            </select>
          </label>
          <div style={{ padding: '8px 11px', borderRadius: theme.radius, background: `${theme.primary}12`, color: theme.textSecondary, fontSize: 12.5 }}>
            {MESES[mesInicio - 1]} a {MESES[mesFim - 1]} de {ano}
            {ano === hoje.getFullYear() && mesFim === hoje.getMonth() + 1 ? ` · até ${hoje.toLocaleDateString('pt-BR')}` : ''}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 10 }}>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Tipo de ensino
            <select value={tipoEnsino} onChange={e => {
              setTipoEnsino(e.target.value as TipoEnsino);
              setSerie('');
              setTurmaId('');
            }} style={{ ...input, display: 'block', margin: '4px 0 0', width: '100%' }}>
              <option value="">Todos — matrícula regular</option>
              {(Object.keys(TIPO_LABEL) as Array<Exclude<TipoEnsino, ''>>).map(tipo => (
                <option key={tipo} value={tipo}>{TIPO_LABEL[tipo]}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Série
            <select value={serie} onChange={e => { setSerie(e.target.value); setTurmaId(''); }}
              style={{ ...input, display: 'block', margin: '4px 0 0', width: '100%' }}>
              <option value="">Todas as séries</option>
              {seriesDisponiveis.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textSecondary }}>
            Turma
            <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
              style={{ ...input, display: 'block', margin: '4px 0 0', width: '100%' }}>
              <option value="">Todas as turmas</option>
              {turmasDisponiveis.map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setTipoEnsino(''); setSerie(''); setTurmaId(''); setMesInicio(1); setMesFim(ultimoMesDisponivel); }}
            className="report-action report-action-neutral" style={{ alignSelf: 'end', width: '100%' }}>
            🧹 Limpar filtros
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: '12px 16px' }}>
        <Resumo label="Alunos no período" valor={resumo.totalPeriodo.masculino} cor="var(--report-blue)" />
        <Resumo label="Alunas no período" valor={resumo.totalPeriodo.feminino} cor="var(--report-pink)" />
        <Resumo label="Sexo não informado" valor={resumo.totalPeriodo.naoInformado} cor="var(--report-orange)" />
        <Resumo label="Total único do período" valor={resumo.totalPeriodo.total} cor="var(--report-blue)" />
      </div>

      {(resumo.semSexo > 0 || resumo.semDataInicio > 0 || resumo.semDataSaida > 0) && (
        <div style={{ margin: '0 16px 12px', padding: '9px 12px', borderRadius: theme.radius, background: `${theme.orange}12`, border: `1px solid ${theme.orange}55`, color: theme.textSecondary, fontSize: 12.5 }}>
          ⚠️ Conferência necessária na SED:
          {resumo.semSexo > 0 ? ` ${resumo.semSexo} aluno(s) sem sexo informado.` : ''}
          {resumo.semDataInicio > 0 ? ` ${resumo.semDataInicio} aluno(s) sem data de início e fora da contagem mensal.` : ''}
          {resumo.semDataSaida > 0 ? ` ${resumo.semDataSaida} aluno(s) com situação de saída, mas sem data de saída; contabilizado(s) apenas no mês de início até conferência.` : ''}
          {!somenteConsulta && resumo.semSexo > 0 && (
            <button type="button" onClick={() => setMostrarConferenciaSexo(valor => !valor)}
              className="report-action report-action-warning" style={{ marginLeft: 10 }}>
              {mostrarConferenciaSexo ? 'Fechar conferência' : `Conferir ${resumo.semSexo} agora`}
            </button>
          )}
        </div>
      )}

      {!somenteConsulta && mostrarConferenciaSexo && resumo.semSexo > 0 && (
        <div style={{ margin: '0 16px 14px', border: `1px solid ${theme.orange}88`, borderRadius: theme.radius, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', background: `${theme.orange}12`, borderBottom: `1px solid ${theme.orange}55` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>👥 Conferência de meninos e meninas</div>
            <div style={{ marginTop: 3, fontSize: 12, color: theme.textSecondary }}>
              Confira cada estudante na SED e marque a opção correta. A confirmação será aplicada a todos os registros do mesmo RA e os totais serão atualizados imediatamente.
              {' '}Nomes com 💡 têm sugestão automática pelo primeiro nome — confira antes de aceitar, nada é salvo sem confirmação.
            </div>
            {totalComSugestao > 0 && (
              <button type="button" disabled={!!salvandoSexo} onClick={confirmarSugestoesEmLote}
                className="report-action report-action-primary" style={{ marginTop: 8 }}>
                {salvandoSexo === '__lote__' ? 'Salvando sugestões…' : `💡 Confirmar todas as sugestões (${totalComSugestao})`}
              </button>
            )}
            {erroSexo && <div style={{ marginTop: 6, color: 'var(--report-danger)', fontWeight: 700 }}>{erroSexo}</div>}
          </div>
          <div style={{ maxHeight: 430, overflowY: 'auto' }}>
            {pendentesSexoOrdenados.map((pendente, indice) => (
              <div key={pendente.chave} style={{
                display: 'grid', gridTemplateColumns: 'minmax(210px, 1fr) minmax(120px, .45fr) auto',
                alignItems: 'center', gap: 10, padding: '8px 12px',
                background: indice % 2 === 0 ? 'transparent' : theme.bg,
                borderBottom: `1px solid ${theme.borderLight}`,
              }}>
                <div>
                  <div style={{ color: theme.text, fontWeight: 700 }}>
                    {pendente.nome}
                    {pendente.sugestao && (
                      <span title={`Sugestão pelo primeiro nome: ${pendente.sugestao === 'M' ? 'Menino' : 'Menina'}`} style={{ marginLeft: 5 }}>
                        💡
                      </span>
                    )}
                  </div>
                  <div style={{ color: theme.textSecondary, fontSize: 11.5 }}>RA: {pendente.ra || 'não informado'}</div>
                </div>
                <div style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 600 }}>{pendente.turma}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" disabled={!!salvandoSexo} onClick={() => confirmarSexo(pendente.chave, pendente.ids, 'M')}
                    className="report-action report-action-primary"
                    style={{ boxShadow: pendente.sugestao === 'M' ? '0 0 0 2px #fbbf24' : undefined }}>
                    {salvandoSexo === pendente.chave ? 'Salvando…' : 'Menino'}
                  </button>
                  <button type="button" disabled={!!salvandoSexo} onClick={() => confirmarSexo(pendente.chave, pendente.ids, 'F')}
                    className="report-action report-action-pink"
                    style={{ boxShadow: pendente.sugestao === 'F' ? '0 0 0 2px #fbbf24' : undefined }}>
                    {salvandoSexo === pendente.chave ? 'Salvando…' : 'Menina'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ margin: '0 16px 14px', border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', background: theme.bg, borderBottom: `1px solid ${theme.borderLight}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>📊 Consolidado por ensino e ciclo/ano</div>
          <div style={{ marginTop: 3, fontSize: 11.5, color: theme.textSecondary }}>
            Totais únicos no período selecionado. O AEE aparece somente quando escolhido no filtro, evitando duplicidade com a matrícula regular.
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: theme.primary, color: 'white' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ensino / ciclo / ano</th>
                <th style={{ padding: '8px 7px', textAlign: 'center' }}>Meninos</th>
                <th style={{ padding: '8px 7px', textAlign: 'center' }}>Meninas</th>
                <th style={{ padding: '8px 7px', textAlign: 'center' }} title="Sexo não informado">N/I</th>
                <th style={{ padding: '8px 7px', textAlign: 'center' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {linhasConsolidadas.map((linha, indice) => (
                <tr key={linha.chave} style={{
                  background: linha.nivel === 'tipo' ? `${theme.primary}12` : indice % 2 === 0 ? 'transparent' : theme.bg,
                  borderBottom: `1px solid ${theme.borderLight}`,
                }}>
                  <td style={{
                    padding: linha.nivel === 'tipo' ? '9px 12px' : '7px 12px 7px 30px',
                    color: theme.text,
                    fontWeight: linha.nivel === 'tipo' ? 800 : 600,
                  }}>
                    {linha.nivel === 'serie' ? '↳ ' : ''}{linha.label}
                  </td>
                  <td style={numero('var(--report-blue)')}>{linha.contagem.masculino}</td>
                  <td style={numero('var(--report-pink)')}>{linha.contagem.feminino}</td>
                  <td style={numero(linha.contagem.naoInformado > 0 ? 'var(--report-orange)' : theme.textSecondary)}>{linha.contagem.naoInformado}</td>
                  <td style={{ ...numero(theme.text), fontWeight: 800 }}>{linha.contagem.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--footer-row)', borderTop: `2px solid ${theme.primary}55` }}>
                <td style={{ padding: '9px 12px', color: theme.text, fontWeight: 900 }}>TOTAL ÚNICO CONSOLIDADO</td>
                <td style={numero('var(--report-blue)')}>{resumo.totalPeriodo.masculino}</td>
                <td style={numero('var(--report-pink)')}>{resumo.totalPeriodo.feminino}</td>
                <td style={numero(resumo.totalPeriodo.naoInformado > 0 ? 'var(--report-orange)' : theme.textSecondary)}>{resumo.totalPeriodo.naoInformado}</td>
                <td style={{ ...numero(theme.text), fontWeight: 900 }}>{resumo.totalPeriodo.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: theme.primary, color: 'white' }}>
              <th rowSpan={2} style={{ padding: '9px 12px', textAlign: 'left' }}>Mês</th>
              <th colSpan={4} style={{ padding: 7, borderLeft: '1px solid rgba(255,255,255,.22)' }}>Matrículas existentes</th>
              <th colSpan={4} style={{ padding: 7, borderLeft: '1px solid rgba(255,255,255,.22)' }}>Entradas no mês</th>
              <th colSpan={4} style={{ padding: 7, borderLeft: '1px solid rgba(255,255,255,.22)' }}>Saídas no mês</th>
            </tr>
            <tr style={{ background: theme.primaryHover, color: 'white' }}>
              {[0, 1, 2].flatMap(grupo => ['Alunos', 'Alunas', 'N/I', 'Total'].map((label, indice) => (
                <th key={`${grupo}-${label}`} title={label === 'N/I' ? 'Sexo não informado' : undefined} style={{ padding: '6px 7px', textAlign: 'center', borderLeft: indice === 0 ? '1px solid rgba(255,255,255,.22)' : undefined }}>{label}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {resumo.meses.map((linha, indice) => (
              <tr key={linha.mes} style={{ background: indice % 2 === 0 ? 'transparent' : theme.bg, borderBottom: `1px solid ${theme.borderLight}` }}>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: theme.text }}>{MESES[linha.mes - 1]}</td>
                <CelulasContagem valor={linha.matriculados} />
                <CelulasContagem valor={linha.entradas} />
                <CelulasContagem valor={linha.saidas} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--footer-row)', borderTop: `2px solid ${theme.primary}55` }}>
              <td style={{ padding: '10px 12px', fontWeight: 800, color: theme.text }}>TOTAL DO PERÍODO*</td>
              <CelulasContagem valor={resumo.totalPeriodo} />
              <CelulasContagem valor={resumo.totalEntradas} />
              <CelulasContagem valor={resumo.totalSaidas} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ padding: '8px 16px 12px', color: theme.textSecondary, fontSize: 11.5 }}>
        * Em “Matrículas existentes”, o total representa pessoas únicas no período selecionado — não é a soma dos meses.
      </div>
    </section>
  );
}

function Resumo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div style={{ border: `1px solid ${cor}44`, borderRadius: theme.radius, padding: '9px 12px', background: `${cor}0d` }}>
      <div style={{ fontSize: 11.5, color: theme.textSecondary }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{valor}</div>
    </div>
  );
}

function ListaDivergencia({ titulo, itens }: { titulo: string; itens: Array<{ nome: string; turma: string }> }) {
  return (
    <div style={{ border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius, background: theme.card, padding: 8 }}>
      <div style={{ color: theme.text, fontWeight: 850, marginBottom: 5 }}>{titulo} ({itens.length})</div>
      {itens.length === 0
        ? <div style={{ color: theme.textSecondary }}>Nenhuma divergência.</div>
        : itens.map((item, indice) => (
          <div key={`${item.nome}-${item.turma}-${indice}`} style={{ padding: '4px 0', borderBottom: indice < itens.length - 1 ? `1px solid ${theme.borderLight}` : undefined }}>
            <div style={{ color: theme.text, fontWeight: 650 }}>{item.nome}</div>
            {item.turma && <div style={{ color: theme.textSecondary, fontSize: 11 }}>{item.turma}</div>}
          </div>
        ))}
    </div>
  );
}
