import { useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, MESES, SITUACAO_COR, SITUACAO_LABEL, getFeriado, isRecesso, isSabadoLetivo, sortTurmasPedagogico, isInfantilTurma, calendarioDetalhadoDisponivel, converterCodigoInep } from '../styles';
import { Loading, EmptyState, StatCard, Spinner } from '../components';
import { useTheme } from '../ThemeContext';
import { useAno } from '../AnoContext';
import { useAuth } from '../AuthContext';
import { MOTIVOS_BAIXA_FREQUENCIA, MOTIVO_BF_POR_CODIGO } from '../motivosBaixaFrequencia';

type Status = 'P' | 'F' | 'J' | 'A';
const CICLO: Status[] = ['P', 'F', 'J', 'A'];
const ST_LABEL: Record<Status, string> = { P: 'Presença', F: 'Falta', J: 'Justificado', A: 'Atestado médico' };

// Cores claras (light mode)
const ST_BG_LIGHT: Record<Status, string> = { P: '#dcfce7', F: '#fee2e2', J: '#ffedd5', A: '#ede9fe' };
const ST_COR_LIGHT: Record<Status, string> = { P: '#16a34a', F: '#dc2626', J: '#ea580c', A: '#7c3aed' };
// Cores escuras (dark mode) — fundo semi-transparente + texto mais brilhante
const ST_BG_DARK: Record<Status, string> = { P: 'rgba(74,222,128,0.13)', F: 'rgba(248,113,113,0.13)', J: 'rgba(251,146,60,0.13)', A: 'rgba(167,139,250,0.13)' };
const ST_COR_DARK: Record<Status, string> = { P: '#4ade80', F: '#f87171', J: '#fb923c', A: '#a78bfa' };

const initDias = (n: number): Status[] => Array(n).fill('P') as Status[];
const encodeDias = (d: Status[]) => 'DIAS:' + d.join('');
const decodeDias = (freq: string, n: number): Status[] => {
  if (freq?.startsWith('DIAS:')) {
    const chars = freq.slice(5).split('');
    return Array(n).fill('P').map((_, i) =>
      CICLO.includes(chars[i] as Status) ? (chars[i] as Status) : 'P'
    ) as Status[];
  }
  return initDias(n);
};
const ct = (dias: Status[], tipo: Status) => dias.filter(d => d === tipo).length;

// Maior sequência de faltas ('F') não justificadas seguidas — dias não letivos já ficam
// fora do array `dias`, então a contagem naturalmente pula recesso/férias/fins de semana.
const NCOM_LIMITE = 15;
const maxFaltasConsecutivas = (dias: Status[]) => {
  let max = 0, atual = 0;
  for (const d of dias) {
    atual = d === 'F' ? atual + 1 : 0;
    if (atual > max) max = atual;
  }
  return max;
};

interface CalendarDay {
  dia: number;
  isWeekend: boolean;
  isSabadoLetivo: boolean;
  feriado: string | null;
  recesso: string | null;
  isEmenda: boolean;
  isLetivo: boolean;
  schoolIdx: number;
}

function buildCalendarDays(ano: number, mes: number, emendas: string[]): CalendarDay[] {
  const totalDias = new Date(ano, mes, 0).getDate();
  const result: CalendarDay[] = [];
  let schoolIdx = 0;
  for (let d = 1; d <= totalDias; d++) {
    const dw = new Date(ano, mes - 1, d).getDay();
    const weekend = dw === 0 || dw === 6;
    const sabLetivo = isSabadoLetivo(ano, mes, d);
    const feriado = getFeriado(ano, mes, d);
    const recesso = isRecesso(ano, mes, d);
    const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const emenda = emendas.includes(dataStr);
    const letivo = !feriado && !recesso && !emenda && (!weekend || sabLetivo);
    result.push({
      dia: d, isWeekend: weekend, isSabadoLetivo: sabLetivo,
      feriado, recesso, isEmenda: emenda, isLetivo: letivo,
      schoolIdx: letivo ? schoolIdx++ : -1,
    });
  }
  return result;
}

