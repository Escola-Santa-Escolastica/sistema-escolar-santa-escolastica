import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO } from '@/lib/perfis';
import { formatarData, STATUS_MATRICULA, TURNOS, type StatusMatricula, type Turno } from '@/lib/formatos';
import { BotaoLink, Selo } from '@/components/ui';

export const metadata: Metadata = { title: 'Matrículas' };

const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'em_analise', rotulo: 'Em análise' },
  { valor: 'pendente_documento', rotulo: 'Documento pendente' },
  { valor: 'aguardando_aprovacao', rotulo: 'Aguardando direção' },
  { valor: 'matriculado', rotulo: 'Matriculados' },
  { valor: 'encerradas', rotulo: 'Encerradas' },
];

type Linha = {
  id: string; numero: string; status: StatusMatricula; aluno_nome: string; data_nascimento: string | null;
  etapa_nome: string; turno_pretendido: Turno; turma_nome: string | null; documentos_pendentes: number;
};

export default async function Matriculas({ searchParams }: { searchParams: Promise<{ status?: string; busca?: string }> }) {
  const sessao = await exigirSessao(GESTAO);
  const { status = '', busca = '' } = await searchParams;
  const supabase = await criarClienteSupabase();
  const { data: ano } = await supabase.from('anos_letivos').select('id, ano').eq('ativo', true).maybeSingle();

  let consulta = supabase.from('vw_matriculas')
    .select('id, numero, status, aluno_nome, data_nascimento, etapa_nome, turno_pretendido, turma_nome, documentos_pendentes')
    .order('aluno_nome');
  if (ano) consulta = consulta.eq('ano_letivo_id', ano.id);
  if (status === 'encerradas') consulta = consulta.in('status', ['transferido', 'concluido', 'cancelado']);
  else if (status) consulta = consulta.eq('status', status);
  const termo = busca.trim();
  if (termo) consulta = consulta.or(`aluno_nome.ilike.%${termo.replace(/[%,()]/g, '')}%,numero.ilike.%${termo.replace(/[%,()]/g, '')}%`);
  const { data } = await consulta;
  const linhas = (data ?? []) as Linha[];

  const href = (valor: string) => {
    const p = new URLSearchParams();
    if (valor) p.set('status', valor);
    if (termo) p.set('busca', termo);
    const q = p.toString();
    return q ? `/matriculas?${q}` : '/matriculas';
  };

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">{ano ? `Ano letivo ${ano.ano}` : 'Nenhum ano letivo ativo'}</p>
          <h1 className="titulo">Matrículas</h1>
        </div>
        <form role="search" className="busca">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="se-campo busca-campo">
            <label htmlFor="busca" className="se-campo-rotulo">Buscar</label>
            <input id="busca" name="busca" defaultValue={termo} className="se-campo-input" placeholder="Nome ou nº de matrícula" />
          </div>
          <button type="submit" className="se-btn se-btn-secundario se-btn-md">Buscar</button>
        </form>
        {sessao.papeis.includes('secretaria') ? <BotaoLink href="/matriculas/nova" variante="primario">Nova matrícula</BotaoLink> : null}
      </div>

      <nav aria-label="Filtrar por situação" className="filtros">
        {FILTROS.map((f) => (
          <Link key={f.valor} href={href(f.valor)} className="filtro" aria-current={status === f.valor ? 'page' : undefined}>{f.rotulo}</Link>
        ))}
      </nav>

      <section className="painel painel-sem-padding">
        {linhas.length === 0 ? (
          <p className="vazio">{termo || status ? 'Nenhuma matrícula encontrada com esse filtro.' : 'Nenhuma matrícula neste ano letivo ainda.'}</p>
        ) : (
          <div className="tabela-caixa">
            <table className="tabela">
              <caption className="sr-only">Matrículas ({linhas.length})</caption>
              <thead><tr><th>Nº</th><th>Aluno</th><th>Nascimento</th><th>Etapa e turno</th><th>Turma</th><th>Situação</th></tr></thead>
              <tbody>
                {linhas.map((m) => (
                  <tr key={m.id}>
                    <td className="muted">{m.numero}</td>
                    <td><Link className="nome" href={`/matriculas/${m.id}`}>{m.aluno_nome}</Link></td>
                    <td>{formatarData(m.data_nascimento)}</td>
                    <td>{m.etapa_nome} · {TURNOS[m.turno_pretendido]}</td>
                    <td className="muted">{m.turma_nome ?? '—'}</td>
                    <td>
                      <div className="selos">
                        <Selo tom={STATUS_MATRICULA[m.status].tom}>{STATUS_MATRICULA[m.status].rotulo}</Selo>
                        {m.documentos_pendentes > 0 && ['em_analise', 'pendente_documento'].includes(m.status) ? (
                          <Selo tom="dourado">{m.documentos_pendentes} doc. pendente{m.documentos_pendentes > 1 ? 's' : ''}</Selo>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="legenda" style={{ margin: 0 }}>{linhas.length} matrícula{linhas.length === 1 ? '' : 's'}.</p>
    </main>
  );
}
