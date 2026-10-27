// =====================================================================
// Povoa um AMBIENTE DE TESTE com logins por perfil e crianças fictícias.
//
// Uso (na pasta do projeto):
//   node scripts/popular-teste.mjs
//
// Pede o endereço e as duas chaves do projeto Supabase (Project Settings ›
// API Keys) e uma senha para os logins de teste. Pode rodar de novo sem
// duplicar nada. NUNCA rode no projeto oficial da escola: só cria dados
// inventados e logins com senha compartilhada.
//
// As matrículas passam pelo fluxo real do sistema (secretaria cria e
// confere documentos, direção aprova, secretaria enturma), com os logins
// de teste — então o script também testa as regras do banco.
// =====================================================================
import { createInterface } from 'node:readline/promises';
import { randomInt } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DOMINIO = 'teste.santaescolastica.example';

const LOGINS = [
  { chave: 'direcao', email: `direcao@${DOMINIO}`, nome: 'Marta Duarte (teste)', papeis: ['direcao'] },
  { chave: 'coordenacao', email: `coordenacao@${DOMINIO}`, nome: 'Carla Mendes (teste)', papeis: ['coordenacao'] },
  { chave: 'secretaria', email: `secretaria@${DOMINIO}`, nome: 'Renata Alves (teste)', papeis: ['secretaria'] },
  { chave: 'professora', email: `professora@${DOMINIO}`, nome: 'Ana Beatriz Moura (teste)', papeis: ['professor_regente'], turma: 'Pré II · Manhã' },
  { chave: 'auxiliar', email: `auxiliar@${DOMINIO}`, nome: 'Joana Lima (teste)', papeis: ['auxiliar'], turma: 'Pré II · Manhã' },
  { chave: 'mae', email: `mae@${DOMINIO}`, nome: 'Juliana Souza (teste)', papeis: ['responsavel'] },
];

const TURMAS = [
  { etapa: 'Pré I', turno: 'manha', nome: 'Pré I · Manhã' },
  { etapa: 'Pré I', turno: 'tarde', nome: 'Pré I · Tarde' },
  { etapa: 'Pré II', turno: 'manha', nome: 'Pré II · Manhã' },
  { etapa: 'Pré II', turno: 'tarde', nome: 'Pré II · Tarde' },
];

