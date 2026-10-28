/**
 * Validação da Ficha Individual do Aluno (usada na matrícula e na edição).
 * Converte o FormData em objetos prontos para o banco: strings vazias → null,
 * CPF/CEP/telefone só com dígitos.
 */
import { z } from 'zod';
import { cpfValido, normalizarRg, soDigitos } from '@/lib/formatos';

const texto = z.string().trim().transform((v) => (v === '' ? null : v)).nullable().optional();
const obrigatorio = (msg: string) => z.string({ error: msg }).trim().min(1, msg);
const cpf = z.string().optional().nullable().transform((v) => soDigitos(v) || null)
  .refine((v) => v === null || cpfValido(v), 'CPF inválido: confira os 11 números.');
const data = z.string().optional().nullable().transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data inválida.');
const telefone = z.string().optional().nullable().transform((v) => soDigitos(v) || null)
  .refine((v) => v === null || v.length === 10 || v.length === 11, 'Telefone com DDD: 10 ou 11 números.');
const email = z.string().trim().optional().nullable().transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, 'E-mail inválido.');
// Caixa de seleção desmarcada não vai no formulário: ausente = não.
const sim = z.union([z.string(), z.boolean()]).optional().transform((v) => v === 'on' || v === 'true' || v === true);
const rg = z.string().optional().nullable().transform((v) => normalizarRg(v) || null)
  .refine((v) => v === null || v.replace('X', '').length >= 5, 'RG incompleto: confira os números.');

export const esquemaAluno = z.object({
  nome: obrigatorio('Informe o nome completo do aluno.').min(3, 'Informe o nome completo do aluno.'),
  data_nascimento: z.string({ error: 'Informe a data de nascimento.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento.'),
  sexo: z.enum(['masculino', 'feminino']).optional().nullable().or(z.literal('').transform(() => null)),
  cpf,
  rg,
  rg_orgao_expedidor: texto,
  rg_data_emissao: data,
  cin: texto,
  naturalidade: texto,
  nacionalidade: texto,
  cor_raca: z.enum(['branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_declarada']).optional().nullable()
    .or(z.literal('').transform(() => null)),
  tipo_sanguineo: z.enum(['A', 'B', 'AB', 'O']).optional().nullable().or(z.literal('').transform(() => null)),
  fator_rh: z.enum(['+', '-']).optional().nullable().or(z.literal('').transform(() => null)),
  numero_sus: texto,
  nis: texto,
  transporte_escolar: sim,
  bolsa_familia: sim,
  ensino_religioso: sim,
  dispensa_educacao_fisica: texto,
});

export const esquemaResponsavel = z.object({
  nome: obrigatorio('Informe o nome de cada responsável.').min(3, 'Informe o nome completo de cada responsável.'),
  parentesco: obrigatorio('Informe o parentesco de cada responsável.'),
  filiacao: z.enum(['pai', 'mae']).optional().nullable().or(z.literal('').transform(() => null)),
  cpf,
  rg,
  profissao: texto,
  telefone,
  email,
  responsavel_legal: sim,
  responsavel_financeiro: sim,
  pode_buscar: sim,
  contato_emergencia: sim,
});

export const esquemaEndereco = z.object({
  logradouro: texto,
  numero: texto,
  complemento: texto,
  bairro: texto,
  cidade: texto,
  uf: z.string().trim().toUpperCase().optional().nullable().transform((v) => v || null)
    .refine((v) => v === null || /^[A-Z]{2}$/.test(v), 'UF com 2 letras.'),
  cep: z.string().optional().nullable().transform((v) => soDigitos(v) || null)
    .refine((v) => v === null || v.length === 8, 'CEP com 8 números.'),
  telefone_residencial: telefone,
  telefone_celular: telefone,
});

export const esquemaSaude = z.object({
  problema_saude: texto,
  alergias: texto,
  medicamento_continuo: texto,
  restricao_alimentar: texto,
  convenio: texto,
  convenio_carteirinha: texto,
  observacoes: texto,
  emergencia_nome: texto,
  emergencia_telefone: telefone,
});

export const esquemaAtendimento = z.object({
  possui_laudo: sim,
  laudo_descricao: texto,
  acompanha_atendimento: sim,
  atendimento_descricao: texto,
  observacoes_pedagogicas: texto,
});

export const esquemaMatricula = z.object({
  etapa_id: z.string({ error: 'Escolha a etapa pretendida (Pré I ou Pré II).' }).uuid('Escolha a etapa pretendida (Pré I ou Pré II).'),
  turno_pretendido: z.enum(['manha', 'tarde', 'integral'], { message: 'Escolha o turno.' }),
  instituicao_origem: texto,
  ultimo_ano_cursado: texto,
  observacoes: texto,
});

/** Pega os campos com prefixo ("aluno.nome" → { nome }). */
export function secao(form: FormData, prefixo: string) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [chave, valor] of form.entries()) {
    if (chave.startsWith(prefixo + '.')) obj[chave.slice(prefixo.length + 1)] = valor;
  }
  return obj;
}

