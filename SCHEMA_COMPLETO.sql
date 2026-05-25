-- ============================================================
-- DIÁRIO DE CLASSE + DIÁRIO SERVIDOR
-- SCHEMA COMPLETO DO BANCO DE DADOS — EMEIEF LUIZ GONZAGA
-- Supabase Project: hxmwpleyhagwcukuhzxg
-- Atualizado: Maio 2026
-- ✅ Seguro rodar mais de uma vez (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- ▶ MÓDULO 1: DIÁRIO DE CLASSE (tabelas existentes)
-- ══════════════════════════════════════════════════════════════

-- ─── Turma ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Turma" (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  professora TEXT        DEFAULT '',
  periodo    TEXT        DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public."Turma" ADD COLUMN IF NOT EXISTS professora TEXT DEFAULT '';
ALTER TABLE public."Turma" ADD COLUMN IF NOT EXISTS periodo    TEXT DEFAULT '';

-- ─── Aluno ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Aluno" (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "turmaId"             UUID    REFERENCES public."Turma"(id) ON DELETE CASCADE,
  nome                  TEXT    NOT NULL,
  numero                INTEGER DEFAULT 0,
  ra                    BIGINT,
  dig_ra                TEXT    DEFAULT '',
  data_nascimento       TEXT    DEFAULT '',
  data_inicio_matricula TEXT    DEFAULT '',
  data_fim_matricula    TEXT    DEFAULT '',
  data_movimentacao     TEXT    DEFAULT '',
  deficiencia           TEXT    DEFAULT '',
  bolsa_familia         BOOLEAN DEFAULT FALSE,
  situacao              TEXT    DEFAULT 'ATIVO',
  professora            TEXT    DEFAULT '',
  nis                   TEXT    DEFAULT NULL,
  responsavel           TEXT    DEFAULT NULL,
  cpf                   TEXT    DEFAULT NULL,
  cor_raca              TEXT    DEFAULT '',
  turma_origem          TEXT    DEFAULT '',
  professora_origem     TEXT    DEFAULT '',
  turma_destino         TEXT    DEFAULT '',
  professora_destino    TEXT    DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS ra                    BIGINT;
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS dig_ra                TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS data_nascimento       TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS data_inicio_matricula TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS data_fim_matricula    TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS data_movimentacao     TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS deficiencia           TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS bolsa_familia         BOOLEAN DEFAULT FALSE;
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS situacao              TEXT DEFAULT 'ATIVO';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS professora            TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS numero                INTEGER DEFAULT 0;
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS nis                   TEXT DEFAULT NULL;
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS responsavel           TEXT DEFAULT NULL;
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS cpf                   TEXT DEFAULT NULL;
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS cor_raca              TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS turma_origem          TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS professora_origem     TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS turma_destino         TEXT DEFAULT '';
ALTER TABLE public."Aluno" ADD COLUMN IF NOT EXISTS professora_destino    TEXT DEFAULT '';

-- ─── Falta ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Falta" (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "alunoId"  UUID    REFERENCES public."Aluno"(id) ON DELETE CASCADE,
  "turmaId"  UUID    REFERENCES public."Turma"(id) ON DELETE CASCADE,
  mes        INTEGER NOT NULL,
  ano        INTEGER NOT NULL DEFAULT 2026,
  faltas     INTEGER DEFAULT 0,
  frequencia TEXT    DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("alunoId", mes, ano)
);
ALTER TABLE public."Falta" ADD COLUMN IF NOT EXISTS frequencia TEXT DEFAULT '';

-- ─── Pendente ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Pendente" (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "turmaId"       UUID    REFERENCES public."Turma"(id) ON DELETE CASCADE,
  mes             INTEGER NOT NULL,
  ano             INTEGER NOT NULL DEFAULT 2026,
  status          TEXT    DEFAULT 'pendente',
  dados           JSONB   NOT NULL DEFAULT '[]',
  total_entradas  INTEGER DEFAULT 0,
  total_problemas INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Educacenso ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Educacenso" (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT        NOT NULL,
  data_nascimento TEXT        DEFAULT '',
  cpf             TEXT        DEFAULT '',
  deficiencia     TEXT        DEFAULT '',
  cor_raca        TEXT        DEFAULT '',
  identificador   TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS educacenso_cpf_uniq
  ON public."Educacenso" (cpf) WHERE cpf <> '';

