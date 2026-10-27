# Sistema Escolar — Instituto Santa Escolástica

Sistema de gestão escolar do Instituto Santa Escolástica (Itapecerica/MG), Educação Infantil a partir de 4 anos.

**Primeira entrega:** base do sistema (login, 10 perfis de acesso, permissões no banco) + cadastro do aluno e fluxo de matrícula.

| Módulo | O que já faz |
| --- | --- |
| Acesso | Login por e-mail e senha, convite por e-mail, definição de senha, menu por perfil |
| Usuários | Administrador convida a equipe e atribui perfis (com turma e componente quando é professor) |
| Matrícula | Ficha Individual completa, número automático (2027-0001), checklist de documentos, fluxo secretaria → direção, enturmação com controle de vagas, linha do tempo |
| Alunos | Lista com alertas de saúde, ficha completa, edição por seção, responsáveis e autorizados a buscar, acesso da família |
| Turmas | Anos letivos (um ativo por vez), turmas por etapa e turno, capacidade |
| Família | Pai, mãe ou responsável legal vê os próprios filhos, a situação da matrícula e os documentos pendentes |

## Tecnologia

- **Next.js 16** (App Router, Server Actions) + TypeScript
- **Supabase**: Postgres, autenticação e **Row Level Security** — as permissões ficam no banco, não só nas telas
- Identidade visual do design system "Instituto Santa Escolástica" (`src/app/tokens.css`)

## Como as permissões funcionam

Cada usuário tem um ou mais **perfis** (tabela `atribuicoes`). Professores e auxiliares têm o perfil ligado a uma **turma**; responsáveis veem os alunos aos quais estão **vinculados**. As políticas de RLS em `supabase/migrations/20261027000003_permissoes.sql` aplicam a matriz da especificação:

| | Direção | Coordenação | Secretaria | Professor | Auxiliar/Portaria | Responsável | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cadastro do aluno | vê | vê | gerencia | vê (turma) | vê (turma) | vê (filhos) | — |
| Saúde e alergias | vê | vê | gerencia | vê (turma) | vê (turma) | vê (filhos) | — |
| Laudo | vê | gerencia | edita | vê (turma) | — | vê (filhos) | — |
| Endereço | vê | vê | gerencia | vê (turma) | — | vê (filhos) | — |
| Matrícula | vê e aprova | vê, enturma | gerencia | — | — | vê (filhos) | — |
| Usuários e perfis | vê | — | contas de famílias | — | — | — | gerencia |
| Auditoria | vê | — | — | — | — | — | vê |

Regras do fluxo de matrícula (no banco, função `mudar_status_matricula`):

- em análise → aguardando direção: só com todos os documentos obrigatórios entregues;
- aguardando direção → matriculado: **só a direção**;
- enturmação: só matriculado, turma do mesmo ano e etapa, com vaga;
- transferência e cancelamento exigem motivo; nada é apagado.

Toda alteração em dados de alunos, matrículas e perfis é gravada na tabela `auditoria`.

## Testar no seu computador (Windows)

