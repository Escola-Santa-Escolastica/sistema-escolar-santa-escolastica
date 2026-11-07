import type { Metadata } from 'next';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, temAlgum } from '@/lib/perfis';
import {
  ddmm, diaDaSemana, diasNoMes, DIAS_MINIMOS, eDiaLetivo, HORAS_MINIMAS, HORAS_POR_DIA, isoDe, NOMES_MES, TIPOS_DIA,
  type AnoLetivo, type DiaCalendario, type TipoDia,
} from '@/lib/frequencia';
import { Selo } from '@/components/ui';
import { BotaoImprimir } from '@/components/botao-imprimir';
import { alternarDiaSemAula, removerData } from '../frequencia/actions';
import { FormAdicionarData, FormDatasDoAno } from './formularios';

export const metadata: Metadata = { title: 'Calendário letivo' };

const CLASSE: Record<TipoDia, string> = { feriado: 'd d-f', recesso: 'd d-r', sem_aula: 'd d-s', evento: 'd d-l d-e' };

export default async function Calendario() {
  const sessao = await exigirSessao(GESTAO);
  const podeDatas = temAlgum(sessao.papeis, ['coordenacao', 'secretaria']);
  const supabase = await criarClienteSupabase();
  const { data: anoRow } = await supabase.from('anos_letivos').select('id, ano, inicio, fim').eq('ativo', true).maybeSingle();
  if (!anoRow) return <main className="pagina"><h1 className="titulo">Calendário letivo</h1><p className="vazio">Nenhum ano letivo ativo.</p></main>;
  const ano = anoRow as AnoLetivo;

  const [{ data: cal }, { data: turmas }] = await Promise.all([
    supabase.from('calendario_dias').select('data, tipo, descricao').eq('ano_letivo_id', ano.id).order('data'),
    supabase.from('turmas').select('turno').eq('ano_letivo_id', ano.id),
  ]);
  const dias = (cal ?? []) as DiaCalendario[];
  const ex = new Map(dias.map((d) => [d.data, d]));
  const temIntegral = (turmas ?? []).some((t) => t.turno === 'integral');
  const definido = Boolean(ano.inicio && ano.fim);

  // Meses mostrados: do início ao fim das aulas (ou fevereiro a dezembro).
  const mesIni = definido ? Number(ano.inicio!.slice(5, 7)) : 2;
  const mesFim = definido ? Number(ano.fim!.slice(5, 7)) : 12;
  const anoIni = definido ? Number(ano.inicio!.slice(0, 4)) : ano.ano;
  const meses: { a: number; m: number }[] = [];
  for (let a = anoIni, m = mesIni; a < Number((ano.fim ?? `${ano.ano}`).slice(0, 4)) || (a === Number((ano.fim ?? `${ano.ano}`).slice(0, 4)) && m <= mesFim);) {
    meses.push({ a, m });
    m++; if (m > 12) { m = 1; a++; }
    if (meses.length > 14) break;
  }

  let totalLetivos = 0;
  const grades = meses.map(({ a, m }) => {
    const celulas: { chave: string; n?: number; classe: string; rotulo?: string; iso?: string; acao?: boolean }[] = [];
    const primeiro = diaDaSemana(isoDe(a, m, 1));
    for (let i = 0; i < primeiro; i++) celulas.push({ chave: `v${i}`, classe: 'd' });
    let letivos = 0;
    for (let d = 1; d <= diasNoMes(a, m); d++) {
      const iso = isoDe(a, m, d);
      const dow = diaDaSemana(iso);
      const util = dow > 0 && dow < 6;
      const noPeriodo = definido && iso >= ano.inicio! && iso <= ano.fim!;
      const e = ex.get(iso);
      if (!util || !noPeriodo) {
        celulas.push({ chave: iso, n: d, classe: e && util ? CLASSE[e.tipo] : 'd', rotulo: e ? `${ddmm(iso)}: ${e.descricao}` : undefined });
        continue;
      }
      if (e && e.tipo !== 'evento') {
        celulas.push({ chave: iso, n: d, classe: CLASSE[e.tipo], iso, acao: e.tipo === 'sem_aula',
          rotulo: `${ddmm(iso)}: ${e.descricao}${e.tipo === 'sem_aula' ? ' (toque para voltar a ser dia letivo)' : ''}` });
        continue;
      }
      if (eDiaLetivo(iso, ano, ex)) letivos++;
      celulas.push({ chave: iso, n: d, classe: e ? CLASSE.evento : 'd d-l', iso, acao: !e,
        rotulo: `${ddmm(iso)}: dia letivo${e ? ` · ${e.descricao}` : ''}${e ? '' : ' (toque para marcar sem aula)'}` });
    }
    totalLetivos += letivos;
    return { chave: `${a}-${m}`, nome: NOMES_MES[m - 1].replace(/^./, (c) => c.toUpperCase()) + (a !== ano.ano ? ` ${a}` : ''), letivos, celulas };
  });

  const horasParcial = totalLetivos * HORAS_POR_DIA.manha;
  const horasIntegral = totalLetivos * HORAS_POR_DIA.integral;
  const okDias = totalLetivos >= DIAS_MINIMOS;
  const okHoras = horasParcial >= HORAS_MINIMAS;

  // Lista agrupada: dias seguidos com o mesmo tipo e descrição viram um período.
  const grupos: { tipo: TipoDia; descricao: string; de: string; ate: string; n: number }[] = [];
  dias.forEach((d) => {
    const g = grupos.find((x) => x.tipo === d.tipo && x.descricao === d.descricao);
    if (g) { g.ate = d.data; g.n++; } else grupos.push({ tipo: d.tipo, descricao: d.descricao, de: d.data, ate: d.data, n: 1 });
  });

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">
            {definido ? `Aulas de ${ddmm(ano.inicio!)}/${ano.inicio!.slice(0, 4)} a ${ddmm(ano.fim!)}/${ano.fim!.slice(0, 4)}` : 'Período das aulas ainda não definido'}
          </p>
          <h1 className="titulo">Calendário letivo {ano.ano}</h1>
        </div>
        <BotaoImprimir>Imprimir calendário</BotaoImprimir>
      </div>

      {definido ? (
        <div className="grade-cartoes">
          <section className="painel" aria-label="Dias letivos" style={{ display: 'grid', gap: 8 }}>
            <div className="cartao-turma-topo"><strong>Dias letivos</strong>
              <Selo tom={okDias ? 'verde' : 'alerta'}>{okDias ? `Cumpre · sobram ${totalLetivos - DIAS_MINIMOS}` : `Faltam ${DIAS_MINIMOS - totalLetivos} dias`}</Selo></div>
            <span><span className="numero-grande">{totalLetivos}</span> <span className="legenda">de {DIAS_MINIMOS} exigidos</span></span>
            <div className="medidor" role="img" aria-label={`${totalLetivos} dias letivos de ${DIAS_MINIMOS} exigidos`}>
              <div className={okDias ? '' : 'baixa'} style={{ width: `${Math.min(100, (100 * totalLetivos) / DIAS_MINIMOS)}%` }} />
            </div>
          </section>
          <section className="painel" aria-label="Carga horária" style={{ display: 'grid', gap: 8 }}>
            <div className="cartao-turma-topo"><strong>Horas no turno parcial (4h/dia)</strong>
              <Selo tom={okHoras ? 'verde' : 'alerta'}>{okHoras ? 'Cumpre' : `Faltam ${HORAS_MINIMAS - horasParcial} h`}</Selo></div>
            <span><span className="numero-grande">{horasParcial}</span> <span className="legenda">de {HORAS_MINIMAS} horas exigidas</span></span>
            <div className="medidor" role="img" aria-label={`${horasParcial} horas de ${HORAS_MINIMAS} exigidas`}>
              <div className={okHoras ? '' : 'baixa'} style={{ width: `${Math.min(100, (100 * horasParcial) / HORAS_MINIMAS)}%` }} />
            </div>
            {temIntegral ? <span className="legenda">Turmas integrais (7h/dia): {horasIntegral} horas.</span> : null}
          </section>
          <section className="painel-dourado" aria-label="Regra" style={{ display: 'grid', gap: 6 }}>
            <strong>O que a lei pede na pré-escola</strong>
            <span className="legenda" style={{ color: 'var(--ink)' }}>
              Pelo menos {DIAS_MINIMOS} dias e {HORAS_MINIMAS} horas no ano; mínimo de 4 horas por dia no turno parcial e 7 no integral
              (LDB, art. 31). Toque num dia útil para marcar ou desmarcar como dia sem aula.
            </span>
          </section>
        </div>
      ) : (
        <div className="painel-dourado">
          <strong>Defina o início e o fim das aulas</strong> para o sistema contar os dias letivos e as horas.
          {podeDatas ? '' : ' Peça à coordenação ou à secretaria.'}
        </div>
      )}

      <div className="legenda-freq">
        <span><span className="d d-l" aria-hidden="true" />Dia letivo</span>
        <span><span className="d d-f" aria-hidden="true" />Feriado</span>
        <span><span className="d d-r" aria-hidden="true" />Recesso</span>
        <span><span className="d d-s" aria-hidden="true" />Sem aula</span>
        <span><span className="d d-l d-e" aria-hidden="true" />Evento com aula</span>
      </div>

      <div className="colunas">
        <div className="coluna-principal meses-ano">
          {grades.map((g) => (
            <section key={g.chave} className="mes-ano" aria-label={g.nome}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{g.nome}</strong>
                {definido ? <span className="legenda">{g.letivos} {g.letivos === 1 ? 'dia' : 'dias'}</span> : null}
              </div>
              <div className="mes-ano-grade">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((s, i) => <span key={i} aria-hidden="true">{s}</span>)}
                {g.celulas.map((c) => c.acao ? (
                  <form key={c.chave} action={alternarDiaSemAula}>
                    <input type="hidden" name="ano" value={ano.id} />
                    <input type="hidden" name="dia" value={c.iso} />
                    <button type="submit" className={c.classe} aria-label={c.rotulo} title={c.rotulo}>{c.n}</button>
                  </form>
                ) : (
                  <span key={c.chave} className={c.classe} title={c.rotulo}>
                    {c.n}{c.rotulo ? <span className="sr-only"> {c.rotulo}</span> : null}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="coluna-lateral">
          {podeDatas ? <FormDatasDoAno anoId={ano.id} ano={ano.ano} inicio={ano.inicio} fim={ano.fim} /> : null}
          <section className="painel" aria-labelledby="t-datas">
            <h2 id="t-datas" className="secao-titulo" style={{ marginBottom: 4 }}>Feriados e dias sem aula</h2>
            {grupos.length === 0 ? <p className="vazio" style={{ padding: '8px 0' }}>Nenhuma data cadastrada.</p> : (
              <ul className="lista-linhas">
                {grupos.map((g) => (
                  <li key={`${g.tipo}|${g.descricao}`}>
                    <span style={{ flex: 'none', width: 92, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {g.de === g.ate ? ddmm(g.de) : `${ddmm(g.de)}–${ddmm(g.ate)}`}
                    </span>
                    <span className="cresce">{g.descricao}<br /><span className="legenda">{TIPOS_DIA[g.tipo]}{g.n > 1 ? ` · ${g.n} dias` : ''}</span></span>
                    <form action={removerData}>
                      <input type="hidden" name="ano" value={ano.id} />
                      <input type="hidden" name="tipo" value={g.tipo} />
                      <input type="hidden" name="descricao" value={g.descricao} />
                      <button type="submit" className="se-btn se-btn-texto se-btn-sm" aria-label={`Remover ${g.descricao}`}>Remover</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="legenda" style={{ margin: '8px 0 0' }}>Feriados municipais de Itapecerica: confira com a prefeitura e adicione abaixo.</p>
          </section>
          <FormAdicionarData anoId={ano.id} />
        </aside>
      </div>
    </main>
  );
}
