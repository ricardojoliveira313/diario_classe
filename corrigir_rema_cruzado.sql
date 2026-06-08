-- ============================================================
-- CORREÇÃO: REMOVE REMA CRUZANDO MODALIDADES
-- REMA só vale dentro da mesma modalidade:
--   Regular→Regular, AEE→AEE, EJA→EJA, Infantil→Infantil
-- ============================================================

-- ─── Identifica e lista os REMAs errados ─────────────────────
SELECT 'REMA CRUZANDO MODALIDADE — SERÁ REMOVIDO' AS acao,
  a1.ra, a1.nome,
  COALESCE(t1.tipo, 'REGULAR') AS tipo_origem,
  t1.nome AS turma_origem,
  COALESCE(t2.tipo, 'REGULAR') AS tipo_destino,
  t2.nome AS turma_destino
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
  AND (
    (COALESCE(t1.tipo, 'REGULAR') = 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
    OR
    (COALESCE(t2.tipo, 'REGULAR') = 'AEE' AND COALESCE(t1.tipo, 'REGULAR') <> 'AEE')
    OR
    (COALESCE(t1.tipo, 'REGULAR') = 'REGULAR' AND t2.tipo = 'EJA')
    OR
    (t1.tipo = 'EJA' AND COALESCE(t2.tipo, 'REGULAR') = 'REGULAR')
  )
ORDER BY a1.nome;

-- ─── 2: Remove os REMAs errados (mantém ATIVO) ──────────────
-- Rode ABAIXO APENAS se a lista acima estiver correta

-- DELETE FROM "Aluno" WHERE id IN (
--   SELECT a1.id FROM "Aluno" a1
--   JOIN "Aluno" a2 ON a1.ra = a2.ra
--   LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
--   LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
--   WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
--     AND (
--       (COALESCE(t1.tipo, 'REGULAR') = 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
--       OR
--       (COALESCE(t2.tipo, 'REGULAR') = 'AEE' AND COALESCE(t1.tipo, 'REGULAR') <> 'AEE')
--     )
-- );

-- ─── 3: Varredura de verificação ─────────────────────────────
-- (mesmas consultas do varredura_duplicatas.sql)

SELECT 'REMA Regular→Regular (correto)' AS tipo, COUNT(DISTINCT a1.ra) AS total
FROM "Aluno" a1 JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
  AND (t1.tipo IS NULL OR t1.tipo <> 'AEE')
  AND (t2.tipo IS NULL OR t2.tipo <> 'AEE');

SELECT 'REMA AEE→AEE (correto)' AS tipo, COUNT(DISTINCT a1.ra) AS total
FROM "Aluno" a1 JOIN "Aluno" a2 ON a1.ra = a2.ra AND a1.id < a2.id
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
  AND t1.tipo = 'AEE' AND t2.tipo = 'AEE';

SELECT 'ERRO: REMA cruzando modalidades' AS tipo, COUNT(DISTINCT a1.ra) AS total
FROM "Aluno" a1 JOIN "Aluno" a2 ON a1.ra = a2.ra
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
  AND (
    (COALESCE(t1.tipo, 'REGULAR') = 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
    OR (COALESCE(t2.tipo, 'REGULAR') = 'AEE' AND COALESCE(t1.tipo, 'REGULAR') <> 'AEE')
  );
