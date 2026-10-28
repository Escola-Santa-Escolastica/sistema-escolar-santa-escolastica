import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { avaliarSessao, COOKIE_ATIVIDADE } from '@/lib/limite-sessao';

export const dynamic = 'force-dynamic';

/**
 * Usado pelo aviso de sessão na tela.
 * GET: quanto tempo falta (não conta como uso). POST: "continuar conectado"
 * (o proxy já renovou o horário de uso antes de chegar aqui).
 * Sessão vencida nem chega aqui: o proxy responde 401.
 */
async function situacao(request: NextRequest, renovado: boolean) {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ logado: false }, { status: 401 });
  const ultima = renovado ? String(Date.now()) : request.cookies.get(COOKIE_ATIVIDADE)?.value;
  const s = avaliarSessao(data.claims, ultima);
  if (!s.valida) return NextResponse.json({ logado: false, motivo: s.motivo }, { status: 401 });
  return NextResponse.json({ logado: true, restanteMs: s.restanteMs }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  return situacao(request, false);
}

export async function POST(request: NextRequest) {
  return situacao(request, true);
}
