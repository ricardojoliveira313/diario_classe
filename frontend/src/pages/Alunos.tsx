import { useEffect, useState } from 'react';
import { api } from '../api';

const input = { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', marginBottom: 8 };
const label = { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' };

const SITUACAO_COR: Record<string, string> = {
  'ATIVO': '#16a34a',
  'N COM': '#dc2626',
  'BAIXA TRANSF.': '#9333ea',
  'REMA': '#ea580c',
  'TRANSF.': '#0284c7',
};

export default function Alunos() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  useEffect(() => {
    api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); });
  }, []);

  useEffect(() => {
    if (turmaId) api.getAlunos(turmaId).then(setAlunos);
  }, [turmaId]);

  const alunosFiltrados = alunos.filter(a => {
    const buscaOk = !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()) || String(a.ra ?? '').includes(busca);
    const sitOk = !filtroSituacao || a.situacao === filtroSituacao;
    return buscaOk && sitOk;
  });

  const totalAtivos = alunos.filter(a => a.situacao === 'ATIVO').length;
  const totalBolsa = alunos.filter(a => a.bolsa_familia).length;

  return (
    <div style={{ marginTop: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Alunos</h1>

      {/* Seletor de turma */}
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Turma</label>
        <select style={{ ...input, marginBottom: 0 }} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
          {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      {/* Resumo */}
      {alunos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Total', value: alunos.length, cor: '#1e40af' },
            { label: 'Ativos', value: totalAtivos, cor: '#16a34a' },
            { label: 'Bolsa Família', value: totalBolsa, cor: '#ea580c' },
          ].map(({ label: l, value, cor }) => (
            <div key={l} style={{ background: 'white', borderRadius: 8, padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      {alunos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
          <input style={{ ...input, marginBottom: 0 }} placeholder="🔍 Buscar por nome ou RA..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <select style={{ ...input, marginBottom: 0, width: 'auto' }}
            value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
            <option value="">Todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="N COM">N COM</option>
            <option value="BAIXA TRANSF.">Baixa Transf.</option>
            <option value="REMA">REMA</option>
            <option value="TRANSF.">Transf.</option>
          </select>
        </div>
      )}

      {/* Sem dados */}
      {turmas.length === 0 && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
          <div style={{ fontSize: 40 }}>📥</div>
          <p>Nenhuma turma cadastrada.</p>
          <a href="/importar" style={{ color: '#1e40af', fontWeight: 600 }}>→ Importar planilha</a>
        </div>
      )}

      {turmas.length > 0 && alunos.length === 0 && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
          <div style={{ fontSize: 40 }}>📭</div>
          <p>Nenhum aluno nesta turma.</p>
          <a href="/importar" style={{ color: '#1e40af', fontWeight: 600 }}>→ Importar planilha</a>
        </div>
      )}

      {/* Tabela de alunos */}
      {alunosFiltrados.length > 0 && (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {/* Cabeçalho */}
          <div style={{
            background: '#1e40af', color: 'white', padding: '10px 14px',
            display: 'grid', gridTemplateColumns: '32px 1fr 90px 70px 70px',
            gap: 8, fontSize: 12, fontWeight: 700,
          }}>
            <span>#</span>
            <span>Nome do Aluno</span>
            <span>RA</span>
            <span style={{ textAlign: 'center' }}>Situação</span>
            <span style={{ textAlign: 'center' }}>B. Família</span>
          </div>

          {alunosFiltrados.map((a, i) => (
            <div key={a.id} style={{
              padding: '9px 14px',
              display: 'grid', gridTemplateColumns: '32px 1fr 90px 70px 70px',
              gap: 8, alignItems: 'center',
              borderBottom: '1px solid #f1f5f9',
              background: i % 2 === 0 ? 'white' : '#f8fafc',
            }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.numero || i + 1}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{a.nome}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {a.data_nascimento ? `Nasc: ${a.data_nascimento}` : ''}
                  {a.deficiencia ? ` · ${a.deficiencia}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
                {a.ra}{a.dig_ra ? `-${a.dig_ra}` : ''}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, textAlign: 'center',
                color: SITUACAO_COR[a.situacao] ?? '#64748b',
                background: `${SITUACAO_COR[a.situacao] ?? '#64748b'}18`,
                borderRadius: 4, padding: '2px 4px',
              }}>
                {a.situacao ?? 'ATIVO'}
              </span>
              <span style={{ textAlign: 'center', fontSize: 14 }}>
                {a.bolsa_familia ? '✅' : '—'}
              </span>
            </div>
          ))}

          <div style={{ padding: '8px 14px', background: '#f8fafc', fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
            {alunosFiltrados.length} aluno(s) exibido(s) de {alunos.length} total
          </div>
        </div>
      )}
    </div>
  );
}
