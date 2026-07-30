-- ═══════════════════════════════════════════════════════════════════════
-- CORREÇÃO: acesso à tabela Usuario e função de login (verificar_login)
-- ═══════════════════════════════════════════════════════════════════════
-- PROBLEMA: depois da varredura de segurança, a tabela "Usuario" ficou
-- sem os privilégios básicos (GRANT) que o app precisa para funcionar
-- com a chave anônima, e/ou a função verificar_login perdeu a permissão
-- de execução (ou foi removida). Resultado:
--   - A aba "Gerenciar Usuários" não consegue mais listar ninguém
--   - Login de usuários cadastrados no Supabase (ex: "bruno@escola.com")
--     falha com "Não foi possível conectar ao servidor"
--
-- Isso é diferente do problema de Turma/Aluno (RLS sem policy, que só
-- ESCONDIA os dados) — aqui parece ter havido um bloqueio mais forte,
-- na tabela e/ou na função, específico da tabela de credenciais.
--
-- CORREÇÃO: recria a extensão/trigger/função de login (igual ao script
-- original CORRIGIR_SEGURANCA_SENHAS.sql — seguro rodar de novo) e
-- garante explicitamente os privilégios de tabela que faltavam:
--   - leitura de id/nome/perfil/permissoes/turma_id/created_at (NUNCA
--     da coluna senha) para o painel "Gerenciar Usuários"
--   - escrita (insert/update) incluindo a coluna senha, pois é assim
--     que se cadastra/troca a senha de um usuário (o valor é hasheado
--     automaticamente pelo gatilho antes de gravar — nunca fica em
--     texto puro)
--   - exclusão de usuários
--   - permissão de execução da função verificar_login
--
-- COMO RODAR: copie este arquivo inteiro e execute no SQL Editor do
-- Supabase. Seguro rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1b. Garante as colunas do esquema original (a tabela "Usuario" parece
--     ter sido recriada sem elas — foi o que causou o erro
--     "column created_at does not exist" ao tentar rodar este script)
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT NULL;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS turma_id UUID REFERENCES "Turma"(id) ON DELETE SET NULL;

-- 2. Migra qualquer senha em texto puro (ex: usuários criados enquanto
--    o gatilho estava faltando) para hash bcrypt
UPDATE "Usuario"
SET senha = crypt(senha, gen_salt('bf'))
WHERE senha IS NOT NULL AND senha !~ '^\$2[aby]\$';

-- 3. Recria o gatilho de hash automático
CREATE OR REPLACE FUNCTION hash_senha_usuario() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.senha IS NOT NULL AND NEW.senha !~ '^\$2[aby]\$' THEN
    NEW.senha := crypt(NEW.senha, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hash_senha_usuario ON "Usuario";
CREATE TRIGGER trg_hash_senha_usuario
  BEFORE INSERT OR UPDATE OF senha ON "Usuario"
  FOR EACH ROW EXECUTE FUNCTION hash_senha_usuario();

-- 4. Recria a função de login
CREATE OR REPLACE FUNCTION verificar_login(p_nome TEXT, p_senha TEXT)
RETURNS TABLE(nome TEXT, perfil TEXT, permissoes JSONB, turma_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.nome, u.perfil, u.permissoes, u.turma_id
  FROM "Usuario" u
  WHERE u.nome = p_nome AND u.senha = crypt(p_senha, u.senha);
END;
$$;

REVOKE ALL ON FUNCTION verificar_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verificar_login(TEXT, TEXT) TO anon, authenticated;

-- 5. Garante os privilégios de tabela que o painel "Gerenciar Usuários" precisa
GRANT SELECT (id, nome, perfil, permissoes, turma_id, created_at) ON "Usuario" TO anon, authenticated;
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
