-- ============================================================
-- LIMPA REGISTROS REPETIDOS (MESMO RA + MESMA SITUAÇÃO + MESMA TURMA)
-- Mantém 1 registro por RA/situação/turma, apaga os extras
-- ============================================================

-- ─── Lista o que será removido ───────────────────────────────
SELECT 'REPETIDO' AS tipo, ra, nome, situacao,
  COUNT(*) AS qtd, array_agg(id) AS ids
FROM "Aluno"
WHERE ra IS NOT NULL
GROUP BY ra, nome, situacao, "turmaId"
HAVING COUNT(*) > 1
ORDER BY ra;

-- ─── Remove os repetidos (mantém o mais antigo) ──────────────
-- Rode APENAS se a lista acima estiver correta
--
-- DELETE FROM "Aluno" WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (
--       PARTITION BY ra, situacao, "turmaId"
--       ORDER BY created_at ASC
--     ) AS rn FROM "Aluno" WHERE ra IS NOT NULL
--   ) sub WHERE rn > 1
-- );
