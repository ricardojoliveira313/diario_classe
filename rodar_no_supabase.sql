-- ============================================================
-- PASSO A PASSO COMPLETO — RODE TUDO NO SUPABASE
-- 1) Marca AEE
-- 2) Remove REMA cruzados e repetidos
-- 3) Cria índices únicos
-- ============================================================

-- ─── PASSO 1: Marca alunos AEE baseado na turma ─────────────
ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS aee BOOLEAN DEFAULT FALSE;

UPDATE "Aluno" SET aee = TRUE
WHERE aee IS DISTINCT FROM TRUE
  AND "turmaId" IN (
    SELECT id FROM "Turma"
    WHERE tipo = 'AEE' OR nome ILIKE 'AEE%'
  );

UPDATE "Aluno" SET aee = FALSE WHERE aee IS NULL;

-- ─── PASSO 2: Remove REMAs que cruzam modalidades (ex: AEE→Regular) ──
DELETE FROM "Aluno" WHERE id IN (
  SELECT a1.id FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra
  LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
  LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
  WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
    AND (
      (COALESCE(t1.tipo, 'REGULAR') = 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
      OR
      (COALESCE(t2.tipo, 'REGULAR') = 'AEE' AND COALESCE(t1.tipo, 'REGULAR') <> 'AEE')
    )
);

-- ─── PASSO 3: Remove registros repetidos (mesmo RA+turma+situação) ──
DELETE FROM "Aluno" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY ra, situacao, "turmaId"
      ORDER BY created_at ASC
    ) AS rn FROM "Aluno" WHERE ra IS NOT NULL
  ) sub WHERE rn > 1
);

-- ─── PASSO 4: Remove duplicatas de RA entre regulares ────────
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
    GROUP BY a.id ORDER BY COUNT(f.id) DESC, a.id ASC LIMIT 1;
    FOR extra_id IN
      SELECT id FROM "Aluno"
      WHERE ra = ra_val AND id <> canon_id
        AND situacao <> 'REMA' AND aee IS NOT TRUE
    LOOP
      DELETE FROM "Falta" WHERE "alunoId" = extra_id;
      DELETE FROM "Aluno" WHERE id = extra_id;
    END LOOP;
  END LOOP;
END $$;

-- ─── PASSO 5: Cria índices únicos ────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS aluno_ra_uniq ON "Aluno" (ra)
  WHERE ra IS NOT NULL AND situacao <> 'REMA' AND aee IS NOT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS turma_nome_uniq
  ON "Turma" (nome) WHERE nome <> '';

NOTIFY pgrst, 'reload schema';
