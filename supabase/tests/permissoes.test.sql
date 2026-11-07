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
select tst.falha('select * from public.vw_matriculas', 'anônimo não lê a visão de matrículas', 'permission denied');
select tst.falha('select public.mudar_status_matricula(gen_random_uuid(), ''matriculado'')', 'anônimo não executa funções do sistema', 'permission denied');
select tst.falha('select public.criar_matricula(''{}''::jsonb)', 'anônimo não chama criar_matricula', 'permission denied');
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
select tst.falha($q$select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', 'Outra Criança', 'data_nascimento', '2022-05-05', 'cpf', '11122233344'),
  'responsaveis', '[]'::jsonb, 'matricula', jsonb_build_object('etapa_id', (select id from public.etapas limit 1), 'turno_pretendido', 'manha')))$q$,
  'não recadastra criança com CPF já cadastrado', 'Já existe uma criança cadastrada com este CPF');
select tst.falha($q$select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', 'Outra Criança', 'data_nascimento', '2022-05-05', 'cpf', '55566677788'),
  'responsaveis', '[]'::jsonb, 'matricula', jsonb_build_object('etapa_id', (select id from public.etapas limit 1), 'turno_pretendido', 'manha')))$q$,
  'não usa o CPF de um responsável para a criança', 'já está cadastrado para Juliana Souza');
select tst.falha($q$select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', '  pedro henrique lima ', 'data_nascimento', '2023-01-20'),
  'responsaveis', '[]'::jsonb, 'matricula', jsonb_build_object('etapa_id', (select id from public.etapas limit 1), 'turno_pretendido', 'manha')))$q$,
  'não recadastra criança com mesmo nome e nascimento', 'mesmo nome e data de nascimento');
select tst.ok(tst.conta('select * from public.alunos') = 3, 'tentativas duplicadas não criaram alunos');
-- Responsável sem CPF escolhido na busca (avó de Maria Clara) para outra criança
select id as avo_helena from public.pessoas where nome = 'Helena Souza' \gset
select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', 'Prima Teste Souza', 'data_nascimento', '2022-10-10'),
  'responsaveis', jsonb_build_array(
    jsonb_build_object('pessoa_id', :'avo_helena', 'nome', 'Helena Souza', 'parentesco', 'Avó', 'responsavel_legal', true,
                       'telefone', '37988887777')),
  'matricula', jsonb_build_object('etapa_id', :'pre2', 'turno_pretendido', 'tarde')
)) as mat_prima \gset
select tst.ok(tst.conta('select * from public.pessoas where nome = ''Helena Souza''') = 1, 'responsável escolhido na busca não é duplicado');
select tst.ok(tst.conta(format('select * from public.vinculos where pessoa_id = %L', :'avo_helena')) = 2, 'a mesma pessoa fica ligada às duas crianças');
select tst.ok((select telefone from public.pessoas where id = :'avo_helena') = '37988887777', 'dado em branco do responsável é completado');
select tst.falha(format($q$select public.criar_matricula(jsonb_build_object(
  'aluno', jsonb_build_object('nome', 'Outra Prima Teste', 'data_nascimento', '2022-11-11'),
  'responsaveis', jsonb_build_array(jsonb_build_object('pessoa_id', %L, 'nome', 'x', 'parentesco', 'Mãe', 'responsavel_legal', true)),
  'matricula', jsonb_build_object('etapa_id', (select id from public.etapas limit 1), 'turno_pretendido', 'manha')))$q$,
  (select pessoa_id from public.alunos limit 1)),
  'criança não pode ser escolhida como responsável', 'não foi encontrado');
select public.mudar_status_matricula(:'mat_prima', 'cancelado', 'teste de responsável compartilhado');

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