Precisa ter instalado: [Docker Desktop](https://www.docker.com/products/docker-desktop) (aberto), [Node.js LTS](https://nodejs.org) e [Git](https://git-scm.com).

```powershell
git clone https://github.com/Escola-Santa-Escolastica/sistema-escolar-santa-escolastica.git
cd sistema-escolar-santa-escolastica
npm run local
```

O script sobe o banco de dados local (Supabase no Docker), aplica as tabelas e permissões, cria turmas de teste, cria o login de administrador e abre http://localhost:3000. A senha provisória aparece no terminal. Para gerar outra: `npm run local -- -NovaSenha`.

| Endereço | O que é |
| --- | --- |
| http://localhost:3000 | O sistema |
| http://localhost:54324 | Caixa de e-mails de teste (convites e troca de senha) |
| http://localhost:54323 | Supabase Studio (ver as tabelas) |

Para parar: `Ctrl+C` e depois `npx supabase stop`. Os dados ficam guardados para a próxima vez.

## Ambiente de teste online (para outras pessoas testarem)

Um site com **dados fictícios** e um login por perfil, para a equipe testar pelo celular ou computador. Uma faixa no topo avisa que é ambiente de teste. Não use para dados reais de crianças.

1. **Supabase:** crie um projeto (região South America – São Paulo). Na sua pasta do projeto, no PowerShell:
   ```powershell
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF   # pede a senha do banco
   npx supabase db push                              # cria tabelas, regras e permissões
   ```
2. **Supabase › Authentication › Sign In / Providers:** desligue *Allow new users to sign up* (deixe o provedor Email ligado).
3. **Vercel:** *Add New › Project*, importe o repositório e cadastre as variáveis de ambiente:

   | Variável | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SECRET_KEY` | Secret key |
   | `NEXT_PUBLIC_SITE_URL` | o endereço que a Vercel der (ex.: https://sistema-escolar.vercel.app) |
   | `NEXT_PUBLIC_AMBIENTE` | `teste` |

4. **Supabase › Authentication › URL Configuration:** *Site URL* = o endereço da Vercel; em *Redirect URLs* adicione `https://SEU-ENDERECO/auth/confirmar`.
5. **Dados de teste:** na pasta do projeto, rode `npm run popular-teste` e informe o Project URL, as duas chaves e uma senha. O script cria 6 logins de teste (direção, coordenação, secretaria, professora, auxiliar e mãe), 9 crianças fictícias com matrículas em situações diferentes e, se quiser, o seu login de administrador. Pode rodar de novo sem duplicar nada.

O plano gratuito do Supabase pausa o projeto depois de 7 dias sem uso; basta reativar no painel.

## Colocando no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. Aplique as migrations, em ordem, com a [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJETO
   npx supabase db push
   ```
   (Ou cole cada arquivo de `supabase/migrations/` no SQL Editor, na ordem dos nomes.)
3. Em **Authentication › Sign In / Providers**, desative "Allow new users to sign up" (as contas são criadas por convite).
4. Em **Authentication › URL Configuration**, coloque o endereço do sistema em *Site URL* e adicione `https://SEU-ENDERECO/auth/confirmar` em *Redirect URLs*.
5. Em **Authentication › Emails**, ajuste os modelos *Invite user* e *Reset password* para usar o link:
   ```
   {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite&proximo=/definir-senha
   ```
   (no de senha, `type=recovery`). Para enviar e-mails de verdade, configure um SMTP próprio (o do Supabase tem limite baixo).

### 2. Primeiro administrador

1. Em **Authentication › Users**, clique em *Add user* e crie sua conta (e-mail e senha).
2. No **SQL Editor**, rode:
   ```sql
   select public.promover_primeiro_admin('seu-email@exemplo.com');
   ```
   (só funciona enquanto não existir nenhum administrador).
3. Entre no sistema e convide a equipe em **Usuários**. O administrador não vê dados das crianças: dê a você também o perfil de Direção, se for o caso.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados de **Project Settings › API Keys**. A `SUPABASE_SECRET_KEY` só existe no servidor (é usada para enviar convites).

### 4. Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Para publicar, a [Vercel](https://vercel.com) funciona sem configuração extra: importe o repositório e cadastre as mesmas variáveis de ambiente.

## Testes do banco

`supabase/tests/` tem 55 verificações das regras de matrícula e de cada perfil da matriz de permissões. Rodam num Postgres local (sem Docker):

```bash
npm run test:db    # requer psql e um Postgres local
```

## Estrutura

```
supabase/migrations/   estrutura, funções, permissões (RLS), API da matrícula, dados de referência
supabase/tests/        testes de permissões e do fluxo de matrícula
src/proxy.ts           renova a sessão e exige login
src/lib/               sessão, perfis, validação da ficha, formatação
src/components/        componentes do design system (Botao, Selo, Campo, CartaoAluno…)
src/app/(escola)/      painel da escola: início, alunos, matrículas, turmas, usuários
src/app/familia/       área da família
```

## Próximas entregas

Frequência diária, documentos oficiais em PDF (declarações e histórico), comunicados, relatórios da Educação Infantil. Pendências levantadas na especificação: confirmar o órgão que supervisiona a escola, preencher os atos autorizativos e unificar "Ciências" / "Ciências da Natureza".
