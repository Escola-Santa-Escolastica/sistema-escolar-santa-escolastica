-- =====================================================================
-- Etapa 2 · Frequência diária
--
-- - calendario_dias: feriados, recesso e dias sem aula do ano letivo.
--   Dia letivo = dia útil entre o início e o fim das aulas que não está
--   marcado aqui como feriado, recesso ou sem aula.
-- - chamadas + frequencias: uma chamada por turma e dia; uma linha por
--   aluno (presente ou falta). Só se grava pela função salvar_chamada.
-- - justificativas_falta: aviso prévio da família (vale na hora) ou
--   justificativa depois da falta (a gestão analisa).
--
-- Regras (LDB, art. 31): pré-escola com 200 dias e 800 horas por ano e
-- frequência mínima de 60% das horas. Falta justificada continua sendo
-- ausência; a justificativa só evita os alertas de "falta sem aviso".
-- =====================================================================

-- ---------- Configuração -------------------------------------------------

alter table public.escola
  add column frequencia_alerta_pct int not null default 75 check (frequencia_alerta_pct between 60 and 100),
  add column faltas_seguidas_alerta int not null default 3 check (faltas_seguidas_alerta between 2 and 10),
  add column chamada_editavel_ate time not null default '18:00';

comment on column public.escola.frequencia_alerta_pct is 'Avisar quando a frequência do aluno no ano ficar abaixo deste %. O mínimo legal é 60%.';
comment on column public.escola.faltas_seguidas_alerta is 'Avisar a partir de quantas faltas seguidas sem aviso nem justificativa.';
comment on column public.escola.chamada_editavel_ate is 'Até que horas o professor pode corrigir a chamada do dia. Depois, só a gestão.';

-- Data e hora "da escola" (o servidor roda em UTC).
-- Só para testes automatizados: um superusuário pode simular o dia e a hora
-- com "alter database ... set app.hoje_simulado = '2027-03-17'" (e
-- app.agora_simulada). Usuários do sistema não conseguem mudar isso.
create or replace function public.hoje_escola()
returns date
language sql stable set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.hoje_simulado', true), '')::date,
                  (now() at time zone 'America/Sao_Paulo')::date);
$$;

create or replace function public.agora_escola()
returns time
language sql stable set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.agora_simulada', true), '')::time,
                  (now() at time zone 'America/Sao_Paulo')::time);
$$;

-- ---------- Calendário letivo --------------------------------------------

create type public.tipo_dia as enum ('feriado', 'recesso', 'sem_aula', 'evento');

create table public.calendario_dias (
  id uuid primary key default gen_random_uuid(),
  ano_letivo_id uuid not null references public.anos_letivos (id) on delete cascade,
  data date not null,
  tipo public.tipo_dia not null,
  descricao text not null check (length(btrim(descricao)) > 0),
  created_at timestamptz not null default now(),
  unique (ano_letivo_id, data)
);

-- Dia letivo do ano informado (padrão: o ano ativo).
create or replace function public.e_dia_letivo(p_data date, p_ano uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select extract(isodow from p_data) < 6
     and exists (
       select 1 from public.anos_letivos a
       where a.id = coalesce(p_ano, public.ano_letivo_ativo())
         and (a.inicio is null or p_data >= a.inicio)
         and (a.fim is null or p_data <= a.fim))
     and not exists (
       select 1 from public.calendario_dias d
       where d.ano_letivo_id = coalesce(p_ano, public.ano_letivo_ativo())
         and d.data = p_data
         and d.tipo in ('feriado', 'recesso', 'sem_aula'));
$$;

-- ---------- Chamada e frequência -----------------------------------------

create type public.situacao_frequencia as enum ('presente', 'falta');

create table public.chamadas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas (id),
  data date not null,
  registrada_por uuid references auth.users (id) default auth.uid(),
  registrada_em timestamptz not null default now(),
  atualizada_por uuid references auth.users (id),
  atualizada_em timestamptz,
  unique (turma_id, data)
);
create index chamadas_data on public.chamadas (data);

