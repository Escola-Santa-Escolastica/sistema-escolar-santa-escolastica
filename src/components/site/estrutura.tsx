import Link from 'next/link';
import { obterSessao } from '@/lib/sessao';
import { SITE, TIPO_PUBLICACAO, dataLocal, dataPorExtenso, diaMes, hora, type Publicacao } from '@/lib/site';
import { Selo } from '@/components/ui';

const LINKS = [
  { href: '/#escola', rotulo: 'A escola' },
  { href: '/#etapas', rotulo: 'Turmas' },
  { href: '/matricula', rotulo: 'Matrículas' },
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
export async function CabecalhoSite({ atual }: { atual?: 'noticias' | 'matricula' | 'calendario-escolar' }) {
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
              <Link key={l.href} href={l.href} aria-current={atual && l.href === `/${atual}` ? 'page' : undefined}>{l.rotulo}</Link>
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
                <Link href="/calendario-escolar">Calendário escolar</Link>
                <Link href="/#contato">Agendar uma visita</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}

function IconeRede({ rede }: { rede: 'instagram' | 'facebook' }) {
  return rede === 'instagram' ? (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
  ) : (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v7h4v-7h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z" /></svg>
  );
}

export function RodapeSite() {
  const redes = ([['instagram', SITE.instagram], ['facebook', SITE.facebook]] as const).filter(([, url]) => url);
  return (
    <footer className="site-rodape">
      <div className="site-largura site-rodape-inner">
        <div className="site-rodape-col site-rodape-marca">
          <div className="site-marca site-marca-clara">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/emblema.png" alt="" width={52} height={54} />
            <span>
              <span className="site-marca-nome">{SITE.nome}</span>
              <span className="site-marca-lema">{SITE.lema}</span>
            </span>
          </div>
          <p>Educação Infantil católica em Itapecerica, do Maternal II ao 2º Período.</p>
          {redes.length ? (
            <div className="site-rodape-redes">
              {redes.map(([rede, url]) => (
                <a key={rede} href={url!} target="_blank" rel="noopener noreferrer" aria-label={rede === 'instagram' ? 'Instagram' : 'Facebook'}><IconeRede rede={rede} /></a>
              ))}
            </div>
          ) : null}
        </div>
        <div className="site-rodape-col">
          <h2>Contato</h2>
          <address>
            {SITE.endereco}{SITE.cep ? ` · CEP ${SITE.cep}` : ''}<br />
            <a href={SITE.mapa} target="_blank" rel="noopener noreferrer">Como chegar ›</a>
          </address>
          <p><a href={`tel:${SITE.telefoneLink}`}>{SITE.telefone}</a> · <a href={SITE.whatsappLink} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
          <p><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
          {SITE.atendimento ? <p>Atendimento: {SITE.atendimento}</p> : null}
        </div>
        <nav aria-label="Rodapé" className="site-rodape-col">
          <h2>Para as famílias</h2>
          <ul>
            <li><Link href="/matricula">Matrículas</Link></li>
            <li><Link href="/calendario-escolar">Calendário escolar</Link></li>
            <li><Link href="/noticias">Notícias e eventos</Link></li>
            <li><Link href="/#contato">Agendar uma visita</Link></li>
            <li><Link href="/entrar" className="site-rodape-entrar">Entrar no sistema (famílias e equipe)</Link></li>
          </ul>
        </nav>
      </div>
      <div className="site-largura site-rodape-legal">
        <span>{[`© ${new Date().getFullYear()} ${SITE.nome}`, SITE.cnpj ? `CNPJ ${SITE.cnpj}` : null, SITE.atosAutorizativos].filter(Boolean).join(' · ')}</span>
        <Link href="/privacidade">Política de privacidade</Link>
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
