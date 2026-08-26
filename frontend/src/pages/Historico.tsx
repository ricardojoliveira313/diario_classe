import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../api';
import { btn, input, label, theme, contarDiasLetivosPeriodo } from '../styles';

interface TurmaHistorico {
  nome: string;
  professora: string | null;
  periodo: string | null;
}

interface AlunoHistorico {
  id: string;
  ra: number;
  nome: string;
  data_nascimento: string | null;
  cpf: string | null;
  situacao: string | null;
  turmaId: string | null;
  data_inicio_matricula: string | null;
  data_fim_matricula: string | null;
  Turma: TurmaHistorico | null;
}

interface NotaDisciplina {
  disciplina: string;
  nota: string;
  cargaHoraria: string;
}

interface LinhaCiclo {
  ciclo: number;
  label: string;
  anoLetivo: string;
  cargaHoraria: string;
  escola: string;
  complementoEstabelecimento: string;
  municipio: string;
  uf: string;
  resultado: string;
  notas: NotaDisciplina[];
  notasDiversificada: NotaDisciplina[];
  cargaHorariaOutraRede: string;
}

interface HistoricoSalvo {
  ciclo: number;
  ano_letivo: string | null;
  carga_horaria: string | null;
  escola: string | null;
  complemento_estabelecimento: string | null;
  municipio: string | null;
  uf: string | null;
  resultado: string | null;
  notas_disciplinas: unknown;
  notas_diversificada: unknown;
  carga_horaria_outra_rede: string | null;
  cert_num: string | null;
  cert_folha: string | null;
  cert_livro: string | null;
  cert_distrito: string | null;
  cidade_nasc: string | null;
  estado_nasc: string | null;
  nome_aluno: string | null;
  ra_exibicao: string | null;
  data_nascimento: string | null;
  cpf: string | null;
  situacao: string | null;
  data_inicio_matricula: string | null;
  data_fim_matricula: string | null;
  turma_nome: string | null;
  total_faltas: number | null;
  transferencia_ano_ciclo: string | null;
  transferencia_periodo: string | null;
  transferencia_dias_letivos: string | null;
  transferencia_presencas: string | null;
  transferencia_ausencias: string | null;
  prosseguimento_ano: string | null;
  data_emissao: string | null;
}

interface GrupoNotas {
  ciclo: number;
  label: string;
  anoLetivo: string;
  escola: string;
  notas: NotaDisciplina[];
  titulo?: string;
  cargaHorariaTotal?: string;
}

const CICLOS_LABELS = [
  '1º Ano / Inicial',
  '2º Ano / Intermediário',
  '3º Ano / Final',
  '4º Ano / Inicial',
  '5º Ano / Final',
];

const DISCIPLINAS_PADRAO = [
  'Língua Portuguesa',
  'Geografia',
  'História',
  'Ciências',
  'Matemática',
  'Arte',
  'Língua Estrangeira: Inglês',
  'Educação Física',
  'Filosofia',
  'Educação Financeira',
];

const DISCIPLINAS_DIVERSIFICADA_PADRAO = [
  'Projeto de Convivência',
  'Tecnologia e Inovação',
  'Práticas Experimentais',
  'Orientação de Estudos',
  'Assembleia',
  'Cultura do Movimento',
  'Linguagem Artística',
  'Inglês',
  'Leitura e Produção de Textos',
  'Experiências Matemáticas',
  'Educação Socioemocional',
];

const ESCOLA_PADRAO = 'EMEIEF LUIZ GONZAGA';
const MUN_PADRAO = 'Santo André';
const DIRETOR = 'Terezinha Babichaka Squiavoni';
const CARGO_DIRETOR = 'Diretora de Unidade Escolar';

const OBSERVACOES_LEGAIS = [
  'O Sistema Continuado de Ensino, conforme deliberação CEE 9/97, indicação 22/97 das Escolas Municipais de Santo André prevê avaliação contínua, cumulativa e sistemática, através da síntese de desempenho do aluno, elaborado por meio de registro. A verificação do rendimento escolar não prevê notas.',
  'O Curso de Ensino Fundamental Regular mantido pela Secretaria de Educação do Município de Santo André está organizado em dois ciclos:',
  'O referido curso equivale às cinco primeiras séries iniciais do Ensino Fundamental de 09 anos.',
  'Carga Horária Anual mínima de 1000 horas, distribuídas em 200 dias letivos.',
  'A organização do 1º ao 5º ano foi adotada a partir de 2011. (Deliberação CME nº.03/2010)',
  'O referido curso, Decreto Municipal 14.146, de 27/04/98 publicado no Diário do Grande ABC, equivale aos estudos das séries iniciais do Ensino Fundamental.',
  'De acordo com Lei nº 14.040/2020, de 18 de agosto de 2020, Art. 2º, em seu caput, indica que os estabelecimentos de ensino de educação básica ficam dispensados em caráter excepcional do cumprimento da obrigatoriedade dos 200 dias letivos (LDB nº 9394/96), especificando no Inciso II do mesmo artigo, que no ensino fundamental seja cumprida a carga horária mínima de 800 horas, também prevista na LDB. Na Rede Municipal de Santo André em 2020 foram cumpridas 940h.',
];

const campoDocumento: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#111',
  font: 'inherit',
  minWidth: 0,
  outline: 'none',
  padding: '1px 2px',
  textAlign: 'center',
  width: '100%',
};

function criarLinhasVazias(): LinhaCiclo[] {
  return CICLOS_LABELS.map((labelCiclo, index) => ({
    ciclo: index + 1,
    label: labelCiclo,
    anoLetivo: '',
    cargaHoraria: '1000',
    escola: '',
    complementoEstabelecimento: '',
    municipio: '',
    uf: 'SP',
    resultado: '',
    notas: [],
    notasDiversificada: [],
    cargaHorariaOutraRede: '',
  }));
}

function criarNotasPadrao(): NotaDisciplina[] {
  return DISCIPLINAS_PADRAO.map(disciplina => ({ disciplina, nota: '', cargaHoraria: '' }));
}

function criarNotasDiversificadaPadrao(): NotaDisciplina[] {
  return DISCIPLINAS_DIVERSIFICADA_PADRAO.map(disciplina => ({ disciplina, nota: '', cargaHoraria: '' }));
}

function normalizarNotas(valor: unknown): NotaDisciplina[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const registro = item as Record<string, unknown>;
      return {
        disciplina: String(registro.disciplina ?? ''),
        nota: String(registro.nota ?? ''),
        cargaHoraria: String(registro.cargaHoraria ?? registro.carga_horaria ?? ''),
      };
    })
    .filter(item => item.disciplina.trim() || item.nota.trim() || item.cargaHoraria.trim());
}

function dividirEmGrupos<T>(itens: T[], tamanho: number): T[][] {
  const grupos: T[][] = [];
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    grupos.push(itens.slice(inicio, inicio + tamanho));
  }
  return grupos;
}

function detectarCiclo(nomeTurma: string): number | null {
  const normalizado = nomeTurma
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, ' ');
  const ano = normalizado.match(/\b([1-5])\b.*ANO/);
  if (ano) return Number(ano[1]);
  if (/ALFABET/.test(normalizado) && !/POS.{0,5}ALFABET/.test(normalizado)) return 1;
  if (/POS.{0,5}ALFABET/.test(normalizado)) return 2;
  if (/1.*(ETAPA|CICLO)|INICIAL/.test(normalizado)) return 1;
  if (/2.*(ETAPA|CICLO)|INTERMEDIAR/.test(normalizado)) return 2;
  return null;
}

function isAtivo(situacao: string | null): boolean {
  return !situacao || situacao === 'ATIVO';
}

function isTurmaAEE(turma: TurmaHistorico | null): boolean {
  const nome = turma?.nome?.toUpperCase() ?? '';
  return nome.includes('AEE') || nome.includes('ATENDIMENTO');
}

function formatarData(data: string | null): string {
  if (!data) return '';
  const brasileira = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brasileira) return data;
  const iso = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return data;
}

function normalizarDataParaBanco(data: string | null): string | null {
  const valor = data?.trim();
  if (!valor) return null;
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const brasileira = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brasileira) return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
  return null;
}

function extrairAno(data: string | null): string {
  const valorBanco = normalizarDataParaBanco(data);
  return valorBanco?.slice(0, 4) ?? '';
}

