import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, MESES_ABR, MESES, DIAS_LETIVOS, getDiasLetivos, input, row, sortTurmasPedagogico, isInfantilTurma } from '../styles';
import { Loading, EmptyState, StatCard } from '../components';
import { useAno } from '../AnoContext';

type DetalheCard = 'bf' | 'defiRegular' | 'defiAEE' | null;

// ─── Painel de detalhe inline ──────────────────────────────────────────────
function PainelDetalhe({ titulo, cor, lista, colunas, onClose }: {
  titulo: string; cor: string;
  lista: any[];
  colunas: { label: string; key: string; render?: (v: any, row: any) => any }[];
  onClose: () => void;
}) {
  const [busca, setBusca] = useState('');
  const filtrado = busca.trim()
    ? lista.filter(r =>
        Object.values(r).some(v => String(v ?? '').toLowerCase().includes(busca.toLowerCase()))
      )
    : lista;

  return (
    <div style={{
      background: theme.card, borderRadius: theme.radiusMd,
      border: `2px solid ${cor}55`, marginBottom: 20,
      boxShadow: theme.shadow, animation: 'fadeIn 0.2s ease both',
    }}>
      {/* Cabeçalho */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: cor + '18',
        borderBottom: `1px solid ${cor}33`, borderRadius: `${theme.radiusMd} ${theme.radiusMd} 0 0`,
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15, color: cor }}>{titulo}</span>
          <span style={{ marginLeft: 8, fontSize: 13, color: theme.textSecondary }}>
            {filtrado.length} {busca ? `de ${lista.length}` : 'alunos'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar nome, RA..."
            style={{ ...input, width: 200, marginBottom: 0, fontSize: 13, padding: '6px 10px' }}
          />
          <button onClick={onClose} style={{
            background: theme.borderLight, border: 'none', borderRadius: theme.radius,
            padding: '6px 12px', cursor: 'pointer', fontSize: 18, color: theme.textSecondary,
          }}>×</button>
        </div>
      </div>

      {/* Cabeçalho da tabela */}
      <div style={{
        display: 'grid', gridTemplateColumns: colunas.map(() => '1fr').join(' '),
        padding: '8px 16px', background: cor + '10',
        borderBottom: `1px solid ${theme.borderLight}`,
        fontSize: 11, fontWeight: 700, color: theme.textSecondary,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {colunas.map(c => <span key={c.key}>{c.label}</span>)}
      </div>

      {/* Linhas */}
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {filtrado.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 14 }}>
            Nenhum resultado
          </div>
        ) : (
          filtrado.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: colunas.map(() => '1fr').join(' '),
              padding: '9px 16px', fontSize: 13,
              background: i % 2 === 0 ? 'transparent' : theme.bg,
              borderBottom: `1px solid ${theme.borderLight}`,
            }}>
              {colunas.map(c => (
                <span key={c.key} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.render ? c.render(r[c.key], r) : (r[c.key] || '—')}
                </span>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Rodapé */}
      <div style={{
        padding: '8px 16px', fontSize: 12, color: theme.textMuted,
        borderTop: `1px solid ${theme.borderLight}`,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Total: <strong>{lista.length}</strong></span>
        <button onClick={() => {
          const csv = [colunas.map(c => c.label).join(';'),
            ...lista.map(r => colunas.map(c => String(r[c.key] ?? '')).join(';'))
          ].join('\n');
          const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url;
          a.download = titulo.replace(/[^\w]/g, '_') + '.csv'; a.click();
        }} style={{
          background: cor + '22', border: `1px solid ${cor}55`, borderRadius: theme.radius,
          padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: cor, fontWeight: 600,
        }}>⬇ Exportar CSV</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { ano } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [faltas, setFaltas] = useState<any[]>([]);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [loadingFaltas, setLoadingFaltas] = useState(false);
  const [detalhe, setDetalhe] = useState<DetalheCard>(null);

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

  // Contagem sem dupla-contagem (mesmo RA em turma regular + AEE)
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

  // ─── Listas para os painéis de detalhe ───────────────────────────────────

  // Bolsa Família: alunos ATIVOS com BF, exclui duplicatas AEE (usa só o registo regular)
  const listaBF = alunos
    .filter(a => a.bolsa_familia && isAtivo(a) && turmaMap.get(a.turmaId)?.tipo !== 'AEE')
    .map(a => ({
      nome: a.nome,
      ra: a.ra || '—',
      nis: a.nis || '—',
      turma: turmaMap.get(a.turmaId)?.nome || '—',
      professora: turmaMap.get(a.turmaId)?.professora || '—',
      situacao: a.situacao || 'ATIVO',
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Para defi, mapas RA → dado útil
  const raToDefi = new Map<string, string>();
  const raToRegular = new Map<string, any>(); // RA → registro turma regular
  const raToAEE    = new Map<string, any>(); // RA → registro turma AEE
  for (const a of alunos) {
    if (!isAtivo(a)) continue;
    const ra = a.ra ? String(a.ra) : null;
    if (!ra) continue;
    if (a.deficiencia) raToDefi.set(ra, a.deficiencia);
    if (turmaMap.get(a.turmaId)?.tipo === 'AEE') raToAEE.set(ra, a);
    else raToRegular.set(ra, a);
  }

  // Defi Regular: têm deficiência mas NÃO estão em AEE
  const listaDefiRegular = [...rasComDefiDash]
    .filter(ra => !rasEmAEEDash.has(ra))
    .map(ra => {
      const a = raToRegular.get(ra) ?? alunos.find(x => isAtivo(x) && x.ra && String(x.ra) === ra);
      if (!a) return null;
      return {
        nome: a.nome,
        ra: ra,
        deficiencia: a.deficiencia || raToDefi.get(ra) || '—',
        turma: turmaMap.get(a.turmaId)?.nome || '—',
        professora: turmaMap.get(a.turmaId)?.professora || '—',
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  // Defi AEE: têm deficiência E estão matriculados na sala de recursos
  const listaDefiAEE = [...rasEmAEEDash]
    .filter(ra => rasComDefiDash.has(ra))
    .map(ra => {
      const aeeRec = raToAEE.get(ra);
      const regRec = raToRegular.get(ra);
      if (!aeeRec && !regRec) return null;
      const rec = regRec ?? aeeRec;
      return {
        nome: rec.nome,
        ra,
        deficiencia: raToDefi.get(ra) || '—',
        turmaRegular: regRec ? (turmaMap.get(regRec.turmaId)?.nome || '—') : '—',
        turmaAEE: aeeRec ? (turmaMap.get(aeeRec.turmaId)?.nome || '—') : '—',
        professoraAEE: aeeRec ? (turmaMap.get(aeeRec.turmaId)?.professora || '—') : '—',
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  const toggleDetalhe = (card: DetalheCard) =>
    setDetalhe(prev => prev === card ? null : card);

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      {/* INDICADOR DE VERSÃO — remover depois de confirmar deploy */}
      <div style={{ background: '#16a34a', color: 'white', padding: '6px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12, fontWeight: 700 }}>
        ✅ Build 2026-05-27 v3 — cards clicáveis activos
      </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
            <StatCard label="Total Alunos" val={total} color={theme.primary} />
            <StatCard label="Ativos" val={ativos} color={theme.success} sub={`${((ativos / total) * 100).toFixed(0)}%`} />
            <StatCard label="Remanejados" val={rema} color={theme.orange} />
            <StatCard label="Baixas" val={baixas} color={theme.danger} />
            <StatCard
              label="💚 Bolsa Família" val={bolsa} color={theme.success}
              sub={`${((bolsa / total) * 100).toFixed(0)}%`}
              onClick={() => toggleDetalhe('bf')}
              active={detalhe === 'bf'}
            />
            <StatCard
              label="🏫 Defi. Regular" val={comDefiRegular} color={theme.purple}
              sub="Ensino regular"
              onClick={() => toggleDetalhe('defiRegular')}
              active={detalhe === 'defiRegular'}
            />
            <StatCard
              label="🎯 Defi. AEE" val={comDefiAEE} color="#8b5cf6"
              sub="Sala de recursos"
              onClick={() => toggleDetalhe('defiAEE')}
              active={detalhe === 'defiAEE'}
            />
            <StatCard label="⚠️ Alertas" val={alertas.length} color={alertas.length > 0 ? theme.danger : theme.textMuted} sub="Inf: <60% · Fund: <75%" />
          </div>

          {/* ─── Painéis de detalhe ─────────────────────────────────────── */}
          {detalhe === 'bf' && (
            <PainelDetalhe
              titulo="💚 Alunos com Bolsa Família (ativos)"
              cor={theme.success}
              lista={listaBF}
              onClose={() => setDetalhe(null)}
              colunas={[
                { label: 'Nome', key: 'nome' },
                { label: 'RA', key: 'ra' },
                { label: 'NIS', key: 'nis' },
                { label: 'Turma', key: 'turma' },
                { label: 'Professora', key: 'professora' },
              ]}
            />
          )}

          {detalhe === 'defiRegular' && (
            <PainelDetalhe
              titulo="🏫 Alunos com Deficiência — Ensino Regular"
              cor={theme.purple}
              lista={listaDefiRegular as any[]}
              onClose={() => setDetalhe(null)}
              colunas={[
                { label: 'Nome', key: 'nome' },
                { label: 'RA', key: 'ra' },
                { label: 'Deficiência', key: 'deficiencia' },
                { label: 'Turma', key: 'turma' },
                { label: 'Professora', key: 'professora' },
              ]}
            />
          )}

          {detalhe === 'defiAEE' && (
            <PainelDetalhe
              titulo="🎯 Alunos com Deficiência — Sala de Recursos (AEE)"
              cor="#8b5cf6"
              lista={listaDefiAEE as any[]}
              onClose={() => setDetalhe(null)}
              colunas={[
                { label: 'Nome', key: 'nome' },
                { label: 'RA', key: 'ra' },
                { label: 'Deficiência', key: 'deficiencia' },
                { label: 'Turma Regular', key: 'turmaRegular' },
                { label: 'Sala de Recursos', key: 'turmaAEE' },
                { label: 'Prof. AEE', key: 'professoraAEE' },
              ]}
            />
          )}

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
