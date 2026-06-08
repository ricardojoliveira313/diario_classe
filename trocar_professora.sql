-- PASSO 1: Descobrir nome exato da turma
SELECT id, nome, professora FROM "Turma" ORDER BY nome;

-- PASSO 2 (rode DEPOIS de ver o resultado acima):
-- Troca Débora → ALINE APARECIDA em todas as turmas com professora Débora
--
-- UPDATE "Turma" SET professora = 'ALINE APARECIDA'
-- WHERE professora ILIKE '%DEBORA%';
--
-- UPDATE "Aluno" SET professora = 'ALINE APARECIDA'
-- WHERE professora ILIKE '%DEBORA%';