// Crianças e famílias inventadas. "fim" = até onde a matrícula anda no fluxo.
const MAE_JULIANA = {
  nome: 'Juliana Souza (teste)', parentesco: 'Mãe', filiacao: 'mae', telefone: '37900000001', email: `mae@${DOMINIO}`,
  profissao: 'Enfermeira', responsavel_legal: true, responsavel_financeiro: true, pode_buscar: true, contato_emergencia: true,
};
const CRIANCAS = [
  {
    nome: 'Maria Clara Souza', nasc: '2022-03-14', sexo: 'feminino', etapa: 'Pré II', turno: 'manha', fim: 'enturmado',
    resps: [MAE_JULIANA,
      { nome: 'Ricardo Souza (teste)', parentesco: 'Pai', filiacao: 'pai', telefone: '37900000002', pode_buscar: true, responsavel_legal: true },
      { nome: 'Helena Souza (teste)', parentesco: 'Avó', telefone: '37900000003', pode_buscar: true, contato_emergencia: true }],
    saude: { alergias: 'Amendoim e derivados', restricao_alimentar: 'Amendoim', emergencia_nome: 'Juliana Souza (mãe)', emergencia_telefone: '37900000001' },
    atendimento: { possui_laudo: true, laudo_descricao: 'TEA (laudo de exemplo)', acompanha_atendimento: true, atendimento_descricao: 'Fonoaudiologia, 1x por semana' },
  },
  {
    nome: 'Lucas Andrade Souza', nasc: '2022-06-02', sexo: 'masculino', etapa: 'Pré II', turno: 'manha', fim: 'enturmado',
    resps: [MAE_JULIANA], saude: {}, atendimento: {},
  },
  {
    nome: 'Helena Martins', nasc: '2022-01-25', sexo: 'feminino', etapa: 'Pré II', turno: 'manha', fim: 'enturmado',
    resps: [{ nome: 'Paula Martins (teste)', parentesco: 'Mãe', filiacao: 'mae', telefone: '37900000004', responsavel_legal: true, responsavel_financeiro: true, pode_buscar: true }],
    saude: { restricao_alimentar: 'Intolerância à lactose' }, atendimento: {},
  },
  {
    nome: 'Isabela Prado', nasc: '2022-08-30', sexo: 'feminino', etapa: 'Pré II', turno: 'manha', fim: 'enturmado',
    resps: [{ nome: 'Fernanda Prado (teste)', parentesco: 'Mãe', filiacao: 'mae', telefone: '37900000005', responsavel_legal: true, pode_buscar: true },
      { nome: 'Rafael Prado (teste)', parentesco: 'Pai', filiacao: 'pai', telefone: '37900000006', responsavel_financeiro: true, pode_buscar: true }],
    saude: {}, atendimento: {},
  },
  {
    nome: 'Pedro Henrique Lima', nasc: '2023-01-20', sexo: 'masculino', etapa: 'Pré I', turno: 'manha', fim: 'enturmado',
    resps: [{ nome: 'Carlos Lima (teste)', parentesco: 'Pai', filiacao: 'pai', telefone: '37900000007', responsavel_legal: true, responsavel_financeiro: true, pode_buscar: true }],
    saude: { medicamento_continuo: 'Anticonvulsivante (exemplo), 12h' }, atendimento: {},
  },
  {
    nome: 'Sofia Ribeiro', nasc: '2023-04-11', sexo: 'feminino', etapa: 'Pré I', turno: 'tarde', fim: 'aguardando_aprovacao',
    resps: [{ nome: 'Patrícia Ribeiro (teste)', parentesco: 'Mãe', filiacao: 'mae', telefone: '37900000008', responsavel_legal: true, pode_buscar: true }],
    saude: {}, atendimento: {},
  },
  {
    nome: 'Bento Ferreira', nasc: '2022-11-05', sexo: 'masculino', etapa: 'Pré II', turno: 'tarde', fim: 'pendente_documento',
    resps: [{ nome: 'Luciana Ferreira (teste)', parentesco: 'Mãe', filiacao: 'mae', telefone: '37900000009', responsavel_legal: true, pode_buscar: true }],
    saude: {}, atendimento: {}, faltando: 'Cartão de vacina',
  },
  {
    nome: 'Davi Assis', nasc: '2023-02-17', sexo: 'masculino', etapa: 'Pré I', turno: 'manha', fim: 'em_analise',
    resps: [{ nome: 'Marcos Assis (teste)', parentesco: 'Pai', filiacao: 'pai', telefone: '37900000010', responsavel_legal: true, pode_buscar: true }],
    saude: { alergias: 'Dipirona' }, atendimento: {},
  },
  {
    nome: 'Théo Carvalho', nasc: '2023-07-09', sexo: 'masculino', etapa: 'Pré I', turno: 'tarde', fim: 'em_analise',
    resps: [{ nome: 'Beatriz Carvalho (teste)', parentesco: 'Mãe', filiacao: 'mae', telefone: '37900000011', responsavel_legal: true, pode_buscar: true }],
    saude: {}, atendimento: {},
  },
];

