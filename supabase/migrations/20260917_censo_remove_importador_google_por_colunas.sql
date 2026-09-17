-- Remove o importador acadêmico antigo que lia a planilha Google por posições
-- fixas de coluna e podia inserir formações como importado_confiavel.
--
-- Auditoria em 17/09/2026 confirmou que:
-- - não há trigger chamando censo_sincronizar_ficha_google();
-- - não há referência no código atual do repositório;
-- - censo_csv_fields() e censo_norm_acad() só eram auxiliares desse fluxo.
--
-- A fonte bruta/histórica continua preservada; apenas o mecanismo inseguro de
-- promoção automática é removido.

drop function if exists public.censo_sincronizar_ficha_google();
drop function if exists public.censo_csv_fields(text);
drop function if exists public.censo_norm_acad(text);
