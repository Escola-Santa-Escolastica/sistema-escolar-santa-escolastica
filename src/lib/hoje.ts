import 'server-only';
import { cache } from 'react';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { hojeEscola } from '@/lib/frequencia';

/**
 * "Hoje" segundo o banco (public.hoje_escola), para a tela e as regras da
 * chamada usarem sempre a mesma data. Memorizado por requisição.
 */
export const hojeNaEscola = cache(async (): Promise<string> => {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc('hoje_escola');
  return typeof data === 'string' ? data : hojeEscola();
});
