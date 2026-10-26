'use server';

import { redirect } from 'next/navigation';
import { criarClienteSupabase } from '@/lib/supabase/server';

export type EstadoSenha = { erro?: string };

export async function definirSenha(_: EstadoSenha, form: FormData): Promise<EstadoSenha> {
  const senha = String(form.get('senha') ?? '');
  const confirmacao = String(form.get('confirmacao') ?? '');
  if (senha.length < 10) return { erro: 'A senha precisa ter pelo menos 10 caracteres.' };
  if (senha !== confirmacao) return { erro: 'As duas senhas não são iguais.' };

  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: 'Não foi possível salvar a senha. Peça um novo link à secretaria.' };
  redirect('/');
}
