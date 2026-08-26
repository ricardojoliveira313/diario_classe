-- Registra a data/hora e o usuário da última importação SED bem-sucedida,
-- para toda a escola (independente de qual computador importou) — em vez
-- de só no navegador de quem importou, como era antes.
--
-- Linha única (id fixo 'unica'): cada nova importação sobrescreve a
-- anterior via upsert, então a tabela nunca cresce.

CREATE TABLE IF NOT EXISTS "ControleImportacao" (
  id text PRIMARY KEY DEFAULT 'unica',
  importado_em timestamptz,
  importado_por text
);
