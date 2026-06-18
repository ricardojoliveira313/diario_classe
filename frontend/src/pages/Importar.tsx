import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { api, supabase } from '../api';
import { theme, btn, card as cardStyle } from '../styles';
import { FileRow, ProgressBar, ErrorBox, Spinner } from '../components';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

// ─── Relatório de conciliação Bolsa Família ────────────────────────────────
function BFConciliacaoPanel({ naoEncontrados }: { naoEncontrados: { nome: string; nasc: string; nis: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const filtrado = busca.trim()
    ? naoEncontrados.filter(r => r.nome.toLowerCase().includes(busca.toLowerCase()) || r.nis.includes(busca))
    : naoEncontrados;

  return (
    <div style={{
      marginTop: 12,
      background: '#fff7ed', border: '1px solid #f59e0b',
      borderRadius: theme.radius,
    }}>
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 700, color: '#b45309', fontSize: 13 }}>
          ⚠️ {naoEncontrados.length} aluno{naoEncontrados.length !== 1 ? 's' : ''} do PDF Bolsa Família não encontrado{naoEncontrados.length !== 1 ? 's' : ''} nos arquivos de matrícula
        </span>
        <span style={{ fontSize: 18, color: '#b45309' }}>{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <div style={{ borderTop: '1px solid #f59e0b33', padding: '8px 14px 12px' }}>
          <p style={{ fontSize: 12, color: '#92400e', marginBottom: 8 }}>
            Estes alunos estão no PDF do Bolsa Família mas <strong>não constam em nenhum arquivo de matrícula importado</strong>.
            Podem ter sido transferidos, desmatriculados, ou o nome/data pode diferir.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="🔍 Buscar nome ou NIS..."
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #f59e0b', fontSize: 13 }}
            />
            <button onClick={() => {
              const csv = 'Nome;Dt. Nasc.;NIS\n' + naoEncontrados.map(r => `${r.nome};${r.nasc};${r.nis}`).join('\n');
              const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob); const a = document.createElement('a');
              a.href = url; a.download = 'BF_nao_encontrados.csv'; a.click();
            }} style={{
              background: '#f59e0b22', border: '1px solid #f59e0b88', borderRadius: 6,
              padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#b45309', fontWeight: 600,
            }}>⬇ CSV</button>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 6, border: '1px solid #f59e0b33' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr',
              padding: '6px 12px', background: '#fef3c7',
              fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase',
            }}>
              <span>Nome (do PDF BF)</span><span>Dt. Nasc.</span><span>NIS</span>
            </div>
            {filtrado.map((r, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr',
                padding: '7px 12px', fontSize: 13,
                background: i % 2 === 0 ? 'transparent' : '#fffbeb',
                borderTop: '1px solid #f59e0b22',
              }}>
                <span style={{ fontWeight: 500 }}>{r.nome || '—'}</span>
                <span style={{ color: '#78716c' }}>{r.nasc || '—'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.nis || '—'}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#92400e', marginTop: 6 }}>
            Mostrando {filtrado.length} de {naoEncontrados.length}
          </p>
        </div>
      )}
    </div>
  );
}

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
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${val.getFullYear()}`;
  }
  const s = String(val).trim();
  if (!s || s === 'undefined' || s === 'null') return '';
  // DD/MM/YYYY (formato brasileiro)
  const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dm) return `${dm[1].padStart(2,'0')}/${dm[2].padStart(2,'0')}/${dm[3]}`;
  // YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS (ISO)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // DD-MM-YYYY
  const dashes = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashes) return `${dashes[1].padStart(2,'0')}/${dashes[2].padStart(2,'0')}/${dashes[3]}`;
  // Número serial do Excel (ex: 46047 = 04/02/2026)
  const num = Number(s);
  if (!isNaN(num) && num > 1 && num < 200000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
    }
  }
  return s;
}

function parseBool(val: any): boolean {
  return String(val ?? '').toUpperCase().trim() === 'SIM';
}

function normalizeStr(s: string): string {
  return s.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ªº°]/g, '');
}

const ARTIGOS = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'NO', 'NA']);

/** Normalização COMPLETA para nomes de alunos — fecha o cerco do cruzamento.
 *  Garante match mesmo com: hífen, apóstrofe, pontos, espaços duplos, acentos.
 *  Ex: "MARIA-CLARA" = "MARIA CLARA" | "D'AVILA" = "DAVILA" | "JR." = "JR"
 */
function normalizeNome(s: string): string {
  return s
    .toUpperCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[.]/g, '')
    .replace(/[\u2018\u2019\u0060\u00b4']/g, ' ')
    .replace(/[\u00aa\u00ba\u00b0]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nomeSignificativo(nome: string): string {
  return nome.split(' ').filter(p => p.length >= 2 && !ARTIGOS.has(p)).join(' ');
}

const SITUACAO_MAP: Record<string, string> = {
  ATIVO: 'ATIVO', REMA: 'REMA', REMANEJADO: 'REMA', 'REMANEJADA': 'REMA', 'REMANEJADO(A)': 'REMA', REMANEJAMENTO: 'REMA',
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
  numero: number;
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
  corRaca: string;
  turmaOrigem: string;
  professoraOrigem: string;
  turmaDestino: string;
  professoraDestino: string;
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
  const dadosRef = useRef<{ turmas: any[]; alunos: AlunoUnificado[]; faltasArr: any[]; educacenso?: any[]; bfNaoEncontrados?: { nome: string; nasc: string; nis: string }[] } | null>(null);
  // Snapshot para rollback em caso de falha na importação
  const rollbackRef = useRef<{ alunosInseridos: any[]; alunosDeletados: any[]; faltasInseridas: any[]; turmasCriadas: any[] } | null>(null);

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

  /** Normaliza data para dígitos (YYYYMMDD) independente do formato de entrada */
  const normalizarData = (d: string): string => {
    const digs = (d || '').replace(/[^0-9]/g, '');
    if (digs.length !== 8) return digs;
    // Se começa com ano (19xx ou 20xx) → já YYYYMMDD
    const pre = parseInt(digs.slice(0, 4), 10);
    if (pre >= 1900 && pre <= 2100) return digs;
    // Senão é DDMMYYYY → converte para YYYYMMDD
    return `${digs.slice(4)}${digs.slice(2, 4)}${digs.slice(0, 2)}`;
  };


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
      const raNumeroByPos = new Map<string, number>();
      const allPdfItems: Array<{ str: string; x: number; y: number; page: number }> = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        texto += content.items.map((item: any) => item.str).join(' ') + '\n';
        for (const it of content.items as any[]) {
          if (!it.str?.trim() || !it.transform) continue;
          allPdfItems.push({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], page: p });
        }
      }

      // ── Detecção da coluna Nr e mapeamento RA→número de chamada ──
      // Agrupa números 1-200 por posição X (±10) e identifica a coluna Nr como
      // o grupo mais à esquerda com ≥3 itens. Depois faz match por proximidade Y
      // dentro de cada página, garantindo que cada Nr é usado apenas uma vez.
      {
        const numCands = allPdfItems.filter(it => /^\d{1,3}$/.test(it.str) && parseInt(it.str) >= 1 && parseInt(it.str) <= 200);
        const xBuckets = new Map<number, typeof numCands>();
        for (const n of numCands) {
          let added = false;
          for (const [bx, bucket] of xBuckets) {
            if (Math.abs(n.x - bx) <= 10) { bucket.push(n); added = true; break; }
          }
          if (!added) xBuckets.set(n.x, [n]);
        }
        const nrCol = [...xBuckets.entries()].filter(([, b]) => b.length >= 3).sort((a, b) => a[0] - b[0])[0];

        if (nrCol) {
          const colX = nrCol[0];
          const nrAll = numCands.filter(n => Math.abs(n.x - colX) <= 10);
          const raAll = allPdfItems.filter(it => /^0{3}\d{9}$/.test(it.str));
          const pages = new Set([...nrAll.map(n => n.page), ...raAll.map(r => r.page)]);

          for (const pg of pages) {
            const nrs = nrAll.filter(n => n.page === pg);
            const ras = raAll.filter(r => r.page === pg).sort((a, b) => b.y - a.y);
            const used = new Set<number>();

            for (const ra of ras) {
              let bestI = -1, bestD = Infinity;
              for (let i = 0; i < nrs.length; i++) {
                if (used.has(i)) continue;
                const d = Math.abs(nrs[i].y - ra.y);
                if (d < bestD) { bestD = d; bestI = i; }
              }
              if (bestI >= 0 && bestD <= 50) {
                raNumeroByPos.set(ra.str, parseInt(nrs[bestI].str));
                used.add(bestI);
              }
            }
          }
        }

        // Fallback: para RAs não mapeados, procura número à esquerda na mesma linha (±8)
        for (const pg of new Set(allPdfItems.map(it => it.page))) {
          const items = allPdfItems.filter(it => it.page === pg);
          const rows = new Map<number, Array<{ str: string; x: number }>>();
          for (const it of items) {
            let rk = Math.round(it.y);
            for (const k of rows.keys()) { if (Math.abs(k - rk) <= 8) { rk = k; break; } }
            if (!rows.has(rk)) rows.set(rk, []);
            rows.get(rk)!.push({ str: it.str, x: it.x });
          }
          for (const cells of rows.values()) {
            const raCells = cells.filter(c => /^0{3}\d{9}$/.test(c.str));
            for (const raCell of raCells) {
              if (raNumeroByPos.has(raCell.str)) continue;
              const nums = cells.filter(c => /^\d{1,3}$/.test(c.str) && c.x < raCell.x);
              if (nums.length > 0) {
                nums.sort((a, b) => a.x - b.x);
                const nr = parseInt(nums[0].str);
                if (nr >= 1 && nr <= 200) raNumeroByPos.set(raCell.str, nr);
              }
            }
          }
        }
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
        const preNome = before.substring(0, nomeMatch.index);
        // XY map é mais confiável (usa coordenadas 2D reais); texto é fallback
        // O stream do pdfjs nem sempre preserva a ordem esquerda→direita dentro da linha
        const xyNr = raNumeroByPos.get(raStr);
        const nrMatch = xyNr ? null : preNome.trimEnd().match(/(\d{1,3})\s*$/);
        const numero = xyNr || (nrMatch ? parseInt(nrMatch[1]) : 0);
        const nome = nomeMatch[1].trim();
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
          if (!serieAluno) continue;
          alunos.push({
            nome, nomeNorm: normalizeNome(nome),
            ra: parseInt(raStr) || null,
            numero,
            nascimento: '',
            serie: serieAluno,
            professora: profAluno || getProfessora(raPos),
            situacao: 'ATIVO', deficiencia: '',
            bolsaFamilia: false,
            dataInicioMatricula: '', dataFimMatricula: '', dataMovimentacao: '',
            nis: '', responsavel: '', cpf: '',
            turmaOrigem: '', professoraOrigem: '', turmaDestino: '', professoraDestino: '', corRaca: '',
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
          || /^(ATIVO|REMA|TRAN|BXTR|ABAN|N\s?COM|NAO\s?COMPAREC|\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4}|$)/i.test(defRawClean)
          || /^(Ano|Diretoria|Escola|Turma|Tipo|Habilitação|Série|Nr\b)/i.test(defRawClean)
        ) ? '' : defRawClean;
        const isAtivo = situacao === 'ATIVO';

        alunos.push({
          nome, nomeNorm: normalizeNome(nome),
          ra: parseInt(raStr) || null,
          numero,
          nascimento,
          serie: serieAluno,
          professora: profAluno || getProfessora(raPos),
          situacao, deficiencia,
          bolsaFamilia: false,
          dataInicioMatricula: '',
          dataFimMatricula: isAtivo ? (dataMovim ?? '') : '',
          dataMovimentacao: isAtivo ? '' : (dataMovim ?? ''),
          nis: '', responsavel: '', cpf: '',
          turmaOrigem: '', professoraOrigem: '', turmaDestino: '', professoraDestino: '', corRaca: '',
          faltas: {},
        });
      }
    }
    return alunos;
  }

  // ─── PARSE: Excel ───
  // datesOnly: mapa externo onde são guardadas datas de séries numéricas não-AEE
  // (FUNDAMENTAL, INFANTIL) — esses alunos não entram no alunosMap, PDF é a base
  function parseExcels(files: File[], datesOnly?: Map<string, { inicio: string; fim: string }>): Promise<AlunoUnificado[]> {
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
            // Diagnóstico: mostra colunas e valores da primeira linha de dados
            if (rows.length > 0) {
              const colsDetectadas = Object.keys(rows[0]).map(k => {
                const normalKey = normalizeStr(String(k).trim())
                  .replace(/[.\-_,;:!?/\\]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                return `"${k}" → "${normalKey}"`;
              });
              console.log(`[Import] Ficheiro: ${file.name} | Aba: ${sheetName} | Colunas detectadas:\n${colsDetectadas.join('\n')}`);
              // Mostra valores das colunas de data na primeira linha
              const primeiraLinha: Record<string, any> = {};
              for (const [k, v] of Object.entries(rows[0])) {
                const normalKey = normalizeStr(String(k).trim()).replace(/[.\-_,;:!?/\\]/g, ' ').replace(/\s+/g, ' ').trim();
                primeiraLinha[normalKey] = v;
              }
              console.log(`[Import] Primeira linha — DATA INICIO MATRICULA: ${JSON.stringify(primeiraLinha['DATA INICIO MATRICULA'])} | tipo: ${typeof primeiraLinha['DATA INICIO MATRICULA']} | DATA FIM MATRICULA: ${JSON.stringify(primeiraLinha['DATA FIM MATRICULA'])}`);
            }
            for (const row of rows) {
              const nr: Record<string, any> = {};
              for (const [k, v] of Object.entries(row)) {
                // Normaliza chave: maiúsculo, sem acentos, pontuação → espaço, espaços colapsados
                // Nota: ( ) NÃO são removidos — preserva chaves como "FREQUENCIA DOS ALUNOS(A)"
                const normalKey = normalizeStr(String(k).trim())
                  .replace(/[.\-_,;:!?/\\]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                nr[normalKey] = v;
              }

              const isDiario = 'FREQUENCIA DOS ALUNOS(A)' in nr;

              const nome = String(nr['NOME DO ALUNO'] ?? nr['NOME'] ?? '').trim();
              // Planilha de diário mensal numera apenas ativos (pula BXTR/REMA) — não é o Nr real da SED.
              // Só usa o Nº de fontes que contenham a lista completa (ex: exportação SED).
              const numero = isDiario ? 0 : (parseInt(String(nr['Nº'] ?? nr['N°'] ?? nr['NR'] ?? nr['NUMERO'] ?? nr['CHAMADA'] ?? '')) || 0);
              let serie = String(nr['SERIE'] ?? nr['TURMA'] ?? '').trim();
              // EJA: séries numéricas 9 e 10 → turmas específicas
              if (serie === '9') serie = 'EJA I ALFABETIZACAO';
              else if (serie === '10') serie = 'EJA I POS ALFABETIZACAO';
              // AEE: série "0" é código interno do SED — usar serie vazia para que o PDF
              // preencha o nome correto da turma via merge, mas preservar data_inicio_matricula
              const tipoEnsinoNorm = normalizeStr(String(nr['TIPO DE ENSINO'] ?? ''));
              if (/^\d{1,3}$/.test(serie) && tipoEnsinoNorm.includes('ATENDIMENTO')) serie = '';
              // Séries numéricas não-AEE (FUNDAMENTAL 1-5, INFANTIL, etc.):
              // PDF é a base — Excel só fornece datas; não entram no alunosMap
              if (!nome || /^\d{1,3}$/.test(serie)) {
                if (datesOnly && nome && /^\d{1,3}$/.test(String(nr['SERIE'] ?? nr['TURMA'] ?? '').trim())) {
                  const raNum = parseInt(String(nr['RA'] ?? '')) || null;
                  if (raNum) {
                    const ini = fmtDate(nr[Object.keys(nr).find(k => normalizeStr(k).includes('INICIO') && normalizeStr(k).includes('MATRI') && !normalizeStr(k).includes('FIM')) ?? '']);
                    const fim = fmtDate(nr[Object.keys(nr).find(k => normalizeStr(k).includes('FIM') && normalizeStr(k).includes('MATRI')) ?? '']);
                    if (ini || fim) datesOnly.set(String(raNum), { inicio: ini, fim: fim });
                  }
                }
                continue;
              }

        const ra = parseInt(String(nr['RA'] ?? '')) || null;
        const nasc = fmtDate(nr['DATA DE NASCIMENTO'] ?? nr['DATA NASCIMENTO']);
        const key = ra ? `RA:${ra}` : `${normalizeNome(nome)}|${nasc}`; // RA-first: alinha com mkKey do merge
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
        const _rawDataInicio = nr['DATA INICIO MATRICULA'] ??
          nr['DATA DE INICIO DA MATRICULA'] ??
          nr['DT INICIO MATRICULA'] ??
          nr['INICIO DA MATRICULA'] ??
          nr['INICIO MATRICULA'] ??
          nr['DATA DA MATRICULA'] ??
          nr['DATA MATRICULA'] ??
          nr['DT MATRICULA'] ??
          nr['DATA DE MATRICULA'] ??
          nr['DT INICIO MATRI'] ??
          nr['DATA INICIO MATRI'] ??
          nr['DT INICIO'] ??
          nr[Object.keys(nr).find(k => k.includes('INICIO') && k.includes('MATRI') && !k.includes('FIM')) ?? ''] ??
          nr[Object.keys(nr).find(k => k.includes('MATRI') && !k.includes('FIM')) ?? ''];
        const dataInicioMatricula = fmtDate(_rawDataInicio);
        // Log de diagnóstico — __diagCount é resetado no início de cada Analisar
        if (nome && (window as any).__diagCount < 10) {
          console.log(`[Diag] ${file.name} | Aluno: ${nome} | raw: ${JSON.stringify(_rawDataInicio)} (${typeof _rawDataInicio}) | fmtDate: "${dataInicioMatricula}" | chaves nr: ${Object.keys(nr).filter(k => k.includes('MATRI') || k.includes('INICIO')).join(', ')}`);
          (window as any).__diagCount = ((window as any).__diagCount || 0) + 1;
        }
        const dataFimMatricula = fmtDate(
          nr['DATA FIM MATRICULA'] ??
          nr['DT FIM MATRICULA'] ??
          nr['FIM MATRICULA'] ??
          nr['DATA FIM'] ??
          nr['DT FIM MATRI'] ??
          nr[Object.keys(nr).find(k => k.includes('FIM') && k.includes('MATRI')) ?? '']
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
                const seriesDiferentes = serie && e.serie && normalizeStr(serie) !== normalizeStr(e.serie);

                if (seriesDiferentes) {
                  const sufKey = `${key}|${normalizeStr(serie)}`;
                  if (alunosMap.has(sufKey)) {
                    const e2 = alunosMap.get(sufKey)!;
                    if (mes > 0 && faltasQtd >= 0) e2.faltas[mes] = { faltas: faltasQtd, frequencia: freqTexto };
                    if (situacao !== 'ATIVO') e2.situacao = situacao;
                    if (professora) e2.professora = professora;
                    if (dataInicioMatricula) e2.dataInicioMatricula = dataInicioMatricula;
                    if (dataFimMatricula) e2.dataFimMatricula = dataFimMatricula;
                    if (dataMovimentacao) e2.dataMovimentacao = dataMovimentacao;
                    if (deficiencia) e2.deficiencia = deficiencia;
                  } else {
                    alunosMap.set(sufKey, {
                      nome, nomeNorm: normalizeNome(nome),
                      ra, numero,
                      nascimento: nasc,
                      serie, professora,
                      situacao, deficiencia,
                      bolsaFamilia,
                      dataInicioMatricula, dataFimMatricula, dataMovimentacao,
                      nis: '', responsavel: '',
                      cpf: String(nr['CPF'] ?? '').replace(/\D/g, '') || '',
                      corRaca: '',
                      turmaOrigem: '', professoraOrigem: '', turmaDestino: '', professoraDestino: '',
                      faltas: mes > 0 && faltasQtd >= 0 ? { [mes]: { faltas: faltasQtd, frequencia: freqTexto } } : {},
                    });
                  }
                } else {
                  if (mes > 0 && faltasQtd >= 0) e.faltas[mes] = { faltas: faltasQtd, frequencia: freqTexto };
                  if (situacao !== 'ATIVO') e.situacao = situacao;
                  if (professora) e.professora = professora;
                  if (dataInicioMatricula) e.dataInicioMatricula = dataInicioMatricula;
                  if (dataFimMatricula) e.dataFimMatricula = dataFimMatricula;
                  if (dataMovimentacao) e.dataMovimentacao = dataMovimentacao;
                  if (deficiencia) e.deficiencia = deficiencia;
                }
                continue;
              }

              alunosMap.set(key, {
                nome, nomeNorm: normalizeNome(nome),
                ra, numero,
                nascimento: nasc,
                serie, professora,
                situacao, deficiencia,
                bolsaFamilia,
                dataInicioMatricula, dataFimMatricula, dataMovimentacao,
                nis: '', responsavel: '',
                cpf: String(nr['CPF'] ?? '').replace(/\D/g, '') || '',
                corRaca: '',
                turmaOrigem: '', professoraOrigem: '', turmaDestino: '', professoraDestino: '',
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
            if (turma && prof) {
              const keyExato = normalizeStr(turma);
              mapa.set(keyExato, { professor: prof, periodo: per });
              // Também guarda versão simplificada: "1ª ETAPA A" → "1 ETAPA A"
              // para casar com "1ª ETAPA PRÉ- ESCOLA A MANHA ANUAL" → "1 ETAPA A"
              const keySimp = keyExato
                .replace(/[ªº°]/g, '').replace(/[-–—]/g, ' ')
                .replace(/\bPRE\s*ESCOLA\b/g, '')
                .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL)\b/g, '')
                .replace(/\s+/g, ' ').trim();
              if (keySimp && keySimp !== keyExato) mapa.set(keySimp, { professor: prof, periodo: per });
            }
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
          // EJA: extrai número de série do nome da turma ("SÉRIE 10 - 3° TERMO...")
          // e mapeia directamente para a turma correcta antes de processar as linhas
          {
            const m = serie.match(/\bS[EÉ]RIE\s+(\d+)\b/i);
            if (m) {
              const n = parseInt(m[1]);
              if (n === 9) serie = 'EJA I ALFABETIZACAO';
              else if (n === 10) serie = 'EJA I POS ALFABETIZACAO';
            }
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
            const normHdr = (h: string) => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
            const serieColIdx = headers.findIndex(h => normHdr(h) === 'SERIE');
            const nomeColIdx = headers.findIndex(h => normHdr(h).includes('NOME'));
            const nrColIdx = headers.findIndex(h => /^(N[º°]?|NR\.?|NUMERO|CHAMADA)$/i.test(normHdr(h)));
            for (let i = headerIdx + 1; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('td');
              const vals = Array.from(cells).map(c => (c.textContent || '').trim());
              if (vals.length < 2) continue;
              const nomeIdx = nomeColIdx >= 0 ? nomeColIdx : 0;
              const nome = vals[nomeIdx]?.length > 3 ? vals[nomeIdx] : '';
              if (!nome || /^\d/.test(nome)) continue;
              const numero = nrColIdx >= 0 && nrColIdx < vals.length ? (parseInt(vals[nrColIdx]) || 0) : 0;
              let raStr = '', nasc = '', situ = 'ATIVO', defi = '';
              for (let j = 0; j < vals.length; j++) {
                if (j === nomeIdx || j === nrColIdx) continue;
                const v = vals[j];
                if (/^\d{6,12}$/.test(v)) raStr = v;
                else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) && !nasc) nasc = fmtDate(v);
                else if (/^(ATIVO|N\s?COM|BAIXA|REMA|TRANSF)/.test(v.toUpperCase())) situ = v;
                else if (v.length > 2 && !/^\d/.test(v) && !nasc) defi = v;
              }
              let rowSerie = serie;
              if (serieColIdx >= 0 && serieColIdx < vals.length) {
                const sNum = parseInt(vals[serieColIdx]);
                if (sNum === 9) rowSerie = 'EJA I ALFABETIZACAO';
                else if (sNum === 10) rowSerie = 'EJA I POS ALFABETIZACAO';
              }
              const ra = parseInt(raStr) || null;
              const key = ra ? `RA:${ra}` : `${normalizeNome(nome)}|${nasc}`;
              if (processados.has(key)) continue;
              processados.add(key);
              alunos.push({
                nome, nomeNorm: normalizeNome(nome),
                ra, numero,
                nascimento: nasc, serie: rowSerie,
                professora: '', situacao: situ, deficiencia: defi,
                bolsaFamilia: false,
                dataInicioMatricula: '', dataFimMatricula: '', dataMovimentacao: '',
                nis: '', responsavel: '', cpf: '',
                turmaOrigem: '', professoraOrigem: '', turmaDestino: '', professoraDestino: '', corRaca: '',
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
      // Aceita NIS com ou sem espaços/hífens: normaliza para só dígitos
      const nisLimpo = nis.replace(/\D/g, '');
      if (nome.length < 3 || !/^\d{11}$/.test(nisLimpo)) return;
      mapa.set(`${nome}|${nasc}`, { nis: nisLimpo, responsavel });
      // Chave por NIS (match direto para alunos que já têm NIS no banco)
      mapa.set(`NIS:${nisLimpo}`, { nis: nisLimpo, responsavel });
      // Chave fuzzy: nome sem artigos + data (tolera variações de "DA"/"DE" entre sistemas)
      const nomeSimp = nomeSignificativo(nome);
      if (nomeSimp.length >= 3 && nasc) {
        mapa.set(`~${nomeSimp}|${nasc}`, { nis: nisLimpo, responsavel });
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
      // Janela de 1500 chars (era 800 — aumentada para blocos maiores)
      const nisRe = /\bNIS[:\s]*(\d[\d\s\-]{9,12}\d)/g;
      let m: RegExpExecArray | null;
      let extraidos1 = 0;
      while ((m = nisRe.exec(texto)) !== null) {
        const nis = m[1];
        const endPos = m.index;
        const lookback = texto.substring(Math.max(0, endPos - 1500), endPos);

        const lastNomeIdx = lookback.lastIndexOf('Nome:');
        if (lastNomeIdx < 0) continue;
        const afterNome = lookback.substring(lastNomeIdx + 5).trimStart();
        const nameStop = afterNome.search(/Dt\.\s*Nasc\.|NIS:|S[eé]rie:|Respons/);
        const nome = normalizeNome((nameStop > 0 ? afterNome.substring(0, nameStop) : afterNome).trim());

        const nascMatches = [...lookback.matchAll(/Dt\.\s*Nasc\.:\s*(\d{1,2}\/\d{1,2}\/\d{4})/g)];
        const nascRaw = nascMatches.length > 0 ? nascMatches[nascMatches.length - 1][1] : '';
        // Normaliza data para DD/MM/YYYY com zeros à esquerda
        const nasc = nascRaw ? nascRaw.split('/').map(p => p.padStart(2, '0')).join('/') : '';

        indexar(nome, nasc, nis, '');
        extraidos1++;
      }

      // Abordagem 2 (fallback por ficheiro — não usa contagem global)
      if (extraidos1 < 5) {
        const blocos = texto.split(/(?=\bNome:\s)/);
        for (const bloco of blocos) {
          if (!bloco.includes('Nome:')) continue;
          const nomeM = bloco.match(/\bNome:\s*(.+?)(?=\s*Dt\.\s*Nasc\.|\s*NIS:|\s*S[eé]rie:|\s*Respons|$)/s);
          const nascM = bloco.match(/Dt\.\s*Nasc\.:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
          const nisM = bloco.match(/\bNIS[:\s]*(\d[\d\s\-]{9,12}\d)/);
          if (nomeM?.[1] && nisM?.[1]) {
            const nascRaw = nascM?.[1] ?? '';
            const nasc = nascRaw ? nascRaw.split('/').map(p => p.padStart(2, '0')).join('/') : '';
            indexar(normalizeNome(nomeM[1].trim()), nasc, nisM[1], '');
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
      const nisLimpo = nis.replace(/\D/g, '');
      if (nome.length < 3 || !/^\d{11}$/.test(nisLimpo)) return;
      mapa.set(`${nome}|${nasc}`, { nis: nisLimpo, responsavel });
      mapa.set(`NIS:${nisLimpo}`, { nis: nisLimpo, responsavel });
      const nomeSimp = nomeSignificativo(nome);
      if (nomeSimp.length >= 3 && nasc) {
        mapa.set(`~${nomeSimp}|${nasc}`, { nis: nisLimpo, responsavel });
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
          currentNome = normalizeNome(nomeM[1].trim());
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
  function safeStr(v: any): string {
    try { return String(v ?? ''); } catch { return ''; }
  }
  function safeNorm(v: any): string {
    try { return normalizeStr(safeStr(v)); } catch { return ''; }
  }
  async function parseEducacensoCPF(files: File[]): Promise<Map<string, { cpf: string; deficiencia: string; corRaca: string }>> {
    const mapa = new Map<string, { cpf: string; deficiencia: string; corRaca: string }>();

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) continue;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      if (!wb.SheetNames || wb.SheetNames.length === 0) continue;
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) continue;
      const rows: any[][] = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) ?? [];

      // Busca cabeçalho — colunas conhecidas do Educacenso:
      //   [3]=Nome  [6]=Data de nascimento  [8]=CPF  [11]=Cor/Raça  [14]=Deficiência
      let headerIdx = -1, idxNome = -1, idxNasc = -1, idxCPF = -1, idxDef = -1, idxCor = -1;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        // Verifica se a linha contém "Nome" e "CPF" nas posições esperadas
        const temNome = row[3] && safeNorm(row[3]) === 'NOME';
        const temCPF = row[8] && safeNorm(row[8]) === 'CPF';
        if (temNome && temCPF) {
          headerIdx = r;
          idxNome = 3;
          idxNasc = 6;
          idxCPF = 8;
          idxDef = 14;
          idxCor = 11;
          break;
        }
        // Fallback: busca por conteúdo (qualquer posição)
        const vals = row.map((v: any) => safeNorm(v));
        const achouNome = vals.some(v => v === 'NOME');
        const achouCPF = vals.some(v => v === 'CPF');
        if (achouNome && achouCPF) {
          headerIdx = r;
          idxNome = vals.indexOf('NOME');
          idxNasc = vals.indexOf('DATA DE NASCIMENTO');
          idxCPF = vals.indexOf('CPF');
          idxDef = vals.findIndex(v => v?.startsWith('TIPO(S) DE DEFICIENCIA'));
          idxCor = vals.indexOf('COR/RACA');
          break;
        }
      }
      if (idxCPF < 0) continue;

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        const nomeRaw = String(row[idxNome] ?? '').trim();
        const cpfRaw = String(row[idxCPF] ?? '').replace(/\D/g, '');
        if (!nomeRaw || nomeRaw === '--') continue;

        const nomeNorm = normalizeNome(nomeRaw);
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
        const corRaw = idxCor >= 0 ? String(row[idxCor] ?? '').trim() : '';
        const corRaca = (!corRaw || corRaw === '--') ? '' : corRaw;
        const entry = { cpf, deficiencia, corRaca };

        // Chave exata: nome|data
        mapa.set(`${nomeNorm}|${nasc}`, entry);
        // Chave por CPF (permite cruzar independente do nome)
        if (cpf) mapa.set(`CPF:${cpf}`, entry);
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
    (window as any).__diagCount = 0; // reset para log aparecer em todo Analisar
    try {
      const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      const xlsFiles = files.filter(f => f.name.toLowerCase().endsWith('.xls'));
      const xlsxFiles = files.filter(f => f.name.toLowerCase().endsWith('.xlsx'));
      const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));

      let alunosPDF: AlunoUnificado[] = [], alunosHTML: AlunoUnificado[] = [], alunosExcel: AlunoUnificado[] = [];
      let turmasMap = new Map<string, { professor: string; periodo: string }>();
      let bolsaMapPDF = new Map<string, { nis: string; responsavel: string }>();
      let bolsaMapTXT = new Map<string, { nis: string; responsavel: string }>();
      let cpfMap = new Map<string, { cpf: string; deficiencia: string; corRaca: string }>();
      try { alunosPDF = await parsePDFs(pdfFiles); } catch (e: any) { setErro('Erro nos PDFs: ' + (e.message ?? e)); return; }
      try { alunosHTML = await parseHTMLSED(xlsFiles); } catch (e: any) { setErro('Erro nos HTML (xls): ' + (e.message ?? e)); return; }
      const excelDatesMap = new Map<string, { inicio: string; fim: string }>();
      try { alunosExcel = await parseExcels(xlsxFiles, excelDatesMap); } catch (e: any) { setErro('Erro nos Excel: ' + (e.message ?? e)); return; }
      try { turmasMap = await parseTurmasProfessores(files); } catch (e: any) { setErro('Erro na planilha Turmas: ' + (e.message ?? e)); return; }
      try { bolsaMapPDF = await parseBolsaFamiliaPDF(pdfFiles); } catch (e: any) { setErro('Erro no PDF Bolsa Família: ' + (e.message ?? e)); return; }
      try { bolsaMapTXT = await parseBolsaFamiliaTXT(txtFiles); } catch (e: any) { setErro('Erro no TXT Bolsa Família: ' + (e.message ?? e)); return; }
      try { cpfMap = await parseEducacensoCPF(xlsxFiles); } catch (e: any) { setErro('Erro no EDUCACENSO: ' + (e.message ?? e)); return; }
      // Merge: TXT tem prioridade (mais confiável), PDF completa o que faltar
      const bolsaMap = new Map([...bolsaMapPDF, ...bolsaMapTXT]);
      // Contagem de entradas únicas no BF (exclui chaves NIS: e ~fuzzy para contar só alunos reais)
      const bfTotalPDF = [...bolsaMap.keys()].filter(k => !k.startsWith('NIS:') && !k.startsWith('~')).length;

      // ─── Cruzamento ───
      const todosAlunos = new Map<string, AlunoUnificado>();
      // Chave: RA (quando disponível) para cruzar PDF + Excel mesmo sem data de nascimento
      // Usa normalizarData para garantir formato YYYYMMDD consistente com a dedup
      const mkKey = (a: AlunoUnificado) =>
        a.ra ? `RA:${a.ra}` : `${a.nomeNorm}|${normalizarData(a.nascimento)}`;
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
          // ⚠️ Só vale se as turmas forem da MESMA modalidade:
          //    Regular→Regular, AEE→AEE, EJA→EJA, Infantil→Infantil
          //    NUNCA cruzando modalidades (ex: AEE→Regular)
          const seriesDiferentes = existente.serie && a.serie
            && normalizeStr(existente.serie) !== normalizeStr(a.serie);

          const detectarModalidade = (serie: string): string => {
            const n = normalizeStr(serie);
            if (/^AEE\b/.test(n) || n.includes('ATENDIMENTO EDUCACIONAL')) return 'AEE';
            if (/\bEJA\b/.test(n) || /\bALFABETIZACAO\b/.test(n) || /\bMULTISSERIADA\b/.test(n) || /\bTERMO\b/.test(n)) return 'EJA';
            if (/\bETAPA\b/.test(n) || /\bPRE\s*ESCOLA\b/.test(n) || /\bMATERNAL\b/.test(n) || /\bBERCARIO\b/.test(n)) return 'INFANTIL';
            return 'REGULAR';
          };

          const mesmaModalidade = seriesDiferentes
            && detectarModalidade(existente.serie) === detectarModalidade(a.serie);

          const ehRemaDuplo = seriesDiferentes && mesmaModalidade && (
            (existente.situacao === 'REMA' && a.situacao === 'ATIVO') ||
            (existente.situacao === 'ATIVO' && a.situacao === 'REMA')
          );

          if (ehRemaDuplo) {
            const rema  = existente.situacao === 'REMA' ? existente : a;
            const ativo = existente.situacao === 'REMA' ? a : existente;
            // Vincula o destino à origem do remanejamento
            ativo.turmaOrigem      = rema.serie;
            ativo.professoraOrigem = rema.professora;
            // Vincula a origem ao destino (REMA sabe pra onde foi)
            rema.turmaDestino      = ativo.serie;
            rema.professoraDestino = ativo.professora;
            // Propaga dados complementares para o destino
            ativo.bolsaFamilia  = ativo.bolsaFamilia  || rema.bolsaFamilia;
            ativo.nis           = ativo.nis           || rema.nis;
            ativo.responsavel   = ativo.responsavel   || rema.responsavel;
            ativo.cpf           = ativo.cpf           || rema.cpf;
            ativo.deficiencia   = ativo.deficiencia   || rema.deficiencia;
            if (!ativo.nascimento && rema.nascimento) ativo.nascimento = rema.nascimento;
            Object.assign(ativo.faltas, rema.faltas);

            // Preservar datas do ATIVO já armazenado (não sobrescrever com vazio)
            const existAtivo = todosAlunos.get(key);
            if (existAtivo) {
              if (!ativo.dataInicioMatricula && existAtivo.dataInicioMatricula)
                ativo.dataInicioMatricula = existAtivo.dataInicioMatricula;
              if (!ativo.dataFimMatricula && existAtivo.dataFimMatricula)
                ativo.dataFimMatricula = existAtivo.dataFimMatricula;
              if (!ativo.dataMovimentacao && existAtivo.dataMovimentacao)
                ativo.dataMovimentacao = existAtivo.dataMovimentacao;
            }
            todosAlunos.set(key, ativo);           // destino (ATIVO) — chave principal

            // Armazena o REMA com chave que inclui a turma de origem
            // Isso permite múltiplos REMAs para o mesmo RA (ex: A→B→C)
            const remaKey = `${key}|REMA|${normalizeStr(rema.serie)}`;
            const existRema = todosAlunos.get(remaKey);
            if (existRema) {
              if (!rema.dataInicioMatricula && existRema.dataInicioMatricula)
                rema.dataInicioMatricula = existRema.dataInicioMatricula;
              if (!rema.dataFimMatricula && existRema.dataFimMatricula)
                rema.dataFimMatricula = existRema.dataFimMatricula;
              if (!rema.dataMovimentacao && existRema.dataMovimentacao)
                rema.dataMovimentacao = existRema.dataMovimentacao;
              if (!rema.turmaDestino && existRema.turmaDestino)
                rema.turmaDestino = existRema.turmaDestino;
              if (!rema.professoraDestino && existRema.professoraDestino)
                rema.professoraDestino = existRema.professoraDestino;
            }
            todosAlunos.set(remaKey, rema);
            return;
          }

          // ─── Múltiplos REMAs: mesmo RA, turmas diferentes, ambos REMA ──────────
          // Cenário: aluno saiu da turma A → B, depois B → C
          // No SED aparece: REMA em A, REMA em B (e ATIVO em C)
          // Cada REMA deve virar um registro separado no banco
          if (seriesDiferentes && existente.situacao === 'REMA' && a.situacao === 'REMA') {
            const remaKey = `${key}|REMA|${normalizeStr(a.serie)}`;
            if (todosAlunos.has(remaKey)) {
              const existRema = todosAlunos.get(remaKey)!;
              Object.assign(existRema.faltas, a.faltas);
              if (!existRema.dataInicioMatricula && a.dataInicioMatricula)
                existRema.dataInicioMatricula = a.dataInicioMatricula;
              if (!existRema.dataMovimentacao && a.dataMovimentacao)
                existRema.dataMovimentacao = a.dataMovimentacao;
              if (!existRema.turmaDestino && a.turmaDestino)
                existRema.turmaDestino = a.turmaDestino;
              if (!existRema.professoraDestino && a.professoraDestino)
                existRema.professoraDestino = a.professoraDestino;
            } else {
              todosAlunos.set(remaKey, { ...a, situacao: 'REMA' });
            }
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
          if (a.numero) existente.numero = a.numero;
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

      // ─── Suplementar datas do Excel para alunos vindos do PDF ──────────────
      // excelDatesMap tem datas de séries numéricas (FUNDAMENTAL, INFANTIL) que
      // não entraram no alunosMap — aplica apenas se o aluno não tiver a data já
      if (excelDatesMap.size > 0) {
        for (const a of todosAlunos.values()) {
          if (!a.ra) continue;
          const d = excelDatesMap.get(String(a.ra));
          if (!d) continue;
          if (!a.dataInicioMatricula && d.inicio) a.dataInicioMatricula = d.inicio;
          if (!a.dataFimMatricula && d.fim) a.dataFimMatricula = d.fim;
        }
      }

      // ─── Reconciliação pós-merge: mesmo aluno com RA num arquivo e sem RA noutro ──
      // Ex: PDF extrai RA mas Excel não tem coluna RA → dois keys diferentes (RA:xxx vs NOME|data)
      // Varredura: entradas sem RA que tenham nome+data idênticos a uma entrada COM RA
      const alunosSemRA = Array.from(todosAlunos.entries()).filter(([, a]) => !a.ra);
      for (const [key, semRA] of alunosSemRA) {
        if (!todosAlunos.has(key)) continue; // já foi removido por reconciliação anterior
        for (const [otherKey, comRA] of todosAlunos) {
          if (comRA === semRA || !comRA.ra) continue;
          if (comRA.nomeNorm !== semRA.nomeNorm) continue;
          if (normalizarData(comRA.nascimento) !== normalizarData(semRA.nascimento)) continue;
          // Merge: dados do semRA → comRA
          comRA.bolsaFamilia  = comRA.bolsaFamilia  || semRA.bolsaFamilia;
          comRA.nis           = comRA.nis           || semRA.nis;
          comRA.responsavel   = comRA.responsavel   || semRA.responsavel;
          comRA.cpf           = comRA.cpf           || semRA.cpf;
          comRA.deficiencia   = comRA.deficiencia   || semRA.deficiencia;
          comRA.corRaca       = comRA.corRaca       || semRA.corRaca;
          if (!comRA.numero && semRA.numero) comRA.numero = semRA.numero;
          if (!comRA.dataInicioMatricula && semRA.dataInicioMatricula) comRA.dataInicioMatricula = semRA.dataInicioMatricula;
          if (!comRA.dataFimMatricula && semRA.dataFimMatricula) comRA.dataFimMatricula = semRA.dataFimMatricula;
          if (!comRA.dataMovimentacao && semRA.dataMovimentacao) comRA.dataMovimentacao = semRA.dataMovimentacao;
          if (!comRA.serie && semRA.serie) comRA.serie = semRA.serie;
          if (!comRA.professora && semRA.professora) comRA.professora = semRA.professora;
          Object.assign(comRA.faltas, semRA.faltas);
          todosAlunos.delete(key);
          break;
        }
      }

      // Enriquece com professor da tabela TURMA-PROFESSORES
      const alunosArr = Array.from(todosAlunos.values());

      // Renumeração de alunos sem número (numero=0): recebem número sequencial no fim da turma,
      // ordenados por data_inicio_matricula (alunos que entraram mais tarde ficam por último).
      const porSerie = new Map<string, AlunoUnificado[]>();
      for (const a of alunosArr) {
        const s = a.serie || '';
        if (!porSerie.has(s)) porSerie.set(s, []);
        porSerie.get(s)!.push(a);
      }
      for (const grupo of porSerie.values()) {
        const comNum = grupo.filter(a => a.numero > 0);
        const semNum = grupo.filter(a => !a.numero && a.situacao !== 'REMA');
        if (!semNum.length) continue;
        const maxNum = comNum.reduce((m, a) => Math.max(m, a.numero), 0);
        // Ordena sem número por data de início de matrícula (mais antiga primeiro)
        semNum.sort((a, b) => {
          const da = normalizarData(a.dataInicioMatricula);
          const db = normalizarData(b.dataInicioMatricula);
          if (da && db) return da.localeCompare(db);
          if (da) return -1;
          if (db) return 1;
          return a.nomeNorm.localeCompare(b.nomeNorm);
        });
        semNum.forEach((a, i) => { a.numero = maxNum + i + 1; });
      }

      // Rastreio de NIS do BF que foram cruzados com algum aluno do arquivo
      const bfUsados = new Set<string>();
      for (const a of alunosArr) {
        // Busca exata, depois simplificada (sem PRÉ-ESCOLA/MANHA/ANUAL), depois por prefixo
        const serieNorm = normalizeStr(a.serie);
        // Versão simplificada para casar "1ª ETAPA PRÉ- ESCOLA A MANHA ANUAL" → "1 ETAPA A"
        const serieSimp = serieNorm
          .replace(/[ªº°]/g, '').replace(/[-–—]/g, ' ')
          .replace(/\bPRE\s*ESCOLA\b/g, '')
          .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL)\b/g, '')
          .replace(/\s+/g, ' ').trim();
        let tp = turmasMap.get(serieNorm) ?? turmasMap.get(serieSimp);
        if (!tp) {
          // Tenta bater por prefixo: chave do mapa contém a série ou vice-versa
          for (const [k, v] of turmasMap.entries()) {
            if (k.startsWith(serieNorm) || serieNorm.startsWith(k)) { tp = v; break; }
          }
        }
        if (tp) {
          if (tp.professor && !a.professora) a.professora = tp.professor;
          if (tp.periodo && a.serie && !a.serie.toLowerCase().includes(tp.periodo.toLowerCase())) {
            // Não sobrescreve o nome da turma, só usa o período para enriquecer se necessário
          }
        }
        // Cruzamento Bolsa Família: nome+data (exato) → fuzzy → NIS direto
        const bfExato = bolsaMap.get(`${a.nomeNorm}|${a.nascimento}`);
        const nomeSimp = nomeSignificativo(a.nomeNorm);
        const bfFuzzy = a.nascimento ? bolsaMap.get(`~${nomeSimp}|${a.nascimento}`) : undefined;
        // Fallback: match por NIS se o aluno já tem NIS (de importação anterior)
        const bfNIS = a.nis ? bolsaMap.get(`NIS:${a.nis}`) : undefined;
        const bf = bfExato ?? bfFuzzy ?? bfNIS;
        if (bf) {
          a.nis = a.nis || bf.nis;
          a.responsavel = a.responsavel || bf.responsavel;
          a.bolsaFamilia = true;
          // Marca a entrada do mapa como usada (para relatório de não encontrados)
          bfUsados.add(bf.nis);
        }
        // Cruzamento CPF + Deficiência + Cor/Raça (EDUCACENSO): CPF → nome+data → fuzzy
        const ecPorCPF = a.cpf ? cpfMap.get(`CPF:${a.cpf}`) : undefined;
        const ecExato = !ecPorCPF ? cpfMap.get(`${a.nomeNorm}|${a.nascimento}`) : undefined;
        const ecFuzzy = !ecPorCPF && a.nascimento ? cpfMap.get(`~${nomeSimp}|${a.nascimento}`) : undefined;
        const ec = ecPorCPF ?? ecExato ?? ecFuzzy;
        if (ec) {
          a.cpf = ec.cpf || a.cpf || '';
          a.deficiencia = a.deficiencia || ec.deficiencia || '';
          a.corRaca = a.corRaca || ec.corRaca || '';
        }
      }

      // ─── Relatório BF: entradas do PDF que não encontraram aluno no arquivo ───
      // (só entradas com chave nome|data, excluindo NIS: e ~fuzzy)
      const bfNaoEncontrados: { nome: string; nasc: string; nis: string }[] = [];
      for (const [chave, val] of bolsaMap.entries()) {
        if (chave.startsWith('NIS:') || chave.startsWith('~')) continue;
        if (!bfUsados.has(val.nis)) {
          const parts = chave.split('|');
          bfNaoEncontrados.push({ nome: parts[0] ?? '', nasc: parts[1] ?? '', nis: val.nis });
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
        .replace(/[ªº°]/g, '').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
      const ALIASES2: Record<string, string> = {
        'ALFABETIZACAO': 'EJA I ALFABETIZACAO', 'EJA ALFABETIZACAO': 'EJA I ALFABETIZACAO',
        'TURMA ALFABETIZACAO': 'EJA I ALFABETIZACAO',
        'POS ALFABETIZACAO': 'EJA I POS ALFABETIZACAO', 'EJA POS ALFABETIZACAO': 'EJA I POS ALFABETIZACAO',
        'TURMA POS ALFABETIZACAO': 'EJA I POS ALFABETIZACAO',
      };
      // Catch-all para nomes SED: "MULTISSERIADA" = Alfabetização, "TERMO" = Pós-Alfa
      const applyAlias2 = (s: string): string => {
        const n = normT2(s);
        const nSemSufixo = n
          .replace(/\bPRE\s*ESCOLA\b/g, '')
          .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL)\b/g, '')
          .replace(/\s+/g, ' ').trim();
        if (ALIASES2[nSemSufixo]) return ALIASES2[nSemSufixo];
        if (n.includes('MULTISSERIADA')) return 'EJA I ALFABETIZACAO';
        if (/\bTERMO\b/.test(n)) return 'EJA I POS ALFABETIZACAO';
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

      const bfCruzados = alunosArr.filter(a => a.bolsaFamilia).length;
      const prev = {
        turmas: turmasUnicas.size,
        turmasReconhecidas,
        alunos: alunosArr.length,
        bolsaFamilia: bfCruzados,
        bolsaFamiliaTotal: bfTotalPDF,    // total extraído do PDF BF
        bolsaMapSize: bolsaMap.size,
        arquivos: files.length,
        faltas: totalFaltas,
      };
      setPreview(prev);
      // Converte cpfMap (Map) em array para serialização — só entradas com nome real
      const educacensoArr = Array.from(cpfMap.entries())
        .filter(([chave]) => !chave.startsWith('CPF:') && !chave.startsWith('~'))
        .map(([chave, val]) => ({ chave, ...val }));
      dadosRef.current = { turmas: Array.from(turmasUnicas.values()), alunos: alunosArr, faltasArr: [], educacenso: educacensoArr, bfNaoEncontrados };
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
    // \bEJAI\b → EJA I: "EJAI - ALFABETIZAÇÃO" e "EJA I ALFABETIZAÇÃO" são a mesma turma
    const normT = (s: string) => (s ?? '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[ªº°]/g, '')
      .replace(/[-–—]/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .replace(/\bEJAI\b/g, 'EJA I');

    // Remove sufixos verbosos do SED: "1ª ETAPA PRÉ-ESCOLA A MANHA ANUAL" → "1 ETAPA A"
    const normSerieSED = (s: string) => normT(s)
      .replace(/\bPRE\s*ESCOLA\b/g, '')
      .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL|SEMI\s*INTEGRAL)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Aliases: nomes usados no SED/PDF → nome cadastrado no sistema
    const ALIASES: Record<string, string> = {
      'ALFABETIZACAO':           'EJA I ALFABETIZACAO',
      'EJA ALFABETIZACAO':       'EJA I ALFABETIZACAO',
      'TURMA ALFABETIZACAO':     'EJA I ALFABETIZACAO',
      'POS ALFABETIZACAO':       'EJA I POS ALFABETIZACAO',
      'EJA POS ALFABETIZACAO':   'EJA I POS ALFABETIZACAO',
      'TURMA POS ALFABETIZACAO': 'EJA I POS ALFABETIZACAO',
    };
    const applyAlias = (serie: string): string => {
      const n = normT(serie);
      const nSemSufixo = n
        .replace(/\bPRE\s*ESCOLA\b/g, '')
        .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL|SEMI\s*INTEGRAL)\b/g, '')
        .replace(/\s+/g, ' ').trim();
      if (ALIASES[nSemSufixo]) return ALIASES[nSemSufixo];
      if (n.includes('MULTISSERIADA')) return 'EJA I ALFABETIZACAO';
      if (/\bTERMO\b/.test(n)) return 'EJA I POS ALFABETIZACAO';
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
            // Recolhe TODOS os prefix-matches (não só o primeiro) para que a
            // disambiguação por professora funcione quando há múltiplas turmas com
            // prefixo igual (ex: "EJA I ALFABETIZACAO" e "EJA I POS ALFABETIZACAO")
            const allPrefix: Array<{ id: string; professora: string }> = [];
            for (const [k, v] of serieToTurmasList.entries()) {
              if (k.startsWith(key) || key.startsWith(k)) allPrefix.push(...v);
            }
            if (allPrefix.length) candidates = allPrefix;
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

    // Guarda snapshot dos registros deletados para rollback em caso de falha
    const snapAlunosDeletados: any[] = [];

    try {
      // ─── PASSO 1: Turmas — upsert por nome com alias (evita duplicatas SED) ───
      setStatus('Carregando turmas cadastradas...');
      const turmasExistentes = await api.getTurmas();
      // Mapa: nome original → id, e nome normalizado → id (matching fuzzy)
      const nomeToTurmaId = new Map(turmasExistentes.map(t => [t.nome, t.id]));
      const normToTurmaId = new Map(turmasExistentes.map(t => [normT(t.nome), t.id]));
      for (const t of turmasExistentes) {
        const aliasT = applyAlias(t.nome);
        if (aliasT !== t.nome) normToTurmaId.set(normT(aliasT), t.id);
      }
      // Detecta tipo da turma pelo nome: AEE → 'AEE', outros → preserva existente
      const detectarTipo = (nome: string, existente?: any): string | undefined => {
        const n = normT(nome);
        if (/^AEE\b/.test(n) || n.includes('ATENDIMENTO EDUCACIONAL')) return 'AEE';
        return existente?.tipo || undefined;
      };

      const turmasParaUpsert = turmas.map(t => {
        // Tenta match exato, depois por alias (SED → nome limpo)
        let id = nomeToTurmaId.get(t.nome);
        let matchName: string | undefined;
        if (!id) {
          const aliased = applyAlias(t.nome);
          const nAliased = normT(aliased);
          for (const [origName, tid] of nomeToTurmaId) {
            if (normT(origName) === nAliased) { id = tid; matchName = origName; break; }
          }
        }
        if (!id) {
          // Tenta match parcial: SED "1 ETAPA PRE ESCOLA A MANHA" → "1 ETAPA A"
          const n = normT(t.nome);
          const simplificado = n
            .replace(/\bPRE\s*ESCOLA\b/g, '').replace(/\bPRÉ\s*ESCOLA\b/g, '')
            .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL)\b/g, '')
            .replace(/\s+/g, ' ').trim();
          for (const [origName, tid] of nomeToTurmaId) {
            const nn = normT(origName);
            if (nn === simplificado || nn.startsWith(simplificado) || simplificado.startsWith(nn)) {
              id = tid; matchName = origName; break;
            }
          }
        }
        // Se já existe, preserva nome e professora do banco (não sobrescreve com SED)
        if (id && matchName) {
          const existente = turmasExistentes.find((x: any) => x.id === id);
          const tipo = detectarTipo(matchName, existente);
          return { id, nome: matchName, professora: existente?.professora || t.professora || '', ...(tipo ? { tipo } : {}) };
        }
        if (id) {
          const existente = turmasExistentes.find((x: any) => x.id === id);
          const tipo = detectarTipo(t.nome, existente);
          return { id, nome: t.nome, professora: existente?.professora || t.professora || '', ...(tipo ? { tipo } : {}) };
        }
        const tipo = detectarTipo(t.nome);
        return { nome: t.nome, professora: t.professora, ...(tipo ? { tipo } : {}) };
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

      // ─── PASSO 1.2: Garante tipo='AEE' em todas as turmas com nome AEE* ───
      {
        const { data: todasTurmasAtual } = await supabase.from('Turma').select('id, nome, tipo');
        const semTipoAEE = (todasTurmasAtual ?? []).filter(t =>
          /^AEE\b/i.test(t.nome) && t.tipo !== 'AEE'
        );
        for (const t of semTipoAEE) {
          await supabase.from('Turma').update({ tipo: 'AEE' }).eq('id', t.id);
        }
      }

      // PASSO 1.5: Turmas com sufixos SED (MANHÃ, TARDE…) — migra alunos para a turma limpa
      // mas NUNCA apaga a turma original. Turmas são dados permanentes (como CPF e Educacenso).
      // A limpeza manual pode ser feita na página Turmas se necessário.
      const SED_SUFIXOS = /\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL|PRE\s*ESCOLA)\b/i;
      const strippaSED = (s: string) => normT(s)
        .replace(/\bPRE\s*ESCOLA\b/g, '').replace(/\bPRÉ\s*ESCOLA\b/g, '')
        .replace(/\b(MANHA|TARDE|NOTURNO|MATUTINO|VESPERTINO|NOITE|ANUAL|INTEGRAL)\b/g, '')
        .replace(/\s+/g, ' ').trim();
      const turmaIdToProf = new Map<string, string>(
        turmasExistentes.map((t: any) => [t.id, normT(t.professora ?? '')])
      );
      for (const t of turmasExistentes) {
        if (!SED_SUFIXOS.test(t.nome)) continue;
        const simplificado = strippaSED(t.nome);
        const srcProf = normT(t.professora ?? '');
        for (const [origName, tid] of nomeToTurmaId) {
          if (t.id === tid) continue;
          const nn = normT(origName);
          if (nn !== simplificado) continue;
          const dstProf = turmaIdToProf.get(tid) ?? '';
          if (srcProf && dstProf && srcProf !== dstProf) continue;
          // Migra alunos e faltas para a turma com nome limpo — mas não apaga a turma SED
          await supabase.from('Aluno').update({ turmaId: tid }).eq('turmaId', t.id);
          await supabase.from('Falta').update({ turmaId: tid }).eq('turmaId', t.id);
          // NÃO apaga a turma — turmas são permanentes no banco
          break;
        }
      }

      // Reconstrói resolveId com turmas atualizadas do DB (inclui novas)
      const { data: todasTurmas } = await supabase.from('Turma').select('id, nome, professora');
      const turmaIdToNome = new Map<string, string>();
      for (const t of (todasTurmas ?? [])) turmaIdToNome.set(t.id, t.nome);
      const resolveIdAtualizado = buildResolveId(todasTurmas ?? []);

      // IDs das turmas AEE — detecta pelo nome (robusto) e pelo campo tipo
      // Assim funciona mesmo que tipo='AEE' não esteja preenchido na BD
      const aeeturmaIds = new Set<string>(
        (todasTurmas ?? [])
          .filter((t: any) => t.tipo === 'AEE' || /^AEE\b/i.test(t.nome ?? ''))
          .map((t: any) => t.id)
      );

      // ─── PASSO 2: Alunos — upsert por RA (preserva UUIDs → preserva faltas) ───
      // AEE: alunos têm 2 registros separados (turma regular + turma AEE) — mesmo padrão que REMA
      setStatus('Atualizando cadastro de alunos...');

      // Garante coluna aee consistente antes de construir os mapas.
      // Registos em turmas AEE com aee=NULL/FALSE conflituam com aluno_ra_uniq
      // (o índice inclui aee IS NOT TRUE). Corrigir antes do import previne a violação.
      {
        const aeeIds = Array.from(aeeturmaIds);
        if (aeeIds.length > 0) {
          await supabase.from('Aluno').update({ aee: true }).in('turmaId', aeeIds).neq('aee', true);
        }
      }

      const { data: existentes } = await supabase
        .from('Aluno').select('id, ra, nome, situacao, cpf, nis, responsavel, bolsa_familia, turmaId, data_nascimento, cor_raca, deficiencia, aee, data_inicio_matricula, data_fim_matricula').range(0, 99999);

      // ─── PRÉ-LIMPEZA: remove duplicatas de RA em TODO o banco antes de importar ──
      // Roda em toda importação, independente do arquivo — garante banco sempre limpo
      // idsRemovidosPreLimpeza: declarado FORA do bloco para que o loop de mapas abaixo
      // pule esses IDs — evita que o upsert recrie registros que acabaram de ser apagados
      const idsRemovidosPreLimpeza = new Set<string>();
      let snapFantasmas: any[] = [];
      {
        const raGrupos = new Map<string, Array<{ id: string; cpf?: string; nis?: string; responsavel?: string; bolsa_familia?: boolean }>>();
        for (const e of (existentes ?? [])) {
          if (!e.ra || e.situacao === 'REMA') continue;
          // Alinha com aluno_ra_uniq: só exclui registos com aee=TRUE (coluna, não turmaId)
          if (e.aee === true) continue;
          const k = String(e.ra);
          if (!raGrupos.has(k)) raGrupos.set(k, []);
          raGrupos.get(k)!.push(e);
        }
        const grupos = Array.from(raGrupos.values()).filter(g => g.length > 1);
        if (grupos.length > 0) {
          setStatus(`🔧 Encontradas ${grupos.length} duplicata(s) — unificando...`);
          const todosDupIds = grupos.flatMap(g => g.map(e => e.id));
          const { data: faltasGrupos } = await supabase
            .from('Falta').select('id, alunoId, mes, ano').in('alunoId', todosDupIds);
          const faltasPorAluno = new Map<string, Array<{ id: string; mes: number; ano: number }>>();
          for (const f of (faltasGrupos ?? [])) {
            if (!faltasPorAluno.has(f.alunoId)) faltasPorAluno.set(f.alunoId, []);
            faltasPorAluno.get(f.alunoId)!.push(f);
          }
          for (const grupo of grupos) {
            // Canônico = o que tem mais faltas; empate → primeiro da lista
            const canonico = grupo.reduce((best, cur) =>
              (faltasPorAluno.get(cur.id)?.length ?? 0) > (faltasPorAluno.get(best.id)?.length ?? 0) ? cur : best
            );
            const extras = grupo.filter(e => e.id !== canonico.id);
            const mesesCanon = new Set(
              (faltasPorAluno.get(canonico.id) ?? []).map(f => `${f.mes}-${f.ano}`)
            );
            for (const extra of extras) {
              const faltasExtra = faltasPorAluno.get(extra.id) ?? [];
              const transferir = faltasExtra.filter(f => !mesesCanon.has(`${f.mes}-${f.ano}`)).map(f => f.id);
              const apagar = faltasExtra.filter(f => mesesCanon.has(`${f.mes}-${f.ano}`)).map(f => f.id);
              if (transferir.length > 0)
                await supabase.from('Falta').update({ alunoId: canonico.id }).in('id', transferir);
              if (apagar.length > 0)
                await supabase.from('Falta').delete().in('id', apagar);
              // Preserva dados manuais do extra no canônico
              const up: any = {};
              if (extra.bolsa_familia && !canonico.bolsa_familia) up.bolsa_familia = true;
              if (extra.cpf && !canonico.cpf) up.cpf = extra.cpf;
              if (extra.nis && !canonico.nis) up.nis = extra.nis;
              if (extra.responsavel && !canonico.responsavel) up.responsavel = extra.responsavel;
              if (Object.keys(up).length > 0)
                await supabase.from('Aluno').update(up).eq('id', canonico.id);
              snapAlunosDeletados.push(extra); // snapshot para rollback
              await supabase.from('Aluno').delete().eq('id', extra.id);
              idsRemovidosPreLimpeza.add(extra.id); // marca para ignorar nos mapas abaixo
            }
          }
        }
      }
      // ─── PRÉ-LIMPEZA NOME: detecta duplicados por nome+nascimento (RAs diferentes ou sem RA)
      {
        const grpNomePre = new Map<string, any[]>();
        for (const e of (existentes ?? [])) {
          if (idsRemovidosPreLimpeza.has(e.id)) continue;
          if (e.situacao === 'REMA') continue;
          if (e.aee === true) continue;
          if (e.turmaId && aeeturmaIds.has(e.turmaId)) continue;
          const nn = normalizeNome(e.nome);
          const dn = normalizarData(e.data_nascimento || '');
          if (!nn) continue;
          const k = `${nn}|${dn}`;
          if (!grpNomePre.has(k)) grpNomePre.set(k, []);
          grpNomePre.get(k)!.push(e);
        }
        const dupsNomePre = Array.from(grpNomePre.values()).filter(g => g.length > 1);
        if (dupsNomePre.length > 0) {
          setStatus(`🔧 Unificando ${dupsNomePre.length} duplicata(s) por nome...`);
          const todosIdsPre = dupsNomePre.flatMap(g => g.map(a => a.id));
          const { data: ftsNomePre } = await supabase
            .from('Falta').select('id, alunoId, mes, ano').in('alunoId', todosIdsPre);
          const ftsPorAlunoPre = new Map<string, any[]>();
          for (const f of (ftsNomePre ?? [])) {
            if (!ftsPorAlunoPre.has(f.alunoId)) ftsPorAlunoPre.set(f.alunoId, []);
            ftsPorAlunoPre.get(f.alunoId)!.push(f);
          }
          for (const grupo of dupsNomePre) {
            const canon = grupo.reduce((best: any, cur: any) =>
              (ftsPorAlunoPre.get(cur.id)?.length ?? 0) > (ftsPorAlunoPre.get(best.id)?.length ?? 0) ? cur : best
            );
            const mesesCanon = new Set((ftsPorAlunoPre.get(canon.id) ?? []).map((f: any) => `${f.mes}-${f.ano}`));
            for (const extra of grupo) {
              if (extra.id === canon.id) continue;
              const faltasExtra = ftsPorAlunoPre.get(extra.id) ?? [];
              const transferir = faltasExtra.filter((f: any) => !mesesCanon.has(`${f.mes}-${f.ano}`)).map((f: any) => f.id);
              const apagar = faltasExtra.filter((f: any) => mesesCanon.has(`${f.mes}-${f.ano}`)).map((f: any) => f.id);
              if (transferir.length > 0)
                await supabase.from('Falta').update({ alunoId: canon.id }).in('id', transferir);
              if (apagar.length > 0)
                await supabase.from('Falta').delete().in('id', apagar);
              const up: any = {};
              if (extra.bolsa_familia && !canon.bolsa_familia) up.bolsa_familia = true;
              if (extra.cpf && !canon.cpf) up.cpf = extra.cpf;
              if (extra.nis && !canon.nis) up.nis = extra.nis;
              if (extra.ra && !canon.ra) up.ra = extra.ra;
              if (extra.responsavel && !canon.responsavel) up.responsavel = extra.responsavel;
              if (Object.keys(up).length > 0)
                await supabase.from('Aluno').update(up).eq('id', canon.id);
              snapAlunosDeletados.push(extra);
              await supabase.from('Aluno').delete().eq('id', extra.id);
              idsRemovidosPreLimpeza.add(extra.id);
            }
          }
        }
      }
      // ─── PRÉ-LIMPEZA REMA: remove registros REMA duplicados ─────────────────────
      {
        // Fase 1: REMA com turmaId=null são fantasmas — apagar se já existe REMA
        // com turmaId real para o mesmo RA (criados em imports anteriores com turma não resolvida)
        const raComRemaReal = new Set<string>();
        for (const e of (existentes ?? [])) {
          if (e.situacao === 'REMA' && e.ra && e.turmaId) raComRemaReal.add(String(e.ra));
        }
        for (const e of (existentes ?? [])) {
          if (e.situacao !== 'REMA' || !e.ra || e.turmaId) continue; // só null turmaId
          if (raComRemaReal.has(String(e.ra))) {
            await supabase.from('Aluno').delete().eq('id', e.id);
            idsRemovidosPreLimpeza.add(e.id);
          }
        }
        // Fase 2: agrupar por RA|turmaNome (não por turmaId) para detectar duplicados
        // criados quando a turma foi recriada com nova UUID em imports anteriores
        const remaGrupos = new Map<string, Array<{ id: string; turmaId: string | null }>>();
        for (const e of (existentes ?? [])) {
          if (e.situacao !== 'REMA' || !e.ra || idsRemovidosPreLimpeza.has(e.id)) continue;
          const turmaNome = e.turmaId ? (turmaIdToNome.get(e.turmaId) ?? e.turmaId) : 'null';
          const k = `${String(e.ra)}|${turmaNome}`;
          if (!remaGrupos.has(k)) remaGrupos.set(k, []);
          remaGrupos.get(k)!.push({ id: e.id, turmaId: e.turmaId ?? null });
        }
        for (const [, entries] of remaGrupos) {
          if (entries.length <= 1) continue;
          // Preferir o registro cujo turmaId ainda existe na tabela Turma (turma atual)
          const comTurmaAtual = entries.find(e => e.turmaId && turmaIdToNome.has(e.turmaId));
          const manter = comTurmaAtual ?? entries[0];
          for (const e of entries) {
            if (e.id === manter.id) continue;
            await supabase.from('Aluno').delete().eq('id', e.id);
            idsRemovidosPreLimpeza.add(e.id);
          }
        }
      }
      // ─── LOOKUP FRESCO: lê o banco DEPOIS da pré-limpeza ──────────────────
      // Mapas directos RA→registo: REMA, AEE e Regular em mapas separados
      // Sem idTo* indirectos — preservamos dados do registo existente na hora do upsert
      const { data: existentesAtualizados } = await supabase
        .from('Aluno').select('id, ra, nome, situacao, cpf, nis, responsavel, bolsa_familia, turmaId, data_nascimento, cor_raca, deficiencia, aee, data_inicio_matricula, data_fim_matricula, data_movimentacao').range(0, 99999);
      const existentesFrescos = existentesAtualizados ?? existentes ?? [];
      const freshRegular = new Map<string, any>();  // RA → registo (não-REMA, não-AEE)
      const freshAEE = new Map<string, any>();      // RA → registo AEE
      const freshRema = new Map<string, any>();     // RA|turmaNome → registo REMA
      const freshByName = new Map<string, any[]>(); // nome|nasc → registos (para alunos sem RA)
      for (const e of existentesFrescos) {
        const nomeKey = `${normalizeNome(e.nome)}|${normalizarData(e.data_nascimento || '')}`;
        if (!freshByName.has(nomeKey)) freshByName.set(nomeKey, []);
        freshByName.get(nomeKey)!.push(e);
        if (!e.ra) continue;
        const raStr = String(e.ra);
        if (e.situacao === 'REMA') {
          const turmaNome = e.turmaId ? (turmaIdToNome.get(e.turmaId) ?? '') : '';
          freshRema.set(`${raStr}|${normalizeStr(turmaNome)}`, e);
          if (e.turmaId) freshRema.set(`${raStr}|TID:${e.turmaId}`, e);
        } else if (e.aee === true || (e.turmaId && aeeturmaIds.has(e.turmaId))) {
          freshAEE.set(raStr, e);
        } else {
          freshRegular.set(raStr, e);
        }
      }

      // ─── Carrega EDUCACENSO do banco (tabela fixa) e enriquece alunos ───
      const { data: dbEducData } = await supabase
        .from('Educacenso')
        .select('nome, data_nascimento, cpf, deficiencia, cor_raca');
      if (dbEducData) {
        const dbEduc = new Map<string, { cpf: string; deficiencia: string; corRaca: string }>();
        for (const rec of dbEducData) {
          if (!rec.cpf && !rec.nome) continue;
          const entry = { cpf: rec.cpf || '', deficiencia: rec.deficiencia || '', corRaca: rec.cor_raca || '' };
          if (rec.cpf) dbEduc.set(`CPF:${rec.cpf}`, entry);
          if (rec.nome) {
            const nn = normalizeNome(rec.nome);
            dbEduc.set(`${nn}|${rec.data_nascimento || ''}`, entry);
            if (rec.data_nascimento) {
              const simp = nomeSignificativo(nn);
              if (simp.length >= 3) dbEduc.set(`~${simp}|${rec.data_nascimento}`, entry);
            }
          }
        }
        for (const a of alunos) {
          if (a.cpf && a.deficiencia && a.corRaca) continue;
          const ecPorCPF = a.cpf ? dbEduc.get(`CPF:${a.cpf}`) : undefined;
          const ecExato = !ecPorCPF ? dbEduc.get(`${a.nomeNorm}|${a.nascimento}`) : undefined;
          const simp = nomeSignificativo(a.nomeNorm);
          const ecFuzzy = !ecPorCPF && a.nascimento ? dbEduc.get(`~${simp}|${a.nascimento}`) : undefined;
          const ec = ecPorCPF ?? ecExato ?? ecFuzzy;
          if (ec) {
            if (!a.cpf) a.cpf = ec.cpf;
            if (!a.deficiencia) a.deficiencia = ec.deficiencia;
            if (!a.corRaca) a.corRaca = ec.corRaca || '';
          }
        }
      }

      // ─── Resolução de ID: lookup directo nos mapas frescos ──────────────────
      // Regra: RA é a chave natural. O mapa fresco garante que nunca geramos UUID
      // novo para um RA que já existe no banco → zero duplicados por RA.
      const ativosRAsNoImport = new Set<string>(
        alunos.filter(a => a.ra && a.situacao !== 'REMA').map(a => String(a.ra))
      );

      const alunosParaUpsert = alunos.map(a => {
        const isRema = a.situacao === 'REMA';
        const raKey = String(a.ra ?? '');
        const targetTurmaId = resolveIdAtualizado(a.serie, a.professora);
        const isAEE = targetTurmaId ? aeeturmaIds.has(targetTurmaId) : false;

        // Lookup directo no mapa fresco
        let existente: any = null;
        if (a.ra) {
          if (isRema) {
            existente = freshRema.get(`${raKey}|${normalizeStr(a.serie)}`)
              ?? (targetTurmaId ? freshRema.get(`${raKey}|TID:${targetTurmaId}`) : null)
              ?? (!ativosRAsNoImport.has(raKey) ? freshRegular.get(raKey) : null);
          } else if (isAEE) {
            existente = freshAEE.get(raKey);
          } else {
            existente = freshRegular.get(raKey);
          }
        }

        // Fallback nome+nascimento: só para não-REMA e se candidato único (evita gêmeos)
        if (!existente && !isRema) {
          const nomeKey = `${a.nomeNorm}|${normalizarData(a.nascimento || '')}`;
          const candidatos = (freshByName.get(nomeKey) ?? []).filter(c => {
            if (c.situacao === 'REMA') return false;
            const cIsAEE = c.aee === true || (c.turmaId && aeeturmaIds.has(c.turmaId));
            return isAEE === cIsAEE;
          });
          if (candidatos.length === 1) existente = candidatos[0];
        }

        const alunoId = existente?.id ?? crypto.randomUUID();
        return {
          id: alunoId,
          nome: a.nome,
          turmaId: targetTurmaId,
          ra: a.ra,
          numero: a.numero || existente?.numero || 0,
          data_nascimento: a.nascimento,
          data_inicio_matricula: a.dataInicioMatricula || existente?.data_inicio_matricula || null,
          data_fim_matricula: a.dataFimMatricula || existente?.data_fim_matricula || null,
          data_movimentacao: a.dataMovimentacao || existente?.data_movimentacao || null,
          deficiencia: a.deficiencia || '',
          situacao: a.situacao,
          bolsa_familia: a.bolsaFamilia || existente?.bolsa_familia || false,
          professora: a.professora,
          nis: a.nis || existente?.nis || null,
          responsavel: a.responsavel || existente?.responsavel || null,
          cpf: a.cpf || existente?.cpf || null,
          cor_raca: a.corRaca || existente?.cor_raca || '',
          turma_origem: a.turmaOrigem || '',
          professora_origem: a.professoraOrigem || '',
          turma_destino: a.turmaDestino || '',
          professora_destino: a.professoraDestino || '',
          aee: isAEE,
        };
      });

      // Garante IDs únicos no batch (REMA+ATIVO do mesmo RA → segundo ganha UUID novo)
      const idSet = new Set<string>();
      for (const a of alunosParaUpsert) {
        if (idSet.has(a.id)) a.id = crypto.randomUUID();
        idSet.add(a.id);
      }
      // Dedup por ID (último ganha)
      const upsertDedup = Array.from(
        alunosParaUpsert.reduce((m, a) => { m.set(a.id, a); return m; }, new Map<string, typeof alunosParaUpsert[0]>()).values()
      );
      // Dedup por RA no batch: evita que ficheiros com RA repetido violem aluno_ra_uniq
      {
        const rasBatch = new Set<string>();
        const limpo = upsertDedup.filter(a => {
          if (!a.ra || a.situacao === 'REMA' || a.aee) return true;
          const k = String(a.ra);
          if (rasBatch.has(k)) return false;
          rasBatch.add(k);
          return true;
        });
        upsertDedup.splice(0, upsertDedup.length, ...limpo);
      }

      for (let i = 0; i < upsertDedup.length; i += 80) {
        const chunk = upsertDedup.slice(i, i + 80);
        const { error } = await supabase.from('Aluno').upsert(chunk, { onConflict: 'id' });
        if (error) {
          if (!error.message.includes('aluno_ra_uniq')) {
            throw new Error(`${error.message} | chunk ${i}`);
          }
          // Fallback individual: identifica e corrige o conflito restante no chunk
          for (const record of chunk) {
            const { error: e2 } = await supabase.from('Aluno').upsert([record], { onConflict: 'id' });
            if (e2 && e2.message.includes('aluno_ra_uniq')) {
              // Busca o verdadeiro dono deste RA no banco e actualiza-o directamente
              const { data: owner } = await supabase.from('Aluno')
                .select('id').eq('ra', record.ra).neq('aee', true).limit(1).maybeSingle();
              if (owner) {
                const { id: _id, ...rest } = record as any;
                await supabase.from('Aluno').update(rest).eq('id', owner.id);
              }
            } else if (e2) {
              throw new Error(`Upsert individual: ${e2.message} RA=${record.ra}`);
            }
          }
        }
        setProgresso(Math.min(i + 80, upsertDedup.length));
        setStatus(`Atualizando alunos... ${Math.min(i + 80, upsertDedup.length)}/${upsertDedup.length}`);
      }

      snapAlunosDeletados.push(...snapFantasmas);

      // ─── BF extra: marca bolsa_família em alunos que estão no banco mas não vieram nos arquivos ───
      // Caso típico: alunos atípicos (AEE) ou turmas não enviadas nesta importação
      {
        const bfPendentes = dadosRef.current?.bfNaoEncontrados ?? [];
        if (bfPendentes.length > 0) {
          // Índices para match rápido contra existentes (já têm data_nascimento agora)
          const existentesPorNis = new Map<string, string>(); // nis → id
          const existentesPorChave = new Map<string, string>(); // nome|data → id
          const existentesPorFuzzy = new Map<string, string>(); // ~nomeSimp|data → id
          for (const e of (existentes ?? [])) {
            if (e.nis) existentesPorNis.set(e.nis.replace(/\D/g, ''), e.id);
            if (e.nome) {
              const enome = normalizeNome(e.nome);
              // data_nascimento pode vir como YYYY-MM-DD (Supabase date) ou DD/MM/YYYY (texto legado)
              const raw = (e.data_nascimento as string) || '';
              const eNasc = raw.includes('-') ? raw.split('-').reverse().join('/') : raw;
              if (eNasc) {
                existentesPorChave.set(`${enome}|${eNasc}`, e.id);
                const simp = nomeSignificativo(enome);
                if (simp.length >= 6) existentesPorFuzzy.set(`~${simp}|${eNasc}`, e.id);
              }
            }
          }

          const bfIdsParaAtualizar: string[] = [];
          const bfNisEncontrados = new Set<string>();

          for (const bf of bfPendentes) {
            // 1º: NIS direto
            let matchId = bf.nis ? existentesPorNis.get(bf.nis) : undefined;
            // 2º: nome+data exato
            if (!matchId) matchId = existentesPorChave.get(`${bf.nome}|${bf.nasc}`);
            // 3º: fuzzy (sem artigos) + data
            if (!matchId) {
              const bfSimp = nomeSignificativo(bf.nome);
              if (bfSimp.length >= 6) matchId = existentesPorFuzzy.get(`~${bfSimp}|${bf.nasc}`);
            }

            if (matchId) {
              const existente = (existentes ?? []).find(e => e.id === matchId);
              if (!existente?.bolsa_familia) bfIdsParaAtualizar.push(matchId);
              bfNisEncontrados.add(bf.nis);
            }
          }

          if (bfIdsParaAtualizar.length > 0) {
            setStatus(`Marcando ${bfIdsParaAtualizar.length} alunos adicionais como Bolsa Família...`);
            for (let i = 0; i < bfIdsParaAtualizar.length; i += 50) {
              await supabase.from('Aluno').update({ bolsa_familia: true })
                .in('id', bfIdsParaAtualizar.slice(i, i + 50));
            }
          }

          // Atualiza o relatório removendo os que foram encontrados no banco
          if (bfNisEncontrados.size > 0) {
            dadosRef.current!.bfNaoEncontrados = bfPendentes.filter(b => !bfNisEncontrados.has(b.nis));
          }
        }
      }

      // ─── PASSO 3: Re-ler IDs dos alunos ───
      const { data: alunosDb } = await supabase.from('Aluno').select('id, ra, nome');
      const raToId = new Map<string, string>();
      const nomeToId = new Map<string, string>();
      for (const a of (alunosDb ?? [])) {
        if (a.ra) raToId.set(String(a.ra), a.id);
        nomeToId.set(normalizeNome(a.nome), a.id);
      }

      // ─── PASSO 4: EDUCACENSO — salva na tabela independente ───
      // (dados primários já estão no Aluno — esta é uma cache auxiliar)
      const { educacenso } = dadosRef.current;
      if (educacenso && educacenso.length > 0) {
        const records = educacenso
          .filter((e: any) => e.cpf && e.cpf.length === 11 && !e.chave.startsWith('CPF:') && !e.chave.startsWith('~'));
        if (records.length > 0) {
          setStatus(`Salvando ${records.length} registros do EDUCACENSO...`);
          // Remove registros antigos com esses CPFs, depois insere novos
          const cpfs = [...new Set(records.map((e: any) => e.cpf))];
          await supabase.from('Educacenso').delete().in('cpf', cpfs).then(() => {}, () => {});
          for (let i = 0; i < records.length; i += 80) {
            const { error } = await supabase
              .from('Educacenso')
              .insert(records.slice(i, i + 80).map((e: any) => ({
                nome: e.chave.split('|')[0] || '',
                data_nascimento: e.chave.split('|')[1] || '',
                cpf: e.cpf || '',
                deficiencia: e.deficiencia || '',
                cor_raca: e.corRaca || '',
              })));
            if (error) console.error('Erro ao salvar Educacenso:', error);
          }
        }
      }

      // ─── PASSO 5: Faltas — upsert por (alunoId, mes, ano) ───
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

      setStatus('');
      setSucesso(true);
    } catch (ex: any) {
      const msg = ex.message ?? String(ex);
      setErro(msg);
      setStatus('⏻ Importação falhou — tentando reverter alterações...');
      // Rollback: restaura registros que foram deletados antes do crash
      if (snapAlunosDeletados.length > 0) {
        try {
          const lote = snapAlunosDeletados.map(a => ({
            id: a.id, nome: a.nome || 'Desconhecido', turmaId: a.turmaId || null,
            ra: a.ra || null, numero: a.numero || 0, situacao: a.situacao || 'ATIVO',
            data_nascimento: a.data_nascimento || '', deficiencia: a.deficiencia || '',
            bolsa_familia: a.bolsa_familia || false, professora: a.professora || '',
            nis: a.nis || null, responsavel: a.responsavel || null,
            cpf: a.cpf || null, cor_raca: a.cor_raca || '',
            turma_origem: a.turma_origem || '', professora_origem: a.professora_origem || '',
            turma_destino: a.turma_destino || '', professora_destino: a.professora_destino || '',
          }));
          for (let i = 0; i < lote.length; i += 80) {
            await supabase.from('Aluno').upsert(lote.slice(i, i + 80), { onConflict: 'id' }).then(() => {}, () => {});
          }
          setStatus(`⏻ ${lote.length} registro(s) restaurado(s).`);
        } catch {
          setStatus('⚠️ Falha ao reverter — verifique o banco manualmente.');
        }
      } else {
        setStatus('');
      }
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
            {([
              ['🏫 Turmas no arquivo',   preview.turmas,             '#3b82f6'],
              ['✅ Turmas reconhecidas', preview.turmasReconhecidas, '#10b981'],
              ['👥 Alunos',              preview.alunos,             '#8b5cf6'],
              ['🟢 Bolsa Família',       preview.bolsaFamilia,       '#f59e0b', preview.bolsaFamiliaTotal ? `${preview.bolsaFamiliaTotal} no PDF` : undefined],
              ['📄 Registros Faltas',    preview.faltas,             '#6b7280'],
              ['📂 Arquivos',            preview.arquivos,           '#0ea5e9'],
            ] as [string, number, string, string?][]).map(([label, val, color, sub]) => (
              <div key={label} style={{ textAlign: 'center', padding: 16, background: color + '18', borderRadius: theme.radius, border: `1.5px solid ${color}44` }}>
                <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{val}</div>
                {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
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

          {/* ─── Relatório de conciliação Bolsa Família ─────────────── */}
          {dadosRef.current?.bfNaoEncontrados?.length > 0 && (
            <BFConciliacaoPanel naoEncontrados={dadosRef.current.bfNaoEncontrados} />
          )}

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
