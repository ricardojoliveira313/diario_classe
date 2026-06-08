-- Remove o índice único de Aluno (causa conflito com AEE+regular)
DROP INDEX IF EXISTS aluno_ra_uniq;

-- Mantém só o de Turma (esse sim não tem exceção)
CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

NOTIFY pgrst, 'reload schema';
