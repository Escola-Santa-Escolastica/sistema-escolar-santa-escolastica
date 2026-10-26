import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { FichaMatricula } from './ficha';

export const metadata: Metadata = { title: 'Nova matrícula' };

export default async function NovaMatricula() {
  await exigirSessao(['secretaria']);
  const supabase = await criarClienteSupabase();
  const [{ data: etapas }, { data: ano }] = await Promise.all([
    supabase.from('etapas').select('id, nome').order('ordem'),
    supabase.from('anos_letivos').select('ano').eq('ativo', true).maybeSingle(),
  ]);

  return (
    <main className="pagina pagina-estreita">
      <nav aria-label="Caminho" className="caminho"><Link href="/matriculas">Matrículas</Link> / Nova</nav>
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">Ficha Individual do Aluno</p>
          <h1 className="titulo">Nova matrícula</h1>
        </div>
      </div>
      {!ano ? (
        <div className="painel-dourado"><strong>Nenhum ano letivo ativo.</strong> Ative um ano letivo em Turmas antes de matricular.</div>
      ) : (
        <FichaMatricula etapas={etapas ?? []} ano={ano.ano} />
      )}
    </main>
  );
}
