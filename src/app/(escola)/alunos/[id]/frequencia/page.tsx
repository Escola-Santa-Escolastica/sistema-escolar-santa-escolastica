import { hojeNaEscola } from '@/lib/hoje';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, temAlgum } from '@/lib/perfis';
import { TURNOS } from '@/lib/formatos';
import { CartaoAluno, Selo, alertasDe } from '@/components/ui';
import { AbasAluno } from '@/components/abas-aluno';
import { FormJustificar } from '@/components/form-justificar';
import { BarraFrequencia, CalendarioMes } from '@/components/frequencia-aluno';
import { analisarJustificativa, justificarFalta } from '@/app/(escola)/frequencia/actions';
import {
  mesValido, MOTIVOS, rotuloDia, situacaoDe, type AnoLetivo, type DiaCalendario, type Motivo,
  type RegistroDia, type ResumoAluno,
} from '@/lib/frequencia';

export const metadata: Metadata = { title: 'Frequência do aluno' };

export default async function FrequenciaDoAluno({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; justificar?: string }>;
}) {
  const sessao = await exigirSessao([...GESTAO, 'professor_regente', 'professor_especialista', 'auxiliar']);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const eGestao = temAlgum(sessao.papeis, GESTAO);
  const hoje = await hojeNaEscola();
  const supabase = await criarClienteSupabase();

  const { data: aluno } = await supabase.from('alunos').select('id, pessoa:pessoas!inner(nome)').eq('id', id).maybeSingle();
  if (!aluno) notFound();
  const nome = (aluno.pessoa as unknown as { nome: string }).nome;

  const { data: ano } = await supabase.from('anos_letivos').select('id, ano, inicio, fim').eq('ativo', true).single();
  const [{ data: mat }, { data: alerta }, { data: resumo }, { data: regs }, { data: cal }, { data: escola }] = await Promise.all([
    supabase.from('matriculas').select('turno_pretendido, turma:turmas(nome, turno), etapa:etapas(nome)')
      .eq('aluno_id', id).eq('ano_letivo_id', ano!.id).neq('status', 'cancelado').maybeSingle(),
    supabase.from('vw_alertas_aluno').select('*').eq('aluno_id', id).maybeSingle(),
    supabase.from('vw_frequencia_aluno').select('*').eq('aluno_id', id).eq('ano_letivo_id', ano!.id).maybeSingle(),
    supabase.from('vw_frequencia_dia').select('*').eq('aluno_id', id).eq('ano_letivo_id', ano!.id).order('data', { ascending: false }),
    supabase.from('calendario_dias').select('data, tipo, descricao').eq('ano_letivo_id', ano!.id),
    supabase.from('escola').select('frequencia_alerta_pct').single(),
  ]);
  const registros = (regs ?? []) as RegistroDia[];
  const r = resumo as ResumoAluno | null;
  const turma = mat?.turma as unknown as { nome: string; turno: keyof typeof TURNOS } | null;
  const horas = turma?.turno === 'integral' ? 7 : 4;
  // Mês mostrado: o pedido; senão o atual; se o atual não tem chamada, o da última chamada.
  const mesAtual = hoje.slice(0, 7);
  const mes = mesValido(sp.mes)
    ?? (registros.length && !registros.some((x) => x.data.startsWith(mesAtual)) ? registros[0].data.slice(0, 7) : mesAtual);
  const faltas = registros.filter((x) => x.situacao === 'falta');

  // avisos para dias que ainda não tiveram chamada (feitos pela família ou pela secretaria)
  const { data: avisosFuturos } = await supabase.from('justificativas_falta').select('id, data, motivo, observacao')
    .eq('aluno_id', id).gte('data', hoje).eq('aviso_previo', true).order('data');
  const datasComChamada = new Set(registros.map((x) => x.data));
  const avisos = (avisosFuturos ?? []).filter((a) => !datasComChamada.has(a.data as string));

  return (
    <main className="pagina">
      <nav aria-label="Caminho" className="caminho"><Link href="/alunos">Alunos</Link> / <Link href={`/alunos/${id}`}>{nome}</Link> / Frequência</nav>
      <CartaoAluno nome={nome}
        meta={turma ? turma.nome : mat ? `${(mat.etapa as unknown as { nome: string }).nome} · sem turma` : 'Sem matrícula neste ano'}
        alertas={alertasDe(alerta, alerta?.possui_laudo)} />
      <AbasAluno id={id} atual="frequencia" />

      <section aria-labelledby="t-ano" className="painel" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 32px' }}>
          <div style={{ flex: '1 1 260px' }}>
            <h2 id="t-ano" className="secao-titulo">No ano letivo de {ano!.ano}</h2>
            <p className="legenda" style={{ margin: '4px 0 0' }}>
              {r ? `${r.dias} ${r.dias === 1 ? 'dia com chamada' : 'dias com chamada'} até ${rotuloDia(r.ultima_chamada).toLowerCase()}` : 'Nenhuma chamada registrada ainda'}
              {' '}· {horas} horas por dia ({turma?.turno === 'integral' ? 'integral' : 'turno parcial'})
            </p>
          </div>
          <dl className="numeros">
            <div><dt>Frequência</dt><dd style={{ fontFamily: 'var(--font-serif)', fontSize: 30, lineHeight: '36px' }}>{r ? `${Math.round(Number(r.percentual))}%` : '—'}</dd></div>
            <div><dt>Presenças</dt><dd>{r?.presencas ?? 0}</dd></div>
            <div><dt>Faltas</dt><dd>{r?.faltas ?? 0}</dd></div>
            <div><dt>Justificadas</dt><dd>{r?.justificadas ?? 0}</dd></div>
          </dl>
        </div>
        <BarraFrequencia percentual={r ? Number(r.percentual) : null} aviso={escola?.frequencia_alerta_pct ?? 75} />
        <p className="legenda" style={{ margin: 0 }}>
          Falta justificada continua sendo ausência no cálculo dos 60% (LDB, art. 31). A justificativa fica registrada e evita
          os alertas de falta sem aviso.
        </p>
      </section>

      <div className="colunas">
        <section aria-labelledby="t-mes" className="painel coluna-principal">
          <CalendarioMes
            mes={mes}
            hoje={hoje}
            ano={ano as AnoLetivo}
            excecoes={(cal ?? []) as DiaCalendario[]}
            registros={registros}
            hrefMes={(m) => `?mes=${m}`}
            idTitulo="t-mes"
          />
        </section>

        <aside className="coluna-lateral">
          <section aria-labelledby="t-faltas" className="painel">
            <h2 id="t-faltas" className="secao-titulo" style={{ marginBottom: 4 }}>Faltas no ano</h2>
            {faltas.length === 0 ? <p className="vazio" style={{ padding: '8px 0' }}>Nenhuma falta.</p> : (
              <ul className="lista-linhas">
                {faltas.map((f) => {
                  const s = situacaoDe(f);
                  return (
                    <li key={f.data} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong>{rotuloDia(f.data)}</strong>
                        <Selo tom={s === 'j' ? 'dourado' : 'falta'}>{s === 'j' ? 'Justificada' : s === 'a' ? 'Em análise' : 'Sem justificativa'}</Selo>
                      </div>
                      {f.justificativa_motivo ? (
                        <div className="legenda">
                          {f.aviso_previo ? 'Avisada antes' : 'Justificada depois'} · {MOTIVOS[f.justificativa_motivo as Motivo]}
                          {f.justificativa_observacao ? `: ${f.justificativa_observacao}` : ''}
                        </div>
                      ) : null}
                      {eGestao && s === 'a' ? (
                        <form action={analisarJustificativa} className="acoes">
                          <input type="hidden" name="id" value={f.justificativa_id!} />
                          <button type="submit" name="aceitar" value="sim" className="se-btn se-btn-primario se-btn-sm">Aceitar</button>
                          <button type="submit" name="aceitar" value="nao" className="se-btn se-btn-texto se-btn-sm">Não aceitar</button>
                        </form>
                      ) : null}
                      {eGestao && s === 'f' ? (
                        <details open={sp.justificar === f.data}>
                          <summary className="se-btn se-btn-secundario se-btn-sm" style={{ width: 'fit-content', listStyle: 'none' }}>Justificar</summary>
                          <div style={{ marginTop: 8 }}>
                            <FormJustificar acao={justificarFalta} alunoId={id} dia={f.data} idPrefixo={`j-${f.data}`} />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {eGestao && turma ? (
            <section aria-labelledby="t-aviso" className="painel">
              <h2 id="t-aviso" className="secao-titulo" style={{ marginBottom: 4 }}>Aviso de falta</h2>
              {avisos.length ? (
                <ul className="lista-linhas" style={{ marginBottom: 8 }}>
                  {avisos.map((a) => (
                    <li key={a.id as string}>
                      <span className="cresce"><strong>{rotuloDia(a.data as string)}</strong><br />
                        <span className="legenda">{MOTIVOS[a.motivo as Motivo]}{a.observacao ? `: ${a.observacao}` : ''}</span></span>
                      <Selo tom="dourado">Avisada</Selo>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="legenda" style={{ margin: '0 0 8px' }}>A família avisou por telefone? Registre aqui; a criança já aparece com falta na chamada do dia.</p>
              <FormJustificar acao={justificarFalta} alunoId={id} escolherDia minDia={hoje} idPrefixo="aviso" rotuloBotao="Registrar aviso" />
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
