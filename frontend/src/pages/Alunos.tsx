import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, btn, input, label, SITUACAO_COR, SITUACAO_LABEL, SITUACOES, card as cardStyle, row } from '../styles';
import { Loading, EmptyState, StatCard, Spinner, BadgeSituacao } from '../components';

export default function Alunos() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('__all__');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroProfessora, setFiltroProfessora] = useState('');
  const [filtroDefi, setFiltroDefi] = useState('');
  const [soBolsa, setSoBolsa] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaSituacao, setNovaSituacao] = useState('');
  const [dataMovimentacao, setDataMovimentacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getTurmas().then(setTurmas); }, []);

  useEffect(() => {
    setLoading(true);
    const p = turmaId === '__all__' ? api.getAllAlunos() : api.getAlunos(turmaId);
    p.then(setAlunos).finally(() => setLoading(false));
  }, [turmaId]);

  const professoras = [...new Set(turmas.map(t => t.professora).filter(Boolean))].sort();
  const deficiencias = [...new Set(alunos.map(a => a.deficiencia).filter(Boolean))].sort();
  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  const alunosFiltrados = alunos.filter(a => {
    if (busca && !a.nome?.toLowerCase().includes(busca.toLowerCase()) && !String(a.ra ?? '').includes(busca)) return false;
    if (filtroSituacao && a.situacao !== filtroSituacao) return false;
    if (soBolsa && !a.bolsa_familia) return false;
    if (filtroProfessora && turmaMap.get(a.turmaId)?.professora !== filtroProfessora) return false;
    if (filtroDefi && a.deficiencia !== filtroDefi) return false;
    return true;
  });

  const totalAtivos = alunos.filter(a => a.situacao === 'ATIVO').length;
  const totalBolsa = alunos.filter(a => a.bolsa_familia).length;
  const totalDefi = alunos.filter(a => a.deficiencia).length;

  const abrirEdicao = (a: any) => {
    if (editandoId === a.id) { setEditandoId(null); return; }
    setEditandoId(a.id);
    setNovaSituacao(a.situacao ?? 'ATIVO');
    setDataMovimentacao('');
  };

  const salvarSituacao = async (alunoId: string) => {
    setSalvando(true);
    const updates: any = { situacao: novaSituacao };
    if (dataMovimentacao) {
      updates.data_movimentacao = dataMovimentacao;
      if (['BXTR', 'TRAN', 'N COM'].includes(novaSituacao)) updates.data_fim_matricula = dataMovimentacao;
    }
    await api.updateAluno(alunoId, updates);
    setAlunos(prev => prev.map(a => a.id === alunoId ? { ...a, ...updates } : a));
    setSalvando(false);
    setEditandoId(null);
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>👥 Alunos</h1>

      {/* Filtros */}
      <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        padding: 16, marginBottom: 16, boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
              <option value="__all__">— Todas as turmas —</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Professora</label>
            <select style={input} value={filtroProfessora} onChange={e => setFiltroProfessora(e.target.value)}>
              <option value="">Todas</option>
              {professoras.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={label}>Situação</label>
            <select style={input} value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
              <option value="">Todas</option>
              {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Deficiência</label>
            <select style={input} value={filtroDefi} onChange={e => setFiltroDefi(e.target.value)}>
              <option value="">Todas</option>
              {deficiencias.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <input style={{ ...input, marginBottom: 0 }} placeholder="🔍 Buscar por nome ou RA..."
          value={busca} onChange={e => setBusca(e.target.value)} />
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', fontSize: 13, color: theme.success,
          fontWeight: 600, marginTop: 10,
        }}>
          <input type="checkbox" checked={soBolsa} onChange={e => setSoBolsa(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: theme.success }} />
          🟢 Só Bolsa Família ({totalBolsa})
        </label>
      </div>

      {loading ? <Loading /> : alunos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          <StatCard label="Total" val={alunos.length} cor={theme.primary} />
          <StatCard label="Ativos" val={totalAtivos} cor={theme.success} />
          <StatCard label="Bolsa Família" val={totalBolsa} cor={theme.orange} />
          <StatCard label="Deficiência" val={totalDefi} cor={theme.purple} />
        </div>
      )}

      {turmas.length === 0 && !loading && (
        <EmptyState icon="📥" message="Nenhuma turma cadastrada."
          action={{ label: 'Importar planilha', href: '/importar' }} />
      )}

      {turmas.length > 0 && !loading && alunos.length === 0 && (
        <EmptyState icon="📭" message="Nenhum aluno encontrado com esses filtros." />
      )}

      {/* Tabela */}
      {alunosFiltrados.length > 0 && !loading && (
        <div style={cardStyle({})}>
          <div style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
            color: 'white', padding: '10px 14px',
            display: 'grid', gridTemplateColumns: '32px 1fr 90px 80px 44px',
            gap: 8, fontSize: 12, fontWeight: 700,
          }}>
            <span>#</span><span>Nome</span><span>RA</span>
            <span style={{ textAlign: 'center' }}>Situação</span><span style={{ textAlign: 'center' }}>BF</span>
          </div>

          {alunosFiltrados.map((a, i) => {
            const t = turmaMap.get(a.turmaId);
            return (
              <div key={a.id}>
                <div style={row(i, { gridTemplateColumns: '32px 1fr 90px 80px 44px', gap: 8, ...(editandoId === a.id ? { borderBottom: 'none', background: '#fffbeb' } : {}) })}
                  onMouseEnter={e => { if (editandoId !== a.id) e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={e => { if (editandoId !== a.id) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f8fafc'; }}>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{a.numero || i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{a.nome}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                      {a.data_nascimento || ''}
                      {a.deficiencia ? ` · ${a.deficiencia}` : ''}
                      {turmaId === '__all__' && t ? ` · ${t.nome}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'monospace' }}>
                    {a.ra}{a.dig_ra ? `-${a.dig_ra}` : ''}
                  </span>
                  <button onClick={() => abrirEdicao(a)} style={{
                    fontSize: 10, fontWeight: 700, textAlign: 'center',
                    color: SITUACAO_COR[a.situacao] ?? theme.textSecondary,
                    background: `${SITUACAO_COR[a.situacao] ?? theme.textSecondary}18`,
                    border: `1px solid ${SITUACAO_COR[a.situacao] ?? theme.border}50`,
                    borderRadius: 4, padding: '3px 6px', cursor: 'pointer', width: '100%',
                    transition: 'opacity 0.15s ease',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                    {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                  </button>
                  <span style={{ textAlign: 'center', fontSize: 14 }}>{a.bolsa_familia ? '✅' : '—'}</span>
                </div>
                {editandoId === a.id && (
                  <div className="slide-down" style={{
                    padding: '12px 14px', background: '#fffbeb',
                    borderBottom: `1px solid #fde68a`,
                    display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
                    borderLeft: `3px solid ${theme.warning}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Nova situação</div>
                      <select value={novaSituacao} onChange={e => setNovaSituacao(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 13 }}>
                        {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Data da movimentação</div>
                      <input type="date" value={dataMovimentacao} onChange={e => setDataMovimentacao(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 13 }} />
                    </div>
                    <button onClick={() => salvarSituacao(a.id)} disabled={salvando}
                      style={btn('success', { small: true })}>
                      {salvando ? <Spinner size={14} /> : '💾 Salvar'}
                    </button>
                    <button onClick={() => setEditandoId(null)}
                      style={btn('ghost', { small: true })}>✕</button>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ padding: '8px 14px', background: '#f8fafc', fontSize: 12, color: theme.textSecondary, borderTop: `1px solid ${theme.borderLight}` }}>
            <span style={{ fontWeight: 600 }}>{alunosFiltrados.length}</span> de <span style={{ fontWeight: 600 }}>{alunos.length}</span> aluno(s) · Clique na situação para alterar
          </div>
        </div>
      )}
    </div>
  );
}
