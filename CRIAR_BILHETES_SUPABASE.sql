-- DIÁRIO DE CLASSE — Mural de bilhetes impressos
-- Migração idempotente: pode ser executada mais de uma vez.
CREATE TABLE IF NOT EXISTS "Bilhete" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INTEGER NOT NULL DEFAULT 2026,
  modelo TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  alunos JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_bilhetes INTEGER NOT NULL DEFAULT 0,
  criado_por TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS ano INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS modelo TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS mensagem TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS alunos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS total_bilhetes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS criado_por TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bilhete" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "Bilhete" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_app_Bilhete" ON "Bilhete";
CREATE POLICY "permitir_app_Bilhete" ON "Bilhete"
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS bilhete_created_at_idx ON "Bilhete" (created_at DESC);
NOTIFY pgrst, 'reload schema';
