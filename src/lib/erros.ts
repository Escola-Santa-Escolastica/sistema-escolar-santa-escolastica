import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Mensagem para a tela. As regras do banco já levantam erros em português
 * (códigos P0001/P0002/42501/22023); o resto vira uma mensagem genérica.
 */
export function mensagemErro(error: PostgrestError | null | undefined, padrao = 'Não foi possível concluir. Tente novamente.') {
  if (!error) return padrao;
  if (['P0001', 'P0002', '42501', '22023'].includes(error.code)) return error.message;
  if (error.code === '23505') {
    if (error.message.includes('cpf')) return 'Este CPF já está cadastrado para outra pessoa. Confira o número.';
    if (error.message.includes('matriculas_uma_por_ano')) return 'Este aluno já tem matrícula neste ano letivo.';
    return 'Este registro já existe.';
  }
  if (error.code === '23514') return 'Algum campo está em formato inválido. Confira CPF (11 números), CEP (8 números) e e-mails.';
  if (error.message?.includes('row-level security')) return 'Seu perfil não tem permissão para esta ação.';
  // Erro inesperado: detalhe técnico só no log do servidor.
  console.error('[banco] erro sem mensagem própria:', error.code, error.message);
  return padrao;
}
