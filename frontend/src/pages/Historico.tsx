import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../api';
import { btn, input, label, theme } from '../styles';

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
  }));
}

function criarNotasPadrao(): NotaDisciplina[] {
  return DISCIPLINAS_PADRAO.map(disciplina => ({ disciplina, nota: '', cargaHoraria: '' }));
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

function normalizarSituacao(situacao: string | null): string {
  return (situacao ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

function TabelaNotas({ grupo, anexo = false }: { grupo: GrupoNotas; anexo?: boolean }) {
  return (
    <div className={anexo ? 'notas-anexo' : 'notas-frente'}>
      <div className="notas-identificacao">
        <strong>{grupo.label}</strong>
        {grupo.anoLetivo && <> · {grupo.anoLetivo}</>}
        {grupo.escola && <> · {grupo.escola}</>}
      </div>
      <table className="tabela-notas">
        <tbody>
          <tr>
            <th>Disciplinas</th>
            {grupo.notas.map((nota, index) => <th key={`${nota.disciplina}-${index}`}>{nota.disciplina}</th>)}
          </tr>
          <tr>
            <th>Notas</th>
            {grupo.notas.map((nota, index) => <td key={`nota-${index}`}>{nota.nota}</td>)}
          </tr>
          <tr>
            <th>Carga horária</th>
            {grupo.notas.map((nota, index) => <td key={`carga-${index}`}>{nota.cargaHoraria}</td>)}
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
  const [prosseguimentoAno, setProsseguimentoAno] = useState('');
  const [nomeAssinante, setNomeAssinante] = useState(DIRETOR);
  const [cargoAssinante, setCargoAssinante] = useState(CARGO_DIRETOR);
  const printRef = useRef<HTMLDivElement>(null);

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
  };

  const buscarPorRA = async () => {
    const ra = Number.parseInt(raInput.trim(), 10);
    if (Number.isNaN(ra)) {
      setErro('Digite um RA válido.');
      return;
    }

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
      const novasLinhas = CICLOS_LABELS.map((labelCiclo, index): LinhaCiclo => {
        const ciclo = index + 1;
        const salva = historico.find(item => item.ciclo === ciclo);
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
            resultado: salva.resultado ?? '',
            notas: normalizarNotas(salva.notas_disciplinas),
          };
        }
        const ehCicloAtual = ciclo === cicloAtual;
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
        };
      });

      setAluno(selecionado);
      setTotalFaltas(total);
      setLinhas(novasLinhas);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico escolar.');
    } finally {
      setCarregando(false);
    }
  };

  const atualizarLinha = (
    index: number,
    campo: keyof Omit<LinhaCiclo, 'ciclo' | 'label' | 'notas'>,
    valor: string,
  ) => {
    setLinhas(atuais => atuais.map((linha, posicao) => {
      if (posicao !== index) return linha;
      if (campo === 'anoLetivo' && valor === '2020') {
        return { ...linha, anoLetivo: valor, cargaHoraria: '800' };
      }
      if (campo === 'complementoEstabelecimento' && normalizarSituacao(valor).includes('TRANSFERE')) {
        if (!transferenciaAnoCiclo) setTransferenciaAnoCiclo(linha.anoLetivo || linha.label);
        if (!prosseguimentoAno) setProsseguimentoAno(linha.label.replace(/\s*\/.*$/, ''));
      }
      return { ...linha, [campo]: valor };
    }));
  };

  const atualizarAluno = <K extends keyof AlunoHistorico>(campo: K, valor: AlunoHistorico[K]) => {
    setAluno(atual => atual ? { ...atual, [campo]: valor } : atual);
  };

  const atualizarTurma = (nome: string) => {
    setAluno(atual => atual ? {
      ...atual,
      Turma: { nome, professora: atual.Turma?.professora ?? null, periodo: atual.Turma?.periodo ?? null },
    } : atual);
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
      ...camposComuns,
    }));

    const { error } = await supabase.from('HistoricoAluno').upsert(registros, { onConflict: 'ra,ciclo' });
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar o histórico: ${error.message}`);
      return false;
    }
    setSucesso('Histórico salvo com sucesso.');
    return true;
  };

  const imprimir = async () => {
    const salvo = await salvarHistorico();
    if (salvo) window.print();
  };

  const situacaoNormalizada = normalizarSituacao(aluno?.situacao ?? null);
  const mostrarCertificado = Boolean(
    aluno
    && (isAtivo(aluno.situacao) || situacaoNormalizada.startsWith('CONCLUI'))
    && linhas[4]?.anoLetivo.trim(),
  );
  const tabelasNotas = linhas.flatMap(linha => {
    const notasPreenchidas = linha.notas.filter(nota => (
      nota.disciplina.trim() || nota.nota.trim() || nota.cargaHoraria.trim()
    ));
    return dividirEmGrupos(notasPreenchidas, 10).map(notas => ({
      ciclo: linha.ciclo,
      label: linha.label,
      anoLetivo: linha.anoLetivo,
      escola: linha.escola,
      notas,
    }));
  });
  const tabelaNotasFrente = tabelasNotas[0] ?? null;
  const tabelasNotasAnexo = tabelasNotas.slice(1);

  return (
    <div style={{ marginTop: 16 }}>
      <style>{`
        .historico-pagina { width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 13mm 10mm 14mm 13mm; margin: 0 auto 20px; background: #fff; color: #111; font-family: Arial, sans-serif; font-size: 10pt; box-shadow: ${theme.shadow}; overflow: hidden; }
        .historico-pagina * { box-sizing: border-box; }
        .pagina-etiqueta { width: 210mm; margin: 0 auto 5px; font-weight: 800; color: ${theme.textSecondary}; }
        .quadro-oficial { border: 1.5px solid #111; margin-bottom: 7mm; }
        .titulo-quadro { border-bottom: 1px solid #111; font-size: 12pt; font-weight: 800; margin: 0; padding: 2.5mm 2mm; text-align: center; text-transform: uppercase; }
        .historico-frente .quadro-oficial { margin-bottom: 4mm; }
        .cabecalho-oficial { height: 30mm; display: grid; grid-template-columns: 46mm 1fr; align-items: center; padding: 2mm; }
        .cabecalho-oficial img { width: 43mm; height: auto; }
        .cabecalho-texto { text-align: center; font-weight: 800; font-size: 12pt; line-height: 1.25; }
        .cabecalho-texto h2 { font-size: 14pt; margin: 6mm 0 0; }
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
        .campo-estabelecimento { display: flex; min-height: 8mm; flex-direction: column; justify-content: center; line-height: 1.1; }
        .campo-escola-documento { display: block; font-size: 8pt !important; height: 5.4mm; line-height: 1.02; overflow: hidden; resize: none; }
        .complemento-estabelecimento { font-size: 8pt; font-weight: 800; text-transform: uppercase; }
        .resultados-frente { min-height: 48mm; }
        .texto-equivalencia { font-size: 9pt; font-weight: 700; line-height: 1.2; padding: 3mm 2mm; text-align: center; }
        .notas-identificacao { font-size: 8pt; font-weight: 700; margin: 1mm 0; text-align: left; }
        .tabela-notas { font-size: 6.6pt; }
        .tabela-notas th, .tabela-notas td { border: 1px solid #555; padding: .7mm .4mm; text-align: center; vertical-align: middle; word-break: break-word; }
        .tabela-notas th:first-child { width: 17mm; text-align: left; }
        .notas-frente { padding: 0 1mm 1mm; }
        .tabela-transferencia th { height: 8mm; }
        .tabela-transferencia td { height: 9mm; }
        input::placeholder { color: #888; opacity: 1; }
        .observacoes-oficiais { height: 112mm; }
        .observacoes-corpo { padding: 3mm 2mm; font-size: 8.1pt; font-weight: 700; line-height: 1.14; }
        .observacao-item { display: grid; grid-template-columns: 7mm 1fr; margin-bottom: 2mm; }
        .ciclos-observacao { display: grid; grid-template-columns: 24mm 1fr; font-family: 'Courier New', monospace; font-size: 7.8pt; font-weight: 400; margin: 1mm 0 1.5mm 8mm; }
        .certificado-oficial { height: 30mm; }
        .certificado-texto { font-size: 11pt; line-height: 1.35; padding: 4mm 2mm; text-align: justify; }
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
        .editor-nota-linha { display: grid; grid-template-columns: minmax(180px, 2fr) 1fr 1fr auto; gap: 8px; margin-top: 7px; align-items: end; }
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
          .historico-pagina { width: 210mm; height: 295mm; min-height: 295mm; margin: 0; padding: 13mm 10mm 14mm 13mm; box-shadow: none; break-after: page; page-break-after: always; }
          #historico-doc > div:last-child .historico-pagina { break-after: auto; page-break-after: auto; }
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
      </section>

      {aluno && (
        <>
          <section className="editor-card nao-imprimir">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Dados complementares e impressão</h2>
                <small style={{ color: theme.textSecondary }}>Estes campos não alteram o cadastro original do aluno.</small>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { void salvarHistorico(); }} disabled={salvando} style={btn('success')}>
                  {salvando ? '⏳ Salvando...' : '💾 Salvar'}
                </button>
                <button type="button" onClick={() => { void imprimir(); }} disabled={salvando} style={btn('primary')}>🖨️ Salvar e imprimir</button>
              </div>
            </div>
            <div className="editor-grid">
              <label style={label}>Situação<input list="historico-situacoes" style={input} value={aluno.situacao ?? ''} onChange={event => atualizarAluno('situacao', event.target.value.toUpperCase() || null)} /></label>
              <datalist id="historico-situacoes"><option value="ATIVO" /><option value="TRAN" /><option value="BXTR" /><option value="CONCLUÍDO" /></datalist>
              <label style={label}>Início da matrícula<input type="date" style={input} value={normalizarDataParaBanco(aluno.data_inicio_matricula) ?? ''} onChange={event => atualizarAluno('data_inicio_matricula', event.target.value || null)} /></label>
              <label style={label}>Data de saída<input type="date" style={input} value={normalizarDataParaBanco(aluno.data_fim_matricula) ?? ''} onChange={event => atualizarAluno('data_fim_matricula', event.target.value || null)} /></label>
              <label style={label}>Última turma<input style={input} value={aluno.Turma?.nome ?? ''} onChange={event => atualizarTurma(event.target.value)} /></label>
              <label style={label}>Total de faltas<input type="number" min={0} style={input} value={totalFaltas} onChange={event => setTotalFaltas(Math.max(0, Number(event.target.value) || 0))} /></label>
            </div>
            <h3 style={{ margin: '18px 0 6px', fontSize: 16 }}>Notas de outra rede — opcional</h3>
            <p style={{ margin: '0 0 8px', color: theme.textSecondary }}>Adicione somente nos anos em que o histórico trouxer notas ou conceitos por disciplina.</p>
            {linhas.map((linha, indexLinha) => (
              <div className="editor-notas" key={`editor-notas-${linha.ciclo}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{linha.label} {linha.anoLetivo && `— ${linha.anoLetivo}`}</strong>
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
                    <label style={label}>Carga horária<input style={input} value={nota.cargaHoraria} onChange={event => atualizarNota(indexLinha, indexNota, 'cargaHoraria', event.target.value)} /></label>
                    <button type="button" aria-label={`Excluir ${nota.disciplina || 'disciplina'}`} style={btn('danger')} onClick={() => removerDisciplina(indexLinha, indexNota)}>Excluir</button>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <div id="historico-doc" ref={printRef}>
            <div className="pagina-etiqueta nao-imprimir">Frente — página 1</div>
            <div className="historico-rolagem">
              <section className="historico-pagina historico-frente">
                <div className="quadro-oficial cabecalho-oficial">
                  <img src="/brasao-santo-andre.png" alt="Prefeitura de Santo André" />
                  <div className="cabecalho-texto">
                    <div>SECRETARIA DE EDUCAÇÃO</div>
                    <div>DEPARTAMENTO DE EDUCAÇÃO E ENSINO FUNDAMENTAL</div>
                    <h2>HISTÓRICO ESCOLAR</h2>
                  </div>
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
                      {linhas.map((linha, index) => (
                        <tr key={`ciclo-${linha.ciclo}`}>
                          {index === 0 && <td className="col-ciclo" rowSpan={3}>1º ciclo</td>}
                          {index === 3 && <td className="col-ciclo" rowSpan={2}>2º ciclo</td>}
                          <td className="col-ano-ciclo">{linha.label}</td>
                          <td><input aria-label={`Ano letivo do ${linha.label}`} style={campoDocumento} value={linha.anoLetivo} onChange={event => atualizarLinha(index, 'anoLetivo', event.target.value)} /></td>
                          <td><input aria-label={`Carga horária do ${linha.label}`} style={campoDocumento} value={linha.cargaHoraria} onChange={event => atualizarLinha(index, 'cargaHoraria', event.target.value)} /></td>
                          <td>
                            <div className="campo-estabelecimento">
                              <textarea aria-label={`Estabelecimento do ${linha.label}`} className="campo-escola-documento" rows={2} style={campoDocumento} value={linha.escola} onChange={event => atualizarLinha(index, 'escola', event.target.value)} />
                              <input aria-label={`Complemento do estabelecimento do ${linha.label}`} list="complementos-estabelecimento" className="complemento-estabelecimento" style={campoDocumento} value={linha.complementoEstabelecimento} onChange={event => atualizarLinha(index, 'complementoEstabelecimento', event.target.value.toUpperCase())} />
                            </div>
                          </td>
                          <td><input aria-label={`Município do ${linha.label}`} style={campoDocumento} value={linha.municipio} onChange={event => atualizarLinha(index, 'municipio', event.target.value)} /></td>
                          <td><input aria-label={`UF do ${linha.label}`} maxLength={2} style={campoDocumento} value={linha.uf} onChange={event => atualizarLinha(index, 'uf', event.target.value.toUpperCase())} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <datalist id="complementos-estabelecimento"><option value="TRANSFERE-SE" /></datalist>
                  <div className="resultados-frente">
                    <h3 className="titulo-quadro">Resultados de estudos realizados no Ensino Fundamental</h3>
                    <div className="texto-equivalencia">
                      O referido curso, criado pelo Decreto Municipal 14.146, de 27/04/98 e publicado em 29/04/98 no Diário do Grande ABC, equivale aos estudos das séries iniciais do Ensino Fundamental.<br />
                      {tabelaNotasFrente ? 'Notas e cargas horárias da outra rede registradas abaixo.' : 'Segue em anexo Instrumento de Registro Individual do(a) estudante.'}
                    </div>
                    {tabelaNotasFrente && <TabelaNotas grupo={tabelaNotasFrente} />}
                  </div>
                </div>
              </section>
            </div>

            <div className="pagina-etiqueta nao-imprimir">Verso — página 2</div>
            <div className="historico-rolagem">
              <section className="historico-pagina historico-verso">
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
                          <input aria-label="Ano de prosseguimento" style={{ ...campoDocumento, display: 'inline-block', width: '28%', fontWeight: 800 }} value={prosseguimentoAno} onChange={event => setProsseguimentoAno(event.target.value)} placeholder="- - - - - - - - -" />
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

                <div className="quadro-oficial certificado-oficial">
                  <h3 className="titulo-quadro">Certificado</h3>
                  {mostrarCertificado && (
                    <div className="certificado-texto">
                      O diretor da <strong>{ESCOLA_PADRAO}</strong>, de acordo com o inciso VII do artigo 24 da Lei 9.394/96, certifica que <strong>{aluno.nome}</strong> concluiu o <strong>5º Ano do Ensino Fundamental</strong>, no ano letivo de <strong>{linhas[4].anoLetivo}</strong>.
                    </div>
                  )}
                </div>

                <div className="quadro-oficial assinatura-oficial">
                  <div className="assinatura-coluna"><div className="assinatura-conteudo"><strong>Santo André, <input aria-label="Data de emissão" style={{ ...campoDocumento, display: 'inline-block', width: '36mm', fontWeight: 800 }} value={dataEmissao} onChange={event => setDataEmissao(event.target.value)} /></strong></div><div className="assinatura-legenda">DATA</div></div>
                  <div className="assinatura-coluna"><div className="assinatura-conteudo"><strong><input aria-label="Nome do assinante" style={{ ...campoDocumento, fontWeight: 800 }} value={nomeAssinante} onChange={event => setNomeAssinante(event.target.value)} /></strong><input aria-label="Cargo do assinante" style={campoDocumento} value={cargoAssinante} onChange={event => setCargoAssinante(event.target.value)} /></div><div className="assinatura-legenda">ASSINATURA DO DIRETOR (Carimbo)</div></div>
                </div>

                <div className="quadro-oficial aviso-final">ESTE DOCUMENTO NÃO CONTÉM EMENDA NEM RASURA</div>
              </section>
            </div>

            {tabelasNotasAnexo.map((grupo, index) => (
              <div key={`anexo-${grupo.ciclo}-${index}`}>
                <div className="pagina-etiqueta nao-imprimir">Anexo de notas — página {index + 3}</div>
                <div className="historico-rolagem">
                  <section className="historico-pagina historico-anexo">
                    <div className="quadro-oficial cabecalho-oficial">
                      <img src="/brasao-santo-andre.png" alt="Prefeitura de Santo André" />
                      <div className="cabecalho-texto"><div>SECRETARIA DE EDUCAÇÃO</div><div>DEPARTAMENTO DE EDUCAÇÃO E ENSINO FUNDAMENTAL</div><h2>ANEXO — RESULTADOS DE OUTRA REDE</h2></div>
                    </div>
                    <div className="quadro-oficial" style={{ padding: '4mm 3mm' }}>
                      <div><strong>ALUNO:</strong> {aluno.nome}</div>
                      <div><strong>R.A.:</strong> {raExibicao}</div>
                    </div>
                    <div className="quadro-oficial" style={{ padding: '3mm' }}><TabelaNotas grupo={grupo} anexo /></div>
                  </section>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
