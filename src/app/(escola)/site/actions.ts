'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { exigirSessao } from '@/lib/sessao';
import { mensagemErro } from '@/lib/erros';
import { GESTAO, temAlgum } from '@/lib/perfis';
import { criarSlug } from '@/lib/site';

export type EstadoPublicacao = { erro?: string; campo?: string; ok?: string };

const PUBLICA: ['direcao', 'coordenacao'] = ['direcao', 'coordenacao'];
const uuid = z.string().uuid();
const vazioNulo = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const esquema = z.object({
  id: z.preprocess(vazioNulo, uuid.optional()),
  tipo: z.enum(['noticia', 'evento', 'comunicado'], { error: 'Escolha o tipo da publicação.' }),
  titulo: z.string().trim().min(3, 'Escreva um título (pelo menos 3 letras).').max(120, 'Título muito longo (máximo 120 letras).'),
  resumo: z.string().trim().min(3, 'Escreva o resumo (aparece nos cartões do site).').max(200, 'Resumo muito longo (máximo 200 letras).'),
  texto: z.string().max(20000, 'Texto muito longo.').default(''),
  evento_data: z.preprocess(vazioNulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do evento inválida.').optional()),
  evento_inicio: z.preprocess(vazioNulo, z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.').optional()),
  evento_fim: z.preprocess(vazioNulo, z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.').optional()),
  evento_local: z.preprocess(vazioNulo, z.string().trim().max(160, 'Local muito longo.').optional()),
  visibilidade: z.enum(['publico', 'familias', 'turma'], { error: 'Escolha quem pode ver.' }),
  turma_id: z.preprocess(vazioNulo, uuid.optional()),
  acao: z.enum(['rascunho', 'publicar', 'agendar']),
  publicar_em: z.preprocess(vazioNulo, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Data de agendamento inválida.').optional()),
});

/** Gera um endereço único: "festa-junina", "festa-junina-2", ... */
async function slugLivre(supabase: Awaited<ReturnType<typeof criarClienteSupabase>>, titulo: string, ignorar?: string) {
  const base = criarSlug(titulo);
  const { data } = await supabase.from('publicacoes').select('id, slug').like('slug', `${base}%`);
  const usados = new Set((data ?? []).filter((r) => r.id !== ignorar).map((r) => r.slug));
  if (!usados.has(base)) return base;
  for (let i = 2; i < 500; i++) if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

function revalidarSite(slug?: string) {
  revalidatePath('/');
  revalidatePath('/noticias');
  if (slug) revalidatePath(`/noticias/${slug}`);
  revalidatePath('/site', 'layout');
  revalidatePath('/familia');
}

export async function salvarPublicacao(_: EstadoPublicacao, form: FormData): Promise<EstadoPublicacao> {
  const sessao = await exigirSessao(GESTAO);
  const r = esquema.safeParse(Object.fromEntries(form));
  if (!r.success) {
    const e = r.error.issues[0];
    return { erro: e.message.startsWith('Invalid') ? 'Confira os campos destacados.' : e.message, campo: String(e.path[0] ?? '') };
  }
  const d = r.data;
  const podePublicar = temAlgum(sessao.papeis, PUBLICA);
  if (d.acao !== 'rascunho' && !podePublicar) {
    return { erro: 'Só a coordenação ou a direção publicam. Salve como rascunho e avise a coordenação.' };
  }
  if (d.tipo === 'evento' && !d.evento_data) return { erro: 'Informe a data do evento.', campo: 'evento_data' };
  if (d.tipo === 'evento' && d.evento_inicio && d.evento_fim && d.evento_fim <= d.evento_inicio) {
    return { erro: 'O horário de término deve ser depois do início.', campo: 'evento_fim' };
  }
  if (d.visibilidade === 'turma' && !d.turma_id) return { erro: 'Escolha a turma.', campo: 'turma_id' };

  let publicarEm: string | null = null;
  if (d.acao === 'publicar') publicarEm = new Date().toISOString();
  if (d.acao === 'agendar') {
    if (!d.publicar_em) return { erro: 'Informe o dia e a hora para publicar.', campo: 'publicar_em' };
    const quando = new Date(`${d.publicar_em}:00-03:00`);
    if (Number.isNaN(quando.getTime()) || quando.getTime() < Date.now() + 60_000) {
      return { erro: 'O agendamento precisa ser para um horário futuro.', campo: 'publicar_em' };
    }
    publicarEm = quando.toISOString();
  }

  const supabase = await criarClienteSupabase();
  let anterior: { slug: string; status: string; publicar_em: string | null } | null = null;
  if (d.id) {
    const { data } = await supabase.from('publicacoes').select('slug, status, publicar_em').eq('id', d.id).maybeSingle();
    if (!data) return { erro: 'Publicação não encontrada. Recarregue a página.' };
    anterior = data;
    if (data.status === 'publicada' && !podePublicar) {
      return { erro: 'Esta publicação já está no ar. Só a coordenação ou a direção podem alterá-la.' };
    }
  }

  const evento = d.tipo === 'evento';
  const linha = {
    tipo: d.tipo,
    titulo: d.titulo,
    resumo: d.resumo,
    texto: d.texto.replace(/\r\n/g, '\n').trim(),
    evento_data: evento ? d.evento_data ?? null : null,
    evento_inicio: evento ? d.evento_inicio ?? null : null,
    evento_fim: evento ? d.evento_fim ?? null : null,
    evento_local: evento ? d.evento_local ?? null : null,
    visibilidade: d.visibilidade,
    turma_id: d.visibilidade === 'turma' ? d.turma_id ?? null : null,
    status: d.acao === 'rascunho' ? 'rascunho' : 'publicada',
    publicar_em: publicarEm,
  };

  let id = d.id;
  let slug = anterior?.slug;
  if (id) {
    // O endereço só muda enquanto a publicação nunca foi ao ar (links já compartilhados continuam valendo).
    if (anterior && anterior.status === 'rascunho') slug = await slugLivre(supabase, d.titulo, id);
    const { error } = await supabase.from('publicacoes').update({ ...linha, slug }).eq('id', id);
    if (error) return { erro: mensagemErro(error) };
  } else {
    slug = await slugLivre(supabase, d.titulo);
    const { data, error } = await supabase.from('publicacoes').insert({ ...linha, slug }).select('id').single();
    if (error) return { erro: mensagemErro(error) };
    id = data.id;
  }
  revalidarSite(slug);
  const aviso = d.acao === 'rascunho' ? 'rascunho' : d.acao === 'agendar' ? 'agendada' : 'publicada';
  redirect(`/site/${id}?salvo=${aviso}`);
}

export async function apagarPublicacao(form: FormData) {
  await exigirSessao(PUBLICA);
  const r = uuid.safeParse(form.get('id'));
  if (!r.success) return;
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.from('publicacoes').select('slug').eq('id', r.data).maybeSingle();
  const { error } = await supabase.from('publicacoes').delete().eq('id', r.data);
  if (error) console.error('[site] exclusão recusada:', error.message);
  revalidarSite(data?.slug);
  redirect('/site?apagada=1');
}

export async function marcarPedido(form: FormData) {
  const sessao = await exigirSessao(GESTAO);
  const r = z.object({ id: uuid, atendido: z.enum(['sim', 'nao']) }).safeParse(Object.fromEntries(form));
  if (!r.success) return;
  const atendido = r.data.atendido === 'sim';
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('pedidos_visita').update({
    atendido, atendido_por: atendido ? sessao.userId : null, atendido_em: atendido ? new Date().toISOString() : null,
  }).eq('id', r.data.id);
  if (error) console.error('[site] pedido de visita:', error.message);
  revalidatePath('/site', 'layout');
  revalidatePath('/inicio');
}
