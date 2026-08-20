-- Adiciona o sexo cadastral usado no relatório mensal de matrículas.
-- O valor deve refletir a SED ou uma conferência humana; nunca é inferido pelo nome.

ALTER TABLE "Aluno"
  ADD COLUMN IF NOT EXISTS sexo TEXT DEFAULT NULL;

UPDATE "Aluno"
SET sexo = CASE
  WHEN UPPER(TRIM(sexo)) IN ('M', 'MASCULINO') THEN 'M'
  WHEN UPPER(TRIM(sexo)) IN ('F', 'FEMININO') THEN 'F'
  ELSE NULL
END
WHERE sexo IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aluno_sexo_check'
      AND conrelid = '"Aluno"'::regclass
  ) THEN
    ALTER TABLE "Aluno"
      ADD CONSTRAINT aluno_sexo_check
      CHECK (sexo IS NULL OR sexo IN ('M', 'F'));
  END IF;
END $$;

COMMENT ON COLUMN "Aluno".sexo IS
  'Sexo cadastral conforme a SED ou conferência humana: M, F ou NULL quando não informado.';

NOTIFY pgrst, 'reload schema';
