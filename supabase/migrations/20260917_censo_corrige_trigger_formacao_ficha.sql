-- Corrige o trigger de sincronização automática de formação (ficha -> formacoes).
-- Aplicar manualmente no Supabase (SQL Editor), mesma rotina das migrations anteriores.
--
-- Problema encontrado (caso real: Andressa Souza da Silva, RF 58.978-0):
-- a lógica anterior combinava `dados->>'formacaoPrincipal'` (um campo de texto
-- solto) com `dados->'universidades'->>0` (sempre a primeira universidade da
-- lista) e com posições FIXAS de coluna (33/34) no array `academicoReferencia`
-- para achar início/término -- sem nenhuma garantia de que os três pedaços
-- pertencem à mesma formação quando a ficha do professor tem mais de um
-- curso/período registrado. Isso gerou um registro de curso, instituição e
-- data misturados de blocos diferentes da ficha.
--
-- Além disso, o registro criado automaticamente já nascia com
-- status_validacao = 'importado_confiavel', o que faz o restante do sistema
-- (montarSuperiores / montarPosEstruturada no frontend) tratá-lo como fonte
-- fidedigna pronta para pré-preencher o formulário oficial do Censo sem
-- nenhuma conferência humana antes.
--
-- Correção: o trigger passa a inserir sempre como status_validacao = 'pendente'
-- (nunca mais 'importado_confiavel' automaticamente). Um humano precisa
-- revisar e promover manualmente para 'validado' depois de conferir que
-- curso/universidade/datas realmente pertencem ao mesmo registro acadêmico.
-- Isso não corrige dados já misturados -- só impede que o mesmo tipo de erro
-- volte a se apresentar como "confiável" sem revisão.

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

  -- Nunca sobrescreve nem duplica quando já existe QUALQUER formação
  -- estruturada para o profile (validada, pendente ou já importada por este
  -- trigger antes) -- evita empilhar sugestões conflitantes a cada nova
  -- gravação da ficha.
  if exists(select 1 from public.formacoes f where f.profile_id=v_profile) then
    return new;
  end if;

  insert into public.formacoes(profile_id,tipo,curso,universidade,rede_ensino,modalidade,inicio,termino,fonte,fonte_data,status_validacao,rf_snapshot,cpf_snapshot,verificado_em,observacao)
  values(
    v_profile,'',v_curso,v_universidade,v_rede,v_modalidade,v_inicio,v_termino,
    'ficha_cadastral_validada',new.fonte_timestamp,
    'pendente', -- antes: 'importado_confiavel'. Precisa de conferência humana antes de virar fonte fidedigna.
    regexp_replace(coalesce(new.rf,''),'\D','','g'),v_dados_cpf,null,
    'Sugestão automática a partir da ficha -- curso/universidade/datas podem vir de blocos diferentes quando o professor tem mais de uma formação registrada. Revisar manualmente antes de promover para validado.'
  );
  return new;
exception when others then return new;
end;
$$;

-- Não sobrescreve nada silenciosamente: registros já promovidos manualmente
-- para 'validado' continuam como estão. Só rebaixa os que este MESMO
-- trigger inseriu automaticamente como 'importado_confiavel' (fonte
-- 'ficha_cadastral_validada') e que nunca passaram por conferência humana
-- (verificado_em ainda igual à criação, nunca atualizado depois).
update public.formacoes
set status_validacao = 'pendente',
    observacao = coalesce(observacao,'') || ' [Rebaixado de importado_confiavel para pendente em 2026-09-17: revisão automática identificou risco de mistura de campos entre formações diferentes da mesma ficha.]'
where fonte = 'ficha_cadastral_validada'
  and status_validacao = 'importado_confiavel';

drop trigger if exists trg_censo_sync_formacao_ficha on public."CensoFichaServidor";
create trigger trg_censo_sync_formacao_ficha
after insert or update of dados,fonte_timestamp on public."CensoFichaServidor"
for each row execute function public.censo_sync_formacao_ficha_confiavel();
