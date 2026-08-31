-- Salva o resultado do cruzamento SED × Educacenso (aba Educacenso), pra não
-- se perder ao trocar de aba ou fechar o navegador — antes ficava só em
-- memória do React e sumia na primeira navegação.
--
-- Uma linha por ano letivo (upsert por "ano" sobrescreve o cruzamento
-- anterior daquele ano quando um novo é feito).

CREATE TABLE IF NOT EXISTS "CruzamentoEducacenso" (
  ano INTEGER PRIMARY KEY,
  data_corte TEXT,
  nome_arquivo TEXT,
  resultado JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "CruzamentoEducacenso" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_app_CruzamentoEducacenso" ON "CruzamentoEducacenso";
CREATE POLICY "permitir_app_CruzamentoEducacenso" ON "CruzamentoEducacenso"
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
