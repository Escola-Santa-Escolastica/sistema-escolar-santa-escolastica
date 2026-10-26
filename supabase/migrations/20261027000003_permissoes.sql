-- =====================================================================
-- 003 · Permissões (Row Level Security)
--
-- Tradução da matriz de permissões da especificação:
--   G gerencia · E edita · V vê · (T) só turmas atribuídas · (F) só os próprios filhos
-- Ninguém apaga alunos, pessoas ou matrículas: elas mudam de situação.
-- =====================================================================

-- Sem acesso anônimo a nada; usuários logados passam pela RLS.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    -- (sem FORCE: as funções SECURITY DEFINER do sistema, donas das tabelas,
    --  precisam ler atribuições e vínculos sem passar pela própria RLS)
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Configuração e tabelas de referência --------------------------
-- Leitura para todo usuário logado (não são dados pessoais).

create policy escola_ler on public.escola for select to authenticated using (true);
create policy escola_editar on public.escola for update to authenticated
  using (public.tem_algum_papel(array['admin', 'direcao']::public.papel[]))
  with check (public.tem_algum_papel(array['admin', 'direcao']::public.papel[]));

create policy anos_ler on public.anos_letivos for select to authenticated using (true);
create policy anos_gerir on public.anos_letivos for all to authenticated
  using (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]))
  with check (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]));

create policy etapas_ler on public.etapas for select to authenticated using (true);
create policy etapas_gerir on public.etapas for all to authenticated
  using (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]))
  with check (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]));

create policy turmas_ler on public.turmas for select to authenticated using (true);
create policy turmas_gerir on public.turmas for all to authenticated
  using (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]))
  with check (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]));

create policy componentes_ler on public.componentes for select to authenticated using (true);
create policy componentes_gerir on public.componentes for all to authenticated
  using (public.tem_papel('coordenacao')) with check (public.tem_papel('coordenacao'));

create policy tipos_doc_ler on public.tipos_documento for select to authenticated using (true);
create policy tipos_doc_gerir on public.tipos_documento for all to authenticated
  using (public.tem_papel('secretaria')) with check (public.tem_papel('secretaria'));

-- ---------- Pessoas e alunos ---------------------------------------------

create policy pessoas_ler on public.pessoas for select to authenticated
  using (public.pode_ver_pessoa(id));
create policy pessoas_criar on public.pessoas for insert to authenticated
  with check (public.tem_papel('secretaria') or public.tem_papel('admin') and user_id is not null);
create policy pessoas_editar on public.pessoas for update to authenticated
  using (public.tem_papel('secretaria') or public.tem_papel('admin') and user_id is not null)
  with check (public.tem_papel('secretaria') or public.tem_papel('admin') and user_id is not null);

create policy alunos_ler on public.alunos for select to authenticated
  using (public.pode_ver_aluno(id));
create policy alunos_criar on public.alunos for insert to authenticated
  with check (public.tem_papel('secretaria'));
create policy alunos_editar on public.alunos for update to authenticated
  using (public.tem_papel('secretaria')) with check (public.tem_papel('secretaria'));

-- Endereço: auxiliares/portaria não veem.
create policy enderecos_ler on public.enderecos for select to authenticated
  using (public.pode_ver_aluno(aluno_id, incluir_auxiliar => false));
create policy enderecos_criar on public.enderecos for insert to authenticated
  with check (public.tem_papel('secretaria'));
create policy enderecos_editar on public.enderecos for update to authenticated
  using (public.tem_papel('secretaria')) with check (public.tem_papel('secretaria'));

-- Saúde e alergias: todos que convivem com a criança (incluindo auxiliares) leem.
create policy saude_ler on public.saude_alunos for select to authenticated
  using (public.pode_ver_aluno(aluno_id));
create policy saude_criar on public.saude_alunos for insert to authenticated
  with check (public.tem_papel('secretaria'));
create policy saude_editar on public.saude_alunos for update to authenticated
  using (public.tem_papel('secretaria')) with check (public.tem_papel('secretaria'));

