-- Camada intermediária: Perfil + Educacenso + Ficha + formações estruturadas.
-- Objetivo: consolidar as fontes antes de mapear os campos para o formulário oficial.

create or replace view public."CensoCadastroConsolidadoAtual" as
with ficha as (
  select distinct on (regexp_replace(rf,'\D','','g'))
    regexp_replace(rf,'\D','','g') as rf_key,
    fonte_timestamp,
    metodo_match,
    dados
  from public."CensoFichaServidor"
  where ano = 2026
  order by regexp_replace(rf,'\D','','g'), fonte_timestamp desc nulls last
), forms as (
  select
    profile_id,
    jsonb_agg(
      jsonb_build_object(
        'tipo', tipo,
        'curso', curso,
        'universidade', universidade,
        'rede_ensino', rede_ensino,
        'modalidade', modalidade,
        'inicio', inicio,
        'termino', termino,
        'fonte', 'formacoes_estruturadas'
      ) order by created_at
    ) as formacoes
  from public.formacoes
  group by profile_id
), base as (
  select
    p.id as profile_id,
    regexp_replace(p.registro_funcional_rf,'\D','','g') as rf,
    p.nome,
    regexp_replace(p.cpf,'\D','','g') as cpf,
    p.data_nascimento,
    p.email,
    p.telefone_celular_1,
    p.telefone_celular_2,
    p.telefone_fixo,
    p.endereco,
    p.bairro,
    p.cep,
    p.municipio,
    p.estado,
    p.etnia,
    p.nome_mae,
    p.nome_pai,
    p.municipio_nascimento,
    p.updated_at as perfil_atualizado_em,
    e.identificacao_unica,
    e.nome as educacenso_nome,
    e.data_nascimento as educacenso_data_nascimento,
    e.nacionalidade_oficial,
    e.cor_raca_oficial,
    e.sexo,
    e.deficiencia_raw,
    e.grau_formacao_oficial,
    e.pos_graduacao_raw,
    e.formacao_complementacao_raw,
    e.cursos_especificos_raw,
    e.referencia_data as educacenso_referencia_data,
    e.arquivo_nome as educacenso_arquivo_nome,
    f.fonte_timestamp as ficha_atualizada_em,
    f.metodo_match as ficha_metodo_match,
    f.dados as ficha_dados,
    coalesce(fr.formacoes, '[]'::jsonb) as formacoes_estruturadas
  from public.profiles p
  left join public."EducacensoProfissionalAtual" e
    on regexp_replace(e.cpf,'\D','','g') = regexp_replace(p.cpf,'\D','','g')
  left join ficha f
    on f.rf_key = regexp_replace(p.registro_funcional_rf,'\D','','g')
  left join forms fr
    on fr.profile_id = p.id
)
select
  base.*,
  (
    coalesce(regexp_replace(base.ficha_dados->>'cpf','\D','','g'),'') in ('', base.cpf)
    and (
      coalesce(base.ficha_dados->>'dataNascimento','') = ''
      or to_char(
        case
          when base.ficha_dados->>'dataNascimento' ~ '^\d{2}/\d{2}/\d{4}$' then to_date(base.ficha_dados->>'dataNascimento','DD/MM/YYYY')
          when base.ficha_dados->>'dataNascimento' ~ '^\d{4}-\d{2}-\d{2}' then (base.ficha_dados->>'dataNascimento')::date
          else null
        end,
        'YYYYMMDD'
      ) = to_char(
        case
          when base.data_nascimento ~ '^\d{2}/\d{2}/\d{4}$' then to_date(base.data_nascimento,'DD/MM/YYYY')
          when base.data_nascimento ~ '^\d{4}-\d{2}-\d{2}' then base.data_nascimento::date
          else null
        end,
        'YYYYMMDD'
      )
    )
    and not (
      upper(coalesce(base.ficha_dados->>'_fonte_cadastro_atual','')) = 'PROFILES'
      and base.ficha_dados ? '_origem_ficha_importada'
      and coalesce(regexp_replace(base.ficha_dados#>>'{_origem_ficha_importada,cpf}','\D','','g'),'') not in ('', base.cpf)
    )
    and coalesce(base.ficha_dados->>'_academico_bloqueado','') = ''
  ) as academico_ficha_confiavel,
  jsonb_build_object(
    'identidade', 'perfil + Educacenso por CPF',
    'dados_pessoais', 'perfil mais recente',
    'grau_formacao', case when coalesce(base.grau_formacao_oficial,'') <> '' then 'Educacenso' else 'local' end,
    'formacoes', case when jsonb_array_length(base.formacoes_estruturadas) > 0 then 'formacoes estruturadas' else 'pendente de consolidação' end,
    'ficha_timestamp', base.ficha_atualizada_em,
    'perfil_timestamp', base.perfil_atualizado_em,
    'educacenso_referencia', base.educacenso_referencia_data
  ) as fontes_consolidadas
from base;

-- André Pezzotti: formação confirmada na ficha de 26/02/2025 fornecida para conferência.
-- O tipo fica vazio na fonte local; a tela resolve o tipo pela combinação única do catálogo oficial
-- do curso "Artes formação de professor", evitando inventar Bacharelado/Licenciatura no dado de origem.
insert into public.formacoes (profile_id,tipo,curso,universidade,rede_ensino,modalidade,inicio,termino)
select p.id,'','Artes formação de professor','FACULDADES INTEGRADAS CORAÇÃO DE JESUS','Privada','Presencial','07/02/2013','22/12/2015'
from public.profiles p
where regexp_replace(p.cpf,'\D','','g')='33446003894'
  and regexp_replace(p.registro_funcional_rf,'\D','','g')='612340'
  and not exists (
    select 1
    from public.formacoes f
    where f.profile_id=p.id
      and upper(coalesce(f.curso,''))=upper('Artes formação de professor')
  );
