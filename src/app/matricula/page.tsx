import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE, dataPorExtenso, diaMes } from '@/lib/site';
import {
  DOCUMENTOS_MATRICULA_2027, ENTREGA_MATERIAIS_2027, INFORMACOES_UTEIS_2027, LISTAS_MATERIAL_2027,
  PDF_DOCUMENTOS_2027, REUNIOES_PAIS_2027, UNIFORME_2027, pdfDaLista,
} from '@/lib/matriculas-2027';
import { CabecalhoSite, RodapeSite } from '@/components/site/estrutura';

export const metadata: Metadata = {
  title: `Matrículas ${SITE.matriculas.ano}`,
  description: 'Documentos para a matrícula, listas de material de cada turma, entrega dos materiais, reuniões de pais e uniforme.',
};

const SECOES = [
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'listas', rotulo: 'Listas de material' },
  { id: 'antes-das-aulas', rotulo: 'Antes das aulas' },
  { id: 'uniforme', rotulo: 'Uniforme' },
];

function IconePdf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}

/** Matrículas: tudo o que a família precisa antes do primeiro dia (sem login). */
export default function Matriculas() {
  const ano = SITE.matriculas.ano;
  const turmas = LISTAS_MATERIAL_2027.map((l) => ({ ...l, etapa: SITE.etapas.find((e) => e.lista === l.slug) }));
  const [diaA, diaB] = ENTREGA_MATERIAIS_2027.dias;

  return (
    <div className="site">
      <CabecalhoSite atual="matricula" />

      <section aria-labelledby="t-matriculas" className="site-mat-topo">
        <div className="site-largura">
          <nav aria-label="Caminho" className="caminho caminho-claro"><Link href="/">Início</Link> / Matrículas {ano}</nav>
          <span className="site-sobrelinha site-sobrelinha-ouro">EDUCAÇÃO INFANTIL · MATERNAL II AO 2º PERÍODO</span>
          <h1 id="t-matriculas">Matrículas {ano}</h1>
          <p>
            O que levar no dia da matrícula, a lista de material de cada turma e as datas de janeiro.
            {SITE.matriculas.periodo ? <> Período de matrícula: <strong>{SITE.matriculas.periodo}</strong>.</> : null}
          </p>
          <div className="site-hero-acoes">
            <Link href="/#contato" className="site-btn site-btn-ouro">Agendar uma visita</Link>
            <a href={SITE.whatsappLink} className="site-btn site-btn-claro" target="_blank" rel="noopener noreferrer">Falar com a secretaria</a>
          </div>
          <nav aria-label="Nesta página" className="site-mat-atalhos">
            {SECOES.map((s) => <a key={s.id} href={`#${s.id}`}>{s.rotulo}</a>)}
          </nav>
        </div>
      </section>

      <main>
        <section id="documentos" aria-labelledby="t-documentos" className="site-largura site-secao">
          <div className="site-titulo-linha">
            <div>
              <span className="site-sobrelinha">PARA O DIA DA MATRÍCULA</span>
              <h2 id="t-documentos">Documentos necessários</h2>
            </div>
            <a href={PDF_DOCUMENTOS_2027} className="site-btn site-btn-entrar" download>
              <IconePdf /> Baixar em PDF
            </a>
          </div>
          <div className="site-mat-docs">
            <article className="site-cartao site-mat-doc">
              <h3>Da criança</h3>
              <ul className="site-mat-check">{DOCUMENTOS_MATRICULA_2027.crianca.map((d) => <li key={d}>{d}</li>)}</ul>
            </article>
            <article className="site-cartao site-mat-doc">
              <h3>Dos pais ou responsáveis</h3>
              <ul className="site-mat-check">{DOCUMENTOS_MATRICULA_2027.responsaveis.map((d) => <li key={d}>{d}</li>)}</ul>
            </article>
          </div>
          <p className="site-mat-contrato">{DOCUMENTOS_MATRICULA_2027.contrato}</p>
          <div className="site-mat-atencao" role="note"><strong>Atenção.</strong> {DOCUMENTOS_MATRICULA_2027.atencao}</div>
        </section>

        <section id="listas" aria-labelledby="t-listas" className="site-faixa-clara">
          <div className="site-largura site-secao">
            <span className="site-sobrelinha">MATERIAL ESCOLAR {ano}</span>
            <h2 id="t-listas">Listas de material por turma</h2>
            <p className="site-mat-intro">Baixe a lista oficial da turma do seu filho ou confira os itens aqui mesmo.</p>
            <div className="site-mat-listas">
              {turmas.map((t) => (
                <article key={t.slug} id={`lista-${t.slug}`} className="site-cartao site-mat-lista">
                  <div className="site-mat-lista-cab">
                    {t.etapa ? <span className="site-etapa-idade" aria-hidden="true">{t.etapa.idade}</span> : null}
                    <div>
                      <h3>{t.nome}</h3>
                      <span className="site-mat-lista-info">
                        {t.etapa ? `${t.etapa.idade} anos · ` : ''}{t.coletivo.length} itens coletivos · {t.pessoal.length} de uso pessoal
                      </span>
                    </div>
                  </div>
                  <a href={pdfDaLista(t.slug)} className="site-btn site-btn-verde" download>
                    <IconePdf /> Baixar lista em PDF
                  </a>
                  <details className="site-mat-detalhes">
                    <summary>Ver a lista na página</summary>
                    <div className="site-mat-tabelas">
                    <table className="site-mat-tabela">
                      <caption className="sr-only">Material coletivo · {t.nome}</caption>
                      <thead><tr><th scope="col">Qtde</th><th scope="col">Material coletivo</th></tr></thead>
                      <tbody>{t.coletivo.map(([q, d]) => <tr key={d}><td>{String(q).padStart(2, '0')}</td><td>{d}</td></tr>)}</tbody>
                    </table>
                    <table className="site-mat-tabela">
                      <caption className="sr-only">Uso pessoal · {t.nome}</caption>
                      <thead><tr><th scope="col">Qtde</th><th scope="col">Uso pessoal</th></tr></thead>
                      <tbody>{t.pessoal.map(([q, d]) => <tr key={d}><td>{String(q).padStart(2, '0')}</td><td>{d}</td></tr>)}</tbody>
                    </table>
                    </div>
                  </details>
                </article>
              ))}
            </div>
            <ul className="site-mat-uteis">
              {INFORMACOES_UTEIS_2027.map((i) => <li key={i.titulo}><strong>{i.titulo}.</strong> {i.texto}</li>)}
            </ul>
          </div>
        </section>

        <section id="antes-das-aulas" aria-labelledby="t-antes" className="site-largura site-secao">
          <span className="site-sobrelinha">JANEIRO DE {ano}</span>
          <h2 id="t-antes">Antes das aulas</h2>
          <div className="site-mat-antes">
            <article className="site-cartao site-mat-bloco">
              <h3>Entrega dos materiais</h3>
              <div className="site-mat-datas">
                {[diaA, diaB].map((d) => {
                  const dm = diaMes(d);
                  return <span key={d} className="site-data-badge"><b>{dm.dia}</b>{dm.mes}</span>;
                })}
              </div>
              <p>
                <strong>{diaMes(diaA).dia} e {dataPorExtenso(diaB).replace(/ de \d{4}$/, '')}</strong> ({dataPorExtenso(diaA, true).split('-')[0].toLowerCase()} e {dataPorExtenso(diaB, true).split(',')[0].toLowerCase()}), {ENTREGA_MATERIAIS_2027.horario}.
              </p>
              <p>Os materiais de uso coletivo são entregues na escola. {ENTREGA_MATERIAIS_2027.texto}</p>
            </article>
            <article className="site-cartao site-mat-bloco">
              <h3>Primeira reunião de pais</h3>
              <p>{REUNIOES_PAIS_2027.texto}</p>
              <ul className="site-mat-reunioes">
                {REUNIOES_PAIS_2027.datas.map((r) => {
                  const dm = diaMes(r.data);
                  return (
                    <li key={r.turma}>
                      <span className="site-data-badge"><b>{dm.dia}</b>{dm.mes}</span>
                      <span><strong>{r.turma}</strong><span className="site-agenda-detalhe">{dataPorExtenso(r.data, true).split(',')[0]}, às {r.hora}</span></span>
                    </li>
                  );
                })}
              </ul>
            </article>
          </div>
        </section>

        <section id="uniforme" aria-labelledby="t-uniforme" className="site-faixa-clara">
          <div className="site-largura site-secao">
            <span className="site-sobrelinha">NO DIA A DIA</span>
            <h2 id="t-uniforme">Uniforme</h2>
            <div className="site-mat-antes">
              <article className="site-cartao site-mat-bloco">
                <h3>Peças</h3>
                <dl className="site-mat-uniforme">
                  {UNIFORME_2027.pecas.map((p) => <div key={p.para}><dt>{p.para}</dt><dd>{p.itens[0].toUpperCase() + p.itens.slice(1)}.</dd></div>)}
                </dl>
              </article>
              <article className="site-cartao site-mat-bloco">
                <h3>Calçado e pedido</h3>
                <p>{UNIFORME_2027.calcado}</p>
                <p>{UNIFORME_2027.pedido}</p>
              </article>
            </div>
          </div>
        </section>

        <section aria-labelledby="t-duvidas" className="site-largura site-secao site-mat-duvidas">
          <h2 id="t-duvidas">Ficou alguma dúvida?</h2>
          <p>
            Fale com a secretaria pelo <a href={SITE.whatsappLink} target="_blank" rel="noopener noreferrer">WhatsApp {SITE.telefone}</a>,
            pelo e-mail <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ou venha nos visitar: {SITE.endereco}.
          </p>
          <div><Link href="/#contato" className="site-btn site-btn-verde">Agendar uma visita</Link></div>
        </section>
      </main>

      <RodapeSite />
    </div>
  );
}
