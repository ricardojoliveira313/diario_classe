import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { theme, btn, input, label, SITUACAO_LABEL } from '../styles';
import { Loading, EmptyState, StatCard } from '../components';
import { useAno } from '../AnoContext';
import { useAuth } from '../AuthContext';
import { estavaMatriculadoNaData } from '../educacensoCorte';

type Status = 'P' | 'F' | 'J' | 'A';
const CICLO: Status[] = ['P', 'F', 'J', 'A'];
const decodeDias = (freq: string): Status[] => {
  if (!freq?.startsWith('DIAS:')) return [];
  return freq.slice(5).split('').filter(c => CICLO.includes(c as Status)) as Status[];
};
const ct = (dias: Status[], tipo: Status) => dias.filter(d => d === tipo).length;
const maxFaltasConsecutivas = (dias: Status[]) => {
  let max = 0, atual = 0;
  for (const d of dias) { atual = d === 'F' ? atual + 1 : 0; if (atual > max) max = atual; }
  return max;
};

function normalizeNome(s: string): string {
  return String(s ?? '').toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-]/g, ' ').replace(/[.]/g, '')
    .replace(/[‘’`´']/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function matchScoreNome(a: string, b: string): number {
  const na = normalizeNome(a).split(' ').filter(Boolean);
  const nb = normalizeNome(b).split(' ').filter(Boolean);
  if (na.length === 0 || nb.length === 0) return 0;
  const intersect = na.filter(w => nb.includes(w)).length;
  return intersect / Math.max(na.length, nb.length);
}
// Normaliza qualquer formato de data (DD/MM/YYYY, Date do Excel, etc.) para dígitos AAAAMMDD
function normalizarDataDigits(d: any): string {
  if (d instanceof Date) {
    const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }
  const digs = String(d ?? '').replace(/[^0-9]/g, '');
  if (digs.length !== 8) return digs;
  const pre = parseInt(digs.slice(0, 4), 10);
  if (pre >= 1900 && pre <= 2100) return digs;
  return `${digs.slice(4)}${digs.slice(2, 4)}${digs.slice(0, 2)}`;
}


// A data de matrícula vem do cadastro em dd/mm/aaaa ou aaaa-mm-dd (ISO) —
// normaliza pra exibição sempre em dd/mm/aaaa, sem quebrar se vier vazia.
function formatarDataMatricula(valor: any): string {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return texto;
}

interface LinhaEduc {
  nome: string;
  dataNascimento: any;
  cpf: string;
  corRaca: string;
  turmaNome: string;
  etapa: string;
  // "Identificação Única" — segundo o manual do Educacenso, é o mesmo número
  // do R.A. do aluno. Serve tanto pra localizar o aluno exato (sem depender
  // só do nome) quanto pra detectar duplicidade de Identificação Única.
  identificacaoUnica: string;
}

type StatusLinha = 'bate' | 'so_sed' | 'so_educacenso' | 'divergencia';

interface LinhaResultado {
  status: StatusLinha;
  aluno: any | null;
  educ: LinhaEduc | null;
  divergencias: string[];
  frequenciaHint: string | null;
  // Explica uma linha "só no SED" ou "só no Educacenso": procura, entre TODOS
  // os registros do aluno (ativos ou não), uma situação de saída (TRAN, BXTR,
  // REMA, ABAN) que explique o motivo de ele não bater na data-base — ex.:
  // "Foi transferido em 12/04/2026" — sem isso a linha só dizia "não achei",
  // sem dizer pra onde o aluno foi nem quando.
  contextoHistorico: string | null;
}

// Procura o índice da linha de cabeçalho (a planilha oficial do Educacenso tem
// linhas em branco/título antes da linha com os nomes das colunas).
function acharCabecalho(rows: any[][]): number {
  // O export oficial "Relação de Alunos" do Educacenso tem o cabeçalho real
  // por volta da linha 21 (metadados/título antes) — 10 linhas era pouco e
  // recusava o arquivo oficial (achado da auditoria de ago/2026).
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const linha = (rows[i] ?? []).map(c => String(c ?? '').trim().toLowerCase());
    if (linha.includes('nome') && linha.some(c => c.startsWith('data de nascimento'))) return i;
  }
  return -1;
}

function achaColuna(cabecalho: string[], termos: string[]): number {
  return cabecalho.findIndex(c => termos.some(t => c.toLowerCase().includes(t.toLowerCase())));
}

// Versão enxuta do resultado, salva no banco — guarda só o que a tela e as
// exportações realmente usam (nome, RA, CPF, turma), não o registro Aluno
// inteiro, pra manter o JSON leve.
function serializarResultado(resultado: LinhaResultado[]) {
  return resultado.map(l => ({
    status: l.status,
    aluno: l.aluno ? { nome: l.aluno.nome, ra: l.aluno.ra, cpf: l.aluno.cpf, turmaId: l.aluno.turmaId, data_inicio_matricula: l.aluno.data_inicio_matricula } : null,
    educ: l.educ ? { nome: l.educ.nome, turmaNome: l.educ.turmaNome, identificacaoUnica: l.educ.identificacaoUnica } : null,
    divergencias: l.divergencias,
    frequenciaHint: l.frequenciaHint,
    contextoHistorico: l.contextoHistorico,
  }));
}
function desserializarResultado(resultado: any[]): LinhaResultado[] {
  return (resultado ?? []).map(l => ({
    status: l.status,
    aluno: l.aluno,
    educ: l.educ ? { nome: l.educ.nome ?? '', dataNascimento: '', cpf: '', corRaca: '', turmaNome: l.educ.turmaNome ?? '', etapa: '', identificacaoUnica: l.educ.identificacaoUnica ?? '' } : null,
    divergencias: l.divergencias ?? [],
    frequenciaHint: l.frequenciaHint ?? null,
    contextoHistorico: l.contextoHistorico ?? null,
  }));
}

export default function Educacenso() {
  const { ano } = useAno();
  const { username } = useAuth();
  const [dataCorte, setDataCorte] = useState(`${ano}-05-27`);
  // Sincroniza a data-base com o ano letivo global — sem isso, trocar o ano
  // no seletor do topo sem recarregar a página deixava a data-base "presa"
  // no ano anterior (achado da auditoria de ago/2026).
  useEffect(() => { setDataCorte(`${ano}-05-27`); }, [ano]);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [linhasEduc, setLinhasEduc] = useState<LinhaEduc[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<LinhaResultado[] | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<StatusLinha | ''>('');
  const [salvoInfo, setSalvoInfo] = useState<{ por: string; em: string } | null>(null);

  // Recupera o último cruzamento salvo deste ano letivo — sem isso, trocar de
  // aba (Alunos, Faltas etc.) e voltar, ou fechar o navegador, fazia o
  // resultado inteiro desaparecer (ficava só em memória do React).
  useEffect(() => {
    api.getCruzamentoEducacenso(ano).then(salvo => {
      if (!salvo) { setResultado(null); setSalvoInfo(null); return; }
      setResultado(desserializarResultado(salvo.resultado));
      setNomeArquivo(salvo.nome_arquivo ?? '');
      if (salvo.data_corte) setDataCorte(salvo.data_corte);
      setSalvoInfo({ por: salvo.criado_por ?? 'desconhecido', em: salvo.criado_em });
    });
  }, [ano]);

  const importarArquivo = async (file: File) => {
    setErro('');
    setResultado(null);
    setNomeArquivo(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      const idxCab = acharCabecalho(rows);
      if (idxCab === -1) {
        setErro('Não encontrei as colunas esperadas ("Nome", "Data de nascimento") no arquivo. Confira se é o export oficial "Relação de Alunos" do Educacenso.');
        setLinhasEduc(null);
        return;
      }
      const cabecalho = rows[idxCab].map(c => String(c ?? '').trim());
      const iNome = achaColuna(cabecalho, ['nome']);
      const iNasc = achaColuna(cabecalho, ['data de nascimento']);
      const iCpf = achaColuna(cabecalho, ['cpf']);
      const iCorRaca = achaColuna(cabecalho, ['cor/raça', 'cor/raca']);
      const iTurma = achaColuna(cabecalho, ['nome da turma']);
      const iEtapa = achaColuna(cabecalho, ['etapa de ensino']);
      const iIdUnica = achaColuna(cabecalho, ['identificação única', 'identificacao unica']);

      const linhas: LinhaEduc[] = [];
      for (let i = idxCab + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[iNome]) continue;
        linhas.push({
          nome: String(r[iNome] ?? '').trim(),
          dataNascimento: r[iNasc],
          cpf: iCpf >= 0 ? String(r[iCpf] ?? '').replace(/\D/g, '') : '',
          corRaca: iCorRaca >= 0 ? String(r[iCorRaca] ?? '').trim() : '',
          turmaNome: iTurma >= 0 ? String(r[iTurma] ?? '').trim() : '',
          etapa: iEtapa >= 0 ? String(r[iEtapa] ?? '').trim() : '',
          identificacaoUnica: iIdUnica >= 0 ? String(r[iIdUnica] ?? '').trim() : '',
        });
      }
      if (linhas.length === 0) {
        setErro('Nenhuma linha de aluno encontrada no arquivo.');
        setLinhasEduc(null);
        return;
      }
      setLinhasEduc(linhas);
    } catch (e: any) {
      setErro(`Erro ao ler o arquivo: ${e?.message ?? e}`);
      setLinhasEduc(null);
    }
  };

  // Aproximação: verifica, dentro do MÊS da data-base, se o aluno teve alguma
  // presença e qual a maior sequência de faltas seguidas. Não recorta pelo dia
  // exato da data-base (isso exigiria remontar o calendário letivo dia a dia) —
  // serve como indicativo para o operador confirmar o caso manualmente.
  const calcularFrequenciaHint = async (alunoId: string, mesCorte: number, anoCorte: number): Promise<string> => {
    const registros = await api.getFaltasAluno(alunoId, anoCorte);
    const registroMes = registros.find((r: any) => r.mes === mesCorte);
    if (!registroMes?.frequencia?.startsWith('DIAS:')) return 'Sem lançamento no mês da data-base — confira o diário manualmente.';
    const dias = decodeDias(registroMes.frequencia);
    const presencas = ct(dias, 'P');
    const maxSeguidas = maxFaltasConsecutivas(dias);
    if (presencas === 0) return '⚠️ Nenhuma presença lançada no mês — provável DESCONSIDERAR.';
    if (maxSeguidas >= 15) return `⚠️ ${maxSeguidas} faltas seguidas no mês — possível DESCONSIDERAR (confirme a data exata).`;
    return `✅ ${presencas} presença(s) no mês — provável CONFIRMAR.`;
  };

  // Explica um "só no Educacenso" (aluno consta no arquivo oficial, mas não
  // bateu com nenhum aluno ativo na data-base): procura, entre TODOS os
  // registros já cadastrados dessa pessoa (ativos ou não — diferente do
  // `alunosAtivos` usado no cruzamento principal), um registro de saída
  // (transferido, remanejado, baixa, abandono) que explique o motivo — pra
  // não deixar a dúvida "sumiu, mas foi pra onde?" sem resposta.
  function explicarAusencia(todosAlunos: any[], nome: string, nascimentoDigits: string): string | null {
    const candidatos = todosAlunos.filter(a =>
      normalizarDataDigits(a.data_nascimento) === nascimentoDigits && matchScoreNome(a.nome, nome) >= 0.7
    );
    if (candidatos.length === 0) return null;
    const comSaida = candidatos.find(a => a.situacao && a.situacao !== 'ATIVO');
    if (!comSaida) return null;
    const rotulo = SITUACAO_LABEL[comSaida.situacao] ?? comSaida.situacao;
    const data = formatarDataMatricula(comSaida.data_movimentacao || comSaida.data_fim_matricula);
    return `${rotulo}${data ? ` em ${data}` : ''} (RA ${comSaida.ra ?? '—'})`;
  }

  const cruzar = async () => {
    if (!linhasEduc) return;
    setCarregando(true);
    setResultado(null);
    try {
      const [anoCorteStr, mesCorteStr, diaCorteStr] = dataCorte.split('-');
      const anoCorte = Number(anoCorteStr), mesCorte = Number(mesCorteStr);
      const dataCorteDate = new Date(anoCorte, mesCorte - 1, Number(diaCorteStr));
      const todosAlunos = await api.getAllAlunos();
      const alunosAtivos = (todosAlunos ?? []).filter((a: any) => estavaMatriculadoNaData(a, dataCorteDate));
      const usados = new Set<string>();
      const linhas: LinhaResultado[] = [];

      for (const educ of linhasEduc) {
        const nascEduc = normalizarDataDigits(educ.dataNascimento);
        let melhorAluno: any = null;
        let melhorScore = 0;
        for (const a of alunosAtivos) {
          if (usados.has(a.id)) continue;
          if (nascEduc && normalizarDataDigits(a.data_nascimento) !== nascEduc) continue;
          const score = matchScoreNome(a.nome, educ.nome);
          if (score > melhorScore) { melhorScore = score; melhorAluno = a; }
        }
        if (melhorAluno && melhorScore >= 0.7) {
          usados.add(melhorAluno.id);
          const divergencias: string[] = [];
          if (educ.cpf && melhorAluno.cpf && educ.cpf !== String(melhorAluno.cpf).replace(/\D/g, '')) divergencias.push('CPF diferente');
          if (educ.corRaca && melhorAluno.cor_raca && normalizeNome(educ.corRaca) !== normalizeNome(melhorAluno.cor_raca)) divergencias.push('Cor/Raça diferente');
          // Compara só os dígitos, sem zeros à esquerda — a Identificação Única do
          // Educacenso costuma vir com zeros à esquerda (tamanho fixo) enquanto o RA
          // cadastrado no SED não, o que gerava divergência falsa em quase todo mundo.
          const raSemZeros = String(melhorAluno.ra ?? '').replace(/\D/g, '').replace(/^0+/, '');
          const idSemZeros = educ.identificacaoUnica.replace(/\D/g, '').replace(/^0+/, '');
          if (idSemZeros && raSemZeros && idSemZeros !== raSemZeros) divergencias.push(`RA diferente da Identificação Única do Educacenso (${educ.identificacaoUnica})`);
          linhas.push({
            status: divergencias.length > 0 ? 'divergencia' : 'bate',
            aluno: melhorAluno, educ, divergencias, frequenciaHint: null, contextoHistorico: null,
          });
        } else {
          const contexto = explicarAusencia(todosAlunos, educ.nome, nascEduc);
          linhas.push({ status: 'so_educacenso', aluno: null, educ, divergencias: [], frequenciaHint: null, contextoHistorico: contexto });
        }
      }
      for (const a of alunosAtivos) {
        if (!usados.has(a.id)) {
          linhas.push({ status: 'so_sed', aluno: a, educ: null, divergencias: [], frequenciaHint: null, contextoHistorico: null });
        }
      }

      // Calcula a dica de frequência só para os casos de dúvida (só SED / só Educacenso) —
      // evita disparar uma consulta por aluno para a lista inteira.
      const duvidosos = linhas.filter(l => l.status === 'so_sed' && l.aluno);
      for (const l of duvidosos) {
        l.frequenciaHint = await calcularFrequenciaHint(l.aluno.id, mesCorte, anoCorte);
      }

      linhas.sort((a, b) => {
        const ordem: Record<StatusLinha, number> = { divergencia: 0, so_educacenso: 1, so_sed: 2, bate: 3 };
        if (ordem[a.status] !== ordem[b.status]) return ordem[a.status] - ordem[b.status];
        const nomeA = a.aluno?.nome ?? a.educ?.nome ?? '';
        const nomeB = b.aluno?.nome ?? b.educ?.nome ?? '';
        return nomeA.localeCompare(nomeB, 'pt-BR');
      });
      setResultado(linhas);
      const agora = new Date().toISOString();
      await api.salvarCruzamentoEducacenso(ano, dataCorte, nomeArquivo, serializarResultado(linhas), username ?? 'desconhecido');
      setSalvoInfo({ por: username ?? 'desconhecido', em: agora });
    } finally {
      setCarregando(false);
    }
  };

  const exportarExcel = () => {
    if (!resultado) return;
    const dados = resultado.map(l => ({
      Status: { bate: 'Bate', so_sed: 'Só no SED', so_educacenso: 'Só no Educacenso', divergencia: 'Divergência' }[l.status],
      'Nome (SED)': l.aluno?.nome ?? '',
      RA: l.aluno?.ra ?? '',
      'Data de Matrícula': formatarDataMatricula(l.aluno?.data_inicio_matricula),
      Turma: l.aluno?.turmaId ?? '',
      'Nome (Educacenso)': l.educ?.nome ?? '',
      'Identificação Única (Educacenso)': l.educ?.identificacaoUnica ?? '',
      'Turma (Educacenso)': l.educ?.turmaNome ?? '',
      Divergências: l.divergencias.join('; '),
      'Dica de frequência': l.frequenciaHint ?? '',
      'Motivo (histórico no SED)': l.contextoHistorico ?? '',
    }));
    const wsOut = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsOut, 'Conferência Educacenso');
    XLSX.writeFile(wb, `Conferencia_Educacenso_${ano}.xlsx`);
  };

  const BADGE_LABEL: Record<StatusLinha, string> = {
    bate: 'Bate', so_sed: 'Só no SED', so_educacenso: 'Só no Educacenso', divergencia: 'Divergência',
  };

  const exportarPDF = () => {
    if (!resultado) return;
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const linhasHtml = resultado.map(l => `
      <tr>
        <td>${esc(BADGE_LABEL[l.status])}</td>
        <td>${esc(l.aluno?.ra ? String(l.aluno.ra) : '—')}</td>
        <td>${esc(l.aluno?.nome ?? '—')}</td>
        <td>${esc(formatarDataMatricula(l.aluno?.data_inicio_matricula) || '—')}</td>
        <td>${esc(l.educ?.nome ?? '—')}</td>
        <td>${esc(l.educ?.identificacaoUnica || '—')}</td>
        <td>${esc([...l.divergencias, l.frequenciaHint, l.contextoHistorico].filter(Boolean).join(' · '))}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Conferência Educacenso ${ano}</title>
<style>
  @page{size:A4 landscape;margin:10mm}
  body{font-family:Arial,sans-serif;color:#111;margin:0}
  h1{font-size:16px;margin:0 0 4px}
  p{font-size:11px;color:#555;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
  th{background:#1e40af;color:#fff}
  tr:nth-child(even){background:#f5f5f5}
</style></head><body>
  <h1>Conferência Educacenso — ${ano}</h1>
  <p>Data-base do Censo (corte): ${dataCorte.split('-').reverse().join('/')} — arquivo: ${nomeArquivo || '—'}</p>
  <table><thead><tr><th>Status</th><th>RA</th><th>Nome (SED)</th><th>Data de Matrícula</th><th>Nome (Educacenso)</th><th>Identificação Única</th><th>Detalhe</th></tr></thead>
  <tbody>${linhasHtml}</tbody></table>
  <script>setTimeout(()=>window.print(),400);</script>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups no navegador para abrir o PDF.'); return; }
    win.document.write(html);
    win.document.close();
  };

  const contagem = resultado ? {
    bate: resultado.filter(l => l.status === 'bate').length,
    so_sed: resultado.filter(l => l.status === 'so_sed').length,
    so_educacenso: resultado.filter(l => l.status === 'so_educacenso').length,
    divergencia: resultado.filter(l => l.status === 'divergencia').length,
  } : null;

  const linhasFiltradas = resultado ? (filtro ? resultado.filter(l => l.status === filtro) : resultado) : [];

  const BADGE: Record<StatusLinha, { label: string; cor: string; bg: string }> = {
    bate: { label: '✅ Bate', cor: theme.success, bg: `${theme.success}18` },
    so_sed: { label: '⚠️ Só no SED', cor: theme.orange, bg: `${theme.orange}18` },
    so_educacenso: { label: '⚠️ Só no Educacenso', cor: theme.orange, bg: `${theme.orange}18` },
    divergencia: { label: '🔴 Divergência', cor: theme.danger, bg: `${theme.danger}18` },
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <div style={{ background: theme.card, borderRadius: theme.radiusMd, padding: 20, marginBottom: 16, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}` }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginBottom: 6 }}>🔗 Conferência Educacenso</h1>
        <p style={{ color: theme.textMuted, marginBottom: 18, fontSize: 13.5 }}>
          Cruza o cadastro de alunos do app (SED) com o export oficial "Relação de Alunos" do Educacenso, por nome + data de
          nascimento — sem precisar montar a comparação manualmente linha a linha.
        </p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={label}>Arquivo oficial "Relação de Alunos" (.xlsx)</label>
            <input
              type="file" accept=".xlsx,.xls"
              onChange={e => e.target.files?.[0] && importarArquivo(e.target.files[0])}
              style={{ ...input, padding: '6px 10px' }}
            />
          </div>
          <div>
            <label style={label}>Data-base do Censo (corte)</label>
            <input type="date" style={{ ...input, width: 180 }} value={dataCorte} onChange={e => setDataCorte(e.target.value)} />
          </div>
          <button style={btn('primary')} disabled={!linhasEduc || carregando} onClick={cruzar}>
            {carregando ? 'Cruzando...' : '🔍 Cruzar SED × Educacenso'}
          </button>
          {resultado && (
            <>
              <button style={btn('success', { outline: true })} onClick={exportarExcel}>📊 Exportar Excel</button>
              <button style={btn('danger', { outline: true })} onClick={exportarPDF}>🖨️ Exportar PDF</button>
            </>
          )}
        </div>
        {nomeArquivo && !erro && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: theme.textMuted }}>
            📄 {nomeArquivo} — {linhasEduc?.length ?? 0} aluno(s) lido(s) do Educacenso.
          </div>
        )}
        {salvoInfo && resultado && (
          <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
            💾 Cruzamento salvo — por {salvoInfo.por}, em {new Date(salvoInfo.em).toLocaleString('pt-BR')}. Fica salvo mesmo trocando de aba ou fechando o navegador.
          </div>
        )}
        {erro && <div style={{ marginTop: 10, color: theme.danger, fontSize: 13, fontWeight: 600 }}>{erro}</div>}
      </div>

      {carregando && <Loading />}

      {!carregando && resultado && contagem && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard label="✅ Bate" val={contagem.bate} color={theme.success} onClick={() => setFiltro(filtro === 'bate' ? '' : 'bate')} active={filtro === 'bate'} />
            <StatCard label="⚠️ Só no SED" val={contagem.so_sed} color={theme.orange} onClick={() => setFiltro(filtro === 'so_sed' ? '' : 'so_sed')} active={filtro === 'so_sed'} />
            <StatCard label="⚠️ Só no Educacenso" val={contagem.so_educacenso} color={theme.orange} onClick={() => setFiltro(filtro === 'so_educacenso' ? '' : 'so_educacenso')} active={filtro === 'so_educacenso'} />
            <StatCard label="🔴 Divergência" val={contagem.divergencia} color={theme.danger} onClick={() => setFiltro(filtro === 'divergencia' ? '' : 'divergencia')} active={filtro === 'divergencia'} />
          </div>

          {linhasFiltradas.length === 0 ? (
            <EmptyState icon="✅" message="Nenhum registro nessa categoria." />
          ) : (
            <div style={{ background: theme.card, borderRadius: theme.radiusMd, boxShadow: theme.shadow, border: `1px solid ${theme.borderLight}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: theme.primary }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>RA</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Nome (SED)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Data de Matrícula</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Nome (Educacenso)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Identificação Única</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 13 }}>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.map((l, i) => {
                    const b = BADGE[l.status];
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.06)' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: b.bg, color: b.cor }}>
                            {b.label}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: theme.text, fontWeight: 600 }}>{l.aluno?.ra ?? '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: theme.text }}>{l.aluno?.nome ?? '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: theme.text }}>{formatarDataMatricula(l.aluno?.data_inicio_matricula) || '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: theme.text }}>{l.educ?.nome ?? '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: theme.text }}>{l.educ?.identificacaoUnica || '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12.5, color: theme.textMuted }}>
                          {l.divergencias.length > 0 && <div>{l.divergencias.join(' · ')}</div>}
                          {l.frequenciaHint && <div>{l.frequenciaHint}</div>}
                          {l.contextoHistorico && <div style={{ fontWeight: 600, color: theme.danger }}>{l.contextoHistorico}</div>}
                          {l.status === 'so_educacenso' && !l.frequenciaHint && !l.contextoHistorico && 'Consta no Educacenso mas não no cadastro atual — confira se foi transferido/saiu.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
