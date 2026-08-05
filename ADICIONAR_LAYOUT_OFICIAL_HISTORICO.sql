-- Histórico Escolar: complemento do estabelecimento, notas por disciplina
-- e dados do quadro de transferência do verso.
-- Migração aditiva e idempotente: não remove nem altera dados existentes.

ALTER TABLE public."HistoricoAluno"
  ADD COLUMN IF NOT EXISTS ra_exibicao text,
  ADD COLUMN IF NOT EXISTS complemento_estabelecimento text,
  ADD COLUMN IF NOT EXISTS notas_disciplinas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transferencia_ano_ciclo text,
  ADD COLUMN IF NOT EXISTS transferencia_periodo text,
  ADD COLUMN IF NOT EXISTS transferencia_dias_letivos text,
  ADD COLUMN IF NOT EXISTS transferencia_presencas text,
  ADD COLUMN IF NOT EXISTS transferencia_ausencias text,
  ADD COLUMN IF NOT EXISTS prosseguimento_ano text,
  ADD COLUMN IF NOT EXISTS data_emissao text;

COMMENT ON COLUMN public."HistoricoAluno".ra_exibicao IS
  'RA apresentado no documento, podendo conter zeros ou formatação.';
COMMENT ON COLUMN public."HistoricoAluno".complemento_estabelecimento IS
  'Texto opcional impresso abaixo do estabelecimento, por exemplo TRANSFERE-SE.';
COMMENT ON COLUMN public."HistoricoAluno".notas_disciplinas IS
  'Lista JSON de disciplinas, notas e cargas horárias do ciclo.';
COMMENT ON COLUMN public."HistoricoAluno".transferencia_periodo IS
  'Período cursado apresentado no verso do histórico.';

-- Atualiza imediatamente o cache de schema da API do Supabase/PostgREST.
NOTIFY pgrst, 'reload schema';
