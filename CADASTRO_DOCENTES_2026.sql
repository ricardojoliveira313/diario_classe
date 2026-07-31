-- ═══════════════════════════════════════════════════════════════════════
-- DIÁRIO DE CLASSE — Cadastro de docentes 2026
-- ═══════════════════════════════════════════════════════════════════════
-- Já executado em produção (documentado aqui para histórico/referência).
-- Cria 43 acessos para as 46 turmas informadas.
-- Cada docente verá somente a aba Faltas e poderá lançar apenas nas suas turmas.
-- Ocorrências não são liberadas aqui: elas podem ser habilitadas depois na tela
-- Gerenciar Usuários > Permissões.
--
-- Regra de login: nome normalizado + @lg.com.br (minúsculas).
-- Regra de senha inicial: NOME + LG (MAIÚSCULAS).
-- Ex.: marialucia@lg.com.br / MARIALUCIALG
--
-- ⚠️ LIMITAÇÃO CONHECIDA: as 3 contas de AEE (carolinaaee, michelleaee,
-- kimberlyaee) foram cadastradas com DUAS turmas cada (ver array `turmas`
-- abaixo), gravadas dentro de `permissoes` como `turma:<uuid>`. O frontend
-- atual (frontend/src/pages/Faltas.tsx) só reconhece UMA turma por usuário
-- via a coluna `turma_id` — a segunda turma de cada uma dessas 3 contas
-- fica com o combo de turma travado, sem conseguir alternar para ela. Se
-- essas professoras precisarem lançar falta nas duas turmas, é necessário
-- criar um segundo acesso para a segunda turma, ou estender o app pra
-- suportar múltiplas turmas por usuário via `permissoes`.
--
-- Segurança:
-- - não cria turmas novas nem altera alunos/faltas existentes;
-- - interrompe tudo se alguma turma não estiver cadastrada;
-- - interrompe tudo se algum desses logins já existir;
-- - não libera acesso direto às tabelas.
--
-- Execute este arquivo inteiro UMA VEZ no SQL Editor do Supabase.

BEGIN;

CREATE TEMP TABLE _turmas_docentes (
  nome TEXT PRIMARY KEY,
  professora TEXT NOT NULL,
  periodo TEXT NOT NULL
);

INSERT INTO _turmas_docentes (nome, professora, periodo) VALUES
  ('1ª ETAPA A', 'Maria Lucia', 'Manhã'),
  ('1ª ETAPA B', 'Denise', 'Manhã'),
  ('1ª ETAPA C', 'Fernanda', 'Manhã'),
  ('1ª ETAPA D', 'Celina', 'Manhã'),
  ('1ª ETAPA E', 'Aline', 'Tarde'),
  ('1ª ETAPA F', 'Andressa', 'Tarde'),
  ('1ª ETAPA G', 'Rosangela', 'Tarde'),
  ('1ª ETAPA H', 'Adriana Zenoides', 'Tarde'),
  ('2ª ETAPA A', 'Liliane', 'Manhã'),
  ('2ª ETAPA B', 'Silvana', 'Manhã'),
  ('2ª ETAPA C', 'Michele', 'Manhã'),
  ('2ª ETAPA D', 'Solange', 'Manhã'),
  ('2ª ETAPA E', 'Sabrina', 'Tarde'),
  ('2ª ETAPA F', 'Angelita', 'Tarde'),
  ('2ª ETAPA G', 'Kamila', 'Tarde'),
  ('2ª ETAPA H', 'Danielle', 'Tarde'),
  ('1º ano A', 'Roseli Pereira', 'Manhã'),
  ('1º ano B', 'Bruna', 'Manhã'),
  ('1º ano C', 'Luciany', 'Tarde'),
  ('1º ano D', 'Silene', 'Tarde'),
  ('1º ano E', 'Bianca', 'Tarde'),
  ('2º ano A', 'Ione', 'Manhã'),
  ('2º ano B', 'Sandra', 'Manhã'),
  ('2º ano C', 'Gilmara', 'Manhã'),
  ('2º ano D', 'Paula', 'Tarde'),
  ('2º ano E', 'Marta', 'Tarde'),
  ('3º ano A', 'Magnus', 'Manhã'),
  ('3º ano B', 'Thabata', 'Manhã'),
  ('3º ano D', 'Adriana Caetano', 'Tarde'),
  ('4º ano A', 'Juliana', 'Manhã'),
  ('4º ano B', 'Camila P', 'Manhã'),
  ('4º ano C', 'Cida Drigo', 'Tarde'),
  ('4º ano D', 'Karine', 'Tarde'),
  ('5º ano A', 'Roseli Zamana', 'Manhã'),
  ('5º ano B', 'Jessica', 'Manhã'),
  ('5º ano C', 'Alessandra', 'Tarde'),
  ('5º ano D', 'Raquel', 'Tarde'),
  ('EJA I – ALFABETIZAÇÃO', 'Maria dos Anjos Ferreira do Carmo', 'Noite'),
  ('EJA I – POS-ALFABETIZAÇÃO', 'Elaine Aparecida da Silva Figueiredo', 'Noite'),
  ('AEE A MANHÃ', 'Carolina', 'Manhã'),
  ('AEE B - MANHÃ', 'Michelle', 'Manhã'),
  ('AEE C MANHÃ', 'Kimberly', 'Manhã'),
  ('AEE D TARDE', 'Michelle', 'Tarde'),
  ('AEE E TARDE', 'Carolina', 'Tarde'),
  ('AEE F TARDE', 'Kimberly', 'Tarde');

