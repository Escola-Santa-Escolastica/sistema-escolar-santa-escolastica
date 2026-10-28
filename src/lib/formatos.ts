/** Formatação e rótulos usados nas telas (padrão brasileiro). */

export type StatusMatricula =
  | 'pre_matricula'
  | 'em_analise'
  | 'pendente_documento'
  | 'aguardando_aprovacao'
  | 'matriculado'
  | 'transferido'
  | 'concluido'
  | 'cancelado';

export type TomSelo = 'neutro' | 'verde' | 'dourado' | 'alerta' | 'falta';

export const STATUS_MATRICULA: Record<StatusMatricula, { rotulo: string; tom: TomSelo }> = {
  pre_matricula: { rotulo: 'Pré-matrícula', tom: 'neutro' },
  em_analise: { rotulo: 'Em análise', tom: 'neutro' },
  pendente_documento: { rotulo: 'Documento pendente', tom: 'dourado' },
  aguardando_aprovacao: { rotulo: 'Aguardando direção', tom: 'neutro' },
  matriculado: { rotulo: 'Matriculado', tom: 'verde' },
  transferido: { rotulo: 'Transferido', tom: 'neutro' },
  concluido: { rotulo: 'Concluído', tom: 'verde' },
  cancelado: { rotulo: 'Cancelado', tom: 'neutro' },
};

export const STATUS_EM_ANDAMENTO: StatusMatricula[] = [
  'pre_matricula',
  'em_analise',
  'pendente_documento',
  'aguardando_aprovacao',
];

export const TURNOS = { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' } as const;
export type Turno = keyof typeof TURNOS;

export const CORES_RACA = {
  branca: 'Branca',
  preta: 'Preta',
  parda: 'Parda',
  amarela: 'Amarela',
  indigena: 'Indígena',
  nao_declarada: 'Não declarada',
} as const;

export function soDigitos(v: string | null | undefined) {
  return (v ?? '').replace(/\D/g, '');
}

export function formatarCpf(cpf: string | null | undefined) {
  const d = soDigitos(cpf);
  if (d.length !== 11) return cpf ?? '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** CPF parcialmente oculto para quem não precisa do número completo. */
export function mascararCpf(cpf: string | null | undefined) {
  const d = soDigitos(cpf);
  if (d.length !== 11) return '—';
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
}

export function formatarTelefone(tel: string | null | undefined) {
  const d = soDigitos(tel);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel ?? '';
}

export function formatarCep(cep: string | null | undefined) {
  const d = soDigitos(cep);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep ?? '';
}

// ---- Máscaras enquanto a pessoa digita (aceitam o número pela metade) ----

/** 000.000.000-00 */
export function mascaraCpf(v: string) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** (37) 99999-9999 ou (37) 3333-3333 */
export function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  if (resto.length <= 4) return ddd + resto;
  const corte = d.length === 11 ? 5 : 4;
  return `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** 35550-000 */
export function mascaraCep(v: string) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** RG só com números (e o X final de alguns estados): 12.345.678 ou 12.345.678-9. */
export function normalizarRg(v: string | null | undefined) {
  const limpo = (v ?? '').toUpperCase().replace(/[^0-9X]/g, '');
  // o X só vale como último caractere (dígito verificador)
  return limpo.replace(/X(?=.)/g, '').slice(0, 10);
}

export function mascaraRg(v: string | null | undefined) {
  const d = normalizarRg(v);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
}

/** Datas ISO (aaaa-mm-dd) → dd/mm/aaaa, sem passar por fuso horário. */
export function formatarData(iso: string | null | undefined) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function formatarDataHora(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

export function idadeEmAnos(iso: string | null | undefined, hoje = new Date()) {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  let idade = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade--;
  return idade;
}

/** Valida CPF pelos dígitos verificadores. */
export function cpfValido(cpf: string) {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome;
}
