-- RELATÓRIO DE DUPLICIDADES — DIÁRIO DE CLASSE
-- Execute no Supabase SQL Editor

-- ─── RESUMO GERAL ─────────────────────────────────────────────────
SELECT '=== RESUMO GERAL ===' as info;

SELECT
  (SELECT COUNT(DISTINCT ra) FROM "Aluno") as "Total RAs únicos",
  (SELECT COUNT(*) FROM "Aluno") as "Total registros",
  (SELECT COUNT(*) FROM "Aluno") - (SELECT COUNT(DISTINCT ra) FROM "Aluno") as "Registros excedentes";

-- ─── CATEGORIA 1: AEE + Regular (CORRETO) ──────────────────────────
SELECT '=== CATEGORIA 1: AEE + Regular (OK) ===' as info;

SELECT COUNT(DISTINCT a.ra) as "Qtd alunos",
       COUNT(*) as "Qtd registros"
FROM "Aluno" a
JOIN "Turma" t ON t.id = a."turmaId"
WHERE a.ra IN (
  SELECT ra FROM "Aluno" WHERE ra IS NOT NULL GROUP BY ra HAVING COUNT(*) = 2
)
AND a.situacao = 'ATIVO'
AND t.id IN (SELECT id FROM "Turma" WHERE nome LIKE '%AEE%')
   OR a.situacao = 'ATIVO' AND a.ra IN (
     SELECT ra FROM "Aluno" WHERE ra IS NOT NULL GROUP BY ra HAVING COUNT(*) = 2
   );

-- ─── CATEGORIA 2: REMA duplicado (BUG — múltiplos registros REMA idênticos) ──
SELECT '=== CATEGORIA 2: REMA duplicado (BUG) ===' as info;

SELECT a.ra, a.nome, t.nome as turma, COUNT(*) as qtd_repeticao
FROM "Aluno" a
JOIN "Turma" t ON t.id = a."turmaId"
WHERE a.situacao = 'REMA'
GROUP BY a.ra, a.nome, a.situacao, t.nome
HAVING COUNT(*) > 1
ORDER BY qtd_repeticao DESC;

-- ─── CATEGORIA 3: REMAs caóticos (3+ turmas diferentes) ───────────
SELECT '=== CATEGORIA 3: 3+ registros (caótico) ===' as info;

SELECT a.ra, a.nome, COUNT(*) as total_registros,
       COUNT(DISTINCT a."turmaId") as turmas_envolvidas,
       STRING_AGG(DISTINCT t.nome, ', ') as turmas
FROM "Aluno" a
JOIN "Turma" t ON t.id = a."turmaId"
WHERE a.ra IN (
  SELECT ra FROM "Aluno" WHERE ra IS NOT NULL GROUP BY ra HAVING COUNT(*) >= 3
)
GROUP BY a.ra, a.nome
ORDER BY total_registros DESC;

-- ─── CATEGORIA 4: REMA sem turma_destino ───────────────────────────
SELECT '=== CATEGORIA 4: REMA sem destino ===' as info;

SELECT COUNT(*) as "REMA sem turma_destino",
       COUNT(DISTINCT ra) as "RAs únicos"
FROM "Aluno"
WHERE situacao = 'REMA'
AND (turma_destino IS NULL OR turma_destino = '');

-- ─── TOP 10 piores casos ──────────────────────────────────────────
SELECT '=== TOP 10 PIORES CASOS ===' as info;

SELECT a.ra, a.nome, COUNT(*) as qtd,
       STRING_AGG(t.nome, ' | ' ORDER BY t.nome) as turmas
FROM "Aluno" a
JOIN "Turma" t ON t.id = a."turmaId"
GROUP BY a.ra, a.nome
HAVING COUNT(*) > 2
ORDER BY qtd DESC
LIMIT 10;