-- Laudo e atendimento especializado: coordenação gerencia, secretaria edita;
-- professores da turma e responsáveis leem; auxiliares não.
create policy atend_ler on public.atendimentos_especializados for select to authenticated
  using (public.pode_ver_aluno(aluno_id, incluir_auxiliar => false));
create policy atend_criar on public.atendimentos_especializados for insert to authenticated
  with check (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]));
create policy atend_editar on public.atendimentos_especializados for update to authenticated
  using (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]))
  with check (public.tem_algum_papel(array['coordenacao', 'secretaria']::public.papel[]));

-- Vínculos (inclui autorizados a buscar): visíveis a quem vê o aluno.
create policy vinculos_ler on public.vinculos for select to authenticated
  using (public.pode_ver_aluno(aluno_id));
create policy vinculos_criar on public.vinculos for insert to authenticated
  with check (public.tem_papel('secretaria'));
create policy vinculos_editar on public.vinculos for update to authenticated
  using (public.tem_papel('secretaria')) with check (public.tem_papel('secretaria'));
create policy vinculos_remover on public.vinculos for delete to authenticated
  using (public.tem_papel('secretaria'));

-- ---------- Matrículas ----------------------------------------------------

create policy matriculas_ler on public.matriculas for select to authenticated
  using (public.e_gestao()
         or public.e_responsavel_do_aluno(aluno_id)
         or (status = 'matriculado' and public.aluno_na_minha_turma(aluno_id)));
create policy matriculas_criar on public.matriculas for insert to authenticated
  with check (public.tem_papel('secretaria'));
-- Dados e enturmação: secretaria e coordenação. A situação só muda pelo fluxo.
create policy matriculas_editar on public.matriculas for update to authenticated
  using (public.tem_algum_papel(array['secretaria', 'coordenacao']::public.papel[]))
  with check (public.tem_algum_papel(array['secretaria', 'coordenacao']::public.papel[]));

create policy docs_ler on public.documentos_entregues for select to authenticated
  using (exists (select 1 from public.matriculas m where m.id = matricula_id
                 and (public.e_gestao() or public.e_responsavel_do_aluno(m.aluno_id))));
create policy docs_editar on public.documentos_entregues for update to authenticated
  using (public.tem_papel('secretaria')) with check (public.tem_papel('secretaria'));

create policy eventos_ler on public.matricula_eventos for select to authenticated
  using (exists (select 1 from public.matriculas m where m.id = matricula_id
                 and (public.e_gestao() or public.e_responsavel_do_aluno(m.aluno_id))));
-- eventos são gravados só pelas funções do sistema (SECURITY DEFINER)

-- Contadores: só as funções do sistema.
revoke all on public.matricula_contadores from authenticated;

-- ---------- Acesso e auditoria --------------------------------------------

create policy atrib_ler on public.atribuicoes for select to authenticated
  using (user_id = auth.uid() or public.tem_algum_papel(array['admin', 'direcao']::public.papel[]));
-- Admin gerencia todos os papéis; a secretaria só cria e desativa contas de famílias.
create policy atrib_criar on public.atribuicoes for insert to authenticated
  with check (public.tem_papel('admin') or (public.tem_papel('secretaria') and papel = 'responsavel'));
create policy atrib_editar on public.atribuicoes for update to authenticated
  using (public.tem_papel('admin') or (public.tem_papel('secretaria') and papel = 'responsavel'))
  with check (public.tem_papel('admin') or (public.tem_papel('secretaria') and papel = 'responsavel'));

create policy auditoria_ler on public.auditoria for select to authenticated
  using (public.tem_algum_papel(array['admin', 'direcao']::public.papel[]));
revoke insert, update, delete on public.auditoria from authenticated;

-- Funções: liberadas para usuários logados (cada uma checa o perfil).
grant execute on function public.tem_papel(public.papel), public.tem_algum_papel(public.papel[]),
  public.e_gestao(), public.ano_letivo_ativo(), public.aluno_na_minha_turma(uuid, boolean),
  public.e_responsavel_do_aluno(uuid), public.pode_ver_aluno(uuid, boolean), public.pode_ver_pessoa(uuid),
  public.meus_papeis(), public.mudar_status_matricula(uuid, public.status_matricula, text)
  to authenticated;
