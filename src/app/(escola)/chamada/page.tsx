import { hojeNaEscola } from '@/lib/hoje';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, temAlgum } from '@/lib/perfis';
import { rotuloDia } from '@/lib/frequencia';
import { Selo } from '@/components/ui';

export const metadata: Metadata = { title: 'Chamada' };

export default async function MinhasTurmas() {
  const sessao = await exigirSessao([...GESTAO, 'professor_regente']);
  const supabase = await criarClienteSupabase();
  const hoje = await hojeNaEscola();
  const eGestao = temAlgum(sessao.papeis, GESTAO);
  const minhas = sessao.atribuicoes.filter((a) => a.papel === 'professor_regente' && a.turma_id).map((a) => a.turma_id!) ;

  const { data: ano } = await supabase.from('anos_letivos').select('id').eq('ativo', true).maybeSingle();
  let consulta = supabase.from('turmas').select('id, nome').eq('ano_letivo_id', ano?.id ?? '00000000-0000-0000-0000-000000000000').order('nome');
  if (!eGestao) consulta = consulta.in('id', minhas.length ? minhas : ['00000000-0000-0000-0000-000000000000']);
  const { data: turmas } = await consulta;
  const lista = turmas ?? [];
  if (!eGestao && lista.length === 1) redirect(`/chamada/${lista[0].id}`);

  const { data: feitas } = await supabase.from('chamadas').select('turma_id, registrada_em').eq('data', hoje);
  const feitaEm = new Map((feitas ?? []).map((c) => [c.turma_id as string, c.registrada_em as string]));

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">{rotuloDia(hoje)}</p>
          <h1 className="titulo">{eGestao ? 'Chamada das turmas' : 'Minhas turmas'}</h1>
        </div>
      </div>
      <section className="painel painel-sem-padding">
        {lista.length === 0 ? (
          <p className="vazio">Nenhuma turma atribuída a você neste ano. Fale com a coordenação.</p>
        ) : (
          <ul className="lista-linhas" style={{ padding: '0 20px' }}>
            {lista.map((t) => (
              <li key={t.id}>
                <Link href={`/chamada/${t.id}`} className="cresce" style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{t.nome}</Link>
                {feitaEm.has(t.id) ? <Selo tom="verde">Chamada feita</Selo> : <Selo tom="dourado">Chamada pendente</Selo>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
