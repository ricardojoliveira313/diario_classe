-- Rastreia se o lançamento de frequência foi feito dia a dia (dado real de
-- calendário) ou pelo Lançamento Rápido (totais digitados, distribuídos
-- artificialmente nos primeiros dias do mês pela função diasFromCounts em
-- Faltas.tsx só para fins de contagem — não são datas reais). Necessário
-- para o Mapa de risco de NCOM no Painel Analítico não confundir uma
-- sequência artificial com faltas consecutivas reais.

ALTER TABLE "Falta" ADD COLUMN IF NOT EXISTS origem_frequencia text;
