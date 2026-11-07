import { hojeNaEscola } from '@/lib/hoje';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, temAlgum } from '@/lib/perfis';
import {
  dataValida, ddmm, diaDaSemana, diasLetivosDoMes, fimDoMes, mesValido, MOTIVOS, nomeDoMes, NOMES_MES, ROTULO_SITUACAO,
  situacaoDe, type AnoLetivo, type DiaCalendario, type Motivo, type RegistroDia,
} from '@/lib/frequencia';
import { BotaoImprimir } from '@/components/botao-imprimir';
import { marcarFrequencia } from '../../actions';

export const metadata: Metadata = { title: 'Diário de frequência' };

const LETRA: Record<string, string> = { p: '•', f: 'F', j: 'J', a: 'F' };
const SEM = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default async function DiarioTurma({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; aluno?: string; dia?: string }>;
}) {
  const sessao = await exigirSessao([...GESTAO, 'professor_regente', 'professor_especialista', 'auxiliar']);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const eGestao = temAlgum(sessao.papeis, GESTAO);
  const eRegente = sessao.atribuicoes.some((a) => a.papel === 'professor_regente' && a.turma_id === id);
  if (!eGestao && !sessao.atribuicoes.some((a) => a.turma_id === id)) notFound();
  const sp = await searchParams;
  const hoje = await hojeNaEscola();

  const supabase = await criarClienteSupabase();
  const { data: turma } = await supabase.from('turmas').select('id, nome, ano_letivo_id').eq('id', id).maybeSingle();
  if (!turma) notFound();
  const [{ data: ano }, { data: cal }, { data: datas }, { data: mats }, { data: prof }] = await Promise.all([
    supabase.from('anos_letivos').select('id, ano, inicio, fim').eq('id', turma.ano_letivo_id).single(),
    supabase.from('calendario_dias').select('data, tipo, descricao').eq('ano_letivo_id', turma.ano_letivo_id),
    supabase.from('chamadas').select('data').eq('turma_id', id),
    supabase.from('matriculas').select('aluno:alunos!inner(id, pessoa:pessoas!inner(nome))').eq('turma_id', id).eq('status', 'matriculado'),
    supabase.from('atribuicoes').select('user_id').eq('turma_id', id).eq('papel', 'professor_regente').eq('ativo', true).limit(1).maybeSingle(),
  ]);
  const anoLetivo = ano as AnoLetivo;
  const excecoes = new Map(((cal ?? []) as DiaCalendario[]).map((d) => [d.data, d]));

  // Meses: os do período letivo, os que têm chamada e o mês atual.
  const meses = new Set<string>((datas ?? []).map((d) => (d.data as string).slice(0, 7)));
  meses.add(hoje.slice(0, 7));
  if (anoLetivo.inicio && anoLetivo.fim) {
    for (let m = anoLetivo.inicio.slice(0, 7); m <= anoLetivo.fim.slice(0, 7); ) {
      meses.add(m);
      const [a, n] = m.split('-').map(Number);
      m = n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, '0')}`;
    }
  }
  const listaMeses = [...meses].sort();
  const mes = mesValido(sp.mes) ?? hoje.slice(0, 7);

  const { data: regs } = await supabase.from('vw_frequencia_dia').select('*')
    .eq('turma_id', id).gte('data', `${mes}-01`).lte('data', fimDoMes(mes));
  const registros = (regs ?? []) as RegistroDia[];
  const reg = new Map(registros.map((r) => [`${r.aluno_id}|${r.data}`, r]));
  const comChamada = new Set(registros.map((r) => r.data));
  const dias = [...new Set([...diasLetivosDoMes(mes, anoLetivo, excecoes), ...comChamada])].sort();

  const alunos = ((mats ?? []) as unknown as { aluno: { id: string; pessoa: { nome: string } } }[])
    .map((m) => ({ id: m.aluno.id, nome: m.aluno.pessoa.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const { data: professora } = prof
    ? await supabase.from('pessoas').select('nome').eq('user_id', prof.user_id).maybeSingle()
    : { data: null };

  const linhas = alunos.map((a) => {
    const rs = dias.map((d) => reg.get(`${a.id}|${d}`)).filter(Boolean) as RegistroDia[];
    const faltas = rs.filter((r) => r.situacao === 'falta').length;
    return { ...a, faltas, pct: rs.length ? Math.round((100 * (rs.length - faltas)) / rs.length) : null };
  });
  const totalRegs = registros.length;
  const totalFaltas = registros.filter((r) => r.situacao === 'falta').length;
  const mediaTurma = totalRegs ? Math.round((100 * (totalRegs - totalFaltas)) / totalRegs) : null;

  // Detalhe do dia escolhido
  const selAluno = alunos.find((a) => a.id === sp.aluno);
  const selDia = dataValida(sp.dia);
  const selReg = selAluno && selDia ? reg.get(`${selAluno.id}|${selDia}`) : undefined;
  const podeCorrigir = eGestao || (eRegente && selDia === hoje);
  const url = (extra: Record<string, string>) => `?${new URLSearchParams({ mes, ...extra })}`;

  return (
    <main className="pagina">
      <nav aria-label="Caminho" className="caminho nao-imprimir">
        {eGestao ? <Link href="/frequencia">Frequência</Link> : <Link href="/chamada">Chamada</Link>} / {turma.nome}
      </nav>
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">
            Diário de frequência{professora ? ` · Professora ${professora.nome}` : ''} · {alunos.length} alunos
          </p>
          <h1 className="titulo">{turma.nome} · {nomeDoMes(mes)}</h1>
        </div>
        <BotaoImprimir>Imprimir diário do mês</BotaoImprimir>
      </div>

      <nav aria-label="Mês" className="abas nao-imprimir">
        {listaMeses.map((m) => (
          <Link key={m} href={`?mes=${m}`} aria-current={m === mes ? 'page' : undefined}>
            {NOMES_MES[Number(m.slice(5)) - 1].replace(/^./, (c) => c.toUpperCase())}{m.slice(0, 4) !== String(anoLetivo.ano) ? ` ${m.slice(0, 4)}` : ''}
          </Link>
        ))}
      </nav>

      <div className="legenda-freq">
        <span><span className="cel cel-p" aria-hidden="true">•</span>Presente</span>
        <span><span className="cel cel-f" aria-hidden="true">F</span>Falta</span>
        <span><span className="cel cel-j" aria-hidden="true">J</span>Falta justificada</span>
        <span><span className="cel cel-a" aria-hidden="true">F</span>Justificativa em análise</span>
        <span><span className="cel cel-x" aria-hidden="true"></span>Sem chamada</span>
        <span style={{ marginLeft: 'auto' }} className="legenda">
          {comChamada.size} {comChamada.size === 1 ? 'dia com chamada' : 'dias com chamada'} de {dias.length} letivos
          {mediaTurma !== null ? <> · média da turma <strong style={{ color: 'var(--ink)' }}>{mediaTurma}%</strong></> : null}
        </span>
      </div>

      {alunos.length === 0 ? (
        <p className="painel vazio">A turma ainda não tem alunos matriculados.</p>
      ) : (
        <section aria-label="Frequência por aluno e dia" className="painel painel-sem-padding">
          <div className="tabela-caixa">
            <table className="grade-freq">
              <thead>
                <tr>
                  <th scope="col" className="col-nome">Aluno</th>
                  {dias.map((d) => (
                    <th key={d} scope="col" className={d === hoje ? 'col-hoje' : undefined}>
                      {SEM[diaDaSemana(d)]}<b>{Number(d.slice(8))}</b>
                    </th>
                  ))}
                  <th scope="col" className="col-num">Faltas</th>
                  <th scope="col" className="col-num">No mês</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((a) => (
                  <tr key={a.id}>
                    <th scope="row" className="col-nome">
                      <Link href={`/alunos/${a.id}/frequencia`} style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}>{a.nome}</Link>
                    </th>
                    {dias.map((d) => {
                      const r = reg.get(`${a.id}|${d}`);
                      const td = d === hoje ? 'col-hoje' : undefined;
                      if (!r) return <td key={d} className={td}><span className="cel cel-x" title={`${ddmm(d)}: sem chamada`} /></td>;
                      const s = situacaoDe(r);
                      const on = selAluno?.id === a.id && selDia === d;
                      return (
                        <td key={d} className={td}>
                          <Link href={url({ aluno: a.id, dia: d })} scroll={false} className={`cel cel-${s}${on ? ' cel-on' : ''}`}
                            aria-label={`${a.nome}, ${ddmm(d)}: ${ROTULO_SITUACAO[s]}`}>{LETRA[s]}</Link>
                        </td>
                      );
                    })}
                    <td className="col-num">{a.faltas}</td>
                    <td className="col-num" style={{ fontWeight: 600 }}>{a.pct === null ? '—' : `${a.pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selAluno && selDia && selReg ? (
        <section aria-live="polite" className="painel nao-imprimir" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
          <div className="cresce" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{selAluno.nome} · {ddmm(selDia)}</div>
            <div>
              {ROTULO_SITUACAO[situacaoDe(selReg)]}
              {selReg.situacao === 'falta' && selReg.justificativa_motivo
                ? ` · ${MOTIVOS[selReg.justificativa_motivo as Motivo]}${selReg.justificativa_observacao ? `: ${selReg.justificativa_observacao}` : ''}`
                : ''}
            </div>
          </div>
          {podeCorrigir ? (
            <form action={marcarFrequencia} className="acoes">
              <input type="hidden" name="turma" value={id} />
              <input type="hidden" name="dia" value={selDia} />
              <input type="hidden" name="aluno" value={selAluno.id} />
              {selReg.situacao === 'falta'
                ? <button type="submit" name="situacao" value="presente" className="se-btn se-btn-secundario se-btn-sm">Corrigir para presença</button>
                : <button type="submit" name="situacao" value="falta" className="se-btn se-btn-secundario se-btn-sm">Corrigir para falta</button>}
              {selReg.situacao === 'falta' && eGestao && situacaoDe(selReg) === 'f'
                ? <Link href={`/alunos/${selAluno.id}/frequencia?justificar=${selDia}`} className="se-btn se-btn-primario se-btn-sm">Justificar</Link>
                : null}
            </form>
          ) : null}
          <p className="legenda" style={{ flexBasis: '100%', margin: 0 }}>Toda correção fica registrada com quem alterou e quando.</p>
        </section>
      ) : null}
    </main>
  );
}