-- Antes de qualquer cadastro, confirma que todas as turmas já existem.
DO $$
DECLARE
  turmas_ausentes TEXT;
BEGIN
  SELECT string_agg(d.nome, ', ' ORDER BY d.nome)
    INTO turmas_ausentes
  FROM _turmas_docentes d
  WHERE NOT EXISTS (
    SELECT 1 FROM public."Turma" t WHERE t.nome = d.nome
  );

  IF turmas_ausentes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cadastro cancelado: estas turmas não foram encontradas: %. Nenhum usuário foi criado.',
      turmas_ausentes;
  END IF;
END;
$$;

CREATE TEMP TABLE _usuarios_docentes (
  nome TEXT PRIMARY KEY,
  senha_base TEXT NOT NULL,
  turmas TEXT[] NOT NULL
);

INSERT INTO _usuarios_docentes (nome, senha_base, turmas) VALUES
  ('marialucia@lg.com.br', 'marialucia', ARRAY['1ª ETAPA A']::TEXT[]),
  ('denise@lg.com.br', 'denise', ARRAY['1ª ETAPA B']::TEXT[]),
  ('fernanda@lg.com.br', 'fernanda', ARRAY['1ª ETAPA C']::TEXT[]),
  ('celina@lg.com.br', 'celina', ARRAY['1ª ETAPA D']::TEXT[]),
  ('aline@lg.com.br', 'aline', ARRAY['1ª ETAPA E']::TEXT[]),
  ('andressa@lg.com.br', 'andressa', ARRAY['1ª ETAPA F']::TEXT[]),
  ('rosangela@lg.com.br', 'rosangela', ARRAY['1ª ETAPA G']::TEXT[]),
  ('adrianazenoides@lg.com.br', 'adrianazenoides', ARRAY['1ª ETAPA H']::TEXT[]),
  ('liliane@lg.com.br', 'liliane', ARRAY['2ª ETAPA A']::TEXT[]),
  ('silvana@lg.com.br', 'silvana', ARRAY['2ª ETAPA B']::TEXT[]),
  ('michele@lg.com.br', 'michele', ARRAY['2ª ETAPA C']::TEXT[]),
  ('solange@lg.com.br', 'solange', ARRAY['2ª ETAPA D']::TEXT[]),
  ('sabrina@lg.com.br', 'sabrina', ARRAY['2ª ETAPA E']::TEXT[]),
  ('angelita@lg.com.br', 'angelita', ARRAY['2ª ETAPA F']::TEXT[]),
  ('kamila@lg.com.br', 'kamila', ARRAY['2ª ETAPA G']::TEXT[]),
  ('danielle@lg.com.br', 'danielle', ARRAY['2ª ETAPA H']::TEXT[]),
  ('roselipereira@lg.com.br', 'roselipereira', ARRAY['1º ano A']::TEXT[]),
  ('bruna@lg.com.br', 'bruna', ARRAY['1º ano B']::TEXT[]),
  ('luciany@lg.com.br', 'luciany', ARRAY['1º ano C']::TEXT[]),
  ('silene@lg.com.br', 'silene', ARRAY['1º ano D']::TEXT[]),
  ('bianca@lg.com.br', 'bianca', ARRAY['1º ano E']::TEXT[]),
  ('ione@lg.com.br', 'ione', ARRAY['2º ano A']::TEXT[]),
  ('sandra@lg.com.br', 'sandra', ARRAY['2º ano B']::TEXT[]),
  ('gilmara@lg.com.br', 'gilmara', ARRAY['2º ano C']::TEXT[]),
  ('paula@lg.com.br', 'paula', ARRAY['2º ano D']::TEXT[]),
  ('marta@lg.com.br', 'marta', ARRAY['2º ano E']::TEXT[]),
  ('magnus@lg.com.br', 'magnus', ARRAY['3º ano A']::TEXT[]),
  ('thabata@lg.com.br', 'thabata', ARRAY['3º ano B']::TEXT[]),
  ('adrianacaetano@lg.com.br', 'adrianacaetano', ARRAY['3º ano D']::TEXT[]),
  ('juliana@lg.com.br', 'juliana', ARRAY['4º ano A']::TEXT[]),
  ('camilap@lg.com.br', 'camilap', ARRAY['4º ano B']::TEXT[]),
  ('cidadrigo@lg.com.br', 'cidadrigo', ARRAY['4º ano C']::TEXT[]),
  ('karine@lg.com.br', 'karine', ARRAY['4º ano D']::TEXT[]),
  ('roselizamana@lg.com.br', 'roselizamana', ARRAY['5º ano A']::TEXT[]),
  ('jessica@lg.com.br', 'jessica', ARRAY['5º ano B']::TEXT[]),
  ('alessandra@lg.com.br', 'alessandra', ARRAY['5º ano C']::TEXT[]),
  ('raquel@lg.com.br', 'raquel', ARRAY['5º ano D']::TEXT[]),
  ('mariadosanjos@lg.com.br', 'mariadosanjos', ARRAY['EJA I – ALFABETIZAÇÃO']::TEXT[]),
  ('elaineaparecida@lg.com.br', 'elaineaparecida', ARRAY['EJA I – POS-ALFABETIZAÇÃO']::TEXT[]),
  ('carolinaaee@lg.com.br', 'carolina', ARRAY['AEE A MANHÃ', 'AEE E TARDE']::TEXT[]),
  ('michelleaee@lg.com.br', 'michelle', ARRAY['AEE B - MANHÃ', 'AEE D TARDE']::TEXT[]),
  ('kimberlyaee@lg.com.br', 'kimberly', ARRAY['AEE C MANHÃ', 'AEE F TARDE']::TEXT[]);

