import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { type Papel, temAlgum } from '@/lib/perfis';

export type Atribuicao = { papel: Papel; turma_id: string | null; componente_id: string | null };

export type Sessao = {
  userId: string;
  email: string;
  nome: string;
  papeis: Papel[];
  atribuicoes: Atribuicao[];
};

/** Usuário logado + perfis. Memorizado por requisição. */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteSupabase();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const [{ data: atribuicoes }, { data: pessoa }] = await Promise.all([
    supabase.rpc('meus_papeis'),
    supabase.from('pessoas').select('nome').eq('user_id', claims.sub).maybeSingle(),
  ]);

  const lista = (atribuicoes ?? []) as Atribuicao[];
  const email = typeof claims.email === 'string' ? claims.email : '';
  return {
    userId: claims.sub,
    email,
    nome: pessoa?.nome ?? email,
    papeis: [...new Set(lista.map((a) => a.papel))],
    atribuicoes: lista,
  };
});

/** Exige login e, opcionalmente, um dos perfis. */
export async function exigirSessao(permitidos?: Papel[]): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  if (permitidos && !temAlgum(sessao.papeis, permitidos)) redirect('/sem-acesso');
  return sessao;
}
