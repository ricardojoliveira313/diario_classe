import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function turmasRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return prisma.turma.findMany({
      orderBy: [{ etapa: 'asc' }, { numero: 'asc' }, { letra: 'asc' }, { periodo: 'asc' }],
      include: { _count: { select: { alunos: true } } },
    });
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    return prisma.turma.findUnique({ where: { id }, include: { alunos: { orderBy: { nome: 'asc' } } } });
  });

  app.post('/', async (req, reply) => {
    const body = req.body as any;
    const numero = Number(body.numero);
    const nome = `${numero}º ${body.etapa} ${body.letra} - ${body.periodo}`;
    const turma = await prisma.turma.create({
      data: { nome, etapa: body.etapa, numero, letra: body.letra.toUpperCase(), periodo: body.periodo, professor: body.professor || '' },
    });
    return reply.status(201).send(turma);
  });

  app.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const numero = Number(body.numero);
    const nome = `${numero}º ${body.etapa} ${body.letra} - ${body.periodo}`;
    return prisma.turma.update({
      where: { id },
      data: { nome, etapa: body.etapa, numero, letra: body.letra.toUpperCase(), periodo: body.periodo, professor: body.professor || '' },
    });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.turma.delete({ where: { id } });
    return reply.status(204).send();
  });
}
