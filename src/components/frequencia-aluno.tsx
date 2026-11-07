import Link from 'next/link';
import {
  diaDaSemana, diasNoMes, eDiaLetivo, isoDe, MINIMO_LEGAL_PCT, mesAnterior, mesSeguinte, nomeDoMes, situacaoDe,
  type AnoLetivo, type DiaCalendario, type RegistroDia,
} from '@/lib/frequencia';

/** Barra 0–100% com as marcas do mínimo legal (60%) e do aviso da escola. */
export function BarraFrequencia({ percentual, aviso }: { percentual: number | null; aviso: number }) {
  const v = percentual ?? 0;
  const descricao = percentual === null
    ? 'Ainda sem chamadas registradas.'
    : `Frequência de ${Math.round(v)}%. Mínimo exigido: ${MINIMO_LEGAL_PCT}%. O sistema avisa abaixo de ${aviso}%.`;
  return (
    <div>
      <div className="barra-freq" role="img" aria-label={descricao}>
        {percentual !== null ? <div className={`barra-freq-valor${v < aviso ? ' baixa' : ''}`} style={{ width: `${Math.max(2, v)}%` }} /> : null}
        <div className="barra-freq-marca" style={{ left: `${MINIMO_LEGAL_PCT}%` }} aria-hidden="true" />
        <div className="barra-freq-marca aviso" style={{ left: `${aviso}%` }} aria-hidden="true" />
      </div>
      <div className="barra-freq-rotulos" aria-hidden="true">
        <span style={{ left: `${MINIMO_LEGAL_PCT}%`, color: 'var(--alerta)' }}>{MINIMO_LEGAL_PCT}% mínimo</span>
        <span style={{ left: `${Math.min(aviso + 6, 92)}%`, color: 'var(--dourado-ink)' }}>{aviso}% aviso</span>
      </div>
    </div>
  );
}

const TEXTO: Record<string, string> = { p: 'Presente', f: 'Falta', j: 'Justificada', a: 'Em análise' };

/** Mês em dias úteis (seg a sex) com a situação de cada dia. */
export function CalendarioMes({ mes, hoje, ano, excecoes, registros, hrefMes, idTitulo }: {
  mes: string;
  hoje: string;
  ano: AnoLetivo;
  excecoes: DiaCalendario[];
  registros: Pick<RegistroDia, 'data' | 'situacao' | 'justificativa_status'>[];
  hrefMes: (mes: string) => string;
  idTitulo: string;
}) {
  const [a, m] = mes.split('-').map(Number);
  const ex = new Map(excecoes.map((d) => [d.data, d]));
  const reg = new Map(registros.map((r) => [r.data, r]));
  const celulas: { chave: string; classe: string; n?: number; texto?: string; titulo?: string }[] = [];
  const primeiroDow = diaDaSemana(isoDe(a, m, 1));
  // espaços antes do 1º dia útil (segunda = coluna 0)
  if (primeiroDow >= 2 && primeiroDow <= 5) for (let i = 1; i < primeiroDow; i++) celulas.push({ chave: `v${i}`, classe: 'dia-cal dia-cal-vazio' });
  for (let d = 1; d <= diasNoMes(a, m); d++) {
    const iso = isoDe(a, m, d);
    const dow = diaDaSemana(iso);
    if (dow === 0 || dow === 6) continue;
    const r = reg.get(iso);
    const e = ex.get(iso);
    let tipo = 'x';
    let texto = '';
    if (r) { tipo = situacaoDe(r); texto = TEXTO[tipo]; }
    else if (e && e.tipo !== 'evento') texto = e.descricao;
    else if (eDiaLetivo(iso, ano, ex) && iso > hoje) texto = '';
    else if (eDiaLetivo(iso, ano, ex)) texto = 'Sem chamada';
    celulas.push({
      chave: iso, n: d, texto,
      classe: `dia-cal dia-cal-${tipo}${iso === hoje ? ' dia-cal-hoje' : ''}`,
      titulo: texto ? `${d}/${m}: ${texto}` : undefined,
    });
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 id={idTitulo} className="secao-titulo" style={{ flexGrow: 1 }}>{nomeDoMes(mes)}</h2>
        <Link href={hrefMes(mesAnterior(mes))} scroll={false} className="se-btn se-btn-texto se-btn-sm" aria-label="Mês anterior">‹</Link>
        <Link href={hrefMes(mesSeguinte(mes))} scroll={false} className="se-btn se-btn-texto se-btn-sm" aria-label="Próximo mês">›</Link>
      </div>
      <div className="mes-semana" aria-hidden="true"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span></div>
      <div className="mes-dias">
        {celulas.map((c) => (
          <div key={c.chave} className={c.classe} title={c.titulo}>
            {c.n ? <b>{c.n}</b> : null}
            {c.texto ? <span>{c.texto}</span> : null}
            {c.titulo ? <span className="sr-only">{c.titulo}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
