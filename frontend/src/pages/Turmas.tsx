import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, btn, input, label, card as cardStyle } from '../styles';
import { Loading, EmptyState, Spinner } from '../components';

export default function Turmas() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [form, setForm] = useState({ nome: '', etapa: 'EF1', numero: 1, letra: 'A', periodo: 'Manhã', professor: '' });
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => api.getTurmas().then(setTurmas).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    await api.createTurma({ ...form, numero: Number(form.numero) });
    setSaving(false);
    setAdding(false);
    setForm({ nome: '', etapa: 'EF1', numero: 1, letra: 'A', periodo: 'Manhã', professor: '' });
    load();
  };

  const del = async (id: string, nome: string) => {
    if (!confirm(`Excluir turma "${nome}"? Todos os alunos e faltas serão removidos.`)) return;
    setDeleting(id);
    await api.deleteTurma(id);
    setDeleting(null);
    load();
  };

  if (loading) return <Loading />;

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>👩‍🏫 Turmas</h1>
        <button style={adding ? btn('ghost') : btn('primary')} onClick={() => setAdding(!adding)}>
          {adding ? 'Cancelar' : '+ Nova Turma'}
        </button>
      </div>

      {adding && (
        <div className="slide-down" style={{
          background: theme.card, borderRadius: theme.radiusMd,
          padding: 20, marginBottom: 16, boxShadow: theme.shadowMd,
          border: `1px solid ${theme.border}`,
        }}>
          <label style={label}>Nome da Turma</label>
          <input style={input} placeholder="Ex: 3º Ano A - Manhã" value={form.nome}
            onChange={e => setForm({ ...form, nome: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label style={label}>Etapa</label>
              <select style={input} value={form.etapa} onChange={e => setForm({ ...form, etapa: e.target.value })}>
                <option>EI</option><option>EF1</option><option>EF2</option><option>EJA</option>
              </select>
            </div>
            <div>
              <label style={label}>Período</label>
              <select style={input} value={form.periodo} onChange={e => setForm({ ...form, periodo: e.target.value })}>
                <option>Manhã</option><option>Tarde</option><option>Integral</option><option>Noturno</option>
              </select>
            </div>
            <div>
              <label style={label}>Número</label>
              <input style={input} type="number" value={form.numero}
                onChange={e => setForm({ ...form, numero: Number(e.target.value) })} />
            </div>
            <div>
              <label style={label}>Letra</label>
              <input style={input} value={form.letra}
                onChange={e => setForm({ ...form, letra: e.target.value })} />
            </div>
          </div>
          <label style={{ ...label, marginTop: 8 }}>Professor(a)</label>
          <input style={input} placeholder="Nome do professor" value={form.professor}
            onChange={e => setForm({ ...form, professor: e.target.value })} />
          <button style={{ ...btn('success', { full: true }), marginTop: 12 }} onClick={save} disabled={saving}>
            {saving ? <Spinner size={16} /> : null}
            {saving ? 'Salvando...' : '💾 Salvar Turma'}
          </button>
        </div>
      )}

      {turmas.length === 0 && !adding && (
        <EmptyState icon="👩‍🏫" message="Nenhuma turma cadastrada."
          action={{ label: 'Clique em "+ Nova Turma" para começar', href: '#' }}
        />
      )}

      {turmas.map((t, i) => (
        <div key={t.id} className="slide-down" style={{
          ...cardStyle({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 10 }),
          animationDelay: `${i * 0.05}s`,
        }}>
          <div>
            <strong style={{ fontSize: 15, color: theme.text }}>{t.nome || `${t.numero}º ${t.letra} - ${t.periodo}`}</strong>
            <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
              {t.etapa} · {t.periodo} {t.professor && `· Prof. ${t.professor}`}
            </div>
          </div>
          <button style={btn('danger', { small: true, outline: true })}
            onClick={() => del(t.id, t.nome)} disabled={deleting === t.id}>
            {deleting === t.id ? <Spinner size={14} /> : 'Excluir'}
          </button>
        </div>
      ))}
    </div>
  );
}
