'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { exigirSessao } from '@/lib/sessao';
import { mensagemErro } from '@/lib/erros';
import {
  esquemaAluno, esquemaAtendimento, esquemaEndereco, esquemaMatricula, esquemaResponsavel, esquemaSaude,
  primeiroErro, responsaveis, secao,
} from '@/lib/ficha';

export type EstadoForm = { erro?: string };

/** Nova matrícula: grava a ficha inteira numa transação (função criar_matricula no banco). */
export async function criarMatricula(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirSessao(['secretaria']);

  const aluno = esquemaAluno.safeParse(secao(form, 'aluno'));
  const matricula = esquemaMatricula.safeParse(secao(form, 'matricula'));
  const endereco = esquemaEndereco.safeParse(secao(form, 'endereco'));
  const saude = esquemaSaude.safeParse(secao(form, 'saude'));
  const atendimento = esquemaAtendimento.safeParse(secao(form, 'atendimento'));
  const resps = responsaveis(form).map((r) => esquemaResponsavel.safeParse(r));

  const erro = primeiroErro(aluno) ?? primeiroErro(matricula) ?? resps.map(primeiroErro).find(Boolean)
    ?? primeiroErro(endereco) ?? primeiroErro(saude) ?? primeiroErro(atendimento);
  if (erro) return { erro };
  if (resps.length === 0) return { erro: 'Cadastre pelo menos um responsável.' };

  const listaResps = resps.map((r) => r.data!);
  if (!listaResps.some((r) => r.responsavel_legal)) return { erro: 'Marque quem é o responsável legal pela criança.' };
  if (listaResps.filter((r) => r.filiacao === 'mae').length > 1 || listaResps.filter((r) => r.filiacao === 'pai').length > 1) {
    return { erro: 'Só pode haver um pai e uma mãe na filiação.' };
  }

  const supabase = await criarClienteSupabase();
  const { data: id, error } = await supabase.rpc('criar_matricula', {
    p: {
      aluno: aluno.data,
      responsaveis: listaResps,
      endereco: endereco.data,
      saude: saude.data,
      atendimento: atendimento.data,
      matricula: matricula.data,
    },
  });
  if (error || !id) return { erro: mensagemErro(error) };

  revalidatePath('/matriculas');
  redirect(`/matriculas/${id}?ok=criada`);
}

const idSchema = z.string().uuid();
const statusSchema = z.enum([
  'pre_matricula', 'em_analise', 'pendente_documento', 'aguardando_aprovacao', 'matriculado', 'transferido', 'concluido', 'cancelado',
]);

export async function mudarStatus(form: FormData) {
  await exigirSessao();
  const id = idSchema.parse(form.get('id'));
  const para = statusSchema.parse(form.get('para'));
  const observacao = String(form.get('observacao') ?? '').trim() || null;
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc('mudar_status_matricula', { p_matricula: id, p_para: para, p_observacao: observacao });
  revalidatePath(`/matriculas/${id}`);
  revalidatePath('/matriculas');
  redirect(`/matriculas/${id}?${error ? 'erro=' + encodeURIComponent(mensagemErro(error)) : 'ok=status'}`);
}

export async function marcarDocumento(form: FormData) {
  const sessao = await exigirSessao(['secretaria']);
  const id = idSchema.parse(form.get('id'));
  const matriculaId = idSchema.parse(form.get('matricula_id'));
  const status = z.enum(['pendente', 'entregue', 'dispensado']).parse(form.get('status'));
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('documentos_entregues').update({
    status,
    conferido_por: status === 'pendente' ? null : sessao.userId,
    conferido_em: status === 'pendente' ? null : new Date().toISOString(),
  }).eq('id', id);
  revalidatePath(`/matriculas/${matriculaId}`);
  if (error) redirect(`/matriculas/${matriculaId}?erro=${encodeURIComponent(mensagemErro(error))}`);
}

export async function enturmar(form: FormData) {
  await exigirSessao(['secretaria', 'coordenacao']);
  const id = idSchema.parse(form.get('id'));
  const turma = form.get('turma_id') ? idSchema.parse(form.get('turma_id')) : null;
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('matriculas').update({ turma_id: turma }).eq('id', id);
  revalidatePath(`/matriculas/${id}`);
  redirect(`/matriculas/${id}?${error ? 'erro=' + encodeURIComponent(mensagemErro(error)) : 'ok=turma'}`);
}
