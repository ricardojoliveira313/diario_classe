create table if not exists public."CensoProfessorConvite" (
  id uuid primary key default gen_random_uuid(),
  ano integer not null default 2026,
  rf text not null,
  nome text not null,
  turma text,
  periodo text,
  token_hash text not null unique,
  campos jsonb not null default '[]'::jsonb,
  respostas jsonb not null default '{}'::jsonb,
  status text not null default 'aberto' check (status in ('aberto','respondido','conferido','cancelado','expirado')),
  criado_por text not null default '',
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  respondido_em timestamptz,
  conferido_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint censo_professor_convite_rf_check check (length(regexp_replace(rf, '\D', '', 'g')) between 6 and 8)
);

create index if not exists censo_professor_convite_rf_status_idx
  on public."CensoProfessorConvite" (ano, rf, status, criado_em desc);

create index if not exists censo_professor_convite_expira_idx
  on public."CensoProfessorConvite" (expira_em);

alter table public."CensoProfessorConvite" enable row level security;

revoke all on table public."CensoProfessorConvite" from public, anon, authenticated;
grant select, insert, update, delete on table public."CensoProfessorConvite" to service_role;

comment on table public."CensoProfessorConvite" is
  'Convites individuais do Censo Docentes. O token público é armazenado apenas como SHA-256; respostas ficam em staging até conferência administrativa.';
