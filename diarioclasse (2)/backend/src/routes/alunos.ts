import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function alunosRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    const { turmaId } = req.query as { turmaId?: string };
    
    if (turmaId) {
      return prisma.aluno.findMany({
        where: { turmaId },
        orderBy: { numeroAluno: 'asc' },
        include: { turma: { select: { nome: true } } },
      });
    }

    // Sem filtro: retorna alunos unicos (sem duplicar quem esta em regular + AEE)
    const todos = await prisma.aluno.findMany({
      orderBy: { numeroAluno: 'asc' },
      include: { turma: { select: { nome: true } } },
    });
    const vistos = new Set<string>();
    return todos.filter(a => {
      if (vistos.has(a.ra)) return false;
      vistos.add(a.ra);
      return true;
    });
  });

  app.post('/', async (req, reply) => {
    const body = req.body as any;
    const aluno = await prisma.aluno.create({
      data: {
        ra: String(body.ra || ''),
        digito: String(body.digito || ''),
        nome: body.nome,
        nascimento: body.nascimento || '',
        situacao: body.situacao || 'ATIVO',
        bolsaFamilia: Boolean(body.bolsaFamilia),
        deficiencia: body.deficiencia || '',
        dataInicioMatric: body.dataInicioMatric || '',
        dataFimMatric: body.dataFimMatric || '',
        numeroAluno: parseInt(body.numeroAluno) || 0,
        turmaId: body.turmaId,
      },
    });
    return reply.status(201).send(aluno);
  });

  app.put('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    return prisma.aluno.update({
      where: { id },
      data: {
        ra: String(body.ra || ''),
        digito: String(body.digito || ''),
        nome: body.nome,
        nascimento: body.nascimento || '',
        situacao: body.situacao || 'ATIVO',
        bolsaFamilia: Boolean(body.bolsaFamilia),
        deficiencia: body.deficiencia || '',
        dataInicioMatric: body.dataInicioMatric || '',
        dataFimMatric: body.dataFimMatric || '',
        numeroAluno: parseInt(body.numeroAluno) || 0,
        turmaId: body.turmaId,
      },
    });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.aluno.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Import em lote (CSV/JSON)
  app.post('/import', async (req, reply) => {
    const body = req.body as any;
    const alunos = body.alunos as any[];
    const result = await prisma.$transaction(
      alunos.map((a) =>
        prisma.aluno.upsert({
          where: { ra_turmaId: { ra: String(a.ra || ''), turmaId: a.turmaId } },
          create: {
            ra: String(a.ra || ''),
            digito: String(a.digito || ''),
            nome: a.nome,
            nascimento: a.nascimento || '',
            situacao: a.situacao || 'ATIVO',
            bolsaFamilia: Boolean(a.bolsaFamilia),
            deficiencia: a.deficiencia || '',
            dataInicioMatric: a.dataInicioMatric || '',
            dataFimMatric: a.dataFimMatric || '',
            numeroAluno: parseInt(a.numeroAluno) || 0,
            turmaId: a.turmaId,
          },
          update: { nome: a.nome, situacao: a.situacao || 'ATIVO', bolsaFamilia: Boolean(a.bolsaFamilia), dataInicioMatric: a.dataInicioMatric || '', dataFimMatric: a.dataFimMatric || '', numeroAluno: parseInt(a.numeroAluno) || 0 },
        })
      )
    );
    return reply.status(201).send({ count: result.length });
  });
}
