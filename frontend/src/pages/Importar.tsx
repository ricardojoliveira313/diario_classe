import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { api, supabase } from '../api';

// Worker do PDF.js — caminho relativo p/ vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

const MES_MAP: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, MARÇO: 3, ABRIL: 4,
  MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8,
  SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function getMes(sheetName: string, row: any): number {
  const porAba = MES_MAP[sheetName.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
  if (porAba) return porAba;
  const colMes = String(row['MÊS'] ?? row['MES'] ?? row['Mês'] ?? row['mês'] ?? '')
    .toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return MES_MAP[colMes] ?? 0;
}

function fmtDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${val.getFullYear()}`;
  }
  return String(val);
}

function parseBool(val: any): boolean {
  return String(val ?? '').toUpperCase().trim() === 'SIM';
}

function normalizeStr(s: string): string {
  return s.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SITUACAO_MAP: Record<string, string> = {
  ATIVO: 'ATIVO', REMA: 'REMA', REMANEJADO: 'REMA', 'REMANEJADA': 'REMA',
  BXTR: 'BXTR', 'BAIXA TRANSF.': 'BXTR', 'BAIXA TRANSFERENCIA': 'BXTR', 'BAIXA TRANSFER\u00caNCIA': 'BXTR',
  TRAN: 'TRAN', 'TRANSF.': 'TRAN', TRANSFERIDO: 'TRAN', TRANSFERIDA: 'TRAN',
  'N COM': 'N COM', 'NAO COMPARECEU': 'N COM', 'N\u00c3O COMPARECEU': 'N COM', 'NCOM': 'N COM',
};

function normalizeSituacao(s: string): string {
  const key = normalizeStr(s);
  return SITUACAO_MAP[key] ?? SITUACAO_MAP[s.trim().toUpperCase()] ?? s.trim();
}

// ─── Registro unificado do aluno ───
interface AlunoUnificado {
  nome: string;
  nomeNorm: string;
  ra: number | null;
  nascimento: string;
  serie: string;
  professora: string;
  situacao: string;
  deficiencia: string;
  bolsaFamilia: boolean;
  dataInicioMatricula: string;
  dataFimMatricula: string;
  dataMovimentacao: string;
  nis: string;
  responsavel: string;
  faltas: Record<number, { faltas: number; frequencia: string }>;
}

const normalizeFileName = (s: string) => s.toUpperCase();

export default function Importar() {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Record<string, any> | null>(null);
  const [status, setStatus] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dadosRef = useRef<{ turmas: any[]; alunos: AlunoUnificado[]; faltasArr: any[] } | null>(null);

  // ─── PARSE: PDF ───
  async function parsePDFs(files: File[]): Promise<AlunoUnificado[]> {
    const alunos: AlunoUnificado[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      let texto = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        texto += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      // Extrai turma do PDF
      const turmaMatch = texto.match(/Turma:\s*\n?\s*(.+)/i);
      const serie = turmaMatch?.[1]?.trim() || '';
      // Extrai alunos do PDF (formato SED: Nome, RA, Data Nasc)
      const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < linhas.length; i++) {
        const nome = linhas[i];
        if (nome.length < 5 || /^\d/.test(nome)) continue;
        const raStr = linhas[i + 1]?.trim();
        const ra = parseInt(raStr) || null;
        const nascStr = linhas[i + 2]?.trim();
        if (nascStr && /^\d{2}\/\d{2}\/\d{4}$/.test(nascStr)) {
          alunos.push({
            nome, nomeNorm: normalizeStr(nome),
            ra, nascimento: nascStr,
            serie: serie, professora: '', situacao: 'ATIVO', deficiencia: '',
            bolsaFamilia: false,
            dataInicioMatricula: '', dataFimMatricula: '', dataMovimentacao: '',
            nis: '', responsavel: '',
            faltas: {},
          });
          i += 2;
        }
      }
    }
    return alunos;
  }

  // ─── PARSE: Excel ───
  function parseExcels(files: File[]): Promise<AlunoUnificado[]> {
    return new Promise((resolve) => {
      const alunos: AlunoUnificado[] = [];
      const processados = new Set<string>();
      let pendentes = 0;

      for (const file of files) {
        const name = file.name.toLowerCase();
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) continue;
        pendentes++;
        const reader = new FileReader();
        reader.onload = (e) => {
          const wb = XLSX.read(e.target!.result, { type: 'array', cellDates: true });
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'dd/mm/yyyy' }) as any[];
            for (const row of rows) {
              // Detecta formato: DIARIO CLASSE (tem FREQUÊNCIA) ou SED Relação (tem Nome do Aluno sem FREQUÊNCIA)
              const isDiario = 'FREQUÊNCIA DOS ALUNOS(A)' in row || 'FREQUENCIA DOS ALUNOS(A)' in row;
              
              const nome = String(row['NOME DO ALUNO'] ?? row['Nome do Aluno'] ?? row['Nome'] ?? '').trim();
              const serie = String(row['SÉRIE'] ?? row['SERIE'] ?? row['Série'] ?? row['Turma'] ?? '').trim();
              if (!nome) continue;
              
              const ra = parseInt(String(row['RA'] ?? row['RA'] ?? '')) || null;
              const nasc = fmtDate(row['DATA DE NASCIMENTO'] ?? row['Data de Nascimento'] ?? row['Data Nascimento']);
              const key = `${normalizeStr(nome)}|${ra}|${nasc}`;
              if (processados.has(key)) continue;
              processados.add(key);

              const mes = getMes(sheetName, row);
              let faltasQtd = 0;
              let freqTexto = '';
              if (isDiario) {
                const freqVal = String(row['FREQUÊNCIA DOS ALUNOS(A)'] ?? '').trim();
                const faltasNum = parseInt(freqVal);
                faltasQtd = isNaN(faltasNum) ? 0 : faltasNum;
                freqTexto = isNaN(faltasNum) ? freqVal : '';
              }

              const situacao = normalizeSituacao(String(row['SITUAÇÃO'] ?? row['SITUACAO'] ?? row['Situação'] ?? 'ATIVO'));
              const deficiencia = String(row['DEFICIÊNCIA'] ?? row['DEFICIENCIA'] ?? row['Deficiência'] ?? '').trim();

              alunos.push({
                nome, nomeNorm: normalizeStr(nome),
                ra, nascimento: nasc,
                serie, professora: String(row['PROFESSORA'] ?? row['Professora'] ?? '').trim(),
                situacao, deficiencia,
                bolsaFamilia: parseBool(row['BOLSA FAMÍLIA'] ?? row['BOLSA FAMILIA']),
                dataInicioMatricula: fmtDate(row['DATA INÍCIO MATRÍCULA'] ?? row['Data Início Matrícula']),
                dataFimMatricula: fmtDate(row['DATA FIM MATRÍCULA'] ?? row['Data Fim Matrícula']),
                dataMovimentacao: fmtDate(row['DATA MOVIMENTAÇÃO'] ?? row['Data Movimentação']),
                nis: '',
                responsavel: '',
                faltas: mes > 0 && faltasQtd >= 0 ? { [mes]: { faltas: faltasQtd, frequencia: freqTexto } } : {},
              });
            }
          }
          pendentes--;
          if (pendentes === 0) resolve(alunos);
        };
        reader.readAsArrayBuffer(file);
      }
      if (pendentes === 0) resolve(alunos);
    });
  }

  // ─── PARSE: Excel Turmas-Professores ───
  function parseTurmasProfessores(files: File[]): Promise<Map<string, { professor: string; periodo: string }>> {
    return new Promise((resolve) => {
      const mapa = new Map<string, { professor: string; periodo: string }>();
      let pendentes = 0;
      for (const file of files) {
        const name = normalizeFileName(file.name);
        if (!name.includes('TURMA') && !name.includes('PROFESSOR')) continue;
        if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) continue;
        pendentes++;
        const reader = new FileReader();
        reader.onload = (e) => {
          const wb = XLSX.read(e.target!.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.length < 4) continue;
            const turma = String(r[1] ?? '').trim();
            const prof = String(r[2] ?? '').trim();
            const periodo = String(r[3] ?? '').trim();
            if (turma && prof) mapa.set(normalizeStr(turma), { professor: prof, periodo });
          }
          pendentes--;
          if (pendentes === 0) resolve(mapa);
        };
        reader.readAsArrayBuffer(file);
      }
      if (pendentes === 0) resolve(mapa);
    });
  }

  // ─── PARSE: HTML SED (arquivos .xls com tabela HTML) ───
  function parseHTMLSED(files: File[]): Promise<AlunoUnificado[]> {
    return new Promise((resolve) => {
      const alunos: AlunoUnificado[] = [];
      const processados = new Set<string>();
      let pendentes = 0;
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.xls')) continue;
        pendentes++;
        const reader = new FileReader();
        reader.onload = (e) => {
          const html = e.target?.result as string;
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const allText = doc.body?.textContent || '';
          // Extrai turma do cabeçalho
          let serie = '';
          const tm = allText.match(/Turma:\s*(.+?)(?:\r|\n|$)/i);
          if (tm) serie = tm[1].trim();
          // Extrai de outra forma: procura strings tipo "1ª ETAPA PRÉ-ESCOLA" etc
          if (!serie) {
            const tf = allText.match(/(\d+[ª°º]?\s*(?:ETAPA|ANO|SÉRIE|FASE)\s*.+?(?:MANHA|TARDE|ANUAL|INTEGRAL|NOITE))/i);
            if (tf) serie = tf[1].trim();
          }
          // Pega todas as tabelas
          const tables = doc.querySelectorAll('table');
          for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            // Encontra cabeçalho com NOME e RA
            let headerIdx = -1;
            const headers: string[] = [];
            for (let i = 0; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('td, th');
              const texts = Array.from(cells).map(c => (c.textContent || '').trim().toUpperCase());
              const hasNome = texts.some(t => t.includes('NOME'));
              const hasRA = texts.some(t => t === 'RA' || t.includes('REGISTRO'));
              if (hasNome && hasRA) { headerIdx = i; headers.push(...texts); break; }
            }
            if (headerIdx < 0) continue;
            for (let i = headerIdx + 1; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('td');
              const vals = Array.from(cells).map(c => (c.textContent || '').trim());
              if (vals.length < 2) continue;
              const nome = vals[0]?.length > 3 ? vals[0] : '';
              if (!nome || /^\d/.test(nome)) continue;
              // RA está em alguma coluna
              let raStr = '', nasc = '', situ = 'ATIVO', defi = '';
              for (let j = 1; j < vals.length; j++) {
                const v = vals[j];
                if (/^\d{6,12}$/.test(v)) raStr = v;
                else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) && !nasc) nasc = v;
                else if (/^(ATIVO|N\s?COM|BAIXA|REMA|TRANSF)/.test(v.toUpperCase())) situ = v;
                else if (v.length > 2 && !/^\d/.test(v) && !nasc) defi = v;
              }
              const ra = parseInt(raStr) || null;
              const key = normalizeStr(nome) + '|' + (ra || '') + '|' + nasc;
              if (processados.has(key)) continue;
              processados.add(key);
              alunos.push({
                nome, nomeNorm: normalizeStr(nome),
                ra, nascimento: nasc, serie,
                professora: '', situacao: situ, deficiencia: defi,
                bolsaFamilia: false,
                dataInicioMatricula: '', dataFimMatricula: '', dataMovimentacao: '',
                nis: '', responsavel: '', faltas: {},
              });
            }
          }
          pendentes--;
          if (pendentes === 0) resolve(alunos);
        };
        reader.readAsText(file);
      }
      if (pendentes === 0) resolve(alunos);
    });
  }

  // ─── PARSE: PDF Bolsa Família (NIS) ───
  async function parseBolsaFamiliaPDF(files: File[]): Promise<Map<string, { nis: string; responsavel: string }>> {
    const mapa = new Map<string, { nis: string; responsavel: string }>();

    const indexar = (nome: string, nasc: string, nis: string, responsavel: string) => {
      if (nome.length < 3 || !/^\d{11}$/.test(nis)) return;
      mapa.set(`${nome}|${nasc}`, { nis, responsavel });
      const partes = nome.split(' ').filter(p => p.length > 2);
      if (partes.length >= 2) {
        mapa.set(`~${partes[0]}|${partes[partes.length - 1]}`, { nis, responsavel });
      }
    };

    for (const file of files) {
      const name = normalizeFileName(file.name);
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      if (!name.includes('FORMULARIO') && !name.includes('BOLSA')) continue;
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;

      // Usa hasEOL para preservar quebras de linha reais do PDF
      let texto = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        for (const item of content.items) {
          const it = item as any;
          texto += it.str + ((it.hasEOL || it.str.endsWith('\n')) ? '\n' : ' ');
        }
        texto += '\n';
      }

      // Abordagem 1: âncora no NIS → busca Nome: e Dt. Nasc.: imediatamente antes
      const nisRe = /\bNIS:\s*(\d{11})/g;
      let m: RegExpExecArray | null;
      while ((m = nisRe.exec(texto)) !== null) {
        const nis = m[1];
        const endPos = m.index;
        const lookback = texto.substring(Math.max(0, endPos - 800), endPos);

        const lastNomeIdx = lookback.lastIndexOf('Nome:');
        if (lastNomeIdx < 0) continue;
        const afterNome = lookback.substring(lastNomeIdx + 5).trimStart();
        const nameStop = afterNome.search(/Dt\.\s*Nasc\.|NIS:|S[eé]rie:|Respons/);
        const nome = normalizeStr((nameStop > 0 ? afterNome.substring(0, nameStop) : afterNome).trim());

        const nascMatches = [...lookback.matchAll(/Dt\.\s*Nasc\.:\s*(\d{2}\/\d{2}\/\d{4})/g)];
        const nasc = nascMatches.length > 0 ? nascMatches[nascMatches.length - 1][1] : '';

        indexar(nome, nasc, nis, '');
      }

      // Abordagem 2 (fallback): split por bloco
      if (mapa.size < 5) {
        const blocos = texto.split(/(?=\bNome:\s)/);
        for (const bloco of blocos) {
          if (!bloco.includes('Nome:')) continue;
          const nomeM = bloco.match(/\bNome:\s*(.+?)(?=\s*Dt\.\s*Nasc\.|\s*NIS:|\s*S[eé]rie:|\s*Respons|$)/s);
          const nascM = bloco.match(/Dt\.\s*Nasc\.:\s*(\d{2}\/\d{2}\/\d{4})/);
          const nisM = bloco.match(/\bNIS:\s*(\d{11})/);
          if (nomeM?.[1] && nisM?.[1]) {
            indexar(normalizeStr(nomeM[1].trim()), nascM?.[1] ?? '', nisM[1], '');
          }
        }
      }
    }
    return mapa;
  }
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setFiles(prev => [...prev, ...Array.from(fileList)]);
    setErro('');
    setSucesso(false);
    setPreview(null);
    dadosRef.current = null;
  };

  const removerArquivo = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreview(null);
  };

  // ─── ANALISAR ───
  const analisar = async () => {
    if (files.length === 0) { setErro('Adicione ao menos 1 arquivo.'); return; }
    setErro('');
    setStatus('Analisando arquivos...');
    try {
      const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      const xlsFiles = files.filter(f => f.name.toLowerCase().endsWith('.xls'));
      const xlsxFiles = files.filter(f => f.name.toLowerCase().endsWith('.xlsx'));

      const [alunosPDF, alunosHTML, alunosExcel, turmasMap, bolsaMap] = await Promise.all([
        parsePDFs(pdfFiles),
        parseHTMLSED(xlsFiles),
        parseExcels(xlsxFiles),
        parseTurmasProfessores(files),
        parseBolsaFamiliaPDF(pdfFiles),
      ]);

      // ─── Cruzamento ───
      const todosAlunos = new Map<string, AlunoUnificado>();
      // Prioridade: Excel primeiro (dados mais completos), depois PDF
      const mergeAluno = (a: AlunoUnificado) => {
        const key = `${a.nomeNorm}|${a.ra}|${a.nascimento}`;
        if (todosAlunos.has(key)) {
          const existente = todosAlunos.get(key)!;
          existente.bolsaFamilia = existente.bolsaFamilia || a.bolsaFamilia;
          existente.nis = existente.nis || a.nis;
          existente.responsavel = existente.responsavel || a.responsavel;
          existente.professora = existente.professora || a.professora;
          existente.situacao = a.situacao !== 'ATIVO' ? a.situacao : existente.situacao;
          existente.deficiencia = existente.deficiencia || a.deficiencia;
          Object.assign(existente.faltas, a.faltas);
        } else {
          todosAlunos.set(key, a);
        }
      };
      alunosExcel.forEach(mergeAluno);
      alunosHTML.forEach(mergeAluno);
      alunosPDF.forEach(mergeAluno);

      // Enriquece com professor da tabela TURMA-PROFESSORES
      const alunosArr = Array.from(todosAlunos.values());
      for (const a of alunosArr) {
        const tp = turmasMap.get(normalizeStr(a.serie));
        if (tp) {
          if (tp.professor && !a.professora) a.professora = tp.professor;
        }
        // Enriquece com NIS do Bolsa Família — 3 tentativas de cruzamento
        const bfExato = bolsaMap.get(`${a.nomeNorm}|${a.nascimento}`);
        const partes = a.nomeNorm.split(' ').filter((p: string) => p.length > 2);
        const bfFuzzy = partes.length >= 2 ? bolsaMap.get(`~${partes[0]}|${partes[partes.length - 1]}`) : undefined;
        const bf = bfExato ?? bfFuzzy;
        if (bf) {
          a.nis = a.nis || bf.nis;
          a.responsavel = a.responsavel || bf.responsavel;
          a.bolsaFamilia = true;
        }
      }

      // Turmas únicas
      const turmasUnicas = new Map<string, { nome: string; professora: string }>();
      for (const a of alunosArr) {
        if (!turmasUnicas.has(a.serie)) {
          turmasUnicas.set(a.serie, { nome: a.serie, professora: a.professora });
        }
      }

      // Conta faltas
      let totalFaltas = 0;
      for (const a of alunosArr) totalFaltas += Object.keys(a.faltas).length;

      const prev = {
        turmas: turmasUnicas.size,
        alunos: alunosArr.length,
        bolsaFamilia: alunosArr.filter(a => a.bolsaFamilia).length,
        bolsaMapSize: bolsaMap.size,
        arquivos: files.length,
        faltas: totalFaltas,
      };
      setPreview(prev);
      dadosRef.current = { turmas: Array.from(turmasUnicas.values()), alunos: alunosArr, faltasArr: [] };
      setStatus('');
    } catch (ex: any) {
      setErro('Erro na análise: ' + ex.message);
      setStatus('');
    }
  };

  // ─── IMPORTAR ───
  const importar = async () => {
    if (!dadosRef.current) return;
    const { turmas, alunos } = dadosRef.current;
    setErro('');
    setSucesso(false);
    setTotal(alunos.length);
    setProgresso(0);

    try {
      setStatus('Limpando dados anteriores...');
      await api.clearAll();

      setStatus('Inserindo turmas...');
      const turmasInseridas = await api.bulkInsertTurmas(turmas.map(t => ({ nome: t.nome, professora: t.professora })));
      const serieToId = new Map<string, string>(turmasInseridas.map((t: any) => [t.nome, t.id]));

      setStatus('Inserindo alunos...');
      const alunosInsert = alunos.map(a => ({
        nome: a.nome, turmaId: serieToId.get(a.serie) ?? null,
        ra: a.ra, numero: 0,
        data_nascimento: a.nascimento,
        data_inicio_matricula: a.dataInicioMatricula,
        data_fim_matricula: a.dataFimMatricula,
        data_movimentacao: a.dataMovimentacao,
        deficiencia: a.deficiencia, situacao: a.situacao,
        bolsa_familia: a.bolsaFamilia, professora: a.professora,
        nis: a.nis || null, responsavel: a.responsavel || null,
      }));

      await api.bulkInsertAlunos(alunosInsert, (n) => {
        setProgresso(n);
        setStatus(`Inserindo alunos... ${n}/${alunos.length}`);
      });

      // Buscar IDs dos alunos inseridos
      const { data: alunosDb } = await supabase.from('Aluno').select('id, ra, nome');
      const raToId = new Map<string, string>();
      const nomeToId = new Map<string, string>();
      for (const a of (alunosDb ?? [])) {
        if (a.ra) raToId.set(String(a.ra), a.id);
        nomeToId.set(normalizeStr(a.nome), a.id);
      }

      // Inserir faltas
      const faltasParaInserir: any[] = [];
      for (const a of alunos) {
        const alunoId = raToId.get(String(a.ra ?? '')) ?? nomeToId.get(a.nomeNorm);
        const turmaId = serieToId.get(a.serie);
        if (!alunoId || !turmaId) continue;
        for (const [mes, f] of Object.entries(a.faltas)) {
          faltasParaInserir.push({
            alunoId, turmaId,
            mes: Number(mes), ano: 2026,
            faltas: f.faltas, frequencia: f.frequencia,
          });
        }
      }

      setStatus(`Inserindo ${faltasParaInserir.length} registros de frequência...`);
      await api.bulkInsertFaltas(faltasParaInserir);

      setStatus('');
      setSucesso(true);
    } catch (ex: any) {
      setErro('Erro na importação: ' + ex.message);
      setStatus('');
    }
  };

  const s = (n: number) => (
    <span style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{n}</span>
  );

  return (
    <div style={{ marginTop: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>📥 Importar Dados da SED</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
        Selecione todos os arquivos exportados da Secretaria Escolar Digital:
        PDFs (Alunos por Classe, Bolsa Família) + Excels (Diário de Classe, Turmas-Professores).
        O sistema cruza automaticamente por nome, RA e data de nascimento.
      </p>

      {/* Upload zone */}
      <div style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: files.length > 0 ? 16 : 40, textAlign: 'center', marginBottom: 16, background: '#f8fafc', cursor: 'pointer' }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#1e40af'; }}
        onDragLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#cbd5e1'; handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.pdf"
          style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <p style={{ fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Clique ou arraste arquivos aqui'}
        </p>
        <p style={{ fontSize: 12, color: '#64748b' }}>.xlsx .xls .pdf — múltiplos arquivos</p>
      </div>

      {/* Lista de arquivos */}
      {files.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'white', borderRadius: 8, marginBottom: 4, fontSize: 13 }}>
          <span>{f.name.endsWith('.pdf') ? '📄' : f.name.endsWith('.xlsx') ? '📊' : '📋'}</span>
          <span style={{ flex: 1 }}>{f.name}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{(f.size / 1024).toFixed(0)} KB</span>
          <button onClick={() => removerArquivo(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>✕</button>
        </div>
      ))}

      {files.length > 0 && !preview && !status && (
        <button onClick={analisar}
          style={{ padding: '12px 24px', borderRadius: 8, background: '#1e40af', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, marginTop: 12, width: '100%' }}>
          🔍 Analisar Arquivos
        </button>
      )}

      {status && !sucesso && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <p style={{ color: '#64748b', marginBottom: 8 }}>{status}</p>
          {total > 0 && (
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
              <div style={{ height: '100%', background: '#1e40af', transition: 'width 0.2s', width: `${(progresso / total) * 100}%`, borderRadius: 4 }} />
            </div>
          )}
        </div>
      )}

      {/* Preview do cruzamento */}
      {preview && !sucesso && (
        <div style={{ marginTop: 16, background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📊 Resultado do Cruzamento</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            {[
              ['🏫 Turmas', preview.turmas],
              ['👥 Alunos', preview.alunos],
              ['🟢 Bolsa Família', preview.bolsaFamilia],
              ['📄 No PDF BF', preview.bolsaMapSize ?? 0],
              ['📋 Registros Faltas', preview.faltas],
              ['📂 Arquivos', preview.arquivos],
            ].map(([label, val]) => (
              <div key={label as string} style={{ textAlign: 'center', padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{(val as number)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => { setPreview(null); dadosRef.current = null; }} style={{ flex: 1, padding: 12, borderRadius: 8, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 600 }}>
              Reanalisar
            </button>
            <button onClick={importar} style={{ flex: 2, padding: 12, borderRadius: 8, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
              Confirmar Importação (apaga dados anteriores)
            </button>
          </div>
        </div>
      )}

      {sucesso && (
        <div style={{ marginTop: 16, background: '#f0fdf4', borderRadius: 12, padding: 24, textAlign: 'center', border: '2px solid #16a34a' }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', marginTop: 8 }}>Importação concluída!</p>
          {preview && <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {preview.turmas} turmas, {preview.alunos} alunos, {preview.faltas} registros de frequência
          </p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
            <a href="/alunos" style={{ padding: '10px 20px', borderRadius: 8, background: '#1e40af', color: 'white', textDecoration: 'none', fontWeight: 600 }}>👥 Ver Alunos</a>
            <a href="/faltas" style={{ padding: '10px 20px', borderRadius: 8, background: '#16a34a', color: 'white', textDecoration: 'none', fontWeight: 600 }}>📋 Lançar Faltas</a>
          </div>
        </div>
      )}

      {erro && (
        <div style={{ marginTop: 16, padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #dc2626', color: '#dc2626', fontSize: 13 }}>
          {erro}
        </div>
      )}
    </div>
  );
}
