import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ROTAS_PUBLICAS = ['/entrar', '/definir-senha', '/auth/confirmar'];

/**
 * Renova a sessão do Supabase a cada navegação e manda para /entrar quem
 * não está logado. A autorização de verdade (quem vê o quê) fica no banco.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Valida o token (não apenas lê o cookie).
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(r + '/'));

  if (!logado && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = caminho === '/' ? '' : `?voltar=${encodeURIComponent(caminho)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
