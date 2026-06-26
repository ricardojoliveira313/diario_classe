import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, MESES, SITUACAO_COR, SITUACAO_LABEL, getFeriado, isRecesso, isSabadoLetivo, sortTurmasPedagogico, isInfantilTurma } from '../styles';
import { Loading, EmptyState, StatCard, Spinner } from '../components';
import { useTheme } from '../ThemeContext';
import { useAno } from '../AnoContext';
import { useAuth } from '../AuthContext';

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

interface CalendarDay {
  dia: number;
  isWeekend: boolean;
  isSabadoLetivo: boolean;
  feriado: string | null;
  recesso: string | null;
  isEmenda: boolean;
  isLetivo: boolean;
  schoolIdx: number;
}

function buildCalendarDays(ano: number, mes: number, emendas: string[]): CalendarDay[] {
  const totalDias = new Date(ano, mes, 0).getDate();
  const result: CalendarDay[] = [];
  let schoolIdx = 0;
  for (let d = 1; d <= totalDias; d++) {
    const dw = new Date(ano, mes - 1, d).getDay();
    const weekend = dw === 0 || dw === 6;
    const sabLetivo = isSabadoLetivo(ano, mes, d);
    const feriado = getFeriado(ano, mes, d);
    const recesso = isRecesso(ano, mes, d);
    const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const emenda = emendas.includes(dataStr);
    const letivo = !feriado && !recesso && !emenda && (!weekend || sabLetivo);
    result.push({
      dia: d, isWeekend: weekend, isSabadoLetivo: sabLetivo,
      feriado, recesso, isEmenda: emenda, isLetivo: letivo,
      schoolIdx: letivo ? schoolIdx++ : -1,
    });
  }
  return result;
}

