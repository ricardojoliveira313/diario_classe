-- ============================================================
-- RODE NO SQL EDITOR DO SUPABASE
-- Cria índices únicos excluindo AEE e REMA (compartilham RA legitimamente)
-- ============================================================

-- Índice único em Aluno(ra): exclui REMA e AEE
-- (REMA compartilha RA com ATIVO, AEE compartilha RA com Regular)
CREATE UNIQUE INDEX IF NOT EXISTS aluno_ra_uniq ON "Aluno" (ra)
  WHERE ra IS NOT NULL AND situacao <> 'REMA' AND aee IS NOT TRUE;

-- Índice único em Turma(nome): impede turmas com nome duplicado
CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
