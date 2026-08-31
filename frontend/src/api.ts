import { createClient } from '@supabase/supabase-js';

// Credenciais via variáveis de ambiente (configure no painel do Render)
// Fallback para desenvolvimento local
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  || 'https://hxmwpleyhagwcukuhzxg.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bXdwbGV5aGFnd2N1a3VoenhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzcyMzMsImV4cCI6MjA5Mzc1MzIzM30.3o7GXefZaGVlbB3PndAaMdri0gk8-P792Z3KmgPVPwQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CHUNK = 80;
const PAGE = 1000;

// O PostgREST limita respostas a 1.000 linhas. Centralizar a paginação evita
// que telas, conferências e backups pareçam completos quando há mais registros.
async function todasAsPaginas(carregar: (inicio: number, fim: number) => any): Promise<any[]> {
  const todos: any[] = [];
  for (let inicio = 0; ; inicio += PAGE) {
    const { data, error } = await carregar(inicio, inicio + PAGE - 1);
    if (error) throw error;
    todos.push(...(data ?? []));
    if (!data || data.length < PAGE) return todos;
  }
}

export const api = {
  getTurmas: async () => {
    return todasAsPaginas((inicio, fim) => supabase
      .from('Turma').select('*').order('nome').order('id').range(inicio, fim));
  },
  createTurma: async (data: any) => {
    const { data: result, error } = await supabase.from('Turma').insert(data).select().single();
    if (error) throw error;
    return result;
  },
  updateTurma: async (id: string, updates: any) => {
    const { error } = await supabase.from('Turma').update(updates).eq('id', id);
    if (error) throw error;
  },
  deleteTurma: async (id: string) => {
    const { error } = await supabase.from('Turma').delete().eq('id', id);
    if (error) throw error;
  },

  getAlunos: async (turmaId?: string) => {
    return todasAsPaginas((inicio, fim) => {
      let query = supabase.from('Aluno').select('*').order('numero').order('nome').order('id');
      if (turmaId) query = query.eq('turmaId', turmaId);
      return query.range(inicio, fim);
    });
  },
  getAllAlunos: async () => {
    return todasAsPaginas((inicio, fim) => supabase
      .from('Aluno').select('*').order('numero').order('nome').order('id').range(inicio, fim));
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
    return todasAsPaginas((inicio, fim) => supabase
      .from('Falta').select('*').eq('turmaId', turmaId).eq('mes', mes).eq('ano', ano)
      .order('id').range(inicio, fim));
  },
  getFaltasMes: async (mes: number, ano: number) => {
    return todasAsPaginas((inicio, fim) => supabase
      .from('Falta').select('*').eq('mes', mes).eq('ano', ano)
      .order('id').range(inicio, fim));
  },
  getFaltasAluno: async (alunoId: string, ano: number) => {
    return todasAsPaginas((inicio, fim) => supabase
      .from('Falta').select('*').eq('alunoId', alunoId).eq('ano', ano)
      .order('mes').order('id').range(inicio, fim));
  },
  getFaltasAlunoTodos: async (alunoId: string) => {
    return todasAsPaginas((inicio, fim) => supabase
      .from('Falta').select('*').eq('alunoId', alunoId)
      .order('ano').order('mes').order('id').range(inicio, fim));
  },
  getAllFaltas: async () => todasAsPaginas((inicio, fim) => supabase
    .from('Falta').select('*').order('id').range(inicio, fim)),

  getAllEducacenso: async (colunas = '*') => todasAsPaginas((inicio, fim) => supabase
    .from('Educacenso').select(colunas).order('id').range(inicio, fim)),

  atualizarMotivoFalta: async (alunoId: string, mes: number, ano: number, motivo: string | null) => {
    const { error } = await supabase.from('Falta')
      .update({ motivo_baixa_frequencia: motivo })
      .eq('alunoId', alunoId).eq('mes', mes).eq('ano', ano);
    if (error) throw error;
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
    return todasAsPaginas((inicio, fim) => {
      let q = supabase.from('Pendente').select('*, Turma(nome, professora)').order('created_at', { ascending: false }).order('id');
      if (status) q = q.eq('status', status);
      return q.range(inicio, fim);
    });
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

  // --- BILHETES E COMUNICADOS IMPRESSOS ---
  createBilhete: async (b: { ano: number; modelo: string; titulo: string; mensagem: string; alunos: any[]; total_bilhetes: number; criado_por: string }) => {
    const { data, error } = await supabase.from('Bilhete').insert(b).select().single();
    if (error) throw error;
    return data;
  },
  getBilhetes: async (ano?: number) => todasAsPaginas((inicio, fim) => {
    let q = supabase.from('Bilhete').select('*').order('created_at', { ascending: false }).order('id');
    if (ano) q = q.eq('ano', ano);
    return q.range(inicio, fim);
  }),

  // --- OCORRENCIAS (faltas de servidores) ---
  getOcorrencias: async (filtros?: { servidor?: string; tipo?: string; dataInicio?: string; dataFim?: string; registrado_por?: string }) => {
    return todasAsPaginas((inicio, fim) => {
      let q = supabase.from('Ocorrencia').select('*').order('data', { ascending: true }).order('created_at', { ascending: true }).order('id');
      // Cada usuário visualiza somente as ocorrências registradas no próprio login.
      if (filtros?.registrado_por) q = q.eq('registrado_por', filtros.registrado_por);
      if (filtros?.servidor) q = q.ilike('servidor', `%${filtros.servidor}%`);
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo);
      if (filtros?.dataInicio) q = q.gte('data', filtros.dataInicio);
      if (filtros?.dataFim) q = q.lte('data', filtros.dataFim);
      return q.range(inicio, fim);
    });
  },
  createOcorrencia: async (o: { servidor: string; tipo: string; data: string; dias?: number; descricao?: string; registrado_por: string }) => {
    const { data, error } = await supabase.from('Ocorrencia').insert(o).select().single();
    if (error) throw error;
    return data;
  },
  updateOcorrencia: async (id: string, updates: any) => {
    const { error } = await supabase.from('Ocorrencia').update(updates).eq('id', id);
    if (error) throw error;
  },
  deleteOcorrencia: async (id: string) => {
    const { error } = await supabase.from('Ocorrencia').delete().eq('id', id);
    if (error) throw error;
  },

  // --- CONTROLE DE LANÇAMENTOS ---
  upsertLancamento: async (turmaId: string, mes: number, ano: number, lancadoPor: string, totalFaltas: number, alunosComFalta: number) => {
    const { error } = await supabase.from('LancamentoFaltas').upsert({
      turma_id: turmaId,
      mes,
      ano,
      lancado_por: lancadoPor,
      lancado_em: new Date().toISOString(),
      total_faltas: totalFaltas,
      alunos_com_falta: alunosComFalta,
    }, { onConflict: 'turma_id,mes,ano' });
    if (error) throw error;
  },
  getLancamentos: async (mes: number, ano: number) => {
    return todasAsPaginas((inicio, fim) => supabase
      .from('LancamentoFaltas').select('*').eq('mes', mes).eq('ano', ano)
      .order('id').range(inicio, fim));
  },

  // --- CONTROLE DE IMPORTAÇÃO SED (data válida pra escola inteira) ---
  // Tolerante a falha de propósito: se a tabela ainda não existir no banco
  // (migração não rodada), a importação continua funcionando normalmente —
  // só não atualiza esse indicador específico.
  registrarImportacao: async (importadoPor: string) => {
    const { error } = await supabase.from('ControleImportacao').upsert({
      id: 'unica',
      importado_em: new Date().toISOString(),
      importado_por: importadoPor,
    }, { onConflict: 'id' });
    if (error) console.error('Não foi possível registrar a data da importação:', error);
  },
  getUltimaImportacao: async (): Promise<{ importado_em: string; importado_por: string } | null> => {
    try {
      const { data, error } = await supabase.from('ControleImportacao').select('importado_em, importado_por').eq('id', 'unica').maybeSingle();
      if (error) return null;
      return data ?? null;
    } catch {
      return null;
    }
  },

  // --- CRUZAMENTO SED × EDUCACENSO (aba Educacenso) ---
  // Tolerante a falha de propósito: se a tabela ainda não existir (migração
  // não rodada), o cruzamento em si continua funcionando normalmente na
  // tela — só não fica salvo pra sobreviver a trocar de aba/fechar o navegador.
  salvarCruzamentoEducacenso: async (ano: number, dataCorte: string, nomeArquivo: string, resultado: any[], criadoPor: string) => {
    const { error } = await supabase.from('CruzamentoEducacenso').upsert({
      ano,
      data_corte: dataCorte,
      nome_arquivo: nomeArquivo,
      resultado,
      criado_por: criadoPor,
      criado_em: new Date().toISOString(),
    }, { onConflict: 'ano' });
    if (error) console.error('Não foi possível salvar o cruzamento Educacenso:', error);
  },
  getCruzamentoEducacenso: async (ano: number): Promise<{ data_corte: string; nome_arquivo: string; resultado: any[]; criado_por: string; criado_em: string } | null> => {
    try {
      const { data, error } = await supabase.from('CruzamentoEducacenso').select('*').eq('ano', ano).maybeSingle();
      if (error) return null;
      return data ?? null;
    } catch {
      return null;
    }
  },

  getUsuarios: async () => todasAsPaginas((inicio, fim) => supabase
    .from('Usuario')
    .select('id, nome, perfil, ativo, turma_id, permissoes')
    .order('id', { ascending: true })
    .range(inicio, fim)),

  getBackups: async () => todasAsPaginas((inicio, fim) => supabase
    .from('Backup')
    .select('id, created_at, descricao')
    .order('created_at', { ascending: false })
    .order('id')
    .range(inicio, fim)),

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
  // Limpa apenas alunos e faltas — preserva turmas e professoras cadastradas
  clearAlunos: async () => {
    await supabase.from('Falta').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('Aluno').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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

  // --- BF FREQUÊNCIA (registro histórico permanente) ---
  salvarBFFrequenciaRegistros: async (registros: any[]) => {
    for (let i = 0; i < registros.length; i += CHUNK) {
      const { error } = await supabase
        .from('BFFrequenciaRegistro')
        .upsert(registros.slice(i, i + CHUNK), { onConflict: 'aluno_id,mes,ano' });
      if (error) throw error;
    }
  },
  getBFFrequenciaRegistros: async (mesInicio: number, mesFim: number, ano: number) => {
    return todasAsPaginas((inicio, fim) => supabase
      .from('BFFrequenciaRegistro').select('*')
      .gte('mes', mesInicio).lte('mes', mesFim).eq('ano', ano)
      .order('mes').order('aluno_nome')
      .range(inicio, fim));
  },
};
