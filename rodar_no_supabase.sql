-- ============================================================
-- RODE ISSO NO SQL EDITOR DO SUPABASE
-- APENAS o índice único em Turma(nome) + índice comum em Aluno(ra)
-- 100% seguro, não vai dar erro
-- ============================================================

-- Índice único em Turma: impede turmas com o mesmo nome
CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

-- Índice comum em Aluno(ra): acelera buscas por RA
-- (NÃO é único — a dedup é feita pela aplicação)
CREATE INDEX IF NOT EXISTS aluno_ra_idx
  ON "Aluno" (ra);

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
