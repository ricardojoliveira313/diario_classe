import { useEffect, useState } from 'react';
import { api } from '../api';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_LETIVOS: Record<number, number> = {
  1: 4, 2: 13, 3: 22, 4: 18, 5: 20, 6: 21,
  7: 9, 8: 21, 9: 22, 10: 18, 11: 20, 12: 17,
};

export default function Dashboard() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [faltas, setFaltas] = useState<any[]>([]);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [loadingFaltas, setLoadingFaltas] = useState(false);

  useEffect(() => {
    Promise.all([api.getTurmas(), api.getAllAlunos()])
      .then(([t, a]) => { setTurmas(t); setAlunos(a); setLoading(false); });
  }, []);

  useEffect(() => {
    setLoadingFaltas(true);
    api.getFaltasMes(mes, 2026).then(f => { setFaltas(f); setLoadingFaltas(false); });
  }, [mes]);

  if (loading) return <p style={{ textAlign: 'center', marginTop: 48, color: '#64748b' }}>Carregando...</p>;

  const total = alunos.length;
  const ativos = alunos.filter(a => a.situacao === 'ATIVO').length;
  const baixas = alunos.filter(a => ['BXTR', 'TRAN', 'N COM'].includes(a.situacao)).length;
  const rema = alunos.filter(a => a.situacao === 'REMA').length;
  const bolsa = alunos.filter(a => a.bolsa_familia).length;
  const comDefi = alunos.filter(a => a.deficiencia).length;
  const dl = DIAS_LETIVOS[mes] ?? 22;
  const limiteAlerta = Math.ceil(dl * 0.25);

  const faltasMap = new Map<string, number>(faltas.map(f => [f.alunoId, f.faltas ?? 0]));
  const alertas = alunos.filter(a => (faltasMap.get(a.id) ?? 0) >= limiteAlerta && a.situacao === 'ATIVO');

  const statsPorTurma = turmas.map(t => {
    const alunosTurma = alunos.filter(a => a.turmaId === t.id);
    const faltasTurma = faltas.filter(f => f.turmaId === t.id);
    const totalF = faltasTurma.reduce((s, f) => s + (f.faltas ?? 0), 0);
    const ativosTurma = alunosTurma.filter(a => a.situacao === 'ATIVO').length;
    const dlTotal = dl * ativosTurma;
    const freq = dlTotal > 0 ? (dlTotal - totalF) / dlTotal * 100 : 100;
    return { id: t.id, nome: t.nome, professora: t.professora, total: alunosTurma.length, ativos: ativosTurma, faltas: totalF, freq };
  }).filter(t => t.total > 0).sort((a, b) => a.nome.localeCompare(b.nome));

  const Card = ({ label, val, cor, sub }: { label: string; val: number | string; cor: string; sub?: string }) => (
    <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor, lineHeight: 1.2 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>📊 Dashboard</h1>
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
        >
          {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m} 2026</option>)}
        </select>
      </div>

      {total === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 60 }}>
          <div style={{ fontSize: 48 }}>📥</div>
          <p style={{ marginTop: 12, fontSize: 15 }}>Nenhum dado importado ainda.</p>
          <a href="/importar" style={{ color: '#1e40af', fontWeight: 600, fontSize: 14 }}>→ Importar planilha da SED</a>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 20 }}>
            <Card label="Total Alunos" val={total} cor="#1e40af" />
            <Card label="Ativos" val={ativos} cor="#16a34a" sub={`${((ativos / total) * 100).toFixed(0)}%`} />
            <Card label="Remanejados" val={rema} cor="#ea580c" />
            <Card label="Baixas" val={baixas} cor="#dc2626" />
            <Card label="Bolsa Família" val={bolsa} cor="#16a34a" sub={`${((bolsa / total) * 100).toFixed(0)}%`} />
            <Card label="Deficiência" val={comDefi} cor="#9333ea" />
            <Card label="⚠️ Alertas" val={alertas.length} cor={alertas.length > 0 ? '#dc2626' : '#94a3b8'} sub="≥25% faltas" />
          </div>

          {alertas.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 10 }}>
                ⚠️ Frequência abaixo de 75% — {MESES_FULL[mes - 1]} ({alertas.length} alunos)
              </h2>
              <div style={{ display: 'grid', gap: 6 }}>
                {alertas.slice(0, 25).map(a => {
                  const f = faltasMap.get(a.id) ?? 0;
                  const turma = turmas.find(t => t.id === a.turmaId);
                  const freq = ((dl - f) / dl * 100).toFixed(0);
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{a.nome}</span>
                        {a.bolsa_familia && <span style={{ marginLeft: 6, fontSize: 11, color: '#16a34a', fontWeight: 700 }}>BF</span>}
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{turma?.nome} · {turma?.professora}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'right' }}>
                        <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>{f} faltas</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: Number(freq) < 75 ? '#dc2626' : '#ea580c' }}>{freq}%</span>
                      </div>
                    </div>
                  );
                })}
                {alertas.length > 25 && (
                  <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
                    + mais {alertas.length - 25} alunos — acesse a página Faltas para ver por turma
                  </p>
                )}
              </div>
            </div>
          )}

          <div style={{ background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ background: '#1e40af', color: 'white', padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 110px 44px 44px 44px 56px', gap: 8, fontSize: 12, fontWeight: 700 }}>
              <span>Turma</span>
              <span>Professora</span>
              <span style={{ textAlign: 'center' }}>Total</span>
              <span style={{ textAlign: 'center' }}>Ativos</span>
              <span style={{ textAlign: 'center' }}>Faltas</span>
              <span style={{ textAlign: 'center' }}>Freq.</span>
            </div>
            {loadingFaltas ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Carregando faltas...</div>
            ) : (
              statsPorTurma.map((t, i) => (
                <div key={t.id} style={{
                  padding: '9px 14px', display: 'grid', gridTemplateColumns: '1fr 110px 44px 44px 44px 56px',
                  gap: 8, alignItems: 'center', borderBottom: '1px solid #f1f5f9',
                  background: i % 2 === 0 ? 'white' : '#f8fafc',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.nome}</span>
                  <span style={{ fontSize: 12, color: '#475569' }}>{t.professora || '—'}</span>
                  <span style={{ textAlign: 'center', fontSize: 13 }}>{t.total}</span>
                  <span style={{ textAlign: 'center', fontSize: 13 }}>{t.ativos}</span>
                  <span style={{ textAlign: 'center', fontSize: 13, color: t.faltas > 0 ? '#dc2626' : '#94a3b8', fontWeight: t.faltas > 0 ? 700 : 400 }}>{t.faltas}</span>
                  <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.freq >= 85 ? '#16a34a' : t.freq >= 75 ? '#ea580c' : '#dc2626' }}>
                    {t.freq.toFixed(0)}%
                  </span>
                </div>
              ))
            )}
            <div style={{ padding: '10px 14px', background: '#f8fafc', fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>{statsPorTurma.length} turmas</span>
              <span>{total} alunos · {faltas.reduce((s, f) => s + (f.faltas ?? 0), 0)} faltas em {MESES_FULL[mes - 1]}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
