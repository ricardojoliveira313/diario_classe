-- Lista de Espera EJA: campo de telefone + granularidade por termo (1º a 4º)
-- Rode isto no SQL Editor do Supabase.

ALTER TABLE "ListaEsperaEja" ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Amplia o CHECK de "ciclo" para aceitar os termos, sem remover os valores
-- antigos (ALFA/POS/MULTI continuam usados noutras partes do sistema).
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = '"ListaEsperaEja"'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%ciclo%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "ListaEsperaEja" DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE "ListaEsperaEja" ADD CONSTRAINT "ListaEsperaEja_ciclo_check"
  CHECK (ciclo IN ('ALFA', 'POS', 'MULTI', 'TERMO1', 'TERMO2', 'TERMO3', 'TERMO4'));

NOTIFY pgrst, 'reload schema';
