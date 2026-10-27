'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';

export type EstadoEntrar = { erro?: string; email?: string };

const esquema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe a senha.'),
  voltar: z.string().optional(),
});

/** Só aceita voltar para caminhos internos (evita redirecionamento aberto). */
function destinoSeguro(voltar?: string) {
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/';
}

export async function entrar(_: EstadoEntrar, form: FormData): Promise<EstadoEntrar> {
  const dados = esquema.safeParse(Object.fromEntries(form));
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message, email: String(form.get('email') ?? '') };
  }

  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: dados.data.email, password: dados.data.senha });
  if (error) {
    // Detalhe técnico só no log do servidor; para a tela, mensagem neutra.
    console.error('[entrar] falha no login:', error.code ?? error.status, error.message);
    // status 0 = não chegou ao servidor (sem conexão, servidor fora do ar)
    if (!error.status || error.name === 'AuthRetryableFetchError') {
      return { erro: 'Não foi possível conectar ao servidor. Confira a internet e tente de novo em instantes.', email: dados.data.email };
    }
    if (error.code === 'email_provider_disabled') {
      return { erro: 'O login por e-mail está desativado no servidor. Avise o administrador.', email: dados.data.email };
    }
    return { erro: 'E-mail ou senha incorretos.', email: dados.data.email };
  }
  redirect(destinoSeguro(dados.data.voltar));
}

export async function sair() {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  redirect('/entrar');
}

export async function enviarLinkSenha(_: EstadoEntrar, form: FormData): Promise<EstadoEntrar> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get('email'));
  if (!email.success) return { erro: 'Informe um e-mail válido.' };
  const supabase = await criarClienteSupabase();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirmar?proximo=/definir-senha`,
  });
  // Mesma resposta exista ou não a conta (não revela quem tem acesso).
  return { erro: undefined, email: 'enviado' };
}
