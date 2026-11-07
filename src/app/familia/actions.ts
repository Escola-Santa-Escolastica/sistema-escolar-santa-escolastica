'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { exigirSessao } from '@/lib/sessao';
import { mensagemErro } from '@/lib/erros';
import { ddmm, MOTIVOS } from '@/lib/frequencia';
import { hojeNaEscola } from '@/lib/hoje';

type Estado = { erro?: string; ok?: string };

const esquema = z.object({
  aluno: z.string().uuid(),
  dia: z.string({ error: 'Informe o dia.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o dia.'),
  motivo: z.enum(Object.keys(MOTIVOS) as [keyof typeof MOTIVOS, ...(keyof typeof MOTIVOS)[]], { error: 'Escolha o motivo.' }),
  observacao: z.string().trim().max(500, 'Recado muito longo (máximo 500 letras).').optional(),
});

/** Aviso antes da falta (vale na hora) ou justificativa depois (a escola analisa). */
export async function avisarOuJustificar(_: Estado, form: FormData): Promise<Estado> {
  await exigirSessao(['responsavel']);
  const r = esquema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0]?.message ?? 'Confira os dados.' };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc('registrar_justificativa', {
    p_aluno: r.data.aluno, p_data: r.data.dia, p_motivo: r.data.motivo, p_observacao: r.data.observacao ?? null,
  });
  if (error) return { erro: mensagemErro(error) };
  revalidatePath('/familia', 'layout');
  return r.data.dia >= (await hojeNaEscola())
    ? { ok: `Aviso enviado. A professora vai ver na chamada de ${ddmm(r.data.dia)}, e a falta já conta como justificada.` }
    : { ok: `Justificativa da falta de ${ddmm(r.data.dia)} enviada. A escola vai analisar e você vê a resposta aqui.` };
}
