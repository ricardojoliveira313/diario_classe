-- Amplia somente a tabela de históricos para permitir emitir documentos
-- de alunos que já não estejam no cadastro atual da escola.
-- Migração aditiva e idempotente: não altera Aluno, Turma ou Falta.

ALTER TABLE public."HistoricoAluno"
  ADD COLUMN IF NOT EXISTS nome_aluno text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS situacao text,
  ADD COLUMN IF NOT EXISTS data_inicio_matricula date,
  ADD COLUMN IF NOT EXISTS data_fim_matricula date,
  ADD COLUMN IF NOT EXISTS turma_nome text,
  ADD COLUMN IF NOT EXISTS total_faltas integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'HistoricoAluno_total_faltas_check'
      AND conrelid = 'public."HistoricoAluno"'::regclass
  ) THEN
    ALTER TABLE public."HistoricoAluno"
      ADD CONSTRAINT "HistoricoAluno_total_faltas_check"
      CHECK (total_faltas IS NULL OR total_faltas >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public."HistoricoAluno".nome_aluno IS
  'Nome usado no documento, inclusive quando o aluno não existe mais em Aluno.';
COMMENT ON COLUMN public."HistoricoAluno".turma_nome IS
  'Última turma informada no histórico; não cria vínculo com a tabela Turma.';

NOTIFY pgrst, 'reload schema';
