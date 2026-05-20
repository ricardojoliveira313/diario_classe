import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';

const btn = { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 } as const;
const input = { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', marginBottom: 8 } as const;
const label = { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'block' } as const;

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_LETIVOS: Record<number, number> = {
  1: 4, 2: 13, 3: 22, 4: 18, 5: 20, 6: 21,
  7: 9, 8: 21, 9: 22, 10: 18, 11: 20, 12: 17,
};
const SITUACAO_COR: Record<string, string> = {
  REMA: '#ea580c', BXTR: '#9333ea', TRAN: '#0284c7', 'N COM': '#dc2626',
};
const SITUACAO_LABEL: Record<string, string> = {
  REMA: 'Remanejado', BXTR: 'Baixa Transf.', TRAN: 'Transferido', 'N COM': 'N. Compareceu',
};

export default function Faltas() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano] = useState(2026);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [faltas, setFaltas] = useState<Record<string, number>>({});
  const [freqTextos, setFreqTextos] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getTurmas().then(t => { setTurmas(t); if (t.length) setTurmaId(t[0].id); }); }, []);

  useEffect(() => {
    if (!turmaId) return;
    Promise.all([api.getAlunos(turmaId), api.getFaltas(turmaId, mes, ano)]).then(([al, fa]) => {
      setAlunos(al);
      const mapF: Record<string, number> = {};
      const mapT: Record<string, string> = {};
      fa.forEach((f: any) => { mapF[f.alunoId] = f.faltas; if (f.frequencia) mapT[f.alunoId] = f.frequencia; });
      setFaltas(mapF);
      setFreqTextos(mapT);
      setSaved(false);
    });
  }, [turmaId, mes]);

  // Opções de texto especial (igual ao SED)
  const FREQ_TEXTOS_ESPECIAIS = [
    'TRANSFERIDO(A)',
    'BAIXA TRANSFERÊNCIA',
    'REMANEJADO(A)',
    'BAIXA POR NÃO COMPARECIMENTO',
  ];

  const handleFreq = (alunoId: string, val: string) => {
    const num = parseInt(val);
    if (!isNaN(num)) {
      setFaltas(prev => ({ ...prev, [alunoId]: num }));
      setFreqTextos(prev => { const n = { ...prev }; delete n[alunoId]; return n; });
    } else {
      setFaltas(prev => ({ ...prev, [alunoId]: 0 }));
      setFreqTextos(prev => ({ ...prev, [alunoId]: val }));
    }
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
  const dl = DIAS_LETIVOS[mes] ?? 22;
  const freqGeral = alunos.length > 0
    ? ((dl * alunos.length - totalFaltas) / (dl * alunos.length) * 100).toFixed(1)
    : '0.0';
  const limiteAlerta = Math.ceil(dl * 0.25);
  const alertas = alunos.filter(a => (faltas[a.id] ?? 0) >= limiteAlerta);

  return (
    <div>
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Lançamento de Faltas</h1>
          {alunos.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportarExcel} style={{ ...btn, background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', fontSize: 12 }}>
                📊 Excel
              </button>
              <button onClick={exportarPDF} style={{ ...btn, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                📄 PDF
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={{ ...input, marginBottom: 0 }} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Mês</label>
            <select style={{ ...input, marginBottom: 0 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {alunos.length === 0 && (
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 32 }}>
          {turmas.length === 0 ? 'Cadastre turmas e alunos primeiro.' : 'Nenhum aluno nesta turma.'}
        </p>
      )}

      {alunos.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Dias Letivos', val: dl, cor: '#1e40af' },
              { label: 'Total Faltas', val: totalFaltas, cor: '#dc2626' },
              { label: 'Freq. Geral', val: `${freqGeral}%`, cor: Number(freqGeral) >= 85 ? '#16a34a' : '#dc2626' },
              { label: '⚠️ Alertas', val: alertas.length, cor: alertas.length > 0 ? '#dc2626' : '#94a3b8' },
            ].map(({ label: l, val, cor }) => (
              <div key={l} style={{ background: 'white', borderRadius: 8, padding: 10, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: 10, color: '#64748b' }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: cor }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textAlign: 'right' }}>
            ⚠️ Alerta: ≥ {limiteAlerta} faltas (menos de 75% de frequência)
          </div>

          <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 14 }}>
            <div style={{ background: '#1e40af', color: 'white', padding: '10px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 28px 190px 55px', gap: 8, fontSize: 12, fontWeight: 600 }}>
              <span>#</span><span>Aluno</span><span title="Bolsa Família">💚</span>
              <span style={{ textAlign: 'center' }}>Frequência</span><span style={{ textAlign: 'center' }}>%</span>
            </div>
            {alunos.map((a, i) => {
              const faltasAluno = faltas[a.id] ?? 0;
              const freqTxt = freqTextos[a.id] ?? '';
              const emAlerta = faltasAluno >= limiteAlerta && !freqTxt;
              const freq = freqTxt ? null : (dl - faltasAluno) / dl * 100;
              const selectVal = freqTxt || String(faltasAluno);
              return (
                <div key={a.id} style={{
                  padding: '8px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 28px 190px 55px',
                  gap: 8, alignItems: 'center', borderBottom: '1px solid #f1f5f9',
                  background: emAlerta ? '#fff1f2' : i % 2 === 0 ? 'white' : '#f8fafc',
                }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.numero || i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {emAlerta && <span title="Frequência abaixo de 75%">⚠️</span>}
                      {a.nome}
                    </div>
                    {a.deficiencia && (
                      <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>♿ {a.deficiencia}</span>
                    )}
                    {a.situacao && a.situacao !== 'ATIVO' && (
                      <span style={{ fontSize: 10, color: SITUACAO_COR[a.situacao] ?? '#64748b', fontWeight: 700, marginLeft: a.deficiencia ? 6 : 0 }}>
                        {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                      </span>
                    )}
                  </div>
                  <span style={{ textAlign: 'center', fontSize: 13 }}>{a.bolsa_familia ? '✅' : ''}</span>
                  <select
                    value={selectVal}
                    onChange={e => handleFreq(a.id, e.target.value)}
                    style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: `1px solid ${freqTxt ? '#a855f7' : faltasAluno > 0 ? '#fca5a5' : '#cbd5e1'}`, background: freqTxt ? '#f3e8ff' : faltasAluno > 0 ? '#fff1f2' : 'white', width: '100%', color: freqTxt ? '#7c3aed' : faltasAluno > 0 ? '#dc2626' : '#1e293b', fontWeight: freqTxt || faltasAluno > 0 ? 700 : 400 }}
                  >
                    <option value="0">Não há faltas no mês</option>
                    {Array.from({ length: dl }, (_, k) => k + 1).map(n => (
                      <option key={n} value={String(n)}>
                        {String(n).padStart(2, '0')} Falta{n > 1 ? 's' : ''} Injustificada{n > 1 ? 's' : ''}
                      </option>
                    ))}
                    <option disabled>──────────────────</option>
                    {FREQ_TEXTOS_ESPECIAIS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: freqTxt ? '#7c3aed' : freq !== null && freq >= 85 ? '#16a34a' : freq !== null && freq >= 75 ? '#ea580c' : '#dc2626' }}>
                    {freqTxt ? '—' : `${freq!.toFixed(0)}%`}
                  </span>
                </div>
              );
            })}
            <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '36px 1fr 28px 190px 55px', gap: 8, background: '#f8fafc', fontWeight: 700, borderTop: '1px solid #e2e8f0' }}>
              <span></span><span style={{ fontSize: 13 }}>Total</span><span></span>
              <span style={{ textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{totalFaltas} faltas</span>
              <span style={{ textAlign: 'center', fontSize: 13 }}>{freqGeral}%</span>
            </div>
          </div>

          <button
            style={{ ...btn, background: saved ? '#16a34a' : '#1e40af', color: 'white', width: '100%', padding: '13px', fontSize: 15 }}
            onClick={salvar} disabled={saving}
          >
            {saving ? 'Salvando...' : saved ? '✓ Salvo!' : '💾 Salvar Faltas'}
          </button>
        </>
      )}
    </div>
  );
}
