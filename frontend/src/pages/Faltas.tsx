import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, MESES, getDiasLetivos, SITUACAO_COR, SITUACAO_LABEL, row, card as cardStyle } from '../styles';
import { Loading, EmptyState, StatCard, Spinner } from '../components';
import { useAno } from '../AnoContext';

export default function Faltas() {
  const { ano } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [faltas, setFaltas] = useState<Record<string, number>>({});
  const [freqTextos, setFreqTextos] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); });
  }, []);

  useEffect(() => {
    if (!turmaId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([api.getAlunos(turmaId), api.getFaltas(turmaId, mes, ano)]).then(([al, fa]) => {
      setAlunos(al);
      const mapF: Record<string, number> = {};
      const mapT: Record<string, string> = {};
      fa.forEach((f: any) => { mapF[f.alunoId] = f.faltas; if (f.frequencia) mapT[f.alunoId] = f.frequencia; });
      setFaltas(mapF);
      setFreqTextos(mapT);
      setSaved(false);
      setLoading(false);
    });
  }, [turmaId, mes]);

  const setFalta = (alunoId: string, val: number) => {
    setFaltas(prev => ({ ...prev, [alunoId]: Math.max(0, val) }));
    setSaved(false);
  };

  const salvar = async () => {
    setSaving(true);
    const registros = alunos.map(a => ({
      alunoId: a.id, turmaId, mes, ano,
      faltas: faltas[a.id] ?? 0,
      frequencia: freqTextos[a.id] ?? '',
    }));
    await api.upsertFaltasBatch(registros);
    setSaving(false);
    setSaved(true);
  };

  const exportarExcel = () => {
    const turma = turmas.find(t => t.id === turmaId);
    const dados = alunos.map((a, i) => ({
      'Nº': a.numero || i + 1,
      'Nome do Aluno': a.nome,
      'RA': a.ra ?? '',
      'Situação': a.situacao ?? 'ATIVO',
      'Bolsa Família': a.bolsa_familia ? 'Sim' : 'Não',
      'Deficiência': a.deficiencia ?? '',
      'Faltas': faltas[a.id] ?? 0,
      'Dias Letivos': dl,
      'Frequência %': `${((dl - (faltas[a.id] ?? 0)) / dl * 100).toFixed(0)}%`,
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [{ wch: 4 }, { wch: 36 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, MESES[mes - 1].substring(0, 31));
    const nomeArquivo = `Faltas_${(turma?.nome ?? 'turma').replace(/[^A-Za-z0-9]/g, '_')}_${MESES[mes - 1]}_${ano}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  };

  const exportarPDF = () => {
    const turma = turmas.find(t => t.id === turmaId);
    const linhas = alunos.map((a, i) => {
      const f = faltas[a.id] ?? 0;
      const freq = ((dl - f) / dl * 100).toFixed(0);
      const alerta = f >= limiteAlerta ? ' ⚠️' : '';
      return `${String(a.numero || i + 1).padStart(2)} ${a.nome.padEnd(42)} ${String(f).padStart(2)} faltas   ${freq}%${alerta}`;
    });
    const conteudo = [
      '═══════════════════════════════════════════════════════════',
      `  DIÁRIO DE CLASSE — ${ano}`,
      `  Turma: ${turma?.nome ?? ''}`,
      `  Professora: ${turma?.professora ?? '—'}`,
      `  Mês: ${MESES[mes - 1]}   Dias letivos: ${dl}`,
      '═══════════════════════════════════════════════════════════',
      '',
      ` Nº  Nome                                       Faltas  Freq.`,
      '─────────────────────────────────────────────────────────────',
      ...linhas,
      '─────────────────────────────────────────────────────────────',
      `      Total de faltas: ${totalFaltas}   Frequência geral: ${freqGeral}%`,
      '',
      `  ⚠️ Alertas (≥${limiteAlerta} faltas / <75%): ${alertas.length} aluno(s)`,
    ].join('\n');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Faltas ${turma?.nome} ${MESES[mes - 1]}</title>
<style>body{font-family:monospace;font-size:13px;margin:24px}pre{white-space:pre-wrap}
@media print{body{margin:8px}}</style></head>
<body><pre>${conteudo}</pre>
<script>setTimeout(()=>window.print(),400)</script></body></html>`);
    win.document.close();
  };

  const totalFaltas = alunos.reduce((s, a) => s + (faltas[a.id] ?? 0), 0);
  const dl = getDiasLetivos(mes, ano);
  const freqGeral = alunos.length > 0
    ? ((dl * alunos.length - totalFaltas) / (dl * alunos.length) * 100).toFixed(1)
    : '0.0';
  const limiteAlerta = Math.ceil(dl * 0.25);
  const alertas = alunos.filter(a => (faltas[a.id] ?? 0) >= limiteAlerta);

  const turma = turmas.find(t => t.id === turmaId);

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        padding: 16, marginBottom: 16, boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>📋 Lançamento de Faltas</h1>
          {alunos.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>
                📊 Excel
              </button>
              <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>
                📄 PDF
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Mês</label>
            <select style={input} value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        {turma?.professora && (
          <div style={{ marginTop: 8, fontSize: 13, color: theme.textSecondary }}>
            👩‍🏫 Prof. {turma.professora}
          </div>
        )}
      </div>

      {loading ? <Loading /> : alunos.length === 0 && (
        <EmptyState icon="📋" message={turmas.length === 0 ? 'Cadastre turmas e alunos primeiro.' : 'Nenhum aluno nesta turma.'} />
      )}

      {alunos.length > 0 && !loading && (
        <div className="fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard label="Dias Letivos" val={dl} cor={theme.primary} />
            <StatCard label="Total Faltas" val={totalFaltas} cor={theme.danger} />
            <StatCard label="Freq. Geral" val={`${freqGeral}%`} cor={Number(freqGeral) >= 85 ? theme.success : theme.danger} />
            <StatCard label="⚠️ Alertas" val={alertas.length} cor={alertas.length > 0 ? theme.danger : theme.textMuted} />
          </div>

          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10, textAlign: 'right' }}>
            ⚠️ Alerta: ≥ {limiteAlerta} faltas (&lt;75% frequência)
          </div>

          <div style={cardStyle({ marginBottom: 14 })}>
            <div style={{
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
              color: 'white', padding: '10px 16px',
              display: 'grid', gridTemplateColumns: '36px 1fr 28px 100px 55px',
              gap: 8, fontSize: 12, fontWeight: 600,
            }}>
              <span>#</span><span>Aluno</span><span title="Bolsa Família">💚</span>
              <span style={{ textAlign: 'center' }}>Faltas</span><span style={{ textAlign: 'center' }}>%</span>
            </div>
            {alunos.map((a, i) => {
              const faltasAluno = faltas[a.id] ?? 0;
              const emAlerta = faltasAluno >= limiteAlerta;
              const freq = (dl - faltasAluno) / dl * 100;
              return (
                <div key={a.id} style={{
                    ...row(i, { gridTemplateColumns: '36px 1fr 28px 100px 55px', gap: 8, padding: '9px 16px' }),
                  background: emAlerta ? '#fff1f2' : i % 2 === 0 ? 'white' : '#f8fafc',
                }}>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{a.numero || i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {emAlerta && <span title="Frequência abaixo de 75%">⚠️</span>}
                      {a.nome}
                    </div>
                    {a.situacao && a.situacao !== 'ATIVO' && (
                      <span style={{ fontSize: 10, color: SITUACAO_COR[a.situacao] ?? theme.textSecondary, fontWeight: 700 }}>
                        {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                      </span>
                    )}
                  </div>
                  <span style={{ textAlign: 'center', fontSize: 13 }}>{a.bolsa_familia ? '✅' : ''}</span>
                  {freqTextos[a.id] ? (
                    <span style={{
                      fontSize: 10, color: theme.purple, fontWeight: 700, textAlign: 'center',
                      padding: '2px 6px', background: theme.purpleLight, borderRadius: 4, display: 'inline-block',
                    }}>
                      {freqTextos[a.id]}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={() => setFalta(a.id, faltasAluno - 1)}
                        style={{
                          width: 30, height: 30, borderRadius: 8,
                          border: `1.5px solid ${theme.border}`,
                          background: '#f8fafc',
                          cursor: 'pointer', fontWeight: 700, fontSize: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease', color: theme.danger,
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = theme.dangerLight; e.currentTarget.style.borderColor = theme.danger; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = theme.border; }}>
                        −
                      </button>
                      <span style={{
                        width: 32, textAlign: 'center', fontWeight: 800, fontSize: 17,
                        color: faltasAluno > 0 ? theme.danger : theme.text,
                      }}>
                        {faltasAluno}
                      </span>
                      <button
                        onClick={() => setFalta(a.id, faltasAluno + 1)}
                        style={{
                          width: 30, height: 30, borderRadius: 8,
                          border: `1.5px solid ${theme.border}`,
                          background: '#f8fafc',
                          cursor: 'pointer', fontWeight: 700, fontSize: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease', color: theme.success,
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = theme.successLight; e.currentTarget.style.borderColor = theme.success; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = theme.border; }}>
                        +
                      </button>
                    </div>
                  )}
                  <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: freq >= 85 ? theme.success : freq >= 75 ? theme.orange : theme.danger }}>
                    {freq.toFixed(0)}%
                  </span>
                </div>
              );
            })}
            <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '40px 1fr 110px 55px', gap: 8, background: '#f8fafc', fontWeight: 700, borderTop: `1px solid ${theme.borderLight}` }}>
              <span></span><span style={{ fontSize: 13 }}>Total</span>
              <span style={{ textAlign: 'center', color: theme.danger, fontSize: 13 }}>{totalFaltas} faltas</span>
              <span style={{ textAlign: 'center', fontSize: 13 }}>{freqGeral}%</span>
            </div>
          </div>

          <button
            style={{
              ...btn('primary', { full: true }),
              padding: '13px', fontSize: 16,
              background: saved ? theme.success : theme.primary,
              transition: 'all 0.2s ease',
              borderRadius: theme.radiusMd,
            }}
            onClick={salvar} disabled={saving}
          >
            {saving ? <><Spinner size={18} /> Salvando...</> : saved ? '✅ Salvo!' : '💾 Salvar Faltas'}
          </button>
        </div>
      )}
    </div>
  );
}
