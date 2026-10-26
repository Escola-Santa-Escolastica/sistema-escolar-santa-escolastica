import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO } from '@/lib/perfis';
import { formatarData, formatarDataHora, idadeEmAnos, STATUS_MATRICULA, TURNOS, type StatusMatricula, type Turno } from '@/lib/formatos';
import { Aviso, Botao, CartaoAluno, Selo, alertasDe, BotaoLink } from '@/components/ui';
import { enturmar, marcarDocumento, mudarStatus } from '../actions';

export const metadata: Metadata = { title: 'Matrícula' };

const MENSAGENS: Record<string, string> = {
  criada: 'Matrícula criada. Confira os documentos entregues e siga o fluxo.',
  status: 'Situação da matrícula atualizada.',
  turma: 'Enturmação salva.',
};

type Matricula = {
  id: string; numero: string; status: StatusMatricula; aluno_id: string; aluno_nome: string; data_nascimento: string | null;
  etapa_id: string; etapa_nome: string; turma_id: string | null; turma_nome: string | null; turno_pretendido: Turno;
  ano_letivo_id: string; ano: number; data_matricula: string | null; documentos_pendentes: number; created_at: string;
};

function BotaoStatus({ id, para, rotulo, variante = 'secundario', disabled }: {
  id: string; para: StatusMatricula; rotulo: string; variante?: 'primario' | 'secundario' | 'perigo'; disabled?: boolean;
}) {
  return (
    <form action={mudarStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="para" value={para} />
      <Botao type="submit" variante={variante} disabled={disabled}>{rotulo}</Botao>
    </form>
  );
}

function ComMotivo({ id, para, rotulo, campo, variante = 'secundario', obrigatorio = true }: {
  id: string; para: StatusMatricula; rotulo: string; campo: string; variante?: 'secundario' | 'perigo'; obrigatorio?: boolean;
}) {
  return (
    <details className="painel" style={{ padding: '12px 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{rotulo}</summary>
      <form action={mudarStatus} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="para" value={para} />
        <div className="se-campo">
          <label htmlFor={`obs-${para}`} className="se-campo-rotulo">{campo}</label>
          <textarea id={`obs-${para}`} name="observacao" className="se-campo-input" rows={2} required={obrigatorio} />
        </div>
        <div><Botao type="submit" variante={variante}>{rotulo}</Botao></div>
      </form>
    </details>
  );
}

export default async function DetalheMatricula({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const sessao = await exigirSessao(GESTAO);
  const { id } = await params;
  const { ok, erro } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await criarClienteSupabase();
  const { data } = await supabase.from('vw_matriculas').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const m = data as Matricula;

  const [{ data: docs }, { data: eventos }, { data: alerta }, { data: turmas }, { data: ocupacao }] = await Promise.all([
    supabase.from('documentos_entregues').select('id, status, conferido_em, tipo:tipos_documento(nome, obrigatorio, ordem)').eq('matricula_id', id),
    supabase.from('matricula_eventos').select('id, de, para, observacao, em').eq('matricula_id', id).order('em', { ascending: false }),
    supabase.from('vw_alertas_aluno').select('*').eq('aluno_id', m.aluno_id).maybeSingle(),
    supabase.from('turmas').select('id, nome, capacidade').eq('ano_letivo_id', m.ano_letivo_id).eq('etapa_id', m.etapa_id).order('nome'),
    supabase.from('matriculas').select('turma_id').eq('ano_letivo_id', m.ano_letivo_id).eq('status', 'matriculado').not('turma_id', 'is', null),
  ]);

  type Doc = { id: string; status: 'pendente' | 'entregue' | 'dispensado'; conferido_em: string | null; tipo: { nome: string; obrigatorio: boolean; ordem: number } };
  const documentos = ((docs ?? []) as unknown as Doc[]).sort((a, b) => a.tipo.ordem - b.tipo.ordem);
  const eSecretaria = sessao.papeis.includes('secretaria');
  const eDirecao = sessao.papeis.includes('direcao');
  const podeEnturmar = sessao.papeis.some((p) => p === 'secretaria' || p === 'coordenacao');
  const final = ['transferido', 'concluido', 'cancelado'].includes(m.status);
  const idade = idadeEmAnos(m.data_nascimento);
  const vagas = (tid: string, cap: number) => cap - (ocupacao ?? []).filter((o) => o.turma_id === tid && tid !== m.turma_id).length;

  return (
    <main className="pagina">
      <nav aria-label="Caminho" className="caminho"><Link href="/matriculas">Matrículas</Link> / {m.aluno_nome}</nav>
      {ok && MENSAGENS[ok] ? <Aviso tipo="ok">{MENSAGENS[ok]}</Aviso> : null}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">Matrícula {m.numero} · Ano letivo {m.ano}</p>
          <h1 className="titulo">{m.aluno_nome}</h1>
        </div>
        <Selo tom={STATUS_MATRICULA[m.status].tom}>{STATUS_MATRICULA[m.status].rotulo}</Selo>
      </div>

      <div className="colunas">
        <div className="coluna-principal">
          <CartaoAluno
            nome={m.aluno_nome}
            meta={[m.etapa_nome, TURNOS[m.turno_pretendido], idade !== null ? `${idade} anos` : null].filter(Boolean).join(' · ')}
            alertas={alertasDe(alerta, alerta?.possui_laudo)}
            acao={<BotaoLink href={`/alunos/${m.aluno_id}`} tamanho="sm">Ver ficha</BotaoLink>}
          />

          {/* Próximo passo do fluxo, conforme o perfil */}
          {!final ? (
            <section className="painel" aria-labelledby="t-fluxo" style={{ display: 'grid', gap: 16 }}>
              <h2 id="t-fluxo" className="secao-titulo">Próximo passo</h2>
              {m.status === 'pre_matricula' && (eSecretaria ? (
                <div className="acoes"><BotaoStatus id={m.id} para="em_analise" rotulo="Iniciar análise" variante="primario" /></div>
              ) : <p style={{ margin: 0 }}>Aguardando a secretaria iniciar a análise.</p>)}

              {m.status === 'em_analise' && (eSecretaria ? (
                <>
                  <p style={{ margin: 0 }}>
                    {m.documentos_pendentes > 0
                      ? `Faltam ${m.documentos_pendentes} documento(s) obrigatório(s). Marque os recebidos no checklist ou registre a pendência.`
                      : 'Todos os documentos obrigatórios foram conferidos. Envie para a aprovação da direção.'}
                  </p>
                  <div className="acoes">
                    <BotaoStatus id={m.id} para="aguardando_aprovacao" rotulo="Enviar para a direção" variante="primario" disabled={m.documentos_pendentes > 0} />
                    {m.documentos_pendentes > 0 ? <BotaoStatus id={m.id} para="pendente_documento" rotulo="Registrar documento pendente" /> : null}
                  </div>
                </>
              ) : <p style={{ margin: 0 }}>A secretaria está conferindo os documentos.</p>)}

              {m.status === 'pendente_documento' && (eSecretaria ? (
                <>
                  <p style={{ margin: 0 }}>Aguardando a família entregar {m.documentos_pendentes} documento(s). Quando receber, marque no checklist.</p>
                  <div className="acoes"><BotaoStatus id={m.id} para="em_analise" rotulo="Documentos recebidos: voltar para análise" variante="primario" /></div>
                </>
              ) : <p style={{ margin: 0 }}>Aguardando documentos da família.</p>)}

              {m.status === 'aguardando_aprovacao' && (eDirecao ? (
                <>
                  <p style={{ margin: 0 }}>A secretaria conferiu os documentos. Aprove para efetivar a matrícula.</p>
                  <div className="acoes"><BotaoStatus id={m.id} para="matriculado" rotulo="Aprovar matrícula" variante="primario" /></div>
                  <ComMotivo id={m.id} para="em_analise" rotulo="Devolver para a secretaria" campo="O que precisa ser revisto?" />
                </>
              ) : <p style={{ margin: 0 }}>Aguardando a aprovação da direção.</p>)}

              {m.status === 'matriculado' && (
                <>
                  <p style={{ margin: 0 }}>
                    Matriculado(a) em {formatarData(m.data_matricula)}.{' '}
                    {m.turma_nome ? `Turma: ${m.turma_nome}.` : 'Falta escolher a turma.'}
                  </p>
                  {podeEnturmar ? (
                    <form action={enturmar} className="acoes" style={{ alignItems: 'flex-end' }}>
                      <input type="hidden" name="id" value={m.id} />
                      <div className="se-campo" style={{ minWidth: 240 }}>
                        <label htmlFor="turma" className="se-campo-rotulo">Turma</label>
                        <select id="turma" name="turma_id" className="se-campo-input" defaultValue={m.turma_id ?? ''}>
                          <option value="">Sem turma</option>
                          {(turmas ?? []).map((t) => (
                            <option key={t.id} value={t.id} disabled={vagas(t.id, t.capacidade) <= 0 && t.id !== m.turma_id}>
                              {t.nome} ({Math.max(0, vagas(t.id, t.capacidade))} vagas)
                            </option>
                          ))}
                        </select>
                      </div>
                      <Botao type="submit" variante={m.turma_id ? 'secundario' : 'primario'}>Salvar turma</Botao>
                    </form>
                  ) : null}
                  {(turmas ?? []).length === 0 && podeEnturmar ? (
                    <p className="legenda" style={{ margin: 0 }}>Nenhuma turma de {m.etapa_nome} em {m.ano}. <Link href="/turmas">Cadastrar turma</Link>.</p>
                  ) : null}
                  {eSecretaria ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <ComMotivo id={m.id} para="transferido" rotulo="Registrar transferência" campo="Motivo da transferência" />
                      <ComMotivo id={m.id} para="concluido" rotulo="Registrar conclusão da etapa" campo="Observação (opcional)" obrigatorio={false} />
                    </div>
                  ) : null}
                </>
              )}

              {(eSecretaria || eDirecao) && m.status !== 'matriculado' ? (
                <ComMotivo id={m.id} para="cancelado" rotulo="Cancelar matrícula" campo="Motivo do cancelamento" variante="perigo" />
              ) : null}
            </section>
          ) : (
            <div className="painel-dourado"><strong>Matrícula encerrada:</strong> {STATUS_MATRICULA[m.status].rotulo.toLowerCase()}.</div>
          )}

          <section className="painel" aria-labelledby="t-docs">
            <div className="painel-cab">
              <h2 id="t-docs" className="secao-titulo">Documentos entregues</h2>
              {m.documentos_pendentes > 0 ? <Selo tom="dourado">{m.documentos_pendentes} obrigatório(s) pendente(s)</Selo> : <Selo tom="verde">Obrigatórios em dia</Selo>}
            </div>
            <ul className="lista-linhas">
              {documentos.map((d) => (
                <li key={d.id}>
                  <span className="cresce">
                    {d.tipo.nome}
                    {!d.tipo.obrigatorio ? <span className="legenda"> · opcional</span> : null}
                  </span>
                  <Selo tom={d.status === 'entregue' ? 'verde' : d.status === 'dispensado' ? 'neutro' : d.tipo.obrigatorio ? 'dourado' : 'neutro'}>
                    {d.status === 'entregue' ? 'Entregue' : d.status === 'dispensado' ? 'Dispensado' : 'Pendente'}
                  </Selo>
                  {eSecretaria && !final ? (
                    <form action={marcarDocumento} className="acoes" style={{ gap: 4 }}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="matricula_id" value={m.id} />
                      {d.status !== 'entregue' ? <Botao type="submit" name="status" value="entregue" tamanho="sm">Recebido</Botao> : null}
                      {d.status === 'pendente' && !d.tipo.obrigatorio ? <Botao type="submit" name="status" value="dispensado" tamanho="sm" variante="texto">Não se aplica</Botao> : null}
                      {d.status !== 'pendente' ? <Botao type="submit" name="status" value="pendente" tamanho="sm" variante="texto">Desfazer</Botao> : null}
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="coluna-lateral">
          <section className="painel" aria-labelledby="t-historico">
            <h2 id="t-historico" className="secao-titulo" style={{ marginBottom: 12 }}>Linha do tempo</h2>
            <ol className="linha-tempo">
              {(eventos ?? []).map((e) => (
                <li key={e.id}>
                  <span className="ponto" aria-hidden="true" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{STATUS_MATRICULA[e.para as StatusMatricula].rotulo}</div>
                    <div className="legenda">{formatarDataHora(e.em)}</div>
                    {e.observacao ? <div style={{ fontSize: 14 }}>{e.observacao}</div> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