-- =====================================================================
\echo '--- Frequência'
-- Simula quarta-feira, 17/03/2027 às 9h (aulas de 01/02 a 10/12/2027)
set app.hoje_simulado = '2027-03-17';
set app.agora_simulada = '09:00';
update public.anos_letivos set inicio = '2027-02-01', fim = '2027-12-10' where ativo;
select tst.ok(public.e_dia_letivo('2027-03-17'), '17/03/2027 é dia letivo');
select tst.ok(not public.e_dia_letivo('2027-03-26'), 'Sexta-feira Santa (feriado já cadastrado) não é dia letivo');
select tst.ok(not public.e_dia_letivo('2027-03-20'), 'sábado não é dia letivo');
select tst.ok(not public.e_dia_letivo('2027-01-15'), 'antes do início das aulas não é dia letivo');
select a.id as aluno_maria from public.alunos a join public.pessoas p on p.id = a.pessoa_id where p.nome = 'Maria Clara Souza' \gset
select a.id as aluno_lucas from public.alunos a join public.pessoas p on p.id = a.pessoa_id where p.nome = 'Lucas Andrade Melo' \gset
select a.id as aluno_pedro from public.alunos a join public.pessoas p on p.id = a.pessoa_id where p.nome = 'Pedro Henrique Lima' \gset

\echo '--- Frequência: professora do Pré II'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select public.salvar_chamada(:'turma_pre2', '2027-03-17', array[:'aluno_lucas']::uuid[]) as chamada_hoje \gset
select tst.ok(tst.conta('select * from public.frequencias') = 2, 'chamada grava um registro por aluno da turma');
select tst.ok(tst.conta('select * from public.frequencias where situacao = ''falta''') = 1, 'Lucas com falta');
select public.salvar_chamada(:'turma_pre2', '2027-03-17', '{}');
select tst.ok(tst.conta('select * from public.frequencias where situacao = ''falta''') = 0, 'professora corrige a chamada no mesmo dia');
select tst.falha(format('select public.salvar_chamada(%L, ''2027-03-16'', ''{}'')', :'turma_pre2'),
  'professora não grava dia anterior', 'coordenação');
select tst.falha(format('select public.salvar_chamada(%L, ''2027-03-17'', ''{}'')', :'turma_pre1'),
  'professora não faz chamada de outra turma', 'não pode');
select tst.falha(format('select public.salvar_chamada(%L, ''2027-03-17'', array[%L]::uuid[])', :'turma_pre2', :'aluno_pedro'),
  'não marca falta de aluno de outra turma', 'não é desta turma');
select tst.falha(format('select public.salvar_chamada(%L, ''2027-03-18'', ''{}'')', :'turma_pre2'),
  'não faz chamada de dia futuro', 'ainda não chegou');
select tst.falha('insert into public.frequencias (chamada_id, aluno_id, situacao) select id, aluno_id, ''falta'' from public.frequencias limit 1',
  'não grava frequência direto na tabela');
reset role;
set app.agora_simulada = '18:30';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select tst.falha(format('select public.salvar_chamada(%L, ''2027-03-17'', ''{}'')', :'turma_pre2'),
  'depois das 18h a professora não corrige', 'Depois das 18h00');
reset role;
set app.agora_simulada = '09:00';

\echo '--- Frequência: auxiliar e outros professores'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', false);
select tst.ok(tst.conta('select * from public.frequencias') = 2, 'auxiliar vê a frequência da turma');
select tst.falha(format('select public.salvar_chamada(%L, ''2027-03-17'', ''{}'')', :'turma_pre2'),
  'auxiliar não grava a chamada', 'não pode');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', false);
select tst.ok(tst.conta('select * from public.frequencias') = 0, 'professor de outra turma não vê a frequência');
select tst.ok(tst.conta('select * from public.chamadas') = 0, 'professor de outra turma não vê as chamadas');
reset role;

\echo '--- Frequência: coordenação corrige dias anteriores'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select public.salvar_chamada(:'turma_pre2', '2027-03-15', array[:'aluno_maria']::uuid[]);
select public.salvar_chamada(:'turma_pre2', '2027-03-16', array[:'aluno_maria']::uuid[]);
select public.salvar_chamada(:'turma_pre2', '2027-03-17', array[:'aluno_maria']::uuid[]);
select tst.ok((select faltas_seguidas_sem_aviso from public.vw_frequencia_aluno where aluno_id = :'aluno_maria') = 3,
  '3 faltas seguidas sem aviso');
