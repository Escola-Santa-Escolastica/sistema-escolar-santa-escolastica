import 'server-only';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { hojeEscola } from '@/lib/frequencia';
import type { Publicacao, TipoPublicacao } from '@/lib/site';

const CAMPOS = 'id, tipo, titulo, slug, resumo, texto, evento_data, evento_inicio, evento_fim, evento_local, visibilidade, turma_id, status, publicar_em, created_at, updated_at';

/**
 * Leituras do site público. Sempre filtra "público": mesmo quem está logado
 * vê no site só o que é aberto (o resto aparece na área da família).
 * A RLS do banco garante o mesmo para visitantes sem login.
 */
export async function publicacoesDoSite({ tipo, limite = 30, ate }: { tipo?: TipoPublicacao; limite?: number; ate?: string } = {}) {
  const supabase = await criarClienteSupabase();
  let q = supabase.from('publicacoes').select(CAMPOS)
    .eq('status', 'publicada').eq('visibilidade', 'publico').lte('publicar_em', new Date().toISOString())
    .order('publicar_em', { ascending: false }).limit(limite);
  if (tipo) q = q.eq('tipo', tipo);
  if (ate) q = q.lt('publicar_em', ate);
  const { data } = await q;
  return (data ?? []) as Publicacao[];
}

export async function proximosEventos(limite = 4) {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.from('publicacoes').select(CAMPOS)
    .eq('status', 'publicada').eq('visibilidade', 'publico').eq('tipo', 'evento')
    .lte('publicar_em', new Date().toISOString()).gte('evento_data', hojeEscola())
    .order('evento_data').limit(limite);
  return (data ?? []) as Publicacao[];
}

export async function publicacaoPorSlug(slug: string) {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.from('publicacoes').select(CAMPOS)
    .eq('slug', slug).eq('status', 'publicada').eq('visibilidade', 'publico')
    .lte('publicar_em', new Date().toISOString()).maybeSingle();
  return data as Publicacao | null;
}