-- ─── Usuario ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Usuario" (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL UNIQUE,   -- usado como username
  senha      TEXT        NOT NULL,
  perfil     TEXT        NOT NULL DEFAULT 'viewer',  -- 'admin' | 'viewer'
  ativo      BOOLEAN     DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public."Usuario" ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

-- Usuários padrão
INSERT INTO public."Usuario" (nome, senha, perfil) VALUES
  ('gestao', 'gestao2026', 'admin'),
  ('escola', 'escola2026', 'viewer')
ON CONFLICT (nome) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- ▶ MÓDULO 2: DIÁRIO SERVIDOR (tabelas novas)
-- ══════════════════════════════════════════════════════════════

-- ─── Escola ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Escola" (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cr          TEXT    NOT NULL,          -- ex: 61015
  nome        TEXT    NOT NULL,          -- ex: EMEIEF LUIZ GONZAGA
  municipio   TEXT    DEFAULT 'Santo André',
  ano_letivo  INTEGER DEFAULT 2026,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Escola padrão
INSERT INTO public."Escola" (cr, nome, municipio, ano_letivo) VALUES
  ('61015', 'EMEIEF LUIZ GONZAGA', 'Santo André', 2026)
ON CONFLICT DO NOTHING;

-- ─── Servidor ────────────────────────────────────────────────
-- NOTA: tabela já existe com 90 registros — apenas adicionamos colunas novas
CREATE TABLE IF NOT EXISTS public."Servidor" (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rf         VARCHAR(20) NOT NULL UNIQUE,
  nome       TEXT        NOT NULL,
  cargo      TEXT        DEFAULT '',
  periodo    TEXT        DEFAULT 'Manha',
  escola     TEXT        DEFAULT 'EMEIEF LUIZ GONZAGA',
  ativo      BOOLEAN     DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Colunas novas (para tabela existente)
ALTER TABLE public."Servidor" ADD COLUMN IF NOT EXISTS turma_atribuida TEXT DEFAULT '';
ALTER TABLE public."Servidor" ADD COLUMN IF NOT EXISTS sala_atribuida  TEXT DEFAULT '';
ALTER TABLE public."Servidor" ADD COLUMN IF NOT EXISTS ativo           BOOLEAN DEFAULT TRUE;
ALTER TABLE public."Servidor" ADD COLUMN IF NOT EXISTS escola          TEXT DEFAULT 'EMEIEF LUIZ GONZAGA';
ALTER TABLE public."Servidor" ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- ─── Vinculo ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Vinculo" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor_id UUID REFERENCES public."Servidor"(id) ON DELETE CASCADE,
  escola_id   UUID REFERENCES public."Escola"(id)   ON DELETE SET NULL,
  tipo        TEXT NOT NULL,    -- 'Efetivo' | 'Substituto' | 'Contratado' | 'Readaptado'
  data_inicio DATE NOT NULL,
  data_fim    DATE,
  observacao  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TipoAfastamento ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."TipoAfastamento" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT UNIQUE NOT NULL,   -- AF, LM, LT, ABO, FERIAS, etc.
  descricao   TEXT NOT NULL,
  sigla       TEXT DEFAULT '',
  conta_falta BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos padrão
INSERT INTO public."TipoAfastamento" (codigo, descricao, sigla, conta_falta) VALUES
  ('P',     'Presente',                         'P',    FALSE),
  ('F',     'Falta Injustificada',               'F',    TRUE),
  ('AF',    'Afastamento por Atestado/Licença',  'AF',   FALSE),
  ('LM',    'Licença Maternidade',               'LM',   FALSE),
  ('LT',    'Licença para Tratamento de Saúde',  'LT',   FALSE),
  ('ABO',   'Abono',                             'ABO',  FALSE),
  ('FERIAS','Férias',                            'FER',  FALSE),
  ('DSR',   'Descanso Semanal Remunerado',       'DSR',  FALSE),
  ('FOLGA', 'Folga',                             'FOL',  FALSE),
  ('FER',   'Feriado',                           'FER',  FALSE)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Afastamento ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Afastamento" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor_id   UUID REFERENCES public."Servidor"(id) ON DELETE CASCADE,
  tipo_id       UUID REFERENCES public."TipoAfastamento"(id),
  data_inicio   DATE NOT NULL,
  data_fim      DATE NOT NULL,
  dias_uteis    INTEGER DEFAULT 0,
  observacao    TEXT    DEFAULT '',
  documento_url TEXT    DEFAULT '',   -- Supabase Storage
  criado_por    TEXT    DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FrequenciaMensal ────────────────────────────────────────
-- Armazena frequência diária de cada servidor por mês
-- dias = {"1":"P","2":"F","3":"AF","6":"DSR",...}
CREATE TABLE IF NOT EXISTS public."FrequenciaMensal" (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor_id         UUID    REFERENCES public."Servidor"(id) ON DELETE CASCADE,
  mes                 INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano                 INTEGER NOT NULL DEFAULT 2026,
  dias                JSONB   NOT NULL DEFAULT '{}',
  total_presencas     INTEGER DEFAULT 0,
  total_faltas        INTEGER DEFAULT 0,
  total_afastamentos  INTEGER DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (servidor_id, mes, ano)
);

-- ─── Parametro ───────────────────────────────────────────────
-- Dias letivos, feriados e calendário por mês
CREATE TABLE IF NOT EXISTS public."Parametro" (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ano        INTEGER NOT NULL,
  mes        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  dias_uteis INTEGER NOT NULL DEFAULT 22,
  feriados   JSONB   DEFAULT '[]',   -- ["2026-04-21","2026-05-01"]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ano, mes)
);

