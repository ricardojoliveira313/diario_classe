import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { api, supabase } from '../api';
import { theme, btn, card as cardStyle } from '../styles';
import { FileRow, ProgressBar, ErrorBox, Spinner } from '../components';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

const MES_MAP: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, MARÇO: 3, ABRIL: 4,
  MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8,
  SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function getMes(sheetName: string, row: any): number {
  const colMes = String(row['MÊS'] ?? row['MES'] ?? row['Mês'] ?? row['mês'] ?? '')
    .toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (colMes && MES_MAP[colMes]) return MES_MAP[colMes];
  const porAba = MES_MAP[sheetName.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
  return porAba ?? 0;
}

function fmtDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${val.getFullYear()}`;
  }
  const s = String(val).trim();
  const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dm) return `${dm[1].padStart(2,'0')}/${dm[2].padStart(2,'0')}/${dm[3]}`;
  return s;
}

function parseBool(val: any): boolean {
  return String(val ?? '').toUpperCase().trim() === 'SIM';
}

function normalizeStr(s: string): string {
  return s.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const ARTIGOS = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'NO', 'NA']);

function nomeSignificativo(nome: string): string {
  return nome.split(' ').filter(p => p.length >= 2 && !ARTIGOS.has(p)).join(' ');
}

const SITUACAO_MAP: Record<string, string> = {
  ATIVO: 'ATIVO', REMA: 'REMA', REMANEJADO: 'REMA', 'REMANEJADA': 'REMA', 'REMANEJADO(A)': 'REMA',
  BXTR: 'BXTR', 'BAIXA TRANSF.': 'BXTR', 'BAIXA TRANSFERENCIA': 'BXTR', 'BAIXA TRANSFER\u00caNCIA': 'BXTR',
  TRAN: 'TRAN', 'TRANSF.': 'TRAN', TRANSFERIDO: 'TRAN', TRANSFERIDA: 'TRAN',
  'N COM': 'N COM', 'NAO COMPARECEU': 'N COM', 'N\u00c3O COMPARECEU': 'N COM', 'NCOM': 'N COM',
  'BAIXA POR NAO COMPARECIMENTO': 'N COM', 'BAIXA POR N\u00c3O COMPARECIMENTO': 'N COM',
  ABAN: 'ABAN', ABANDONO: 'ABAN',
};

function normalizeSituacao(s: string): string {
  const key = normalizeStr(s);
  return SITUACAO_MAP[key] ?? SITUACAO_MAP[s.trim().toUpperCase()] ?? s.trim();
}

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
  cpf: string;
  turmaOrigem: string;
  professoraOrigem: string;
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
  const [fixing, setFixing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dadosRef = useRef<{ turmas: any[]; alunos: AlunoUnificado[]; faltasArr: any[] } | null>(null);

  const fixSchema = useCallback(async () => {
    setFixing(true);
    setErro('');
    try {
      await api.reloadSchema();
      setErro('');
      setStatus('Schema recarregado! Tente importar novamente.');
    } catch (ex: any) {
      setErro('Execute no SQL Editor do Supabase:\nNOTIFY pgrst, \'reload schema\';');
    } finally {
      setFixing(false);
    }
  }, []);

  // ─── PARSE: PDF SED (Relação de Alunos por Classe) ───
  async function parsePDFs(files: File[]): Promise<AlunoUnificado[]> {
    const alunos: AlunoUnificado[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      // PDFs do Bolsa Família têm parser próprio — pula aqui
      const nomeArq = normalizeFileName(file.name);
      if (nomeArq.includes('BOLSA') || nomeArq.includes('FORMULARIO')) continue;

      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      let texto = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        texto += content.items.map((item: any) => item.str).join(' ') + '\n';
      }

      // Preserva espaços múltiplos — são delimitadores de coluna nos PDFs SED
      // (NÃO colapsar: o lookahead (?=\s{3,}) depende deles para achar fim do nome da turma)
      const allText = texto.replace(/\n/g, ' ');

      // Mapa de posição → série + professora (suporta PDFs com múltiplas turmas)
      // Para no primeiro rótulo estatístico (Ativos:, Professora:, Período:…) ou no próximo Turma:
      const turmaPosicoes: Array<{ pos: number; serie: string; professora: string }> = [];
      // PDFs "Relação de Alunos" SED: após o nome da turma vem "Ativos: N"
      // PDFs "Diário de Classe" SED: após o nome vem "Professora:" ou "Período:"
      const turmaRe = /Turma:\s*(.+?)(?=\s+(?:Ativos|Transferidos|Abandonos|NCOM|Cadastrados|Sala|NR\.|Professora?|Per[ií]odo|Turno|Modalidade|Escola|Coordenador|Turma)\s*[:.]|Turma:|$)/gi;
      let tmm: RegExpExecArray | null;
      while ((tmm = turmaRe.exec(allText)) !== null) {
        const serie = tmm[1].trim();
        // Extrai professora próxima ao cabeçalho (PDFs SED têm "Professora: NOME" perto de "Turma:")
        const win = allText.substring(tmm.index, Math.min(allText.length, tmm.index + 500));
        const profM = win.match(/Professora?:?\s*([A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ][A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ\s'-]{5,60}?)(?=\s{3,}|\s*RA:|\s*N[º°]|\s*\d|$)/i);
        const professora = profM ? normalizeStr(profM[1].trim()) : '';
        turmaPosicoes.push({ pos: tmm.index, serie, professora });
      }
      // Fallback: turma única — captura até o primeiro rótulo de campo ou fim
      if (!turmaPosicoes.length) {
        const t = allText.match(/Turma:\s*(.+?)(?=\s+[A-Za-záàãâéêíóôõúüçÁÀÃÂÉÊÍÓÔÕÚÜÇ]{4,}\s*:|$)/i);
        const profFb = allText.match(/Professora?:?\s*([A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ][A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ\s'-]{5,60}?)(?=\s{3,}|$)/i);
        if (t) turmaPosicoes.push({ pos: 0, serie: t[1].trim(), professora: profFb ? normalizeStr(profFb[1].trim()) : '' });
      }
      const getSerie = (raPos: number) => {
        let s = { serie: '', professora: '' };
        for (const t of turmaPosicoes) { if (t.pos <= raPos) s = t; else break; }
        return s;
      };

      // Mapa de posição → professora (extrai do próprio PDF)
      const professoresPosicoes: Array<{ pos: number; prof: string }> = [];
      const profRe = /Professora?:\s*([A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ][A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ\s'-]{3,}?)(?=\s+(?:Professora?|Per[ií]odo|Turno|Modalidade|Escola|Turma)\s*:|Turma:|$)/gi;
      let pmm: RegExpExecArray | null;
      while ((pmm = profRe.exec(allText)) !== null) {
        professoresPosicoes.push({ pos: pmm.index, prof: pmm[1].trim() });
      }
      const getProfessora = (raPos: number) => {
        let p = '';
        for (const pt of professoresPosicoes) { if (pt.pos <= raPos) p = pt.prof; else break; }
        return p;
      };

      // Âncora nos RAs de 12 dígitos (padrão SED: 000XXXXXXXXX)
      const raRe = /\b(0{3}\d{9})\b/g;
      let raMatch: RegExpExecArray | null;
      while ((raMatch = raRe.exec(allText)) !== null) {
        const raStr = raMatch[1];
        const raPos = raMatch.index;

        // ── Nome: último trecho todo em maiúsculas antes do RA ──
        const before = allText.substring(Math.max(0, raPos - 160), raPos);
        const nomeMatch = before.match(/([A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ][A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ\s'-]{3,})$/);
        if (!nomeMatch) continue;
        // Remove prefixo "X X " (série + nº do aluno) se presente
        const nome = nomeMatch[1].replace(/^\d{1,2}\s+\d{1,3}\s+/, '').trim();
        if (!nome || nome.length < 4) continue;

        // ── Campos após o RA: [dig_ra] [UF] [nasc] [situação] [data_movim?] [deficiência] ──
        // A data de movimentação é OPCIONAL — alunos ATIVO podem não ter data de movimentação
        const after = allText.substring(raPos + 12, raPos + 400);
        // PDF dates have spaces after slashes due to pdfjs text extraction: "DD/ MM/ YYYY"
        const pdfDate = '(\\d{2}\\s*\\/\\s*\\d{2}\\s*\\/\\s*\\d{4})';
        // Section boundaries: stop before next turma header or section break
        const sectionBreak = 'Ano\\s+Letivo|Diretoria:|Escola:|Tipo\\s+Ensino|Habilitação:|Sala:|Turma:';
        const afterMatch = after.match(
          new RegExp(`^\\s*\\S+\\s+\\S{2}\\s+${pdfDate}\\s+(ATIVO|TRAN|REMA|ABAN|N\\s?COM|BXTR|NAO\\s?COMPARECEU)(?:\\s+${pdfDate})?\\s*(.*?)(?=\\s*\\d{1,2}\\s+\\d{1,3}\\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ]|\\s*0{3}\\d{9}|${sectionBreak}|$)`, 'i')
        );
        const { serie: serieAluno, professora: profAluno } = getSerie(raPos);

        if (!afterMatch) {
          // Fallback: PDF "Relação de Alunos" SED — colunas em ordem invertida
          // (datas/situações extraídas antes dos nomes pelo pdfjs). Salva nome+RA+série;
          // o merge com Excel preencherá nascimento, situação e deficiência via RA.
          if (!serieAluno) continue; // sem turma identificada, descarta
          alunos.push({
            nome, nomeNorm: normalizeStr(nome),
            ra: parseInt(raStr) || null,
            nascimento: '',
            serie: serieAluno,
            professora: profAluno || getProfessora(raPos),
            situacao: 'ATIVO', deficiencia: '',
            bolsaFamilia: false,
            dataInicioMatricula: '', dataFimMatricula: '', dataMovimentacao: '',
            nis: '', responsavel: '', cpf: '',
            turmaOrigem: '', professoraOrigem: '',
            faltas: {},
          });
          continue;
        }

        const [, nascRaw, situacaoRaw, dataMovimRaw, defRaw] = afterMatch;
        // Remove espaços extras nas datas vindas do PDF: "26/ 09/ 2018" -> "26/09/2018"
        const nascimento = nascRaw.replace(/\s*\/\s*/g, '/');
        const dataMovim = dataMovimRaw ? dataMovimRaw.replace(/\s*\/\s*/g, '/') : undefined;
        const situacao = normalizeSituacao(situacaoRaw.trim());
        // Limpa deficiência: remove falsos positivos (cabeçalhos, datas, números isolados)
        const defRawClean = (defRaw ?? '').trim().replace(/\s+/g, ' ');
        const deficiencia = (!defRawClean || defRawClean.length > 120
          || /^(ATIVO|REMA|TRAN|BXTR|ABAN|N\s?COM|\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4}|$)/i.test(defRawClean)
          || /^(Ano|Diretoria|Escola|Turma|Tipo|Habilitação|Série|Nr\b)/i.test(defRawClean)
        ) ? '' : defRawClean;
        const isAtivo = situacao === 'ATIVO';

        alunos.push({
          nome, nomeNorm: normalizeStr(nome),
          ra: parseInt(raStr) || null,
          nascimento,
          serie: serieAluno,
          professora: profAluno || getProfessora(raPos),
          situacao, deficiencia,
          bolsaFamilia: false,
          dataInicioMatricula: '',
          dataFimMatricula: isAtivo ? (dataMovim ?? '') : '',
          dataMovimentacao: isAtivo ? '' : (dataMovim ?? ''),
          nis: '', responsavel: '', cpf: '',
          turmaOrigem: '', professoraOrigem: '',
          faltas: {},
        });
      }
    }
    return alunos;
  }

  // ─── PARSE: Excel ───
  function parseExcels(files: File[]): Promise<AlunoUnificado[]> {
    return new Promise((resolve) => {
      const alunosMap = new Map<string, AlunoUnificado>();
      let pendentes = 0;

      for (const file of files) {
        const name = file.name.toLowerCase();
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) continue;
        if (normalizeFileName(name).includes('EDUCACENSO')) continue; // parser específico
        pendentes++;
        const reader = new FileReader();
        reader.onload = (e) => {
          const wb = XLSX.read(e.target!.result, { type: 'array', cellDates: true });
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];

            // ─── Detecta Educacenso por conteúdo ──────────────────────────────
            // O arquivo Educacenso (INEP) tem ~20 linhas de metadados antes do
            // cabeçalho real. A coluna "CPF" aparece como VALOR numa dessas linhas
            // intermediárias (não como chave/cabeçalho na linha 0 do sheet_to_json).
            // Essa detecção funciona independente do nome do arquivo.
            const rawScan = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][];
            const isEducacenso = (rawScan as any[]).slice(1, 30).some((r: any) =>
              Array.isArray(r) && (r as any[]).some(
                (v: any) => normalizeStr(String(v ?? '')) === 'CPF'
              )
            );
            if (isEducacenso) continue; // processado por parseEducacensoCPF
            // ──────────────────────────────────────────────────────────────────

            const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'dd/mm/yyyy' }) as any[];
            for (const row of rows) {
              const nr: Record<string, any> = {};
              for (const [k, v] of Object.entries(row)) {
                nr[normalizeStr(String(k).trim())] = v;
              }

              const isDiario = 'FREQUENCIA DOS ALUNOS(A)' in nr;

              const nome = String(nr['NOME DO ALUNO'] ?? nr['NOME'] ?? '').trim();
              const serie = String(nr['SERIE'] ?? nr['TURMA'] ?? '').trim();
              if (!nome) continue;

        const ra = parseInt(String(nr['RA'] ?? '')) || null;
        const nasc = fmtDate(nr['DATA DE NASCIMENTO'] ?? nr['DATA NASCIMENTO']);
        const key = `${normalizeStr(nome)}|${ra}|${nasc}`;
        const mes = getMes(sheetName, nr);

        let faltasQtd = 0;
        let freqTexto = '';
        if (isDiario) {
          const freqRaw = String(nr['FREQUENCIA DOS ALUNOS(A)'] ?? '').trim().replace(/^["']|["']$/g, '').trim();
          const freqNumM = freqRaw.match(/^(\d{1,2})/);
          faltasQtd = freqNumM ? Math.min(parseInt(freqNumM[1]), 22) : 0;
          const freqNorm = normalizeStr(freqRaw);
          freqTexto = !freqNumM && freqRaw && !freqNorm.startsWith('NAO HA FALTAS') ? freqRaw : '';
        }

        const situacao = normalizeSituacao(String(nr['SITUACAO'] ?? 'ATIVO'));
        const deficiencia = String(nr['DEFICIENCIA'] ?? '').trim();
        const professora = String(nr['PROFESSORA'] ?? '').trim();
        const bolsaFamilia = parseBool(nr['BOLSA FAMILIA'] ?? nr['BOLSA FAMLIA']);
        const _inicioKey = Object.keys(nr).find(k => k.includes('INICIO') && k.includes('MATRICULA'));
        const _inicioVal = _inicioKey ? nr[_inicioKey] : undefined;
        const dataInicioMatricula = fmtDate(
          nr['DATA INICIO MATRICULA'] ??
          nr['DATA DE INICIO DA MATRICULA'] ??
          nr['INICIO DA MATRICULA'] ??
          nr['INICIO MATRICULA'] ??
          nr['DATA DA MATRICULA'] ??
          _inicioVal
        );
        const _fimKey = Object.keys(nr).find(k => k.includes('FIM') && k.includes('MATRICULA'));
        const _fimVal = _fimKey ? nr[_fimKey] : undefined;
        const dataFimMatricula = fmtDate(
          nr['DATA FIM MATRICULA'] ??
          nr['DT FIM MATRICULA'] ??
          _fimVal
        );
        const _movKey = Object.keys(nr).find(k => k.includes('MOVIMENTAC') || k.includes('MOVIM'));
        const _movVal = _movKey ? nr[_movKey] : undefined;
        const dataMovimentacao = fmtDate(
          nr['DATA MOVIMENTACAO'] ??
          nr['DT MOVIMENTACAO'] ??
          nr['DATA DE MOVIMENTACAO'] ??
          _movVal
        );

              if (alunosMap.has(key)) {
                const e = alunosMap.get(key)!;
                if (mes > 0 && faltasQtd >= 0) {
                  e.faltas[mes] = { faltas: faltasQtd, frequencia: freqTexto };
                }
                if (situacao !== 'ATIVO') e.situacao = situacao;
                if (professora) e.professora = professora;
                if (dataInicioMatricula) e.dataInicioMatricula = dataInicioMatricula;
                if (dataFimMatricula) e.dataFimMatricula = dataFimMatricula;
                if (dataMovimentacao) e.dataMovimentacao = dataMovimentacao;
                if (deficiencia) e.deficiencia = deficiencia;
                continue;
              }

              alunosMap.set(key, {
                nome, nomeNorm: normalizeStr(nome),
                ra, nascimento: nasc,
                serie, professora,
                situacao, deficiencia,
                bolsaFamilia: parseBool(nr['BOLSA FAMILIA'] ?? nr['BOLSA FAMLIA']),
                dataInicioMatricula: fmtDate(
                  nr['DATA INICIO MATRICULA'] ??
                  nr['DT INICIO MATRICULA'] ??
                  nr['DATA DE INICIO DA MATRICULA'] ??
                  nr['INICIO DA MATRICULA'] ??
                  nr['INICIO MATRICULA'] ??
                  nr['DATA DA MATRICULA'] ??
                  nr[Object.keys(nr).find(k => k.includes('INICIO') && k.includes('MATRICULA'))]
                ),
                dataFimMatricula: fmtDate(
                  nr['DATA FIM MATRICULA'] ??
                  nr['DT FIM MATRICULA'] ??
                  nr[Object.keys(nr).find(k => k.includes('FIM') && k.includes('MATRICULA'))]
                ),
                dataMovimentacao: fmtDate(
                  nr['DATA MOVIMENTACAO'] ??
                  nr['DT MOVIMENTACAO'] ??
                  nr['DATA DE MOVIMENTACAO'] ??
                  nr[Object.keys(nr).find(k => k.includes('MOVIMENTAC') || k.includes('MOVIM'))]
                ),
                nis: '',
                responsavel: '',
                cpf: String(nr['CPF'] ?? '').replace(/\D/g, '') || '',
                turmaOrigem: '', professoraOrigem: '',
                faltas: mes > 0 && faltasQtd >= 0 ? { [mes]: { faltas: faltasQtd, frequencia: freqTexto } } : {},
              });
            }
          }
          pendentes--;
          if (pendentes === 0) resolve(Array.from(alunosMap.values()));
        };
        reader.readAsArrayBuffer(file);
      }
      if (pendentes === 0) resolve([]);
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
          if (rows.length < 2) { pendentes--; if (pendentes === 0) resolve(mapa); return; }

          // Encontra a linha real de cabeçalho (pode ter nome da escola na linha 0)
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const joined = rows[i].map((h: any) => normalizeStr(String(h ?? ''))).join('|');
            if (joined.includes('TURMA') || joined.includes('PROFESSOR') || joined.includes('SALA')) {
              headerRowIdx = i;
              break;
            }
          }
          const headers = rows[headerRowIdx].map((h: any) => normalizeStr(String(h ?? '')));
          const idxTurma = headers.findIndex((h: string) => h.includes('TURMA') || h.includes('SERIE') || h.includes('CLASSE'));
          const idxProf  = headers.findIndex((h: string) => h.includes('PROFESSOR') || h.includes('DOCENTE'));
          const idxPer   = headers.findIndex((h: string) => h.includes('PERIOD') || h.includes('TURNO'));

          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.every((c: any) => !String(c ?? '').trim())) continue; // pula linhas vazias
            const turma = String(r[idxTurma >= 0 ? idxTurma : 1] ?? '').trim();
            const prof  = String(r[idxProf  >= 0 ? idxProf  : 2] ?? '').trim();
            const per   = String(r[idxPer   >= 0 ? idxPer   : 3] ?? '').trim();
            if (turma && prof) mapa.set(normalizeStr(turma), { professor: prof, periodo: per });
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
                else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) && !nasc) nasc = fmtDate(v);
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
                nis: '', responsavel: '', cpf: '',
                turmaOrigem: '', professoraOrigem: '',
                faltas: {},
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
      // Chave fuzzy: nome sem artigos + data (tolera variações de "DA"/"DE" entre sistemas)
      const nomeSimp = nomeSignificativo(nome);
      if (nomeSimp.length >= 3 && nasc) {
        mapa.set(`~${nomeSimp}|${nasc}`, { nis, responsavel });
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
  // ─── PARSE: TXT Bolsa Família (formato linearizado campo a campo) ───
  async function parseBolsaFamiliaTXT(files: File[]): Promise<Map<string, { nis: string; responsavel: string }>> {
    const mapa = new Map<string, { nis: string; responsavel: string }>();

    const indexar = (nome: string, nasc: string, nis: string, responsavel: string) => {
      if (nome.length < 3 || !/^\d{11}$/.test(nis)) return;
      mapa.set(`${nome}|${nasc}`, { nis, responsavel });
      const nomeSimp = nomeSignificativo(nome);
      if (nomeSimp.length >= 3 && nasc) {
        mapa.set(`~${nomeSimp}|${nasc}`, { nis, responsavel });
      }
    };

    for (const file of files) {
      const name = normalizeFileName(file.name);
      if (!file.name.toLowerCase().endsWith('.txt')) continue;
      if (!name.includes('FORMULARIO') && !name.includes('BOLSA')) continue;
      const texto = await file.text();

      // Formato: cada campo em linha própria com rótulo
      // "Nome: NOME\n...\nDt. Nasc.: DD/MM/YYYY\n...\nNIS: 11DIGITS"
      let currentNome = '';
      let currentNasc = '';
      let currentResp = '';

      for (const linha of texto.split('\n')) {
        const l = linha.trim();
        const nomeM = l.match(/^Nome:\s*(.+)/i);
        if (nomeM) {
          currentNome = normalizeStr(nomeM[1].trim());
          currentNasc = '';
          currentResp = '';
          continue;
        }
        const nascM = l.match(/^Dt\.\s*Nasc\.:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (nascM) { currentNasc = fmtDate(nascM[1]); continue; }

        const respM = l.match(/^Respons[áa]vel\s+familiar:\s*(.+)/i);
        if (respM) { currentResp = normalizeStr(respM[1].trim()); continue; }

        const nisM = l.match(/^NIS:\s*(\d{11})/i);
        if (nisM && currentNome) {
          indexar(currentNome, currentNasc, nisM[1], currentResp);
          currentNome = '';
          currentNasc = '';
          currentResp = '';
        }
      }
    }
    return mapa;
  }

  // ─── PARSE: EDUCACENSO xlsx (CPF + Deficiência) ───
  async function parseEducacensoCPF(files: File[]): Promise<Map<string, { cpf: string; deficiencia: string }>> {
    const mapa = new Map<string, { cpf: string; deficiencia: string }>();

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) continue;
      // Nota: não filtramos por nome — qualquer xlsx é testado pelo conteúdo abaixo

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

      // Procura linha de cabeçalho com "Nome" e "CPF"
      let headerIdx = -1, idxNome = -1, idxNasc = -1, idxCPF = -1, idxDef = -1;
      for (let r = 0; r < rows.length; r++) {
        const vals = (rows[r] ?? []).map((v: any) => normalizeStr(String(v ?? '')));
        if (vals.some(v => v.includes('NOME')) && vals.some(v => v === 'CPF')) {
          headerIdx = r;
          idxNome = vals.findIndex(v => v.includes('NOME'));
          idxNasc = vals.findIndex(v => v.includes('NASCIMENTO'));
          idxCPF  = vals.findIndex(v => v === 'CPF');
          idxDef  = vals.findIndex(v => v.startsWith('TIPO(S) DE DEFICIENCIA'));
          break;
        }
      }
      // headerIdx < 5 → cabeçalho na linha 0–4 = arquivo SED normal (não Educacenso)
      // Educacenso tem ~20 linhas de metadados → headerIdx ~20
      if (headerIdx < 5 || idxCPF < 0) continue;

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        const nomeRaw = String(row[idxNome] ?? '').trim();
        const cpfRaw = String(row[idxCPF] ?? '').replace(/\D/g, '');
        if (!nomeRaw || nomeRaw === '--') continue;

        const nomeNorm = normalizeStr(nomeRaw);
        let nasc = '';
        if (idxNasc >= 0) {
          const nascRaw = row[idxNasc];
          if (nascRaw instanceof Date) {
            nasc = `${String(nascRaw.getDate()).padStart(2,'0')}/${String(nascRaw.getMonth()+1).padStart(2,'0')}/${nascRaw.getFullYear()}`;
          } else {
            const d = String(nascRaw ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (d) nasc = `${d[1].padStart(2,'0')}/${d[2].padStart(2,'0')}/${d[3]}`;
          }
        }
        const defRaw = idxDef >= 0 ? String(row[idxDef] ?? '').trim() : '';
        const deficiencia = (!defRaw || defRaw === '--') ? '' : defRaw;
        const cpf = cpfRaw.length === 11 ? cpfRaw : '';
        const entry = { cpf, deficiencia };

        // Chave exata: nome|data
        mapa.set(`${nomeNorm}|${nasc}`, entry);
        // Chave fuzzy: nome significativo|data (tolera artigos)
        if (nasc) {
          const simp = nomeSignificativo(nomeNorm);
          if (simp.length >= 3) mapa.set(`~${simp}|${nasc}`, entry);
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
      const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));

      const [alunosPDF, alunosHTML, alunosExcel, turmasMap, bolsaMapPDF, bolsaMapTXT, cpfMap] = await Promise.all([
        parsePDFs(pdfFiles),
        parseHTMLSED(xlsFiles),
        parseExcels(xlsxFiles),
        parseTurmasProfessores(files),
        parseBolsaFamiliaPDF(pdfFiles),
        parseBolsaFamiliaTXT(txtFiles),
        parseEducacensoCPF(xlsxFiles),
      ]);
      // Merge: TXT tem prioridade (mais confiável), PDF completa o que faltar
      const bolsaMap = new Map([...bolsaMapPDF, ...bolsaMapTXT]);

      // ─── Cruzamento ───
      const todosAlunos = new Map<string, AlunoUnificado>();
      // Chave: RA (quando disponível) para cruzar PDF + Excel mesmo sem data de nascimento
      const mkKey = (a: AlunoUnificado) =>
        a.ra ? `RA:${a.ra}` : `${a.nomeNorm}|${a.nascimento}`;
      // Prioridade: Excel primeiro (dados mais completos), depois PDF
      const mergeAluno = (a: AlunoUnificado) => {
        const key = mkKey(a);
        if (todosAlunos.has(key)) {
          const existente = todosAlunos.get(key)!;

          // ─── Remanejamento duplo: mesmo RA, turmas diferentes ─────────────────
          // O SED registra remanejamento interno em dois lançamentos:
          //   • REMA  na turma de ORIGEM (aluno que saiu)
          //   • ATIVO na turma de DESTINO (aluno que chegou)
          // Ambos devem existir no sistema → mantemos as duas entradas separadas.
          const seriesDiferentes = existente.serie && a.serie
            && normalizeStr(existente.serie) !== normalizeStr(a.serie);
          const ehRemaDuplo = seriesDiferentes && (
            (existente.situacao === 'REMA' && a.situacao === 'ATIVO') ||
            (existente.situacao === 'ATIVO' && a.situacao === 'REMA')
          );

          if (ehRemaDuplo) {
            const rema  = existente.situacao === 'REMA' ? existente : a;
            const ativo = existente.situacao === 'REMA' ? a : existente;
            // Vincula o destino à origem do remanejamento
            ativo.turmaOrigem      = rema.serie;
            ativo.professoraOrigem = rema.professora;
            // Propaga dados complementares para o destino
            ativo.bolsaFamilia  = ativo.bolsaFamilia  || rema.bolsaFamilia;
            ativo.nis           = ativo.nis           || rema.nis;
            ativo.responsavel   = ativo.responsavel   || rema.responsavel;
            ativo.cpf           = ativo.cpf           || rema.cpf;
            ativo.deficiencia   = ativo.deficiencia   || rema.deficiencia;
            if (!ativo.nascimento && rema.nascimento) ativo.nascimento = rema.nascimento;
            Object.assign(ativo.faltas, rema.faltas);
            todosAlunos.set(key, ativo);           // destino (ATIVO) — chave principal
            todosAlunos.set(`${key}|REMA`, rema);  // origem  (REMA)  — chave separada
            return;
          }

          // ─── Merge normal ─────────────────────────────────────────────────────
          existente.bolsaFamilia = existente.bolsaFamilia || a.bolsaFamilia;
          existente.nis = existente.nis || a.nis;
          existente.responsavel = existente.responsavel || a.responsavel;
          existente.cpf = existente.cpf || a.cpf;
          existente.professora = existente.professora || a.professora;
          existente.situacao = a.situacao !== 'ATIVO' ? a.situacao : existente.situacao;
          existente.deficiencia = existente.deficiencia || a.deficiencia;
          if (a.serie && a.serie.length > (existente.serie?.length ?? 0)) {
            existente.serie = a.serie;
          }
          if (a.dataInicioMatricula) existente.dataInicioMatricula = a.dataInicioMatricula;
          if (a.dataFimMatricula) existente.dataFimMatricula = a.dataFimMatricula;
          if (a.dataMovimentacao) existente.dataMovimentacao = a.dataMovimentacao;
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
        // Busca exata, depois parcial (ex: "1 ANO A" bate "1 ANO A MANHA")
        const serieNorm = normalizeStr(a.serie);
        let tp = turmasMap.get(serieNorm);
        if (!tp) {
          // Tenta bater por prefixo: chave do mapa contém a série ou vice-versa
          for (const [k, v] of turmasMap.entries()) {
            if (k.startsWith(serieNorm) || serieNorm.startsWith(k)) { tp = v; break; }
          }
        }
        if (tp) {
          if (tp.professor && !a.professora) a.professora = tp.professor;
          if (tp.periodo && !a.serie.toLowerCase().includes(tp.periodo.toLowerCase())) {
            // Não sobrescreve o nome da turma, só usa o período para enriquecer se necessário
          }
        }
        // Cruzamento Bolsa Família: nome+data (exato), depois nome sem artigos+data (fuzzy)
        const bfExato = bolsaMap.get(`${a.nomeNorm}|${a.nascimento}`);
        const nomeSimp = nomeSignificativo(a.nomeNorm);
        const bfFuzzy = a.nascimento ? bolsaMap.get(`~${nomeSimp}|${a.nascimento}`) : undefined;
        const bf = bfExato ?? bfFuzzy;
        if (bf) {
          a.nis = a.nis || bf.nis;
          a.responsavel = a.responsavel || bf.responsavel;
          a.bolsaFamilia = true;
        }
        // Cruzamento CPF + Deficiência (EDUCACENSO): nome+data exato, depois fuzzy
        const ecExato = cpfMap.get(`${a.nomeNorm}|${a.nascimento}`);
        const ecFuzzy = a.nascimento ? cpfMap.get(`~${nomeSimp}|${a.nascimento}`) : undefined;
        const ec = ecExato ?? ecFuzzy;
        if (ec) {
          a.cpf = a.cpf || ec.cpf || '';
          a.deficiencia = a.deficiencia || ec.deficiencia || '';
        }
      }

      // Turmas únicas — prefere professora não-vazia
      const turmasUnicas = new Map<string, { nome: string; professora: string }>();
      for (const a of alunosArr) {
        if (!turmasUnicas.has(a.serie)) {
          turmasUnicas.set(a.serie, { nome: a.serie, professora: a.professora });
        } else if (a.professora && !turmasUnicas.get(a.serie)!.professora) {
          turmasUnicas.get(a.serie)!.professora = a.professora;
        }
      }

      // Conta faltas
      let totalFaltas = 0;
      for (const a of alunosArr) totalFaltas += Object.keys(a.faltas).length;

      // Verifica quantas turmas do arquivo existem no banco (com aliases)
      const turmasNoBanco = await api.getTurmas();
      const normT2 = (s: string) => (s ?? '').toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[ªº°]/g, '').replace(/[-]/g, ' ').replace(/\s+/g, ' ').trim();
      const ALIASES2: Record<string, string> = {
        'ALFABETIZACAO': 'EJA I', 'EJA ALFABETIZACAO': 'EJA I',
        'TURMA ALFABETIZACAO': 'EJA I',
        'POS ALFABETIZACAO': 'EJA I', 'EJA POS ALFABETIZACAO': 'EJA I',
        'TURMA POS ALFABETIZACAO': 'EJA I',
      };
      // Catch-all para nomes SED: "MULTISSERIADA" = Alfabetização, "TERMO" = Pós-Alfa
      const applyAlias2 = (s: string): string => {
        const n = normT2(s);
        const nSemSufixo = n
          .replace(/\bPRE\s*ESCOLA\b/g, '')
          .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL)\b/g, '')
          .replace(/\s+/g, ' ').trim();
        if (ALIASES2[nSemSufixo]) return ALIASES2[nSemSufixo];
        if (n.includes('MULTISSERIADA')) return 'EJA I';
        if (/\bTERMO\b/.test(n)) return 'EJA I';
        return s;
      };
      const nomesNoBanco = new Set(turmasNoBanco.map((t: any) => normT2(t.nome)));
      // Strip SED verboso: "1ª ETAPA PRÉ-ESCOLA A MANHA ANUAL" → "1 ETAPA A"
      const normSed2 = (s: string) => s
        .replace(/\bPRE\s*ESCOLA\b/g, '')
        .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL)\b/g, '')
        .replace(/\s+/g, ' ').trim();
      const turmasReconhecidas = Array.from(turmasUnicas.keys())
        .filter(s => {
          const n = normT2(applyAlias2(s));
          const nSed = normSed2(n);
          for (const key of [n, nSed]) {
            if (nomesNoBanco.has(key)) return true;
            for (const nb of nomesNoBanco) { if (nb.startsWith(key) || key.startsWith(nb)) return true; }
          }
          return false;
        }).length;

      const prev = {
        turmas: turmasUnicas.size,
        turmasReconhecidas,
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

  // ─── IMPORTAR (UPSERT — preserva histórico de faltas) ───
  const importar = async () => {
    if (!dadosRef.current) return;
    const { alunos, turmas } = dadosRef.current;
    setErro('');
    setSucesso(false);
    setTotal(alunos.length);
    setProgresso(0);

    // Normaliza para matching: sem acento, sem ordinal, maiúsculas, espaço simples
    const normT = (s: string) => (s ?? '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[ªº°]/g, '')
      .replace(/[-]/g, ' ')
      .replace(/\s+/g, ' ').trim();

    // Remove sufixos verbosos do SED: "1ª ETAPA PRÉ-ESCOLA A MANHA ANUAL" → "1 ETAPA A"
    const normSerieSED = (s: string) => normT(s)
      .replace(/\bPRE\s*ESCOLA\b/g, '')
      .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL|SEMI\s*INTEGRAL)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Aliases: nomes usados no SED/PDF → nome cadastrado no sistema
    const ALIASES: Record<string, string> = {
      'ALFABETIZACAO':           'EJA I',
      'EJA ALFABETIZACAO':       'EJA I',
      'TURMA ALFABETIZACAO':     'EJA I',
      'POS ALFABETIZACAO':       'EJA I',
      'EJA POS ALFABETIZACAO':   'EJA I',
      'TURMA POS ALFABETIZACAO': 'EJA I',
    };
    const applyAlias = (serie: string): string => {
      const n = normT(serie);
      const nSemSufixo = n
        .replace(/\bPRE\s*ESCOLA\b/g, '')
        .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL|SEMI\s*INTEGRAL)\b/g, '')
        .replace(/\s+/g, ' ').trim();
      if (ALIASES[nSemSufixo]) return ALIASES[nSemSufixo];
      if (n.includes('MULTISSERIADA')) return 'EJA I';
      if (/\bTERMO\b/.test(n)) return 'EJA I';
      return serie;
    };

    // Matching: aplica alias → exato → prefixo desempata por professora
    const buildResolveId = (turmasExistentes: any[]) => {
      const serieToTurmasList = new Map<string, Array<{ id: string; professora: string }>>();
      for (const t of turmasExistentes) {
        const key = normT(t.nome);
        if (!serieToTurmasList.has(key)) serieToTurmasList.set(key, []);
        serieToTurmasList.get(key)!.push({ id: t.id, professora: normT(t.professora ?? '') });
      }
      return (serie: string, professora?: string): string | null => {
        const aliased = applyAlias(serie);
        const n = normT(aliased);
        const nSed = normSerieSED(aliased);
        let candidates: Array<{ id: string; professora: string }> = [];
        for (const key of [n, nSed]) {
          candidates = serieToTurmasList.get(key) ?? [];
          if (!candidates.length) {
            for (const [k, v] of serieToTurmasList.entries()) {
              if (k.startsWith(key) || key.startsWith(k)) { candidates = v; break; }
            }
          }
          if (candidates.length) break;
        }
        if (!candidates.length) return null;
        if (candidates.length === 1) return candidates[0].id;
        if (professora) {
          const pn = normT(professora);
          const words = pn.split(' ').filter((w: string) => w.length > 4 && !ARTIGOS.has(w));
          for (const c of candidates) {
            if (c.professora && words.some((w: string) => c.professora.includes(w))) return c.id;
          }
          for (const c of candidates) {
            if (c.professora && (c.professora.includes(pn) || pn.includes(c.professora))) return c.id;
          }
        }
        return candidates[0].id;
      };
    };

    try {
      // ─── PASSO 1: Turmas — upsert por nome normalizado (evita duplicatas ANUAL/SED) ───
      // Problema anterior: "1° ANO A MANHA ANUAL" (Excel) e "1º ANO A" (PDF) criavam
      // turmas separadas porque o match era exato. Agora usa resolveExistente (normalizado)
      // para encontrar a turma canônica já cadastrada e preservar seu nome.
      setStatus('Carregando turmas cadastradas...');
      const turmasExistentes = await api.getTurmas();
      const resolveExistente = buildResolveId(turmasExistentes);
      const idToExistente = new Map<string, any>(turmasExistentes.map((t: any) => [t.id, t]));
      const nomeToTurmaId = new Map<string, string>(turmasExistentes.map((t: any) => [t.nome, t.id]));

      const turmasParaUpsertRaw = turmas.map(t => {
        const exactId = nomeToTurmaId.get(t.nome) ?? null;
        const normId  = exactId ?? resolveExistente(t.nome, t.professora) ?? null;
        const exist   = normId ? idToExistente.get(normId) : null;
        return {
          ...(normId ? { id: normId } : {}),
          // Preserva nome canônico já no DB; usa nome do arquivo só para turmas novas
          nome: exist ? exist.nome : t.nome,
          // Atualiza professora somente se a existente estiver vazia
          professora: t.professora || (exist?.professora ?? ''),
        };
      });
      // Deduplica: "1° ANO A MANHA ANUAL" e "1º ANO A" podem resolver pro mesmo ID
      const seenTurmaIds = new Set<string>();
      const turmasParaUpsert = turmasParaUpsertRaw.filter(t => {
        const key = (t as any).id ?? t.nome;
        if (seenTurmaIds.has(key)) return false;
        seenTurmaIds.add(key);
        return true;
      });
      for (let i = 0; i < turmasParaUpsert.length; i += 80) {
        const { data: chunk } = await supabase
          .from('Turma')
          .upsert(turmasParaUpsert.slice(i, i + 80), { onConflict: 'id' })
          .select();
        if (chunk) {
          for (const t of chunk) nomeToTurmaId.set(t.nome, t.id);
        }
      }

      // Reconstrói resolveId com turmas atualizadas do DB (inclui novas)
      const { data: todasTurmas } = await supabase.from('Turma').select('id, nome, professora');
      const resolveIdAtualizado = buildResolveId(todasTurmas ?? []);

      // ─── PASSO 2: Alunos — upsert por RA (preserva UUIDs → preserva faltas) ───
      setStatus('Atualizando cadastro de alunos...');
      const { data: existentes } = await supabase
        .from('Aluno').select('id, ra, nome');
      const raToExistingId = new Map<string, string>();
      const nomeToExistingId = new Map<string, string>();
      for (const e of (existentes ?? [])) {
        if (e.ra) raToExistingId.set(String(e.ra), e.id);
        nomeToExistingId.set(normalizeStr(e.nome), e.id);
      }

      const alunosParaUpsert = alunos.map(a => {
        const existingId = raToExistingId.get(String(a.ra ?? ''))
          ?? nomeToExistingId.get(a.nomeNorm);
        return {
          ...(existingId ? { id: existingId } : {}),
          nome: a.nome,
          turmaId: resolveIdAtualizado(a.serie, a.professora),
          ra: a.ra,
          numero: 0,
          data_nascimento: a.nascimento,
          data_inicio_matricula: a.dataInicioMatricula || null,
          data_fim_matricula: a.dataFimMatricula || null,
          data_movimentacao: a.dataMovimentacao || null,
          deficiencia: a.deficiencia,
          situacao: a.situacao,
          bolsa_familia: a.bolsaFamilia,
          professora: a.professora,
          nis: a.nis || null,
          responsavel: a.responsavel || null,
          cpf: a.cpf || null,
          turma_origem: a.turmaOrigem || '',
          professora_origem: a.professoraOrigem || '',
        };
      });

      for (let i = 0; i < alunosParaUpsert.length; i += 80) {
        const { error } = await supabase
          .from('Aluno')
          .upsert(alunosParaUpsert.slice(i, i + 80), { onConflict: 'id' });
        if (error) throw error;
        setProgresso(Math.min(i + 80, alunosParaUpsert.length));
        setStatus(`Atualizando alunos... ${Math.min(i + 80, alunosParaUpsert.length)}/${alunosParaUpsert.length}`);
      }

      // ─── PASSO 3: Re-ler IDs dos alunos ───
      const { data: alunosDb } = await supabase.from('Aluno').select('id, ra, nome');
      const raToId = new Map<string, string>();
      const nomeToId = new Map<string, string>();
      for (const a of (alunosDb ?? [])) {
        if (a.ra) raToId.set(String(a.ra), a.id);
        nomeToId.set(normalizeStr(a.nome), a.id);
      }

      // ─── PASSO 4: Faltas — upsert por (alunoId, mes, ano) ───
      const faltasParaInserir: any[] = [];
      for (const a of alunos) {
        const alunoId = raToId.get(String(a.ra ?? '')) ?? nomeToId.get(a.nomeNorm);
        const turmaId = resolveIdAtualizado(a.serie, a.professora);
        if (!alunoId || !turmaId) continue;
        for (const [mes, f] of Object.entries(a.faltas)) {
          faltasParaInserir.push({
            alunoId, turmaId,
            mes: Number(mes), ano: new Date().getFullYear(),
            faltas: f.faltas, frequencia: f.frequencia,
          });
        }
      }

      setStatus(`Atualizando ${faltasParaInserir.length} registros de frequência...`);
      for (let i = 0; i < faltasParaInserir.length; i += 80) {
        const { error } = await supabase
          .from('Falta')
          .upsert(faltasParaInserir.slice(i, i + 80), { onConflict: 'alunoId,mes,ano' });
        if (error) throw error;
      }

      // ─── PASSO 5: Limpa turmas que ficaram sem alunos (duplicatas de imports anteriores) ───
      setStatus('Limpando turmas duplicadas...');
      const { data: alunosComTurma } = await supabase
        .from('Aluno').select('turmaId').not('turmaId', 'is', null);
      const idsComAlunos = new Set((alunosComTurma ?? []).map((a: any) => a.turmaId));
      const { data: todasTurmasFim } = await supabase.from('Turma').select('id');
      const turmasVazias = (todasTurmasFim ?? []).filter((t: any) => !idsComAlunos.has(t.id));
      if (turmasVazias.length > 0) {
        await supabase.from('Turma').delete().in('id', turmasVazias.map((t: any) => t.id));
      }

      setStatus('');
      setSucesso(true);
    } catch (ex: any) {
      const msg = ex.message ?? String(ex);
      setErro(msg);
      setStatus('');
    }
  };

  return (
    <div style={{ marginTop: 16, animation: 'fadeIn 0.25s ease both' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>📥 Importar Dados da SED</h1>
      <p style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
        Selecione todos os arquivos exportados da Secretaria Escolar Digital:
        PDFs (Alunos por Classe) + Excels (Diário de Classe, Turmas-Professores) + <strong>TXT do Bolsa Família</strong>.
        O sistema cruza automaticamente por nome, RA e data de nascimento.
      </p>

      {/* Upload zone */}
      <div style={{
        border: `2px dashed ${theme.border}`,
        borderRadius: theme.radiusMd,
        padding: files.length > 0 ? 16 : 48,
        textAlign: 'center', marginBottom: 16,
        background: 'var(--row-odd)', cursor: 'pointer',
        transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.background = theme.primaryBg; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = 'var(--row-odd)'; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = 'var(--row-odd)'; handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.pdf,.txt"
          style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        <div style={{ fontSize: 42, marginBottom: 8 }}>📂</div>
        <p style={{ fontWeight: 700, color: theme.primary, marginBottom: 4, fontSize: 17 }}>
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Clique ou arraste arquivos aqui'}
        </p>
        <p style={{ fontSize: 13, color: theme.textMuted }}>.xlsx .xls .pdf .txt — múltiplos arquivos</p>
      </div>

      {/* Lista de arquivos */}
      {files.map((f, i) => (
        <FileRow key={i} name={f.name} size={f.size} onRemove={() => removerArquivo(i)} />
      ))}

      {files.length > 0 && !preview && !status && (
        <button onClick={analisar} style={{ ...btn('primary', { full: true }), marginTop: 12, borderRadius: theme.radiusMd, padding: '13px', fontSize: 16 }}>
          🔍 Analisar Arquivos
        </button>
      )}

      {status && !sucesso && (
        <div className="fade-in" style={{ marginTop: 20, textAlign: 'center' }}>
          <p style={{ color: theme.textSecondary, marginBottom: 10, fontSize: 14 }}>{status}</p>
          <ProgressBar current={progresso} total={total} />
        </div>
      )}

      {/* Preview do cruzamento */}
      {preview && !sucesso && (
        <div className="scale-in" style={cardStyle({ marginTop: 16, padding: 20 })}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: theme.text }}>📊 Resultado do Cruzamento</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {[
              ['🏫 Turmas no arquivo', preview.turmas],
              [`✅ Turmas reconhecidas`, preview.turmasReconhecidas],
              ['👥 Alunos', preview.alunos],
              ['🟢 Bolsa Família', preview.bolsaFamilia],
              ['📄 Registros Faltas', preview.faltas],
              ['📂 Arquivos', preview.arquivos],
            ].map(([label, val]) => (
                <div key={label as string} style={{ textAlign: 'center', padding: 16, background: theme.primaryBg, borderRadius: theme.radius }}>
                <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>{label as string}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: theme.primary }}>{val as number}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: theme.successLight,
            border: `1px solid ${theme.success}`,
            borderRadius: theme.radius,
            fontSize: 13, color: theme.successHover,
            fontWeight: 600,
          }}>
            ✅ Faltas históricas serão PRESERVADAS.
            Apenas registros do mês correspondente serão atualizados.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={() => { setPreview(null); dadosRef.current = null; }}
              style={btn('ghost', { full: true })}>Reanalisar</button>
            <button onClick={importar}
              style={{ ...btn('primary', { full: true }), fontWeight: 700, fontSize: 15 }}>
              ✅ Atualizar Cadastro (histórico preservado)
            </button>
          </div>
        </div>
      )}

      {sucesso && (
        <div className="scale-in" style={{
          background: theme.successLight, borderRadius: theme.radiusMd,
          padding: 28, textAlign: 'center',
          border: `2px solid ${theme.success}`,
          marginTop: 16,
        }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ fontSize: 18, fontWeight: 800, color: theme.successHover, marginTop: 10 }}>Importação concluída!</p>
          {preview && <p style={{ fontSize: 14, color: theme.textSecondary, marginTop: 6 }}>
            {preview.turmas} turmas, {preview.alunos} alunos, {preview.faltas} registros de frequência
          </p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            <a href="/alunos" style={{ ...btn('primary'), textDecoration: 'none' }}>👥 Ver Alunos</a>
            <a href="/faltas" style={{ ...btn('success'), textDecoration: 'none' }}>📋 Lançar Faltas</a>
          </div>
        </div>
      )}

      {erro && (
        <div className="fade-in" style={{ marginTop: 16 }}>
          {erro.includes('schema cache') || erro.includes('Could not find the table') ? (
            <div style={{
              padding: 16, background: theme.warningLight, borderRadius: theme.radiusMd,
              border: `2px solid ${theme.warning}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                ⚠️ Cache do Supabase desatualizado
              </div>
              <p style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>
                O Supabase precisa recarregar o cache das tabelas. Clique no botão abaixo para tentar automaticamente,
                ou execute no SQL Editor do Supabase:
              </p>
              <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '10px 14px', borderRadius: theme.radius, fontSize: 12, marginBottom: 12, overflow: 'auto' }}>
                NOTIFY pgrst, 'reload schema';
              </pre>
              <button onClick={fixSchema} disabled={fixing} style={btn('warning', { full: true })}>
                {fixing ? <Spinner size={16} /> : '🔄 Recarregar Schema'}
              </button>
            </div>
          ) : (
            <ErrorBox message={erro} />
          )}
        </div>
      )}
    </div>
  );
}
