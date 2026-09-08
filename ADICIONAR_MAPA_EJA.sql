-- Campos e tabela de apoio para o Mapa EJA (espelha o "Mapa do Mês" da SED).
-- Óbito, CADE e medida socioeducativa não vêm da SED — são informação social
-- cadastrada manualmente pelo administrador. Resultado final (promovido/
-- permanece) também é lançado manualmente ao fim do período de avaliação.
-- Rematrícula marca quem voltou a se matricular (distingue de matrícula nova).

ALTER TABLE "Aluno"
  ADD COLUMN IF NOT EXISTS obito BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cade BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS medida_socioeducativa TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resultado_final TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rematricula BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'aluno_medida_socioeducativa_check' AND conrelid = '"Aluno"'::regclass
  ) THEN
    ALTER TABLE "Aluno"
      ADD CONSTRAINT aluno_medida_socioeducativa_check
      CHECK (medida_socioeducativa IS NULL OR medida_socioeducativa IN ('LA', 'CRAS', 'CREAS', 'CONSELHO_TUTELAR'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'aluno_resultado_final_check' AND conrelid = '"Aluno"'::regclass
  ) THEN
    ALTER TABLE "Aluno"
      ADD CONSTRAINT aluno_resultado_final_check
      CHECK (resultado_final IS NULL OR resultado_final IN ('PROMOVIDO', 'PERMANECE', 'CONCLUINTE'));
  END IF;
END $$;

COMMENT ON COLUMN "Aluno".obito IS 'TRUE quando o aluno faleceu — usado no Mapa EJA (Eliminação Geral / Eliminados no Mês).';
COMMENT ON COLUMN "Aluno".cade IS 'TRUE quando o aluno é atendido pelo CADE — usado no Mapa EJA (Matriculados no Mês).';
COMMENT ON COLUMN "Aluno".medida_socioeducativa IS 'LA, CRAS, CREAS ou CONSELHO_TUTELAR quando o aluno está em medida socioeducativa — usado no Mapa EJA.';
COMMENT ON COLUMN "Aluno".resultado_final IS 'PROMOVIDO, PERMANECE ou CONCLUINTE — resultado final do ciclo, usado no Mapa EJA.';
COMMENT ON COLUMN "Aluno".rematricula IS 'TRUE quando a matrícula do período é uma rematrícula (não matrícula nova) — usado no Mapa EJA.';

-- Lista de espera do EJA (não existe hoje no app — cadastro manual).
CREATE TABLE IF NOT EXISTS "ListaEsperaEja" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ciclo TEXT NOT NULL CHECK (ciclo IN ('ALFA', 'POS', 'MULTI')),
  periodo TEXT NOT NULL CHECK (periodo IN ('Manhã', 'Tarde', 'Vespertino', 'Noite')),
  observacao TEXT,
  criado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE "ListaEsperaEja" IS 'Lista de espera do EJA por ciclo e período — usada no Mapa EJA.';

ALTER TABLE "ListaEsperaEja" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_app_ListaEsperaEja" ON "ListaEsperaEja";
CREATE POLICY "permitir_app_ListaEsperaEja" ON "ListaEsperaEja"
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
