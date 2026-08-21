-- Adiciona campo para anotar o Inep da escola de destino de alunos
-- transferidos (usado na aba "Situações" para registrar manualmente
-- a escola pra onde o aluno foi, já que esse dado não vem em nenhum
-- relatório importável hoje — é apurado pelo usuário direto na SED).

ALTER TABLE "Aluno" ADD COLUMN IF NOT EXISTS inep_destino text;
