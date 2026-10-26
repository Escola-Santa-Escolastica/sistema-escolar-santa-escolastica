import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { formatarData, TURNOS, type Turno } from '@/lib/formatos';
import { Botao, Selo } from '@/components/ui';
import { alterarCapacidade, ativarAnoLetivo } from './actions';
import { FormularioAno, FormularioTurma } from './formularios';

export const metadata: Metadata = { title: 'Turmas' };

export default async function Turmas() {
  const sessao = await exigirSessao(['direcao', 'coordenacao', 'secretaria']);
  const podeEditar = sessao.papeis.some((p) => p === 'coordenacao' || p === 'secretaria');
  const supabase = await criarClienteSupabase();

  const [{ data: anos }, { data: etapas }] = await Promise.all([
    supabase.from('anos_letivos').select('id, ano, inicio, fim, ativo').order('ano', { ascending: false }),
    supabase.from('etapas').select('id, nome').order('ordem'),
  ]);
  const ativo = (anos ?? []).find((a) => a.ativo);

  const [{ data: turmas }, { data: ocupacao }] = ativo
    ? await Promise.all([
        supabase.from('turmas').select('id, nome, turno, capacidade, etapa:etapas(nome, ordem)').eq('ano_letivo_id', ativo.id),
        supabase.from('matriculas').select('turma_id').eq('ano_letivo_id', ativo.id).eq('status', 'matriculado').not('turma_id', 'is', null),
      ])
    : [{ data: [] }, { data: [] }];

  type T = { id: string; nome: string; turno: Turno; capacidade: number; etapa: { nome: string; ordem: number } };
  const lista = ((turmas ?? []) as unknown as T[]).sort((a, b) => a.etapa.ordem - b.etapa.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
  const ocupadas = (id: string) => (ocupacao ?? []).filter((o) => o.turma_id === id).length;

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">{ativo ? `Ano letivo ${ativo.ano}` : 'Nenhum ano letivo ativo'}</p>
          <h1 className="titulo">Turmas</h1>
        </div>
      </div>

      <div className="colunas">
        <div className="coluna-principal">
          <section className="painel painel-sem-padding" aria-labelledby="t-turmas">
            <div className="painel-cab"><h2 id="t-turmas" className="secao-titulo">Turmas de {ativo?.ano ?? '—'}</h2></div>
            {lista.length === 0 ? <p className="vazio">Nenhuma turma cadastrada neste ano letivo.</p> : (
              <div className="tabela-caixa">
                <table className="tabela">
                  <thead><tr><th>Turma</th><th>Etapa</th><th>Turno</th><th>Ocupação</th>{podeEditar ? <th>Capacidade</th> : null}</tr></thead>
                  <tbody>
                    {lista.map((t) => {
                      const o = ocupadas(t.id);
                      return (
                        <tr key={t.id}>
                          <td><Link className="nome" href={`/alunos?turma=${t.id}`}>{t.nome}</Link></td>
                          <td>{t.etapa.nome}</td>
                          <td>{TURNOS[t.turno]}</td>
                          <td><Selo tom={o >= t.capacidade ? 'dourado' : 'neutro'}>{o} de {t.capacidade}</Selo></td>
                          {podeEditar ? (
                            <td>
                              <form action={alterarCapacidade} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input type="hidden" name="id" value={t.id} />
                                <label className="sr-only" htmlFor={`cap-${t.id}`}>Capacidade de {t.nome}</label>
                                <input id={`cap-${t.id}`} name="capacidade" type="number" min={Math.max(1, o)} max={60} defaultValue={t.capacidade}
                                  className="se-campo-input" style={{ width: 80, minHeight: 36 }} />
                                <Botao type="submit" tamanho="sm">Salvar</Botao>
                              </form>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="painel" aria-labelledby="t-anos">
            <h2 id="t-anos" className="secao-titulo" style={{ marginBottom: 8 }}>Anos letivos</h2>
            <ul className="lista-linhas">
              {(anos ?? []).map((a) => (
                <li key={a.id}>
                  <div className="cresce">
                    <div style={{ fontWeight: 600 }}>{a.ano}</div>
                    <div className="legenda">{a.inicio ? `${formatarData(a.inicio)} a ${formatarData(a.fim)}` : 'Datas a definir'}</div>
                  </div>
                  {a.ativo ? <Selo tom="verde">Ativo</Selo> : podeEditar ? (
                    <form action={ativarAnoLetivo}>
                      <input type="hidden" name="id" value={a.id} />
                      <Botao type="submit" tamanho="sm">Tornar ativo</Botao>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="legenda" style={{ margin: 0 }}>O ano ativo é o que aparece nas telas e define as turmas que cada professor vê.</p>
          </section>
        </div>
        {podeEditar ? (
          <div className="coluna-lateral">
            {ativo ? <FormularioTurma etapas={etapas ?? []} /> : null}
            <FormularioAno />
          </div>
        ) : null}
      </div>
    </main>
  );
}
