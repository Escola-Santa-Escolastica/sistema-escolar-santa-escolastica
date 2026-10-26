/**
 * Perfis de acesso e o que cada um vê no menu.
 * Espelha a matriz de permissões da especificação. Isto controla só a
 * INTERFACE; quem garante o acesso de verdade é a RLS do banco
 * (supabase/migrations/*_permissoes.sql).
 */

export type Papel =
  | 'admin'
  | 'direcao'
  | 'coordenacao'
  | 'secretaria'
  | 'financeiro'
  | 'professor_regente'
  | 'professor_especialista'
  | 'auxiliar'
  | 'responsavel'
  | 'aluno';

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  direcao: 'Direção',
  coordenacao: 'Coordenação',
  secretaria: 'Secretaria',
  financeiro: 'Financeiro',
  professor_regente: 'Professor(a) regente',
  professor_especialista: 'Professor(a) especialista',
  auxiliar: 'Auxiliar / Portaria',
  responsavel: 'Responsável',
  aluno: 'Aluno',
};

/** Papéis que a tela de usuários pode atribuir (fase atual). */
export const PAPEIS_ATRIBUIVEIS: Papel[] = [
  'direcao',
  'coordenacao',
  'secretaria',
  'professor_regente',
  'professor_especialista',
  'auxiliar',
  'admin',
];

export const PAPEIS_COM_TURMA: Papel[] = ['professor_regente', 'professor_especialista', 'auxiliar'];
export const GESTAO: Papel[] = ['direcao', 'coordenacao', 'secretaria'];

export type ItemMenu = { href: string; rotulo: string; papeis: Papel[] };

export const MENU: ItemMenu[] = [
  { href: '/inicio', rotulo: 'Início', papeis: ['direcao', 'coordenacao', 'secretaria', 'professor_regente', 'professor_especialista', 'auxiliar', 'admin'] },
  { href: '/alunos', rotulo: 'Alunos', papeis: ['direcao', 'coordenacao', 'secretaria', 'professor_regente', 'professor_especialista', 'auxiliar'] },
  { href: '/matriculas', rotulo: 'Matrículas', papeis: ['direcao', 'coordenacao', 'secretaria'] },
  { href: '/turmas', rotulo: 'Turmas', papeis: ['direcao', 'coordenacao', 'secretaria'] },
  { href: '/usuarios', rotulo: 'Usuários', papeis: ['admin', 'direcao'] },
];

export function temAlgum(papeis: Papel[], permitidos: Papel[]) {
  return papeis.some((p) => permitidos.includes(p));
}

export function menuDoUsuario(papeis: Papel[]) {
  return MENU.filter((item) => temAlgum(papeis, item.papeis));
}

/** Família sem nenhum papel da escola vai para a área da família. */
export function eSoFamilia(papeis: Papel[]) {
  return papeis.length > 0 && papeis.every((p) => p === 'responsavel');
}
