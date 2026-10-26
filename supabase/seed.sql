-- Dados de teste para o ambiente LOCAL (rodam no `supabase start` / `supabase db reset`).
-- Não vão para produção.

-- Turmas do ano letivo ativo (2027)
insert into public.turmas (ano_letivo_id, etapa_id, nome, turno, capacidade)
select a.id, e.id, e.nome || ' · ' || t.rotulo, t.turno::public.turno, 20
from public.anos_letivos a
cross join public.etapas e
cross join (values ('manha', 'Manhã'), ('tarde', 'Tarde')) as t(turno, rotulo)
where a.ativo
on conflict do nothing;
