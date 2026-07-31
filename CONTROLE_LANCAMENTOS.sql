-- ═══════════════════════════════════════════════════════════════════════
-- CONTROLE DE LANÇAMENTOS DE FALTAS
-- ═══════════════════════════════════════════════════════════════════════
-- Cria a tabela que registra quando cada turma teve suas faltas
-- lançadas no mês. Cada clique em "Salvar Faltas" grava ou atualiza
-- uma linha para a combinação turma + mês + ano.
--
-- Campos registrados:
--   turma_id        — identificador da turma
--   mes / ano       — mês e ano do lançamento
--   lancado_por     — login do usuário que clicou em Salvar
--   lancado_em      — data e hora do salvamento
--   total_faltas    — soma de todas as faltas/justificativas/atestados
--   alunos_com_falta— quantos alunos tiveram pelo menos uma ausência
--
-- COMO RODAR: copie este arquivo inteiro e execute no SQL Editor do
-- Supabase. Seguro rodar mais de uma vez (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public."LancamentoFaltas" (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id         UUID NOT NULL REFERENCES public."Turma"(id) ON DELETE CASCADE,
  mes              INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano              INTEGER NOT NULL,
  lancado_por      TEXT NOT NULL,
  lancado_em       TIMESTAMPTZ DEFAULT NOW(),
  total_faltas     INTEGER NOT NULL DEFAULT 0,
  alunos_com_falta INTEGER NOT NULL DEFAULT 0,
  UNIQUE (turma_id, mes, ano)
);

ALTER TABLE public."LancamentoFaltas" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'LancamentoFaltas'
      AND policyname = 'permitir_app_LancamentoFaltas'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "permitir_app_LancamentoFaltas" ON public."LancamentoFaltas"
        FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    $pol$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
