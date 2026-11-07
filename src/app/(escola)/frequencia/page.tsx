import { hojeNaEscola } from '@/lib/hoje';
import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO } from '@/lib/perfis';
import { ddmm, fimDoMes, MINIMO_LEGAL_PCT, MOTIVOS, pct, rotuloDia, situacaoDe, type Motivo, type RegistroDia, type ResumoAluno } from '@/lib/frequencia';
import { Avatar, BotaoLink, Selo } from '@/components/ui';
import { analisarJustificativa } from './actions';

export const metadata: Metadata = { title: 'Frequência' };

type Turma = { id: string; nome: string; turno: string };
type Mat = { aluno_id: string; turma_id: string; aluno: { pessoa: { nome: string } } };

export default async function PainelFrequencia() {
  await exigirSessao(GESTAO);
  const supabase = await criarClienteSupabase();
  const hoje = await hojeNaEscola();
  const mes = hoje.slice(0, 7);

  const { data: ano } = await supabase.from('anos_letivos').select('id, ano').eq('ativo', true).maybeSingle();
  if (!ano) {
    return <main className="pagina"><h1 className="titulo">Frequência</h1><p className="vazio">Nenhum ano letivo ativo.</p></main>;
  }

  const [{ data: turmas }, { data: mats }, { data: chamadasHoje }, { data: escola }, { data: diaLetivo }, { data: resumos }, { data: pendentes }, { data: doMes }] =
    await Promise.all([
      supabase.from('turmas').select('id, nome, turno').eq('ano_letivo_id', ano.id).order('nome'),
      supabase.from('matriculas').select('aluno_id, turma_id, aluno:alunos!inner(pessoa:pessoas!inner(nome))')
        .eq('ano_letivo_id', ano.id).eq('status', 'matriculado').not('turma_id', 'is', null),
      supabase.from('chamadas').select('id, turma_id, registrada_em').eq('data', hoje),
      supabase.from('escola').select('frequencia_alerta_pct, faltas_seguidas_alerta').single(),
      supabase.rpc('e_dia_letivo', { p_data: hoje }),
      supabase.from('vw_frequencia_aluno').select('*').eq('ano_letivo_id', ano.id),
      supabase.from('justificativas_falta').select('id, aluno_id, data, motivo, observacao, enviada_em').eq('status', 'pendente').order('data'),
      supabase.from('vw_frequencia_dia').select('aluno_id, turma_id, data, situacao, justificativa_status')
        .eq('ano_letivo_id', ano.id).gte('data', `${mes}-01`).lte('data', fimDoMes(mes)),
    ]);

  const listaTurmas = (turmas ?? []) as Turma[];
  const matriculas = (mats ?? []) as unknown as Mat[];
  const nomeDe = new Map(matriculas.map((m) => [m.aluno_id, m.aluno.pessoa.nome]));
  const turmaDe = new Map(matriculas.map((m) => [m.aluno_id, m.turma_id]));
  const nomeTurma = new Map(listaTurmas.map((t) => [t.id, t.nome]));
  const alunosPorTurma = (id: string) => matriculas.filter((m) => m.turma_id === id).length;

  const idsChamadaHoje = (chamadasHoje ?? []).map((c) => c.id);
  const { data: faltasHoje } = idsChamadaHoje.length
    ? await supabase.from('frequencias').select('chamada_id').in('chamada_id', idsChamadaHoje).eq('situacao', 'falta')
    : { data: [] };
  const chamadaDe = new Map((chamadasHoje ?? []).map((c) => [c.turma_id as string, c]));
  const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso)).replace(':', 'h');

  const limitePct = escola?.frequencia_alerta_pct ?? 75;
  const limiteSeguidas = escola?.faltas_seguidas_alerta ?? 3;
  const atencao = ((resumos ?? []) as ResumoAluno[])
    .filter((r) => nomeDe.has(r.aluno_id))
    .map((r) => ({
      ...r,
      seguidas: r.faltas_seguidas_sem_aviso >= limiteSeguidas,
      baixa: r.dias >= 10 && Number(r.percentual) < limitePct,
    }))
    .filter((r) => r.seguidas || r.baixa)
    .sort((a, b) => Number(a.percentual) - Number(b.percentual));

  const registrosMes = (doMes ?? []) as Pick<RegistroDia, 'aluno_id' | 'turma_id' | 'data' | 'situacao' | 'justificativa_status'>[];
  const diasMes = new Set(registrosMes.map((r) => r.data)).size;
  const resumoTurma = (id: string) => {
    const rs = registrosMes.filter((r) => r.turma_id === id);
    const faltas = rs.filter((r) => r.situacao === 'falta');
    return {
      total: rs.length,
      pct: rs.length ? Math.round((100 * (rs.length - faltas.length)) / rs.length) : null,
      faltas: faltas.length,
      justificadas: faltas.filter((r) => situacaoDe(r) === 'j').length,
    };
  };
  const listaPendentes = (pendentes ?? []).filter((j) => nomeDe.has(j.aluno_id as string));

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">{rotuloDia(hoje)} · ano letivo {ano.ano}</p>
          <h1 className="titulo">Frequência</h1>
        </div>
        <BotaoLink href="/calendario">Calendário letivo</BotaoLink>
      </div>

      <section aria-labelledby="t-hoje" style={{ display: 'grid', gap: 12 }}>
        <h2 id="t-hoje" className="secao-titulo">Chamada de hoje</h2>
        {!diaLetivo ? (
          <p className="painel" style={{ margin: 0 }}>Hoje não é dia letivo no calendário da escola.</p>
        ) : listaTurmas.length === 0 ? (
          <p className="painel" style={{ margin: 0 }}>Nenhuma turma cadastrada neste ano.</p>
        ) : (
          <div className="grade-cartoes">
            {listaTurmas.map((t) => {
              const c = chamadaDe.get(t.id);
              const total = alunosPorTurma(t.id);
              const nf = c ? (faltasHoje ?? []).filter((f) => f.chamada_id === c.id).length : 0;
              return (
                <Link key={t.id} href={c ? `/frequencia/turma/${t.id}` : `/chamada/${t.id}`} className="cartao-turma">
                  <span className="cartao-turma-topo">
                    <strong style={{ fontSize: 17 }}>{t.nome}</strong>
                    {c ? <Selo tom="verde">Feita</Selo> : <Selo tom="dourado">Pendente</Selo>}
                  </span>
                  {c ? (
                    <span><span className="numero-grande">{total - nf}</span> <span className="legenda">de {total} presentes</span></span>
                  ) : (
                    <span><span className="numero-grande" style={{ color: 'var(--ink-muted)' }}>—</span> <span className="legenda">{total} {total === 1 ? 'aluno' : 'alunos'}</span></span>
                  )}
                  <span className="legenda">
                    {c ? `Salva às ${hora(c.registrada_em)} · ${nf} ${nf === 1 ? 'falta' : 'faltas'}` : 'Toque para fazer a chamada no lugar da professora'}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="colunas">
        <section aria-labelledby="t-atencao" className="painel coluna-principal">
          <div className="painel-cab">
            <h2 id="t-atencao" className="secao-titulo">Precisa de atenção</h2>
            <span className="legenda">{atencao.length} {atencao.length === 1 ? 'aluno' : 'alunos'}</span>
          </div>
          {atencao.length === 0 ? (
            <p className="vazio">Nenhum aluno com {limiteSeguidas} faltas seguidas sem aviso ou abaixo de {limitePct}% no ano.</p>
          ) : (
            <ul className="lista-linhas">
              {atencao.map((r) => (
                <li key={r.aluno_id}>
                  <Avatar nome={nomeDe.get(r.aluno_id) ?? ''} />
                  <div className="cresce">
                    <Link href={`/alunos/${r.aluno_id}/frequencia`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
                      {nomeDe.get(r.aluno_id)}
                    </Link>
                    <div className="legenda">{nomeTurma.get(turmaDe.get(r.aluno_id) ?? '')}</div>
                    <div className="selos" style={{ marginTop: 6 }}>
                      {r.seguidas ? <Selo tom="falta">{r.faltas_seguidas_sem_aviso} faltas seguidas sem aviso</Selo> : null}
                      {r.baixa ? <Selo tom={Number(r.percentual) < MINIMO_LEGAL_PCT ? 'alerta' : 'dourado'}>{pct(Number(r.percentual))} no ano</Selo> : null}
                    </div>
                  </div>
                  <BotaoLink href={`/alunos/${r.aluno_id}/frequencia`} tamanho="sm">Ver frequência</BotaoLink>
                </li>
              ))}
            </ul>
          )}
          <p className="legenda" style={{ margin: '12px 0 0' }}>
            A pré-escola exige frequência mínima de {MINIMO_LEGAL_PCT}% das horas do ano (LDB, art. 31). O sistema avisa antes:
            abaixo de {limitePct}% ou com {limiteSeguidas} faltas seguidas sem aviso. Faltas repetidas sem justificativa devem ser
            comunicadas ao Conselho Tutelar depois de esgotado o contato com a família (ECA, art. 56).
          </p>
        </section>

        <aside className="coluna-lateral">
          <section aria-labelledby="t-just" className="painel">
            <h2 id="t-just" className="secao-titulo" style={{ marginBottom: 4 }}>Justificativas enviadas</h2>
            <p className="legenda" style={{ margin: '0 0 8px' }}>Enviadas pela família depois da falta.</p>
            {listaPendentes.length === 0 ? (
              <p className="vazio" style={{ padding: '8px 0' }}>Nenhuma justificativa esperando análise.</p>
            ) : (
              <ul className="lista-linhas">
                {listaPendentes.map((j) => (
                  <li key={j.id as string} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <Link href={`/alunos/${j.aluno_id}/frequencia`} style={{ fontWeight: 600 }}>{nomeDe.get(j.aluno_id as string)}</Link>
                      <span className="legenda">falta de {ddmm(j.data as string)}</span>
                    </div>
                    <div>{MOTIVOS[j.motivo as Motivo]}{j.observacao ? `: ${j.observacao}` : ''}</div>
                    <form action={analisarJustificativa} className="acoes">
                      <input type="hidden" name="id" value={j.id as string} />
                      <button type="submit" name="aceitar" value="sim" className="se-btn se-btn-primario se-btn-sm">Aceitar</button>
                      <button type="submit" name="aceitar" value="nao" className="se-btn se-btn-texto se-btn-sm">Não aceitar</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <section aria-labelledby="t-mes" className="painel painel-sem-padding">
        <div className="painel-cab">
          <h2 id="t-mes" className="secao-titulo">Este mês</h2>
          <span className="legenda">{diasMes} {diasMes === 1 ? 'dia com chamada' : 'dias com chamada'}</span>
        </div>
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Turma</th><th className="num">Alunos</th><th className="num">Frequência</th><th className="num">Faltas</th><th className="num">Justificadas</th><th><span className="sr-only">Diário</span></th></tr></thead>
            <tbody>
              {listaTurmas.map((t) => {
                const r = resumoTurma(t.id);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.nome}</td>
                    <td className="num">{alunosPorTurma(t.id)}</td>
                    <td className="num">{r.pct === null ? '—' : `${r.pct}%`}</td>
                    <td className="num">{r.faltas}</td>
                    <td className="num">{r.justificadas}</td>
                    <td><Link href={`/frequencia/turma/${t.id}`}>Abrir diário</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
