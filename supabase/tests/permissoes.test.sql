-- =====================================================================
-- Testes do banco: fluxo de matrícula e matriz de permissões.
-- Roda num Postgres local com stub_auth.sql + migrations (ver run.sh).
-- Cada bloco entra como um perfil diferente e confere o que ele vê/faz.
-- =====================================================================
\set ON_ERROR_STOP on
\set QUIET on

-- ---------- Utilitários de teste ----------
create schema tst;
grant usage on schema tst to authenticated, anon;

create function tst.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Espera que o comando falhe (por permissão ou regra de negócio).
create function tst.falha(cmd text, msg text, trecho text default null) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when others then
    if trecho is not null and position(lower(trecho) in lower(sqlerrm)) = 0 then
      raise exception 'FALHOU: % (erro inesperado: %)', msg, sqlerrm;
    end if;
    raise notice 'ok - % [%]', msg, sqlerrm;
    return;
  end;
  raise exception 'FALHOU: % (o comando deveria ter falhado)', msg;
end $$;

-- Quantas linhas um UPDATE/DELETE afetou (a RLS filtra em silêncio).
create function tst.linhas(cmd text) returns int language plpgsql as $$
declare n int;
begin
  execute cmd;
  get diagnostics n = row_count;
  return n;
end $$;

create function tst.conta(cmd text) returns int language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || cmd || ') x' into n;
  return n;
end $$;

grant execute on all functions in schema tst to authenticated, anon;

-- ---------- Cenário (como superusuário) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@escola.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'direcao@escola.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'coord@escola.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'secretaria@escola.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'prof.pre2@escola.test'),
  ('00000000-0000-0000-0000-0000000000a6', 'prof.pre1@escola.test'),
  ('00000000-0000-0000-0000-0000000000a7', 'aux.pre2@escola.test'),
  ('00000000-0000-0000-0000-0000000000a8', 'mae.maria@familia.test'),
  ('00000000-0000-0000-0000-0000000000a9', 'pai.pedro@familia.test'),
  ('00000000-0000-0000-0000-0000000000b0', 'sem.papel@escola.test');

insert into public.turmas (ano_letivo_id, etapa_id, nome, turno, capacidade)
select public.ano_letivo_ativo(), e.id, e.nome || ' · Manhã', 'manha', 2 from public.etapas e;

insert into public.atribuicoes (user_id, papel, turma_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', null),
  ('00000000-0000-0000-0000-0000000000a2', 'direcao', null),
  ('00000000-0000-0000-0000-0000000000a3', 'coordenacao', null),
  ('00000000-0000-0000-0000-0000000000a4', 'secretaria', null),
  ('00000000-0000-0000-0000-0000000000a5', 'professor_regente', (select id from public.turmas where nome = 'Pré II · Manhã')),
  ('00000000-0000-0000-0000-0000000000a6', 'professor_regente', (select id from public.turmas where nome = 'Pré I · Manhã')),
  ('00000000-0000-0000-0000-0000000000a7', 'auxiliar', (select id from public.turmas where nome = 'Pré II · Manhã')),
  ('00000000-0000-0000-0000-0000000000a8', 'responsavel', null),
  ('00000000-0000-0000-0000-0000000000a9', 'responsavel', null);

select id as pre1 from public.etapas where nome = 'Pré I' \gset
select id as pre2 from public.etapas where nome = 'Pré II' \gset
select id as turma_pre2 from public.turmas where nome = 'Pré II · Manhã' \gset
select id as turma_pre1 from public.turmas where nome = 'Pré I · Manhã' \gset

-- =====================================================================
\echo '--- Anônimo'
set role anon;
select tst.falha('select * from public.alunos', 'anônimo não lê alunos', 'permission denied');
reset role;

-- =====================================================================
\echo '--- Secretaria: cria matrículas'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);

