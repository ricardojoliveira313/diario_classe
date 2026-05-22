import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, MESES, DIAS_LETIVOS, SITUACAO_COR, SITUACAO_LABEL } from '../styles';
import { Loading, EmptyState, StatCard, Spinner } from '../components';
import { useTheme } from '../ThemeContext';
import { useAno } from '../AnoContext';

type Status = 'P' | 'F' | 'J' | 'A';
const CICLO: Status[] = ['P', 'F', 'J', 'A'];
const ST_LABEL: Record<Status, string> = { P: 'Presença', F: 'Falta', J: 'Justificado', A: 'Atestado médico' };

// Cores claras (light mode)
const ST_BG_LIGHT: Record<Status, string> = { P: '#dcfce7', F: '#fee2e2', J: '#ffedd5', A: '#ede9fe' };
const ST_COR_LIGHT: Record<Status, string> = { P: '#16a34a', F: '#dc2626', J: '#ea580c', A: '#7c3aed' };
// Cores escuras (dark mode) — fundo semi-transparente + texto mais brilhante
const ST_BG_DARK: Record<Status, string> = { P: 'rgba(74,222,128,0.13)', F: 'rgba(248,113,113,0.13)', J: 'rgba(251,146,60,0.13)', A: 'rgba(167,139,250,0.13)' };
const ST_COR_DARK: Record<Status, string> = { P: '#4ade80', F: '#f87171', J: '#fb923c', A: '#a78bfa' };

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
  const { theme: themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const ST_BG = isDark ? ST_BG_DARK : ST_BG_LIGHT;
  const ST_COR = isDark ? ST_COR_DARK : ST_COR_LIGHT;
  const { ano } = useAno();

  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
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

  // ── Folha de Frequência para OCR (lista simples A4 retrato) ─────────────────
  const exportarFolhaOCR = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];

    const linhas = alunos.map((a, i) => {
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      return `
      <tr>
        <td style="border:1px solid #555;padding:5px 6px;font-size:13px;text-align:center;width:30px;font-weight:700;">${String(a.numero || i + 1).padStart(2, '0')}</td>
        <td style="border:1px solid #555;padding:5px 8px;font-size:13px;">${a.nome}${defi}${bf}</td>
        <td style="border:2px solid #1e40af;padding:5px 4px;text-align:center;width:54px;font-size:22px;font-weight:900;"></td>
        <td style="border:2px solid #f59e0b;padding:5px 4px;text-align:center;width:54px;font-size:22px;font-weight:900;"></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Folha Frequência — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 6mm; font-size: 13px; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  @media print { @page { size: A4 portrait; margin: 7mm; } body { margin: 0; } }
</style>
</head>
<body>

<div style="text-align:center; margin-bottom:8px;">
  <div style="font-size:20px; font-weight:bold; letter-spacing:1px;">FOLHA DE FREQUÊNCIA</div>
  <div style="font-size:12px; font-weight:bold;">EMEIEF LUIZ GONZAGA</div>
</div>

<table style="border:none; margin-bottom:6px;">
  <tr>
    <td style="border:none; padding:2px 4px; font-size:12px;"><b>Prof(a):</b> ${turmaObj?.professora ?? '________________________________'}</td>
    <td style="border:none; padding:2px 4px; font-size:12px;"><b>Turma:</b> ${turmaObj?.nome ?? ''}</td>
    <td style="border:none; padding:2px 4px; font-size:14px; font-weight:bold; color:red; white-space:nowrap;">${nomeMes.toUpperCase()} / ${ano}</td>
  </tr>
</table>

<div style="font-size:11px; margin-bottom:5px; padding:4px 6px; background:#f1f5f9; border-radius:4px;">
  ✏️ <b>Instruções:</b> Escreva o número total de faltas do mês em cada coluna.
  &nbsp;&nbsp;
  <span style="color:#1e40af; font-weight:bold;">F = Faltas</span>
  &nbsp;&nbsp;
  <span style="color:#d97706; font-weight:bold;">J = Justificadas / Atestado</span>
  &nbsp;&nbsp;
  (0 = sem faltas)
</div>

<table>
  <thead>
    <tr style="background:#1e40af; color:white;">
      <th style="border:1px solid #1e40af; padding:7px 4px; width:30px; font-size:12px; text-align:center;">Nº</th>
      <th style="border:1px solid #1e40af; padding:7px 8px; font-size:12px; text-align:left;">NOME DO ALUNO</th>
      <th style="border:2px solid #93c5fd; padding:7px 4px; width:54px; font-size:13px; text-align:center; background:#1d4ed8;">F<br><span style="font-size:9px; font-weight:400;">Faltas</span></th>
      <th style="border:2px solid #fde68a; padding:7px 4px; width:54px; font-size:13px; text-align:center; background:#b45309;">J<br><span style="font-size:9px; font-weight:400;">Justif.</span></th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
</table>

<div style="margin-top:8mm; font-size:10px; color:#444;">
  <b>Total de dias letivos do mês:</b> ${numDias}
  &nbsp;&nbsp;&nbsp;
  <b>Alunos:</b> ${alunos.length}
</div>

<div style="margin-top:6mm; font-size:11px; display:flex; gap:20mm; flex-wrap:wrap;">
  <span>Assinatura do Professor(a): _________________________________</span>
  <span>Data: _____ / _____ / __________</span>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups no navegador para abrir a Folha.'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ── Diário Tradicional (grade com todos os dias do mês) ──────────────────────
  const exportarDiario = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const DIAS_FULL = [
      'Domingo','Segunda-Feira','Terça-Feira','Quarta-Feira',
      'Quinta-Feira','Sexta-Feira','Sábado',
    ];

    const diasCols = Array.from({ length: diasNoMes }, (_, d) => {
      const date = new Date(ano, mes - 1, d + 1);
      const dw = date.getDay(); // 0=Dom, 6=Sáb
      return { dia: d + 1, isWeekend: dw === 0 || dw === 6, nomeDia: DIAS_FULL[dw] };
    });

    const thDia = (bg: string) =>
      `border:1px solid #aaa;padding:0;font-size:7px;background:${bg};` +
      `writing-mode:vertical-rl;transform:rotate(180deg);height:54px;` +
      `text-align:center;vertical-align:bottom;min-width:19px;max-width:19px;`;

    const tdDia = (bg: string) =>
      `border:1px solid #aaa;padding:0;text-align:center;height:22px;` +
      `font-size:9px;background:${bg};min-width:19px;max-width:19px;`;

    const thExtra = (bg: string) =>
      `border:1px solid #aaa;padding:0;font-size:7.5px;font-weight:bold;` +
      `background:${bg};writing-mode:vertical-rl;transform:rotate(180deg);` +
      `height:54px;text-align:center;vertical-align:bottom;min-width:26px;max-width:26px;`;

    const tdExtra = (bg: string) =>
      `border:1px solid #aaa;padding:0;text-align:center;height:22px;` +
      `font-size:9px;background:${bg};min-width:26px;max-width:26px;`;

    const headerDias = diasCols.map(d =>
      `<th style="${thDia(d.isWeekend ? '#c8e6c9' : '#f5f5f5')}">${d.dia}/${mes < 10 ? '0' + mes : mes}<br>${d.nomeDia}</th>`
    ).join('');

    const alunosRows = alunos.map((a, i) => {
      const cells = diasCols.map(d =>
        `<td style="${tdDia(d.isWeekend ? '#c8e6c9' : '#fff')}"></td>`
      ).join('');
      const badges = (a.deficiencia ? ' ♿' : '') + (a.bolsa_familia ? ' 💚' : '');
      return `<tr>
        <td style="border:1px solid #aaa;padding:1px 3px;font-size:9px;text-align:center;width:26px;">${String(a.numero || i + 1).padStart(2, '0')}</td>
        <td style="border:1px solid #aaa;padding:1px 5px;font-size:9px;white-space:nowrap;min-width:145px;">${a.nome}${badges}</td>
        ${cells}
        <td style="${tdExtra('#ffcdd2')}"></td>
        <td style="${tdExtra('#c8e6c9')}"></td>
        <td style="${tdExtra('#fff9c4')}"></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Diário — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 4mm; font-size: 10px; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    @page { size: A4 landscape; margin: 5mm 4mm; }
    body { margin: 0; }
  }
</style>
</head>
<body>

<div style="text-align:center;margin-bottom:5px;">
  <div style="font-size:16px;font-weight:bold;letter-spacing:1px;">DIÁRIO</div>
  <div style="font-size:11px;font-weight:bold;">EMEIEF LUIZ GONZAGA</div>
</div>

<table style="margin-bottom:3px;border:none;">
  <tr>
    <td style="border:none;padding:1px 4px;font-size:9px;white-space:nowrap;"><b>Escola:</b> EMEIEF LUIZ GONZAGA</td>
    <td style="border:none;padding:1px 4px;font-size:9px;white-space:nowrap;"><b>Professor(a):</b> ${turmaObj?.professora ?? ''}</td>
    <td style="border:none;padding:1px 4px;font-size:9px;white-space:nowrap;"><b>Turma:</b> ${turmaObj?.nome ?? ''}</td>
    <td style="border:none;padding:1px 4px;font-size:12px;font-weight:bold;color:red;text-align:right;white-space:nowrap;">${nomeMes.toUpperCase()} — ${ano}</td>
  </tr>
</table>

<div style="font-size:9px;margin-bottom:3px;padding:2px 0;">
  <b>"C" = COMPARECIMENTOS &nbsp;&nbsp;&nbsp; "F" = FALTAS</b>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <span style="background:yellow;padding:1px 7px;font-weight:bold;border:1px solid #ccc;">J = FALTA JUSTIFICADA (ATESTADO)</span>
</div>

<table>
  <thead>
    <tr>
      <th style="border:1px solid #aaa;padding:2px;font-size:9px;text-align:center;width:26px;">Nº</th>
      <th style="border:1px solid #aaa;padding:2px;font-size:9px;text-align:left;min-width:145px;">NOME</th>
      ${headerDias}
      <th style="${thExtra('#ffcdd2')}">Total de faltas</th>
      <th style="${thExtra('#c8e6c9')}">Comparecimentos</th>
      <th style="${thExtra('#fff9c4')}">JUSTIFICADA (ATESTADO)</th>
    </tr>
  </thead>
  <tbody>
    ${alunosRows}
  </tbody>
</table>

<div style="margin-top:10mm;font-size:9px;display:flex;gap:25mm;flex-wrap:wrap;">
  <span>Assinatura do Professor(a): _________________________________</span>
  <span>Data: _____ / _____ / __________</span>
  <span>Assinatura da Coordenação: _________________________________</span>
</div>

<script>setTimeout(()=>window.print(),500);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups no navegador para abrir o Diário.'); return; }
    win.document.write(html);
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
          <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.text }}>📋 Lançamento de Faltas</h1>
          {alunos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={exportarFolhaOCR} style={btn('primary', { small: true, outline: true })} title="Folha simples (A4 retrato) para professor preencher número de faltas — fácil de fotografar">📋 Folha</button>
              <button onClick={exportarDiario} style={btn('warning', { small: true, outline: true })} title="Diário tradicional com todos os dias do mês">🖨️ Diário</button>
              <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
              <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
              {turmas.map(t => {
                // Se existem duas turmas com o mesmo nome (ex: duas "EJA I"), mostra a professora
                const duplicado = turmas.filter(x => x.nome === t.nome).length > 1;
                return (
                  <option key={t.id} value={t.id}>
                    {t.nome}{duplicado && t.professora ? ` — ${t.professora}` : ''}
                  </option>
                );
              })}
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
                  const rowBg = emAlerta ? 'var(--row-alerta)' : i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)';
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
                            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, display: 'flex', alignItems: 'center', gap: 4 }}>
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
                <tr style={{ background: 'var(--footer-row)', borderTop: '2px solid var(--border-light)' }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    background: 'var(--footer-row)',
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
