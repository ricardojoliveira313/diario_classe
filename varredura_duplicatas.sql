-- ============================================================
-- VARREDURA DE DUPLICATAS
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ─── 1. DUPLICATAS LEGÍTIMAS (REMA + ATIVO) ─────────────────
-- Aluno que foi remanejado: tem registro REMA na origem + ATIVO no destino
SELECT
  a1.ra,
  a1.nome,
  a1.situacao AS situacao_origem,
  COALESCE(t1.nome, 'SEM TURMA') AS turma_origem,
  COALESCE(t1.professora, '') AS prof_origem,
  a2.situacao AS situacao_destino,
  COALESCE(t2.nome, 'SEM TURMA') AS turma_destino,
  COALESCE(t2.professora, '') AS prof_destino
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.ra IS NOT NULL
  AND a1.situacao = 'REMA'
  AND a2.situacao = 'ATIVO'
ORDER BY a1.ra;

-- ─── 2. DUPLICATAS LEGÍTIMAS (AEE + REGULAR) ────────────────
-- Mesmo aluno na turma regular + Sala de Recursos
SELECT
  a1.ra,
  a1.nome,
  'REGULAR' AS tipo,
  COALESCE(t1.nome, 'SEM TURMA') AS turma,
  a2.aee AS aee_marcado
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
WHERE a1.ra IS NOT NULL
  AND a1.situacao <> 'REMA'
  AND a2.situacao <> 'REMA'
  AND (
    (a1."turmaId" IN (SELECT id FROM "Turma" WHERE tipo = 'AEE') AND a2."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE'))
    OR
    (a2."turmaId" IN (SELECT id FROM "Turma" WHERE tipo = 'AEE') AND a1."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE'))
  )
ORDER BY a1.ra;

-- ─── 3. DUPLICATAS INDEVIDAS (VERDADEIRAS) ───────────────────
-- Mesmo RA, ambos regulares (NEM REMA, NEM AEE) — isso é erro
SELECT
  a1.ra,
  a1.nome AS nome_aluno,
  a1.situacao AS sit_1,
  a2.situacao AS sit_2,
  COALESCE(t1.nome, 'SEM TURMA') AS turma_1,
  COALESCE(t2.nome, 'SEM TURMA') AS turma_2
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.ra IS NOT NULL
  AND a1.situacao <> 'REMA'
  AND a2.situacao <> 'REMA'
  AND (a1."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE') OR a1."turmaId" IS NULL)
  AND (a2."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE') OR a2."turmaId" IS NULL)
  AND a1.situacao = a2.situacao
ORDER BY a1.ra;

-- ─── 4. CONTAGEM RESUMO ──────────────────────────────────────
SELECT 'REMA+ATIVO (correto)' AS tipo, COUNT(*) AS total FROM (
  SELECT a1.ra FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
  WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
  GROUP BY a1.ra
) sub1

UNION ALL

SELECT 'AEE+REGULAR (correto)' AS tipo, COUNT(*) AS total FROM (
  SELECT a1.ra FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
  WHERE a1.situacao <> 'REMA' AND a2.situacao <> 'REMA'
    AND (
      (a1."turmaId" IN (SELECT id FROM "Turma" WHERE tipo = 'AEE')
       AND a2."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE'))
      OR
      (a2."turmaId" IN (SELECT id FROM "Turma" WHERE tipo = 'AEE')
       AND a1."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE'))
    )
  GROUP BY a1.ra
) sub2

UNION ALL

SELECT 'DUPLICATA INDEVIDA (erro)' AS tipo, COUNT(*) AS total FROM (
  SELECT a1.ra FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
  WHERE a1.situacao <> 'REMA' AND a2.situacao <> 'REMA'
    AND a1.situacao = a2.situacao
    AND (a1."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE') OR a1."turmaId" IS NULL)
    AND (a2."turmaId" NOT IN (SELECT id FROM "Turma" WHERE tipo = 'AEE') OR a2."turmaId" IS NULL)
  GROUP BY a1.ra
) sub3;
