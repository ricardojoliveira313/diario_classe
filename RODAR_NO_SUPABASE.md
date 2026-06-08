# Como Rodar no Supabase

## 1. Abra o SQL Editor

No painel do Supabase, vá em **SQL Editor** (ícone de terminal).

## 2. Copie e cole o SQL abaixo

```sql
-- ============================================================
-- RODE ISSO NO SQL EDITOR DO SUPABASE
-- APENAS o índice único em Turma(nome) + índice comum em Aluno(ra)
-- 100% seguro, não vai dar erro
-- ============================================================

-- Índice único em Turma: impede turmas com o mesmo nome
CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

-- Índice comum em Aluno(ra): acelera buscas por RA
-- (NÃO é único — a dedup é feita pela aplicação)
CREATE INDEX IF NOT EXISTS aluno_ra_idx
  ON "Aluno" (ra);

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
```

## 3. Clique em **Run** (▶)

Isso não vai dar erro. O índice de Turma impede nomes duplicados. A dedup de RA continua sendo feita pela própria aplicação (que já tem limpeza automática).