export default function Faltas() {
  const { theme: themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const ST_BG = isDark ? ST_BG_DARK : ST_BG_LIGHT;
  const ST_COR = isDark ? ST_COR_DARK : ST_COR_LIGHT;
  const { ano } = useAno();
  const { role, turmaId: minhaTurmaId, permissoes, podeEditarTodasFaltas, username } = useAuth();
  // Turmas adicionais ficam registradas como "turma:<uuid>" nas permissões.
  // A memoização evita que a lista seja recriada em cada renderização e
  // que a turma escolhida manualmente seja trocada de volta para a primeira.
  const turmasMarcadas = useMemo(
    () => Array.isArray(permissoes)
      ? permissoes
          .filter((p: string) => p.startsWith('turma:'))
          .map(p => p.slice('turma:'.length))
      : [],
    [permissoes],
  );
  const minhasTurmasIds = useMemo(
    () => turmasMarcadas.length > 0
      ? turmasMarcadas
      : (minhaTurmaId ? [minhaTurmaId] : []),
    [turmasMarcadas, minhaTurmaId],
  );
  const podeEditar = role === 'admin' || minhasTurmasIds.length > 0 || podeEditarTodasFaltas;

  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [diasAluno, setDiasAluno] = useState<Record<string, Status[]>>({});
  // Rastreia, por aluno, se o registro veio de digitação dia a dia (Grade,
  // Pintura, Digitação Sequencial, SF) ou do Lançamento Rápido (totais) —
  // NUNCA pela aba atualmente selecionada na tela, porque reabrir um mês
  // já lançado dia a dia carrega com a aba "Rápido" em foco por padrão, e
  // salvar sem editar nada apagaria essa informação de todo mundo da turma
  // se a origem fosse decidida pelo `modo` no momento de salvar.
  const [origemAluno, setOrigemAluno] = useState<Record<string, 'DIA_A_DIA' | 'LANCAMENTO_RAPIDO'>>({});
  const [statusTextos, setStatusTextos] = useState<Record<string, string>>({});
  const [semFaltas, setSemFaltas] = useState<Record<string, boolean>>({});
  const [confirmacoesSemFaltas, setConfirmacoesSemFaltas] = useState<Record<string, { por: string | null; em: string | null }>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [motivosMesAnterior, setMotivosMesAnterior] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [controleErro, setControleErro] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBF, setShowBF] = useState(false);
  const [bfAlunos, setBfAlunos] = useState<any[]>([]);
  const [bfLoading, setBfLoading] = useState(false);
  const [bfFiltroSit, setBfFiltroSit] = useState('');
  const [showInep, setShowInep] = useState(false);
  const [inepCodigo, setInepCodigo] = useState('');
  const [arquivado, setArquivado] = useState(false);

  // ── Consulta de Motivos — busca por aluno (nome/RA) e histórico de motivos ──
  const [showMotivos, setShowMotivos] = useState(false);
  const [todosAlunosMotivo, setTodosAlunosMotivo] = useState<any[]>([]);
  const [buscaMotivoTexto, setBuscaMotivoTexto] = useState('');
  const [alunoMotivoSel, setAlunoMotivoSel] = useState<any | null>(null);
  const [motivoHistLoading, setMotivoHistLoading] = useState(false);
  const [motivoHistorico, setMotivoHistorico] = useState<any[]>([]);

  const [paintStatus, setPaintStatus] = useState<Status | null>(null);
  const [modo, setModo] = useState<'grade' | 'rapido'>('rapido');

  // ── Modo Digitação Sequencial — teclado assume a grade, sem clicar em cada dia ──
  const [cursor, setCursor] = useState<{ alunoId: string; day: number } | null>(null);
  const [linhaFocusada, setLinhaFocusada] = useState<string | null>(null);
  const [numBuffer, setNumBuffer] = useState('');
  const cursorRef = useRef<{ alunoId: string; day: number } | null>(null);
  const numBufferRef = useRef('');
  const modoRef = useRef(modo);
  const podeEditarRef = useRef(podeEditar);
  const numDiasRef = useRef(0);
  const alunosRef = useRef<any[]>([]);
  const statusTextosRef = useRef<Record<string, string>>({});
  const calDaysRef = useRef<CalendarDay[]>([]);
  const showBFRef = useRef(false);

  const isMobile = window.innerWidth < 640;

  const EMENDAS_KEY = `emendas-${ano}`;
  const [emendas, setEmendas] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(EMENDAS_KEY) || '[]'); }
    catch { return []; }
  });
  const toggleEmenda = (dataStr: string) => {
    if (role !== 'admin') return;
    setEmendas(prev => {
      const next = prev.includes(dataStr)
        ? prev.filter(d => d !== dataStr)
        : [...prev, dataStr];
      localStorage.setItem(EMENDAS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const calDays = useMemo(() => buildCalendarDays(ano, mes, emendas), [ano, mes, emendas]);
  const numDias = useMemo(() => calDays.filter(d => d.isLetivo).length, [calDays]);

  useEffect(() => {
    api.getTurmas().then(t => {
      const s = sortTurmasPedagogico(t || []);
      if (minhasTurmasIds.length > 0 && !podeEditarTodasFaltas) {
        const minhas = s.filter(x => minhasTurmasIds.includes(x.id));
        setTurmas(minhas);
        setTurmaId(minhas[0]?.id ?? '');
      } else {
        setTurmas(s);
        if (s.length) setTurmaId(s[0].id);
      }
    });
  }, [minhasTurmasIds, podeEditarTodasFaltas]);

  useEffect(() => {
    if (!turmaId) { setLoading(false); return; }
    setLoading(true);
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anoAnterior = mes === 1 ? ano - 1 : ano;
    Promise.all([
      api.getAlunos(turmaId),
      api.getFaltas(turmaId, mes, ano),
      api.getFaltas(turmaId, mesAnterior, anoAnterior),
    ]).then(([al, fa, faAnterior]) => {
      // Ordena pelo NR oficial do PDF (numero); empate: ATIVO antes de não-ATIVO
      const sorted = [...al].sort((a: any, b: any) => {
        const diff = (a.numero || 9999) - (b.numero || 9999);
        if (diff !== 0) return diff;
        const aAtivo = !a.situacao || a.situacao === 'ATIVO';
        const bAtivo = !b.situacao || b.situacao === 'ATIVO';
        if (aAtivo && !bAtivo) return -1;
        if (!aAtivo && bAtivo) return 1;
        return 0;
      });
      // Para duplicatas de NR (ex: TRAN e ATIVO com mesmo numero), o segundo fica sem NR
      const vistos = new Set<number>();
      setAlunos(sorted.map((a: any) => {
        if (a.numero && !vistos.has(a.numero)) { vistos.add(a.numero); return a; }
        return { ...a, _nrDisplay: 0 };
      }));
      const mapDias: Record<string, Status[]> = {};
      const mapTextos: Record<string, string> = {};
      const mapMotivos: Record<string, string> = {};
      const mapSemFaltas: Record<string, boolean> = {};
      const mapConfirmacoesSemFaltas: Record<string, { por: string | null; em: string | null }> = {};
      const mapOrigem: Record<string, 'DIA_A_DIA' | 'LANCAMENTO_RAPIDO'> = {};
      fa.forEach((f: any) => {
        if (f.frequencia?.startsWith('DIAS:')) {
          mapDias[f.alunoId] = decodeDias(f.frequencia, numDias);
        } else if (f.frequencia) {
          mapTextos[f.alunoId] = f.frequencia;
        }
        if (f.motivo_baixa_frequencia) mapMotivos[f.alunoId] = f.motivo_baixa_frequencia;
        if (f.conferido_sem_faltas === true) {
          mapSemFaltas[f.alunoId] = true;
          mapConfirmacoesSemFaltas[f.alunoId] = {
            por: f.confirmado_por ?? null,
            em: f.confirmado_em ?? null,
          };
        }
        if (f.origem_frequencia === 'DIA_A_DIA' || f.origem_frequencia === 'LANCAMENTO_RAPIDO') {
          mapOrigem[f.alunoId] = f.origem_frequencia;
        }
      });
      al.forEach((a: any) => {
        if (!mapDias[a.id] && !mapTextos[a.id]) mapDias[a.id] = initDias(numDias);
      });
      const mapMotivosAnterior: Record<string, string> = {};
      faAnterior.forEach((f: any) => {
        if (f.motivo_baixa_frequencia) mapMotivosAnterior[f.alunoId] = f.motivo_baixa_frequencia;
      });
      setDiasAluno(mapDias);
      setOrigemAluno(mapOrigem);
      setStatusTextos(mapTextos);
      setSemFaltas(mapSemFaltas);
      setConfirmacoesSemFaltas(mapConfirmacoesSemFaltas);
      setMotivos(mapMotivos);
      setMotivosMesAnterior(mapMotivosAnterior);
      setSaved(false);
      setLoading(false);
    });
  }, [turmaId, mes, ano, numDias]);

  const limparConfirmacaoSemFaltas = (alunoIds: string[]) => {
    setSemFaltas(prev => {
      const next = { ...prev };
      alunoIds.forEach(id => { delete next[id]; });
      return next;
    });
    setConfirmacoesSemFaltas(prev => {
      const next = { ...prev };
      alunoIds.forEach(id => { delete next[id]; });
      return next;
    });
  };

  const toggleDia = (alunoId: string, diaIdx: number) => {
    if (!podeEditar) return;
    limparConfirmacaoSemFaltas([alunoId]);
    setDiasAluno(prev => {
      const dias = [...(prev[alunoId] ?? initDias(numDias))];
      const idx = CICLO.indexOf(dias[diaIdx]);
      dias[diaIdx] = CICLO[(idx + 1) % CICLO.length];
      return { ...prev, [alunoId]: dias };
    });
    setOrigemAluno(prev => ({ ...prev, [alunoId]: 'DIA_A_DIA' }));
    setSaved(false);
  };

  // ── Modo Pintura — escolhe a situação na legenda e clica pra marcar direto ──
  const togglePaintStatus = (status: Status) => {
    setPaintStatus(prev => (prev === status ? null : status));
  };

  const pintarDia = (alunoId: string, schoolIdx: number, status: Status) => {
    limparConfirmacaoSemFaltas([alunoId]);
    setDiasAluno(prev => {
      const dias = [...(prev[alunoId] ?? initDias(numDias))];
      dias[schoolIdx] = status;
      return { ...prev, [alunoId]: dias };
    });
    setOrigemAluno(prev => ({ ...prev, [alunoId]: 'DIA_A_DIA' }));
    setSaved(false);
  };

  const pintarLinha = (alunoId: string, status: Status) => {
    limparConfirmacaoSemFaltas([alunoId]);
    const letivoIdxs = calDays.filter(cd => cd.isLetivo).map(cd => cd.schoolIdx);
    setDiasAluno(prev => {
      const dias = [...(prev[alunoId] ?? initDias(numDias))];
      letivoIdxs.forEach(idx => { dias[idx] = status; });
      return { ...prev, [alunoId]: dias };
    });
    setOrigemAluno(prev => ({ ...prev, [alunoId]: 'DIA_A_DIA' }));
    setSaved(false);
  };

  const pintarColuna = (schoolIdx: number, status: Status) => {
    const idsElegiveis = alunos.filter(a => !statusTextos[a.id]).map(a => a.id);
    limparConfirmacaoSemFaltas(idsElegiveis);
    setDiasAluno(prev => {
      const next = { ...prev };
      idsElegiveis.forEach(id => {
        const dias = [...(next[id] ?? initDias(numDias))];
        dias[schoolIdx] = status;
        next[id] = dias;
      });
      return next;
    });
    setOrigemAluno(prev => {
      const next = { ...prev };
      idsElegiveis.forEach(id => { next[id] = 'DIA_A_DIA'; });
      return next;
    });
    setSaved(false);
  };

  // ── Modo Digitação Sequencial — clique 1x no aluno/dia pra "entrar" na linha,
  // depois cada tecla é um dia (P/F/J/A) e o cursor avança sozinho.
  // Um número antes da letra preenche em lote (ex: "3" + "F" = 3 faltas seguidas).
  const alunosEditaveis = () => alunosRef.current.filter(a => !statusTextosRef.current[a.id]);

  const avancarCursor = (alunoId: string, day: number, passo: number): { alunoId: string; day: number } | null => {
    const lista = alunosEditaveis();
    const idx = lista.findIndex(a => a.id === alunoId);
    if (idx === -1) return null;
    const novoDay = day + passo;
    if (novoDay < numDiasRef.current) return { alunoId, day: novoDay };
    const proximo = lista[idx + 1];
    return proximo ? { alunoId: proximo.id, day: 0 } : null;
  };

  const aplicarSequencial = (status: Status) => {
    const cur = cursorRef.current;
    if (!cur) return;
    const qtd = Math.max(1, Math.min(parseInt(numBufferRef.current || '1', 10) || 1, numDiasRef.current));
    const fim = Math.min(cur.day + qtd, numDiasRef.current);
    limparConfirmacaoSemFaltas([cur.alunoId]);
    setDiasAluno(prev => {
      const dias = [...(prev[cur.alunoId] ?? initDias(numDiasRef.current))];
      for (let d = cur.day; d < fim; d++) dias[d] = status;
      return { ...prev, [cur.alunoId]: dias };
    });
    setOrigemAluno(prev => ({ ...prev, [cur.alunoId]: 'DIA_A_DIA' }));
    setSaved(false);
    setNumBuffer('');
    setCursor(avancarCursor(cur.alunoId, cur.day, fim - cur.day));
  };

  // ── Modo Rápido — digita só os totais (F/J/A) por aluno, sem clicar dia a dia ──
  const diasFromCounts = (f: number, j: number, a: number, n: number): Status[] => {
    const arr: Status[] = [];
    for (let i = 0; i < n; i++) {
      if (i < f) arr.push('F');
      else if (i < f + j) arr.push('J');
      else if (i < f + j + a) arr.push('A');
      else arr.push('P');
    }
    return arr;
  };

  const setContagem = (alunoId: string, tipo: 'F' | 'J' | 'A', valor: number) => {
    if (valor > 0) limparConfirmacaoSemFaltas([alunoId]);
    setDiasAluno(prev => {
      const dias = prev[alunoId] ?? initDias(numDias);
      const atual = { F: ct(dias, 'F'), J: ct(dias, 'J'), A: ct(dias, 'A') };
      const outrosDois = (['F', 'J', 'A'] as const).filter(t => t !== tipo).reduce((s, t) => s + atual[t], 0);
      atual[tipo] = Math.max(0, Math.min(valor || 0, numDias - outrosDois));
      return { ...prev, [alunoId]: diasFromCounts(atual.F, atual.J, atual.A, numDias) };
    });
    setOrigemAluno(prev => ({ ...prev, [alunoId]: 'LANCAMENTO_RAPIDO' }));
    setSaved(false);
  };

  const toggleSemFaltas = (alunoId: string) => {
    if (!podeEditar) return;
    if (semFaltas[alunoId]) {
      limparConfirmacaoSemFaltas([alunoId]);
      setSaved(false);
      return;
    }
    const dias = diasAluno[alunoId] ?? initDias(numDias);
    const ausencias = ct(dias, 'F') + ct(dias, 'J') + ct(dias, 'A');
    if (ausencias > 0) return;
    const agora = new Date().toISOString();
    setDiasAluno(prev => ({ ...prev, [alunoId]: initDias(numDias) }));
    setSemFaltas(prev => ({ ...prev, [alunoId]: true }));
    setConfirmacoesSemFaltas(prev => ({
      ...prev,
      [alunoId]: { por: username ?? 'desconhecido', em: agora },
    }));
    setOrigemAluno(prev => ({ ...prev, [alunoId]: 'DIA_A_DIA' }));
    setSaved(false);
  };

  const setMotivo = (alunoId: string, codigo: string) => {
    setMotivos(prev => {
      const next = { ...prev };
      if (codigo) next[alunoId] = codigo; else delete next[alunoId];
      return next;
    });
    setSaved(false);
  };

  const focusProximoCampo = (el: HTMLInputElement) => {
    const campos = Array.from(document.querySelectorAll<HTMLInputElement>('.quick-input'));
    const idx = campos.indexOf(el);
    const proximo = campos[idx + 1];
    if (proximo) { proximo.focus(); proximo.select(); }
  };

  const salvar = async () => {
    if (!podeEditar) return;
    setSaving(true);
    setControleErro('');
    const registros = alunos.map(a => {
      const motivo = motivos[a.id] || null;
      if (statusTextos[a.id]) {
        return { alunoId: a.id, turmaId, mes, ano, faltas: 0, frequencia: statusTextos[a.id], motivo_baixa_frequencia: motivo, origem_frequencia: null };
      }
      const dias = diasAluno[a.id] ?? initDias(numDias);
      const sfConfirmado = semFaltas[a.id] === true;
      const confirmacaoSF = confirmacoesSemFaltas[a.id];
      return {
        alunoId: a.id, turmaId, mes, ano,
        faltas: ct(dias, 'F') + ct(dias, 'J') + ct(dias, 'A'),
        frequencia: encodeDias(dias),
        motivo_baixa_frequencia: motivo,
        conferido_sem_faltas: sfConfirmado,
        confirmado_por: sfConfirmado ? (confirmacaoSF?.por ?? username ?? 'desconhecido') : null,
        confirmado_em: sfConfirmado ? (confirmacaoSF?.em ?? new Date().toISOString()) : null,
        // Origem rastreada por aluno, conforme a interação que realmente
        // editou aquele registro (ver origemAluno) — nunca pela aba `modo`
        // ativa na tela no momento de salvar, pois reabrir um mês já
        // lançado por qualquer via carrega com "Rápido" em foco por padrão.
        origem_frequencia: origemAluno[a.id] ?? null,
      };
    });
    await api.upsertFaltasBatch(registros);
    // Registra no controle de lançamentos (não bloqueia mesmo se a tabela ainda não existir)
    try {
      const totalFaltas = registros.reduce((s, r) => s + (r.faltas ?? 0), 0);
      const alunosComFalta = registros.filter(r => (r.faltas ?? 0) > 0).length;
      await api.upsertLancamento(turmaId, mes, ano, username ?? 'desconhecido', totalFaltas, alunosComFalta);
    } catch (error) {
      console.error('Faltas salvas, mas o Controle de Lançamentos não foi atualizado:', error);
      setControleErro('As faltas foram salvas, mas o Controle de Lançamentos não foi atualizado. Tente salvar novamente ou avise a administração.');
    }
    setSaving(false);
    setSaved(true);
  };

  // Mantém os refs do Modo Digitação Sequencial atualizados com o render atual
  cursorRef.current = cursor;
  numBufferRef.current = numBuffer;
  modoRef.current = modo;
  podeEditarRef.current = podeEditar;
  numDiasRef.current = numDias;
  alunosRef.current = alunos;
  statusTextosRef.current = statusTextos;
  calDaysRef.current = calDays;
  showBFRef.current = showBF;

  // Limpa seleção ao trocar turma ou mês
  useEffect(() => { setPaintStatus(null); setCursor(null); setNumBuffer(''); }, [turmaId, mes]);

  // Checklist de arquivo do Relatório Registro de Frequência — persistido localmente por turma/mês/ano
  useEffect(() => {
    if (!turmaId) return;
    setArquivado(localStorage.getItem(`arquivadoFreq_${ano}_${mes}_${turmaId}`) === '1');
  }, [turmaId, mes, ano]);

  const alternarArquivado = () => {
    setArquivado(v => {
      const novo = !v;
      localStorage.setItem(`arquivadoFreq_${ano}_${mes}_${turmaId}`, novo ? '1' : '0');
      return novo;
    });
  };

  // Sai do Modo Digitação Sequencial se trocar para o Modo Rápido
  useEffect(() => { if (modo !== 'grade') { setCursor(null); setNumBuffer(''); } }, [modo]);

  // Listener global de teclado do Modo Digitação Sequencial (ativo só quando há um cursor)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (modoRef.current !== 'grade' || !podeEditarRef.current || showBFRef.current || !cursorRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        setNumBuffer(prev => (prev + key).slice(-2));
        return;
      }
      if (key === 'Backspace') {
        e.preventDefault();
        if (numBufferRef.current) { setNumBuffer(prev => prev.slice(0, -1)); return; }
        const cur = cursorRef.current;
        if (cur && cur.day > 0) setCursor({ ...cur, day: cur.day - 1 });
        return;
      }
      if (key === ' ' || key === 'Enter') { e.preventDefault(); aplicarSequencial('P'); return; }

      const upper = key.toUpperCase();
      if (upper === 'P' || upper === 'F' || upper === 'J' || upper === 'A') {
        e.preventDefault();
        aplicarSequencial(upper as Status);
        return;
      }
      if (key === 'ArrowRight') {
        e.preventDefault(); setNumBuffer('');
        const cur = cursorRef.current;
        if (cur && cur.day < numDiasRef.current - 1) setCursor({ ...cur, day: cur.day + 1 });
        return;
      }
      if (key === 'ArrowLeft') {
        e.preventDefault(); setNumBuffer('');
        const cur = cursorRef.current;
        if (cur && cur.day > 0) setCursor({ ...cur, day: cur.day - 1 });
        return;
      }
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault(); setNumBuffer('');
        const cur = cursorRef.current;
        if (!cur) return;
        const lista = alunosEditaveis();
        const idx = lista.findIndex(a => a.id === cur.alunoId);
        const alvo = lista[idx + (key === 'ArrowDown' ? 1 : -1)];
        if (alvo) setCursor({ alunoId: alvo.id, day: cur.day });
        return;
      }
      if (key === 'Escape') { e.preventDefault(); setCursor(null); setNumBuffer(''); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const totalF = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'F'), 0);
  const totalJ = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'J'), 0);
  const totalA = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'A'), 0);
  const totalSF = alunos.filter(a => semFaltas[a.id] === true).length;
  const totalP = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'P'), 0);
  const totalAusencias = totalF + totalJ + totalA;
  const turma = turmas.find(t => t.id === turmaId);
  const isInfantil = isInfantilTurma(turma?.nome);
  const thresholdPct = isInfantil ? 0.4 : 0.25;
  const limiteAlerta = Math.ceil(numDias * thresholdPct);
  const freqGeral = alunos.length > 0
    ? ((numDias * alunos.length - totalAusencias) / (numDias * alunos.length) * 100).toFixed(1)
    : '0.0';
  // Freq. c/ atestado: conta só F+J como ausência (A = presença justificada)
  const freqGeralAt = alunos.length > 0
    ? ((numDias * alunos.length - (totalF + totalJ)) / (numDias * alunos.length) * 100).toFixed(1)
    : '0.0';
  const alertas = alunos.filter(a => {
    const dias = diasAluno[a.id] ?? [];
    return ct(dias, 'F') + ct(dias, 'J') + ct(dias, 'A') >= limiteAlerta;
  });

  const abrirBolsaFamilia = async () => {
    setShowBF(true);
    setBfLoading(true);
    const todos = await api.getAllAlunos();
    const bf = todos
      .filter((a: any) => a.bolsa_familia)
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
    setBfAlunos(bf);
    setBfLoading(false);
  };

  const abrirMotivos = async () => {
    setShowMotivos(true);
    setAlunoMotivoSel(null);
    setMotivoHistorico([]);
    setBuscaMotivoTexto('');
    if (todosAlunosMotivo.length === 0) {
      const todos = await api.getAllAlunos();
      setTodosAlunosMotivo(todos);
    }
  };

  const normalizarBusca = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const resultadosBuscaMotivo = useMemo(() => {
    const termo = normalizarBusca(buscaMotivoTexto.trim());
    if (!termo) return [];
    return todosAlunosMotivo
      .filter(a => normalizarBusca(a.nome ?? '').includes(termo) || String(a.ra ?? '').includes(termo))
      .slice(0, 20);
  }, [buscaMotivoTexto, todosAlunosMotivo]);

  const selecionarAlunoMotivo = async (a: any) => {
    setAlunoMotivoSel(a);
    setMotivoHistLoading(true);
    const faltas = await api.getFaltasAlunoTodos(a.id);
    // Marca sequências de meses seguidos com o MESMO código de motivo — sinal de
    // possível padrão (doença recorrente sem atestado, negligência etc.) a revisar.
    const comMotivo = faltas.filter((f: any) => f.motivo_baixa_frequencia);
    const ordenado = [...comMotivo].sort((x: any, y: any) => (x.ano - y.ano) || (x.mes - y.mes));
    const historico = ordenado.map((f: any, i: any) => {
      const anterior = ordenado[i - 1];
      const seguido = !!anterior
        && f.motivo_baixa_frequencia === anterior.motivo_baixa_frequencia
        && ((f.ano === anterior.ano && f.mes === anterior.mes + 1) || (f.ano === anterior.ano + 1 && anterior.mes === 12 && f.mes === 1));
      return { ...f, seguido };
    });
    // Propaga o alerta pro mês anterior também, pra marcar a sequência inteira
    for (let i = 0; i < historico.length - 1; i++) {
      if (historico[i + 1].seguido) historico[i].seguido = true;
    }
    setMotivoHistorico(historico);
    setMotivoHistLoading(false);
  };

  const exportarBFExcel = () => {
    const turmaNomeMap = new Map(turmas.map((t: any) => [t.id, t.nome]));
    const toRow = (a: any) => ({
      'Nome': a.nome,
      'RA': a.ra ?? '',
      'NIS': a.nis ?? '',
      'Turma': turmaNomeMap.get(a.turmaId) ?? '',
      'Situação': SITUACAO_LABEL[a.situacao ?? 'ATIVO'] ?? (a.situacao ?? 'ATIVO'),
      'Data Movimentação': a.data_movimentacao ?? '',
      'Deficiência': a.deficiencia ?? '',
    });
    const ativos = bfAlunos.filter(a => !a.situacao || a.situacao === 'ATIVO');
    const saidas = bfAlunos.filter(a => a.situacao && a.situacao !== 'ATIVO');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ativos.map(toRow)), 'Ativos');
    if (saidas.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(saidas.map(toRow)), 'Transferidos e Outros');
    XLSX.writeFile(wb, `BolsaFamilia_${ano}.xlsx`);
  };

  const exportarPDF = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];

    const linhas = alunos.map((a, i) => {
      const dias = diasAluno[a.id] ?? initDias(numDias);
      const nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
      const ausencias = nF + nJ + nA;
      const freqNum = numDias > 0 ? ((numDias - ausencias) / numDias * 100) : 100;
      const freq = freqNum.toFixed(0);
      const alerta = ausencias >= limiteAlerta;
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      const rowBg = alerta ? '#fff1f2' : i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const freqColor = alerta ? '#dc2626' : freqNum >= 90 ? '#16a34a' : '#d97706';
      return `<tr style="background:${rowBg};">
      <td style="border:1px solid #333;padding:5px 6px;text-align:center;font-size:12px;font-weight:700;width:28px;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
      <td style="border:1px solid #333;padding:5px 8px;font-size:12px;${alerta ? 'font-weight:700;' : ''}">${a.nome}${defi}${bf}${alerta ? ' <span style="color:#dc2626;font-size:10px;">⚠️</span>' : ''}</td>
      <td style="border:1px solid #333;padding:5px 4px;text-align:center;font-size:12px;color:#dc2626;font-weight:${nF > 0 ? '700' : '400'};">${nF}</td>
      <td style="border:1px solid #333;padding:5px 4px;text-align:center;font-size:12px;color:#d97706;font-weight:${nJ > 0 ? '700' : '400'};">${nJ}</td>
      <td style="border:1px solid #333;padding:5px 4px;text-align:center;font-size:12px;color:#7c3aed;font-weight:${nA > 0 ? '700' : '400'};">${nA}</td>
      <td style="border:1px solid #333;padding:5px 6px;text-align:center;font-size:12px;font-weight:700;color:${freqColor};">${freq}%</td>
    </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Frequência — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 8mm; font-size: 12px; color: #0f172a; background: #fff; }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    @page { size: A4 portrait; margin: 10mm 8mm; }
    body { margin: 0; }
    .no-print { display: none; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>

<div style="text-align:center; border-bottom:3px solid #1e40af; padding-bottom:8px; margin-bottom:10px;">
  <div style="font-size:11px; color:#64748b; font-weight:600; letter-spacing:1px;">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
  <div style="font-size:18px; font-weight:900; color:#1e40af; letter-spacing:1px; margin:2px 0;">EMEIEF LUIZ GONZAGA</div>
  <div style="font-size:11px; color:#475569;">Diário de Frequência — Ano Letivo ${ano}</div>
</div>

<table style="margin-bottom:10px; border:none;">
  <tr>
    <td style="border:none; padding:3px 6px; font-size:12px;">
      <span style="font-weight:700; color:#475569;">TURMA:</span>
      <span style="font-size:14px; font-weight:900; color:#1e40af; margin-left:6px;">${turmaObj?.nome ?? '—'}</span>
    </td>
    <td style="border:none; padding:3px 6px; font-size:12px;">
      <span style="font-weight:700; color:#475569;">PROFESSORA:</span>
      <span style="font-weight:600; margin-left:6px;">${turmaObj?.professora ?? '—'}</span>
    </td>
    <td style="border:none; padding:3px 6px; font-size:13px; text-align:right; white-space:nowrap;">
      <span style="font-weight:900; color:#dc2626; font-size:15px;">${nomeMes.toUpperCase()} / ${ano}</span>
    </td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b;">
      <span style="font-weight:600;">Total de alunos:</span> ${alunos.length}
    </td>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b;">
      <span style="font-weight:600;">Dias letivos do mês:</span> ${numDias}
    </td>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b; text-align:right;">
      <span style="font-weight:600;">Frequência geral:</span>
      <span style="font-weight:900; color:${parseFloat(freqGeral) >= 75 ? '#16a34a' : '#dc2626'}; font-size:13px; margin-left:4px;">${freqGeral}%</span>
    </td>
  </tr>
</table>

<table>
  <thead>
    <tr style="background:#1e40af; color:#ffffff;">
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:28px; font-size:11px; text-align:center;">Nº</th>
      <th style="border:1px solid #1e3a8a; padding:7px 8px; font-size:11px; text-align:left;">NOME DO ALUNO</th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#dc2626;">F<br><span style="font-size:8px;font-weight:400;">Faltas</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#d97706;">J<br><span style="font-size:8px;font-weight:400;">Justif.</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#7c3aed;">A<br><span style="font-size:8px;font-weight:400;">Atestado</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 6px; width:52px; font-size:11px; text-align:center;">FREQ.<br><span style="font-size:8px;font-weight:400;">%</span></th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
  <tfoot>
    <tr style="background:#f1f5f9; font-weight:700;">
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:11px;" colspan="2">TOTAIS DO MÊS</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:#dc2626;">${totalF}</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:#d97706;">${totalJ}</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:#7c3aed;">${totalA}</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:${parseFloat(freqGeral) >= 75 ? '#16a34a' : '#dc2626'};">${freqGeral}%</td>
    </tr>
  </tfoot>
</table>

<div style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
  ${alertas.length > 0 ? `<div style="padding:5px 10px; background:#fff1f2; border:1px solid #fca5a5; border-radius:4px; font-size:11px; color:#dc2626; font-weight:700;">⚠️ Alertas frequência &lt;75%: ${alertas.length} aluno(s)</div>` : `<div style="padding:5px 10px; background:#f0fdf4; border:1px solid #86efac; border-radius:4px; font-size:11px; color:#16a34a; font-weight:700;">✅ Nenhum aluno com frequência crítica</div>`}
  ${alunos.filter((a: any) => a.deficiencia).length > 0 ? `<div style="padding:5px 10px; background:#f0f9ff; border:1px solid #7dd3fc; border-radius:4px; font-size:11px; color:#0369a1;">♿ Alunos com deficiência: ${alunos.filter((a: any) => a.deficiencia).length}</div>` : ''}
  ${alunos.filter((a: any) => a.bolsa_familia).length > 0 ? `<div style="padding:5px 10px; background:#f0fdf4; border:1px solid #86efac; border-radius:4px; font-size:11px; color:#15803d;">💚 Bolsa Família: ${alunos.filter((a: any) => a.bolsa_familia).length} aluno(s)</div>` : ''}
</div>

<div style="margin-top:6px; font-size:10px; color:#64748b; padding:4px 0; border-top:1px solid #e2e8f0;">
  <span style="font-weight:700;">Legenda:</span>
  <span style="margin-left:8px; color:#dc2626; font-weight:700;">F = Falta</span>
  <span style="margin-left:10px; color:#d97706; font-weight:700;">J = Justificado</span>
  <span style="margin-left:10px; color:#7c3aed; font-weight:700;">A = Atestado médico</span>
  <span style="margin-left:10px;">⚠️ = Frequência abaixo de 75%</span>
  <span style="margin-left:10px;">♿ = Deficiência</span>
  <span style="margin-left:10px;">💚 = Bolsa Família</span>
</div>

<div style="margin-top:14mm; display:flex; gap:20mm; flex-wrap:wrap; font-size:11px;">
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:200px;">Assinatura do(a) Professor(a)</div>
  </div>
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:140px;">Data: _____ / _____ / _______</div>
  </div>
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:200px;">Assinatura da Coordenação</div>
  </div>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups no navegador para imprimir.'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ── Folha OCR — Grade de Dias com X (A4 paisagem, células VAZIAS) ─────
  const exportarGradeDias = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const diasCols = Array.from({ length: diasNoMes }, (_, i) => {
      const date = new Date(ano, mes - 1, i + 1);
      const dw = date.getDay();
      return { dia: i + 1, isWeekend: dw === 0 || dw === 6 };
    });

    const headerDias = diasCols.map(d =>
      `<th style="border:1px solid #333;padding:0;width:22px;min-width:22px;max-width:22px;height:28px;text-align:center;vertical-align:middle;font-size:8px;font-weight:700;background:${d.isWeekend ? '#555555' : '#1e40af'};color:#ffffff;">${d.dia}</th>`
    ).join('');

    const linhas = alunos.map((a, i) => {
      const rowBg = i % 2 === 0 ? '#ffffff' : '#eeeeee';
      const celulas = diasCols.map(d =>
        `<td style="border:1px solid #333;width:22px;min-width:22px;max-width:22px;height:22px;background:${d.isWeekend ? '#aaaaaa' : rowBg};"></td>`
      ).join('');
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      return `<tr>
        <td style="border:1px solid #333;padding:2px 4px;text-align:center;width:26px;font-size:11px;font-weight:700;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
        <td style="border:1px solid #333;padding:2px 6px;font-size:10px;white-space:nowrap;">${a.nome}${defi}${bf}</td>
        ${celulas}
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Grade de Dias — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 6mm; color: #000; background: #fff; }
  table { border-collapse: collapse; }
  @media print {
    @page { size: A4 landscape; margin: 7mm 6mm; }
    body { margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>

<div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:5px;margin-bottom:7px;">
  <div style="font-size:9px;color:#64748b;font-weight:600;letter-spacing:0.5px;">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
  <div style="font-size:15px;font-weight:900;color:#1e40af;margin:1px 0;">EMEIEF LUIZ GONZAGA</div>
  <div style="font-size:9px;color:#475569;font-weight:600;">Folha de Frequência Diária — ${nomeMes.toUpperCase()} / ${ano}</div>
</div>

<table style="width:100%;border:none;margin-bottom:6px;">
  <tr>
    <td style="border:none;font-size:10px;padding:1px 0;">
      <b style="color:#475569;">TURMA:</b>
      <span style="font-size:12px;font-weight:900;color:#1e40af;margin-left:5px;">${turmaObj?.nome ?? '—'}</span>
    </td>
    <td style="border:none;font-size:10px;padding:1px 0;text-align:center;">
      <b style="color:#475569;">PROFESSORA:</b>
      <span style="font-weight:700;margin-left:5px;">${turmaObj?.professora ?? '—'}</span>
    </td>
    <td style="border:none;font-size:10px;padding:1px 0;text-align:right;">
      <b style="color:#475569;">Alunos:</b> ${alunos.length}
      &nbsp;&nbsp;
      <b style="color:#475569;">Dias letivos:</b> ${numDias}
    </td>
  </tr>
</table>

<div style="font-size:9px;padding:3px 8px;background:#fef3c7;border:1px solid #fbbf24;border-radius:3px;margin-bottom:5px;color:#92400e;font-weight:700;">
  ✏️ Escreva <strong>X</strong> no dia em que o aluno <strong>FALTOU</strong>. Deixe em <strong>BRANCO</strong> se veio à aula. Fins de semana (cinza escuro) não preencher.
</div>

<table style="width:100%;">
  <thead>
    <tr>
      <th style="border:1px solid #333;padding:2px;width:26px;font-size:9px;text-align:center;background:#0f172a;color:#ffffff;">Nº</th>
      <th style="border:1px solid #333;padding:2px 6px;font-size:9px;text-align:left;background:#0f172a;color:#ffffff;min-width:130px;">NOME DO ALUNO</th>
      ${headerDias}
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
</table>

<div style="margin-top:5mm;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:4mm;">
  <div style="font-size:9px;color:#475569;">
    <b>Legenda:</b>
    <span style="margin-left:6px;background:#fee2e2;padding:1px 6px;border-radius:2px;font-weight:900;color:#dc2626;font-size:11px;">X</span> = Falta
    &nbsp;&nbsp;
    <span style="background:#f1f5f9;padding:1px 10px;border-radius:2px;border:1px solid #cbd5e1;font-size:10px;">  </span> = Presente (vazio)
    &nbsp;&nbsp;
    <span style="background:#334155;padding:1px 8px;border-radius:2px;font-size:10px;color:#94a3b8;">■</span> = Fim de semana (não preencher)
  </div>
  <div style="font-size:10px;display:flex;gap:12mm;">
    <span>Assinatura do(a) Professor(a): _________________________</span>
    <span>Data: ___/___/______</span>
  </div>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para abrir a folha.'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ── Folha de Frequência para OCR (lista simples A4 retrato) ─────────────────
  const exportarFolhaOCR = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];

    const linhas = alunos.map((a, i) => {
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      return `
      <tr>
        <td style="border:1px solid #555;padding:5px 6px;font-size:13px;text-align:center;width:30px;font-weight:700;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
        <td style="border:1px solid #555;padding:5px 8px;font-size:13px;">${a.nome}${defi}${bf}</td>
        <td style="border:2px solid #1e40af;padding:5px 4px;text-align:center;width:54px;font-size:22px;font-weight:900;"></td>
        <td style="border:2px solid #f59e0b;padding:5px 4px;text-align:center;width:54px;font-size:22px;font-weight:900;"></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Folha Frequência — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 6mm; font-size: 13px; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  @media print { @page { size: A4 portrait; margin: 7mm; } body { margin: 0; } }
</style>
</head>
<body>

<div style="text-align:center; margin-bottom:8px;">
  <div style="font-size:20px; font-weight:bold; letter-spacing:1px;">FOLHA DE FREQUÊNCIA</div>
  <div style="font-size:12px; font-weight:bold;">EMEIEF LUIZ GONZAGA</div>
</div>

<table style="border:none; margin-bottom:6px;">
  <tr>
    <td style="border:none; padding:2px 4px; font-size:12px;"><b>Prof(a):</b> ${turmaObj?.professora ?? '________________________________'}</td>
    <td style="border:none; padding:2px 4px; font-size:12px;"><b>Turma:</b> ${turmaObj?.nome ?? ''}</td>
    <td style="border:none; padding:2px 4px; font-size:14px; font-weight:bold; color:red; white-space:nowrap;">${nomeMes.toUpperCase()} / ${ano}</td>
  </tr>
</table>

<div style="font-size:11px; margin-bottom:5px; padding:4px 6px; background:#f1f5f9; border-radius:4px;">
  ✏️ <b>Instruções:</b> Escreva o número total de faltas do mês em cada coluna.
  &nbsp;&nbsp;
  <span style="color:#1e40af; font-weight:bold;">F = Faltas</span>
  &nbsp;&nbsp;
  <span style="color:#d97706; font-weight:bold;">J = Justificadas / Atestado</span>
  &nbsp;&nbsp;
  (0 = sem faltas)
</div>

<table>
  <thead>
    <tr style="background:#1e40af; color:white;">
      <th style="border:1px solid #1e40af; padding:7px 4px; width:30px; font-size:12px; text-align:center;">Nº</th>
      <th style="border:1px solid #1e40af; padding:7px 8px; font-size:12px; text-align:left;">NOME DO ALUNO</th>
      <th style="border:2px solid #93c5fd; padding:7px 4px; width:54px; font-size:13px; text-align:center; background:#1d4ed8;">F<br><span style="font-size:9px; font-weight:400;">Faltas</span></th>
      <th style="border:2px solid #fde68a; padding:7px 4px; width:54px; font-size:13px; text-align:center; background:#b45309;">J<br><span style="font-size:9px; font-weight:400;">Justif.</span></th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
</table>

<div style="margin-top:8mm; font-size:10px; color:#444;">
  <b>Total de dias letivos do mês:</b> ${numDias}
  &nbsp;&nbsp;&nbsp;
  <b>Alunos:</b> ${alunos.length}
</div>

<div style="margin-top:6mm; font-size:11px; display:flex; gap:20mm; flex-wrap:wrap;">
  <span>Assinatura do Professor(a): _________________________________</span>
  <span>Data: _____ / _____ / __________</span>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups no navegador para abrir a Folha.'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ── Diário Tradicional (grade com todos os dias do mês) ──────────────────────
  const exportarDiario = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const DIAS_FULL = [
      'Domingo','Segunda-Feira','Terça-Feira','Quarta-Feira',
      'Quinta-Feira','Sexta-Feira','Sábado',
    ];

    const diasCols = Array.from({ length: diasNoMes }, (_, d) => {
      const date = new Date(ano, mes - 1, d + 1);
      const dw = date.getDay(); // 0=Dom, 6=Sáb
      return { dia: d + 1, isWeekend: dw === 0 || dw === 6, nomeDia: DIAS_FULL[dw] };
    });

    const thDia = (bg: string) =>
      `border:1px solid #aaa;padding:0;font-size:7px;background:${bg};` +
      `writing-mode:vertical-rl;transform:rotate(180deg);height:54px;` +
      `text-align:center;vertical-align:bottom;min-width:19px;max-width:19px;`;

    const tdDia = (bg: string) =>
      `border:1px solid #aaa;padding:0;text-align:center;height:22px;` +
      `font-size:9px;background:${bg};min-width:19px;max-width:19px;`;

    const thExtra = (bg: string) =>
      `border:1px solid #aaa;padding:0;font-size:7.5px;font-weight:bold;` +
      `background:${bg};writing-mode:vertical-rl;transform:rotate(180deg);` +
      `height:54px;text-align:center;vertical-align:bottom;min-width:26px;max-width:26px;`;

    const tdExtra = (bg: string) =>
      `border:1px solid #aaa;padding:0;text-align:center;height:22px;` +
      `font-size:9px;background:${bg};min-width:26px;max-width:26px;`;

    const headerDias = diasCols.map(d =>
      `<th style="${thDia(d.isWeekend ? '#c8e6c9' : '#f5f5f5')}">${d.dia}/${mes < 10 ? '0' + mes : mes}<br>${d.nomeDia}</th>`
    ).join('');

    const alunosRows = alunos.map((a, i) => {
      const cells = diasCols.map(d =>
        `<td style="${tdDia(d.isWeekend ? '#c8e6c9' : '#fff')}"></td>`
      ).join('');
      const badges = (a.deficiencia ? ' ♿' : '') + (a.bolsa_familia ? ' 💚' : '');
      return `<tr>
        <td style="border:1px solid #aaa;padding:1px 3px;font-size:9px;text-align:center;width:26px;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
        <td style="border:1px solid #aaa;padding:1px 5px;font-size:9px;white-space:nowrap;min-width:145px;">${a.nome}${badges}</td>
        ${cells}
        <td style="${tdExtra('#ffcdd2')}"></td>
        <td style="${tdExtra('#c8e6c9')}"></td>
        <td style="${tdExtra('#fff9c4')}"></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Diário — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 4mm; font-size: 10px; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    @page { size: A4 landscape; margin: 5mm 4mm; }
    body { margin: 0; }
  }
</style>
</head>
<body>

<div style="text-align:center;margin-bottom:5px;">
  <div style="font-size:16px;font-weight:bold;letter-spacing:1px;">DIÁRIO</div>
  <div style="font-size:11px;font-weight:bold;">EMEIEF LUIZ GONZAGA</div>
</div>

<table style="margin-bottom:3px;border:none;">
  <tr>
    <td style="border:none;padding:1px 4px;font-size:9px;white-space:nowrap;"><b>Escola:</b> EMEIEF LUIZ GONZAGA</td>
    <td style="border:none;padding:1px 4px;font-size:9px;white-space:nowrap;"><b>Professor(a):</b> ${turmaObj?.professora ?? ''}</td>
    <td style="border:none;padding:1px 4px;font-size:9px;white-space:nowrap;"><b>Turma:</b> ${turmaObj?.nome ?? ''}</td>
    <td style="border:none;padding:1px 4px;font-size:12px;font-weight:bold;color:red;text-align:right;white-space:nowrap;">${nomeMes.toUpperCase()} — ${ano}</td>
  </tr>
</table>

<div style="font-size:9px;margin-bottom:3px;padding:2px 0;">
  <b>"C" = COMPARECIMENTOS &nbsp;&nbsp;&nbsp; "F" = FALTAS</b>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <span style="background:yellow;padding:1px 7px;font-weight:bold;border:1px solid #ccc;">J = FALTA JUSTIFICADA (ATESTADO)</span>
</div>

<table>
  <thead>
    <tr>
      <th style="border:1px solid #aaa;padding:2px;font-size:9px;text-align:center;width:26px;">Nº</th>
      <th style="border:1px solid #aaa;padding:2px;font-size:9px;text-align:left;min-width:145px;">NOME</th>
      ${headerDias}
      <th style="${thExtra('#ffcdd2')}">Total de faltas</th>
      <th style="${thExtra('#c8e6c9')}">Comparecimentos</th>
      <th style="${thExtra('#fff9c4')}">JUSTIFICADA (ATESTADO)</th>
    </tr>
  </thead>
  <tbody>
    ${alunosRows}
  </tbody>
</table>

<div style="margin-top:10mm;font-size:9px;display:flex;gap:25mm;flex-wrap:wrap;">
  <span>Assinatura do Professor(a): _________________________________</span>
  <span>Data: _____ / _____ / __________</span>
  <span>Assinatura da Coordenação: _________________________________</span>
</div>

<script>setTimeout(()=>window.print(),500);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups no navegador para abrir o Diário.'); return; }
    win.document.write(html);
    win.document.close();
  };

  const exportarExcel = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const dados = alunos.map((a, i) => {
      const dias = diasAluno[a.id] ?? initDias(numDias);
      const nP = ct(dias, 'P'), nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
      const row: any = {
        'Nº': a.numero || (i + 1),
        'Nome do Aluno': a.nome,
        'RA': a.ra ?? '',
        'Situação': a.situacao ?? 'ATIVO',
        'Deficiência': a.deficiencia ?? '',
        'Bolsa Família': a.bolsa_familia ? 'Sim' : 'Não',
      };
      dias.forEach((s, d) => { row[`Dia ${d + 1}`] = s; });
      row['P'] = nP; row['F'] = nF; row['J'] = nJ; row['A'] = nA;
      row['Dias Letivos'] = numDias;
      row['Frequência %'] = `${((numDias - nF - nJ - nA) / numDias * 100).toFixed(0)}%`;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, MESES[mes - 1].substring(0, 31));
    XLSX.writeFile(wb, `Faltas_${(turmaObj?.nome ?? 'turma').replace(/[^A-Za-z0-9]/g, '_')}_${MESES[mes - 1]}_${ano}.xlsx`);
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      {/* Cabeçalho */}
      <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        padding: 18, marginBottom: 16, boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.text }}>📋 Lançamento de Faltas</h1>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={abrirBolsaFamilia} style={btn('success', { small: true })} title="Ver todos os alunos com Bolsa Família de todas as turmas (qualquer situação)">💚 Bolsa Família</button>
            <button onClick={abrirMotivos} style={btn('warning', { small: true })} title="Buscar um aluno por nome ou RA e ver o histórico de motivos de baixa frequência mês a mês">🔍 Consultar Motivos</button>
            <button onClick={() => setShowInep(true)} style={btn('primary', { small: true, outline: true })} title="Converter código da escola do SED para o código INEP de 8 dígitos usado no Sistema Presença">🔢 Código INEP</button>
            {alunos.length > 0 && (
              <>
                <button onClick={exportarFolhaOCR} style={btn('primary', { small: true, outline: true })} title="Folha simples (A4 retrato) para professor preencher número de faltas — fácil de fotografar">📋 Folha</button>
                <button onClick={exportarGradeDias} style={btn('primary', { small: true, outline: true })} title="Grade com X por dia (A4 paisagem) para preencher à mão e depois digitar no Modo Teclado">📅 Grade de Dias</button>
                <button onClick={exportarDiario} style={btn('warning', { small: true, outline: true })} title="Diário tradicional com todos os dias do mês">🖨️ Diário</button>
                <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
                <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
              </>
            )}
          </div>
        </div>
        {turmaId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: theme.textSecondary, marginBottom: 12, cursor: 'pointer', width: 'fit-content' }}>
            <input type="checkbox" checked={arquivado} onChange={alternarArquivado} />
            📁 Relatório Registro de Frequência impresso, assinado e arquivado (Sistema Presença)
          </label>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)} disabled={minhasTurmasIds.length === 1 && !podeEditarTodasFaltas}>
              {turmas.map(t => {
                // Se existem duas turmas com o mesmo nome (ex: duas "EJA I"), mostra a professora
                const duplicado = turmas.filter(x => x.nome === t.nome).length > 1;
                return (
                  <option key={t.id} value={t.id}>
                    {t.nome}{duplicado && t.professora ? ` — ${t.professora}` : ''}
                  </option>
                );
              })}
            </select>
            {minhasTurmasIds.length > 0 && !podeEditarTodasFaltas && (
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                🔒 Acesso restrito {minhasTurmasIds.length === 1 ? 'à sua turma' : 'às suas turmas'}
              </div>
            )}
          </div>
          <div>
            <label style={label}>Mês</label>
            <select style={input} value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        {turma?.professora && (
          <div style={{ marginTop: 10, fontSize: 14, color: theme.textSecondary }}>
            👩‍🏫 Prof. {turma.professora}
          </div>
        )}

        {!calendarioDetalhadoDisponivel(ano) && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: theme.radius,
            background: isDark ? 'rgba(217,119,6,0.12)' : '#fffbeb',
            border: '1px solid #f59e0b', fontSize: 12, color: isDark ? '#fbbf24' : '#92400e',
          }}>
            ⚠️ O calendário de feriados móveis, sábados letivos e recesso de {ano} ainda não foi cadastrado no sistema —
            só feriados fixos (Ano Novo, Tiradentes etc.) são marcados automaticamente na grade. Confira manualmente os
            demais dias não letivos deste ano antes de lançar as faltas.
          </div>
        )}

        {/* Alternador de modo de lançamento */}
        {podeEditar && alunos.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 4, background: 'var(--ghost-bg)', borderRadius: 8, padding: 4, maxWidth: 420 }}>
            <button
              onClick={() => setModo('rapido')}
              style={{
                flex: 1, padding: '9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: modo === 'rapido' ? theme.card : 'transparent',
                color: modo === 'rapido' ? theme.primary : theme.textSecondary,
                boxShadow: modo === 'rapido' ? theme.shadow : 'none',
                transition: 'all 0.15s',
              }}
              title="Digite só os totais de faltas/justificadas/atestados de cada aluno — sem clicar dia a dia. Ideal para lançar meses atrasados rapidamente.">
              ⚡ Lançamento Rápido (totais)
            </button>
            <button
              onClick={() => setModo('grade')}
              style={{
                flex: 1, padding: '9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: modo === 'grade' ? theme.card : 'transparent',
                color: modo === 'grade' ? theme.primary : theme.textSecondary,
                boxShadow: modo === 'grade' ? theme.shadow : 'none',
                transition: 'all 0.15s',
              }}
              title="Grade dia a dia — marque a situação exata de cada dia do mês.">
              📅 Grade Dia a Dia
            </button>
          </div>
        )}

        {/* Legenda — clique numa situação para "pintar" alunos/dias direto */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {podeEditar && alunos.length > 0 && modo === 'grade' ? (Object.keys(ST_LABEL) as Status[]).map(s => {
            const ativo = paintStatus === s;
            return (
              <button key={s} onClick={() => togglePaintStatus(s)}
                style={{
                  background: ativo ? ST_COR[s] : ST_BG[s], color: ativo ? '#fff' : ST_COR[s], fontWeight: 700,
                  padding: '5px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
                  border: `1.5px solid ${ST_COR[s]}`,
                  boxShadow: ativo ? `0 0 0 2px ${ST_COR[s]}55` : undefined,
                }}
              >
                {s} = {ST_LABEL[s]}
              </button>
            );
          }) : (Object.keys(ST_LABEL) as Status[]).map(s => (
            <span key={s} style={{
              background: ST_BG[s], color: ST_COR[s], fontWeight: 700,
              padding: '3px 10px', borderRadius: 5, fontSize: 12,
              border: `1px solid ${ST_COR[s]}44`,
            }}>
              {s} = {ST_LABEL[s]}
            </span>
          ))}
          {podeEditar && alunos.length > 0 && modo === 'grade' && (
            paintStatus ? (
              <span style={{ fontSize: 12, color: ST_COR[paintStatus], fontWeight: 700 }}>
                🖌️ Marcando "{ST_LABEL[paintStatus]}" — clique nos dias que quiser marcar (um por um). O nome do aluno ou o número do dia marcam em massa (pedem confirmação). Clique de novo em "{paintStatus}" pra sair.
              </span>
            ) : (
              <span style={{ fontSize: 11, color: theme.textMuted }}>· Clique numa situação acima para marcar em lote, clique direto na célula para alternar, ou clique no nome do aluno para ativar o ⌨️ Modo Teclado (digite P/F/J/A dia a dia sem tirar a mão do teclado)</span>
            )
          )}
          {podeEditar && alunos.length > 0 && modo === 'rapido' && (
            <span style={{ fontSize: 11, color: theme.textMuted }}>· Digite o total de F/J/A de cada aluno no mês — a Presença é calculada automaticamente. Use Tab ou Enter para pular de campo em campo.</span>
          )}
        </div>
      </div>

      {/* ── Modal Bolsa Família ─────────────────────────────────────────── */}
      {showInep && (
        <div
          onClick={() => setShowInep(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.card, borderRadius: theme.radiusMd,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              border: `1px solid ${theme.borderLight}`,
              width: '100%', maxWidth: 420, padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.text, margin: 0 }}>🔢 Conversor de Código INEP</h2>
              <button onClick={() => setShowInep(false)} style={btn('danger', { small: true, outline: true })}>✕</button>
            </div>
            <p style={{ fontSize: 12.5, color: theme.textSecondary, marginBottom: 14 }}>
              O código do SED (4 a 7 dígitos) precisa virar o código INEP de 8 dígitos usado no Sistema Presença.
            </p>
            <label style={label}>Código no SED</label>
            <input
              style={input} value={inepCodigo} placeholder="Ex.: 4539"
              onChange={e => setInepCodigo(e.target.value.replace(/\D/g, '').slice(0, 7))}
            />
            {inepCodigo && (
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: theme.radius,
                background: `${theme.success}18`, border: `1px solid ${theme.success}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>CÓDIGO INEP (SISTEMA PRESENÇA)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: theme.success, letterSpacing: 1 }}>{converterCodigoInep(inepCodigo)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showBF && (
        <div
          onClick={() => setShowBF(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.card, borderRadius: theme.radiusMd,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              border: `1px solid ${theme.borderLight}`,
              width: '100%', maxWidth: 800,
              padding: 24,
            }}
          >
            {/* Cabeçalho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#15803d', margin: 0 }}>
                  💚 Alunos com Bolsa Família
                </h2>
                {!bfLoading && (
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                    {bfAlunos.length} total · {bfAlunos.filter(a => !a.situacao || a.situacao === 'ATIVO').length} ativos ·{' '}
                    <span style={{ color: '#0284c7', fontWeight: 700 }}>
                      {bfAlunos.filter(a => a.situacao === 'TRAN').length} transferidos
                    </span>
                    {' '}— todas as turmas
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!bfLoading && bfAlunos.length > 0 && (
                  <button onClick={exportarBFExcel} style={btn('success', { small: true, outline: true })} title="Excel com duas abas: Ativos e Transferidos/Outros">
                    📊 Excel (2 abas)
                  </button>
                )}
                <button onClick={() => setShowBF(false)} style={btn('danger', { small: true, outline: true })}>✕ Fechar</button>
              </div>
            </div>

            {/* Filtro por situação */}
            {!bfLoading && bfAlunos.length > 0 && (() => {
              const situacoes = Array.from(new Set(bfAlunos.map(a => a.situacao ?? 'ATIVO'))).sort();
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  <button
                    onClick={() => setBfFiltroSit('')}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${bfFiltroSit === '' ? '#15803d' : theme.borderLight}`,
                      background: bfFiltroSit === '' ? '#15803d' : 'transparent',
                      color: bfFiltroSit === '' ? '#fff' : theme.textSecondary,
                    }}
                  >
                    Todas ({bfAlunos.length})
                  </button>
                  {situacoes.map(sit => (
                    <button
                      key={sit}
                      onClick={() => setBfFiltroSit(sit === bfFiltroSit ? '' : sit)}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${bfFiltroSit === sit ? (SITUACAO_COR[sit] ?? theme.primary) : theme.borderLight}`,
                        background: bfFiltroSit === sit ? (SITUACAO_COR[sit] ?? theme.primary) : 'transparent',
                        color: bfFiltroSit === sit ? '#fff' : (SITUACAO_COR[sit] ?? theme.textSecondary),
                      }}
                    >
                      {SITUACAO_LABEL[sit] ?? sit} ({bfAlunos.filter(a => (a.situacao ?? 'ATIVO') === sit).length})
                    </button>
                  ))}
                </div>
              );
            })()}

            {bfLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>
                <Spinner size={32} /> <div style={{ marginTop: 12 }}>Carregando...</div>
              </div>
            ) : bfAlunos.length === 0 ? (
              <EmptyState icon="💚" message="Nenhum aluno com Bolsa Família cadastrado." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#15803d', color: '#fff' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Nome</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>RA</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700 }}>NIS</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700 }}>Turma</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700 }}>Situação</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Data Movim.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const turmaNomeMap = new Map(turmas.map((t: any) => [t.id, t.nome]));
                      const lista = bfFiltroSit
                        ? bfAlunos.filter(a => (a.situacao ?? 'ATIVO') === bfFiltroSit)
                        : bfAlunos;
                      return lista.map((a, i) => {
                        const sit = a.situacao ?? 'ATIVO';
                        const cor = SITUACAO_COR[sit] ?? theme.textSecondary;
                        const isTran = sit === 'TRAN';
                        const isSaida = sit === 'TRAN' || sit === 'ABAN' || sit === 'BXTR';
                        const rowBg = isSaida
                          ? (isDark ? 'rgba(2,132,199,0.12)' : '#e0f2fe')
                          : (i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)');
                        return (
                          <tr key={a.id} style={{ background: rowBg }}>
                            <td style={{ padding: '7px 10px', fontWeight: 600, color: theme.text }}>
                              {isTran && <span title="Transferido — lançar no Sistema Presença" style={{ marginRight: 5 }}>🔄</span>}
                              {a.nome}
                              {a.deficiencia && <span style={{ fontSize: 10, color: '#7c3aed', marginLeft: 6 }}>♿</span>}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', color: theme.textSecondary }}>{a.ra ?? '—'}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', color: theme.textSecondary, fontWeight: 600 }}>{a.nis ?? '—'}</td>
                            <td style={{ padding: '7px 8px', color: theme.textSecondary }}>{turmaNomeMap.get(a.turmaId) ?? '—'}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: cor }}>
                              {SITUACAO_LABEL[sit] ?? sit}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', color: isSaida ? cor : theme.textMuted, fontWeight: isSaida ? 700 : 400 }}>
                              {a.data_movimentacao ?? '—'}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
                {bfFiltroSit && (
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8, textAlign: 'right' }}>
                    Mostrando {bfAlunos.filter(a => (a.situacao ?? 'ATIVO') === bfFiltroSit).length} de {bfAlunos.length} alunos
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Consulta de Motivos ───────────────────────────────────── */}
      {showMotivos && (
        <div
          onClick={() => setShowMotivos(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.card, borderRadius: theme.radiusMd,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              border: `1px solid ${theme.borderLight}`,
              width: '100%', maxWidth: 720,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#d97706', margin: 0 }}>
                🔍 Consultar Motivos de Baixa Frequência
              </h2>
              <button onClick={() => setShowMotivos(false)} style={btn('danger', { small: true, outline: true })}>✕ Fechar</button>
            </div>

            <label style={label}>Buscar aluno por nome ou RA</label>
            <input
              style={input}
              value={buscaMotivoTexto}
              onChange={e => { setBuscaMotivoTexto(e.target.value); setAlunoMotivoSel(null); setMotivoHistorico([]); }}
              placeholder="Digite o nome ou o RA do aluno..."
              autoFocus
            />

            {!alunoMotivoSel && buscaMotivoTexto.trim() && (
              resultadosBuscaMotivo.length === 0 ? (
                <div style={{ marginTop: 12, fontSize: 13, color: theme.textMuted }}>Nenhum aluno encontrado.</div>
              ) : (
                <div style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto', border: `1px solid ${theme.borderLight}`, borderRadius: theme.radius }}>
                  {resultadosBuscaMotivo.map((a, i) => (
                    <div
                      key={a.id}
                      onClick={() => selecionarAlunoMotivo(a)}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                        background: i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)',
                        borderBottom: `1px solid ${theme.borderLight}`,
                        display: 'flex', justifyContent: 'space-between', gap: 10,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: theme.text }}>{a.nome}</span>
                      <span style={{ color: theme.textMuted }}>RA {a.ra ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )
            )}

            {alunoMotivoSel && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: theme.text }}>{alunoMotivoSel.nome}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>RA {alunoMotivoSel.ra ?? '—'}{alunoMotivoSel.deficiencia ? ` · ♿ ${alunoMotivoSel.deficiencia}` : ''}</div>
                  </div>
                  <button onClick={() => { setAlunoMotivoSel(null); setMotivoHistorico([]); }} style={btn('ghost', { small: true })}>← Nova busca</button>
                </div>

                {motivoHistLoading ? (
                  <div style={{ textAlign: 'center', padding: 30, color: theme.textMuted }}>
                    <Spinner size={28} /> <div style={{ marginTop: 10 }}>Carregando histórico...</div>
                  </div>
                ) : motivoHistorico.length === 0 ? (
                  <EmptyState icon="📭" message="Nenhum motivo de baixa frequência lançado para este aluno." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#d97706', color: '#fff' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Mês/Ano</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>F</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>J</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>A</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {motivoHistorico.map((f: any, i: number) => {
                          const dias = f.frequencia?.startsWith('DIAS:') ? decodeDias(f.frequencia, 31) : null;
                          const nF = dias ? ct(dias, 'F') : null;
                          const nJ = dias ? ct(dias, 'J') : null;
                          const nA = dias ? ct(dias, 'A') : null;
                          return (
                            <tr key={f.id} style={{ background: f.seguido ? (isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2') : i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 600, color: theme.text }}>
                                {f.seguido && <span title="Mesmo motivo repetido em meses seguidos — possível padrão a revisar" style={{ marginRight: 4 }}>⚠️</span>}
                                {MESES[f.mes - 1]}/{f.ano}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', color: ST_COR.F }}>{nF ?? '—'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', color: ST_COR.J }}>{nJ ?? '—'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', color: ST_COR.A }}>{nA ?? '—'}</td>
                              <td style={{ padding: '6px 8px', color: theme.textSecondary }}>
                                <strong>{f.motivo_baixa_frequencia}</strong> — {MOTIVO_BF_POR_CODIGO[f.motivo_baixa_frequencia] ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {motivoHistorico.some((f: any) => f.seguido) && (
                      <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: theme.radius, background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2', border: '1px solid #dc2626', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                        ⚠️ Este aluno teve o mesmo motivo lançado em meses seguidos — vale revisar se há um padrão (ex.: doença recorrente sem atestado, ou possível negligência).
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? <Loading /> : alunos.length === 0 && (
        <EmptyState icon="📋" message={turmas.length === 0 ? 'Cadastre turmas e alunos primeiro.' : 'Nenhum aluno nesta turma.'} />
      )}

      {alunos.length > 0 && !loading && (
        <div className="fade-in">
          {/* Estatísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, marginBottom: 14 }}>
            <StatCard label="Dias Letivos" val={numDias} color={theme.primary} />
            <StatCard label="Faltas (F)" val={totalF} color={ST_COR.F} />
            <StatCard label="Justif. (J)" val={totalJ} color={ST_COR.J} />
            <StatCard label="Atestados (A)" val={totalA} color={ST_COR.A} />
            {modo === 'rapido' && <StatCard label="Sem faltas (SF)" val={totalSF} color={theme.success} />}
            <StatCard label="Freq. Geral" val={`${freqGeral}%`} color={Number(freqGeral) >= 85 ? theme.success : theme.danger} />
            <StatCard label="⚠️ Alertas" val={alertas.length} color={alertas.length > 0 ? theme.danger : theme.textMuted} />
          </div>

          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10, textAlign: 'right' }}>
            ⚠️ Alerta: ≥ {limiteAlerta} ausências (&lt;{isInfantil ? 60 : 75}% frequência{isInfantil ? ' — Infantil' : ''})
          </div>

          {/* ── Painel do Modo Digitação Sequencial ─────────────────────────── */}
          {modo === 'grade' && cursor && (() => {
            const alunoCursor = alunos.find(a => a.id === cursor.alunoId);
            const diaCal = calDays.find(cd => cd.schoolIdx === cursor.day)?.dia;
            return (
              <div style={{
                background: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff',
                border: '2px solid #2563eb', borderRadius: theme.radiusMd,
                padding: '10px 16px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 22 }}>⌨️</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#2563eb' }}>
                    {alunoCursor?.nome ?? '—'} — Dia {diaCal ?? '?'} ({cursor.day + 1}/{numDias})
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                    Digite <strong>P/F/J/A</strong> pra marcar e avançar · <strong>Espaço/Enter</strong> = Presença ·
                    número antes da letra marca em lote (ex.: <strong>3</strong> depois <strong>F</strong> = 3 faltas seguidas) ·
                    ← → navega sem alterar · Esc sai
                  </div>
                </div>
                {numBuffer && (
                  <span style={{ background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 16, padding: '4px 12px', borderRadius: 6 }}>
                    {numBuffer}
                  </span>
                )}
                <button onClick={() => { setCursor(null); setNumBuffer(''); }} style={{ ...btn('ghost', { small: true }), marginLeft: 'auto' }}>
                  ✕ Sair (Esc)
                </button>
              </div>
            );
          })()}

          {/* Grid de frequência */}
          {modo === 'grade' && (
          <div style={{
            overflowX: 'auto',
            borderRadius: theme.radiusMd,
            boxShadow: theme.shadow,
            marginBottom: 14,
            border: `1px solid ${theme.borderLight}`,
          }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`, color: 'white' }}>
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: theme.primary,
                    padding: '10px 12px', textAlign: 'left',
                    fontSize: 12, fontWeight: 600, minWidth: isMobile ? 150 : 210,
                    borderRight: '2px solid rgba(255,255,255,0.25)',
                  }}>
                    # Aluno
                  </th>
                  {calDays.map(cd => {
                    const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(cd.dia).padStart(2, '0')}`;
                    const naoLetivo = !cd.isLetivo;
                    const bg = cd.isWeekend && !cd.isSabadoLetivo ? '#374151'
                             : cd.recesso ? '#1e3a5f'
                             : naoLetivo ? '#4b5563'
                             : undefined;
                    const podePintarColuna = !!paintStatus && podeEditar && cd.isLetivo;
                    const tooltip = podePintarColuna
                      ? `Marcar "${ST_LABEL[paintStatus!]}" para todos os alunos no dia ${cd.dia} (pede confirmação)`
                      : cd.feriado ?? (cd.isEmenda ? '⛔ Emenda marcada' : null) ??
                        cd.recesso ?? (cd.isSabadoLetivo ? '📚 Sábado Letivo' : null) ??
                        (cd.isWeekend ? 'Final de semana' : `Dia ${cd.dia}`);
                    return (
                      <th key={cd.dia} title={tooltip}
                        onClick={
                          podePintarColuna
                            ? () => {
                                if (window.confirm(`Marcar "${ST_LABEL[paintStatus!]}" para TODOS os alunos no dia ${cd.dia}?\n\nPara marcar só alguns alunos, clique direto nas células deles em vez do número do dia.`)) {
                                  pintarColuna(cd.schoolIdx, paintStatus!);
                                }
                              }
                            : role === 'admin' && !cd.isWeekend && !cd.feriado && !cd.recesso
                              ? () => toggleEmenda(dataStr) : undefined
                        }
                        style={{
                          width: isMobile ? 38 : 24, textAlign: 'center',
                          fontSize: isMobile ? 9 : 10, padding: '6px 1px',
                          fontWeight: 600, background: bg, lineHeight: 1.2,
                          opacity: naoLetivo ? 0.55 : 1,
                          cursor: podePintarColuna || (role === 'admin' && !cd.isWeekend && !cd.feriado && !cd.recesso)
                            ? 'pointer' : 'default',
                        }}
                      >
                        <div>{cd.dia}</div>
                        {cd.feriado && <div style={{ fontSize: 7 }}>🎉</div>}
                        {!cd.feriado && cd.recesso && <div style={{ fontSize: 7 }}>🏖️</div>}
                        {cd.isEmenda && <div style={{ fontSize: 7 }}>⛔</div>}
                        {cd.isSabadoLetivo && <div style={{ fontSize: 7 }}>📚</div>}
                      </th>
                    );
                  })}
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#bbf7d0', padding: '8px 2px', borderLeft: '2px solid rgba(255,255,255,0.25)' }}>P</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#fca5a5', padding: '8px 2px' }}>F</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#fdba74', padding: '8px 2px' }}>J</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#c4b5fd', padding: '8px 2px' }}>A</th>
                  <th style={{ width: 52, textAlign: 'center', fontSize: 11, padding: '8px 4px' }}>Freq.</th>
                  <th style={{ width: 58, textAlign: 'center', fontSize: 10, padding: '8px 4px', color: '#a5f3fc' }} title="Frequência considerando atestado como presença">Freq.<br/>c/At.</th>
                  <th style={{ width: 210, textAlign: 'center', fontSize: 10, padding: '8px 4px' }} title="Código oficial do motivo de baixa frequência (Bolsa Família/MEC)">Motivo da Baixa Frequência</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a, i) => {
                  const dias = diasAluno[a.id] ?? initDias(numDias);
                  const statusTxt = statusTextos[a.id];
                  const nP = ct(dias, 'P'), nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
                  const ausencias = nF + nJ + nA;
                  const emAlerta = !statusTxt && ausencias >= limiteAlerta;
                  const ncomAlerta = !statusTxt && maxFaltasConsecutivas(dias) >= NCOM_LIMITE;
                  const freq = ((numDias - ausencias) / numDias * 100).toFixed(0);
                  const freqAt = ((numDias - (nF + nJ)) / numDias * 100).toFixed(0);
                  const rowBg = emAlerta ? 'var(--row-alerta)' : i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)';
                  const linhaAtiva = cursor?.alunoId === a.id;
                  const rowBgFinal = linhaAtiva ? (isDark ? 'rgba(37,99,235,0.18)' : '#dbeafe') : rowBg;
                  const motivoRepetido = !!motivos[a.id] && motivos[a.id] === motivosMesAnterior[a.id];
                  return (
                    <tr key={a.id} style={{ background: rowBgFinal, outline: linhaAtiva ? `2px solid ${isDark ? '#3b82f6' : '#93c5fd'}` : 'none', outlineOffset: '-1px' }}>
                      <td
                        onClick={
                          paintStatus && podeEditar && !statusTxt
                            ? () => {
                                if (window.confirm(`Marcar "${ST_LABEL[paintStatus]}" para TODOS os ${numDias} dias letivos de ${a.nome}?\n\nPara marcar só alguns dias, clique direto nas células dos dias em vez do nome.`)) {
                                  pintarLinha(a.id, paintStatus);
                                }
                              }
                            : podeEditar && !statusTxt
                              ? () => { setCursor({ alunoId: a.id, day: 0 }); setNumBuffer(''); }
                              : undefined
                        }
                        title={
                          paintStatus && podeEditar && !statusTxt
                            ? `Marcar "${ST_LABEL[paintStatus]}" para todos os dias deste aluno (pede confirmação)`
                            : podeEditar && !statusTxt
                              ? 'Clique para começar o Modo Teclado no dia 1 deste aluno'
                              : undefined
                        }
                        style={{
                          position: 'sticky', left: 0, zIndex: 1,
                          background: rowBgFinal,
                          padding: '8px 12px',
                          borderRight: '2px solid var(--border-light)',
                          cursor: podeEditar && !statusTxt ? 'pointer' : 'default',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontSize: 11, color: theme.textMuted, paddingTop: 2, minWidth: 18 }}>{(a._nrDisplay === 0 ? '—' : a.numero) || '—'}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {emAlerta && <span title="Frequência abaixo de 75%">⚠️</span>}
                              {a.nome}
                            </div>
                            {ncomAlerta && (
                              <span
                                title={`${maxFaltasConsecutivas(dias)} faltas consecutivas sem justificativa — regra da SED para caracterizar Não Comparecimento (NCOM) a partir de 15. Registre 3 tentativas de contato com a família antes de dar baixa no SED.`}
                                style={{ fontSize: 10, color: '#b91c1c', fontWeight: 800, display: 'block' }}
                              >
                                🚨 Possível NCOM ({maxFaltasConsecutivas(dias)} faltas seguidas)
                              </span>
                            )}
                            {a.situacao && a.situacao !== 'ATIVO' && (
                              <span style={{ fontSize: 10, color: SITUACAO_COR[a.situacao] ?? theme.textSecondary, fontWeight: 700, display: 'block' }}>
                                {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                              </span>
                            )}
                            {a.deficiencia && (
                              <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, display: 'block' }}>
                                ♿ {a.deficiencia}
                              </span>
                            )}
                            {a.bolsa_familia && (
                              <span style={{ fontSize: 10, color: '#15803d', fontWeight: 600, display: 'block' }}>
                                💚 Bolsa Família
                              </span>
                            )}
                            {motivoRepetido && (
                              <span
                                title={`Mesmo motivo (${motivos[a.id]}) lançado no mês anterior — verifique se há um padrão`}
                                style={{ fontSize: 10, color: '#db2777', fontWeight: 700, display: 'block' }}
                              >
                                🔁 Motivo repetido
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {statusTxt ? (
                        <td colSpan={calDays.length + 6} style={{ textAlign: 'center', color: '#7c3aed', fontStyle: 'italic', fontSize: 12, padding: 8 }}>
                          {statusTxt}
                        </td>
                      ) : (
                        <>
                          {calDays.map(cd => {
                            if (!cd.isLetivo) {
                              const bg = cd.recesso ? '#1a2f4a' : cd.isWeekend ? '#1f2937' : '#283548';
                              return <td key={cd.dia} style={{
                                width: isMobile ? 38 : 24, background: bg,
                                borderLeft: '1px solid var(--border-light)',
                              }} />;
                            }
                            const status = dias[cd.schoolIdx] ?? 'P';
                            const isCursor = cursor?.alunoId === a.id && cursor?.day === cd.schoolIdx;
                            return (
                              <td key={cd.dia}
                                onClick={podeEditar ? () => {
                                  if (paintStatus) { pintarDia(a.id, cd.schoolIdx, paintStatus); }
                                  else { toggleDia(a.id, cd.schoolIdx); setCursor({ alunoId: a.id, day: cd.schoolIdx }); setNumBuffer(''); }
                                } : undefined}
                                title={paintStatus
                                  ? `Dia ${cd.dia}: ${ST_LABEL[status]} — clique para marcar "${ST_LABEL[paintStatus]}"`
                                  : `Dia ${cd.dia}: ${ST_LABEL[status]}${cd.isSabadoLetivo ? ' (Sábado Letivo)' : ''} — clique pra começar o Modo Teclado aqui`}
                                style={{
                                  width: isMobile ? 38 : 24, textAlign: 'center', cursor: podeEditar ? 'pointer' : 'default',
                                  background: ST_BG[status], color: ST_COR[status],
                                  fontWeight: 700, fontSize: isMobile ? 13 : 11,
                                  padding: isMobile ? '12px 0' : '7px 0',
                                  borderLeft: '1px solid var(--border-light)',
                                  userSelect: 'none', transition: 'opacity 0.1s', touchAction: 'manipulation',
                                  position: 'relative',
                                  boxShadow: isCursor ? 'inset 0 0 0 2px #2563eb' : undefined,
                                }}
                                onMouseEnter={!isMobile && podeEditar ? (e => (e.currentTarget.style.opacity = '0.75')) : undefined}
                                onMouseLeave={!isMobile && podeEditar ? (e => (e.currentTarget.style.opacity = '1')) : undefined}
                              >
                                {status}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', color: ST_COR.P, fontWeight: 700, fontSize: 13, padding: '0 2px', borderLeft: '2px solid var(--border-light)' }}>{nP}</td>
                          <td style={{ textAlign: 'center', color: nF > 0 ? ST_COR.F : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nF > 0 ? nF : '—'}</td>
                          <td style={{ textAlign: 'center', color: nJ > 0 ? ST_COR.J : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nJ > 0 ? nJ : '—'}</td>
                          <td style={{ textAlign: 'center', color: nA > 0 ? ST_COR.A : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nA > 0 ? nA : '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '0 4px', color: Number(freq) >= 85 ? ST_COR.P : Number(freq) >= 75 ? '#ea580c' : ST_COR.F }}>
                            {freq}%
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '0 4px', color: Number(freqAt) >= 85 ? ST_COR.P : Number(freqAt) >= 75 ? '#ea580c' : ST_COR.F }} title="Frequência considerando atestado como presença">
                            {freqAt}%
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            {ausencias > 0 && (
                              <select
                                value={motivos[a.id] ?? ''}
                                disabled={!podeEditar}
                                onChange={e => setMotivo(a.id, e.target.value)}
                                style={{ ...input, padding: '4px 6px', fontSize: 11, width: '100%' }}
                                title="Código oficial do motivo de baixa frequência (Bolsa Família/MEC)"
                              >
                                <option value="">— selecionar motivo —</option>
                                {MOTIVOS_BAIXA_FREQUENCIA.map(cat => (
                                  <optgroup key={cat.categoria} label={cat.categoria}>
                                    {cat.itens.map(m => (
                                      <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.descricao}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {/* Linha de totais */}
                <tr style={{ background: 'var(--footer-row)', borderTop: '2px solid var(--border-light)' }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    background: 'var(--footer-row)',
                    padding: '10px 12px', fontWeight: 700, fontSize: 13,
                    borderRight: '2px solid var(--border-light)',
                    color: theme.textSecondary,
                  }}>
                    Totais
                  </td>
                  <td colSpan={calDays.length} />
                  <td style={{ textAlign: 'center', color: ST_COR.P, fontWeight: 700, fontSize: 13, borderLeft: '2px solid var(--border-light)' }}>{totalP}</td>
                  <td style={{ textAlign: 'center', color: totalF > 0 ? ST_COR.F : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalF > 0 ? totalF : '—'}</td>
                  <td style={{ textAlign: 'center', color: totalJ > 0 ? ST_COR.J : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalJ > 0 ? totalJ : '—'}</td>
                  <td style={{ textAlign: 'center', color: totalA > 0 ? ST_COR.A : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalA > 0 ? totalA : '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '0 4px', color: Number(freqGeral) >= 85 ? ST_COR.P : theme.danger }}>{freqGeral}%</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '0 4px', color: Number(freqGeralAt) >= 85 ? ST_COR.P : theme.danger }} title="Freq. geral c/ atestado como presença">{freqGeralAt}%</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          )}

          {modo === 'grade' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, marginTop: 10, marginBottom: 12, alignItems: 'center' }}>
            <span style={{ color: ST_COR.P, fontWeight: 700 }}>🟢 P=Presença</span>
            <span style={{ color: ST_COR.F, fontWeight: 700 }}>🔴 F=Falta</span>
            <span style={{ color: ST_COR.J, fontWeight: 700 }}>🟠 J=Justificado</span>
            <span style={{ color: ST_COR.A, fontWeight: 700 }}>🟣 A=Atestado</span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              · 🎉 Feriado &nbsp; 🏖️ Recesso &nbsp; ⚠️ Frequência abaixo do mínimo &nbsp; <span style={{ color: '#b91c1c', fontWeight: 700 }}>🚨 Possível NCOM (15+ faltas seguidas)</span> &nbsp; <span style={{ color: '#db2777', fontWeight: 700 }}>🔁 Motivo repetido do mês anterior</span>
            </span>
            {role === 'admin' && (
              <span style={{ fontSize: 11, color: '#f97316' }}>
                · Admin: clique no Nº do dia para marcar/desmarcar emenda ⛔
              </span>
            )}
          </div>
          )}

          {/* Modo Rápido — só totais, sem grade dia a dia */}
          {modo === 'rapido' && (
          <div style={{
            overflowX: 'auto',
            borderRadius: theme.radiusMd,
            boxShadow: theme.shadow,
            marginBottom: 14,
            border: `1px solid ${theme.borderLight}`,
          }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`, color: 'white' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, minWidth: 210 }}># Aluno</th>
                  <th style={{ width: 70, textAlign: 'center', fontSize: 12, padding: '8px 4px', color: '#fca5a5' }}>F<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Faltas</span></th>
                  <th style={{ width: 70, textAlign: 'center', fontSize: 12, padding: '8px 4px', color: '#fdba74' }}>J<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Justif.</span></th>
                  <th style={{ width: 70, textAlign: 'center', fontSize: 12, padding: '8px 4px', color: '#c4b5fd' }}>A<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Atestado</span></th>
                  <th style={{ width: 76, textAlign: 'center', fontSize: 12, padding: '8px 4px', color: '#bbf7d0' }} title="SF = diário conferido e aluno sem nenhuma falta no mês">SF<br /><span style={{ fontSize: 9, fontWeight: 400 }}>Sem faltas</span></th>
                  <th style={{ width: 60, textAlign: 'center', fontSize: 11, padding: '8px 4px', color: '#bbf7d0' }}>P<br /><span style={{ fontSize: 9, fontWeight: 400 }}>calc.</span></th>
                  <th style={{ width: 60, textAlign: 'center', fontSize: 11, padding: '8px 4px' }}>Freq.</th>
                  <th style={{ width: 210, textAlign: 'center', fontSize: 10, padding: '8px 4px' }} title="Código oficial do motivo de baixa frequência (Bolsa Família/MEC)">Motivo da Baixa Frequência</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a, i) => {
                  const statusTxt = statusTextos[a.id];
                  const dias = diasAluno[a.id] ?? initDias(numDias);
                  const nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A'), nP = ct(dias, 'P');
                  const ausencias = nF + nJ + nA;
                  const sfConfirmado = semFaltas[a.id] === true;
                  const emAlerta = !statusTxt && ausencias >= limiteAlerta;
                  const ncomAlerta = !statusTxt && maxFaltasConsecutivas(dias) >= NCOM_LIMITE;
                  const freq = numDias > 0 ? ((numDias - ausencias) / numDias * 100).toFixed(0) : '100';
                  const rowBg = emAlerta ? 'var(--row-alerta)' : sfConfirmado ? (isDark ? 'rgba(22,163,74,0.12)' : '#f0fdf4') : i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)';
                  const linhaAtiva = linhaFocusada === a.id;
                  const motivoRepetido = !!motivos[a.id] && motivos[a.id] === motivosMesAnterior[a.id];
                  const campoNum = (tipo: 'F' | 'J' | 'A', valor: number, cor: string) => (
                    <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                      <input
                        className="quick-input"
                        type="number" min={0} max={numDias}
                        value={valor}
                        disabled={!podeEditar || sfConfirmado}
                        onFocus={e => { e.target.select(); setLinhaFocusada(a.id); }}
                        onBlur={() => setLinhaFocusada(null)}
                        onChange={e => setContagem(a.id, tipo, parseInt(e.target.value) || 0)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusProximoCampo(e.currentTarget); } }}
                        style={{
                          width: 52, padding: '6px 4px', textAlign: 'center', borderRadius: 6,
                          border: `1.5px solid ${valor > 0 ? cor : theme.border}`,
                          fontWeight: 700, fontSize: 14, color: valor > 0 ? cor : theme.text,
                          background: valor > 0 ? `${cor}18` : theme.card,
                        }}
                      />
                    </td>
                  );
                  return (
                    <tr key={a.id} style={{ background: linhaAtiva ? (isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff') : rowBg }}>
                      <td style={{ padding: '8px 12px', borderRight: `2px solid ${theme.borderLight}`, background: linhaAtiva ? (isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff') : undefined }}>
                        <span style={{ fontSize: 11, color: theme.textMuted, marginRight: 6 }}>{(a._nrDisplay === 0 ? '—' : a.numero) || '—'}</span>
                        <span style={{ fontSize: 13, fontWeight: linhaAtiva ? 800 : 600, color: linhaAtiva ? (isDark ? '#93c5fd' : '#1d4ed8') : theme.text }}>
                          {emAlerta && <span title="Frequência abaixo do limite">⚠️ </span>}
                          {ncomAlerta && (
                            <span
                              title={`${maxFaltasConsecutivas(dias)} faltas consecutivas sem justificativa — regra da SED para caracterizar Não Comparecimento (NCOM) a partir de 15. Registre 3 tentativas de contato com a família antes de dar baixa no SED.`}
                            >🚨 </span>
                          )}
                          {a.nome}
                        </span>
                        {sfConfirmado && (
                          <span
                            title={`Sem faltas confirmado${confirmacoesSemFaltas[a.id]?.por ? ` por ${confirmacoesSemFaltas[a.id].por}` : ''}${confirmacoesSemFaltas[a.id]?.em ? ` em ${new Date(confirmacoesSemFaltas[a.id].em!).toLocaleString('pt-BR')}` : ''}`}
                            style={{ marginLeft: 6, fontSize: 10, color: '#15803d', fontWeight: 800 }}
                          >
                            ✅ SF
                          </span>
                        )}
                        {a.situacao && a.situacao !== 'ATIVO' && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: SITUACAO_COR[a.situacao] ?? theme.textSecondary, fontWeight: 700 }}>
                            {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                          </span>
                        )}
                        {a.deficiencia && (
                          <span
                            title={`Deficiência: ${a.deficiencia} — tratamento de faltas pode seguir regra diferenciada`}
                            style={{ marginLeft: 6, fontSize: 10, color: '#7c3aed', fontWeight: 700 }}
                          >
                            ♿ {a.deficiencia}
                          </span>
                        )}
                        {a.bolsa_familia && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: '#15803d', fontWeight: 700 }}>
                            💚
                          </span>
                        )}
                        {motivoRepetido && (
                          <span
                            title={`Mesmo motivo (${motivos[a.id]}) lançado no mês anterior — verifique se há um padrão`}
                            style={{ marginLeft: 6, fontSize: 10, color: '#db2777', fontWeight: 700 }}
                          >
                            🔁 Motivo repetido
                          </span>
                        )}
                      </td>
                      {statusTxt ? (
                        <td colSpan={7} style={{ textAlign: 'center', color: '#7c3aed', fontStyle: 'italic', fontSize: 12, padding: 8 }}>{statusTxt}</td>
                      ) : (
                        <>
                          {campoNum('F', nF, ST_COR.F)}
                          {campoNum('J', nJ, ST_COR.J)}
                          {campoNum('A', nA, ST_COR.A)}
                          <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                            <input
                              type="checkbox"
                              checked={sfConfirmado}
                              disabled={!podeEditar || ausencias > 0}
                              onChange={() => toggleSemFaltas(a.id)}
                              aria-label={`Sem faltas no mês — ${a.nome}`}
                              title={ausencias > 0 ? 'Zere F, J e A antes de confirmar SF' : 'Confirmar que o aluno não teve faltas no mês'}
                              style={{ width: 20, height: 20, accentColor: '#16a34a', cursor: podeEditar && ausencias === 0 ? 'pointer' : 'not-allowed' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: ST_COR.P }}>{nP}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: Number(freq) >= 85 ? ST_COR.P : Number(freq) >= 75 ? '#ea580c' : ST_COR.F }}>{freq}%</td>
                          <td style={{ padding: '4px 6px' }}>
                            {ausencias > 0 && (
                              <select
                                value={motivos[a.id] ?? ''}
                                disabled={!podeEditar}
                                onChange={e => setMotivo(a.id, e.target.value)}
                                style={{ ...input, padding: '4px 6px', fontSize: 11, width: '100%' }}
                                title="Código oficial do motivo de baixa frequência (Bolsa Família/MEC)"
                              >
                                <option value="">— selecionar motivo —</option>
                                {MOTIVOS_BAIXA_FREQUENCIA.map(cat => (
                                  <optgroup key={cat.categoria} label={cat.categoria}>
                                    {cat.itens.map(m => (
                                      <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.descricao}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {modo === 'rapido' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, marginTop: 10, marginBottom: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              ⌨️ Dica: clique no campo F do primeiro aluno e use <strong>Tab</strong> ou <strong>Enter</strong> para pular F → J → A → próximo aluno, sem tirar a mão do teclado.
            </span>
            <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>
              · SF = diário conferido e aluno sem nenhuma falta no mês. Zero sem SF continua pendente.
            </span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              · ⚠️ Frequência abaixo do mínimo &nbsp; <span style={{ color: '#b91c1c', fontWeight: 700 }}>🚨 Possível NCOM (15+ faltas seguidas)</span> &nbsp; <span style={{ color: '#db2777', fontWeight: 700 }}>🔁 Motivo repetido do mês anterior</span>
            </span>
          </div>
          )}

          {podeEditar ? (
            <>
              <button
                style={{
                  ...btn('primary', { full: true }),
                  padding: '14px', fontSize: 17,
                  background: saved ? theme.success : theme.primary,
                  transition: 'all 0.2s ease',
                  borderRadius: isMobile ? 0 : theme.radiusMd,
                  position: isMobile ? 'sticky' : 'static',
                  bottom: isMobile ? 0 : 'auto',
                  zIndex: isMobile ? 10 : 'auto',
                  boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.2)' : 'none',
                }}
                onClick={salvar} disabled={saving}
              >
                {saving ? <><Spinner size={20} /> Salvando...</> : saved ? '✅ Salvo!' : '💾 Salvar Faltas'}
              </button>
              {controleErro && (
                <div role="alert" style={{ marginTop: 10, padding: '10px 12px', borderRadius: theme.radius, background: theme.warningLight, color: theme.warning, fontSize: 13, fontWeight: 600 }}>
                  ⚠️ {controleErro}
                </div>
              )}
            </>
          ) : (
            <div style={{
              padding: '14px', fontSize: 14, fontWeight: 600, textAlign: 'center',
              background: 'var(--ghost-bg)', borderRadius: theme.radiusMd,
              color: theme.textMuted, border: `1px solid ${theme.borderLight}`,
            }}>
              🔒 Somente visualização — apenas o administrador pode salvar faltas
            </div>
          )}
        </div>
      )}
    </div>
  );
}
