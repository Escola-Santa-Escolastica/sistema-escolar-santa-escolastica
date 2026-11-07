import { hojeNaEscola } from '@/lib/hoje';
import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { primeiroNome } from '@/lib/formatos';
import {
  mesValido, MINIMO_LEGAL_PCT, MOTIVOS, rotuloDia, situacaoDe, type AnoLetivo, type DiaCalendario, type Motivo,
  type RegistroDia, type ResumoAluno,
} from '@/lib/frequencia';
import { Selo } from '@/components/ui';
import { CabecalhoFamilia } from '@/components/cabecalho-familia';
import { VigiaSessao } from '@/components/vigia-sessao';
import { FormJustificar } from '@/components/form-justificar';
import { CalendarioMes } from '@/components/frequencia-aluno';
import { avisarOuJustificar } from '../actions';

export const metadata: Metadata = { title: 'Frequência' };

type Filho = { aluno_id: string; aluno_nome: string; turma_nome: string | null };

export default async function FrequenciaFamilia({ searchParams }: { searchParams: Promise<{ filho?: string; mes?: string }> }) {
  await exigirSessao(['responsavel']);
  const sp = await searchParams;
  const supabase = await criarClienteSupabase();
  const hoje = await hojeNaEscola();

  const { data: ano } = await supabase.from('anos_letivos').select('id, ano, inicio, fim').eq('ativo', true).single();
  const { data: mats } = await supabase.from('vw_matriculas').select('aluno_id, aluno_nome, turma_nome')
    .eq('ano_letivo_id', ano!.id).eq('status', 'matriculado').order('aluno_nome');
  const filhos = (mats ?? []) as Filho[];
  const filho = filhos.find((f) => f.aluno_id === sp.filho) ?? filhos[0];

  if (!filho) {
    return (
      <>
        <CabecalhoFamilia />
        <main className="pagina pagina-estreita">
          <h1 className="titulo">Frequência</h1>
          <p className="vazio">Nenhuma criança matriculada numa turma neste ano.</p>
          <Link href="/familia">Voltar</Link>
        </main>
      </>
    );
  }

  const [{ data: resumo }, { data: regs }, { data: cal }, { data: avisos }] = await Promise.all([
    supabase.from('vw_frequencia_aluno').select('*').eq('aluno_id', filho.aluno_id).eq('ano_letivo_id', ano!.id).maybeSingle(),
    supabase.from('vw_frequencia_dia').select('*').eq('aluno_id', filho.aluno_id).eq('ano_letivo_id', ano!.id).order('data', { ascending: false }),
    supabase.from('calendario_dias').select('data, tipo, descricao').eq('ano_letivo_id', ano!.id),
    supabase.from('justificativas_falta').select('id, data, motivo, observacao').eq('aluno_id', filho.aluno_id)
      .gte('data', hoje).eq('aviso_previo', true).order('data'),
  ]);
  const r = resumo as ResumoAluno | null;
  const registros = (regs ?? []) as RegistroDia[];
  const faltas = registros.filter((x) => x.situacao === 'falta');
  const comChamada = new Set(registros.map((x) => x.data));
  const avisosFuturos = (avisos ?? []).filter((a) => !comChamada.has(a.data as string));
  const nome = primeiroNome(filho.aluno_nome);
  const mesAtual = hoje.slice(0, 7);
  const mes = mesValido(sp.mes)
    ?? (registros.length && !registros.some((x) => x.data.startsWith(mesAtual)) ? registros[0].data.slice(0, 7) : mesAtual);

  return (
    <>
      <CabecalhoFamilia />
      <main className="pagina pagina-estreita">
        <nav aria-label="Caminho" className="caminho"><Link href="/familia">Início</Link> / Frequência</nav>
        <h1 className="titulo">Frequência</h1>

        {filhos.length > 1 ? (
          <nav aria-label="Filho" className="chips">
            {filhos.map((f) => (
              <Link key={f.aluno_id} href={`?filho=${f.aluno_id}`} className="chip" aria-current={f.aluno_id === filho.aluno_id ? 'page' : undefined}>
                {primeiroNome(f.aluno_nome)}
              </Link>
            ))}
          </nav>
        ) : null}

        <section className="painel" aria-labelledby="t-resumo" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <h2 id="t-resumo" className="secao-titulo">{nome} em {ano!.ano}</h2>
            {r ? <span className="numero-grande" style={{ fontSize: 28 }}>{Math.round(Number(r.percentual))}%</span> : null}
          </div>
          {r ? (
            <>
              <p style={{ margin: 0 }}>
                {Number(r.percentual) >= MINIMO_LEGAL_PCT
                  ? `Acima do mínimo de ${MINIMO_LEGAL_PCT}% exigido por lei.`
                  : `Abaixo do mínimo de ${MINIMO_LEGAL_PCT}% exigido por lei. Fale com a coordenação.`}
              </p>
              <div className="selos">
                <Selo tom="verde">{r.presencas} {r.presencas === 1 ? 'presença' : 'presenças'}</Selo>
                <Selo tom="falta">{r.faltas} {r.faltas === 1 ? 'falta' : 'faltas'}</Selo>
              </div>
            </>
          ) : <p style={{ margin: 0 }} className="legenda">Ainda não há chamadas registradas para {nome}.</p>}
        </section>

        <section className="painel" aria-labelledby="t-avisar" style={{ display: 'grid', gap: 10 }}>
          <h2 id="t-avisar" className="secao-titulo">Avisar que {nome} vai faltar</h2>
          {avisosFuturos.length ? (
            <ul className="lista-linhas">
              {avisosFuturos.map((a) => (
                <li key={a.id as string}>
                  <span className="cresce"><strong>{rotuloDia(a.data as string)}</strong><br />
                    <span className="legenda">{MOTIVOS[a.motivo as Motivo]}{a.observacao ? `: ${a.observacao}` : ''}</span></span>
                  <Selo tom="dourado">Avisada</Selo>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="legenda" style={{ margin: 0 }}>Avisando antes, a falta já conta como justificada e a professora vê o recado na chamada.</p>
          <FormJustificar key={`aviso-${filho.aluno_id}`} acao={avisarOuJustificar} alunoId={filho.aluno_id} escolherDia minDia={hoje}
            idPrefixo="aviso" rotuloBotao="Enviar aviso" />
        </section>

        <section className="painel" aria-labelledby="t-faltas" style={{ display: 'grid', gap: 4 }}>
          <h2 id="t-faltas" className="secao-titulo">Faltas</h2>
          {faltas.length === 0 ? <p className="vazio" style={{ padding: '8px 0' }}>Nenhuma falta.</p> : (
            <ul className="lista-linhas">
              {faltas.map((f) => {
                const s = situacaoDe(f);
                return (
                  <li key={f.data} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong>{rotuloDia(f.data)}</strong>
                      <Selo tom={s === 'j' ? 'dourado' : s === 'a' ? 'neutro' : 'falta'}>
                        {s === 'j' ? 'Justificada' : s === 'a' ? 'Em análise' : 'Sem justificativa'}
                      </Selo>
                    </div>
                    {f.justificativa_motivo ? (
                      <span className="legenda">Você enviou: {MOTIVOS[f.justificativa_motivo as Motivo]}{f.justificativa_observacao ? ` — ${f.justificativa_observacao}` : ''}</span>
                    ) : null}
                    {s === 'f' ? (
                      <details>
                        <summary className="se-btn se-btn-secundario se-btn-sm" style={{ width: 'fit-content', listStyle: 'none' }}>Justificar esta falta</summary>
                        <div style={{ marginTop: 8 }}>
                          <FormJustificar acao={avisarOuJustificar} alunoId={filho.aluno_id} dia={f.data} idPrefixo={`j-${f.data}`} rotuloBotao="Enviar justificativa" />
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="painel" aria-labelledby="t-cal">
          <CalendarioMes mes={mes} hoje={hoje} ano={ano as AnoLetivo} excecoes={(cal ?? []) as DiaCalendario[]} registros={registros}
            hrefMes={(m) => `?filho=${filho.aluno_id}&mes=${m}`} idTitulo="t-cal" />
        </section>
        <VigiaSessao />
      </main>
    </>
  );
}
