-- Controle mensal do lançamento de faltas
-- Aplicar no SQL Editor do Supabase antes de ativar a nova aba.
CREATE TABLE IF NOT EXISTS "LancamentoFalta" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "turmaId" TEXT NOT NULL REFERENCES "Turma"(id) ON DELETE CASCADE,
  professora TEXT NOT NULL DEFAULT '',
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('com_faltas', 'sem_faltas')),
  "totalFaltas" INTEGER NOT NULL DEFAULT 0,
  "alunosComFalta" INTEGER NOT NULL DEFAULT 0,
  "lancadoPor" TEXT NOT NULL DEFAULT '',
  "lancadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "LancamentoFalta_turma_mes_ano_key" UNIQUE ("turmaId", mes, ano)
);

ALTER TABLE "LancamentoFalta" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_app_lancamento_falta" ON "LancamentoFalta";
CREATE POLICY "permitir_app_lancamento_falta"
  ON "LancamentoFalta"
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
