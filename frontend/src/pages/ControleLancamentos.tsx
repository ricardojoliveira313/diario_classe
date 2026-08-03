import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useAno } from '../AnoContext';
import { theme, btn, input, label, MESES, sortTurmasPedagogico } from '../styles';
import { Loading } from '../components';

type Filtro = 'todos' | 'lancados' | 'com_faltas' | 'sem_faltas' | 'nao_lancados';

export default function ControleLancamentos() {
  const { role, podeControlarLancamentos } = useAuth();
  const { ano } = useAno();
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [turmas, setTurmas] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true); setErro('');
    try {
      const [ts, ls] = await Promise.all([api.getTurmas(), api.getLancamentosFaltas(ano, mes)]);
      setTurmas(sortTurmasPedagogico(ts || []));
      setLancamentos(ls || []);
    } catch (e) {
      console.error(e);
      setErro('Não foi possível carregar o controle. Verifique se a tabela LancamentoFalta foi criada no Supabase.');
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [ano, mes]);

  const porTurma = useMemo(() => new Map(lancamentos.map(l => [l.turmaId, l])), [lancamentos]);
  const linhas = useMemo(() => turmas.map(turma => {
    const l = porTurma.get(turma.id);
    return { turma, lancamento: l || null };
  }).filter(({ lancamento }) => {
    if (filtro === 'todos') return true;
    if (filtro === 'nao_lancados') return !lancamento;
    if (filtro === 'lancados') return !!lancamento;
    return lancamento?.status === filtro;
  }), [turmas, porTurma, filtro]);

  const totalLancados = turmas.filter(t => porTurma.has(t.id)).length;
  const comFaltas = turmas.filter(t => porTurma.get(t.id)?.status === 'com_faltas').length;
  const semFaltas = turmas.filter(t => porTurma.get(t.id)?.status === 'sem_faltas').length;
  const naoLancados = turmas.length - totalLancados;

  if (role !== 'admin' && !podeControlarLancamentos) {
    return <div style={{ textAlign: 'center', marginTop: 60, color: theme.textSecondary }}>🔒 Acesso restrito à gestão.</div>;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 18, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, margin: 0 }}>📈 Controle de Lançamentos</h1>
        <p style={{ color: theme.textMuted, fontSize: 13, margin: '4px 0 16px' }}>Acompanhamento mensal das faltas por turma e professora.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div><label style={{ ...label, fontSize: 12 }}>Mês</label><select value={mes} onChange={e => setMes(Number(e.target.value))} style={{ ...input, width: 150 }}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
          <button onClick={() => setFiltro('todos')} style={{ ...btn('ghost'), fontSize: 12 }}>Todos: {turmas.length}</button>
          <button onClick={() => setFiltro('com_faltas')} style={{ ...btn('danger'), fontSize: 12 }}>Com faltas: {comFaltas}</button>
          <button onClick={() => setFiltro('sem_faltas')} style={{ ...btn('success'), fontSize: 12 }}>Sem faltas: {semFaltas}</button>
          <button onClick={() => setFiltro('nao_lancados')} style={{ ...btn('warning'), fontSize: 12 }}>Não lançados: {naoLancados}</button>
        </div>
      </div>
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 18, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`, overflowX: 'auto' }}>
        {loading ? <Loading text="Carregando lançamentos..." /> : erro ? <p style={{ color: theme.danger }}>{erro}</p> : (
          <>
            <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 0 }}>Lançados: <strong>{totalLancados}</strong> · Não lançados: <strong>{naoLancados}</strong></p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `2px solid ${theme.borderLight}` }}>
                {['Professora','Turma','Situação','Total de faltas','Alunos com falta','Lançado por','Data'].map(h => <th key={h} style={{ padding: '9px 8px', textAlign: 'left', color: theme.textMuted }}>{h}</th>)}
              </tr></thead>
              <tbody>{linhas.map(({ turma, lancamento }) => <tr key={turma.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                <td style={{ padding: '9px 8px', fontWeight: 600, color: theme.text }}>{turma.professora || '—'}</td>
                <td style={{ padding: '9px 8px', color: theme.text }}>{turma.nome}</td>
                <td style={{ padding: '9px 8px', fontWeight: 700, color: lancamento ? (lancamento.status === 'com_faltas' ? theme.danger : theme.success) : theme.warning }}>
                  {lancamento ? (lancamento.status === 'com_faltas' ? '✅ Lançado com faltas' : '✅ Lançado sem faltas') : '❌ Não lançado'}
                </td>
                <td style={{ padding: '9px 8px', color: theme.text }}>{lancamento ? lancamento.totalFaltas : '—'}</td>
                <td style={{ padding: '9px 8px', color: theme.text }}>{lancamento ? lancamento.alunosComFalta : '—'}</td>
                <td style={{ padding: '9px 8px', color: theme.textMuted }}>{lancamento?.lancadoPor || '—'}</td>
                <td style={{ padding: '9px 8px', color: theme.textMuted }}>{lancamento?.lancadoEm ? new Date(lancamento.lancadoEm).toLocaleString('pt-BR') : '—'}</td>
              </tr>)}</tbody>
            </table>
            {linhas.length === 0 && <p style={{ color: theme.textMuted, textAlign: 'center', padding: 30 }}>Nenhum registro para este filtro.</p>}
          </>
        )}
      </div>
    </div>
  );
}