// ---------- utilitários ----------
const rl = createInterface({ input: process.stdin, output: process.stdout });
async function perguntar(texto, padrao) {
  const r = (await rl.question(padrao ? `${texto} [${padrao}]: ` : `${texto}: `)).trim();
  return r || padrao || '';
}
function falhar(msg, erro) {
  console.error(`\nERRO: ${msg}${erro ? ` (${erro.message ?? erro})` : ''}`);
  process.exit(1);
}
function ok(r, msg) {
  if (r.error) falhar(msg, r.error);
  return r.data;
}
function senhaAleatoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return 'Teste-' + Array.from({ length: 8 }, () => letras[randomInt(letras.length)]).join('');
}
function lerEnvLocal() {
  if (!existsSync('.env.local')) return {};
  const env = {};
  for (const l of readFileSync('.env.local', 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// ---------- configuração ----------
const local = lerEnvLocal();
const naoInterativo = process.argv.includes('--sim');
const url = process.env.SUPABASE_URL || (naoInterativo ? local.NEXT_PUBLIC_SUPABASE_URL : await perguntar('Endereço do projeto (Project URL)', local.NEXT_PUBLIC_SUPABASE_URL));
const publica = process.env.SUPABASE_PUBLISHABLE_KEY || (naoInterativo ? local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : await perguntar('Chave pública (Publishable key)', local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
const secreta = process.env.SUPABASE_SECRET_KEY || (naoInterativo ? local.SUPABASE_SECRET_KEY : await perguntar('Chave secreta (Secret key)', local.SUPABASE_SECRET_KEY ? '(a do .env.local)' : ''));
const chaveSecreta = secreta === '(a do .env.local)' ? local.SUPABASE_SECRET_KEY : secreta;
if (!url || !publica || !chaveSecreta) falhar('Faltou o endereço ou alguma das chaves.');
const senha = process.env.SENHA_TESTE || (naoInterativo ? senhaAleatoria() : await perguntar('Senha para os logins de teste (Enter = gerar uma)', '')) || senhaAleatoria();
if (senha.length < 8) falhar('A senha precisa ter pelo menos 8 caracteres.');
const adminEmail = process.env.ADMIN_EMAIL || (naoInterativo ? '' : await perguntar('Seu e-mail para o login de administrador (Enter = pular)', ''));
const adminNome = adminEmail ? (process.env.ADMIN_NOME || (naoInterativo ? 'Administrador' : await perguntar('Seu nome completo', 'Administrador'))) : '';
if (!naoInterativo) {
  const conf = await perguntar(`\nVai criar logins de teste e crianças FICTÍCIAS em ${url}. Este é um ambiente de TESTE? (s/n)`, 'n');
  if (!/^s/i.test(conf)) falhar('Cancelado.');
}
rl.close();

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, chaveSecreta, opcoes);

async function entrarComo(email, senhaLogin = senha) {
  const c = createClient(url, publica, opcoes);
  ok(await c.auth.signInWithPassword({ email, password: senhaLogin }), `Não consegui entrar como ${email}. Confira se o login por e-mail está ligado no Supabase`);
  return c;
}

// ---------- 1. Ano letivo e turmas ----------
console.log('\n1/4 Turmas do ano letivo ativo');
const ano = ok(await admin.from('anos_letivos').select('id, ano').eq('ativo', true).maybeSingle(), 'Não achei o ano letivo (as migrations foram aplicadas?)');
if (!ano) falhar('Nenhum ano letivo ativo. Aplique as migrations do sistema antes (npx supabase db push).');
const etapas = ok(await admin.from('etapas').select('id, nome'), 'Erro ao ler etapas');
const idEtapa = (nome) => etapas.find((e) => e.nome === nome)?.id;
const existentes = ok(await admin.from('turmas').select('id, nome').eq('ano_letivo_id', ano.id), 'Erro ao ler turmas');
for (const t of TURMAS) {
  if (existentes.some((e) => e.nome === t.nome)) continue;
  ok(await admin.from('turmas').insert({ ano_letivo_id: ano.id, etapa_id: idEtapa(t.etapa), nome: t.nome, turno: t.turno, capacidade: 20 }), `Erro ao criar a turma ${t.nome}`);
}
const turmas = ok(await admin.from('turmas').select('id, nome').eq('ano_letivo_id', ano.id), 'Erro ao ler turmas');
const idTurma = (nome) => turmas.find((t) => t.nome === nome)?.id;
console.log(`   ${turmas.length} turmas em ${ano.ano}`);

// ---------- 2. Logins ----------
console.log('2/4 Logins de teste');
const usuarios = ok(await admin.auth.admin.listUsers({ perPage: 1000 }), 'Não consegui listar usuários (confira a chave secreta)').users;
async function garantirLogin({ email, nome, papeis, turma }, senhaLogin) {
  let u = usuarios.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (u) {
    if (senhaLogin) ok(await admin.auth.admin.updateUserById(u.id, { password: senhaLogin }), `Erro ao atualizar a senha de ${email}`);
  } else {
    u = ok(await admin.auth.admin.createUser({ email, password: senhaLogin, email_confirm: true, user_metadata: { nome } }), `Erro ao criar ${email}`).user;
    usuarios.push(u);
  }
  const pessoa = ok(await admin.from('pessoas').select('id').eq('user_id', u.id).maybeSingle(), 'Erro ao ler pessoas');
  if (!pessoa) ok(await admin.from('pessoas').insert({ nome, email, user_id: u.id }), `Erro ao salvar ${nome}`);
  const atuais = ok(await admin.from('atribuicoes').select('papel, turma_id').eq('user_id', u.id), 'Erro ao ler perfis');
  for (const papel of papeis) {
    const turmaId = turma ? idTurma(turma) : null;
    if (atuais.some((a) => a.papel === papel && (a.turma_id ?? null) === turmaId)) continue;
    ok(await admin.from('atribuicoes').insert({ user_id: u.id, papel, turma_id: turmaId }), `Erro ao dar o perfil ${papel} a ${email}`);
  }
  return u;
}
const ids = {};
for (const l of LOGINS) ids[l.chave] = (await garantirLogin(l, senha)).id;
let senhaAdmin = null;
if (adminEmail) {
  const existe = usuarios.some((x) => x.email?.toLowerCase() === adminEmail.toLowerCase());
  senhaAdmin = existe ? null : senhaAleatoria();
  await garantirLogin({ email: adminEmail, nome: adminNome, papeis: ['admin', 'direcao', 'coordenacao', 'secretaria'] }, senhaAdmin);
}
console.log(`   ${LOGINS.length} logins de teste${adminEmail ? ' + o seu de administrador' : ''}`);

// ---------- 3. Matrículas pelo fluxo real ----------
console.log('3/4 Crianças fictícias e matrículas (pelo fluxo do sistema)');
const secretaria = await entrarComo(LOGINS.find((l) => l.chave === 'secretaria').email);
const direcao = await entrarComo(LOGINS.find((l) => l.chave === 'direcao').email);
const ja = ok(await admin.from('vw_matriculas').select('aluno_nome').eq('ano_letivo_id', ano.id), 'Erro ao ler matrículas').map((m) => m.aluno_nome);
const tipos = ok(await admin.from('tipos_documento').select('id, nome, obrigatorio'), 'Erro ao ler tipos de documento');
const vazio = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ?? null]));

let criadas = 0;
for (const c of CRIANCAS) {
  if (ja.includes(c.nome)) continue;
  const id = ok(await secretaria.rpc('criar_matricula', { p: {
    aluno: { nome: c.nome, data_nascimento: c.nasc, sexo: c.sexo, naturalidade: 'Itapecerica/MG', nacionalidade: 'Brasileira', ensino_religioso: true },
    responsaveis: c.resps.map((r) => vazio({ responsavel_legal: false, responsavel_financeiro: false, pode_buscar: false, contato_emergencia: false, ...r })),
    endereco: { logradouro: 'Rua de Exemplo', numero: String(10 + criadas), bairro: 'Centro', cidade: 'Itapecerica', uf: 'MG', cep: '35550000' },
    saude: c.saude,
    atendimento: { possui_laudo: false, acompanha_atendimento: false, ...c.atendimento },
    matricula: { etapa_id: idEtapa(c.etapa), turno_pretendido: c.turno },
  } }), `Erro ao matricular ${c.nome}`);

  // Documentos: todos entregues, menos o que estiver faltando
  for (const t of tipos.filter((t) => t.obrigatorio && t.nome !== c.faltando)) {
    ok(await secretaria.from('documentos_entregues').update({ status: 'entregue', conferido_em: new Date().toISOString() })
      .eq('matricula_id', id).eq('tipo_id', t.id), `Erro ao marcar documento de ${c.nome}`);
  }
  const passo = async (cliente, para, obs) => ok(await cliente.rpc('mudar_status_matricula', { p_matricula: id, p_para: para, p_observacao: obs ?? null }), `Erro ao mover ${c.nome} para ${para}`);
  if (c.fim === 'pendente_documento') await passo(secretaria, 'pendente_documento');
  if (['aguardando_aprovacao', 'matriculado', 'enturmado'].includes(c.fim)) await passo(secretaria, 'aguardando_aprovacao');
  if (['matriculado', 'enturmado'].includes(c.fim)) await passo(direcao, 'matriculado');
  if (c.fim === 'enturmado') {
    const turma = `${c.etapa} · ${c.turno === 'manha' ? 'Manhã' : c.turno === 'tarde' ? 'Tarde' : 'Integral'}`;
    ok(await secretaria.from('matriculas').update({ turma_id: idTurma(turma) }).eq('id', id), `Erro ao enturmar ${c.nome}`);
  }
  criadas++;
}
console.log(`   ${criadas} matrícula(s) criada(s)${criadas === 0 ? ' (já existiam)' : ''}`);

// ---------- 4. Liga a mãe de teste às crianças dela ----------
console.log('4/4 Acesso da família de teste');
const pessoaMae = ok(await admin.from('pessoas').select('id').eq('user_id', ids.mae).single(), 'Erro ao achar a mãe de teste');
const vinculosJuliana = ok(await admin.from('pessoas').select('id').eq('email', `mae@${DOMINIO}`).is('user_id', null), 'Erro ao achar os vínculos da mãe');
// a ficha criou a "Juliana" como responsável; a pessoa com login herda os dados e os vínculos dela
ok(await admin.from('pessoas').update({ telefone: MAE_JULIANA.telefone, profissao: MAE_JULIANA.profissao }).eq('id', pessoaMae.id), 'Erro ao completar os dados da mãe');
for (const p of vinculosJuliana) {
  ok(await admin.from('vinculos').update({ pessoa_id: pessoaMae.id }).eq('pessoa_id', p.id), 'Erro ao ligar a mãe às crianças');
}
const filhos = ok(await admin.from('vinculos').select('id').eq('pessoa_id', pessoaMae.id), 'Erro ao conferir os vínculos');
console.log(`   mãe de teste ligada a ${filhos.length} criança(s)`);

// ---------- resumo ----------
console.log('\n=====================================================');
console.log(' Ambiente de teste pronto');
console.log('=====================================================');
console.log(` Senha de todos os logins de teste: ${senha}\n`);
for (const l of LOGINS) console.log(` ${l.email.padEnd(42)} ${l.nome.replace(' (teste)', '')} — ${l.papeis.map((p) => ({ direcao: 'Direção', coordenacao: 'Coordenação', secretaria: 'Secretaria', professor_regente: 'Professora do Pré II · Manhã', auxiliar: 'Auxiliar do Pré II · Manhã', responsavel: 'Mãe da Maria Clara e do Lucas' }[p])).join(', ')}`);
if (adminEmail) console.log(`\n Seu login: ${adminEmail}  ${senhaAdmin ? `(senha: ${senhaAdmin})` : '(senha: a mesma de antes)'}`);
console.log('');
