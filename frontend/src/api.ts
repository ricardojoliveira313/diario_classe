import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hxmwpleyhagwcukuhzxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const api = {
  getTurmas: async () => {
    const { data, error } = await supabase.from('Turma').select('*').order('nome');
    if (error) throw error;
    return data;
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
    let query = supabase.from('Aluno').select('*').order('nome');
    if (turmaId) query = query.eq('turmaId', turmaId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
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
      .from('Falta')
      .select('*, aluno:Aluno(*)')
      .eq('turmaId', turmaId)
      .eq('mes', mes)
      .eq('ano', ano);
    if (error) throw error;
    return data;
  },

  upsertFaltasBatch: async (registros: any[]) => {
    const { data, error } = await supabase
      .from('Falta')
      .upsert(registros, { onConflict: 'alunoId,mes,ano' })
      .select();
    if (error) throw error;
    return data;
  },
};
