-- =====================================================================
-- 012 · Calendário escolar no site (sem login)
-- O site mostra o período das aulas e os feriados, recessos e dias sem
-- aula do ano letivo ativo. Só isso sai daqui: nenhuma frequência,
-- chamada ou dado de aluno. A tabela continua fechada para visitantes.
-- =====================================================================

create or replace function public.calendario_publico()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ano', a.ano,
    'inicio', a.inicio,
    'fim', a.fim,
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object('data', c.data, 'tipo', c.tipo, 'descricao', c.descricao) order by c.data)
      from public.calendario_dias c
      where c.ano_letivo_id = a.id
    ), '[]'::jsonb)
  )
  from public.anos_letivos a
  where a.ativo
$$;

revoke all on function public.calendario_publico() from public;
grant execute on function public.calendario_publico() to anon, authenticated;