/** Responsáveis vêm como resp.0.nome, resp.1.nome… */
export function responsaveis(form: FormData) {
  const mapa = new Map<string, Record<string, FormDataEntryValue>>();
  for (const [chave, valor] of form.entries()) {
    const m = /^resp\.(\d+)\.(.+)$/.exec(chave);
    if (!m) continue;
    if (!mapa.has(m[1])) mapa.set(m[1], {});
    mapa.get(m[1])![m[2]] = valor;
  }
  // __indice = número do bloco no formulário (para apontar o campo com erro); o zod descarta.
  return [...mapa.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([i, v]) => ({ ...v, __indice: i }));
}

/** Nome de cada campo como aparece na tela (para as mensagens de erro). */
const ROTULOS: Record<string, string> = {
  nome: 'Nome completo', data_nascimento: 'Data de nascimento', sexo: 'Sexo', cpf: 'CPF', rg: 'RG',
  rg_orgao_expedidor: 'Órgão expedidor', rg_data_emissao: 'Data de emissão do RG', cin: 'CIN', naturalidade: 'Naturalidade',
  nacionalidade: 'Nacionalidade', cor_raca: 'Cor/Raça', tipo_sanguineo: 'Tipo sanguíneo', fator_rh: 'Fator RH',
  numero_sus: 'Nº do SUS', nis: 'NIS', parentesco: 'Parentesco', filiacao: 'Aparece na filiação como', telefone: 'Telefone',
  email: 'E-mail', profissao: 'Profissão', logradouro: 'Endereço', numero: 'Nº', bairro: 'Bairro', cidade: 'Cidade', uf: 'UF',
  cep: 'CEP', telefone_residencial: 'Telefone residencial', telefone_celular: 'Telefone celular',
  emergencia_telefone: 'Telefone de emergência', etapa_id: 'Etapa pretendida', turno_pretendido: 'Turno',
  turno: 'Turno', capacidade: 'Capacidade', ano: 'Ano', inicio: 'Início das aulas', fim: 'Fim das aulas',
  papel: 'Perfil', turma_id: 'Turma', componente_id: 'Componente', senha: 'Senha', confirmacao: 'Confirmar senha',
};

/**
 * Mensagens padrão do zod (em inglês, técnicas) nunca chegam à tela:
 * viram "Confira o campo X." com o nome que a pessoa vê.
 */
function mensagemCampo(issue: z.core.$ZodIssue) {
  const chave = String(issue.path[issue.path.length - 1] ?? '');
  const rotulo = ROTULOS[chave];
  const padraoDoZod = /^(Invalid|Too (big|small)|Expected|Unrecognized)/i.test(issue.message);
  if (!padraoDoZod) return issue.message;
  if (issue.code === 'invalid_type' && issue.input === undefined) {
    return rotulo ? `Preencha o campo "${rotulo}".` : 'Preencha os campos obrigatórios (marcados com *).';
  }
  return rotulo ? `Confira o campo "${rotulo}".` : 'Algum campo está preenchido de forma inválida. Confira os dados.';
}

export type ErroValidacao = { erro: string; campo?: string };

/** Primeiro erro de uma validação, já em português; `prefixo` monta o nome do campo no formulário (ex.: "aluno"). */
export function primeiroErro(r: z.ZodSafeParseResult<unknown>, prefixo?: string): ErroValidacao | undefined {
  if (r.success) return undefined;
  const issue = r.error.issues[0];
  if (!issue) return { erro: 'Confira os dados do formulário.' };
  const caminho = issue.path.map(String).join('.');
  return { erro: mensagemCampo(issue), campo: prefixo && caminho ? `${prefixo}.${caminho}` : caminho || undefined };
}

/** Só a mensagem (para formulários simples). */
export function mensagemValidacao(r: z.ZodSafeParseResult<unknown>) {
  return primeiroErro(r)?.erro;
}
