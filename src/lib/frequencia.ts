/**
 * Regras e formatos da frequência (o banco é quem decide de verdade:
 * ver supabase/migrations/*_frequencia.sql).
 */

export const MOTIVOS = {
  doenca: 'Doença ou consulta',
  familia: 'Compromisso da família',
  viagem: 'Viagem',
  outro: 'Outro',
} as const;
export type Motivo = keyof typeof MOTIVOS;

export const TIPOS_DIA = {
  feriado: 'Feriado',
  recesso: 'Recesso',
  sem_aula: 'Sem aula',
  evento: 'Evento (com aula)',
} as const;
export type TipoDia = keyof typeof TIPOS_DIA;

export const HORAS_POR_DIA = { manha: 4, tarde: 4, integral: 7 } as const;
export const MINIMO_LEGAL_PCT = 60;
export const DIAS_MINIMOS = 200;
export const HORAS_MINIMAS = 800;

export const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Data de hoje no fuso da escola, aaaa-mm-dd. */
export function hojeEscola(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // en-CA já sai como aaaa-mm-dd
}

export function isoDe(ano: number, mes: number, dia: number) {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** 0 = domingo … 6 = sábado, sem passar por fuso. */
export function diaDaSemana(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function ddmm(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function rotuloDia(iso: string) {
  const nome = NOMES_DIA[diaDaSemana(iso)];
  return `${nome.charAt(0).toUpperCase() + nome.slice(1)}, ${ddmm(iso)}`;
}

export function diasNoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export type AnoLetivo = { id: string; ano: number; inicio: string | null; fim: string | null };
export type DiaCalendario = { data: string; tipo: TipoDia; descricao: string };

/** Mesma regra de public.e_dia_letivo(). */
export function eDiaLetivo(iso: string, ano: AnoLetivo, excecoes: Map<string, DiaCalendario>) {
  const dow = diaDaSemana(iso);
  if (dow === 0 || dow === 6) return false;
  if (ano.inicio && iso < ano.inicio) return false;
  if (ano.fim && iso > ano.fim) return false;
  const ex = excecoes.get(iso);
  return !(ex && ex.tipo !== 'evento');
}

/** Dias letivos de um mês (aaaa-mm). */
export function diasLetivosDoMes(mes: string, ano: AnoLetivo, excecoes: Map<string, DiaCalendario>) {
  const [a, m] = mes.split('-').map(Number);
  const dias: string[] = [];
  for (let d = 1; d <= diasNoMes(a, m); d++) {
    const iso = isoDe(a, m, d);
    if (eDiaLetivo(iso, ano, excecoes)) dias.push(iso);
  }
  return dias;
}

export function mesAnterior(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${pad(m - 1)}`;
}
export function mesSeguinte(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${pad(m + 1)}`;
}
export function nomeDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const n = NOMES_MES[m - 1];
  return `${n.charAt(0).toUpperCase() + n.slice(1)} de ${a}`;
}
export function mesValido(v: string | undefined) {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : undefined;
}
export function dataValida(v: string | undefined) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/** Situação de um registro: p presente · f falta · j justificada · a em análise. */
export type Situacao = 'p' | 'f' | 'j' | 'a';
export type RegistroDia = {
  aluno_id: string; turma_id: string; data: string; situacao: 'presente' | 'falta';
  justificativa_id: string | null; justificativa_status: 'pendente' | 'aceita' | null;
  justificativa_motivo: Motivo | null; justificativa_observacao: string | null; aviso_previo: boolean | null;
};
export function situacaoDe(r: Pick<RegistroDia, 'situacao' | 'justificativa_status'>): Situacao {
  if (r.situacao === 'presente') return 'p';
  if (r.justificativa_status === 'aceita') return 'j';
  if (r.justificativa_status === 'pendente') return 'a';
  return 'f';
}
export const ROTULO_SITUACAO: Record<Situacao, string> = {
  p: 'Presente',
  f: 'Falta sem justificativa',
  j: 'Falta justificada',
  a: 'Justificativa em análise',
};

export type ResumoAluno = {
  aluno_id: string; dias: number; presencas: number; faltas: number; justificadas: number; em_analise: number;
  percentual: number; faltas_seguidas_sem_aviso: number; ultima_chamada: string;
};

export function pct(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(0)}%`;
}

/** Último dia do mês (aaaa-mm → aaaa-mm-dd), para filtros de período. */
export function fimDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return isoDe(a, m, diasNoMes(a, m));
}
