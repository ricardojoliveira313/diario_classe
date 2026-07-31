import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { theme, btn, input, label, MESES, sortTurmasPedagogico } from '../styles';
import { Loading, EmptyState } from '../components';
import { useTheme } from '../ThemeContext';
import { useAno } from '../AnoContext';

type Filtro = 'todas' | 'lancadas' | 'com_faltas' | 'sem_faltas' | 'nao_lancadas';

function fmtData(iso: string) {
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
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getTurmas(), api.getLancamentos(mes, ano)])
      .then(([t, l]) => {
        setTurmas(sortTurmasPedagogico(t ?? []));
        setLancamentos(l ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mes, ano]);

  const lancMap = useMemo(() => {
    const m = new Map<string, any>();
    lancamentos.forEach(l => m.set(l.turma_id, l));
    return m;
  }, [lancamentos]);

  const rows = useMemo(() =>
    turmas.map(t => ({ turma: t, lancamento: lancMap.get(t.id) ?? null })),
    [turmas, lancMap]
  );

  const totalTurmas = rows.length;
  const totalLancadas = rows.filter(r => r.lancamento).length;
  const totalComFaltas = rows.filter(r => r.lancamento && r.lancamento.total_faltas > 0).length;
  const totalSemFaltas = totalLancadas - totalComFaltas;
  const totalNaoLancadas = totalTurmas - totalLancadas;
  const pct = totalTurmas > 0 ? Math.round(totalLancadas / totalTurmas * 100) : 0;

  const filtradas = useMemo(() => {
    switch (filtro) {
      case 'lancadas':     return rows.filter(r => r.lancamento);
      case 'com_faltas':   return rows.filter(r => r.lancamento && r.lancamento.total_faltas > 0);
      case 'sem_faltas':   return rows.filter(r => r.lancamento && r.lancamento.total_faltas === 0);
      case 'nao_lancadas': return rows.filter(r => !r.lancamento);
      default:             return rows;
    }
  }, [rows, filtro]);

  if (loading) return <Loading />;

  const statusBadge = (lancamento: any | null) => {
    if (!lancamento) return (
      <span style={{ background: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
        ❌ Não lançado
      </span>
    );
    if (lancamento.total_faltas > 0) return (
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
    { key: 'lancadas',     label: `✅ Lançadas (${totalLancadas})` },
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
          { val: totalLancadas,    lbl: 'Lançadas',         cor: '#16a34a' },
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
            {pct}% — {totalLancadas}/{totalTurmas} turmas {totalNaoLancadas === 0 && totalTurmas > 0 ? '✅ Completo!' : ''}
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
                {['Turma', 'Professora', 'Status', 'Faltas', 'Alunos c/ falta', 'Lançado por', 'Quando'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Status' ? 'center' : 'left', fontWeight: 700, color: theme.textSecondary, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ turma, lancamento }, i) => (
                <tr key={turma.id} style={{ borderBottom: `1px solid ${theme.borderLight}`, background: i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: theme.text, whiteSpace: 'nowrap' }}>{turma.nome}</td>
                  <td style={{ padding: '10px 12px', color: theme.textSecondary }}>{turma.professora ?? '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{statusBadge(lancamento)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: lancamento?.total_faltas > 0 ? 700 : 400, color: lancamento?.total_faltas > 0 ? '#dc2626' : theme.textMuted }}>
                    {lancamento != null ? lancamento.total_faltas : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: theme.textSecondary }}>
                    {lancamento != null ? lancamento.alunos_com_falta : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: theme.textSecondary, fontSize: 12 }}>
                    {lancamento ? lancamento.lancado_por : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: theme.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>
                    {lancamento ? fmtData(lancamento.lancado_em) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
