# Como Rodar no Supabase

## Abra o SQL Editor

No painel do Supabase, vá em **SQL Editor** (ícone de terminal).

## Copie e cole o SQL abaixo

```sql
-- ============================================================
-- SOLUÇÃO DEFINITIVA — RODE NO SQL EDITOR DO SUPABASE
-- 1) Adiciona coluna aee no Aluno
-- 2) Marca alunos AEE baseado na turma
-- 3) Remove RAs duplicados (entre regulares)
-- 4) Cria índice ÚNICO em Aluno(ra) excluindo AEE e REMA
-- 5) Cria índice ÚNICO em Turma(nome)
-- ============================================================

ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS aee BOOLEAN DEFAULT FALSE;

UPDATE "Aluno" SET aee = TRUE
WHERE aee IS DISTINCT FROM TRUE
  AND "turmaId" IN (SELECT id FROM "Turma" WHERE tipo = 'AEE');

DO $$
DECLARE
  dup RECORD;
  canon_id UUID;
  extra_id UUID;
  ra_val BIGINT;
BEGIN
  FOR dup IN
    SELECT ra FROM "Aluno"
    WHERE ra IS NOT NULL AND situacao <> 'REMA' AND aee IS NOT TRUE
    GROUP BY ra HAVING COUNT(*) > 1
  LOOP
    ra_val := dup.ra;

    SELECT a.id INTO canon_id FROM "Aluno" a
      LEFT JOIN "Falta" f ON f."alunoId" = a.id
    WHERE a.ra = ra_val AND a.situacao <> 'REMA' AND a.aee IS NOT TRUE
    GROUP BY a.id
    ORDER BY COUNT(f.id) DESC, a.id ASC
    LIMIT 1;

    FOR extra_id IN
      SELECT id FROM "Aluno"
      WHERE ra = ra_val AND id <> canon_id
        AND situacao <> 'REMA' AND aee IS NOT TRUE
    LOOP
      UPDATE "Falta" SET "alunoId" = canon_id
      WHERE "alunoId" = extra_id
        AND (mes, ano) NOT IN (SELECT mes, ano FROM "Falta" WHERE "alunoId" = canon_id);
      DELETE FROM "Falta"
      WHERE "alunoId" = extra_id
        AND (mes, ano) IN (SELECT mes, ano FROM "Falta" WHERE "alunoId" = canon_id);
      DELETE FROM "Aluno" WHERE id = extra_id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS aluno_ra_uniq
  ON "Aluno" (ra) WHERE ra IS NOT NULL AND situacao <> 'REMA' AND aee IS NOT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

NOTIFY pgrst, 'reload schema';
```

## Clique em **Run** (▶)

### O que faz

| Passo | O quê |
|-------|-------|
| 1 | Cria coluna `aee` no Aluno |
| 2 | Marca como AEE quem está em turma AEE |
| 3 | Remove RAs duplicados entre regulares (preserva o que tem mais faltas) |
| 4 | Cria índice **único** em `Aluno(ra)` — exclui AEE e REMA (legítimos) |
| 5 | Cria índice **único** em `Turma(nome)` — impede turmas com mesmo nome |

Agora o banco entende perfeitamente: aluno AEE pode ter o mesmo RA do regular, REMA pode compartilhar RA com ATIVO — tudo legítimo. Mas **dois regulares com o mesmo RA** são barrados na hora.
