import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, SITUACAO_COR, SITUACAO_LABEL, SITUACOES, card as cardStyle, row } from '../styles';
import { Loading, EmptyState, StatCard, Spinner, BadgeSituacao } from '../components';

// CSS vars — funcionam em light e dark mode
const V = {
  rowHover: 'var(--row-hover)',
  rowEven: 'var(--row-even)',
  rowOdd: 'var(--row-odd)',
  editBg: 'var(--edit-bg)',
  editBorder: 'var(--edit-border)',
  footerRow: 'var(--footer-row)',
};

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

  // Seleção em lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modoSelecao, setModoSelecao] = useState(false);
  const [loteStatus, setLoteStatus] = useState('ATIVO');
  const [loteData, setLoteData] = useState('');
  const [salvandoLote, setSalvandoLote] = useState(false);

  useEffect(() => { api.getTurmas().then(setTurmas); }, []);

  useEffect(() => {
    setLoading(true);
    setSelecionados(new Set());
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
    if (modoSelecao) return;
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

  // ── Seleção em lote ──
  const toggleSelecao = (id: string) => {
    setSelecionados(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selecionarTodos = () => {
    if (selecionados.size === alunosFiltrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(alunosFiltrados.map(a => a.id)));
    }
  };

  const salvarLote = async () => {
    if (selecionados.size === 0) return;
    setSalvandoLote(true);
    const updates: any = { situacao: loteStatus };
    if (loteData) {
      updates.data_movimentacao = loteData;
      if (['BXTR', 'TRAN', 'N COM'].includes(loteStatus)) updates.data_fim_matricula = loteData;
    }
    await Promise.all([...selecionados].map(id => api.updateAluno(id, updates)));
    setAlunos(prev => prev.map(a => selecionados.has(a.id) ? { ...a, ...updates } : a));
    setSelecionados(new Set());
    setSalvandoLote(false);
    setModoSelecao(false);
  };

  // ── Exportação ──
  const exportarExcel = () => {
    const dados = alunosFiltrados.map((a, i) => ({
      'Nº': a.numero || i + 1,
      'Nome': a.nome,
      'RA': a.ra ? `${a.ra}${a.dig_ra ? '-' + a.dig_ra : ''}` : '',
      'Data Nasc.': a.data_nascimento ?? '',
      'Situação': SITUACAO_LABEL[a.situacao] ?? a.situacao ?? 'ATIVO',
      'Turma': turmaId === '__all__' ? (turmaMap.get(a.turmaId)?.nome ?? '') : '',
      'Professor(a)': turmaId === '__all__' ? (turmaMap.get(a.turmaId)?.professora ?? '') : '',
      'Deficiência': a.deficiencia ?? '',
      'Bolsa Família': a.bolsa_familia ? 'Sim' : 'Não',
      'NIS': a.nis ?? '',
      'Responsável': a.responsavel ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [
      { wch: 4 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    const turma = turmas.find(t => t.id === turmaId);
    const nomePlanilha = turma ? turma.nome.substring(0, 31) : 'Todos os Alunos';
    XLSX.utils.book_append_sheet(wb, ws, nomePlanilha);
    const nomeArq = `Alunos_${turma ? turma.nome.replace(/[^A-Za-z0-9]/g, '_') : 'Geral'}.xlsx`;
    XLSX.writeFile(wb, nomeArq);
  };

  const exportarPDF = () => {
    const turma = turmas.find(t => t.id === turmaId);
    const linhas = alunosFiltrados.map((a, i) => {
      const sit = (SITUACAO_LABEL[a.situacao] ?? a.situacao ?? 'ATIVO').substring(0, 12);
      const ra = a.ra ? String(a.ra).substring(0, 12) : '';
      return `${String(a.numero || i + 1).padStart(3)}. ${a.nome.padEnd(44)} ${ra.padEnd(13)} ${sit}`;
    });
    const professora = turma?.professora || '';
    const periodo = turma?.periodo || '';
    const conteudo = [
      '═══════════════════════════════════════════════════════════════════',
      '  DIÁRIO DE CLASSE',
      `  Turma: ${turma?.nome ?? 'Todas as Turmas'}   ${professora ? `Prof.: ${professora}` : ''}   ${periodo}`,
      '═══════════════════════════════════════════════════════════════════',
      '',
      ` Nº  Nome                                          RA             Situação`,
      '───────────────────────────────────────────────────────────────────',
      ...linhas,
      '───────────────────────────────────────────────────────────────────',
      `     Total: ${alunosFiltrados.length} aluno(s)`,
      '',
      `  Ativos: ${alunosFiltrados.filter(a => a.situacao === 'ATIVO' || !a.situacao).length}`,
      `  Bolsa Família: ${alunosFiltrados.filter(a => a.bolsa_familia).length}`,
      `  Com deficiência: ${alunosFiltrados.filter(a => a.deficiencia).length}`,
    ].join('\n');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Alunos ${turma?.nome ?? ''}</title>
<style>body{font-family:monospace;font-size:12px;margin:24px}pre{white-space:pre-wrap}
@media print{body{margin:8px}}</style></head>
<body><pre>${conteudo}</pre>
<script>setTimeout(()=>window.print(),400)</script></body></html>`);
    win.document.close();
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>👥 Alunos</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {!loading && alunosFiltrados.length > 0 && (
            <>
              <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
              <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
            </>
          )}
          {!loading && alunos.length > 0 && (
            <button
              onClick={() => { setModoSelecao(!modoSelecao); setSelecionados(new Set()); setEditandoId(null); }}
              style={btn(modoSelecao ? 'warning' : 'ghost', { small: true })}
            >
              {modoSelecao ? '✕ Cancelar' : '☑️ Edição em Lote'}
            </button>
          )}
        </div>
      </div>

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

      {/* Barra de ação em lote */}
      {modoSelecao && selecionados.size > 0 && (
        <div style={{
          position: 'sticky', bottom: 16, zIndex: 20,
          background: theme.card, borderRadius: theme.radiusMd,
          padding: '12px 16px', marginBottom: 12,
          boxShadow: theme.shadowLg, border: `2px solid ${theme.warning}`,
          display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.warning, flex: '0 0 auto', alignSelf: 'center' }}>
            ☑️ {selecionados.size} aluno(s) selecionado(s)
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Nova situação</div>
            <select value={loteStatus} onChange={e => setLoteStatus(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 13 }}>
              {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Data da movimentação</div>
            <input type="date" value={loteData} onChange={e => setLoteData(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 13 }} />
          </div>
          <button onClick={salvarLote} disabled={salvandoLote}
            style={btn('warning', { small: true })}>
            {salvandoLote ? <><Spinner size={14} /> Salvando...</> : '💾 Aplicar a todos'}
          </button>
        </div>
      )}

      {/* Tabela */}
      {alunosFiltrados.length > 0 && !loading && (
        <div style={cardStyle({})}>
          <div style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
            color: 'white', padding: '10px 14px',
            display: 'grid',
            gridTemplateColumns: modoSelecao ? '28px 32px 1fr 90px 80px 44px' : '32px 1fr 90px 80px 44px',
            gap: 8, fontSize: 12, fontWeight: 700,
          }}>
            {modoSelecao && (
              <input type="checkbox"
                checked={selecionados.size === alunosFiltrados.length && alunosFiltrados.length > 0}
                onChange={selecionarTodos}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'white' }}
              />
            )}
            <span>#</span><span>Nome</span><span>RA</span>
            <span style={{ textAlign: 'center' }}>Situação</span><span style={{ textAlign: 'center' }}>BF</span>
          </div>

          {alunosFiltrados.map((a, i) => {
            const t = turmaMap.get(a.turmaId);
            const isSelected = selecionados.has(a.id);
            return (
              <div key={a.id}>
                <div
                  style={row(i, {
                    gridTemplateColumns: modoSelecao ? '28px 32px 1fr 90px 80px 44px' : '32px 1fr 90px 80px 44px',
                    gap: 8,
                    ...(editandoId === a.id ? { borderBottom: 'none', background: '#fffbeb' } : {}),
                    ...(isSelected ? { background: '#eff6ff', borderLeft: `3px solid ${theme.primary}` } : {}),
                    cursor: modoSelecao ? 'pointer' : 'default',
                  })}
                  onClick={() => modoSelecao && toggleSelecao(a.id)}
                  onMouseEnter={e => { if (editandoId !== a.id && !isSelected) e.currentTarget.style.background = V.rowHover; }}
                  onMouseLeave={e => { if (editandoId !== a.id && !isSelected) e.currentTarget.style.background = i % 2 === 0 ? V.rowEven : V.rowOdd; }}
                >
                  {modoSelecao && (
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelecao(a.id)}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: theme.primary }}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{a.numero || i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{a.nome}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                      {a.data_nascimento || ''}
                      {a.deficiencia ? ` · ♿ ${a.deficiencia}` : ''}
                      {turmaId === '__all__' && t ? ` · ${t.nome}` : ''}
                    </div>
                    {/* Origem do remanejamento — aparece no registro ATIVO */}
                    {a.turma_origem && (
                      <div style={{ fontSize: 10, color: theme.orange, fontWeight: 600, marginTop: 2 }}>
                        ↩ Remanejado(a) de: {a.turma_origem}
                        {a.professora_origem ? ` (Prof. ${a.professora_origem})` : ''}
                      </div>
                    )}
                    {/* Registro de origem do remanejamento — aparece no registro REMA */}
                    {a.situacao === 'REMA' && turmaId === '__all__' && (
                      <div style={{ fontSize: 10, color: theme.orange, fontWeight: 600, marginTop: 2 }}>
                        ↗ Saiu desta turma (registro histórico)
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'monospace' }}>
                    {a.ra}{a.dig_ra ? `-${a.dig_ra}` : ''}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); abrirEdicao(a); }} style={{
                    fontSize: 10, fontWeight: 700, textAlign: 'center',
                    color: SITUACAO_COR[a.situacao] ?? theme.textSecondary,
                    background: `${SITUACAO_COR[a.situacao] ?? theme.textSecondary}18`,
                    border: `1px solid ${SITUACAO_COR[a.situacao] ?? theme.border}50`,
                    borderRadius: 4, padding: '3px 6px', cursor: modoSelecao ? 'default' : 'pointer', width: '100%',
                    transition: 'opacity 0.15s ease',
                  }}>
                    {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                  </button>
                  <span style={{ textAlign: 'center', fontSize: 14 }}>{a.bolsa_familia ? '✅' : '—'}</span>
                </div>

                {editandoId === a.id && !modoSelecao && (
                  <div className="slide-down" style={{
                    padding: '12px 14px', background: V.editBg,
                    borderBottom: `1px solid ${V.editBorder}`,
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

          <div style={{ padding: '8px 14px', background: V.footerRow, fontSize: 12, color: theme.textSecondary, borderTop: `1px solid ${theme.borderLight}` }}>
            <span style={{ fontWeight: 600 }}>{alunosFiltrados.length}</span> de <span style={{ fontWeight: 600 }}>{alunos.length}</span> aluno(s)
            {!modoSelecao && ' · Clique na situação para alterar'}
            {modoSelecao && selecionados.size > 0 && ` · ${selecionados.size} selecionado(s)`}
          </div>
        </div>
      )}
    </div>
  );
}
