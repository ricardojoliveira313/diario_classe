import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { theme, btn, input, label, MESES, sortTurmasPedagogico } from '../styles';
import { Loading, EmptyState } from '../components';
import { useTheme } from '../ThemeContext';
import { useAno } from '../AnoContext';

type Filtro = 'todas' | 'lancadas' | 'parciais' | 'com_faltas' | 'sem_faltas' | 'nao_lancadas';

// Uma linha de Falta só conta como "conferida" se ela representa uma decisão
// de fato: faltas digitadas, o botão SF (sem faltas) confirmado, ou um status
// especial (transferido etc). Uma linha default (0 faltas, sem SF, grade em
// branco) é só o que sobra de salvar a turma inteira de uma vez — não prova
// que alguém olhou aquele aluno. Ver aviso na tela de Faltas: "Zero sem SF
// continua pendente".
function faltaConferida(f: any): boolean {
  if ((f.faltas ?? 0) > 0) return true;
  if (f.conferido_sem_faltas === true) return true;
  if (f.frequencia && !String(f.frequencia).startsWith('DIAS:')) return true;
  return false;
}

function alunoAtivo(a: any): boolean {
  return !a.situacao || a.situacao === 'ATIVO';
}

function fmtData(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function Controle() {
  const { theme: themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const { ano } = useAno();
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [faltasMes, setFaltasMes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getTurmas(),
      api.getAllAlunos(),
      api.getLancamentos(mes, ano).catch(error => {
        // Falha no registro auxiliar não pode esconder faltas já salvas.
        console.error('Falha ao carregar LancamentoFaltas; usando dados de Falta:', error);
        return [];
      }),
      api.getFaltasMes(mes, ano),
    ])
      .then(([t, al, l, f]) => {
        setTurmas(sortTurmasPedagogico(t ?? []));
        setAlunos(al ?? []);
        setLancamentos(l ?? []);
        setFaltasMes(f ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mes, ano]);

  const lancMap = useMemo(() => {
    const m = new Map<string, any>();
    lancamentos.forEach(l => m.set(l.turma_id, l));

    // Compatibilidade com lançamentos anteriores à criação de LancamentoFaltas:
    // a existência de linhas em Falta comprova que a turma/mês foi salva.
    const agregados = new Map<string, { total: number; alunos: number }>();
    faltasMes.forEach(f => {
      const atual = agregados.get(f.turmaId) ?? { total: 0, alunos: 0 };
      const faltas = Number(f.faltas ?? 0);
      atual.total += faltas;
      if (faltas > 0) atual.alunos += 1;
      agregados.set(f.turmaId, atual);
    });
    agregados.forEach((a, turmaId) => {
      if (!m.has(turmaId)) {
        m.set(turmaId, {
          turma_id: turmaId,
          mes,
          ano,
          total_faltas: a.total,
          alunos_com_falta: a.alunos,
          lancado_por: 'Dados existentes',
          lancado_em: null,
        });
      }
    });
    return m;
  }, [lancamentos, faltasMes, mes, ano]);

  // Quantos alunos ATIVOS cada turma tem — é o denominador que decide se o
  // lançamento está completo, não a simples existência de alguma linha salva.
  const ativosPorTurma = useMemo(() => {
    const m = new Map<string, Set<string>>();
    alunos.filter(alunoAtivo).forEach(a => {
      if (!m.has(a.turmaId)) m.set(a.turmaId, new Set());
      m.get(a.turmaId)!.add(a.id);
    });
    return m;
  }, [alunos]);

  // Quais desses alunos já têm uma linha de Falta realmente conferida no mês.
  const conferidosPorTurma = useMemo(() => {
    const m = new Map<string, Set<string>>();
    faltasMes.filter(faltaConferida).forEach(f => {
      if (!m.has(f.turmaId)) m.set(f.turmaId, new Set());
      m.get(f.turmaId)!.add(f.alunoId);
    });
    return m;
  }, [faltasMes]);

  const rows = useMemo(() =>
    turmas.map(t => {
      const ativos = ativosPorTurma.get(t.id) ?? new Set<string>();
      const conferidosTodos = conferidosPorTurma.get(t.id) ?? new Set<string>();
      const conferidos = new Set([...conferidosTodos].filter(id => ativos.has(id)));
      const status: 'nao_lancada' | 'parcial' | 'completa' =
        conferidos.size === 0 ? 'nao_lancada'
        : (ativos.size > 0 && conferidos.size < ativos.size) ? 'parcial'
        : 'completa';
      return {
        turma: t,
        lancamento: lancMap.get(t.id) ?? null,
        totalAtivos: ativos.size,
        totalConferidos: conferidos.size,
        status,
      };
    }),
    [turmas, lancMap, ativosPorTurma, conferidosPorTurma]
  );

  const totalTurmas = rows.length;
  const totalCompletas = rows.filter(r => r.status === 'completa').length;
  const totalParciais = rows.filter(r => r.status === 'parcial').length;
  const totalComFaltas = rows.filter(r => r.status === 'completa' && r.lancamento && r.lancamento.total_faltas > 0).length;
  const totalSemFaltas = totalCompletas - totalComFaltas;
  const totalNaoLancadas = rows.filter(r => r.status === 'nao_lancada').length;
  const pct = totalTurmas > 0 ? Math.round(totalCompletas / totalTurmas * 100) : 0;

  const filtradas = useMemo(() => {
    switch (filtro) {
      case 'lancadas':     return rows.filter(r => r.status === 'completa');
      case 'parciais':     return rows.filter(r => r.status === 'parcial');
      case 'com_faltas':   return rows.filter(r => r.status === 'completa' && r.lancamento && r.lancamento.total_faltas > 0);
      case 'sem_faltas':   return rows.filter(r => r.status === 'completa' && r.lancamento && r.lancamento.total_faltas === 0);
      case 'nao_lancadas': return rows.filter(r => r.status === 'nao_lancada');
      default:             return rows;
    }
  }, [rows, filtro]);

  if (loading) return <Loading />;

  const statusBadge = (status: 'nao_lancada' | 'parcial' | 'completa', totalConferidos: number, totalAtivos: number, lancamento: any | null) => {
    if (status === 'nao_lancada') return (
      <span style={{ background: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
        ❌ Não lançado
      </span>
    );
    if (status === 'parcial') return (
      <span style={{ background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }} title="Nem todos os alunos da turma foram conferidos ainda">
        🟡 Parcial ({totalConferidos}/{totalAtivos})
      </span>
    );
    if (lancamento && lancamento.total_faltas > 0) return (
      <span style={{ background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
        ⚠️ Com faltas
      </span>
    );
    return (
      <span style={{ background: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7', color: '#16a34a', border: '1px solid #86efac', borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
        ✅ Sem faltas
      </span>
    );
  };

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: 'todas',        label: `Todas (${totalTurmas})` },
    { key: 'lancadas',     label: `✅ Lançadas (${totalCompletas})` },
    { key: 'parciais',     label: `🟡 Parciais (${totalParciais})` },
    { key: 'com_faltas',   label: `⚠️ Com faltas (${totalComFaltas})` },
    { key: 'sem_faltas',   label: `✓ Sem faltas (${totalSemFaltas})` },
    { key: 'nao_lancadas', label: `❌ Não lançadas (${totalNaoLancadas})` },
  ];

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>

      {/* Cabeçalho */}
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 18, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.text, marginBottom: 14 }}>📊 Controle de Lançamentos</h1>
        <div>
          <label style={label}>Mês</label>
          <select style={{ ...input, maxWidth: 160 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { val: totalTurmas,      lbl: 'Total de turmas',  cor: theme.primary },
          { val: totalCompletas,   lbl: 'Lançadas',         cor: '#16a34a' },
          { val: totalParciais,    lbl: 'Parciais',         cor: '#d97706' },
          { val: totalComFaltas,   lbl: 'Com faltas',       cor: '#d97706' },
          { val: totalSemFaltas,   lbl: 'Sem faltas',       cor: '#0369a1' },
          { val: totalNaoLancadas, lbl: 'Não lançadas',     cor: '#dc2626' },
        ].map(({ val, lbl, cor }) => (
          <div key={lbl} style={{ background: theme.card, borderRadius: theme.radiusMd, padding: '14px 16px', boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: cor }}>{val}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Barra de progresso */}
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: '12px 18px', marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: theme.text }}>Progresso de {MESES[mes - 1]} {ano}</span>
          <span style={{ color: totalNaoLancadas === 0 && totalTurmas > 0 ? '#16a34a' : theme.textSecondary, fontWeight: 700 }}>
            {pct}% — {totalCompletas}/{totalTurmas} turmas {totalNaoLancadas === 0 && totalTurmas > 0 ? '✅ Completo!' : ''}
          </span>
        </div>
        <div style={{ background: theme.borderLight, borderRadius: 8, height: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 8, width: `${pct}%`, background: totalNaoLancadas === 0 && totalTurmas > 0 ? '#16a34a' : '#2563eb', transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${filtro === f.key ? theme.primary : theme.borderLight}`,
            background: filtro === f.key ? theme.primary : 'transparent',
            color: filtro === f.key ? '#fff' : theme.textSecondary,
            transition: 'all 0.15s',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Tabela */}
      {filtradas.length === 0 ? (
        <EmptyState icon="📊" message="Nenhuma turma encontrada para este filtro." />
      ) : (
        <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderBottom: `1px solid ${theme.borderLight}` }}>
                {['Turma', 'Professora', 'Status', 'Alunos c/ falta', 'Lançado por', 'Quando'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Status' ? 'center' : 'left', fontWeight: 700, color: theme.textSecondary, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ turma, lancamento, status, totalConferidos, totalAtivos }) => {
                const naoLancado = status === 'nao_lancada';
                const rowBg = naoLancado
                  ? (isDark ? 'rgba(239,68,68,0.08)' : '#fff5f5')
                  : status === 'parcial'
                  ? (isDark ? 'rgba(217,119,6,0.08)' : '#fffbeb')
                  : 'transparent';
                return (
                  <tr key={turma.id} style={{ borderBottom: `1px solid ${theme.borderLight}`, background: rowBg }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: naoLancado ? '#dc2626' : theme.text, whiteSpace: 'nowrap' }}>{turma.nome}</td>
                    <td style={{ padding: '10px 12px', fontWeight: naoLancado ? 700 : 400, color: naoLancado ? '#dc2626' : theme.textSecondary }}>{turma.professora ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{statusBadge(status, totalConferidos, totalAtivos, lancamento)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: lancamento?.alunos_com_falta > 0 ? '#d97706' : theme.textSecondary, fontWeight: lancamento?.alunos_com_falta > 0 ? 700 : 400 }}>
                      {lancamento != null ? lancamento.alunos_com_falta : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: theme.textSecondary, fontSize: 12 }}>
                      {lancamento ? lancamento.lancado_por : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: theme.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>
                      {lancamento ? fmtData(lancamento.lancado_em) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
