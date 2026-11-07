import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { proximosEventos, publicacoesDoSite } from '@/lib/publicacoes';
import { CabecalhoSite, CartaoPublicacao, ItemAgenda, RodapeSite } from '@/components/site/estrutura';
import { FormVisita } from '@/components/site/form-visita';

export const metadata: Metadata = {
  title: { absolute: `${SITE.nome} · Educação Infantil católica em Itapecerica` },
  description: SITE.subtitulo,
};
export const revalidate = 0;

/** Página inicial do site (sem login). */
export default async function SiteInicio() {
  const [noticias, eventos] = await Promise.all([publicacoesDoSite({ limite: 3 }), proximosEventos(3)]);

  return (
    <div className="site">
      <CabecalhoSite />

      <section aria-labelledby="t-hero" className="site-hero">
        <div className="site-largura site-hero-inner">
          <div className="site-hero-texto">
            <span className="site-sobrelinha site-sobrelinha-ouro">EDUCAÇÃO INFANTIL CATÓLICA · {SITE.cidade.toUpperCase()}</span>
            <h1 id="t-hero">{SITE.chamada}</h1>
            <p>{SITE.subtitulo}</p>
            <div className="site-hero-acoes">
              <Link href="#matriculas" className="site-btn site-btn-ouro">Matrículas {SITE.matriculas.ano}</Link>
              <Link href="#contato" className="site-btn site-btn-claro">Conhecer a escola</Link>
            </div>
          </div>
          <div className="site-hero-brasao" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/emblema-completo.png" alt="" />
          </div>
        </div>
      </section>

      <section id="matriculas" aria-label="Matrículas" className="site-faixa-matriculas">
        <div className="site-largura">
          <strong>Matrículas {SITE.matriculas.ano}</strong>
          <span>
            {SITE.etapas.map((e) => `${e.nome} (${e.idade} anos)`).join(' e ')}, manhã ou tarde.{' '}
            {SITE.matriculas.periodo ? <>Período de matrícula: <strong>{SITE.matriculas.periodo}</strong>.</> : 'Período de matrícula: em breve.'}
          </span>
          <Link href="#contato" className="site-btn site-btn-verde">Quero saber mais</Link>
        </div>
      </section>

      <main>
        <section id="escola" aria-labelledby="t-escola" className="site-largura site-secao site-escola">
          <span className="site-sobrelinha">A ESCOLA</span>
          <h2 id="t-escola">{SITE.apresentacaoTitulo}</h2>
          {SITE.apresentacao.map((p, i) => <p key={i}>{p}</p>)}
        </section>

        <section aria-label="Nossos pilares" className="site-largura site-pilares">
          {SITE.pilares.map((p) => (
            <article key={p.nome} className={`site-cartao site-pilar site-pilar-${p.cor}`}>
              <h3>{p.nome}</h3>
              <p>{p.texto}</p>
            </article>
          ))}
        </section>

        <section id="etapas" aria-labelledby="t-etapas" className="site-faixa-clara">
          <div className="site-largura site-secao">
            <span className="site-sobrelinha">EDUCAÇÃO INFANTIL</span>
            <h2 id="t-etapas">Duas etapas, um mesmo cuidado.</h2>
            <div className="site-etapas">
              {SITE.etapas.map((e, i) => (
                <article key={e.nome} className={`site-etapa ${i === 0 ? 'site-etapa-verde' : 'site-etapa-azul'}`}>
                  <span className="site-etapa-idade">{e.idade}</span>
                  <div><h3>{e.nome} · {e.idade} anos</h3><p>{e.texto}</p></div>
                </article>
              ))}
            </div>
            <p className="site-nota">{SITE.turnos}</p>
          </div>
        </section>

        <section aria-labelledby="t-noticias" className="site-largura site-secao">
          <div className="site-titulo-linha">
            <div>
              <span className="site-sobrelinha">ACONTECE NA ESCOLA</span>
              <h2 id="t-noticias">Notícias e eventos</h2>
            </div>
            <Link href="/noticias" className="site-link-forte">Ver todas as notícias ›</Link>
          </div>
          <div className="site-noticias-home">
            {noticias.length ? (
              <div className="site-grade-cartoes">{noticias.map((p) => <CartaoPublicacao key={p.id} p={p} />)}</div>
            ) : <p className="site-vazio">As primeiras notícias da escola aparecem aqui em breve.</p>}
            {eventos.length ? (
              <aside aria-labelledby="t-agenda" className="site-cartao site-agenda">
                <h3 id="t-agenda">Próximos eventos</h3>
                {eventos.map((e) => <ItemAgenda key={e.id} p={e} />)}
              </aside>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="t-padroeira" className="site-padroeira">
          <div className="site-largura">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/emblema.png" alt="Brasão do Instituto Santa Escolástica" width={150} height={156} />
            <div>
              <span className="site-sobrelinha site-sobrelinha-ouro">NOSSA PADROEIRA</span>
              <h2 id="t-padroeira">Santa Escolástica</h2>
              <p>{SITE.padroeira}</p>
            </div>
          </div>
        </section>

        <section id="contato" aria-labelledby="t-contato" className="site-largura site-secao site-contato">
          <div className="site-contato-texto">
            <span className="site-sobrelinha">VENHA NOS CONHECER</span>
            <h2 id="t-contato">Agende uma visita</h2>
            <p>Deixe seu contato e a secretaria liga para combinar um horário. Você conhece as salas, a proposta e tira suas dúvidas sobre a matrícula.</p>
            <dl>
              <div><dt>Endereço</dt><dd>{SITE.endereco}</dd></div>
              <div><dt>Telefone e WhatsApp</dt><dd><a href={`tel:${SITE.telefoneLink}`}>{SITE.telefone}</a> · <a href={SITE.whatsappLink}>conversar no WhatsApp</a></dd></div>
              {SITE.atendimento ? <div><dt>Atendimento</dt><dd>{SITE.atendimento}</dd></div> : null}
            </dl>
          </div>
          <div className="site-cartao site-visita"><FormVisita /></div>
        </section>
      </main>

      <RodapeSite />
    </div>
  );
}
