-- ═══════════════════════════════════════════════════════════════════════
-- CORREÇÃO SEGURA: login de usuários via Supabase
-- ═══════════════════════════════════════════════════════════════════════
-- Execute este arquivo inteiro no SQL Editor do Supabase.
--
-- Causa corrigida: a versão anterior falhava em
-- GRANT SELECT (..., ativo), pois a tabela Usuario não possui a coluna
-- "ativo". Como o SQL Editor executa a transação inteira, o erro desfazia
-- também a criação do RPC verificar_login.
--
-- Esta versão recria somente o necessário para autenticação e não concede
-- INSERT, UPDATE ou DELETE amplos para anon/authenticated.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT NULL;

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS turma_id UUID
    REFERENCES "Turma"(id) ON DELETE SET NULL;

-- Garante o hash automático de novas senhas e alterações de senha.
CREATE OR REPLACE FUNCTION public.hash_senha_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.senha IS NOT NULL AND NEW.senha !~ '^\$2[aby]\$' THEN
    NEW.senha := extensions.crypt(NEW.senha, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_senha_usuario ON "Usuario";

CREATE TRIGGER trg_hash_senha_usuario
  BEFORE INSERT OR UPDATE OF senha ON "Usuario"
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_senha_usuario();

-- RPC usado pelo frontend no login.
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
