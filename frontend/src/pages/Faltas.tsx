import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, MESES, DIAS_LETIVOS, SITUACAO_COR, SITUACAO_LABEL } from '../styles';
import { Loading, EmptyState, StatCard, Spinner } from '../components';

type Status = 'P' | 'F' | 'J' | 'A';
const CICLO: Status[] = ['P', 'F', 'J', 'A'];
const ST_BG: Record<Status, string> = { P: '#dcfce7', F: '#fee2e2', J: '#ffedd5', A: '#ede9fe' };
const ST_COR: Record<Status, string> = { P: '#16a34a', F: '#dc2626', J: '#ea580c', A: '#7c3aed' };
const ST_LABEL: Record<Status, string> = { P: 'Presença', F: 'Falta', J: 'Justificado', A: 'Atestado médico' };

const initDias = (n: number): Status[] => Array(n).fill('P') as Status[];
const encodeDias = (d: Status[]) => 'DIAS:' + d.join('');
const decodeDias = (freq: string, n: number): Status[] => {
  if (freq?.startsWith('DIAS:')) {
    const chars = freq.slice(5).split('');
    return Array(n).fill('P').map((_, i) =>
      CICLO.includes(chars[i] as Status) ? (chars[i] as Status) : 'P'
    ) as Status[];
  }
  return initDias(n);
};
const ct = (dias: Status[], tipo: Status) => dias.filter(d => d === tipo).length;

