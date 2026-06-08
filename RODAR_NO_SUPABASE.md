# Como Rodar no Supabase

## 1. Abra o SQL Editor

No painel do Supabase, vá em **SQL Editor** (ícone de terminal).

## 2. Copie e cole o SQL abaixo

```sql
-- ============================================================
-- RODE ISSO NO SQL EDITOR DO SUPABASE
-- 1) Limpa duplicatas de RA
-- 2) Cria índices únicos
-- Pode rodar quantas vezes quiser
-- ============================================================

-- ─── PASSO 1: Limpa duplicatas de RA ─────────────────────────
-- Mantém o registro com MAIS faltas, deleta os extras
-- Ignora REMA (compartilha RA legitimamente) e AEE

DO $$
DECLARE
  dup RECORD;
  canon_id UUID;
  extra_id UUID;
  ra_val BIGINT;
BEGIN
  FOR dup IN
    SELECT ra FROM "Aluno"
    WHERE ra IS NOT NULL AND situacao <> 'REMA'
      AND ("turmaId" IS NULL OR "turmaId" NOT IN (
        SELECT id FROM "Turma" WHERE tipo = 'AEE'
      ))
    GROUP BY ra
    HAVING COUNT(*) > 1
  LOOP
    ra_val := dup.ra;

    SELECT a.id INTO canon_id FROM "Aluno" a
      LEFT JOIN "Falta" f ON f."alunoId" = a.id
    WHERE a.ra = ra_val AND a.situacao <> 'REMA'
      AND (a."turmaId" IS NULL OR a."turmaId" NOT IN (
        SELECT id FROM "Turma" WHERE tipo = 'AEE'
      ))
    GROUP BY a.id
    ORDER BY COUNT(f.id) DESC, a.id ASC
    LIMIT 1;

    FOR extra_id IN
      SELECT a.id FROM "Aluno" a
      WHERE a.ra = ra_val AND a.id <> canon_id
        AND a.situacao <> 'REMA'
        AND (a."turmaId" IS NULL OR a."turmaId" NOT IN (
          SELECT id FROM "Turma" WHERE tipo = 'AEE'
        ))
    LOOP
      UPDATE "Falta" SET "alunoId" = canon_id
      WHERE "alunoId" = extra_id
        AND (mes, ano) NOT IN (
          SELECT mes, ano FROM "Falta" WHERE "alunoId" = canon_id
        );

      DELETE FROM "Falta"
      WHERE "alunoId" = extra_id
        AND (mes, ano) IN (
          SELECT mes, ano FROM "Falta" WHERE "alunoId" = canon_id
        );

      UPDATE "Aluno" SET
        bolsa_familia = TRUE
      WHERE id = canon_id AND EXISTS (
        SELECT 1 FROM "Aluno" WHERE id = extra_id AND bolsa_familia = TRUE
      ) AND bolsa_familia IS DISTINCT FROM TRUE;

      DELETE FROM "Aluno" WHERE id = extra_id;
    END LOOP;
  END LOOP;
END $$;

-- ─── PASSO 2: Cria índices únicos ────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS aluno_ra_uniq
  ON "Aluno" (ra) WHERE ra IS NOT NULL AND situacao <> 'REMA';

CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
```

## 3. Clique em **Run**

## O que isso faz

| Passo | O que |
|-------|-------|
| 1 | Remove RAs duplicados que já existem no banco (mantém o registro com mais faltas) |
| 2 | Cria índices únicos — impedem novas duplicatas de RA e nome de turma |
| 3 | Recarrega o cache do PostgREST |

Depois disso, a importação não vai mais criar duplicatas. Pode rodar quantas vezes quiser.
