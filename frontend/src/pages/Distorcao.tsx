import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { useAno } from '../AnoContext';
import { theme, btn, input, label, card as cardStyle, row, SITUACAO_COR, SITUACAO_LABEL } from '../styles';
import { Loading, EmptyState, StatCard } from '../components';

function calcIdade(dataNasc: string, refDate: Date): number {
  if (!dataNasc) return 0;
  const parts = dataNasc.split('/');
  if (parts.length !== 3) return 0;
  const nasc = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  if (isNaN(nasc.getTime())) return 0;
  let age = refDate.getFullYear() - nasc.getFullYear();
  const m = refDate.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < nasc.getDate())) age--;
  return age;
}

function extractGrade(turmaNome: string): number | null {
  const m = turmaNome.match(/^(\d)/);
  return m ? parseInt(m[1]) : null;
}

function badgeDefasagem(anos: number) {
  const cor = anos >= 3 ? theme.danger : theme.warning;
  return (
    <span style={{
      background: cor + '20', color: cor, border: `1px solid ${cor}50`,
      borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: 12,
    }}>
      {anos} {anos === 1 ? 'ano' : 'anos'}
    </span>
  );
}

export default function Distorcao() {
  const { ano } = useAno();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('');
  const [filtroMin, setFiltroMin] = useState(2);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getTurmas(), api.getAllAlunos()])
      .then(([t, a]) => { setTurmas(t); setAlunos(a); setLoading(false); });
  }, []);

  const refDate = new Date(ano, 2, 31); // 31/03 — data de referência INEP
  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  const todos = alunos
    .filter(a => ['ATIVO', '', null, undefined].includes(a.situacao) || a.situacao === 'ATIVO')
    .map(a => {
      const turma = turmaMap.get(a.turmaId);
      const grade = turma ? extractGrade(turma.nome) : null;
      if (!grade || !a.data_nascimento) return null;
      const idade = calcIdade(a.data_nascimento, refDate);
      if (!idade) return null;
      const idadeEsperada = grade + 5;
      const defasagem = idade - idadeEsperada;
      return { ...a, turma, grade, idade, idadeEsperada, defasagem };
    })
    .filter(Boolean) as any[];

  const comDistorcao = todos.filter(a => a.defasagem >= filtroMin);

  const filtrados = (filtroTurma ? comDistorcao.filter(a => a.turmaId === filtroTurma) : comDistorcao)
    .sort((a, b) => {
      const t = (a.turma?.nome ?? '').localeCompare(b.turma?.nome ?? '');
      return t !== 0 ? t : a.nome.localeCompare(b.nome);
    });

  const totalAtivos = alunos.filter(a => a.situacao === 'ATIVO' || !a.situacao).length;
  const pct = totalAtivos > 0 ? ((comDistorcao.length / totalAtivos) * 100).toFixed(1) : '0.0';

  // Agrupamento por turma para stats
  const porTurma = turmas
    .map(t => ({
      nome: t.nome,
      professora: t.professora,
      total: alunos.filter(a => a.turmaId === t.id && (a.situacao === 'ATIVO' || !a.situacao)).length,
      distorcao: comDistorcao.filter(a => a.turmaId === t.id).length,
    }))
    .filter(t => t.distorcao > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    // Aba distorção
    const dadosDist = filtrados.map((a, i) => ({
      'Nº': i + 1,
      'Nome': a.nome,
      'RA': a.ra ?? '',
      'Data Nasc.': a.data_nascimento,
      'Idade': a.idade,
      'Turma': a.turma?.nome ?? '',
      'Professor(a)': a.turma?.professora ?? '',
      'Série': `${a.grade}º ano`,
      'Idade Esperada': a.idadeEsperada,
      'Defasagem (anos)': a.defasagem,
      'Deficiência': a.deficiencia ?? '',
      'Situação': SITUACAO_LABEL[a.situacao] ?? a.situacao ?? 'ATIVO',
    }));
    const wsDist = XLSX.utils.json_to_sheet(dadosDist);
    wsDist['!cols'] = [
      { wch: 4 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 7 },
      { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDist, 'Distorção');

    // Aba por turma
    const dadosTurma = porTurma.map(t => ({
      'Turma': t.nome,
      'Professor(a)': t.professora,
      'Total Ativos': t.total,
      'Com Distorção': t.distorcao,
      '% Distorção': t.total > 0 ? `${((t.distorcao / t.total) * 100).toFixed(1)}%` : '0.0%',
    }));
    const wsTurma = XLSX.utils.json_to_sheet(dadosTurma);
    wsTurma['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsTurma, 'Por Turma');

    // Aba resumo
    const dadosResumo = [
      ['RELATÓRIO DE DISTORÇÃO IDADE-SÉRIE', ''],
      ['Escola', 'EMEIEF Luiz Gonzaga - Santo André'],
      ['Ano letivo', ano],
      ['Data de referência', `31/03/${ano}`],
      ['Critério', '2 ou mais anos acima da idade esperada (INEP)'],
      ['', ''],
      ['Total de alunos ativos', totalAtivos],
      ['Alunos com distorção', comDistorcao.length],
      ['Percentual', `${pct}%`],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(dadosResumo);
    wsResumo['!cols'] = [{ wch: 28 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    XLSX.writeFile(wb, `Distorcao_Idade_Serie_${ano}.xlsx`);
  };

  const exportarPDF = () => {
    const linhas = filtrados.map((a, i) => {
      const defasStr = `${a.defasagem} anos`;
      return `${String(i + 1).padStart(3)}. ${a.nome.padEnd(44)} ${String(a.idade).padStart(3)} anos  ${(a.turma?.nome ?? '').padEnd(12)} Defas: ${defasStr}`;
    });

    const porTurmaLinhas = porTurma.map(t =>
      `  ${t.nome.padEnd(14)} ${t.professora?.padEnd(22) ?? '—'.padEnd(22)} ${String(t.distorcao).padStart(2)} aluno(s) c/ distorção`
    );

    const conteudo = [
      '═══════════════════════════════════════════════════════════════════',
      `  DISTORÇÃO IDADE-SÉRIE — ${ano}`,
      '  EMEIEF Luiz Gonzaga - Santo André',
      `  Data de referência: 31/03/${ano}   Critério: ≥ 2 anos de defasagem`,
      '═══════════════════════════════════════════════════════════════════',
      '',
      `  Total de alunos ativos: ${totalAtivos}`,
      `  Alunos com distorção: ${comDistorcao.length} (${pct}%)`,
      '',
      '─── ALUNOS COM DISTORÇÃO ──────────────────────────────────────────',
      '',
      ` Nº  Nome                                          Idade  Turma        Defasagem`,
      '───────────────────────────────────────────────────────────────────',
      ...linhas,
      '',
      '─── POR TURMA ─────────────────────────────────────────────────────',
      '',
      ...porTurmaLinhas,
      '',
      '─── NOTA ──────────────────────────────────────────────────────────',
      '  Critério INEP: aluno com 2 ou mais anos acima da idade esperada.',
      '  Idade esperada: 1º ano = 6 anos, 2º ano = 7 anos, ..., 5º ano = 10 anos.',
      '═══════════════════════════════════════════════════════════════════',
    ].join('\n');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Distorção Idade-Série ${ano}</title>
<style>body{font-family:monospace;font-size:12px;margin:24px}pre{white-space:pre-wrap}
@media print{body{margin:8px}}</style></head>
<body><pre>${conteudo}</pre>
<script>setTimeout(()=>window.print(),400)</script></body></html>`);
    win.document.close();
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      {/* Header */}
      <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        padding: 16, marginBottom: 16, boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>📐 Distorção Idade-Série</h1>
            <div style={{ fontSize: 12, color: theme.textMuted }}>
              Critério INEP: aluno com 2+ anos acima da idade esperada para a série · Ref: 31/03/{ano}
            </div>
          </div>
          {!loading && alunos.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
              <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
              <option value="">— Todas as turmas —</option>
              {turmas.filter(t => comDistorcao.some(a => a.turmaId === t.id)).map(t =>
                <option key={t.id} value={t.id}>{t.nome}</option>
              )}
            </select>
          </div>
          <div>
            <label style={label}>Defasagem mínima</label>
            <select style={input} value={filtroMin} onChange={e => setFiltroMin(Number(e.target.value))}>
              <option value={2}>2+ anos (padrão INEP)</option>
              <option value={3}>3+ anos</option>
              <option value={1}>1+ ano (todos)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? <Loading /> : alunos.length === 0 ? (
        <EmptyState icon="📥" message="Nenhum aluno importado ainda."
          action={{ label: 'Importar planilha', href: '/importar' }} />
      ) : (
        <div className="fade-in">
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <StatCard label="Alunos Ativos" val={totalAtivos} cor={theme.primary} />
            <StatCard label="Com Distorção" val={comDistorcao.length} cor={comDistorcao.length > 0 ? theme.danger : theme.textMuted} />
            <StatCard label="Percentual" val={`${pct}%`} cor={Number(pct) > 5 ? theme.danger : Number(pct) > 2 ? theme.warning : theme.success} />
            <StatCard label="Turmas Afetadas" val={porTurma.length} cor={theme.orange} />
          </div>

          {comDistorcao.length === 0 ? (
            <div style={{
              background: theme.successLight, border: `1px solid ${theme.success}`,
              borderRadius: theme.radiusMd, padding: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 700, color: theme.success, fontSize: 16 }}>Nenhuma distorção encontrada!</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>
                Todos os {totalAtivos} alunos ativos estão na faixa etária esperada para sua série.
              </div>
            </div>
          ) : (
            <>
              {/* Tabela de alunos */}
              <div style={cardStyle({ marginBottom: 16 })}>
                <div style={{
                  background: `linear-gradient(135deg, ${theme.danger}, ${theme.dangerHover})`,
                  color: 'white', padding: '10px 14px',
                  display: 'grid', gridTemplateColumns: '32px 1fr 80px 70px 90px 100px',
                  gap: 8, fontSize: 12, fontWeight: 700,
                }}>
                  <span>#</span>
                  <span>Aluno</span>
                  <span style={{ textAlign: 'center' }}>Nasc.</span>
                  <span style={{ textAlign: 'center' }}>Idade</span>
                  <span style={{ textAlign: 'center' }}>Turma</span>
                  <span style={{ textAlign: 'center' }}>Defasagem</span>
                </div>

                {filtrados.map((a, i) => (
                  <div key={a.id} style={row(i, {
                    gridTemplateColumns: '32px 1fr 80px 70px 90px 100px', gap: 8,
                    background: i % 2 === 0 ? 'var(--row-alerta)' : 'var(--row-even)',
                  })}>
                    <span style={{ fontSize: 12, color: theme.textMuted }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>
                        {a.turma?.professora || '—'}
                        {a.deficiencia ? ` · ♿ ${a.deficiencia}` : ''}
                      </div>
                    </div>
                    <span style={{ textAlign: 'center', fontSize: 12, color: theme.textSecondary }}>
                      {a.data_nascimento}
                    </span>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: theme.danger }}>{a.idade}</span>
                      <div style={{ fontSize: 10, color: theme.textMuted }}>anos</div>
                    </div>
                    <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: theme.primaryText }}>
                      {a.turma?.nome ?? '—'}
                    </span>
                    <div style={{ textAlign: 'center' }}>
                      {badgeDefasagem(a.defasagem)}
                      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>
                        esp: {a.idadeEsperada} anos
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ padding: '8px 14px', background: 'var(--footer-row)', borderTop: `1px solid ${theme.borderLight}`, fontSize: 12, color: theme.textSecondary }}>
                  <strong>{filtrados.length}</strong> aluno(s) com distorção de {filtroMin}+ anos
                </div>
              </div>

              {/* Por Turma */}
              {porTurma.length > 0 && (
                <div style={cardStyle({})}>
                  <div style={{
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
                    color: 'white', padding: '10px 14px',
                    display: 'grid', gridTemplateColumns: '1fr 140px 70px 80px 80px',
                    gap: 8, fontSize: 12, fontWeight: 700,
                  }}>
                    <span>Turma</span>
                    <span>Professor(a)</span>
                    <span style={{ textAlign: 'center' }}>Ativos</span>
                    <span style={{ textAlign: 'center' }}>Distorção</span>
                    <span style={{ textAlign: 'center' }}>%</span>
                  </div>
                  {porTurma.map((t, i) => {
                    const pctT = t.total > 0 ? (t.distorcao / t.total * 100).toFixed(1) : '0.0';
                    return (
                      <div key={t.nome} style={row(i, { gridTemplateColumns: '1fr 140px 70px 80px 80px', gap: 8 })}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{t.nome}</span>
                        <span style={{ fontSize: 12, color: theme.textSecondary }}>{t.professora || '—'}</span>
                        <span style={{ textAlign: 'center', fontSize: 13 }}>{t.total}</span>
                        <span style={{ textAlign: 'center', fontWeight: 700, color: theme.danger, fontSize: 13 }}>{t.distorcao}</span>
                        <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: Number(pctT) > 10 ? theme.danger : theme.warning }}>
                          {pctT}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
