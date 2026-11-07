import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { GESTAO, temAlgum } from '@/lib/perfis';
import { EditorPublicacao } from '../editor';
import { turmasAtivas } from '../turmas';

export const metadata: Metadata = { title: 'Nova publicação' };

export default async function NovaPublicacao() {
  const sessao = await exigirSessao(GESTAO);
  const turmas = await turmasAtivas();
  return (
    <main className="pagina">
      <nav aria-label="Caminho" className="caminho"><Link href="/site">Site e notícias</Link> / Nova publicação</nav>
      <h1 className="titulo">Nova publicação</h1>
      <EditorPublicacao turmas={turmas} podePublicar={temAlgum(sessao.papeis, ['direcao', 'coordenacao'])} />
    </main>
  );
}
