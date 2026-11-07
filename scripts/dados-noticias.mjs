// Publicações e pedidos de visita FICTÍCIOS para o ambiente de teste.
// Usado por noticias-exemplo.mjs e popular-teste.mjs.

/** Soma dias a uma data "AAAA-MM-DD" (sem fuso). */
function somarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Próximo sábado depois de `semanas` semanas. */
function sabado(hoje, semanas) {
  const d = new Date(`${hoje}T12:00:00Z`);
  const ate = (6 - d.getUTCDay() + 7) % 7 || 7;
  return somarDias(hoje, ate + 7 * semanas);
}
/** Data e hora de Itapecerica (UTC-3) em ISO, `dias` atrás. */
function haDias(hoje, dias, hora = '10:00') {
  return new Date(`${somarDias(hoje, -dias)}T${hora}:00-03:00`).toISOString();
}

export function publicacoesExemplo(hoje, turmas) {
  return [
    {
      slug: 'exemplo-festa-da-familia', tipo: 'evento', titulo: 'Festa da Família (exemplo)',
      evento_data: sabado(hoje, 2), evento_inicio: '09:00', evento_fim: '11:30', evento_local: 'Pátio da escola',
      resumo: 'Uma manhã de brincadeiras, apresentações das turmas e lanche partilhado. Publicação de teste.',
      texto: 'Este é um texto de exemplo do ambiente de teste.\n\nAs famílias são convidadas para uma manhã de convivência na escola, com apresentações do Pré I e do Pré II.\n\nCada família pode trazer um prato doce ou salgado para o lanche partilhado.',
      publicar_em: haDias(hoje, 1),
    },
    {
      slug: 'exemplo-missa-de-encerramento', tipo: 'evento', titulo: 'Missa de encerramento do ano (exemplo)',
      evento_data: sabado(hoje, 5), evento_inicio: '18:00', evento_fim: null, evento_local: 'Igreja Matriz',
      resumo: 'Celebração de ação de graças com as crianças, as famílias e a equipe. Publicação de teste.',
      texto: 'Texto de exemplo do ambiente de teste.\n\nAs crianças vão participar do ofertório com as turmas.',
      publicar_em: haDias(hoje, 2),
    },
    {
      slug: 'exemplo-projeto-horta', tipo: 'noticia', titulo: 'Projeto horta: as crianças plantaram (exemplo)',
      resumo: 'O Pré I começou a cuidar de uma pequena horta no pátio. Publicação de teste.',
      texto: 'Texto de exemplo do ambiente de teste.\n\nCada criança ficou responsável por regar uma muda durante a semana.\n\nNo fim do mês, a colheita vai para o lanche da turma.',
      publicar_em: haDias(hoje, 4),
    },
    {
      slug: 'exemplo-semana-da-leitura', tipo: 'noticia', titulo: 'Semana da leitura no Pré II (exemplo)',
      resumo: 'Contação de histórias, empréstimo de livros e uma visita da biblioteca municipal. Publicação de teste.',
      texto: 'Texto de exemplo do ambiente de teste.\n\nAs crianças levaram um livro para ler em casa com a família.',
      publicar_em: haDias(hoje, 9),
    },
    {
      slug: 'exemplo-matriculas-2027', tipo: 'comunicado', titulo: 'Matrículas 2027: como vai funcionar (exemplo)',
      resumo: 'As datas e os documentos da matrícula serão divulgados aqui. Publicação de teste.',
      texto: 'Texto de exemplo do ambiente de teste.\n\nTenha em mãos a certidão de nascimento, o cartão de vacina e um comprovante de endereço.',
      publicar_em: haDias(hoje, 6),
    },
    {
      slug: 'exemplo-aviso-dia-do-brinquedo', tipo: 'comunicado', titulo: 'Dia do brinquedo no Pré II (exemplo)',
      visibilidade: 'turma', turma_id: turmas['Pré II · Manhã'],
      resumo: 'Na sexta, cada criança pode trazer um brinquedo de casa. Aviso de teste só para as famílias do Pré II · Manhã.',
      texto: 'Mande o brinquedo com o nome da criança. Evite brinquedos pequenos ou que façam barulho.',
      publicar_em: haDias(hoje, 0, '08:00'),
    },
    {
      slug: 'exemplo-aviso-reuniao-pre-i', tipo: 'comunicado', titulo: 'Reunião de famílias do Pré I (exemplo)',
      visibilidade: 'turma', turma_id: turmas['Pré I · Manhã'],
      resumo: 'Reunião na quinta, às 17h30, na sala da turma. Aviso de teste só para o Pré I · Manhã.',
      texto: '', publicar_em: haDias(hoje, 1),
    },
    {
      slug: 'exemplo-aviso-uniforme', tipo: 'comunicado', titulo: 'Uniforme de verão (exemplo)', visibilidade: 'familias',
      resumo: 'A partir da próxima semana, as crianças podem vir de bermuda e camiseta do uniforme. Aviso de teste para todas as famílias.',
      texto: '', publicar_em: haDias(hoje, 3),
    },
    {
      slug: 'exemplo-rascunho-feira-de-ciencias', tipo: 'evento', titulo: 'Feira de ciências (rascunho de exemplo)', status: 'rascunho',
      evento_data: sabado(hoje, 8), resumo: 'Rascunho de teste: não deve aparecer no site até a coordenação publicar.', texto: '', publicar_em: null,
    },
  ];
}

export const PEDIDOS_EXEMPLO = [
  { nome: 'Exemplo — Fernanda Teixeira', telefone: '37900000001', idade_crianca: '4 anos (Pré I)' },
  { nome: 'Exemplo — Rodrigo Campos', telefone: '37900000002', idade_crianca: '5 anos (Pré II)' },
];
