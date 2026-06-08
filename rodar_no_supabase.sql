-- RODE NO SQL EDITOR DO SUPABASE
-- Remove índice único de Aluno(ra) — conflita com AEE+regular
-- Mantém índice único de Turma(nome)

DROP INDEX IF EXISTS aluno_ra_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

NOTIFY pgrst, 'reload schema';