create table public.frequencias (
  id uuid primary key default gen_random_uuid(),
  chamada_id uuid not null references public.chamadas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id),
  situacao public.situacao_frequencia not null,
  unique (chamada_id, aluno_id)
);
create index frequencias_aluno on public.frequencias (aluno_id);

create type public.status_justificativa as enum ('pendente', 'aceita', 'recusada');

create table public.justificativas_falta (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id),
  data date not null,
  motivo text not null check (motivo in ('doenca', 'familia', 'viagem', 'outro')),
  observacao text check (observacao is null or length(observacao) <= 500),
  aviso_previo boolean not null,           -- avisada antes da chamada do dia
  status public.status_justificativa not null,
  enviada_por uuid references auth.users (id) default auth.uid(),
  enviada_em timestamptz not null default now(),
  analisada_por uuid references auth.users (id),
  analisada_em timestamptz,
  unique (aluno_id, data)
);

-- O usuário é professor regente ou auxiliar da turma?
create or replace function public.minha_turma(p_turma uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.atribuicoes a
    where a.user_id = auth.uid() and a.ativo and a.turma_id = p_turma
      and a.papel in ('professor_regente', 'professor_especialista', 'auxiliar'));
$$;

create or replace function public.e_regente_da_turma(p_turma uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.atribuicoes a
    where a.user_id = auth.uid() and a.ativo and a.turma_id = p_turma and a.papel = 'professor_regente');
$$;

-- Quem pode gravar a chamada de uma turma num dia (e por quê não).
-- Gestão: qualquer dia letivo até hoje. Regente: só hoje, até o horário limite.
create or replace function public.motivo_bloqueio_chamada(p_turma uuid, p_data date)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_gestao boolean := public.e_gestao();
  v_ate time;
begin
  if not v_gestao and not public.e_regente_da_turma(p_turma) then
    return 'Seu perfil não pode fazer a chamada desta turma.';
  end if;
  if not exists (select 1 from public.turmas t where t.id = p_turma and t.ano_letivo_id = public.ano_letivo_ativo()) then
    return 'A turma não é do ano letivo ativo.';
  end if;
  if p_data > public.hoje_escola() then
    return 'Não dá para fazer a chamada de um dia que ainda não chegou.';
  end if;
  if not public.e_dia_letivo(p_data) then
    return format('%s não é dia letivo no calendário da escola.', to_char(p_data, 'DD/MM/YYYY'));
  end if;
  if not v_gestao then
    select chamada_editavel_ate into v_ate from public.escola;
    if p_data < public.hoje_escola() then
      return format('A chamada de %s só pode ser corrigida pela coordenação ou pela secretaria.', to_char(p_data, 'DD/MM'));
    end if;
    if public.agora_escola() >= v_ate then
      return format('Depois das %s a chamada só pode ser corrigida pela coordenação ou pela secretaria.', to_char(v_ate, 'HH24"h"MI'));
    end if;
  end if;
  return null;
end;
$$;

