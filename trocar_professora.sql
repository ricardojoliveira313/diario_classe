-- Troca professora Débora → ALINE APARECIDA na 1ª ETAPA E
UPDATE "Turma" SET professora = 'ALINE APARECIDA'
WHERE nome ILIKE '%1%ETAPA%E%' AND professora ILIKE '%DEBORA%';

UPDATE "Aluno" SET professora = 'ALINE APARECIDA'
WHERE "turmaId" IN (
  SELECT id FROM "Turma"
  WHERE nome ILIKE '%1%ETAPA%E%'
) AND professora ILIKE '%DEBORA%';