select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', 'Maria Clara Souza', 'data_nascimento', '2022-03-14', 'sexo', 'feminino',
                              'cpf', '11122233344', 'naturalidade', 'Itapecerica/MG', 'cor_raca', 'parda',
                              'tipo_sanguineo', 'O', 'fator_rh', '+'),
  'responsaveis', jsonb_build_array(
    jsonb_build_object('nome', 'Juliana Souza', 'cpf', '55566677788', 'parentesco', 'Mãe', 'filiacao', 'mae',
                       'responsavel_legal', true, 'responsavel_financeiro', true, 'pode_buscar', true,
                       'telefone', '37999990001', 'email', 'mae.maria@familia.test'),
    jsonb_build_object('nome', 'Helena Souza', 'parentesco', 'Avó', 'pode_buscar', true, 'contato_emergencia', true)),
  'endereco', jsonb_build_object('logradouro', 'Rua das Flores', 'numero', '10', 'bairro', 'Centro',
                                 'cidade', 'Itapecerica', 'uf', 'MG', 'cep', '35550000'),
  'saude', jsonb_build_object('alergias', 'Amendoim', 'emergencia_nome', 'Juliana Souza'),
  'atendimento', jsonb_build_object('possui_laudo', true, 'laudo_descricao', 'TEA'),
  'matricula', jsonb_build_object('etapa_id', :'pre2', 'turno_pretendido', 'manha')
)) as mat_maria \gset

select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', 'Pedro Henrique Lima', 'data_nascimento', '2023-01-20', 'sexo', 'masculino'),
  'responsaveis', jsonb_build_array(
    jsonb_build_object('nome', 'Carlos Lima', 'cpf', '99988877766', 'parentesco', 'Pai', 'filiacao', 'pai',
                       'responsavel_legal', true)),
  'matricula', jsonb_build_object('etapa_id', :'pre1', 'turno_pretendido', 'manha')
)) as mat_pedro \gset

select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', 'Lucas Andrade Melo', 'data_nascimento', '2022-06-02'),
  'responsaveis', jsonb_build_array(
    jsonb_build_object('nome', 'Juliana Souza', 'cpf', '55566677788', 'parentesco', 'Mãe', 'filiacao', 'mae',
                       'responsavel_legal', true)),
  'matricula', jsonb_build_object('etapa_id', :'pre2', 'turno_pretendido', 'manha')
)) as mat_lucas \gset

select tst.ok(tst.conta('select * from public.alunos') = 3, 'secretaria vê os 3 alunos');
select tst.ok((select numero from public.matriculas where id = :'mat_maria') = '2027-0001', 'número de matrícula sequencial (2027-0001)');
select tst.ok((select status from public.matriculas where id = :'mat_maria') = 'em_analise', 'matrícula da secretaria nasce em análise');
select tst.ok(tst.conta(format('select * from public.documentos_entregues where matricula_id = %L', :'mat_maria')) = 8, 'checklist com 8 documentos criado');
select tst.ok(tst.conta('select * from public.pessoas where cpf = ''55566677788''') = 1, 'mãe com dois filhos é uma pessoa só (CPF reaproveitado)');

select tst.falha(format('update public.matriculas set status = ''matriculado'' where id = %L', :'mat_maria'),
  'situação não muda por UPDATE direto', 'só muda pelo fluxo');
select tst.falha(format('select public.mudar_status_matricula(%L, ''aguardando_aprovacao'')', :'mat_maria'),
  'não envia para a direção com documento obrigatório pendente', 'pendente');

update public.documentos_entregues d set status = 'entregue', conferido_por = auth.uid(), conferido_em = now()
from public.tipos_documento t
where t.id = d.tipo_id and t.obrigatorio and d.matricula_id in (:'mat_maria', :'mat_lucas');

select tst.ok((public.mudar_status_matricula(:'mat_maria', 'aguardando_aprovacao')).status = 'aguardando_aprovacao',
  'documentos ok → aguardando aprovação');
select public.mudar_status_matricula(:'mat_lucas', 'aguardando_aprovacao');
select tst.falha(format('select public.mudar_status_matricula(%L, ''matriculado'')', :'mat_maria'),
  'secretaria não aprova matrícula', 'não permitida');
