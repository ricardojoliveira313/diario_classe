import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';

const prisma = new PrismaClient();
const uploadsDir = path.join(__dirname, '../../../uploads');

export async function uploadsRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

    const tipo = (req.query as any).tipo || 'outros';
    const filename = `${Date.now()}_${data.filename}`;
    const filePath = path.join(uploadsDir, filename);

    await pipeline(data.file, fs.createWriteStream(filePath));

    const upload = await prisma.upload.create({
      data: { tipo, filename: data.filename, path: filePath },
    });

    return reply.status(201).send(upload);
  });

  app.get('/', async () => {
    return prisma.upload.findMany({ orderBy: { createdAt: 'desc' } });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const upload = await prisma.upload.findUnique({ where: { id } });
    if (upload && fs.existsSync(upload.path)) fs.unlinkSync(upload.path);
    await prisma.upload.delete({ where: { id } });
    return reply.status(204).send();
  });
}
