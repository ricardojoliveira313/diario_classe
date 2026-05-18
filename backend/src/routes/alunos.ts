import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const { turmaId } = req.query;
    const alunos = await prisma.aluno.findMany({
      where: turmaId ? { turmaId: String(turmaId) } : undefined,
      orderBy: { nome: 'asc' },
    });
    res.json(alunos);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req, res) => {
  try {
    const aluno = await prisma.aluno.create({ data: req.body });
    res.json(aluno);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const aluno = await prisma.aluno.update({ where: { id: req.params.id }, data: req.body });
    res.json(aluno);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.aluno.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
