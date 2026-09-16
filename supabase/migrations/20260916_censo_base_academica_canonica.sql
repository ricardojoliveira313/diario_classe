alter table public.formacoes add column if not exists fonte text;
alter table public.formacoes add column if not exists fonte_data timestamptz;
alter table public.formacoes add column if not exists status_validacao text not null default 'pendente';
alter table public.formacoes add column if not exists rf_snapshot text;
alter table public.formacoes add column if not exists cpf_snapshot text;
alter table public.formacoes add column if not exists area_oficial text;
alter table public.formacoes add column if not exists curso_oficial text;
alter table public.formacoes add column if not exists tipo_oficial text;
alter table public.formacoes add column if not exists instituicao_oficial text;
alter table public.formacoes add column if not exists uf_instituicao text;
alter table public.formacoes add column if not exists categoria_org text;
alter table public.formacoes add column if not exists copia_entregue_ue boolean;
alter table public.formacoes add column if not exists verificado_em timestamptz;
alter table public.formacoes add column if not exists observacao text;

update public.formacoes f
set fonte=coalesce(f.fonte,'estrutura_existente'),
    fonte_data=coalesce(f.fonte_data,f.created_at),
    status_validacao=case when f.status_validacao='pendente' then 'validado' else f.status_validacao end,
    rf_snapshot=coalesce(f.rf_snapshot,regexp_replace(coalesce(p.registro_funcional_rf,''),'\D','','g')),
    cpf_snapshot=coalesce(f.cpf_snapshot,regexp_replace(coalesce(p.cpf,''),'\D','','g')),
    verificado_em=coalesce(f.verificado_em,f.created_at)
from public.profiles p
where p.id=f.profile_id;

create unique index if not exists ux_formacoes_profile_curso_termino
on public.formacoes(profile_id, lower(coalesce(curso,'')), lower(coalesce(termino,'')));

create or replace view public."CensoFormacaoConsolidadaAtual" as
select f.id,f.profile_id,
  regexp_replace(coalesce(p.registro_funcional_rf,''),'\D','','g') rf,
  regexp_replace(coalesce(p.cpf,''),'\D','','g') cpf,
  p.nome,f.tipo,f.tipo_oficial,f.area_oficial,f.curso,
  coalesce(nullif(f.curso_oficial,''),f.curso) curso_para_censo,
  f.universidade,coalesce(nullif(f.instituicao_oficial,''),f.universidade) instituicao_para_censo,
  f.uf_instituicao,f.categoria_org,f.rede_ensino,f.modalidade,f.inicio,f.termino,
  f.copia_entregue_ue,f.fonte,f.fonte_data,f.status_validacao,f.verificado_em,f.observacao
from public.formacoes f
join public.profiles p on p.id=f.profile_id
where f.status_validacao in ('validado','importado_confiavel');

create or replace view public."CensoAcademicoStatusAtual" as
select p.id profile_id,
  regexp_replace(coalesce(p.registro_funcional_rf,''),'\D','','g') rf,
  regexp_replace(coalesce(p.cpf,''),'\D','','g') cpf,
  p.nome,
  case
    when exists(select 1 from public.formacoes f where f.profile_id=p.id and f.status_validacao in ('validado','importado_confiavel')) then 'estruturado'
    when exists(
      select 1 from public."CensoFichaServidor" c
      where c.ano=2026
        and regexp_replace(coalesce(c.rf,''),'\D','','g')=regexp_replace(coalesce(p.registro_funcional_rf,''),'\D','','g')
        and c.dados ? 'formacaoPrincipal'
        and (c.dados->'_origem_ficha_importada' is null or (
          regexp_replace(coalesce((c.dados->'_origem_ficha_importada')->>'cpf',''),'\D','','g')=regexp_replace(coalesce(c.dados->>'cpf',''),'\D','','g')
          and coalesce((c.dados->'_origem_ficha_importada')->>'dataNascimento','')=coalesce(c.dados->>'dataNascimento','')
        ))
    ) then 'ficha_confiavel_disponivel'
    when exists(select 1 from public."CensoFichaServidor" c where c.ano=2026 and regexp_replace(coalesce(c.rf,''),'\D','','g')=regexp_replace(coalesce(p.registro_funcional_rf,''),'\D','','g') and c.dados->'_origem_ficha_importada' is not null) then 'bloqueado_identidade'
    else 'sem_fonte_academica'
  end status_academico
