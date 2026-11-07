'use server';

import { criarClienteSupabase } from '@/lib/supabase/server';
import { mensagemErro } from '@/lib/erros';

export type EstadoVisita = { erro?: string; ok?: boolean; valores?: { nome?: string; telefone?: string } };

/** Formulário "Agende uma visita" do site (sem login). */
export async function pedirVisita(_: EstadoVisita, form: FormData): Promise<EstadoVisita> {
  const nome = String(form.get('nome') ?? '').trim().slice(0, 120);
  const telefone = String(form.get('telefone') ?? '');
  const idade = String(form.get('idade') ?? '').slice(0, 40);
  const valores = { nome, telefone };
  // Robôs costumam preencher o campo escondido: finge que deu certo.
  if (String(form.get('site') ?? '')) return { ok: true };
  if (nome.length < 3) return { erro: 'Informe seu nome.', valores };
  if (!form.get('consentimento')) return { erro: 'Marque a autorização para a escola entrar em contato.', valores };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc('registrar_interesse', {
    p_nome: nome, p_telefone: telefone, p_idade: idade, p_consentimento: true,
  });
  if (error) return { erro: mensagemErro(error), valores };
  return { ok: true };
}
