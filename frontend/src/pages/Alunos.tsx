import { useEffect, useState } from 'react';
import { api } from '../api';

const card = { background: 'white', borderRadius: 8, padding: 12, marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const btn = { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 };
const input = { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', marginBottom: 8 };
const label = { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' };

export default function Alunos() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nome: '', ra: '', digito: '', nascimento: '', situacao: 'ATIVO' });

  useEffect(() => { api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); }); }, []);
  useEffect(() => { if (turmaId) api.getAlunos(turmaId).then(setAlunos); }, [turmaId]);

  const save = async () => {
    await api.createAluno({ ...form, turmaId });
    setAdding(false);
    setForm({ nome: '', ra: '', digito: '', nascimento: '', situacao: 'ATIVO' });
    api.getAlunos(turmaId).then(setAlunos);
  };

  const del = async (id: string, nome: string) => {
    if (!confirm(`Excluir aluno "${nome}"?`)) return;
    await api.deleteAluno(id);
    api.getAlunos(turmaId).then(setAlunos);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Alunos</h1>
        <button style={{ ...btn, background: '#1e40af', color: 'white' }} onClick={() => setAdding(!adding)}>
          {adding ? 'Cancelar' : '+ Novo Aluno'}
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>Turma</label>
        <select style={{ ...input, marginBottom: 0 }} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
          {turmas.map(t => <option key={t.id} value={t.id}>{t.nome || `${t.numero}º ${t.letra} - ${t.periodo}`}</option>)}
        </select>
      </div>

      {adding && (
        <div style={{ background: 'white', borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <label style={label}>Nome completo</label>
          <input style={input} placeholder="Nome do aluno" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={label}>RA</label>
              <input style={input} value={form.ra} onChange={e => setForm({ ...form, ra: e.target.value })} />
            </div>
            <div>
              <label style={label}>Dígito</label>
              <input style={input} value={form.digito} onChange={e => setForm({ ...form, digito: e.target.value })} />
            </div>
          </div>
          <label style={label}>Nascimento</label>
          <input style={input} placeholder="dd/mm/aaaa" value={form.nascimento} onChange={e => setForm({ ...form, nascimento: e.target.value })} />
          <button style={{ ...btn, background: '#16a34a', color: 'white', width: '100%', marginTop: 8 }} onClick={save}>
            Salvar Aluno
          </button>
        </div>
      )}

      {alunos.length === 0 && (
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 32 }}>
          {turmas.length === 0 ? 'Cadastre uma turma primeiro.' : 'Nenhum aluno nesta turma.'}
        </p>
      )}

      {alunos.map((a, i) => (
        <div key={a.id} style={card}>
          <div>
            <strong>{i + 1}. {a.nome}</strong>
            <div style={{ fontSize: 12, color: '#64748b' }}>RA: {a.ra}{a.digito ? `-${a.digito}` : ''} · {a.situacao}</div>
          </div>
          <button style={{ ...btn, background: '#fee2e2', color: '#dc2626', padding: '6px 12px' }} onClick={() => del(a.id, a.nome)}>✕</button>
        </div>
      ))}
    </div>
  );
}