-- Grava (ou corrige) a chamada inteira: quem está em p_faltas faltou,
-- os demais alunos matriculados na turma estão presentes.
create or replace function public.salvar_chamada(p_turma uuid, p_data date, p_faltas uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_bloqueio text := public.motivo_bloqueio_chamada(p_turma, p_data);
  v_chamada uuid;
  v_alunos uuid[];
begin
  if v_bloqueio is not null then
    raise exception '%', v_bloqueio using errcode = 'P0001';
  end if;
  select coalesce(array_agg(m.aluno_id), '{}') into v_alunos
    from public.matriculas m
   where m.turma_id = p_turma and m.status = 'matriculado';
  if cardinality(v_alunos) = 0 then
    raise exception 'A turma ainda não tem alunos matriculados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(p_faltas, '{}')) f where f <> all (v_alunos)) then
    raise exception 'Há um aluno na lista de faltas que não é desta turma.' using errcode = 'P0001';
  end if;

  insert into public.chamadas (turma_id, data) values (p_turma, p_data)
  on conflict (turma_id, data) do update
    set atualizada_por = auth.uid(), atualizada_em = now()
  returning id into v_chamada;

  insert into public.frequencias (chamada_id, aluno_id, situacao)
  select v_chamada, a, case when a = any (coalesce(p_faltas, '{}')) then 'falta' else 'presente' end::public.situacao_frequencia
    from unnest(v_alunos) a
  on conflict (chamada_id, aluno_id) do update set situacao = excluded.situacao
    where public.frequencias.situacao is distinct from excluded.situacao;

  return v_chamada;
end;
$$;

-- Corrige um aluno num dia em que já houve chamada.
create or replace function public.marcar_frequencia(p_turma uuid, p_data date, p_aluno uuid, p_situacao public.situacao_frequencia)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_bloqueio text := public.motivo_bloqueio_chamada(p_turma, p_data);
  v_chamada uuid;
begin
  if v_bloqueio is not null then
    raise exception '%', v_bloqueio using errcode = 'P0001';
  end if;
  select id into v_chamada from public.chamadas where turma_id = p_turma and data = p_data;
  if v_chamada is null then
    raise exception 'Ainda não há chamada desta turma em %.', to_char(p_data, 'DD/MM') using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.matriculas m where m.turma_id = p_turma and m.aluno_id = p_aluno and m.status = 'matriculado') then
    raise exception 'O aluno não é desta turma.' using errcode = 'P0001';
  end if;
  insert into public.frequencias (chamada_id, aluno_id, situacao) values (v_chamada, p_aluno, p_situacao)
  on conflict (chamada_id, aluno_id) do update set situacao = excluded.situacao;
  update public.chamadas set atualizada_por = auth.uid(), atualizada_em = now() where id = v_chamada;
end;
$$;

-- ---------- Justificativas -----------------------------------------------

