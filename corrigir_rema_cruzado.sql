-- ============================================================
-- LIMPA REMAs QUE CRUZAM MODALIDADES (dados incorretos)
-- Rode no SQL Editor do Supabase
-- ============================================================

-- ─── 1: LISTA os REMAs errados que serão removidos ──────────
SELECT 'SERA REMOVIDO' AS acao, a1.id, a1.ra, a1.nome,
  t1.nome AS turma_rema, COALESCE(t1.tipo, 'REGULAR') AS tipo_rema,
  t2.nome AS turma_ativo, COALESCE(t2.tipo, 'REGULAR') AS tipo_ativo
FROM "Aluno" a1
JOIN "Aluno" a2 ON a1.ra = a2.ra
LEFT JOIN "Turma" t1 ON t1.id = a1."turmaId"
LEFT JOIN "Turma" t2 ON t2.id = a2."turmaId"
WHERE a1.situacao = 'REMA' AND a2.situacao = 'ATIVO'
  AND (
    (COALESCE(t1.tipo, 'REGULAR') = 'AEE' AND COALESCE(t2.tipo, 'REGULAR') <> 'AEE')
    OR
    (COALESCE(t2.tipo, 'REGULAR') = 'AEE' AND COALESCE(t1.tipo, 'REGULAR') <> 'AEE')
  )
ORDER BY a1.nome;

-- ─── 2: REMOVE os REMAs errados (mantém os ATIVOS) ─────────
-- DESCOMENTE e rode ABAIXO depois de verificar a lista acima

BEGIN;
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
COMMIT;

-- ─── 3: Remove registros REPETIDOS (mesmo RA+mesma turma+mesma situação) ──
BEGIN;
DELETE FROM "Aluno" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY ra, situacao, "turmaId"
      ORDER BY created_at ASC
    ) AS rn FROM "Aluno" WHERE ra IS NOT NULL
  ) sub WHERE rn > 1
);
COMMIT;

-- ─── 4: Verifica resultado final ─────────────────────────────
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
