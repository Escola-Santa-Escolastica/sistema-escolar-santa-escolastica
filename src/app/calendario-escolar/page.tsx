import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE, dataPorExtenso } from '@/lib/site';
import { calendarioPublico, proximosEventos } from '@/lib/publicacoes';
import { ddmm, diaDaSemana, diasNoMes, eDiaLetivo, isoDe, NOMES_MES, TIPOS_DIA, type AnoLetivo, type DiaCalendario, type TipoDia } from '@/lib/frequencia';
import { CabecalhoSite, ItemAgenda, RodapeSite } from '@/components/site/estrutura';
import { BotaoImprimir } from '@/components/botao-imprimir';

export const metadata: Metadata = {
  title: 'Calendário escolar',
  description: 'Início e fim das aulas, feriados, recessos e dias sem aula do ano letivo.',
};
export const revalidate = 0;

const CLASSE: Record<TipoDia, string> = { feriado: 'd d-f', recesso: 'd d-r', sem_aula: 'd d-s', evento: 'd d-l d-e' };

/** Calendário do ano letivo, lido do sistema (o mesmo que a equipe edita em Calendário). */
export default async function CalendarioEscolar() {
  const [cal, eventos] = await Promise.all([calendarioPublico(), proximosEventos(6)]);
  const ano = cal?.ano ?? SITE.matriculas.ano;
  const definido = Boolean(cal?.inicio && cal?.fim);
  const dias = (cal?.dias ?? []) as DiaCalendario[];
  const ex = new Map(dias.map((d) => [d.data, d]));
  const anoLetivo: AnoLetivo = { id: '', ano, inicio: cal?.inicio ?? null, fim: cal?.fim ?? null };

  const meses: { a: number; m: number }[] = [];
  if (definido) {
    let a = Number(cal!.inicio!.slice(0, 4)), m = Number(cal!.inicio!.slice(5, 7));
    const af = Number(cal!.fim!.slice(0, 4)), mf = Number(cal!.fim!.slice(5, 7));
    while ((a < af || (a === af && m <= mf)) && meses.length < 14) {
      meses.push({ a, m });
      m++; if (m > 12) { m = 1; a++; }
    }
  }

  let total = 0;
  const grades = meses.map(({ a, m }) => {
    const celulas: { chave: string; n?: number; classe: string; rotulo?: string }[] = [];
    for (let i = 0; i < diaDaSemana(isoDe(a, m, 1)); i++) celulas.push({ chave: `v${i}`, classe: 'd' });
    let letivos = 0;
    for (let d = 1; d <= diasNoMes(a, m); d++) {
      const iso = isoDe(a, m, d);
      const dow = diaDaSemana(iso);
      const util = dow > 0 && dow < 6;
      const noPeriodo = iso >= cal!.inicio! && iso <= cal!.fim!;
      const e = ex.get(iso);
      if (util && noPeriodo && eDiaLetivo(iso, anoLetivo, ex)) {
        letivos++;
        celulas.push({ chave: iso, n: d, classe: e ? CLASSE.evento : 'd d-l', rotulo: `${ddmm(iso)}: dia de aula${e ? ` · ${e.descricao}` : ''}` });
      } else {
        celulas.push({ chave: iso, n: d, classe: e && util ? CLASSE[e.tipo] : 'd', rotulo: e ? `${ddmm(iso)}: ${e.descricao}` : undefined });
      }
    }
    total += letivos;
    return { chave: `${a}-${m}`, nome: NOMES_MES[m - 1].replace(/^./, (c) => c.toUpperCase()) + (a !== ano ? ` ${a}` : ''), letivos, celulas };
  });

  // Dias seguidos com o mesmo tipo e descrição viram um período.
  const grupos: { tipo: TipoDia; descricao: string; de: string; ate: string; n: number }[] = [];
  dias.filter((d) => d.tipo !== 'evento').forEach((d) => {
    const g = grupos.find((x) => x.tipo === d.tipo && x.descricao === d.descricao);
    if (g) { g.ate = d.data; g.n++; } else grupos.push({ tipo: d.tipo, descricao: d.descricao, de: d.data, ate: d.data, n: 1 });
  });

  return (
    <div className="site">
      <CabecalhoSite atual="calendario-escolar" />
      <main className="site-largura site-pagina">
        <div className="site-titulo-linha">
          <div>
            <h1 className="site-titulo-pagina">Calendário escolar {ano}</h1>
            <p className="site-subtitulo-pagina">
              {definido
                ? <>Aulas de <strong>{dataPorExtenso(cal!.inicio!)}</strong> a <strong>{dataPorExtenso(cal!.fim!)}</strong>, com {total} dias letivos.</>
                : `O calendário de ${ano} será publicado aqui assim que a escola definir as datas.`}
            </p>
          </div>
          {definido ? <BotaoImprimir>Imprimir calendário</BotaoImprimir> : null}
        </div>

        <div className="site-cal">
          <div className="site-cal-meses">
            {definido ? (
              <>
                <div className="legenda-freq" aria-label="Legenda">
                  <span><span className="d d-l" aria-hidden="true" />Dia de aula</span>
                  <span><span className="d d-f" aria-hidden="true" />Feriado</span>
                  <span><span className="d d-r" aria-hidden="true" />Recesso</span>
                  <span><span className="d d-s" aria-hidden="true" />Sem aula</span>
                  <span><span className="d d-l d-e" aria-hidden="true" />Data especial com aula</span>
                </div>
                <div className="meses-ano">
                  {grades.map((g) => (
                    <section key={g.chave} className="mes-ano site-cartao" aria-label={g.nome}>
                      <div className="site-cal-mes-topo"><strong>{g.nome}</strong><span className="legenda">{g.letivos} {g.letivos === 1 ? 'dia' : 'dias'}</span></div>
                      <div className="mes-ano-grade">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((s, i) => <span key={i} aria-hidden="true">{s}</span>)}
                        {g.celulas.map((c) => (
                          <span key={c.chave} className={c.classe} title={c.rotulo}>
                            {c.n}{c.rotulo ? <span className="sr-only"> {c.rotulo}</span> : null}
                          </span>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : <p className="site-vazio site-cartao">Ainda não há datas publicadas para {ano}.</p>}
          </div>

          <aside className="site-noticias-lado">
            <section aria-labelledby="t-datas" className="site-cartao site-agenda">
              <h2 id="t-datas">Feriados e dias sem aula</h2>
              {grupos.length === 0 ? <p className="site-nota">Nenhuma data cadastrada ainda.</p> : (
                <ul className="site-cal-datas">
                  {grupos.map((g) => (
                    <li key={`${g.tipo}|${g.descricao}|${g.de}`}>
                      <span className="site-cal-quando">{g.de === g.ate ? ddmm(g.de) : `${ddmm(g.de)} a ${ddmm(g.ate)}`}</span>
                      <span><strong>{g.descricao}</strong><span className="site-agenda-detalhe">{TIPOS_DIA[g.tipo]}{g.n > 1 ? ` · ${g.n} dias` : ''}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="site-aviso-familia">
              <strong>Antes do início das aulas</strong>
              <span>Entrega dos materiais e reuniões de pais de cada turma em janeiro.</span>
              <Link href="/matricula#antes-das-aulas">Ver as datas de janeiro ›</Link>
            </section>
            {eventos.length ? (
              <section aria-labelledby="t-eventos" className="site-cartao site-agenda">
                <h2 id="t-eventos">Próximos eventos</h2>
                {eventos.map((e) => <ItemAgenda key={e.id} p={e} />)}
              </section>
            ) : null}
          </aside>
        </div>
      </main>
      <RodapeSite />
    </div>
  );
}
