import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, MESES_ABR, MESES, getDiasLetivos, input, row } from '../styles';
import { Loading, EmptyState, StatCard } from '../components';
import { useAno } from '../AnoContext';

export default function Dashboard() {
  const { ano } = useAno();
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
    api.getFaltasMes(mes, ano).then(f => { setFaltas(f); setLoadingFaltas(false); });
  }, [mes]);

  if (loading) return <Loading />;

  const total = alunos.length;
  const ativos = alunos.filter(a => a.situacao === 'ATIVO').length;
  const baixas = alunos.filter(a => ['BXTR', 'TRAN', 'N COM'].includes(a.situacao)).length;
  const rema = alunos.filter(a => a.situacao === 'REMA').length;
  const bolsa = alunos.filter(a => a.bolsa_familia).length;
  const comDefi = alunos.filter(a => a.deficiencia).length;
  const dl = getDiasLetivos(mes, ano);
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

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>📊 Dashboard</h1>
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          style={{ ...input, width: 'auto', marginBottom: 0 }}>
          {MESES_ABR.map((m, i) => <option key={i + 1} value={i + 1}>{m} {ano}</option>)}
        </select>
      </div>

      {total === 0 ? (
        <EmptyState icon="📥" message="Nenhum dado importado ainda."
          action={{ label: 'Importar planilha da SED', href: '/importar' }} />
      ) : (
        <div className="fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, marginBottom: 20 }}>
            <StatCard label="Total Alunos" val={total} cor={theme.primary} />
            <StatCard label="Ativos" val={ativos} cor={theme.success} sub={`${((ativos / total) * 100).toFixed(0)}%`} />
            <StatCard label="Remanejados" val={rema} cor={theme.orange} />
            <StatCard label="Baixas" val={baixas} cor={theme.danger} />
            <StatCard label="Bolsa Família" val={bolsa} cor={theme.success} sub={`${((bolsa / total) * 100).toFixed(0)}%`} />
            <StatCard label="Deficiência" val={comDefi} cor={theme.purple} />
            <StatCard label="⚠️ Alertas" val={alertas.length} cor={alertas.length > 0 ? theme.danger : theme.textMuted} sub="≥25% faltas" />
          </div>

          {alertas.length > 0 && (
            <div style={{ background: theme.dangerLight, border: `1px solid ${theme.danger}`, borderRadius: theme.radiusMd, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: theme.danger }}>
                  ⚠️ Frequência abaixo de 75% — {MESES[mes - 1]} ({alertas.length} alunos)
                </h2>
                <span style={{ fontSize: 12, color: theme.textSecondary }}>≥{limiteAlerta} faltas</span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {alertas.slice(0, 25).map(a => {
                  const f = faltasMap.get(a.id) ?? 0;
                  const turma = turmas.find(t => t.id === a.turmaId);
                  const freq = ((dl - f) / dl * 100).toFixed(0);
                  return (
                    <div key={a.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: theme.card, padding: '10px 14px', borderRadius: theme.radius, fontSize: 13,
                      boxShadow: theme.shadowSm,
                    }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{a.nome}</span>
                        {a.bolsa_familia && <span style={{ marginLeft: 6, fontSize: 11, color: theme.success, fontWeight: 700 }}>BF</span>}
                        <div style={{ fontSize: 11, color: theme.textMuted }}>{turma?.nome} · {turma?.professora}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', textAlign: 'right' }}>
                        <div>
                          <div style={{ color: theme.danger, fontWeight: 700, fontSize: 15 }}>{f}</div>
                          <div style={{ fontSize: 10, color: theme.textMuted }}>faltas</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: Number(freq) < 75 ? theme.danger : theme.orange }}>{freq}%</div>
                          <div style={{ fontSize: 10, color: theme.textMuted }}>freq.</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {alertas.length > 25 && (
                  <p style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 4 }}>
                    + mais {alertas.length - 25} alunos — acesse <a href="/faltas" style={{ fontWeight: 600 }}>Faltas</a> por turma
                  </p>
                )}
              </div>
            </div>
          )}

          <div style={{
            background: theme.card, borderRadius: theme.radiusMd, overflow: 'hidden',
            boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`,
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
              color: 'white', padding: '12px 14px',
              display: 'grid', gridTemplateColumns: '1fr 110px 44px 44px 44px 56px',
              gap: 8, fontSize: 12, fontWeight: 700,
            }}>
              <span>Turma</span><span>Professora</span>
              <span style={{ textAlign: 'center' }}>Total</span><span style={{ textAlign: 'center' }}>Ativos</span>
              <span style={{ textAlign: 'center' }}>Faltas</span><span style={{ textAlign: 'center' }}>Freq.</span>
            </div>
            {loadingFaltas ? (
              <Loading text="Carregando faltas..." />
            ) : (
              statsPorTurma.map((t, i) => (
                <div key={t.id} style={row(i, { gridTemplateColumns: '1fr 110px 44px 44px 44px 56px', gap: 8 })}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.nome}</span>
                  <span style={{ fontSize: 12, color: theme.textSecondary }}>{t.professora || '—'}</span>
                  <span style={{ textAlign: 'center', fontSize: 13 }}>{t.total}</span>
                  <span style={{ textAlign: 'center', fontSize: 13 }}>{t.ativos}</span>
                  <span style={{ textAlign: 'center', fontSize: 13, color: t.faltas > 0 ? theme.danger : theme.textMuted, fontWeight: t.faltas > 0 ? 700 : 400 }}>{t.faltas}</span>
                  <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.freq >= 85 ? theme.success : t.freq >= 75 ? theme.orange : theme.danger }}>
                    {t.freq.toFixed(0)}%
                  </span>
                </div>
              ))
            )}
            <div style={{ padding: '10px 14px', background: 'var(--footer-row)', fontSize: 12, color: theme.textSecondary, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.borderLight}` }}>
              <span>{statsPorTurma.length} turmas</span>
              <span>{total} alunos · {faltas.reduce((s, f) => s + (f.faltas ?? 0), 0)} faltas em {MESES[mes - 1]} {ano}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
