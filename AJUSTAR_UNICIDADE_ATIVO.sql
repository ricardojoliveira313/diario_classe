-- Corrige aluno_ra_uniq: a unicidade por RA deve valer SOMENTE para o registro
-- ATIVO (a matrícula corrente do aluno). TRAN, BXTR, REMA e N COM são estados
-- administrativos/históricos que podem legitimamente coexistir em turmas
-- diferentes para o mesmo RA — o SED lista cada um como uma linha própria, e
-- o sistema deve ser espelho fiel disso, sem perder nenhuma linha.
--
-- Problema real encontrado: BXTR não estava isento da unicidade (só REMA e
-- TRAN estavam). Um aluno com BXTR numa turma e ATIVO em outra (mesmo RA)
-- violava a constraint — o upsert sobrescrevia um registro no lugar do outro,
-- perdendo uma das duas linhas do relatório SED.
--
-- Migração aditiva e idempotente: não remove nem altera dados existentes,
-- apenas recria o índice com a condição correta.

DROP INDEX IF EXISTS aluno_ra_uniq;
CREATE UNIQUE INDEX aluno_ra_uniq ON "Aluno" (ra)
  WHERE ra IS NOT NULL AND (situacao IS NULL OR situacao = 'ATIVO') AND aee IS NOT TRUE;

NOTIFY pgrst, 'reload schema';
