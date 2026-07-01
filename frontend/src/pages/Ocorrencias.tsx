import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, btn, input, label } from '../styles';
import { useAuth } from '../AuthContext';

const selectStyle = { ...input, cursor: 'pointer' as const, appearance: 'menulist' as const, WebkitAppearance: 'menulist' as const };

const TIPOS = [
  { value: 'falta_abonada',       label: 'Falta Abonada',          color: '#ef4444' },
  { value: 'atestado_medico',     label: 'Atestado Médico',        color: '#f59e0b' },
  { value: 'licenca_medica',      label: 'Licença Médica',         color: '#8b5cf6' },
  { value: 'ltpf',                label: 'LTPF',                   color: '#a855f7' },
  { value: 'tre',                 label: 'TRE',                    color: '#3b82f6' },
  { value: 'pedido_justificacao', label: 'Pedido de Justificação', color: '#10b981' },
  { value: 'doacao_sangue',       label: 'Doação de Sangue',       color: '#ec4899' },
];

function formatDate(d: string) {
  if (!d) return '';
  const p = d.split('-');
  if (p.length !== 3) return d;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function toInputDate(d: string) {
  if (!d) return '';
  const p = d.split('/');
  if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
  return d;
}

export default function Ocorrencias() {
  const { role, username } = useAuth();
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroServidor, setFiltroServidor] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState({ servidor: '', tipo: 'falta_abonada', data: '', dias: 1, descricao: '' });
  const [servidorUnico, setServidorUnico] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await api.getOcorrencias({
        servidor: filtroServidor || undefined,
        tipo: filtroTipo || undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
      });
      setOcorrencias(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtroServidor, filtroTipo, filtroDataInicio, filtroDataFim]);

  const servidores = [...new Set(ocorrencias.map(o => o.servidor))].sort();

  const abrirNovo = () => {
    setEditando(null);
    setForm({ servidor: servidorUnico, tipo: 'falta_abonada', data: '', dias: 1, descricao: '' });
    setModal(true);
  };

  const abrirEditar = (o: any) => {
    setEditando(o);
    setForm({ servidor: o.servidor, tipo: o.tipo, data: toInputDate(o.data), dias: o.dias ?? 1, descricao: o.descricao || '' });
    setModal(true);
  };

  const salvar = async () => {
    if (!form.servidor.trim() || !form.data) return;
    setSaving(true);
    try {
      if (editando) {
        await api.updateOcorrencia(editando.id, {
          servidor: form.servidor.trim(),
          tipo: form.tipo,
          data: form.data,
          dias: form.dias,
          descricao: form.descricao.trim(),
        });
      } else {
        await api.createOcorrencia({
          servidor: form.servidor.trim(),
          tipo: form.tipo,
          data: form.data,
          dias: form.dias,
          descricao: form.descricao.trim(),
          registrado_por: username || '',
        });
      }
      setModal(false);
      await carregar();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar. Verifique se a tabela Ocorrencia foi criada no Supabase.');
    }
    setSaving(false);
  };

  const deletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ocorrência?')) return;
    try {
      await api.deleteOcorrencia(id);
      await carregar();
    } catch (e) {
      console.error(e);
    }
  };

  const exportarPDF = () => {
    const filtrados = ocorrencias;
    const grupos = new Map<string, any[]>();
    for (const o of filtrados) {
      if (!grupos.has(o.servidor)) grupos.set(o.servidor, []);
      grupos.get(o.servidor)!.push(o);
    }

    const tipoLabel = (t: string) => TIPOS.find(p => p.value === t)?.label ?? t;

    const rows: string[] = [];
    for (const [serv, lista] of grupos) {
      const totalDias = lista.reduce((s, o) => s + (o.dias || 1), 0);
      const detalhes = lista.map(o =>
        `<tr><td>${formatDate(o.data)}</td><td>${tipoLabel(o.tipo)}</td><td>${o.dias || 1}</td><td>${o.descricao || '-'}</td><td>${o.registrado_por || '-'}</td></tr>`
      ).join('');
      const porTipo = new Map<string, number>();
      for (const o of lista) {
        const lbl = tipoLabel(o.tipo);
        porTipo.set(lbl, (porTipo.get(lbl) || 0) + (o.dias || 1));
      }
      const sumario = Array.from(porTipo).map(([t, c]) => `${t}: ${c} dia(s)`).join(' | ');
      rows.push(`
        <h3 style="color:#1e40af;margin:24px 0 8px;border-bottom:2px solid #1e40af;padding-bottom:4px">${serv}</h3>
        <p style="margin:0 0 8px;color:#555;font-size:13px">Total: ${totalDias} dia(s) — ${sumario}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#e5e7eb">
            <th style="padding:6px 8px;text-align:left;border:1px solid #d1d5db">Data</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid #d1d5db">Tipo</th>
            <th style="padding:6px 8px;text-align:center;border:1px solid #d1d5db">Dias</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid #d1d5db">Descrição</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid #d1d5db">Registrado por</th>
          </tr></thead>
          <tbody>${detalhes}</tbody>
        </table>
      `);
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Relatório de Ocorrências</title>
<style>
  body { font-family:Arial,sans-serif; margin:20px; color:#333; }
  h1 { color:#1e3a5f; font-size:20px; margin-bottom:4px; }
  .sub { color:#666; font-size:13px; margin-bottom:16px; }
  @media print { @page { margin:15mm; } body { margin:0; } }
</style></head>
<body>
  <h1>Relatório de Ocorrências — Servidores</h1>
  <div class="sub">
    ${filtroDataInicio || filtroDataFim ? `Período: ${filtroDataInicio || '—'} a ${filtroDataFim || '—'}` : 'Todos os períodos'}
    ${filtroTipo ? ` | Tipo: ${tipoLabel(filtroTipo)}` : ''} | Total: ${filtrados.length} registro(s)
  </div>
  ${rows.join('\n')}
  <script>setTimeout(()=>window.print(),300);</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const cardBg = theme.card;
  const bdr = theme.borderLight;

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ background: cardBg, borderRadius: theme.radiusMd, padding: 18, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${bdr}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, margin: 0 }}>📋 Ocorrências</h1>
            <p style={{ color: theme.textMuted, fontSize: 13, margin: '2px 0 0' }}>Registro de faltas de servidores — Falta Abonada, Atestado Médico, Licença Médica, LTPF, TRE, Ped. Justificação e Doação de Sangue</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportarPDF} style={{ ...btn.secondary, fontSize: 13 }} disabled={ocorrencias.length === 0}>📄 Relatório PDF</button>
            <button onClick={abrirNovo} style={{ ...btn.primary, fontSize: 13 }}>+ Nova Ocorrência</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label style={{ ...label, fontSize: 12 }}>Servidor</label>
            <input value={filtroServidor} onChange={e => setFiltroServidor(e.target.value)} placeholder="Filtrar servidor..." style={{ ...input, width: 180 }} />
          </div>
          <div>
            <label style={{ ...label, fontSize: 12 }}>Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...selectStyle, width: 160 }}>
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ ...label, fontSize: 12 }}>Data início</label>
            <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={{ ...input, width: 150 }} />
          </div>
          <div>
            <label style={{ ...label, fontSize: 12 }}>Data fim</label>
            <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={{ ...input, width: 150 }} />
          </div>
          {(filtroServidor || filtroTipo || filtroDataInicio || filtroDataFim) && (
            <button onClick={() => { setFiltroServidor(''); setFiltroTipo(''); setFiltroDataInicio(''); setFiltroDataFim(''); }}
              style={{ ...btn.danger, fontSize: 12, padding: '7px 12px', marginBottom: 0 }}>Limpar filtros</button>
          )}
        </div>
      </div>

      <div style={{ background: cardBg, borderRadius: theme.radiusMd, padding: 18, boxShadow: theme.shadow, border: `1px solid ${bdr}`, overflowX: 'auto' }}>
        {loading ? (
          <p style={{ color: theme.textMuted, textAlign: 'center', padding: 40 }}>Carregando...</p>
        ) : ocorrencias.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <p>Nenhuma ocorrência encontrada.</p>
            <button onClick={abrirNovo} style={{ ...btn.primary, fontSize: 13, marginTop: 8 }}>+ Nova Ocorrência</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${bdr}` }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Servidor</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Tipo</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Data</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Dias</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Descrição</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Registro</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', color: theme.textMuted, fontWeight: 600, fontSize: 12 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ocorrencias.map(o => {
                const tipo = TIPOS.find(t => t.value === o.tipo);
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${bdr}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = theme.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: theme.text }}>{o.servidor}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ background: (tipo?.color || '#6b7280') + '20', color: tipo?.color || '#6b7280', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {tipo?.label || o.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>{formatDate(o.data)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: theme.text, fontWeight: 600 }}>{o.dias || 1}</td>
                    <td style={{ padding: '8px 10px', color: theme.textMuted, fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descricao || '-'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>{o.registrado_por || '-'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {role === 'admin' && (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => abrirEditar(o)} style={{ background: 'none', border: 'none', color: theme.primary, cursor: 'pointer', fontSize: 13, padding: '2px 6px' }} title="Editar">✏️</button>
                          <button onClick={() => deletar(o.id)} style={{ background: 'none', border: 'none', color: theme.danger, cursor: 'pointer', fontSize: 13, padding: '2px 6px' }} title="Excluir">🗑️</button>
                        </div>
                      )}
                      {role !== 'admin' && <span style={{ color: theme.textMuted, fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: cardBg, borderRadius: theme.radiusMd, padding: 24, width: '100%', maxWidth: 480, boxShadow: theme.shadowLg, border: `1px solid ${bdr}` }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: '0 0 16px' }}>
              {editando ? '✏️ Editar Ocorrência' : '➕ Nova Ocorrência'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ ...label, fontSize: 13 }}>Servidor *</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={form.servidor} onChange={e => setForm(f => ({ ...f, servidor: e.target.value }))}
                    placeholder="Nome do servidor" list="servidores-list"
                    style={{ ...input, flex: 1 }} autoFocus />
                  <datalist id="servidores-list">
                    {servidores.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label style={{ ...label, fontSize: 13 }}>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...label, fontSize: 13 }}>Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={{ ...input, width: '100%' }} />
                </div>
                <div style={{ width: 80 }}>
                  <label style={{ ...label, fontSize: 13 }}>Dias</label>
                  <input type="number" min={1} value={form.dias} onChange={e => setForm(f => ({ ...f, dias: Math.max(1, Number(e.target.value)) }))} style={{ ...input, width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ ...label, fontSize: 13 }}>Descrição (opcional)</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Observações..." rows={3}
                  style={{ ...input, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={{ ...btn.secondary }} disabled={saving}>Cancelar</button>
              <button onClick={salvar} style={{ ...btn.primary }} disabled={saving || !form.servidor.trim() || !form.data}>
                {saving ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
