import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, temAlgum } from '@/lib/perfis';
import { TIPO_PUBLICACAO, VISIBILIDADE, dataLocal, situacaoPublicacao, type Publicacao } from '@/lib/site';
import { formatarDataHora, formatarTelefone } from '@/lib/formatos';
import { Aviso, BotaoLink, Selo } from '@/components/ui';
import { marcarPedido } from './actions';

export const metadata: Metadata = { title: 'Site e notícias' };

type Linha = Pick<Publicacao, 'id' | 'tipo' | 'titulo' | 'slug' | 'status' | 'publicar_em' | 'visibilidade' | 'evento_data' | 'updated_at'> & {
  turmas: { nome: string } | null;
};
type Pedido = { id: string; nome: string; telefone: string; idade_crianca: string | null; atendido: boolean; atendido_em: string | null; created_at: string };

const FILTROS = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'rascunho', rotulo: 'Rascunhos' },
  { valor: 'agendada', rotulo: 'Agendadas' },
  { valor: 'publicada', rotulo: 'No ar' },
] as const;

export default async function SiteEquipe({ searchParams }: { searchParams: Promise<{ filtro?: string; apagada?: string; pedidos?: string }> }) {
  const sessao = await exigirSessao(GESTAO);
  const sp = await searchParams;
  const filtro = FILTROS.find((f) => f.valor === sp.filtro)?.valor ?? '';
  const verAtendidos = sp.pedidos === 'todos';
  const podePublicar = temAlgum(sessao.papeis, ['direcao', 'coordenacao']);
  const supabase = await criarClienteSupabase();

  let pedidosQ = supabase.from('pedidos_visita').select('id, nome, telefone, idade_crianca, atendido, atendido_em, created_at')
    .order('atendido').order('created_at', { ascending: false }).limit(50);
  if (!verAtendidos) pedidosQ = pedidosQ.eq('atendido', false);
  const [{ data: pubs }, { data: peds }] = await Promise.all([
    supabase.from('publicacoes')
      .select('id, tipo, titulo, slug, status, publicar_em, visibilidade, evento_data, updated_at, turmas(nome)')
      .order('updated_at', { ascending: false }).limit(200),
    pedidosQ,
  ]);
  const todas = (pubs ?? []) as unknown as Linha[];
  const linhas = filtro ? todas.filter((p) => situacaoPublicacao(p).chave === filtro) : todas;
  const pedidos = (peds ?? []) as Pedido[];
  const contagem = (chave: string) => todas.filter((p) => situacaoPublicacao(p).chave === chave).length;

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub"><Link href="/" target="_blank">Ver o site da escola ›</Link></p>
          <h1 className="titulo">Site e notícias</h1>
        </div>
        <BotaoLink href="/site/nova" variante="primario">Nova publicação</BotaoLink>
      </div>
      {sp.apagada ? <Aviso tipo="ok">Publicação apagada.</Aviso> : null}
      {!podePublicar ? <Aviso tipo="info">Você pode escrever rascunhos. Quem coloca no ar é a coordenação ou a direção.</Aviso> : null}

      <div className="colunas">
        <div className="coluna-principal">
          <nav aria-label="Filtrar publicações" className="filtros">
            {FILTROS.map((f) => (
              <Link key={f.valor} href={f.valor ? `/site?filtro=${f.valor}` : '/site'} className="filtro" aria-current={filtro === f.valor ? 'page' : undefined}>
                {f.rotulo}{f.valor ? ` (${contagem(f.valor)})` : ''}
              </Link>
            ))}
          </nav>
          <section className="painel painel-sem-padding" aria-label="Publicações">
            {linhas.length === 0 ? (
              <p className="vazio">{filtro ? 'Nenhuma publicação nesta situação.' : 'Nenhuma publicação ainda. Comece pela primeira notícia da escola.'}</p>
            ) : (
              <div className="tabela-caixa">
                <table className="tabela">
                  <caption className="sr-only">Publicações ({linhas.length})</caption>
                  <thead><tr><th>Título</th><th>Tipo</th><th>Quem vê</th><th>Situação</th><th>Atualizada</th></tr></thead>
                  <tbody>
                    {linhas.map((p) => {
                      const s = situacaoPublicacao(p);
                      return (
                        <tr key={p.id}>
                          <td><Link className="nome" href={`/site/${p.id}`}>{p.titulo}</Link>{p.tipo === 'evento' && p.evento_data ? <div className="legenda">Evento em {p.evento_data.split('-').reverse().join('/')}</div> : null}</td>
                          <td>{TIPO_PUBLICACAO[p.tipo].rotulo}</td>
                          <td>{p.visibilidade === 'turma' ? `Turma ${p.turmas?.nome ?? ''}` : VISIBILIDADE[p.visibilidade].replace(' (site público)', '')}</td>
                          <td>
                            <Selo tom={s.tom}>{s.rotulo}</Selo>
                            {s.chave === 'agendada' ? <div className="legenda">{formatarDataHora(p.publicar_em)}</div> : null}
                          </td>
                          <td className="legenda">{dataLocal(p.updated_at).split('-').reverse().join('/')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="coluna-lateral">
          <section className="painel" aria-labelledby="t-pedidos">
            <div className="painel-cab">
              <h2 id="t-pedidos" className="secao-titulo">Pedidos de visita</h2>
              <Link className="legenda" href={verAtendidos ? '/site' : '/site?pedidos=todos'}>{verAtendidos ? 'Só pendentes' : 'Ver atendidos'}</Link>
            </div>
            {pedidos.length === 0 ? (
              <p className="vazio">{verAtendidos ? 'Nenhum pedido recebido.' : 'Nenhum pedido pendente.'}</p>
            ) : (
              <ul className="lista-linhas">
                {pedidos.map((p) => {
                  const tel = formatarTelefone(p.telefone);
                  return (
                    <li key={p.id} className="pedido-visita">
                      <div className="cresce">
                        <strong>{p.nome}</strong>
                        <div><a href={`tel:+55${p.telefone}`}>{tel}</a> · <a href={`https://wa.me/55${p.telefone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></div>
                        <div className="legenda">{p.idade_crianca ? `${p.idade_crianca} · ` : ''}pedido em {formatarDataHora(p.created_at)}</div>
                        {p.atendido ? <div className="legenda">Atendido em {formatarDataHora(p.atendido_em)}</div> : null}
                      </div>
                      <form action={marcarPedido}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="atendido" value={p.atendido ? 'nao' : 'sim'} />
                        <button type="submit" className={`se-btn ${p.atendido ? 'se-btn-texto' : 'se-btn-secundario'} se-btn-sm`}>
                          {p.atendido ? 'Reabrir' : 'Marcar como atendido'}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="legenda" style={{ marginTop: 12 }}>Os contatos chegam pelo formulário “Agende uma visita” do site. Use só para combinar a visita.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
