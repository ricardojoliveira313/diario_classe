-- Base mínima de leitura para validar os vínculos do Censo Docentes
-- contra a folha de frequência oficial da unidade.

create table if not exists public."CensoFrequenciaServidor" (
  ano integer not null,
  mes integer not null,
  rf text not null,
  nome text not null,
  categoria text,
  lotacao text,
  cargo text,
  carga_horaria integer,
  local_trabalho text,
  pagina_pdf integer,
  atualizado_em timestamptz not null default now(),
  primary key (ano, mes, rf)
);

alter table public."CensoFrequenciaServidor" enable row level security;

drop policy if exists "censo_frequencia_leitura" on public."CensoFrequenciaServidor";
create policy "censo_frequencia_leitura"
on public."CensoFrequenciaServidor"
for select
to anon, authenticated
using (true);

grant select on public."CensoFrequenciaServidor" to anon, authenticated;

create index if not exists "idx_censo_freq_ano_mes"
  on public."CensoFrequenciaServidor" (ano, mes);

create index if not exists "idx_censo_freq_nome"
  on public."CensoFrequenciaServidor" (nome);
