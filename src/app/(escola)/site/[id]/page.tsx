import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, temAlgum } from '@/lib/perfis';
import { formatarDataHora } from '@/lib/formatos';
import { situacaoPublicacao, type Publicacao } from '@/lib/site';
import { Aviso, Selo } from '@/components/ui';
import { EditorPublicacao } from '../editor';
import { turmasAtivas } from '../turmas';
import { apagarPublicacao } from '../actions';

export const metadata: Metadata = { title: 'Editar publicação' };

const MENSAGEM: Record<string, string> = {
  rascunho: 'Rascunho salvo. Ainda não aparece para ninguém fora da equipe.',
  publicada: 'Publicado! Já está no ar.',
  agendada: 'Agendado. Vai ao ar sozinho no horário escolhido.',
};

export default async function EditarPublicacao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const sessao = await exigirSessao(GESTAO);
  const { id } = await params;
  const { salvo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await criarClienteSupabase();
  const [{ data }, turmas] = await Promise.all([
    supabase.from('publicacoes')
      .select('id, tipo, titulo, slug, resumo, texto, evento_data, evento_inicio, evento_fim, evento_local, visibilidade, turma_id, status, publicar_em, created_at, updated_at')
      .eq('id', id).maybeSingle(),
    turmasAtivas(),
  ]);
  if (!data) notFound();
  const p = data as Publicacao;
  const podePublicar = temAlgum(sessao.papeis, ['direcao', 'coordenacao']);
  const s = situacaoPublicacao(p);
  const noSite = s.chave === 'publicada' && p.visibilidade === 'publico';

  return (
    <main className="pagina">
      <nav aria-label="Caminho" className="caminho"><Link href="/site">Site e notícias</Link> / {p.titulo}</nav>
      <div className="topo">
        <div className="topo-texto">
          <h1 className="titulo">{p.titulo}</h1>
          <p className="topo-sub">
            <Selo tom={s.tom}>{s.rotulo}</Selo>{' '}
            {s.chave === 'agendada' ? `Vai ao ar em ${formatarDataHora(p.publicar_em)}. ` : null}
            {s.chave === 'publicada' ? `No ar desde ${formatarDataHora(p.publicar_em)}. ` : null}
            {noSite ? <Link href={`/noticias/${p.slug}`} target="_blank">Ver no site ›</Link> : null}
          </p>
        </div>
      </div>
      {salvo && MENSAGEM[salvo] ? <Aviso tipo="ok">{MENSAGEM[salvo]}</Aviso> : null}
      <EditorPublicacao
        key={p.updated_at}
        inicial={p}
        turmas={turmas}
        podePublicar={podePublicar}
        bloqueada={p.status === 'publicada' && !podePublicar}
      />
      {podePublicar ? (
        <details className="painel zona-perigo">
          <summary>Apagar esta publicação</summary>
          <p>Ela sai do site e da área da família, e o link deixa de funcionar. Não dá para desfazer.</p>
          <form action={apagarPublicacao}>
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" className="se-btn se-btn-perigo se-btn-sm">Apagar definitivamente</button>
          </form>
        </details>
      ) : null}
    </main>
  );
}
