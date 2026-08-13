-- Tabela para guardar permanentemente os registros de alunos com Bolsa Família
-- abaixo do mínimo de frequência, mês a mês. Sem isso, o cálculo é feito só
-- "ao vivo" na tela e se perde caso o aluno deixe de ter bolsa_familia=true
-- no cadastro (ex.: correção de cadastro) ou os dados de falta mudem depois.
CREATE TABLE IF NOT EXISTS "BFFrequenciaRegistro" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES "Aluno"(id) ON DELETE SET NULL,
  aluno_nome text NOT NULL,
  ra text,
  turma_nome text,
  mes int NOT NULL,
  ano int NOT NULL,
  is_infantil boolean NOT NULL DEFAULT false,
  dias_letivos int NOT NULL,
  faltas int NOT NULL DEFAULT 0,
  justificadas int NOT NULL DEFAULT 0,
  atestados int NOT NULL DEFAULT 0,
  freq_pct numeric NOT NULL,
  minimo_exigido int NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  registrado_por text
);

CREATE UNIQUE INDEX IF NOT EXISTS bf_frequencia_registro_uniq
  ON "BFFrequenciaRegistro" (aluno_id, mes, ano);

NOTIFY pgrst, 'reload schema';
