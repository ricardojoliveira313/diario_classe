import { useEffect, useState } from 'react';
import { api } from '../api';

const card = { background: 'white', borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const btn = { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 };
const input = { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', marginBottom: 8 };
const label = { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' };

export default function Turmas() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [form, setForm] = useState({ nome: '', etapa: 'EF1', numero: 1, letra: 'A', periodo: 'Manhã', professor: '' });
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => api.getTurmas().then(setTurmas).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    await api.createTurma({ ...form, numero: Number(form.numero) });
    setAdding(false);
    setForm({ nome: '', etapa: 'EF1', numero: 1, letra: 'A', periodo: 'Manhã', professor: '' });
    load();
  };

  const del = async (id: string, nome: string) => {
    if (!confirm(`Excluir turma "${nome}"? Todos os alunos e faltas serão removidos.`)) return;
    await api.deleteTurma(id);
    load();
  };

  if (loading) return <p style={{ marginTop: 32, textAlign: 'center', color: '#64748b' }}>Carregando...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Turmas</h1>
        <button style={{ ...btn, background: '#1e40af', color: 'white' }} onClick={() => setAdding(!adding)}>
          {adding ? 'Cancelar' : '+ Nova Turma'}
        </button>
      </div>

      {adding && (
        <div style={{ background: 'white', borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <label style={label}>Nome da Turma</label>
          <input style={input} placeholder="Ex: 3º Ano A - Manhã" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              <input style={input} type="number" value={form.numero} onChange={e => setForm({ ...form, numero: Number(e.target.value) })} />
            </div>
            <div>
              <label style={label}>Letra</label>
              <input style={input} value={form.letra} onChange={e => setForm({ ...form, letra: e.target.value })} />
            </div>
          </div>
          <label style={label}>Professor(a)</label>
          <input style={input} placeholder="Nome do professor" value={form.professor} onChange={e => setForm({ ...form, professor: e.target.value })} />
          <button style={{ ...btn, background: '#16a34a', color: 'white', width: '100%', marginTop: 8 }} onClick={save}>
            Salvar Turma
          </button>
        </div>
      )}

      {turmas.length === 0 && !adding && (
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 48 }}>Nenhuma turma cadastrada. Clique em "+ Nova Turma" para começar.</p>
      )}

      {turmas.map(t => (
        <div key={t.id} style={card}>
          <div>
            <strong>{t.nome || `${t.numero}º ${t.letra} - ${t.periodo}`}</strong>
            <div style={{ fontSize: 13, color: '#64748b' }}>{t.etapa} · {t.periodo} {t.professor && `· Prof. ${t.professor}`}</div>
          </div>
          <button style={{ ...btn, background: '#fee2e2', color: '#dc2626' }} onClick={() => del(t.id, t.nome)}>Excluir</button>
        </div>
      ))}
    </div>
  );
}
