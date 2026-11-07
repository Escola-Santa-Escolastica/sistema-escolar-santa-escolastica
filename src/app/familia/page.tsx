import type { Metadata } from 'next';
import { VigiaSessao } from '@/components/vigia-sessao';
import { CabecalhoFamilia } from '@/components/cabecalho-familia';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { primeiroNome, STATUS_MATRICULA, TURNOS, type StatusMatricula, type Turno } from '@/lib/formatos';
import { BotaoLink, CartaoAluno, Selo, alertasDe } from '@/components/ui';
import { MINIMO_LEGAL_PCT, type ResumoAluno } from '@/lib/frequencia';
import { TIPO_PUBLICACAO, dataLocal, dataPorExtenso, hora, type Publicacao } from '@/lib/site';

export const metadata: Metadata = { title: 'Área da família' };

type Matricula = {
  id: string; aluno_id: string; aluno_nome: string; aluno_nome_social: string | null; status: StatusMatricula;
  etapa_nome: string; turma_nome: string | null; turno_pretendido: Turno; ano: number; documentos_pendentes: number;
};

/** Área da família: a RLS só devolve os filhos vinculados à conta. */
export default async function Familia() {
  const sessao = await exigirSessao(['responsavel']);
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.from('vw_matriculas')
    .select('id, aluno_id, aluno_nome, aluno_nome_social, status, etapa_nome, turma_nome, turno_pretendido, ano, documentos_pendentes')
    .neq('status', 'cancelado')
    .order('ano', { ascending: false });
  const matriculas = (data ?? []) as Matricula[];

  // Uma matrícula por criança (a mais recente).
  const porAluno = new Map<string, Matricula>();
  matriculas.forEach((m) => { if (!porAluno.has(m.aluno_id)) porAluno.set(m.aluno_id, m); });
  const filhos = [...porAluno.values()];

  const ids = filhos.map((f) => f.aluno_id);
  const matIds = filhos.map((f) => f.id);
  const [{ data: alertas }, { data: pendentes }, { data: resumos }, { data: avisosRows }] = await Promise.all([
    ids.length ? supabase.from('vw_alertas_aluno').select('*').in('aluno_id', ids) : Promise.resolve({ data: [] as never[] }),
    matIds.length
      ? supabase.from('documentos_entregues').select('matricula_id, status, tipo:tipos_documento(nome, obrigatorio)').in('matricula_id', matIds).eq('status', 'pendente')
      : Promise.resolve({ data: [] as never[] }),
    ids.length ? supabase.from('vw_frequencia_aluno').select('*').in('aluno_id', ids) : Promise.resolve({ data: [] as never[] }),
    // Avisos só para famílias (ou para a turma do filho). A RLS filtra as turmas.
    supabase.from('publicacoes')
      .select('id, tipo, titulo, resumo, texto, evento_data, evento_inicio, evento_fim, evento_local, publicar_em, created_at, turmas(nome)')
      .eq('status', 'publicada').in('visibilidade', ['familias', 'turma']).lte('publicar_em', new Date().toISOString())
      .order('publicar_em', { ascending: false }).limit(6),
  ]);
  type Aviso = Pick<Publicacao, 'id' | 'tipo' | 'titulo' | 'resumo' | 'texto' | 'evento_data' | 'evento_inicio' | 'evento_fim' | 'evento_local' | 'publicar_em' | 'created_at'> & { turmas: { nome: string } | null };
  const avisos = (avisosRows ?? []) as unknown as Aviso[];
  const resumoDe = new Map(((resumos ?? []) as ResumoAluno[]).map((r) => [r.aluno_id, r]));
  const alertaDe = new Map((alertas ?? []).map((a: { aluno_id: string }) => [a.aluno_id, a]));
  type Pend = { matricula_id: string; tipo: { nome: string; obrigatorio: boolean } };
  const pend = (pendentes ?? []) as unknown as Pend[];

  return (
    <>
      <CabecalhoFamilia />
      <main className="pagina pagina-estreita">
        <h1 className="titulo">Olá, {primeiroNome(sessao.nome)}</h1>
        {avisos.length ? (
          <section className="painel avisos-familia" aria-labelledby="t-avisos">
            <h2 id="t-avisos" className="secao-titulo" style={{ fontSize: 20 }}>Avisos da escola</h2>
            {avisos.map((a) => {
              const t = TIPO_PUBLICACAO[a.tipo];
              const horario = [hora(a.evento_inicio), hora(a.evento_fim)].filter(Boolean).join(' às ');
              return (
                <article key={a.id} className="aviso-familia-item">
                  <span className="site-cartao-meta">
                    <Selo tom={t.tom}>{t.rotulo}</Selo>
                    {a.turmas ? <Selo tom="neutro">Turma {a.turmas.nome}</Selo> : null}
                    {dataPorExtenso(dataLocal(a.publicar_em ?? a.created_at))}
                  </span>
                  <strong>{a.titulo}</strong>
                  {a.tipo === 'evento' && a.evento_data ? (
                    <span className="legenda">{dataPorExtenso(a.evento_data, true)}{horario ? ` · ${horario}` : ''}{a.evento_local ? ` · ${a.evento_local}` : ''}</span>
                  ) : null}
                  <p>{a.resumo}</p>
                  {a.texto ? <details><summary>Ler o aviso completo</summary><p style={{ marginTop: 8 }}>{a.texto}</p></details> : null}
                </article>
              );
            })}
          </section>
        ) : null}
        {filhos.length === 0 ? (
          <p className="vazio">Ainda não há crianças vinculadas à sua conta. Fale com a secretaria da escola.</p>
        ) : filhos.map((f) => {
          const al = alertaDe.get(f.aluno_id) as Parameters<typeof alertasDe>[0] & { possui_laudo?: boolean } | undefined;
          const docs = pend.filter((p) => p.matricula_id === f.id && p.tipo.obrigatorio);
          return (
            <section key={f.aluno_id} style={{ display: 'grid', gap: 12 }} aria-label={f.aluno_nome}>
              <CartaoAluno
                nome={f.aluno_nome}
                meta={[f.turma_nome ?? `${f.etapa_nome} · ${TURNOS[f.turno_pretendido]}`, String(f.ano)].join(' · ')}
                alertas={alertasDe(al, al?.possui_laudo)}
              />
              <div className="painel" style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h2 className="secao-titulo" style={{ fontSize: 20 }}>Matrícula {f.ano}</h2>
                  <Selo tom={STATUS_MATRICULA[f.status].tom}>{STATUS_MATRICULA[f.status].rotulo}</Selo>
                </div>
                {docs.length > 0 && ['em_analise', 'pendente_documento'].includes(f.status) ? (
                  <div className="painel-dourado">
                    <strong>Falta entregar:</strong> {docs.map((d) => d.tipo.nome).join(', ')}. Leve à secretaria para concluirmos a matrícula.
                  </div>
                ) : null}
                {f.status === 'aguardando_aprovacao' ? <p style={{ margin: 0 }}>Os documentos estão completos. A direção vai aprovar a matrícula.</p> : null}
                {f.status === 'matriculado' && !f.turma_nome ? <p style={{ margin: 0 }}>Matrícula confirmada. A turma será informada em breve.</p> : null}
              </div>
              {f.status === 'matriculado' && f.turma_nome ? (() => {
                const r = resumoDe.get(f.aluno_id);
                return (
                  <div className="painel" style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                      <h2 className="secao-titulo" style={{ fontSize: 20 }}>Frequência</h2>
                      {r ? <span className="numero-grande" style={{ fontSize: 26 }}>{Math.round(Number(r.percentual))}%</span> : null}
                    </div>
                    {r ? (
                      <div className="selos">
                        <Selo tom="verde">{r.presencas} {r.presencas === 1 ? 'presença' : 'presenças'}</Selo>
                        <Selo tom="falta">{r.faltas} {r.faltas === 1 ? 'falta' : 'faltas'}</Selo>
                        {Number(r.percentual) < MINIMO_LEGAL_PCT ? <Selo tom="alerta">Abaixo do mínimo de {MINIMO_LEGAL_PCT}%</Selo> : null}
                      </div>
                    ) : <p style={{ margin: 0 }} className="legenda">Ainda não há chamadas registradas.</p>}
                    <BotaoLink href={`/familia/frequencia?filho=${f.aluno_id}`} larguraTotal>Ver faltas e avisar falta</BotaoLink>
                  </div>
                );
              })() : null}
            </section>
          );
        })}
        <VigiaSessao />
        <p className="legenda" style={{ margin: 0 }}>
          Para corrigir algum dado (telefone, endereço, saúde), fale com a secretaria. Em breve você poderá fazer isso por aqui.
        </p>
      </main>
    </>
  );
}
