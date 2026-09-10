-- Mapa EJA: ajuste manual fixo para "Nunca Compareceram"
-- Rode isto no SQL Editor do Supabase.
--
-- Alunos que saíram por N COM (nunca compareceram) e depois somem dos
-- relatórios seguintes da SED não têm mais como ser reconstituídos como
-- registros de Aluno de verdade (perdemos nome/RA/data de nascimento).
-- Este ajuste é um número fixo, lançado manualmente por turma, que soma
-- direto no Mapa EJA (Eliminação Geral / Faixa Etária) sem depender de
-- nenhum aluno cadastrado — como um "TOTAIS EJA I" que o SED ainda cobra,
-- mas que o próprio SED parou de detalhar.

ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS ajuste_nunca_compareceram INTEGER DEFAULT 0;
ALTER TABLE "Turma" ADD COLUMN IF NOT EXISTS ajuste_faixa_nunca_compareceram TEXT DEFAULT '';

NOTIFY pgrst, 'reload schema';
