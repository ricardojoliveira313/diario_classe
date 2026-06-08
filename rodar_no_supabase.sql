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

    -- Canônico = o que tem mais faltas
    SELECT a.id INTO canon_id FROM "Aluno" a
      LEFT JOIN "Falta" f ON f."alunoId" = a.id
    WHERE a.ra = ra_val AND a.situacao <> 'REMA'
      AND (a."turmaId" IS NULL OR a."turmaId" NOT IN (
        SELECT id FROM "Turma" WHERE tipo = 'AEE'
      ))
    GROUP BY a.id
    ORDER BY COUNT(f.id) DESC, a.id ASC
    LIMIT 1;

    -- Transfere faltas dos extras para o canônico
    FOR extra_id IN
      SELECT a.id FROM "Aluno" a
      WHERE a.ra = ra_val AND a.id <> canon_id
        AND a.situacao <> 'REMA'
        AND (a."turmaId" IS NULL OR a."turmaId" NOT IN (
          SELECT id FROM "Turma" WHERE tipo = 'AEE'
        ))
    LOOP
      -- Faltas que o canônico ainda não tem
      UPDATE "Falta" SET "alunoId" = canon_id
      WHERE "alunoId" = extra_id
        AND (mes, ano) NOT IN (
          SELECT mes, ano FROM "Falta" WHERE "alunoId" = canon_id
        );

      -- Faltas que o canônico já tem (duplicadas) → deleta
      DELETE FROM "Falta"
      WHERE "alunoId" = extra_id
        AND (mes, ano) IN (
          SELECT mes, ano FROM "Falta" WHERE "alunoId" = canon_id
        );

      -- Preserva dados manuais no canônico
      UPDATE "Aluno" SET
        bolsa_familia = TRUE
      WHERE id = canon_id AND EXISTS (
        SELECT 1 FROM "Aluno" WHERE id = extra_id AND bolsa_familia = TRUE
      ) AND bolsa_familia IS DISTINCT FROM TRUE;

      -- Deleta o extra
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
