-- Histórico Escolar: Parte Diversificada (disciplinas complementares à Base
-- Nacional Comum), documentada separadamente ao registrar notas de outra rede.
-- Migração aditiva e idempotente: não remove nem altera dados existentes.

ALTER TABLE public."HistoricoAluno"
  ADD COLUMN IF NOT EXISTS notas_diversificada jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public."HistoricoAluno".notas_diversificada IS
  'Lista JSON de disciplinas, notas e cargas horárias da Parte Diversificada do ciclo.';

-- Atualiza imediatamente o cache de schema da API do Supabase/PostgREST.
NOTIFY pgrst, 'reload schema';