select tst.ok((select percentual from public.vw_frequencia_aluno where aluno_id = :'aluno_lucas') = 100, 'Lucas com 100%');
select public.marcar_frequencia(:'turma_pre2', '2027-03-15', :'aluno_lucas', 'falta');
select tst.ok((select faltas from public.vw_frequencia_aluno where aluno_id = :'aluno_lucas') = 1, 'coordenação corrige um aluno num dia');
select tst.falha(format('select public.marcar_frequencia(%L, ''2027-03-12'', %L, ''falta'')', :'turma_pre2', :'aluno_lucas'),
  'não corrige dia sem chamada', 'Ainda não há chamada');
reset role;
select tst.ok(tst.conta('select * from public.auditoria where tabela = ''frequencias'' and acao = ''UPDATE''') >= 1, 'correções ficam na auditoria');

\echo '--- Frequência: família'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
select tst.ok(tst.conta('select * from public.frequencias') = 6, 'mãe vê a frequência dos dois filhos');
select tst.ok(tst.conta('select * from public.chamadas') = 3, 'mãe vê as datas das chamadas dos filhos');
select public.registrar_justificativa(:'aluno_maria', '2027-03-16', 'doenca', 'Febre') as just_maria \gset
select tst.ok((select status from public.justificativas_falta where id = :'just_maria') = 'pendente', 'justificativa depois da falta fica em análise');
select tst.ok((select faltas_seguidas_sem_aviso from public.vw_frequencia_aluno where aluno_id = :'aluno_maria') = 1,
  'falta com justificativa em análise não conta como "sem aviso"');
select tst.falha(format('select public.registrar_justificativa(%L, ''2027-03-16'', ''doenca'')', :'aluno_maria'),
  'não reenvia justificativa em análise', 'em análise');
select tst.falha(format('select public.registrar_justificativa(%L, ''2027-03-17'', ''doenca'')', :'aluno_lucas'),
  'não justifica dia em que esteve presente', 'Não há falta');
select public.registrar_justificativa(:'aluno_lucas', '2027-03-18', 'familia', 'Viagem curta') as aviso_lucas \gset
select tst.ok((select status = 'aceita' and aviso_previo from public.justificativas_falta where id = :'aviso_lucas'), 'aviso prévio vale na hora');
select tst.falha(format('select public.registrar_justificativa(%L, ''2027-03-20'', ''doenca'')', :'aluno_lucas'),
  'não avisa falta em dia sem aula', 'não é dia letivo');
select tst.falha(format('select public.registrar_justificativa(%L, ''2027-03-18'', ''doenca'')', :'aluno_pedro'),
  'não justifica falta de outra criança', 'não pode');
select tst.falha(format('select public.analisar_justificativa(%L, true)', :'just_maria'), 'família não aceita a própria justificativa', 'Só a coordenação');
select tst.falha(format('select public.salvar_chamada(%L, ''2027-03-17'', ''{}'')', :'turma_pre2'), 'família não faz chamada', 'não pode');
reset role;

\echo '--- Frequência: gestão analisa'
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select public.analisar_justificativa(:'just_maria', true);
select tst.ok((select justificadas from public.vw_frequencia_aluno where aluno_id = :'aluno_maria') = 1, 'secretaria aceita a justificativa');
select tst.ok((select percentual from public.vw_frequencia_aluno where aluno_id = :'aluno_maria') = 0,
  'falta justificada continua contando como ausência');
select tst.falha(format('select public.analisar_justificativa(%L, false)', :'just_maria'), 'não analisa duas vezes', 'já foi analisada');
select public.registrar_justificativa(:'aluno_maria', '2027-03-15', 'doenca', 'Atestado entregue na secretaria') as just_sec \gset
select tst.ok((select status from public.justificativas_falta where id = :'just_sec') = 'aceita', 'justificativa da secretaria já entra aceita');
select tst.ok(tst.linhas('insert into public.calendario_dias (ano_letivo_id, data, tipo, descricao) select id, ''2027-03-19'', ''sem_aula'', ''Formação de professores'' from public.anos_letivos where ativo') = 1,
  'secretaria marca dia sem aula');
select tst.ok(not public.e_dia_letivo('2027-03-19'), 'dia sem aula deixa de ser letivo');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select tst.ok(tst.linhas('delete from public.calendario_dias') = 0, 'professora não mexe no calendário');
reset role;
update public.anos_letivos set inicio = null, fim = null where ativo;
reset app.hoje_simulado;
reset app.agora_simulada;

\echo '=== TODOS OS TESTES PASSARAM ==='
