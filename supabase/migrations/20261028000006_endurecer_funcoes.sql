-- =====================================================================
-- 006 · Fecha as funções do sistema para quem não está logado
--
-- No Supabase, toda função criada em "public" nasce executável por anon
-- (e pelo PUBLIC do Postgres). As funções já se protegem checando o
-- perfil, mas aqui fechamos a porta de vez: só usuários logados chamam.
-- =====================================================================

revoke execute on all functions in schema public from anon, public;

grant execute on function
  public.tem_papel(public.papel),
  public.tem_algum_papel(public.papel[]),
  public.e_gestao(),
  public.ano_letivo_ativo(),
  public.aluno_na_minha_turma(uuid, boolean),
  public.e_responsavel_do_aluno(uuid),
  public.pode_ver_aluno(uuid, boolean),
  public.pode_ver_pessoa(uuid),
  public.meus_papeis(),
  public.mudar_status_matricula(uuid, public.status_matricula, text),
  public.criar_matricula(jsonb)
to authenticated;

-- Funções criadas daqui em diante também não nascem abertas para anon.
alter default privileges in schema public revoke execute on functions from anon, public;
