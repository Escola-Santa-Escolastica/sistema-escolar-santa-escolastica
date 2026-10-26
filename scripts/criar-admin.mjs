// Cria (ou atualiza) o login de administrador no Supabase LOCAL.
// Uso: node scripts/criar-admin.mjs email@exemplo.com "Nome Completo" [--nova-senha]
//
// Dá os perfis Administrador, Direção, Coordenação e Secretaria, para você
// testar todas as telas. Lê as chaves do arquivo .env.local.
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function lerEnv() {
  const env = {};
  for (const linha of readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function senhaProvisoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += letras[randomInt(letras.length)];
  return `Escola-${s}`;
}

const [email, nome = 'Administrador', flag] = process.argv.slice(2);
if (!email) {
  console.error('Uso: node scripts/criar-admin.mjs email@exemplo.com "Nome Completo"');
  process.exit(1);
}
const env = lerEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.SUPABASE_SECRET_KEY;
if (!url || !chave) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env.local.');
  process.exit(1);
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) {
  console.error(`Este script é só para o Supabase local (encontrado: ${url}).`);
  process.exit(1);
}

const sb = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. Conta
const { data: lista, error: erroLista } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (erroLista) { console.error('Não consegui falar com o Supabase local:', erroLista.message); process.exit(1); }
let usuario = lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
let senha = null;

if (!usuario) {
  senha = senhaProvisoria();
  const { data, error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
  if (error) { console.error('Erro ao criar a conta:', error.message); process.exit(1); }
  usuario = data.user;
} else if (flag === '--nova-senha') {
  senha = senhaProvisoria();
  const { error } = await sb.auth.admin.updateUserById(usuario.id, { password: senha });
  if (error) { console.error('Erro ao trocar a senha:', error.message); process.exit(1); }
}

// 2. Pessoa ligada à conta
const { data: pessoa } = await sb.from('pessoas').select('id').eq('user_id', usuario.id).maybeSingle();
if (!pessoa) {
  const { error } = await sb.from('pessoas').insert({ nome, email, user_id: usuario.id });
  if (error) { console.error('Erro ao salvar o nome:', error.message); process.exit(1); }
}

// 3. Perfis
const { data: atuais } = await sb.from('atribuicoes').select('papel').eq('user_id', usuario.id);
const tem = new Set((atuais ?? []).map((a) => a.papel));
for (const papel of ['admin', 'direcao', 'coordenacao', 'secretaria']) {
  if (tem.has(papel)) continue;
  const { error } = await sb.from('atribuicoes').insert({ user_id: usuario.id, papel, criado_por: usuario.id });
  if (error) { console.error(`Erro ao dar o perfil ${papel}:`, error.message); process.exit(1); }
}

console.log('');
console.log('  Login de administrador pronto');
console.log(`  E-mail: ${email}`);
console.log(senha ? `  Senha provisória: ${senha}` : '  Senha: a mesma de antes (use --nova-senha para gerar outra)');
console.log('  Perfis: Administrador, Direção, Coordenação e Secretaria');
console.log('');
