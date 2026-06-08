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
  -- Remanejamento: turma/professor de origem quando aluno foi remanejado
  turma_origem          TEXT DEFAULT '',
  professora_origem     TEXT DEFAULT '',
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
-- Remanejamento (novas colunas)
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS turma_origem          TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS professora_origem     TEXT DEFAULT '';
-- CPF do aluno
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS cpf                  TEXT DEFAULT NULL;
-- Destino do remanejamento (pra onde o aluno REMA foi)
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS turma_destino       TEXT DEFAULT '';
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS professora_destino  TEXT DEFAULT '';
-- Rendimento do Conselho de Ciclo (3º e 5º Anos): APROVADO | PERMANECENTE
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS rendimento          TEXT DEFAULT NULL;

ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS professora TEXT DEFAULT '';
ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS periodo    TEXT DEFAULT '';
-- Tipo da turma: REGULAR (padrão), AEE (Sala de Recursos), EJA (Alfabetização/Pós-Alfa)
ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'REGULAR';
-- Define tipo='AEE' em todas as turmas cujo nome começa por AEE (idempotente)
UPDATE "Turma" SET tipo = 'AEE'
  WHERE (nome ILIKE 'AEE%' OR nome ILIKE '%ATENDIMENTO EDUCACIONAL%')
    AND (tipo IS NULL OR tipo <> 'AEE');

-- Permissões por página para cada usuário viewer (null = todas liberadas)
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT NULL;

ALTER TABLE "Falta" ADD COLUMN IF NOT EXISTS frequencia      TEXT DEFAULT '';

-- ─── 2b. Tabela EDUCACENSO (dados persistentes do Censo Escolar) ──────
CREATE TABLE IF NOT EXISTS "Educacenso" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  data_nascimento TEXT DEFAULT '',
  cpf             TEXT DEFAULT '',
  deficiencia     TEXT DEFAULT '',
  cor_raca        TEXT DEFAULT '',
  identificador   TEXT DEFAULT '',  -- "Identificação única" do Educacenso
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Cor/Raça no Aluno
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS cor_raca TEXT DEFAULT '';

-- Sinaliza se o aluno é da Sala de Recursos (AEE) — usado pelo índice único
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS aee BOOLEAN DEFAULT FALSE;

-- Índice único em CPF (parcial: só alunos com CPF) para upsert da Educacenso
CREATE UNIQUE INDEX IF NOT EXISTS educacenso_cpf_uniq ON "Educacenso" (cpf) WHERE cpf <> '';

-- Índice único em RA do Aluno (parcial: exclui REMA e AEE, que legitimamente
-- compartilham RA com ATIVO regular)
-- Impede duplicatas entre alunos regulares mesmo que a aplicação falhe
CREATE UNIQUE INDEX IF NOT EXISTS aluno_ra_uniq ON "Aluno" (ra)
  WHERE ra IS NOT NULL AND situacao <> 'REMA' AND aee IS NOT TRUE;

-- Índice único em nome da Turma (parcial: ignora nomes vazios)
-- Garante que não se criem duas turmas com o mesmo nome
CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq ON "Turma" (nome) WHERE nome <> '';

-- RLS desativado na Educacenso (se não rodou antes)
ALTER TABLE "Educacenso" DISABLE ROW LEVEL SECURITY;

-- ─── 2c. Tabela USUARIO (login gerenciável pelo admin) ─────────
CREATE TABLE IF NOT EXISTS "Usuario" (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL UNIQUE,
  senha      TEXT NOT NULL,
  perfil     TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO "Usuario" (nome, senha, perfil) VALUES
  ('gestao', 'gestao2026', 'admin'),
  ('escola', 'escola2026', 'viewer')
ON CONFLICT (nome) DO NOTHING;

-- ─── 3. Desativa RLS (Row Level Security) nas tabelas ─────────

ALTER TABLE "Turma"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Aluno"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Falta"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Pendente" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Educacenso" DISABLE ROW LEVEL SECURITY;

-- ─── 4. Recarrega o cache do PostgREST ───────────────────────
-- (resolve o erro "Could not find the table in the schema cache")

NOTIFY pgrst, 'reload schema';

-- Professor pode lançar faltas de uma turma específica
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS turma_id UUID REFERENCES "Turma"(id) ON DELETE SET NULL;
