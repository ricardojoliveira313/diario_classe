import { useEffect, useState } from 'react';
import { api, supabase } from '../api';
import { theme, btn, MESES, card as cardStyle, DIAS_LETIVOS_ANO, sortTurmasPedagogico, ordemTurma, input, label } from '../styles';
import { Loading, EmptyState, Spinner } from '../components';
import { useAno } from '../AnoContext';

// ─── Helpers de confiança (Folhas de Frequência) ──────────────────────────────
const COR_CONF: Record<string, string> = { alta: theme.success, media: theme.orange, baixa: theme.danger };
const BG_CONF: Record<string, string>  = { alta: theme.successLight, media: theme.orangeLight, baixa: theme.dangerLight };
const LABEL_CONF: Record<string, string> = { alta: '✅ Ok', media: '⚠️ Conferir', baixa: '❌ Problema' };

// ─── Detecta turmas de Conselho de Ciclo (3º e 5º Anos) ──────────────────────
function getAnoCiclo(nome: string): '3' | '5' | null {
  const g = ordemTurma(nome).slice(0, 2);
  if (g === '05') return '3';
  if (g === '07') return '5';
  return null;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AlunoResultado {
  id: string;
  nome: string;
  numero: number;
  turmaId: string;
  turmaNome: string;
  anoCiclo: '3' | '5';
  totalFaltas: number;
  totalDias: number;
  frequenciaPct: number;
  rendimentoSugerido: 'APROVADO' | 'PERMANECENTE';
  rendimento: string;
}

export default function Pendentes() {
  // ── Aba ativa ──
  const [aba, setAba] = useState<'folhas' | 'ciclo'>('folhas');
  const { ano } = useAno();

  // ── Estado: Folhas de Frequência (existente) ──────────────────────────────
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<Record<string, any[]>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'pendente' | 'aprovado' | 'todos'>('pendente');

  // ── Estado: Conselho de Ciclo ─────────────────────────────────────────────
  const [turmasCiclo, setTurmasCiclo] = useState<any[]>([]);
  const [alunosCiclo, setAlunosCiclo] = useState<AlunoResultado[]>([]);
  const [loadingCiclo, setLoadingCiclo] = useState(false);
  const [salvandoCiclo, setSalvandoCiclo] = useState(false);
  const [filtroTurmaCiclo, setFiltroTurmaCiclo] = useState('__all__');
  const [msgCiclo, setMsgCiclo] = useState('');

  // ── Carrega: Folhas de Frequência ─────────────────────────────────────────
  const carregar = () => {
    setLoading(true);
    api.getPendentes(filtro === 'todos' ? undefined : filtro)
      .then(setItens).finally(() => setLoading(false));
  };

  useEffect(() => { if (aba === 'folhas') carregar(); }, [filtro, aba]);

  // ── Carrega: Conselho de Ciclo ────────────────────────────────────────────
  const carregarCiclo = async () => {
    setLoadingCiclo(true);
    setMsgCiclo('');
    try {
      const todasTurmas = await api.getTurmas();
      const turmasFiltradas = sortTurmasPedagogico(
        todasTurmas.filter(t => getAnoCiclo(t.nome) !== null)
      );
      setTurmasCiclo(turmasFiltradas);

      if (turmasFiltradas.length === 0) {
        setAlunosCiclo([]);
        setMsgCiclo('Nenhuma turma de 3º ou 5º Ano encontrada no cadastro.');
        return;
      }

      const turmaIds = turmasFiltradas.map(t => t.id);

      // Carrega alunos ativos das turmas de ciclo
      const { data: todosAlunos } = await supabase
        .from('Aluno')
        .select('id, nome, numero, turmaId, situacao, rendimento')
        .in('turmaId', turmaIds)
        .eq('situacao', 'ATIVO')
        .order('numero');

      const alunos = todosAlunos ?? [];
      const alunoIds = alunos.map(a => a.id);

      // Carrega faltas acumuladas no ano
      const { data: todasFaltas } = await supabase
        .from('Falta')
        .select('alunoId, faltas')
        .in('alunoId', alunoIds)
        .eq('ano', ano);

      // Total de dias letivos no ano
      const diasAnuais = Object.values(DIAS_LETIVOS_ANO[ano] ?? DIAS_LETIVOS_ANO[2026])
        .reduce((s, v) => s + v, 0);

      // Agrupa faltas por aluno
      const faltasPorAluno = new Map<string, number>();
      for (const f of (todasFaltas ?? [])) {
        faltasPorAluno.set(f.alunoId, (faltasPorAluno.get(f.alunoId) ?? 0) + (f.faltas ?? 0));
      }

      const turmaMap = new Map(turmasFiltradas.map(t => [t.id, t]));

      const resultados: AlunoResultado[] = alunos.map(a => {
        const totalFaltas = faltasPorAluno.get(a.id) ?? 0;
        const presencas = Math.max(0, diasAnuais - totalFaltas);
        const frequenciaPct = diasAnuais > 0 ? (presencas / diasAnuais) * 100 : 100;
        const rendimentoSugerido: 'APROVADO' | 'PERMANECENTE' =
          frequenciaPct >= 75 ? 'APROVADO' : 'PERMANECENTE';
        const t = turmaMap.get(a.turmaId);
        return {
          id: a.id,
          nome: a.nome,
          numero: a.numero || 0,
          turmaId: a.turmaId,
          turmaNome: t?.nome ?? '',
          anoCiclo: getAnoCiclo(t?.nome ?? '') ?? '3',
          totalFaltas,
          totalDias: diasAnuais,
          frequenciaPct,
          rendimentoSugerido,
          rendimento: a.rendimento ?? '',
        };
      });

      setAlunosCiclo(resultados);
    } catch (e: any) {
      setMsgCiclo('Erro ao carregar: ' + (e.message ?? e));
    } finally {
      setLoadingCiclo(false);
    }
  };

  useEffect(() => { if (aba === 'ciclo') carregarCiclo(); }, [aba, ano]);

  // ── Aplica sugestões automáticas nos alunos sem rendimento definido ─────────
  const aplicarSugestoes = () => {
    setAlunosCiclo(prev => prev.map(a => ({
      ...a,
      rendimento: a.rendimento || a.rendimentoSugerido,
    })));
  };

  // ── Aplica sugestões em TODOS (sobrescreve) ───────────────────────────────
  const aplicarSugestoesTodas = () => {
    setAlunosCiclo(prev => prev.map(a => ({
      ...a,
      rendimento: a.rendimentoSugerido,
    })));
  };

  // ── Salva rendimentos no banco ───────────────────────────────────────────
  const salvarCiclo = async () => {
    const comRendimento = alunosCiclo.filter(a => a.rendimento);
    if (comRendimento.length === 0) {
      setMsgCiclo('⚠️ Nenhum rendimento para salvar. Aplique as sugestões ou defina manualmente.');
      return;
    }
    setSalvandoCiclo(true);
    setMsgCiclo('');
    try {
      for (const a of comRendimento) {
        await api.updateAluno(a.id, { rendimento: a.rendimento || null });
      }
      setMsgCiclo(`✅ ${comRendimento.length} rendimento(s) salvos com sucesso!`);
    } catch (e: any) {
      setMsgCiclo('Erro ao salvar: ' + (e.message ?? e));
    } finally {
      setSalvandoCiclo(false);
    }
  };

  // ── Atualiza rendimento individual ───────────────────────────────────────
  const setRendimento = (id: string, valor: string) => {
    setAlunosCiclo(prev => prev.map(a => a.id === id ? { ...a, rendimento: valor } : a));
  };

  // ── Folhas de Frequência: ações ──────────────────────────────────────────
  const abrir = (id: string, dados: any[]) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    setEditando(prev => ({ ...prev, [id]: dados.map((d: any) => ({ ...d })) }));
  };

  const aprovar = async (item: any) => {
    const dados: any[] = editando[item.id] ?? item.dados;
    const validos = dados.filter((d: any) => d.alunoId);
    if (validos.length === 0) { alert('Nenhum aluno cruzado — não é possível aprovar.'); return; }
    setSalvando(item.id);
    try {
      const registros = validos.map((d: any) => ({
        alunoId: d.alunoId, turmaId: item.turmaId, mes: item.mes, ano: item.ano,
        faltas: d.faltas, frequencia: '',
      }));
      await api.upsertFaltasBatch(registros);
      await api.atualizarPendente(item.id, { status: 'aprovado' });
      carregar();
    } finally {
      setSalvando(null); setExpandido(null);
    }
  };

  const rejeitar = async (id: string) => {
    if (!confirm('Rejeitar esta submissão? Os dados não serão salvos.')) return;
    await api.atualizarPendente(id, { status: 'rejeitado' });
    carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir permanentemente?')) return;
    await api.deletePendente(id);
    carregar();
  };

  const pendentes = itens.filter(i => i.status === 'pendente').length;

  // ── Filtra alunos do ciclo pela turma selecionada ─────────────────────────
  const alunosCicloFiltrados = filtroTurmaCiclo === '__all__'
    ? alunosCiclo
    : alunosCiclo.filter(a => a.turmaId === filtroTurmaCiclo);

  const qtd3ano = alunosCiclo.filter(a => a.anoCiclo === '3').length;
  const qtd5ano = alunosCiclo.filter(a => a.anoCiclo === '5').length;
  const qtdDefinidos = alunosCiclo.filter(a => a.rendimento).length;
  const qtdPermanecente = alunosCiclo.filter(a => a.rendimento === 'PERMANECENTE').length;
  const qtdAprovado = alunosCiclo.filter(a => a.rendimento === 'APROVADO').length;

  // ── Estilos do badge de rendimento ──────────────────────────────────────
  const badgeRendimento = (valor: string, sugestao: string) => {
    if (!valor) return { bg: 'var(--ghost-bg)', cor: theme.textMuted, label: '— não definido —' };
    const isDiff = valor !== sugestao;
    if (valor === 'APROVADO') return {
      bg: theme.successLight, cor: theme.success,
      label: '✅ Aprovado' + (isDiff ? ' ✏️' : ''),
    };
    return {
      bg: theme.dangerLight, cor: theme.danger,
      label: '🔁 Permanecente' + (isDiff ? ' ✏️' : ''),
    };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>
          📋 Ata de Resultados
          {aba === 'folhas' && pendentes > 0 && (
            <span style={{ marginLeft: 8, background: theme.danger, color: 'white', borderRadius: 12, padding: '2px 10px', fontSize: 14 }}>{pendentes}</span>
          )}
        </h1>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${theme.borderLight}`, paddingBottom: 0 }}>
        {([
          { id: 'folhas', label: '📄 Folhas de Frequência' },
          { id: 'ciclo',  label: '🏆 Conselho de Ciclo — 3º e 5º Anos' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            style={{
              padding: '9px 16px',
              border: 'none',
              borderBottom: aba === tab.id ? `3px solid ${theme.primary}` : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: aba === tab.id ? 700 : 500,
              fontSize: 14,
              color: aba === tab.id ? theme.primary : theme.textSecondary,
              transition: 'all 0.15s ease',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ABA 1 — Folhas de Frequência (lógica existente)
      ═══════════════════════════════════════════════════════════ */}
      {aba === 'folhas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['pendente', 'aprovado', 'todos'] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  style={{
                    padding: '6px 12px', borderRadius: theme.radius, border: `1px solid ${theme.border}`,
                    cursor: 'pointer', fontWeight: filtro === f ? 700 : 400,
                    background: filtro === f ? theme.primary : 'var(--ghost-bg)',
                    color: filtro === f ? 'white' : theme.textSecondary,
                    fontSize: 12, transition: 'all 0.15s ease',
                  }}>
                  {f === 'pendente' ? 'Pendentes' : f === 'aprovado' ? 'Aprovados' : 'Todos'}
                </button>
              ))}
            </div>
          </div>

          {loading && <Loading />}

          {!loading && itens.length === 0 && (
            <EmptyState icon="✅" message={filtro === 'pendente' ? 'Nenhuma submissão pendente.' : 'Nenhum item encontrado.'} />
          )}

          {itens.map((item, idx) => {
            const dados: any[] = editando[item.id] ?? item.dados ?? [];
            const turmaInfo = item.Turma ?? {};
            const isOpen = expandido === item.id;
            const problemas = dados.filter((d: any) => d.confianca !== 'alta').length;
            const dataEnvio = new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

            return (
              <div key={item.id} className="fade-in" style={{
                ...cardStyle({ marginBottom: 12 }),
                animationDelay: `${idx * 0.05}s`,
                borderLeft: `4px solid ${item.status === 'pendente' ? theme.warning : item.status === 'aprovado' ? theme.success : theme.danger}`,
              }}>
                <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{turmaInfo.nome ?? item.turmaId}</div>
                    <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                      {turmaInfo.professora && `Prof. ${turmaInfo.professora} · `}
                      {MESES[item.mes - 1]} {ano} · {item.total_entradas} alunos · Enviado {dataEnvio}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: item.status === 'pendente' ? theme.warningLight : item.status === 'aprovado' ? theme.successLight : theme.dangerLight,
                        color: item.status === 'pendente' ? '#92400e' : item.status === 'aprovado' ? theme.successHover : theme.dangerHover,
                      }}>
                        {item.status === 'pendente' ? '⏳ Pendente' : item.status === 'aprovado' ? '✅ Aprovado' : '❌ Rejeitado'}
                      </span>
                      {problemas > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: theme.dangerLight, color: theme.danger }}>
                          ⚠️ {problemas} com problema
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {item.status === 'pendente' && (
                      <>
                        <button onClick={() => aprovar(item)} disabled={salvando === item.id}
                          style={btn('success', { small: true })}>
                          {salvando === item.id ? <Spinner size={14} /> : '✓ Aprovar'}
                        </button>
                        <button onClick={() => rejeitar(item.id)}
                          style={btn('danger', { small: true, outline: true })}>✕</button>
                      </>
                    )}
                    {item.status !== 'pendente' && (
                      <button onClick={() => excluir(item.id)}
                        style={btn('ghost', { small: true })}>🗑</button>
                    )}
                    <button onClick={() => abrir(item.id, item.dados)}
                      style={btn('ghost', { small: true })}>
                      {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: `1px solid ${theme.borderLight}` }}>
                    <div style={{ background: 'var(--footer-row)', padding: '8px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 1fr 70px 80px', gap: 8, fontSize: 11, color: theme.textSecondary, fontWeight: 700 }}>
                      <span>Nº</span><span>OCR (foto)</span><span>Banco de dados</span><span style={{ textAlign: 'center' }}>Faltas</span><span style={{ textAlign: 'center' }}>Status</span>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                      {dados.map((d: any, i: number) => (
                        <div key={i} style={{
                          display: 'grid', gridTemplateColumns: '36px 1fr 1fr 70px 80px',
                          gap: 8, padding: '8px 16px', borderBottom: `1px solid ${theme.borderLight}`,
                          alignItems: 'center',
                          background: d.confianca === 'alta' ? 'var(--row-even)' : BG_CONF[d.confianca] ?? 'var(--row-even)',
                        }}>
                          <span style={{ fontSize: 12, color: theme.textMuted }}>{d.numero}</span>
                          <div>
                            <div style={{ fontSize: 12 }}>{d.nome}</div>
                            {d.motivo && <div style={{ fontSize: 10, color: theme.danger, marginTop: 2 }}>{d.motivo}</div>}
                          </div>
                          <div style={{ fontSize: 12, color: d.nomeDB ? theme.text : theme.textMuted, fontStyle: d.nomeDB ? 'normal' : 'italic' }}>
                            {d.nomeDB ?? '— não encontrado —'}
                          </div>
                          <input type="number" min={0} max={31} value={d.faltas}
                            disabled={item.status !== 'pendente'}
                            onChange={v => setEditando(prev => ({
                              ...prev,
                              [item.id]: (prev[item.id] ?? dados).map((x: any, j: number) => j === i ? { ...x, faltas: Number(v.target.value) } : x)
                            }))}
                            style={{ padding: '4px 6px', borderRadius: 4, border: `1px solid ${theme.border}`, fontSize: 13, textAlign: 'center', width: '100%' }} />
                          <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: COR_CONF[d.confianca] ?? theme.textSecondary }}>
                            {LABEL_CONF[d.confianca] ?? d.confianca}
                          </span>
                        </div>
                      ))}
                    </div>
                    {item.status === 'pendente' && (
                      <div style={{ padding: 12, display: 'flex', gap: 8, background: 'var(--footer-row)', borderTop: `1px solid ${theme.borderLight}` }}>
                        <button onClick={() => aprovar(item)} disabled={salvando === item.id}
                          style={{ ...btn('success', { full: true }), fontSize: 14 }}>
                          {salvando === item.id ? <><Spinner size={16} /> Salvando...</> : '✅ Aprovar e Salvar'}
                        </button>
                        <button onClick={() => rejeitar(item.id)}
                          style={btn('danger', { outline: true })}>Rejeitar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ABA 2 — Conselho de Ciclo (3º e 5º Anos)
      ═══════════════════════════════════════════════════════════ */}
      {aba === 'ciclo' && (
        <div>
          {/* Info sobre o critério */}
          <div style={{
            background: 'var(--ghost-bg)',
            border: `1px solid ${theme.borderLight}`,
            borderRadius: theme.radiusMd,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: theme.textSecondary,
            lineHeight: 1.6,
          }}>
            <strong style={{ color: theme.text }}>ℹ️ Critério automático:</strong> frequência ≥ 75% →{' '}
            <span style={{ color: theme.success, fontWeight: 700 }}>APROVADO</span> · frequência {'<'} 75% →{' '}
            <span style={{ color: theme.danger, fontWeight: 700 }}>PERMANECENTE</span>.{' '}
            Você pode ajustar manualmente antes de salvar.
            {alunosCiclo.length > 0 && (
              <span style={{ marginLeft: 8, color: theme.textMuted }}>
                (Base: {alunosCiclo[0]?.totalDias} dias letivos em {ano})
              </span>
            )}
          </div>

          {/* Controles */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {turmasCiclo.length > 0 && (
              <div style={{ minWidth: 200 }}>
                <label style={label}>Filtrar por turma</label>
                <select style={{ ...input, marginBottom: 0 }} value={filtroTurmaCiclo} onChange={e => setFiltroTurmaCiclo(e.target.value)}>
                  <option value="__all__">— Todas ({qtd3ano} × 3º ano · {qtd5ano} × 5º ano) —</option>
                  {turmasCiclo.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
              <button onClick={aplicarSugestoes} style={btn('warning', { small: true, outline: true })}
                title="Preenche apenas quem ainda não tem rendimento definido">
                🤖 Sugerir pendentes
              </button>
              <button onClick={aplicarSugestoesTodas} style={btn('ghost', { small: true })}
                title="Sobrescreve todos com a sugestão automática">
                🔄 Resetar todas
              </button>
              <button onClick={carregarCiclo} style={btn('ghost', { small: true })} disabled={loadingCiclo}>
                {loadingCiclo ? <Spinner size={14} /> : '↺ Recarregar'}
              </button>
            </div>
          </div>

          {loadingCiclo && <Loading />}

          {/* Mensagem de feedback */}
          {msgCiclo && (
            <div style={{
              padding: '10px 16px', borderRadius: theme.radius, marginBottom: 14,
              background: msgCiclo.startsWith('✅') ? theme.successLight : theme.warningLight,
              color: msgCiclo.startsWith('✅') ? theme.success : '#92400e',
              fontWeight: 600, fontSize: 13,
            }}>
              {msgCiclo}
            </div>
          )}

          {!loadingCiclo && alunosCiclo.length === 0 && !msgCiclo && (
            <EmptyState icon="🏫" message="Nenhum aluno ativo em turmas de 3º ou 5º Ano." />
          )}

          {/* Resumo */}
          {alunosCiclo.length > 0 && !loadingCiclo && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Total alunos', val: alunosCiclo.length, color: theme.primary },
                { label: 'Definidos', val: `${qtdDefinidos}/${alunosCiclo.length}`, color: theme.orange },
                { label: '✅ Aprovados', val: qtdAprovado, color: theme.success },
                { label: '🔁 Permanecentes', val: qtdPermanecente, color: theme.danger },
              ].map(s => (
                <div key={s.label} style={{
                  flex: 1, minWidth: 110, padding: '10px 14px', borderRadius: theme.radiusMd,
                  background: theme.card, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabela de alunos */}
          {alunosCicloFiltrados.length > 0 && !loadingCiclo && (
            <div style={cardStyle({})}>
              {/* Cabeçalho da tabela */}
              <div style={{
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
                color: 'white', padding: '10px 16px',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 150px 70px 80px 110px 160px',
                gap: 8, fontSize: 12, fontWeight: 700,
              }}>
                <span>#</span>
                <span>Nome</span>
                <span>Turma</span>
                <span style={{ textAlign: 'center' }}>Faltas</span>
                <span style={{ textAlign: 'center' }}>Freq %</span>
                <span style={{ textAlign: 'center' }}>Sugestão</span>
                <span style={{ textAlign: 'center' }}>Rendimento Final</span>
              </div>

              {/* Linhas */}
              <div>
                {alunosCicloFiltrados.map((a, i) => {
                  const badge = badgeRendimento(a.rendimento, a.rendimentoSugerido);
                  const freqBaixa = a.frequenciaPct < 75;
                  return (
                    <div key={a.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 150px 70px 80px 110px 160px',
                      gap: 8, padding: '10px 16px',
                      borderBottom: `1px solid ${theme.borderLight}`,
                      alignItems: 'center',
                      background: i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)',
                    }}>
                      <span style={{ fontSize: 12, color: theme.textMuted }}>{a.numero || i + 1}</span>

                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</span>

                      <span style={{ fontSize: 12, color: theme.textSecondary }}>{a.turmaNome}</span>

                      <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700,
                        color: a.totalFaltas > 50 ? theme.danger : theme.text }}>
                        {a.totalFaltas}
                      </span>

                      <span style={{
                        textAlign: 'center', fontSize: 12, fontWeight: 700,
                        color: freqBaixa ? theme.danger : theme.success,
                      }}>
                        {a.frequenciaPct.toFixed(1)}%
                      </span>

                      {/* Sugestão automática */}
                      <span style={{
                        textAlign: 'center', fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 8,
                        background: a.rendimentoSugerido === 'APROVADO' ? theme.successLight : theme.dangerLight,
                        color: a.rendimentoSugerido === 'APROVADO' ? theme.success : theme.danger,
                      }}>
                        {a.rendimentoSugerido === 'APROVADO' ? '✅ Aprovado' : '🔁 Permanecente'}
                      </span>

                      {/* Rendimento final (editável) */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <select
                          value={a.rendimento}
                          onChange={e => setRendimento(a.id, e.target.value)}
                          style={{
                            padding: '5px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                            border: `1.5px solid ${
                              !a.rendimento ? theme.border
                              : a.rendimento === 'APROVADO' ? theme.success
                              : theme.danger
                            }`,
                            background: badge.bg,
                            color: badge.cor,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          <option value="">— definir —</option>
                          <option value="APROVADO">✅ Aprovado</option>
                          <option value="PERMANECENTE">🔁 Permanecente</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rodapé com botão salvar */}
              <div style={{
                padding: '12px 16px', background: 'var(--footer-row)',
                borderTop: `1px solid ${theme.borderLight}`,
                display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: theme.textSecondary, marginRight: 'auto' }}>
                  {alunosCicloFiltrados.length} aluno(s) listado(s) · ✏️ indica diferença da sugestão automática
                </span>
                <button onClick={salvarCiclo} disabled={salvandoCiclo}
                  style={{ ...btn('success', {}), minWidth: 160 }}>
                  {salvandoCiclo ? <><Spinner size={16} /> Salvando...</> : '💾 Salvar Rendimentos'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
