'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { exigirSessao } from '@/lib/sessao';
import { mensagemValidacao } from '@/lib/ficha';
import { PAPEIS_ATRIBUIVEIS, PAPEIS_COM_TURMA, type Papel } from '@/lib/perfis';

export type EstadoUsuario = { erro?: string; ok?: string };

const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.'),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  papel: z.enum(PAPEIS_ATRIBUIVEIS as [Papel, ...Papel[]]),
  turma_id: z.string().uuid().optional().or(z.literal('')),
  componente_id: z.string().uuid().optional().or(z.literal('')),
});

/**
 * Convida (ou reaproveita) a conta pelo e-mail e atribui o perfil.
 * Só o administrador; a gravação do perfil passa pela RLS com a sessão dele.
 */
export async function convidarUsuario(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirSessao(['admin']);
  const dados = esquema.safeParse(Object.fromEntries(form));
  if (!dados.success) return { erro: mensagemValidacao(dados) };
  const { nome, email, papel } = dados.data;
  const turmaId = dados.data.turma_id || null;
  const componenteId = dados.data.componente_id || null;

  if (PAPEIS_COM_TURMA.includes(papel) && !turmaId) return { erro: 'Escolha a turma deste perfil.' };
  if (papel === 'professor_especialista' && !componenteId) return { erro: 'Escolha o componente do professor especialista.' };

  const admin = criarClienteAdmin();
  const supabase = await criarClienteSupabase();

  // 1. Conta: convida por e-mail; se já existir, reaproveita.
  let userId: string | undefined;
  const convite = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirmar?proximo=/definir-senha`,
  });
  if (convite.data.user) {
    userId = convite.data.user.id;
  } else {
    const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = lista?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return { erro: `Não foi possível convidar ${email}: ${convite.error?.message ?? 'erro desconhecido'}.` };
  }

  // 2. Pessoa ligada à conta (cria se ainda não houver).
  const { data: pessoa } = await supabase.from('pessoas').select('id').eq('user_id', userId).maybeSingle();
  if (!pessoa) {
    const { error } = await supabase.from('pessoas').insert({ nome, email, user_id: userId });
    if (error) return { erro: 'A conta foi criada, mas não deu para salvar o nome. Tente novamente.' };
  }

  // 3. Perfil.
  const { error } = await supabase.from('atribuicoes').insert({
    user_id: userId, papel, turma_id: PAPEIS_COM_TURMA.includes(papel) ? turmaId : null,
    componente_id: papel === 'professor_especialista' ? componenteId : null,
  });
  if (error) {
    if (error.code === '23505') return { erro: 'Esta pessoa já tem esse perfil.' };
    return { erro: 'Não foi possível atribuir o perfil.' };
  }

  revalidatePath('/usuarios');
  return { ok: convite.data.user ? `Convite enviado para ${email}.` : `Perfil adicionado à conta de ${email}.` };
}

export async function alternarPerfil(form: FormData) {
  await exigirSessao(['admin']);
  const id = z.string().uuid().parse(form.get('id'));
  const ativo = form.get('ativo') === 'true';
  const supabase = await criarClienteSupabase();
  await supabase.from('atribuicoes').update({ ativo: !ativo }).eq('id', id);
  revalidatePath('/usuarios');
}
