-- =====================================================================
-- 002 · Funções de acesso, gatilhos e regras do fluxo de matrícula
--
-- As funções de acesso são SECURITY DEFINER para poderem ler as tabelas
-- de atribuições/vínculos sem cair na própria RLS (evita recursão).
-- Todas fixam search_path = '' e usam nomes qualificados.
-- =====================================================================

-- ---------- Quem é o usuário atual ---------------------------------------

create or replace function public.tem_papel(p public.papel)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.atribuicoes a
    where a.user_id = auth.uid() and a.papel = p and a.ativo
  );
$$;

create or replace function public.tem_algum_papel(ps public.papel[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.atribuicoes a
    where a.user_id = auth.uid() and a.papel = any (ps) and a.ativo
  );
$$;

-- Direção, coordenação e secretaria: veem os dados de todos os alunos.
create or replace function public.e_gestao()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.tem_algum_papel(array['direcao', 'coordenacao', 'secretaria']::public.papel[]);
$$;

create or replace function public.ano_letivo_ativo()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.anos_letivos where ativo limit 1;
$$;

-- O aluno está (matriculado e enturmado) numa turma atribuída ao usuário?
-- incluir_auxiliar = false exclui auxiliares/portaria (ex.: laudos, endereço).
create or replace function public.aluno_na_minha_turma(p_aluno uuid, incluir_auxiliar boolean default true)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.matriculas m
    join public.atribuicoes a on a.turma_id = m.turma_id
    where m.aluno_id = p_aluno
      and m.status = 'matriculado'
      and a.user_id = auth.uid()
      and a.ativo
      and (a.papel in ('professor_regente', 'professor_especialista')
           or (incluir_auxiliar and a.papel = 'auxiliar'))
  );
$$;

