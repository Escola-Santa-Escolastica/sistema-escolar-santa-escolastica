import 'server-only';
import { criarClienteSupabase } from '@/lib/supabase/server';

/** Turmas do ano letivo ativo, para "só as famílias de uma turma". */
export async function turmasAtivas() {
  const supabase = await criarClienteSupabase();
  const { data: ano } = await supabase.from('anos_letivos').select('id').eq('ativo', true).maybeSingle();
  if (!ano) return [];
  const { data } = await supabase.from('turmas').select('id, nome').eq('ano_letivo_id', ano.id).order('nome');
  return (data ?? []) as { id: string; nome: string }[];
}
