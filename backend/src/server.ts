import express from 'express';
import cors from 'cors';
import turmasRouter from './routes/turmas';
import alunosRouter from './routes/alunos';
import faltasRouter from './routes/faltas';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173'] }));
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api/turmas', turmasRouter);
app.use('/api/alunos', alunosRouter);
app.use('/api/faltas', faltasRouter);

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
