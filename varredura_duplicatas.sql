-- ============================================================
-- VARREDURA DE DUPLICATAS — CORRIGIDA
-- Separa REGULAR de AEE (NÃO se misturam)
-- ============================================================

-- ─── 1. REMA + ATIVO APENAS REGULAR → REGULAR ───────────────
SELECT
  a1.ra,
  a1.nome,
  a1.situacao AS sit_origem,
  COALESCE(t1.nome, 'SEM TURMA') AS turma_origem,
  COALESCE(t1.professora, '') AS prof_origem,
  a2.situacao AS sit_destino,
  COALESCE(t2.nome, 'SEM TURMA') AS turma_destino,
  COALESCE(t2.professora, '') AS prof_destino
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.ra IS NOT NULL
  AND a1.situacao = 'REMA'
  AND a2.situacao = 'ATIVO'
  AND (t1.tipo IS NULL OR t1.tipo <> 'AEE')
  AND (t2.tipo IS NULL OR t2.tipo <> 'AEE')
ORDER BY a1.nome;

-- ─── 2. REMA + ATIVO APENAS AEE → AEE ───────────────────────
SELECT
  a1.ra,
  a1.nome,
  a1.situacao AS sit_origem,
  COALESCE(t1.nome, 'SEM TURMA') AS turma_origem,
  COALESCE(t1.professora, '') AS prof_origem,
  a2.situacao AS sit_destino,
  COALESCE(t2.nome, 'SEM TURMA') AS turma_destino,
  COALESCE(t2.professora, '') AS prof_destino
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.ra IS NOT NULL
  AND a1.situacao = 'REMA'
  AND a2.situacao = 'ATIVO'
  AND (t1.tipo = 'AEE')
  AND (t2.tipo = 'AEE')
ORDER BY a1.nome;

-- ─── 3. ERRO: REMA CRUZANDO REGULAR ↔ AEE ───────────────────
SELECT
  a1.ra,
  a1.nome,
  a1.situacao AS sit_origem,
  COALESCE(t1.nome, 'SEM TURMA') AS turma_origem,
  COALESCE(t1.tipo, 'REGULAR') AS tipo_origem,
  a2.situacao AS sit_destino,
  COALESCE(t2.nome, 'SEM TURMA') AS turma_destino,
  COALESCE(t2.tipo, 'REGULAR') AS tipo_destino
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.ra IS NOT NULL
  AND a1.situacao = 'REMA'
  AND a2.situacao = 'ATIVO'
  AND (
    (COALESCE(t1.tipo, 'REGULAR') = 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
    OR
    (COALESCE(t2.tipo, 'REGULAR') = 'AEE' AND COALESCE(t1.tipo, 'REGULAR') <> 'AEE')
  )
ORDER BY a1.nome;

-- ─── 4. DUPLICATAS INDEVIDAS (MESMA SITUAÇÃO, MESMO RA) ────
SELECT
  a1.ra,
  a1.nome,
  a1.situacao,
  COALESCE(t1.nome, 'SEM TURMA') AS turma_1,
  COALESCE(t2.nome, 'SEM TURMA') AS turma_2,
  a1.id AS id_1,
  a2.id AS id_2
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.ra IS NOT NULL
  AND a1.situacao <> 'REMA'
  AND a2.situacao <> 'REMA'
  AND a1.situacao = a2.situacao
  AND (
    (COALESCE(t1.tipo, 'REGULAR') <> 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
    OR
    (t1.tipo = 'AEE' AND t2.tipo = 'AEE')
  )
ORDER BY a1.nome;

-- ─── 5. CONTAGEM RESUMO ──────────────────────────────────────
SELECT 'REMA Regular→Regular (correto)' AS tipo, COUNT(*) AS total FROM (
  SELECT DISTINCT a1.ra FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
  LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
  LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
  WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
    AND (t1.tipo IS NULL OR t1.tipo <> 'AEE')
    AND (t2.tipo IS NULL OR t2.tipo <> 'AEE')
) sub

UNION ALL

SELECT 'REMA AEE→AEE (correto)' AS tipo, COUNT(*) AS total FROM (
  SELECT DISTINCT a1.ra FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
  LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
  LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
  WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
    AND t1.tipo = 'AEE' AND t2.tipo = 'AEE'
) sub

UNION ALL

SELECT 'ERRO: REMA cruzando Regular↔AEE' AS tipo, COUNT(*) AS total FROM (
  SELECT DISTINCT a1.ra FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
  LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
  LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
  WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
    AND (
      (COALESCE(t1.tipo, 'REGULAR') = 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
      OR
      (COALESCE(t2.tipo, 'REGULAR') = 'AEE' AND COALESCE(t1.tipo, 'REGULAR') <> 'AEE')
    )
) sub

UNION ALL

SELECT 'DUPLICATA INDEVIDA (erro)' AS tipo, COUNT(*) AS total FROM (
  SELECT a1.ra FROM "Aluno" a1
  JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
  WHERE a1.situacao <> 'REMA' AND a2.situacao <> 'REMA'
    AND a1.situacao = a2.situacao
    AND (
      (COALESCE(t1.tipo, 'REGULAR') <> 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
      OR
      (t1.tipo = 'AEE' AND t2.tipo = 'AEE')
    )
) sub;
