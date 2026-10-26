'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { exigirSessao } from '@/lib/sessao';
import { mensagemErro } from '@/lib/erros';
import { esquemaAluno, esquemaAtendimento, esquemaEndereco, esquemaResponsavel, esquemaSaude, primeiroErro, secao } from '@/lib/ficha';

export type EstadoSecao = { erro?: string; ok?: string };

const uuid = z.string().uuid();

function atualizar(alunoId: string) {
  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function salvarIdentificacao(_: EstadoSecao, form: FormData): Promise<EstadoSecao> {
  await exigirSessao(['secretaria']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const r = esquemaAluno.safeParse(secao(form, 'aluno'));
  if (!r.success) return { erro: primeiroErro(r) };
  const d = r.data;
  const supabase = await criarClienteSupabase();
  const { data: aluno } = await supabase.from('alunos').select('pessoa_id').eq('id', alunoId).single();
  if (!aluno) return { erro: 'Aluno não encontrado.' };

  const { error: e1 } = await supabase.from('pessoas').update({
    nome: d.nome, nome_social: d.nome_social, data_nascimento: d.data_nascimento, sexo: d.sexo, cpf: d.cpf, rg: d.rg,
    rg_orgao_expedidor: d.rg_orgao_expedidor, rg_data_emissao: d.rg_data_emissao, cin: d.cin,
  }).eq('id', aluno.pessoa_id);
  if (e1) return { erro: mensagemErro(e1) };
  const { error: e2 } = await supabase.from('alunos').update({
    naturalidade: d.naturalidade, nacionalidade: d.nacionalidade ?? 'Brasileira', cor_raca: d.cor_raca,
    tipo_sanguineo: d.tipo_sanguineo, fator_rh: d.fator_rh, numero_sus: d.numero_sus, nis: d.nis,
    transporte_escolar: d.transporte_escolar, bolsa_familia: d.bolsa_familia, ensino_religioso: d.ensino_religioso,
    dispensa_educacao_fisica: d.dispensa_educacao_fisica,
  }).eq('id', alunoId);
  if (e2) return { erro: mensagemErro(e2) };
  atualizar(alunoId);
  return { ok: 'Identificação salva.' };
}

export async function salvarEndereco(_: EstadoSecao, form: FormData): Promise<EstadoSecao> {
  await exigirSessao(['secretaria']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const r = esquemaEndereco.safeParse(secao(form, 'endereco'));
  if (!r.success) return { erro: primeiroErro(r) };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('enderecos').upsert({ aluno_id: alunoId, ...r.data });
  if (error) return { erro: mensagemErro(error) };
  atualizar(alunoId);
  return { ok: 'Endereço salvo.' };
}

export async function salvarSaude(_: EstadoSecao, form: FormData): Promise<EstadoSecao> {
  await exigirSessao(['secretaria']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const r = esquemaSaude.safeParse(secao(form, 'saude'));
  if (!r.success) return { erro: primeiroErro(r) };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('saude_alunos').upsert({ aluno_id: alunoId, ...r.data });
  if (error) return { erro: mensagemErro(error) };
  atualizar(alunoId);
  return { ok: 'Informações de saúde salvas.' };
}

export async function salvarAtendimento(_: EstadoSecao, form: FormData): Promise<EstadoSecao> {
  await exigirSessao(['secretaria', 'coordenacao']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const r = esquemaAtendimento.safeParse(secao(form, 'atendimento'));
  if (!r.success) return { erro: primeiroErro(r) };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from('atendimentos_especializados').upsert({ aluno_id: alunoId, ...r.data });
  if (error) return { erro: mensagemErro(error) };
  atualizar(alunoId);
  return { ok: 'Atendimento especializado salvo.' };
}

export async function adicionarResponsavel(_: EstadoSecao, form: FormData): Promise<EstadoSecao> {
  await exigirSessao(['secretaria']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const r = esquemaResponsavel.safeParse(secao(form, 'resp'));
  if (!r.success) return { erro: primeiroErro(r) };
  const d = r.data;
  const supabase = await criarClienteSupabase();

  let pessoaId: string | undefined;
  if (d.cpf) {
    const { data } = await supabase.from('pessoas').select('id').eq('cpf', d.cpf).maybeSingle();
    pessoaId = data?.id;
  }
  if (!pessoaId) {
    const { data, error } = await supabase.from('pessoas')
      .insert({ nome: d.nome, cpf: d.cpf, rg: d.rg, profissao: d.profissao, telefone: d.telefone, email: d.email })
      .select('id').single();
    if (error || !data) return { erro: mensagemErro(error) };
    pessoaId = data.id;
  }
  const { error } = await supabase.from('vinculos').insert({
    aluno_id: alunoId, pessoa_id: pessoaId, parentesco: d.parentesco, filiacao: d.filiacao,
    responsavel_legal: d.responsavel_legal, responsavel_financeiro: d.responsavel_financeiro,
    pode_buscar: d.pode_buscar, contato_emergencia: d.contato_emergencia,
  });
  if (error) {
    if (error.code === '23505') return { erro: 'Esta pessoa já está vinculada ou a filiação (pai/mãe) já foi preenchida.' };
    return { erro: mensagemErro(error) };
  }
  atualizar(alunoId);
  return { ok: `${d.nome} adicionado(a).` };
}

export async function removerVinculo(form: FormData) {
  await exigirSessao(['secretaria']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const id = uuid.parse(form.get('vinculo_id'));
  const supabase = await criarClienteSupabase();
  await supabase.from('vinculos').delete().eq('id', id).eq('aluno_id', alunoId);
  atualizar(alunoId);
}

/**
 * Cria o acesso da família: convida o e-mail cadastrado do responsável,
 * liga a conta à pessoa e dá o perfil "responsável" (a RLS limita aos filhos).
 */
export async function convidarFamilia(form: FormData) {
  await exigirSessao(['secretaria']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const pessoaId = uuid.parse(form.get('pessoa_id'));
  const supabase = await criarClienteSupabase();
  const { data: pessoa } = await supabase.from('pessoas').select('id, nome, email, user_id').eq('id', pessoaId).single();
  if (!pessoa?.email || pessoa.user_id) return;

  const admin = criarClienteAdmin();
  let userId: string | undefined;
  const convite = await admin.auth.admin.inviteUserByEmail(pessoa.email, {
    data: { nome: pessoa.nome },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirmar?proximo=/definir-senha`,
  });
  userId = convite.data.user?.id;
  if (!userId) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = data?.users.find((u) => u.email?.toLowerCase() === pessoa.email!.toLowerCase())?.id;
  }
  if (!userId) return;

  await supabase.from('pessoas').update({ user_id: userId }).eq('id', pessoa.id);
  await supabase.from('atribuicoes').insert({ user_id: userId, papel: 'responsavel' });
  atualizar(alunoId);
}
