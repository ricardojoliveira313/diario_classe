-- Marca quando o sexo de um aluno foi confirmado manualmente por um humano
-- (conferência avulsa, alerta "sexo pode estar trocado", ou definição manual
-- na divergência do Educacenso). Sem essa marca, "Aplicar sexo oficial" do
-- cruzamento Educacenso sobrescrevia essas correções toda vez que o admin
-- reenviava o arquivo, porque não tinha como saber que aquele aluno já tinha
-- sido revisado — mesmo quando o próprio Educacenso trazia um dado errado.

ALTER TABLE "Aluno"
  ADD COLUMN IF NOT EXISTS sexo_confirmado_manual BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN "Aluno".sexo_confirmado_manual IS
  'TRUE quando o sexo foi confirmado manualmente por um humano (conferência avulsa, alerta de sexo trocado, ou divergência do Educacenso) — nesse caso, "Aplicar sexo oficial" do cruzamento Educacenso não deve sobrescrever automaticamente.';

NOTIFY pgrst, 'reload schema';