export default function Faltas() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano] = useState(2026);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [diasAluno, setDiasAluno] = useState<Record<string, Status[]>>({});
  const [statusTextos, setStatusTextos] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const numDias = DIAS_LETIVOS[mes] ?? 22;

  useEffect(() => {
    api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); });
  }, []);

  useEffect(() => {
    if (!turmaId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([api.getAlunos(turmaId), api.getFaltas(turmaId, mes, ano)]).then(([al, fa]) => {
      setAlunos(al);
      const mapDias: Record<string, Status[]> = {};
      const mapTextos: Record<string, string> = {};
      fa.forEach((f: any) => {
        if (f.frequencia?.startsWith('DIAS:')) {
          mapDias[f.alunoId] = decodeDias(f.frequencia, numDias);
        } else if (f.frequencia) {
          mapTextos[f.alunoId] = f.frequencia;
        }
      });
      al.forEach((a: any) => {
        if (!mapDias[a.id] && !mapTextos[a.id]) mapDias[a.id] = initDias(numDias);
      });
      setDiasAluno(mapDias);
      setStatusTextos(mapTextos);
      setSaved(false);
      setLoading(false);
    });
  }, [turmaId, mes]);

  const toggleDia = (alunoId: string, diaIdx: number) => {
    setDiasAluno(prev => {
      const dias = [...(prev[alunoId] ?? initDias(numDias))];
      const idx = CICLO.indexOf(dias[diaIdx]);
      dias[diaIdx] = CICLO[(idx + 1) % CICLO.length];
      return { ...prev, [alunoId]: dias };
    });
    setSaved(false);
  };

  const salvar = async () => {
    setSaving(true);
    const registros = alunos.map(a => {
      if (statusTextos[a.id]) {
        return { alunoId: a.id, turmaId, mes, ano, faltas: 0, frequencia: statusTextos[a.id] };
      }
      const dias = diasAluno[a.id] ?? initDias(numDias);
      return {
        alunoId: a.id, turmaId, mes, ano,
        faltas: ct(dias, 'F') + ct(dias, 'J') + ct(dias, 'A'),
        frequencia: encodeDias(dias),
      };
    });
    await api.upsertFaltasBatch(registros);
    setSaving(false);
    setSaved(true);
  };

  const totalF = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'F'), 0);
  const totalJ = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'J'), 0);
  const totalA = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'A'), 0);
  const totalP = alunos.reduce((s, a) => s + ct(diasAluno[a.id] ?? [], 'P'), 0);
  const totalAusencias = totalF + totalJ + totalA;
  const limiteAlerta = Math.ceil(numDias * 0.25);
  const freqGeral = alunos.length > 0
    ? ((numDias * alunos.length - totalAusencias) / (numDias * alunos.length) * 100).toFixed(1)
    : '0.0';
  const alertas = alunos.filter(a => {
    const dias = diasAluno[a.id] ?? [];
    return ct(dias, 'F') + ct(dias, 'J') + ct(dias, 'A') >= limiteAlerta;
  });
  const turma = turmas.find(t => t.id === turmaId);

  const exportarPDF = () => {
    const linhas = alunos.map((a, i) => {
      const dias = diasAluno[a.id] ?? initDias(numDias);
      const nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
      const ausencias = nF + nJ + nA;
      const freq = ((numDias - ausencias) / numDias * 100).toFixed(0);
      const alerta = ausencias >= limiteAlerta ? ' ⚠️' : '';
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      return `${String(a.numero || i + 1).padStart(2)} ${(a.nome + defi + bf).padEnd(44)}  F:${nF} J:${nJ} A:${nA}   ${freq}%${alerta}`;
    });
    const conteudo = [
      '══════════════════════════════════════════════════════════════',
      `  DIÁRIO DE CLASSE — ${ano}`,
      `  Turma: ${turma?.nome ?? ''}`,
      `  Professora: ${turma?.professora ?? '—'}`,
      `  Mês: ${MESES[mes - 1]}   Dias letivos: ${numDias}`,
      '══════════════════════════════════════════════════════════════',
      '',
      ` Nº  Nome                                          F    J    A   Freq.`,
      '──────────────────────────────────────────────────────────────',
      ...linhas,
      '──────────────────────────────────────────────────────────────',
      `      Totais:  F: ${totalF}   J: ${totalJ}   A: ${totalA}   Freq.: ${freqGeral}%`,
      '',
      `  ⚠️ Alertas (<75%): ${alertas.length} aluno(s)`,
      `  ♿ Alunos com deficiência: ${alunos.filter(a => a.deficiencia).length}`,
      `  💚 Bolsa Família: ${alunos.filter(a => a.bolsa_familia).length}`,
      '',
      `  Legenda: P = Presença   F = Falta   J = Justificado   A = Atestado médico`,
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

  const exportarExcel = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const dados = alunos.map((a, i) => {
      const dias = diasAluno[a.id] ?? initDias(numDias);
      const nP = ct(dias, 'P'), nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
      const row: any = {
        'Nº': a.numero || i + 1,
        'Nome do Aluno': a.nome,
        'RA': a.ra ?? '',
        'Situação': a.situacao ?? 'ATIVO',
        'Deficiência': a.deficiencia ?? '',
        'Bolsa Família': a.bolsa_familia ? 'Sim' : 'Não',
      };
      dias.forEach((s, d) => { row[`Dia ${d + 1}`] = s; });
      row['P'] = nP; row['F'] = nF; row['J'] = nJ; row['A'] = nA;
      row['Dias Letivos'] = numDias;
      row['Frequência %'] = `${((numDias - nF - nJ - nA) / numDias * 100).toFixed(0)}%`;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, MESES[mes - 1].substring(0, 31));
    XLSX.writeFile(wb, `Faltas_${(turmaObj?.nome ?? 'turma').replace(/[^A-Za-z0-9]/g, '_')}_${MESES[mes - 1]}_${ano}.xlsx`);
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      {/* Cabeçalho */}
      <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        padding: 18, marginBottom: 16, boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>📋 Lançamento de Faltas</h1>
          {alunos.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
              <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
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
          <div style={{ marginTop: 10, fontSize: 14, color: theme.textSecondary }}>
            👩‍🏫 Prof. {turma.professora}
          </div>
        )}
        {/* Legenda */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {(Object.keys(ST_LABEL) as Status[]).map(s => (
            <span key={s} style={{
              background: ST_BG[s], color: ST_COR[s], fontWeight: 700,
              padding: '3px 10px', borderRadius: 5, fontSize: 12,
              border: `1px solid ${ST_COR[s]}44`,
            }}>
              {s} = {ST_LABEL[s]}
            </span>
          ))}
          <span style={{ fontSize: 11, color: theme.textMuted }}>· Clique na célula para alternar</span>
        </div>
      </div>

      {loading ? <Loading /> : alunos.length === 0 && (
        <EmptyState icon="📋" message={turmas.length === 0 ? 'Cadastre turmas e alunos primeiro.' : 'Nenhum aluno nesta turma.'} />
      )}

      {alunos.length > 0 && !loading && (
        <div className="fade-in">
          {/* Estatísticas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, marginBottom: 14 }}>
            <StatCard label="Dias Letivos" val={numDias} color={theme.primary} />
            <StatCard label="Faltas (F)" val={totalF} color={ST_COR.F} />
            <StatCard label="Justif. (J)" val={totalJ} color={ST_COR.J} />
            <StatCard label="Atestados (A)" val={totalA} color={ST_COR.A} />
            <StatCard label="Freq. Geral" val={`${freqGeral}%`} color={Number(freqGeral) >= 85 ? theme.success : theme.danger} />
            <StatCard label="⚠️ Alertas" val={alertas.length} color={alertas.length > 0 ? theme.danger : theme.textMuted} />
          </div>

          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10, textAlign: 'right' }}>
            ⚠️ Alerta: ≥ {limiteAlerta} ausências (&lt;75% frequência)
          </div>

          {/* Grid de frequência */}
          <div style={{
            overflowX: 'auto',
            borderRadius: theme.radiusMd,
            boxShadow: theme.shadow,
            marginBottom: 14,
            border: `1px solid ${theme.borderLight}`,
          }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`, color: 'white' }}>
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: theme.primary,
                    padding: '10px 12px', textAlign: 'left',
                    fontSize: 12, fontWeight: 600, minWidth: 210,
                    borderRight: '2px solid rgba(255,255,255,0.25)',
                  }}>
                    # Aluno
                  </th>
                  {Array(numDias).fill(0).map((_, d) => (
                    <th key={d} style={{ width: 24, textAlign: 'center', fontSize: 10, padding: '8px 1px', fontWeight: 600 }}>
                      {d + 1}
                    </th>
                  ))}
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#bbf7d0', padding: '8px 2px', borderLeft: '2px solid rgba(255,255,255,0.25)' }}>P</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#fca5a5', padding: '8px 2px' }}>F</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#fdba74', padding: '8px 2px' }}>J</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#c4b5fd', padding: '8px 2px' }}>A</th>
                  <th style={{ width: 52, textAlign: 'center', fontSize: 11, padding: '8px 4px' }}>Freq.</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a, i) => {
                  const dias = diasAluno[a.id] ?? initDias(numDias);
                  const statusTxt = statusTextos[a.id];
                  const nP = ct(dias, 'P'), nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
                  const ausencias = nF + nJ + nA;
                  const emAlerta = !statusTxt && ausencias >= limiteAlerta;
                  const freq = ((numDias - ausencias) / numDias * 100).toFixed(0);
                  const rowBg = emAlerta ? '#fff1f2' : i % 2 === 0 ? 'var(--card)' : 'var(--bg)';
                  return (
                    <tr key={a.id} style={{ background: rowBg }}>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 1,
                        background: rowBg,
                        padding: '8px 12px',
                        borderRight: '2px solid var(--border-light)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontSize: 11, color: theme.textMuted, paddingTop: 2, minWidth: 18 }}>{a.numero || i + 1}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {emAlerta && <span title="Frequência abaixo de 75%">⚠️</span>}
                              {a.nome}
                            </div>
                            {a.situacao && a.situacao !== 'ATIVO' && (
                              <span style={{ fontSize: 10, color: SITUACAO_COR[a.situacao] ?? theme.textSecondary, fontWeight: 700, display: 'block' }}>
                                {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                              </span>
                            )}
                            {a.deficiencia && (
                              <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, display: 'block' }}>
                                ♿ {a.deficiencia}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {statusTxt ? (
                        <td colSpan={numDias + 5} style={{ textAlign: 'center', color: '#7c3aed', fontStyle: 'italic', fontSize: 12, padding: 8 }}>
                          {statusTxt}
                        </td>
                      ) : (
                        <>
                          {dias.map((status, d) => (
                            <td key={d}
                              onClick={() => toggleDia(a.id, d)}
                              title={`Dia ${d + 1}: ${ST_LABEL[status]} — clique para alternar`}
                              style={{
                                width: 24, textAlign: 'center', cursor: 'pointer',
                                background: ST_BG[status],
                                color: ST_COR[status],
                                fontWeight: 700, fontSize: 11,
                                padding: '7px 0',
                                borderLeft: '1px solid var(--border-light)',
                                userSelect: 'none',
                                transition: 'opacity 0.1s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                              {status}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', color: ST_COR.P, fontWeight: 700, fontSize: 13, padding: '0 2px', borderLeft: '2px solid var(--border-light)' }}>{nP}</td>
                          <td style={{ textAlign: 'center', color: nF > 0 ? ST_COR.F : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nF > 0 ? nF : '—'}</td>
                          <td style={{ textAlign: 'center', color: nJ > 0 ? ST_COR.J : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nJ > 0 ? nJ : '—'}</td>
                          <td style={{ textAlign: 'center', color: nA > 0 ? ST_COR.A : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nA > 0 ? nA : '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '0 4px', color: Number(freq) >= 85 ? ST_COR.P : Number(freq) >= 75 ? '#ea580c' : ST_COR.F }}>
                            {freq}%
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {/* Linha de totais */}
                <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--border-light)' }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    background: 'var(--bg)',
                    padding: '10px 12px', fontWeight: 700, fontSize: 13,
                    borderRight: '2px solid var(--border-light)',
                    color: theme.textSecondary,
                  }}>
                    Totais
                  </td>
                  <td colSpan={numDias} />
                  <td style={{ textAlign: 'center', color: ST_COR.P, fontWeight: 700, fontSize: 13, borderLeft: '2px solid var(--border-light)' }}>{totalP}</td>
                  <td style={{ textAlign: 'center', color: totalF > 0 ? ST_COR.F : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalF > 0 ? totalF : '—'}</td>
                  <td style={{ textAlign: 'center', color: totalJ > 0 ? ST_COR.J : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalJ > 0 ? totalJ : '—'}</td>
                  <td style={{ textAlign: 'center', color: totalA > 0 ? ST_COR.A : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalA > 0 ? totalA : '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '0 4px', color: Number(freqGeral) >= 85 ? ST_COR.P : theme.danger }}>{freqGeral}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            style={{
              ...btn('primary', { full: true }),
              padding: '14px', fontSize: 17,
              background: saved ? theme.success : theme.primary,
              transition: 'all 0.2s ease',
              borderRadius: theme.radiusMd,
            }}
            onClick={salvar} disabled={saving}
          >
            {saving ? <><Spinner size={20} /> Salvando...</> : saved ? '✅ Salvo!' : '💾 Salvar Faltas'}
          </button>
        </div>
      )}
    </div>
  );
}