-- O usuário é pai, mãe ou responsável legal do aluno (e tem o papel responsável)?
create or replace function public.e_responsavel_do_aluno(p_aluno uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.tem_papel('responsavel') and exists (
    select 1
    from public.vinculos v
    join public.pessoas p on p.id = v.pessoa_id
    where v.aluno_id = p_aluno
      and p.user_id = auth.uid()
      and (v.responsavel_legal or v.filiacao is not null)
  );
$$;

create or replace function public.pode_ver_aluno(p_aluno uuid, incluir_auxiliar boolean default true)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.e_gestao()
      or public.aluno_na_minha_turma(p_aluno, incluir_auxiliar)
      or public.e_responsavel_do_aluno(p_aluno);
$$;

-- Uma pessoa é visível se for o próprio usuário, ou aluno/vínculo de um aluno visível.
create or replace function public.pode_ver_pessoa(p_pessoa uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.e_gestao()
    or exists (select 1 from public.pessoas p where p.id = p_pessoa and p.user_id = auth.uid())
    or public.tem_papel('admin') and exists (
         -- admin vê apenas pessoas que têm login (para gerir usuários)
         select 1 from public.pessoas p where p.id = p_pessoa and p.user_id is not null)
    or exists (select 1 from public.alunos a where a.pessoa_id = p_pessoa and public.pode_ver_aluno(a.id))
    or exists (select 1 from public.vinculos v where v.pessoa_id = p_pessoa and public.pode_ver_aluno(v.aluno_id));
$$;

-- Lista os papéis do usuário atual (usada pelas telas para montar o menu).
create or replace function public.meus_papeis()
returns table (papel public.papel, turma_id uuid, componente_id uuid)
language sql stable security definer set search_path = ''
as $$
  select a.papel, a.turma_id, a.componente_id
  from public.atribuicoes a
  where a.user_id = auth.uid() and a.ativo;
$$;

-- ---------- Gatilhos genéricos -------------------------------------------

create or replace function public.tg_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['escola', 'pessoas', 'alunos', 'enderecos', 'saude_alunos',
                           'atendimentos_especializados', 'matriculas']
  loop
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.tg_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Auditoria: grava antes/depois de toda alteração nas tabelas sensíveis.
create or replace function public.tg_auditoria()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id text;
begin
  v_id := coalesce(
    to_jsonb(coalesce(new, old)) ->> 'id',
    to_jsonb(coalesce(new, old)) ->> 'aluno_id');
  insert into public.auditoria (user_id, acao, tabela, registro_id, antes, depois)
  values (auth.uid(), tg_op, tg_table_name, v_id,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['pessoas', 'alunos', 'enderecos', 'saude_alunos', 'atendimentos_especializados',
                           'vinculos', 'matriculas', 'documentos_entregues', 'atribuicoes', 'escola']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.tg_auditoria()', t || '_auditoria', t);
  end loop;
end $$;

-- ---------- Matrícula: número, documentos e regras -------------------------

-- Número sequencial por ano letivo: 2027-0001, 2027-0002…
create or replace function public.tg_matricula_numero()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ano int;
  v_seq int;
begin
  if new.numero is null then
    select ano into v_ano from public.anos_letivos where id = new.ano_letivo_id;
    insert into public.matricula_contadores (ano, ultimo) values (v_ano, 1)
    on conflict (ano) do update set ultimo = public.matricula_contadores.ultimo + 1
    returning ultimo into v_seq;
    new.numero := v_ano || '-' || lpad(v_seq::text, 4, '0');
  end if;
  return new;
end;
$$;
create trigger matriculas_numero before insert on public.matriculas
  for each row execute function public.tg_matricula_numero();

-- Toda matrícula nasce com o checklist de documentos e o primeiro evento.
create or replace function public.tg_matricula_criada()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.documentos_entregues (matricula_id, tipo_id)
  select new.id, t.id from public.tipos_documento t;
  insert into public.matricula_eventos (matricula_id, de, para, observacao)
  values (new.id, null, new.status, 'Matrícula criada');
  return new;
end;
$$;
create trigger matriculas_criada after insert on public.matriculas
  for each row execute function public.tg_matricula_criada();

-- Regras de alteração direta (UPDATE) da matrícula:
--   * a situação só muda pela função mudar_status_matricula();
--   * enturmação só para matriculado, em turma do mesmo ano e etapa, com vaga.
create or replace function public.tg_matricula_regras()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_turma public.turmas%rowtype;
  v_ocupadas int;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('pre_matricula', 'em_analise') then
      raise exception 'Uma matrícula começa como pré-matrícula ou em análise.' using errcode = 'P0001';
    end if;
    if new.turma_id is not null then
      raise exception 'A enturmação só acontece depois da aprovação.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     and coalesce(current_setting('app.transicao_matricula', true), '') <> 'on' then
    raise exception 'A situação da matrícula só muda pelo fluxo (mudar_status_matricula).' using errcode = 'P0001';
  end if;

  if (new.aprovado_por, new.aprovado_em, new.data_matricula, new.numero)
     is distinct from (old.aprovado_por, old.aprovado_em, old.data_matricula, old.numero)
     and coalesce(current_setting('app.transicao_matricula', true), '') <> 'on' then
    raise exception 'Número, aprovação e data da matrícula são preenchidos pelo sistema.' using errcode = 'P0001';
  end if;

  if new.turma_id is distinct from old.turma_id and new.turma_id is not null then
    if new.status <> 'matriculado' then
      raise exception 'Só é possível enturmar um aluno matriculado.' using errcode = 'P0001';
    end if;
    select * into v_turma from public.turmas where id = new.turma_id;
    if v_turma.ano_letivo_id <> new.ano_letivo_id or v_turma.etapa_id <> new.etapa_id then
      raise exception 'A turma precisa ser do mesmo ano letivo e da mesma etapa da matrícula.' using errcode = 'P0001';
    end if;
    select count(*) into v_ocupadas from public.matriculas
      where turma_id = new.turma_id and status = 'matriculado' and id <> new.id;
    if v_ocupadas >= v_turma.capacidade then
      raise exception 'A turma % está cheia (capacidade: %).', v_turma.nome, v_turma.capacidade using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger matriculas_regras before insert or update on public.matriculas
  for each row execute function public.tg_matricula_regras();

-- Fluxo de matrícula. Transições permitidas e quem pode fazer cada uma:
--   pre_matricula        → em_analise                         secretaria
--   em_analise           → pendente_documento                 secretaria
--   em_analise           → aguardando_aprovacao               secretaria (documentos obrigatórios ok)
--   pendente_documento   → em_analise                         secretaria
--   aguardando_aprovacao → matriculado | em_analise           direção
--   matriculado          → transferido | concluido            secretaria (exige motivo na transferência)
--   qualquer não final   → cancelado                          secretaria ou direção (exige motivo)
create or replace function public.mudar_status_matricula(
  p_matricula uuid,
  p_para public.status_matricula,
  p_observacao text default null
)
returns public.matriculas
language plpgsql security definer set search_path = ''
as $$
declare
  m public.matriculas%rowtype;
  v_ok boolean := false;
  v_pendentes int;
  v_de public.status_matricula;
begin
  select * into m from public.matriculas where id = p_matricula for update;
  if not found then
    raise exception 'Matrícula não encontrada.' using errcode = 'P0002';
  end if;
  v_de := m.status;

  v_ok := case
    when m.status = 'pre_matricula' and p_para = 'em_analise' then public.tem_papel('secretaria')
    when m.status = 'em_analise' and p_para in ('pendente_documento', 'aguardando_aprovacao') then public.tem_papel('secretaria')
    when m.status = 'pendente_documento' and p_para = 'em_analise' then public.tem_papel('secretaria')
    when m.status = 'aguardando_aprovacao' and p_para in ('matriculado', 'em_analise') then public.tem_papel('direcao')
    when m.status = 'matriculado' and p_para in ('transferido', 'concluido') then public.tem_papel('secretaria')
    when m.status not in ('transferido', 'concluido', 'cancelado') and p_para = 'cancelado'
      then public.tem_algum_papel(array['secretaria', 'direcao']::public.papel[])
    else false
  end;

  if not v_ok then
    raise exception 'Mudança de "%" para "%" não permitida para o seu perfil.', m.status, p_para
      using errcode = '42501';
  end if;

  if p_para = 'aguardando_aprovacao' then
    select count(*) into v_pendentes
    from public.documentos_entregues d
    join public.tipos_documento t on t.id = d.tipo_id
    where d.matricula_id = m.id and t.obrigatorio and d.status = 'pendente';
    if v_pendentes > 0 then
      raise exception 'Ainda há % documento(s) obrigatório(s) pendente(s).', v_pendentes using errcode = 'P0001';
    end if;
  end if;

  if p_para in ('transferido', 'cancelado') and coalesce(trim(p_observacao), '') = '' then
    raise exception 'Informe o motivo.' using errcode = 'P0001';
  end if;

  perform set_config('app.transicao_matricula', 'on', true);

  update public.matriculas set
    status = p_para,
    aprovado_por = case when p_para = 'matriculado' then auth.uid() else aprovado_por end,
    aprovado_em = case when p_para = 'matriculado' then now() else aprovado_em end,
    data_matricula = case when p_para = 'matriculado' then current_date else data_matricula end,
    motivo_saida = case when p_para in ('transferido', 'cancelado') then p_observacao else motivo_saida end
  where id = m.id
  returning * into m;

  perform set_config('app.transicao_matricula', 'off', true);

  insert into public.matricula_eventos (matricula_id, de, para, observacao)
  values (m.id, v_de, p_para, p_observacao);

  return m;
end;
$$;

-- ---------- Contas ---------------------------------------------------------

-- Primeiro administrador: só funciona enquanto não houver nenhum admin.
-- Uso (no SQL Editor do Supabase): select public.promover_primeiro_admin('email@escola.com');
create or replace function public.promover_primeiro_admin(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if exists (select 1 from public.atribuicoes where papel = 'admin' and ativo) then
    raise exception 'Já existe um administrador.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'Usuário % não encontrado. Crie a conta em Authentication › Users antes.', p_email;
  end if;
  insert into public.atribuicoes (user_id, papel, criado_por) values (v_user, 'admin', v_user);
end;
$$;
revoke execute on function public.promover_primeiro_admin(text) from public, anon, authenticated;
