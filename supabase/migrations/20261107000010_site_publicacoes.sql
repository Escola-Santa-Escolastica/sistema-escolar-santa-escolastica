-- =====================================================================
-- Etapa 3 · Site público e notícias
--
-- - publicacoes: notícias, eventos e comunicados. Quem visita o site sem
--   login vê só o que está publicado, é público e já chegou a hora.
--   Famílias com login também veem o que é "só para famílias" e o que é
--   da turma do filho.
-- - pedidos_visita: formulário "Agende uma visita" do site (sem login).
--   Só a gestão lê. O envio passa pela função registrar_interesse.
--
-- Quem escreve: direção, coordenação e secretaria. Publicar (status
-- "publicada"): só direção e coordenação; a secretaria salva rascunhos.
-- =====================================================================

create type public.tipo_publicacao as enum ('noticia', 'evento', 'comunicado');
create type public.visibilidade_publicacao as enum ('publico', 'familias', 'turma');
create type public.status_publicacao as enum ('rascunho', 'publicada');

create table public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_publicacao not null,
  titulo text not null check (length(btrim(titulo)) between 3 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  resumo text not null check (length(btrim(resumo)) between 3 and 200),
  texto text not null default '' check (length(texto) <= 20000),
  evento_data date,
  evento_inicio time,
  evento_fim time,
  evento_local text check (evento_local is null or length(evento_local) <= 160),
  visibilidade public.visibilidade_publicacao not null default 'publico',
  turma_id uuid references public.turmas (id),
  status public.status_publicacao not null default 'rascunho',
  publicar_em timestamptz,          -- quando passa a aparecer (agendamento)
  autor uuid references auth.users (id) default auth.uid(),
  atualizado_por uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo <> 'evento' or evento_data is not null),
  check (visibilidade <> 'turma' or turma_id is not null),
  check (evento_fim is null or evento_inicio is null or evento_fim > evento_inicio)
);
create index publicacoes_vitrine on public.publicacoes (status, visibilidade, publicar_em desc);

create trigger publicacoes_updated_at before update on public.publicacoes
  for each row execute function public.tg_updated_at();
create trigger publicacoes_auditoria after insert or update or delete on public.publicacoes
  for each row execute function public.tg_auditoria();

-- Ao publicar sem data, vale "agora"; quem altera fica registrado.
create or replace function public.tg_publicacao_regras()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'publicada' and new.publicar_em is null then
    new.publicar_em := now();
  end if;
  if new.visibilidade <> 'turma' then
    new.turma_id := null;
  end if;
  if new.tipo <> 'evento' then
    new.evento_data := null; new.evento_inicio := null; new.evento_fim := null; new.evento_local := null;
  end if;
  if tg_op = 'UPDATE' then
    new.atualizado_por := auth.uid();
  end if;
  return new;
end;
$$;
create trigger publicacoes_regras before insert or update on public.publicacoes
  for each row execute function public.tg_publicacao_regras();

-- A família tem filho matriculado nesta turma?
create or replace function public.familia_da_turma(p_turma uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matriculas m
    where m.turma_id = p_turma and m.status = 'matriculado' and public.e_responsavel_do_aluno(m.aluno_id));
$$;

alter table public.publicacoes enable row level security;

-- Visitante sem login: só o que é público e já foi publicado.
create policy publicacoes_site on public.publicacoes for select to anon, authenticated
  using (status = 'publicada' and publicar_em <= now() and visibilidade = 'publico');

-- Com login: a gestão vê tudo (rascunhos inclusive); famílias e equipe veem
-- o que é para famílias; a turma vê o que é da turma.
create policy publicacoes_internas on public.publicacoes for select to authenticated
  using (
    public.e_gestao()
    or (status = 'publicada' and publicar_em <= now() and (
         (visibilidade = 'familias' and (public.tem_papel('responsavel') or public.tem_algum_papel(array['professor_regente', 'professor_especialista', 'auxiliar']::public.papel[])))
         or (visibilidade = 'turma' and (public.familia_da_turma(turma_id) or public.minha_turma(turma_id))))));

create policy publicacoes_escrever on public.publicacoes for insert to authenticated
  with check (public.e_gestao()
              and (status = 'rascunho' or public.tem_algum_papel(array['direcao', 'coordenacao']::public.papel[])));
create policy publicacoes_editar on public.publicacoes for update to authenticated
  using (public.e_gestao())
  with check (public.e_gestao()
              and (status = 'rascunho' or public.tem_algum_papel(array['direcao', 'coordenacao']::public.papel[])));
create policy publicacoes_apagar on public.publicacoes for delete to authenticated
  using (public.tem_algum_papel(array['direcao', 'coordenacao']::public.papel[]));

grant select on public.publicacoes to anon;
grant select, insert, update, delete on public.publicacoes to authenticated;

-- ---------- Pedidos de visita (formulário do site) ----------------------

create table public.pedidos_visita (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 3 and 120),
  telefone text not null check (telefone ~ '^[0-9]{10,11}$'),
  idade_crianca text check (idade_crianca is null or length(idade_crianca) <= 40),
  consentimento boolean not null check (consentimento),
  atendido boolean not null default false,
  atendido_por uuid references auth.users (id),
  atendido_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pedidos_visita enable row level security;
create policy pedidos_ler on public.pedidos_visita for select to authenticated using (public.e_gestao());
create policy pedidos_atender on public.pedidos_visita for update to authenticated
  using (public.e_gestao()) with check (public.e_gestao());
grant select, update on public.pedidos_visita to authenticated;
revoke all on public.pedidos_visita from anon;

-- Envio do formulário, também sem login. Limita repetições do mesmo telefone.
create or replace function public.registrar_interesse(p_nome text, p_telefone text, p_idade text, p_consentimento boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  if not coalesce(p_consentimento, false) then
    raise exception 'Marque a autorização para a escola entrar em contato.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_nome, ''))) < 3 then
    raise exception 'Informe seu nome.' using errcode = 'P0001';
  end if;
  if length(v_tel) not in (10, 11) then
    raise exception 'Informe o telefone com DDD.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.pedidos_visita where telefone = v_tel and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Já recebemos seu pedido. A secretaria vai entrar em contato.' using errcode = 'P0001';
  end if;
  insert into public.pedidos_visita (nome, telefone, idade_crianca, consentimento)
  values (btrim(p_nome), v_tel, nullif(btrim(coalesce(p_idade, '')), ''), true);
end;
$$;

revoke execute on function public.registrar_interesse(text, text, text, boolean) from public;
grant execute on function public.registrar_interesse(text, text, text, boolean) to anon, authenticated;
revoke execute on function public.familia_da_turma(uuid) from anon, public;
grant execute on function public.familia_da_turma(uuid) to authenticated;
