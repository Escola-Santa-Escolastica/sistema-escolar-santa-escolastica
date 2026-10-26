'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { exigirSessao } from '@/lib/sessao';
import { mensagemErro } from '@/lib/erros';
import { TURNOS } from '@/lib/formatos';

export type EstadoTurma = { erro?: string; ok?: string };

const esquemaTurma = z.object({
  etapa_id: z.string().uuid('Escolha a etapa.'),
  turno: z.enum(['manha', 'tarde', 'integral'], { message: 'Escolha o turno.' }),
  nome: z.string().trim().optional(),
  capacidade: z.coerce.number().int().min(1, 'Capacidade mínima: 1.').max(60, 'Capacidade máxima: 60.'),
});

export async function criarTurma(_: EstadoTurma, form: FormData): Promise<EstadoTurma> {
  await exigirSessao(['coordenacao', 'secretaria']);
  const r = esquemaTurma.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0]?.message };
  const supabase = await criarClienteSupabase();
  const [{ data: ano }, { data: etapa }] = await Promise.all([
    supabase.from('anos_letivos').select('id').eq('ativo', true).maybeSingle(),
    supabase.from('etapas').select('nome').eq('id', r.data.etapa_id).single(),
  ]);
  if (!ano) return { erro: 'Ative um ano letivo antes de criar turmas.' };
  const nome = r.data.nome || `${etapa?.nome} · ${TURNOS[r.data.turno]}`;
  const { error } = await supabase.from('turmas').insert({
    ano_letivo_id: ano.id, etapa_id: r.data.etapa_id, turno: r.data.turno, nome, capacidade: r.data.capacidade,
  });
  if (error) return { erro: error.code === '23505' ? `Já existe a turma "${nome}" neste ano. Dê outro nome (ex.: ${nome} A).` : mensagemErro(error) };
  revalidatePath('/turmas');
  return { ok: `Turma ${nome} criada.` };
}

export async function alterarCapacidade(form: FormData) {
  await exigirSessao(['coordenacao', 'secretaria']);
  const id = z.string().uuid().parse(form.get('id'));
  const capacidade = z.coerce.number().int().min(1).max(60).parse(form.get('capacidade'));
  const supabase = await criarClienteSupabase();
  await supabase.from('turmas').update({ capacidade }).eq('id', id);
  revalidatePath('/turmas');
}

export async function criarAnoLetivo(_: EstadoTurma, form: FormData): Promise<EstadoTurma> {
  await exigirSessao(['coordenacao', 'secretaria']);
  const r = z.object({
    ano: z.coerce.number().int().min(2024, 'Ano inválido.').max(2100, 'Ano inválido.'),
    inicio: z.string().optional().transform((v) => v || null),
    fim: z.string().optional().transform((v) => v || null),
  }).safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0]?.message };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('anos_letivos').insert({ ano: r.data.ano, inicio: r.data.inicio, fim: r.data.fim, ativo: false });
  if (error) return { erro: error.code === '23505' ? `O ano letivo ${r.data.ano} já existe.` : mensagemErro(error) };
  revalidatePath('/turmas');
  return { ok: `Ano letivo ${r.data.ano} criado. Ative-o quando as matrículas dele começarem.` };
}

/** Troca o ano ativo (o índice único só permite um ativo por vez). */
export async function ativarAnoLetivo(form: FormData) {
  await exigirSessao(['coordenacao', 'secretaria']);
  const id = z.string().uuid().parse(form.get('id'));
  const supabase = await criarClienteSupabase();
  await supabase.from('anos_letivos').update({ ativo: false }).eq('ativo', true);
  await supabase.from('anos_letivos').update({ ativo: true }).eq('id', id);
  revalidatePath('/', 'layout');
}