-- Família: avisa antes (vale na hora) ou justifica depois (gestão analisa).
-- Gestão: registra a justificativa já aceita.
create or replace function public.registrar_justificativa(p_aluno uuid, p_data date, p_motivo text, p_observacao text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_gestao boolean := public.e_gestao();
  v_familia boolean := public.e_responsavel_do_aluno(p_aluno);
  v_hoje date := public.hoje_escola();
  v_turma uuid;
  v_previo boolean;
  v_falta boolean;
  v_existente public.justificativas_falta;
  v_id uuid;
begin
  if not v_gestao and not v_familia then
    raise exception 'Seu perfil não pode justificar faltas deste aluno.' using errcode = 'P0001';
  end if;
  if p_motivo is null or p_motivo not in ('doenca', 'familia', 'viagem', 'outro') then
    raise exception 'Escolha o motivo da falta.' using errcode = 'P0001';
  end if;
  select m.turma_id into v_turma from public.matriculas m
   where m.aluno_id = p_aluno and m.ano_letivo_id = public.ano_letivo_ativo() and m.status = 'matriculado';
  if v_turma is null then
    raise exception 'O aluno não está matriculado numa turma neste ano.' using errcode = 'P0001';
  end if;
  if p_data > v_hoje + 60 then
    raise exception 'Dá para avisar faltas com até 60 dias de antecedência.' using errcode = 'P0001';
  end if;
  if not public.e_dia_letivo(p_data) then
    raise exception '% não é dia letivo no calendário da escola.', to_char(p_data, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;

  -- Aviso prévio: a chamada daquele dia ainda não foi feita.
  v_previo := p_data >= v_hoje and not exists (select 1 from public.chamadas c where c.turma_id = v_turma and c.data = p_data);
  if not v_previo then
    select exists (
      select 1 from public.frequencias f join public.chamadas c on c.id = f.chamada_id
       where f.aluno_id = p_aluno and c.data = p_data and f.situacao = 'falta') into v_falta;
    if not v_falta then
      raise exception 'Não há falta registrada em %.', to_char(p_data, 'DD/MM') using errcode = 'P0001';
    end if;
  end if;

  select * into v_existente from public.justificativas_falta where aluno_id = p_aluno and data = p_data;
  if found and v_existente.status = 'aceita' then
    raise exception 'A falta de % já está justificada.', to_char(p_data, 'DD/MM') using errcode = 'P0001';
  end if;
  if found and v_existente.status = 'pendente' and not v_gestao then
    raise exception 'A justificativa de % já foi enviada e está em análise.', to_char(p_data, 'DD/MM') using errcode = 'P0001';
  end if;

  insert into public.justificativas_falta (aluno_id, data, motivo, observacao, aviso_previo, status, analisada_por, analisada_em)
  values (p_aluno, p_data, p_motivo, nullif(btrim(p_observacao), ''), v_previo,
          case when v_gestao or v_previo then 'aceita' else 'pendente' end::public.status_justificativa,
          case when v_gestao then auth.uid() end, case when v_gestao then now() end)
  on conflict (aluno_id, data) do update set
    motivo = excluded.motivo, observacao = excluded.observacao, aviso_previo = excluded.aviso_previo,
    status = excluded.status, enviada_por = auth.uid(), enviada_em = now(),
    analisada_por = excluded.analisada_por, analisada_em = excluded.analisada_em
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.analisar_justificativa(p_id uuid, p_aceitar boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.e_gestao() then
    raise exception 'Só a coordenação, a secretaria ou a direção analisam justificativas.' using errcode = 'P0001';
  end if;
  update public.justificativas_falta
     set status = case when p_aceitar then 'aceita' else 'recusada' end::public.status_justificativa,
         analisada_por = auth.uid(), analisada_em = now()
   where id = p_id and status = 'pendente';
  if not found then
    raise exception 'Esta justificativa já foi analisada.' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------- Leitura: resumos ---------------------------------------------

-- Cada registro de frequência com a data, a turma e a justificativa (se houver).
create view public.vw_frequencia_dia with (security_invoker = true) as
select f.aluno_id, c.turma_id, t.ano_letivo_id, c.data, f.situacao,
       j.id as justificativa_id, j.status as justificativa_status, j.motivo as justificativa_motivo,
       j.observacao as justificativa_observacao, j.aviso_previo
  from public.frequencias f
  join public.chamadas c on c.id = f.chamada_id
  join public.turmas t on t.id = c.turma_id
  left join public.justificativas_falta j on j.aluno_id = f.aluno_id and j.data = c.data and j.status <> 'recusada';

-- Totais do aluno no ano e faltas seguidas sem aviso (contadas do dia mais recente para trás).
create view public.vw_frequencia_aluno with (security_invoker = true) as
with r as (
  select d.*, (d.situacao = 'falta' and d.justificativa_id is null) as sem_aviso,
         row_number() over (partition by d.aluno_id, d.ano_letivo_id order by d.data desc) as rn
    from public.vw_frequencia_dia d
)
select aluno_id, ano_letivo_id,
       count(*)::int as dias,
       count(*) filter (where situacao = 'presente')::int as presencas,
       count(*) filter (where situacao = 'falta')::int as faltas,
       count(*) filter (where situacao = 'falta' and justificativa_status = 'aceita')::int as justificadas,
       count(*) filter (where situacao = 'falta' and justificativa_status = 'pendente')::int as em_analise,
       round(100.0 * count(*) filter (where situacao = 'presente') / count(*), 1) as percentual,
       coalesce(min(rn) filter (where not sem_aviso) - 1, count(*))::int as faltas_seguidas_sem_aviso,
       max(data) as ultima_chamada
  from r
 group by aluno_id, ano_letivo_id;

-- ---------- Permissões ---------------------------------------------------

alter table public.calendario_dias enable row level security;
alter table public.chamadas enable row level security;
alter table public.frequencias enable row level security;
alter table public.justificativas_falta enable row level security;

create policy calendario_ler on public.calendario_dias for select to authenticated using (true);
create policy calendario_gerir on public.calendario_dias for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

-- Frequência: gestão, professores/auxiliares da turma do aluno e a família do aluno.
create policy frequencias_ler on public.frequencias for select to authenticated
  using (public.pode_ver_aluno(aluno_id));
create policy chamadas_ler on public.chamadas for select to authenticated
  using (public.e_gestao() or public.minha_turma(turma_id)
         or exists (select 1 from public.frequencias f where f.chamada_id = chamadas.id));
create policy justificativas_ler on public.justificativas_falta for select to authenticated
  using (public.pode_ver_aluno(aluno_id));
-- Gravação só pelas funções acima (sem políticas de insert/update/delete).

grant select on public.calendario_dias, public.chamadas, public.frequencias, public.justificativas_falta,
  public.vw_frequencia_dia, public.vw_frequencia_aluno to authenticated;
grant insert, update, delete on public.calendario_dias to authenticated;

revoke execute on function public.hoje_escola(), public.agora_escola(), public.e_dia_letivo(date, uuid),
  public.minha_turma(uuid), public.e_regente_da_turma(uuid), public.motivo_bloqueio_chamada(uuid, date),
  public.salvar_chamada(uuid, date, uuid[]), public.marcar_frequencia(uuid, date, uuid, public.situacao_frequencia),
  public.registrar_justificativa(uuid, date, text, text), public.analisar_justificativa(uuid, boolean)
  from anon, public;
grant execute on function public.hoje_escola(), public.agora_escola(), public.e_dia_letivo(date, uuid),
  public.minha_turma(uuid), public.e_regente_da_turma(uuid), public.motivo_bloqueio_chamada(uuid, date),
  public.salvar_chamada(uuid, date, uuid[]), public.marcar_frequencia(uuid, date, uuid, public.situacao_frequencia),
  public.registrar_justificativa(uuid, date, text, text), public.analisar_justificativa(uuid, boolean)
  to authenticated;

-- Auditoria das alterações (quem corrigiu a chamada, quem aceitou a justificativa)
create trigger chamadas_auditoria after insert or update or delete on public.chamadas
  for each row execute function public.tg_auditoria();
create trigger frequencias_auditoria after insert or update or delete on public.frequencias
  for each row execute function public.tg_auditoria();
create trigger justificativas_auditoria after insert or update or delete on public.justificativas_falta
  for each row execute function public.tg_auditoria();
create trigger calendario_auditoria after insert or update or delete on public.calendario_dias
  for each row execute function public.tg_auditoria();

-- ---------- Feriados nacionais de 2027 -----------------------------------
-- (feriados municipais de Itapecerica: a escola cadastra no Calendário)
insert into public.calendario_dias (ano_letivo_id, data, tipo, descricao)
select a.id, v.data::date, 'feriado', v.descricao
  from public.anos_letivos a
  cross join (values
    ('2027-01-01', 'Confraternização Universal'), ('2027-02-08', 'Carnaval'), ('2027-02-09', 'Carnaval'),
    ('2027-03-26', 'Sexta-feira Santa'), ('2027-04-21', 'Tiradentes'), ('2027-05-01', 'Dia do Trabalho'),
    ('2027-05-27', 'Corpus Christi'), ('2027-09-07', 'Independência do Brasil'),
    ('2027-10-12', 'Nossa Senhora Aparecida'), ('2027-11-02', 'Finados'),
    ('2027-11-15', 'Proclamação da República'), ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
    ('2027-12-25', 'Natal')) as v (data, descricao)
 where a.ano = 2027
on conflict (ano_letivo_id, data) do nothing;

revoke all on public.calendario_dias, public.chamadas, public.frequencias, public.justificativas_falta,
  public.vw_frequencia_dia, public.vw_frequencia_aluno from anon;
