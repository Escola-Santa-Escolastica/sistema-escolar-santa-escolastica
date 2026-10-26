import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteSupabase } from '@/lib/supabase/server';

/**
 * Destino dos links enviados por e-mail (convite, troca de senha).
 * Valida o token e cria a sessão; depois segue para "proximo".
 * Nos modelos de e-mail do Supabase, o link deve ser:
 *   {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite&proximo=/definir-senha
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as EmailOtpType | null;
  const codigo = url.searchParams.get('code');
  const proximoParam = url.searchParams.get('proximo') ?? '/';
  const proximo = proximoParam.startsWith('/') && !proximoParam.startsWith('//') ? proximoParam : '/';

  const supabase = await criarClienteSupabase();
  let ok = false;
  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    ok = !error;
  } else if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    ok = !error;
  }

  const destino = url.clone();
  destino.search = '';
  if (ok) {
    destino.pathname = proximo;
  } else {
    destino.pathname = '/entrar';
    destino.searchParams.set('erro', 'link');
  }
  return NextResponse.redirect(destino);
}
