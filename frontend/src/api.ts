import { createClient } from '@supabase/supabase-js';

// Credenciais via variáveis de ambiente (configure no painel do Render)
// Fallback para desenvolvimento local
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  || 'https://hxmwpleyhagwcukuhzxg.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CHUNK = 80;

export const api = {
  getTurmas: async () => {
    const { data, error } = await supabase.from('Turma').select('*').order('nome');
    if (error) throw error;
    return data ?? [];
  },
  createTurma: async (data: any) => {
    const { data: result, error } = await supabase.from('Turma').insert(data).select().single();
    if (error) throw error;
    return result;
  },
  deleteTurma: async (id: string) => {
    const { error } = await supabase.from('Turma').delete().eq('id', id);
    if (error) throw error;
  },

  getAlunos: async (turmaId?: string) => {
    let query = supabase.from('Aluno').select('*').order('numero').order('nome');
    if (turmaId) query = query.eq('turmaId', turmaId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
  getAllAlunos: async () => {
    const { data, error } = await supabase.from('Aluno').select('*').order('nome');
    if (error) throw error;
    return data ?? [];
  },
  updateAluno: async (id: string, updates: any) => {
    const { error } = await supabase.from('Aluno').update(updates).eq('id', id);
    if (error) throw error;
  },
  createAluno: async (data: any) => {
    const { data: result, error } = await supabase.from('Aluno').insert(data).select().single();
    if (error) throw error;
    return result;
  },
  deleteAluno: async (id: string) => {
    const { error } = await supabase.from('Aluno').delete().eq('id', id);
    if (error) throw error;
  },

  getFaltas: async (turmaId: string, mes: number, ano: number) => {
    const { data, error } = await supabase
      .from('Falta').select('*').eq('turmaId', turmaId).eq('mes', mes).eq('ano', ano);
    if (error) throw error;
    return data ?? [];
  },
  getFaltasMes: async (mes: number, ano: number) => {
    const { data, error } = await supabase
      .from('Falta').select('*').eq('mes', mes).eq('ano', ano);
    if (error) throw error;
    return data ?? [];
  },
  getFaltasAluno: async (alunoId: string, ano: number) => {
    const { data, error } = await supabase
      .from('Falta').select('*').eq('alunoId', alunoId).eq('ano', ano).order('mes');
    if (error) throw error;
    return data ?? [];
  },

  upsertFaltasBatch: async (registros: any[]) => {
    for (let i = 0; i < registros.length; i += CHUNK) {
      const { error } = await supabase
        .from('Falta')
        .upsert(registros.slice(i, i + CHUNK), { onConflict: 'alunoId,mes,ano' });
      if (error) throw error;
    }
  },

  // --- PENDENTES ---
  getPendentes: async (status?: string) => {
    let q = supabase.from('Pendente').select('*, Turma(nome, professora)').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  criarPendente: async (p: { turmaId: string; mes: number; ano: number; dados: any[]; total_entradas: number; total_problemas: number }) => {
    const { data, error } = await supabase.from('Pendente').insert(p).select().single();
    if (error) throw error;
    return data;
  },
  atualizarPendente: async (id: string, updates: any) => {
    const { error } = await supabase.from('Pendente').update(updates).eq('id', id);
    if (error) throw error;
  },
  deletePendente: async (id: string) => {
    const { error } = await supabase.from('Pendente').delete().eq('id', id);
    if (error) throw error;
  },
  contarPendentes: async () => {
    const { count } = await supabase.from('Pendente').select('*', { count: 'exact', head: true }).eq('status', 'pendente');
    return count ?? 0;
  },

  reloadSchema: async () => {
    const { error } = await supabase.rpc('pgrst_reload_schema' as any);
    if (error) {
      // fallback: exec_sql se tiver sido criada
      const { error: e2 } = await supabase.rpc('exec_sql' as any, { sql: "NOTIFY pgrst, 'reload schema';" }).single();
      if (e2) throw new Error(`Cache do Supabase desatualizado. Vá no SQL Editor do Supabase e execute: NOTIFY pgrst, 'reload schema';`);
    }
  },
  checkSchema: async () => {
    const { error } = await supabase.from('Turma').select('id').limit(1);
    if (error && error.message?.includes('schema cache')) {
      await api.reloadSchema();
      // tenta de novo
      const { error: e2 } = await supabase.from('Turma').select('id').limit(1);
      if (e2 && e2.message?.includes('schema cache')) {
        throw new Error('Execute no SQL Editor do Supabase: NOTIFY pgrst, \'reload schema\';');
      }
    }
    return true;
  },
  clearAll: async () => {
    await api.checkSchema();
    await supabase.from('Falta').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('Aluno').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('Turma').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  },
  bulkInsertTurmas: async (turmas: { nome: string; professora: string }[]) => {
    const { data, error } = await supabase.from('Turma').insert(turmas).select();
    if (error) throw error;
    return data ?? [];
  },
  bulkInsertAlunos: async (alunos: any[], onProgress: (n: number) => void) => {
    for (let i = 0; i < alunos.length; i += CHUNK) {
      const { error } = await supabase.from('Aluno').insert(alunos.slice(i, i + CHUNK));
      if (error) throw error;
      onProgress(Math.min(i + CHUNK, alunos.length));
    }
  },
  bulkInsertFaltas: async (faltas: any[]) => {
    for (let i = 0; i < faltas.length; i += CHUNK) {
      const { error } = await supabase.from('Falta').insert(faltas.slice(i, i + CHUNK));
      if (error) throw error;
    }
  },
};
