# Como Rodar no Supabase

## 1. Abra o SQL Editor

No painel do Supabase, vá em **SQL Editor** (ícone de terminal).

## 2. Cole e execute

Abra o arquivo [`rodar_no_supabase.sql`](./rodar_no_supabase.sql), copie todo o conteúdo, cole no SQL Editor e clique em **Run** (▶).

## 3. O que ele faz

| Passo | O que |
|-------|-------|
| 1 | Remove RAs duplicados que já existem no banco (mantém o registro com mais faltas) |
| 2 | Cria índices únicos — impedem novas duplicatas de RA e nome de turma |
| 3 | Recarrega o cache do PostgREST |

## 4. Depois disso

- A página de importação continua funcionando normalmente
- Se houver tentativa de criar RA duplicado, o banco rejeita e o sistema mostra erro — **não cria duplicata silenciosa**

Pode rodar quantas vezes quiser, é seguro (idempotente).
