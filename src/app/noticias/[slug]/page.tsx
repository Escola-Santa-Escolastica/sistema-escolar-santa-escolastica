import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE, TIPO_PUBLICACAO, dataLocal, dataPorExtenso, hora } from '@/lib/site';
import { publicacaoPorSlug, publicacoesDoSite } from '@/lib/publicacoes';
import { CabecalhoSite, CapaPublicacao, RodapeSite, dataDaPublicacao } from '@/components/site/estrutura';
import { BotaoCopiarLink } from '@/components/site/copiar-link';
import { Selo } from '@/components/ui';

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await publicacaoPorSlug((await params).slug);
  return p ? { title: p.titulo, description: p.resumo, openGraph: { title: p.titulo, description: p.resumo } } : { title: 'Notícia' };
}

/** Uma notícia, evento ou comunicado do site. */
export default async function Noticia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) notFound();
  const p = await publicacaoPorSlug(slug);
  if (!p) notFound();
  const outras = (await publicacoesDoSite({ limite: 4 })).filter((x) => x.id !== p.id).slice(0, 3);
  const t = TIPO_PUBLICACAO[p.tipo];
  const paragrafos = p.texto.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const horario = [hora(p.evento_inicio), hora(p.evento_fim)].filter(Boolean).join(' às ');
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  const link = `${siteUrl}/noticias/${p.slug}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${p.titulo} — ${link}`)}`;

  return (
    <div className="site">
      <CabecalhoSite atual="noticias" />
      <main className="site-largura site-pagina">
        <nav aria-label="Caminho" className="caminho"><Link href="/">Início</Link> / <Link href="/noticias">Notícias e eventos</Link> / {p.titulo}</nav>
        <div className="site-noticia">
          <article className="site-noticia-artigo">
            <div className="site-cartao-meta"><Selo tom={t.tom}>{t.rotulo}</Selo>Publicado em {dataPorExtenso(dataLocal(p.publicar_em ?? p.created_at))}</div>
            <h1 className="site-titulo-pagina">{p.titulo}</h1>
            <p className="site-noticia-resumo">{p.resumo}</p>
            <CapaPublicacao tipo={p.tipo} data={p.tipo === 'evento' ? p.evento_data : null} grande />
            <div className="site-noticia-texto">{paragrafos.map((x, i) => <p key={i}>{x}</p>)}</div>
            <div className="site-compartilhar">
              <span>Compartilhar</span>
              <a href={whatsapp} className="site-btn site-btn-entrar" target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <BotaoCopiarLink url={link} />
            </div>
          </article>
          <aside className="site-noticias-lado">
            {p.tipo === 'evento' && p.evento_data ? (
              <section aria-labelledby="t-quando" className="site-cartao site-quando">
                <h2 id="t-quando">Quando e onde</h2>
                <dl>
                  <div><dt>Data</dt><dd>{dataPorExtenso(p.evento_data, true)}</dd></div>
                  {horario ? <div><dt>Horário</dt><dd>{horario}</dd></div> : null}
                  <div><dt>Local</dt><dd>{p.evento_local || `${SITE.nome} · ${SITE.endereco}`}</dd></div>
                </dl>
                <a className="site-btn site-btn-verde" href={`/noticias/${p.slug}/agenda.ics`}>Adicionar à minha agenda</a>
              </section>
            ) : null}
            {outras.length ? (
              <section aria-labelledby="t-mais" className="site-cartao site-agenda">
                <h2 id="t-mais">Mais publicações</h2>
                {outras.map((o) => (
                  <Link key={o.id} href={`/noticias/${o.slug}`} className="site-agenda-item site-mais-item">
                    <span><strong>{o.titulo}</strong><span className="site-agenda-detalhe">{TIPO_PUBLICACAO[o.tipo].rotulo} · {dataDaPublicacao(o)}</span></span>
                  </Link>
                ))}
              </section>
            ) : null}
          </aside>
        </div>
      </main>
      <RodapeSite />
    </div>
  );
}
