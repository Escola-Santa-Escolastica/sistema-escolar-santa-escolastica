'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { exigirSessao } from '@/lib/sessao';
import { mensagemErro } from '@/lib/erros';
import { esquemaAluno, esquemaAtendimento, esquemaEndereco, esquemaResponsavel, esquemaSaude, primeiroErro, secao } from '@/lib/ficha';

export type EstadoSecao = { erro?: string; ok?: string; campo?: string };

const uuid = z.string().uuid();

function atualizar(alunoId: string) {
  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function salvarIdentificacao(_: EstadoSecao, form: FormData): Promise<EstadoSecao> {
  await exigirSessao(['secretaria']);
  const alunoId = uuid.parse(form.get('aluno_id'));
  const r = esquemaAluno.safeParse(secao(form, 'aluno'));
  if (!r.success) return primeiroErro(r, 'aluno')!;
  const d = r.data;
  const supabase = await criarClienteSupabase();
  const { data: aluno } = await supabase.from('alunos').select('pessoa_id').eq('id', alunoId).single();
  if (!aluno) return { erro: 'Aluno não encontrado.' };
  if (d.cpf) {
    const { data: outra } = await supabase.from('pessoas').select('nome').eq('cpf', d.cpf).neq('id', aluno.pessoa_id).maybeSingle();
    if (outra) return { erro: `Este CPF já está cadastrado para ${outra.nome}. Confira o número.`, campo: 'aluno.cpf' };
  }

  const { error: e1 } = await supabase.from('pessoas').update({
    nome: d.nome, data_nascimento: d.data_nascimento, sexo: d.sexo, cpf: d.cpf, rg: d.rg,
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
  if (!r.success) return primeiroErro(r, 'endereco')!;
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
  if (!r.success) return primeiroErro(r, 'saude')!;
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
  if (!r.success) return primeiroErro(r, 'atendimento')!;
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
  if (!r.success) return primeiroErro(r, 'resp')!;
  const d = r.data;
  const supabase = await criarClienteSupabase();

  let pessoaId: string | undefined = d.pessoa_id ?? undefined;
  if (!pessoaId && d.cpf) {
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

export type ResponsavelEncontrado = {
  id: string; nome: string; cpf: string | null; telefone: string | null; email: string | null; profissao: string | null;
  criancas: string[];
};

/**
 * Busca responsável já cadastrado (pai/mãe de outra criança) pelo CPF ou
 * pelo nome, para ligar a mesma pessoa a mais de um filho.
 */
export async function buscarResponsaveis(termo: string): Promise<ResponsavelEncontrado[]> {
  await exigirSessao(['secretaria']);
  const t = termo.trim();
  const digitos = t.replace(/\D/g, '');
  const porCpf = digitos.length === 11;
  if (!porCpf && t.replace(/\s/g, '').length < 3) return [];
  const supabase = await criarClienteSupabase();
  let q = supabase.from('pessoas')
    .select('id, nome, cpf, telefone, email, profissao, vinculos!inner(aluno:alunos(pessoa:pessoas(nome)))')
    .order('nome').limit(5);
  q = porCpf ? q.eq('cpf', digitos) : q.ilike('nome', `%${t.replace(/[%_\\,()]/g, '')}%`);
  const { data } = await q;
  type Linha = Omit<ResponsavelEncontrado, 'criancas'> & { vinculos: { aluno: { pessoa: { nome: string } | null } | null }[] };
  return ((data ?? []) as unknown as Linha[]).map(({ vinculos, ...p }) => ({
    ...p,
    criancas: [...new Set(vinculos.map((v) => v.aluno?.pessoa?.nome).filter((n): n is string => Boolean(n)))],
  }));
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
