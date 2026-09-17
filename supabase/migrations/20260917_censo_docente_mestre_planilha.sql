create table if not exists public."CensoDocenteMestre" (
  ano integer not null default 2026,
  rf text not null,
  nome text not null,
  fonte_arquivo text not null,
  fonte_timestamp timestamptz,
  dados jsonb not null default '{}'::jsonb,
  importado_em timestamptz not null default now(),
  primary key (ano, rf)
);

alter table public."CensoDocenteMestre" enable row level security;
revoke all on table public."CensoDocenteMestre" from anon, authenticated;

comment on table public."CensoDocenteMestre" is
  'Base permanente importada da planilha limpa Banco_Mestre_Censo_Docentes_2026.xlsx; acesso exclusivo pelas Edge Functions com service role.';

create index if not exists idx_censo_docente_mestre_nome
  on public."CensoDocenteMestre" (ano, nome);
