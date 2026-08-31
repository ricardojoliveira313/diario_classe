-- Guarda também os dados lidos do arquivo oficial do Educacenso (já processados,
-- não o .xlsx bruto) junto do cruzamento salvo — sem isso, pra rodar o cruzamento
-- de novo (ex.: depois de uma correção no sistema) era preciso reimportar o
-- mesmo arquivo .xlsx de novo, mesmo ele já tendo sido lido antes.

ALTER TABLE "CruzamentoEducacenso" ADD COLUMN IF NOT EXISTS linhas_educ JSONB;

NOTIFY pgrst, 'reload schema';
