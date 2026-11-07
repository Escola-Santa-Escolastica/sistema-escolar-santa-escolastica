'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { exigirSessao } from '@/lib/sessao';
import { mensagemErro } from '@/lib/erros';
import { GESTAO } from '@/lib/perfis';
import { ddmm, MOTIVOS, TIPOS_DIA } from '@/lib/frequencia';

export type EstadoFreq = { erro?: string; ok?: string };

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function revalidarTudo() {
  revalidatePath('/frequencia', 'layout');
  revalidatePath('/chamada', 'layout');
  revalidatePath('/alunos', 'layout');
  revalidatePath('/familia', 'layout');
  revalidatePath('/calendario');
}

// ---------- Chamada ----------

export async function salvarChamada(turmaId: string, dia: string, faltas: string[]): Promise<EstadoFreq> {
  await exigirSessao([...GESTAO, 'professor_regente']);
  const r = z.object({ turmaId: uuid, dia: data, faltas: z.array(uuid).max(80) }).safeParse({ turmaId, dia, faltas });
  if (!r.success) return { erro: 'Dados da chamada inválidos. Recarregue a página.' };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc('salvar_chamada', { p_turma: turmaId, p_data: dia, p_faltas: faltas });
  if (error) return { erro: mensagemErro(error) };
  revalidarTudo();
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
  return { ok: `Chamada de ${ddmm(dia)} salva às ${hora.replace(':', 'h')}.` };
}

export async function marcarFrequencia(form: FormData) {
  await exigirSessao([...GESTAO, 'professor_regente']);
  const r = z.object({ turma: uuid, dia: data, aluno: uuid, situacao: z.enum(['presente', 'falta']) })
    .safeParse(Object.fromEntries(form));
  if (!r.success) return;
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc('marcar_frequencia', {
    p_turma: r.data.turma, p_data: r.data.dia, p_aluno: r.data.aluno, p_situacao: r.data.situacao,
  });
  if (error) console.error('[frequencia] correção recusada:', error.message);
  revalidarTudo();
}

// ---------- Justificativas (gestão) ----------

const esquemaJust = z.object({
  aluno: uuid,
  dia: data,
  motivo: z.enum(Object.keys(MOTIVOS) as [keyof typeof MOTIVOS, ...(keyof typeof MOTIVOS)[]], { error: 'Escolha o motivo.' }),
  observacao: z.string().trim().max(500, 'Observação muito longa (máximo 500 letras).').optional(),
});

export async function justificarFalta(_: EstadoFreq, form: FormData): Promise<EstadoFreq> {
  await exigirSessao(GESTAO);
  const r = esquemaJust.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0]?.path[0] === 'motivo' ? 'Escolha o motivo.' : 'Confira os dados da justificativa.' };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc('registrar_justificativa', {
    p_aluno: r.data.aluno, p_data: r.data.dia, p_motivo: r.data.motivo, p_observacao: r.data.observacao ?? null,
  });
  if (error) return { erro: mensagemErro(error) };
  revalidarTudo();
  return { ok: `Falta de ${ddmm(r.data.dia)} justificada.` };
}

export async function analisarJustificativa(form: FormData) {
  await exigirSessao(GESTAO);
  const r = z.object({ id: uuid, aceitar: z.enum(['sim', 'nao']) }).safeParse(Object.fromEntries(form));
  if (!r.success) return;
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc('analisar_justificativa', { p_id: r.data.id, p_aceitar: r.data.aceitar === 'sim' });
  if (error) console.error('[frequencia] análise recusada:', error.message);
  revalidarTudo();
}

// ---------- Calendário ----------

export async function alternarDiaSemAula(form: FormData) {
  await exigirSessao(GESTAO);
  const r = z.object({ ano: uuid, dia: data }).safeParse(Object.fromEntries(form));
  if (!r.success) return;
  const supabase = await criarClienteSupabase();
  const { data: existente } = await supabase.from('calendario_dias').select('id, tipo')
    .eq('ano_letivo_id', r.data.ano).eq('data', r.data.dia).maybeSingle();
  if (existente) {
    // Só desfaz o que é "sem aula"; feriado e recesso saem pela lista.
    if (existente.tipo === 'sem_aula' || existente.tipo === 'evento') {
      await supabase.from('calendario_dias').delete().eq('id', existente.id);
    }
  } else {
    await supabase.from('calendario_dias').insert({ ano_letivo_id: r.data.ano, data: r.data.dia, tipo: 'sem_aula', descricao: 'Sem aula' });
  }
  revalidarTudo();
}

const esquemaData = z.object({
  ano: uuid,
  de: z.string({ error: 'Informe a data.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  ate: z.string().optional(),
  tipo: z.enum(Object.keys(TIPOS_DIA) as [keyof typeof TIPOS_DIA, ...(keyof typeof TIPOS_DIA)[]], { error: 'Escolha o tipo.' }),
  descricao: z.string({ error: 'Escreva a descrição.' }).trim().min(2, 'Escreva a descrição (ex.: Aniversário da cidade).').max(80),
});

export async function adicionarData(_: EstadoFreq, form: FormData): Promise<EstadoFreq> {
  await exigirSessao(GESTAO);
  const r = esquemaData.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0]?.message ?? 'Confira os dados.' };
  const { ano, de, tipo, descricao } = r.data;
  const ate = r.data.ate && /^\d{4}-\d{2}-\d{2}$/.test(r.data.ate) ? r.data.ate : de;
  if (ate < de) return { erro: 'A data final é antes da inicial.' };
  const dias: string[] = [];
  for (let d = new Date(`${de}T12:00:00Z`); d.toISOString().slice(0, 10) <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10));
    if (dias.length > 62) return { erro: 'Período longo demais (máximo 2 meses).' };
  }
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('calendario_dias')
    .upsert(dias.map((dia) => ({ ano_letivo_id: ano, data: dia, tipo, descricao })), { onConflict: 'ano_letivo_id,data' });
  if (error) return { erro: mensagemErro(error) };
  revalidarTudo();
  return { ok: dias.length === 1 ? `${ddmm(de)} adicionado ao calendário.` : `${dias.length} dias adicionados (${ddmm(de)} a ${ddmm(ate)}).` };
}

export async function removerData(form: FormData) {
  await exigirSessao(GESTAO);
  const r = z.object({ ano: uuid, descricao: z.string(), tipo: z.string() }).safeParse(Object.fromEntries(form));
  if (!r.success) return;
  const supabase = await criarClienteSupabase();
  // remove o grupo inteiro (ex.: todos os dias do recesso)
  await supabase.from('calendario_dias').delete()
    .eq('ano_letivo_id', r.data.ano).eq('descricao', r.data.descricao).eq('tipo', r.data.tipo);
  revalidarTudo();
}

export async function salvarDatasDoAno(_: EstadoFreq, form: FormData): Promise<EstadoFreq> {
  await exigirSessao(['coordenacao', 'secretaria']);
  const r = z.object({ ano: uuid, inicio: data, fim: data }).safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: 'Informe o início e o fim das aulas.' };
  if (r.data.fim <= r.data.inicio) return { erro: 'O fim das aulas precisa ser depois do início.' };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('anos_letivos').update({ inicio: r.data.inicio, fim: r.data.fim }).eq('id', r.data.ano);
  if (error) return { erro: mensagemErro(error) };
  revalidarTudo();
  return { ok: 'Datas das aulas salvas.' };
}
