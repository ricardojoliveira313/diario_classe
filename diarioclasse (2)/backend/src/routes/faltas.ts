import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function faltasRoutes(app: FastifyInstance) {
  // Busca faltas de uma turma num mês
  app.get('/', async (req) => {
    const { turmaId, mes, ano } = req.query as { turmaId: string; mes: string; ano?: string };
    return prisma.falta.findMany({
      where: { turmaId, mes: Number(mes), ano: Number(ano || 2026) },
      include: { aluno: { select: { id: true, nome: true, ra: true, situacao: true, bolsaFamilia: true } } },
    });
  });

  // Salva lote de faltas de uma turma/mês
  app.post('/batch', async (req, reply) => {
    const body = req.body as { turmaId: string; mes: number; ano: number; faltas: Array<{ alunoId: string; faltas: number }> };
    const result = await prisma.$transaction(
      body.faltas.map((f) =>
        prisma.falta.upsert({
          where: { alunoId_mes_ano: { alunoId: f.alunoId, mes: body.mes, ano: body.ano } },
          create: { alunoId: f.alunoId, turmaId: body.turmaId, mes: body.mes, ano: body.ano, faltas: f.faltas },
          update: { faltas: f.faltas },
        })
      )
    );
    return reply.status(200).send({ count: result.length });
  });

  // Resumo por turma (total de faltas no ano)
  app.get('/resumo/:turmaId', async (req) => {
    const { turmaId } = req.params as { turmaId: string };
    const alunos = await prisma.aluno.findMany({
      where: { turmaId },
      include: { faltas: { where: { ano: 2026 } } },
      orderBy: { nome: 'asc' },
    });
    return alunos.map((a) => ({
      id: a.id,
      nome: a.nome,
      ra: a.ra,
      situacao: a.situacao,
      bolsaFamilia: a.bolsaFamilia,
      totalFaltas: a.faltas.reduce((s, f) => s + f.faltas, 0),
      faltasPorMes: Object.fromEntries(a.faltas.map((f) => [f.mes, f.faltas])),
    }));
  });
}
