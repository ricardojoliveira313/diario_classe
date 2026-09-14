-- View de leitura mínima para a aba Censo Docentes 2026.
-- Expõe somente dados funcionais necessários ao cruzamento no frontend.

CREATE OR REPLACE VIEW public."ServidorCenso" AS
SELECT
  rf,
  nome,
  cargo,
  periodo,
  escola,
  ativo,
  turma_atribuida,
  sala_atribuida
FROM public."Servidor"
WHERE ativo = true;

GRANT SELECT ON public."ServidorCenso" TO anon, authenticated;
