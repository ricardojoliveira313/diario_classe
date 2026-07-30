-- RECUPERAÇÃO RÁPIDA DO LOGIN
-- Execute no SQL Editor do Supabase se o site retornar 404 em
-- /rest/v1/rpc/verificar_login.
-- Este script não altera usuários nem senhas; apenas recria o RPC
-- necessário para comparar os hashes já armazenados.

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT NULL;

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS turma_id UUID
    REFERENCES "Turma"(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.verificar_login(
  p_nome TEXT,
  p_senha TEXT
)
RETURNS TABLE(
  nome TEXT,
  perfil TEXT,
  permissoes JSONB,
  turma_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT u.nome, u.perfil, u.permissoes, u.turma_id
  FROM public."Usuario" AS u
  WHERE lower(trim(u.nome)) = lower(trim(p_nome))
    AND u.senha = extensions.crypt(p_senha, u.senha);
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_login(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
