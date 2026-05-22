import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, SITUACAO_COR, SITUACAO_LABEL, SITUACOES, card as cardStyle, row } from '../styles';
import { Loading, EmptyState, StatCard, Spinner } from '../components';

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
  const [dataInicioEdit, setDataInicioEdit] = useState('');
  const [dataFimEdit, setDataFimEdit] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detalhesAbertos, setDetalhesAbertos] = useState<Set<string>>(new Set());

  useEffect(() => { api.getTurmas().then(setTurmas); }, []);

  useEffect(() => {
    setLoading(true);
    const p = turmaId === '__all__' ? api.getAllAlunos() : api.getAlunos(turmaId);
    p.then(setAlunos).catch(err => { console.error('Erro ao carregar alunos:', err); setAlunos([]); }).finally(() => setLoading(false));
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
    setDataInicioEdit(a.data_inicio_matricula ?? '');
    setDataFimEdit(a.data_fim_matricula ?? '');
  };

  const salvarSituacao = async (alunoId: string) => {
    setSalvando(true);
    const updates: any = { situacao: novaSituacao };
    if (dataMovimentacao) {
      updates.data_movimentacao = dataMovimentacao;
      if (['BXTR', 'TRAN', 'N COM', 'REMA'].includes(novaSituacao)) updates.data_fim_matricula = dataMovimentacao;
    }
    if (dataInicioEdit.trim()) updates.data_inicio_matricula = dataInicioEdit.trim();
    if (dataFimEdit.trim() && !updates.data_fim_matricula) updates.data_fim_matricula = dataFimEdit.trim();
    await api.updateAluno(alunoId, updates);
    setAlunos(prev => prev.map(a => a.id === alunoId ? { ...a, ...updates } : a));
    setSalvando(false);
    setEditandoId(null);
  };

  const toggleDetalhes = (id: string) => {
    setDetalhesAbertos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Export ───
  const exportarExcel = () => {
    const dados = alunosFiltrados.map((a, i) => {
      const t = turmaMap.get(a.turmaId);
      return {
        'Nº': a.numero || i + 1,
        'Nome do Aluno': a.nome,
        'RA': a.ra ?? '',
        'Dig. RA': a.dig_ra ?? '',
        'Data Nascimento': a.data_nascimento ?? '',
        'Situação': SITUACAO_LABEL[a.situacao] ?? a.situacao,
        'Deficiência': a.deficiencia ?? '',
        'Bolsa Família': a.bolsa_familia ? 'Sim' : 'Não',
        'Turma': t?.nome ?? '',
        'Professora': t?.professora ?? '',
        'Data Início Matrícula': a.data_inicio_matricula ?? '',
        'Data Fim Matrícula': a.data_fim_matricula ?? '',
        'Data Movimentação': a.data_movimentacao ?? '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [
      { wch: 4 }, { wch: 38 }, { wch: 14 }, { wch: 8 },
      { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 12 },
      { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, `Alunos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarPDF = () => {
    const turmaSel = turmas.find(t => t.id === turmaId);
    const linhas = alunosFiltrados.map((a, i) => {
      const nome = String(a.nome ?? '').padEnd(38);
      const ra = String(a.ra ?? '').padEnd(12);
      const sit = (SITUACAO_LABEL[a.situacao] ?? a.situacao ?? '').padEnd(14);
      const defi = (a.deficiencia ?? '').substring(0, 22).padEnd(22);
      return `${String(a.numero || i + 1).padStart(2)} ${nome} ${ra} ${sit} ${defi}`;
    });
    const titulo = `RELAÇÃO DE ALUNOS — ${turmaSel?.nome ?? 'Todas as Turmas'}`;
    const conteudo = [
      '='.repeat(100),
      `  ${titulo}`,
      '='.repeat(100),
      '',
      ` Nº  Nome                                    RA             Situação       Deficiência`,
      '─'.repeat(100),
      ...linhas,
      '─'.repeat(100),
      `  Total: ${alunosFiltrados.length} alunos`,
    ].join('\n');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${titulo}</title>
<style>body{font-family:monospace;font-size:14px;margin:24px}pre{white-space:pre-wrap}
@media print{body{margin:8px}}</style></head>
<body><pre>${conteudo}</pre>
<script>setTimeout(()=>window.print(),400)</script></body></html>`);
    win.document.close();
  };

  const COLUNAS = '44px 1fr 110px 85px 100px 40px 110px 130px';

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>👥 Alunos</h1>
        {alunosFiltrados.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
            <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        padding: 18, marginBottom: 16, boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
              <option value="__all__">— Todas as turmas —</option>
              {turmas.map(t => {
                const duplicado = turmas.filter(x => x.nome === t.nome).length > 1;
                return (
                  <option key={t.id} value={t.id}>
                    {t.nome}{duplicado && t.professora ? ` — ${t.professora}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label style={label}>Professora</label>
            <select style={input} value={filtroProfessora} onChange={e => setFiltroProfessora(e.target.value)}>
              <option value="">Todas</option>
              {professoras.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...input, marginBottom: 0, flex: 1, minWidth: 180 }} placeholder="🔍 Buscar por nome ou RA..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', fontSize: 14, color: theme.success,
            fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            <input type="checkbox" checked={soBolsa} onChange={e => setSoBolsa(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: theme.success }} />
            🟢 Só Bolsa Família ({totalBolsa})
          </label>
        </div>
      </div>

      {loading ? <Loading /> : alunos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
          <StatCard label="Total" val={alunos.length} cor={theme.primary} />
          <StatCard label="Ativos" val={totalAtivos} cor={theme.success} sub={alunos.length > 0 ? `${((totalAtivos / alunos.length) * 100).toFixed(0)}%` : undefined} />
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
        <div className="table-wrap">
          <div style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
            color: 'white', padding: '12px 16px',
            display: 'grid', gridTemplateColumns: COLUNAS,
            gap: 8, fontSize: 13, fontWeight: 700,
          }}>
            <span>#</span><span>Nome</span><span>RA</span>
            <span style={{ textAlign: 'center' }}>Situação</span><span style={{ textAlign: 'center' }}>Deficiência</span>
            <span style={{ textAlign: 'center' }}>BF</span>
            <span>Professora</span><span>Turma</span>
          </div>

          {alunosFiltrados.map((a, i) => {
            const t = turmaMap.get(a.turmaId);
            const aberto = detalhesAbertos.has(a.id);
            return (
              <div key={a.id}>
                <div
                  onClick={() => toggleDetalhes(a.id)}
                  style={{
                    ...row(i, {
                      gridTemplateColumns: COLUNAS,
                      gap: 8,
                      cursor: 'pointer',
                      ...(editandoId === a.id ? { borderBottom: 'none', background: 'var(--edit-bg)' } : {}),
                    }),
                  }}
                  onMouseEnter={e => { if (editandoId !== a.id) e.currentTarget.style.background = 'var(--ghost-bg)'; }}
                  onMouseLeave={e => { if (editandoId !== a.id) e.currentTarget.style.background = ''; }}>
                  <span style={{ fontSize: 13, color: theme.textMuted }}>{a.numero || i + 1}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{a.nome}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      {a.data_nascimento || ''}
                      {a.data_nascimento && a.deficiencia ? ' · ' : ''}{a.deficiencia || ''}
                      {turmaId === '__all__' && t ? ` · ${t.nome}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: theme.textSecondary, fontFamily: 'monospace' }}>
                    {a.ra}{a.dig_ra ? `-${a.dig_ra}` : ''}
                  </span>
                  <button onClick={e => { e.stopPropagation(); abrirEdicao(a); }} style={{
                    fontSize: 11, fontWeight: 700, textAlign: 'center',
                    color: SITUACAO_COR[a.situacao] ?? theme.textSecondary,
                    background: `${SITUACAO_COR[a.situacao] ?? theme.textSecondary}18`,
                    border: `1px solid ${SITUACAO_COR[a.situacao] ?? theme.border}50`,
                    borderRadius: 4, padding: '4px 8px', cursor: 'pointer', width: '100%',
                    transition: 'opacity 0.15s ease',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                    {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                  </button>
                  <span style={{ fontSize: 11, textAlign: 'center', color: a.deficiencia ? theme.purple : theme.textMuted }}>
                    {a.deficiencia ? '🟣' : '—'}
                  </span>
                  <span style={{ textAlign: 'center', fontSize: 15 }}>{a.bolsa_familia ? '✅' : '—'}</span>
                  <span style={{ fontSize: 12, color: theme.textSecondary }}>{a.professora || t?.professora || ''}</span>
                  <span style={{ fontSize: 12, color: theme.textSecondary }}>{t?.nome || ''}</span>
                </div>

                {/* Detalhes expandidos */}
                {aberto && (
                  <div className="slide-down" style={{
                    padding: '12px 16px',
                    background: 'var(--bg-card)',
                    borderBottom: `1px solid ${theme.borderLight}`,
                    borderLeft: `3px solid ${theme.sky}`,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 8,
                    fontSize: 13,
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, color: theme.textSecondary }}>Início Matrícula: </span>
                      {a.data_inicio_matricula
                        ? <span style={{ color: theme.text }}>{a.data_inicio_matricula}</span>
                        : <span style={{ color: theme.orange, fontSize: 12, fontWeight: 600 }}>⚠️ não informado — clique em ✏️ Situação para preencher</span>}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: theme.textSecondary }}>Fim Matrícula: </span>
                      {a.data_fim_matricula
                        ? <span style={{ color: theme.text }}>{a.data_fim_matricula}</span>
                        : <span style={{ color: theme.orange, fontSize: 12, fontWeight: 600 }}>⚠️ não informado</span>}
                    </div>
                    {a.data_movimentacao && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Movimentação:</span> {a.data_movimentacao}</div>}
                    {t?.professora && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Professora:</span> {t.professora}</div>}
                    {t?.nome && turmaId !== '__all__' && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Turma:</span> {t.nome}</div>}
                    {a.nis && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>NIS:</span> {a.nis}</div>}
                    {a.responsavel && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Responsável:</span> {a.responsavel}</div>}
                  </div>
                )}

                {/* Edição inline */}
                {editandoId === a.id && (
                  <div className="slide-down" style={{
                    padding: '14px 16px', background: 'var(--edit-bg)',
                    borderBottom: `1px solid var(--edit-border)`,
                    display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
                    borderLeft: `3px solid ${theme.warning}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Nova situação</div>
                      <select value={novaSituacao} onChange={e => setNovaSituacao(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 14 }}>
                        {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                        Início Matrícula <span style={{ color: theme.orange, fontWeight: 400 }}>(DD/MM/AAAA)</span>
                      </div>
                      <input
                        type="text" placeholder="04/02/2026"
                        value={dataInicioEdit}
                        onChange={e => setDataInicioEdit(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${dataInicioEdit ? theme.border : theme.orange}`, width: '100%', fontSize: 14 }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                        Fim Matrícula <span style={{ color: theme.textMuted, fontWeight: 400 }}>(DD/MM/AAAA)</span>
                      </div>
                      <input
                        type="text" placeholder="18/12/2026"
                        value={dataFimEdit}
                        onChange={e => setDataFimEdit(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 14 }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Data da movimentação</div>
                      <input type="date" value={dataMovimentacao} onChange={e => setDataMovimentacao(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 14 }} />
                    </div>
                    <button onClick={() => salvarSituacao(a.id)} disabled={salvando}
                      style={btn('success', { small: true })}>
                      {salvando ? <Spinner size={16} /> : '💾 Salvar'}
                    </button>
                    <button onClick={() => setEditandoId(null)}
                      style={btn('ghost', { small: true })}>✕</button>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ padding: '10px 16px', background: 'var(--footer-row)', fontSize: 13, color: theme.textSecondary, borderTop: `1px solid ${theme.borderLight}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <span><span style={{ fontWeight: 600 }}>{alunosFiltrados.length}</span> de <span style={{ fontWeight: 600 }}>{alunos.length}</span> aluno(s)</span>
            <span>Clique na linha para detalhes · Clique na situação para alterar</span>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
