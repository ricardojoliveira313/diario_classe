-- ═══════════════════════════════════════════════════════════════════════
-- CORREÇÃO: acesso à tabela Usuario e função de login (verificar_login)
-- ═══════════════════════════════════════════════════════════════════════
-- HISTÓRICO: a primeira versão deste script chamava crypt(...)/gen_salt(...)
-- sem qualificar o schema. No Supabase, a extensão pgcrypto fica instalada
-- no schema "extensions" (não em "public"), então a função verificar_login
-- era criada sem erro, mas o PostgREST nunca conseguia resolvê-la em tempo
-- de chamada — o site recebia 404 em /rest/v1/rpc/verificar_login mesmo com
-- tudo aparentemente certo no banco. A correção real (aplicada em produção)
-- foi qualificar as chamadas como extensions.crypt(...)/extensions.gen_salt(...)
-- e incluir "extensions" no search_path da função. Esta versão do arquivo
-- já reflete a correção que está rodando em produção.
--
-- COMO RODAR: copie este arquivo inteiro e execute no SQL Editor do
-- Supabase. Seguro rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1b. Garante as colunas do esquema original (a tabela "Usuario" parece
--     ter sido recriada sem elas em algum momento)
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT NULL;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS turma_id UUID REFERENCES "Turma"(id) ON DELETE SET NULL;

-- 2. Migra qualquer senha em texto puro (ex: usuários criados enquanto
--    o gatilho estava faltando) para hash bcrypt
UPDATE "Usuario"
SET senha = extensions.crypt(senha, extensions.gen_salt('bf'))
WHERE senha IS NOT NULL AND senha !~ '^\$2[aby]\$';

-- 3. Recria o gatilho de hash automático
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
  FOR EACH ROW EXECUTE FUNCTION public.hash_senha_usuario();

-- 4. Recria a função de login
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
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO anon, authenticated;

-- 5. Garante os privilégios de tabela que o painel "Gerenciar Usuários" precisa
GRANT SELECT (id, nome, perfil, permissoes, turma_id, ativo) ON "Usuario" TO anon, authenticated;
GRANT INSERT (nome, senha, perfil, permissoes, turma_id) ON "Usuario" TO anon, authenticated;
GRANT UPDATE (nome, senha, perfil, permissoes, turma_id) ON "Usuario" TO anon, authenticated;
GRANT DELETE ON "Usuario" TO anon, authenticated;

-- 6. Bloqueia a leitura direta da coluna "senha" (redundante com o GRANT
--    acima, que já não inclui essa coluna — só por garantia)
REVOKE SELECT (senha) ON "Usuario" FROM anon;
REVOKE SELECT (senha) ON "Usuario" FROM authenticated;

-- 7. Garante que a policy de RLS (criada em CORRIGIR_RLS_SEM_POLICY.sql)
--    continua existindo
DROP POLICY IF EXISTS "permitir_app_Usuario" ON public."Usuario";
CREATE POLICY "permitir_app_Usuario" ON public."Usuario"
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';
