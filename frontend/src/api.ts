const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function req(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getTurmas: () => req('/turmas'),
  createTurma: (data: any) => req('/turmas', { method: 'POST', body: JSON.stringify(data) }),
  deleteTurma: (id: string) => req(`/turmas/${id}`, { method: 'DELETE' }),

  getAlunos: (turmaId?: string) => req(`/alunos${turmaId ? `?turmaId=${turmaId}` : ''}`),
  createAluno: (data: any) => req('/alunos', { method: 'POST', body: JSON.stringify(data) }),
  deleteAluno: (id: string) => req(`/alunos/${id}`, { method: 'DELETE' }),

  getFaltas: (turmaId: string, mes: number, ano: number) =>
    req(`/faltas?turmaId=${turmaId}&mes=${mes}&ano=${ano}`),
  upsertFaltasBatch: (registros: any[]) =>
    req('/faltas/upsert-batch', { method: 'POST', body: JSON.stringify({ registros }) }),
};