export default function Faltas() {
  const { theme: themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  const ST_BG = isDark ? ST_BG_DARK : ST_BG_LIGHT;
  const ST_COR = isDark ? ST_COR_DARK : ST_COR_LIGHT;
  const { ano } = useAno();
  const { role, turmaId: minhaTurmaId, podeEditarTodasFaltas } = useAuth();
  const podeEditar = role === 'admin' || !!minhaTurmaId || podeEditarTodasFaltas;

  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [diasAluno, setDiasAluno] = useState<Record<string, Status[]>>({});
  const [statusTextos, setStatusTextos] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBF, setShowBF] = useState(false);
  const [bfAlunos, setBfAlunos] = useState<any[]>([]);
  const [bfLoading, setBfLoading] = useState(false);
  const [bfFiltroSit, setBfFiltroSit] = useState('');

  const isMobile = window.innerWidth < 640;

  const EMENDAS_KEY = `emendas-${ano}`;
  const [emendas, setEmendas] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(EMENDAS_KEY) || '[]'); }
    catch { return []; }
  });
  const toggleEmenda = (dataStr: string) => {
    if (role !== 'admin') return;
    setEmendas(prev => {
      const next = prev.includes(dataStr)
        ? prev.filter(d => d !== dataStr)
        : [...prev, dataStr];
      localStorage.setItem(EMENDAS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const calDays = useMemo(() => buildCalendarDays(ano, mes, emendas), [ano, mes, emendas]);
  const numDias = useMemo(() => calDays.filter(d => d.isLetivo).length, [calDays]);

  useEffect(() => {
    api.getTurmas().then(t => {
      const s = sortTurmasPedagogico(t || []);
      if (minhaTurmaId && !podeEditarTodasFaltas) {
        const minhas = s.filter(x => x.id === minhaTurmaId);
        setTurmas(minhas);
        setTurmaId(minhaTurmaId);
      } else {
        setTurmas(s);
        if (s.length) setTurmaId(s[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!turmaId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([api.getAlunos(turmaId), api.getFaltas(turmaId, mes, ano)]).then(([al, fa]) => {
      // Ordena pelo NR oficial do PDF (numero); empate: ATIVO antes de não-ATIVO
      const sorted = [...al].sort((a: any, b: any) => {
        const diff = (a.numero || 9999) - (b.numero || 9999);
        if (diff !== 0) return diff;
        const aAtivo = !a.situacao || a.situacao === 'ATIVO';
        const bAtivo = !b.situacao || b.situacao === 'ATIVO';
        if (aAtivo && !bAtivo) return -1;
        if (!aAtivo && bAtivo) return 1;
        return 0;
      });
      // Para duplicatas de NR (ex: TRAN e ATIVO com mesmo numero), o segundo fica sem NR
      const vistos = new Set<number>();
      setAlunos(sorted.map((a: any) => {
        if (a.numero && !vistos.has(a.numero)) { vistos.add(a.numero); return a; }
        return { ...a, _nrDisplay: 0 };
      }));
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
    if (!podeEditar) return;
    setDiasAluno(prev => {
      const dias = [...(prev[alunoId] ?? initDias(numDias))];
      const idx = CICLO.indexOf(dias[diaIdx]);
      dias[diaIdx] = CICLO[(idx + 1) % CICLO.length];
      return { ...prev, [alunoId]: dias };
    });
    setSaved(false);
  };

  const salvar = async () => {
    if (!podeEditar) return;
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
  const turma = turmas.find(t => t.id === turmaId);
  const isInfantil = isInfantilTurma(turma?.nome);
  const thresholdPct = isInfantil ? 0.4 : 0.25;
  const limiteAlerta = Math.ceil(numDias * thresholdPct);
  const freqGeral = alunos.length > 0
    ? ((numDias * alunos.length - totalAusencias) / (numDias * alunos.length) * 100).toFixed(1)
    : '0.0';
  // Freq. c/ atestado: conta só F+J como ausência (A = presença justificada)
  const freqGeralAt = alunos.length > 0
    ? ((numDias * alunos.length - (totalF + totalJ)) / (numDias * alunos.length) * 100).toFixed(1)
    : '0.0';
  const alertas = alunos.filter(a => {
    const dias = diasAluno[a.id] ?? [];
    return ct(dias, 'F') + ct(dias, 'J') + ct(dias, 'A') >= limiteAlerta;
  });

  const abrirBolsaFamilia = async () => {
    setShowBF(true);
    setBfLoading(true);
    const todos = await api.getAllAlunos();
    const bf = todos
      .filter((a: any) => a.bolsa_familia)
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
    setBfAlunos(bf);
    setBfLoading(false);
  };

  const exportarBFExcel = () => {
    const turmaNomeMap = new Map(turmas.map((t: any) => [t.id, t.nome]));
    const toRow = (a: any) => ({
      'Nome': a.nome,
      'RA': a.ra ?? '',
      'NIS': a.nis ?? '',
      'Turma': turmaNomeMap.get(a.turmaId) ?? '',
      'Situação': SITUACAO_LABEL[a.situacao ?? 'ATIVO'] ?? (a.situacao ?? 'ATIVO'),
      'Data Movimentação': a.data_movimentacao ?? '',
      'Deficiência': a.deficiencia ?? '',
    });
    const ativos = bfAlunos.filter(a => !a.situacao || a.situacao === 'ATIVO');
    const saidas = bfAlunos.filter(a => a.situacao && a.situacao !== 'ATIVO');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ativos.map(toRow)), 'Ativos');
    if (saidas.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(saidas.map(toRow)), 'Transferidos e Outros');
    XLSX.writeFile(wb, `BolsaFamilia_${ano}.xlsx`);
  };

  const exportarPDF = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];

    const linhas = alunos.map((a, i) => {
      const dias = diasAluno[a.id] ?? initDias(numDias);
      const nF = ct(dias, 'F'), nJ = ct(dias, 'J'), nA = ct(dias, 'A');
      const ausencias = nF + nJ + nA;
      const freqNum = numDias > 0 ? ((numDias - ausencias) / numDias * 100) : 100;
      const freq = freqNum.toFixed(0);
      const alerta = ausencias >= limiteAlerta;
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      const rowBg = alerta ? '#fff1f2' : i % 2 === 0 ? '#ffffff' : '#f8fafc';
      const freqColor = alerta ? '#dc2626' : freqNum >= 90 ? '#16a34a' : '#d97706';
      return `<tr style="background:${rowBg};">
      <td style="border:1px solid #333;padding:5px 6px;text-align:center;font-size:12px;font-weight:700;width:28px;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
      <td style="border:1px solid #333;padding:5px 8px;font-size:12px;${alerta ? 'font-weight:700;' : ''}">${a.nome}${defi}${bf}${alerta ? ' <span style="color:#dc2626;font-size:10px;">⚠️</span>' : ''}</td>
      <td style="border:1px solid #333;padding:5px 4px;text-align:center;font-size:12px;color:#dc2626;font-weight:${nF > 0 ? '700' : '400'};">${nF}</td>
      <td style="border:1px solid #333;padding:5px 4px;text-align:center;font-size:12px;color:#d97706;font-weight:${nJ > 0 ? '700' : '400'};">${nJ}</td>
      <td style="border:1px solid #333;padding:5px 4px;text-align:center;font-size:12px;color:#7c3aed;font-weight:${nA > 0 ? '700' : '400'};">${nA}</td>
      <td style="border:1px solid #333;padding:5px 6px;text-align:center;font-size:12px;font-weight:700;color:${freqColor};">${freq}%</td>
    </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Frequência — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 8mm; font-size: 12px; color: #0f172a; background: #fff; }
  table { border-collapse: collapse; width: 100%; }
  @media print {
    @page { size: A4 portrait; margin: 10mm 8mm; }
    body { margin: 0; }
    .no-print { display: none; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>

<div style="text-align:center; border-bottom:3px solid #1e40af; padding-bottom:8px; margin-bottom:10px;">
  <div style="font-size:11px; color:#64748b; font-weight:600; letter-spacing:1px;">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
  <div style="font-size:18px; font-weight:900; color:#1e40af; letter-spacing:1px; margin:2px 0;">EMEIEF LUIZ GONZAGA</div>
  <div style="font-size:11px; color:#475569;">Diário de Frequência — Ano Letivo ${ano}</div>
</div>

<table style="margin-bottom:10px; border:none;">
  <tr>
    <td style="border:none; padding:3px 6px; font-size:12px;">
      <span style="font-weight:700; color:#475569;">TURMA:</span>
      <span style="font-size:14px; font-weight:900; color:#1e40af; margin-left:6px;">${turmaObj?.nome ?? '—'}</span>
    </td>
    <td style="border:none; padding:3px 6px; font-size:12px;">
      <span style="font-weight:700; color:#475569;">PROFESSORA:</span>
      <span style="font-weight:600; margin-left:6px;">${turmaObj?.professora ?? '—'}</span>
    </td>
    <td style="border:none; padding:3px 6px; font-size:13px; text-align:right; white-space:nowrap;">
      <span style="font-weight:900; color:#dc2626; font-size:15px;">${nomeMes.toUpperCase()} / ${ano}</span>
    </td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b;">
      <span style="font-weight:600;">Total de alunos:</span> ${alunos.length}
    </td>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b;">
      <span style="font-weight:600;">Dias letivos do mês:</span> ${numDias}
    </td>
    <td style="border:none; padding:2px 6px; font-size:11px; color:#64748b; text-align:right;">
      <span style="font-weight:600;">Frequência geral:</span>
      <span style="font-weight:900; color:${parseFloat(freqGeral) >= 75 ? '#16a34a' : '#dc2626'}; font-size:13px; margin-left:4px;">${freqGeral}%</span>
    </td>
  </tr>
</table>

<table>
  <thead>
    <tr style="background:#1e40af; color:#ffffff;">
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:28px; font-size:11px; text-align:center;">Nº</th>
      <th style="border:1px solid #1e3a8a; padding:7px 8px; font-size:11px; text-align:left;">NOME DO ALUNO</th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#dc2626;">F<br><span style="font-size:8px;font-weight:400;">Faltas</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#d97706;">J<br><span style="font-size:8px;font-weight:400;">Justif.</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 4px; width:40px; font-size:11px; text-align:center; background:#7c3aed;">A<br><span style="font-size:8px;font-weight:400;">Atestado</span></th>
      <th style="border:1px solid #1e3a8a; padding:7px 6px; width:52px; font-size:11px; text-align:center;">FREQ.<br><span style="font-size:8px;font-weight:400;">%</span></th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
  <tfoot>
    <tr style="background:#f1f5f9; font-weight:700;">
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:11px;" colspan="2">TOTAIS DO MÊS</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:#dc2626;">${totalF}</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:#d97706;">${totalJ}</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:#7c3aed;">${totalA}</td>
      <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:13px; color:${parseFloat(freqGeral) >= 75 ? '#16a34a' : '#dc2626'};">${freqGeral}%</td>
    </tr>
  </tfoot>
</table>

<div style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
  ${alertas.length > 0 ? `<div style="padding:5px 10px; background:#fff1f2; border:1px solid #fca5a5; border-radius:4px; font-size:11px; color:#dc2626; font-weight:700;">⚠️ Alertas frequência &lt;75%: ${alertas.length} aluno(s)</div>` : `<div style="padding:5px 10px; background:#f0fdf4; border:1px solid #86efac; border-radius:4px; font-size:11px; color:#16a34a; font-weight:700;">✅ Nenhum aluno com frequência crítica</div>`}
  ${alunos.filter((a: any) => a.deficiencia).length > 0 ? `<div style="padding:5px 10px; background:#f0f9ff; border:1px solid #7dd3fc; border-radius:4px; font-size:11px; color:#0369a1;">♿ Alunos com deficiência: ${alunos.filter((a: any) => a.deficiencia).length}</div>` : ''}
  ${alunos.filter((a: any) => a.bolsa_familia).length > 0 ? `<div style="padding:5px 10px; background:#f0fdf4; border:1px solid #86efac; border-radius:4px; font-size:11px; color:#15803d;">💚 Bolsa Família: ${alunos.filter((a: any) => a.bolsa_familia).length} aluno(s)</div>` : ''}
</div>

<div style="margin-top:6px; font-size:10px; color:#64748b; padding:4px 0; border-top:1px solid #e2e8f0;">
  <span style="font-weight:700;">Legenda:</span>
  <span style="margin-left:8px; color:#dc2626; font-weight:700;">F = Falta</span>
  <span style="margin-left:10px; color:#d97706; font-weight:700;">J = Justificado</span>
  <span style="margin-left:10px; color:#7c3aed; font-weight:700;">A = Atestado médico</span>
  <span style="margin-left:10px;">⚠️ = Frequência abaixo de 75%</span>
  <span style="margin-left:10px;">♿ = Deficiência</span>
  <span style="margin-left:10px;">💚 = Bolsa Família</span>
</div>

<div style="margin-top:14mm; display:flex; gap:20mm; flex-wrap:wrap; font-size:11px;">
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:200px;">Assinatura do(a) Professor(a)</div>
  </div>
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:140px;">Data: _____ / _____ / _______</div>
  </div>
  <div>
    <div style="border-top:1px solid #000; padding-top:3px; min-width:200px;">Assinatura da Coordenação</div>
  </div>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups no navegador para imprimir.'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ── Folha OCR — Grade de Dias com X (A4 paisagem, células VAZIAS) ─────
  const exportarGradeDias = () => {
    const turmaObj = turmas.find(t => t.id === turmaId);
    const nomeMes = MESES[mes - 1];
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const diasCols = Array.from({ length: diasNoMes }, (_, i) => {
      const date = new Date(ano, mes - 1, i + 1);
      const dw = date.getDay();
      return { dia: i + 1, isWeekend: dw === 0 || dw === 6 };
    });

    const headerDias = diasCols.map(d =>
      `<th style="border:1px solid #333;padding:0;width:22px;min-width:22px;max-width:22px;height:28px;text-align:center;vertical-align:middle;font-size:8px;font-weight:700;background:${d.isWeekend ? '#555555' : '#1e40af'};color:#ffffff;">${d.dia}</th>`
    ).join('');

    const linhas = alunos.map((a, i) => {
      const rowBg = i % 2 === 0 ? '#ffffff' : '#eeeeee';
      const celulas = diasCols.map(d =>
        `<td style="border:1px solid #333;width:22px;min-width:22px;max-width:22px;height:22px;background:${d.isWeekend ? '#aaaaaa' : rowBg};"></td>`
      ).join('');
      const defi = a.deficiencia ? ' ♿' : '';
      const bf = a.bolsa_familia ? ' 💚' : '';
      return `<tr>
        <td style="border:1px solid #333;padding:2px 4px;text-align:center;width:26px;font-size:11px;font-weight:700;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
        <td style="border:1px solid #333;padding:2px 6px;font-size:10px;white-space:nowrap;">${a.nome}${defi}${bf}</td>
        ${celulas}
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Folha OCR — ${turmaObj?.nome ?? ''} — ${nomeMes} ${ano}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 6mm; color: #000; background: #fff; }
  table { border-collapse: collapse; }
  @media print {
    @page { size: A4 landscape; margin: 7mm 6mm; }
    body { margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>

<div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:5px;margin-bottom:7px;">
  <div style="font-size:9px;color:#64748b;font-weight:600;letter-spacing:0.5px;">PREFEITURA MUNICIPAL DE SANTO ANDRÉ</div>
  <div style="font-size:15px;font-weight:900;color:#1e40af;margin:1px 0;">EMEIEF LUIZ GONZAGA</div>
  <div style="font-size:9px;color:#475569;font-weight:600;">Folha de Frequência Diária — ${nomeMes.toUpperCase()} / ${ano}</div>
</div>

<table style="width:100%;border:none;margin-bottom:6px;">
  <tr>
    <td style="border:none;font-size:10px;padding:1px 0;">
      <b style="color:#475569;">TURMA:</b>
      <span style="font-size:12px;font-weight:900;color:#1e40af;margin-left:5px;">${turmaObj?.nome ?? '—'}</span>
    </td>
    <td style="border:none;font-size:10px;padding:1px 0;text-align:center;">
      <b style="color:#475569;">PROFESSORA:</b>
      <span style="font-weight:700;margin-left:5px;">${turmaObj?.professora ?? '—'}</span>
    </td>
    <td style="border:none;font-size:10px;padding:1px 0;text-align:right;">
      <b style="color:#475569;">Alunos:</b> ${alunos.length}
      &nbsp;&nbsp;
      <b style="color:#475569;">Dias letivos:</b> ${numDias}
    </td>
  </tr>
</table>

<div style="font-size:9px;padding:3px 8px;background:#fef3c7;border:1px solid #fbbf24;border-radius:3px;margin-bottom:5px;color:#92400e;font-weight:700;">
  ✏️ Escreva <strong>X</strong> no dia em que o aluno <strong>FALTOU</strong>. Deixe em <strong>BRANCO</strong> se veio à aula. Fins de semana (cinza escuro) não preencher.
</div>

<table style="width:100%;">
  <thead>
    <tr>
      <th style="border:1px solid #333;padding:2px;width:26px;font-size:9px;text-align:center;background:#0f172a;color:#ffffff;">Nº</th>
      <th style="border:1px solid #333;padding:2px 6px;font-size:9px;text-align:left;background:#0f172a;color:#ffffff;min-width:130px;">NOME DO ALUNO</th>
      ${headerDias}
    </tr>
  </thead>
  <tbody>
    ${linhas}
  </tbody>
</table>

<div style="margin-top:5mm;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:4mm;">
  <div style="font-size:9px;color:#475569;">
    <b>Legenda:</b>
    <span style="margin-left:6px;background:#fee2e2;padding:1px 6px;border-radius:2px;font-weight:900;color:#dc2626;font-size:11px;">X</span> = Falta
    &nbsp;&nbsp;
    <span style="background:#f1f5f9;padding:1px 10px;border-radius:2px;border:1px solid #cbd5e1;font-size:10px;">  </span> = Presente (vazio)
    &nbsp;&nbsp;
    <span style="background:#334155;padding:1px 8px;border-radius:2px;font-size:10px;color:#94a3b8;">■</span> = Fim de semana (não preencher)
  </div>
  <div style="font-size:10px;display:flex;gap:12mm;">
    <span>Assinatura do(a) Professor(a): _________________________</span>
    <span>Data: ___/___/______</span>
  </div>
</div>

<script>setTimeout(()=>window.print(),400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para abrir a folha.'); return; }
    win.document.write(html);
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
        <td style="border:1px solid #555;padding:5px 6px;font-size:13px;text-align:center;width:30px;font-weight:700;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
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
        <td style="border:1px solid #aaa;padding:1px 3px;font-size:9px;text-align:center;width:26px;">${String(a.numero || (i + 1)).padStart(2, '0')}</td>
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
        'Nº': a.numero || (i + 1),
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={abrirBolsaFamilia} style={btn('success', { small: true })} title="Ver todos os alunos com Bolsa Família de todas as turmas (qualquer situação)">💚 Bolsa Família</button>
            {alunos.length > 0 && (
              <>
                <button onClick={exportarFolhaOCR} style={btn('primary', { small: true, outline: true })} title="Folha simples (A4 retrato) para professor preencher número de faltas — fácil de fotografar">📋 Folha</button>
                <button onClick={exportarGradeDias} style={btn('primary', { small: true, outline: true })} title="Grade com X por dia (A4 paisagem) para fotografar e ler com OCR">📅 Grade OCR</button>
                <button onClick={exportarDiario} style={btn('warning', { small: true, outline: true })} title="Diário tradicional com todos os dias do mês">🖨️ Diário</button>
                <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
                <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)} disabled={!!minhaTurmaId && !podeEditarTodasFaltas}>
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
            {minhaTurmaId && (
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                🔒 Acesso restrito à sua turma
              </div>
            )}
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

      {/* ── Modal Bolsa Família ─────────────────────────────────────────── */}
      {showBF && (
        <div
          onClick={() => setShowBF(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.card, borderRadius: theme.radiusMd,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              border: `1px solid ${theme.borderLight}`,
              width: '100%', maxWidth: 800,
              padding: 24,
            }}
          >
            {/* Cabeçalho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#15803d', margin: 0 }}>
                  💚 Alunos com Bolsa Família
                </h2>
                {!bfLoading && (
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                    {bfAlunos.length} total · {bfAlunos.filter(a => !a.situacao || a.situacao === 'ATIVO').length} ativos ·{' '}
                    <span style={{ color: '#0284c7', fontWeight: 700 }}>
                      {bfAlunos.filter(a => a.situacao === 'TRAN').length} transferidos
                    </span>
                    {' '}— todas as turmas
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!bfLoading && bfAlunos.length > 0 && (
                  <button onClick={exportarBFExcel} style={btn('success', { small: true, outline: true })} title="Excel com duas abas: Ativos e Transferidos/Outros">
                    📊 Excel (2 abas)
                  </button>
                )}
                <button onClick={() => setShowBF(false)} style={btn('danger', { small: true, outline: true })}>✕ Fechar</button>
              </div>
            </div>

            {/* Filtro por situação */}
            {!bfLoading && bfAlunos.length > 0 && (() => {
              const situacoes = Array.from(new Set(bfAlunos.map(a => a.situacao ?? 'ATIVO'))).sort();
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  <button
                    onClick={() => setBfFiltroSit('')}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${bfFiltroSit === '' ? '#15803d' : theme.borderLight}`,
                      background: bfFiltroSit === '' ? '#15803d' : 'transparent',
                      color: bfFiltroSit === '' ? '#fff' : theme.textSecondary,
                    }}
                  >
                    Todas ({bfAlunos.length})
                  </button>
                  {situacoes.map(sit => (
                    <button
                      key={sit}
                      onClick={() => setBfFiltroSit(sit === bfFiltroSit ? '' : sit)}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${bfFiltroSit === sit ? (SITUACAO_COR[sit] ?? theme.primary) : theme.borderLight}`,
                        background: bfFiltroSit === sit ? (SITUACAO_COR[sit] ?? theme.primary) : 'transparent',
                        color: bfFiltroSit === sit ? '#fff' : (SITUACAO_COR[sit] ?? theme.textSecondary),
                      }}
                    >
                      {SITUACAO_LABEL[sit] ?? sit} ({bfAlunos.filter(a => (a.situacao ?? 'ATIVO') === sit).length})
                    </button>
                  ))}
                </div>
              );
            })()}

            {bfLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>
                <Spinner size={32} /> <div style={{ marginTop: 12 }}>Carregando...</div>
              </div>
            ) : bfAlunos.length === 0 ? (
              <EmptyState icon="💚" message="Nenhum aluno com Bolsa Família cadastrado." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#15803d', color: '#fff' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Nome</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>RA</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700 }}>NIS</th>
                      <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700 }}>Turma</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700 }}>Situação</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Data Movim.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const turmaNomeMap = new Map(turmas.map((t: any) => [t.id, t.nome]));
                      const lista = bfFiltroSit
                        ? bfAlunos.filter(a => (a.situacao ?? 'ATIVO') === bfFiltroSit)
                        : bfAlunos;
                      return lista.map((a, i) => {
                        const sit = a.situacao ?? 'ATIVO';
                        const cor = SITUACAO_COR[sit] ?? theme.textSecondary;
                        const isTran = sit === 'TRAN';
                        const isSaida = sit === 'TRAN' || sit === 'ABAN' || sit === 'BXTR';
                        const rowBg = isSaida
                          ? (isDark ? 'rgba(2,132,199,0.12)' : '#e0f2fe')
                          : (i % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)');
                        return (
                          <tr key={a.id} style={{ background: rowBg }}>
                            <td style={{ padding: '7px 10px', fontWeight: 600, color: theme.text }}>
                              {isTran && <span title="Transferido — lançar no Sistema Presença" style={{ marginRight: 5 }}>🔄</span>}
                              {a.nome}
                              {a.deficiencia && <span style={{ fontSize: 10, color: '#7c3aed', marginLeft: 6 }}>♿</span>}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', color: theme.textSecondary }}>{a.ra ?? '—'}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', color: theme.textSecondary, fontWeight: 600 }}>{a.nis ?? '—'}</td>
                            <td style={{ padding: '7px 8px', color: theme.textSecondary }}>{turmaNomeMap.get(a.turmaId) ?? '—'}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: cor }}>
                              {SITUACAO_LABEL[sit] ?? sit}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', color: isSaida ? cor : theme.textMuted, fontWeight: isSaida ? 700 : 400 }}>
                              {a.data_movimentacao ?? '—'}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
                {bfFiltroSit && (
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8, textAlign: 'right' }}>
                    Mostrando {bfAlunos.filter(a => (a.situacao ?? 'ATIVO') === bfFiltroSit).length} de {bfAlunos.length} alunos
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
            ⚠️ Alerta: ≥ {limiteAlerta} ausências (&lt;{isInfantil ? 60 : 75}% frequência{isInfantil ? ' — Infantil' : ''})
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
                    fontSize: 12, fontWeight: 600, minWidth: isMobile ? 150 : 210,
                    borderRight: '2px solid rgba(255,255,255,0.25)',
                  }}>
                    # Aluno
                  </th>
                  {calDays.map(cd => {
                    const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(cd.dia).padStart(2, '0')}`;
                    const naoLetivo = !cd.isLetivo;
                    const bg = cd.isWeekend && !cd.isSabadoLetivo ? '#374151'
                             : cd.recesso ? '#1e3a5f'
                             : naoLetivo ? '#4b5563'
                             : undefined;
                    const tooltip =
                      cd.feriado ?? (cd.isEmenda ? '⛔ Emenda marcada' : null) ??
                      cd.recesso ?? (cd.isSabadoLetivo ? '📚 Sábado Letivo' : null) ??
                      (cd.isWeekend ? 'Final de semana' : `Dia ${cd.dia}`);
                    return (
                      <th key={cd.dia} title={tooltip}
                        onClick={
                          role === 'admin' && !cd.isWeekend && !cd.feriado && !cd.recesso
                            ? () => toggleEmenda(dataStr) : undefined
                        }
                        style={{
                          width: isMobile ? 38 : 24, textAlign: 'center',
                          fontSize: isMobile ? 9 : 10, padding: '6px 1px',
                          fontWeight: 600, background: bg, lineHeight: 1.2,
                          opacity: naoLetivo ? 0.55 : 1,
                          cursor: role === 'admin' && !cd.isWeekend && !cd.feriado && !cd.recesso
                            ? 'pointer' : 'default',
                        }}
                      >
                        <div>{cd.dia}</div>
                        {cd.feriado && <div style={{ fontSize: 7 }}>🎉</div>}
                        {!cd.feriado && cd.recesso && <div style={{ fontSize: 7 }}>🏖️</div>}
                        {cd.isEmenda && <div style={{ fontSize: 7 }}>⛔</div>}
                        {cd.isSabadoLetivo && <div style={{ fontSize: 7 }}>📚</div>}
                      </th>
                    );
                  })}
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#bbf7d0', padding: '8px 2px', borderLeft: '2px solid rgba(255,255,255,0.25)' }}>P</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#fca5a5', padding: '8px 2px' }}>F</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#fdba74', padding: '8px 2px' }}>J</th>
                  <th style={{ width: 30, textAlign: 'center', fontSize: 11, color: '#c4b5fd', padding: '8px 2px' }}>A</th>
                  <th style={{ width: 52, textAlign: 'center', fontSize: 11, padding: '8px 4px' }}>Freq.</th>
                  <th style={{ width: 58, textAlign: 'center', fontSize: 10, padding: '8px 4px', color: '#a5f3fc' }} title="Frequência considerando atestado como presença">Freq.<br/>c/At.</th>
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
                  const freqAt = ((numDias - (nF + nJ)) / numDias * 100).toFixed(0);
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
                          <span style={{ fontSize: 11, color: theme.textMuted, paddingTop: 2, minWidth: 18 }}>{(a._nrDisplay === 0 ? '—' : a.numero) || '—'}</span>
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
                            {a.bolsa_familia && (
                              <span style={{ fontSize: 10, color: '#15803d', fontWeight: 600, display: 'block' }}>
                                💚 Bolsa Família
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {statusTxt ? (
                        <td colSpan={calDays.length + 5} style={{ textAlign: 'center', color: '#7c3aed', fontStyle: 'italic', fontSize: 12, padding: 8 }}>
                          {statusTxt}
                        </td>
                      ) : (
                        <>
                          {calDays.map(cd => {
                            if (!cd.isLetivo) {
                              const bg = cd.recesso ? '#1a2f4a' : cd.isWeekend ? '#1f2937' : '#283548';
                              return <td key={cd.dia} style={{
                                width: isMobile ? 38 : 24, background: bg,
                                borderLeft: '1px solid var(--border-light)',
                              }} />;
                            }
                            const status = dias[cd.schoolIdx] ?? 'P';
                            return (
                              <td key={cd.dia}
                                onClick={podeEditar ? () => toggleDia(a.id, cd.schoolIdx) : undefined}
                                title={`Dia ${cd.dia}: ${ST_LABEL[status]}${cd.isSabadoLetivo ? ' (Sábado Letivo)' : ''}`}
                                style={{
                                  width: isMobile ? 38 : 24, textAlign: 'center', cursor: podeEditar ? 'pointer' : 'default',
                                  background: ST_BG[status], color: ST_COR[status],
                                  fontWeight: 700, fontSize: isMobile ? 13 : 11,
                                  padding: isMobile ? '12px 0' : '7px 0',
                                  borderLeft: '1px solid var(--border-light)',
                                  userSelect: 'none', transition: 'opacity 0.1s', touchAction: 'manipulation',
                                }}
                                onMouseEnter={!isMobile && podeEditar ? (e => (e.currentTarget.style.opacity = '0.75')) : undefined}
                                onMouseLeave={!isMobile && podeEditar ? (e => (e.currentTarget.style.opacity = '1')) : undefined}
                              >
                                {status}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', color: ST_COR.P, fontWeight: 700, fontSize: 13, padding: '0 2px', borderLeft: '2px solid var(--border-light)' }}>{nP}</td>
                          <td style={{ textAlign: 'center', color: nF > 0 ? ST_COR.F : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nF > 0 ? nF : '—'}</td>
                          <td style={{ textAlign: 'center', color: nJ > 0 ? ST_COR.J : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nJ > 0 ? nJ : '—'}</td>
                          <td style={{ textAlign: 'center', color: nA > 0 ? ST_COR.A : theme.textMuted, fontWeight: 700, fontSize: 13, padding: '0 2px' }}>{nA > 0 ? nA : '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '0 4px', color: Number(freq) >= 85 ? ST_COR.P : Number(freq) >= 75 ? '#ea580c' : ST_COR.F }}>
                            {freq}%
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '0 4px', color: Number(freqAt) >= 85 ? ST_COR.P : Number(freqAt) >= 75 ? '#ea580c' : ST_COR.F }} title="Frequência considerando atestado como presença">
                            {freqAt}%
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
                  <td colSpan={calDays.length} />
                  <td style={{ textAlign: 'center', color: ST_COR.P, fontWeight: 700, fontSize: 13, borderLeft: '2px solid var(--border-light)' }}>{totalP}</td>
                  <td style={{ textAlign: 'center', color: totalF > 0 ? ST_COR.F : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalF > 0 ? totalF : '—'}</td>
                  <td style={{ textAlign: 'center', color: totalJ > 0 ? ST_COR.J : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalJ > 0 ? totalJ : '—'}</td>
                  <td style={{ textAlign: 'center', color: totalA > 0 ? ST_COR.A : theme.textMuted, fontWeight: 700, fontSize: 13 }}>{totalA > 0 ? totalA : '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, padding: '0 4px', color: Number(freqGeral) >= 85 ? ST_COR.P : theme.danger }}>{freqGeral}%</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '0 4px', color: Number(freqGeralAt) >= 85 ? ST_COR.P : theme.danger }} title="Freq. geral c/ atestado como presença">{freqGeralAt}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, marginTop: 10, marginBottom: 12, alignItems: 'center' }}>
            <span style={{ color: ST_COR.P, fontWeight: 700 }}>🟢 P=Presença</span>
            <span style={{ color: ST_COR.F, fontWeight: 700 }}>🔴 F=Falta</span>
            <span style={{ color: ST_COR.J, fontWeight: 700 }}>🟠 J=Justificado</span>
            <span style={{ color: ST_COR.A, fontWeight: 700 }}>🟣 A=Atestado</span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              · 🎉 Feriado &nbsp; 🏖️ Recesso
            </span>
            {role === 'admin' && (
              <span style={{ fontSize: 11, color: '#f97316' }}>
                · Admin: clique no Nº do dia para marcar/desmarcar emenda ⛔
              </span>
            )}
          </div>

          {podeEditar ? (
            <button
              style={{
                ...btn('primary', { full: true }),
                padding: '14px', fontSize: 17,
                background: saved ? theme.success : theme.primary,
                transition: 'all 0.2s ease',
                borderRadius: isMobile ? 0 : theme.radiusMd,
                position: isMobile ? 'sticky' : 'static',
                bottom: isMobile ? 0 : 'auto',
                zIndex: isMobile ? 10 : 'auto',
                boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.2)' : 'none',
              }}
              onClick={salvar} disabled={saving}
            >
              {saving ? <><Spinner size={20} /> Salvando...</> : saved ? '✅ Salvo!' : '💾 Salvar Faltas'}
            </button>
          ) : (
            <div style={{
              padding: '14px', fontSize: 14, fontWeight: 600, textAlign: 'center',
              background: 'var(--ghost-bg)', borderRadius: theme.radiusMd,
              color: theme.textMuted, border: `1px solid ${theme.borderLight}`,
            }}>
              🔒 Somente visualização — apenas o administrador pode salvar faltas
            </div>
          )}
        </div>
      )}
    </div>
  );
}
