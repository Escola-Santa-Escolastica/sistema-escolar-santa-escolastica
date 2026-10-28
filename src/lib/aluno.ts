import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StatusMatricula, Turno } from '@/lib/formatos';

export type Pessoa = {
  id: string; nome: string; nome_social: string | null; data_nascimento: string | null; sexo: 'masculino' | 'feminino' | null;
  cpf: string | null; rg: string | null; rg_orgao_expedidor: string | null; rg_data_emissao: string | null; cin: string | null;
  profissao: string | null; email: string | null; telefone: string | null; user_id: string | null;
};

export type FichaAluno = {
  aluno: {
    id: string; naturalidade: string | null; nacionalidade: string; cor_raca: string | null; tipo_sanguineo: string | null;
    fator_rh: string | null; numero_sus: string | null; nis: string | null; transporte_escolar: boolean; bolsa_familia: boolean;
    ensino_religioso: boolean; dispensa_educacao_fisica: string | null; pessoa: Pessoa;
  };
  endereco: Record<string, string | null> | null;
  saude: Record<string, string | null> | null;
  atendimento: {
    possui_laudo: boolean; laudo_descricao: string | null; acompanha_atendimento: boolean;
    atendimento_descricao: string | null; observacoes_pedagogicas: string | null;
  } | null;
  vinculos: {
    id: string; parentesco: string; filiacao: 'pai' | 'mae' | null; responsavel_legal: boolean; responsavel_financeiro: boolean;
    pode_buscar: boolean; contato_emergencia: boolean; pessoa: Pessoa;
  }[];
  /** Outras crianças de cada responsável (irmãos), pelo id da pessoa. A RLS limita o que cada perfil vê. */
  outrasCriancas: Record<string, { id: string; nome: string }[]>;
  matriculas: {
    id: string; numero: string; status: StatusMatricula; turno_pretendido: Turno; data_matricula: string | null;
    ano_letivo: { ano: number; ativo: boolean }; etapa: { nome: string }; turma: { nome: string } | null;
  }[];
};

const CAMPOS_PESSOA = 'id, nome, nome_social, data_nascimento, sexo, cpf, rg, rg_orgao_expedidor, rg_data_emissao, cin, profissao, email, telefone, user_id';

/**
 * Carrega a ficha com o cliente da sessão: cada parte respeita a RLS
 * (ex.: auxiliar recebe endereço e laudo vazios).
 */
export async function carregarFicha(supabase: SupabaseClient, alunoId: string): Promise<FichaAluno | null> {
  const { data: aluno } = await supabase
    .from('alunos')
    .select(`id, naturalidade, nacionalidade, cor_raca, tipo_sanguineo, fator_rh, numero_sus, nis, transporte_escolar,
      bolsa_familia, ensino_religioso, dispensa_educacao_fisica, pessoa:pessoas!inner(${CAMPOS_PESSOA})`)
    .eq('id', alunoId)
    .maybeSingle();
  if (!aluno) return null;

  const [endereco, saude, atendimento, vinculos, matriculas] = await Promise.all([
    supabase.from('enderecos').select('*').eq('aluno_id', alunoId).maybeSingle(),
    supabase.from('saude_alunos').select('*').eq('aluno_id', alunoId).maybeSingle(),
    supabase.from('atendimentos_especializados').select('*').eq('aluno_id', alunoId).maybeSingle(),
    supabase.from('vinculos')
      .select(`id, parentesco, filiacao, responsavel_legal, responsavel_financeiro, pode_buscar, contato_emergencia, pessoa:pessoas(${CAMPOS_PESSOA})`)
      .eq('aluno_id', alunoId)
      .order('created_at'),
    supabase.from('matriculas')
      .select('id, numero, status, turno_pretendido, data_matricula, ano_letivo:anos_letivos(ano, ativo), etapa:etapas(nome), turma:turmas(nome)')
      .eq('aluno_id', alunoId)
      .order('created_at', { ascending: false }),
  ]);

  const listaVinculos = (vinculos.data ?? []) as unknown as FichaAluno['vinculos'];
  const outrasCriancas: FichaAluno['outrasCriancas'] = {};
  const idsPessoas = listaVinculos.map((v) => v.pessoa?.id).filter(Boolean);
  if (idsPessoas.length) {
    const { data: outros } = await supabase.from('vinculos')
      .select('pessoa_id, aluno:alunos(id, pessoa:pessoas(nome))')
      .in('pessoa_id', idsPessoas)
      .neq('aluno_id', alunoId);
    for (const o of (outros ?? []) as unknown as { pessoa_id: string; aluno: { id: string; pessoa: { nome: string } | null } | null }[]) {
      if (!o.aluno?.pessoa) continue;
      (outrasCriancas[o.pessoa_id] ??= []).push({ id: o.aluno.id, nome: o.aluno.pessoa.nome });
    }
  }

  return {
    aluno: aluno as unknown as FichaAluno['aluno'],
    endereco: endereco.data,
    saude: saude.data,
    atendimento: atendimento.data,
    vinculos: listaVinculos,
    outrasCriancas,
    matriculas: (matriculas.data ?? []) as unknown as FichaAluno['matriculas'],
  };
}
