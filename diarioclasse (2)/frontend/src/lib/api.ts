const BASE = 'http://localhost:3001/api';

async function req(url: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...((opts?.body instanceof FormData) ? {} : {}) },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  if (r.status === 204) return null;
  return r.json();
}

export const api = {
  // Turmas
  listTurmas: () => req('/turmas'),
  getTurma: (id: string) => req(`/turmas/${id}`),
  createTurma: (data: any) => req('/turmas', { method: 'POST', body: JSON.stringify(data) }),
  updateTurma: (id: string, data: any) => req(`/turmas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTurma: (id: string) => req(`/turmas/${id}`, { method: 'DELETE' }),

  // Alunos
  listAlunos: (turmaId?: string) => req(`/alunos${turmaId ? `?turmaId=${turmaId}` : ''}`),
  createAluno: (data: any) => req('/alunos', { method: 'POST', body: JSON.stringify(data) }),
  updateAluno: (id: string, data: any) => req(`/alunos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAluno: (id: string) => req(`/alunos/${id}`, { method: 'DELETE' }),
  importAlunos: (alunos: any[]) => req('/alunos/import', { method: 'POST', body: JSON.stringify({ alunos }) }),

  // Faltas
  getFaltas: (turmaId: string, mes: number, ano = 2026) => req(`/faltas?turmaId=${turmaId}&mes=${mes}&ano=${ano}`),
  saveFaltas: (data: { turmaId: string; mes: number; ano: number; faltas: Array<{ alunoId: string; faltas: number }> }) =>
    req('/faltas/batch', { method: 'POST', body: JSON.stringify(data) }),
  getResumo: (turmaId: string) => req(`/faltas/resumo/${turmaId}`),

  // Dashboard
  dashboardStats: () => req('/dashboard/stats'),

  // Uploads
  listUploads: () => req('/uploads'),
  deleteUpload: (id: string) => req(`/uploads/${id}`, { method: 'DELETE' }),
  uploadFile: async (file: File, tipo: string) => {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch(`${BASE}/uploads?tipo=${tipo}`, { method: 'POST', body: form });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};
