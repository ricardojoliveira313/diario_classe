-- Auditoria Censo Docentes 2026 - 17/09/2026
--
-- Objetivos:
-- 1) impedir que blocos acadêmicos históricos de outra identidade sejam
--    reutilizados no cadastro atual;
-- 2) preservar o JSON bruto em _origem_ficha_importada para auditoria;
-- 3) desativar o trigger automático ficha -> formacoes, que ainda montava
--    curso/instituição/datas por posições fixas e podia gerar sugestões
--    academicamente incoerentes;
-- 4) corrigir a graduação da Andressa com a evidência histórica repetida
--    em 3 fichas independentes: 02/2014 a 12/2018, Universidade
--    Metropolitana de Santos.

create or replace function public.censo_sanitiza_academico_origem()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_origem jsonb;
  v_atual_cpf text;
  v_origem_cpf text;
  v_atual_nasc text;
  v_origem_nasc text;
  v_atual_data_key text := '';
  v_origem_data_key text := '';
  v_match text[];
  v_diverge boolean := false;
begin
  if new.ano <> 2026 or new.dados is null then
    return new;
  end if;

  v_origem := new.dados -> '_origem_ficha_importada';
  if v_origem is null or v_origem = 'null'::jsonb then
    return new;
  end if;

  v_atual_cpf := regexp_replace(coalesce(new.dados ->> 'cpf', ''), '\D', '', 'g');
  v_origem_cpf := regexp_replace(coalesce(v_origem ->> 'cpf', ''), '\D', '', 'g');
  v_atual_nasc := trim(coalesce(new.dados ->> 'dataNascimento', ''));
  v_origem_nasc := trim(coalesce(v_origem ->> 'dataNascimento', ''));

  v_match := regexp_match(v_atual_nasc, '^(\d{4})-(\d{2})-(\d{2})');
  if v_match is not null then
    v_atual_data_key := v_match[1] || v_match[2] || v_match[3];
  else
    v_match := regexp_match(v_atual_nasc, '^(\d{1,2})/(\d{1,2})/(\d{4})');
    if v_match is not null then
      v_atual_data_key := v_match[3] || lpad(v_match[2], 2, '0') || lpad(v_match[1], 2, '0');
    end if;
  end if;

  v_match := regexp_match(v_origem_nasc, '^(\d{4})-(\d{2})-(\d{2})');
  if v_match is not null then
    v_origem_data_key := v_match[1] || v_match[2] || v_match[3];
  else
    v_match := regexp_match(v_origem_nasc, '^(\d{1,2})/(\d{1,2})/(\d{4})');
    if v_match is not null then
      v_origem_data_key := v_match[3] || lpad(v_match[2], 2, '0') || lpad(v_match[1], 2, '0');
    end if;
  end if;

  if v_atual_cpf <> '' and v_origem_cpf <> '' and v_atual_cpf <> v_origem_cpf then
    v_diverge := true;
  end if;

  if v_atual_data_key <> '' and v_origem_data_key <> '' and v_atual_data_key <> v_origem_data_key then
    v_diverge := true;
  end if;

  if v_diverge then
    new.dados := new.dados
      - 'formacaoPrincipal'
      - 'universidades'
      - 'posCursos'
      - 'posPossui'
      - 'mestradoPossui'
      - 'ensinoMedioMagisterio'
      - 'academicoReferencia';

    new.dados := new.dados || jsonb_build_object(
      '_academico_bloqueado', 'identidade divergente entre origem acadêmica histórica e cadastro atual',
      '_academico_bloqueado_em', now()::text
    );
  end if;

  return new;
end;
$$;

-- A sanitização precisa acontecer antes de qualquer consumidor/trigger ler o JSON.
drop trigger if exists trg_censo_sanitiza_academico_origem on public."CensoFichaServidor";
create trigger trg_censo_sanitiza_academico_origem
before insert or update of dados on public."CensoFichaServidor"
for each row execute function public.censo_sanitiza_academico_origem();

-- O sincronizador antigo permanece disponível apenas como código histórico,
-- mas deixa de executar automaticamente porque a associação por posições fixas
-- não é suficientemente segura para promover ou sugerir uma formação.
drop trigger if exists trg_censo_sync_formacao_ficha on public."CensoFichaServidor";

-- Reprocessa somente os registros 2026 que têm origem histórica preservada.
-- O BEFORE trigger acima remove os campos acadêmicos apenas quando CPF e/ou
-- nascimento da origem divergem do cadastro atual. O JSON bruto de origem
-- continua preservado em _origem_ficha_importada.
update public."CensoFichaServidor"
set dados = dados
where ano = 2026
  and dados ? '_origem_ficha_importada';

-- Corrige a graduação da Andressa a partir de evidência repetida em 3 de 4
-- fichas cadastrais independentes: 02/2014 a 12/2018 e Universidade
-- Metropolitana de Santos. A atualização é localizada pelo RF + Pedagogia,
-- sem depender de UUID gerado.
update public.formacoes f
set inicio = '02/2014',
    termino = '12/2018',
    universidade = 'Universidade Metropolitana de Santos',
    instituicao_oficial = 'Universidade Metropolitana de Santos',
    fonte = 'conferencia_historica_multiplas_fichas',
    verificado_em = now(),
    observacao = 'Pedagogia: período 02/2014-12/2018 e Universidade Metropolitana de Santos corroborados por repetição em 3 de 4 fichas cadastrais independentes (2024, fev/2026 e mai/2026). Corrigido em 17/09/2026 após auditoria da linha do tempo; não usar o antigo 2010 nem associação por posição fixa de coluna.'
from public.profiles p
where p.id = f.profile_id
  and regexp_replace(coalesce(p.registro_funcional_rf, ''), '\D', '', 'g') = '589780'
  and lower(coalesce(nullif(f.curso_oficial, ''), f.curso, '')) = 'pedagogia'
  and f.status_validacao = 'validado';
