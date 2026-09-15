-- Integração direta segura do Censo Docentes
-- Aplicada no Supabase em 14/09/2026.

alter table public."CensoSessaoToken"
  add column if not exists token_hash text;

delete from public."CensoSessaoToken";

create unique index if not exists censo_sessao_token_hash_uidx
  on public."CensoSessaoToken" (token_hash)
  where token_hash is not null;
create index if not exists censo_sessao_usuario_expira_idx
  on public."CensoSessaoToken" (usuario, expira_em);

create table if not exists public."CensoAuthTentativa" (
  id uuid primary key default gen_random_uuid(),
  usuario text not null,
  ip_hash text not null,
  sucesso boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public."CensoAuthTentativa" enable row level security;
create index if not exists censo_auth_usuario_criado_idx
  on public."CensoAuthTentativa" (usuario, criado_em desc);

alter table public."CensoEnvioLog"
  add column if not exists modalidade text,
  add column if not exists request_id uuid;
create unique index if not exists censo_envio_request_uidx
  on public."CensoEnvioLog" (request_id)
  where request_id is not null;
create index if not exists censo_envio_rf_modalidade_idx
  on public."CensoEnvioLog" (rf, modalidade, criado_em desc);

alter table public."CensoSessaoToken" enable row level security;
alter table public."CensoFichaServidor" enable row level security;
alter table public."CensoEnvioLog" enable row level security;

revoke all on table public."CensoSessaoToken" from anon, authenticated;
revoke all on table public."CensoFichaServidor" from anon, authenticated;
revoke all on table public."CensoEnvioLog" from anon, authenticated;
revoke all on table public."CensoAuthTentativa" from anon, authenticated;

create or replace function public.verificar_login_censo(p_nome text, p_senha text)
returns table(nome text, perfil text, bloqueado boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_usuario text := lower(trim(coalesce(p_nome,'')));
  v_falhas integer;
  v_nome text;
  v_perfil text;
begin
  select count(*)::integer into v_falhas
  from public."CensoAuthTentativa"
  where usuario = v_usuario
    and sucesso = false
    and criado_em >= now() - interval '15 minutes';

  if v_falhas >= 5 then
    return query select null::text, null::text, true;
    return;
  end if;

  select u.nome, u.perfil
    into v_nome, v_perfil
  from public."Usuario" u
  where lower(trim(u.nome)) = v_usuario
    and u.senha = extensions.crypt(p_senha, u.senha)
  limit 1;

  insert into public."CensoAuthTentativa"(usuario, ip_hash, sucesso)
  values (v_usuario, 'server-side', v_nome is not null);

  if v_nome is null then
    return query select null::text, null::text, false;
  else
    return query select v_nome, v_perfil, false;
  end if;
end;
$function$;

revoke all on function public.verificar_login_censo(text,text) from public, anon, authenticated;
grant execute on function public.verificar_login_censo(text,text) to service_role;
