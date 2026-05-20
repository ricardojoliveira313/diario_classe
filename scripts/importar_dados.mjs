import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const SUPABASE_URL = 'https://hxmwpleyhagwcukuhzxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CHUNK = 80;

const MES_MAP = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, MARÇO: 3, ABRIL: 4,
  MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8,
  SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

const SITUACAO_MAP = {
  ATIVO: 'ATIVO', REMA: 'REMA', REMANEJADO: 'REMA', REMANEJADA: 'REMA',
  BXTR: 'BXTR', 'BAIXA TRANSF.': 'BXTR', 'BAIXA TRANSFERENCIA': 'BXTR',
  TRAN: 'TRAN', 'TRANSF.': 'TRAN', TRANSFERIDO: 'TRAN', TRANSFERIDA: 'TRAN',
  'N COM': 'N COM', 'NAO COMPARECEU': 'N COM', 'NCOM': 'N COM',
  ABAN: 'ABAN', ABANDONO: 'ABAN',
};

function norm(s) {
  return String(s ?? '').toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseBool(v) {
  return String(v ?? '').toUpperCase().trim() === 'SIM';
}

function fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) {
    const d = String(v.getDate()).padStart(2, '0');
    const m = String(v.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${v.getFullYear()}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  return s;
}

function getMes(sheetName, row) {
  const aba = MES_MAP[norm(sheetName)];
  if (aba) return aba;
  const col = norm(row['MÊS'] ?? row['MES'] ?? row['Mês'] ?? row['mês'] ?? '');
  return MES_MAP[col] ?? 0;
}

function normalizeSituacao(s) {
  const k = norm(s);
  return SITUACAO_MAP[k] ?? s.trim();
}

// ─── LER TURMA-PROFESSORES ───
console.log('📖 Lendo TURMA-PROFESSORES-PERIODO.xlsx...');
const bufProf = fs.readFileSync('/home/ricojoliveira/diario-classe/diario_classe/TURMA-PROFESSORES-PERIODO.xlsx');
const wbProf = XLSX.read(bufProf);
const wsProf = wbProf.Sheets[wbProf.SheetNames[0]];
const rowsProf = XLSX.utils.sheet_to_json(wsProf, { header: 1 });

let headerRow = -1;
for (let i = 0; i < Math.min(rowsProf.length, 6); i++) {
  const joined = rowsProf[i].map(h => norm(String(h ?? ''))).join('|');
  if (joined.includes('TURMA') || joined.includes('PROFESSOR')) { headerRow = i; break; }
}
const profMap = new Map();
for (let i = headerRow + 1; i < rowsProf.length; i++) {
  const r = rowsProf[i];
  if (!r || !r[1]) continue;
  const turma = String(r[1]).trim();
  const prof = String(r[2] ?? '').trim();
  const periodo = String(r[3] ?? '').trim();
  if (turma && prof) profMap.set(norm(turma), { professor: prof, periodo });
}
console.log(`   → ${profMap.size} turmas com professor`);

// ─── LER DIARIO_CLASSE_2026 ───
console.log('📖 Lendo DIARIO_CLASSE_2026.xlsx...');
const bufDC = fs.readFileSync('/home/ricojoliveira/diario-classe/diario_classe/DIARIO_CLASSE_2026.xlsx');
const wbDC = XLSX.read(bufDC, { cellDates: true });

let totalLinhas = 0;
const turmasSet = new Map(); // norm -> { nome, professora }
const alunosMap = new Map(); // key -> aluno
const alunosDetalhe = [];

for (const sheetName of wbDC.SheetNames) {
  const ws = wbDC.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'dd/mm/yyyy' });
  
  for (const row of rows) {
    const nr = {};
    for (const [k, v] of Object.entries(row)) nr[norm(String(k).trim())] = v;

    const nome = String(nr['NOME DO ALUNO'] ?? nr['NOME'] ?? '').trim();
    const serie = String(nr['SERIE'] ?? nr['TURMA'] ?? '').trim();
    if (!nome || !serie) continue;

    const ra = parseInt(String(nr['RA'] ?? '')) || null;
    const nasc = fmtDate(nr['DATA DE NASCIMENTO'] ?? nr['DATA NASCIMENTO']);
    const key = `${norm(nome)}|${ra}|${nasc}`;
    if (alunosMap.has(key)) continue;
    alunosMap.set(key, true);

    const mes = getMes(sheetName, nr);
    let faltasQtd = 0;
    let freqTexto = '';
    if ('FREQUENCIA DOS ALUNOS(A)' in nr) {
      const freqRaw = String(nr['FREQUENCIA DOS ALUNOS(A)'] ?? '').trim().replace(/^["']|["']$/g, '');
      const freqNum = freqRaw.match(/^(\d{1,2})/);
      faltasQtd = freqNum ? Math.min(parseInt(freqNum[1]), 22) : 0;
      const fn = norm(freqRaw);
      freqTexto = !freqNum && freqRaw && !fn.startsWith('NAO HA FALTAS') ? freqRaw : '';
    }

    const situacao = normalizeSituacao(String(nr['SITUACAO'] ?? 'ATIVO'));
    const deficiencia = String(nr['DEFICIENCIA'] ?? '').trim();
    const professora = String(nr['PROFESSORA'] ?? '').trim();
    const bolsa = parseBool(nr['BOLSA FAMILIA'] ?? nr['BOLSA FAMLIA']);

    // Turma
    const serieNorm = norm(serie);
    if (!turmasSet.has(serieNorm)) {
      let prof = professora;
      // Tenta cruzar com TURMA-PROFESSORES
      const tp = profMap.get(serieNorm);
      if (tp && !prof) prof = tp.professor;
      // Fallback: busca parcial
      if (!prof) {
        for (const [k, v] of profMap.entries()) {
          if (serieNorm.includes(k) || k.includes(serieNorm)) { prof = v.professor; break; }
        }
      }
      turmasSet.set(serieNorm, { nome: serie, professora: prof });
    }

    alunosDetalhe.push({
      nome, ra, nascimento: nasc,
      serie, serieNorm, situacao, deficiencia,
      bolsa_familia: bolsa, professora,
      data_inicio_matricula: fmtDate(nr['DATA INICIO MATRICULA']),
      data_fim_matricula: fmtDate(nr['DATA FIM MATRICULA']),
      data_movimentacao: fmtDate(nr['DATA MOVIMENTACAO']),
      mes: mes > 0 ? mes : null,
      faltas: faltasQtd,
      frequencia: freqTexto,
    });
    totalLinhas++;
  }
}

console.log(`   → ${turmasSet.size} turmas encontradas`);
console.log(`   → ${alunosDetalhe.length} alunos encontrados`);

// ─── LIMPAR DADOS ANTIGOS ───
console.log('\n🗑️  Limpando dados antigos...');
const { error: e1 } = await supabase.from('Falta').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (e1) console.error('   Erro Falta:', e1.message);
const { error: e2 } = await supabase.from('Aluno').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (e2) console.error('   Erro Aluno:', e2.message);
const { error: e3 } = await supabase.from('Turma').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (e3) console.error('   Erro Turma:', e3.message);
console.log('   → OK');

// ─── INSERIR TURMAS ───
console.log('\n🏫 Inserindo turmas...');
const turmasArr = Array.from(turmasSet.values());
const { data: turmasDb, error: errTurmas } = await supabase.from('Turma').insert(turmasArr.map(t => ({
  nome: t.nome,
  professora: t.professora || null,
}))).select();
if (errTurmas) { console.error('   Erro:', errTurmas.message); process.exit(1); }
console.log(`   → ${turmasDb.length} turmas inseridas`);

const serieToId = new Map();
for (const t of turmasDb) serieToId.set(norm(t.nome), t.id);

// ─── INSERIR ALUNOS ───
console.log('\n👥 Inserindo alunos...');
const alunosUnicos = [];
const seen = new Set();
for (const a of alunosDetalhe) {
  const k = `${norm(a.nome)}|${a.ra}|${a.nascimento}`;
  if (seen.has(k)) continue;
  seen.add(k);
  
  let prof = a.professora;
  if (!prof) {
    const tp = profMap.get(a.serieNorm);
    if (tp) prof = tp.professor;
  }
  if (!prof) {
    for (const [k, v] of profMap.entries()) {
      if (a.serieNorm.includes(k) || k.includes(a.serieNorm)) { prof = v.professor; break; }
    }
  }

  alunosUnicos.push({
    nome: a.nome,
    turmaId: serieToId.get(a.serieNorm) ?? null,
    ra: a.ra,
    numero: 0,
    data_nascimento: a.nascimento,
    data_inicio_matricula: a.data_inicio_matricula,
    data_fim_matricula: a.data_fim_matricula,
    data_movimentacao: a.data_movimentacao,
    deficiencia: a.deficiencia,
    situacao: a.situacao,
    bolsa_familia: a.bolsa_familia,
    professora: prof || null,
    nis: null,
    responsavel: null,
  });
}

for (let i = 0; i < alunosUnicos.length; i += CHUNK) {
  const { error } = await supabase.from('Aluno').insert(alunosUnicos.slice(i, i + CHUNK));
  if (error) { console.error(`   Erro chunk ${i}:`, error.message); process.exit(1); }
  process.stdout.write(`\r   → ${Math.min(i + CHUNK, alunosUnicos.length)}/${alunosUnicos.length}`);
}
console.log('');

// Buscar IDs dos alunos inseridos
const { data: alunosDb } = await supabase.from('Aluno').select('id, ra, nome');
const raToId = new Map();
const nomeToId = new Map();
for (const a of alunosDb ?? []) {
  if (a.ra) raToId.set(String(a.ra), a.id);
  nomeToId.set(norm(a.nome), a.id);
}

// ─── INSERIR FALTAS ───
console.log('\n📋 Inserindo faltas...');
const faltasArr = [];
for (const a of alunosDetalhe) {
  if (!a.mes) continue;
  const alunoId = raToId.get(String(a.ra ?? '')) ?? nomeToId.get(norm(a.nome));
  const turmaId = serieToId.get(a.serieNorm);
  if (!alunoId || !turmaId) continue;
  faltasArr.push({
    alunoId, turmaId,
    mes: a.mes, ano: 2026,
    faltas: a.faltas,
    frequencia: a.frequencia || '',
  });
}

for (let i = 0; i < faltasArr.length; i += CHUNK) {
  const { error } = await supabase.from('Falta').insert(faltasArr.slice(i, i + CHUNK));
  if (error) { console.error(`   Erro chunk ${i}:`, error.message); }
  process.stdout.write(`\r   → ${Math.min(i + CHUNK, faltasArr.length)}/${faltasArr.length}`);
}
console.log('');

// ─── RESUMO ───
console.log('\n========================================');
console.log('  ✅ IMPORTACAO CONCLUIDA!');
console.log('========================================');
console.log(`  Turmas: ${turmasDb.length}`);
console.log(`  Alunos: ${alunosUnicos.length}`);
console.log(`  Faltas: ${faltasArr.length}`);
console.log('========================================\n');

// Verifica se os nomes estão corretos
console.log('📊 Turmas inseridas:');
for (const t of turmasDb) {
  console.log(`   ${t.nome} — Prof: ${t.professora || '(sem professor)'}`);
}
