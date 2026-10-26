-- =====================================================================
-- Sistema Escolar — Instituto Santa Escolástica
-- 001 · Estrutura: tipos, tabelas e índices
--
-- Princípios:
--   * Pessoa ≠ usuário: toda pessoa (aluno, pai, funcionário) está em
--     public.pessoas; só quem tem login aponta para auth.users.
--   * Tudo que muda a cada ano pertence a uma Matrícula (aluno + ano letivo).
--   * Nada é apagado: alunos e matrículas mudam de situação.
-- =====================================================================

-- ---------- Tipos ----------------------------------------------------

create type public.papel as enum (
  'admin',                  -- TI: usuários e configurações; sem dados pedagógicos
  'direcao',                -- direção / mantenedora
  'coordenacao',            -- coordenação pedagógica
  'secretaria',             -- secretaria escolar
  'financeiro',             -- fase 3
  'professor_regente',      -- escopo: turma
  'professor_especialista', -- escopo: turma + componente
  'auxiliar',               -- auxiliar de sala / portaria; escopo: turma
  'responsavel',            -- família; escopo: vínculos com alunos
  'aluno'                   -- futuro (Ensino Fundamental)
);

create type public.sexo as enum ('masculino', 'feminino');

create type public.cor_raca as enum ('branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_declarada');

create type public.turno as enum ('manha', 'tarde', 'integral');

create type public.status_matricula as enum (
  'pre_matricula',        -- preenchida pela família ou pela secretaria
  'em_analise',           -- secretaria conferindo
  'pendente_documento',   -- falta documento obrigatório
  'aguardando_aprovacao', -- documentos ok, aguardando a direção
  'matriculado',          -- aprovada pela direção
  'transferido',
  'concluido',
  'cancelado'
);

create type public.status_documento as enum ('pendente', 'entregue', 'dispensado');

create type public.area_componente as enum ('base_comum', 'diversificada');

-- ---------- Configuração da escola (linha única) ----------------------

create table public.escola (
  id boolean primary key default true check (id), -- garante uma única linha
  nome text not null default 'Instituto Santa Escolástica',
  endereco text not null default 'Rua Rodrigues Pereira, 327',
  cidade text not null default 'Itapecerica',
  uf char(2) not null default 'MG',
  telefone text default '(37) 99128-9366',
  atos_autorizativos text, -- obrigatório antes de emitir documentos oficiais
  updated_at timestamptz not null default now()
);
insert into public.escola default values;

-- ---------- Pessoas ---------------------------------------------------

create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nome text not null check (length(trim(nome)) > 1),
  nome_social text,
  data_nascimento date,
  sexo public.sexo,
  cpf text unique check (cpf ~ '^[0-9]{11}$'),
  rg text,
  rg_orgao_expedidor text,
  rg_data_emissao date,
  cin text,
  profissao text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.pessoas.cpf is 'Somente dígitos (11). Com a CIN, o CPF é o número do documento.';

-- ---------- Alunos e dados da Ficha Individual ------------------------

create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null unique references public.pessoas (id),
  foto_path text,
  naturalidade text,
  nacionalidade text not null default 'Brasileira',
  cor_raca public.cor_raca,
  tipo_sanguineo text check (tipo_sanguineo in ('A', 'B', 'AB', 'O')),
  fator_rh text check (fator_rh in ('+', '-')),
  numero_sus text,
  nis text,
  -- 5. Convênios e transporte
  transporte_escolar boolean not null default false,
  bolsa_familia boolean not null default false,
  ensino_religioso boolean not null default true,
  dispensa_educacao_fisica text, -- motivo; null = não dispensado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enderecos (
  aluno_id uuid primary key references public.alunos (id) on delete cascade,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf char(2),
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  telefone_residencial text,
  telefone_celular text,
  updated_at timestamptz not null default now()
);

-- Separada de alunos para ter regra de acesso própria (dado sensível).
create table public.saude_alunos (
  aluno_id uuid primary key references public.alunos (id) on delete cascade,
  problema_saude text,        -- null = não possui
  alergias text,
  medicamento_continuo text,
  restricao_alimentar text,
  convenio text,
  convenio_carteirinha text,
  observacoes text,
  emergencia_nome text,
  emergencia_telefone text,
  updated_at timestamptz not null default now()
);

-- Laudo e atendimento especializado: auxiliares e portaria não acessam.
create table public.atendimentos_especializados (
  aluno_id uuid primary key references public.alunos (id) on delete cascade,
  possui_laudo boolean not null default false,
  laudo_descricao text,
  acompanha_atendimento boolean not null default false,
  atendimento_descricao text,
  observacoes_pedagogicas text,
  updated_at timestamptz not null default now()
);

