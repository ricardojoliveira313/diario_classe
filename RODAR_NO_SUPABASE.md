# Como Rodar no Supabase

## Abra o SQL Editor e cole:

```sql
DROP INDEX IF EXISTS aluno_ra_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

NOTIFY pgrst, 'reload schema';
```

Clique em **Run**.

- Remove o índice único de `Aluno(ra)` — AEE + regular compartilham o mesmo RA legitimamente
- Cria índice único de `Turma(nome)` — impede turmas com nome duplicado
- A dedup de RA continua sendo feita pela aplicação automaticamente
