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
create index if not exists censo_auth_ip_criado_idx
  on public."CensoAuthTentativa" (ip_hash, criado_em desc);

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

-- Credencial isolada do Censo. Ela é copiada uma única vez do hash atual do
-- administrador autorizado. Depois disso, alterações na tabela Usuario não
-- alteram automaticamente a credencial deste canal sensível.
create table if not exists public."CensoAcesso" (
  usuario text primary key,
  senha_hash text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public."CensoAcesso" enable row level security;
revoke all on table public."CensoAcesso" from anon, authenticated;

insert into public."CensoAcesso"(usuario, senha_hash)
select lower(trim(u.nome)), u.senha
from public."Usuario" u
where lower(trim(u.nome)) = 'ricojoliveira'
  and u.perfil = 'admin'
on conflict (usuario) do nothing;

create or replace function public.verificar_login_censo(p_nome text, p_senha text, p_ip_hash text)
returns table(nome text, perfil text, bloqueado boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_usuario text := lower(trim(coalesce(p_nome,'')));
  v_ip text := left(coalesce(nullif(trim(p_ip_hash),''),'sem-ip'),128);
  v_falhas_usuario integer;
  v_falhas_ip integer;
  v_ok boolean := false;
begin
  select count(*)::integer into v_falhas_usuario
  from public."CensoAuthTentativa"
  where usuario = v_usuario
    and sucesso = false
    and criado_em >= now() - interval '15 minutes';

  select count(*)::integer into v_falhas_ip
  from public."CensoAuthTentativa"
  where ip_hash = v_ip
    and sucesso = false
    and criado_em >= now() - interval '15 minutes';

  if v_falhas_usuario >= 5 or v_falhas_ip >= 10 then
    return query select null::text, null::text, true;
    return;
  end if;

  select exists(
    select 1
    from public."CensoAcesso" a
    where a.usuario = v_usuario
      and a.ativo = true
      and a.senha_hash = extensions.crypt(p_senha, a.senha_hash)
  ) into v_ok;

  insert into public."CensoAuthTentativa"(usuario, ip_hash, sucesso)
  values (v_usuario, v_ip, v_ok);

  if v_ok then
    return query select v_usuario, 'admin'::text, false;
  else
    return query select null::text, null::text, false;
  end if;
end;
$function$;

revoke all on function public.verificar_login_censo(text,text,text) from public, anon, authenticated;
grant execute on function public.verificar_login_censo(text,text,text) to service_role;
