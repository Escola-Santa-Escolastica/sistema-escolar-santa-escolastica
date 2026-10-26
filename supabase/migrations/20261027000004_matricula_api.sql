-- =====================================================================
-- 004 · API da matrícula e visões de consulta
--
-- criar_matricula() roda com os direitos de quem chama (SECURITY INVOKER),
-- então a RLS continua valendo: só a secretaria consegue criar.
-- Tudo acontece numa única transação: ou a ficha inteira entra, ou nada.
-- =====================================================================

create or replace function public.criar_matricula(p jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_pessoa public.pessoas;
  v_aluno public.alunos;
  v_pessoa_id uuid;
  v_aluno_id uuid;
  v_resp_id uuid;
  v_matricula_id uuid;
  r jsonb;
  v_resp public.pessoas;
  v_vinc public.vinculos;
  v_end public.enderecos;
  v_saude public.saude_alunos;
  v_atend public.atendimentos_especializados;
  v_mat public.matriculas;
begin
  if not public.tem_papel('secretaria') then
    raise exception 'Somente a secretaria cria matrículas.' using errcode = '42501';
  end if;
  if p -> 'aluno' is null or p -> 'matricula' is null then
    raise exception 'Dados do aluno e da matrícula são obrigatórios.' using errcode = '22023';
  end if;

  -- 1. Aluno (pessoa + dados da ficha)
  v_pessoa := jsonb_populate_record(null::public.pessoas, p -> 'aluno');
  insert into public.pessoas (nome, nome_social, data_nascimento, sexo, cpf, rg, rg_orgao_expedidor,
                              rg_data_emissao, cin)
  values (v_pessoa.nome, v_pessoa.nome_social, v_pessoa.data_nascimento, v_pessoa.sexo, v_pessoa.cpf,
          v_pessoa.rg, v_pessoa.rg_orgao_expedidor, v_pessoa.rg_data_emissao, v_pessoa.cin)
  returning id into v_pessoa_id;

  v_aluno := jsonb_populate_record(null::public.alunos, p -> 'aluno');
  insert into public.alunos (pessoa_id, naturalidade, nacionalidade, cor_raca, tipo_sanguineo, fator_rh,
                             numero_sus, nis, transporte_escolar, bolsa_familia, ensino_religioso,
                             dispensa_educacao_fisica)
  values (v_pessoa_id, v_aluno.naturalidade, coalesce(v_aluno.nacionalidade, 'Brasileira'), v_aluno.cor_raca,
          v_aluno.tipo_sanguineo, v_aluno.fator_rh, v_aluno.numero_sus, v_aluno.nis,
          coalesce(v_aluno.transporte_escolar, false), coalesce(v_aluno.bolsa_familia, false),
          coalesce(v_aluno.ensino_religioso, true), v_aluno.dispensa_educacao_fisica)
  returning id into v_aluno_id;

  -- 2. Responsáveis e vínculos (reaproveita a pessoa se o CPF já existir — irmãos)
  for r in select * from jsonb_array_elements(coalesce(p -> 'responsaveis', '[]'::jsonb))
  loop
    v_resp := jsonb_populate_record(null::public.pessoas, r);
    v_resp_id := null;
    if v_resp.cpf is not null then
      select id into v_resp_id from public.pessoas where cpf = v_resp.cpf;
    end if;
    if v_resp_id is null then
      insert into public.pessoas (nome, cpf, rg, profissao, email, telefone)
      values (v_resp.nome, v_resp.cpf, v_resp.rg, v_resp.profissao, v_resp.email, v_resp.telefone)
      returning id into v_resp_id;
    end if;
    v_vinc := jsonb_populate_record(null::public.vinculos, r);
    insert into public.vinculos (aluno_id, pessoa_id, parentesco, filiacao, responsavel_legal,
                                 responsavel_financeiro, pode_buscar, contato_emergencia)
    values (v_aluno_id, v_resp_id, coalesce(v_vinc.parentesco, 'Responsável'), v_vinc.filiacao,
            coalesce(v_vinc.responsavel_legal, false), coalesce(v_vinc.responsavel_financeiro, false),
            coalesce(v_vinc.pode_buscar, false), coalesce(v_vinc.contato_emergencia, false));
  end loop;

  -- 3. Endereço, saúde e atendimento especializado
  v_end := jsonb_populate_record(null::public.enderecos, coalesce(p -> 'endereco', '{}'::jsonb));
  insert into public.enderecos (aluno_id, logradouro, numero, complemento, bairro, cidade, uf, cep,
                                telefone_residencial, telefone_celular)
  values (v_aluno_id, v_end.logradouro, v_end.numero, v_end.complemento, v_end.bairro, v_end.cidade,
          v_end.uf, v_end.cep, v_end.telefone_residencial, v_end.telefone_celular);

  v_saude := jsonb_populate_record(null::public.saude_alunos, coalesce(p -> 'saude', '{}'::jsonb));
  insert into public.saude_alunos (aluno_id, problema_saude, alergias, medicamento_continuo, restricao_alimentar,
                                   convenio, convenio_carteirinha, observacoes, emergencia_nome, emergencia_telefone)
  values (v_aluno_id, v_saude.problema_saude, v_saude.alergias, v_saude.medicamento_continuo,
          v_saude.restricao_alimentar, v_saude.convenio, v_saude.convenio_carteirinha, v_saude.observacoes,
          v_saude.emergencia_nome, v_saude.emergencia_telefone);

  v_atend := jsonb_populate_record(null::public.atendimentos_especializados, coalesce(p -> 'atendimento', '{}'::jsonb));
  insert into public.atendimentos_especializados (aluno_id, possui_laudo, laudo_descricao, acompanha_atendimento,
                                                  atendimento_descricao, observacoes_pedagogicas)
  values (v_aluno_id, coalesce(v_atend.possui_laudo, false), v_atend.laudo_descricao,
          coalesce(v_atend.acompanha_atendimento, false), v_atend.atendimento_descricao,
          v_atend.observacoes_pedagogicas);

  -- 4. Matrícula (o número e o checklist de documentos são gerados por gatilho)
  v_mat := jsonb_populate_record(null::public.matriculas, p -> 'matricula');
  insert into public.matriculas (aluno_id, ano_letivo_id, etapa_id, turno_pretendido, status,
                                 instituicao_origem, ultimo_ano_cursado, observacoes)
  values (v_aluno_id, coalesce(v_mat.ano_letivo_id, public.ano_letivo_ativo()), v_mat.etapa_id,
          v_mat.turno_pretendido, 'em_analise', v_mat.instituicao_origem, v_mat.ultimo_ano_cursado,
          v_mat.observacoes)
  returning id into v_matricula_id;

  return v_matricula_id;
end;
$$;
grant execute on function public.criar_matricula(jsonb) to authenticated;

-- ---------- Visões (security_invoker: a RLS de quem consulta vale) -------------

-- Lista de matrículas com nome do aluno, etapa, turma e alertas.
create or replace view public.vw_matriculas
with (security_invoker = true) as
select
  m.id,
  m.numero,
  m.status,
  m.turno_pretendido,
  m.data_matricula,
  m.created_at,
  m.updated_at,
  m.ano_letivo_id,
  al.ano,
  m.aluno_id,
  p.nome as aluno_nome,
  p.nome_social as aluno_nome_social,
  p.data_nascimento,
  e.id as etapa_id,
  e.nome as etapa_nome,
  t.id as turma_id,
  t.nome as turma_nome,
  (select count(*) from public.documentos_entregues d
     join public.tipos_documento td on td.id = d.tipo_id
     where d.matricula_id = m.id and td.obrigatorio and d.status = 'pendente') as documentos_pendentes
from public.matriculas m
join public.alunos a on a.id = m.aluno_id
join public.pessoas p on p.id = a.pessoa_id
join public.anos_letivos al on al.id = m.ano_letivo_id
join public.etapas e on e.id = m.etapa_id
left join public.turmas t on t.id = m.turma_id;

-- Alertas de saúde e laudo por aluno (cada coluna respeita a RLS da sua tabela).
create or replace view public.vw_alertas_aluno
with (security_invoker = true) as
select
  a.id as aluno_id,
  s.alergias,
  s.medicamento_continuo,
  s.restricao_alimentar,
  coalesce(ae.possui_laudo, false) as possui_laudo
from public.alunos a
left join public.saude_alunos s on s.aluno_id = a.id
left join public.atendimentos_especializados ae on ae.aluno_id = a.id;

grant select on public.vw_matriculas, public.vw_alertas_aluno to authenticated;
revoke all on public.vw_matriculas, public.vw_alertas_aluno from anon;
