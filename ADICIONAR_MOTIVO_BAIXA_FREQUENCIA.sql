-- Adiciona o campo de motivo de baixa frequência (código oficial Bolsa Família/MEC)
-- ao lançamento mensal de faltas. Um código por aluno/mês/ano, resumindo o motivo
-- predominante das ausências daquele mês (ex.: "1a", "15i", "16a").
ALTER TABLE "Falta"
  ADD COLUMN IF NOT EXISTS motivo_baixa_frequencia text;
