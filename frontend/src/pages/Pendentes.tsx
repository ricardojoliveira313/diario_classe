import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, btn, MESES, label, card as cardStyle } from '../styles';
import { Loading, EmptyState, Spinner } from '../components';

const COR_CONF: Record<string, string> = { alta: theme.success, media: theme.orange, baixa: theme.danger };
const BG_CONF: Record<string, string>  = { alta: theme.successLight, media: theme.orangeLight, baixa: theme.dangerLight };
const LABEL_CONF: Record<string, string> = { alta: '✅ Ok', media: '⚠️ Conferir', baixa: '❌ Problema' };

export default function Pendentes() {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<Record<string, any[]>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'pendente' | 'aprovado' | 'todos'>('pendente');

  const carregar = () => {
    setLoading(true);
    api.getPendentes(filtro === 'todos' ? undefined : filtro)
      .then(setItens).finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, [filtro]);

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

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>
          ⏳ Pendentes
          {pendentes > 0 && (
            <span style={{ marginLeft: 8, background: theme.danger, color: 'white', borderRadius: 12, padding: '2px 10px', fontSize: 14 }}>{pendentes}</span>
          )}
        </h1>
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
                  {MESES[item.mes - 1]} 2026 · {item.total_entradas} alunos · Enviado {dataEnvio}
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
  );
}