function TabelaNotas({ grupo, anexo = false, repetirCabecalho = true }: { grupo: GrupoNotas; anexo?: boolean; repetirCabecalho?: boolean }) {
  return (
    <div className={anexo ? 'notas-anexo' : 'notas-frente'}>
      {repetirCabecalho && (
        <div className="notas-identificacao">
          <span className="notas-identificacao-texto">
            <strong>{grupo.label}</strong>
            {grupo.anoLetivo && <> · {grupo.anoLetivo}</>}
            {grupo.escola && <> · {grupo.escola}</>}
          </span>
          {grupo.titulo && <span className="notas-titulo-badge">{grupo.titulo}</span>}
        </div>
      )}
      <table className="tabela-notas">
        <tbody>
          <tr>
            <th>Disciplinas</th>
            {grupo.notas.map((nota, index) => <th key={`${nota.disciplina}-${index}`}>{nota.disciplina}</th>)}
            {grupo.cargaHorariaTotal && <th className="col-carga-total">Carga Horária Total</th>}
          </tr>
          <tr>
            <th>Notas</th>
            {grupo.notas.map((nota, index) => <td key={`nota-${index}`}>{nota.nota}</td>)}
            {grupo.cargaHorariaTotal && <td className="col-carga-total">{grupo.cargaHorariaTotal}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Historico() {
  const [raInput, setRaInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aluno, setAluno] = useState<AlunoHistorico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [totalFaltas, setTotalFaltas] = useState(0);
  const [linhas, setLinhas] = useState<LinhaCiclo[]>(criarLinhasVazias);
  const [dataEmissao, setDataEmissao] = useState(new Date().toLocaleDateString('pt-BR'));
  const [certNum, setCertNum] = useState('');
  const [certFolha, setCertFolha] = useState('');
  const [certLivro, setCertLivro] = useState('');
  const [certDistrito, setCertDistrito] = useState('');
  const [cidadeNasc, setCidadeNasc] = useState('SANTO ANDRÉ');
  const [estadoNasc, setEstadoNasc] = useState('SP');
  const [raExibicao, setRaExibicao] = useState('');
  const [transferenciaAnoCiclo, setTransferenciaAnoCiclo] = useState('');
  const [transferenciaPeriodo, setTransferenciaPeriodo] = useState('');
  const [transferenciaDiasLetivos, setTransferenciaDiasLetivos] = useState('');
  const [transferenciaPresencas, setTransferenciaPresencas] = useState('');
  const [transferenciaAusencias, setTransferenciaAusencias] = useState('');
  const [transferenciaDataInicio, setTransferenciaDataInicio] = useState('');
  const [transferenciaDataFim, setTransferenciaDataFim] = useState('');
  const [erroCalculoDiasLetivos, setErroCalculoDiasLetivos] = useState<string | null>(null);
  const [prosseguimentoAno, setProsseguimentoAno] = useState('');
  const [certSerie, setCertSerie] = useState('');
  const [via, setVia] = useState('1ª VIA');
  const [nomeAssinante, setNomeAssinante] = useState(DIRETOR);
  const [cargoAssinante, setCargoAssinante] = useState(CARGO_DIRETOR);
  const [historicosSalvos, setHistoricosSalvos] = useState<{ ra: number; nome: string; updated_at: string }[]>([]);
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [alteradoSemSalvar, setAlteradoSemSalvar] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Carrega lista de históricos salvos ao montar
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('HistoricoAluno')
        .select('ra, nome_aluno, updated_at')
        .order('updated_at', { ascending: false });
      if (!data) return;
      const vistos = new Set<number>();
      const unicos = data
        .filter(row => { if (vistos.has(row.ra)) return false; vistos.add(row.ra); return true; })
        .map(row => ({ ra: row.ra, nome: row.nome_aluno ?? String(row.ra), updated_at: row.updated_at ?? '' }));
      setHistoricosSalvos(unicos);
    })();
  }, []);

  // Auto-save com debounce de 4 segundos
  useEffect(() => {
    if (!aluno || !alteradoSemSalvar) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { void salvarHistorico(); }, 4000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluno, linhas, certNum, certFolha, certLivro, certDistrito, cidadeNasc, estadoNasc, raExibicao,
      transferenciaAnoCiclo, transferenciaPeriodo, transferenciaDiasLetivos, transferenciaPresencas,
      transferenciaAusencias, prosseguimentoAno, dataEmissao, totalFaltas, alteradoSemSalvar]);

  const limparCamposComplementares = () => {
    setCertNum('');
    setCertFolha('');
    setCertLivro('');
    setCertDistrito('');
    setCidadeNasc('SANTO ANDRÉ');
    setEstadoNasc('SP');
    setRaExibicao('');
    setTransferenciaAnoCiclo('');
    setTransferenciaPeriodo('');
    setTransferenciaDiasLetivos('');
    setTransferenciaPresencas('');
    setTransferenciaAusencias('');
    setProsseguimentoAno('');
    setDataEmissao(new Date().toLocaleDateString('pt-BR'));
    setCertSerie('');
  };

  // Calcula os dias letivos de um período exato (ex.: transferência no meio
  // do ano) usando o mesmo calendário oficial da aba Faltas — feriados,
  // recessos e sábados letivos — em vez de exigir contagem manual.
  const calcularDiasLetivosPeriodo = () => {
    setErroCalculoDiasLetivos(null);
    if (!transferenciaDataInicio || !transferenciaDataFim) {
      setErroCalculoDiasLetivos('Informe a data de início e a data de fim do período.');
      return;
    }
    const total = contarDiasLetivosPeriodo(transferenciaDataInicio, transferenciaDataFim);
    if (total === null) {
      setErroCalculoDiasLetivos('Período inválido — confira se a data de fim é depois da data de início.');
      return;
    }
    setAlteradoSemSalvar(true);
    setTransferenciaDiasLetivos(String(total));
    if (!transferenciaPeriodo.trim()) {
      setTransferenciaPeriodo(`${formatarData(transferenciaDataInicio)} a ${formatarData(transferenciaDataFim)}`);
    }
  };

  const buscarComRA = async (ra: number) => {
    setRaInput(String(ra));
    setCarregando(true);
    setErro(null);
    setAviso(null);
    setSucesso(null);
    setAluno(null);
    setTotalFaltas(0);
    setLinhas(criarLinhasVazias());
    limparCamposComplementares();

    try {
      const [alunoResult, historicoResult] = await Promise.all([
        supabase
          .from('Aluno')
          .select('ra, nome, data_nascimento, cpf, situacao, turmaId, data_inicio_matricula, data_fim_matricula, id')
          .eq('ra', ra),
        supabase.from('HistoricoAluno').select('*').eq('ra', ra).order('ciclo'),
      ]);

      if (alunoResult.error) throw new Error(`Não foi possível buscar o aluno: ${alunoResult.error.message}`);
      if (historicoResult.error) throw new Error(`Não foi possível carregar o histórico: ${historicoResult.error.message}`);

      const rows = alunoResult.data ?? [];
      const historico = (historicoResult.data ?? []) as HistoricoSalvo[];
      const primeiraLinha = historico[0];
      const turmaIds = [...new Set(rows.map(row => row.turmaId).filter((id): id is string => Boolean(id)))];
      const turmasPorId = new Map<string, TurmaHistorico>();

      if (turmaIds.length > 0) {
        const { data: turmas, error: turmasError } = await supabase
          .from('Turma')
          .select('id, nome, professora, periodo')
          .in('id', turmaIds);
        if (turmasError) throw new Error(`Não foi possível carregar a turma do aluno: ${turmasError.message}`);
        (turmas ?? []).forEach(turma => turmasPorId.set(turma.id, turma));
      }

      const candidatos = rows
        .filter(row => row.situacao !== 'REMA')
        .map(row => ({ ...row, Turma: row.turmaId ? (turmasPorId.get(row.turmaId) ?? null) : null })) as AlunoHistorico[];
      const baseSelecao = candidatos.length > 0
        ? candidatos
        : rows.map(row => ({ ...row, Turma: row.turmaId ? (turmasPorId.get(row.turmaId) ?? null) : null })) as AlunoHistorico[];
      const encontrado =
        baseSelecao.find(row => isAtivo(row.situacao) && !isTurmaAEE(row.Turma)) ??
        baseSelecao.find(row => isAtivo(row.situacao)) ??
        baseSelecao.find(row => !isTurmaAEE(row.Turma)) ??
        baseSelecao[0] ?? null;

      const selecionado: AlunoHistorico = encontrado
        ? {
            ...encontrado,
            nome: primeiraLinha?.nome_aluno ?? encontrado.nome,
            data_nascimento: primeiraLinha?.data_nascimento ?? encontrado.data_nascimento,
            cpf: primeiraLinha?.cpf ?? encontrado.cpf,
            situacao: primeiraLinha?.situacao ?? encontrado.situacao,
            data_inicio_matricula: primeiraLinha?.data_inicio_matricula ?? encontrado.data_inicio_matricula,
            data_fim_matricula: primeiraLinha?.data_fim_matricula ?? encontrado.data_fim_matricula,
            Turma: primeiraLinha?.turma_nome
              ? { nome: primeiraLinha.turma_nome, professora: null, periodo: null }
              : encontrado.Turma,
          }
        : {
            id: '',
            ra,
            nome: primeiraLinha?.nome_aluno ?? '',
            data_nascimento: primeiraLinha?.data_nascimento ?? null,
            cpf: primeiraLinha?.cpf ?? null,
            situacao: primeiraLinha?.situacao ?? 'TRAN',
            turmaId: null,
            data_inicio_matricula: primeiraLinha?.data_inicio_matricula ?? null,
            data_fim_matricula: primeiraLinha?.data_fim_matricula ?? null,
            Turma: primeiraLinha?.turma_nome
              ? { nome: primeiraLinha.turma_nome, professora: null, periodo: null }
              : null,
          };

      if (!encontrado) {
        setAviso(primeiraLinha
          ? 'Aluno fora do cadastro atual. O histórico salvo foi aberto para edição manual.'
          : `RA ${ra} não encontrado no cadastro atual. Preencha os dados manualmente e depois salve ou imprima.`);
      } else if (rows.length === 1 && isTurmaAEE(selecionado.Turma)) {
        setAviso('O único cadastro encontrado está vinculado a uma turma AEE/Atendimento. Confira os dados antes de emitir o histórico.');
      }

      const faltasResult = selecionado.id
        ? await supabase.from('Falta').select('faltas').eq('alunoId', selecionado.id)
        : { data: [], error: null };
      if (faltasResult.error) throw new Error(`Não foi possível carregar as faltas: ${faltasResult.error.message}`);

      const totalCalculado = (faltasResult.data ?? []).reduce(
        (soma, falta) => soma + Number(falta.faltas ?? 0),
        0,
      );
      const total = primeiraLinha?.total_faltas ?? totalCalculado;

      if (primeiraLinha) {
        setCertNum(primeiraLinha.cert_num ?? '');
        setCertFolha(primeiraLinha.cert_folha ?? '');
        setCertLivro(primeiraLinha.cert_livro ?? '');
        setCertDistrito(primeiraLinha.cert_distrito ?? '');
        setCidadeNasc(primeiraLinha.cidade_nasc ?? 'SANTO ANDRÉ');
        setEstadoNasc(primeiraLinha.estado_nasc ?? 'SP');
        setRaExibicao(primeiraLinha.ra_exibicao ?? String(ra));
        setTransferenciaAnoCiclo(primeiraLinha.transferencia_ano_ciclo ?? '');
        setTransferenciaPeriodo(primeiraLinha.transferencia_periodo ?? '');
        setTransferenciaDiasLetivos(primeiraLinha.transferencia_dias_letivos ?? '');
        setTransferenciaPresencas(primeiraLinha.transferencia_presencas ?? '');
        setTransferenciaAusencias(primeiraLinha.transferencia_ausencias ?? '');
        setProsseguimentoAno(primeiraLinha.prosseguimento_ano ?? '');
        setDataEmissao(primeiraLinha.data_emissao ?? new Date().toLocaleDateString('pt-BR'));
      } else {
        setRaExibicao(String(ra));
      }

      const cicloAtual = detectarCiclo(selecionado.Turma?.nome ?? '');
      const anoMatricula = extrairAno(selecionado.data_inicio_matricula);

      const construirLinha = (ciclo: number, labelCiclo: string, salva: HistoricoSalvo | undefined, ehCicloAtual: boolean): LinhaCiclo => {
        if (salva) {
          return {
            ciclo,
            label: labelCiclo,
            anoLetivo: salva.ano_letivo ?? '',
            cargaHoraria: salva.carga_horaria ?? (salva.ano_letivo === '2020' ? '800' : '1000'),
            escola: salva.escola ?? '',
            complementoEstabelecimento: salva.complemento_estabelecimento ?? '',
            municipio: salva.municipio ?? '',
            uf: salva.uf ?? 'SP',
            resultado: salva.resultado === 'PERMANENTE' ? 'PERMANECENTE' : (salva.resultado ?? ''),
            notas: normalizarNotas(salva.notas_disciplinas),
            notasDiversificada: normalizarNotas(salva.notas_diversificada),
            cargaHorariaOutraRede: salva.carga_horaria_outra_rede ?? '',
          };
        }
        return {
          ciclo,
          label: labelCiclo,
          anoLetivo: ehCicloAtual ? anoMatricula : '',
          cargaHoraria: anoMatricula === '2020' && ehCicloAtual ? '800' : '1000',
          escola: ehCicloAtual ? ESCOLA_PADRAO : '',
          complementoEstabelecimento: '',
          municipio: ehCicloAtual ? MUN_PADRAO : '',
          uf: 'SP',
          resultado: '',
          notas: [],
          notasDiversificada: [],
          cargaHorariaOutraRede: '',
        };
      };

      const novasLinhas: LinhaCiclo[] = CICLOS_LABELS.map((labelCiclo, index) => {
        const ciclo = index + 1;
        return construirLinha(ciclo, labelCiclo, historico.find(item => item.ciclo === ciclo), ciclo === cicloAtual);
      });

      // Repetições: ciclo 6 = 3º Ano permanente, ciclo 7 = 5º Ano permanente
      const rep3 = historico.find(item => item.ciclo === 6);
      const rep5 = historico.find(item => item.ciclo === 7);
      if (rep3) {
        const idx3 = novasLinhas.findIndex(l => l.ciclo === 3);
        if (idx3 !== -1) {
          novasLinhas[idx3] = { ...novasLinhas[idx3], resultado: 'PERMANECENTE' };
          novasLinhas.splice(idx3 + 1, 0, construirLinha(6, '3º Ano / Final', rep3, false));
        }
      }
      if (rep5) {
        const idx5 = novasLinhas.findIndex(l => l.ciclo === 5);
        if (idx5 !== -1) {
          novasLinhas[idx5] = { ...novasLinhas[idx5], resultado: 'PERMANECENTE' };
          novasLinhas.splice(idx5 + 1, 0, construirLinha(7, '5º Ano / Final', rep5, false));
        }
      }

      setAluno(selecionado);
      setTotalFaltas(total);
      setLinhas(novasLinhas);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico escolar.');
    } finally {
      setCarregando(false);
    }
  };

  const buscarPorRA = async () => {
    const ra = Number.parseInt(raInput.trim(), 10);
    if (Number.isNaN(ra)) {
      setErro('Digite um RA válido.');
      return;
    }
    await buscarComRA(ra);
  };

  // Clicar em "TRANSFERE-SE" só vincula ao quadro "Transferência durante o
  // período letivo" quando a LINHA daquele ano ainda está incompleta (sem
  // ano letivo, escola ou carga horária) — sinal de que o aluno saiu antes
  // de fechar o ano ali. O critério NÃO pode depender de qual ciclo é (1º ao
  // 5º): um aluno pode entrar em fevereiro no 5º Ano e ser transferido em
  // março, sem concluir nada — nesse caso o "TRANSFERE-SE" do 5º Ano tem que
  // vincular igual a qualquer outro ano, e o prosseguimento é a MESMA série
  // (ele vai continuar/repetir o 5º Ano na escola nova, não "ir pro 6º").
  // Quando a linha já está com os dados completos (ano concluído de fato),
  // TRANSFERE-SE só descreve para onde o aluno foi depois — não deve
  // sobrescrever nada, pois a conclusão já é detectada automaticamente por
  // concluiu5AnoAutomatico (preenchimento das 5 linhas), sem depender deste
  // clique.
  const vincularTransferenciaSeIncompleta = (linha: LinhaCiclo) => {
    const linhaCompleta = Boolean(linha.anoLetivo.trim() && linha.escola.trim() && linha.cargaHoraria.trim());
    if (linhaCompleta) return;
    const serie = linha.label.replace(/\s*\/.*$/, '');
    if (!transferenciaAnoCiclo) setTransferenciaAnoCiclo(serie);
    if (!prosseguimentoAno) setProsseguimentoAno(serie);
  };

  const atualizarLinha = (
    index: number,
    campo: keyof Omit<LinhaCiclo, 'ciclo' | 'label' | 'notas'>,
    valor: string,
  ) => {
    setAlteradoSemSalvar(true);
    setLinhas(atuais => atuais.map((linha, posicao) => {
      if (posicao !== index) return linha;
      if (campo === 'anoLetivo' && valor === '2020') {
        return { ...linha, anoLetivo: valor, cargaHoraria: '800' };
      }
      if (campo === 'resultado' && valor === 'TRANSFERE-SE') {
        vincularTransferenciaSeIncompleta(linha);
      }
      return { ...linha, [campo]: valor };
    }));
  };

  const atualizarAluno = <K extends keyof AlunoHistorico>(campo: K, valor: AlunoHistorico[K]) => {
    setAlteradoSemSalvar(true);
    setAluno(atual => atual ? { ...atual, [campo]: valor } : atual);
  };

  const atualizarTurma = (nome: string) => {
    setAluno(atual => atual ? {
      ...atual,
      Turma: { nome, professora: atual.Turma?.professora ?? null, periodo: atual.Turma?.periodo ?? null },
    } : atual);
  };

  // Gerencia resultado "PERMANECENTE" para 3º Ano (ciclo 3) e 5º Ano (ciclo 5),
  // inserindo ou removendo a linha de repetição (ciclos 6 e 7)
  const atualizarResultadoFinal = (index: number, valor: string) => {
    setAlteradoSemSalvar(true);
    setLinhas(atuais => {
      const linha = atuais[index];
      if (valor === 'TRANSFERE-SE') {
        vincularTransferenciaSeIncompleta(linha);
      }
      const cicloExtra = linha.ciclo === 3 ? 6 : 7;
      const updated = atuais.map((l, i) => i === index ? { ...l, resultado: valor } : l);
      const jaTemExtra = updated.some(l => l.ciclo === cicloExtra);
      if (valor === 'PERMANECENTE' && !jaTemExtra) {
        const novaLinha: LinhaCiclo = {
          ciclo: cicloExtra,
          label: linha.label,
          anoLetivo: linha.anoLetivo ? String(Number(linha.anoLetivo) + 1) : '',
          cargaHoraria: linha.cargaHoraria,
          escola: linha.escola,
          complementoEstabelecimento: '',
          municipio: linha.municipio,
          uf: linha.uf,
          resultado: '',
          notas: [],
          notasDiversificada: [],
          cargaHorariaOutraRede: '',
        };
        return [...updated.slice(0, index + 1), novaLinha, ...updated.slice(index + 1)];
      }
      if (valor !== 'PERMANECENTE' && jaTemExtra) {
        return updated.filter(l => l.ciclo !== cicloExtra);
      }
      return updated;
    });
  };

  const iniciarNotas = (index: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === index && linha.notas.length === 0 ? { ...linha, notas: criarNotasPadrao() } : linha
    )));
  };

  const adicionarDisciplina = (index: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === index
        ? { ...linha, notas: [...linha.notas, { disciplina: '', nota: '', cargaHoraria: '' }] }
        : linha
    )));
  };

  const atualizarNota = (indexLinha: number, indexNota: number, campo: keyof NotaDisciplina, valor: string) => {
    setLinhas(atuais => atuais.map((linha, posicao) => {
      if (posicao !== indexLinha) return linha;
      return {
        ...linha,
        notas: linha.notas.map((nota, posicaoNota) => (
          posicaoNota === indexNota ? { ...nota, [campo]: valor } : nota
        )),
      };
    }));
  };

  const removerDisciplina = (indexLinha: number, indexNota: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === indexLinha
        ? { ...linha, notas: linha.notas.filter((_, posicaoNota) => posicaoNota !== indexNota) }
        : linha
    )));
  };

  const limparNotas = (indexLinha: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === indexLinha ? { ...linha, notas: [] } : linha
    )));
  };

  const iniciarNotasDiversificada = (index: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === index && linha.notasDiversificada.length === 0
        ? { ...linha, notasDiversificada: criarNotasDiversificadaPadrao() }
        : linha
    )));
  };

  const adicionarDisciplinaDiversificada = (index: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === index
        ? { ...linha, notasDiversificada: [...linha.notasDiversificada, { disciplina: '', nota: '', cargaHoraria: '' }] }
        : linha
    )));
  };

  const atualizarNotaDiversificada = (indexLinha: number, indexNota: number, campo: keyof NotaDisciplina, valor: string) => {
    setLinhas(atuais => atuais.map((linha, posicao) => {
      if (posicao !== indexLinha) return linha;
      return {
        ...linha,
        notasDiversificada: linha.notasDiversificada.map((nota, posicaoNota) => (
          posicaoNota === indexNota ? { ...nota, [campo]: valor } : nota
        )),
      };
    }));
  };

  const removerDisciplinaDiversificada = (indexLinha: number, indexNota: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === indexLinha
        ? { ...linha, notasDiversificada: linha.notasDiversificada.filter((_, posicaoNota) => posicaoNota !== indexNota) }
        : linha
    )));
  };

  const limparNotasDiversificada = (indexLinha: number) => {
    setLinhas(atuais => atuais.map((linha, posicao) => (
      posicao === indexLinha ? { ...linha, notasDiversificada: [] } : linha
    )));
  };

  const salvarHistorico = async (): Promise<boolean> => {
    if (!aluno) return false;
    if (!Number.isInteger(aluno.ra) || aluno.ra <= 0) {
      setErro('Informe um RA válido antes de salvar ou imprimir.');
      return false;
    }
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    const camposComuns = {
      cert_num: certNum || null,
      cert_folha: certFolha || null,
      cert_livro: certLivro || null,
      cert_distrito: certDistrito || null,
      cidade_nasc: cidadeNasc || null,
      estado_nasc: estadoNasc || null,
      nome_aluno: aluno.nome.trim() || null,
      ra_exibicao: raExibicao.trim() || String(aluno.ra),
      data_nascimento: normalizarDataParaBanco(aluno.data_nascimento),
      cpf: aluno.cpf?.trim() || null,
      situacao: aluno.situacao?.trim().toUpperCase() || null,
      data_inicio_matricula: normalizarDataParaBanco(aluno.data_inicio_matricula),
      data_fim_matricula: normalizarDataParaBanco(aluno.data_fim_matricula),
      turma_nome: aluno.Turma?.nome.trim() || null,
      total_faltas: totalFaltas,
      transferencia_ano_ciclo: transferenciaAnoCiclo || null,
      transferencia_periodo: transferenciaPeriodo || null,
      transferencia_dias_letivos: transferenciaDiasLetivos || null,
      transferencia_presencas: transferenciaPresencas || null,
      transferencia_ausencias: transferenciaAusencias || null,
      prosseguimento_ano: prosseguimentoAno || null,
      data_emissao: dataEmissao || null,
      updated_at: new Date().toISOString(),
    };

    const registros = linhas.map(linha => ({
      ra: aluno.ra,
      ciclo: linha.ciclo,
      ano_letivo: linha.anoLetivo || null,
      carga_horaria: linha.cargaHoraria || null,
      escola: linha.escola || null,
      complemento_estabelecimento: linha.complementoEstabelecimento || null,
      municipio: linha.municipio || null,
      uf: linha.uf || null,
      resultado: linha.resultado || null,
      notas_disciplinas: linha.notas.filter(nota => (
        nota.disciplina.trim() || nota.nota.trim() || nota.cargaHoraria.trim()
      )),
      notas_diversificada: linha.notasDiversificada.filter(nota => (
        nota.disciplina.trim() || nota.nota.trim() || nota.cargaHoraria.trim()
      )),
      carga_horaria_outra_rede: linha.cargaHorariaOutraRede || null,
      ...camposComuns,
    }));

    const { error } = await supabase.from('HistoricoAluno').upsert(registros, { onConflict: 'ra,ciclo' });
    // Remove linhas de repetição do banco se o aluno não é mais PERMANECENTE
    if (!registros.some(r => r.ciclo === 6)) {
      await supabase.from('HistoricoAluno').delete().eq('ra', aluno.ra).eq('ciclo', 6);
    }
    if (!registros.some(r => r.ciclo === 7)) {
      await supabase.from('HistoricoAluno').delete().eq('ra', aluno.ra).eq('ciclo', 7);
    }
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar o histórico: ${error.message}`);
      return false;
    }
    setSucesso('Histórico salvo com sucesso.');
    setAlteradoSemSalvar(false);
    // Atualiza lista de históricos salvos
    setHistoricosSalvos(atuais => {
      const existe = atuais.find(h => h.ra === aluno.ra);
      const entrada = { ra: aluno.ra, nome: aluno.nome.trim() || String(aluno.ra), updated_at: new Date().toISOString() };
      return existe
        ? [entrada, ...atuais.filter(h => h.ra !== aluno.ra)]
        : [entrada, ...atuais];
    });
    return true;
  };

  const imprimir = async () => {
    const salvo = await salvarHistorico();
    if (salvo) window.print();
  };

  // Conclusão do 5º Ano é detectada pelo PREENCHIMENTO DO HISTÓRICO (1º ao 5º
  // Ano com ano letivo e escola registrados) — nunca pelo chip "TRANSFERE-SE"
  // da tabela de estudos, que só descreve para onde o aluno foi depois (essa
  // escola só vai até o 5º Ano, então TODO concluinte é "transferido" para
  // cursar o 6º ano em outra unidade; isso não significa que ele saiu no meio
  // do ano). Uma transferência real no meio do período letivo é um campo
  // separado, preenchido explicitamente no quadro "Transferência durante o
  // período letivo" (dias letivos/presenças/ausências) — só ela deve impedir
  // a conclusão automática.
  // Filtra por ciclo (não por posição no array) porque uma repetição de ano
  // (PERMANECENTE no 3º ou 5º Ano) insere uma linha extra (ciclo 6/7) que
  // desloca os índices seguintes — usar linhas[4] às cegas quebraria nesse caso.
  const linhasRegularesFundamental1 = linhas.filter(l => l.ciclo >= 1 && l.ciclo <= 5);
  const linha5Ano = linhas.find(l => l.ciclo === 5);
  const historico5AnosCompleto = linhasRegularesFundamental1.length === 5
    && linhasRegularesFundamental1.every(l => l.anoLetivo.trim() && l.escola.trim());
  const houveTransferenciaNoMeioDoAno = Boolean(
    transferenciaDiasLetivos.trim() || transferenciaPresencas.trim()
    || transferenciaAusencias.trim() || transferenciaPeriodo.trim(),
  );
  const concluiu5AnoAutomatico = historico5AnosCompleto && !houveTransferenciaNoMeioDoAno;

  // Monta Base Nacional Comum + Parte Diversificada JUNTAS por ano — nunca separadas
  // em páginas diferentes. Cada ano contribui suas tabelas em sequência (base antes
  // da diversificada), e essa sequência é tratada como um bloco indivisível na hora
  // de decidir o que vai na frente e o que vai para o anexo.
  const todasTabelasNotas = linhas.flatMap(linha => {
    const notasPreenchidas = linha.notas.filter(nota => (
      nota.disciplina.trim() || nota.nota.trim() || nota.cargaHoraria.trim()
    ));
    const diversificadaPreenchida = linha.notasDiversificada.filter(nota => (
      nota.disciplina.trim() || nota.nota.trim() || nota.cargaHoraria.trim()
    ));
    const temDiversificada = diversificadaPreenchida.length > 0;
    const gruposBase: GrupoNotas[] = dividirEmGrupos(notasPreenchidas, 10).map(notas => ({
      ciclo: linha.ciclo,
      label: linha.label,
      anoLetivo: linha.anoLetivo,
      escola: linha.escola,
      notas,
      titulo: temDiversificada ? 'Base Nacional Comum' : undefined,
    }));
    const gruposDiversificada: GrupoNotas[] = dividirEmGrupos(diversificadaPreenchida, 10).map(notas => ({
      ciclo: linha.ciclo,
      label: linha.label,
      anoLetivo: linha.anoLetivo,
      escola: linha.escola,
      notas,
      titulo: 'Parte Diversificada',
    }));
    const gruposLinha: GrupoNotas[] = [...gruposBase, ...gruposDiversificada];
    // Carga horária total do ano aparece só na ÚLTIMA tabela do ano (coluna extra
    // no final) — é o total anual (Base + Diversificada juntas), nunca por disciplina.
    const ultimoGrupo = gruposLinha[gruposLinha.length - 1];
    if (ultimoGrupo && linha.cargaHorariaOutraRede.trim()) ultimoGrupo.cargaHorariaTotal = linha.cargaHorariaOutraRede;
    return gruposLinha;
  });
  // Todas as tabelas de todos os anos ficam juntas, em sequência, na mesma
  // página da frente — nunca separadas numa página de anexo à parte. Se não
  // couber tudo numa folha, o conteúdo flui naturalmente para a próxima
  // (overflow:visible + height:auto no CSS de impressão cuidam disso).
  const gruposFrente = todasTabelasNotas;

  const rowspan1Ciclo = linhas.filter(l => l.ciclo <= 3 || l.ciclo === 6).length;
  const rowspan2Ciclo = linhas.filter(l => (l.ciclo >= 4 && l.ciclo <= 5) || l.ciclo === 7).length;
  const idxPrimeiro2Ciclo = linhas.findIndex(l => l.ciclo === 4);

  return (
    <div style={{ marginTop: 16 }}>
      <style>{`
        .historico-pagina { width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 9mm 8mm 10mm 9mm; margin: 0 auto 20px; background: #fff; color: #111; font-family: Arial, sans-serif; font-size: 10pt; box-shadow: ${theme.shadow}; overflow: hidden; }
        .historico-pagina * { box-sizing: border-box; }
        .pagina-etiqueta { width: 210mm; margin: 0 auto 5px; font-weight: 800; color: ${theme.textSecondary}; }
        .quadro-oficial { border: 1.5px solid #111; margin-bottom: 5mm; }
        .titulo-quadro { border-bottom: 1px solid #111; font-size: 12pt; font-weight: 800; margin: 0; padding: 2mm 2mm; text-align: center; text-transform: uppercase; }
        .historico-frente .quadro-oficial { margin-bottom: 3mm; }
        .historico-frente { display: flex; flex-direction: column; }
        .quadro-preenchimento { flex: 1 1 auto; min-height: 12mm; }
        .cabecalho-wrapper { position: relative; border: 1.5px solid #111; margin-bottom: 2mm; }
        .cabecalho-oficial { height: 22mm; display: grid; grid-template-columns: 34mm 1fr; align-items: center; padding: 1.5mm; }
        .cabecalho-oficial img { width: 31mm; height: auto; }
        .cabecalho-texto { text-align: center; font-weight: 800; font-size: 11pt; line-height: 1.2; }
        .cabecalho-texto h2 { font-size: 13pt; margin: 2.5mm 0 0; }
        .select-via {
          position: absolute; top: 2mm; right: 3mm; font-family: Arial, sans-serif; font-weight: 800; font-size: 9pt;
          border: 1px solid #555; border-radius: 0; background: transparent; color: #111; padding: 1px 14px 1px 4px; cursor: pointer;
          appearance: none; -webkit-appearance: none; -moz-appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'><path d='M0 0 L5 6 L10 0 Z' fill='%23111'/></svg>");
          background-repeat: no-repeat; background-position: right 4px center; background-size: 7px 5px;
        }
        @media print { .select-via { background-image: none; padding-right: 4px; } }
        .dados-escola { min-height: 32mm; padding: 2mm; font-size: 9.5pt; font-weight: 800; line-height: 1.28; }
        .tabela-oficial, .tabela-estudos, .tabela-transferencia, .tabela-notas { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .tabela-oficial { font-size: 9pt; }
        .tabela-oficial th, .tabela-oficial td, .tabela-estudos th, .tabela-estudos td, .tabela-transferencia th, .tabela-transferencia td { border: 1px solid #111; padding: 1.4mm 1mm; text-align: center; vertical-align: middle; }
        .tabela-oficial th, .tabela-oficial td { padding: .8mm .7mm; }
        .tabela-oficial th, .tabela-estudos th, .tabela-transferencia th { font-weight: 800; }
        .tabela-oficial .aluno-linha { height: 8mm; text-align: left; }
        .tabela-oficial .campo-aluno { text-align: left; font-weight: 800; }
        .tabela-oficial .linha-valor { height: 7.5mm; }
        .tabela-estudos th { height: 8mm; }
        .tabela-estudos td { height: 9mm; padding: .8mm; }
        .tabela-estudos .col-ciclo { width: 7mm; writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 700; }
        .tabela-estudos .col-ano-ciclo { width: 40mm; }
        .tabela-estudos .col-ano { width: 14mm; }
        .tabela-estudos .col-carga { width: 22mm; }
        .tabela-estudos .col-estabelecimento { width: 48mm; }
        .tabela-estudos .col-municipio { width: 32mm; }
        .tabela-estudos .col-uf { width: 13mm; }
        .campo-estabelecimento { display: flex; min-height: 8mm; flex-direction: column; justify-content: center; align-items: center; line-height: 1.1; }
        .campo-escola-documento { display: block; font-size: 8pt !important; min-height: 5mm; line-height: 1.2; overflow: visible; resize: none; word-break: break-word; white-space: pre-wrap; text-align: center; }
        .complemento-estabelecimento { font-size: 8pt; font-weight: 800; text-transform: uppercase; text-align: center; width: 100%; }
        .resultados-frente { min-height: 20mm; }
        .texto-equivalencia { font-size: 8.5pt; font-weight: 700; line-height: 1.15; padding: 2mm; text-align: center; }
        .notas-identificacao { font-size: 7.5pt; font-weight: 700; margin: .5mm 0; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 2mm; flex-wrap: wrap; }
        .notas-titulo-badge { font-size: 6pt; font-weight: 800; text-transform: uppercase; letter-spacing: .2px; color: #1e3a6e; background: #eef3fb; border: 0.3mm solid #b9c9e6; border-radius: 1mm; padding: .3mm 1.3mm; white-space: nowrap; }
        .tabela-notas { font-size: 6pt; line-height: 1.05; border: 0.3mm solid #555; }
        .tabela-notas th, .tabela-notas td { border: 1px solid #555; padding: .35mm .3mm; text-align: center; vertical-align: middle; word-break: break-word; }
        .tabela-notas th { background: #f2f4f7; font-weight: 800; }
        .tabela-notas th:first-child { width: 15mm; text-align: left; background: #e7ecf3; white-space: nowrap; }
        .tabela-notas .col-carga-total { width: 15mm; font-weight: 800; background: #e7ecf3; }
        .notas-frente { padding: 0 1mm; }
        .notas-frente + .notas-frente, .notas-anexo + .notas-anexo { margin-top: 0; }
        .notas-frente + .notas-frente .tabela-notas, .notas-anexo + .notas-anexo .tabela-notas { border-top: none; }
        .resultado-chips { display: flex; justify-content: center; align-items: center; gap: 1mm; margin-top: 1mm; width: 100%; flex-wrap: nowrap; }
        .resultado-chip { font-size: 6.6pt; font-weight: 700; padding: .4mm 1.4mm; border: 1px solid #999; border-radius: 1mm; background: #f5f5f5; color: #777; cursor: pointer; }
        .resultado-chip.ativo { background: #1e3a6e; color: #fff; border-color: #1e3a6e; }
        @media print {
          .resultado-chip { display: none; }
          .resultado-chip.ativo { display: inline-block; border: none; background: transparent; color: #111; font-size: 7.5pt; padding: 0; }
        }
        .tabela-transferencia th { height: 8mm; }
        .tabela-transferencia td { height: 9mm; }
        input::placeholder { color: #888; opacity: 1; }
        .observacoes-oficiais { height: 112mm; }
        .observacoes-corpo { padding: 3mm 2mm; font-size: 8.1pt; font-weight: 700; line-height: 1.14; }
        .observacao-item { display: grid; grid-template-columns: 7mm 1fr; margin-bottom: 2mm; }
        .ciclos-observacao { display: grid; grid-template-columns: 24mm 1fr; font-family: 'Courier New', monospace; font-size: 7.8pt; font-weight: 400; margin: 1mm 0 1.5mm 8mm; }
        .certificado-oficial { min-height: 32mm; }
        .certificado-texto { font-size: 10pt; line-height: 1.55; padding: 3mm 2mm; }
        .certificado-linha { display: block; margin-bottom: 1mm; }
        .certificado-campo { border: none; border-bottom: 1px solid #555; background: transparent; color: #111; font: inherit; font-weight: 800; outline: none; padding: 0 1px; vertical-align: baseline; }
        .historico-verso .quadro-oficial { margin-bottom: 5mm; }
        .assinatura-oficial { display: grid; grid-template-columns: 45% 55%; height: 42mm; margin-top: 5mm; }
        .assinatura-coluna { border-right: 1px solid #111; display: flex; flex-direction: column; justify-content: flex-end; text-align: center; }
        .assinatura-coluna:last-child { border-right: none; }
        .assinatura-conteudo { min-height: 33mm; display: flex; flex-direction: column; justify-content: flex-end; padding: 2mm; }
        .assinatura-legenda { border-top: 1px solid #111; font-size: 10pt; font-weight: 800; min-height: 9mm; padding: 2mm 1mm; }
        .aviso-final { font-size: 11pt; font-weight: 800; margin: 0; padding: 3mm; text-align: center; }
        .editor-card { background: ${theme.card}; border-radius: ${theme.radiusMd}; box-shadow: ${theme.shadow}; margin-bottom: 18px; padding: 18px; }
        .editor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
        .editor-notas { border: 1px solid ${theme.border}; border-radius: ${theme.radius}; margin-top: 12px; padding: 12px; }
        .editor-nota-linha { display: grid; grid-template-columns: minmax(180px, 2fr) 1fr auto; gap: 8px; margin-top: 7px; align-items: end; }
        @media (max-width: 900px) {
          .historico-rolagem { overflow-x: auto; padding-bottom: 8px; }
          .editor-nota-linha { grid-template-columns: 1fr; }
        }
        @media print {
          html, body, #root { width: 210mm !important; height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          body { visibility: hidden; background: #fff !important; }
          body *:not(:has(#historico-doc)):not(#historico-doc):not(#historico-doc *) { display: none !important; }
          body *:has(#historico-doc) { position: static !important; height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          #historico-doc { visibility: visible; position: static; width: 210mm; }
          #historico-doc, #historico-doc * { visibility: visible; }
          .nao-imprimir, .pagina-etiqueta { display: none !important; }
          .historico-pagina { width: 210mm; min-height: 295mm; height: auto; overflow: visible; margin: 0; padding: 9mm 8mm 10mm 9mm; box-shadow: none; break-after: page; page-break-after: always; }
          #historico-doc > div:last-child .historico-pagina { break-after: auto; page-break-after: auto; }
          .notas-frente, .notas-anexo, .tabela-notas, .tabela-notas tr { break-inside: avoid; page-break-inside: avoid; }
          input, textarea, select { border: none !important; outline: none !important; background: transparent !important; color: #111 !important; box-shadow: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <section className="editor-card nao-imprimir">
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>📜 Histórico Escolar</h1>
        <p style={{ margin: '0 0 16px', color: theme.textSecondary }}>
          Busque o aluno pelo RA. Se ele não estiver mais no cadastro, todos os dados poderão ser preenchidos manualmente.
        </p>
        <form onSubmit={event => { event.preventDefault(); void buscarPorRA(); }} style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label htmlFor="historico-ra" style={label}>R.A. do aluno</label>
            <input id="historico-ra" inputMode="numeric" style={input} value={raInput} onChange={event => setRaInput(event.target.value)} placeholder="Digite o RA" aria-describedby="historico-mensagem" />
          </div>
          <button type="submit" disabled={carregando} style={btn('primary')}>
            {carregando ? '⏳ Buscando...' : '🔎 Buscar aluno'}
          </button>
        </form>
        <div id="historico-mensagem" aria-live="polite">
          {erro && <p style={{ color: theme.danger, margin: '12px 0 0' }}>⚠️ {erro}</p>}
          {aviso && <p style={{ color: theme.warningHover, margin: '12px 0 0' }}>⚠️ {aviso}</p>}
          {sucesso && <p style={{ color: theme.success, margin: '12px 0 0' }}>✅ {sucesso}</p>}
        </div>

        {historicosSalvos.length > 0 && (
          <div style={{ marginTop: 20, borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Históricos salvos — segunda via</h3>
            <input
              style={{ ...input, marginBottom: 10 }}
              placeholder="Buscar por nome ou RA..."
              value={buscaHistorico}
              onChange={event => setBuscaHistorico(event.target.value)}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {historicosSalvos
                .filter(h => {
                  const q = buscaHistorico.toLowerCase();
                  return !q || h.nome.toLowerCase().includes(q) || String(h.ra).includes(q);
                })
                .map(h => (
                  <button
                    key={h.ra}
                    type="button"
                    style={{ ...btn('sky', { outline: true }), textAlign: 'left', justifyContent: 'flex-start' }}
                    onClick={() => { void buscarComRA(h.ra); }}
                  >
                    <strong>RA {h.ra}</strong> — {h.nome}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: theme.textSecondary }}>
                      {h.updated_at ? new Date(h.updated_at).toLocaleDateString('pt-BR') : ''}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </section>

      {aluno && (
        <>
          <section className="editor-card nao-imprimir">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Impressão — {aluno.nome}</h2>
                <small style={{ color: theme.textSecondary }}>Edite os campos diretamente no documento abaixo antes de imprimir.</small>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { void salvarHistorico(); }} disabled={salvando} style={btn('success')}>
                  {salvando ? '⏳ Salvando...' : '💾 Salvar'}
                </button>
                <button type="button" onClick={() => { void imprimir(); }} disabled={salvando} style={btn('primary')}>🖨️ Salvar e imprimir</button>
              </div>
            </div>
            <h3 style={{ margin: '18px 0 6px', fontSize: 16 }}>Notas de outra rede — opcional</h3>
            <p style={{ margin: '0 0 8px', color: theme.textSecondary }}>Adicione somente nos anos em que o histórico trouxer notas ou conceitos por disciplina.</p>
            {linhas.map((linha, indexLinha) => (
              <div className="editor-notas" key={`editor-notas-${linha.ciclo}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{linha.label} {linha.anoLetivo && `— ${linha.anoLetivo}`}</strong>
                  <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                    Carga horária total (outra rede)
                    <input style={{ ...input, width: 90 }} placeholder="Ex: 1600" value={linha.cargaHorariaOutraRede} onChange={event => atualizarLinha(indexLinha, 'cargaHorariaOutraRede', event.target.value)} />
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {linha.notas.length === 0 ? (
                      <button type="button" style={btn('sky', { outline: true })} onClick={() => iniciarNotas(indexLinha)}>➕ Adicionar notas por disciplina</button>
                    ) : (
                      <>
                        <button type="button" style={btn('sky', { outline: true })} onClick={() => adicionarDisciplina(indexLinha)}>➕ Outra disciplina</button>
                        <button type="button" style={btn('danger')} onClick={() => limparNotas(indexLinha)}>Remover notas deste ano</button>
                      </>
                    )}
                  </div>
                </div>
                {linha.notas.map((nota, indexNota) => (
                  <div className="editor-nota-linha" key={`nota-${linha.ciclo}-${indexNota}`}>
                    <label style={label}>Disciplina<input style={input} value={nota.disciplina} onChange={event => atualizarNota(indexLinha, indexNota, 'disciplina', event.target.value)} /></label>
                    <label style={label}>Nota/conceito<input style={input} value={nota.nota} onChange={event => atualizarNota(indexLinha, indexNota, 'nota', event.target.value)} placeholder="7,0; A; MB" /></label>
                    <button type="button" aria-label={`Excluir ${nota.disciplina || 'disciplina'}`} style={btn('danger')} onClick={() => removerDisciplina(indexLinha, indexNota)}>Excluir</button>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${theme.border}` }}>
                  <strong>Parte Diversificada</strong>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {linha.notasDiversificada.length === 0 ? (
                      <button type="button" style={btn('sky', { outline: true })} onClick={() => iniciarNotasDiversificada(indexLinha)}>➕ Adicionar Parte Diversificada</button>
                    ) : (
                      <>
                        <button type="button" style={btn('sky', { outline: true })} onClick={() => adicionarDisciplinaDiversificada(indexLinha)}>➕ Outra disciplina</button>
                        <button type="button" style={btn('danger')} onClick={() => limparNotasDiversificada(indexLinha)}>Remover Parte Diversificada</button>
                      </>
                    )}
                  </div>
                </div>
                {linha.notasDiversificada.map((nota, indexNota) => (
                  <div className="editor-nota-linha" key={`nota-div-${linha.ciclo}-${indexNota}`}>
                    <label style={label}>Disciplina<input style={input} value={nota.disciplina} onChange={event => atualizarNotaDiversificada(indexLinha, indexNota, 'disciplina', event.target.value)} /></label>
                    <label style={label}>Nota/conceito<input style={input} value={nota.nota} onChange={event => atualizarNotaDiversificada(indexLinha, indexNota, 'nota', event.target.value)} placeholder="7,0; A; MB; F/NF" /></label>
                    <button type="button" aria-label={`Excluir ${nota.disciplina || 'disciplina'}`} style={btn('danger')} onClick={() => removerDisciplinaDiversificada(indexLinha, indexNota)}>Excluir</button>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <div id="historico-doc" ref={printRef}>
            <div className="pagina-etiqueta nao-imprimir">Frente — página 1</div>
            <div className="historico-rolagem">
              <section className="historico-pagina historico-frente">
                <div className="cabecalho-wrapper">
                  <div className="cabecalho-oficial">
                    <img src="/brasao-santo-andre.png" alt="Prefeitura de Santo André" />
                    <div className="cabecalho-texto">
                      <div>SECRETARIA DE EDUCAÇÃO</div>
                      <div>DEPARTAMENTO DE EDUCAÇÃO E ENSINO FUNDAMENTAL</div>
                      <h2>HISTÓRICO ESCOLAR</h2>
                    </div>
                  </div>
                  <select
                    aria-label="Via do documento"
                    className="select-via"
                    value={via}
                    onChange={event => setVia(event.target.value)}
                  >
                    <option>1ª VIA</option>
                    <option>2ª VIA</option>
                    <option>3ª VIA</option>
                    <option>4ª VIA</option>
                  </select>
                </div>

                <div className="quadro-oficial dados-escola">
                  <div>ESCOLA MUNICIPAL DE EDUCAÇÃO INFANTIL E ENSINO FUNDAMENTAL</div>
                  <div>{ESCOLA_PADRAO}</div>
                  <div>ENDEREÇO: RUA IPANEMA Nº 253</div>
                  <div>BAIRRO: PARQUE ERASMO ASSUNÇÃO</div>
                  <div>CIDADE: SANTO ANDRÉ</div>
                  <div>FONE: 3356-7961 / 3356-7962</div>
                </div>

                <div className="quadro-oficial">
                  <table className="tabela-oficial">
                    <tbody>
                      <tr>
                        <td className="aluno-linha campo-aluno" colSpan={4}>ALUNO: <input aria-label="Nome do aluno" style={{ ...campoDocumento, width: '80%', textAlign: 'left', fontWeight: 800 }} value={aluno.nome} onChange={event => atualizarAluno('nome', event.target.value)} /></td>
                        <td className="campo-aluno">R.A.: <input aria-label="RA exibido" style={{ ...campoDocumento, width: '68%', fontWeight: 800 }} value={raExibicao} onChange={event => setRaExibicao(event.target.value)} /></td>
                      </tr>
                      <tr><th rowSpan={2}>LOCAL DE<br />NASCIMENTO</th><th colSpan={2}>CIDADE</th><th>ESTADO</th><th>DATA DE NASCIMENTO</th></tr>
                      <tr className="linha-valor"><td colSpan={2}><input aria-label="Cidade de nascimento" style={campoDocumento} value={cidadeNasc} onChange={event => setCidadeNasc(event.target.value)} /></td><td><input aria-label="Estado de nascimento" maxLength={2} style={campoDocumento} value={estadoNasc} onChange={event => setEstadoNasc(event.target.value.toUpperCase())} /></td><td><input aria-label="Data de nascimento" style={campoDocumento} value={formatarData(aluno.data_nascimento)} onChange={event => atualizarAluno('data_nascimento', event.target.value || null)} placeholder="dd/mm/aaaa" /></td></tr>
                      <tr><th>CERTIDÃO DE<br />NASCIMENTO Nº</th><th>Fls.</th><th>LIVRO</th><th>DISTRITO/MUNICÍPIO</th><th>ESTADO</th></tr>
                      <tr className="linha-valor"><td><input aria-label="Número da certidão" style={campoDocumento} value={certNum} onChange={event => setCertNum(event.target.value)} /></td><td><input aria-label="Folha da certidão" style={campoDocumento} value={certFolha} onChange={event => setCertFolha(event.target.value)} /></td><td><input aria-label="Livro da certidão" style={campoDocumento} value={certLivro} onChange={event => setCertLivro(event.target.value)} /></td><td><input aria-label="Distrito da certidão" style={campoDocumento} value={certDistrito} onChange={event => setCertDistrito(event.target.value)} /></td><td><input aria-label="Estado da certidão" maxLength={2} style={campoDocumento} value={estadoNasc} onChange={event => setEstadoNasc(event.target.value.toUpperCase())} /></td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="quadro-oficial" style={{ marginBottom: 0 }}>
                  <h3 className="titulo-quadro">Estudos realizados no Ensino Fundamental</h3>
                  <table className="tabela-estudos">
                    <thead><tr><th colSpan={2}>ANO/CICLO</th><th className="col-ano">ANO</th><th className="col-carga">C. HORÁRIA</th><th className="col-estabelecimento">ESTABELECIMENTO</th><th className="col-municipio">MUNICÍPIO</th><th className="col-uf">U.F.</th></tr></thead>
                    <tbody>
                      {linhas.map((linha, index) => {
                        const ehRepeticao = linha.ciclo === 6 || linha.ciclo === 7;
                        const aceitaPermanente = linha.ciclo === 3 || linha.ciclo === 5;
                        return (
                          <tr key={`ciclo-${linha.ciclo}-${index}`} style={ehRepeticao ? { background: '#fffbe6' } : undefined}>
                            {index === 0 && <td className="col-ciclo" rowSpan={rowspan1Ciclo}>1º ciclo</td>}
                            {index === idxPrimeiro2Ciclo && idxPrimeiro2Ciclo !== -1 && <td className="col-ciclo" rowSpan={rowspan2Ciclo}>2º ciclo</td>}
                            <td className="col-ano-ciclo">
                              {ehRepeticao ? <em>{linha.label}</em> : linha.label}
                            </td>
                            <td><input aria-label={`Ano letivo do ${linha.label}`} style={campoDocumento} value={linha.anoLetivo} onChange={event => atualizarLinha(index, 'anoLetivo', event.target.value)} /></td>
                            <td><input aria-label={`Carga horária do ${linha.label}`} style={campoDocumento} value={linha.cargaHoraria} onChange={event => atualizarLinha(index, 'cargaHoraria', event.target.value)} /></td>
                            <td>
                              <div className="campo-estabelecimento">
                                <textarea aria-label={`Estabelecimento do ${linha.label}`} className="campo-escola-documento" rows={Math.max(2, Math.ceil(linha.escola.length / 22))} style={campoDocumento} value={linha.escola} onChange={event => atualizarLinha(index, 'escola', event.target.value)} />
                                {!ehRepeticao && (
                                  <div className="resultado-chips" role="group" aria-label={`Resultado do ${linha.label}`}>
                                    {(aceitaPermanente ? (['PERMANECENTE', 'TRANSFERE-SE'] as const) : (['TRANSFERE-SE'] as const)).map(opcao => (
                                      <button
                                        type="button"
                                        key={opcao}
                                        className={`resultado-chip ${linha.resultado === opcao ? 'ativo' : ''}`}
                                        onClick={() => aceitaPermanente
                                          ? atualizarResultadoFinal(index, linha.resultado === opcao ? '' : opcao)
                                          : atualizarLinha(index, 'resultado', linha.resultado === opcao ? '' : opcao)}
                                      >
                                        {opcao}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {ehRepeticao && (
                                  <div className="resultado-chips" role="group" aria-label="Resultado da repetição">
                                    {(['APROVADO', 'TRANSFERE-SE'] as const).map(opcao => (
                                      <button
                                        type="button"
                                        key={opcao}
                                        className={`resultado-chip ${linha.resultado === opcao ? 'ativo' : ''}`}
                                        onClick={() => atualizarLinha(index, 'resultado', linha.resultado === opcao ? '' : opcao)}
                                      >
                                        {opcao}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td><input aria-label={`Município do ${linha.label}`} style={campoDocumento} value={linha.municipio} onChange={event => atualizarLinha(index, 'municipio', event.target.value)} /></td>
                            <td><input aria-label={`UF do ${linha.label}`} maxLength={2} style={campoDocumento} value={linha.uf} onChange={event => atualizarLinha(index, 'uf', event.target.value.toUpperCase())} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="resultados-frente">
                    <h3 className="titulo-quadro">Resultados de estudos realizados no Ensino Fundamental</h3>
                    <div className="texto-equivalencia">
                      O referido curso, criado pelo Decreto Municipal 14.146, de 27/04/98 e publicado em 29/04/98 no Diário do Grande ABC, equivale aos estudos das séries iniciais do Ensino Fundamental.<br />
                      {gruposFrente.length > 0 ? 'Notas e cargas horárias da outra rede registradas abaixo.' : 'Segue em anexo Instrumento de Registro Individual do(a) estudante.'}
                    </div>
                    {gruposFrente.map((grupo, index) => (
                      <TabelaNotas
                        key={`frente-${grupo.ciclo}-${index}`}
                        grupo={grupo}
                        repetirCabecalho={
                          index === 0
                          || grupo.ciclo !== gruposFrente[index - 1].ciclo
                          || grupo.titulo !== gruposFrente[index - 1].titulo
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="quadro-oficial quadro-preenchimento" aria-hidden="true" />
              </section>
            </div>

            <div className="pagina-etiqueta nao-imprimir">Verso — página 2</div>
            <div className="historico-rolagem">
              <section className="historico-pagina historico-verso">
                <div className="nao-imprimir" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 8, padding: '10px 12px', background: 'var(--ghost-bg)', borderRadius: theme.radius }}>
                  <div>
                    <label style={label} htmlFor="transf-data-inicio">Início do período</label>
                    <input id="transf-data-inicio" type="date" style={input} value={transferenciaDataInicio} onChange={event => setTransferenciaDataInicio(event.target.value)} />
                  </div>
                  <div>
                    <label style={label} htmlFor="transf-data-fim">Fim do período</label>
                    <input id="transf-data-fim" type="date" style={input} value={transferenciaDataFim} onChange={event => setTransferenciaDataFim(event.target.value)} />
                  </div>
                  <button type="button" onClick={calcularDiasLetivosPeriodo} style={btn('primary', { small: true })}>
                    📐 Calcular dias letivos
                  </button>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>
                    Preenche "Dias Letivos" (e "Período Letivo", se estiver vazio) usando o calendário oficial — feriados, recessos e sábados letivos.
                  </span>
                  {erroCalculoDiasLetivos && (
                    <span style={{ fontSize: 12, color: theme.danger, fontWeight: 700 }}>{erroCalculoDiasLetivos}</span>
                  )}
                </div>
                <div className="quadro-oficial">
                  <h3 className="titulo-quadro">Transferência durante o período letivo</h3>
                  <table className="tabela-transferencia">
                    <thead><tr><th>ANO/CICLO</th><th style={{ width: '27%' }}>PERÍODO LETIVO</th><th>DIAS LETIVOS</th><th>PRESENÇAS</th><th>AUSÊNCIAS</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><input aria-label="Ano ou ciclo da transferência" style={campoDocumento} value={transferenciaAnoCiclo} onChange={event => setTransferenciaAnoCiclo(event.target.value)} placeholder="- - - - -" /></td>
                        <td><input aria-label="Período letivo da transferência" style={campoDocumento} value={transferenciaPeriodo} onChange={event => setTransferenciaPeriodo(event.target.value)} placeholder="- - - - - - - - - - - - - - -" /></td>
                        <td><input aria-label="Dias letivos da transferência" style={campoDocumento} value={transferenciaDiasLetivos} onChange={event => setTransferenciaDiasLetivos(event.target.value)} placeholder="- - -" /></td>
                        <td><input aria-label="Presenças da transferência" style={campoDocumento} value={transferenciaPresencas} onChange={event => setTransferenciaPresencas(event.target.value)} placeholder="- - -" /></td>
                        <td><input aria-label="Ausências da transferência" style={campoDocumento} value={transferenciaAusencias} onChange={event => setTransferenciaAusencias(event.target.value)} placeholder="- - -" /></td>
                      </tr>
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'left', fontWeight: 800, padding: '2mm 1mm' }}>
                          O aluno tem direito a prosseguimento de estudos no{' '}
                          <input aria-label="Ano de prosseguimento" style={{ ...campoDocumento, display: 'inline-block', width: '28%', fontWeight: 800 }} value={prosseguimentoAno || (concluiu5AnoAutomatico ? '6º Ano' : '')} onChange={event => setProsseguimentoAno(event.target.value)} placeholder="- - - - - - - - -" />
                          {' '}do Ensino Fundamental de 9 anos.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="quadro-oficial observacoes-oficiais">
                  <h3 className="titulo-quadro">Observações</h3>
                  <div className="observacoes-corpo">
                    {OBSERVACOES_LEGAIS.map((texto, index) => (
                      <div className="observacao-item" key={`observacao-${index}`}>
                        <strong>{index + 1}.</strong>
                        <div>
                          {texto}
                          {index === 1 && (
                            <div className="ciclos-observacao">
                              <div>• 1º ciclo</div><div>1º ano — Ensino Fundamental inicial<br />2º ano — Ensino Fundamental intermediário<br />3º ano — Ensino Fundamental final</div>
                              <div>• 2º ciclo</div><div>4º ano — Ensino Fundamental inicial<br />5º ano — Ensino Fundamental final<br />(nomenclatura atual) — (nomenclatura anterior)</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* O Certificado SEMPRE aparece — o quadro fica visível mesmo quando
                    vazio (traço nos campos), mas se preenche sozinho quando o histórico
                    do 1º ao 5º Ano está completo (ano letivo + escola em cada linha) e
                    NÃO há uma transferência real no meio do período letivo registrada
                    no quadro acima. O chip "TRANSFERE-SE" da tabela de estudos NÃO entra
                    nessa conta — ele só descreve para onde o aluno foi depois de concluir
                    (esta escola só vai até o 5º Ano, então TODO concluinte "se transfere"
                    para cursar o 6º ano em outra unidade; isso não é uma saída no meio do
                    ano). A direção pode sempre sobrescrever os campos manualmente. */}
                <div className="quadro-oficial certificado-oficial">
                  <h3 className="titulo-quadro">Certificado</h3>
                  <div className="certificado-texto">
                    <span className="certificado-linha">
                      O diretor da <strong>{ESCOLA_PADRAO}</strong>, de acordo com o inciso VII do artigo 24 da lei 9394/96,
                    </span>
                    <span className="certificado-linha">
                      certifica que{' '}
                      <input
                        aria-label="Nome do aluno no certificado"
                        className="certificado-campo"
                        size={Math.max(aluno.nome.length + 2, 20)}
                        value={aluno.nome}
                        onChange={event => atualizarAluno('nome', event.target.value)}
                      />
                      , concluiu o{' '}
                      <input
                        aria-label="Série no certificado"
                        className="certificado-campo"
                        size={Math.max((certSerie || (concluiu5AnoAutomatico ? '5º Ano' : '- - - - -')).length + 2, 8)}
                        value={certSerie || (concluiu5AnoAutomatico ? '5º Ano' : '')}
                        placeholder="- - - - -"
                        onChange={event => setCertSerie(event.target.value)}
                      />
                      {' '}do Ensino Fundamental, no ano letivo de{' '}
                      <input
                        aria-label="Ano letivo no certificado"
                        className="certificado-campo"
                        size={6}
                        value={linha5Ano?.anoLetivo ?? ''}
                        placeholder="- - - -"
                        onChange={event => {
                          const idx = linhas.findIndex(l => l.ciclo === 5);
                          if (idx !== -1) atualizarLinha(idx, 'anoLetivo', event.target.value);
                        }}
                      />.
                    </span>
                  </div>
                </div>

                <div className="quadro-oficial assinatura-oficial">
                  <div className="assinatura-coluna"><div className="assinatura-conteudo"><strong>Santo André, <input aria-label="Data de emissão" style={{ ...campoDocumento, display: 'inline-block', width: '36mm', fontWeight: 800 }} value={dataEmissao} onChange={event => setDataEmissao(event.target.value)} /></strong></div><div className="assinatura-legenda">DATA</div></div>
                  <div className="assinatura-coluna"><div className="assinatura-conteudo"><strong><input aria-label="Nome do assinante" style={{ ...campoDocumento, fontWeight: 800 }} value={nomeAssinante} onChange={event => setNomeAssinante(event.target.value)} /></strong><input aria-label="Cargo do assinante" style={campoDocumento} value={cargoAssinante} onChange={event => setCargoAssinante(event.target.value)} /></div><div className="assinatura-legenda">ASSINATURA DO DIRETOR (Carimbo)</div></div>
                </div>

                <div className="quadro-oficial aviso-final">ESTE DOCUMENTO NÃO CONTÉM EMENDA NEM RASURA</div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
