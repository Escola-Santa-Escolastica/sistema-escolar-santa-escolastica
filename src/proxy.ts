import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { avaliarSessao, COOKIE_ATIVIDADE, opcoesCookieAtividade } from '@/lib/limite-sessao';

const ROTAS_PUBLICAS = ['/entrar', '/definir-senha', '/auth/confirmar'];
/** Consulta do tempo restante: não conta como uso do sistema. */
const CONSULTA_SESSAO = '/api/sessao';

/**
 * A cada requisição: renova a sessão do Supabase, encerra a sessão parada há
 * muito tempo (ver lib/limite-sessao) e manda para /entrar quem não está logado.
 * A autorização de verdade (quem vê o quê) fica no banco.
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
  const claims = data?.claims;
  let logado = Boolean(claims?.sub);
  let motivo: string | null = null;
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(r + '/'));
  const api = caminho.startsWith('/api/');

  if (logado) {
    const situacao = avaliarSessao(claims, request.cookies.get(COOKIE_ATIVIDADE)?.value);
    if (!situacao.valida) {
      // Sessão parada demais ou longa demais: encerra no Supabase e apaga os cookies.
      await supabase.auth.signOut({ scope: 'local' });
      response.cookies.delete(COOKIE_ATIVIDADE);
      logado = false;
      motivo = situacao.motivo;
    } else if (!(caminho === CONSULTA_SESSAO && request.method === 'GET')) {
      response.cookies.set(COOKIE_ATIVIDADE, String(Date.now()), opcoesCookieAtividade());
    }
  }

  if (!logado && api) {
    const negado = NextResponse.json({ logado: false, motivo }, { status: 401 });
    response.cookies.getAll().forEach((c) => negado.cookies.set(c));
    return negado;
  }

  // Link de convite/troca de senha segue mesmo se havia uma sessão vencida.
  const linkDeEmail = caminho.startsWith('/auth/confirmar');
  if (!logado && (!publica || (motivo && !linkDeEmail))) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    const params = new URLSearchParams();
    if (motivo) params.set('expirou', motivo);
    if (caminho !== '/' && !publica && request.method === 'GET') params.set('voltar', caminho);
    url.search = params.toString() ? `?${params}` : '';
    const redir = NextResponse.redirect(url);
    // leva junto a limpeza dos cookies de sessão
    response.cookies.getAll().forEach((c) => redir.cookies.set(c));
    return redir;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
