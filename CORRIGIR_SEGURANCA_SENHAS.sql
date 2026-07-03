-- ═══════════════════════════════════════════════════════════════════════
-- CORREÇÃO DE SEGURANÇA — Senhas em texto puro (Usuario.senha)
-- ═══════════════════════════════════════════════════════════════════════
-- PROBLEMA: as senhas dos usuários (gestao, escola, professores cadastrados
-- em "Usuários") estão gravadas em texto puro na tabela Usuario. Como a
-- chave anônima do Supabase é pública (fica no código do site), qualquer
-- pessoa conseguia ler todas as senhas diretamente pela API REST.
--
-- CORREÇÃO:
--   1. Ativa a extensão pgcrypto (criptografia de senha, padrão bcrypt)
--   2. Converte todas as senhas já gravadas para hash bcrypt (irreversível)
--   3. Cria um gatilho (trigger) que hasheia automaticamente qualquer nova
--      senha gravada dali pra frente (login que cria/edita usuário na aba
--      "Usuários" continua funcionando exatamente igual)
--   4. Cria uma função de login (verificar_login) que compara a senha sem
--      nunca devolver o hash pela API
--   5. Bloqueia a leitura direta da coluna "senha" pela API — só a função
--      de login acima consegue "ver" a senha, e só para comparar
--
-- COMO RODAR: copie este arquivo inteiro e execute no SQL Editor do
-- Supabase (https://supabase.com/dashboard → seu projeto → SQL Editor →
-- New query → colar → Run). É seguro rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Extensão de criptografia (já vem disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Migra senhas existentes em texto puro para hash bcrypt
--    (pula quem já estiver hasheado — identificado pelo prefixo $2a/$2b/$2y)
UPDATE "Usuario"
SET senha = crypt(senha, gen_salt('bf'))
WHERE senha IS NOT NULL AND senha !~ '^\$2[aby]\$';

-- 3. Gatilho: qualquer senha gravada (criação ou edição de usuário) é
--    automaticamente hasheada antes de ser salva — nunca mais fica em texto puro
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

-- 4. Função de login: recebe usuário + senha em texto puro (só nesta chamada,
--    via HTTPS), compara com o hash salvo, e devolve perfil/permissões — nunca
--    devolve a senha/hash. SECURITY DEFINER = roda com privilégio de leitura
--    mesmo com a coluna "senha" bloqueada para o público (passo 5 abaixo).
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

-- 5. Bloqueia a leitura direta da coluna "senha" pela API pública — a partir
--    de agora só a função verificar_login (acima) consegue comparar a senha.
--    A aba "Usuários" continua funcionando normalmente (não exibe senha).
REVOKE SELECT (senha) ON "Usuario" FROM anon;
REVOKE SELECT (senha) ON "Usuario" FROM authenticated;

-- 6. Recarrega o cache do PostgREST para reconhecer a nova função
NOTIFY pgrst, 'reload schema';
