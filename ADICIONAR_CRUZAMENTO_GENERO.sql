-- Salva o cruzamento SED × Educacenso feito na aba Gênero (usado pra conferir
-- o campo Sexo) — sem isso, toda vez que a página era recarregada ou o
-- usuário trocava de aba, era preciso reimportar o mesmo arquivo do
-- Educacenso de novo pra ver a mesma lista de divergências.
--
-- Uma linha por ano letivo (upsert por "ano" sobrescreve o cruzamento
-- anterior daquele ano quando um novo é feito).

CREATE TABLE IF NOT EXISTS "CruzamentoGenero" (
  ano INTEGER PRIMARY KEY,
  nome_arquivo TEXT,
  resultado JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "CruzamentoGenero" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_app_CruzamentoGenero" ON "CruzamentoGenero";
CREATE POLICY "permitir_app_CruzamentoGenero" ON "CruzamentoGenero"
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
