import { useEffect, useState } from 'react';
import { api } from '../api';
import { theme, MESES_ABR, MESES, getDiasLetivos, input, row, sortTurmasPedagogico, isInfantilTurma } from '../styles';
import { Loading, EmptyState, StatCard } from '../components';
import { useAno } from '../AnoContext';

type DetalheCard = 'bf' | 'defiRegular' | 'defiAEE' | null;

// ─── Modal de detalhe (overlay fixo, sempre visível) ──────────────────────
function ModalDetalhe({ titulo, cor, lista, colunas, onClose, nota }: {
  titulo: string; cor: string;
  lista: any[];
  colunas: { label: string; key: string }[];
  onClose: () => void;
  nota?: string;
}) {
  const [busca, setBusca] = useState('');
  const filtrado = busca.trim()
    ? lista.filter(r =>
        Object.values(r).some(v => String(v ?? '').toLowerCase().includes(busca.toLowerCase()))
      )
    : lista;

  return (
    // Overlay escurecido cobre tudo
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.15s ease both',
      }}
    >
      {/* Caixa do modal */}
      <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        width: '100%', maxWidth: 720,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        border: `2px solid ${cor}66`,
      }}>
        {/* Cabeçalho */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px', background: cor + '18',
          borderBottom: `1px solid ${cor}33`,
          borderRadius: `${theme.radiusMd} ${theme.radiusMd} 0 0`,
          flexShrink: 0,
        }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16, color: cor }}>{titulo}</span>
            <span style={{ marginLeft: 10, fontSize: 13, color: theme.textSecondary }}>
              {filtrado.length}{busca ? ` de ${lista.length}` : ''} aluno{lista.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="🔍 Buscar nome, RA..."
              style={{ ...input, width: 190, marginBottom: 0, fontSize: 13, padding: '6px 10px' }}
              autoFocus
            />
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, color: theme.textSecondary, lineHeight: 1, padding: '0 4px',
            }}>✕</button>
          </div>
        </div>

        {/* Cabeçalho da tabela */}
        <div style={{
          display: 'grid', gridTemplateColumns: colunas.map(() => '1fr').join(' '),
          padding: '8px 18px', background: cor + '0d',
          borderBottom: `1px solid ${theme.borderLight}`,
          fontSize: 11, fontWeight: 700, color: theme.textSecondary,
          textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
        }}>
          {colunas.map(c => <span key={c.key}>{c.label}</span>)}
        </div>

        {/* Linhas com scroll */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtrado.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: theme.textMuted, fontSize: 14 }}>
              {busca ? 'Nenhum resultado para a busca' : 'Nenhum aluno nesta categoria'}
            </div>
          ) : filtrado.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: colunas.map(() => '1fr').join(' '),
              padding: '9px 18px', fontSize: 13,
              background: i % 2 === 0 ? 'transparent' : theme.bg,
              borderBottom: `1px solid ${theme.borderLight}`,
            }}>
              {colunas.map(c => (
                <span key={c.key} style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: c.key === 'nome' ? 600 : 400,
                }}>
                  {r[c.key] || '—'}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '10px 18px', fontSize: 12, color: theme.textMuted,
          borderTop: `1px solid ${theme.borderLight}`,
          display: 'flex', flexDirection: 'column', gap: 4,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Total: <strong style={{ color: cor }}>{lista.length}</strong></span>
          <button onClick={() => {
            const csv = [colunas.map(c => c.label).join(';'),
              ...lista.map(r => colunas.map(c => String(r[c.key] ?? '')).join(';'))
            ].join('\n');
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = titulo.replace(/[^a-zA-Z0-9]/g, '_') + '.csv'; a.click();
          }} style={{
            background: cor + '18', border: `1px solid ${cor}55`, borderRadius: theme.radius,
            padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: cor, fontWeight: 700,
          }}>⬇ Exportar CSV</button>
          </div>
          {nota && (
            <span style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>{nota}</span>
          )}
        </div>
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
  const [modal, setModal] = useState<DetalheCard>(null);

  useEffect(() => {
    Promise.all([api.getTurmas(), api.getAllAlunos()])
      .then(([t, a]) => { setTurmas(sortTurmasPedagogico(t)); setAlunos(a); setLoading(false); });
  }, []);

  useEffect(() => {
    setLoadingFaltas(true);
    api.getFaltasMes(mes, ano).then(f => { setFaltas(f); setLoadingFaltas(false); });
  }, [mes, ano]);

  // Fecha modal com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) return <Loading />;

  const isAtivo = (a: any) => !a.situacao || a.situacao === 'ATIVO';
  // Detecta turma AEE pelo nome (robusto) — não depende do campo tipo estar preenchido
  const isAEETurma = (t: any) => t?.tipo === 'AEE' || /^AEE\b/i.test(t?.nome ?? '');

  const total  = alunos.length;
  const ativos = alunos.filter(isAtivo).length;
  const baixas = alunos.filter(a => ['BXTR', 'TRAN', 'N COM'].includes(a.situacao)).length;
  const rema   = alunos.filter(a => a.situacao === 'REMA').length;
  const bolsa  = alunos.filter(a => a.bolsa_familia && isAtivo(a)).length;
  const dl     = getDiasLetivos(mes, ano);
  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  const rasComDefi = new Set(
    alunos.filter(a => isAtivo(a) && a.deficiencia).map(a => a.ra ? String(a.ra) : a.id)
  );
  // Todos os alunos ativos em turmas AEE (sala de recursos) — com ou sem campo deficiencia preenchido
  const rasEmAEE = new Set(
    alunos.filter(a => isAtivo(a) && isAEETurma(turmaMap.get(a.turmaId)) && a.ra)
      .map(a => String(a.ra))
  );
  // Alunos em AEE sem RA (contados separadamente para não perder ninguém)
  const alunoAEESemRA = alunos.filter(a => isAtivo(a) && isAEETurma(turmaMap.get(a.turmaId)) && !a.ra);
  // "Sala de Recursos" = todos os ativos com deficiência (inclui os que perderam turmaId por exclusão em cascata)
  const comDefiAEE     = rasComDefi.size;
  // "Defi. c/ Laudo" = TODOS os alunos com deficiência
  const comDefiRegular = rasComDefi.size;

  // Breakdown de alunos NÃO-ativos matriculados em turmas AEE (para auditoria)
  const alunosAEEInativos = alunos.filter(a => !isAtivo(a) && isAEETurma(turmaMap.get(a.turmaId)));
  const situacoesAEEInativas: Record<string, number> = {};
  for (const a of alunosAEEInativos) {
    const sit = a.situacao || 'sem situação';
    situacoesAEEInativas[sit] = (situacoesAEEInativas[sit] || 0) + 1;
  }
  const notaAEE = alunosAEEInativos.length > 0
    ? `Excluídos ${alunosAEEInativos.length} inativos: ${Object.entries(situacoesAEEInativas).map(([k, v]) => `${v}×${k}`).join(', ')}`
    : 'Todos os matriculados na AEE estão ativos';

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

  // ─── Listas para os modais ───────────────────────────────────────────────
  const raToDefi    = new Map<string, string>();
  const raToRegular = new Map<string, any>();
  const raToAEE     = new Map<string, any>();
  for (const a of alunos) {
    if (!isAtivo(a) || !a.ra) continue;
    const ra = String(a.ra);
    if (a.deficiencia) raToDefi.set(ra, a.deficiencia);
    if (isAEETurma(turmaMap.get(a.turmaId))) raToAEE.set(ra, a);
    else raToRegular.set(ra, a);
  }

  const listaBF: any[] = alunos
    .filter(a => a.bolsa_familia && isAtivo(a) && !isAEETurma(turmaMap.get(a.turmaId)))
    .map(a => ({
      nome: a.nome,
      ra: a.ra || '—',
      nis: a.nis || '—',
      turma: turmaMap.get(a.turmaId)?.nome || '—',
      professora: turmaMap.get(a.turmaId)?.professora || '—',
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Defi. Regular lista todos os alunos com deficiência
  // Para alunos que também têm AEE, mostra a turma regular (não a AEE)
  const listaDefiRegular: any[] = [...rasComDefi]
    .map(ra => {
      // Prefere o registro da turma REGULAR; fallback para qualquer registro
      const a = raToRegular.get(ra) ?? raToAEE.get(ra) ?? alunos.find(x => isAtivo(x) && (x.ra ? String(x.ra) : x.id) === ra);
      if (!a) return null;
      const temAEE = rasEmAEE.has(ra);
      return {
        nome: a.nome, ra,
        deficiencia: raToDefi.get(ra) || a.deficiencia || '—',
        turma: raToRegular.has(ra)
          ? (turmaMap.get(raToRegular.get(ra)!.turmaId)?.nome || '—')
          : (turmaMap.get(a.turmaId)?.nome || '—'),
        professora: raToRegular.has(ra)
          ? (turmaMap.get(raToRegular.get(ra)!.turmaId)?.professora || '—')
          : (turmaMap.get(a.turmaId)?.professora || '—'),
        aee: temAEE ? '✅' : '—',
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  // Todos os alunos com deficiência (AEE) — inclui os sem turmaId por exclusão em cascata
  const listaDefiAEE: any[] = [
    ...[...rasComDefi].map(ra => {
      const aeeRec = raToAEE.get(ra);
      const regRec = raToRegular.get(ra);
      const rec = regRec ?? aeeRec ?? alunos.find(x => isAtivo(x) && (x.ra ? String(x.ra) : x.id) === ra);
      if (!rec) return null;
      return {
        nome: rec.nome, ra,
        deficiencia: raToDefi.get(ra) || aeeRec?.deficiencia || regRec?.deficiencia || rec.deficiencia || '—',
        turmaRegular: regRec ? (turmaMap.get(regRec.turmaId)?.nome || '—') : (rec.turmaId && !isAEETurma(turmaMap.get(rec.turmaId)) ? turmaMap.get(rec.turmaId)?.nome || '—' : '—'),
        turmaAEE: aeeRec ? (turmaMap.get(aeeRec.turmaId)?.nome || '—') : '—',
        professoraAEE: aeeRec ? (turmaMap.get(aeeRec.turmaId)?.professora || '—') : '—',
      };
    }),
    ...alunoAEESemRA.filter(a => !a.ra).map(a => ({
      nome: a.nome, ra: '—',
      deficiencia: a.deficiencia || '—',
      turmaRegular: '—',
      turmaAEE: turmaMap.get(a.turmaId)?.nome || '—',
      professoraAEE: turmaMap.get(a.turmaId)?.professora || '—',
    })),
  ]
    .filter(Boolean)
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>

      {/* ─── Modais (overlay fixo) ────────────────────────────── */}
      {modal === 'bf' && (
        <ModalDetalhe
          titulo="💚 Bolsa Família — alunos ativos"
          cor={theme.success}
          lista={listaBF}
          onClose={() => setModal(null)}
          colunas={[
            { label: 'Nome', key: 'nome' },
            { label: 'RA', key: 'ra' },
            { label: 'NIS', key: 'nis' },
            { label: 'Turma', key: 'turma' },
            { label: 'Professora', key: 'professora' },
          ]}
        />
      )}
      {modal === 'defiRegular' && (
        <ModalDetalhe
          titulo="🏫 Deficiência — Todos os alunos com laudo"
          cor={theme.purple}
          lista={listaDefiRegular}
          onClose={() => setModal(null)}
          colunas={[
            { label: 'Nome', key: 'nome' },
            { label: 'RA', key: 'ra' },
            { label: 'Deficiência', key: 'deficiencia' },
            { label: 'Turma Regular', key: 'turma' },
            { label: 'Professora', key: 'professora' },
            { label: 'AEE', key: 'aee' },
          ]}
        />
      )}
      {modal === 'defiAEE' && (
        <ModalDetalhe
          titulo="🎯 Sala de Recursos (AEE) — alunos ativos"
          cor="#8b5cf6"
          lista={listaDefiAEE}
          onClose={() => setModal(null)}
          nota={notaAEE}
          colunas={[
            { label: 'Nome', key: 'nome' },
            { label: 'RA', key: 'ra' },
            { label: 'Deficiência', key: 'deficiencia' },
            { label: 'Turma Regular', key: 'turmaRegular' },
            { label: 'Sala Recursos', key: 'turmaAEE' },
            { label: 'Prof. AEE', key: 'professoraAEE' },
          ]}
        />
      )}

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
            <StatCard label="Total Alunos"   val={total}   color={theme.primary} />
            <StatCard label="Ativos"         val={ativos}  color={theme.success} sub={`${((ativos/total)*100).toFixed(0)}%`} />
            <StatCard label="Remanejados"    val={rema}    color={theme.orange} />
            <StatCard label="Baixas"         val={baixas}  color={theme.danger} />
            <StatCard
              label="💚 Bolsa Família" val={bolsa} color={theme.success}
              sub={`${((bolsa/total)*100).toFixed(0)}% · toque para ver`}
              onClick={() => setModal('bf')}
              active={modal === 'bf'}
            />
            <StatCard
              label="🏫 Defi. c/ Laudo" val={comDefiRegular} color={theme.purple}
              sub="toque para ver"
              onClick={() => setModal('defiRegular')}
              active={modal === 'defiRegular'}
            />
            <StatCard
              label="🎯 AEE ativos" val={comDefiAEE} color="#8b5cf6"
              sub="toque para ver"
              onClick={() => setModal('defiAEE')}
              active={modal === 'defiAEE'}
            />
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
              <span style={{ textAlign: 'center' }}>Total</span>
              <span style={{ textAlign: 'center' }}>Ativos</span>
              <span style={{ textAlign: 'center' }}>Faltas</span>
              <span style={{ textAlign: 'center' }}>Freq.</span>
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
