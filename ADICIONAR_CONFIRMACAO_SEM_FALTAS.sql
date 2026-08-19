-- Suporte ao botão "Registrar mês sem faltas" (BF — Frequência).
-- Distingue "diário ainda não conferido" (sem registro em Falta) de
-- "diário conferido, aluno sem nenhuma falta" (registro existe, com
-- estas colunas preenchidas) — nunca preenchidas automaticamente,
-- somente após confirmação humana explícita na tela.
ALTER TABLE "Falta"
  ADD COLUMN IF NOT EXISTS conferido_sem_faltas boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_por        text,
  ADD COLUMN IF NOT EXISTS confirmado_em         timestamptz;

NOTIFY pgrst, 'reload schema';
