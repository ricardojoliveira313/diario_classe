-- ============================================================
-- CRIA TABELA OCORRENCIA — Faltas de Servidores
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS "Ocorrencia" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor        TEXT NOT NULL,
  tipo            TEXT NOT NULL,
  data            DATE NOT NULL,
  dias            INTEGER DEFAULT 1,
  descricao       TEXT DEFAULT '',
  registrado_por  TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE "Ocorrencia" DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
