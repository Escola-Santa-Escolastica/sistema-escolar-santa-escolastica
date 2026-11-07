import Link from 'next/link';
import { obterSessao } from '@/lib/sessao';
import { SITE, TIPO_PUBLICACAO, dataLocal, dataPorExtenso, diaMes, hora, type Publicacao } from '@/lib/site';
import { Selo } from '@/components/ui';

const LINKS = [
  { href: '/#escola', rotulo: 'A escola' },
  { href: '/#etapas', rotulo: 'Educação Infantil' },
  { href: '/#matriculas', rotulo: 'Matrículas' },
  { href: '/noticias', rotulo: 'Notícias e eventos' },
  { href: '/#contato', rotulo: 'Contato' },
];

function IconePessoa() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

/** Topo do site público, com o botão Entrar (ou "Ir para o sistema" se já estiver logado). */
export async function CabecalhoSite({ atual }: { atual?: 'noticias' }) {
  const sessao = await obterSessao();
  const entrar = sessao
    ? <Link href="/painel" className="site-btn site-btn-entrar"><IconePessoa />Ir para o sistema</Link>
    : <Link href="/entrar" className="site-btn site-btn-entrar" aria-label="Entrar no sistema (famílias e equipe)"><IconePessoa />Entrar</Link>;
  return (
    <>
      <div className="site-faixa-topo">
        <div className="site-largura">
          <span>{SITE.endereco}</span>
          <a href={`tel:${SITE.telefoneLink}`}>{SITE.telefone}</a>
        </div>
      </div>
      <header className="site-cabecalho">
        <div className="site-largura site-cabecalho-inner">
          <Link href="/" className="site-marca">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/emblema.png" alt="" width={52} height={54} />
            <span>
              <span className="site-marca-nome">{SITE.nome}</span>
              <span className="site-marca-lema">{SITE.lema}</span>
            </span>
          </Link>
          <nav aria-label="Site" className="site-nav">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={atual === 'noticias' && l.href === '/noticias' ? 'page' : undefined}>{l.rotulo}</Link>
            ))}
          </nav>
          <div className="site-cabecalho-acoes">
            <Link href="/#contato" className="site-btn site-btn-verde site-so-largo">Agendar uma visita</Link>
            {entrar}
            <details className="site-menu-celular">
              <summary aria-label="Abrir menu">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </summary>
              <nav aria-label="Site (menu)">
                {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.rotulo}</Link>)}
                <Link href="/#contato">Agendar uma visita</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}

export function RodapeSite() {
  return (
    <footer className="site-rodape">
      <div className="site-largura site-rodape-inner">
        <div className="site-marca site-marca-clara">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema.png" alt="" width={52} height={54} />
          <span>
            <span className="site-marca-nome">{SITE.nome}</span>
            <span className="site-marca-lema">{SITE.lema}</span>
          </span>
        </div>
        <nav aria-label="Rodapé" className="site-rodape-links">
          {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.rotulo}</Link>)}
          <Link href="/entrar" className="site-rodape-entrar">Entrar no sistema (famílias e equipe)</Link>
        </nav>
      </div>
      <div className="site-largura site-rodape-legal">
        {[SITE.endereco, SITE.telefone, SITE.cnpj ? `CNPJ ${SITE.cnpj}` : null, SITE.atosAutorizativos].filter(Boolean).join(' · ')}
      </div>
    </footer>
  );
}

/** Capa desenhada (enquanto não há fotos): cor do tipo + brasão. */
export function CapaPublicacao({ tipo, data, grande = false }: { tipo: Publicacao['tipo']; data?: string | null; grande?: boolean }) {
  const dm = data ? diaMes(data) : null;
  return (
    <div className={`site-capa site-capa-${tipo}${grande ? ' site-capa-grande' : ''}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marca/emblema.png" alt="" />
      {dm ? <span className="site-capa-data"><b>{dm.dia}</b>{dm.mes}</span> : null}
    </div>
  );
}

export function dataDaPublicacao(p: Pick<Publicacao, 'tipo' | 'evento_data' | 'publicar_em' | 'created_at'>) {
  if (p.tipo === 'evento' && p.evento_data) return dataPorExtenso(p.evento_data);
  return dataPorExtenso(dataLocal(p.publicar_em ?? p.created_at));
}

export function CartaoPublicacao({ p, destaque = false }: { p: Publicacao; destaque?: boolean }) {
  const t = TIPO_PUBLICACAO[p.tipo];
  return (
    <Link href={`/noticias/${p.slug}`} className={`site-cartao site-cartao-noticia${destaque ? ' site-cartao-destaque' : ''}`}>
      <CapaPublicacao tipo={p.tipo} data={p.tipo === 'evento' ? p.evento_data : null} grande={destaque} />
      <span className="site-cartao-corpo">
        <span className="site-cartao-meta"><Selo tom={t.tom}>{t.rotulo}</Selo>{dataDaPublicacao(p)}</span>
        <span className="site-cartao-titulo">{p.titulo}</span>
        <span className="site-cartao-resumo">{p.resumo}</span>
        {destaque ? <span className="site-ler-mais">Ler mais ›</span> : null}
      </span>
    </Link>
  );
}

export function ItemAgenda({ p }: { p: Publicacao }) {
  const dm = diaMes(p.evento_data!);
  const h = [hora(p.evento_inicio), hora(p.evento_fim)].filter(Boolean).join(' às ');
  return (
    <Link href={`/noticias/${p.slug}`} className="site-agenda-item">
      <span className="site-data-badge"><b>{dm.dia}</b>{dm.mes}</span>
      <span><strong>{p.titulo}</strong><span className="site-agenda-detalhe">{dataPorExtenso(p.evento_data!, true).split(',')[0]}{h ? ` · ${h}` : ''}</span></span>
    </Link>
  );
}
