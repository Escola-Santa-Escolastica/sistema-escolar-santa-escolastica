import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a chave secreta: ignora a RLS. Use SOMENTE para operações de
 * autenticação que o banco não faz sozinho (convidar usuário por e-mail),
 * e sempre depois de conferir o perfil de quem pediu.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) {
    throw new Error('SUPABASE_SECRET_KEY não configurada no servidor.');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
