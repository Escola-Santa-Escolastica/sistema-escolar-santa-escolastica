// =====================================================================
// Coloca notícias, eventos, avisos e pedidos de visita de EXEMPLO no
// ambiente de teste. Só ADICIONA: não apaga nem altera nada, não mexe em
// logins, senhas, crianças, matrículas ou frequência. Pode rodar de novo:
// o que já existe é pulado.
//
// Uso (na pasta do projeto):  npm run noticias-exemplo
// Pede o endereço do projeto e a Secret key (Project Settings › API Keys).
// =====================================================================
import { createInterface } from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { publicacoesExemplo, PEDIDOS_EXEMPLO } from './dados-noticias.mjs';

const rl = createInterface({ input: process.stdin, terminal: false });
const linhas = [];
const esperando = [];
let fim = false;
rl.on('line', (l) => (esperando.length ? esperando.shift()(l) : linhas.push(l)));
rl.on('close', () => { fim = true; while (esperando.length) esperando.shift()(''); });
async function perguntar(texto, padrao) {
  process.stdout.write(padrao ? `${texto} [${padrao}]: ` : `${texto}: `);
  const l = linhas.length ? linhas.shift() : fim ? '' : await new Promise((r) => esperando.push(r));
  return l.trim() || padrao || '';
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
function sair(msg) {
  console.error(`\nERRO: ${msg}`);
  rl.close();
  process.exit(1);
}
function ok(r, msg) {
  if (r.error) sair(`${msg} (${r.error.message})`);
  return r.data;
}

const local = lerEnvLocal();
const url = (process.env.SUPABASE_URL || await perguntar('Endereço do projeto (Project URL), ex.: https://xxxx.supabase.co')).replace(/\/+$/, '');
const usaLocal = Boolean(url) && url === (local.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const chave = process.env.SUPABASE_SECRET_KEY || (usaLocal ? local.SUPABASE_SECRET_KEY : await perguntar('Chave secreta (Secret key) — cole da página API Keys'));
if (!url || !chave) sair('Faltou o endereço ou a chave secreta.');
const conf = process.argv.includes('--sim') ? 's'
  : await perguntar(`\nVai ADICIONAR publicações e pedidos de visita de exemplo em ${url} (nada é apagado). Este é o ambiente de TESTE? (s/n)`, 'n');
rl.close();
if (!/^s/i.test(conf)) sair('Cancelado.');

const db = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

// Turmas do ano ativo (para os avisos de turma)
const ano = ok(await db.from('anos_letivos').select('id').eq('ativo', true).maybeSingle(), 'Não consegui ler o ano letivo (a chave está certa?)');
const turmas = {};
if (ano) for (const t of ok(await db.from('turmas').select('id, nome').eq('ano_letivo_id', ano.id), 'Erro ao ler as turmas')) turmas[t.nome] = t.id;

// Autor: a direção de teste, se existir
const direcao = ok(await db.from('pessoas').select('user_id').eq('email', 'direcao@teste.santaescolastica.example').not('user_id', 'is', null).maybeSingle(),
  'Erro ao procurar o login da direção');

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
let criadas = 0, puladas = 0;
console.log('\nPublicações');
for (const p of publicacoesExemplo(hoje, turmas)) {
  if (p.visibilidade === 'turma' && !p.turma_id) { console.log(`   pulei "${p.titulo}": turma não encontrada`); puladas++; continue; }
  const ja = ok(await db.from('publicacoes').select('id').eq('slug', p.slug).maybeSingle(), 'Erro ao ler publicações (rodou o npx supabase db push?)');
  if (ja) { puladas++; continue; }
  ok(await db.from('publicacoes').insert({ visibilidade: 'publico', status: 'publicada', autor: direcao?.user_id ?? null, ...p }), `Erro ao criar "${p.titulo}"`);
  console.log(`   + ${p.titulo}`);
  criadas++;
}
console.log(`   ${criadas} criada(s), ${puladas} já existia(m)`);

console.log('Pedidos de visita');
let pedidos = 0;
for (const v of PEDIDOS_EXEMPLO) {
  const ja = ok(await db.from('pedidos_visita').select('id').eq('nome', v.nome).limit(1), 'Erro ao ler pedidos de visita');
  if (ja.length) continue;
  ok(await db.from('pedidos_visita').insert({ ...v, consentimento: true }), `Erro ao criar o pedido de ${v.nome}`);
  pedidos++;
}
console.log(`   ${pedidos} criado(s)${pedidos === 0 ? ' (já existiam)' : ''}`);
console.log('\nPronto. Nada foi apagado ou alterado.');
