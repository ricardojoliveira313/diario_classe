-- ═══════════════════════════════════════════════════════════════════════
-- CORREÇÃO: RLS ativado sem nenhuma policy (dados sumiram do site)
-- ═══════════════════════════════════════════════════════════════════════
-- PROBLEMA: a varredura de segurança do Supabase ativou "Row Level
-- Security" (RLS) nas tabelas usadas pelo Diário de Classe, mas não
-- criou nenhuma policy. Sem policy, o Postgres nega TODO acesso por
-- padrão — por isso Turmas, Alunos, Faltas etc. apareceram vazios no
-- site, mesmo com os dados intactos no banco.
--
-- CORREÇÃO: cria uma policy permissiva em cada tabela usada pelo
-- sistema, liberando leitura/escrita para as roles "anon" e
-- "authenticated" — exatamente como já funcionava antes da varredura,
-- já que o controle de acesso deste app é feito inteiramente na
-- aplicação (login próprio via tabela Usuario + RPC verificar_login),
-- não pelo Supabase Auth. Isso também resolve o aviso
-- "rls_enabled_no_policy" do linter do Supabase para essas tabelas.
--
-- A tabela Usuario continua protegida: a coluna "senha" já está
-- bloqueada para leitura via REVOKE (ver CORRIGIR_SEGURANCA_SENHAS.sql)
-- — essa proteção de coluna é independente da policy de linha e
-- continua valendo normalmente.
--
-- Não mexe nas tabelas fono_*, profiles, formacoes, Afastamento,
-- AuditLog, Escola, FrequenciaMensal, Parametros, Servidor,
-- TipoAfastamento, TurmaProfessor, Vinculo — não são usadas pelo
-- Diário de Classe (provavelmente de outro sistema no mesmo projeto
-- Supabase) e não devem ser alteradas por este script.
--
-- COMO RODAR: copie este arquivo inteiro e execute no SQL Editor do
-- Supabase (https://supabase.com/dashboard → seu projeto → SQL Editor
-- → New query → colar → Run). Seguro rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tabelas TEXT[] := ARRAY['Turma','Aluno','Falta','Usuario','Pendente','Ocorrencia','Backup','Educacenso'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "permitir_app_%s" ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY "permitir_app_%s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END $$;

-- Recarrega o cache do PostgREST para aplicar as policies imediatamente
NOTIFY pgrst, 'reload schema';