-- Evita sobrescrever um usuário que já exista.
DO $$
DECLARE
  usuarios_existentes TEXT;
BEGIN
  SELECT string_agg(d.nome, ', ' ORDER BY d.nome)
    INTO usuarios_existentes
  FROM _usuarios_docentes d
  JOIN public."Usuario" u ON u.nome = d.nome;

  IF usuarios_existentes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cadastro cancelado: estes usuários já existem: %. Nenhum usuário foi criado.',
      usuarios_existentes;
  END IF;
END;
$$;

INSERT INTO public."Usuario" (
  nome,
  senha,
  perfil,
  permissoes,
  turma_id
)
SELECT
  d.nome,
  upper(d.senha_base) || 'LG',
  'viewer',
  jsonb_build_array('faltas') || (
    SELECT jsonb_agg('turma:' || t.id::text ORDER BY array_position(d.turmas, t.nome))
    FROM public."Turma" t
    WHERE t.nome = ANY(d.turmas)
  ),
  (
    SELECT t.id
    FROM public."Turma" t
    WHERE t.nome = d.turmas[1]
    LIMIT 1
  )
FROM _usuarios_docentes d;

COMMIT;

-- Conferência: devem aparecer 43 usuários e suas respectivas turmas.
SELECT
  u.nome AS usuario,
  array_agg(t.nome ORDER BY t.nome) AS turmas_liberadas
FROM public."Usuario" u
JOIN LATERAL jsonb_array_elements_text(u.permissoes) AS permissoes(item) ON TRUE
JOIN public."Turma" t ON t.id::text = replace(permissoes.item, 'turma:', '')
WHERE permissoes.item LIKE 'turma:%'
  AND u.nome IN (
    SELECT nome FROM _usuarios_docentes
  )
GROUP BY u.nome
ORDER BY u.nome;
