import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

function normalizarTurma(turmaPdf: string): string {
  let t = turmaPdf.toUpperCase().trim();
  t = t.replace(/\s+ANUAL$/, '');
  t = t.replace(/^(\d+º\s+\S+\s+\S+)\s+/, '$1 - ');
  return t;
}

function parseTurma(nome: string): { etapa: string; numero: number; letra: string; periodo: string } | null {
  const m = nome.match(/^(\d+)º\s+(.+?)\s+-\s+(.+)$/);
  if (!m) return null;
  const etapaRaw = m[2].trim();
  const letraMatch = etapaRaw.match(/\w$/);
  const etapa = etapaRaw.replace(/\s+\w$/, '');
  return { etapa, numero: parseInt(m[1]), letra: letraMatch?.[0] || 'U', periodo: m[3].trim() };
}

export async function importSEDRoutes(app: FastifyInstance) {
  app.post('/sed', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      const scriptDir = path.join(__dirname, '../../scripts');
      const pdfDir = body?.pdfDir || 'C:\\diario_classe';
      const excels: string[] = body?.excels || [
        'C:\\diario_classe\\ALUNOS - ATIPICOS\\alunos atipicos - SED.xlsx',
        'C:\\diario_classe\\ALUNOS - ATIPICOS\\INFANTIL - ATIPICOS.xlsx',
      ];

      const excelsArgs = excels.map(e => `--excel "${e}"`).join(' ');
      const pythonCmd = `python "${path.join(scriptDir, 'import_sed.py')}" --pdf-dir "${pdfDir}" ${excelsArgs}`;

      const stdout = execSync(pythonCmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });

      const linhas = stdout.trim().split('\n').filter(l => l.startsWith('{'));
      if (!linhas.length) {
        return reply.status(500).send({ success: false, error: 'Nenhum JSON encontrado na saída do script' });
      }

      const resultado = JSON.parse(linhas[linhas.length - 1]);
      const alunos: any[] = resultado.alunos || [];

      const turmasExistentes = await prisma.turma.findMany();
      const turmaIndex: Record<string, string> = {};
      for (const t of turmasExistentes) {
        turmaIndex[t.nome.toUpperCase()] = t.id;
      }

      let importados = 0;
      let erros = 0;

      for (const aluno of alunos) {
        const turmaNormalizada = normalizarTurma(aluno.turma || '');
        let turmaId = turmaIndex[turmaNormalizada];

        if (!turmaId) {
          const parsed = parseTurma(turmaNormalizada);
          if (parsed) {
            const nova = await prisma.turma.create({
              data: {
                nome: turmaNormalizada,
                etapa: parsed.etapa,
                numero: parsed.numero,
                letra: parsed.letra,
                periodo: parsed.periodo,
              },
            });
            turmaId = nova.id;
            turmaIndex[turmaNormalizada] = turmaId;
          }
        }

        if (!turmaId) { erros++; continue; }

        try {
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
              turmaId,
            },
            update: {
              nome: aluno.nome,
              situacao: aluno.situacao || 'ATIVO',
              deficiencia: aluno.deficiencia || '',
              dataInicioMatric: aluno.dataInicioMatric || '',
              dataFimMatric: aluno.dataFimMatric || '',
            },
          });
          importados++;
        } catch { erros++; }
      }

      return reply.send({
        success: true,
        totalExtraidos: resultado.total,
        importados,
        semMatchPDF: resultado.semMatch,
        erros,
        mensagem: `${importados} alunos importados. ${resultado.semMatch} sem data de matrícula (não localizados no Excel).`,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        stderr: err.stderr?.toString(),
      });
    }
  });

  app.get('/sed/pdfs', async () => {
    const pdfDir = 'C:\\diario_classe';
    const excelsDir = 'C:\\diario_classe\\ALUNOS - ATIPICOS';
    const pdfs = fs.existsSync(pdfDir) ? fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf') && f.toLowerCase() !== 'bolsa_familia.pdf') : [];
    const excels = fs.existsSync(excelsDir) ? fs.readdirSync(excelsDir).filter(f => f.endsWith('.xlsx')) : [];
    return { pdfs, excels };
  });
}
