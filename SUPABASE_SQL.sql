-- ============================================================
-- DIÁRIO DE CLASSE — Script completo do banco de dados
-- Execute no Supabase SQL Editor (pode rodar mais de uma vez)
-- ============================================================

-- ─── 1. Tabelas principais ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "Turma" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  professora  TEXT DEFAULT '',
  periodo     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Aluno" (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "turmaId"             UUID REFERENCES "Turma"(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  numero                INTEGER DEFAULT 0,
  ra                    BIGINT,
  dig_ra                TEXT DEFAULT '',
  data_nascimento       TEXT DEFAULT '',
  data_inicio_matricula TEXT DEFAULT '',
  data_fim_matricula    TEXT DEFAULT '',
  data_movimentacao     TEXT DEFAULT '',
  deficiencia           TEXT DEFAULT '',
  bolsa_familia         BOOLEAN DEFAULT FALSE,
  situacao              TEXT DEFAULT 'ATIVO',
  professora            TEXT DEFAULT '',
  nis                   TEXT DEFAULT NULL,
  responsavel           TEXT DEFAULT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Falta" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "alunoId"       UUID REFERENCES "Aluno"(id) ON DELETE CASCADE,
  "turmaId"       UUID REFERENCES "Turma"(id) ON DELETE CASCADE,
  mes             INTEGER NOT NULL,
  ano             INTEGER NOT NULL DEFAULT 2026,
  faltas          INTEGER DEFAULT 0,
  frequencia      TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("alunoId", mes, ano)
);

CREATE TABLE IF NOT EXISTS "Pendente" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "turmaId"        UUID REFERENCES "Turma"(id) ON DELETE CASCADE,
  mes              INTEGER NOT NULL,
  ano              INTEGER NOT NULL DEFAULT 2026,
  status           TEXT DEFAULT 'pendente',
  dados            JSONB NOT NULL DEFAULT '[]',
  total_entradas   INTEGER DEFAULT 0,
  total_problemas  INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Colunas extras (caso as tabelas já existam sem elas) ──

ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS ra                    BIGINT;
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS dig_ra                TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS data_nascimento       TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS data_inicio_matricula TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS data_fim_matricula    TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS data_movimentacao     TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS deficiencia           TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS bolsa_familia         BOOLEAN DEFAULT FALSE;
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS situacao              TEXT DEFAULT 'ATIVO';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS professora            TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS numero                INTEGER DEFAULT 0;
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS nis                   TEXT DEFAULT NULL;
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS responsavel           TEXT DEFAULT NULL;

ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS professora TEXT DEFAULT '';
ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS periodo    TEXT DEFAULT '';

ALTER TABLE "Falta" ADD COLUMN IF NOT EXISTS frequencia      TEXT DEFAULT '';

-- ─── 3. Desativa RLS (Row Level Security) nas tabelas ─────────

ALTER TABLE "Turma"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Aluno"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Falta"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Pendente" DISABLE ROW LEVEL SECURITY;

-- ─── 4. Recarrega o cache do PostgREST ───────────────────────
-- (resolve o erro "Could not find the table in the schema cache")

NOTIFY pgrst, 'reload schema';