select tst.falha(format('update public.matriculas set data_matricula = current_date where id = %L', :'mat_maria'),
  'data da matrícula não é editável à mão', 'preenchidos pelo sistema');
select tst.ok(tst.conta('select * from public.auditoria') = 0, 'secretaria não lê a auditoria');
select tst.falha('insert into public.atribuicoes (user_id, papel) values (''00000000-0000-0000-0000-0000000000b0'', ''direcao'')',
  'secretaria não cria perfil de direção', 'row-level security');
select tst.ok(tst.linhas('insert into public.atribuicoes (user_id, papel) values (''00000000-0000-0000-0000-0000000000b0'', ''responsavel'')') = 1,
  'secretaria cria conta de família (responsável)');
reset role;
update public.atribuicoes set ativo = false where user_id = '00000000-0000-0000-0000-0000000000b0';

-- liga a conta de login da mãe à pessoa cadastrada (feito pela tela de contas)
update public.pessoas set user_id = '00000000-0000-0000-0000-0000000000a8' where cpf = '55566677788';
update public.pessoas set user_id = '00000000-0000-0000-0000-0000000000a9' where cpf = '99988877766';

-- =====================================================================
\echo '--- Direção: aprova'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select tst.ok((public.mudar_status_matricula(:'mat_maria', 'matriculado')).status = 'matriculado', 'direção aprova a matrícula');
select public.mudar_status_matricula(:'mat_lucas', 'matriculado');
select tst.ok((select data_matricula from public.matriculas where id = :'mat_maria') = current_date, 'data da matrícula preenchida na aprovação');
select tst.ok(tst.conta(format('select * from public.matricula_eventos where matricula_id = %L', :'mat_maria')) = 3,
  'linha do tempo com 3 eventos (criada, aguardando, matriculado)');
select tst.ok(tst.linhas('update public.pessoas set nome = ''X'' where cpf = ''11122233344''') = 0, 'direção não edita cadastro');
select tst.ok(tst.conta('select * from public.auditoria') > 0, 'direção lê a auditoria');
reset role;

-- =====================================================================
\echo '--- Secretaria: enturmação'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select tst.falha(format('update public.matriculas set turma_id = %L where id = %L', :'turma_pre2', :'mat_pedro'),
  'não enturma quem não está matriculado', 'matriculado');
select tst.ok(tst.linhas(format('update public.matriculas set turma_id = %L where id = %L', :'turma_pre2', :'mat_maria')) = 1,
  'enturma Maria no Pré II · Manhã');
select tst.falha(format('update public.matriculas set turma_id = %L where id = %L', :'turma_pre1', :'mat_lucas'),
  'não enturma em turma de outra etapa', 'mesma etapa');
update public.turmas set capacidade = 1 where id = :'turma_pre2';
select tst.falha(format('update public.matriculas set turma_id = %L where id = %L', :'turma_pre2', :'mat_lucas'),
  'não enturma em turma cheia', 'cheia');
update public.turmas set capacidade = 20 where id = :'turma_pre2';
update public.matriculas set turma_id = :'turma_pre2' where id = :'mat_lucas';
select tst.falha(format('select public.mudar_status_matricula(%L, ''transferido'')', :'mat_lucas'),
  'transferência exige motivo', 'motivo');
reset role;

-- =====================================================================
\echo '--- Professora do Pré II'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select tst.ok(tst.conta('select * from public.alunos') = 2, 'vê só os alunos da sua turma (Maria e Lucas)');
select tst.ok(tst.conta('select * from public.saude_alunos where alergias is not null') = 1, 'vê a alergia da Maria');
select tst.ok(tst.conta('select * from public.atendimentos_especializados where possui_laudo') = 1, 'vê o laudo da Maria');
select tst.ok(tst.conta('select * from public.vinculos') = 3, 'vê responsáveis e autorizados a buscar dos seus alunos');
select tst.ok(tst.conta('select * from public.pessoas where nome = ''Pedro Henrique Lima''') = 0, 'não vê aluno de outra turma');
select tst.ok(tst.conta('select * from public.documentos_entregues') = 0, 'não vê documentos da matrícula');
select tst.ok(tst.linhas('update public.saude_alunos set alergias = null') = 0, 'não edita dados de saúde');
reset role;

