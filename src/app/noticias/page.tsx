import type { Metadata } from 'next';
import Link from 'next/link';
import { TIPO_PUBLICACAO, type TipoPublicacao } from '@/lib/site';
import { proximosEventos, publicacoesDoSite } from '@/lib/publicacoes';
import { CabecalhoSite, CartaoPublicacao, ItemAgenda, RodapeSite } from '@/components/site/estrutura';

export const metadata: Metadata = { title: 'Notícias e eventos' };
export const revalidate = 0;

const POR_PAGINA = 13;

export default async function Noticias({ searchParams }: { searchParams: Promise<{ tipo?: string; antes?: string }> }) {
  const sp = await searchParams;
  const tipo = (Object.keys(TIPO_PUBLICACAO) as TipoPublicacao[]).find((t) => t === sp.tipo);
  const antes = sp.antes && !Number.isNaN(Date.parse(sp.antes)) ? sp.antes : undefined;
  const [lista, eventos] = await Promise.all([publicacoesDoSite({ tipo, limite: POR_PAGINA + 1, ate: antes }), proximosEventos(4)]);
  const temMais = lista.length > POR_PAGINA;
  const itens = lista.slice(0, POR_PAGINA);
  const [destaque, ...resto] = antes ? [undefined, ...itens] : itens;
  const filtros: { valor?: TipoPublicacao; rotulo: string }[] = [
    { rotulo: 'Todas' },
    ...(Object.keys(TIPO_PUBLICACAO) as TipoPublicacao[]).map((t) => ({ valor: t, rotulo: TIPO_PUBLICACAO[t].plural })),
  ];
  const href = (t?: string) => (t ? `/noticias?tipo=${t}` : '/noticias');

  return (
    <div className="site">
      <CabecalhoSite atual="noticias" />
      <main className="site-largura site-pagina">
        <div>
          <h1 className="site-titulo-pagina">Notícias e eventos</h1>
          <p className="site-subtitulo-pagina">O que acontece no Instituto: celebrações, projetos das turmas, avisos de matrícula e a agenda aberta à comunidade.</p>
        </div>
        <nav aria-label="Filtrar publicações" className="site-filtros">
          {filtros.map((f) => (
            <Link key={f.rotulo} href={href(f.valor)} className="site-filtro" aria-current={tipo === f.valor ? 'page' : undefined}>{f.rotulo}</Link>
          ))}
        </nav>
        <div className="site-noticias-pagina">
          <div className="site-noticias-lista">
            {itens.length === 0 ? <p className="site-vazio site-cartao">Nenhuma publicação {tipo ? 'nesta categoria ' : ''}ainda.</p> : null}
            {destaque ? <CartaoPublicacao p={destaque} destaque /> : null}
            {resto.length ? <div className="site-grade-cartoes">{resto.map((p) => p && <CartaoPublicacao key={p.id} p={p} />)}</div> : null}
            {temMais ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Link className="site-btn site-btn-entrar" href={`/noticias?${new URLSearchParams({ ...(tipo ? { tipo } : {}), antes: itens[itens.length - 1].publicar_em! })}`}>
                  Ver publicações anteriores
                </Link>
              </div>
            ) : null}
          </div>
          <aside className="site-noticias-lado">
            {eventos.length ? (
              <section aria-labelledby="t-agenda" className="site-cartao site-agenda">
                <h2 id="t-agenda">Agenda</h2>
                {eventos.map((e) => <ItemAgenda key={e.id} p={e} />)}
              </section>
            ) : null}
            <section className="site-aviso-familia">
              <strong>É da família de um aluno?</strong>
              <span>Avisos da turma e a frequência do seu filho ficam na área da família, com login.</span>
              <Link href="/entrar">Entrar na área da família ›</Link>
            </section>
          </aside>
        </div>
      </main>
      <RodapeSite />
    </div>
  );
}
