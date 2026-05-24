-- ============================================================
-- TABELA COMPLETA DE PROFESSORES — para consulta e referência
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS "ProfessorMapping" (
  id          SERIAL PRIMARY KEY,
  turma_nome  TEXT NOT NULL,
  professor   TEXT NOT NULL,
  periodo     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Limpa para reinserir (pode rodar quantas vezes quiser)
DELETE FROM "ProfessorMapping";

INSERT INTO "ProfessorMapping" (turma_nome, professor, periodo) VALUES
-- 1ª ETAPA PRÉ-ESCOLA
('1ª ETAPA A',            'MARIA LUCIA',                     'Manhã'),
('1ª ETAPA B',            'DENISE',                          'Manhã'),
('1ª ETAPA C',            'FERNANDA',                        'Manhã'),
('1ª ETAPA D',            'CELINA',                          'Manhã'),
('1ª ETAPA E',            'DEBORA',                          'Tarde'),
('1ª ETAPA F',            'ANDRESSA',                        'Tarde'),
('1ª ETAPA G',            'ROSANGELA',                       'Tarde'),
('1ª ETAPA H',            'ADRIANA ZENOIDES',                'Tarde'),

-- 2ª ETAPA PRÉ-ESCOLA
('2ª ETAPA A',            'LILIANE',                         'Manhã'),
('2ª ETAPA B',            'SILVANA',                         'Manhã'),
('2ª ETAPA C',            'MICHELE',                         'Manhã'),
('2ª ETAPA D',            'SOLANGE',                         'Manhã'),
('2ª ETAPA E',            'SABRINA',                         'Tarde'),
('2ª ETAPA F',            'ANGELITA',                        'Tarde'),
('2ª ETAPA G',            'KAMILA',                          'Tarde'),
('2ª ETAPA H',            'DANIELLE',                        'Tarde'),

-- 1º ANO
('1º ANO A',              'ROSELI PEREIRA',                  'Manhã'),
('1º ANO B',              'BRUNA',                           'Manhã'),
('1º ANO C',              'LUCIANY',                         'Tarde'),
('1º ANO D',              'SILENE',                          'Tarde'),
('1º ANO E',              'BIANCA',                          'Tarde'),

-- 2º ANO
('2º ANO A',              'IONE',                            'Manhã'),
('2º ANO B',              'SANDRA',                          'Manhã'),
('2º ANO C',              'GILMARA',                         'Manhã'),
('2º ANO D',              'PAULA',                           'Tarde'),
('2º ANO E',              'MARTA',                           'Tarde'),

-- 3º ANO
('3º ANO A',              'MAGNUS',                          'Manhã'),
('3º ANO B',              'THABATA',                         'Manhã'),
('3º ANO C',              'CÁTIA',                           'Tarde'),
('3º ANO D',              'ADRIANA CAETANO',                 'Tarde'),

-- 4º ANO
('4º ANO A',              'JULIANA',                         'Manhã'),
('4º ANO B',              'CAMILA P',                        'Manhã'),
('4º ANO C',              'CIDA DRIGO',                      'Tarde'),
('4º ANO D',              'KARINE',                          'Tarde'),

-- 5º ANO
('5º ANO A',              'ROSELI ZAMANA',                   'Manhã'),
('5º ANO B',              'JESSICA',                         'Manhã'),
('5º ANO C',              'ALESSANDRA',                      'Tarde'),
('5º ANO D',              'RAQUEL',                          'Tarde'),

-- EJA
('EJA I A',               'ELAINE APARECIDA DA SILVA FIGUEIREDO', 'Noturno'),
('EJA I B',               'MARIA DOS ANJOS FERREIRA DO CARMO',    'Noturno'),
('EJA I - PÓS-ALFABETIZAÇÃO', 'ELAINE APARECIDA DA SILVA FIGUEIREDO', 'Noturno');

SELECT * FROM "ProfessorMapping" ORDER BY id;
