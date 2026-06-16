import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs';
import { turmasRoutes } from './routes/turmas';
import { alunosRoutes } from './routes/alunos';
import { faltasRoutes } from './routes/faltas';
import { uploadsRoutes } from './routes/uploads';
import { importSEDRoutes } from './routes/import-sed';
import { dashboardRoutes } from './routes/dashboard';

const app = Fastify({ logger: false });

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function bootstrap() {
  await app.register(cors, { origin: 'http://localhost:5174' });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  app.get('/health', async () => ({ ok: true }));

  await app.register(turmasRoutes, { prefix: '/api/turmas' });
  await app.register(alunosRoutes, { prefix: '/api/alunos' });
  await app.register(faltasRoutes, { prefix: '/api/faltas' });
  await app.register(uploadsRoutes, { prefix: '/api/uploads' });
  await app.register(importSEDRoutes, { prefix: '/api/import' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });

  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('🏫 Diário de Classe API rodando em http://localhost:3001');
}

bootstrap().catch(console.error);