-- Pai, mãe, responsáveis, autorizados a buscar e contatos de emergência.
create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  pessoa_id uuid not null references public.pessoas (id),
  parentesco text not null,                         -- "Mãe", "Avó", "Tio"…
  filiacao text check (filiacao in ('pai', 'mae')),  -- aparece como filiação nos documentos
  responsavel_legal boolean not null default false,
  responsavel_financeiro boolean not null default false,
  pode_buscar boolean not null default false,
  contato_emergencia boolean not null default false,
  created_at timestamptz not null default now(),
  unique (aluno_id, pessoa_id)
);
create unique index vinculos_uma_filiacao_por_tipo on public.vinculos (aluno_id, filiacao) where filiacao is not null;
create index vinculos_pessoa_idx on public.vinculos (pessoa_id);

-- ---------- Estrutura acadêmica ----------------------------------------

create table public.anos_letivos (
  id uuid primary key default gen_random_uuid(),
  ano int not null unique check (ano between 2024 and 2100),
  inicio date,
  fim date,
  ativo boolean not null default false, -- o ano corrente das telas e permissões
  check (fim is null or inicio is null or fim > inicio)
);
create unique index anos_letivos_um_ativo on public.anos_letivos (ativo) where ativo;

create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,           -- "Pré I"
  modalidade text not null,            -- "Educação Infantil"
  idade_referencia int,                -- 4
  ordem int not null
);

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  ano_letivo_id uuid not null references public.anos_letivos (id),
  etapa_id uuid not null references public.etapas (id),
  nome text not null,                  -- "Pré II · Manhã"
  turno public.turno not null,
  capacidade int not null default 20 check (capacidade > 0),
  unique (ano_letivo_id, nome)
);

create table public.componentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  area public.area_componente not null,
  ordem int not null
);

-- ---------- Matrícula ---------------------------------------------------

create table public.matriculas (
  id uuid primary key default gen_random_uuid(),
  numero text unique,                                 -- gerado: 2027-0001
  aluno_id uuid not null references public.alunos (id),
  ano_letivo_id uuid not null references public.anos_letivos (id),
  etapa_id uuid not null references public.etapas (id), -- etapa pretendida
  turno_pretendido public.turno not null,
  turma_id uuid references public.turmas (id),        -- enturmação
  status public.status_matricula not null default 'pre_matricula',
  data_matricula date,                                -- preenchida na aprovação
  instituicao_origem text,
  ultimo_ano_cursado text,
  motivo_saida text,                                  -- transferência / cancelamento
  observacoes text,
  aprovado_por uuid references auth.users (id),
  aprovado_em timestamptz,
  criado_por uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Uma matrícula viva por aluno e ano letivo.
create unique index matriculas_uma_por_ano on public.matriculas (aluno_id, ano_letivo_id)
  where status <> 'cancelado';
create index matriculas_turma_idx on public.matriculas (turma_id) where turma_id is not null;
create index matriculas_status_idx on public.matriculas (ano_letivo_id, status);

create table public.matricula_contadores (
  ano int primary key,
  ultimo int not null default 0
);

create table public.tipos_documento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  obrigatorio boolean not null default true,
  ordem int not null
);

create table public.documentos_entregues (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  tipo_id uuid not null references public.tipos_documento (id),
  status public.status_documento not null default 'pendente',
  arquivo_path text,
  observacao text,
  conferido_por uuid references auth.users (id),
  conferido_em timestamptz,
  unique (matricula_id, tipo_id)
);

-- Linha do tempo da matrícula (quem mudou a situação, quando e por quê).
create table public.matricula_eventos (
  id bigint generated always as identity primary key,
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  de public.status_matricula,
  para public.status_matricula not null,
  observacao text,
  por uuid references auth.users (id) default auth.uid(),
  em timestamptz not null default now()
);
create index matricula_eventos_idx on public.matricula_eventos (matricula_id, em);

-- ---------- Acesso: papéis e escopos ------------------------------------

create table public.atribuicoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel not null,
  turma_id uuid references public.turmas (id),
  componente_id uuid references public.componentes (id),
  ativo boolean not null default true,
  criado_por uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  -- professores e auxiliares sempre têm turma; especialista também tem componente
  check (papel not in ('professor_regente', 'professor_especialista', 'auxiliar') or turma_id is not null),
  check (papel <> 'professor_especialista' or componente_id is not null),
  check (papel in ('professor_regente', 'professor_especialista', 'auxiliar') or (turma_id is null and componente_id is null))
);
create unique index atribuicoes_unicas on public.atribuicoes
  (user_id, papel, coalesce(turma_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(componente_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index atribuicoes_user_idx on public.atribuicoes (user_id) where ativo;

-- ---------- Auditoria -----------------------------------------------------

create table public.auditoria (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid(),
  acao text not null,           -- INSERT | UPDATE | DELETE
  tabela text not null,
  registro_id text,
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);
create index auditoria_registro_idx on public.auditoria (tabela, registro_id, em desc);