-- =====================================================================
\echo '--- Professor do Pré I (Pedro não está enturmado)'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', false);
select tst.ok(tst.conta('select * from public.alunos') = 0, 'não vê alunos sem enturmação nem de outras turmas');
reset role;

-- =====================================================================
\echo '--- Auxiliar do Pré II'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', false);
select tst.ok(tst.conta('select * from public.alunos') = 2, 'vê os alunos da turma');
select tst.ok(tst.conta('select * from public.saude_alunos where alergias is not null') = 1, 'vê o alerta de alergia');
select tst.ok(tst.conta('select * from public.vinculos where pode_buscar') = 2, 'vê quem pode buscar (mãe e avó da Maria)');
select tst.ok(tst.conta('select * from public.enderecos') = 0, 'não vê endereço');
select tst.ok(tst.conta('select * from public.atendimentos_especializados') = 0, 'não vê laudo');
reset role;

-- =====================================================================
\echo '--- Mãe da Maria e do Lucas'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
select tst.ok(tst.conta('select * from public.alunos') = 2, 'vê os dois filhos');
select tst.ok(tst.conta('select * from public.vw_matriculas') = 2, 'vê as matrículas dos filhos');
select tst.ok(tst.conta('select * from public.documentos_entregues') = 16, 'vê o checklist de documentos dos filhos');
select tst.ok(tst.conta('select * from public.pessoas where nome = ''Pedro Henrique Lima''') = 0, 'não vê outras crianças');
select tst.ok(tst.linhas('update public.saude_alunos set alergias = null') = 0, 'não edita saúde diretamente');
select tst.ok(tst.conta('select * from public.auditoria') = 0, 'não lê auditoria');
reset role;

-- =====================================================================
\echo '--- Pai do Pedro'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', false);
select tst.ok(tst.conta('select * from public.alunos') = 1, 'vê só o próprio filho');
select tst.ok(tst.conta('select * from public.saude_alunos') = 1, 'vê a saúde do próprio filho');
reset role;

-- =====================================================================
\echo '--- Administrador (TI)'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select tst.ok(tst.conta('select * from public.alunos') = 0, 'admin não vê dados de alunos');
select tst.ok(tst.conta('select * from public.saude_alunos') = 0, 'admin não vê saúde');
select tst.ok(tst.conta('select * from public.atribuicoes') >= 9, 'admin vê todos os perfis');
select tst.ok(tst.linhas('insert into public.atribuicoes (user_id, papel) values (''00000000-0000-0000-0000-0000000000b0'', ''coordenacao'')') = 1,
  'admin atribui perfis');
select tst.falha('select public.promover_primeiro_admin(''x@y.z'')', 'promover_primeiro_admin fechado para usuários', 'permission denied');
reset role;

-- =====================================================================
\echo '--- Usuário sem perfil'
update public.atribuicoes set ativo = false where user_id = '00000000-0000-0000-0000-0000000000b0';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b0', false);
select tst.ok(tst.conta('select * from public.alunos') = 0, 'sem perfil ativo não vê alunos');
select tst.ok(tst.conta('select * from public.pessoas') = 0, 'sem perfil ativo não vê pessoas');
select tst.ok(tst.conta('select * from public.matriculas') = 0, 'sem perfil ativo não vê matrículas');
select tst.falha(format('select public.mudar_status_matricula(%L, ''cancelado'', ''teste'')', :'mat_pedro'),
  'sem perfil não cancela matrícula', 'não permitida');
reset role;

\echo '=== TODOS OS TESTES PASSARAM ==='