-- Parâmetros 2026 (dias úteis aproximados por mês)
INSERT INTO public."Parametro" (ano, mes, dias_uteis, feriados) VALUES
  (2026, 1,  21, '[]'),
  (2026, 2,  20, '[]'),
  (2026, 3,  22, '["2026-03-03","2026-03-04"]'),
  (2026, 4,  19, '["2026-04-02","2026-04-03","2026-04-21"]'),
  (2026, 5,  20, '["2026-05-01"]'),
  (2026, 6,  22, '["2026-06-11"]'),
  (2026, 7,  23, '[]'),
  (2026, 8,  21, '[]'),
  (2026, 9,  22, '["2026-09-07"]'),
  (2026, 10, 22, '["2026-10-12"]'),
  (2026, 11, 20, '["2026-11-02","2026-11-15","2026-11-20"]'),
  (2026, 12, 23, '["2026-12-08","2026-12-25"]')
ON CONFLICT (ano, mes) DO NOTHING;

-- ─── AuditLog ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."AuditLog" (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario      TEXT        DEFAULT '',
  acao         TEXT        NOT NULL,  -- 'INSERT' | 'UPDATE' | 'DELETE'
  tabela       TEXT        NOT NULL,
  registro_id  TEXT        DEFAULT '',
  dados_antes  JSONB,
  dados_depois JSONB,
  timestamp    TIMESTAMPTZ DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════
-- ▶ SEGURANÇA: DESATIVAR RLS em todas as tabelas
--   (app usa autenticação própria — RLS desativado é intencional)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public."Turma"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Aluno"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Falta"             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pendente"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Educacenso"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Usuario"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Escola"            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Servidor"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Vinculo"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."TipoAfastamento"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Afastamento"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."FrequenciaMensal"  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Parametro"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog"          DISABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════
-- ▶ PERMISSÕES PostgREST (anon + authenticated)
-- ══════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- ▶ RECARREGAR cache do PostgREST (obrigatório!)
-- ══════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════
-- ▶ VERIFICAÇÃO FINAL — rode depois para confirmar
-- ══════════════════════════════════════════════════════════════
SELECT
  t.table_name AS tabela,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = t.table_name) AS colunas
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type   = 'BASE TABLE'
ORDER BY t.table_name;
