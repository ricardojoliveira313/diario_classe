import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(tmpdir(), `mapa-eja-${process.pid}.mjs`);

try {
  await build({
    entryPoints: [path.join(raiz, 'src/mapaEja.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  });
  const { calcularMapaEja, calcularIdade, faixaEtariaDe, ehTurmaEja, cicloEjaDaTurma } = await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

  assert.equal(ehTurmaEja('EJA I – ALFABETIZAÇÃO'), true);
  assert.equal(ehTurmaEja('1ª ETAPA A'), false);
  assert.equal(cicloEjaDaTurma('EJA I – POS-ALFABETIZAÇÃO'), 'POS');
  assert.equal(cicloEjaDaTurma('EJA I – ALFABETIZAÇÃO'), 'ALFA');

  const hoje = new Date(2026, 8, 8); // 08/09/2026
  const idade50 = calcularIdade('10/05/1976', hoje);
  assert.equal(idade50, 50, 'idade calculada deve considerar se já fez aniversário no ano');
  assert.equal(faixaEtariaDe(50), '40 a 59');
  assert.equal(faixaEtariaDe(16), '15 a 17');
  assert.equal(faixaEtariaDe(65), 'acima de 60 anos');
  assert.equal(faixaEtariaDe(null), 'Não informada');

  const turmas = [
    { id: 'alfa', nome: 'EJA I – ALFABETIZAÇÃO', professora: 'Prof A', periodo: 'Noite' },
    { id: 'pos', nome: 'EJA I – POS-ALFABETIZAÇÃO', professora: 'Prof B', periodo: 'Noite' },
    { id: 'infantil', nome: '1ª ETAPA A', professora: 'Prof C', periodo: 'Manhã' },
  ];
  const alunos = [
    { id: '1', ra: 1, nome: 'ATIVO ANTIGO', turmaId: 'alfa', situacao: 'ATIVO', data_nascimento: '10/05/1976', data_inicio_matricula: '04/02/2026', deficiencia: 'AUTISTA INFANTIL' },
    { id: '2', ra: 2, nome: 'MATRICULA NOVA', turmaId: 'alfa', situacao: 'ATIVO', data_nascimento: '01/01/2000', data_inicio_matricula: '05/09/2026' },
    { id: '3', ra: 3, nome: 'EVADIDO', turmaId: 'alfa', situacao: 'ABAN', data_nascimento: '01/01/1990', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/09/2026' },
    { id: '4', ra: 4, nome: 'TRANSFERIDO', turmaId: 'pos', situacao: 'TRAN', data_nascimento: '01/01/1985', data_inicio_matricula: '04/02/2026', data_fim_matricula: '10/06/2026' },
    { id: '5', ra: 5, nome: 'RECLASSIFICADO', turmaId: 'pos', situacao: 'CLASSIFICADO', data_nascimento: '01/01/1995', data_inicio_matricula: '04/02/2026' },
    { id: '6', ra: 6, nome: 'ALUNO INFANTIL', turmaId: 'infantil', situacao: 'ATIVO', data_nascimento: '01/01/2021', data_inicio_matricula: '04/02/2026' },
  ];

  const resumo = calcularMapaEja(alunos, turmas, 9, 2026, hoje);
  assert.equal(resumo.linhas.length, 2, 'só deve considerar as 2 turmas de EJA, não o Infantil');

  const alfa = resumo.linhas.find(l => l.turmaId === 'alfa');
  assert.equal(alfa.alunosFrequentes, 2, 'ativo antigo + matrícula nova');
  assert.equal(alfa.matriculaNova, 1, 'só quem entrou dentro do mês de setembro conta como matrícula nova');
  assert.equal(alfa.vieramDoMesAnterior, 1);
  assert.equal(alfa.evasao, 1);
  assert.equal(alfa.evadidoMes, 1, 'saída em setembro deve contar no mês');
  assert.equal(alfa.cade, 1, 'CADE deve ser automático a partir do campo deficiencia vindo da SED, sem conferência manual');

  const pos = resumo.linhas.find(l => l.turmaId === 'pos');
  assert.equal(pos.transferencia, 1);
  assert.equal(pos.transferidoMes, 0, 'saída de junho não deve contar no mês de setembro');
  assert.equal(pos.reclassificados, 1, 'situação CLASSIFICADO deve contar como reclassificado');

  const faixa50 = resumo.faixaEtaria.find(f => f.label === '40 a 59');
  assert.equal(faixa50.atendimento, 1, 'aluno ativo de 50 anos deve entrar na faixa 40 a 59');

  console.log('Teste do Mapa EJA: OK');
} finally {
  await rm(bundle, { force: true });
}
