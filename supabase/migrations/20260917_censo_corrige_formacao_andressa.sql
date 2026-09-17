-- Correção definitiva, em transação única, do registro de formação da
-- professora Andressa Souza da Silva (RF 58.978-0, profile_id
-- 1d76dba8-c36f-4344-be8c-f52276e4690a).
--
-- Histórico do problema: o registro original tinha curso "Química formação
-- de professor" + instituição "Universidade Metropolitana de Santos" +
-- término "12/2019" -- dado de outra formação/pessoa misturado. Corrigido
-- aos poucos por engano (vários UPDATEs parciais no chat), deixando colunas
-- residuais inconsistentes (uf_instituicao/categoria_org antigos junto com
-- curso já corrigido). Esta migration substitui tudo isso por uma única
-- operação, verificável, que não depende de nenhum UPDATE anterior ter
-- rodado certo.

begin;

-- Se por algum motivo o id conhecido não existir mais (linha apagada ou
-- nunca criada), este INSERT ... ON CONFLICT garante que ela exista com o
-- dado correto de qualquer forma, sem duplicar.
insert into "formacoes" (
  id, profile_id, tipo, curso, universidade,
  tipo_oficial, area_oficial, curso_oficial,
  instituicao_oficial, uf_instituicao, categoria_org,
  inicio, termino, rede_ensino, modalidade, copia_entregue_ue,
  fonte, status_validacao, observacao
) values (
  '12ca5c10-f2bc-47cf-9ee2-892df9301bca',
  '1d76dba8-c36f-4344-be8c-f52276e4690a',
  'Licenciatura', 'Pedagogia', null,
  'Licenciatura', 'Educação', 'Pedagogia',
  null, null, null,
  null, null, null, null, false,
  'conferencia_manual_confirmada', 'validado',
  'Curso (Pedagogia) confirmado pela ficha real da professora em 17/09/2026. Instituição, UF, Categoria, Início e Ano de conclusão ficam em branco propositalmente -- o registro original misturava dado de outra formação, e a data de conclusão era incompatível com a idade dela. Preencher manualmente após confirmar com a professora.'
)
on conflict (id) do update set
  profile_id = excluded.profile_id,
  tipo = excluded.tipo,
  curso = excluded.curso,
  universidade = excluded.universidade,
  tipo_oficial = excluded.tipo_oficial,
  area_oficial = excluded.area_oficial,
  curso_oficial = excluded.curso_oficial,
  instituicao_oficial = excluded.instituicao_oficial,
  uf_instituicao = excluded.uf_instituicao,
  categoria_org = excluded.categoria_org,
  inicio = excluded.inicio,
  termino = excluded.termino,
  rede_ensino = excluded.rede_ensino,
  modalidade = excluded.modalidade,
  copia_entregue_ue = excluded.copia_entregue_ue,
  fonte = excluded.fonte,
  status_validacao = excluded.status_validacao,
  observacao = excluded.observacao;

-- Verificação: se isso não devolver exatamente 1 linha com curso='Pedagogia'
-- e status_validacao='validado', a transação inteira é revertida --
-- garantindo que nunca fica um estado parcial/quebrado no banco.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from "formacoes"
  where profile_id = '1d76dba8-c36f-4344-be8c-f52276e4690a'
    and curso = 'Pedagogia'
    and status_validacao = 'validado';
  if v_count <> 1 then
    raise exception 'Verificação falhou: esperava 1 registro Pedagogia/validado para a Andressa, encontrou %', v_count;
  end if;
end $$;

commit;

-- Confirmação final para conferir visualmente depois de rodar:
select id, tipo, curso, tipo_oficial, area_oficial, instituicao_oficial,
       uf_instituicao, categoria_org, inicio, termino, status_validacao
from "formacoes"
where profile_id = '1d76dba8-c36f-4344-be8c-f52276e4690a';
