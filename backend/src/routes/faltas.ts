import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const { turmaId, mes, ano } = req.query;
    const faltas = await prisma.falta.findMany({
      where: {
        ...(turmaId ? { turmaId: String(turmaId) } : {}),
        ...(mes ? { mes: Number(mes) } : {}),
        ...(ano ? { ano: Number(ano) } : {}),
      },
      include: { aluno: true },
    });
    res.json(faltas);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/upsert', async (req, res) => {
  try {
    const { alunoId, turmaId, mes, ano, faltas, frequencia } = req.body;
    const falta = await prisma.falta.upsert({
      where: { alunoId_mes_ano: { alunoId, mes, ano } },
      update: { faltas, frequencia },
      create: { alunoId, turmaId, mes, ano, faltas, frequencia },
    });
    res.json(falta);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/upsert-batch', async (req, res) => {
  try {
    const { registros } = req.body as {
      registros: { alunoId: string; turmaId: string; mes: number; ano: number; faltas: number; frequencia: string }[];
    };
    const results = await Promise.all(
      registros.map((r) =>
        prisma.falta.upsert({
          where: { alunoId_mes_ano: { alunoId: r.alunoId, mes: r.mes, ano: r.ano } },
          update: { faltas: r.faltas, frequencia: r.frequencia },
          create: r,
        })
      )
    );
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
