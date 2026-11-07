/**
 * Conteúdo fixo do site público. Para mudar um texto do site, edite aqui.
 * Campos `null` não aparecem na página (nada de "[a definir]" para o visitante).
 */
export const SITE = {
  nome: 'Instituto Santa Escolástica',
  lema: 'FÉ · VIRTUDE · SABEDORIA',
  cidade: 'Itapecerica/MG',
  endereco: 'Rua Rodrigues Pereira, 327 · Itapecerica/MG',
  telefone: '(37) 99128-9366',
  telefoneLink: '+5537991289366',
  whatsappLink: 'https://wa.me/5537991289366',
  /** Ex.: 'Segunda a sexta, das 7h30 às 17h' */
  atendimento: null as string | null,
  /** Ex.: '00.000.000/0001-00' */
  cnpj: null as string | null,
  /** Ex.: 'Autorizada pela Portaria SEE nº …' */
  atosAutorizativos: null as string | null,

  chamada: 'Fé, virtude e sabedoria desde os primeiros anos.',
  subtitulo: 'Uma escola católica de Educação Infantil para crianças a partir de 4 anos, com atenção a cada criança e a família por perto em cada etapa.',

  matriculas: {
    ano: 2027,
    /** Ex.: 'de 1º de dezembro a 31 de janeiro' — enquanto for null, aparece "em breve" */
    periodo: null as string | null,
  },

  apresentacaoTitulo: 'Educar a criança inteira: o coração, o caráter e a inteligência.',
  apresentacao: [
    'O Instituto Santa Escolástica é uma escola católica de Educação Infantil em Itapecerica, para crianças de 4 e 5 anos.',
    'Na Educação Infantil, cada dia combina brincadeira, rotina, oração e descoberta, sempre em parceria com os pais.',
  ],

  pilares: [
    { nome: 'Fé', cor: 'verde', texto: 'A vida cristã no dia a dia: oração, sacramentos e as festas do ano litúrgico vividas com as famílias.' },
    { nome: 'Virtude', cor: 'dourado', texto: 'Bons hábitos desde cedo: ordem, gentileza, cuidado com o outro e responsabilidade pelas próprias coisas.' },
    { nome: 'Sabedoria', cor: 'azul', texto: 'Curiosidade, linguagem e pensamento: brincar, ouvir histórias, contar, cantar e descobrir o mundo.' },
  ],

  etapas: [
    { idade: 4, nome: 'Pré I', texto: 'Rotina acolhedora, brincadeiras, movimento, música e os primeiros contatos com letras e números.' },
    { idade: 5, nome: 'Pré II', texto: 'Mais autonomia, linguagem oral e escrita, raciocínio e a preparação para o 1º ano do Ensino Fundamental.' },
  ],
  turnos: 'Turnos da manhã e da tarde',

  padroeira: 'Irmã de São Bento, viveu na Itália do século VI dedicada a Deus na vida religiosa. Sua festa é celebrada em 10 de fevereiro, um dia especial no calendário da escola.',
} as const;

export const TIPO_PUBLICACAO = {
  noticia: { rotulo: 'Notícia', plural: 'Notícias', tom: 'dourado' },
  evento: { rotulo: 'Evento', plural: 'Eventos', tom: 'verde' },
  comunicado: { rotulo: 'Comunicado', plural: 'Comunicados', tom: 'neutro' },
} as const;
export type TipoPublicacao = keyof typeof TIPO_PUBLICACAO;

export const VISIBILIDADE = {
  publico: 'Todos (site público)',
  familias: 'Só as famílias da escola',
  turma: 'Só as famílias de uma turma',
} as const;
export type Visibilidade = keyof typeof VISIBILIDADE;

export type Publicacao = {
  id: string; tipo: TipoPublicacao; titulo: string; slug: string; resumo: string; texto: string;
  evento_data: string | null; evento_inicio: string | null; evento_fim: string | null; evento_local: string | null;
  visibilidade: Visibilidade; turma_id: string | null; status: 'rascunho' | 'publicada'; publicar_em: string | null;
  created_at: string; updated_at: string;
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/** aaaa-mm-dd → "10 de fevereiro de 2027" */
export function dataPorExtenso(iso: string, comDiaDaSemana = false) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${comDiaDaSemana ? `${DIAS[dow]}, ` : ''}${d} de ${MESES[m - 1]} de ${a}`;
}

/** timestamp → data no fuso da escola (aaaa-mm-dd) */
export function dataLocal(ts: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts));
}

export function diaMes(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return { dia: String(d), mes: MESES_CURTOS[m - 1] };
}

export function hora(t: string | null) {
  if (!t) return null;
  const [h, mi] = t.split(':');
  return mi === '00' ? `${Number(h)}h` : `${Number(h)}h${mi}`;
}

/** Título → endereço da notícia ("Festa de Santa Escolástica" → "festa-de-santa-escolastica") */
export function criarSlug(titulo: string) {
  return titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'publicacao';
}

export function soDigitosTel(v: string) {
  return v.replace(/\D/g, '');
}

/** Rascunho, agendada (vai ao ar depois) ou no ar. */
export function situacaoPublicacao(p: Pick<Publicacao, 'status' | 'publicar_em'>) {
  if (p.status === 'rascunho') return { chave: 'rascunho', rotulo: 'Rascunho', tom: 'neutro' as const };
  if (p.publicar_em && new Date(p.publicar_em).getTime() > Date.now()) return { chave: 'agendada', rotulo: 'Agendada', tom: 'dourado' as const };
  return { chave: 'publicada', rotulo: 'No ar', tom: 'verde' as const };
}

