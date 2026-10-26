-- =====================================================================
-- 005 · Dados de referência (vão para produção)
-- Etapas, componentes do boletim/histórico, documentos exigidos na matrícula
-- e o primeiro ano letivo. Tudo pode ser ajustado depois pelas telas.
-- =====================================================================

insert into public.etapas (nome, modalidade, idade_referencia, ordem) values
  ('Pré I', 'Educação Infantil', 4, 1),
  ('Pré II', 'Educação Infantil', 5, 2);

-- Mesma ordem do Boletim Escolar. "Ciências" unificado (o histórico usa
-- "Ciências da Natureza"; decidir um nome só — ver especificação).
insert into public.componentes (nome, area, ordem) values
  ('Língua Portuguesa', 'base_comum', 1),
  ('Matemática', 'base_comum', 2),
  ('Ciências', 'base_comum', 3),
  ('História', 'base_comum', 4),
  ('Geografia', 'base_comum', 5),
  ('Língua Inglesa', 'base_comum', 6),
  ('Arte', 'base_comum', 7),
  ('Educação Física', 'base_comum', 8),
  ('Ensino Religioso', 'base_comum', 9),
  ('Música', 'diversificada', 10),
  ('Robótica / Cultura Maker', 'diversificada', 11);

insert into public.tipos_documento (nome, obrigatorio, ordem) values
  ('Certidão de nascimento', true, 1),
  ('CPF ou CIN do aluno', true, 2),
  ('Documento de identidade do responsável', true, 3),
  ('Comprovante de endereço', true, 4),
  ('Cartão de vacina', true, 5),
  ('Foto 3x4', false, 6),
  ('Laudo (se houver)', false, 7),
  ('Declaração de transferência (se veio de outra escola)', false, 8);

insert into public.anos_letivos (ano, ativo) values (2027, true);
