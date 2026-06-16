import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/stats', async () => {
    const alunos = await prisma.aluno.findMany({ select: { ra: true, deficiencia: true, turmaId: true } });
    const turmas = await prisma.turma.findMany({ select: { id: true, nome: true } });

    const turmaMap = new Map(turmas.map(t => [t.id, t.nome]));

    const rasAEE = new Set<string>();
    const rasRegular = new Set<string>();
    const rasDefRegular = new Set<string>();
    const rasDefAEE = new Set<string>();

    for (const a of alunos) {
      const tNome = turmaMap.get(a.turmaId) || '';
      const isAEE = tNome.includes('AEE');

      if (isAEE) {
        rasAEE.add(a.ra);
        if (a.deficiencia) rasDefAEE.add(a.ra);
      } else {
        rasRegular.add(a.ra);
        if (a.deficiencia) rasDefRegular.add(a.ra);
      }
    }

    const ambas = new Set([...rasAEE].filter(r => rasRegular.has(r)));
    const soRegular = new Set([...rasRegular].filter(r => !rasAEE.has(r)));
    const soAEE = new Set([...rasAEE].filter(r => !rasRegular.has(r)));

    return {
      totalRegistros: alunos.length,
      alunosUnicos: new Set(alunos.map(a => a.ra)).size,
      modalidades: {
        soRegular: soRegular.size,
        soAEE: soAEE.size,
        ambas: ambas.size,
      },
      deficiencia: {
        regular: rasDefRegular.size,
        aee: rasDefAEE.size,
      },
    };
  });
}
