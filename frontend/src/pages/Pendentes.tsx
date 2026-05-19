import { useEffect, useState } from 'react';
import { api } from '../api';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const COR_CONF: Record<string, string> = { alta: '#16a34a', media: '#ea580c', baixa: '#dc2626' };
const BG_CONF: Record<string, string>  = { alta: '#f0fdf4', media: '#fff7ed', baixa: '#fef2f2' };
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
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          ⏳ Pendentes
          {pendentes > 0 && (
            <span style={{ marginLeft: 8, background: '#dc2626', color: 'white', borderRadius: 12, padding: '2px 8px', fontSize: 13 }}>{pendentes}</span>
          )}
        </h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['pendente', 'aprovado', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: filtro === f ? 700 : 400, background: filtro === f ? '#1e40af' : 'white', color: filtro === f ? 'white' : '#475569', fontSize: 12 }}>
              {f === 'pendente' ? 'Pendentes' : f === 'aprovado' ? 'Aprovados' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: 32 }}>Carregando...</p>}

      {!loading && itens.length === 0 && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 60 }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ marginTop: 12, fontSize: 15 }}>
            {filtro === 'pendente' ? 'Nenhuma submissão pendente.' : 'Nenhum item encontrado.'}
          </p>
        </div>
      )}

      {itens.map(item => {
        const dados: any[] = editando[item.id] ?? item.dados ?? [];
        const turmaInfo = item.Turma ?? {};
        const isOpen = expandido === item.id;
        const problemas = dados.filter((d: any) => d.confianca !== 'alta').length;
        const dataEnvio = new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

        return (
          <div key={item.id} style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: 12, overflow: 'hidden' }}>
            {/* Cabeçalho do card */}
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{turmaInfo.nome ?? item.turmaId}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {turmaInfo.professora && `Prof. ${turmaInfo.professora} · `}
                  {MESES[item.mes - 1]} 2026 · {item.total_entradas} alunos · Enviado {dataEnvio}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: item.status === 'pendente' ? '#fef3c7' : item.status === 'aprovado' ? '#f0fdf4' : '#fef2f2',
                    color: item.status === 'pendente' ? '#92400e' : item.status === 'aprovado' ? '#16a34a' : '#dc2626',
                  }}>
                    {item.status === 'pendente' ? '⏳ Pendente' : item.status === 'aprovado' ? '✅ Aprovado' : '❌ Rejeitado'}
                  </span>
                  {problemas > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fef2f2', color: '#dc2626' }}>
                      ⚠️ {problemas} com problema
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {item.status === 'pendente' && (
                  <>
                    <button onClick={() => aprovar(item)} disabled={salvando === item.id}
                      style={{ padding: '7px 14px', borderRadius: 6, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      {salvando === item.id ? '...' : '✓ Aprovar'}
                    </button>
                    <button onClick={() => rejeitar(item.id)}
                      style={{ padding: '7px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}>
                      ✕
                    </button>
                  </>
                )}
                {item.status !== 'pendente' && (
                  <button onClick={() => excluir(item.id)}
                    style={{ padding: '7px 12px', borderRadius: 6, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                    🗑
                  </button>
                )}
                <button onClick={() => abrir(item.id, item.dados)}
                  style={{ padding: '7px 12px', borderRadius: 6, background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 13 }}>
                  {isOpen ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {/* Detalhe expandido */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #f1f5f9' }}>
                <div style={{ background: '#f8fafc', padding: '8px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 1fr 70px 80px', gap: 8, fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                  <span>Nº</span><span>OCR (foto)</span><span>Banco de dados</span><span style={{ textAlign: 'center' }}>Faltas</span><span style={{ textAlign: 'center' }}>Status</span>
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {dados.map((d: any, i: number) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '36px 1fr 1fr 70px 80px',
                      gap: 8, padding: '8px 16px', borderBottom: '1px solid #f1f5f9',
                      alignItems: 'center',
                      background: d.confianca === 'alta' ? 'white' : BG_CONF[d.confianca] ?? 'white',
                    }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.numero}</span>
                      <div>
                        <div style={{ fontSize: 12 }}>{d.nome}</div>
                        {d.motivo && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>{d.motivo}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: d.nomeDB ? '#1e293b' : '#94a3b8', fontStyle: d.nomeDB ? 'normal' : 'italic' }}>
                        {d.nomeDB ?? '— não encontrado —'}
                      </div>
                      <input
                        type="number" min={0} max={31} value={d.faltas}
                        disabled={item.status !== 'pendente'}
                        onChange={v => setEditando(prev => ({
                          ...prev,
                          [item.id]: (prev[item.id] ?? dados).map((x: any, j: number) => j === i ? { ...x, faltas: Number(v.target.value) } : x)
                        }))}
                        style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 13, textAlign: 'center', width: '100%' }}
                      />
                      <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: COR_CONF[d.confianca] ?? '#64748b' }}>
                        {LABEL_CONF[d.confianca] ?? d.confianca}
                      </span>
                    </div>
                  ))}
                </div>
                {item.status === 'pendente' && (
                  <div style={{ padding: 12, display: 'flex', gap: 8, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <button onClick={() => aprovar(item)} disabled={salvando === item.id}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                      {salvando === item.id ? 'Salvando...' : '✅ Aprovar e Salvar'}
                    </button>
                    <button onClick={() => rejeitar(item.id)}
                      style={{ padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
                      Rejeitar
                    </button>
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
