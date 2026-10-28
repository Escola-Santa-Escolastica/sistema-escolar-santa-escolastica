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

export type EstadoForm = { erro?: string; campo?: string; duplicado?: { alunoId: string; nome: string } };

/** Nova matrícula: grava a ficha inteira numa transação (função criar_matricula no banco). */
export async function criarMatricula(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  await exigirSessao(['secretaria']);

  const aluno = esquemaAluno.safeParse(secao(form, 'aluno'));
  const matricula = esquemaMatricula.safeParse(secao(form, 'matricula'));
  const endereco = esquemaEndereco.safeParse(secao(form, 'endereco'));
  const saude = esquemaSaude.safeParse(secao(form, 'saude'));
  const atendimento = esquemaAtendimento.safeParse(secao(form, 'atendimento'));
  const formResps = responsaveis(form);
  const resps = formResps.map((r) => esquemaResponsavel.safeParse(r));

  const erro = primeiroErro(aluno, 'aluno') ?? primeiroErro(matricula, 'matricula')
    ?? resps.map((r, i) => primeiroErro(r, `resp.${formResps[i].__indice}`)).find(Boolean)
    ?? primeiroErro(endereco, 'endereco') ?? primeiroErro(saude, 'saude') ?? primeiroErro(atendimento, 'atendimento');
  if (erro) return erro;
  if (resps.length === 0) return { erro: 'Cadastre pelo menos um responsável.' };

  const listaResps = resps.map((r) => r.data!);
  if (!listaResps.some((r) => r.responsavel_legal)) return { erro: 'Marque quem é o responsável legal pela criança.' };
  if (listaResps.filter((r) => r.filiacao === 'mae').length > 1 || listaResps.filter((r) => r.filiacao === 'pai').length > 1) {
    return { erro: 'Só pode haver um pai e uma mãe na filiação.' };
  }

  const supabase = await criarClienteSupabase();

  // Evita cadastrar de novo uma criança que já está na base.
  const dadosAluno = aluno.data!;
  const existente = await procurarAluno(supabase, { cpf: dadosAluno.cpf, nome: dadosAluno.nome, nascimento: dadosAluno.data_nascimento });
  if (existente) return existente;

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
  if (error || !id) {
    console.error('[matricula] falha ao criar:', error?.code, error?.message);
    return { erro: mensagemErro(error) };
  }

  revalidatePath('/matriculas');
  redirect(`/matriculas/${id}?ok=criada`);
}

type Supa = Awaited<ReturnType<typeof criarClienteSupabase>>;

/** pessoas → alunos é um-para-um: o Supabase devolve objeto (ou lista, conforme a versão). */
function idDoAluno(alunos: unknown): string | undefined {
  const a = Array.isArray(alunos) ? alunos[0] : alunos;
  return (a as { id?: string } | null | undefined)?.id;
}

/** Procura criança já cadastrada pelo CPF ou pelo mesmo nome + data de nascimento. */
async function procurarAluno(supabase: Supa, { cpf, nome, nascimento }: { cpf: string | null; nome?: string; nascimento?: string }): Promise<EstadoForm | null> {
  if (cpf) {
    const { data } = await supabase.from('pessoas').select('nome, alunos(id)').eq('cpf', cpf).maybeSingle();
    if (data) {
      const alunoId = idDoAluno(data.alunos);
      return alunoId
        ? { erro: `Já existe uma criança cadastrada com este CPF: ${data.nome}. Abra a ficha dela em vez de cadastrar de novo.`, campo: 'aluno.cpf', duplicado: { alunoId, nome: data.nome } }
        : { erro: `Este CPF já está cadastrado para ${data.nome} (responsável). Confira o número.`, campo: 'aluno.cpf' };
    }
  }
  if (nome && nascimento) {
    const { data } = await supabase.from('pessoas').select('nome, alunos!inner(id)')
      .ilike('nome', nome.replace(/[%_\\]/g, '')).eq('data_nascimento', nascimento).limit(1);
    const achado = data?.[0];
    const alunoId = idDoAluno(achado?.alunos);
    if (achado && alunoId) {
      return { erro: `Já existe uma criança com o mesmo nome e data de nascimento: ${achado.nome}. Abra a ficha dela em vez de cadastrar de novo.`, campo: 'aluno.nome', duplicado: { alunoId, nome: achado.nome } };
    }
  }
  return null;
}

/** Conferência do CPF enquanto a secretaria preenche a ficha. */
export async function verificarCpfAluno(cpf: string): Promise<EstadoForm | null> {
  await exigirSessao(['secretaria']);
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return null;
  return procurarAluno(await criarClienteSupabase(), { cpf: d });
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
