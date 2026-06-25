import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api, supabase } from '../api';
import { theme, btn, input, label, SITUACAO_COR, SITUACAO_LABEL, SITUACOES, card as cardStyle, row, sortTurmasPedagogico, ordemTurma } from '../styles';
import { Loading, EmptyState, StatCard, Spinner } from '../components';
import { useAuth } from '../AuthContext';

function labelDocente(nome: string): string {
  if (!nome) return 'Professora';
  const n = nome.trim().split(' ')[0].toLowerCase();
  if (/o$|os$|us$|el$|on$|an$|ar$|or$|er$|ir$|ur$/.test(n)) return 'Professor';
  const masculinos = ['magnus', 'andre', 'felipe', 'gabriel', 'rafael', 'daniel',
    'miguel', 'samuel', 'israel', 'ezequiel', 'manoel', 'manuel', 'ismael'];
  if (masculinos.includes(n)) return 'Professor';
  return 'Professora';
}

function normalizeNome(s: string): string {
  return s.toUpperCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-]/g, ' ').replace(/[.]/g, '')
    .replace(/[\u2018\u2019\u0060\u00b4']/g, ' ')
    .replace(/[\u00aa\u00ba\u00b0]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function matchScore(a: string, b: string): number {
  const na = normalizeNome(a).split(' ');
  const nb = normalizeNome(b).split(' ');
  const intersect = na.filter(w => nb.includes(w)).length;
  return intersect / Math.max(na.length, nb.length);
}

// Alunos matriculados após 15/04 ficam por último na chamada
function isLateEnrollment(a: any): boolean {
  const d = a.data_inicio_matricula;
  if (!d) return false;
  const parts = String(d).split('/');
  if (parts.length < 2) return false;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(day) || isNaN(month)) return false;
  return month > 4 || (month === 4 && day > 15);
}

function sortByNr(a: any, b: any): number {
  const aLate = isLateEnrollment(a);
  const bLate = isLateEnrollment(b);
  if (aLate && !bLate) return 1;
  if (!aLate && bLate) return -1;
  return (a.numero || 9999) - (b.numero || 9999);
}

export default function Alunos() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('__all__');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroProfessora, setFiltroProfessora] = useState('');
  const [filtroDefi, setFiltroDefi] = useState('');
  const [soBolsa, setSoBolsa] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaSituacao, setNovaSituacao] = useState('');
  const [dataMovimentacao, setDataMovimentacao] = useState('');
  const [dataInicioEdit, setDataInicioEdit] = useState('');
  const [dataFimEdit, setDataFimEdit] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoCpf, setEditandoCpf] = useState('');
  const [editandoCor, setEditandoCor] = useState('');
  const [copiado, setCopiado] = useState('');
  const [loading, setLoading] = useState(true);
  const [detalhesAbertos, setDetalhesAbertos] = useState<Set<string>>(new Set());
  const [enriquecendo, setEnriquecendo] = useState(false);
  const [msgEnriquecimento, setMsgEnriquecimento] = useState('');
  const [modoCpfRapido, setModoCpfRapido] = useState(false);
  const [cpfInputs, setCpfInputs] = useState<Record<string, string>>({});
  const [corRacaInputs, setCorRacaInputs] = useState<Record<string, string>>({});
  const [cpfSalvos, setCpfSalvos] = useState<Set<string>>(new Set());
  const [cpfSalvando, setCpfSalvando] = useState<Set<string>>(new Set());
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const { role, podeEditarCpf, podeEditarCorRaca } = useAuth();

  const excluirAluno = async (id: string) => {
    await supabase.from('Falta').delete().eq('alunoId', id);
    await supabase.from('Aluno').delete().eq('id', id);
    setAlunos(prev => prev.filter(a => a.id !== id));
    setDeletandoId(null);
  };

  const enriquecerEducacenso = async () => {
    setEnriquecendo(true);
    setMsgEnriquecimento('');
    try {
      const { data: educ } = await supabase
        .from('Educacenso')
        .select('nome, data_nascimento, cpf, deficiencia, cor_raca');
      if (!educ || educ.length === 0) {
        setMsgEnriquecimento('Tabela Educacenso vazia — importe o arquivo primeiro.');
        setEnriquecendo(false);
        return;
      }
      let nAtualizados = 0;
      for (const a of alunos) {
        if (a.cpf && a.deficiencia && a.cor_raca) continue;
        let bestScore = 0;
        let bestEntry = null;
        for (const e of educ) {
          if (!e.nome || a.data_nascimento !== e.data_nascimento) continue;
          const score = matchScore(a.nome, e.nome);
          if (score > bestScore) { bestScore = score; bestEntry = e; }
        }
        if (bestEntry && bestScore >= 0.85) {
          const updates: any = {};
          if (!a.cpf && bestEntry.cpf) updates.cpf = bestEntry.cpf;
          if (!a.deficiencia && bestEntry.deficiencia) updates.deficiencia = bestEntry.deficiencia;
          if (!a.cor_raca && bestEntry.cor_raca) updates.cor_raca = bestEntry.cor_raca;
          if (Object.keys(updates).length > 0) {
            await api.updateAluno(a.id, updates);
            nAtualizados++;
          }
        }
      }
      if (nAtualizados > 0) {
        setMsgEnriquecimento(`✅ ${nAtualizados} alunos enriquecidos com CPF/Cor/Raça do Educacenso`);
        const p = turmaId === '__all__' ? api.getAllAlunos() : api.getAlunos(turmaId);
        p.then(setAlunos).catch(() => {});
      } else {
        setMsgEnriquecimento('Nenhum aluno correspondido.');
      }
    } catch (e: any) {
      setMsgEnriquecimento('Erro: ' + (e.message ?? e));
    }
    setEnriquecendo(false);
  };

  useEffect(() => { api.getTurmas().then(d => setTurmas(sortTurmasPedagogico(d || []))); }, []);

  useEffect(() => {
    setLoading(true);
    const p = turmaId === '__all__' ? api.getAllAlunos() : api.getAlunos(turmaId);
    p.then(setAlunos).catch(err => { console.error('Erro ao carregar alunos:', err); setAlunos([]); }).finally(() => setLoading(false));
  }, [turmaId]);

  const professoras = [...new Set(turmas.map(t => t.professora).filter(Boolean))].sort();
  const deficiencias = [...new Set(alunos.map(a => a.deficiencia).filter(Boolean))].sort();
  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  const alunosFiltrados = alunos.filter(a => {
    if (busca && !a.nome?.toLowerCase().includes(busca.toLowerCase()) && !String(a.ra ?? '').includes(busca)) return false;
    if (filtroSituacao && a.situacao !== filtroSituacao) return false;
    if (soBolsa && !a.bolsa_familia) return false;
    if (filtroProfessora && turmaMap.get(a.turmaId)?.professora !== filtroProfessora) return false;
    if (filtroDefi && a.deficiencia !== filtroDefi) return false;
    return true;
  }).sort(sortByNr);

  const isAtivo = (a: any) => !a.situacao || a.situacao === 'ATIVO';
  const totalAtivos = alunos.filter(isAtivo).length;
  const totalBolsa  = alunos.filter(a => a.bolsa_familia && isAtivo(a)).length;

  // Defi. Regular = total de alunos activos com deficiência (inclui os que também estão em AEE)
  // Defi. AEE = alunos activos em sala de recursos (turmaId aponta para turma AEE)
  const rasComDefi = new Set(
    alunos.filter(a => isAtivo(a) && a.deficiencia).map(a => a.ra ? String(a.ra) : a.id)
  );
  const isAEETurma = (t: any) => t?.tipo === 'AEE' || /^AEE\b/i.test(t?.nome ?? '');
  const rasEmAEE = new Set(
    alunos.filter(a => isAtivo(a) && isAEETurma(turmaMap.get(a.turmaId)) && a.ra)
      .map(a => String(a.ra))
  );
  const totalDefiAEE     = [...rasEmAEE].filter(ra => rasComDefi.has(ra)).length;
  const totalDefiRegular = rasComDefi.size;

  // Agrupa por turma quando "Todas as turmas" — cada turma com numeração independente
  const renderRows = useMemo(() => {
    if (turmaId !== '__all__') {
      return alunosFiltrados.map((a, idx) => ({ tipo: 'aluno' as const, a, idx }));
    }
    const grupos = new Map<string, any[]>();
    for (const a of alunosFiltrados) {
      if (!grupos.has(a.turmaId)) grupos.set(a.turmaId, []);
      grupos.get(a.turmaId).push(a);
    }
    const linhas: Array<{ tipo: 'aluno'; a: any; idx: number } | { tipo: 'header'; nome: string; key: string; total: number }> = [];
    const gruposOrdenados = [...grupos.entries()].sort(([tidA], [tidB]) =>
      ordemTurma(turmaMap.get(tidA)?.nome ?? '').localeCompare(ordemTurma(turmaMap.get(tidB)?.nome ?? ''))
    );
    for (const [tid, arr] of gruposOrdenados) {
      const t = turmaMap.get(tid);
      arr.sort(sortByNr);
      linhas.push({ tipo: 'header', nome: t ? `📚 ${t.nome} — ${labelDocente(t.professora || '')} ${t.professora || ''}` : 'Sem turma', key: tid, total: arr.length });
      arr.forEach((a, idx) => linhas.push({ tipo: 'aluno', a, idx }));
    }
    return linhas;
  }, [alunosFiltrados, turmaId, turmaMap]);

  const abrirEdicao = (a: any) => {
    if (role !== 'admin') return;
    if (editandoId === a.id) { setEditandoId(null); return; }
    setEditandoId(a.id);
    setNovaSituacao(a.situacao ?? 'ATIVO');
    setDataMovimentacao('');
    setDataInicioEdit(a.data_inicio_matricula ?? '');
    setDataFimEdit(a.data_fim_matricula ?? '');
  };

  const salvarSituacao = async (alunoId: string) => {
    if (role !== 'admin') return;
    setSalvando(true);
    const updates: any = { situacao: novaSituacao };
    if (dataMovimentacao) {
      updates.data_movimentacao = dataMovimentacao;
      if (['BXTR', 'TRAN', 'N COM', 'REMA'].includes(novaSituacao)) updates.data_fim_matricula = dataMovimentacao;
    }
    if (dataInicioEdit.trim()) updates.data_inicio_matricula = dataInicioEdit.trim();
    if (dataFimEdit.trim() && !updates.data_fim_matricula) updates.data_fim_matricula = dataFimEdit.trim();
    await api.updateAluno(alunoId, updates);
    setAlunos(prev => prev.map(a => a.id === alunoId ? { ...a, ...updates } : a));
    setSalvando(false);
    setEditandoId(null);
  };

  const toggleDetalhes = (id: string) => {
    setDetalhesAbertos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const salvarDadosRapido = async (alunoId: string, cpf: string, corRaca: string) => {
    const limpo = cpf.replace(/\D/g, '');
    if (!limpo && !corRaca) return;
    if (cpfSalvando.has(alunoId)) return;
    setCpfSalvando(prev => new Set(prev).add(alunoId));
    try {
      const updates: any = {};
      if (limpo) updates.cpf = limpo;
      if (corRaca) updates.cor_raca = corRaca;
      if (Object.keys(updates).length > 0) {
        await api.updateAluno(alunoId, updates);
        // Atualiza estado local — o aluno some da lista naturalmente
        // quando !a.cpf && !a.cor_raca ambos estiverem preenchidos
        setAlunos(prev => {
          const novo = prev.map(a => a.id === alunoId ? { ...a, ...updates } : a);
          const atualizado = novo.find(a => a.id === alunoId);
          if (atualizado?.cpf && atualizado?.cor_raca) {
            setCpfSalvos(s => new Set(s).add(alunoId));
          }
          return novo;
        });
      }
    } catch {}
    setCpfSalvando(prev => { const s = new Set(prev); s.delete(alunoId); return s; });
  };

  // ─── Export ───
  const exportarExcel = () => {
    const dados = alunosFiltrados.map((a, i) => {
      const t = turmaMap.get(a.turmaId);
      return {
        'Nº': i + 1,
        'Nome do Aluno': a.nome,
        'RA': a.ra ?? '',
        'Dig. RA': a.dig_ra ?? '',
        'Data Nascimento': a.data_nascimento ?? '',
        'Situação': SITUACAO_LABEL[a.situacao] ?? a.situacao,
        'Deficiência': a.deficiencia ?? '',
        'Bolsa Família': a.bolsa_familia ? 'Sim' : 'Não',
        'Turma': t?.nome ?? '',
        'Professora': t?.professora ?? '',
        'Data Início Matrícula': a.data_inicio_matricula ?? '',
        'Data Fim Matrícula': a.data_fim_matricula ?? '',
        'Data Movimentação': a.data_movimentacao ?? '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [
      { wch: 4 }, { wch: 38 }, { wch: 14 }, { wch: 8 },
      { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 12 },
      { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, `Alunos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarPDF = () => {
    const turmaSel = turmas.find(t => t.id === turmaId);
    const blocos: string[] = [];

    if (turmaSel) {
      // Turma específica selecionada
      const linhas = alunosFiltrados.map((a, i) => {
        const nome = String(a.nome ?? '').padEnd(38);
        const ra = String(a.ra ?? '').padEnd(12);
        const sit = (SITUACAO_LABEL[a.situacao] ?? a.situacao ?? '').padEnd(14);
        const defi = (a.deficiencia ?? '').substring(0, 22).padEnd(22);
        return `${String(i + 1).padStart(2)} ${nome} ${ra} ${sit} ${defi}`;
      });
      const prof = turmaSel.professora ? `  ${labelDocente(turmaSel.professora)} ${turmaSel.professora}` : '';
      blocos.push([
        '='.repeat(100),
        `  ${turmaSel.nome}${prof}`,
        '='.repeat(100),
        '',
        ` Nº  Nome                                    RA             Situação       Deficiência`,
        '─'.repeat(100),
        ...linhas,
        '─'.repeat(100),
        `  Total: ${alunosFiltrados.length} alunos`,
      ].join('\n'));
    } else {
      // Todas as turmas — separar por turma
      const grupos = new Map<string, any[]>();
      for (const a of alunosFiltrados) {
        if (!grupos.has(a.turmaId)) grupos.set(a.turmaId, []);
        grupos.get(a.turmaId)!.push(a);
      }
      const gruposOrdenados = [...grupos.entries()].sort(([tidA], [tidB]) =>
        ordemTurma(turmaMap.get(tidA)?.nome ?? '').localeCompare(ordemTurma(turmaMap.get(tidB)?.nome ?? ''))
      );
      for (const [tid, arr] of gruposOrdenados) {
        const t = turmaMap.get(tid);
        arr.sort(sortByNr);
        const prof = t?.professora ? `  ${labelDocente(t.professora)} ${t.professora}` : '';
        const nomeTurma = t?.nome ?? 'Sem turma';
        const linhas = arr.map((a: any, i: number) => {
          const nome = String(a.nome ?? '').padEnd(38);
          const ra = String(a.ra ?? '').padEnd(12);
          const sit = (SITUACAO_LABEL[a.situacao] ?? a.situacao ?? '').padEnd(14);
          const defi = (a.deficiencia ?? '').substring(0, 22).padEnd(22);
          return `${String(i + 1).padStart(2)} ${nome} ${ra} ${sit} ${defi}`;
        });
        blocos.push([
          '='.repeat(100),
          `  ${nomeTurma} —${prof}`,
          '='.repeat(100),
          '',
          ` Nº  Nome                                    RA             Situação       Deficiência`,
          '─'.repeat(100),
          ...linhas,
          '─'.repeat(100),
          `  Total: ${arr.length} alunos`,
        ].join('\n'));
      }
    }

    const titulo = `RELAÇÃO DE ALUNOS — ${turmaSel?.nome ?? 'Todas as Turmas'}`;
    const conteudo = blocos.join('\n\n\n');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${titulo}</title>
<style>body{font-family:monospace;font-size:14px;margin:24px}pre{white-space:pre-wrap}
@media print{body{margin:8px}}</style></head>
<body><pre>${conteudo}</pre>
<script>setTimeout(()=>window.print(),400)</script></body></html>`);
    win.document.close();
  };

  const COLUNAS = role === 'admin'
    ? '44px 1fr 110px 85px 100px 40px 110px 130px 125px 90px 30px 36px'
    : '44px 1fr 110px 85px 100px 40px 110px 130px 125px 90px 30px';
  const formataCPF = (cpf: string) => cpf ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';
  const copiar = async (texto: string, label: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(label); setTimeout(() => setCopiado(''), 1500); } catch {}
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>👥 Alunos</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(role === 'admin' || podeEditarCpf) && (
            <button
              onClick={() => { setModoCpfRapido(m => !m); setCpfSalvos(new Set()); setCpfInputs({}); setCorRacaInputs({}); }}
              style={btn(modoCpfRapido ? 'danger' : 'warning', { small: true })}
              title="Lista todos os alunos sem CPF para cadastro rápido"
            >
              {modoCpfRapido ? '✕ Fechar CPF Rápido' : '📋 Cadastrar CPF'}
            </button>
          )}
          {alunosFiltrados.length > 0 && !modoCpfRapido && (
            <>
              <button onClick={exportarExcel} style={btn('success', { small: true, outline: true })}>📊 Excel</button>
              <button onClick={exportarPDF} style={btn('danger', { small: true, outline: true })}>📄 PDF</button>
              {role === 'admin' && (
                <button onClick={enriquecerEducacenso} disabled={enriquecendo}
                  style={btn('warning', { small: true, outline: true })}>
                  {enriquecendo ? <Spinner size={14} /> : '🔗'} Educacenso
                </button>
              )}
            </>
          )}
        </div>
        {msgEnriquecimento && (
          <div style={{
            marginTop: 4, padding: '6px 14px', borderRadius: 6,
            background: msgEnriquecimento.startsWith('✅') ? 'var(--success-light)' : msgEnriquecimento.startsWith('Erro') ? 'var(--danger-light)' : 'var(--warning-light)',
            color: theme.text, fontSize: 13,
          }}>
            {msgEnriquecimento}
          </div>
        )}
      </div>

      {/* ─── MODO CADASTRO RÁPIDO DE CPF ─── */}
      {modoCpfRapido && (() => {
        const COR_RACA_OPCOES = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não declarada'];
        const semCpf = [...alunos]
          .filter(a => !a.cpf || !a.cor_raca)
          .sort((a, b) => {
            const ta = turmaMap.get(a.turmaId)?.nome ?? 'ZZZZ';
            const tb = turmaMap.get(b.turmaId)?.nome ?? 'ZZZZ';
            if (ta !== tb) return ta.localeCompare(tb, 'pt-BR');
            return (a.numero || 9999) - (b.numero || 9999);
          });
        const todos = [...alunos].filter(a => !a.cpf || !a.cor_raca);
        const salvosCount = cpfSalvos.size;
        const inputRefs: Record<string, HTMLInputElement | null> = {};
        const focarProximo = (alunoId: string) => {
          const idx = semCpf.findIndex(a => a.id === alunoId);
          if (idx >= 0 && idx + 1 < semCpf.length) {
            const prox = semCpf[idx + 1];
            setTimeout(() => inputRefs[prox.id]?.focus(), 50);
          }
        };
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              background: '#fefce8', border: '2px solid #fbbf24', borderRadius: 12,
              padding: '14px 18px', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#92400e' }}>📋 Cadastro Rápido de CPF</span>
                <span style={{ fontSize: 13, color: '#78350f', marginLeft: 12 }}>
                  {semCpf.length} alunos sem CPF · {salvosCount} salvos nesta sessão
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#92400e' }}>Busque pelo RA no SED → preencha CPF e cor/raça → Enter salva e avança</span>
            </div>
            {semCpf.length === 0
              ? <div style={{ textAlign: 'center', padding: 32, color: '#16a34a', fontWeight: 700, fontSize: 16 }}>
                  ✅ Todos os alunos já têm CPF e cor/raça cadastrados!
                </div>
              : (
                <div style={{ background: theme.card, borderRadius: 12, border: `1px solid ${theme.borderLight}`, overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '120px 1fr 140px 100px 155px 150px',
                    padding: '8px 14px', background: theme.bg,
                    fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em',
                    borderBottom: `1px solid ${theme.borderLight}`,
                  }}>
                    <span>RA</span><span>Nome</span><span>Turma</span><span>Nascimento</span><span>CPF</span><span>Cor/Raça</span>
                  </div>
                  {semCpf.map((a, idx) => {
                    const turma = turmaMap.get(a.turmaId);
                    const salvando = cpfSalvando.has(a.id);
                    const salvo = cpfSalvos.has(a.id);
                    return (
                      <div key={a.id} style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr 140px 100px 155px 150px',
                        alignItems: 'center', padding: '7px 14px',
                        background: salvo ? '#f0fdf4' : idx % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)',
                        borderBottom: `1px solid ${theme.borderLight}`,
                      }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#2563eb', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                          {a.ra ?? '—'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{a.nome}</span>
                        <span style={{ fontSize: 12, color: theme.textMuted }}>{turma?.nome ?? 'Sem turma'}</span>
                        <span style={{ fontSize: 12, color: theme.textMuted }}>{a.data_nascimento ?? ''}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {a.cpf
                            ? <span style={{ fontSize: 12, color: '#16a34a', fontFamily: 'monospace' }}>✓ {a.cpf}</span>
                            : <input
                                ref={el => { inputRefs[a.id] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={14}
                                placeholder="000.000.000-00"
                                value={cpfInputs[a.id] ?? ''}
                                onChange={e => setCpfInputs(prev => ({ ...prev, [a.id]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    salvarDadosRapido(a.id, cpfInputs[a.id] ?? '', corRacaInputs[a.id] ?? '').then(() => focarProximo(a.id));
                                  }
                                }}
                                onBlur={() => { if (cpfInputs[a.id]?.replace(/\D/g, '').length >= 11) salvarDadosRapido(a.id, cpfInputs[a.id] ?? '', corRacaInputs[a.id] ?? ''); }}
                                style={{
                                  ...input, width: 130, padding: '4px 8px', fontSize: 12,
                                  fontFamily: 'monospace', border: `1.5px solid ${salvando ? '#f59e0b' : '#d1d5db'}`,
                                }}
                                disabled={salvando}
                              />
                          }
                          {salvando && <Spinner size={14} />}
                        </div>
                        <div>
                          {a.cor_raca
                            ? <span style={{ fontSize: 12, color: '#16a34a' }}>✓ {a.cor_raca}</span>
                            : <select
                                value={corRacaInputs[a.id] ?? ''}
                                onChange={e => {
                                  setCorRacaInputs(prev => ({ ...prev, [a.id]: e.target.value }));
                                  if (e.target.value) salvarDadosRapido(a.id, cpfInputs[a.id] ?? '', e.target.value);
                                }}
                                style={{ ...input, padding: '4px 6px', fontSize: 12, width: '100%' }}
                                disabled={salvando}
                              >
                                <option value="">— selecionar —</option>
                                {COR_RACA_OPCOES.map(op => <option key={op} value={op}>{op}</option>)}
                              </select>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        );
      })()}

      {/* Filtros */}
      {!modoCpfRapido && <div style={{
        background: theme.card, borderRadius: theme.radiusMd,
        padding: 18, marginBottom: 16, boxShadow: theme.shadow,
        border: `1px solid ${theme.borderLight}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={label}>Turma</label>
            <select style={input} value={turmaId} onChange={e => setTurmaId(e.target.value)}>
              <option value="__all__">— Todas as turmas —</option>
              {turmas.map(t => {
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
            <label style={label}>Professora</label>
            <select style={input} value={filtroProfessora} onChange={e => setFiltroProfessora(e.target.value)}>
              <option value="">Todas</option>
              {professoras.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Situação</label>
            <select style={input} value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
              <option value="">Todas</option>
              {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Deficiência</label>
            <select style={input} value={filtroDefi} onChange={e => setFiltroDefi(e.target.value)}>
              <option value="">Todas</option>
              {deficiencias.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...input, marginBottom: 0, flex: 1, minWidth: 180 }} placeholder="🔍 Buscar por nome ou RA..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', fontSize: 14, color: theme.success,
            fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            <input type="checkbox" checked={soBolsa} onChange={e => setSoBolsa(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: theme.success }} />
            🟢 Só Bolsa Família ({totalBolsa})
          </label>
        </div>
      </div>}

      {!modoCpfRapido && loading ? <Loading /> : !modoCpfRapido && alunos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
          <StatCard label="Total" val={alunos.length} color={theme.primary} />
          <StatCard label="Ativos" val={totalAtivos} color={theme.success} sub={alunos.length > 0 ? `${((totalAtivos / alunos.length) * 100).toFixed(0)}%` : undefined} />
          <StatCard label="Bolsa Família" val={totalBolsa} color={theme.orange} />
          <StatCard label="🏫 Defi. Regular" val={totalDefiRegular} color={theme.purple} sub="Ensino regular" />
          <StatCard label="🎯 Defi. AEE" val={totalDefiAEE} color="#8b5cf6" sub="Sala de recursos" />
        </div>
      )}

      {!modoCpfRapido && turmas.length === 0 && !loading && (
        <EmptyState icon="📥" message="Nenhuma turma cadastrada."
          action={{ label: 'Importar planilha', href: '/importar' }} />
      )}

      {!modoCpfRapido && turmas.length > 0 && !loading && alunos.length === 0 && (
        <EmptyState icon="📭" message="Nenhum aluno encontrado com esses filtros." />
      )}

      {/* Tabela */}
      {!modoCpfRapido && alunosFiltrados.length > 0 && !loading && (
        <div style={cardStyle({})}>
        <div className="table-wrap">
          <div style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
            color: 'white', padding: '12px 16px',
            display: 'grid', gridTemplateColumns: COLUNAS,
            gap: 8, fontSize: 13, fontWeight: 700,
          }}>
            <span>#</span><span>Nome</span><span>RA</span>
            <span style={{ textAlign: 'center' }}>Situação</span><span style={{ textAlign: 'center' }}>Deficiência</span>
            <span style={{ textAlign: 'center' }}>BF</span>
            <span>Docente</span><span>Turma</span>
            <span style={{ textAlign: 'center' }}>CPF</span>
            <span style={{ textAlign: 'center' }}>Cor/Raça</span>
            <span style={{ textAlign: 'center' }}>SED</span>
            {role === 'admin' && <span />}
          </div>

          {renderRows.map((item, globalIdx) =>
            item.tipo === 'header' ? (
              <div key={`hdr-${item.key}`} style={{
                margin: '20px 0 6px',
                padding: '8px 14px',
                background: theme.primary,
                color: 'white',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {item.nome}
                <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, opacity: 0.8 }}>
                  {item.total} aluno{item.total !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (() => {
              const a = item.a;
              const i = item.idx;
              const t = turmaMap.get(a.turmaId);
              const aberto = detalhesAbertos.has(a.id);
              return (
                <div key={a.id}>
                  <div
                    onClick={() => toggleDetalhes(a.id)}
                    style={{
                      ...row(i, {
                        gridTemplateColumns: COLUNAS,
                        gap: 8,
                        cursor: 'pointer',
                        ...(editandoId === a.id ? { borderBottom: 'none', background: 'var(--edit-bg)' } : {}),
                      }),
                    }}
                    onMouseEnter={e => { if (editandoId !== a.id) e.currentTarget.style.background = 'var(--ghost-bg)'; }}
                    onMouseLeave={e => { if (editandoId !== a.id) e.currentTarget.style.background = ''; }}>
<span style={{ fontSize: 13, color: theme.textMuted }}>{i + 1}</span>
                  <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{a.nome}</div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        {a.data_nascimento || ''}
                        {a.data_nascimento && a.deficiencia ? ' · ' : ''}{a.deficiencia || ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: theme.textSecondary, fontFamily: 'monospace' }}>
                      {a.ra}{a.dig_ra ? `-${a.dig_ra}` : ''}
                    </span>
                    {role === 'admin' ? (
                      <button onClick={e => { e.stopPropagation(); abrirEdicao(a); }} style={{
                        fontSize: 11, fontWeight: 700, textAlign: 'center',
                        color: SITUACAO_COR[a.situacao] ?? theme.textSecondary,
                        background: `${SITUACAO_COR[a.situacao] ?? theme.textSecondary}18`,
                        border: `1px solid ${SITUACAO_COR[a.situacao] ?? theme.border}50`,
                        borderRadius: 4, padding: '4px 8px', cursor: 'pointer', width: '100%',
                        transition: 'opacity 0.15s ease',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                        {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                      </button>
                    ) : (
                      <span style={{
                        display: 'block', fontSize: 11, fontWeight: 700, textAlign: 'center',
                        color: SITUACAO_COR[a.situacao] ?? theme.textSecondary,
                        background: `${SITUACAO_COR[a.situacao] ?? theme.textSecondary}18`,
                        border: `1px solid ${SITUACAO_COR[a.situacao] ?? theme.border}50`,
                        borderRadius: 4, padding: '4px 8px',
                      }}>
                        {SITUACAO_LABEL[a.situacao] ?? a.situacao}
                      </span>
                    )}
                    <span style={{ fontSize: 11, textAlign: 'center', color: a.deficiencia ? theme.purple : theme.textMuted }}>
                      {a.deficiencia ? '🟣' : '—'}
                    </span>
                    <span style={{ textAlign: 'center', fontSize: 15 }}>{a.bolsa_familia ? '✅' : '—'}</span>
                    <span style={{ fontSize: 12, color: theme.textSecondary }}>{a.professora || t?.professora || ''}</span>
                    <span style={{ fontSize: 12, color: theme.textSecondary }}>{t?.nome || ''}</span>
                    <span style={{ fontSize: 12, textAlign: 'center', color: a.cpf ? theme.text : theme.textMuted, fontFamily: 'monospace', cursor: a.cpf ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (a.cpf) copiar(a.cpf, 'cpf');
                        else if (podeEditarCpf) { if (!aberto) toggleDetalhes(a.id); setEditandoCpf(a.id); }
                      }}
                      title={a.cpf ? 'Clique para copiar CPF' : podeEditarCpf ? 'Clique para adicionar CPF' : ''}>
                      {a.cpf ? (copiado === 'cpf' ? '✅' : formataCPF(a.cpf)) : podeEditarCpf ? <span style={{ color: '#3b82f6', cursor: 'pointer' }}>+ cpf</span> : <span style={{ color: theme.textMuted }}>—</span>}
                    </span>
                    <span style={{ fontSize: 12, textAlign: 'center', color: a.cor_raca ? theme.text : theme.textMuted, cursor: a.cor_raca || !podeEditarCorRaca ? 'default' : 'pointer' }}
                      onClick={() => { if (!a.cor_raca && podeEditarCorRaca) { if (!aberto) toggleDetalhes(a.id); setEditandoCor(a.id); } }}
                      title={!a.cor_raca && podeEditarCorRaca ? 'Clique para adicionar Cor/Raça' : ''}>
                      {a.cor_raca || (podeEditarCorRaca ? <span style={{ color: '#3b82f6', cursor: 'pointer' }}>+ raça</span> : <span style={{ color: theme.textMuted }}>—</span>)}
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (a.ra) copiar(String(a.ra), `sed-${a.id}`);
                          window.open('https://sed.educacao.sp.gov.br/', '_blank', 'noopener,noreferrer');
                        }}
                        title={a.ra ? `Copiar RA ${a.ra} e abrir SED` : 'Abrir SED'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 15, padding: '2px 4px', borderRadius: 4, lineHeight: 1,
                          color: copiado === `sed-${a.id}` ? '#16a34a' : '#2563eb',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                      >
                        {copiado === `sed-${a.id}` ? '✅' : '🔗'}
                      </button>
                    </span>
                    {role === 'admin' && (
                      deletandoId === a.id ? (
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button onClick={e => { e.stopPropagation(); excluirAluno(a.id); }}
                            style={{ fontSize: 10, fontWeight: 700, background: '#ef4444', color: 'white', border: 'none', borderRadius: 3, padding: '2px 5px', cursor: 'pointer' }}>
                            ✓
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDeletandoId(null); }}
                            style={{ fontSize: 10, background: theme.border, color: theme.text, border: 'none', borderRadius: 3, padding: '2px 5px', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </span>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDeletandoId(a.id); }}
                          title="Excluir aluno"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: theme.textMuted, padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = theme.textMuted; }}>
                          🗑️
                        </button>
                      )
                    )}
                  </div>

                  {/* Detalhes expandidos */}
                  {aberto && (
                    <div>
                      {a.situacao === 'REMA' && (
                        <div className="slide-down" style={{
                          background: 'rgba(249,115,22,0.08)',
                          border: '1px solid rgba(249,115,22,0.3)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          margin: '0 16px 8px',
                          fontSize: 13,
                        }}>
                          <div style={{ fontWeight: 700, color: theme.orange, marginBottom: 6 }}>
                            🔄 Remanejamento
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
                            {(a.turma_origem || a.professora_origem) && (
                              <div>
                                <span style={{ color: theme.textMuted, fontSize: 12 }}>Turma origem: </span>
                                <span style={{ fontWeight: 600 }}>{a.turma_origem || '—'}</span>
                                {a.professora_origem && (
                                  <span style={{ color: theme.textSecondary }}>
                                    {' '}· {labelDocente(a.professora_origem)} {a.professora_origem}
                                  </span>
                                )}
                              </div>
                            )}
                            {(a.turma_destino || a.professora_destino) && (
                              <div>
                                <span style={{ color: theme.textMuted, fontSize: 12 }}>Turma destino: </span>
                                <span style={{ fontWeight: 600 }}>{a.turma_destino || '—'}</span>
                                {a.professora_destino && (
                                  <span style={{ color: theme.textSecondary }}>
                                    {' '}· {labelDocente(a.professora_destino)} {a.professora_destino}
                                  </span>
                                )}
                              </div>
                            )}
                            {a.data_inicio_matricula && (
                              <div>
                                <span style={{ color: theme.textMuted, fontSize: 12 }}>Início na origem: </span>
                                <span>{a.data_inicio_matricula}</span>
                              </div>
                            )}
                            {a.data_movimentacao && (
                              <div>
                                <span style={{ color: theme.textMuted, fontSize: 12 }}>Data remanejamento: </span>
                                <span style={{ fontWeight: 600, color: theme.orange }}>{a.data_movimentacao}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="slide-down" style={{
                        padding: '12px 16px',
                        background: 'var(--bg-card)',
                        borderBottom: `1px solid ${theme.borderLight}`,
                        borderLeft: `3px solid ${theme.sky}`,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 8,
                        fontSize: 13,
                      }}>
                        <div>
                          <span style={{ fontWeight: 600, color: theme.textSecondary }}>Início Matrícula: </span>
                          {a.data_inicio_matricula
                            ? <span style={{ color: theme.text }}>{a.data_inicio_matricula}</span>
                            : a.situacao === 'REMA'
                              ? <span style={{ color: theme.textMuted, fontSize: 12 }}>— ver turma origem</span>
                              : <span style={{ color: theme.orange, fontSize: 12, fontWeight: 600 }}>⚠️ não informado — clique em ✏️ Situação para preencher</span>}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: theme.textSecondary }}>Fim Matrícula: </span>
                          {a.data_fim_matricula
                            ? <span style={{ color: theme.text }}>{a.data_fim_matricula}</span>
                            : <span style={{ color: theme.orange, fontSize: 12, fontWeight: 600 }}>⚠️ não informado</span>}
                        </div>
                        {a.data_movimentacao && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Movimentação:</span> {a.data_movimentacao}</div>}
                        {t?.professora && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>{labelDocente(t.professora)}:</span> {t.professora}</div>}
                        {t?.nome && turmaId !== '__all__' && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Turma:</span> {t.nome}</div>}
                        {a.turma_origem && a.situacao === 'ATIVO' && (
                          <div><span style={{ fontWeight: 600, color: theme.orange }}>⬅ Veio de:</span> {a.turma_origem}{a.professora_origem ? ` (${a.professora_origem})` : ''}</div>
                        )}
                        {a.nis && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>NIS:</span> {a.nis}</div>}
                        {a.responsavel && <div><span style={{ fontWeight: 600, color: theme.textSecondary }}>Responsável:</span> {a.responsavel}</div>}
                        <div>
                          <span style={{ fontWeight: 600, color: theme.textSecondary }}>CPF:</span>
                          {podeEditarCpf && editandoCpf === a.id ? (
                            <span>
                              <input
                                value={a.cpf || ''}
                                onChange={e => {
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                                  setAlunos(prev => prev.map(x => x.id === a.id ? { ...x, cpf: v } : x));
                                }}
                                onBlur={async e => {
                                  // Auto-salva ao sair do campo (sem precisar clicar 💾)
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                                  await api.updateAluno(a.id, { cpf: v || null });
                                  setEditandoCpf('');
                                }}
                                style={{ ...input, width: 140, marginLeft: 6 }}
                                placeholder="00000000000" maxLength={11}
                                autoFocus
                              />
                              <button onClick={async () => {
                                await api.updateAluno(a.id, { cpf: a.cpf || null });
                                setEditandoCpf('');
                              }} style={{ ...btn('success', { small: true }), marginLeft: 4 }}>💾</button>
                              <button onClick={() => setEditandoCpf('')} style={{ ...btn('ghost', { small: true }) }}>✕</button>
                            </span>
                          ) : (
                            <span>
                              {a.cpf
                                ? a.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                                : podeEditarCpf
                                  ? <span style={{ color: theme.textMuted, fontStyle: 'italic', cursor: 'pointer' }} onClick={() => { setEditandoCpf(a.id); setEditandoCor(''); }}>+ adicionar CPF</span>
                                  : <span style={{ color: theme.textMuted, fontStyle: 'italic' }}>não informado</span>}
                              {a.cpf && podeEditarCpf && <button onClick={() => setEditandoCpf(a.id)} style={{ ...btn('ghost', { small: true }), marginLeft: 4, fontSize: 11 }}>✏️</button>}
                            </span>
                          )}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: theme.textSecondary }}>Cor/Raça:</span>
                          {podeEditarCorRaca && editandoCor === a.id ? (
                            <span>
                              <select value={a.cor_raca || ''} onChange={async e => {
                                const novaCorRaca = e.target.value;
                                setAlunos(prev => prev.map(x => x.id === a.id ? { ...x, cor_raca: novaCorRaca } : x));
                                // Auto-salva ao selecionar (sem precisar clicar 💾)
                                await api.updateAluno(a.id, { cor_raca: novaCorRaca || null });
                                setEditandoCor('');
                              }} style={{ ...input, width: 140, marginLeft: 6 }}>
                                <option value="">--</option>
                                <option value="Branca">Branca</option>
                                <option value="Preta">Preta</option>
                                <option value="Parda">Parda</option>
                                <option value="Amarela">Amarela</option>
                                <option value="Indígena">Indígena</option>
                                <option value="Não declarado">Não declarado</option>
                              </select>
                              <button onClick={() => setEditandoCor('')} style={{ ...btn('ghost', { small: true }), marginLeft: 4 }}>✕</button>
                            </span>
                          ) : (
                            <span>
                              {a.cor_raca
                                ? a.cor_raca
                                : podeEditarCorRaca
                                  ? <span style={{ color: theme.textMuted, fontStyle: 'italic', cursor: 'pointer' }} onClick={() => { setEditandoCor(a.id); setEditandoCpf(''); }}>+ adicionar</span>
                                  : <span style={{ color: theme.textMuted, fontStyle: 'italic' }}>não informado</span>}
                              {a.cor_raca && podeEditarCorRaca && <button onClick={() => setEditandoCor(a.id)} style={{ ...btn('ghost', { small: true }), marginLeft: 4, fontSize: 11 }}>✏️</button>}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {role === 'admin' && editandoId === a.id && (
                    <div className="slide-down" style={{
                      padding: '14px 16px', background: 'var(--edit-bg)',
                      borderBottom: `1px solid var(--edit-border)`,
                      display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
                      borderLeft: `3px solid ${theme.warning}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Nova situação</div>
                        <select value={novaSituacao} onChange={e => setNovaSituacao(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 14 }}>
                          {SITUACOES.map(s => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                          Início Matrícula <span style={{ color: theme.orange, fontWeight: 400 }}>(DD/MM/AAAA)</span>
                        </div>
                        <input
                          type="text" placeholder="04/02/2026"
                          value={dataInicioEdit}
                          onChange={e => setDataInicioEdit(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${dataInicioEdit ? theme.border : theme.orange}`, width: '100%', fontSize: 14 }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                          Fim Matrícula <span style={{ color: theme.textMuted, fontWeight: 400 }}>(DD/MM/AAAA)</span>
                        </div>
                        <input
                          type="text" placeholder="18/12/2026"
                          value={dataFimEdit}
                          onChange={e => setDataFimEdit(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 14 }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>Data da movimentação</div>
                        <input type="date" value={dataMovimentacao} onChange={e => setDataMovimentacao(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: theme.radius, border: `1.5px solid ${theme.border}`, width: '100%', fontSize: 14 }} />
                      </div>
                      <button onClick={() => salvarSituacao(a.id)} disabled={salvando}
                        style={btn('success', { small: true })}>
                        {salvando ? <Spinner size={16} /> : '💾 Salvar'}
                      </button>
                      <button onClick={() => setEditandoId(null)}
                        style={btn('ghost', { small: true })}>✕</button>
                    </div>
                  )}
                </div>
              );
            })()
          )}

          <div style={{ padding: '10px 16px', background: 'var(--footer-row)', fontSize: 13, color: theme.textSecondary, borderTop: `1px solid ${theme.borderLight}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <span><span style={{ fontWeight: 600 }}>{alunosFiltrados.length}</span> de <span style={{ fontWeight: 600 }}>{alunos.length}</span> aluno(s)</span>
            <span>Clique na linha para detalhes{role === 'admin' ? ' · Clique na situação para alterar' : ' · somente visualização'}</span>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
