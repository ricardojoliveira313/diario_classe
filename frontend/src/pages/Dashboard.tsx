import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, MESES_ABR, MESES, DIAS_LETIVOS, getDiasLetivos, input, row, sortTurmasPedagogico, isInfantilTurma } from '../styles';
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
      .then(([t, a]) => { setTurmas(sortTurmasPedagogico(t)); setAlunos(a); setLoading(false); });
  }, []);

  useEffect(() => {
    setLoadingFaltas(true);
    api.getFaltasMes(mes, ano).then(f => { setFaltas(f); setLoadingFaltas(false); });
  }, [mes, ano]);

  if (loading) return <Loading />;

  // isAtivo: ATIVO ou sem situação definida (null/vazio) = ativo na escola
  const isAtivo = (a: any) => !a.situacao || a.situacao === 'ATIVO';

  const total = alunos.length;
  const ativos = alunos.filter(isAtivo).length;
  const baixas = alunos.filter(a => ['BXTR', 'TRAN', 'N COM'].includes(a.situacao)).length;
  const rema   = alunos.filter(a => a.situacao === 'REMA').length;
  const bolsa  = alunos.filter(a => a.bolsa_familia && isAtivo(a)).length;
  const dl = getDiasLetivos(mes, ano);
  const turmaMap = new Map(turmas.map(t => [t.id, t]));
  // Contagem sem dupla-contagem (mesmo RA em turma regular + AEE):
  // Registo AEE pode ter deficiência vazia → verifica deficiência no registo regular.
  const rasComDefiDash = new Set(
    alunos.filter(a => isAtivo(a) && a.deficiencia).map(a => a.ra ? String(a.ra) : a.id)
  );
  const rasEmAEEDash = new Set(
    alunos.filter(a => isAtivo(a) && turmaMap.get(a.turmaId)?.tipo === 'AEE' && a.ra)
      .map(a => String(a.ra))
  );
  const comDefiAEE     = [...rasEmAEEDash].filter(ra => rasComDefiDash.has(ra)).length;
  const comDefiRegular = [...rasComDefiDash].filter(ra => !rasEmAEEDash.has(ra)).length;

  const faltasMap = new Map<string, number>(faltas.map(f => [f.alunoId, f.faltas ?? 0]));
  const alertas = alunos.filter(a => {
    const t = turmaMap.get(a.turmaId);
    const threshold = isInfantilTurma(t?.nome) ? 0.4 : 0.25;
    return (faltasMap.get(a.id) ?? 0) >= Math.ceil(dl * threshold) && isAtivo(a);
  });

  const statsPorTurma = turmas.map(t => {
    const alunosTurma = alunos.filter(a => a.turmaId === t.id);
    const faltasTurma = faltas.filter(f => f.turmaId === t.id);
    const totalF = faltasTurma.reduce((s, f) => s + (f.faltas ?? 0), 0);
    const ativosTurma = alunosTurma.filter(a => a.situacao === 'ATIVO').length;
    const dlTotal = dl * ativosTurma;
    const freq = dlTotal > 0 ? (dlTotal - totalF) / dlTotal * 100 : 100;
    return { id: t.id, nome: t.nome, professora: t.professora, total: alunosTurma.length, ativos: ativosTurma, faltas: totalF, freq };
  }).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.text }}>📊 Dashboard</h1>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 20 }}>
            <StatCard label="Total Alunos" val={total} color={theme.primary} />
            <StatCard label="Ativos" val={ativos} color={theme.success} sub={`${((ativos / total) * 100).toFixed(0)}%`} />
            <StatCard label="Remanejados" val={rema} color={theme.orange} />
            <StatCard label="Baixas" val={baixas} color={theme.danger} />
            <StatCard label="Bolsa Família" val={bolsa} color={theme.success} sub={`${((bolsa / total) * 100).toFixed(0)}%`} />
            <StatCard label="🏫 Defi. Regular" val={comDefiRegular} color={theme.purple} sub="Ensino regular" />
            <StatCard label="🎯 Defi. AEE" val={comDefiAEE} color="#8b5cf6" sub="Sala de recursos" />
            <StatCard label="⚠️ Alertas" val={alertas.length} color={alertas.length > 0 ? theme.danger : theme.textMuted} sub="Inf: <60% · Fund: <75%" />
          </div>

          {alertas.length > 0 && (
            <div style={{ background: theme.dangerLight, border: `1px solid ${theme.danger}`, borderRadius: theme.radiusMd, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.danger }}>
                  ⚠️ Alunos com frequência baixa — {MESES[mes - 1]} ({alertas.length} alunos)
                </h2>
                <span style={{ fontSize: 11, color: theme.textSecondary }}>Infantil &lt;60% · Fundamental &lt;75%</span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                  {alertas.slice(0, 25).map(a => {
                  const f = faltasMap.get(a.id) ?? 0;
                  const turma = turmas.find(t => t.id === a.turmaId);
                  const freqMin = isInfantilTurma(turma?.nome) ? 60 : 75;
                  const freq = ((dl - f) / dl * 100).toFixed(0);
                  return (
                    <div key={a.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: theme.card, padding: '12px 16px', borderRadius: theme.radius, fontSize: 14,
                      boxShadow: theme.shadowSm,
                    }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{a.nome}</span>
                        {a.bolsa_familia && <span style={{ marginLeft: 6, fontSize: 12, color: theme.success, fontWeight: 700 }}>BF</span>}
                        <div style={{ fontSize: 12, color: theme.textMuted }}>{turma?.nome} · {turma?.professora || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 18, alignItems: 'center', textAlign: 'right' }}>
                        <div>
                          <div style={{ color: theme.danger, fontWeight: 700, fontSize: 17 }}>{f}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>faltas</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 17, color: Number(freq) < freqMin ? theme.danger : theme.orange }}>{freq}%</div>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>freq.</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {alertas.length > 25 && (
                  <p style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 4 }}>
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
              color: 'white', padding: '12px 16px',
              display: 'grid', gridTemplateColumns: '1fr 120px 48px 48px 48px 60px',
              gap: 8, fontSize: 13, fontWeight: 700,
            }}>
              <span>Turma</span><span>Professora</span>
              <span style={{ textAlign: 'center' }}>Total</span><span style={{ textAlign: 'center' }}>Ativos</span>
              <span style={{ textAlign: 'center' }}>Faltas</span><span style={{ textAlign: 'center' }}>Freq.</span>
            </div>
            {loadingFaltas ? (
              <Loading text="Carregando faltas..." />
            ) : (
              statsPorTurma.map((t, i) => (
                <div key={t.id} style={row(i, { gridTemplateColumns: '1fr 120px 48px 48px 48px 60px', gap: 8 })}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t.nome}</span>
                  <span style={{ fontSize: 13, color: theme.textSecondary }}>{t.professora || '—'}</span>
                  <span style={{ textAlign: 'center', fontSize: 14 }}>{t.total}</span>
                  <span style={{ textAlign: 'center', fontSize: 14 }}>{t.ativos}</span>
                  <span style={{ textAlign: 'center', fontSize: 14, color: t.faltas > 0 ? theme.danger : theme.textMuted, fontWeight: t.faltas > 0 ? 700 : 400 }}>{t.faltas}</span>
                  <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: t.freq >= 85 ? theme.success : t.freq >= 75 ? theme.orange : theme.danger }}>
                    {t.freq.toFixed(0)}%
                  </span>
                </div>
              ))
            )}
            <div style={{ padding: '10px 16px', background: 'var(--footer-row)', fontSize: 13, color: theme.textSecondary, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.borderLight}` }}>
              <span>{statsPorTurma.length} turmas</span>
              <span>{total} alunos · {faltas.reduce((s, f) => s + (f.faltas ?? 0), 0)} faltas em {MESES[mes - 1]}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
