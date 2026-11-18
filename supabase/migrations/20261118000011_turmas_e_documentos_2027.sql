-- =====================================================================
-- 011 · Turmas e documentos de 2027, conforme os documentos oficiais da
-- secretaria (listas de material e "Documentos para a matrícula").
--
-- Etapas: Maternal II (2 anos), Maternal III (3), 1º Período (4) e
-- 2º Período (5). "Pré I" e "Pré II" passam a se chamar 1º e 2º Período
-- (mesmo registro: matrículas e turmas continuam ligadas).
-- Documentos: a lista que o sistema cobra passa a ser a da escola.
-- =====================================================================

-- ---------- Etapas ------------------------------------------------------
update public.etapas set nome = '2º Período', ordem = 4 where nome = 'Pré II';
update public.etapas set nome = '1º Período', ordem = 3 where nome = 'Pré I';

insert into public.etapas (nome, modalidade, idade_referencia, ordem)
select v.nome, 'Educação Infantil', v.idade, v.ordem
from (values ('Maternal II', 2, 1), ('Maternal III', 3, 2)) as v (nome, idade, ordem)
where not exists (select 1 from public.etapas e where e.nome = v.nome);

-- Turmas que seguiam o nome padrão "Pré II · Manhã" acompanham a etapa.
update public.turmas set nome = regexp_replace(nome, '^Pré II', '2º Período') where nome like 'Pré II%';
update public.turmas set nome = regexp_replace(nome, '^Pré I', '1º Período') where nome like 'Pré I%';

-- ---------- Documentos da matrícula -------------------------------------
update public.tipos_documento set nome = 'Certidão de nascimento ou identidade do aluno', obrigatorio = true, ordem = 1
  where nome = 'Certidão de nascimento';
update public.tipos_documento set nome = 'CPF do aluno (se houver)', obrigatorio = false, ordem = 2
  where nome = 'CPF ou CIN do aluno';
update public.tipos_documento set nome = 'Caderneta de vacinação', obrigatorio = true, ordem = 3
  where nome = 'Cartão de vacina';
update public.tipos_documento set nome = 'Laudos ou relatórios pedagógicos (se houver)', obrigatorio = false, ordem = 5
  where nome = 'Laudo (se houver)';
update public.tipos_documento set nome = 'Identidade e CPF do responsável legal e financeiro', obrigatorio = true, ordem = 6
  where nome = 'Documento de identidade do responsável';
update public.tipos_documento set nome = 'Comprovante de residência atualizado', obrigatorio = true, ordem = 7
  where nome = 'Comprovante de endereço';

insert into public.tipos_documento (nome, obrigatorio, ordem)
select v.nome, v.obrigatorio, v.ordem
from (values
  ('Carteirinha do convênio ou Cartão SUS', true, 4),
  ('Termo de guarda, tutela ou procuração (se aplicável)', false, 8)
) as v (nome, obrigatorio, ordem)
where not exists (select 1 from public.tipos_documento t where t.nome = v.nome);

-- Fora da lista da escola: sai do checklist de todas as matrículas.
delete from public.documentos_entregues d
using public.tipos_documento t
where t.id = d.tipo_id and t.nome in ('Foto 3x4', 'Declaração de transferência (se veio de outra escola)');
delete from public.tipos_documento
where nome in ('Foto 3x4', 'Declaração de transferência (se veio de outra escola)');

-- Documentos novos entram no checklist das matrículas que ainda estão sendo
-- conferidas. As que já foram para a direção ou aprovadas não mudam.
insert into public.documentos_entregues (matricula_id, tipo_id)
select m.id, t.id
from public.matriculas m
cross join public.tipos_documento t
where t.nome in ('Carteirinha do convênio ou Cartão SUS', 'Termo de guarda, tutela ou procuração (se aplicável)')
  and m.status in ('pre_matricula', 'em_analise', 'pendente_documento')
on conflict (matricula_id, tipo_id) do nothing;
