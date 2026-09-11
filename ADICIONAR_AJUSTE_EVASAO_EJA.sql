-- Mapa EJA: ajuste manual fixo para "Evasão" (mesmo mecanismo já criado para
-- "Nunca Compareceu" em ADICIONAR_AJUSTE_NUNCA_COMPARECEU_EJA.sql).
-- Rode isto no SQL Editor do Supabase.
--
-- Alunos evadidos (ABAN) que a SED parou de listar nos relatórios seguintes
-- (nome/RA perdidos) não têm mais como virar um registro de Aluno de
-- verdade. Este ajuste é um número fixo, lançado manualmente por turma, que
-- soma direto no Mapa EJA (Eliminação Geral / Faixa Etária) sem depender de
-- nenhum aluno cadastrado. Uma evasão nova, vinda de um import real, continua
-- sendo detectada automaticamente pela situação ABAN do aluno — este ajuste
-- só cobre o que já foi perdido antes.

ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS ajuste_evasao INTEGER DEFAULT 0;
ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS ajuste_faixa_evasao TEXT DEFAULT '';

NOTIFY pgrst, 'reload schema';
