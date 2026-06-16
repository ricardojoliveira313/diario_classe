import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

function limparTurma(turma) {
  return turma.toUpperCase().trim().replace(/\s+ANUAL$/, '').replace(/\s+/g, ' ');
}

function extrairPartesTurma(nome) {
  const padraoNumero = /^(\d+)[ºª]\s+(.+?)\s+([A-Z])\s+-\s+(.+)$/;  // "1º ANO A - MANHA"
  const padraoAEE = /^(AEE\s+[A-Z])\s+-\s+(.+)$/;                   // "AEE A - MANHA"
  const padraoEJA = /^(SÉRIE\s+\d+\s+-\s+.+?)\s+([A-Z])\s+-\s+(.+)$/; // "SÉRIE 10 - 3° TERMO ... A - NOITE"
  const padraoMulti = /^(MULTISSERIADA\s+[A-Z])\s+-\s+(.+)$/;       // "MULTISSERIADA A - NOITE"

  let m = nome.match(padraoNumero);
  if (m) return { numero: parseInt(m[1]), etapa: m[2].trim(), letra: m[3], periodo: m[4], nome };
  
  m = nome.match(padraoAEE);
  if (m) return { numero: 0, etapa: m[1], letra: 'U', periodo: m[2], nome };

  m = nome.match(padraoEJA);
  if (m) return { numero: 0, etapa: m[1], letra: m[2], periodo: m[3], nome };

  m = nome.match(padraoMulti);
  if (m) return { numero: 0, etapa: m[1], letra: 'U', periodo: m[2], nome };

  return null;
}

async function main() {
  const jsonPath = process.argv[2] || 'C:\\diario_classe\\import_result.json';
  
  if (!fs.existsSync(jsonPath)) {
    console.error('Arquivo nao encontrado:', jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const { alunos } = JSON.parse(raw);
  console.log(`Total de alunos no JSON: ${alunos.length}\n`);

  const turmasExistentes = await prisma.turma.findMany();
  const turmaIndex = {};
  for (const t of turmasExistentes) {
    turmaIndex[t.nome.toUpperCase().replace(/\s+/g, ' ')] = t.id;
  }

  let importados = 0;
  let erros = 0;

  for (const aluno of alunos) {
    const turmaLimp = limparTurma(aluno.turma || '');
    if (!turmaLimp) { erros++; continue; }

    let turmaId = turmaIndex[turmaLimp];

    if (!turmaId) {
      const parsed = extrairPartesTurma(turmaLimp);
      if (parsed) {
        const nova = await prisma.turma.create({ data: parsed });
        turmaId = nova.id;
        turmaIndex[turmaLimp] = turmaId;
        console.log(`  + Turma: ${parsed.nome}`);
      } else {
        // fallback: criar com nome direto
        const nova = await prisma.turma.create({
          data: { nome: turmaLimp, etapa: 'OUTROS', numero: 0, letra: 'U', periodo: '' },
        });
        turmaId = nova.id;
        turmaIndex[turmaLimp] = turmaId;
        console.log(`  + Turma (fallback): ${turmaLimp}`);
      }
    }

    try {
      const num = parseInt(aluno.numeroAluno) || 0;
      await prisma.aluno.upsert({
        where: { ra_turmaId: { ra: aluno.ra, turmaId } },
        create: {
          ra: aluno.ra,
          digito: aluno.digito || '',
          nome: aluno.nome,
          nascimento: aluno.nascimento || '',
          situacao: aluno.situacao || 'ATIVO',
          bolsaFamilia: false,
          deficiencia: aluno.deficiencia || '',
          dataInicioMatric: aluno.dataInicioMatric || '',
          dataFimMatric: aluno.dataFimMatric || '',
          numeroAluno: num,
          turmaId,
        },
        update: {
          nome: aluno.nome,
          situacao: aluno.situacao || 'ATIVO',
          deficiencia: aluno.deficiencia || '',
          dataInicioMatric: aluno.dataInicioMatric || '',
          dataFimMatric: aluno.dataFimMatric || '',
          numeroAluno: num,
        },
      });
      importados++;
    } catch (e) {
      console.error(`  ERRO: ${aluno.nome}: ${e.message}`);
      erros++;
    }
  }

  const comData = alunos.filter(a => a.dataInicioMatric).length;
  const semData = alunos.filter(a => !a.dataInicioMatric).length;

  console.log(`\n=== RESULTADO FINAL ===`);
  console.log(`Total: ${alunos.length}`);
  console.log(`Importados: ${importados}`);
  console.log(`Erros: ${erros}`);
  console.log(`Com data matricula: ${comData}`);
  console.log(`Sem data matricula: ${semData}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