from public.profiles p;

create or replace view public."CensoAcademicoPendenciaAtual" as
select * from public."CensoAcademicoStatusAtual" where status_academico<>'estruturado';

create or replace function public.censo_sync_formacao_ficha_confiavel()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_profile uuid; v_origem jsonb; v_curso text; v_universidade text; v_inicio text; v_termino text;
  v_rede text; v_modalidade text; v_dados_cpf text; v_dados_nasc text; v_origem_cpf text; v_origem_nasc text;
begin
  if new.ano<>2026 then return new; end if;
  v_curso:=nullif(trim(coalesce(new.dados->>'formacaoPrincipal','')),'');
  if v_curso is null then return new; end if;
  v_origem:=new.dados->'_origem_ficha_importada';
  v_dados_cpf:=regexp_replace(coalesce(new.dados->>'cpf',''),'\D','','g');
  v_dados_nasc:=coalesce(new.dados->>'dataNascimento','');
  if v_origem is not null then
    v_origem_cpf:=regexp_replace(coalesce(v_origem->>'cpf',''),'\D','','g');
    v_origem_nasc:=coalesce(v_origem->>'dataNascimento','');
    if (v_origem_cpf<>'' and v_dados_cpf<>'' and v_origem_cpf<>v_dados_cpf)
       or (v_origem_nasc<>'' and v_dados_nasc<>'' and v_origem_nasc<>v_dados_nasc) then return new; end if;
  end if;

  select p.id into v_profile from public.profiles p
  where regexp_replace(coalesce(p.registro_funcional_rf,''),'\D','','g')=regexp_replace(coalesce(new.rf,''),'\D','','g')
    and (v_dados_cpf='' or regexp_replace(coalesce(p.cpf,''),'\D','','g')=v_dados_cpf)
  order by p.updated_at desc limit 1;
  if v_profile is null then return new; end if;

  v_universidade:=new.dados->'universidades'->>0;
  select e->>'valor' into v_inicio from jsonb_array_elements(coalesce(new.dados->'academicoReferencia','[]'::jsonb)) e where e->>'coluna'='33' limit 1;
  select e->>'valor' into v_termino from jsonb_array_elements(coalesce(new.dados->'academicoReferencia','[]'::jsonb)) e where e->>'coluna'='34' limit 1;
  select e->>'valor' into v_rede from jsonb_array_elements(coalesce(new.dados->'academicoReferencia','[]'::jsonb)) e where e->>'coluna'='38' limit 1;
  select e->>'valor' into v_modalidade from jsonb_array_elements(coalesce(new.dados->'academicoReferencia','[]'::jsonb)) e where e->>'coluna'='39' limit 1;

  if exists(select 1 from public.formacoes f where f.profile_id=v_profile and f.status_validacao in ('validado','importado_confiavel')) then
    return new;
  end if;

  insert into public.formacoes(profile_id,tipo,curso,universidade,rede_ensino,modalidade,inicio,termino,fonte,fonte_data,status_validacao,rf_snapshot,cpf_snapshot,verificado_em,observacao)
  values(v_profile,'',v_curso,v_universidade,v_rede,v_modalidade,v_inicio,v_termino,'ficha_cadastral_validada',new.fonte_timestamp,'importado_confiavel',regexp_replace(coalesce(new.rf,''),'\D','','g'),v_dados_cpf,now(),'Importado automaticamente apenas após validação de identidade da ficha histórica.');
  return new;
exception when others then return new;
end;
$$;

drop trigger if exists trg_censo_sync_formacao_ficha on public."CensoFichaServidor";
create trigger trg_censo_sync_formacao_ficha
after insert or update of dados,fonte_timestamp on public."CensoFichaServidor"
for each row execute function public.censo_sync_formacao_ficha_confiavel();