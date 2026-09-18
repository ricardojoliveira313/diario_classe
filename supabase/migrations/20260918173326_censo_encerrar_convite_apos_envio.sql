create or replace function public.censo_encerrar_convite_apos_envio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('enviado', 'confirmado_secretaria') then
    update public."CensoProfessorConvite"
       set status = 'cancelado',
           atualizado_em = now()
     where ano = extract(year from coalesce(new.criado_em, now()))::int
       and regexp_replace(coalesce(rf, ''), '\D', '', 'g') = regexp_replace(coalesce(new.rf, ''), '\D', '', 'g')
       and status in ('aberto', 'respondido');
  end if;
  return new;
end;
$$;

revoke all on function public.censo_encerrar_convite_apos_envio() from public, anon, authenticated;
grant execute on function public.censo_encerrar_convite_apos_envio() to service_role;

drop trigger if exists trg_censo_encerrar_convite_apos_envio on public."CensoEnvioLog";
create trigger trg_censo_encerrar_convite_apos_envio
after insert or update of status on public."CensoEnvioLog"
for each row
execute function public.censo_encerrar_convite_apos_envio();

update public."CensoProfessorConvite" c
   set status = 'cancelado',
       atualizado_em = now()
 where c.status in ('aberto', 'respondido')
   and exists (
     select 1
       from public."CensoEnvioLog" e
      where e.status in ('enviado', 'confirmado_secretaria')
        and extract(year from e.criado_em)::int = c.ano
        and regexp_replace(coalesce(e.rf, ''), '\D', '', 'g') = regexp_replace(coalesce(c.rf, ''), '\D', '', 'g')
   );