-- Remove definitivamente a função antiga de sincronização automática
-- ficha -> formacoes. O trigger já foi removido pela migration anterior.
--
-- A função era SECURITY DEFINER e montava formação combinando texto solto,
-- primeira universidade e posições fixas do academicoReferencia. Mesmo sem
-- trigger, mantê-la exposta era desnecessário e aumentava a superfície de risco.

drop function if exists public.censo_sync_formacao_ficha_confiavel();
