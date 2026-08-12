-- Histórico Escolar: carga horária total específica das "Notas de outra
-- rede" — distinta da carga horária padrão (C. HORÁRIA) da tabela principal,
-- que segue o padrão local (1000h/ano da EMEIEF). Quando o histórico vem de
-- outra rede (ex: escola estadual, 1600h/ano), esse total é diferente e
-- precisa de um campo próprio, editável separadamente.
-- Migração aditiva e idempotente: não remove nem altera dados existentes.

ALTER TABLE public."HistoricoAluno"
  ADD COLUMN IF NOT EXISTS carga_horaria_outra_rede text;

COMMENT ON COLUMN public."HistoricoAluno".carga_horaria_outra_rede IS
  'Carga horária total anual (Base Nacional Comum + Parte Diversificada) do histórico trazido de outra rede — distinta da carga_horaria padrão da EMEIEF.';

-- Atualiza imediatamente o cache de schema da API do Supabase/PostgREST.
NOTIFY pgrst, 'reload schema';
