import { useEffect, useState } from 'react';
import { api } from '../api';

const input = { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', marginBottom: 8 } as const;
const label = { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' } as const;

const SITUACAO_COR: Record<string, string> = {
  ATIVO: '#16a34a', REMA: '#ea580c', BXTR: '#9333ea', TRAN: '#0284c7', 'N COM': '#dc2626',
};
const SITUACAO_LABEL: Record<string, string> = {
  ATIVO: 'Ativo', REMA: 'Remanejado', BXTR: 'Baixa Transf.', TRAN: 'Transferido', 'N COM': 'N. Compareceu',
};
const SITUACOES = ['ATIVO', 'REMA', 'BXTR', 'TRAN', 'N COM'];

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

  useEffect(() => { api.getTurmas().then(setTurmas); }, []);

  useEffect(() => {
    if (turmaId === '__all__') {
      api.getAllAlunos().then(setAlunos);
    } else if (turmaId) {
      api.getAlunos(turmaId).then(setAlunos);
    }
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
    <div style={{ marginTop: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Alunos</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={label}>Turma</label>
          <select style={{ ...input, marginBottom: 0 }} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
            <option value="__all__">— Todas as turmas —</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Professora</label>
          <select style={{ ...input, marginBottom: 0 }} value={filtroProfessora} onChange={e => setFiltroProfessora(e.target.value)}>
            <option value="">Todas</option>
            {professoras.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={label}>Situação</label>
          <select style={{ ...input, marginBottom: 0 }} value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
            <option value="">Todas</option>
            {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Deficiência</label>
          <select style={{ ...input, marginBottom: 0 }} value={filtroDefi} onChange={e => setFiltroDefi(e.target.value)}>
            <option value="">Todas</option>
            {deficiencias.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <input style={{ ...input, marginBottom: 8 }} placeholder="🔍 Buscar por nome ou RA..."
        value={busca} onChange={e => setBusca(e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 12 }}>
        <input type="checkbox" checked={soBolsa} onChange={e => setSoBolsa(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#16a34a' }} />
        🟢 Só Bolsa Família ({totalBolsa})
      </label>

      {alunos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { l: 'Total', v: alunos.length, c: '#1e40af' },
            { l: 'Ativos', v: totalAtivos, c: '#16a34a' },
            { l: 'Bolsa Família', v: totalBolsa, c: '#ea580c' },
            { l: 'Deficiência', v: totalDefi, c: '#9333ea' },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: 'white', borderRadius: 8, padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {turmas.length === 0 && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
          <div style={{ fontSize: 40 }}>📥</div>
          <p>Nenhuma turma cadastrada.</p>
          <a href="/importar" style={{ color: '#1e40af', fontWeight: 600 }}>→ Importar planilha</a>
        </div>
      )}

      {alunosFiltrados.length > 0 && (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ background: '#1e40af', color: 'white', padding: '10px 14px', display: 'grid', gridTemplateColumns: '32px 1fr 88px 80px 44px', gap: 8, fontSize: 12, fontWeight: 700 }}>
            <span>#</span><span>Nome</span><span>RA</span>
            <span style={{ textAlign: 'center' }}>Situação</span>
            <span style={{ textAlign: 'center' }}>BF</span>
          </div>

          {alunosFiltrados.map((a, i) => {
            const turmaAluno = turmaMap.get(a.turmaId);
            return (
              <div key={a.id}>
                <div style={{
                  padding: '9px 14px', display: 'grid', gridTemplateColumns: '32px 1fr 88px 80px 44px',
                  gap: 8, alignItems: 'center', borderBottom: editandoId === a.id ? 'none' : '1px solid #f1f5f9',
                  background: editandoId === a.id ? '#fffbeb' : i % 2 === 0 ? 'white' : '#f8fafc',
                }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.numero || i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{a.nome}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {a.data_nascimento || ''}
                      {a.deficiencia ? ` · ${a.deficiencia}` : ''}
                      {turmaId === '__all__' && turmaAluno ? ` · ${turmaAluno.nome}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
                    {a.ra}{a.dig_ra ? `-${a.dig_ra}` : ''}
                  </span>
                  <button onClick={() => abrirEdicao(a)} style={{
                    fontSize: 10, fontWeight: 700, textAlign: 'center',
                    color: SITUACAO_COR[a.situacao] ?? '#64748b',
                    background: `${SITUACAO_COR[a.situacao] ?? '#64748b'}18`,
                    border: `1px solid ${SITUACAO_COR[a.situacao] ?? '#cbd5e1'}50`,
                    borderRadius: 4, padding: '3px 6px', cursor: 'pointer', width: '100%',
                  }}>
                    {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                  </button>
                  <span style={{ textAlign: 'center', fontSize: 14 }}>{a.bolsa_familia ? '✅' : '—'}</span>
                </div>
                {editandoId === a.id && (
                  <div style={{ padding: '10px 14px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Nova situação</div>
                      <select value={novaSituacao} onChange={e => setNovaSituacao(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', fontSize: 13 }}>
                        {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Data da movimentação</div>
                      <input type="date" value={dataMovimentacao} onChange={e => setDataMovimentacao(e.target.value)}
                        style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', fontSize: 13 }} />
                    </div>
                    <button onClick={() => salvarSituacao(a.id)} disabled={salvando}
                      style={{ padding: '8px 16px', borderRadius: 6, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      {salvando ? '...' : 'Salvar'}
                    </button>
                    <button onClick={() => setEditandoId(null)}
                      style={{ padding: '8px 12px', borderRadius: 6, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: 13 }}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ padding: '8px 14px', background: '#f8fafc', fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
            {alunosFiltrados.length} de {alunos.length} aluno(s) · Clique na situação para alterar
          </div>
        </div>
      )}

      {turmas.length > 0 && alunos.length === 0 && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
          <div style={{ fontSize: 40 }}>📭</div>
          <p>Nenhum aluno encontrado com esses filtros.</p>
        </div>
      )}
    </div>
  );
}
